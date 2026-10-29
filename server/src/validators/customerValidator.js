const {
  EMAIL_PATTERN,
  isPasswordAllowed,
  passwordPolicyMessage,
  NAME_PATTERN,
} = require("./authValidator");
const { parseTicketId } = require("./ticketValidator");
const {
  TICKET_STATUSES,
  SUBJECT_MIN,
  SUBJECT_MAX,
  DESCRIPTION_MAX,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require("../constants/ticketConstants");
const {
  CUSTOMER_NAME_MAX,
  FAQ_SEARCH_MAX,
  FAQ_CATEGORY_MAX,
} = require("../constants/customerConstants");

const REGISTRATION_FIELDS = new Set([
  "firstName",
  "lastName",
  "email",
  "password",
  "companyId",
]);
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidBody() {
  return {
    value: {},
    errors: [{ field: "body", message: "Request body must be a JSON object" }],
  };
}

function parseCompanyId(raw) {
  if (typeof raw === "number") {
    return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === "string" && POSITIVE_INTEGER_PATTERN.test(raw.trim())) {
    const parsed = Number(raw.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function validateCustomerRegistrationPayload(body, policy) {
  if (!isPlainObject(body)) return invalidBody();

  const errors = [];
  const unexpected = Object.keys(body).filter(
    (field) => !REGISTRATION_FIELDS.has(field),
  );
  if (unexpected.length > 0) {
    errors.push({
      field: "body",
      message: `Unexpected fields: ${unexpected.join(", ")}`,
    });
  }

  const text = (raw) => (typeof raw === "string" ? raw.trim() : "");
  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const email = text(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  for (const [field, name, label] of [
    ["firstName", firstName, "First name"],
    ["lastName", lastName, "Last name"],
  ]) {
    if (!name) {
      errors.push({ field, message: `${label} is required` });
    } else if (name.length > CUSTOMER_NAME_MAX || !NAME_PATTERN.test(name)) {
      errors.push({
        field,
        message: `${label} must be up to ${CUSTOMER_NAME_MAX} characters using only letters, spaces, apostrophes, or hyphens`,
      });
    }
  }

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  }

  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (!isPasswordAllowed(password, policy)) {
    errors.push({ field: "password", message: passwordPolicyMessage(policy) });
  }

  const companyId = parseCompanyId(body.companyId);
  if (body.companyId === undefined || body.companyId === null || body.companyId === "") {
    errors.push({ field: "companyId", message: "Select a company" });
  } else if (companyId === null) {
    errors.push({ field: "companyId", message: "Select a valid company" });
  }

  return {
    value: { firstName, lastName, email, password, companyId },
    errors,
  };
}

// Only subject and description are ever read; priority, status, company,
// customer and assignee fields in the body are ignored.
function validateCustomerCreateTicketPayload(body) {
  if (!isPlainObject(body)) return invalidBody();

  const errors = [];
  const value = { subject: "", description: "" };

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  if (!subject) {
    errors.push({ field: "subject", message: "Subject is required" });
  } else if (subject.length < SUBJECT_MIN || subject.length > SUBJECT_MAX) {
    errors.push({
      field: "subject",
      message: `Subject must be between ${SUBJECT_MIN} and ${SUBJECT_MAX} characters`,
    });
  } else {
    value.subject = subject;
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    errors.push({ field: "description", message: "Description is required" });
  } else if (description.length > DESCRIPTION_MAX) {
    errors.push({
      field: "description",
      message: `Description must not exceed ${DESCRIPTION_MAX} characters`,
    });
  } else {
    value.description = description;
  }

  return { value, errors };
}

function validateCustomerTicketListQuery(query) {
  const source = isPlainObject(query) ? query : {};
  const errors = [];
  const value = { status: undefined, page: 1, limit: DEFAULT_LIMIT };
  const isSet = (raw) => raw !== undefined && raw !== "";

  if (isSet(source.status)) {
    if (TICKET_STATUSES.includes(source.status)) {
      value.status = source.status;
    } else {
      errors.push({
        field: "status",
        message: `Status must be one of: ${TICKET_STATUSES.join(", ")}`,
      });
    }
  }

  if (isSet(source.page)) {
    const page = parseTicketId(source.page);
    if (page === null) {
      errors.push({ field: "page", message: "Page must be a positive integer" });
    } else {
      value.page = page;
    }
  }

  if (isSet(source.limit)) {
    const limit = parseTicketId(source.limit);
    if (limit === null || limit > MAX_LIMIT) {
      errors.push({
        field: "limit",
        message: `Limit must be an integer between 1 and ${MAX_LIMIT}`,
      });
    } else {
      value.limit = limit;
    }
  }

  return { value, errors };
}

function validateFaqQuery(query) {
  const source = isPlainObject(query) ? query : {};
  const errors = [];
  const value = { search: undefined, category: undefined };

  for (const [field, max, label] of [
    ["search", FAQ_SEARCH_MAX, "Search"],
    ["category", FAQ_CATEGORY_MAX, "Category"],
  ]) {
    const raw = source[field];
    if (raw === undefined || raw === "") continue;
    const trimmed = typeof raw === "string" ? raw.trim() : null;
    if (trimmed === null || trimmed.length > max) {
      errors.push({
        field,
        message: `${label} must be text of at most ${max} characters`,
      });
    } else if (trimmed) {
      value[field] = trimmed;
    }
  }

  return { value, errors };
}

module.exports = {
  validateCustomerRegistrationPayload,
  validateCustomerCreateTicketPayload,
  validateCustomerTicketListQuery,
  validateFaqQuery,
  parseCustomerTicketId: parseTicketId,
};
