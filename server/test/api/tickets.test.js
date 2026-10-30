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
  userId: 2,
  firstName: "Ada",
  lastName: "Owner",
  email: "owner@acme.test",
  onlineStatus: "Online",
  userStatus: "Active",
  roleName: "Company Admin",
  companyId: 7,
  companyStatus: "Active",
};

function companyToken(overrides = {}) {
  return createAccessToken({
    accountType: "company",
    userId: 2,
    companyId: 7,
    email: "owner@acme.test",
    roleName: "Company Admin",
    ...overrides,
  });
}

function makeTicket(overrides = {}) {
  return {
    ticketId: 1,
    companyId: 7,
    customerId: null,
    requesterName: null,
    requesterEmail: null,
    subject: "Broken thing",
    description: "It is broken",
    status: "Open",
    priority: "Medium",
    assignedAgentId: null,
    assigneeName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

test("company tickets API", async (context) => {
  const calls = {};
  let contextImpl;
  let impl;

  const record = (name, fn) => async (...args) => {
    (calls[name] ||= []).push(args);
    return impl[name](...args);
  };

  const companyPortalModel = {
    findCompanyAdminContext: record("context", (...a) => contextImpl(...a)),
  };
  // `context` is resolved through contextImpl so tests can swap it
  companyPortalModel.findCompanyAdminContext = async (userId) => {
    (calls.context ||= []).push([userId]);
    return contextImpl(userId);
  };

  const ticketModel = {
    createTicket: record("createTicket"),
    findTicketById: record("findTicketById"),
    listTickets: record("listTickets"),
    updateTicket: record("updateTicket"),
    findAssignableAgent: record("findAssignableAgent"),
    listAssignableAgents: record("listAssignableAgents"),
    getTicketStats: record("getTicketStats"),
  };

  const server = await startTestServer({ companyPortalModel, ticketModel });
  context.after(() => server.close());

  const { cookieName } = getAuthConfig();
  const call = (method, path, { token = companyToken(), body } = {}) =>
    fetch(`${server.baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { cookie: `${cookieName}=${token}` } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  const modelCalls = () =>
    Object.keys(calls).filter((name) => name !== "context").length;

  context.beforeEach(() => {
    for (const key of Object.keys(calls)) delete calls[key];
    contextImpl = async () => ({ ...baseContext });
    impl = {
      createTicket: async (companyId, input) => makeTicket({ ...input }),
      findTicketById: async (companyId, ticketId) =>
        companyId === 7 ? makeTicket({ ticketId }) : null,
      listTickets: async (_companyId, filters) => ({
        tickets: [makeTicket()],
        total: 45,
        page: filters.page,
        limit: filters.limit,
      }),
      updateTicket: async (companyId, ticketId, changes) =>
        makeTicket({ ticketId, ...changes }),
      findAssignableAgent: async (companyId, id) =>
        companyId === 7 && id === 5
          ? { userId: 5, firstName: "Sam", lastName: "Agent", email: "s@acme.test" }
          : null,
      listAssignableAgents: async () => [
        { userId: 5, firstName: "Sam", lastName: "Agent", email: "s@acme.test", onlineStatus: "Online" },
      ],
      getTicketStats: async () => ({
        statusRows: [
          { status: "Open", total: 4 },
          { status: "In Progress", total: 2 },
          { status: "Resolved", total: "3" },
        ],
        priorityRows: [
          { priority: "Urgent", total: 1 },
          { priority: "Medium", total: 5 },
        ],
        unassigned: 2,
        dailyRows: [{ day: new Date().toISOString().slice(0, 10), total: 3 }],
        agentRows: [
          { userId: 5, firstName: "Sam", lastName: "Agent", onlineStatus: "Online", openTickets: 4 },
          { userId: 6, firstName: null, lastName: null, onlineStatus: null, openTickets: 0 },
        ],
      }),
    };
  });

  const routes = [
    ["GET", "/api/company/tickets", undefined],
    ["POST", "/api/company/tickets", { subject: "Hello there", description: "d" }],
    ["GET", "/api/company/tickets/1", undefined],
    ["PATCH", "/api/company/tickets/1", { status: "Closed" }],
    ["GET", "/api/company/tickets/assignable-agents", undefined],
    ["GET", "/api/company/tickets/stats", undefined],
  ];

  await context.test("401 without credentials and with an invalid token", async () => {
    const none = await call("GET", "/api/company/tickets", { token: null });
    assert.equal(none.status, 401);
    assert.equal((await none.json()).code, "AUTHENTICATION_REQUIRED");

    const bad = await call("GET", "/api/company/tickets", { token: "garbage" });
    assert.equal(bad.status, 401);
    assert.equal((await bad.json()).code, "INVALID_SESSION");
  });

  await context.test("403 ROLE_FORBIDDEN for other roles on all routes", async () => {
    const tokens = [
      createAccessToken({ accountType: "individual", userId: 1, email: "a@x.test", roleName: "Platform Admin" }),
      createAccessToken({ accountType: "individual", userId: 4, email: "b@x.test", roleName: "Support Agent" }),
    ];
    for (const token of tokens) {
      for (const [method, path, body] of routes) {
        const response = await call(method, path, { token, body });
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.equal((await response.json()).code, "ROLE_FORBIDDEN");
      }
    }
    assert.equal(Object.keys(calls).length, 0);
  });

  const guardCases = [
    ["COMPANY_ACCESS_DENIED", async () => null],
    ["COMPANY_INACTIVE", async () => ({ ...baseContext, companyStatus: "Suspended" })],
    ["ACCOUNT_INACTIVE", async () => ({ ...baseContext, userStatus: "Suspended" })],
    ["ROLE_FORBIDDEN", async () => ({ ...baseContext, roleName: "Support Agent" })],
  ];
  for (const [code, impl403] of guardCases) {
    await context.test(`403 ${code} blocks every route before the ticket model`, async () => {
      contextImpl = impl403;
      for (const [method, path, body] of routes) {
        const response = await call(method, path, { body });
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.equal((await response.json()).code, code);
      }
      assert.equal(modelCalls(), 0);
    });
  }

  await context.test("company comes from the database, not token, query or body", async () => {
    const token = companyToken({ companyId: 99 });
    await call("GET", "/api/company/tickets?companyId=99", { token });
    await call("POST", "/api/company/tickets", {
      token,
      body: { subject: "Hello there", description: "d", companyId: 99, customerId: 12 },
    });
    await call("GET", "/api/company/tickets/3?companyId=99", { token });
    await call("PATCH", "/api/company/tickets/3", { token, body: { status: "Closed", companyId: 99 } });
    await call("GET", "/api/company/tickets/assignable-agents?companyId=99", { token });

    for (const name of ["listTickets", "createTicket", "findTicketById", "updateTicket", "listAssignableAgents"]) {
      assert.ok(calls[name]?.length, name);
      for (const args of calls[name]) assert.equal(args[0], 7, name);
    }
    const [, created] = calls.createTicket[0];
    assert.equal(created.customerId, null);
    assert.ok(!("companyId" in created));
  });

  await context.test("POST creates with defaults and sends no-store", async () => {
    const response = await call("POST", "/api/company/tickets", {
      body: { subject: "  Hello there ", description: "Details" },
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.success, true);
    assert.equal(body.data.ticket.status, "Open");
    assert.equal(body.data.ticket.priority, "Medium");
    assert.equal(body.data.ticket.customerId, null);
    assert.equal(body.data.ticket.subject, "Hello there");
    assert.equal(calls.findAssignableAgent, undefined);
  });

  const badCreates = [
    ["missing subject", { description: "d" }],
    ["short subject", { subject: "ab", description: "d" }],
    ["long subject", { subject: "x".repeat(201), description: "d" }],
    ["missing description", { subject: "Hello there" }],
    ["long description", { subject: "Hello there", description: "x".repeat(5001) }],
    ["bad priority", { subject: "Hello there", description: "d", priority: "Critical" }],
    ["bad status", { subject: "Hello there", description: "d", status: "Done" }],
    ["bad email", { subject: "Hello there", description: "d", requesterEmail: "nope" }],
    ["string agent id", { subject: "Hello there", description: "d", assignedAgentId: "5" }],
    ["array body", []],
  ];
  for (const [name, body] of badCreates) {
    await context.test(`POST 422 for ${name}`, async () => {
      const response = await call("POST", "/api/company/tickets", { body });
      const json = await response.json();
      assert.equal(response.status, 422);
      assert.equal(json.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(json.errors) && json.errors.length > 0);
      assert.equal(calls.createTicket, undefined);
    });
  }

  await context.test("POST 422 INVALID_ASSIGNEE for a foreign or inactive agent", async () => {
    const response = await call("POST", "/api/company/tickets", {
      body: { subject: "Hello there", description: "d", assignedAgentId: 77 },
    });
    const json = await response.json();
    assert.equal(response.status, 422);
    assert.equal(json.code, "INVALID_ASSIGNEE");
    assert.equal(json.errors[0].field, "assignedAgentId");
    assert.deepEqual(calls.findAssignableAgent[0], [7, 77]);
    assert.equal(calls.createTicket, undefined);
  });

  await context.test("POST 201 with a valid agent", async () => {
    const response = await call("POST", "/api/company/tickets", {
      body: { subject: "Hello there", description: "d", assignedAgentId: 5, priority: "High" },
    });
    const json = await response.json();
    assert.equal(response.status, 201);
    assert.equal(json.data.ticket.assignedAgentId, 5);
    assert.equal(json.data.ticket.priority, "High");
  });

  await context.test("GET list defaults and pagination shape", async () => {
    const response = await call("GET", "/api/company/tickets");
    const json = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(json.data.pagination, { page: 1, limit: 20, total: 45, totalPages: 3 });
    assert.equal(json.data.tickets.length, 1);
    assert.equal(calls.listTickets[0][1].page, 1);
    assert.equal(calls.listTickets[0][1].limit, 20);
  });

  await context.test("GET list passes filters through", async () => {
    await call("GET", "/api/company/tickets?status=Open&priority=High&assignee=5&search=login&page=2&limit=10");
    assert.deepEqual(
      { ...calls.listTickets[0][1] },
      { status: "Open", priority: "High", assigneeId: 5, unassigned: false, search: "login", page: 2, limit: 10 },
    );

    await call("GET", "/api/company/tickets?assignee=unassigned");
    assert.equal(calls.listTickets[1][1].unassigned, true);
    assert.equal(calls.listTickets[1][1].assigneeId, undefined);

    await call("GET", `/api/company/tickets?search=${encodeURIComponent("50%_off")}`);
    assert.equal(calls.listTickets[2][1].search, "50%_off");
  });

  for (const query of ["status=open", "priority=Nope", "assignee=abc", "page=0", "limit=101"]) {
    await context.test(`GET list 422 for ${query}`, async () => {
      const response = await call("GET", `/api/company/tickets?${query}`);
      assert.equal(response.status, 422);
      assert.equal((await response.json()).code, "VALIDATION_ERROR");
      assert.equal(calls.listTickets, undefined);
    });
  }

  await context.test("GET :id returns the ticket", async () => {
    const response = await call("GET", "/api/company/tickets/42");
    const json = await response.json();
    assert.equal(response.status, 200);
    assert.equal(json.data.ticket.ticketId, 42);
    assert.deepEqual(calls.findTicketById[0], [7, 42]);
  });

  for (const id of ["abc", "0", "-1"]) {
    await context.test(`GET :id 400 for ${id}`, async () => {
      const response = await call("GET", `/api/company/tickets/${id}`);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, "INVALID_TICKET_ID");
      assert.equal(calls.findTicketById, undefined);
    });
  }

  await context.test("GET :id 404 for another company's ticket", async () => {
    impl.findTicketById = async () => null;
    const response = await call("GET", "/api/company/tickets/9");
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "TICKET_NOT_FOUND");
  });

  await context.test("PATCH changes status", async () => {
    const response = await call("PATCH", "/api/company/tickets/3", { body: { status: "Resolved" } });
    const json = await response.json();
    assert.equal(response.status, 200);
    assert.equal(json.data.ticket.status, "Resolved");
    assert.deepEqual(calls.updateTicket[0], [7, 3, { status: "Resolved" }]);
  });

  for (const [name, body] of [
    ["empty body", {}],
    ["only unknown keys", { subject: "new", companyId: 3 }],
    ["bad status", { status: "Done" }],
    ["bad priority", { priority: "low" }],
  ]) {
    await context.test(`PATCH 422 for ${name}`, async () => {
      const response = await call("PATCH", "/api/company/tickets/3", { body });
      assert.equal(response.status, 422);
      assert.equal((await response.json()).code, "VALIDATION_ERROR");
      assert.equal(calls.updateTicket, undefined);
    });
  }

  await context.test("PATCH unassigns with null without an agent lookup", async () => {
    const response = await call("PATCH", "/api/company/tickets/3", { body: { assignedAgentId: null } });
    assert.equal(response.status, 200);
    assert.equal(calls.findAssignableAgent, undefined);
    assert.deepEqual(calls.updateTicket[0][2], { assignedAgentId: null });
  });

  await context.test("PATCH assigns a valid agent", async () => {
    const response = await call("PATCH", "/api/company/tickets/3", { body: { assignedAgentId: 5 } });
    assert.equal(response.status, 200);
    assert.deepEqual(calls.findAssignableAgent[0], [7, 5]);
  });

  await context.test("PATCH 422 INVALID_ASSIGNEE for a non-agent", async () => {
    const response = await call("PATCH", "/api/company/tickets/3", { body: { assignedAgentId: 77 } });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "INVALID_ASSIGNEE");
    assert.equal(calls.updateTicket, undefined);
  });

  await context.test("PATCH 404 for another company's ticket without updating", async () => {
    impl.findTicketById = async () => null;
    const response = await call("PATCH", "/api/company/tickets/9", { body: { status: "Closed" } });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "TICKET_NOT_FOUND");
    assert.equal(calls.updateTicket, undefined);
  });

  await context.test("PATCH 404 when the update returns null", async () => {
    impl.updateTicket = async () => null;
    const response = await call("PATCH", "/api/company/tickets/3", { body: { status: "Closed" } });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "TICKET_NOT_FOUND");
  });

  await context.test("PATCH 400 for a bad id", async () => {
    const response = await call("PATCH", "/api/company/tickets/abc", { body: { status: "Closed" } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_TICKET_ID");
  });

  await context.test("assignable-agents is scoped and not captured by /:ticketId", async () => {
    const response = await call("GET", "/api/company/tickets/assignable-agents");
    const json = await response.json();
    assert.equal(response.status, 200);
    assert.equal(json.data.agents.length, 1);
    assert.equal(json.data.agents[0].userId, 5);
    assert.deepEqual(calls.listAssignableAgents[0], [7]);
    assert.equal(calls.findTicketById, undefined);
  });

  await context.test("stats are scoped to the company and shaped for the dashboard", async () => {
    const response = await call("GET", "/api/company/tickets/stats?companyId=99", {
      token: companyToken({ companyId: 99 }),
    });
    const { data } = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls.getTicketStats[0], [7, 7]);
    assert.equal(calls.findTicketById, undefined);
    assert.deepEqual(data.byStatus, { open: 4, inProgress: 2, resolved: 3, closed: 0, total: 9 });
    assert.deepEqual(data.openByPriority, { Low: 0, Medium: 5, High: 0, Urgent: 1 });
    assert.equal(data.unassigned, 2);
    assert.equal(data.createdPerDay.length, 7);
    assert.equal(data.createdPerDay[6].total, 3);
    assert.equal(data.createdPerDay[0].total, 0);
    assert.deepEqual(data.agentWorkload[0], { userId: 5, name: "Sam Agent", onlineStatus: "Online", openTickets: 4 });
    assert.deepEqual(data.agentWorkload[1], { userId: 6, name: "Unnamed agent", onlineStatus: "Offline", openTickets: 0 });
  });

  await context.test("model errors become 500", async () => {
    impl.listTickets = async () => {
      throw new Error("db down");
    };
    const response = await call("GET", "/api/company/tickets");
    const json = await response.json();
    assert.equal(response.status, 500);
    assert.equal(json.message, "Internal server error");
  });
});
