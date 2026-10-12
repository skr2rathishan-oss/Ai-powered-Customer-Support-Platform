process.env.NODE_ENV = "test";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";
delete process.env.COMPANY_REGISTRATION_STATUS;

const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { createApp } = require("../../src/app");
const { createAccessToken } = require("../../src/utils/token");
const {
  createRuntimeSettings,
  defaultLoader,
} = require("../../src/services/runtimeSettings");

const PASSWORD = "Correct@123";

async function startTestServer(dependencies = {}) {
  const app = createApp(dependencies);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function createAdminModel(stored = null) {
  const state = { stored, fail: false, saves: [] };
  return {
    state,
    getPlatformSettings: async () => {
      if (state.fail) throw new Error("db down");
      return state.stored;
    },
    savePlatformSettings: async (settings) => {
      state.saves.push(settings);
      state.stored = JSON.parse(JSON.stringify(settings));
    },
  };
}

const adminToken = createAccessToken({
  accountType: "individual",
  userId: 1,
  email: "admin@supportpilot.com",
  roleName: "Platform Admin",
});
const agentToken = createAccessToken({
  accountType: "individual",
  userId: 2,
  email: "agent@supportpilot.com",
  roleName: "Support Agent",
});

const json = (method, body, token) => ({
  method,
  headers: {
    "content-type": "application/json",
    ...(token && { authorization: `Bearer ${token}` }),
  },
  body: JSON.stringify(body),
});

const companyBody = {
  companyName: "Acme Support",
  industry: "SaaS",
  businessEmail: "contact@acme.example",
  adminFirstName: "Alex",
  adminLastName: "Morgan",
  adminEmail: "admin@acme.example",
  password: PASSWORD,
};

const customerBody = {
  firstName: "Casey",
  lastName: "Customer",
  email: "casey@customer.example",
  password: PASSWORD,
  companyId: 7,
};

async function buildHarness(context, { stored = null, extra = {}, ttlMs = 0 } = {}) {
  const adminModel = createAdminModel(stored);
  const hash = await bcrypt.hash(PASSWORD, 4);
  const users = [
    {
      userId: 1,
      email: "admin@supportpilot.com",
      passwordHash: hash,
      accountStatus: "Active",
      roleName: "Platform Admin",
      onlineStatus: "Offline",
    },
    {
      userId: 2,
      email: "agent@supportpilot.com",
      passwordHash: hash,
      accountStatus: "Active",
      roleName: "Support Agent",
      onlineStatus: "Offline",
    },
  ];
  const calls = { createRegistration: [], createCustomer: [], resetMail: [], sendMail: [], setPassword: [] };
  const tokens = [];

  const dependencies = {
    adminModel,
    runtimeSettings: createRuntimeSettings({ loader: defaultLoader(adminModel), ttlMs }),
    userModel: {
      findByEmail: async (email) =>
        users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null,
      setPassword: async (userId, passwordHash) => {
        calls.setPassword.push({ userId, passwordHash });
        const user = users.find((u) => u.userId === userId);
        if (user) user.passwordHash = passwordHash;
      },
    },
    companyModel: {
      findByBusinessEmail: async () => null,
      createRegistration: async (registration) => {
        calls.createRegistration.push(registration);
        return {
          userId: 90,
          companyId: 9,
          companyName: registration.companyName,
          businessEmail: registration.businessEmail,
          adminEmail: registration.adminEmail,
          onlineStatus: "Offline",
          roleName: "Company Admin",
        };
      },
    },
    customerModel: {
      listPublicCompanies: async () => [],
      findActiveCompany: async (id) => (id === 7 ? { companyId: 7, companyName: "Acme" } : null),
      createCustomer: async (customer) => {
        calls.createCustomer.push(customer);
        users.push({
          userId: 50,
          email: customer.email,
          passwordHash: customer.passwordHash,
          accountStatus: "Active",
          roleName: "Customer",
          onlineStatus: "Offline",
        });
        return { userId: 50, ...customer };
      },
    },
    tokenModel: {
      createPasswordResetToken: async (userId, tokenHash, expiresAt) => {
        tokens.push({ tokenId: tokens.length + 1, userId, tokenHash, expiresAt, usedAt: null });
      },
      findValidToken: async (tokenHash) => {
        const token = tokens.find((t) => t.tokenHash === tokenHash && !t.usedAt);
        return token ? { ...token, email: "" } : null;
      },
      markTokenUsed: async (tokenId) => {
        tokens.find((t) => t.tokenId === tokenId).usedAt = new Date();
      },
    },
    hashPassword: (password) => bcrypt.hash(password, 4),
    sendPasswordResetEmail: async (to, link, smtp) => {
      calls.resetMail.push({ to, link, smtp });
    },
    sendMail: async (options) => {
      calls.sendMail.push(options);
      return { messageId: "id" };
    },
    ...extra,
  };

  const server = await startTestServer(dependencies);
  context.after(() => server.close());
  return { server, adminModel, calls, users, tokens, url: (path) => `${server.baseUrl}${path}` };
}

const signIn = (h, email, password = PASSWORD) =>
  fetch(h.url("/api/auth/sign-in"), json("POST", { accountType: "individual", email, password }));

test("maintenance mode", async (context) => {
  const h = await buildHarness(context, { stored: { infrastructure: { maintenanceMode: true } } });

  await context.test("blocks ordinary API routes with 503 and Retry-After", async () => {
    const requests = [
      fetch(h.url("/api/auth/me"), { headers: { authorization: `Bearer ${agentToken}` } }),
      fetch(h.url("/api/customer/me")),
      fetch(h.url("/api/auth/forgot-password"), json("POST", { email: "a@b.co" })),
      fetch(h.url("/api/auth/company/register"), json("POST", companyBody)),
      fetch(h.url("/api/auth/customer/register"), json("POST", customerBody)),
    ];
    for (const response of await Promise.all(requests)) {
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("retry-after"), "60");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal((await response.json()).code, "MAINTENANCE_MODE");
    }
  });

  await context.test("keeps health, providers and public platform reachable", async () => {
    assert.equal((await fetch(h.url("/health"))).status, 200);
    assert.equal((await fetch(h.url("/api/auth/providers"))).status, 200);
    const platform = await fetch(h.url("/api/public/platform"));
    assert.equal(platform.status, 200);
    assert.equal((await platform.json()).data.maintenanceMode, true);
    assert.equal((await fetch(h.url("/api/auth/sign-out"), { method: "POST" })).status, 200);
  });

  await context.test("lets a Platform Admin through to admin and regular routes", async () => {
    const headers = { authorization: `Bearer ${adminToken}` };
    assert.equal((await fetch(h.url("/api/admin/settings"), { headers })).status, 200);
    assert.equal((await fetch(h.url("/api/auth/me"), { headers })).status, 200);
  });

  await context.test("non-admin tokens get the existing 403 on /api/admin, not 503", async () => {
    const response = await fetch(h.url("/api/admin/settings"), {
      headers: { authorization: `Bearer ${agentToken}` },
    });
    assert.equal(response.status, 403);
  });

  await context.test("an invalid token does not bypass maintenance", async () => {
    const response = await fetch(h.url("/api/auth/me"), {
      headers: { authorization: "Bearer not.a.token" },
    });
    assert.equal(response.status, 503);
  });

  await context.test("sign-in: 503 without a cookie for non-admins, 200 for a Platform Admin", async () => {
    const blocked = await signIn(h, "agent@supportpilot.com");
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).code, "MAINTENANCE_MODE");
    assert.equal(blocked.headers.get("set-cookie"), null);

    const wrongPassword = await signIn(h, "agent@supportpilot.com", "Wrong@1234");
    assert.equal(wrongPassword.status, 401);

    const allowed = await signIn(h, "admin@supportpilot.com");
    assert.equal(allowed.status, 200);
    assert.match(allowed.headers.get("set-cookie"), /^supportpilot_access=/);
  });
});

