const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../../src/models/aiSettingsModel");

function makePool(responder = () => [[]]) {
  const calls = [];
  return {
    calls,
    execute: async (sql, params) => {
      calls.push({ sql, params });
      return responder(sql, params);
    },
  };
}

const settings = {
  enabled: true,
  assistantName: "Bot'; DROP TABLE x;--",
  tone: "friendly",
  greeting: "Hi",
  answerFromFaqsOnly: false,
  confidenceThreshold: 60,
  escalateAfterFailures: 3,
  fallbackMessage: "Wait",
  customInstructions: "",
};

const storedRow = {
  enabled: 1,
  assistantName: "Bot",
  tone: "concise",
  greeting: "Hi",
  answerFromFaqsOnly: 0,
  confidenceThreshold: "65",
  escalateAfterFailures: "4",
  fallbackMessage: "F",
  customInstructions: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("every statement is company scoped and parameterized", async () => {
  const pool = makePool((sql) => (/^\s*INSERT/.test(sql) ? [{ affectedRows: 1 }] : [[storedRow]]));
  await model.findAiSettings(7, { pool });
  await model.upsertAiSettings(7, 2, settings, { pool });

  assert.equal(pool.calls.length, 3);
  for (const { sql, params } of pool.calls) {
    assert.ok(params.includes(7), sql);
    assert.match(sql, /company_id/);
    assert.ok(!sql.includes("DROP"));
    assert.equal((sql.match(/\?/g) || []).length, params.length, sql);
  }
  assert.match(pool.calls[1].sql, /ON DUPLICATE KEY UPDATE/);
  assert.match(pool.calls[0].sql, /company_id = \?/);
});

test("upsert maps booleans to TINYINT and empty instructions to NULL", async () => {
  const pool = makePool((sql) => (/^\s*INSERT/.test(sql) ? [{}] : [[]]));
  await model.upsertAiSettings(7, 2, settings, { pool });
  const { params } = pool.calls[0];
  assert.equal(params[0], 7);
  assert.equal(params[1], 1);
  assert.equal(params[5], 0);
  assert.equal(params[9], null);
  assert.equal(params[10], 2);
});

test("find maps TINYINT to booleans, numbers, and NULL to empty string", async () => {
  const pool = makePool(() => [[storedRow]]);
  const result = await model.findAiSettings(7, { pool });
  assert.deepEqual(result, {
    enabled: true,
    assistantName: "Bot",
    tone: "concise",
    greeting: "Hi",
    answerFromFaqsOnly: false,
    confidenceThreshold: 65,
    escalateAfterFailures: 4,
    fallbackMessage: "F",
    customInstructions: "",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
});

test("find returns null when no row exists", async () => {
  assert.equal(await model.findAiSettings(7, { pool: makePool() }), null);
});
