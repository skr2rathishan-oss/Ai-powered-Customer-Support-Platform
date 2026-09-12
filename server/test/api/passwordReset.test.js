process.env.NODE_ENV = "test";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET =
  "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { createAuthService } = require("../../src/services/authService");

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

test("Password Reset Flow - Backend API Tests", async (context) => {
  const mockUsers = [
    {
      userId: 101,
      email: "alex.support@example.com",
      passwordHash: "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      accountStatus: "Active",
      roleName: "Agent",
    },
    {
      userId: 102,
      email: "google.user@example.com",
      passwordHash: null,
      googleId: "google-12345",
      accountStatus: "Active",
      roleName: "Agent",
    },
  ];

  const mockTokens = [];

  const mockUserModel = {
    findByEmail: async (email) => {
      return mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
    },
    setPassword: async (userId, passwordHash) => {
      const u = mockUsers.find((user) => user.userId === userId);
      if (u) {
        u.passwordHash = passwordHash;
      }
    },
  };

  const mockTokenModel = {
    createPasswordResetToken: async (userId, tokenHash, expiresAt) => {
      mockTokens.forEach((t) => {
        if (t.userId === userId && !t.usedAt) {
          t.usedAt = new Date();
        }
      });
      const id = mockTokens.length + 1;
      mockTokens.push({
        tokenId: id,
        userId,
        tokenHash,
        expiresAt,
        usedAt: null,
      });
      return id;
    },
    findValidToken: async (tokenHash) => {
      const token = mockTokens.find(
        (t) =>
          t.tokenHash === tokenHash &&
          !t.usedAt &&
          new Date(t.expiresAt) > new Date(),
      );
      if (!token) return null;
      const user = mockUsers.find((u) => u.userId === token.userId);
      return {
        ...token,
        email: user ? user.email : "",
        accountStatus: user ? user.accountStatus : "Active",
      };
    },
    markTokenUsed: async (tokenId) => {
      const token = mockTokens.find((t) => t.tokenId === tokenId);
      if (token) {
        token.usedAt = new Date();
      }
    },
  };

  const authService = createAuthService({
    userModel: mockUserModel,
    tokenModel: mockTokenModel,
  });

  const server = await startTestServer(authService);
  context.after(server.close);

  await context.test("POST /api/auth/forgot-password with invalid email returns 422", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "invalid-email" }),
    });
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.success, false);
  });

  await context.test("POST /api/auth/forgot-password with non-existent email returns generic success", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@example.com" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.match(body.message, /If an account matches/i);
    assert.equal(body.resetToken, undefined);
  });

  let generatedToken = "";

  await context.test("POST /api/auth/forgot-password with existing user returns success & token (in test)", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alex.support@example.com" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.resetToken);
    generatedToken = body.resetToken;
  });

  await context.test("GET /api/auth/verify-reset-token with invalid token returns 400", async () => {
    const response = await fetch(
      `${server.baseUrl}/api/auth/verify-reset-token?token=invalid-token-12345`,
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.code, "INVALID_TOKEN");
  });

  await context.test("GET /api/auth/verify-reset-token with valid token returns success", async () => {
    const response = await fetch(
      `${server.baseUrl}/api/auth/verify-reset-token?token=${generatedToken}`,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.email, "alex.support@example.com");
  });

  await context.test("POST /api/auth/reset-password with weak password returns 422", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: generatedToken,
        password: "weak",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.success, false);
  });

  const newPassword = "NewSecretPassword123!";

  await context.test("POST /api/auth/reset-password with valid token and password updates password", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: generatedToken,
        password: newPassword,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
  });

  await context.test("POST /api/auth/reset-password reusing the same token returns 400", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: generatedToken,
        password: "AnotherPassword123!",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.code, "INVALID_TOKEN");
  });

  await context.test("User can successfully sign in with the new password", async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountType: "individual",
        email: "alex.support@example.com",
        password: newPassword,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.user.email, "alex.support@example.com");
  });

  await context.test("Google-only user can reset password to set an initial password", async () => {
    const forgotRes = await fetch(`${server.baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "google.user@example.com" }),
    });
    const forgotBody = await forgotRes.json();

    assert.equal(forgotRes.status, 200);
    const googleResetToken = forgotBody.resetToken;
    assert.ok(googleResetToken);

    const resetRes = await fetch(`${server.baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: googleResetToken,
        password: "GoogleUserPass123!",
      }),
    });
    const resetBody = await resetRes.json();
    assert.equal(resetRes.status, 200);
    assert.equal(resetBody.success, true);

    const loginRes = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountType: "individual",
        email: "google.user@example.com",
        password: "GoogleUserPass123!",
      }),
    });
    const loginBody = await loginRes.json();
    assert.equal(loginRes.status, 200);
    assert.equal(loginBody.data.user.email, "google.user@example.com");
  });
});

