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
  companyName: "Acme",
  industry: "Technology",
  businessEmail: "hello@acme.test",
  phone: null,
  website: "https://acme.test",
  description: null,
  companyStatus: "Active",
  registrationDate: "2026-01-01T00:00:00.000Z",
  passwordHash: "should-never-leak",
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

test("GET /api/company/me", async (context) => {
  const calls = { context: [], counts: [] };
  let contextImpl = async () => ({ ...baseContext });
  let countsImpl = async () => ({ supportAgents: 3 });

  const companyPortalModel = {
    findCompanyAdminContext: async (userId) => {
      calls.context.push(userId);
      return contextImpl(userId);
    },
    getCompanyOverviewCounts: async (companyId) => {
      calls.counts.push(companyId);
      return countsImpl(companyId);
    },
  };

  const server = await startTestServer({ companyPortalModel });
  context.after(() => server.close());

  const { cookieName } = getAuthConfig();
  const get = (path, token) =>
    fetch(`${server.baseUrl}${path}`, {
      headers: token ? { cookie: `${cookieName}=${token}` } : {},
    });

  context.beforeEach(() => {
    calls.context.length = 0;
    calls.counts.length = 0;
    contextImpl = async () => ({ ...baseContext });
    countsImpl = async () => ({ supportAgents: 3 });
  });

  await context.test("401 without credentials", async () => {
    const response = await get("/api/company/me");
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.code, "AUTHENTICATION_REQUIRED");
  });

  await context.test("401 with an invalid token", async () => {
    const response = await get("/api/company/me", "not-a-token");
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.code, "INVALID_SESSION");
  });

  await context.test("403 for Platform Admin without touching the model", async () => {
    const token = createAccessToken({
      accountType: "individual",
      userId: 1,
      email: "admin@supportpilot.com",
      roleName: "Platform Admin",
    });
    const response = await get("/api/company/me", token);
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.code, "ROLE_FORBIDDEN");
    assert.equal(calls.context.length, 0);
  });

  await context.test("403 for Support Agent", async () => {
    const token = createAccessToken({
      accountType: "individual",
      userId: 4,
      email: "agent@acme.test",
      roleName: "Support Agent",
    });
    const response = await get("/api/company/me", token);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "ROLE_FORBIDDEN");
    assert.equal(calls.context.length, 0);
  });

  await context.test("200 returns the documented shape without secrets", async () => {
    const response = await get("/api/company/me", companyToken());
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(Object.keys(body.data.user).sort(), [
      "email", "firstName", "lastName", "onlineStatus", "roleName", "userId",
    ]);
    assert.deepEqual(Object.keys(body.data.company).sort(), [
      "businessEmail", "companyId", "companyName", "description", "industry",
      "phone", "registrationDate", "status", "website",
    ]);
    assert.equal(body.data.company.companyName, "Acme");
    assert.equal(body.data.company.status, "Active");
    assert.equal(body.data.overview.supportAgents, 3);
    assert.equal(body.data.overview.openTickets, 0);
    assert.equal(body.data.overview.aiResolutionRate, null);
    assert.deepEqual(body.data.overview.features, {
      tickets: false, agents: false, faqs: false, aiSettings: false,
    });
    assert.ok(!/passwordHash|password_hash|should-never-leak/i.test(JSON.stringify(body)));
  });

  await context.test("sends Cache-Control: no-store", async () => {
    const response = await get("/api/company/me", companyToken());
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  await context.test("200 for individual-mode token without companyId", async () => {
    const token = createAccessToken({
      accountType: "individual",
      userId: 2,
      email: "owner@acme.test",
      roleName: "Company Admin",
    });
    const response = await get("/api/company/me", token);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.company.companyId, 7);
  });

  await context.test("company comes from the database, not token or query", async () => {
    const token = companyToken({ companyId: 999 });
    const response = await get("/api/company/me?companyId=555", token);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.company.companyId, 7);
    assert.deepEqual(calls.context, [2]);
    assert.deepEqual(calls.counts, [7]);
  });

  await context.test("403 COMPANY_ACCESS_DENIED when no company is linked", async () => {
    contextImpl = async () => null;
    const response = await get("/api/company/me", companyToken());
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "COMPANY_ACCESS_DENIED");
  });

  await context.test("403 COMPANY_INACTIVE for a suspended company", async () => {
    contextImpl = async () => ({ ...baseContext, companyStatus: "Suspended" });
    const response = await get("/api/company/me", companyToken());
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "COMPANY_INACTIVE");
  });

  await context.test("403 ACCOUNT_INACTIVE for a disabled user", async () => {
    contextImpl = async () => ({ ...baseContext, userStatus: "Suspended" });
    const response = await get("/api/company/me", companyToken());
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "ACCOUNT_INACTIVE");
  });

  await context.test("403 when the database role is not Company Admin", async () => {
    contextImpl = async () => ({ ...baseContext, roleName: "Support Agent" });
    const response = await get("/api/company/me", companyToken());
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "ROLE_FORBIDDEN");
  });

  await context.test("200 with zero agents when counts fail", async () => {
    countsImpl = async () => {
      throw new Error("counts unavailable");
    };
    const response = await get("/api/company/me", companyToken());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.overview.supportAgents, 0);
  });

  await context.test("500 when the context lookup throws", async () => {
    contextImpl = async () => {
      throw new Error("db down");
    };
    const response = await get("/api/company/me", companyToken());
    assert.equal(response.status, 500);
  });
});
