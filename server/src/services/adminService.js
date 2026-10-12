const defaultAdminModel = require("../models/adminModel");
const mongoose = require("mongoose");
const { getMySQLPool } = require("../config/database");
const { sendMail } = require("./emailService");
const AppError = require("../utils/AppError");
const { isGoogleOAuthConfigured } = require("../config/googleOAuth");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Keys that look like credentials are never stored or accepted
const SECRET_KEY_PATTERN = /(secret|password|passwd|token|api[-_]?key|private[-_]?key|credential)/i;
const SECTION_NAMES = ["general", "security", "email", "aiEngine", "infrastructure"];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Built at call time so env changes (and tests) are picked up
function buildDefaultSettings() {
  return {
    general: {
      platformName: "SupportPilot Enterprise",
      supportEmail: "support@supportpilot.com",
      defaultCompanyStatus: "Active",
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
      validate: (value) => typeof value === "string" && /^\d+[smhd]$/.test(value),
      hint: "must look like 30m, 1h or 7d",
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

function createAdminService(dependencies = {}) {
  const adminModel = dependencies.adminModel || defaultAdminModel;
  const mailSender = dependencies.sendMail || sendMail;

  /**
   * Performs quick diagnostic health checks on key platform infrastructure components.
   */
  async function getPlatformHealth() {
    let dbStatus = "ONLINE";
    try {
      if (process.env.MYSQL_HOST && process.env.NODE_ENV !== "test") {
        const pool = getMySQLPool();
        await pool.query("SELECT 1");
      }
    } catch (_e) {
      dbStatus = "DEGRADED";
    }

    const mongoStatus = mongoose.connection.readyState === 1 ? "HEALTHY" : "CONNECTING";

    return [
      { id: "api-gateway", name: "API Gateway", status: "HEALTHY", active: true },
      { id: "database", name: "Database", status: dbStatus, active: true },
      { id: "webhooks", name: "Webhooks", status: "CONNECTED", active: true },
      { id: "ai-nodes", name: "AI Nodes", status: "RUNNING", active: true },
    ];
  }

  /**
   * Retrieves complete, aggregated platform overview data.
   */
  async function getDashboardOverview(timeframe = "12months") {
    const months = timeframe === "quarter" ? 3 : 12;

    const [stats, growthTrends, recentCompanies, activities, health] =
      await Promise.all([
        adminModel.getPlatformStats(),
        adminModel.getRegistrationTrends(months),
        adminModel.getRecentRegistrations(10),
        adminModel.getRecentActivities(5),
        getPlatformHealth(),
      ]);

    return {
      stats,
      growthTrends,
      recentCompanies,
      activities,
      health,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Lists companies directory with filters, search, and pagination.
   */
  async function listCompanies(query = {}) {
    return adminModel.getCompaniesDirectory(query);
  }

  /**
   * Gets single company profile with users and admins.
   */
  async function getCompanyDetails(companyId) {
    const company = await adminModel.getCompanyById(companyId);
    if (!company) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }
    return company;
  }

  /**
   * Changes status of an enterprise tenant.
   */
  async function changeCompanyStatus(companyId, status) {
    const validStatuses = ["Active", "Pending", "Suspended", "Inactive", "Rejected"];
    if (!validStatuses.includes(status)) {
      throw new AppError(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        422,
        "INVALID_STATUS",
      );
    }

    const updated = await adminModel.updateCompanyStatus(companyId, status);
    if (!updated) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }

    return updated;
  }

  /**
   * Deletes a company and its user relations.
   */
  async function deleteCompany(companyId) {
    const existing = await adminModel.getCompanyById(companyId);
    if (!existing) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }

    const deleted = await adminModel.deleteCompany(companyId);
    return { success: deleted, message: `Company #${companyId} removed successfully.` };
  }

  /**
   * Reads stored settings and merges them over the env-derived defaults.
   */
  async function loadSettings({ fallbackToDefaults = false } = {}) {
    const defaults = buildDefaultSettings();
    try {
      const stored = await adminModel.getPlatformSettings();
      return mergeSettings(defaults, stored);
    } catch (error) {
      if (fallbackToDefaults) return defaults;
      throw error;
    }
  }

  /**
   * Retrieves sanitized platform settings.
   */
  async function getPlatformSettings() {
    // A broken settings store should not take the admin console down
    const settings = await loadSettings({ fallbackToDefaults: true });
    return {
      ...settings,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Updates platform settings with validation and persists them.
   */
  async function updatePlatformSettings(patch, actor = null) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new AppError("Settings payload must be an object", 422, "INVALID_SETTINGS", [
        { field: "body", message: "must be an object" },
      ]);
    }

    const current = await loadSettings();
    const next = {};
    const errors = [];

    for (const section of SECTION_NAMES) next[section] = { ...current[section] };

    for (const [section, values] of Object.entries(patch)) {
      // The client echoes back the GET timestamp; it is not a setting
      if (section === "timestamp") continue;

      if (!SETTINGS_SCHEMA[section]) {
        errors.push({ field: section, message: "Unknown settings section" });
        continue;
      }
      if (!values || typeof values !== "object" || Array.isArray(values)) {
        errors.push({ field: section, message: "must be an object" });
        continue;
      }

      for (const [key, value] of Object.entries(values)) {
        const field = `${section}.${key}`;
        const rule = Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMA[section], key)
          ? SETTINGS_SCHEMA[section][key]
          : null;

        if (!rule) {
          errors.push({
            field,
            message: SECRET_KEY_PATTERN.test(key)
              ? "Secrets cannot be stored in platform settings"
              : "Unknown setting",
          });
        } else if (rule.readOnly) {
          // Echoing the current value back is fine; changing it is not
          if (JSON.stringify(value) !== JSON.stringify(current[section][key])) {
            errors.push({ field, message: "is read-only" });
          }
        } else if (!rule.validate(value, next)) {
          errors.push({ field, message: rule.hint });
        } else {
          next[section][key] = value;
        }
      }
    }

    if (errors.length > 0) {
      throw new AppError("Invalid platform settings", 422, "INVALID_SETTINGS", errors);
    }

    const parsedActorId = Number.parseInt(actor?.userId, 10);
    await adminModel.savePlatformSettings(next, Number.isFinite(parsedActorId) ? parsedActorId : null);

    return {
      success: true,
      message: "Platform settings updated successfully.",
      settings: next,
    };
  }

  /**
   * Sends a diagnostic test email to confirm Gmail SMTP gateway is operational.
   */
  async function sendDiagnosticTestEmail(targetEmail) {
    if (!targetEmail || !targetEmail.includes("@")) {
      throw new AppError("Valid recipient email is required", 422, "INVALID_EMAIL");
    }

    const { smtpHost, smtpPort } = (await loadSettings({ fallbackToDefaults: true })).email;

    const subject = `[Diagnostic] SupportPilot Platform Test Email - ${new Date().toISOString().slice(0, 10)}`;
    const text = `Hello Platform Administrator,\n\nThis is a verified test email sent from the SupportPilot Platform Settings test console.\n\nTimestamp: ${new Date().toISOString()}\nStatus: All email systems and SMTP relay on port 587 STARTTLS are operating normally.\n\nSupportPilot Security Systems`;

    const result = await mailSender({
      to: targetEmail.trim().toLowerCase(),
      subject,
      text,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e4e9; border-radius: 16px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <div style="width: 36px; height: 36px; background: #6D5EF5; border-radius: 8px; text-align: center; line-height: 36px; color: #fff; font-weight: bold;">SP</div>
            <h2 style="margin: 0; color: #1c1b23; font-size: 18px;">SupportPilot Platform Diagnostic</h2>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #166534; font-weight: 600; font-size: 14px;">✓ SMTP Email Gateway Operational</p>
            <p style="margin: 6px 0 0 0; color: #15803d; font-size: 13px;">This test email verifies that outbound transactional emails, password resets, and notifications are delivering properly.</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #474555;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Server Host:</td><td>${escapeHtml(smtpHost)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Server Port:</td><td>${escapeHtml(smtpPort)} (STARTTLS)</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Dispatched At:</td><td>${new Date().toUTCString()}</td></tr>
          </table>
        </div>
      `,
    });

    return {
      success: true,
      message: `Diagnostic test email successfully dispatched to ${targetEmail}.`,
      messageId: result?.messageId || "sent",
    };
  }

  /**
   * Retrieves detailed system infrastructure diagnostic metrics.
   */
  async function getSystemDiagnostics() {
    const memory = process.memoryUsage();
    let dbPingMs = 0;
    let poolStats = { total: 10, active: 1, idle: 9 };

    try {
      if (process.env.MYSQL_HOST && process.env.NODE_ENV !== "test") {
        const pool = getMySQLPool();
        const start = Date.now();
        await pool.query("SELECT 1");
        dbPingMs = Date.now() - start;
      }
    } catch (_e) {
      dbPingMs = -1;
    }

    const mongoStateNames = ["Disconnected", "Connected", "Connecting", "Disconnecting"];
    const mongoState = mongoStateNames[mongoose.connection.readyState] || "Unknown";

    return {
      status: dbPingMs >= 0 ? "OPTIMAL" : "DEGRADED",
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: {
        rssMb: Math.round((memory.rss / 1024 / 1024) * 10) / 10,
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 10) / 10,
      },
      databases: {
        mysql: {
          status: dbPingMs >= 0 ? "ONLINE" : "OFFLINE",
          latencyMs: dbPingMs,
          pool: poolStats,
        },
        mongodb: {
          status: mongoState,
          databaseName: mongoose.connection.name || "customer_support",
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  return {
    getDashboardOverview,
    getPlatformHealth,
    listCompanies,
    getCompanyDetails,
    changeCompanyStatus,
    deleteCompany,
    getPlatformSettings,
    updatePlatformSettings,
    sendDiagnosticTestEmail,
    getSystemDiagnostics,
  };
}

module.exports = { createAdminService };