test("maintenance mode follows saved settings immediately", async (context) => {
  // Default provider TTL (10s): only the invalidate-on-save wiring can make this immediate
  const adminModel = createAdminModel();
  const server = await startTestServer({ adminModel });
  context.after(() => server.close());
  const base = server.baseUrl;

  assert.equal((await fetch(`${base}/api/customer/me`)).status, 401);

  const on = await fetch(
    `${base}/api/admin/settings`,
    json("PUT", { infrastructure: { maintenanceMode: true } }, adminToken),
  );
  assert.equal(on.status, 200);
  assert.equal((await fetch(`${base}/api/customer/me`)).status, 503);

  const off = await fetch(
    `${base}/api/admin/settings`,
    json("PUT", { infrastructure: { maintenanceMode: false } }, adminToken),
  );
  assert.equal(off.status, 200);
  assert.equal((await fetch(`${base}/api/customer/me`)).status, 401);
});

test("maintenance fails open when settings cannot be loaded", async (context) => {
  const h = await buildHarness(context);
  h.adminModel.state.fail = true;

  assert.equal((await fetch(h.url("/api/customer/me"))).status, 401);
  const platform = await (await fetch(h.url("/api/public/platform"))).json();
  assert.equal(platform.data.maintenanceMode, false);
  assert.equal(platform.data.allowSelfRegistration, true);
});

