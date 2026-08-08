const test = require("node:test");
const assert = require("node:assert/strict");
const { createRegistration } = require("../../src/models/companyModel");

const REGISTRATION = {
  companyName: "Acme Support",
  industry: "SaaS",
  businessEmail: "contact@acme.example",
  phone: null,
  website: null,
  description: null,
  adminFirstName: "Alex",
  adminLastName: "Morgan",
  adminEmail: "admin@acme.example",
  passwordHash: "secure-hash",
  companyStatus: "Active",
  adminStatus: "Active",
};

function makeConnection(responses) {
  const calls = [];
  return {
    calls,
    beginTransaction: async () => calls.push("begin"),
    execute: async (sql, values) => {
      calls.push({ sql, values });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    },
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
  };
}

test("creates company, user, and administrator relation in one transaction", async () => {
  const connection = makeConnection([
    [[], []],
    [[], []],
    [[{ role_id: 3 }], []],
    [{ insertId: 27 }, []],
    [{ insertId: 91 }, []],
    [{ affectedRows: 1 }, []],
  ]);

  const result = await createRegistration(REGISTRATION, {
    pool: { getConnection: async () => connection },
  });

  assert.equal(result.companyId, 27);
  assert.equal(result.userId, 91);
  assert.equal(connection.calls[0], "begin");
  assert.equal(connection.calls.at(-2), "commit");
  assert.equal(connection.calls.at(-1), "release");
  assert.equal(
    connection.calls.filter((call) => call === "rollback").length,
    0,
  );
});

test("rolls back the transaction when any registration write fails", async () => {
  const connection = makeConnection([
    [[], []],
    [[], []],
    [[{ role_id: 3 }], []],
    [{ insertId: 27 }, []],
    new Error("user insert failed"),
  ]);

  await assert.rejects(
    createRegistration(REGISTRATION, {
      pool: { getConnection: async () => connection },
    }),
    /user insert failed/,
  );

  assert.ok(connection.calls.includes("rollback"));
  assert.equal(connection.calls.at(-1), "release");
  assert.equal(connection.calls.includes("commit"), false);
});

test("returns a field-specific business email conflict and rolls back", async () => {
  const connection = makeConnection([[[{ company_id: 27 }], []]]);

  await assert.rejects(
    createRegistration(REGISTRATION, {
      pool: { getConnection: async () => connection },
    }),
    (error) =>
      error.statusCode === 409 &&
      error.code === "BUSINESS_EMAIL_EXISTS" &&
      error.errors[0].field === "businessEmail",
  );

  assert.ok(connection.calls.includes("rollback"));
  assert.equal(connection.calls.at(-1), "release");
});
