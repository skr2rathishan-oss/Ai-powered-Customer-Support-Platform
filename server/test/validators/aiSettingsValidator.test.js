const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAiSettingsPayload } = require("../../src/validators/aiSettingsValidator");
const { DEFAULT_AI_SETTINGS } = require("../../src/constants/aiSettingsConstants");

const valid = (overrides = {}) => ({ ...DEFAULT_AI_SETTINGS, ...overrides });
const fieldsOf = (body) => validateAiSettingsPayload(body).errors.map((e) => e.field);

test("accepts the defaults and ignores unknown keys", () => {
  const { value, errors } = validateAiSettingsPayload(
    valid({ apiKey: "sk-x", model: "gpt", companyId: 2, updatedBy: 9 }),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(value, { ...DEFAULT_AI_SETTINGS });
});

test("trims strings and allows empty optional text", () => {
  const { value, errors } = validateAiSettingsPayload(
    valid({ assistantName: "  Bot  ", greeting: "", fallbackMessage: "  ", customInstructions: "" }),
  );
  assert.deepEqual(errors, []);
  assert.equal(value.assistantName, "Bot");
  assert.equal(value.greeting, "");
  assert.equal(value.fallbackMessage, "");
});

test("rejects non-object bodies", () => {
  for (const body of [null, undefined, [], "x", 5]) {
    assert.deepEqual(fieldsOf(body), ["body"]);
  }
});

test("requires every key", () => {
  assert.equal(validateAiSettingsPayload({}).errors.length, 9);
});

test("assistantName rules", () => {
  assert.deepEqual(fieldsOf(valid({ assistantName: "  " })), ["assistantName"]);
  assert.deepEqual(fieldsOf(valid({ assistantName: "a".repeat(41) })), ["assistantName"]);
  assert.deepEqual(fieldsOf(valid({ assistantName: "bad\u0007name" })), ["assistantName"]);
  assert.deepEqual(fieldsOf(valid({ assistantName: "a".repeat(40) })), []);
});

test("tone and booleans are strict", () => {
  assert.deepEqual(fieldsOf(valid({ tone: "sarcastic" })), ["tone"]);
  assert.deepEqual(fieldsOf(valid({ enabled: "true" })), ["enabled"]);
  assert.deepEqual(fieldsOf(valid({ answerFromFaqsOnly: 1 })), ["answerFromFaqsOnly"]);
});

test("text length caps and null rejection", () => {
  assert.deepEqual(fieldsOf(valid({ greeting: "a".repeat(301) })), ["greeting"]);
  assert.deepEqual(fieldsOf(valid({ fallbackMessage: "a".repeat(301) })), ["fallbackMessage"]);
  assert.deepEqual(fieldsOf(valid({ customInstructions: "a".repeat(1001) })), ["customInstructions"]);
  assert.deepEqual(fieldsOf(valid({ greeting: null })), ["greeting"]);
  assert.deepEqual(fieldsOf(valid({ greeting: "line\nbreak" })), ["greeting"]);
});

test("customInstructions allows newlines and tabs", () => {
  const { value, errors } = validateAiSettingsPayload(valid({ customInstructions: "a\nb\tc\r\nd" }));
  assert.deepEqual(errors, []);
  assert.equal(value.customInstructions, "a\nb\tc\r\nd");
  assert.deepEqual(fieldsOf(valid({ customInstructions: "a\u0000b" })), ["customInstructions"]);
});

test("numeric ranges require integers", () => {
  for (const v of [101, -1, 70.5, "70", null]) {
    assert.deepEqual(fieldsOf(valid({ confidenceThreshold: v })), ["confidenceThreshold"]);
  }
  for (const v of [0, 11, 2.5, "2"]) {
    assert.deepEqual(fieldsOf(valid({ escalateAfterFailures: v })), ["escalateAfterFailures"]);
  }
  assert.deepEqual(fieldsOf(valid({ confidenceThreshold: 0, escalateAfterFailures: 10 })), []);
  assert.deepEqual(fieldsOf(valid({ confidenceThreshold: 100, escalateAfterFailures: 1 })), []);
});
