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

test("HTTP-only cookie authentication API", async (context) => {
  const authService = {
    async signIn(credentials) {
      if (credentials.password !== "correct-password") {
        throw new AppError(
          "Invalid email or password",
          401,
          "INVALID_CREDENTIALS",
        );
      }

      return {
        user: {
          userId: 12,
          email: credentials.email,
          onlineStatus: "Offline",
          roleName: "Agent",
        },
        accessToken: createAccessToken({
          userId: 12,
          email: credentials.email,
          roleName: "Agent",
        }),
      };
    },
  };
  const server = await startTestServer(authService);
  context.after(server.close);

  await context.test("returns 422 before calling the service", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "invalid", password: "" }),
    });
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.deepEqual(
      body.errors.map((error) => error.field),
      ["email", "password"],
    );
  });

  await context.test("sets a hardened cookie and hides the JWT", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        email: " Agent@SupportPilot.com ",
        password: "correct-password",
      }),
    });
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie");

    assert.equal(response.status, 200);
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

  await context.test("returns a generic 401 for bad credentials", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "agent@supportpilot.com",
        password: "incorrect-password",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.code, "INVALID_CREDENTIALS");
  });

  await context.test("authenticates protected routes from the cookie", async () => {
    const token = createAccessToken({
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
    assert.equal(body.data.user.roleName, "Agent");
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
