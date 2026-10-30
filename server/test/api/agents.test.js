process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";
process.env.CLIENT_ORIGIN = "http://localhost:5173";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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
  companyName: "Acme",
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

function seedUsers() {
  const user = (userId, companyId, firstName, roleName, extra = {}) => ({
    userId,
    companyId,
    firstName,
    lastName: "Test",
    email: `${firstName.toLowerCase()}@example.test`,
    passwordHash: "hash-should-never-leak",
    googleId: null,
    accountStatus: "Active",
    onlineStatus: "Offline",
    roleName,
    ...extra,
  });

  return [
    user(2, 7, "Ada", "Company Admin"),
    user(5, 7, "Sam", "Support Agent"),
    user(6, 7, "Riya", "Support Agent"),
    user(8, 7, "Nia", "Support Agent", { passwordHash: null }),
    user(9, 7, "Dev", "Support Agent", { accountStatus: "Inactive" }),
    user(20, 8, "Gina", "Support Agent"),
  ];
}

function seedTickets() {
  return [
    { ticketId: 1, companyId: 7, assignedAgentId: 5, status: "Open" },
    { ticketId: 2, companyId: 7, assignedAgentId: 5, status: "In Progress" },
    { ticketId: 3, companyId: 7, assignedAgentId: 5, status: "Resolved" },
    { ticketId: 4, companyId: 8, assignedAgentId: 20, status: "Open" },
  ];
}

