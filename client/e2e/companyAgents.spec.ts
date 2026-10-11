import { test, expect, type Page } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test companyAgents
async function loginAsCompanyAdmin(page: Page) {
  await page.goto("/login/company");
  await page.locator("#company-email").fill("owner@acme-demo.com");
  await page.locator("#company-password").fill("CompanyAdmin@2026!");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/company\/dashboard/, { timeout: 10000 });
}

const row = (page: Page, name: string) =>
  page.getByRole("row", { name: new RegExp(name) });

test.describe("Company agent management", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("unauthenticated visitors are sent to the company login", async ({ page }) => {
    await page.goto("/company/agents");
    await expect(page).toHaveURL(/\/login\/company/, { timeout: 10000 });
  });

  test("platform admin is shown Access Restricted", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#individual-email").fill("admin@supportpilot.com");
    await page.locator("#individual-password").fill("Admin@SupportPilot2026!");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    await page.goto("/company/agents");
    await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
  });

  test("agents nav lists only this company's agents", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    const nav = page.getByRole("link", { name: /Agents/ });
    await nav.click();

    await expect(page).toHaveURL(/\/company\/agents$/);
    await expect(nav).toHaveAttribute("aria-current", "page");
    await expect(nav).not.toContainText("Soon");
    await expect(page.getByText("Coming soon")).toHaveCount(0);

    await expect(row(page, "Sam Agent")).toBeVisible();
    await expect(row(page, "Riya Patel")).toBeVisible();
    await expect(row(page, "Dev Inactive")).toBeVisible();
    await expect(row(page, "Nia Pending")).toContainText("Invite pending");
    await expect(page.getByText("Gina Globex")).toHaveCount(0);
    await expect(row(page, "Sam Agent").getByRole("cell").nth(3)).toHaveText("2");
  });

  test("status filter and search narrow the table", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/agents");
    await expect(row(page, "Sam Agent")).toBeVisible();

    await page.getByLabel("Status", { exact: true }).selectOption("Inactive");
    await expect(row(page, "Dev Inactive")).toBeVisible();
    await expect(row(page, "Sam Agent")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear", exact: true }).click();

    await page.getByLabel("Search agents").fill("riya");
    await expect(row(page, "Riya Patel")).toBeVisible();
    await expect(row(page, "Sam Agent")).toHaveCount(0);

    await page.getByLabel("Search agents").fill("zzz-no-such-agent");
    await expect(page.getByText("No agents match your filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(row(page, "Sam Agent")).toBeVisible();
    await expect(row(page, "Riya Patel")).toBeVisible();
  });

  test("invite validates, rejects duplicates and adds a pending agent", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/agents");
    const trigger = page.getByRole("button", { name: "Invite agent" }).first();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("First name")).toBeFocused();
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(dialog.getByText("First name is required")).toBeVisible();
    await expect(dialog.getByText("Last name is required")).toBeVisible();
    await expect(dialog.getByText("Email is required")).toBeVisible();

    await dialog.getByLabel("First name").fill("Dup");
    await dialog.getByLabel("Last name").fill("Licate");
    for (const email of ["agent@acme-demo.com", "agent@globex.example"]) {
      await dialog.getByLabel("Email").fill(email);
      await dialog.getByRole("button", { name: "Send invite" }).click();
      await expect(dialog.getByText(/already exists/)).toBeVisible();
      await expect(dialog).toBeVisible();
    }

    const email = `lee.${Date.now()}@acme-demo.com`;
    await dialog.getByLabel("First name").fill("Lee");
    await dialog.getByLabel("Last name").fill("Wong");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByRole("button", { name: "Send invite" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: `Invite sent to ${email}` })).toBeVisible();
    await expect(row(page, "Lee Wong")).toContainText("Invite pending");
    await expect(page.getByText(/reset-password|token=/)).toHaveCount(0);

    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("deactivating an agent unassigns tickets, reactivating restores assignability", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/agents");

    await page.getByRole("button", { name: "Deactivate Sam Agent" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("2 open tickets will become unassigned");
    await dialog.getByRole("button", { name: "Deactivate", exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(row(page, "Sam Agent").getByTestId("agent-status-badge")).toHaveText("Inactive");
    await expect(page.getByRole("status").filter({ hasText: "2 tickets unassigned" })).toBeVisible();

    await page.goto("/company/tickets");
    await expect(page.getByText("Cannot reset my password")).toBeVisible();
    await expect(
      page.getByLabel("Assignee", { exact: true }).locator("option", { hasText: "Sam Agent" }),
    ).toHaveCount(0);
    await page.goto("/company/tickets/1");
    await expect(page.getByLabel("Assignee")).toHaveValue("");
    await page.goto("/company/tickets/2");
    await expect(page.getByLabel("Assignee")).toHaveValue("");

    await page.goto("/company/agents");
    await page.getByRole("button", { name: "Reactivate Sam Agent" }).click();
    await expect(row(page, "Sam Agent").getByTestId("agent-status-badge")).toHaveText("Active");

    await page.goto("/company/tickets");
    await expect(
      page.getByLabel("Assignee", { exact: true }).locator("option", { hasText: "Sam Agent" }),
    ).toHaveCount(1);
  });

  test("resend invite succeeds and a failed status change shows a row error", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/agents");

    await page.getByRole("button", { name: "Resend invite to Nia Pending" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Invite sent to nia@/ })).toBeVisible();

    await page.route("**/api/company/agents/*", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Internal server error" }),
      });
    });
    await page.getByRole("button", { name: "Deactivate Riya Patel" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Deactivate", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Internal server error");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(row(page, "Riya Patel").getByTestId("agent-status-badge")).toHaveText("Active");

    await page.unroute("**/api/company/agents/*");
    await page.route("**/api/company/agents/*", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Internal server error" }),
      });
    });
    await page.getByRole("button", { name: "Reactivate Dev Inactive" }).click();
    await expect(row(page, "Dev Inactive").getByRole("alert")).toContainText("Internal server error");
    await expect(row(page, "Dev Inactive").getByTestId("agent-status-badge")).toHaveText("Inactive");
  });

  test("error and empty states", async ({ page }) => {
    await loginAsCompanyAdmin(page);

    await page.route("**/api/company/agents", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Internal server error" }),
      });
    });
    await page.goto("/company/agents");
    await expect(page.getByRole("alert").filter({ hasText: "Internal server error" })).toBeVisible();
    await page.unroute("**/api/company/agents");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(row(page, "Sam Agent")).toBeVisible();

    await page.route("**/api/company/agents", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { agents: [], summary: { total: 0, active: 0, inactive: 0, invitePending: 0 } },
        }),
      });
    });
    await page.goto("/company/agents");
    await expect(page.getByText("No support agents yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite agent" })).toHaveCount(2);
  });
});
