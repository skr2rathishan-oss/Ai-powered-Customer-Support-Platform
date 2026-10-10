process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { createAccessToken } = require("../../src/utils/token");
const { getAuthConfig } = require("../../src/config/auth");

const { createAdminService } = require("../../src/services/adminService");

async function startTestServer(dependencies = {}) {
  const app = createApp(dependencies);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function createMockModel({ stored = null, failGet = false, failSave = false } = {}) {
  const state = { stored, saves: [] };
  return {
    state,
    getPlatformSettings: async () => {
      if (failGet) throw new Error("db down");
      return state.stored;
    },
    savePlatformSettings: async (settings, updatedBy) => {
      if (failSave) throw new Error("db down");
      state.saves.push({ settings, updatedBy });
      state.stored = JSON.parse(JSON.stringify(settings));
    },
  };
}

test("Platform Admin Settings & Diagnostics API Tests", async (context) => {
  let sentMails = [];
  const mockSendMail = async (options) => {
    sentMails.push(options);
    return { messageId: "mock-message-id-123" };
  };

  const adminModel = createMockModel();
  const adminService = createAdminService({ adminModel, sendMail: mockSendMail });

  const server = await startTestServer({ adminService });
  context.after(() => server.close());

  const { cookieName } = getAuthConfig();

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

  const putSettings = (payload, token = adminToken, url = server.baseUrl) =>
    fetch(`${url}/api/admin/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

  const getSettings = (url = server.baseUrl) =>
    fetch(`${url}/api/admin/settings`, {
      headers: { cookie: `${cookieName}=${adminToken}` },
    });

  await context.test("GET /api/admin/settings returns defaults when nothing is stored", async () => {
    const response = await getSettings();
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.general.platformName, "SupportPilot Enterprise");
    assert.ok(body.data.security);
    assert.ok(body.data.email);
    assert.ok(body.data.aiEngine);
    assert.ok(body.data.infrastructure);
    assert.ok(body.data.timestamp);
  });

  await context.test("GET merges stored values over defaults and drops unknown or secret keys", async () => {
    const model = createMockModel({
      stored: {
        general: { platformName: "Stored Name", bogus: 1 },
        email: { smtpHost: "smtp.stored.test", smtpPassword: "hunter2", status: "Hacked" },
        aiEngine: { temperature: 99 },
        rogue: { a: 1 },
      },
    });
    const isolated = await startTestServer({
      adminService: createAdminService({ adminModel: model, sendMail: mockSendMail }),
    });

    try {
      const response = await getSettings(isolated.baseUrl);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.data.general.platformName, "Stored Name");
      assert.equal(body.data.general.bogus, undefined);
      assert.equal(body.data.email.smtpHost, "smtp.stored.test");
      assert.equal(body.data.email.status, "Operational");
      assert.equal(body.data.aiEngine.temperature, 0.2);
      assert.equal(body.data.rogue, undefined);
      assert.ok(!JSON.stringify(body).includes("hunter2"));
    } finally {
      await isolated.close();
    }
  });

  await context.test("PUT persists settings and a fresh service sees them", async () => {
    const response = await putSettings({
      general: { platformName: "SupportPilot Global" },
      aiEngine: { temperature: 0.3 },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.settings.general.platformName, "SupportPilot Global");
    assert.equal(body.settings.aiEngine.temperature, 0.3);
    assert.equal(adminModel.state.saves.length, 1);
    assert.equal(adminModel.state.saves[0].updatedBy, 1);

    const fresh = createAdminService({ adminModel, sendMail: mockSendMail });
    const reloaded = await fresh.getPlatformSettings();
    assert.equal(reloaded.general.platformName, "SupportPilot Global");
    assert.equal(reloaded.aiEngine.temperature, 0.3);
  });

  await context.test("PUT partial update keeps other sections intact", async () => {
    const response = await putSettings({ security: { minPasswordLength: 12 } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.settings.security.minPasswordLength, 12);
    assert.equal(body.settings.general.platformName, "SupportPilot Global");
    assert.equal(body.settings.aiEngine.temperature, 0.3);
  });

  await context.test("PUT ignores echoed read-only values and the GET timestamp", async () => {
    const current = await (await getSettings()).json();
    const savesBefore = adminModel.state.saves.length;
    const response = await putSettings(current.data);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(adminModel.state.saves.length, savesBefore + 1);
    assert.equal(body.settings.timestamp, undefined);
    assert.equal(body.settings.email.status, "Operational");
  });

  await context.test("PUT rejects invalid payloads with 422 and saves nothing", async () => {
    const savesBefore = adminModel.state.saves.length;
    const invalidPayloads = [
      ["array body", []],
      ["unknown section", { bogus: { a: 1 } }],
      ["unknown key", { general: { nope: true } }],
      ["secret-like key", { email: { smtpPassword: "hunter2" } }],
      ["bad type", { general: { allowSelfRegistration: "yes" } }],
      ["empty name", { general: { platformName: "" } }],
      ["long notice", { general: { platformNotice: "x".repeat(501) } }],
      ["bad email", { general: { supportEmail: "not-an-email" } }],
      ["bad jwt expiry", { security: { jwtExpiresIn: "forever" } }],
      ["short password length", { security: { minPasswordLength: 3 } }],
      ["bad same-site", { security: { cookieSameSite: "weird" } }],
      ["port out of range", { email: { smtpPort: 70000 } }],
      ["temperature too high", { aiEngine: { temperature: 5 } }],
      ["unavailable model", { aiEngine: { defaultModel: "gpt-99" } }],
      ["negative quota", { aiEngine: { tokenQuotaPerTenantMonth: -1 } }],
      ["changed read-only", { email: { status: "Down" } }],
      ["changed read-only list", { aiEngine: { availableModels: ["x"] } }],
      ["section not object", { general: "x" }],
    ];

    for (const [label, payload] of invalidPayloads) {
      const response = await putSettings(payload);
      const body = await response.json();
      assert.equal(response.status, 422, label);
      assert.equal(body.code, "INVALID_SETTINGS", label);
    }

    assert.equal(adminModel.state.saves.length, savesBefore);
  });

  await context.test("responses never leak secrets", async () => {
    const response = await getSettings();
    const text = JSON.stringify(await response.json());

    assert.ok(!/password"|secret|apiKey|token"/i.test(text.replace(/minPasswordLength/g, "")));
  });

  await context.test("model failure falls back on GET and returns 500 on PUT", async () => {
    const failing = await startTestServer({
      adminService: createAdminService({
        adminModel: createMockModel({ failGet: true }),
        sendMail: mockSendMail,
      }),
    });
    const failingSave = await startTestServer({
      adminService: createAdminService({
        adminModel: createMockModel({ failSave: true }),
        sendMail: mockSendMail,
      }),
    });

    try {
      const getResponse = await getSettings(failing.baseUrl);
      const getBody = await getResponse.json();
      assert.equal(getResponse.status, 200);
      assert.equal(getBody.data.general.platformName, "SupportPilot Enterprise");

      const putResponse = await putSettings({ general: { platformName: "X" } }, adminToken, failing.baseUrl);
      assert.equal(putResponse.status, 500);

      const saveResponse = await putSettings({ general: { platformName: "X" } }, adminToken, failingSave.baseUrl);
      assert.equal(saveResponse.status, 500);
    } finally {
      await failing.close();
      await failingSave.close();
    }
  });

  await context.test("settings routes require authentication and Platform Admin role", async () => {
    const anonymous = await fetch(`${server.baseUrl}/api/admin/settings`);
    assert.equal(anonymous.status, 401);

    const forbidden = await putSettings({ general: { platformName: "X" } }, agentToken);
    assert.equal(forbidden.status, 403);
  });

  await context.test("POST /api/admin/settings/test-email uses stored host/port, escaped", async () => {
    adminModel.state.stored = {
      ...adminModel.state.stored,
      email: { smtpHost: "<b>mail.stored.test</b>", smtpPort: 2525 },
    };

    const response = await fetch(`${server.baseUrl}/api/admin/settings/test-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: "test-admin@supportpilot.com",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(sentMails.length, 1);
    assert.equal(sentMails[0].to, "test-admin@supportpilot.com");
    assert.ok(sentMails[0].html.includes("&lt;b&gt;mail.stored.test&lt;/b&gt;"));
    assert.ok(!sentMails[0].html.includes("<b>mail.stored.test"));
    assert.ok(sentMails[0].html.includes("2525"));
  });

  await context.test("GET /api/admin/diagnostics returns system metrics", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/diagnostics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.uptimeSeconds !== undefined);
    assert.ok(body.data.memoryUsage);
    assert.ok(body.data.databases);
  });
});
