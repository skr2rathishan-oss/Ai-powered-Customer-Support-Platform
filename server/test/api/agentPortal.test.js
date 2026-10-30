process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { createAccessToken } = require("../../src/utils/token");
const { getAuthConfig } = require("../../src/config/auth");

async function startTestServer(dependencies = {}) {
  const app = createApp(dependencies);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const baseContext = {
  userId: 4,
  firstName: "Sam",
  lastName: "Agent",
  email: "sam@acme.test",
  userStatus: "Active",
  roleName: "Support Agent",
  companyId: 7,
  companyName: "Acme",
  companyStatus: "Active",
};

function agentToken(overrides = {}) {
  return createAccessToken({
    accountType: "individual",
    userId: 4,
    email: "sam@acme.test",
    roleName: "Support Agent",
    ...overrides,
  });
}

function makeRow(overrides = {}) {
  return {
    ticketId: 1,
    companyId: 7,
    customerId: 20,
    requesterName: "Casey Customer",
    requesterEmail: "casey@customer.test",
    subject: "Broken thing",
    description: "It is broken",
    status: "Open",
    priority: "Medium",
    assignedAgentId: 4,
    assigneeName: "Sam Agent",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

test("agent portal API", async (context) => {
  const calls = {};
  let contextImpl;
  let impl;

  const record = (name) => async (...args) => {
    (calls[name] ||= []).push(args);
    return impl[name](...args);
  };

  const agentModel = { findAgentContext: async (id) => contextImpl(id) };
  const ticketModel = {
    listAgentTickets: record("listAgentTickets"),
    countAgentTicketsByStatus: record("countAgentTicketsByStatus"),
    findAgentTicketById: record("findAgentTicketById"),
    updateAgentTicketStatus: record("updateAgentTicketStatus"),
  };
  const ticketReplyModel = {
    listReplies: record("listReplies"),
    createReply: record("createReply"),
    countReplies: record("countReplies"),
    lastReplyByTickets: record("lastReplyByTickets"),
  };

  const server = await startTestServer({ agentModel, ticketModel, ticketReplyModel });
  context.after(() => server.close());

  const { cookieName } = getAuthConfig();
  const call = (method, path, { token = agentToken(), body } = {}) =>
    fetch(`${server.baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { cookie: `${cookieName}=${token}` } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  context.beforeEach(() => {
    for (const key of Object.keys(calls)) delete calls[key];
    contextImpl = async () => ({ ...baseContext });
    impl = {
      listAgentTickets: async (_c, _a, filters) => ({
        tickets: [makeRow()],
        total: 45,
        page: filters.page,
        limit: filters.limit,
      }),
      countAgentTicketsByStatus: async () => ({
        open: 1, inProgress: 0, resolved: 0, closed: 0, total: 1,
      }),
      findAgentTicketById: async (companyId, agentId, ticketId) =>
        companyId === 7 && agentId === 4 ? makeRow({ ticketId }) : null,
      updateAgentTicketStatus: async (companyId, agentId, ticketId, status) =>
        makeRow({ ticketId, status, resolvedAt: status === "Resolved" ? "now" : null }),
      listReplies: async () => [
        { replyId: 1, authorId: 20, authorRole: "Customer", authorName: "Casey", isInternal: false, body: "hi", createdAt: "t1" },
        { replyId: 2, authorId: 4, authorRole: "Agent", authorName: "Sam Agent", isInternal: true, body: "note", createdAt: "t2" },
      ],
      createReply: async (companyId, ticketId, reply) => ({
        replyId: 9,
        authorId: reply.authorId,
        authorRole: reply.authorRole,
        authorName: reply.authorName,
        isInternal: reply.isInternal,
        body: reply.body,
        createdAt: "t3",
      }),
      countReplies: async () => 0,
      lastReplyByTickets: async () => [
        { ticketId: 1, replyCount: 2, lastReplyAt: "t1", lastReplyRole: "Customer" },
      ],
    };
  });

  const routes = [
    ["GET", "/api/agent/me", undefined],
    ["GET", "/api/agent/tickets", undefined],
    ["GET", "/api/agent/tickets/1", undefined],
    ["POST", "/api/agent/tickets/1/replies", { body: "hello" }],
    ["PATCH", "/api/agent/tickets/1", { status: "Resolved" }],
  ];

  await context.test("401 without a cookie on every route", async () => {
    for (const [method, path, body] of routes) {
      const response = await call(method, path, { token: null, body });
      assert.equal(response.status, 401, path);
    }
  });

  await context.test("403 ROLE_FORBIDDEN for other token roles", async () => {
    const tokens = [
      createAccessToken({ accountType: "individual", userId: 20, email: "c@c.test", roleName: "Customer" }),
      createAccessToken({ accountType: "company", userId: 2, companyId: 7, email: "a@c.test", roleName: "Company Admin" }),
      createAccessToken({ accountType: "individual", userId: 1, email: "p@c.test", roleName: "Platform Admin" }),
    ];
    for (const token of tokens) {
      for (const [method, path, body] of routes) {
        const response = await call(method, path, { token, body });
        assert.equal(response.status, 403, path);
        assert.equal((await response.json()).code, "ROLE_FORBIDDEN");
      }
    }
    assert.equal(Object.keys(calls).length, 0);
  });

  await context.test("database role, status and company are re-checked on every route", async () => {
    const cases = [
      [{ roleName: "Customer" }, "ROLE_FORBIDDEN"],
      [{ userStatus: "Inactive" }, "ACCOUNT_INACTIVE"],
      [{ companyStatus: "Inactive" }, "COMPANY_INACTIVE"],
    ];
    for (const [override, code] of cases) {
      contextImpl = async () => ({ ...baseContext, ...override });
      for (const [method, path, body] of routes) {
        const response = await call(method, path, { body });
        assert.equal(response.status, 403, `${path} ${code}`);
        assert.equal((await response.json()).code, code);
      }
    }
    contextImpl = async () => null;
    const none = await call("GET", "/api/agent/me");
    assert.equal(none.status, 403);
    assert.equal((await none.json()).code, "COMPANY_ACCESS_DENIED");
    assert.equal(calls.createReply, undefined);
    assert.equal(calls.updateAgentTicketStatus, undefined);
  });

  await context.test("GET /me returns profile and summary", async () => {
    const response = await call("GET", "/api/agent/me");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const { data } = await response.json();
    assert.equal(data.agent.firstName, "Sam");
    assert.equal(data.company.companyName, "Acme");
    assert.equal(data.summary.total, 1);
  });

  await context.test("scope comes from the database, not token claims or query", async () => {
    const token = agentToken({ companyId: 999 });
    const response = await call("GET", "/api/agent/tickets?companyId=5&assigneeId=9&status=Open", { token });
    assert.equal(response.status, 200);
    const [companyId, agentId, filters] = calls.listAgentTickets[0];
    assert.equal(companyId, 7);
    assert.equal(agentId, 4);
    assert.equal(filters.status, "Open");
    assert.equal(filters.assigneeId, undefined);
  });

  await context.test("list shape, pagination and no leaked ids", async () => {
    const response = await call("GET", "/api/agent/tickets?page=2&limit=10&sort=priority");
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.deepEqual(data.pagination, { page: 2, limit: 10, total: 45, totalPages: 5 });
    assert.equal(data.summary.open, 1);
    const row = data.tickets[0];
    assert.equal(row.lastReplyRole, "Customer");
    assert.equal(row.replyCount, 2);
    for (const key of ["assignedAgentId", "customerId", "description", "companyId"]) {
      assert.ok(!(key in row), key);
    }
    assert.equal(calls.listAgentTickets[0][2].sort, "priority");
  });

  for (const query of ["status=Bogus", "page=0", "limit=101", "sort=random"]) {
    await context.test(`list 422 for ${query}`, async () => {
      const response = await call("GET", `/api/agent/tickets?${query}`);
      assert.equal(response.status, 422);
      assert.equal(calls.listAgentTickets, undefined);
    });
  }

  await context.test("detail returns internal notes and public replies", async () => {
    const response = await call("GET", "/api/agent/tickets/1");
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.ticket.description, "It is broken");
    assert.deepEqual(data.replies.map((r) => r.isInternal), [false, true]);
    assert.ok(!("authorId" in data.replies[0]));
    assert.deepEqual(calls.listReplies[0].slice(0, 3), [7, 1, { includeInternal: true }]);
  });

  await context.test("other agent's / other company's / missing tickets are identical 404s", async () => {
    impl.findAgentTicketById = async () => null;
    const bodies = [];
    for (const [method, path, body] of [
      ["GET", "/api/agent/tickets/5", undefined],
      ["POST", "/api/agent/tickets/5/replies", { body: "x" }],
      ["PATCH", "/api/agent/tickets/5", { status: "Resolved" }],
    ]) {
      const response = await call(method, path, { body });
      assert.equal(response.status, 404, path);
      bodies.push(await response.json());
    }
    assert.ok(bodies.every((b) => b.code === "TICKET_NOT_FOUND"));
    assert.equal(calls.createReply, undefined);
    assert.equal(calls.updateAgentTicketStatus, undefined);
  });

  await context.test("400 INVALID_TICKET_ID", async () => {
    const response = await call("GET", "/api/agent/tickets/abc");
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_TICKET_ID");
  });

  await context.test("reply: 201 with author snapshot from the database, trimmed body", async () => {
    const response = await call("POST", "/api/agent/tickets/1/replies", {
      body: { body: "  Hello\r\nthere  ", isInternal: true },
    });
    assert.equal(response.status, 201);
    const { data } = await response.json();
    assert.equal(data.reply.authorRole, "Agent");
    assert.equal(data.reply.isInternal, true);
    const [companyId, ticketId, reply] = calls.createReply[0];
    assert.equal(companyId, 7);
    assert.equal(ticketId, 1);
    assert.equal(reply.authorId, 4);
    assert.equal(reply.authorName, "Sam Agent");
    assert.equal(reply.body, "Hello\nthere");
    assert.equal(reply.requireAssignedAgentId, 4);
  });

  await context.test("reply rejects smuggled fields and bad bodies with 422", async () => {
    const bodies = [
      { body: "x", authorId: 1 },
      { body: "x", authorRole: "Admin" },
      { body: "x", companyId: 9 },
      { body: "" },
      { body: "   " },
      { body: "a".repeat(5001) },
      { body: "x", isInternal: "yes" },
      { body: "bad\u0000char" },
    ];
    for (const body of bodies) {
      const response = await call("POST", "/api/agent/tickets/1/replies", { body });
      assert.equal(response.status, 422, JSON.stringify(body).slice(0, 40));
    }
    const ok = await call("POST", "/api/agent/tickets/1/replies", { body: { body: "a".repeat(5000) } });
    assert.equal(ok.status, 201);
    assert.equal(calls.createReply.length, 1);
  });

  await context.test("reply: Closed ticket 409, Resolved allowed, cap 409", async () => {
    impl.findAgentTicketById = async () => makeRow({ status: "Closed" });
    let response = await call("POST", "/api/agent/tickets/1/replies", { body: { body: "x" } });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "TICKET_CLOSED");

    impl.findAgentTicketById = async () => makeRow({ status: "Resolved" });
    response = await call("POST", "/api/agent/tickets/1/replies", { body: { body: "x" } });
    assert.equal(response.status, 201);

    impl.countReplies = async () => 500;
    response = await call("POST", "/api/agent/tickets/1/replies", { body: { body: "x" } });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "REPLY_LIMIT_REACHED");
  });

  await context.test("reply: refused conditional insert maps to 404 or 409", async () => {
    impl.createReply = async () => null;
    let lookups = 0;
    impl.findAgentTicketById = async () => (++lookups === 1 ? makeRow() : null);
    let response = await call("POST", "/api/agent/tickets/1/replies", { body: { body: "x" } });
    assert.equal(response.status, 404);

    impl.findAgentTicketById = async () => makeRow();
    response = await call("POST", "/api/agent/tickets/1/replies", { body: { body: "x" } });
    assert.equal(response.status, 409);
  });

  await context.test("status: allowed values, Closed rejected, idempotent, Closed ticket 409", async () => {
    for (const status of ["Open", "In Progress", "Resolved"]) {
      impl.findAgentTicketById = async () => makeRow({ status: "Closed" === status ? "Open" : "Open" });
      const response = await call("PATCH", "/api/agent/tickets/1", { body: { status } });
      assert.equal(response.status, 200, status);
    }
    for (const body of [{ status: "Closed" }, { status: "Nope" }, {}, { status: "Open", priority: "High" }]) {
      const response = await call("PATCH", "/api/agent/tickets/1", { body });
      assert.equal(response.status, 422, JSON.stringify(body));
    }

    for (const key of Object.keys(calls)) delete calls[key];
    impl.findAgentTicketById = async () => makeRow({ status: "Resolved" });
    let response = await call("PATCH", "/api/agent/tickets/1", { body: { status: "Resolved" } });
    assert.equal(response.status, 200);
    assert.equal(calls.updateAgentTicketStatus, undefined);

    impl.findAgentTicketById = async () => makeRow({ status: "Closed" });
    response = await call("PATCH", "/api/agent/tickets/1", { body: { status: "Open" } });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "TICKET_CLOSED");
  });

  await context.test("status: resolvedAt set by the model result", async () => {
    const response = await call("PATCH", "/api/agent/tickets/1", { body: { status: "Resolved" } });
    const { data } = await response.json();
    assert.equal(data.ticket.status, "Resolved");
    assert.equal(data.ticket.resolvedAt, "now");
    assert.deepEqual(calls.updateAgentTicketStatus[0], [7, 4, 1, "Resolved"]);
  });
});
