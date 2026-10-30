const { EMAIL_PATTERN } = require("./authValidator");
const {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  ASSIGNEE_UNASSIGNED,
  SUBJECT_MIN,
  SUBJECT_MAX,
  DESCRIPTION_MAX,
  REQUESTER_NAME_MAX,
  REQUESTER_EMAIL_MAX,
  SEARCH_MAX,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require("../constants/ticketConstants");

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

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

// Query-string integers arrive as strings; digits only, no signs or decimals
function parsePositiveIntegerString(raw) {
  if (typeof raw !== "string" || !POSITIVE_INTEGER_PATTERN.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseTicketId(raw) {
  return parsePositiveIntegerString(typeof raw === "string" ? raw.trim() : raw);
}

// Validates the fields shared by create and update; only keys present in the
// body are touched so update can be a partial change.
function validateSharedFields(body, value, errors) {
  if (body.priority !== undefined) {
    if (TICKET_PRIORITIES.includes(body.priority)) {
      value.priority = body.priority;
    } else {
      errors.push({
        field: "priority",
        message: `Priority must be one of: ${TICKET_PRIORITIES.join(", ")}`,
      });
    }
  }

  if (body.status !== undefined) {
    if (TICKET_STATUSES.includes(body.status)) {
      value.status = body.status;
    } else {
      errors.push({
        field: "status",
        message: `Status must be one of: ${TICKET_STATUSES.join(", ")}`,
      });
    }
  }

  if (body.assignedAgentId !== undefined) {
    if (body.assignedAgentId === null || isPositiveInteger(body.assignedAgentId)) {
      value.assignedAgentId = body.assignedAgentId;
    } else {
      errors.push({
        field: "assignedAgentId",
        message: "Assigned agent must be a positive integer or null",
      });
    }
  }
}

function validateCreateTicketPayload(body) {
  if (!isPlainObject(body)) return invalidBody();

  const errors = [];
  const value = {
    subject: "",
    description: "",
    status: "Open",
    priority: "Medium",
    requesterName: null,
    requesterEmail: null,
    assignedAgentId: null,
  };

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

  if (body.requesterName !== undefined && body.requesterName !== null) {
    const name =
      typeof body.requesterName === "string" ? body.requesterName.trim() : null;
    if (name === null || name.length > REQUESTER_NAME_MAX) {
      errors.push({
        field: "requesterName",
        message: `Requester name must be text of at most ${REQUESTER_NAME_MAX} characters`,
      });
    } else {
      value.requesterName = name || null;
    }
  }

  if (body.requesterEmail !== undefined && body.requesterEmail !== null) {
    const email =
      typeof body.requesterEmail === "string"
        ? body.requesterEmail.trim().toLowerCase()
        : null;
    if (email === "") {
      value.requesterEmail = null;
    } else if (
      email === null ||
      email.length > REQUESTER_EMAIL_MAX ||
      !EMAIL_PATTERN.test(email)
    ) {
      errors.push({
        field: "requesterEmail",
        message: "Enter a valid requester email address",
      });
    } else {
      value.requesterEmail = email;
    }
  }

  validateSharedFields(body, value, errors);

  return { value, errors };
}

function validateUpdateTicketPayload(body) {
  if (!isPlainObject(body)) return invalidBody();

  const hasChange = ["status", "priority", "assignedAgentId"].some(
    (key) => body[key] !== undefined,
  );
  if (!hasChange) {
    return {
      value: {},
      errors: [
        {
          field: "body",
          message: "Provide at least one of status, priority, assignedAgentId",
        },
      ],
    };
  }

  const errors = [];
  const value = {};
  validateSharedFields(body, value, errors);

  return { value, errors };
}

function validateListQuery(query) {
  const source = isPlainObject(query) ? query : {};
  const errors = [];
  const value = {
    status: undefined,
    priority: undefined,
    assigneeId: undefined,
    unassigned: false,
    search: undefined,
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

  if (isSet(source.priority)) {
    if (TICKET_PRIORITIES.includes(source.priority)) {
      value.priority = source.priority;
    } else {
      errors.push({
        field: "priority",
        message: `Priority must be one of: ${TICKET_PRIORITIES.join(", ")}`,
      });
    }
  }

  if (isSet(source.assignee)) {
    if (source.assignee === ASSIGNEE_UNASSIGNED) {
      value.unassigned = true;
    } else {
      const assigneeId = parsePositiveIntegerString(source.assignee);
      if (assigneeId === null) {
        errors.push({
          field: "assignee",
          message: `Assignee must be a positive integer or "${ASSIGNEE_UNASSIGNED}"`,
        });
      } else {
        value.assigneeId = assigneeId;
      }
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

  if (isSet(source.page)) {
    const page = parsePositiveIntegerString(source.page);
    if (page === null) {
      errors.push({ field: "page", message: "Page must be a positive integer" });
    } else {
      value.page = page;
    }
  }

  if (isSet(source.limit)) {
    const limit = parsePositiveIntegerString(source.limit);
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

module.exports = {
  validateCreateTicketPayload,
  validateUpdateTicketPayload,
  validateListQuery,
  parseTicketId,
};
