const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateInviteAgentPayload,
  validateAgentStatusPayload,
} = require("../../src/validators/agentValidator");

const fields = (result) => result.errors.map((error) => error.field);

test("invite: trims names, lowercases email and ignores unknown keys", () => {
  const { value, errors } = validateInviteAgentPayload({
    firstName: "  Ada ",
    lastName: " Lovelace",
    email: " ADA@Example.COM ",
    companyId: 9,
    roleName: "Company Admin",
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(value, {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });
});

test("invite: required fields, limits, control characters and bad email", () => {
  assert.deepEqual(fields(validateInviteAgentPayload({})), ["firstName", "lastName", "email"]);
  assert.deepEqual(
    fields(validateInviteAgentPayload({ firstName: "a".repeat(51), lastName: "b", email: "a@b.co" })),
    ["firstName"],
  );
  assert.deepEqual(
    fields(validateInviteAgentPayload({ firstName: "a\nb", lastName: "b", email: "a@b.co" })),
    ["firstName"],
  );
  assert.deepEqual(
    fields(validateInviteAgentPayload({ firstName: "a", lastName: "b", email: "nope" })),
    ["email"],
  );
  assert.deepEqual(
    fields(validateInviteAgentPayload({ firstName: "a", lastName: "b", email: `${"x".repeat(260)}@b.co` })),
    ["email"],
  );
  assert.deepEqual(
    fields(validateInviteAgentPayload({ firstName: 5, lastName: null, email: {} })),
    ["firstName", "lastName", "email"],
  );
});

test("invite and status: non-object bodies are rejected", () => {
  for (const body of [null, undefined, "x", [], 5]) {
    assert.deepEqual(fields(validateInviteAgentPayload(body)), ["body"]);
    assert.deepEqual(fields(validateAgentStatusPayload(body)), ["body"]);
  }
});

test("status: only exact Active or Inactive pass", () => {
  assert.deepEqual(validateAgentStatusPayload({ status: "Active", x: 1 }), {
    value: { status: "Active" },
    errors: [],
  });
  assert.equal(validateAgentStatusPayload({ status: "Inactive" }).errors.length, 0);
  for (const status of ["active", "Banned", "", null, undefined, 1]) {
    assert.deepEqual(fields(validateAgentStatusPayload({ status })), ["status"]);
  }
});
