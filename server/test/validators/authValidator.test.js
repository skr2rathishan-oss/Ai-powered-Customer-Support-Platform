const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateCompanyRegistrationPayload,
  validateSignInPayload,
  validateResetPasswordPayload,
  buildPasswordPattern,
  passwordPolicyMessage,
  PASSWORD_PATTERN,
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

test("sign-in does not apply the password strength policy", () => {
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

  assert.equal(weakResult.errors.length, 0);
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

test("default password policy matches the static pattern exactly", () => {
  const generated = buildPasswordPattern();
  for (const password of ["Abcdefg1!", "Abcdefg1", "abcdefg1!", "ABCDEFG1!", "Abcdefgh!", "Ab1!", "Ab1!".padEnd(129, "x")]) {
    assert.equal(generated.test(password), PASSWORD_PATTERN.test(password), password);
  }
  assert.equal(
    passwordPolicyMessage(),
    "Password must be 8 to 128 characters and include uppercase, lowercase, number, and special character",
  );
});

test("custom password policies change length and special-character rules only", () => {
  const policy = { minPasswordLength: 6, requireSpecialChar: false };
  assert.deepEqual(validateCompanyRegistrationPayload({ ...VALID_REGISTRATION, password: "Abcde1" }, policy).errors, []);
  assert.equal(
    validateCompanyRegistrationPayload({ ...VALID_REGISTRATION, password: "abcde1" }, policy).errors[0].field,
    "password",
  );
  assert.equal(
    validateCompanyRegistrationPayload({ ...VALID_REGISTRATION, password: "Abcde1" }).errors[0].field,
    "password",
  );

  const strict = { minPasswordLength: 12, requireSpecialChar: true };
  const reset = validateResetPasswordPayload({ token: "t", password: "Abcdefg1!x" }, strict);
  assert.match(reset.errors[0].message, /12 to 128 characters/);
  assert.deepEqual(validateResetPasswordPayload({ token: "t", password: "Abcdefg1!xyz" }, strict).errors, []);
  assert.equal(passwordPolicyMessage(policy).includes("special"), false);
});