test("GET /api/public/platform returns only the allowlisted fields", async (context) => {
  const h = await buildHarness(context, {
    stored: {
      general: { platformName: "Acme Desk", supportEmail: "private@acme.test", allowSelfRegistration: false },
      security: { minPasswordLength: 10 },
      email: { smtpHost: "smtp.private.test" },
    },
  });
  const response = await fetch(h.url("/api/public/platform"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(Object.keys(body.data).sort(), [
    "allowSelfRegistration",
    "maintenanceMode",
    "passwordPolicy",
    "platformName",
    "platformNotice",
  ]);
  assert.equal(body.data.platformName, "Acme Desk");
  assert.equal(body.data.passwordPolicy.minPasswordLength, 10);
  assert.doesNotMatch(JSON.stringify(body), /private|smtp/);
});

test("self-registration switch", async (context) => {
  const closed = await buildHarness(context, { stored: { general: { allowSelfRegistration: false } } });

  await context.test("closed: company and customer registration return 403 before any write", async () => {
    const company = await fetch(closed.url("/api/auth/company/register"), json("POST", companyBody));
    assert.equal(company.status, 403);
    assert.equal((await company.json()).code, "REGISTRATION_DISABLED");

    const customer = await fetch(closed.url("/api/auth/customer/register"), json("POST", customerBody));
    assert.equal(customer.status, 403);
    assert.equal((await customer.json()).code, "REGISTRATION_DISABLED");

    assert.equal(closed.calls.createRegistration.length, 0);
    assert.equal(closed.calls.createCustomer.length, 0);
  });

  await context.test("closed: an invalid body still fails validation first", async () => {
    const response = await fetch(
      closed.url("/api/auth/company/register"),
      json("POST", { ...companyBody, password: "weak" }),
    );
    assert.equal(response.status, 422);
  });

  await context.test("open: registration succeeds", async () => {
    const open = await buildHarness(context);
    const company = await fetch(open.url("/api/auth/company/register"), json("POST", companyBody));
    assert.equal(company.status, 201);
    const customer = await fetch(open.url("/api/auth/customer/register"), json("POST", customerBody));
    assert.equal(customer.status, 201);
  });
});

test("default company status", async (context) => {
  await context.test("stored Pending is passed to createRegistration", async () => {
    const h = await buildHarness(context, { stored: { general: { defaultCompanyStatus: "Pending" } } });
    assert.equal((await fetch(h.url("/api/auth/company/register"), json("POST", companyBody))).status, 201);
    assert.equal(h.calls.createRegistration[0].companyStatus, "Pending");
  });

  await context.test("no stored row: env COMPANY_REGISTRATION_STATUS applies, then Active", async () => {
    process.env.COMPANY_REGISTRATION_STATUS = "Pending";
    try {
      const h = await buildHarness(context);
      await fetch(h.url("/api/auth/company/register"), json("POST", companyBody));
      assert.equal(h.calls.createRegistration[0].companyStatus, "Pending");
    } finally {
      delete process.env.COMPANY_REGISTRATION_STATUS;
    }

    const h = await buildHarness(context);
    await fetch(h.url("/api/auth/company/register"), json("POST", companyBody));
    assert.equal(h.calls.createRegistration[0].companyStatus, "Active");
  });

  await context.test("an injected initialCompanyStatus still wins", async () => {
    const h = await buildHarness(context, {
      stored: { general: { defaultCompanyStatus: "Pending" } },
      extra: { initialCompanyStatus: "Active" },
    });
    await fetch(h.url("/api/auth/company/register"), json("POST", companyBody));
    assert.equal(h.calls.createRegistration[0].companyStatus, "Active");
  });
});

test("JWT expiry and cookie flags", async (context) => {
  await context.test("stored expiry and cookie flags are applied", async () => {
    const h = await buildHarness(context, {
      stored: { security: { jwtExpiresIn: "15m", cookieSameSite: "strict", cookieSecure: true } },
    });
    const response = await signIn(h, "agent@supportpilot.com");
    assert.equal(response.status, 200);

    const { data } = await response.json();
    const decoded = jwt.decode(data.token);
    assert.equal(decoded.exp - decoded.iat, 900);

    const cookie = response.headers.get("set-cookie");
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /Max-Age=900/);
    assert.match(cookie, /HttpOnly/i);

    const out = await fetch(h.url("/api/auth/sign-out"), { method: "POST" });
    const cleared = out.headers.get("set-cookie");
    assert.match(cleared, /SameSite=Strict/i);
    assert.match(cleared, /Secure/i);
    assert.match(cleared, /Expires=Thu, 01 Jan 1970/);
  });

  await context.test("invalid stored values fall back to the env configuration", async () => {
    const h = await buildHarness(context, {
      stored: { security: { jwtExpiresIn: "0s" } },
    });
    const response = await signIn(h, "agent@supportpilot.com");
    const decoded = jwt.decode((await response.json()).data.token);
    assert.equal(decoded.exp - decoded.iat, 3600);
    assert.match(response.headers.get("set-cookie"), /SameSite=Lax/i);
  });

  await context.test("registration tokens use the stored expiry too", async () => {
    const h = await buildHarness(context, { stored: { security: { jwtExpiresIn: "30m" } } });
    const response = await fetch(h.url("/api/auth/customer/register"), json("POST", customerBody));
    const decoded = jwt.decode((await response.json()).data.token);
    assert.equal(decoded.exp - decoded.iat, 1800);
  });
});

test("password policy", async (context) => {
  const registerCompany = (h, password) =>
    fetch(h.url("/api/auth/company/register"), json("POST", { ...companyBody, password }));
  const registerCustomer = (h, password) =>
    fetch(h.url("/api/auth/customer/register"), json("POST", { ...customerBody, password }));

  await context.test("default settings behave exactly like before", async () => {
    const h = await buildHarness(context);
    assert.equal((await registerCompany(h, "Abcdefg1")).status, 422);
    assert.equal((await registerCustomer(h, "Abcdefg1")).status, 422);
    const response = await registerCompany(h, "Abcdefg1!");
    assert.equal(response.status, 201);

    const rejected = await registerCustomer(h, "short");
    const body = await rejected.json();
    assert.equal(body.errors[0].field, "password");
    assert.equal(
      body.errors[0].message,
      "Password must be 8 to 128 characters and include uppercase, lowercase, number, and special character",
    );
  });

  await context.test("minPasswordLength 12 rejects a 10-char password with a policy message", async () => {
    const h = await buildHarness(context, { stored: { security: { minPasswordLength: 12 } } });
    const response = await registerCompany(h, "Abcdefg1!x");
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.match(body.errors[0].message, /12 to 128 characters/);
    assert.equal((await registerCustomer(h, "Abcdefg1!x")).status, 422);
    assert.equal((await registerCompany(h, "Abcdefg1!xyz")).status, 201);
  });

  await context.test("requireSpecialChar false accepts Abcdefg1 and updates the message", async () => {
    const h = await buildHarness(context, { stored: { security: { requireSpecialChar: false } } });
    assert.equal((await registerCompany(h, "Abcdefg1")).status, 201);
    const weak = await registerCustomer(h, "abcdefg1");
    assert.doesNotMatch((await weak.json()).errors[0].message, /special/);
  });

  await context.test("a loosened 6-char password registers and can sign in", async () => {
    const h = await buildHarness(context, {
      stored: { security: { minPasswordLength: 6, requireSpecialChar: false } },
    });
    assert.equal((await registerCustomer(h, "Abcde1")).status, 201);

    const response = await signIn(h, customerBody.email, "Abcde1");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.user.roleName, "Customer");
  });

  await context.test("reset-password uses the stored policy", async () => {
    const h = await buildHarness(context, { stored: { security: { minPasswordLength: 12 } } });
    const forgot = await fetch(h.url("/api/auth/forgot-password"), json("POST", { email: "agent@supportpilot.com" }));
    const { resetToken } = await forgot.json();
    assert.ok(resetToken);

    const tooShort = await fetch(
      h.url("/api/auth/reset-password"),
      json("POST", { token: resetToken, password: "Abcdefg1!x" }),
    );
    assert.equal(tooShort.status, 422);

    const ok = await fetch(
      h.url("/api/auth/reset-password"),
      json("POST", { token: resetToken, password: "Abcdefg1!xyz" }),
    );
    assert.equal(ok.status, 200);
  });

  await context.test("sign-in no longer rejects weak passwords at the validator", async () => {
    const h = await buildHarness(context);
    const response = await signIn(h, "agent@supportpilot.com", "short");
    assert.equal(response.status, 401);
  });
});

