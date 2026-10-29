const defaultAiSettingsModel = require("../models/aiSettingsModel");
const defaultCompanyPortalModel = require("../models/companyPortalModel");
const AppError = require("../utils/AppError");
const { createCompanyContextResolver } = require("./companyContext");
const { validateAiSettingsPayload } = require("../validators/aiSettingsValidator");
const { DEFAULT_AI_SETTINGS } = require("../constants/aiSettingsConstants");

const SETTING_KEYS = Object.keys(DEFAULT_AI_SETTINGS);

function pickSettings(source) {
  const settings = {};
  for (const key of SETTING_KEYS) settings[key] = source[key];
  return settings;
}

// Effective settings for a stored row (or the defaults when none exists).
// Items 8/9 should read settings through this helper and honour `enabled`.
function resolveAiSettings(row) {
  return row ? pickSettings(row) : { ...DEFAULT_AI_SETTINGS };
}

function present(row) {
  return {
    settings: resolveAiSettings(row),
    defaults: { ...DEFAULT_AI_SETTINGS },
    configured: Boolean(row),
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function createAiSettingsService(dependencies = {}) {
  const aiSettingsModel = dependencies.aiSettingsModel || defaultAiSettingsModel;
  const portal = dependencies.companyPortalModel || defaultCompanyPortalModel;
  const { requireActiveCompanyAdmin } = createCompanyContextResolver(portal);

  async function getSettings(auth) {
    const admin = await requireActiveCompanyAdmin(auth);
    const row = await aiSettingsModel.findAiSettings(admin.companyId);
    return present(row);
  }

  async function updateSettings(auth, body) {
    const admin = await requireActiveCompanyAdmin(auth);

    const { value, errors } = validateAiSettingsPayload(body);
    if (errors.length > 0) {
      throw new AppError("Validation failed", 422, "VALIDATION_ERROR", errors);
    }

    const row = await aiSettingsModel.upsertAiSettings(
      admin.companyId,
      admin.userId,
      value,
    );
    return present(row);
  }

  return { getSettings, updateSettings };
}

module.exports = { createAiSettingsService, resolveAiSettings };
