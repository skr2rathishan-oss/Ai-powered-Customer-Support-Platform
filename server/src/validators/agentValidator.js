const { EMAIL_PATTERN } = require("./authValidator");
const {
  AGENT_STATUSES,
  AGENT_NAME_MAX,
  AGENT_EMAIL_MAX,
} = require("../constants/agentConstants");

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidBody() {
  return {
    value: {},
    errors: [{ field: "body", message: "Request body must be a JSON object" }],
  };
}

function validateName(raw, field, label, value, errors) {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) {
    errors.push({ field, message: `${label} is required` });
  } else if (name.length > AGENT_NAME_MAX) {
    errors.push({
      field,
      message: `${label} must not exceed ${AGENT_NAME_MAX} characters`,
    });
  } else if (CONTROL_CHARACTERS.test(name)) {
    errors.push({ field, message: `${label} contains invalid characters` });
  } else {
    value[field] = name;
  }
}

function validateInviteAgentPayload(body) {
  if (!isPlainObject(body)) return invalidBody();

  const errors = [];
  const value = { firstName: "", lastName: "", email: "" };

  validateName(body.firstName, "firstName", "First name", value, errors);
  validateName(body.lastName, "lastName", "Last name", value, errors);

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (email.length > AGENT_EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    value.email = email;
  }

  return { value, errors };
}

function validateAgentStatusPayload(body) {
  if (!isPlainObject(body)) return invalidBody();

  if (!AGENT_STATUSES.includes(body.status)) {
    return {
      value: {},
      errors: [
        {
          field: "status",
          message: `Status must be one of: ${AGENT_STATUSES.join(", ")}`,
        },
      ],
    };
  }

  return { value: { status: body.status }, errors: [] };
}

module.exports = { validateInviteAgentPayload, validateAgentStatusPayload };
