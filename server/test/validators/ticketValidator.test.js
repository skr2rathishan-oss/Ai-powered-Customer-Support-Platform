const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateCreateTicketPayload,
  validateUpdateTicketPayload,
  validateListQuery,
  parseTicketId,
} = require("../../src/validators/ticketValidator");

const fields = (result) => result.errors.map((error) => error.field);

test("create: defaults, trimming and lowercase email", () => {
  const { value, errors } = validateCreateTicketPayload({
    subject: "  Printer broken  ",
    description: " It jams. ",
    requesterName: "  Ada ",
    requesterEmail: " ADA@Example.COM ",
    customerId: 9,
    companyId: 99,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(value, {
    subject: "Printer broken",
    description: "It jams.",
    status: "Open",
    priority: "Medium",
    requesterName: "Ada",
    requesterEmail: "ada@example.com",
    assignedAgentId: null,
  });
});

test("create: empty optional requester fields become null", () => {
  const { value, errors } = validateCreateTicketPayload({
    subject: "abc",
    description: "d",
    requesterName: "   ",
    requesterEmail: "",
  });
  assert.deepEqual(errors, []);
  assert.equal(value.requesterName, null);
  assert.equal(value.requesterEmail, null);
});

const validCreate = { subject: "Valid subject", description: "Valid description" };
const createCases = [
  ["missing subject", { description: "d" }, "subject"],
  ["short subject", { ...validCreate, subject: "ab" }, "subject"],
  ["long subject", { ...validCreate, subject: "x".repeat(201) }, "subject"],
  ["non-string subject", { ...validCreate, subject: 5 }, "subject"],
  ["missing description", { subject: "Valid subject" }, "description"],
  ["long description", { ...validCreate, description: "x".repeat(5001) }, "description"],
  ["lowercase priority", { ...validCreate, priority: "high" }, "priority"],
  ["unknown priority", { ...validCreate, priority: "Critical" }, "priority"],
  ["lowercase status", { ...validCreate, status: "open" }, "status"],
  ["bad email", { ...validCreate, requesterEmail: "nope" }, "requesterEmail"],
  ["long name", { ...validCreate, requesterName: "x".repeat(151) }, "requesterName"],
  ["string agent id", { ...validCreate, assignedAgentId: "5" }, "assignedAgentId"],
  ["zero agent id", { ...validCreate, assignedAgentId: 0 }, "assignedAgentId"],
  ["fractional agent id", { ...validCreate, assignedAgentId: 1.5 }, "assignedAgentId"],
];
for (const [name, body, field] of createCases) {
  test(`create rejects ${name}`, () => {
    assert.ok(fields(validateCreateTicketPayload(body)).includes(field));
  });
}

test("create accepts boundary lengths and a numeric or null agent", () => {
  const result = validateCreateTicketPayload({
    subject: "x".repeat(200),
    description: "y".repeat(5000),
    assignedAgentId: 5,
    priority: "Urgent",
    status: "In Progress",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.value.assignedAgentId, 5);
  assert.equal(validateCreateTicketPayload({ ...validCreate, assignedAgentId: null }).value.assignedAgentId, null);
});

for (const body of [null, undefined, [], "text", 4]) {
  test(`non-object body ${JSON.stringify(body)} is rejected`, () => {
    for (const validate of [validateCreateTicketPayload, validateUpdateTicketPayload]) {
      assert.deepEqual(validate(body).errors, [
        { field: "body", message: "Request body must be a JSON object" },
      ]);
    }
  });
}

test("update: needs at least one known field", () => {
  for (const body of [{}, { subject: "ignored", companyId: 3 }]) {
    assert.deepEqual(validateUpdateTicketPayload(body).errors, [
      { field: "body", message: "Provide at least one of status, priority, assignedAgentId" },
    ]);
  }
});

test("update: copies only allowlisted fields and allows null assignee", () => {
  const { value, errors } = validateUpdateTicketPayload({
    status: "Resolved",
    priority: "Low",
    assignedAgentId: null,
    subject: "nope",
    companyId: 5,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(value, { status: "Resolved", priority: "Low", assignedAgentId: null });
});

test("update: enums are case-sensitive and ids must be positive integers", () => {
  assert.deepEqual(fields(validateUpdateTicketPayload({ status: "resolved" })), ["status"]);
  assert.deepEqual(fields(validateUpdateTicketPayload({ priority: "LOW" })), ["priority"]);
  assert.deepEqual(fields(validateUpdateTicketPayload({ assignedAgentId: -1 })), ["assignedAgentId"]);
});

test("list: defaults", () => {
  const { value, errors } = validateListQuery({});
  assert.deepEqual(errors, []);
  assert.equal(value.page, 1);
  assert.equal(value.limit, 20);
  assert.equal(value.unassigned, false);
  assert.equal(value.search, undefined);
});

test("list: valid filters", () => {
  const { value, errors } = validateListQuery({
    status: "Open",
    priority: "High",
    assignee: "5",
    search: "  50%_off  ",
    page: "2",
    limit: "100",
  });
  assert.deepEqual(errors, []);
  assert.equal(value.status, "Open");
  assert.equal(value.priority, "High");
  assert.equal(value.assigneeId, 5);
  assert.equal(value.search, "50%_off");
  assert.equal(value.page, 2);
  assert.equal(value.limit, 100);
});

test("list: unassigned assignee and empty values", () => {
  assert.equal(validateListQuery({ assignee: "unassigned" }).value.unassigned, true);
  const { value, errors } = validateListQuery({ status: "", search: "   ", assignee: "" });
  assert.deepEqual(errors, []);
  assert.equal(value.status, undefined);
  assert.equal(value.search, undefined);
});

const listCases = [
  [{ status: "open" }, "status"],
  [{ priority: "Critical" }, "priority"],
  [{ assignee: "abc" }, "assignee"],
  [{ assignee: "0" }, "assignee"],
  [{ assignee: "-3" }, "assignee"],
  [{ search: "x".repeat(101) }, "search"],
  [{ search: ["a", "b"] }, "search"],
  [{ page: "0" }, "page"],
  [{ page: "1.5" }, "page"],
  [{ limit: "0" }, "limit"],
  [{ limit: "101" }, "limit"],
];
for (const [query, field] of listCases) {
  test(`list rejects ${JSON.stringify(query)}`, () => {
    assert.ok(fields(validateListQuery(query)).includes(field));
  });
}

test("parseTicketId accepts positive integers only", () => {
  assert.equal(parseTicketId("12"), 12);
  assert.equal(parseTicketId(" 7 "), 7);
  for (const raw of ["abc", "0", "-1", "1.5", "", "1e3", "007", "99999999999999999999", undefined]) {
    assert.equal(parseTicketId(raw), null, String(raw));
  }
});
