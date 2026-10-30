const adminModel = require("../models/adminModel");
const { getAuthConfig } = require("../config/auth");
const {
  buildDefaultSettings,
  mergeSettings,
} = require("./platformSettingsSchema");

const MIN_EXPIRY_MS = 60 * 1000;
const MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const EXPIRY_UNIT_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
const HOSTNAME_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,253}[A-Za-z0-9])?$/;
const NEGATIVE_TTL_MS = 5000;

function parseExpiryMs(value) {
  if (typeof value !== "string" || !/^\d+[smhd]$/.test(value)) return null;
  const ms = Number(value.slice(0, -1)) * EXPIRY_UNIT_MS[value.slice(-1)];
  if (!Number.isFinite(ms) || ms < MIN_EXPIRY_MS || ms > MAX_EXPIRY_MS) return null;
  return ms;
}

/**
 * Picks the JWT lifetime and cookie flags. A stored value wins only when it is
 * valid on its own and in combination; otherwise the env configuration is used.
 */
function resolveSecurity(settings, authConfig, nodeEnv = process.env.NODE_ENV) {
  const stored = settings?.security || {};
  const envCookie = authConfig.cookieOptions;

  const storedExpiryMs = parseExpiryMs(stored.jwtExpiresIn);
  const useStoredExpiry =
    storedExpiryMs !== null && stored.jwtExpiresIn !== authConfig.jwtExpiresIn;
  const jwtExpiresIn = useStoredExpiry ? stored.jwtExpiresIn : authConfig.jwtExpiresIn;
  const maxAge = useStoredExpiry ? storedExpiryMs : envCookie.maxAge;

  let sameSite = ["lax", "strict", "none"].includes(stored.cookieSameSite)
    ? stored.cookieSameSite
    : envCookie.sameSite;
  let secure = typeof stored.cookieSecure === "boolean" ? stored.cookieSecure : envCookie.secure;

  // The stored row persists whatever the admin last saved (defaults are seeded
  // from env, where an unset JWT_COOKIE_SECURE reads as false), so in
  // production a stored `false` must never downgrade the env-derived value.
  if (nodeEnv === "production" && secure === false) {
    secure = envCookie.secure;
  }

  // SameSite=None without Secure is rejected by browsers (and by getAuthConfig).
  if (sameSite === "none" && !secure) {
    sameSite = envCookie.sameSite;
    secure = envCookie.secure;
  }

  return {
    jwtExpiresIn,
    cookieOptions: { httpOnly: true, secure, sameSite, path: "/", maxAge },
  };
}

function resolvePasswordPolicy(settings) {
  const security = settings?.security || {};
  const length = security.minPasswordLength;
  return {
    minPasswordLength:
      Number.isInteger(length) && length >= 6 && length <= 128 ? length : 8,
    requireSpecialChar: security.requireSpecialChar !== false,
  };
}

function resolveEmail(settings) {
  const email = settings?.email || {};
  const host = typeof email.smtpHost === "string" ? email.smtpHost.trim() : "";
  const port = Number(email.smtpPort);
  return {
    ...(HOSTNAME_PATTERN.test(host) && { host }),
    ...(Number.isInteger(port) && port >= 1 && port <= 65535 && { port }),
    user: typeof email.smtpUser === "string" ? email.smtpUser : "",
    senderName: typeof email.senderName === "string" ? email.senderName : "",
    requireTls: email.requireTls !== false,
  };
}

function resolvePublic(settings) {
  return {
    platformName: settings.general.platformName,
    platformNotice: settings.general.platformNotice,
    maintenanceMode: settings.infrastructure.maintenanceMode === true,
    allowSelfRegistration: settings.general.allowSelfRegistration !== false,
    passwordPolicy: resolvePasswordPolicy(settings),
  };
}

function defaultLoader(model = adminModel) {
  return async () => {
    const stored = await model.getPlatformSettings();
    if (!stored) return null;
    return mergeSettings(buildDefaultSettings(), stored);
  };
}

/**
 * Cached view of the effective platform settings for request-time decisions.
 * A single process sees a change immediately after `invalidate()`; other
 * instances pick it up within `ttlMs`.
 */
function createRuntimeSettings({
  loader,
  ttlMs = 10000,
  timeoutMs = 2000,
  now = Date.now,
  authConfig = getAuthConfig,
} = {}) {
  let cached = null;
  let cachedUntil = 0;
  let inFlight = null;
  let generation = 0;
  let lastLogAt = -Infinity;

  function logFailure(error) {
    if (process.env.NODE_ENV === "test") return;
    const at = now();
    if (at - lastLogAt < NEGATIVE_TTL_MS) return;
    lastLogAt = at;
    console.error("[SETTINGS] Could not load platform settings, using defaults:", error?.message);
  }

  async function load() {
    const startedGeneration = generation;
    let value;
    let ttl = ttlMs;
    let timer;

    try {
      const timeout = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Settings load timed out")), timeoutMs);
      });
      value = await Promise.race([Promise.resolve().then(() => loader()), timeout]);
      if (!value || typeof value !== "object") {
        throw new Error("No stored platform settings");
      }
    } catch (error) {
      logFailure(error);
      value = buildDefaultSettings();
      ttl = Math.min(NEGATIVE_TTL_MS, ttlMs);
    } finally {
      clearTimeout(timer);
    }

    // A save during the load makes this result stale; return it but do not keep it.
    if (startedGeneration === generation) {
      cached = value;
      cachedUntil = now() + ttl;
    }
    return value;
  }

  async function get() {
    if (cached && now() < cachedUntil) return cached;
    if (!inFlight) {
      const pending = load().finally(() => {
        if (inFlight === pending) inFlight = null;
      });
      inFlight = pending;
    }
    return inFlight;
  }

  function invalidate() {
    generation += 1;
    cached = null;
    cachedUntil = 0;
    inFlight = null;
  }

  async function getSecurity() {
    return resolveSecurity(await get(), authConfig());
  }

  async function getPasswordPolicy() {
    return resolvePasswordPolicy(await get());
  }

  async function getEmail() {
    return resolveEmail(await get());
  }

  async function getPublic() {
    return resolvePublic(await get());
  }

  return { get, invalidate, getSecurity, getPasswordPolicy, getEmail, getPublic };
}

// Provider that never reads the database: used by hermetic tests and by
// services constructed without an injected provider.
function createStaticRuntimeSettings(options = {}) {
  return createRuntimeSettings({
    ...options,
    loader: async () => buildDefaultSettings(),
  });
}

// Picks the provider for the app: an injected one, a loader built from an
// injected model, or (under NODE_ENV=test with nothing injected) defaults only.
function resolveRuntimeSettings(dependencies = {}) {
  if (dependencies.runtimeSettings) return dependencies.runtimeSettings;
  if (dependencies.settingsLoader) {
    return createRuntimeSettings({ loader: dependencies.settingsLoader });
  }
  if (dependencies.adminModel) {
    return createRuntimeSettings({ loader: defaultLoader(dependencies.adminModel) });
  }
  if (process.env.NODE_ENV === "test") return createStaticRuntimeSettings();
  return createRuntimeSettings({ loader: defaultLoader() });
}

module.exports = {
  createRuntimeSettings,
  createStaticRuntimeSettings,
  resolveRuntimeSettings,
  defaultLoader,
  resolveSecurity,
  resolvePasswordPolicy,
  resolveEmail,
  resolvePublic,
};
