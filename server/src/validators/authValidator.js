const EMAIL_PATTERN =
  /^(?!.*\.\.)[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])[\s\S]{8,128}$/;
const ACCOUNT_TYPES = new Set(["individual", "company"]);

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
  } else if (!PASSWORD_PATTERN.test(password)) {
    errors.push({
      field: "password",
      message:
        "Password must be 8 to 128 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character",
    });
  }

  return { value: { accountType, email, password }, errors };
}

module.exports = { validateSignInPayload };
