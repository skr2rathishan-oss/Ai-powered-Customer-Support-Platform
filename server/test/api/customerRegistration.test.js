process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { verifyAccessToken } = require("../../src/utils/token");
const AppError = require("../../src/utils/AppError");

async function startTestServer(dependencies = {}) {
  const app = createApp(dependencies);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const validBody = {
  firstName: "Casey",
  lastName: "Customer",
  email: "Casey@Customer.Test",
  password: "Customer@2026!",
  companyId: 7,
};

test("customer registration and public companies", async (context) => {
  const calls = { created: [], findActive: [], findByEmail: [] };
  let existingUser = null;
  let createImpl;

  const customerModel = {
    listPublicCompanies: async () => [
      // Extra columns must never be exposed
      { companyId: 7, companyName: "Acme", businessEmail: "o@acme.test", status: "Active", phone: "1" },
    ],
    findActiveCompany: async (companyId) => {
      calls.findActive.push(companyId);
      return companyId === 7 ? { companyId: 7, companyName: "Acme" } : null;
    },
    createCustomer: async (customer) => {
      calls.created.push(customer);
      return createImpl(customer);
    },
    findCustomerContext: async (userId) =>
      userId === 50
        ? {
            userId: 50,
            firstName: "Casey",
            lastName: "Customer",
            email: "casey@customer.test",
            userStatus: "Active",
            roleName: "Customer",
            companyId: 7,
            companyName: "Acme",
            companyStatus: "Active",
          }
        : null,
  };
  const userModel = {
    findByEmail: async (email) => {
      calls.findByEmail.push(email);
      return existingUser;
    },
  };
  const aiSettingsModel = { findAiSettings: async () => null };

  const server = await startTestServer({
    customerModel,
    userModel,
    aiSettingsModel,
    hashPassword: async (password) => `hashed:${password}`,
  });
  context.after(() => server.close());

  context.beforeEach(() => {
    calls.created.length = 0;
    calls.findActive.length = 0;
    calls.findByEmail.length = 0;
    existingUser = null;
    createImpl = async (customer) => ({
      userId: 50,
      companyId: customer.companyId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
    });
  });

  const register = (body, path = "/api/auth/customer/register") =>
    fetch(`${server.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  await context.test("201 sets cookie, returns a Customer token and stores a hash", async () => {
    const response = await register(validBody);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("set-cookie"), /^supportpilot_access=/);

    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.roleName, "Customer");
    assert.equal(body.data.user.accountType, "individual");
    assert.equal(body.data.user.userId, 50);
    assert.ok(!JSON.stringify(body).includes("passwordHash"));

    const claims = verifyAccessToken(body.data.token);
    assert.equal(claims.roleName, "Customer");
    assert.equal(claims.userId, "50");
    assert.equal(claims.companyId, undefined);

    assert.deepEqual(calls.findActive, [7]);
    assert.deepEqual(calls.created, [
      {
        companyId: 7,
        firstName: "Casey",
        lastName: "Customer",
        email: "casey@customer.test",
        passwordHash: "hashed:Customer@2026!",
      },
    ]);
    assert.ok(!JSON.stringify(calls.created).includes('"Customer@2026!"'));
  });

  await context.test("is also reachable without the /api prefix and accepts a digit-string companyId", async () => {
    const response = await register({ ...validBody, companyId: "7" }, "/auth/customer/register");
    assert.equal(response.status, 201);
  });

  const invalid = [
    ["weak password", { password: "short" }],
    ["bad email", { email: "nope" }],
    ["missing companyId", { companyId: undefined }],
    ["non-integer companyId", { companyId: "1.5" }],
    ["negative companyId", { companyId: -1 }],
    ["missing first name", { firstName: "" }],
    ["unexpected roleName", { roleName: "Platform Admin" }],
    ["unexpected accountStatus", { accountStatus: "Active" }],
  ];
  for (const [name, patch] of invalid) {
    await context.test(`422 VALIDATION_ERROR for ${name}`, async () => {
      const response = await register({ ...validBody, ...patch });
      assert.equal(response.status, 422);
      const body = await response.json();
      assert.equal(body.message, "Validation failed");
      assert.ok(body.errors.length > 0);
      assert.equal(calls.created.length, 0);
    });
  }

  await context.test("422 for a non-object body", async () => {
    const response = await register([]);
    assert.equal(response.status, 422);
  });

  await context.test("privilege escalation attempt never creates anything", async () => {
    const response = await register({ ...validBody, roleName: "Platform Admin" });
    assert.equal(response.status, 422);
    assert.equal(calls.created.length, 0);
  });

  await context.test("422 COMPANY_NOT_FOUND for a missing or inactive company", async () => {
    const response = await register({ ...validBody, companyId: 99 });
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.code, "COMPANY_NOT_FOUND");
    assert.equal(body.errors[0].field, "companyId");
    assert.equal(calls.created.length, 0);
  });

  await context.test("409 EMAIL_EXISTS from the pre-check", async () => {
    existingUser = { userId: 1, email: "casey@customer.test" };
    const response = await register(validBody);
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, "EMAIL_EXISTS");
    assert.equal(body.errors[0].field, "email");
    assert.deepEqual(calls.findByEmail, ["casey@customer.test"]);
    assert.equal(calls.created.length, 0);
  });

  await context.test("409 EMAIL_EXISTS when the database reports a duplicate", async () => {
    createImpl = async () => {
      throw new AppError("dup", 409, "EMAIL_EXISTS", [{ field: "email", message: "dup" }]);
    };
    const response = await register(validBody);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "EMAIL_EXISTS");
  });

  await context.test("500 CUSTOMER_ROLE_MISSING is passed through", async () => {
    createImpl = async () => {
      throw new AppError("Customer role is not configured", 500, "CUSTOMER_ROLE_MISSING");
    };
    const response = await register(validBody);
    assert.equal(response.status, 500);
    assert.equal((await response.json()).code, "CUSTOMER_ROLE_MISSING");
  });

  await context.test("a freshly registered customer can call /api/customer/me", async () => {
    const { data } = await (await register(validBody)).json();
    const response = await fetch(`${server.baseUrl}/api/customer/me`, {
      headers: { authorization: `Bearer ${data.token}` },
    });
    assert.equal(response.status, 200);
    const me = await response.json();
    assert.equal(me.data.company.companyName, "Acme");
    assert.equal(me.data.customer.userId, 50);
  });

  await context.test("GET /api/public/companies needs no auth and exposes id and name only", async () => {
    const response = await fetch(`${server.baseUrl}/api/public/companies`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      success: true,
      data: { companies: [{ companyId: 7, companyName: "Acme" }] },
    });
  });
});
