process.env.NODE_ENV = "test";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET =
  "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const AppError = require("../../src/utils/AppError");
const { createAccessToken } = require("../../src/utils/token");
const { createApp } = require("../../src/app");

const VALID_PASSWORD = "Correct@123";

function startTestServer(authService) {
  const server = createApp({ authService }).listen(0, "127.0.0.1");

  return new Promise((resolve, reject) => {
    server.once("listening", () => {
      resolve({
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
    server.once("error", reject);
  });
}

test("account-type-aware HTTP-only cookie authentication API", async (context) => {
  const authService = {
    async signIn(credentials) {
      if (credentials.password !== VALID_PASSWORD) {
        throw new AppError(
          "Invalid email or password",
          401,
          "INVALID_CREDENTIALS",
        );
      }

      const user =
        credentials.accountType === "company"
          ? {
              accountType: "company",
              userId: 41,
              companyId: 7,
              companyName: "Acme Support",
              email: credentials.email,
              onlineStatus: "Offline",
              roleName: "Company Admin",
            }
          : {
              accountType: "individual",
              userId: 12,
              email: credentials.email,
              onlineStatus: "Offline",
              roleName: "Agent",
            };

      return {
        user,
        accessToken: createAccessToken(user),
      };
    },
    async registerCompany(registration) {
      return {
        user: {
          accountType: "company",
          userId: 91,
          companyId: 27,
          companyName: registration.companyName,
          email: registration.businessEmail,
          adminEmail: registration.adminEmail,
          onlineStatus: "Offline",
          roleName: "Company Admin",
        },
        accessToken: createAccessToken({
          accountType: "company",
          userId: 91,
          companyId: 27,
          companyName: registration.companyName,
          email: registration.businessEmail,
          roleName: "Company Admin",
        }),
      };
    },
  };
  const server = await startTestServer(authService);
  context.after(server.close);

  await context.test("returns 422 when account type is missing", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "invalid", password: "" }),
    });
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.deepEqual(
      body.errors.map((error) => error.field),
      ["accountType", "email", "password"],
    );
  });

  await context.test("rejects an unknown account type", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountType: "admin",
        email: "admin@example.com",
        password: VALID_PASSWORD,
      }),
    });

    assert.equal(response.status, 422);
  });

  await context.test("sets a hardened individual cookie and hides the JWT", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        accountType: "individual",
        email: " Agent@SupportPilot.com ",
        password: VALID_PASSWORD,
      }),
    });
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie");

    assert.equal(response.status, 200);
    assert.equal(body.data.user.accountType, "individual");
    assert.equal(body.data.user.email, "agent@supportpilot.com");
    assert.equal(body.data.accessToken, undefined);
    assert.match(setCookie, /^supportpilot_access=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.equal(
      response.headers.get("access-control-allow-credentials"),
      "true",
    );
  });

  await context.test("returns company identity for company sign-in", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountType: "company",
        email: "support@acme.example",
        password: VALID_PASSWORD,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.user.accountType, "company");
    assert.equal(body.data.user.companyId, 7);
    assert.equal(body.data.user.companyName, "Acme Support");
  });

  await context.test("registers a company and sets the auth cookie", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/company/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyName: "Acme Support",
        industry: "SaaS",
        businessEmail: "contact@acme.example",
        phone: "+1 555 012 3456",
        website: "https://acme.example",
        description: "Support software",
        adminFirstName: "Alex",
        adminLastName: "Morgan",
        adminEmail: "admin@acme.example",
        password: VALID_PASSWORD,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.user.accountType, "company");
    assert.equal(body.data.user.adminEmail, "admin@acme.example");
    assert.match(response.headers.get("set-cookie"), /^supportpilot_access=/);
  });

  await context.test("rejects confirmPassword at the API boundary", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/company/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyName: "Acme Support",
        industry: "SaaS",
        businessEmail: "contact@acme.example",
        adminFirstName: "Alex",
        adminLastName: "Morgan",
        adminEmail: "admin@acme.example",
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      }),
    });

    assert.equal(response.status, 422);
  });

  await context.test("returns a generic 401 for bad credentials", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountType: "individual",
        email: "agent@supportpilot.com",
        password: "Incorrect@123",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.code, "INVALID_CREDENTIALS");
  });

  await context.test("returns individual account type from the cookie", async () => {
    const token = createAccessToken({
      accountType: "individual",
      userId: 12,
      email: "agent@supportpilot.com",
      roleName: "Agent",
    });
    const response = await fetch(`${server.baseUrl}/api/auth/me`, {
      headers: { cookie: `supportpilot_access=${token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.user.userId, "12");
    assert.equal(body.data.user.accountType, "individual");
    assert.equal(body.data.user.roleName, "Agent");
  });

  await context.test("returns company identity from the cookie", async () => {
    const token = createAccessToken({
      accountType: "company",
      userId: 41,
      companyId: 7,
      companyName: "Acme Support",
      email: "support@acme.example",
      roleName: "Company Admin",
    });
    const response = await fetch(`${server.baseUrl}/api/auth/me`, {
      headers: { cookie: `supportpilot_access=${token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.user.accountType, "company");
    assert.equal(body.data.user.userId, "41");
    assert.equal(body.data.user.companyId, "7");
  });

  await context.test("rejects protected routes without the cookie", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/me`);
    assert.equal(response.status, 401);
  });

  await context.test("clears the cookie on sign-out", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/sign-out`, {
      method: "POST",
    });
    const setCookie = response.headers.get("set-cookie");

    assert.equal(response.status, 200);
    assert.match(setCookie, /^supportpilot_access=/);
    assert.match(setCookie, /Expires=Thu, 01 Jan 1970/i);
  });
});
