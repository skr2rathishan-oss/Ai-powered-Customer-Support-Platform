const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../../src/models/ticketModel");

function makePool(responder = () => [[]]) {
  const calls = [];
  const run = (kind) => async (sql, params) => {
    calls.push({ kind, sql, params });
    return responder(sql, params, kind);
  };
  return { calls, execute: run("execute"), query: run("query") };
}

test("every query puts company_id first in the parameters", async () => {
  const pool = makePool((sql) =>
    /COUNT/.test(sql) ? [[{ total: 0 }]] : /INSERT/.test(sql) ? [{ insertId: 3 }] : [[]],
  );
  const options = { pool };

  await model.findTicketById(7, 1, options);
  await model.createTicket(
    7,
    { subject: "s", description: "d", status: "Open", priority: "Low" },
    options,
  );
  await model.listTickets(7, { status: "Open" }, options);
  await model.updateTicket(7, 1, { priority: "High" }, options);
  await model.findAssignableAgent(7, 4, options);
  await model.listAssignableAgents(7, options);

  assert.ok(pool.calls.length >= 8);
  for (const call of pool.calls) {
    if (/^\s*UPDATE/.test(call.sql)) {
      // SET values come first; the scope pair is always the last two params
      assert.deepEqual(call.params.slice(-2), [7, 1], call.sql);
    } else {
      assert.equal(call.params[0], 7, call.sql);
    }
    assert.match(call.sql, /company_id = \?|INSERT INTO tickets/);
  }
});

test("search escapes LIKE wildcards and is parameterized", async () => {
  const pool = makePool((sql) => (/COUNT/.test(sql) ? [[{ total: 0 }]] : [[]]));
  await model.listTickets(7, { search: "50%_a\\b" }, { pool });
  const [count, page] = pool.calls;
  assert.deepEqual(count.params, [7, "%50\\%\\_a\\\\b%", "%50\\%\\_a\\\\b%", "%50\\%\\_a\\\\b%"]);
  assert.ok(!count.sql.includes("50%"));
  assert.deepEqual(page.params.slice(-2), [20, 0]);
});

test("list computes offset and returns the total", async () => {
  const pool = makePool((sql) => (/COUNT/.test(sql) ? [[{ total: 45 }]] : [[{ ticketId: 1 }]]));
  const result = await model.listTickets(7, { page: 3, limit: 10 }, { pool });
  assert.equal(result.total, 45);
  assert.equal(result.page, 3);
  assert.deepEqual(pool.calls[1].params.slice(-2), [10, 20]);
});

test("update only sets allowlisted columns", async () => {
  const pool = makePool();
  await model.updateTicket(
    7,
    5,
    { status: "Resolved", assignedAgentId: null, subject: "x", company_id: 9 },
    { pool },
  );
  const update = pool.calls[0];
  assert.match(update.sql, /SET status = \?, resolved_at = COALESCE\(resolved_at, NOW\(\)\), assigned_agent_id = \?/);
  assert.ok(!/subject|company_id = 9/.test(update.sql.split("WHERE")[0]));
  assert.deepEqual(update.params, ["Resolved", null, 7, 5]);
});

test("reopening clears resolved_at; empty changes skip the UPDATE", async () => {
  const pool = makePool();
  await model.updateTicket(7, 5, { status: "Open" }, { pool });
  assert.match(pool.calls[0].sql, /resolved_at = NULL/);

  const idle = makePool();
  await model.updateTicket(7, 5, {}, { pool: idle });
  assert.equal(idle.calls.length, 1);
  assert.match(idle.calls[0].sql, /^\s*SELECT/);
});
