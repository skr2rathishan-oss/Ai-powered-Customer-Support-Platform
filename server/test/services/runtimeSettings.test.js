process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createRuntimeSettings,
  resolveSecurity,
  resolvePasswordPolicy,
  resolveEmail,
  resolveRuntimeSettings,
} = require("../../src/services/runtimeSettings");
const { buildDefaultSettings } = require("../../src/services/platformSettingsSchema");

function stored(overrides = {}) {
  const settings = buildDefaultSettings();
  for (const [section, values] of Object.entries(overrides)) {
    Object.assign(settings[section], values);
  }
  return settings;
}

function clock(start = 1000) {
  const state = { at: start };
  return { now: () => state.at, advance: (ms) => (state.at += ms) };
}

const envAuth = {
  jwtExpiresIn: "1h",
  cookieOptions: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 3600000,
  },
};

test("loader is called once within the TTL and again after it", async () => {
  const time = clock();
  let calls = 0;
  const provider = createRuntimeSettings({
    loader: async () => {
      calls += 1;
      return stored();
    },
    ttlMs: 10000,
    now: time.now,
  });

  await provider.get();
  await provider.get();
  assert.equal(calls, 1);

  time.advance(10001);
  await provider.get();
  assert.equal(calls, 2);
});

test("invalidate forces a reload", async () => {
  let calls = 0;
  const provider = createRuntimeSettings({
    loader: async () => {
      calls += 1;
      return stored();
    },
  });

  await provider.get();
  provider.invalidate();
  await provider.get();
  assert.equal(calls, 2);
});

test("concurrent get calls share one load", async () => {
  let calls = 0;
  const provider = createRuntimeSettings({
    loader: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return stored();
    },
  });

  const results = await Promise.all([provider.get(), provider.get(), provider.get()]);
  assert.equal(calls, 1);
  assert.equal(results[0], results[1]);
});

test("a load started before invalidate does not repopulate the cache", async () => {
  let release;
  let calls = 0;
  const provider = createRuntimeSettings({
    loader: async () => {
      calls += 1;
      if (calls === 1) {
        await new Promise((resolve) => {
          release = resolve;
        });
        return stored({ infrastructure: { maintenanceMode: false } });
      }
      return stored({ infrastructure: { maintenanceMode: true } });
    },
  });

  const first = provider.get();
  await new Promise((resolve) => setImmediate(resolve));
  provider.invalidate();
  release();
  await first;

  const fresh = await provider.get();
  assert.equal(calls, 2);
  assert.equal(fresh.infrastructure.maintenanceMode, true);
});

test("loader failure, timeout and missing row return env defaults without throwing", async () => {
  const cases = {
    throws: async () => {
      throw new Error("db down");
    },
    missing: async () => null,
    timeout: () => new Promise(() => {}),
  };

  for (const [name, loader] of Object.entries(cases)) {
    const provider = createRuntimeSettings({ loader, timeoutMs: 20 });
    const settings = await provider.get();
    assert.deepEqual(settings, buildDefaultSettings(), name);
    assert.equal((await provider.getPublic()).maintenanceMode, false, name);
  }
});

test("failed loads are negatively cached for a short time", async () => {
  const time = clock();
  let calls = 0;
  const provider = createRuntimeSettings({
    loader: async () => {
      calls += 1;
      throw new Error("db down");
    },
    now: time.now,
  });

  await provider.get();
  await provider.get();
  assert.equal(calls, 1);

  time.advance(5001);
  await provider.get();
  assert.equal(calls, 2);
});

test("resolveSecurity accepts a valid stored override and derives maxAge", () => {
  const result = resolveSecurity(
    stored({ security: { jwtExpiresIn: "15m", cookieSameSite: "strict", cookieSecure: true } }),
    envAuth,
    "development",
  );

  assert.equal(result.jwtExpiresIn, "15m");
  assert.deepEqual(result.cookieOptions, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 15 * 60 * 1000,
  });
});

test("resolveSecurity keeps the env expiry and cookie maxAge when nothing is overridden", () => {
  const result = resolveSecurity(stored(), envAuth, "development");
  assert.equal(result.jwtExpiresIn, "1h");
  assert.equal(result.cookieOptions.maxAge, 3600000);
});

