const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateCreateFaqPayload,
  validateUpdateFaqPayload,
  validateListQuery,
  parseFaqId,
} = require("../../src/validators/faqValidator");

test("create applies defaults and trims", () => {
  const { value, errors } = validateCreateFaqPayload({
    question: "  How does it work?  ",
    answer: "  Like this  ",
    unknown: "ignored",
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(value, {
    question: "How does it work?",
    answer: "Like this",
    category: null,
    isPublished: false,
    sortOrder: null,
  });
});

test("create rejects non-object bodies", () => {
  for (const body of [null, undefined, "x", [], 5]) {
    assert.equal(validateCreateFaqPayload(body).errors[0].field, "body");
  }
});

test("question length bounds", () => {
  const check = (question) =>
    validateCreateFaqPayload({ question, answer: "a" }).errors.filter((e) => e.field === "question");
  assert.equal(check("1234").length, 1);
  assert.match(check("1234")[0].message, /at least 5/);
  assert.equal(check("12345").length, 0);
  assert.equal(check("q".repeat(300)).length, 0);
  assert.equal(check("q".repeat(301)).length, 1);
  assert.equal(check(42).length, 1);
});

test("answer allows whitespace controls but not others", () => {
  const check = (answer) =>
    validateCreateFaqPayload({ question: "Valid question", answer }).errors.length;
  assert.equal(check("a\nb\tc\r\nd"), 0);
  assert.equal(check("a\u0000b"), 1);
  assert.equal(check("a\u001bb"), 1);
  assert.equal(check("a".repeat(4000)), 0);
  assert.equal(check("a".repeat(4001)), 1);
});

test("category empty string becomes null, non-strings fail", () => {
  const run = (category) => validateCreateFaqPayload({ question: "Valid question", answer: "a", category });
  assert.equal(run("  ").value.category, null);
  assert.equal(run(" Ops ").value.category, "Ops");
  assert.equal(run(5).errors[0].field, "category");
});

test("update is partial and needs at least one field", () => {
  const partial = validateUpdateFaqPayload({ isPublished: true });
  assert.deepEqual(partial, { value: { isPublished: true }, errors: [] });
  assert.equal(validateUpdateFaqPayload({}).errors[0].field, "body");
  assert.equal(validateUpdateFaqPayload({ companyId: 3 }).errors[0].field, "body");
  assert.deepEqual(validateUpdateFaqPayload({ category: null }).value, { category: null });
});

test("list query validation", () => {
  assert.deepEqual(validateListQuery({}), {
    value: { search: undefined, category: undefined, status: undefined },
    errors: [],
  });
  const ok = validateListQuery({ search: " hi ", category: "Billing", status: "draft" });
  assert.deepEqual(ok.value, { search: "hi", category: "Billing", status: "draft" });
  assert.equal(validateListQuery({ status: "bogus" }).errors[0].field, "status");
  assert.equal(validateListQuery({ search: ["a", "b"] }).errors[0].field, "search");
  assert.equal(validateListQuery({ search: "a".repeat(101) }).errors[0].field, "search");
  assert.equal(validateListQuery({ status: "" }).errors.length, 0);
});

test("parseFaqId accepts positive integer strings only", () => {
  assert.equal(parseFaqId("12"), 12);
  for (const bad of ["abc", "0", "1.5", "-1", "", undefined]) {
    assert.equal(parseFaqId(bad), null);
  }
});
