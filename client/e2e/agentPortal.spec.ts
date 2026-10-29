import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test agentPortal
const API = "http://127.0.0.1:5000";
const PASSWORD = "CompanyAdmin@2026!";

async function loginAsAgent(page: Page, email = "agent@acme-demo.com", password = PASSWORD) {
  await page.goto("/login");
  await page.locator("#individual-email").fill(email);
  await page.locator("#individual-password").fill(password);
  await page.locator('button[type="submit"]').click();
}

async function loginAsAgentAndWait(page: Page, email?: string) {
  await loginAsAgent(page, email);
  await expect(page).toHaveURL(/\/agent\/dashboard$/, { timeout: 10000 });
  await page.getByRole("link", { name: "My queue" }).click();
  await expect(page).toHaveURL(/\/agent\/tickets$/);
  await expect(page.getByRole("heading", { name: "My queue", level: 1 })).toBeVisible();
}

async function loginAsCustomer(page: Page) {
  await page.goto("/login");
  await page.locator("#individual-email").fill("casey@customer.example");
  await page.locator("#individual-password").fill("Customer@2026!");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/support$/, { timeout: 10000 });
}

async function adminApi(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }) {
  const api = await playwright.request.newContext({ baseURL: API });
  const response = await api.post("/api/auth/sign-in", {
    data: { accountType: "company", email: "owner@acme-demo.com", password: PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  return api;
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

const unique = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test.describe("Agent portal", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("unauthenticated visitors go to login; other roles see Access Restricted", async ({ page }) => {
    await page.goto("/agent/tickets");
    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 });

    await loginAsCustomer(page);
    await page.goto("/agent/tickets");
    await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
    await signOutViaStorage(page);

    await page.goto("/login/company");
    await page.locator("#company-email").fill("owner@acme-demo.com");
    await page.locator("#company-password").fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/company\/dashboard/, { timeout: 10000 });
    await page.goto("/agent/tickets");
    await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
  });

  test("agent login lands on the queue with only own tickets", async ({ page }) => {
    await loginAsAgentAndWait(page);

    await expect(page.getByText("Cannot reset my password")).toBeVisible();
    await expect(page.getByText("Invoice shows wrong amount")).toBeVisible();
    await expect(page.getByTestId("status-badge")).toHaveCount(2);
    for (const hidden of [
      "Feature request: dark mode", // unassigned
      "Casey: app crashes on login", // Riya's
      "Order arrived damaged", // Globex
    ]) {
      await expect(page.getByText(hidden)).toHaveCount(0);
    }

    const invoice = page.getByRole("listitem").filter({ hasText: "Invoice shows wrong amount" });
    await expect(invoice.getByText("Awaiting reply")).toBeVisible();
    const reset = page.getByRole("listitem").filter({ hasText: "Cannot reset my password" });
    await expect(reset.getByText("Awaiting reply")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /My queue/ })).toHaveAttribute("aria-current", "page");
  });

  test("filters, search and sort", async ({ page }) => {
    await loginAsAgentAndWait(page);

    await page.getByLabel("Status").selectOption("In Progress");
    await expect(page).toHaveURL(/status=In\+Progress|status=In%20Progress/);
    await expect(page.getByText("Invoice shows wrong amount")).toBeVisible();
    await expect(page.getByText("Cannot reset my password")).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("Cannot reset my password")).toBeVisible();

    await page.getByLabel("Search").fill("reset");
    await expect(page).toHaveURL(/search=reset/);
    await expect(page.getByText("Invoice shows wrong amount")).toHaveCount(0);
    await expect(page.getByText("Cannot reset my password")).toBeVisible();

    await page.getByLabel("Search").fill("zzzznothing");
    await expect(page.getByText("No tickets match your filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.getByText("Cannot reset my password")).toBeVisible();
    await expect(page.getByText("Invoice shows wrong amount")).toBeVisible();

    await page.getByLabel("Sort").selectOption("priority");
    await expect(page).toHaveURL(/sort=priority/);
    await expect(page.getByRole("listitem").first()).toContainText("Invoice shows wrong amount");
  });

  test("Riya's queue differs from Sam's", async ({ page }) => {
    await loginAsAgentAndWait(page, "riya@acme-demo.com");
    await expect(page.getByText("Casey: app crashes on login")).toBeVisible();
    await expect(page.getByText("Casey: update my shipping address")).toBeVisible();
    await expect(page.getByText("Cannot reset my password")).toHaveCount(0);
  });

  test("detail shows description, replies and internal notes; foreign tickets are not found", async ({ page }) => {
    await loginAsAgentAndWait(page);
    await page.getByText("Cannot reset my password").click();

    await expect(page).toHaveURL(/\/agent\/tickets\/1$/);
    await expect(page.getByRole("heading", { name: "Cannot reset my password", level: 1 })).toBeVisible();
    await expect(page.getByText("The reset email never arrives.")).toBeVisible();
    await expect(page.getByText(/we are checking why the reset email/)).toBeVisible();
    const note = page.getByTestId("reply").filter({ hasText: "Checked logs, SMTP bounce" });
    await expect(note).toContainText("Internal note");

    for (const path of ["/agent/tickets/9", "/agent/tickets/13", "/agent/tickets/abc"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Ticket not found" })).toBeVisible();
    }
  });

  test("replying, internal notes, status update and failed send", async ({ page, playwright }) => {
    await loginAsAgentAndWait(page);
    await page.goto("/agent/tickets/1");
    await expect(page.getByRole("heading", { name: "Cannot reset my password", level: 1 })).toBeVisible();

    const send = page.getByRole("button", { name: "Send reply" });
    await expect(send).toBeDisabled();
    await page.getByLabel("Reply", { exact: true }).fill("   ");
    await expect(send).toBeDisabled();

    const publicText = unique("Public reply");
    await page.getByLabel("Reply", { exact: true }).fill(publicText);
    await send.click();
    const published = page.getByTestId("reply").filter({ hasText: publicText });
    await expect(published).toBeVisible();
    await expect(published).not.toContainText("Internal note");
    await expect(page.getByLabel("Reply", { exact: true })).toHaveValue("");
    await expect(page.getByRole("status").filter({ hasText: "Reply sent" })).toBeVisible();

    const noteText = unique("Team note");
    await page.getByLabel("Internal note").check();
    await page.getByLabel("Reply", { exact: true }).fill(noteText);
    await send.click();
    await expect(page.getByTestId("reply").filter({ hasText: noteText })).toContainText("Internal note");

    // A server failure keeps the typed text and shows an alert
    const failing = unique("Will fail");
    await page.route("**/api/agent/tickets/1/replies", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Boom" }) }),
    );
    await page.getByLabel("Reply", { exact: true }).fill(failing);
    await send.click();
    await expect(page.getByRole("alert").filter({ hasText: "Boom" })).toBeVisible();
    await expect(page.getByLabel("Reply", { exact: true })).toHaveValue(failing);
    await page.unroute("**/api/agent/tickets/1/replies");

    // Status change persists after reload
    const admin = await adminApi(playwright);
    try {
      await page.getByLabel("Change status").selectOption("Resolved");
      await page.getByRole("button", { name: "Update status" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Status updated to Resolved" })).toBeVisible();
      await expect(page.getByTestId("status-badge")).toHaveText("Resolved");
      await page.reload();
      await expect(page.getByTestId("status-badge")).toHaveText("Resolved");
      await expect(page.getByText(publicText)).toBeVisible();
    } finally {
      await admin.patch("/api/company/tickets/1", { data: { status: "Open" } });
      await admin.dispose();
    }
  });

  test("customer and agent see each other's public replies but never internal notes", async ({ page }) => {
    const agentReply = unique("Agent says hi");
    const agentNote = unique("INTERNAL-NOTE");
    const customerReply = unique("Customer answers");

    await loginAsAgentAndWait(page, "riya@acme-demo.com");
    await page.goto("/agent/tickets/13");
    await expect(page.getByText("INTERNAL-ONLY-NOTE-RIYA")).toBeVisible();
    await page.getByLabel("Reply", { exact: true }).fill(agentReply);
    await page.getByRole("button", { name: "Send reply" }).click();
    await expect(page.getByText(agentReply)).toBeVisible();
    await page.getByLabel("Internal note").check();
    await page.getByLabel("Reply", { exact: true }).fill(agentNote);
    await page.getByRole("button", { name: "Send reply" }).click();
    await expect(page.getByText(agentNote)).toBeVisible();
    await signOut(page);

    await loginAsCustomer(page);
    await page.goto("/support/tickets/13");
    await expect(page.getByText(agentReply)).toBeVisible();
    await expect(page.getByText("INTERNAL-ONLY-NOTE-RIYA")).toHaveCount(0);
    await expect(page.getByText(agentNote)).toHaveCount(0);
    await expect(page.getByLabel("Internal note")).toHaveCount(0);

    await page.getByLabel("Reply", { exact: true }).fill(customerReply);
    await page.getByRole("button", { name: "Send reply" }).click();
    await expect(page.getByText(customerReply)).toBeVisible();
    await signOut(page);

    await loginAsAgentAndWait(page, "riya@acme-demo.com");
    await page.goto("/agent/tickets/13");
    await expect(page.getByText(customerReply)).toBeVisible();
    await expect(page.getByText(agentNote)).toBeVisible();
  });

  test("closed tickets are read-only for agents and the API answers 409", async ({ page, playwright }) => {
    const admin = await adminApi(playwright);
    try {
      await admin.patch("/api/company/tickets/2", { data: { status: "Closed" } });
      await loginAsAgentAndWait(page);
      await page.goto("/agent/tickets/2");
      await expect(page.getByTestId("status-badge")).toHaveText("Closed");
      await expect(page.getByText(/This ticket is closed/).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Send reply" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Update status" })).toHaveCount(0);

      const response = await page.evaluate(async () => {
        const result = await fetch("http://127.0.0.1:5000/api/agent/tickets/2/replies", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: "late reply" }),
        });
        return { status: result.status, body: await result.json() };
      });
      expect(response.status).toBe(409);
      expect(response.body.code).toBe("TICKET_CLOSED");
    } finally {
      await admin.patch("/api/company/tickets/2", { data: { status: "In Progress" } });
      await admin.dispose();
    }
  });

  test("a deactivated agent with a live session is locked out", async ({ page, playwright }) => {
    await loginAsAgentAndWait(page, "riya@acme-demo.com");
    const admin = await adminApi(playwright);
    try {
      const off = await admin.patch("/api/company/agents/6", { data: { status: "Inactive" } });
      expect(off.ok()).toBeTruthy();
      await page.reload();
      await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
      await expect(page.getByText(/deactivated/)).toBeVisible();
    } finally {
      await admin.patch("/api/company/agents/6", { data: { status: "Active" } });
      // Deactivation unassigned her open ticket; give it back
      await admin.patch("/api/company/tickets/13", { data: { assignedAgentId: 6 } });
      await admin.dispose();
    }
  });

  test("error and empty states of the queue", async ({ page }) => {
    await loginAsAgentAndWait(page);

    await page.route("**/api/agent/tickets?*", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Queue exploded" }) }),
    );
    await page.reload();
    await expect(page.getByRole("alert").filter({ hasText: "Queue exploded" })).toBeVisible();
    await page.unroute("**/api/agent/tickets?*");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("Cannot reset my password")).toBeVisible();

    await page.route("**/api/agent/tickets?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            tickets: [],
            summary: { open: 0, inProgress: 0, resolved: 0, closed: 0, total: 0 },
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
          },
        }),
      }),
    );
    await page.reload();
    await expect(page.getByText("No tickets assigned to you yet")).toBeVisible();
  });

  test.describe("reopening", () => {
    test.describe.configure({ mode: "serial" });

    test("a customer reply on a resolved ticket reopens it", async ({ page, playwright }) => {
      const admin = await adminApi(playwright);
      try {
        await loginAsCustomer(page);
        await page.goto("/support/tickets/14");
        await expect(page.getByTestId("status-badge")).toHaveText("Resolved");
        await expect(page.getByText(/will reopen it/)).toBeVisible();
        await page.getByLabel("Reply", { exact: true }).fill(unique("Still not right"));
        await page.getByRole("button", { name: "Send reply" }).click();
        await expect(page.getByTestId("status-badge")).toHaveText("Open");
      } finally {
        await admin.patch("/api/company/tickets/14", { data: { status: "Resolved" } });
        await admin.dispose();
      }
    });
  });
});

async function signOutViaStorage(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}
