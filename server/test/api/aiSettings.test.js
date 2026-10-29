process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { createAccessToken } = require("../../src/utils/token");
const { getAuthConfig } = require("../../src/config/auth");
const { DEFAULT_AI_SETTINGS } = require("../../src/constants/aiSettingsConstants");

async function startTestServer(dependencies = {}) {
  const app = createApp(dependencies);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const baseContext = {
  userId: 2,
  roleName: "Company Admin",
  userStatus: "Active",
  companyId: 7,
  companyStatus: "Active",
};

function companyToken(overrides = {}) {
  return createAccessToken({
    accountType: "company",
    userId: 2,
    companyId: 7,
    email: "owner@acme.test",
    roleName: "Company Admin",
    ...overrides,
  });
}

const globexRow = () => ({
  enabled: true,
  assistantName: "Globex Helper",
  tone: "concise",
  greeting: "g",
  answerFromFaqsOnly: true,
  confidenceThreshold: 80,
  escalateAfterFailures: 5,
  fallbackMessage: "f",
  customInstructions: "",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const validBody = (overrides = {}) => ({ ...DEFAULT_AI_SETTINGS, ...overrides });

test("company AI settings API", async (context) => {
  let rows;
  let calls;
  let contextImpl;

  const aiSettingsModel = {
    findAiSettings: async (companyId) => {
      calls.push(["find", companyId]);
      return rows.has(companyId) ? { ...rows.get(companyId) } : null;
    },
    upsertAiSettings: async (companyId, userId, settings) => {
      calls.push(["upsert", companyId, userId, settings]);
      const row = { ...settings, updatedAt: "2026-02-01T00:00:00.000Z" };
      rows.set(companyId, row);
      return { ...row };
    },
  };
  const companyPortalModel = { findCompanyAdminContext: async (id) => contextImpl(id) };

  const server = await startTestServer({ aiSettingsModel, companyPortalModel });
  context.after(() => server.close());

  const { cookieName } = getAuthConfig();
  const call = (method, path = "/api/company/ai-settings", { token = companyToken(), body } = {}) =>
    fetch(`${server.baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { cookie: `${cookieName}=${token}` } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  context.beforeEach(() => {
    rows = new Map([[8, globexRow()]]);
    calls = [];
    contextImpl = async () => ({ ...baseContext });
  });

  const routes = [
    ["GET", undefined],
    ["PUT", validBody()],
  ];

  await context.test("401 without credentials", async () => {
    for (const [method, body] of routes) {
      const response = await call(method, undefined, { token: null, body });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).code, "AUTHENTICATION_REQUIRED");
    }
    assert.equal(calls.length, 0);
  });

  await context.test("403 for Support Agent and Platform Admin tokens", async () => {
    const tokens = [
      createAccessToken({ accountType: "individual", userId: 1, email: "a@x.test", roleName: "Platform Admin" }),
      createAccessToken({ accountType: "individual", userId: 5, email: "b@x.test", roleName: "Support Agent" }),
    ];
    for (const token of tokens) {
      for (const [method, body] of routes) {
        const response = await call(method, undefined, { token, body });
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, "ROLE_FORBIDDEN");
      }
    }
    assert.equal(calls.length, 0);
  });

  await context.test("403 when the DB role differs, user or company inactive", async () => {
    const cases = [
      [{ roleName: "Support Agent" }, "ROLE_FORBIDDEN"],
      [{ userStatus: "Inactive" }, "ACCOUNT_INACTIVE"],
      [{ companyStatus: "Suspended" }, "COMPANY_INACTIVE"],
    ];
    for (const [override, code] of cases) {
      contextImpl = async () => ({ ...baseContext, ...override });
      for (const [method, body] of routes) {
        const response = await call(method, undefined, { body });
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, code);
      }
    }
    contextImpl = async () => null;
    assert.equal((await call("GET")).status, 403);
    assert.equal(calls.length, 0);
  });

  await context.test("GET without a row returns defaults and writes nothing", async () => {
    const response = await call("GET");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.success, true);
    assert.equal(body.data.configured, false);
    assert.equal(body.data.updatedAt, null);
    assert.deepEqual(body.data.settings, DEFAULT_AI_SETTINGS);
    assert.deepEqual(body.data.defaults, DEFAULT_AI_SETTINGS);
    assert.equal(body.data.settings.enabled, false);
    assert.ok(!calls.some((c) => c[0] === "upsert"));
  });

  await context.test("GET with a row returns stored values without internals", async () => {
    rows.set(7, { ...globexRow(), assistantName: "Acme Bot" });
    const body = await (await call("GET")).json();
    assert.equal(body.data.configured, true);
    assert.equal(body.data.settings.assistantName, "Acme Bot");
    assert.equal(body.data.updatedAt, "2026-01-01T00:00:00.000Z");
    assert.ok(!("updatedAt" in body.data.settings));
    assert.ok(!/companyId|updatedBy/.test(JSON.stringify(body)));
  });

  await context.test("tenancy: company comes from the DB only", async () => {
    const token = companyToken({ companyId: "999" });
    const response = await call("PUT", "/api/company/ai-settings?companyId=8", {
      token,
      body: validBody({ assistantName: "Acme Bot", companyId: 8 }),
    });
    assert.equal(response.status, 200);
    await call("GET", "/api/company/ai-settings?companyId=8", { token });
    for (const entry of calls) assert.equal(entry[1], 7);
    assert.equal(rows.get(8).assistantName, "Globex Helper");
    assert.equal(rows.get(7).assistantName, "Acme Bot");
  });

  await context.test("GET never returns another company's row", async () => {
    const body = await (await call("GET")).json();
    assert.notEqual(body.data.settings.assistantName, "Globex Helper");
  });

  await context.test("PUT creates then updates idempotently, trimming strings", async () => {
    const payload = validBody({ assistantName: "  Acme Bot  ", greeting: "", fallbackMessage: "", customInstructions: "" });
    const first = await call("PUT", undefined, { body: payload });
    const firstBody = await first.json();
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("cache-control"), "no-store");
    assert.equal(firstBody.data.configured, true);
    assert.equal(firstBody.data.settings.assistantName, "Acme Bot");
    assert.equal(firstBody.data.settings.greeting, "");

    const second = await call("PUT", undefined, { body: payload });
    const secondBody = await second.json();
    assert.equal(second.status, 200);
    assert.deepEqual(secondBody.data.settings, firstBody.data.settings);
    const upserts = calls.filter((c) => c[0] === "upsert");
    assert.equal(upserts.length, 2);
    assert.equal(upserts[0][2], 2);
  });

  await context.test("unknown keys are not stored or echoed", async () => {
    const response = await call("PUT", undefined, {
      body: validBody({ apiKey: "sk-secret", model: "gpt-x", companyId: 8, updatedBy: 99 }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    const stored = calls.find((c) => c[0] === "upsert")[3];
    assert.deepEqual(Object.keys(stored).sort(), Object.keys(DEFAULT_AI_SETTINGS).sort());
    assert.ok(!/apiKey|sk-secret|gpt-x|updatedBy/.test(JSON.stringify(body)));
  });

  await context.test("PUT accepts multi-line instructions", async () => {
    const response = await call("PUT", undefined, { body: validBody({ customInstructions: "Be kind.\nBe brief." }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.settings.customInstructions, "Be kind.\nBe brief.");
  });

  await context.test("PUT 422 with field errors and no model call", async () => {
    const cases = [
      [[], "body"],
      [{ ...validBody(), assistantName: undefined }, "assistantName"],
      [validBody({ assistantName: "" }), "assistantName"],
      [validBody({ assistantName: "a".repeat(41) }), "assistantName"],
      [validBody({ assistantName: "a\u0001b" }), "assistantName"],
      [validBody({ tone: "rude" }), "tone"],
      [validBody({ greeting: "a".repeat(301) }), "greeting"],
      [validBody({ fallbackMessage: "a".repeat(301) }), "fallbackMessage"],
      [validBody({ customInstructions: "a".repeat(1001) }), "customInstructions"],
      [validBody({ enabled: "true" }), "enabled"],
      [validBody({ confidenceThreshold: 101 }), "confidenceThreshold"],
      [validBody({ confidenceThreshold: -1 }), "confidenceThreshold"],
      [validBody({ confidenceThreshold: 70.5 }), "confidenceThreshold"],
      [validBody({ confidenceThreshold: "70" }), "confidenceThreshold"],
      [validBody({ escalateAfterFailures: 0 }), "escalateAfterFailures"],
      [validBody({ escalateAfterFailures: 11 }), "escalateAfterFailures"],
      [validBody({ escalateAfterFailures: 2.5 }), "escalateAfterFailures"],
    ];
    for (const [body, field] of cases) {
      const response = await fetch(`${server.baseUrl}/api/company/ai-settings`, {
        method: "PUT",
        headers: { cookie: `${cookieName}=${companyToken()}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      assert.equal(response.status, 422, field);
      assert.equal(json.code, "VALIDATION_ERROR");
      assert.ok(json.errors.some((e) => e.field === field), field);
    }
    assert.ok(!calls.some((c) => c[0] === "upsert"));
  });

  await context.test("no PATCH or DELETE", async () => {
    assert.equal((await call("PATCH", undefined, { body: {} })).status, 404);
    assert.equal((await call("DELETE")).status, 404);
  });
});
