const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../../src/models/ticketReplyModel");
const ticketModel = require("../../src/models/ticketModel");

function makePool(responder = () => [[]]) {
  const calls = [];
  const run = (kind) => async (sql, params) => {
    calls.push({ kind, sql, params });
    return responder(sql, params, kind);
  };
  return { calls, execute: run("execute"), query: run("query") };
}

test("listReplies scopes by company and filters internal notes in SQL", async () => {
  const pool = makePool(() => [[{ replyId: 1, isInternal: 0 }]]);
  await model.listReplies(7, 5, { includeInternal: false }, { pool });
  await model.listReplies(7, 5, { includeInternal: true }, { pool });
  const [publicCall, staffCall] = pool.calls;
  assert.match(publicCall.sql, /company_id = \? AND ticket_id = \?/);
  assert.match(publicCall.sql, /is_internal = 0/);
  assert.doesNotMatch(staffCall.sql, /is_internal = 0/);
  assert.deepEqual(publicCall.params, [7, 5]);
  assert.match(publicCall.sql, /ORDER BY created_at ASC, reply_id ASC\s+LIMIT 500/);
  const rows = await model.listReplies(7, 5, {}, { pool });
  assert.equal(rows[0].isInternal, false);
});

test("listReplies defaults to public replies only", async () => {
  const pool = makePool();
  await model.listReplies(7, 5, undefined, { pool });
  assert.match(pool.calls[0].sql, /is_internal = 0/);
});

test("createReply is a conditional insert and never interpolates text", async () => {
  const pool = makePool((sql) =>
    /INSERT/.test(sql) ? [{ affectedRows: 1, insertId: 9 }] : [[{ replyId: 9, isInternal: 1 }]],
  );
  const created = await model.createReply(
    7,
    5,
    { authorId: 4, authorRole: "Agent", authorName: "Sam", isInternal: true, body: "secret'; DROP", requireAssignedAgentId: 4 },
    { pool },
  );
  assert.equal(created.isInternal, true);
  const insert = pool.calls[0];
  assert.match(insert.sql, /status <> 'Closed'/);
  assert.match(insert.sql, /assigned_agent_id = \?/);
  assert.ok(!insert.sql.includes("DROP"));
  assert.deepEqual(insert.params, [7, 5, 4, "Agent", "Sam", 1, "secret'; DROP", 7, 5, 4]);
  assert.match(pool.calls[1].sql, /company_id = \? AND reply_id = \?/);
});

test("createReply without agent requirement omits the assignment check and returns null on refusal", async () => {
  const pool = makePool(() => [{ affectedRows: 0 }]);
  const result = await model.createReply(7, 5, { authorRole: "Customer", body: "x" }, { pool });
  assert.equal(result, null);
  assert.doesNotMatch(pool.calls[0].sql, /assigned_agent_id/);
  assert.equal(pool.calls.length, 1);
});

test("countReplies and lastReplyByTickets are company-scoped with placeholders", async () => {
  const pool = makePool((sql) => (/COUNT\(\*\) AS total/.test(sql) && !/GROUP/.test(sql) ? [[{ total: 3 }]] : [[{ ticketId: 1, replyCount: "2" }]]));
  assert.equal(await model.countReplies(7, 5, { pool }), 3);
  assert.deepEqual(pool.calls[0].params, [7, 5]);
  const rows = await model.lastReplyByTickets(7, [1, 2, 3], { pool });
  assert.equal(rows[0].replyCount, 2);
  const call = pool.calls[1];
  assert.match(call.sql, /IN \(\?, \?, \?\)/);
  assert.match(call.sql, /is_internal = 0/);
  assert.deepEqual(call.params, [7, 1, 2, 3, 7]);
  assert.deepEqual(await model.lastReplyByTickets(7, [], { pool }), []);
  assert.equal(pool.calls.length, 2);
});

test("agent ticket queries put company then agent first in every WHERE", async () => {
  const pool = makePool((sql) =>
    /COUNT\(\*\) AS total FROM tickets/.test(sql) && !/GROUP/.test(sql)
      ? [[{ total: 1 }]]
      : /GROUP BY/.test(sql)
        ? [[{ status: "Open", total: 2 }, { status: "Resolved", total: 1 }]]
        : /UPDATE/.test(sql)
          ? [{ affectedRows: 1 }]
          : [[{ ticketId: 1 }]],
  );
  const options = { pool };
  await ticketModel.findAgentTicketById(7, 4, 5, options);
  await ticketModel.listAgentTickets(7, 4, { status: "Open", search: "50%_", sort: "priority" }, options);
  const summary = await ticketModel.countAgentTicketsByStatus(7, 4, options);
  await ticketModel.updateAgentTicketStatus(7, 4, 5, "Resolved", options);

  assert.deepEqual(summary, { open: 2, inProgress: 0, resolved: 1, closed: 0, total: 3 });
  for (const call of pool.calls) {
    assert.match(call.sql, /company_id = \? AND (t\.)?assigned_agent_id = \?/, call.sql);
  }
  const list = pool.calls.find((c) => c.kind === "query");
  assert.match(list.sql, /FIELD\(t\.priority/);
  assert.ok(list.params.includes("%50\\%\\_%"));
  assert.ok(!list.sql.includes("50"));
  const update = pool.calls.find((c) => /UPDATE/.test(c.sql));
  assert.match(update.sql, /status <> 'Closed'/);
  assert.match(update.sql, /COALESCE\(resolved_at, NOW\(\)\)/);
  assert.deepEqual(update.params, ["Resolved", 7, 4, 5]);
});

test("updateAgentTicketStatus returns null when nothing matched and clears resolved_at on reopen", async () => {
  const pool = makePool(() => [{ affectedRows: 0 }]);
  assert.equal(await ticketModel.updateAgentTicketStatus(7, 4, 5, "Open", { pool }), null);
  assert.match(pool.calls[0].sql, /resolved_at = NULL/);
});

test("unknown sort falls back to newest and is never interpolated", async () => {
  const pool = makePool((sql) => (/COUNT/.test(sql) ? [[{ total: 0 }]] : [[]]));
  await ticketModel.listAgentTickets(7, 4, { sort: "1; DROP TABLE tickets" }, { pool });
  const list = pool.calls[1];
  assert.match(list.sql, /ORDER BY t\.created_at DESC/);
  assert.ok(!list.sql.includes("DROP"));
});
