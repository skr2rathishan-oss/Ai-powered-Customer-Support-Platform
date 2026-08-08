const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateSignInPayload,
} = require("../../src/validators/authValidator");

test("accepts and normalizes individual sign-in data", () => {
  const result = validateSignInPayload({
    accountType: " Individual ",
    email: "  Agent@SupportPilot.com ",
    password: "Correct@123",
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    accountType: "individual",
    email: "agent@supportpilot.com",
    password: "Correct@123",
  });
});

test("accepts company as an account type", () => {
  const result = validateSignInPayload({
    accountType: "company",
    email: "support@acme.example",
    password: "Correct@123",
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.value.accountType, "company");
});

test("rejects missing account type and credentials", () => {
  const result = validateSignInPayload({});

  assert.deepEqual(
    result.errors.map((error) => error.field),
    ["accountType", "email", "password"],
  );
});

test("rejects unknown account types", () => {
  const result = validateSignInPayload({
    accountType: "admin",
    email: "agent@example.com",
    password: "Correct@123",
  });

  assert.deepEqual(result.errors, [
    {
      field: "accountType",
      message: "Account type must be individual or company",
    },
  ]);
});

test("rejects malformed email addresses", () => {
  const result = validateSignInPayload({
    accountType: "individual",
    email: "not-an-email",
    password: "Correct@123",
  });

  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "email");
});

test("rejects passwords that do not meet the sign-in contract", () => {
  const weakResult = validateSignInPayload({
    accountType: "individual",
    email: "agent@example.com",
    password: "short",
  });
  const longResult = validateSignInPayload({
    accountType: "individual",
    email: "agent@example.com",
    password: `A1@${"x".repeat(126)}`,
  });

  assert.equal(weakResult.errors[0].field, "password");
  assert.equal(longResult.errors[0].field, "password");
});

test("rejects arrays and other non-object bodies", () => {
  const result = validateSignInPayload(["agent@example.com", "password"]);

  assert.deepEqual(result.errors, [
    { field: "body", message: "Request body must be a JSON object" },
  ]);
});
