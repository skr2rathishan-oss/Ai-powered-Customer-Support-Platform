process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canRetryStatement,
  isTransientDbError,
  withDbRetry,
} = require("../../src/utils/dbErrors");
const { createApp } = require("../../src/app");

function dbError(code, extra = {}) {
  return Object.assign(new Error(code), { code, ...extra });
}

test("connect timeouts are transient and always safe to retry", () => {
  const error = dbError("ETIMEDOUT", { syscall: "connect", fatal: true });
  assert.equal(isTransientDbError(error), true);
  assert.equal(canRetryStatement(error, "SELECT 1"), true);
  assert.equal(canRetryStatement(error, "INSERT INTO faqs VALUES (1)"), true);
});

test("mid-query connection loss is retried for reads but never for writes", () => {
  const error = dbError("PROTOCOL_CONNECTION_LOST");
  assert.equal(canRetryStatement(error, "  select * from users"), true);
  assert.equal(canRetryStatement(error, { sql: "SHOW COLUMNS FROM users" }), true);
  assert.equal(canRetryStatement(error, "UPDATE tickets SET status = 'Open'"), false);
  assert.equal(canRetryStatement(error, "DELETE FROM companies WHERE company_id = 1"), false);
});

test("SQL errors are not transient", () => {
  const duplicate = dbError("ER_DUP_ENTRY");
  assert.equal(isTransientDbError(duplicate), false);
  assert.equal(canRetryStatement(duplicate, "SELECT 1"), false);
  assert.equal(isTransientDbError(new Error("plain")), false);
  assert.equal(isTransientDbError(undefined), false);
});

test("withDbRetry retries a transient failure once and then succeeds", async () => {
  let calls = 0;
  const retries = [];
  const result = await withDbRetry(
    async () => {
      calls += 1;
      if (calls === 1) throw dbError("ETIMEDOUT", { syscall: "connect" });
      return "ok";
    },
    { shouldRetry: isTransientDbError, delayMs: 0, onRetry: (_e, n) => retries.push(n) },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 2);
  assert.deepEqual(retries, [1]);
});

test("withDbRetry gives up after the retry budget and on non-retryable errors", async () => {
  let calls = 0;
  await assert.rejects(
    withDbRetry(
      async () => {
        calls += 1;
        throw dbError("ETIMEDOUT", { syscall: "connect" });
      },
      { shouldRetry: isTransientDbError, delayMs: 0 },
    ),
    { code: "ETIMEDOUT" },
  );
  assert.equal(calls, 2);

  calls = 0;
  await assert.rejects(
    withDbRetry(
      async () => {
        calls += 1;
        throw dbError("ER_DUP_ENTRY");
      },
      { shouldRetry: isTransientDbError, delayMs: 0 },
    ),
    { code: "ER_DUP_ENTRY" },
  );
  assert.equal(calls, 1);
});

test("an unreachable database answers 503 DATABASE_UNAVAILABLE instead of 500", async (context) => {
  const userModel = {
    findByEmail: async () => {
      throw dbError("ETIMEDOUT", { syscall: "connect", fatal: true });
    },
  };
  const app = createApp({ userModel });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin@supportpilot.com",
      password: "Admin@SupportPilot2026!",
      accountType: "individual",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.code, "DATABASE_UNAVAILABLE");
  assert.match(body.message, /temporarily unavailable/);
});
