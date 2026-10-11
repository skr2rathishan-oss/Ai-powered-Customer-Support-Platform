const {
  AI_TONES,
  AI_ASSISTANT_NAME_MAX,
  AI_GREETING_MAX,
  AI_FALLBACK_MAX,
  AI_INSTRUCTIONS_MAX,
  AI_CONFIDENCE_MIN,
  AI_CONFIDENCE_MAX,
  AI_ESCALATE_MIN,
  AI_ESCALATE_MAX,
} = require("../constants/aiSettingsConstants");

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
// Instructions are multi-line plain text: tab, LF and CR are allowed
const MULTILINE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateBoolean(body, key, label, value, errors) {
  if (typeof body[key] === "boolean") {
    value[key] = body[key];
  } else {
    errors.push({ field: key, message: `${label} must be true or false` });
  }
}

function validateText(body, key, label, { max, required, multiline }, value, errors) {
  const raw = body[key];
  if (typeof raw !== "string") {
    errors.push({ field: key, message: `${label} is required` });
    return;
  }
  const text = raw.trim();
  const pattern = multiline ? MULTILINE_CONTROL_CHARACTERS : CONTROL_CHARACTERS;
  if (required && !text) {
    errors.push({ field: key, message: `${label} is required` });
  } else if (text.length > max) {
    errors.push({ field: key, message: `${label} must not exceed ${max} characters` });
  } else if (pattern.test(text)) {
    errors.push({ field: key, message: `${label} contains invalid characters` });
  } else {
    value[key] = text;
  }
}

function validateInteger(body, key, label, min, max, value, errors) {
  const raw = body[key];
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= min && raw <= max) {
    value[key] = raw;
  } else {
    errors.push({
      field: key,
      message: `${label} must be a whole number between ${min} and ${max}`,
    });
  }
}

function validateAiSettingsPayload(body) {
  if (!isPlainObject(body)) {
    return {
      value: {},
      errors: [{ field: "body", message: "Request body must be a JSON object" }],
    };
  }

  const value = {};
  const errors = [];

  validateBoolean(body, "enabled", "Enabled", value, errors);
  validateText(body, "assistantName", "Assistant name", { max: AI_ASSISTANT_NAME_MAX, required: true }, value, errors);
  if (typeof body.tone === "string" && AI_TONES.includes(body.tone)) {
    value.tone = body.tone;
  } else {
    errors.push({ field: "tone", message: `Tone must be one of: ${AI_TONES.join(", ")}` });
  }
  validateText(body, "greeting", "Greeting", { max: AI_GREETING_MAX }, value, errors);
  validateBoolean(body, "answerFromFaqsOnly", "Answer from FAQs only", value, errors);
  validateInteger(body, "confidenceThreshold", "Confidence threshold", AI_CONFIDENCE_MIN, AI_CONFIDENCE_MAX, value, errors);
  validateInteger(body, "escalateAfterFailures", "Escalation count", AI_ESCALATE_MIN, AI_ESCALATE_MAX, value, errors);
  validateText(body, "fallbackMessage", "Fallback message", { max: AI_FALLBACK_MAX }, value, errors);
  validateText(body, "customInstructions", "Custom instructions", { max: AI_INSTRUCTIONS_MAX, multiline: true }, value, errors);

  return { value: errors.length > 0 ? {} : value, errors };
}

module.exports = { validateAiSettingsPayload };