test("SMTP settings reach the mailers", async (context) => {
  const stored = {
    email: {
      smtpHost: "smtp.example.test",
      smtpPort: 2525,
      smtpUser: "mailer@example.test",
      senderName: "Acme Mailer",
      requireTls: false,
    },
  };

  await context.test("forgot-password passes the stored settings without any password", async () => {
    const h = await buildHarness(context, { stored });
    const response = await fetch(h.url("/api/auth/forgot-password"), json("POST", { email: "agent@supportpilot.com" }));
    assert.equal(response.status, 200);

    assert.equal(h.calls.resetMail.length, 1);
    assert.deepEqual(h.calls.resetMail[0].smtp, {
      host: "smtp.example.test",
      port: 2525,
      user: "mailer@example.test",
      senderName: "Acme Mailer",
      requireTls: false,
    });
    assert.doesNotMatch(JSON.stringify(h.calls.resetMail[0].smtp), /pass/i);
  });

  await context.test("the admin test email passes stored host and port to sendMail", async () => {
    const h = await buildHarness(context, { stored });
    const response = await fetch(
      h.url("/api/admin/settings/test-email"),
      json("POST", { email: "owner@example.test" }, adminToken),
    );
    assert.equal(response.status, 200);
    assert.equal(h.calls.sendMail[0].smtp.host, "smtp.example.test");
    assert.equal(h.calls.sendMail[0].smtp.port, 2525);
    assert.equal(h.calls.sendMail[0].smtp.senderName, "Acme Mailer");
  });
});

