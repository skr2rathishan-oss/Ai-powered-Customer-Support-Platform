const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../../src/models/customerModel");

function makePool(responder = () => [[]]) {
  const calls = [];
  const run = (kind) => async (sql, params) => {
    calls.push({ kind, sql, params });
    return responder(sql, params, kind);
  };
  return { calls, execute: run("execute"), query: run("query") };
}

test("listPublicCompanies only selects Active companies and exposes id and name", async () => {
  const pool = makePool(() => [[{ companyId: 1, companyName: "Acme" }]]);
  const rows = await model.listPublicCompanies({ pool });
  assert.deepEqual(rows, [{ companyId: 1, companyName: "Acme" }]);
  assert.match(pool.calls[0].sql, /status = 'Active'/);
  assert.doesNotMatch(pool.calls[0].sql, /business_email|phone/);
});

test("findActiveCompany is parameterized and filters on status", async () => {
  const pool = makePool(() => [[]]);
  assert.equal(await model.findActiveCompany(4, { pool }), null);
  assert.deepEqual(pool.calls[0].params, [4]);
  assert.match(pool.calls[0].sql, /company_id = \? AND status = 'Active'/);
});

test("findCustomerContext inner-joins the company and filters by user id only", async () => {
  const row = { userId: 9, roleName: "Customer", companyId: 3 };
  const pool = makePool(() => [[row]]);
  assert.equal(await model.findCustomerContext(9, { pool }), row);
  assert.deepEqual(pool.calls[0].params, [9]);
  assert.match(pool.calls[0].sql, /INNER JOIN companies/);
  assert.match(pool.calls[0].sql, /u\.user_id = \?/);
  assert.doesNotMatch(pool.calls[0].sql, /role_name = /);
});

test("createCustomer selects the role by name and parameterizes every value", async () => {
  const pool = makePool(() => [{ affectedRows: 1, insertId: 31 }]);
  const created = await model.createCustomer(
    { companyId: 3, firstName: "A", lastName: "B", email: "a@b.test", passwordHash: "hash" },
    { pool },
  );
  assert.equal(created.userId, 31);
  assert.equal(created.email, "a@b.test");
  const [call] = pool.calls;
  assert.match(call.sql, /role_name = 'Customer'/);
  assert.deepEqual(call.params, [3, "A", "B", "a@b.test", "hash"]);
  assert.ok(!call.sql.includes("a@b.test"));
});

test("createCustomer maps database errors", async () => {
  const customer = { companyId: 3, firstName: "A", lastName: "B", email: "a@b.test", passwordHash: "h" };
  const failing = (code) =>
    makePool(() => {
      throw Object.assign(new Error("db"), { code });
    });

  await assert.rejects(model.createCustomer(customer, { pool: failing("ER_BAD_NULL_ERROR") }), {
    statusCode: 500,
    code: "CUSTOMER_ROLE_MISSING",
  });
  await assert.rejects(model.createCustomer(customer, { pool: failing("ER_DUP_ENTRY") }), {
    statusCode: 409,
    code: "EMAIL_EXISTS",
  });
  await assert.rejects(model.createCustomer(customer, { pool: failing("ER_OTHER") }), {
    code: "ER_OTHER",
  });
  await assert.rejects(
    model.createCustomer(customer, { pool: makePool(() => [{ affectedRows: 0 }]) }),
    { code: "CUSTOMER_ROLE_MISSING" },
  );
});
