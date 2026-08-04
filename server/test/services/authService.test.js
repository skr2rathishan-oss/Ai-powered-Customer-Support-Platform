const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { createAuthService } = require("../../src/services/authService");

async function makeUser(overrides = {}) {
  return {
    userId: 12,
    email: "agent@supportpilot.com",
    passwordHash: await bcrypt.hash("correct-password", 4),
    onlineStatus: "Offline",
    accountStatus: "Active",
    roleName: "Agent",
    ...overrides,
  };
}

test("verifies bcrypt and returns only safe user data", async () => {
  const databaseUser = await makeUser();
  const service = createAuthService({
    userModel: { findByEmail: async () => databaseUser },
    createAccessToken: () => "signed.jwt.token",
  });

  const result = await service.signIn({
    email: databaseUser.email,
    password: "correct-password",
  });

  assert.equal(result.accessToken, "signed.jwt.token");
  assert.deepEqual(result.user, {
    userId: 12,
    email: "agent@supportpilot.com",
    onlineStatus: "Offline",
    roleName: "Agent",
  });
  assert.equal(result.user.passwordHash, undefined);
});

test("rejects an incorrect password with a generic error", async () => {
  const databaseUser = await makeUser();
  const service = createAuthService({
    userModel: { findByEmail: async () => databaseUser },
  });

  await assert.rejects(
    service.signIn({
      email: databaseUser.email,
      password: "incorrect-password",
    }),
    (error) =>
      error.statusCode === 401 &&
      error.code === "INVALID_CREDENTIALS" &&
      error.message === "Invalid email or password",
  );
});

test("rejects an unknown email with the same generic error", async () => {
  const service = createAuthService({
    userModel: { findByEmail: async () => null },
  });

  await assert.rejects(
    service.signIn({
      email: "missing@supportpilot.com",
      password: "incorrect-password",
    }),
    (error) =>
      error.statusCode === 401 &&
      error.code === "INVALID_CREDENTIALS" &&
      error.message === "Invalid email or password",
  );
});

test("rejects inactive and suspended accounts", async () => {
  const databaseUser = await makeUser({ accountStatus: "Suspended" });
  const service = createAuthService({
    userModel: { findByEmail: async () => databaseUser },
  });

  await assert.rejects(
    service.signIn({
      email: databaseUser.email,
      password: "correct-password",
    }),
    (error) =>
      error.statusCode === 403 && error.code === "ACCOUNT_INACTIVE",
  );
});