test("company agents API", async (context) => {
  let users;
  let tickets;
  let tokenRows;
  let mails;
  let mailerImpl;
  let contextImpl;
  let nextUserId;
  let calls;

  const isOpen = (t) => t.status === "Open" || t.status === "In Progress";
  const present = (u, companyId) => ({
    agentId: u.userId,
    firstName: u.firstName,
    lastName: u.lastName,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    status: u.accountStatus,
    onlineStatus: u.onlineStatus,
    invitePending: !u.passwordHash && !u.googleId,
    openTickets: tickets.filter(
      (t) => t.companyId === companyId && t.assignedAgentId === u.userId && isOpen(t),
    ).length,
  });
  const agentRow = (companyId, agentId) =>
    users.find(
      (u) =>
        u.userId === agentId && u.companyId === companyId && u.roleName === "Support Agent",
    );

  const agentModel = {
    listAgents: async (companyId) => {
      calls.push(["listAgents", companyId]);
      return users
        .filter((u) => u.companyId === companyId && u.roleName === "Support Agent")
        .map((u) => present(u, companyId));
    },
    findAgent: async (companyId, agentId) => {
      const row = agentRow(companyId, agentId);
      return row ? present(row, companyId) : null;
    },
    createAgent: async (companyId, input) => {
      calls.push(["createAgent", companyId, input]);
      if (users.some((u) => u.email === input.email)) {
        throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
      }
      const row = {
        userId: nextUserId++,
        companyId,
        ...input,
        passwordHash: null,
        googleId: null,
        accountStatus: "Active",
        onlineStatus: "Offline",
        roleName: "Support Agent",
      };
      users.push(row);
      return present(row, companyId);
    },
    setAgentStatus: async (companyId, agentId, status) => {
      calls.push(["setAgentStatus", companyId, agentId, status]);
      const row = agentRow(companyId, agentId);
      if (!row) return 0;
      row.accountStatus = status;
      return 1;
    },
    unassignOpenTickets: async (companyId, agentId) => {
      calls.push(["unassignOpenTickets", companyId, agentId]);
      let count = 0;
      for (const t of tickets) {
        if (t.companyId === companyId && t.assignedAgentId === agentId && isOpen(t)) {
          t.assignedAgentId = null;
          count += 1;
        }
      }
      return count;
    },
  };

  const userModel = {
    findByEmail: async (email) =>
      users.find((u) => u.email === email.toLowerCase().trim()) || null,
  };

  const tokenModel = {
    createPasswordResetToken: async (userId, tokenHash, expiresAt) => {
      tokenRows.push({ userId, tokenHash, expiresAt, active: true });
    },
    invalidateUserTokens: async (userId) => {
      calls.push(["invalidateUserTokens", userId]);
      for (const row of tokenRows) if (row.userId === userId) row.active = false;
    },
  };

  const ticketModel = {
    findTicketById: async (companyId, ticketId) =>
      tickets.find((t) => t.companyId === companyId && t.ticketId === ticketId) || null,
    updateTicket: async (companyId, ticketId, changes) => {
      const ticket = tickets.find((t) => t.companyId === companyId && t.ticketId === ticketId);
      Object.assign(ticket, changes);
      return ticket;
    },
    // Same predicate as the real SQL: company, Support Agent, Active
    findAssignableAgent: async (companyId, agentId) => {
      const row = agentRow(companyId, agentId);
      return row && row.accountStatus === "Active" ? { userId: row.userId } : null;
    },
    listAssignableAgents: async () => [],
  };

  const companyPortalModel = {
    findCompanyAdminContext: async (userId) => contextImpl(userId),
  };

  const server = await startTestServer({
    companyPortalModel,
    agentModel,
    userModel,
    tokenModel,
    ticketModel,
    sendAgentInviteEmail: async (to, link, details) => {
      if (mailerImpl) return mailerImpl(to, link, details);
      mails.push({ to, link, details });
    },
  });
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

  context.beforeEach(() => {
    users = seedUsers();
    tickets = seedTickets();
    tokenRows = [];
    mails = [];
    mailerImpl = null;
    calls = [];
    nextUserId = 100;
    contextImpl = async () => ({ ...baseContext });
  });

  const routes = [
    ["GET", "/api/company/agents", undefined],
    ["POST", "/api/company/agents", { firstName: "A", lastName: "B", email: "ab@x.test" }],
    ["POST", "/api/company/agents/8/resend-invite", undefined],
    ["PATCH", "/api/company/agents/5", { status: "Inactive" }],
  ];

  await context.test("401 without credentials", async () => {
    const response = await call("GET", "/api/company/agents", { token: null });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "AUTHENTICATION_REQUIRED");
  });

  await context.test("403 for Support Agent and Platform Admin tokens", async () => {
    const tokens = [
      createAccessToken({ accountType: "individual", userId: 1, email: "a@x.test", roleName: "Platform Admin" }),
      createAccessToken({ accountType: "individual", userId: 5, email: "b@x.test", roleName: "Support Agent" }),
    ];
    for (const token of tokens) {
      for (const [method, path, body] of routes) {
        const response = await call(method, path, { token, body });
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.equal((await response.json()).code, "ROLE_FORBIDDEN");
      }
    }
    assert.equal(calls.length, 0);
  });

  const guardCases = [
    ["COMPANY_ACCESS_DENIED", async () => null],
    ["COMPANY_INACTIVE", async () => ({ ...baseContext, companyStatus: "Suspended" })],
    ["ACCOUNT_INACTIVE", async () => ({ ...baseContext, userStatus: "Suspended" })],
    ["ROLE_FORBIDDEN", async () => ({ ...baseContext, roleName: "Support Agent" })],
  ];
  for (const [code, impl] of guardCases) {
    await context.test(`403 ${code} stops every route before the models`, async () => {
      contextImpl = impl;
      for (const [method, path, body] of routes) {
        const response = await call(method, path, { body });
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.equal((await response.json()).code, code);
      }
      assert.equal(calls.length, 0);
      assert.equal(mails.length, 0);
    });
  }

  await context.test("list returns own-company agents with workload and summary", async () => {
    const response = await call("GET", "/api/company/agents?companyId=8", {
      token: companyToken({ companyId: 999 }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();

    assert.deepEqual(calls[0], ["listAgents", 7]);
    const names = body.data.agents.map((a) => a.firstName).sort();
    assert.deepEqual(names, ["Dev", "Nia", "Riya", "Sam"]);
    const sam = body.data.agents.find((a) => a.firstName === "Sam");
    assert.equal(sam.openTickets, 2);
    assert.equal(sam.invitePending, false);
    assert.equal(body.data.agents.find((a) => a.firstName === "Nia").invitePending, true);
    assert.deepEqual(body.data.summary, { total: 4, active: 3, inactive: 1, invitePending: 1 });
    assert.ok(!/passwordHash|password_hash|googleId|hash-should-never-leak|token/i.test(JSON.stringify(body)));
  });

  await context.test("invite creates the agent, mails a link and never returns it", async () => {
    const response = await call("POST", "/api/company/agents", {
      body: {
        firstName: " Lee ",
        lastName: "Wong",
        email: " Lee.Wong@Example.TEST ",
        companyId: 8,
        roleName: "Company Admin",
      },
    });
    assert.equal(response.status, 201);
    const text = await response.text();
    const body = JSON.parse(text);

    assert.equal(body.data.emailSent, true);
    assert.equal(body.data.agent.email, "lee.wong@example.test");
    assert.equal(body.data.agent.invitePending, true);
    assert.equal(body.data.agent.status, "Active");

    const created = users.find((u) => u.email === "lee.wong@example.test");
    assert.equal(created.companyId, 7);
    assert.equal(created.roleName, "Support Agent");
    assert.equal(created.firstName, "Lee");

    assert.equal(mails.length, 1);
    assert.equal(mails[0].to, "lee.wong@example.test");
    assert.equal(mails[0].details.companyName, "Acme");
    const match = mails[0].link.match(/^http:\/\/localhost:5173\/reset-password\?token=([0-9a-f]{64})$/);
    assert.ok(match, mails[0].link);

    assert.equal(tokenRows.length, 1);
    assert.equal(tokenRows[0].userId, created.userId);
    assert.equal(
      tokenRows[0].tokenHash,
      crypto.createHash("sha256").update(match[1]).digest("hex"),
    );
    const ttl = tokenRows[0].expiresAt.getTime() - Date.now();
    assert.ok(Math.abs(ttl - 72 * 3600 * 1000) < 60 * 1000, String(ttl));

    assert.ok(!text.includes(match[1]));
    assert.ok(!/reset-password|token/i.test(text));
  });

  await context.test("invite rejects an email that exists in any company", async () => {
    for (const email of ["gina@example.test", "ADA@example.test"]) {
      const response = await call("POST", "/api/company/agents", {
        body: { firstName: "X", lastName: "Y", email },
      });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, "EMAIL_IN_USE");
    }
    assert.equal(mails.length, 0);
  });

  await context.test("invite maps a duplicate-entry race to 409", async () => {
    const original = userModel.findByEmail;
    userModel.findByEmail = async () => null;
    try {
      const response = await call("POST", "/api/company/agents", {
        body: { firstName: "X", lastName: "Y", email: "sam@example.test" },
      });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, "EMAIL_IN_USE");
    } finally {
      userModel.findByEmail = original;
    }
  });

  await context.test("invite validation returns 422 with field errors", async () => {
    const bodies = [
      [{}, ["firstName", "lastName", "email"]],
      [{ firstName: "A".repeat(51), lastName: "B", email: "a@b.test" }, ["firstName"]],
      [{ firstName: "A", lastName: " ", email: "a@b.test" }, ["lastName"]],
      [{ firstName: "A", lastName: "B", email: "not-an-email" }, ["email"]],
      [{ firstName: "A\u0007", lastName: "B", email: "a@b.test" }, ["firstName"]],
      [[], ["body"]],
    ];
    for (const [body, fields] of bodies) {
      const response = await call("POST", "/api/company/agents", { body });
      assert.equal(response.status, 422, JSON.stringify(body));
      const json = await response.json();
      assert.equal(json.code, "VALIDATION_ERROR");
      assert.deepEqual(json.errors.map((e) => e.field), fields);
    }
    assert.equal(calls.length, 0);
  });

  await context.test("a failing mailer still creates the agent with emailSent false", async () => {
    mailerImpl = async () => {
      throw Object.assign(new Error("smtp down http://leak.test/secret"), { code: "ESOCKET" });
    };
    const response = await call("POST", "/api/company/agents", {
      body: { firstName: "Mia", lastName: "Fox", email: "mia@example.test" },
    });
    assert.equal(response.status, 201);
    const text = await response.text();
    assert.equal(JSON.parse(text).data.emailSent, false);
    assert.ok(!/leak\.test|reset-password|smtp/i.test(text));
    assert.ok(users.some((u) => u.email === "mia@example.test"));
  });

  await context.test("resend invalidates old tokens and mails a new link", async () => {
    tokenRows.push({ userId: 8, tokenHash: "old", expiresAt: new Date(), active: true });
    const response = await call("POST", "/api/company/agents/8/resend-invite");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { emailSent: true });

    assert.equal(tokenRows.find((r) => r.tokenHash === "old").active, false);
    assert.equal(tokenRows.filter((r) => r.active).length, 1);
    assert.equal(mails.length, 1);
    assert.equal(mails[0].to, "nia@example.test");
  });

  await context.test("resend is refused for set-password, inactive and foreign agents", async () => {
    users.find((u) => u.userId === 8).accountStatus = "Inactive";
    for (const id of [5, 8]) {
      const response = await call("POST", `/api/company/agents/${id}/resend-invite`);
      assert.equal(response.status, 409, String(id));
      assert.equal((await response.json()).code, "INVITE_NOT_PENDING");
    }
    for (const id of [20, 2, 999]) {
      const response = await call("POST", `/api/company/agents/${id}/resend-invite`);
      assert.equal(response.status, 404, String(id));
      assert.equal((await response.json()).code, "AGENT_NOT_FOUND");
    }
    const bad = await call("POST", "/api/company/agents/abc/resend-invite");
    assert.equal(bad.status, 400);
    assert.equal(mails.length, 0);
  });

  await context.test("deactivate unassigns open tickets only, then is idempotent", async () => {
    tokenRows.push({ userId: 5, tokenHash: "x", expiresAt: new Date(), active: true });
    const response = await call("PATCH", "/api/company/agents/5", {
      body: { status: "Inactive", companyId: 8 },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.agent.status, "Inactive");
    assert.equal(body.data.agent.openTickets, 0);
    assert.equal(body.data.unassignedTickets, 2);

    assert.deepEqual(
      calls.filter((c) => c[0] === "unassignOpenTickets"),
      [["unassignOpenTickets", 7, 5]],
    );
    assert.deepEqual(calls.find((c) => c[0] === "setAgentStatus"), ["setAgentStatus", 7, 5, "Inactive"]);
    assert.equal(tokenRows[0].active, false);
    // The Resolved ticket keeps its assignee and the other company is untouched
    assert.equal(tickets.find((t) => t.ticketId === 3).assignedAgentId, 5);
    assert.equal(tickets.find((t) => t.ticketId === 4).assignedAgentId, 20);

    const before = calls.length;
    const again = await call("PATCH", "/api/company/agents/5", { body: { status: "Inactive" } });
    assert.equal(again.status, 200);
    assert.equal((await again.json()).data.unassignedTickets, 0);
    assert.equal(calls.length, before);
  });

  await context.test("reactivate does not touch tickets", async () => {
    const response = await call("PATCH", "/api/company/agents/9", { body: { status: "Active" } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.agent.status, "Active");
    assert.equal(body.data.unassignedTickets, 0);
    assert.ok(!calls.some((c) => c[0] === "unassignOpenTickets"));
  });

  await context.test("a deactivated agent can no longer be assigned a ticket", async () => {
    const before = await call("PATCH", "/api/company/tickets/1", { body: { assignedAgentId: 5 } });
    assert.equal(before.status, 200);

    await call("PATCH", "/api/company/agents/5", { body: { status: "Inactive" } });

    const after = await call("PATCH", "/api/company/tickets/1", { body: { assignedAgentId: 5 } });
    assert.equal(after.status, 422);
    assert.equal((await after.json()).code, "INVALID_ASSIGNEE");
  });

  await context.test("PATCH validation, ids and tenancy", async () => {
    const bad = await call("PATCH", "/api/company/agents/5", { body: { status: "Banned" } });
    assert.equal(bad.status, 422);
    assert.equal((await bad.json()).errors[0].field, "status");

    const missing = await call("PATCH", "/api/company/agents/5", { body: {} });
    assert.equal(missing.status, 422);

    for (const id of ["abc", "0", "1.5"]) {
      const response = await call("PATCH", `/api/company/agents/${id}`, { body: { status: "Inactive" } });
      assert.equal(response.status, 400, id);
      assert.equal((await response.json()).code, "INVALID_AGENT_ID");
    }

    // Other company's agent, a Company Admin's id, nonexistent
    for (const id of [20, 2, 999]) {
      const response = await call("PATCH", `/api/company/agents/${id}`, { body: { status: "Inactive" } });
      assert.equal(response.status, 404, String(id));
      assert.equal((await response.json()).code, "AGENT_NOT_FOUND");
    }
    assert.ok(!calls.some((c) => c[0] === "setAgentStatus"));
    assert.equal(users.find((u) => u.userId === 20).accountStatus, "Active");
  });

  await context.test("model errors become a generic 500", async () => {
    const original = agentModel.listAgents;
    agentModel.listAgents = async () => {
      throw new Error("db exploded");
    };
    try {
      const response = await call("GET", "/api/company/agents");
      assert.equal(response.status, 500);
      assert.ok(!(await response.text()).includes("db exploded"));
    } finally {
      agentModel.listAgents = original;
    }
  });
});
