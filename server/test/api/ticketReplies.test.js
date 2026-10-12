process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { createAccessToken } = require("../../src/utils/token");
const { getAuthConfig } = require("../../src/config/auth");

const adminContext = {
  userId: 2,
  firstName: "Ada",
  lastName: "Owner",
  userStatus: "Active",
  roleName: "Company Admin",
  companyId: 7,
  companyStatus: "Active",
};

test("company admin ticket replies", async (context) => {
  const calls = {};
  let ticket;
  const rec = (name, fn) => async (...args) => {
    (calls[name] ||= []).push(args);
    return fn(...args);
  };
  const server = createApp({
    companyPortalModel: { findCompanyAdminContext: async () => ({ ...adminContext }) },
    ticketModel: {
      findTicketById: async (c, id) => (ticket && c === 7 && id === 3 ? ticket : null),
    },
    ticketReplyModel: {
      listReplies: rec("listReplies", async () => [
        { replyId: 1, authorId: 4, authorRole: "Agent", authorName: "Sam", isInternal: true, body: "note", createdAt: "t1" },
      ]),
      countReplies: async () => 0,
      createReply: rec("createReply", async (c, t, reply) => ({ replyId: 2, ...reply, createdAt: "t2" })),
    },
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { cookieName } = getAuthConfig();
  const adminToken = createAccessToken({
    accountType: "company", userId: 2, companyId: 7, email: "a@a.test", roleName: "Company Admin",
  });
  const call = (method, path, body, token = adminToken) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { cookie: `${cookieName}=${token}`, "content-type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  context.beforeEach(() => {
    for (const key of Object.keys(calls)) delete calls[key];
    ticket = { ticketId: 3, companyId: 7, status: "In Progress" };
  });

  await context.test("list includes internal notes scoped to the admin company", async () => {
    const response = await call("GET", "/api/company/tickets/3/replies");
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.replies[0].isInternal, true);
    assert.deepEqual(calls.listReplies[0].slice(0, 3), [7, 3, { includeInternal: true }]);
  });

  await context.test("post creates an Admin reply, internal allowed", async () => {
    const response = await call("POST", "/api/company/tickets/3/replies", { body: "hello", isInternal: true });
    assert.equal(response.status, 201);
    const reply = calls.createReply[0][2];
    assert.equal(reply.authorRole, "Admin");
    assert.equal(reply.authorName, "Ada Owner");
    assert.equal(reply.authorId, 2);
    assert.equal(reply.isInternal, true);
  });

  await context.test("other company ticket 404, closed 409, bad body 422, agent token 403", async () => {
    let response = await call("GET", "/api/company/tickets/4/replies");
    assert.equal(response.status, 404);
    response = await call("POST", "/api/company/tickets/4/replies", { body: "x" });
    assert.equal(response.status, 404);
    response = await call("POST", "/api/company/tickets/3/replies", { body: "" });
    assert.equal(response.status, 422);
    ticket = { ticketId: 3, companyId: 7, status: "Closed" };
    response = await call("POST", "/api/company/tickets/3/replies", { body: "x" });
    assert.equal(response.status, 409);
    const agent = createAccessToken({ accountType: "individual", userId: 4, email: "s@a.test", roleName: "Support Agent" });
    response = await call("GET", "/api/company/tickets/3/replies", undefined, agent);
    assert.equal(response.status, 403);
  });
});
