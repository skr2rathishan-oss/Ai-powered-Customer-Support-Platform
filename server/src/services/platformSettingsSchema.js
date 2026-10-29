const { isGoogleOAuthConfigured } = require("../config/googleOAuth");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Keys that look like credentials are never stored or accepted
const SECRET_KEY_PATTERN = /(secret|password|passwd|token|api[-_]?key|private[-_]?key|credential)/i;
const SECTION_NAMES = ["general", "security", "email", "aiEngine", "infrastructure"];

// Built at call time so env changes (and tests) are picked up
function buildDefaultSettings() {
  return {
    general: {
      platformName: "SupportPilot Enterprise",
      supportEmail: "support@supportpilot.com",
      defaultCompanyStatus: ["Active", "Pending"].includes(process.env.COMPANY_REGISTRATION_STATUS)
        ? process.env.COMPANY_REGISTRATION_STATUS
        : "Active",
      timezone: "UTC",
      allowSelfRegistration: true,
      platformNotice: "System performance is fully operational.",
    },
    security: {
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
      minPasswordLength: 8,
      requireSpecialChar: true,
      googleOAuthEnabled: isGoogleOAuthConfigured(),
      cookieSameSite: process.env.JWT_COOKIE_SAME_SITE || "lax",
      cookieSecure: process.env.JWT_COOKIE_SECURE === "true",
      sessionIdleTimeoutMinutes: 60,
    },
    email: {
      smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
      smtpPort: Number(process.env.SMTP_PORT || 587),
      smtpUser: process.env.MAIL_USER || process.env.SMTP_USER || "",
      senderName: process.env.APP_NAME || "SupportPilot Security",
      requireTls: true,
      status: "Operational",
    },
    aiEngine: {
      defaultModel: "gemini-1.5-pro",
      availableModels: ["gemini-1.5-pro", "gemini-1.5-flash", "gpt-4o", "claude-3.5-sonnet"],
      temperature: 0.2,
      maxOutputTokens: 2048,
      tokenQuotaPerTenantMonth: 500000,
      sentimentAnalysisEnabled: true,
      autoTicketCategorization: true,
    },
    infrastructure: {
      environment: process.env.NODE_ENV || "development",
      region: "ap-southeast-1",
      databaseHost: process.env.MYSQL_HOST || "tidbcloud.com",
      maintenanceMode: false,
    },
  };
}

const isBoolean = (value) => typeof value === "boolean";
const isString = (min, max) => (value) =>
  typeof value === "string" && value.trim().length >= min && value.length <= max;
const isNumberInRange = (min, max, integer = false) => (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max &&
  (!integer || Number.isInteger(value));
const isOneOf = (options) => (value) => options.includes(value);

// Allowlist per section: each key has a validator, or readOnly (always taken from defaults)
const SETTINGS_SCHEMA = {
  general: {
    platformName: { validate: isString(1, 100), hint: "must be 1-100 characters" },
    supportEmail: {
      validate: (value) => typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value),
      hint: "must be a valid email address",
    },
    defaultCompanyStatus: {
      validate: isOneOf(["Active", "Pending"]),
      hint: "must be Active or Pending",
    },
    timezone: { validate: isString(1, 64), hint: "must be 1-64 characters" },
    allowSelfRegistration: { validate: isBoolean, hint: "must be a boolean" },
    platformNotice: { validate: (value) => typeof value === "string" && value.length <= 500, hint: "must be at most 500 characters" },
  },
  security: {
    jwtExpiresIn: {
      validate: (value) => {
        const match = typeof value === "string" && /^(\d+)([smhd])$/.exec(value);
        if (!match) return false;
        const seconds = Number(match[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
        return seconds >= 60 && seconds <= 30 * 86400;
      },
      hint: "must look like 30m, 1h or 7d (between 1 minute and 30 days)",
    },
    minPasswordLength: { validate: isNumberInRange(6, 128, true), hint: "must be an integer from 6 to 128" },
    requireSpecialChar: { validate: isBoolean, hint: "must be a boolean" },
    googleOAuthEnabled: { validate: isBoolean, hint: "must be a boolean" },
    cookieSameSite: { validate: isOneOf(["lax", "strict", "none"]), hint: "must be lax, strict or none" },
    cookieSecure: { validate: isBoolean, hint: "must be a boolean" },
    sessionIdleTimeoutMinutes: { validate: isNumberInRange(5, 1440, true), hint: "must be an integer from 5 to 1440" },
  },
  email: {
    smtpHost: { validate: isString(1, 255), hint: "must be 1-255 characters" },
    smtpPort: { validate: isNumberInRange(1, 65535, true), hint: "must be an integer from 1 to 65535" },
    smtpUser: { validate: (value) => typeof value === "string" && value.length <= 254, hint: "must be at most 254 characters" },
    senderName: { validate: isString(1, 100), hint: "must be 1-100 characters" },
    requireTls: { validate: isBoolean, hint: "must be a boolean" },
    status: { readOnly: true },
  },
  aiEngine: {
    defaultModel: {
      validate: (value, current) => current.aiEngine.availableModels.includes(value),
      hint: "must be one of the available models",
    },
    availableModels: { readOnly: true },
    temperature: { validate: isNumberInRange(0, 2), hint: "must be a number from 0 to 2" },
    maxOutputTokens: { validate: isNumberInRange(1, 32768, true), hint: "must be an integer from 1 to 32768" },
    tokenQuotaPerTenantMonth: { validate: isNumberInRange(0, Number.MAX_SAFE_INTEGER, true), hint: "must be a non-negative integer" },
    sentimentAnalysisEnabled: { validate: isBoolean, hint: "must be a boolean" },
    autoTicketCategorization: { validate: isBoolean, hint: "must be a boolean" },
  },
  infrastructure: {
    environment: { readOnly: true },
    region: { validate: isString(1, 64), hint: "must be 1-64 characters" },
    databaseHost: { readOnly: true },
    maintenanceMode: { validate: isBoolean, hint: "must be a boolean" },
  },
};

/**
 * Overlays stored values onto defaults. Unknown keys are dropped, read-only keys always
 * come from defaults, and invalid stored values fall back to the default.
 */
function mergeSettings(defaults, stored) {
  const merged = {};
  const source = stored && typeof stored === "object" ? stored : {};

  for (const section of SECTION_NAMES) {
    merged[section] = { ...defaults[section] };
    const storedSection = source[section];
    if (!storedSection || typeof storedSection !== "object") continue;

    for (const [key, rule] of Object.entries(SETTINGS_SCHEMA[section])) {
      if (rule.readOnly) continue;
      if (!Object.prototype.hasOwnProperty.call(storedSection, key)) continue;
      if (rule.validate(storedSection[key], merged)) {
        merged[section][key] = storedSection[key];
      }
    }
  }

  return merged;
}

module.exports = {
  EMAIL_PATTERN,
  SECRET_KEY_PATTERN,
  SECTION_NAMES,
  SETTINGS_SCHEMA,
  buildDefaultSettings,
  mergeSettings,
};
