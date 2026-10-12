const test = require("node:test");
const assert = require("node:assert/strict");

const database = require("../../src/config/database");

let currentPool;
const originalGetPool = database.getMySQLPool;
database.getMySQLPool = () => currentPool;
const userModel = require("../../src/models/userModel");
test.after(() => {
  database.getMySQLPool = originalGetPool;
});

function makePool(responder) {
  const calls = [];
  return {
    calls,
    execute: async (sql, params) => {
      calls.push({ sql, params });
      return responder(sql, params);
    },
  };
}

function findOrCreate(data) {
  return new Promise((resolve, reject) => {
    userModel.findOrCreate(data, (err, user) => (err ? reject(err) : resolve(user)));
  });
}

test("findOrCreate with allowCreate false never inserts and returns false", async () => {
  currentPool = makePool(() => [[]]);
  const user = await findOrCreate({
    googleId: "g1",
    email: "nobody@example.com",
    allowCreate: false,
  });
  assert.equal(user, false);
  assert.ok(currentPool.calls.every((c) => !/INSERT/i.test(c.sql)));
});

test("findOrCreate with allowCreate false still links an existing email account", async () => {
  const existing = { userId: 5, googleId: null, email: "a@example.com", roleName: "Customer" };
  currentPool = makePool((sql) => (/WHERE LOWER/.test(sql) ? [[{ ...existing }]] : [[]]));
  const user = await findOrCreate({ googleId: "g5", email: "a@example.com", allowCreate: false });
  assert.equal(user.userId, 5);
  assert.equal(user.googleId, "g5");
  assert.ok(currentPool.calls.some((c) => /UPDATE users SET google_id/.test(c.sql)));
});

test("findOrCreate default path creates with the resolved role", async () => {
  currentPool = makePool((sql) => {
    if (/FROM roles/.test(sql)) return [[{ role_id: 3, role_name: "Agent" }]];
    if (/INSERT INTO users/.test(sql)) return [{ insertId: 77 }];
    return [[]];
  });
  const user = await findOrCreate({ googleId: "g9", email: "New@Example.com" });
  assert.equal(user.userId, 77);
  assert.equal(user.roleName, "Agent");
  assert.equal(user.email, "new@example.com");
});

test("findOrCreate errors instead of falling back to role 1 when no default role exists", async () => {
  currentPool = makePool((sql) => (/FROM roles/.test(sql) ? [[]] : [[]]));
  await assert.rejects(findOrCreate({ googleId: "g10", email: "x@example.com" }), /default role/);
  assert.ok(currentPool.calls.every((c) => !/INSERT/i.test(c.sql)));
});
