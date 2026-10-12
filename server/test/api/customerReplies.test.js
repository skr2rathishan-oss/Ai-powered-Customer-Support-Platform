process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { createAccessToken } = require("../../src/utils/token");
const { getAuthConfig } = require("../../src/config/auth");

const ctx = {
  userId: 20,
  firstName: "Casey",
  lastName: "Customer",
  email: "casey@customer.test",
  userStatus: "Active",
  roleName: "Customer",
  companyId: 7,
  companyName: "Acme",
  companyStatus: "Active",
};

const row = (overrides = {}) => ({
  ticketId: 5,
  companyId: 7,
  customerId: 20,
  subject: "Broken",
  description: "It is broken",
  status: "Open",
  priority: "Medium",
  assigneeName: "Sam Agent",
  createdAt: "t0",
  updatedAt: "t0",
  resolvedAt: null,
  ...overrides,
});

test("customer replies", async (context) => {
  const calls = {};
  let ticket;
  const rec = (name, fn) => async (...args) => {
    (calls[name] ||= []).push(args);
    return fn(...args);
  };
  const server = createApp({
    customerModel: { findCustomerContext: async () => ({ ...ctx }) },
    ticketModel: {
      findCustomerTicketById: async (c, u, id) =>
        ticket && c === 7 && u === 20 && id === 5 ? ticket : null,
      updateTicket: rec("updateTicket", async (c, id, changes) => ({
        ...ticket,
        ...changes,
        resolvedAt: null,
      })),
    },
    ticketReplyModel: {
      listReplies: rec("listReplies", async () => [
        { replyId: 1, authorId: 4, authorRole: "Agent", authorName: "Sam", isInternal: false, body: "public", createdAt: "t1" },
      ]),
      countReplies: async () => 0,
      createReply: rec("createReply", async (c, t, reply) => ({
        replyId: 2,
        ...reply,
        createdAt: "t2",
      })),
    },
    companyPortalModel: { findCompanyAdminContext: async () => null },
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { cookieName } = getAuthConfig();
  const token = createAccessToken({
    accountType: "individual",
    userId: 20,
    email: ctx.email,
    roleName: "Customer",
  });
  const call = (method, path, body) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { cookie: `${cookieName}=${token}`, "content-type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  context.beforeEach(() => {
    for (const key of Object.keys(calls)) delete calls[key];
    ticket = row();
  });

  await context.test("detail returns public replies only through the SQL flag, whitelisted", async () => {
    const response = await call("GET", "/api/customer/tickets/5");
    const { data } = await response.json();
    assert.deepEqual(calls.listReplies[0].slice(0, 3), [7, 5, { includeInternal: false }]);
    assert.equal(data.replies.length, 1);
    assert.deepEqual(Object.keys(data.replies[0]).sort(), [
      "authorName", "authorRole", "body", "createdAt", "replyId",
    ]);
  });

  await context.test("reply 201 on Open does not change the ticket", async () => {
    const response = await call("POST", "/api/customer/tickets/5/replies", { body: " hi " });
    assert.equal(response.status, 201);
    const { data } = await response.json();
    assert.equal(data.reply.authorRole, "Customer");
    assert.equal(data.reply.body, "hi");
    assert.equal(calls.updateTicket, undefined);
    const reply = calls.createReply[0][2];
    assert.equal(reply.isInternal, false);
    assert.equal(reply.authorId, 20);
  });

  await context.test("reply on Resolved reopens the ticket", async () => {
    ticket = row({ status: "Resolved" });
    const response = await call("POST", "/api/customer/tickets/5/replies", { body: "still broken" });
    assert.equal(response.status, 201);
    assert.deepEqual(calls.updateTicket[0], [7, 5, { status: "Open", onlyIfStatus: "Resolved" }]);
    assert.equal((await response.json()).data.ticket.status, "Open");
  });

  await context.test("isInternal true is 422, Closed is 409, other ticket is 404", async () => {
    let response = await call("POST", "/api/customer/tickets/5/replies", { body: "x", isInternal: true });
    assert.equal(response.status, 422);
    response = await call("POST", "/api/customer/tickets/5/replies", { body: "x", authorId: 1 });
    assert.equal(response.status, 422);
    ticket = row({ status: "Closed" });
    response = await call("POST", "/api/customer/tickets/5/replies", { body: "x" });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "TICKET_CLOSED");
    response = await call("POST", "/api/customer/tickets/6/replies", { body: "x" });
    assert.equal(response.status, 404);
    assert.equal(calls.createReply, undefined);
  });
});
