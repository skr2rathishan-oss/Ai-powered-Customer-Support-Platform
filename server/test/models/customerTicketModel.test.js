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

test("customer queries put company_id then customer_id first and in every WHERE", async () => {
  const pool = makePool((sql) => (/COUNT/.test(sql) ? [[{ total: 2 }]] : [[]]));
  const options = { pool };

  await model.findCustomerTicketById(7, 20, 5, options);
  await model.listCustomerTickets(7, 20, { status: "Open" }, options);
  await model.countOpenCustomerTickets(7, 20, options);

  assert.equal(pool.calls.length, 4);
  for (const call of pool.calls) {
    assert.deepEqual(call.params.slice(0, 2), [7, 20], call.sql);
    assert.match(call.sql, /t\.company_id = \? AND t\.customer_id = \?/);
  }
  assert.deepEqual(pool.calls[0].params, [7, 20, 5]);
});

test("list is parameterized, ordered newest first and paginated", async () => {
  const pool = makePool((sql) => (/COUNT/.test(sql) ? [[{ total: 45 }]] : [[{ ticketId: 1 }]]));
  const result = await model.listCustomerTickets(
    7,
    20,
    { status: "Resolved", page: 3, limit: 10 },
    { pool },
  );
  assert.equal(result.total, 45);
  assert.equal(result.page, 3);
  const [count, page] = pool.calls;
  assert.deepEqual(count.params, [7, 20, "Resolved"]);
  assert.deepEqual(page.params, [7, 20, "Resolved", 10, 20]);
  assert.match(page.sql, /ORDER BY t\.created_at DESC, t\.ticket_id DESC/);
  assert.ok(!page.sql.includes("Resolved"));
});

test("list defaults to page 1 and 20 rows without a status filter", async () => {
  const pool = makePool((sql) => (/COUNT/.test(sql) ? [[{ total: 0 }]] : [[]]));
  await model.listCustomerTickets(7, 20, {}, { pool });
  assert.deepEqual(pool.calls[1].params, [7, 20, 20, 0]);
  assert.doesNotMatch(pool.calls[0].sql, /t\.status = \?/);
});

test("countOpenCustomerTickets counts Open and In Progress only", async () => {
  const pool = makePool(() => [[{ total: 4 }]]);
  assert.equal(await model.countOpenCustomerTickets(7, 20, { pool }), 4);
  assert.match(pool.calls[0].sql, /status IN \('Open', 'In Progress'\)/);
});

test("findCustomerTicketById returns null when nothing matches", async () => {
  assert.equal(await model.findCustomerTicketById(7, 20, 1, { pool: makePool() }), null);
});
