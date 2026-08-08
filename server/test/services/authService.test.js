const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { createAuthService } = require("../../src/services/authService");

const VALID_PASSWORD = "Correct@123";

async function makeUser(overrides = {}) {
  return {
    userId: 12,
    email: "agent@supportpilot.com",
    passwordHash: await bcrypt.hash(VALID_PASSWORD, 4),
    onlineStatus: "Offline",
    accountStatus: "Active",
    roleName: "Agent",
    ...overrides,
  };
}

async function makeCompany(overrides = {}) {
  return {
    userId: 41,
    companyId: 7,
    companyName: "Acme Support",
    email: "support@acme.example",
    passwordHash: await bcrypt.hash(VALID_PASSWORD, 4),
    onlineStatus: "Offline",
    accountStatus: "Active",
    companyStatus: "Active",
    roleName: "Company Admin",
    ...overrides,
  };
}

test("individual sign-in queries only the individual model", async () => {
  const databaseUser = await makeUser();
  let companyLookups = 0;
  const service = createAuthService({
    userModel: { findByEmail: async () => databaseUser },
    companyModel: {
      findByBusinessEmail: async () => {
        companyLookups += 1;
        return null;
      },
    },
    createAccessToken: () => "signed.jwt.token",
  });

  const result = await service.signIn({
    accountType: "individual",
    email: databaseUser.email,
    password: VALID_PASSWORD,
  });

  assert.equal(companyLookups, 0);
  assert.equal(result.accessToken, "signed.jwt.token");
  assert.deepEqual(result.user, {
    accountType: "individual",
    userId: 12,
    email: "agent@supportpilot.com",
    onlineStatus: "Offline",
    roleName: "Agent",
  });
  assert.equal(result.user.passwordHash, undefined);
});

test("company sign-in queries only the company model", async () => {
  const databaseCompany = await makeCompany();
  let userLookups = 0;
  const service = createAuthService({
    userModel: {
      findByEmail: async () => {
        userLookups += 1;
        return null;
      },
    },
    companyModel: {
      findByBusinessEmail: async () => databaseCompany,
    },
    createAccessToken: () => "company.jwt.token",
  });

  const result = await service.signIn({
    accountType: "company",
    email: databaseCompany.email,
    password: VALID_PASSWORD,
  });

  assert.equal(userLookups, 0);
  assert.deepEqual(result.user, {
    accountType: "company",
    userId: 41,
    companyId: 7,
    companyName: "Acme Support",
    email: "support@acme.example",
    onlineStatus: "Offline",
    roleName: "Company Admin",
  });
});

test("does not fall back to individual accounts during company sign-in", async () => {
  const individual = await makeUser();
  let userLookups = 0;
  const service = createAuthService({
    userModel: {
      findByEmail: async () => {
        userLookups += 1;
        return individual;
      },
    },
    companyModel: { findByBusinessEmail: async () => null },
  });

  await assert.rejects(
    service.signIn({
      accountType: "company",
      email: individual.email,
      password: VALID_PASSWORD,
    }),
    (error) =>
      error.statusCode === 401 && error.code === "INVALID_CREDENTIALS",
  );
  assert.equal(userLookups, 0);
});

test("does not fall back to companies during individual sign-in", async () => {
  const company = await makeCompany();
  let companyLookups = 0;
  const service = createAuthService({
    userModel: { findByEmail: async () => null },
    companyModel: {
      findByBusinessEmail: async () => {
        companyLookups += 1;
        return company;
      },
    },
  });

  await assert.rejects(
    service.signIn({
      accountType: "individual",
      email: company.email,
      password: VALID_PASSWORD,
    }),
    (error) =>
      error.statusCode === 401 && error.code === "INVALID_CREDENTIALS",
  );
  assert.equal(companyLookups, 0);
});

test("rejects an incorrect password with a generic error", async () => {
  const databaseUser = await makeUser();
  const service = createAuthService({
    userModel: { findByEmail: async () => databaseUser },
  });

  await assert.rejects(
    service.signIn({
      accountType: "individual",
      email: databaseUser.email,
      password: "Incorrect@123",
    }),
    (error) =>
      error.statusCode === 401 &&
      error.code === "INVALID_CREDENTIALS" &&
      error.message === "Invalid email or password",
  );
});

test("rejects inactive individual and company accounts", async () => {
  const suspendedUser = await makeUser({ accountStatus: "Suspended" });
  const suspendedCompany = await makeCompany({ companyStatus: "Suspended" });
  const individualService = createAuthService({
    userModel: { findByEmail: async () => suspendedUser },
  });
  const companyService = createAuthService({
    companyModel: { findByBusinessEmail: async () => suspendedCompany },
  });

  await assert.rejects(
    individualService.signIn({
      accountType: "individual",
      email: suspendedUser.email,
      password: VALID_PASSWORD,
    }),
    (error) =>
      error.statusCode === 403 && error.code === "ACCOUNT_INACTIVE",
  );

  await assert.rejects(
    companyService.signIn({
      accountType: "company",
      email: suspendedCompany.email,
      password: VALID_PASSWORD,
    }),
    (error) =>
      error.statusCode === 403 && error.code === "COMPANY_INACTIVE",
  );
});

test("rejects invalid account types before any lookup", async () => {
  let lookups = 0;
  const service = createAuthService({
    userModel: { findByEmail: async () => (lookups += 1) },
    companyModel: { findByBusinessEmail: async () => (lookups += 1) },
  });

  await assert.rejects(
    service.signIn({
      accountType: "admin",
      email: "admin@example.com",
      password: VALID_PASSWORD,
    }),
    (error) =>
      error.statusCode === 422 && error.code === "INVALID_ACCOUNT_TYPE",
  );
  assert.equal(lookups, 0);
});

test("automatically registers an active company administrator", async () => {
  let persisted;
  const service = createAuthService({
    companyModel: {
      createRegistration: async (registration) => {
        persisted = registration;
        return {
          userId: 91,
          companyId: 27,
          companyName: registration.companyName,
          businessEmail: registration.businessEmail,
          adminEmail: registration.adminEmail,
          onlineStatus: "Offline",
          roleName: "Company Admin",
        };
      },
    },
    hashPassword: async () => "secure-password-hash",
    createAccessToken: () => "registration.jwt.token",
  });

  const result = await service.registerCompany({
    companyName: "Acme Support",
    industry: "SaaS",
    businessEmail: "contact@acme.example",
    phone: null,
    website: null,
    description: null,
    adminFirstName: "Alex",
    adminLastName: "Morgan",
    adminEmail: "admin@acme.example",
    password: VALID_PASSWORD,
  });

  assert.equal(persisted.password, undefined);
  assert.equal(persisted.passwordHash, "secure-password-hash");
  assert.equal(persisted.companyStatus, "Active");
  assert.equal(persisted.adminStatus, "Active");
  assert.equal(result.accessToken, "registration.jwt.token");
  assert.equal(result.user.roleName, "Company Admin");
  assert.equal(result.user.email, "contact@acme.example");
  assert.equal(result.user.adminEmail, "admin@acme.example");
});
