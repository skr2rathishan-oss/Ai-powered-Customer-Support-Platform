const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateCompanyRegistrationPayload,
  validateSignInPayload,
} = require("../../src/validators/authValidator");

const VALID_REGISTRATION = {
  companyName: "Acme Support",
  industry: "SaaS",
  businessEmail: " Contact@Acme.Example ",
  phone: "+1 555 012 3456",
  website: "https://acme.example",
  description: "Customer support software",
  adminFirstName: "Alex",
  adminLastName: "Morgan",
  adminEmail: " Admin@Acme.Example ",
  password: "Correct@123",
};

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

test("accepts and normalizes every company registration field", () => {
  const result = validateCompanyRegistrationPayload(VALID_REGISTRATION);

  assert.deepEqual(result.errors, []);
  assert.equal(result.value.businessEmail, "contact@acme.example");
  assert.equal(result.value.adminEmail, "admin@acme.example");
  assert.equal(result.value.companyName, "Acme Support");
});

test("validates company and administrator emails independently", () => {
  const result = validateCompanyRegistrationPayload({
    ...VALID_REGISTRATION,
    businessEmail: "invalid",
    adminEmail: "also-invalid",
  });

  assert.deepEqual(
    result.errors.map((error) => error.field),
    ["businessEmail", "adminEmail"],
  );
});

test("rejects invalid optional registration fields", () => {
  const result = validateCompanyRegistrationPayload({
    ...VALID_REGISTRATION,
    phone: "abc",
    website: "javascript:alert(1)",
    description: "x".repeat(2001),
  });

  assert.deepEqual(
    result.errors.map((error) => error.field),
    ["phone", "website", "description"],
  );
});

test("rejects confirmPassword and other unexpected backend fields", () => {
  const result = validateCompanyRegistrationPayload({
    ...VALID_REGISTRATION,
    confirmPassword: "Correct@123",
  });

  assert.equal(result.errors[0].field, "body");
  assert.match(result.errors[0].message, /confirmPassword/);
});
