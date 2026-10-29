const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../../src/models/faqModel");

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

const responder = (sql) => {
  if (/^\s*INSERT/.test(sql)) return [{ insertId: 9, affectedRows: 1 }];
  if (/^\s*(UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
  return [[]];
};

test("every statement is company scoped and parameterized", async () => {
  const pool = makePool(responder);
  const options = { pool };

  await model.listFaqs(7, { search: "x'; DROP", category: "A", status: "draft" }, options);
  await model.listFaqMeta(7, options);
  await model.countFaqs(7, options);
  await model.findFaq(7, 4, options);
  await model.createFaq(7, 2, { question: "q'; DROP", answer: "a", category: null, isPublished: true, sortOrder: null }, options);
  await model.updateFaq(7, 4, { question: "new", isPublished: false }, options);
  await model.deleteFaq(7, 4, options);

  assert.ok(pool.calls.length >= 8);
  for (const { sql, params } of pool.calls) {
    assert.ok(params.includes(7), sql);
    assert.match(sql, /company_id\s*=\s*\?/);
    assert.ok(!sql.includes("DROP"));
    assert.equal((sql.match(/\?/g) || []).length, params.length, sql);
  }
});

test("search escapes LIKE wildcards and uses ESCAPE", async () => {
  const pool = makePool();
  await model.listFaqs(7, { search: "100%_\\" }, { pool });
  const { sql, params } = pool.calls[0];
  assert.match(sql, /ESCAPE/);
  assert.deepEqual(params.slice(1), ["%100\\%\\_\\\\%", "%100\\%\\_\\\\%", "%100\\%\\_\\\\%"]);
  assert.match(sql, /ORDER BY sort_order ASC, faq_id ASC/);
  assert.match(sql, /LIMIT 500/);
});

test("update only writes allowlisted columns", async () => {
  const pool = makePool(responder);
  await model.updateFaq(
    7,
    4,
    { isPublished: true, company_id: 99, "answer = 'x', question": "evil", answer: "ok" },
    { pool },
  );
  const update = pool.calls.find((c) => /^\s*UPDATE/.test(c.sql));
  assert.match(update.sql, /SET answer = \?, is_published = \? WHERE company_id = \? AND faq_id = \?/);
  assert.deepEqual(update.params, ["ok", 1, 7, 4]);
});

test("rows map to booleans and omit tenant fields", async () => {
  const pool = makePool(() => [[
    { faqId: 1, question: "q", answer: "a", category: null, isPublished: 1, sortOrder: "10", createdAt: "c", updatedAt: "u" },
  ]]);
  const [faq] = await model.listFaqs(7, {}, { pool });
  assert.equal(faq.isPublished, true);
  assert.equal(faq.sortOrder, 10);
  assert.ok(!("companyId" in faq) && !("createdBy" in faq));
});

test("deleteFaq reports whether a row was removed", async () => {
  const none = makePool(() => [{ affectedRows: 0 }]);
  assert.equal(await model.deleteFaq(7, 1, { pool: none }), false);
});
