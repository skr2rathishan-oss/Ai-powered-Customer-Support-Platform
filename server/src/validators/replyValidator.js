const { parseTicketId } = require("./ticketValidator");
const {
  TICKET_STATUSES,
  SEARCH_MAX,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require("../constants/ticketConstants");
const {
  REPLY_BODY_MAX,
  AGENT_SETTABLE_STATUSES,
  AGENT_SORTS,
} = require("../constants/replyConstants");

const REPLY_FIELDS = new Set(["body", "isInternal"]);
// Control characters other than tab and newline
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidBody() {
  return {
    value: {},
    errors: [{ field: "body", message: "Request body must be a JSON object" }],
  };
}

function validateReplyPayload(body, { allowInternal = false } = {}) {
  if (!isPlainObject(body)) return invalidBody();

  const errors = [];
  const unexpected = Object.keys(body).filter((field) => !REPLY_FIELDS.has(field));
  if (unexpected.length > 0) {
    errors.push({
      field: "body",
      message: `Unexpected fields: ${unexpected.join(", ")}`,
    });
  }

  const value = { body: "", isInternal: false };

  const text =
    typeof body.body === "string" ? body.body.replace(/\r\n?/g, "\n").trim() : "";
  if (!text) {
    errors.push({ field: "body", message: "Reply is required" });
  } else if (text.length > REPLY_BODY_MAX) {
    errors.push({
      field: "body",
      message: `Reply must not exceed ${REPLY_BODY_MAX} characters`,
    });
  } else if (CONTROL_CHARS.test(text)) {
    errors.push({ field: "body", message: "Reply contains invalid characters" });
  } else {
    value.body = text;
  }

  if (body.isInternal !== undefined) {
    if (typeof body.isInternal !== "boolean") {
      errors.push({ field: "isInternal", message: "isInternal must be true or false" });
    } else if (body.isInternal && !allowInternal) {
      errors.push({
        field: "isInternal",
        message: "Internal notes are not available for this account",
      });
    } else {
      value.isInternal = body.isInternal;
    }
  }

  return { value, errors };
}

function validateAgentTicketListQuery(query) {
  const source = isPlainObject(query) ? query : {};
  const errors = [];
  const value = {
    status: undefined,
    search: undefined,
    sort: "newest",
    page: 1,
    limit: DEFAULT_LIMIT,
  };
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

  if (isSet(source.search)) {
    const search = typeof source.search === "string" ? source.search.trim() : null;
    if (search === null || search.length > SEARCH_MAX) {
      errors.push({
        field: "search",
        message: `Search must be text of at most ${SEARCH_MAX} characters`,
      });
    } else if (search) {
      value.search = search;
    }
  }

  if (isSet(source.sort)) {
    if (AGENT_SORTS.includes(source.sort)) {
      value.sort = source.sort;
    } else {
      errors.push({
        field: "sort",
        message: `Sort must be one of: ${AGENT_SORTS.join(", ")}`,
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

function validateAgentStatusPayload(body) {
  if (!isPlainObject(body)) return invalidBody();

  const errors = [];
  const unexpected = Object.keys(body).filter((field) => field !== "status");
  if (unexpected.length > 0) {
    errors.push({
      field: "body",
      message: `Unexpected fields: ${unexpected.join(", ")}`,
    });
  }

  const value = {};
  if (AGENT_SETTABLE_STATUSES.includes(body.status)) {
    value.status = body.status;
  } else {
    errors.push({
      field: "status",
      message: `Status must be one of: ${AGENT_SETTABLE_STATUSES.join(", ")}`,
    });
  }

  return { value, errors };
}

module.exports = {
  validateReplyPayload,
  validateAgentTicketListQuery,
  validateAgentStatusPayload,
};
