const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateCustomerRegistrationPayload,
  validateCustomerCreateTicketPayload,
  validateCustomerTicketListQuery,
  validateFaqQuery,
  parseCustomerTicketId,
} = require("../../src/validators/customerValidator");

const validRegistration = {
  firstName: " Casey ",
  lastName: "O'Neil-Smith",
  email: "  Casey@Example.COM ",
  password: "Customer@2026!",
  companyId: 7,
};

const fields = (result) => result.errors.map((error) => error.field);

test("registration trims, lowercases and coerces companyId", () => {
  const result = validateCustomerRegistrationPayload(validRegistration);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    firstName: "Casey",
    lastName: "O'Neil-Smith",
    email: "casey@example.com",
    password: "Customer@2026!",
    companyId: 7,
  });
  assert.equal(
    validateCustomerRegistrationPayload({ ...validRegistration, companyId: " 12 " }).value.companyId,
    12,
  );
});

const registrationCases = [
  ["non-object", null, ["body"]],
  ["array", [], ["body"]],
  ["unexpected keys", { ...validRegistration, roleName: "x", companyName: "y" }, ["body"]],
  ["empty names", { ...validRegistration, firstName: " ", lastName: "" }, ["firstName", "lastName"]],
  ["digits in name", { ...validRegistration, firstName: "R2D2" }, ["firstName"]],
  ["name too long", { ...validRegistration, lastName: "a".repeat(61) }, ["lastName"]],
  ["bad email", { ...validRegistration, email: "a@b" }, ["email"]],
  ["email too long", { ...validRegistration, email: `${"a".repeat(250)}@x.com` }, ["email"]],
  ["weak password", { ...validRegistration, password: "password" }, ["password"]],
  ["missing password", { ...validRegistration, password: undefined }, ["password"]],
  ["missing companyId", { ...validRegistration, companyId: undefined }, ["companyId"]],
  ["zero companyId", { ...validRegistration, companyId: 0 }, ["companyId"]],
  ["fractional companyId", { ...validRegistration, companyId: 1.5 }, ["companyId"]],
  ["text companyId", { ...validRegistration, companyId: "abc" }, ["companyId"]],
  ["unsafe companyId", { ...validRegistration, companyId: "99999999999999999999" }, ["companyId"]],
];
for (const [name, payload, expected] of registrationCases) {
  test(`registration rejects ${name}`, () => {
    assert.deepEqual(fields(validateCustomerRegistrationPayload(payload)), expected);
  });
}

test("create ticket trims and ignores every other key", () => {
  const result = validateCustomerCreateTicketPayload({
    subject: "  Hello  ",
    description: "  Body text ",
    priority: "Urgent",
    status: "Closed",
    companyId: 9,
    customerId: 9,
    assignedAgentId: 3,
    requesterName: "x",
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, { subject: "Hello", description: "Body text" });
});

const ticketCases = [
  ["non-object", "x", ["body"]],
  ["missing subject", { description: "d" }, ["subject"]],
  ["short subject", { subject: "ab", description: "d" }, ["subject"]],
  ["long subject", { subject: "a".repeat(201), description: "d" }, ["subject"]],
  ["non-string subject", { subject: 5, description: "d" }, ["subject"]],
  ["missing description", { subject: "Hello" }, ["description"]],
  ["oversize description", { subject: "Hello", description: "a".repeat(5001) }, ["description"]],
  ["both missing", {}, ["subject", "description"]],
];
for (const [name, payload, expected] of ticketCases) {
  test(`create ticket rejects ${name}`, () => {
    assert.deepEqual(fields(validateCustomerCreateTicketPayload(payload)), expected);
  });
}

test("create ticket accepts boundary lengths", () => {
  const result = validateCustomerCreateTicketPayload({
    subject: "abc",
    description: "a".repeat(5000),
  });
  assert.deepEqual(result.errors, []);
});

test("list query defaults and parsing", () => {
  assert.deepEqual(validateCustomerTicketListQuery(undefined).value, {
    status: undefined,
    page: 1,
    limit: 20,
  });
  const result = validateCustomerTicketListQuery({ status: "In Progress", page: "3", limit: "100" });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, { status: "In Progress", page: 3, limit: 100 });
  assert.deepEqual(validateCustomerTicketListQuery({ status: "", page: "" }).errors, []);
});

for (const [name, query, expected] of [
  ["bad status", { status: "open" }, ["status"]],
  ["page zero", { page: "0" }, ["page"]],
  ["page text", { page: "x" }, ["page"]],
  ["limit zero", { limit: "0" }, ["limit"]],
  ["limit too big", { limit: "101" }, ["limit"]],
]) {
  test(`list query rejects ${name}`, () => {
    assert.deepEqual(fields(validateCustomerTicketListQuery(query)), expected);
  });
}

test("faq query trims and bounds", () => {
  assert.deepEqual(validateFaqQuery({ search: " pass ", category: " Billing " }).value, {
    search: "pass",
    category: "Billing",
  });
  assert.deepEqual(validateFaqQuery({ search: "  " }).value.search, undefined);
  assert.deepEqual(validateFaqQuery(undefined).errors, []);
  assert.deepEqual(fields(validateFaqQuery({ search: "a".repeat(101) })), ["search"]);
  assert.deepEqual(fields(validateFaqQuery({ category: "a".repeat(61) })), ["category"]);
  assert.deepEqual(fields(validateFaqQuery({ search: ["a"] })), ["search"]);
});

test("parseCustomerTicketId accepts positive integers only", () => {
  assert.equal(parseCustomerTicketId("12"), 12);
  for (const bad of ["0", "-1", "abc", "1.5", "", undefined]) {
    assert.equal(parseCustomerTicketId(bad), null, String(bad));
  }
});
