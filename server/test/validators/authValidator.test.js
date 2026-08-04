const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateSignInPayload,
} = require("../../src/validators/authValidator");

test("accepts valid sign-in data and normalizes the email", () => {
  const result = validateSignInPayload({
    email: "  Agent@SupportPilot.com ",
    password: "secure-password",
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    email: "agent@supportpilot.com",
    password: "secure-password",
  });
});

test("rejects missing credentials", () => {
  const result = validateSignInPayload({});

  assert.deepEqual(result.errors, [
    { field: "email", message: "Email is required" },
    { field: "password", message: "Password is required" },
  ]);
});

test("rejects malformed email addresses", () => {
  const result = validateSignInPayload({
    email: "not-an-email",
    password: "secure-password",
  });

  assert.deepEqual(result.errors, [
    { field: "email", message: "Enter a valid email address" },
  ]);
});

test("allows legacy password lengths but rejects oversized input", () => {
  const shortResult = validateSignInPayload({
    email: "agent@example.com",
    password: "short",
  });
  const longResult = validateSignInPayload({
    email: "agent@example.com",
    password: "x".repeat(129),
  });

  assert.deepEqual(shortResult.errors, []);
  assert.equal(longResult.errors[0].field, "password");
});

test("rejects arrays and other non-object bodies", () => {
  const result = validateSignInPayload(["agent@example.com", "password"]);

  assert.deepEqual(result.errors, [
    { field: "body", message: "Request body must be a JSON object" },
  ]);
});
