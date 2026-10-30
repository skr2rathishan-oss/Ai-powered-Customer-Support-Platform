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

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const baseContext = {
  userId: 2,
  firstName: "Ada",
  lastName: "Owner",
  email: "owner@acme.test",
  onlineStatus: "Online",
  userStatus: "Active",
  roleName: "Company Admin",
  companyId: 7,
  companyName: "Acme",
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

function seedFaqs() {
  const faq = (faqId, companyId, question, extra = {}) => ({
    faqId,
    companyId,
    question,
    answer: `Answer for ${question}`,
    category: null,
    isPublished: false,
    sortOrder: faqId * 10,
    createdBy: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  });

  return [
    faq(1, 7, "How do I reset my password?", { category: "Account", isPublished: true }),
    faq(2, 7, "What are your support hours?", { category: "General", isPublished: true }),
    faq(3, 7, "How do I request a refund?", { category: "Billing" }),
    faq(4, 7, "Do you give 100% uptime_guarantees?", { answer: "Never promise 100%" }),
    faq(9, 8, "Other company secret question", { isPublished: true, category: "Secret" }),
  ];
}

test("company FAQs API", async (context) => {
  let faqs;
  let calls;
  let contextImpl;
  let nextFaqId;

  const present = (row) => {
    const { companyId, createdBy, ...rest } = row;
    return rest;
  };
  const own = (companyId) => faqs.filter((f) => f.companyId === companyId);

  const faqModel = {
    listFaqs: async (companyId, filters = {}) => {
      calls.push(["listFaqs", companyId, filters]);
      const search = filters.search ? filters.search.toLowerCase() : null;
      return own(companyId)
        .filter((f) => !filters.status || f.isPublished === (filters.status === "published"))
        .filter((f) => !filters.category || f.category === filters.category)
        .filter(
          (f) =>
            !search ||
            [f.question, f.answer, f.category || ""].some((t) => t.toLowerCase().includes(search)),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder || a.faqId - b.faqId)
        .map(present);
    },
    listFaqMeta: async (companyId) => {
      calls.push(["listFaqMeta", companyId]);
      const rows = own(companyId);
      return {
        categories: [...new Set(rows.map((f) => f.category).filter(Boolean))].sort(),
        total: rows.length,
        published: rows.filter((f) => f.isPublished).length,
      };
    },
    countFaqs: async (companyId) => {
      calls.push(["countFaqs", companyId]);
      return countOverride ?? own(companyId).length;
    },
    createFaq: async (companyId, userId, data) => {
      calls.push(["createFaq", companyId, userId, data]);
      const row = {
        faqId: nextFaqId++,
        companyId,
        question: data.question,
        answer: data.answer,
        category: data.category,
        isPublished: data.isPublished,
        sortOrder: data.sortOrder ?? own(companyId).reduce((m, f) => Math.max(m, f.sortOrder), 0) + 10,
        createdBy: userId,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      };
      faqs.push(row);
      return present(row);
    },
    updateFaq: async (companyId, faqId, changes) => {
      calls.push(["updateFaq", companyId, faqId, changes]);
      const row = own(companyId).find((f) => f.faqId === faqId);
      if (!row) return null;
      Object.assign(row, changes);
      return present(row);
    },
    deleteFaq: async (companyId, faqId) => {
      calls.push(["deleteFaq", companyId, faqId]);
      const index = faqs.findIndex((f) => f.companyId === companyId && f.faqId === faqId);
      if (index === -1) return false;
      faqs.splice(index, 1);
      return true;
    },
  };
  let countOverride;

  const companyPortalModel = {
    findCompanyAdminContext: async (userId) => contextImpl(userId),
  };

  const server = await startTestServer({ faqModel, companyPortalModel });
  context.after(() => server.close());

  const { cookieName } = getAuthConfig();
  const call = (method, path, { token = companyToken(), body } = {}) =>
    fetch(`${server.baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { cookie: `${cookieName}=${token}` } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  context.beforeEach(() => {
    faqs = seedFaqs();
    calls = [];
    nextFaqId = 100;
    countOverride = undefined;
    contextImpl = async () => ({ ...baseContext });
  });

  const routes = [
    ["GET", "/api/company/faqs", undefined],
    ["POST", "/api/company/faqs", { question: "A valid question?", answer: "Yes" }],
    ["PATCH", "/api/company/faqs/1", { isPublished: false }],
    ["DELETE", "/api/company/faqs/1", undefined],
  ];

  await context.test("401 without credentials on every route", async () => {
    for (const [method, path, body] of routes) {
      const response = await call(method, path, { token: null, body });
      assert.equal(response.status, 401, `${method} ${path}`);
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
      for (const [method, path, body] of routes) {
        const response = await call(method, path, { token, body });
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.equal((await response.json()).code, "ROLE_FORBIDDEN");
      }
    }
    assert.equal(calls.length, 0);
  });

  const guardCases = [
    ["COMPANY_ACCESS_DENIED", async () => null],
    ["COMPANY_INACTIVE", async () => ({ ...baseContext, companyStatus: "Suspended" })],
    ["ACCOUNT_INACTIVE", async () => ({ ...baseContext, userStatus: "Suspended" })],
    ["ROLE_FORBIDDEN", async () => ({ ...baseContext, roleName: "Support Agent" })],
  ];
  for (const [code, impl] of guardCases) {
    await context.test(`403 ${code} stops every route before the model`, async () => {
      contextImpl = impl;
      for (const [method, path, body] of routes) {
        const response = await call(method, path, { body });
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.equal((await response.json()).code, code);
      }
      assert.equal(calls.length, 0);
    });
  }

  await context.test("list returns only own-company FAQs with stable summary", async () => {
    const response = await call("GET", "/api/company/faqs?companyId=8", {
      token: companyToken({ companyId: 999 }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();

    assert.equal(calls[0][1], 7);
    assert.deepEqual(body.data.faqs.map((f) => f.faqId), [1, 2, 3, 4]);
    assert.deepEqual(body.data.categories, ["Account", "Billing", "General"]);
    assert.deepEqual(body.data.summary, { total: 4, published: 2, draft: 2 });
    assert.ok(!/companyId|createdBy|Secret/.test(JSON.stringify(body)));
  });

  await context.test("filters narrow the list but not the summary", async () => {
    const draft = await (await call("GET", "/api/company/faqs?status=draft")).json();
    assert.deepEqual(draft.data.faqs.map((f) => f.faqId), [3, 4]);
    assert.deepEqual(draft.data.summary, { total: 4, published: 2, draft: 2 });

    const published = await (await call("GET", "/api/company/faqs?status=published")).json();
    assert.deepEqual(published.data.faqs.map((f) => f.faqId), [1, 2]);

    const billing = await (await call("GET", "/api/company/faqs?category=Billing")).json();
    assert.deepEqual(billing.data.faqs.map((f) => f.faqId), [3]);

    const search = await (await call("GET", "/api/company/faqs?search=%20REFUND%20")).json();
    assert.deepEqual(search.data.faqs.map((f) => f.faqId), [3]);
    assert.equal(calls.at(-2)[2].search, "REFUND");
  });

  await context.test("invalid list filters give 422", async () => {
    for (const query of [
      "status=bogus",
      "search=" + "a".repeat(101),
      "category=" + "a".repeat(61),
      "status=draft&status=published",
    ]) {
      const response = await call("GET", `/api/company/faqs?${query}`);
      assert.equal(response.status, 422, query);
      assert.equal((await response.json()).code, "VALIDATION_ERROR");
    }
    assert.equal(calls.length, 0);
  });

  await context.test("create trims fields, defaults to draft and ignores injected ids", async () => {
    const response = await call("POST", "/api/company/faqs", {
      body: {
        question: "  Where is my invoice?  ",
        answer: "  Under Billing.\nSecond line.  ",
        category: "",
        companyId: 8,
        faqId: 1,
        createdBy: 99,
      },
    });
    assert.equal(response.status, 201);
    const body = await response.json();

    assert.equal(body.data.faq.question, "Where is my invoice?");
    assert.equal(body.data.faq.answer, "Under Billing.\nSecond line.");
    assert.equal(body.data.faq.category, null);
    assert.equal(body.data.faq.isPublished, false);
    assert.equal(body.data.faq.sortOrder, 50);
    assert.ok(!("companyId" in body.data.faq) && !("createdBy" in body.data.faq));

    const call2 = calls.find((c) => c[0] === "createFaq");
    assert.equal(call2[1], 7);
    assert.equal(call2[2], 2);
    assert.ok(faqs.find((f) => f.faqId === 100 && f.companyId === 7));
    assert.equal(faqs.find((f) => f.faqId === 1).companyId, 7);
  });

  await context.test("create accepts publish flag, category and display order", async () => {
    const response = await call("POST", "/api/company/faqs", {
      body: { question: "Is it live now?", answer: "Yes", category: " Ops ", isPublished: true, sortOrder: 5 },
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.data.faq.category, "Ops");
    assert.equal(body.data.faq.isPublished, true);
    assert.equal(body.data.faq.sortOrder, 5);
  });

  await context.test("create validation failures give 422 with field errors", async () => {
    const valid = { question: "A valid question?", answer: "An answer" };
    const cases = [
      [{ answer: "x" }, "question"],
      [{ ...valid, question: "Hi?" }, "question"],
      [{ ...valid, question: "q".repeat(301) }, "question"],
      [{ ...valid, question: "Bad\u0001question" }, "question"],
      [{ question: valid.question }, "answer"],
      [{ ...valid, answer: "a".repeat(4001) }, "answer"],
      [{ ...valid, category: "c".repeat(61) }, "category"],
      [{ ...valid, isPublished: "true" }, "isPublished"],
      [{ ...valid, isPublished: 1 }, "isPublished"],
      [{ ...valid, sortOrder: 1.5 }, "sortOrder"],
      [{ ...valid, sortOrder: -1 }, "sortOrder"],
      [{ ...valid, sortOrder: 10000 }, "sortOrder"],
      [[], "body"],
    ];
    for (const [body, field] of cases) {
      const response = await call("POST", "/api/company/faqs", { body });
      assert.equal(response.status, 422, JSON.stringify(body));
      const json = await response.json();
      assert.equal(json.code, "VALIDATION_ERROR");
      assert.ok(json.errors.some((e) => e.field === field), JSON.stringify(json.errors));
    }
    assert.ok(!calls.some((c) => c[0] === "createFaq"));
  });

  await context.test("create answers may contain newlines and tabs", async () => {
    const response = await call("POST", "/api/company/faqs", {
      body: { question: "Multi line answer?", answer: "Line one\n\tLine two\r\nLine three" },
    });
    assert.equal(response.status, 201);
  });

  await context.test("create returns 409 FAQ_LIMIT_REACHED at 500 FAQs", async () => {
    countOverride = 500;
    const response = await call("POST", "/api/company/faqs", {
      body: { question: "One too many?", answer: "Yes" },
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "FAQ_LIMIT_REACHED");
    assert.ok(!calls.some((c) => c[0] === "createFaq"));
  });

  await context.test("update changes only the given keys", async () => {
    const response = await call("PATCH", "/api/company/faqs/3", { body: { isPublished: true } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.faq.isPublished, true);
    assert.equal(body.data.faq.question, "How do I request a refund?");
    assert.equal(body.data.faq.category, "Billing");
    assert.deepEqual(calls.at(-1), ["updateFaq", 7, 3, { isPublished: true }]);

    const again = await call("PATCH", "/api/company/faqs/3", { body: { isPublished: true } });
    assert.equal(again.status, 200);
  });

  await context.test("update can edit text and clear the category", async () => {
    const response = await call("PATCH", "/api/company/faqs/1", {
      body: { answer: " New answer ", category: null, sortOrder: 0 },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.faq.answer, "New answer");
    assert.equal(body.data.faq.category, null);
    assert.equal(body.data.faq.sortOrder, 0);

    const cleared = await call("PATCH", "/api/company/faqs/2", { body: { category: "" } });
    assert.equal((await cleared.json()).data.faq.category, null);
  });

  await context.test("update rejects empty or invalid bodies with 422", async () => {
    const empty = await call("PATCH", "/api/company/faqs/1", { body: { companyId: 8 } });
    assert.equal(empty.status, 422);
    const json = await empty.json();
    assert.deepEqual(json.errors, [{ field: "body", message: "Provide at least one field to update" }]);

    const bad = await call("PATCH", "/api/company/faqs/1", { body: { question: "no" } });
    assert.equal(bad.status, 422);
    assert.ok(!calls.some((c) => c[0] === "updateFaq"));
  });

  await context.test("update of another company's FAQ is 404 and leaves it unchanged", async () => {
    const response = await call("PATCH", "/api/company/faqs/9", {
      body: { question: "Hijacked question", companyId: 7 },
    });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "FAQ_NOT_FOUND");
    const other = faqs.find((f) => f.faqId === 9);
    assert.equal(other.question, "Other company secret question");
    assert.equal(other.companyId, 8);
  });

  await context.test("malformed ids give 400 INVALID_FAQ_ID", async () => {
    for (const id of ["abc", "0", "1.5", "-1"]) {
      for (const [method, body] of [["PATCH", { isPublished: true }], ["DELETE", undefined]]) {
        const response = await call(method, `/api/company/faqs/${id}`, { body });
        assert.equal(response.status, 400, `${method} ${id}`);
        assert.equal((await response.json()).code, "INVALID_FAQ_ID");
      }
    }
  });

  await context.test("delete removes the FAQ once", async () => {
    const response = await call("DELETE", "/api/company/faqs/2");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { deleted: true, faqId: 2 });
    assert.ok(!faqs.some((f) => f.faqId === 2));

    const second = await call("DELETE", "/api/company/faqs/2");
    assert.equal(second.status, 404);
    assert.equal((await second.json()).code, "FAQ_NOT_FOUND");
  });

  await context.test("delete of another company's FAQ is 404 and keeps it", async () => {
    const response = await call("DELETE", "/api/company/faqs/9");
    assert.equal(response.status, 404);
    assert.ok(faqs.some((f) => f.faqId === 9));
    assert.deepEqual(calls.at(-1), ["deleteFaq", 7, 9]);
  });
});
