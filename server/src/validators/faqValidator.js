const {
  FAQ_QUESTION_MIN,
  FAQ_QUESTION_MAX,
  FAQ_ANSWER_MAX,
  FAQ_CATEGORY_MAX,
  FAQ_SORT_MAX,
  FAQ_SEARCH_MAX,
  FAQ_PUBLISHED_FILTERS,
} = require("../constants/faqConstants");
const { parseTicketId } = require("./ticketValidator");

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
// Answers are multi-line plain text: tab, LF and CR are allowed
const ANSWER_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidBody() {
  return {
    value: {},
    errors: [{ field: "body", message: "Request body must be a JSON object" }],
  };
}

function validateQuestion(raw, value, errors) {
  const question = typeof raw === "string" ? raw.trim() : "";
  if (!question) {
    errors.push({ field: "question", message: "Question is required" });
  } else if (question.length < FAQ_QUESTION_MIN) {
    errors.push({
      field: "question",
      message: `Question must be at least ${FAQ_QUESTION_MIN} characters`,
    });
  } else if (question.length > FAQ_QUESTION_MAX) {
    errors.push({
      field: "question",
      message: `Question must not exceed ${FAQ_QUESTION_MAX} characters`,
    });
  } else if (CONTROL_CHARACTERS.test(question)) {
    errors.push({ field: "question", message: "Question contains invalid characters" });
  } else {
    value.question = question;
  }
}

function validateAnswer(raw, value, errors) {
  const answer = typeof raw === "string" ? raw.trim() : "";
  if (!answer) {
    errors.push({ field: "answer", message: "Answer is required" });
  } else if (answer.length > FAQ_ANSWER_MAX) {
    errors.push({
      field: "answer",
      message: `Answer must not exceed ${FAQ_ANSWER_MAX} characters`,
    });
  } else if (ANSWER_CONTROL_CHARACTERS.test(answer)) {
    errors.push({ field: "answer", message: "Answer contains invalid characters" });
  } else {
    value.answer = answer;
  }
}

// Empty or null clears the category
function validateCategory(raw, value, errors) {
  if (raw === null || raw === undefined) {
    value.category = null;
    return;
  }
  if (typeof raw !== "string") {
    errors.push({ field: "category", message: "Category must be text" });
    return;
  }
  const category = raw.trim();
  if (category.length > FAQ_CATEGORY_MAX) {
    errors.push({
      field: "category",
      message: `Category must not exceed ${FAQ_CATEGORY_MAX} characters`,
    });
  } else if (CONTROL_CHARACTERS.test(category)) {
    errors.push({ field: "category", message: "Category contains invalid characters" });
  } else {
    value.category = category || null;
  }
}

function validateIsPublished(raw, value, errors) {
  if (typeof raw === "boolean") {
    value.isPublished = raw;
  } else {
    errors.push({ field: "isPublished", message: "isPublished must be true or false" });
  }
}

function validateSortOrder(raw, value, errors) {
  if (Number.isInteger(raw) && raw >= 0 && raw <= FAQ_SORT_MAX) {
    value.sortOrder = raw;
  } else {
    errors.push({
      field: "sortOrder",
      message: `Display order must be a whole number from 0 to ${FAQ_SORT_MAX}`,
    });
  }
}

function validateCreateFaqPayload(body) {
  if (!isPlainObject(body)) return invalidBody();

  const errors = [];
  const value = { isPublished: false, category: null, sortOrder: null };

  validateQuestion(body.question, value, errors);
  validateAnswer(body.answer, value, errors);
  if (body.category !== undefined) validateCategory(body.category, value, errors);
  if (body.isPublished !== undefined) validateIsPublished(body.isPublished, value, errors);
  if (body.sortOrder !== undefined) validateSortOrder(body.sortOrder, value, errors);

  return { value, errors };
}

// Partial update: only keys present in the body are validated and returned
function validateUpdateFaqPayload(body) {
  if (!isPlainObject(body)) return invalidBody();

  const errors = [];
  const value = {};

  if (body.question !== undefined) validateQuestion(body.question, value, errors);
  if (body.answer !== undefined) validateAnswer(body.answer, value, errors);
  if (body.category !== undefined) validateCategory(body.category, value, errors);
  if (body.isPublished !== undefined) validateIsPublished(body.isPublished, value, errors);
  if (body.sortOrder !== undefined) validateSortOrder(body.sortOrder, value, errors);

  const provided = ["question", "answer", "category", "isPublished", "sortOrder"].some(
    (key) => body[key] !== undefined,
  );
  if (!provided) {
    errors.push({ field: "body", message: "Provide at least one field to update" });
  }

  return { value, errors };
}

function validateListQuery(query) {
  const source = isPlainObject(query) ? query : {};
  const errors = [];
  const value = { search: undefined, category: undefined, status: undefined };

  const read = (field, label, max) => {
    const raw = source[field];
    if (raw === undefined || raw === "") return undefined;
    if (typeof raw !== "string") {
      errors.push({ field, message: `${label} must be a single value` });
      return undefined;
    }
    const text = raw.trim();
    if (!text) return undefined;
    if (max && text.length > max) {
      errors.push({ field, message: `${label} must not exceed ${max} characters` });
      return undefined;
    }
    return text;
  };

  value.search = read("search", "Search", FAQ_SEARCH_MAX);
  value.category = read("category", "Category", FAQ_CATEGORY_MAX);

  const status = read("status", "Status");
  if (status !== undefined) {
    if (FAQ_PUBLISHED_FILTERS.includes(status)) {
      value.status = status;
    } else {
      errors.push({
        field: "status",
        message: `Status must be one of: ${FAQ_PUBLISHED_FILTERS.join(", ")}`,
      });
    }
  }

  return { value, errors };
}

const parseFaqId = parseTicketId;

module.exports = {
  validateCreateFaqPayload,
  validateUpdateFaqPayload,
  validateListQuery,
  parseFaqId,
};