test("saving SameSite=None without Secure is rejected", async (context) => {
  const h = await buildHarness(context);
  const response = await fetch(
    h.url("/api/admin/settings"),
    json("PUT", { security: { cookieSameSite: "none", cookieSecure: false } }, adminToken),
  );
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.equal(body.errors[0].field, "security.cookieSecure");
  assert.equal(h.adminModel.state.saves.length, 0);
});

function googlePassport(user) {
  return {
    initialize: () => (_req, _res, next) => next(),
    authenticate: (_strategy, _options, callback) => (req, res, next) =>
      typeof callback === "function" ? callback(null, user) : next(),
  };
}

test("Google callback uses stored token and cookie settings", async (context) => {
  const googleUser = {
    userId: 101,
    googleId: "g-1",
    email: "sarah@company.test",
    roleName: "Support Agent",
    onlineStatus: "Offline",
  };

  await context.test("applies expiry and cookie flags", async () => {
    const h = await buildHarness(context, {
      stored: { security: { jwtExpiresIn: "20m", cookieSameSite: "strict" } },
      extra: { passport: googlePassport(googleUser), isGoogleConfigured: () => true },
    });
    const response = await fetch(h.url("/api/auth/google/callback?code=x"), { redirect: "manual" });
    assert.equal(response.status, 302);
    const cookie = response.headers.get("set-cookie");
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Max-Age=1200/);
    const token = /supportpilot_access=([^;]+)/.exec(cookie)[1];
    const decoded = jwt.decode(token);
    assert.equal(decoded.exp - decoded.iat, 1200);
  });

  await context.test("redirects non-admins to login during maintenance without a cookie", async () => {
    const h = await buildHarness(context, {
      stored: { infrastructure: { maintenanceMode: true } },
      extra: { passport: googlePassport(googleUser), isGoogleConfigured: () => true },
    });
    const response = await fetch(h.url("/api/auth/google/callback?code=x"), { redirect: "manual" });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "http://localhost:5173/login?error=maintenance");
    assert.equal(response.headers.get("set-cookie"), null);
  });
});
