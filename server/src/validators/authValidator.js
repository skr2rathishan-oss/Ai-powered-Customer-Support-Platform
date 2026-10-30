const EMAIL_PATTERN =
  /^(?!.*\.\.)[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])[\s\S]{8,128}$/;
const DEFAULT_PASSWORD_POLICY = { minPasswordLength: 8, requireSpecialChar: true };

function normalizePolicy(policy) {
  const length = policy?.minPasswordLength;
  return {
    minPasswordLength:
      Number.isInteger(length) && length >= 6 && length <= 128
        ? length
        : DEFAULT_PASSWORD_POLICY.minPasswordLength,
    requireSpecialChar: policy?.requireSpecialChar !== false,
  };
}

function buildPasswordPattern(policy) {
  const { minPasswordLength, requireSpecialChar } = normalizePolicy(policy);
  const special = requireSpecialChar ? "(?=.*[^A-Za-z0-9\\s])" : "";
  return new RegExp(
    `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)${special}[\\s\\S]{${minPasswordLength},128}$`,
  );
}

function passwordPolicyMessage(policy) {
  const { minPasswordLength, requireSpecialChar } = normalizePolicy(policy);
  return `Password must be ${minPasswordLength} to 128 characters and include uppercase, lowercase, number${
    requireSpecialChar ? ", and special character" : ""
  }`;
}

function isPasswordAllowed(password, policy) {
  return typeof password === "string" && buildPasswordPattern(policy).test(password);
}

const ACCOUNT_TYPES = new Set(["individual", "company"]);
const COMPANY_REGISTRATION_FIELDS = new Set([
  "companyName",
  "industry",
  "businessEmail",
  "phone",
  "website",
  "description",
  "adminFirstName",
  "adminLastName",
  "adminEmail",
  "password",
]);
const INDUSTRIES = new Set([
  "SaaS",
  "E-commerce",
  "Fintech",
  "Healthcare",
  "Education",
  "Other",
]);
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;
const PHONE_PATTERN = /^\+?[0-9().\-\s]{7,20}$/;

function normalizedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateSignInPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      value: {},
      errors: [{ field: "body", message: "Request body must be a JSON object" }],
    };
  }

  const email =
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const accountType =
    typeof payload.accountType === "string"
      ? payload.accountType.trim().toLowerCase()
      : "";

  if (!accountType) {
    errors.push({
      field: "accountType",
      message: "Account type is required",
    });
  } else if (!ACCOUNT_TYPES.has(accountType)) {
    errors.push({
      field: "accountType",
      message: "Account type must be individual or company",
    });
  }

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.push({
      field: "email",
      message:
        "Enter a valid email address (for example, user@example.com) with no spaces and no more than 254 characters",
    });
  }

  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (password.length > 128) {
    // Sign-in never applies the strength policy: it may have been tightened or
    // loosened since the password was set.
    errors.push({
      field: "password",
      message: "Password must be at most 128 characters",
    });
  }

  return { value: { accountType, email, password }, errors };
}

