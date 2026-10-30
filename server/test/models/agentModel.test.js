const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../../src/models/agentModel");

function makePool(responder = () => [[]]) {
  const calls = [];
  const run = (kind) => async (sql, params) => {
    calls.push({ kind, sql, params });
    return responder(sql, params, kind);
  };
  return { calls, execute: run("execute"), query: run("query") };
}

test("every statement is company scoped and parameterized", async () => {
  const pool = makePool((sql) => (/^\s*INSERT/.test(sql) ? [{ insertId: 9, affectedRows: 1 }] : /^\s*UPDATE/.test(sql) ? [{ affectedRows: 1 }] : [[]]));
  const options = { pool };

  await model.listAgents(7, options);
  await model.findAgent(7, 4, options);
  await model.createAgent(7, { firstName: "A'; DROP", lastName: "B", email: "a@b.co" }, options);
  await model.setAgentStatus(7, 4, "Inactive", options);
  await model.unassignOpenTickets(7, 4, options);

  assert.equal(pool.calls.length, 6);
  for (const call of pool.calls) {
    assert.ok(call.params.includes(7), call.sql);
    assert.match(call.sql, /company_id/);
    assert.ok(!call.sql.includes("DROP"));
    const placeholders = (call.sql.match(/\?/g) || []).length;
    assert.equal(placeholders, call.params.length, call.sql);
  }
});

test("list never selects secrets and computes invitePending in SQL", async () => {
  const pool = makePool();
  await model.listAgents(7, { pool });
  const { sql, params } = pool.calls[0];
  assert.match(sql, /password_hash IS NULL AND u\.google_id IS NULL\) AS invitePending/);
  assert.ok(!/u\.password_hash AS|u\.google_id AS/.test(sql));
  assert.match(sql, /LIMIT 500/);
  assert.deepEqual(params, [7, "Open", "In Progress", 7]);
});

test("rows are mapped to agents with boolean invitePending", async () => {
  const pool = makePool(() => [[
    { agentId: 1, firstName: "Sam", lastName: "Agent", email: "s@a.co", status: "Active", onlineStatus: "Offline", invitePending: "1", openTickets: "2" },
  ]]);
  const [agent] = await model.listAgents(7, { pool });
  assert.equal(agent.name, "Sam Agent");
  assert.equal(agent.invitePending, true);
  assert.equal(agent.openTickets, 2);
});

test("createAgent maps a missing role and rejects a missing insert id", async () => {
  const noRole = makePool(() => {
    throw Object.assign(new Error("null"), { code: "ER_BAD_NULL_ERROR" });
  });
  await assert.rejects(
    model.createAgent(7, { firstName: "A", lastName: "B", email: "a@b.co" }, { pool: noRole }),
    (error) => error.code === "AGENT_ROLE_MISSING" && error.statusCode === 500,
  );

  const zeroRows = makePool(() => [{ affectedRows: 0 }]);
  await assert.rejects(
    model.createAgent(7, { firstName: "A", lastName: "B", email: "a@b.co" }, { pool: zeroRows }),
    (error) => error.code === "AGENT_ROLE_MISSING",
  );

  const noId = makePool(() => [{ affectedRows: 1 }]);
  await assert.rejects(
    model.createAgent(7, { firstName: "A", lastName: "B", email: "a@b.co" }, { pool: noId }),
    /did not return an id/,
  );
});

test("unassignOpenTickets only touches open statuses and returns the count", async () => {
  const pool = makePool(() => [{ affectedRows: 3 }]);
  assert.equal(await model.unassignOpenTickets(7, 4, { pool }), 3);
  assert.deepEqual(pool.calls[0].params, [7, 4, "Open", "In Progress"]);
});
