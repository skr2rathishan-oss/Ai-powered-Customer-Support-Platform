process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { createAccessToken } = require("../../src/utils/token");
const { getAuthConfig } = require("../../src/config/auth");
const AppError = require("../../src/utils/AppError");

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

test("Platform Admin Companies Management API Tests", async (context) => {
  let companiesStore = [
    {
      companyId: 1,
      companyName: "Acme Corp",
      industry: "Technology",
      businessEmail: "contact@acme.com",
      companyPhone: "+1 555-0100",
      websiteUrl: "https://acme.com",
      description: "Cloud computing and SaaS.",
      status: "Active",
      registrationDate: "2026-01-15T00:00:00.000Z",
      adminId: 10,
      adminFirstName: "Alice",
      adminLastName: "Smith",
      adminEmail: "alice@acme.com",
      totalUsers: 5,
    },
    {
      companyId: 2,
      companyName: "Beta Logistics",
      industry: "Logistics",
      businessEmail: "ops@betalog.com",
      companyPhone: "+1 555-0200",
      websiteUrl: "https://betalog.com",
      description: "Freight and supply chain.",
      status: "Pending",
      registrationDate: "2026-02-10T00:00:00.000Z",
      adminId: 20,
      adminFirstName: "Bob",
      adminLastName: "Jones",
      adminEmail: "bob@betalog.com",
      totalUsers: 2,
    },
  ];

  const mockAdminModel = {
    getCompaniesDirectory: async (params) => {
      let filtered = [...companiesStore];
      if (params.status && params.status !== "all") {
        filtered = filtered.filter((c) => c.status.toLowerCase() === params.status.toLowerCase());
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter((c) => c.companyName.toLowerCase().includes(q) || c.businessEmail.toLowerCase().includes(q));
      }
      return {
        companies: filtered,
        counts: { total: companiesStore.length, active: 1, pending: 1, suspended: 0 },
        pagination: { page: 1, limit: 10, total: filtered.length, totalPages: 1 },
      };
    },
    getCompanyById: async (id) => {
      const c = companiesStore.find((item) => item.companyId === Number(id));
      if (!c) return null;
      return {
        ...c,
        users: [
          { userId: c.adminId, firstName: c.adminFirstName, lastName: c.adminLastName, email: c.adminEmail, roleName: "Company Admin" },
        ],
      };
    },
    updateCompanyStatus: async (id, status) => {
      const c = companiesStore.find((item) => item.companyId === Number(id));
      if (!c) return null;
      c.status = status;
      return { ...c, users: [] };
    },
    deleteCompany: async (id) => {
      const index = companiesStore.findIndex((item) => item.companyId === Number(id));
      if (index === -1) return false;
      companiesStore.splice(index, 1);
      return true;
    },
  };

  const registrations = [];
  const mockCompanyModel = {
    createRegistration: async (registration) => {
      if (companiesStore.some((c) => c.businessEmail === registration.businessEmail)) {
        throw new AppError(
          "A company with this business email already exists",
          409,
          "BUSINESS_EMAIL_EXISTS",
          [{ field: "businessEmail", message: "A company with this business email already exists" }],
        );
      }
      registrations.push(registration);
      const companyId = 100 + registrations.length;
      companiesStore.push({
        companyId,
        companyName: registration.companyName,
        industry: registration.industry,
        businessEmail: registration.businessEmail,
        status: registration.companyStatus,
        registrationDate: new Date().toISOString(),
        adminId: 500 + registrations.length,
        adminFirstName: registration.adminFirstName,
        adminLastName: registration.adminLastName,
        adminEmail: registration.adminEmail,
      });
      return { companyId, userId: 500 + registrations.length };
    },
  };

  const { createAdminService } = require("../../src/services/adminService");
  const adminService = createAdminService({
    adminModel: mockAdminModel,
    companyModel: mockCompanyModel,
    hashPassword: async (password) => `hashed:${password}`,
  });

  const server = await startTestServer({ adminService });
  context.after(() => server.close());

  const { cookieName } = getAuthConfig();

  const adminToken = createAccessToken({
    accountType: "individual",
    userId: 1,
    email: "admin@supportpilot.com",
    roleName: "Platform Admin",
  });

  await context.test("GET /api/admin/companies requires Platform Admin authorization", async () => {
    const unauthRes = await fetch(`${server.baseUrl}/api/admin/companies`);
    assert.equal(unauthRes.status, 401);

    const nonAdminToken = createAccessToken({
      accountType: "company",
      userId: 2,
      companyId: 1,
      email: "companyadmin@example.com",
      roleName: "Company Admin",
    });
    const forbiddenRes = await fetch(`${server.baseUrl}/api/admin/companies`, {
      headers: { cookie: `${cookieName}=${nonAdminToken}` },
    });
    assert.equal(forbiddenRes.status, 403);
  });

  await context.test("GET /api/admin/companies returns enterprise directory with counts", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/companies`, {
      headers: { cookie: `${cookieName}=${adminToken}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.companies.length, 2);
    assert.equal(body.data.counts.total, 2);
    assert.equal(body.data.counts.active, 1);
  });

  await context.test("GET /api/admin/companies with search filter", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/companies?search=Acme`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.companies.length, 1);
    assert.equal(body.data.companies[0].companyName, "Acme Corp");
  });

  await context.test("GET /api/admin/companies/:id returns company detail with users", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/companies/1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.companyName, "Acme Corp");
    assert.equal(body.data.users.length, 1);
  });

  const onboardingPayload = {
    companyName: "Gamma Health",
    industry: "Healthcare",
    businessEmail: "Contact@GammaHealth.com",
    phone: "+94 77 123 4567",
    website: "https://gammahealth.com",
    description: "Telehealth provider.",
    adminFirstName: "Grace",
    adminLastName: "Perera",
    adminEmail: "grace@gammahealth.com",
    password: "Str0ng!Pass",
    status: "Pending",
  };

  await context.test("POST /api/admin/companies requires Platform Admin authorization", async () => {
    const nonAdminToken = createAccessToken({
      accountType: "company",
      userId: 2,
      companyId: 1,
      email: "companyadmin@example.com",
      roleName: "Company Admin",
    });
    const response = await fetch(`${server.baseUrl}/api/admin/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${nonAdminToken}`,
      },
      body: JSON.stringify(onboardingPayload),
    });

    assert.equal(response.status, 403);
    assert.equal(registrations.length, 0);
  });

  await context.test("POST /api/admin/companies onboards a company with a hashed admin password", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(onboardingPayload),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.companyName, "Gamma Health");
    assert.equal(body.data.businessEmail, "contact@gammahealth.com");
    assert.equal(body.data.status, "Pending");
    assert.equal(registrations[0].passwordHash, "hashed:Str0ng!Pass");
    assert.equal(registrations[0].password, undefined);
    assert.equal(registrations[0].adminStatus, "Active");
    assert.equal(response.headers.get("set-cookie"), null);
  });

  await context.test("POST /api/admin/companies rejects a duplicate business email with 409", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ ...onboardingPayload, adminEmail: "other@gammahealth.com" }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.code, "BUSINESS_EMAIL_EXISTS");
    assert.equal(body.errors[0].field, "businessEmail");
  });

  await context.test("POST /api/admin/companies returns field errors for invalid input", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        ...onboardingPayload,
        companyName: "",
        businessEmail: "not-an-email",
        password: "weak",
        status: "Suspended",
      }),
    });
    const body = await response.json();
    const fields = body.errors.map((error) => error.field);

    assert.equal(response.status, 422);
    assert.ok(fields.includes("companyName"));
    assert.ok(fields.includes("businessEmail"));
    assert.ok(fields.includes("password"));
    assert.ok(fields.includes("status"));
  });

  await context.test("PATCH /api/admin/companies/:id/status updates status", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/companies/2/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "Active" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.status, "Active");
  });

  await context.test("DELETE /api/admin/companies/:id deletes company", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/companies/2`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
  });
});