function validateCompanyRegistrationPayload(payload, policy) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      value: {},
      errors: [{ field: "body", message: "Request body must be a JSON object" }],
    };
  }

  const errors = [];
  const unexpectedFields = Object.keys(payload).filter(
    (field) => !COMPANY_REGISTRATION_FIELDS.has(field),
  );

  if (unexpectedFields.length > 0) {
    errors.push({
      field: "body",
      message: `Unexpected fields: ${unexpectedFields.join(", ")}`,
    });
  }

  const companyName = normalizedString(payload.companyName);
  const industry = normalizedString(payload.industry);
  const businessEmail = normalizedString(payload.businessEmail).toLowerCase();
  const phone = normalizedString(payload.phone);
  const website = normalizedString(payload.website);
  const description = normalizedString(payload.description);
  const adminFirstName = normalizedString(payload.adminFirstName);
  const adminLastName = normalizedString(payload.adminLastName);
  const adminEmail = normalizedString(payload.adminEmail).toLowerCase();
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!companyName) {
    errors.push({ field: "companyName", message: "Company name is required" });
  } else if (companyName.length < 2 || companyName.length > 150) {
    errors.push({
      field: "companyName",
      message: "Company name must be between 2 and 150 characters",
    });
  }

  if (!industry) {
    errors.push({ field: "industry", message: "Industry is required" });
  } else if (!INDUSTRIES.has(industry)) {
    errors.push({ field: "industry", message: "Select a valid industry" });
  }

  for (const [field, email, label] of [
    ["businessEmail", businessEmail, "Business email"],
    ["adminEmail", adminEmail, "Administrator email"],
  ]) {
    if (!email) {
      errors.push({ field, message: `${label} is required` });
    } else if (email.length > 150 || !EMAIL_PATTERN.test(email)) {
      errors.push({ field, message: `Enter a valid ${label.toLowerCase()}` });
    }
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.push({ field: "phone", message: "Enter a valid phone number" });
  }

  if (website && (website.length > 255 || !isHttpUrl(website))) {
    errors.push({
      field: "website",
      message: "Enter a valid website URL beginning with http:// or https://",
    });
  }

  if (description.length > 2000) {
    errors.push({
      field: "description",
      message: "Description must not exceed 2000 characters",
    });
  }

  for (const [field, name, label] of [
    ["adminFirstName", adminFirstName, "First name"],
    ["adminLastName", adminLastName, "Last name"],
  ]) {
    if (!name) {
      errors.push({ field, message: `${label} is required` });
    } else if (name.length > 100 || !NAME_PATTERN.test(name)) {
      errors.push({
        field,
        message: `${label} must contain only letters, spaces, apostrophes, or hyphens`,
      });
    }
  }

  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (!isPasswordAllowed(password, policy)) {
    errors.push({ field: "password", message: passwordPolicyMessage(policy) });
  }

  return {
    value: {
      companyName,
      industry,
      businessEmail,
      phone: phone || null,
      website: website || null,
      description: description || null,
      adminFirstName,
      adminLastName,
      adminEmail,
      password,
    },
    errors,
  };
}

function validateForgotPasswordPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      value: {},
      errors: [{ field: "body", message: "Request body must be a JSON object" }],
    };
  }

  const errors = [];
  const email =
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.push({
      field: "email",
      message: "Enter a valid email address",
    });
  }

  return { value: { email }, errors };
}

function validateResetPasswordPayload(payload, policy) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      value: {},
      errors: [{ field: "body", message: "Request body must be a JSON object" }],
    };
  }

  const errors = [];
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!token) {
    errors.push({ field: "token", message: "Reset token is required" });
  }

  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (!isPasswordAllowed(password, policy)) {
    errors.push({ field: "password", message: passwordPolicyMessage(policy) });
  }

  return { value: { token, password }, errors };
}

const ONBOARDING_STATUSES = new Set(["Active", "Pending"]);

/**
 * Validates a company onboarded by a Platform Admin: the same fields as
 * self-registration plus the initial company status.
 */
function validateCompanyOnboardingPayload(payload, policy) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return validateCompanyRegistrationPayload(payload, policy);
  }

  const { status, ...registration } = payload;
  const result = validateCompanyRegistrationPayload(registration, policy);
  const companyStatus = normalizedString(status) || "Active";

  if (!ONBOARDING_STATUSES.has(companyStatus)) {
    result.errors.push({
      field: "status",
      message: "Status must be either Active or Pending",
    });
  }

  return {
    value: { ...result.value, status: companyStatus },
    errors: result.errors,
  };
}

module.exports = {
  EMAIL_PATTERN,
  PASSWORD_PATTERN,
  DEFAULT_PASSWORD_POLICY,
  buildPasswordPattern,
  passwordPolicyMessage,
  isPasswordAllowed,
  NAME_PATTERN,
  INDUSTRIES,
  validateSignInPayload,
  validateCompanyRegistrationPayload,
  validateCompanyOnboardingPayload,
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
};
