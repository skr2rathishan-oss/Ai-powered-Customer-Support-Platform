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

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("Platform Admin Dashboard API & Role-Based Access Control", async (context) => {
  const mockAdminModel = {
    getPlatformStats: async () => ({
      totalCompanies: 120,
      activeCompanies: 96,
      suspendedCompanies: 10,
      pendingCompanies: 14,
      activePercentage: 80,
      pendingPercentage: 12,
      suspendedPercentage: 8,
      totalUsers: 450,
      companyAdmins: 120,
      supportAgents: 330,
      monthlyGrowth: "24.5%",
    }),
    getRegistrationTrends: async (months) => [
      { key: "2026-08", month: "Aug", count: 12, heightPercentage: 80 },
      { key: "2026-09", month: "Sep", count: 15, heightPercentage: 100 },
    ],
    getRecentRegistrations: async () => [
      {
        companyId: 1,
        companyName: "Velocity AI",
        industry: "Technology",
        businessEmail: "hello@velocity-ai.co",
        websiteUrl: "https://velocity-ai.co",
        status: "Active",
        registrationDate: new Date().toISOString(),
      },
    ],
    getRecentActivities: async () => [
      {
        id: "act-1",
        title: "Velocity AI joined",
        message: "Trial plan activated.",
        type: "CompanyRegistration",
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const { createAdminService } = require("../../src/services/adminService");
  const adminService = createAdminService({ adminModel: mockAdminModel });

  const server = await startTestServer({ adminService });
  context.after(() => server.close());

  const { cookieName } = getAuthConfig();

  await context.test("GET /api/admin/dashboard without auth cookie returns 401", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/dashboard`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.code, "AUTHENTICATION_REQUIRED");
  });

  await context.test("GET /api/admin/dashboard with non-admin role (Company Admin) returns 403 Forbidden", async () => {
    const nonAdminToken = createAccessToken({
      accountType: "company",
      userId: 2,
      companyId: 1,
      email: "companyadmin@example.com",
      roleName: "Company Admin",
    });

    const response = await fetch(`${server.baseUrl}/api/admin/dashboard`, {
      headers: {
        cookie: `${cookieName}=${nonAdminToken}`,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(body.code, "ROLE_FORBIDDEN");
  });

  await context.test("GET /api/admin/dashboard with Support Agent role returns 403 Forbidden", async () => {
    const agentToken = createAccessToken({
      accountType: "individual",
      userId: 4,
      email: "agent@example.com",
      roleName: "Support Agent",
    });

    const response = await fetch(`${server.baseUrl}/api/admin/dashboard`, {
      headers: {
        cookie: `${cookieName}=${agentToken}`,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(body.code, "ROLE_FORBIDDEN");
  });

  await context.test("GET /api/admin/dashboard with Platform Admin role returns 200 with complete metrics", async () => {
    const adminToken = createAccessToken({
      accountType: "individual",
      userId: 1,
      email: "admin@supportpilot.com",
      firstName: "Super",
      lastName: "Admin",
      roleName: "Platform Admin",
    });

    const response = await fetch(`${server.baseUrl}/api/admin/dashboard`, {
      headers: {
        cookie: `${cookieName}=${adminToken}`,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.stats);
    assert.equal(body.data.stats.totalCompanies, 120);
    assert.equal(body.data.stats.activeCompanies, 96);
    assert.ok(Array.isArray(body.data.growthTrends));
    assert.ok(Array.isArray(body.data.recentCompanies));
    assert.ok(Array.isArray(body.data.activities));
    assert.ok(Array.isArray(body.data.health));
    assert.equal(body.data.health[0].status, "HEALTHY");
  });
});

