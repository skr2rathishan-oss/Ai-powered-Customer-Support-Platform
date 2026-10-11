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

function customerToken(overrides = {}) {
  return createAccessToken({
    accountType: "individual",
    userId: 20,
    email: "casey@customer.test",
    roleName: "Customer",
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

const jsonKeys = (value) => JSON.stringify(value);

test("customer API", async (context) => {
  const calls = {};
  let contextImpl;
  let impl;

  const record = (name) => async (...args) => {
    (calls[name] ||= []).push(args);
    return impl[name](...args);
  };

  const customerModel = {
    findCustomerContext: async (userId) => {
      (calls.context ||= []).push([userId]);
      return contextImpl(userId);
    },
  };
  const ticketModel = {
    createTicket: record("createTicket"),
    listCustomerTickets: record("listCustomerTickets"),
    findCustomerTicketById: record("findCustomerTicketById"),
    countOpenCustomerTickets: record("countOpenCustomerTickets"),
  };
  const faqModel = { listFaqs: record("listFaqs"), listFaqMeta: record("listFaqMeta") };
  const aiSettingsModel = { findAiSettings: record("findAiSettings") };
  // Company admin guard must reject customers before touching this
  const companyPortalModel = {
    findCompanyAdminContext: async () => {
      throw new Error("company context must not be reached");
    },
  };

  const server = await startTestServer({
    customerModel,
    ticketModel,
    faqModel,
    aiSettingsModel,
    companyPortalModel,
  });
  context.after(() => server.close());

  const { cookieName } = getAuthConfig();
  const call = (method, path, { token = customerToken(), body } = {}) =>
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
      createTicket: async (companyId, input) => makeRow({ companyId, ...input }),
      listCustomerTickets: async (_c, _u, filters) => ({
        tickets: [makeRow()],
        total: 45,
        page: filters.page,
        limit: filters.limit,
      }),
      findCustomerTicketById: async (companyId, customerId, ticketId) =>
        companyId === 7 && customerId === 20 ? makeRow({ ticketId }) : null,
      countOpenCustomerTickets: async () => 0,
      listFaqs: async () => [],
      listFaqMeta: async () => ({}),
      findAiSettings: async () => null,
    };
  });

  const routes = [
    ["GET", "/api/customer/me", undefined],
    ["GET", "/api/customer/faqs", undefined],
    ["GET", "/api/customer/tickets", undefined],
    ["POST", "/api/customer/tickets", { subject: "Hello there", description: "d" }],
    ["GET", "/api/customer/tickets/1", undefined],
  ];

  await context.test("401 without credentials and with an invalid token on every route", async () => {
    for (const [method, path, body] of routes) {
      const none = await call(method, path, { token: null, body });
      assert.equal(none.status, 401, path);
      assert.equal((await none.json()).code, "AUTHENTICATION_REQUIRED");
      const bad = await call(method, path, { token: "garbage", body });
      assert.equal(bad.status, 401, path);
      assert.equal((await bad.json()).code, "INVALID_SESSION");
    }
    assert.equal(Object.keys(calls).length, 0);
  });

  await context.test("403 ROLE_FORBIDDEN for other roles; models untouched", async () => {
    const roles = [
      ["company", { accountType: "company", companyId: 7, roleName: "Company Admin" }],
      ["individual", { roleName: "Support Agent" }],
      ["individual", { roleName: "Platform Admin" }],
    ];
    for (const [accountType, extra] of roles) {
      const token = createAccessToken({
        accountType,
        userId: 4,
        email: "x@x.test",
        ...extra,
      });
      for (const [method, path, body] of routes) {
        const response = await call(method, path, { token, body });
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.equal((await response.json()).code, "ROLE_FORBIDDEN");
      }
    }
    assert.equal(Object.keys(calls).length, 0);
  });

  await context.test("a customer token cannot use company routes", async () => {
    for (const path of ["/api/company/tickets", "/api/company/faqs", "/api/company/me"]) {
      const response = await call("GET", path);
      assert.equal(response.status, 403, path);
      assert.equal((await response.json()).code, "ROLE_FORBIDDEN");
    }
  });

  const guardCases = [
    ["COMPANY_ACCESS_DENIED", async () => null],
    ["ROLE_FORBIDDEN", async () => ({ ...baseContext, roleName: "Support Agent" })],
    ["ACCOUNT_INACTIVE", async () => ({ ...baseContext, userStatus: "Inactive" })],
    ["COMPANY_INACTIVE", async () => ({ ...baseContext, companyStatus: "Suspended" })],
  ];
  for (const [code, impl403] of guardCases) {
    await context.test(`403 ${code} blocks every route before data models`, async () => {
      contextImpl = impl403;
      for (const [method, path, body] of routes) {
        const response = await call(method, path, { body });
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.equal((await response.json()).code, code);
      }
      assert.equal(modelCalls(), 0);
    });
  }

  await context.test("identity comes from the database, not token, query or body", async () => {
    const token = customerToken({ companyId: 99 });
    await call("GET", "/api/customer/tickets?companyId=99&customerId=99", { token });
    await call("POST", "/api/customer/tickets", {
      token,
      body: { subject: "Hello there", description: "d", companyId: 99, customerId: 99 },
    });
    await call("GET", "/api/customer/tickets/3?companyId=99&customerId=99", { token });
    await call("GET", "/api/customer/faqs?companyId=99", { token });

    for (const name of ["listCustomerTickets", "findCustomerTicketById", "countOpenCustomerTickets"]) {
      assert.ok(calls[name]?.length, name);
      for (const args of calls[name]) assert.deepEqual(args.slice(0, 2), [7, 20], name);
    }
    assert.equal(calls.createTicket[0][0], 7);
    assert.equal(calls.createTicket[0][1].customerId, 20);
    assert.equal(calls.listFaqs[0][0], 7);
    assert.deepEqual(calls.context.map((args) => args[0]).every((id) => id === 20), true);
  });

  await context.test("POST /tickets creates a customer-owned Open/Medium ticket", async () => {
    const response = await call("POST", "/api/customer/tickets", {
      body: {
        subject: "  Need help  ",
        description: " Something broke ",
        priority: "Urgent",
        status: "Closed",
        assignedAgentId: 4,
        requesterName: "Evil",
        requesterEmail: "evil@x.test",
      },
    });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.deepEqual(calls.createTicket[0], [
      7,
      {
        customerId: 20,
        requesterName: "Casey Customer",
        requesterEmail: "casey@customer.test",
        subject: "Need help",
        description: "Something broke",
        status: "Open",
        priority: "Medium",
        assignedAgentId: null,
      },
    ]);
    assert.equal(body.success, true);
    for (const key of ["companyId", "customerId", "requesterEmail", "requesterName", "assignedAgentId"]) {
      assert.ok(!(key in body.data.ticket), key);
    }
    assert.deepEqual(Object.keys(body.data.ticket).sort(), [
      "assigneeName", "createdAt", "description", "priority", "resolvedAt",
      "status", "subject", "ticketId", "updatedAt",
    ]);
  });

  const badBodies = [
    ["missing subject", { description: "d" }],
    ["short subject", { subject: "ab", description: "d" }],
    ["long subject", { subject: "x".repeat(201), description: "d" }],
    ["missing description", { subject: "Hello there" }],
    ["blank description", { subject: "Hello there", description: "   " }],
    ["oversize description", { subject: "Hello there", description: "x".repeat(5001) }],
    ["array body", []],
  ];
  for (const [name, body] of badBodies) {
    await context.test(`POST /tickets 422 for ${name}`, async () => {
      const response = await call("POST", "/api/customer/tickets", { body });
      assert.equal(response.status, 422);
      assert.equal((await response.json()).code ?? "VALIDATION_ERROR", "VALIDATION_ERROR");
      assert.equal(calls.createTicket, undefined);
    });
  }

  await context.test("POST /tickets 409 when the open ticket limit is reached", async () => {
    impl.countOpenCustomerTickets = async () => 25;
    const response = await call("POST", "/api/customer/tickets", {
      body: { subject: "Hello there", description: "d" },
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "TICKET_LIMIT_REACHED");
    assert.equal(calls.createTicket, undefined);
  });

  await context.test("GET /tickets defaults, pagination and status pass-through", async () => {
    const response = await call("GET", "/api/customer/tickets");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const { data } = await response.json();
    assert.deepEqual(calls.listCustomerTickets[0].slice(0, 3), [
      7,
      20,
      { status: undefined, page: 1, limit: 20 },
    ]);
    assert.deepEqual(data.pagination, { page: 1, limit: 20, total: 45, totalPages: 3 });
    assert.ok(!jsonKeys(data).includes("requesterEmail"));

    await call("GET", "/api/customer/tickets?status=Resolved&page=2&limit=10");
    assert.deepEqual(calls.listCustomerTickets[1][2], { status: "Resolved", page: 2, limit: 10 });
  });

  await context.test("GET /tickets returns an empty list shape", async () => {
    impl.listCustomerTickets = async () => ({ tickets: [], total: 0 });
    const { data } = await (await call("GET", "/api/customer/tickets")).json();
    assert.deepEqual(data, {
      tickets: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  for (const query of ["status=Bogus", "page=0", "limit=101", "limit=abc"]) {
    await context.test(`GET /tickets 422 for ${query}`, async () => {
      const response = await call("GET", `/api/customer/tickets?${query}`);
      assert.equal(response.status, 422);
      assert.equal(calls.listCustomerTickets, undefined);
    });
  }

  await context.test("GET /tickets/:id returns own ticket, 404 for others", async () => {
    const own = await call("GET", "/api/customer/tickets/5");
    assert.equal(own.status, 200);
    assert.equal((await own.json()).data.ticket.ticketId, 5);

    // Same company, other customer / other company: scoped lookup finds nothing
    contextImpl = async () => ({ ...baseContext, userId: 21 });
    const otherCustomer = await call("GET", "/api/customer/tickets/5", {
      token: customerToken({ userId: 21 }),
    });
    assert.equal(otherCustomer.status, 404);
    assert.equal((await otherCustomer.json()).code, "TICKET_NOT_FOUND");

    contextImpl = async () => ({ ...baseContext, companyId: 8 });
    const otherCompany = await call("GET", "/api/customer/tickets/5");
    assert.equal(otherCompany.status, 404);
  });

  for (const id of ["abc", "0", "-1"]) {
    await context.test(`GET /tickets/${id} is 400 INVALID_TICKET_ID`, async () => {
      const response = await call("GET", `/api/customer/tickets/${id}`);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, "INVALID_TICKET_ID");
    });
  }

  await context.test("/tickets/new is not a successful API route", async () => {
    const response = await call("GET", "/api/customer/tickets/new");
    assert.notEqual(response.status, 200);
    assert.ok([400, 404].includes(response.status));
  });

  await context.test("PATCH, PUT and DELETE on a ticket are 404", async () => {
    for (const method of ["PATCH", "PUT", "DELETE"]) {
      const response = await call(method, "/api/customer/tickets/1", {
        body: method === "DELETE" ? undefined : { status: "Closed" },
      });
      assert.equal(response.status, 404, method);
    }
    assert.equal(modelCalls(), 0);
  });

  await context.test("GET /faqs always asks for published rows and never leaks drafts", async () => {
    impl.listFaqs = async (_companyId, filters) =>
      [
        { faqId: 1, question: "Q1", answer: "A1", category: "Billing", isPublished: true, sortOrder: 10, createdAt: "x", updatedAt: "y" },
        { faqId: 2, question: "Q2", answer: "A2", category: "Account", isPublished: true, sortOrder: 20, createdAt: "x", updatedAt: "y" },
        { faqId: 3, question: "Q3", answer: "A3", category: null, isPublished: true, sortOrder: 30, createdAt: "x", updatedAt: "y" },
      ].filter(() => filters.status === "published");

    const response = await call("GET", "/api/customer/faqs?status=draft&search=%20pass%20&category=Billing");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const { data } = await response.json();
    assert.deepEqual(calls.listFaqs[0], [7, { status: "published", search: "pass", category: "Billing" }]);
    assert.equal(calls.listFaqMeta, undefined);
    assert.equal(data.faqs.length, 3);
    assert.deepEqual(Object.keys(data.faqs[0]).sort(), ["answer", "category", "faqId", "question"]);
    assert.deepEqual(data.categories, ["Account", "Billing"]);
  });

  await context.test("GET /faqs 422 for an oversize search", async () => {
    const response = await call("GET", `/api/customer/faqs?search=${"x".repeat(101)}`);
    assert.equal(response.status, 422);
    assert.equal(calls.listFaqs, undefined);
  });

  await context.test("GET /me hides assistant details unless enabled", async () => {
    let body = await (await call("GET", "/api/customer/me")).json();
    assert.equal(body.data.assistant.enabled, false);
    assert.deepEqual(body.data.customer, {
      userId: 20,
      firstName: "Casey",
      lastName: "Customer",
      email: "casey@customer.test",
    });
    assert.deepEqual(body.data.company, { companyId: 7, companyName: "Acme" });

    impl.findAiSettings = async () => ({ enabled: false, assistantName: "Off", greeting: "no" });
    body = await (await call("GET", "/api/customer/me")).json();
    assert.equal(body.data.assistant.enabled, false);

    impl.findAiSettings = async () => ({
      enabled: true,
      assistantName: "Acme Bot",
      greeting: "Hello!",
      tone: "friendly",
      customInstructions: "secret instructions",
      confidenceThreshold: 80,
      escalateAfterFailures: 3,
      fallbackMessage: "fallback",
    });
    const response = await call("GET", "/api/customer/me");
    assert.equal(response.headers.get("cache-control"), "no-store");
    body = await response.json();
    assert.deepEqual(body.data.assistant, {
      enabled: true,
      assistantName: "Acme Bot",
      greeting: "Hello!",
    });
    const text = jsonKeys(body);
    assert.ok(!text.includes("secret instructions"));
    assert.ok(!text.includes("confidenceThreshold"));
    assert.equal(calls.findAiSettings.at(-1)[0], 7);
  });

  await context.test("GET /me survives an AI settings failure", async () => {
    impl.findAiSettings = async () => {
      throw new Error("db down");
    };
    const response = await call("GET", "/api/customer/me");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.assistant.enabled, false);
  });

  await context.test("model errors become a generic 500", async () => {
    impl.listCustomerTickets = async () => {
      throw new Error("secret sql detail");
    };
    const response = await call("GET", "/api/customer/tickets");
    assert.equal(response.status, 500);
    const text = JSON.stringify(await response.json());
    assert.match(text, /Internal server error/);
    assert.ok(!text.includes("secret sql detail"));
  });
});