test("resolveSecurity rejects unsafe or malformed expiry values", () => {
  for (const value of ["0s", "abc", "999d", "30s", "", 900]) {
    const result = resolveSecurity(stored({ security: { jwtExpiresIn: value } }), envAuth);
    assert.equal(result.jwtExpiresIn, "1h", String(value));
    assert.equal(result.cookieOptions.maxAge, 3600000, String(value));
  }
});

test("resolveSecurity falls back to the env pair for SameSite=None without Secure", () => {
  const result = resolveSecurity(
    stored({ security: { cookieSameSite: "none", cookieSecure: false } }),
    envAuth,
    "development",
  );
  assert.equal(result.cookieOptions.sameSite, "lax");
  assert.equal(result.cookieOptions.secure, false);
});

test("resolveSecurity ignores a stored cookieSecure=false in production", () => {
  const productionEnv = {
    ...envAuth,
    cookieOptions: { ...envAuth.cookieOptions, secure: true },
  };
  const result = resolveSecurity(stored({ security: { cookieSecure: false } }), productionEnv, "production");
  assert.equal(result.cookieOptions.secure, true);
});

test("password policy and email resolution validate stored values", () => {
  assert.deepEqual(
    resolvePasswordPolicy(stored({ security: { minPasswordLength: 12, requireSpecialChar: false } })),
    { minPasswordLength: 12, requireSpecialChar: false },
  );
  assert.deepEqual(resolvePasswordPolicy(stored({ security: { minPasswordLength: 2 } })), {
    minPasswordLength: 8,
    requireSpecialChar: true,
  });

  const email = resolveEmail(
    stored({ email: { smtpHost: "smtp.example.com", smtpPort: 2525, smtpUser: "u@example.com", senderName: "Acme", requireTls: false } }),
  );
  assert.deepEqual(email, {
    host: "smtp.example.com",
    port: 2525,
    user: "u@example.com",
    senderName: "Acme",
    requireTls: false,
  });
  assert.equal(resolveEmail(stored({ email: { smtpHost: "http://evil.test/x y" } })).host, undefined);
  assert.equal("pass" in email || "password" in email, false);
});

test("getPublic exposes exactly the allowlisted keys", async () => {
  const provider = createRuntimeSettings({
    loader: async () =>
      stored({
        general: { platformName: "Acme Desk", allowSelfRegistration: false },
        infrastructure: { maintenanceMode: true },
        email: { smtpHost: "smtp.secret.test", smtpUser: "private@example.com" },
      }),
  });

  const result = await provider.getPublic();
  assert.deepEqual(Object.keys(result).sort(), [
    "allowSelfRegistration",
    "maintenanceMode",
    "passwordPolicy",
    "platformName",
    "platformNotice",
  ]);
  assert.equal(result.platformName, "Acme Desk");
  assert.equal(result.allowSelfRegistration, false);
  assert.equal(result.maintenanceMode, true);
  assert.deepEqual(Object.keys(result.passwordPolicy).sort(), ["minPasswordLength", "requireSpecialChar"]);
  assert.doesNotMatch(JSON.stringify(result), /smtp|private@|supportEmail/i);
});

test("getSecurity uses the injected auth config", async () => {
  const provider = createRuntimeSettings({
    loader: async () => stored({ security: { jwtExpiresIn: "2h" } }),
    authConfig: () => envAuth,
  });
  assert.equal((await provider.getSecurity()).jwtExpiresIn, "2h");
});

test("resolveRuntimeSettings is hermetic under NODE_ENV=test and honours injections", async () => {
  const injected = { get: async () => stored() };
  assert.equal(resolveRuntimeSettings({ runtimeSettings: injected }), injected);

  const fromLoader = resolveRuntimeSettings({
    settingsLoader: async () => stored({ general: { platformName: "Loader Desk" } }),
  });
  assert.equal((await fromLoader.get()).general.platformName, "Loader Desk");

  const fromModel = resolveRuntimeSettings({
    adminModel: { getPlatformSettings: async () => ({ general: { platformName: "Model Desk" } }) },
  });
  assert.equal((await fromModel.get()).general.platformName, "Model Desk");

  const hermetic = resolveRuntimeSettings({});
  assert.deepEqual(await hermetic.get(), buildDefaultSettings());
});
