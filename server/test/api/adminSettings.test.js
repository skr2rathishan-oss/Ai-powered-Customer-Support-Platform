process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { createAccessToken } = require("../../src/utils/token");
const { getAuthConfig } = require("../../src/config/auth");

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

test("Platform Admin Settings & Diagnostics API Tests", async (context) => {
  let sentMails = [];
  const mockSendMail = async (options) => {
    sentMails.push(options);
    return { messageId: "mock-message-id-123" };
  };

  const { createAdminService } = require("../../src/services/adminService");
  const adminService = createAdminService({ sendMail: mockSendMail });

  const server = await startTestServer({ adminService });
  context.after(() => server.close());

  const { cookieName } = getAuthConfig();

  const adminToken = createAccessToken({
    accountType: "individual",
    userId: 1,
    email: "admin@supportpilot.com",
    roleName: "Platform Admin",
  });

  await context.test("GET /api/admin/settings returns sanitized platform settings", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/settings`, {
      headers: { cookie: `${cookieName}=${adminToken}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.general);
    assert.ok(body.data.security);
    assert.ok(body.data.email);
    assert.ok(body.data.aiEngine);
    assert.ok(body.data.infrastructure);
  });

  await context.test("PUT /api/admin/settings updates settings patch", async () => {
    const response = await fetch(`${server.baseUrl}/api/admin/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        general: { platformName: "SupportPilot Global" },
        aiEngine: { temperature: 0.3 },
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.settings.general.platformName, "SupportPilot Global");
    assert.equal(body.settings.aiEngine.temperature, 0.3);
  });

  await context.test("POST /api/admin/settings/test-email dispatches diagnostic test email", async () => {
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
