const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateReplyPayload,
  validateAgentTicketListQuery,
  validateAgentStatusPayload,
} = require("../../src/validators/replyValidator");

test("reply body boundaries and normalisation", () => {
  assert.equal(validateReplyPayload({ body: "a" }).errors.length, 0);
  assert.equal(validateReplyPayload({ body: "a".repeat(5000) }).errors.length, 0);
  assert.equal(validateReplyPayload({ body: "a".repeat(5001) }).errors.length, 1);
  assert.equal(validateReplyPayload({ body: "  " }).errors.length, 1);
  assert.equal(validateReplyPayload({ body: 5 }).errors.length, 1);
  assert.equal(validateReplyPayload({ body: " a\r\nb " }).value.body, "a\nb");
  assert.equal(validateReplyPayload({ body: "a\tb\nc" }).errors.length, 0);
  assert.equal(validateReplyPayload({ body: "a\u0007b" }).errors.length, 1);
});

test("reply payload rejects non-objects and unknown fields", () => {
  assert.equal(validateReplyPayload(null).errors.length, 1);
  assert.equal(validateReplyPayload([]).errors.length, 1);
  assert.match(validateReplyPayload({ body: "a", authorId: 1 }).errors[0].message, /Unexpected/);
});

test("isInternal must be boolean and is gated by allowInternal", () => {
  assert.equal(validateReplyPayload({ body: "a" }, { allowInternal: true }).value.isInternal, false);
  assert.equal(validateReplyPayload({ body: "a", isInternal: true }, { allowInternal: true }).value.isInternal, true);
  assert.equal(validateReplyPayload({ body: "a", isInternal: "true" }, { allowInternal: true }).errors.length, 1);
  assert.equal(validateReplyPayload({ body: "a", isInternal: 1 }, { allowInternal: true }).errors.length, 1);
  const denied = validateReplyPayload({ body: "a", isInternal: true });
  assert.equal(denied.errors[0].field, "isInternal");
  assert.equal(validateReplyPayload({ body: "a", isInternal: false }).errors.length, 0);
});

test("agent list query defaults, limits and whitelists", () => {
  const defaults = validateAgentTicketListQuery({});
  assert.deepEqual(defaults.value, { status: undefined, search: undefined, sort: "newest", page: 1, limit: 20 });
  assert.equal(defaults.errors.length, 0);
  const ok = validateAgentTicketListQuery({ status: "Resolved", search: " x ", sort: "oldest", page: "2", limit: "100" });
  assert.equal(ok.errors.length, 0);
  assert.equal(ok.value.search, "x");
  for (const query of [{ status: "x" }, { sort: "x" }, { page: "0" }, { limit: "101" }, { search: "a".repeat(101) }]) {
    assert.equal(validateAgentTicketListQuery(query).errors.length, 1, JSON.stringify(query));
  }
});

test("agent status payload", () => {
  for (const status of ["Open", "In Progress", "Resolved"]) {
    assert.equal(validateAgentStatusPayload({ status }).errors.length, 0);
  }
  assert.equal(validateAgentStatusPayload({ status: "Closed" }).errors.length, 1);
  assert.equal(validateAgentStatusPayload({}).errors.length, 1);
  assert.equal(validateAgentStatusPayload({ status: "Open", x: 1 }).errors.length, 1);
  assert.equal(validateAgentStatusPayload("x").errors.length, 1);
});
