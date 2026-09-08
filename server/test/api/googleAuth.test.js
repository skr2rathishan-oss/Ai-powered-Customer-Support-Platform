process.env.NODE_ENV = "test";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET =
  "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";
process.env.GOOGLE_CLIENT_ID = "mock-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "mock-google-client-secret";
process.env.GOOGLE_CALLBACK_URL = "http://localhost:5000/api/auth/google/callback";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { createAuthService } = require("../../src/services/authService");
const { createAccessToken } = require("../../src/utils/token");

function startTestServer(dependencies = {}) {
  const app = createApp(dependencies);
  const server = app.listen(0, "127.0.0.1");

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

function parseCookies(response) {
  const setCookieHeaders =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);

  return setCookieHeaders.map((cookieString) => {
    const [nameValue, ...attributes] = cookieString.split(";").map((part) => part.trim());
    const [name, ...restValue] = nameValue.split("=");
    const value = restValue.join("=");

    const attributeMap = {};
    for (const attr of attributes) {
      const [k, v] = attr.split("=");
      attributeMap[k.toLowerCase()] = v || true;
    }

    return {
      name,
      value,
      attributes: attributeMap,
      raw: cookieString,
    };
  });
}

test("Google OAuth 2.0 End-to-End Authentication & Account Linking Tests", async (t) => {
  let nextUserId = 200;
  const mockDatabaseUsers = [
    {
      userId: 101,
      googleId: null,
      email: "sarah.agent@company.com",
      firstName: "Sarah",
      lastName: "Jenkins",
      passwordHash: "$2b$10$hashed_password_for_sarah",
      onlineStatus: "Offline",
      accountStatus: "Active",
      roleName: "Agent",
    },
  ];

  const mockUserModel = {
    async findByEmail(email) {
      return (
        mockDatabaseUsers.find(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        ) || null
      );
    },
    async findByGoogleId(googleId) {
      return (
        mockDatabaseUsers.find((u) => u.googleId === String(googleId)) || null
      );
    },
    async linkGoogleAccount(userId, googleId) {
      const user = mockDatabaseUsers.find((u) => u.userId === userId);
      if (user) user.googleId = String(googleId);
    },
    async setPassword(userId, passwordHash) {
      const user = mockDatabaseUsers.find((u) => u.userId === userId);
      if (user) user.passwordHash = passwordHash;
    },
    async findOrCreate(data, callback) {
      const googleId = data.googleId ? String(data.googleId) : null;
      let matchedUser = googleId
        ? mockDatabaseUsers.find((u) => u.googleId === googleId)
        : null;

      if (!matchedUser && data.email) {
        matchedUser = mockDatabaseUsers.find(
          (u) => u.email.toLowerCase() === data.email.toLowerCase(),
        );
        if (matchedUser && googleId && !matchedUser.googleId) {
          matchedUser.googleId = googleId;
        }
      }

      if (!matchedUser) {
        matchedUser = {
          userId: ++nextUserId,
          googleId,
          email: data.email,
          firstName: data.firstName || "Google",
          lastName: data.lastName || "User",
          passwordHash: null,
          onlineStatus: "Offline",
          accountStatus: "Active",
          roleName: "Agent",
        };
        mockDatabaseUsers.push(matchedUser);
      }

      if (callback) return callback(null, matchedUser);
      return matchedUser;
    },
  };

  const authService = createAuthService({
    userModel: mockUserModel,
  });

  await t.test(
    "GET /api/auth/google initiates OAuth redirection to Google without 404",
    async () => {
      const server = await startTestServer({
        authService,
        userModel: mockUserModel,
      });

      try {
        const response = await fetch(`${server.baseUrl}/api/auth/google`, {
          redirect: "manual",
        });

        assert.equal(response.status, 302);
        const location = response.headers.get("location");
        assert.ok(location);
        assert.match(location, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
        assert.match(location, /client_id=mock-google-client-id/);
      } finally {
        await server.close();
      }
    },
  );

  await t.test(
    "GET /auth/google (alias without /api) initiates OAuth redirection without 404",
    async () => {
      const server = await startTestServer({
        authService,
        userModel: mockUserModel,
      });

      try {
        const response = await fetch(`${server.baseUrl}/auth/google`, {
          redirect: "manual",
        });

        assert.equal(response.status, 302);
        const location = response.headers.get("location");
        assert.ok(location);
        assert.match(location, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
      } finally {
        await server.close();
      }
    },
  );

  await t.test(
    "Existing email/password user signing in with Google automatically links google_id",
    async () => {
      const existingUser = mockDatabaseUsers.find(
        (u) => u.email === "sarah.agent@company.com",
      );
      assert.equal(existingUser.googleId, null, "Initially not linked");

      const linkedUser = await mockUserModel.findOrCreate({
        googleId: "google-uid-sarah-999",
        email: "sarah.agent@company.com",
        firstName: "Sarah",
        lastName: "Jenkins",
      });

      assert.equal(linkedUser.userId, 101, "Preserves existing userId");
      assert.equal(
        linkedUser.googleId,
        "google-uid-sarah-999",
        "Links google_id",
      );
      assert.equal(
        linkedUser.roleName,
        "Agent",
        "Preserves existing role and permissions",
      );
    },
  );

  await t.test(
    "GET /api/auth/google/callback with linked user sets cookie and authenticates",
    async () => {
      const mockPassport = {
        initialize: () => (req, res, next) => next(),
        authenticate: (strategy, options, callback) => {
          return (req, res, next) => {
            if (typeof callback === "function") {
              const mockGoogleUser = {
                userId: 101,
                googleId: "google-uid-sarah-999",
                email: "sarah.agent@company.com",
                firstName: "Sarah",
                lastName: "Jenkins",
                roleName: "Agent",
                onlineStatus: "Offline",
              };
              return callback(null, mockGoogleUser);
            }
            next();
          };
        },
      };

      const server = await startTestServer({
        authService,
        passport: mockPassport,
      });

      try {
        const callbackResponse = await fetch(
          `${server.baseUrl}/api/auth/google/callback?code=mock_oauth_code`,
          {
            redirect: "manual",
          },
        );

        assert.equal(callbackResponse.status, 302);
        assert.equal(
          callbackResponse.headers.get("location"),
          "http://localhost:5173/login?authenticated=true",
        );

        const cookies = parseCookies(callbackResponse);
        const authCookie = cookies.find((c) => c.name === "supportpilot_access");
        assert.ok(authCookie);

        const meResponse = await fetch(`${server.baseUrl}/api/auth/me`, {
          headers: {
            Cookie: `supportpilot_access=${authCookie.value}`,
          },
        });

        assert.equal(meResponse.status, 200);
        const meBody = await meResponse.json();
        assert.equal(meBody.success, true);
        assert.equal(meBody.data.user.email, "sarah.agent@company.com");
        assert.equal(meBody.data.user.googleId, "google-uid-sarah-999");
      } finally {
        await server.close();
      }
    },
  );

  await t.test(
    "New Google-only user without password safely rejects email/password login attempts with 401",
    async () => {
      // Create new Google user
      const newGoogleUser = await mockUserModel.findOrCreate({
        googleId: "google-uid-alex-888",
        email: "alex.google@example.com",
        firstName: "Alex",
        lastName: "Smith",
      });

      assert.equal(newGoogleUser.passwordHash, null, "No password stored");

      const server = await startTestServer({
        authService,
        userModel: mockUserModel,
      });

      try {
        const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountType: "individual",
            email: "alex.google@example.com",
            password: "AnyPassword123!",
          }),
        });

        assert.equal(
          response.status,
          401,
          "Safely rejects login without crashing or exposing null hash",
        );
        const body = await response.json();
        assert.equal(body.success, false);
      } finally {
        await server.close();
      }
    },
  );

  await t.test(
    "Google-only user can set a password and subsequently use both login methods",
    async () => {
      const alexUser = await mockUserModel.findByEmail("alex.google@example.com");
      assert.ok(alexUser);

      // Set password
      await authService.setPassword(alexUser.userId, "SecureNewPassword123!");

      // Verify sign in with password now succeeds
      const server = await startTestServer({
        authService,
        userModel: mockUserModel,
      });

      try {
        const response = await fetch(`${server.baseUrl}/api/auth/sign-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountType: "individual",
            email: "alex.google@example.com",
            password: "SecureNewPassword123!",
          }),
        });

        assert.equal(response.status, 200, "Password sign-in now succeeds");
        const body = await response.json();
        assert.equal(body.success, true);
        assert.equal(body.data.user.email, "alex.google@example.com");
      } finally {
        await server.close();
      }
    },
  );
});
