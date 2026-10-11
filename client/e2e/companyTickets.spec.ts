import { test, expect, type Page } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test companyTickets
async function loginAsCompanyAdmin(page: Page) {
  await page.goto("/login/company");
  await page.locator("#company-email").fill("owner@acme-demo.com");
  await page.locator("#company-password").fill("CompanyAdmin@2026!");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/company\/dashboard/, { timeout: 10000 });
}

test.describe("Company ticket management", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("unauthenticated visitors are sent to the company login", async ({ page }) => {
    await page.goto("/company/tickets");
    await expect(page).toHaveURL(/\/login\/company/, { timeout: 10000 });
  });

  test("platform admin is shown Access Restricted", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#individual-email").fill("admin@supportpilot.com");
    await page.locator("#individual-password").fill("Admin@SupportPilot2026!");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    await page.goto("/company/tickets");
    await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
  });

  test("tickets nav shows only this company's tickets", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    const nav = page.getByRole("link", { name: /Tickets/ });
    await nav.click();

    await expect(page).toHaveURL(/\/company\/tickets$/);
    await expect(nav).toHaveAttribute("aria-current", "page");
    await expect(nav).not.toContainText("Soon");
    await expect(page.getByText("Coming soon")).toHaveCount(0);
    await expect(page.getByText("Cannot reset my password")).toBeVisible();
    await expect(page.getByText("Order arrived damaged")).toHaveCount(0);
  });

  test("filters narrow the list and can be cleared", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/tickets");
    await expect(page.getByText("Cannot reset my password")).toBeVisible();

    await page.getByLabel("Status", { exact: true }).selectOption("Open");
    await expect(page).toHaveURL(/status=Open/);
    await expect(page.getByTestId("status-badge").first()).toBeVisible();
    await expect(page.getByTestId("status-badge").filter({ hasNotText: "Open" })).toHaveCount(0);

    await page.getByLabel("Priority", { exact: true }).selectOption("Urgent");
    await expect(page).toHaveURL(/priority=Urgent/);
    await expect(page.getByTestId("priority-badge").filter({ hasNotText: "Urgent" })).toHaveCount(0);

    await page.getByLabel("Assignee", { exact: true }).selectOption("unassigned");
    await expect(page).toHaveURL(/assignee=unassigned/);
    await expect(page.getByRole("cell", { name: "Unassigned" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page).not.toHaveURL(/status=/);

    await page.getByLabel("Search tickets").fill("password");
    await expect(page).toHaveURL(/search=password/);
    await expect(page.getByText("Cannot reset my password")).toBeVisible();
    await expect(page.getByText("Invoice shows wrong amount")).toHaveCount(0);

    await page.getByLabel("Search tickets").fill("zzzz-no-such-ticket");
    await expect(page.getByText("No tickets match your filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("Cannot reset my password")).toBeVisible();
    await expect(page.getByLabel("Search tickets")).toHaveValue("");
  });

  test("search keeps typed spaces after the debounce fires", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/tickets");
    const search = page.getByLabel("Search tickets");
    await search.pressSequentially("invoice ");
    await expect(page).toHaveURL(/search=invoice(&|$)/);
    await expect(search).toHaveValue("invoice ");
    await search.pressSequentially("shows");
    await expect(page).toHaveURL(/search=invoice\+shows/);
    await expect(search).toHaveValue("invoice shows");
    await expect(page.getByText("Invoice shows wrong amount")).toBeVisible();
  });

  test("pagination moves between pages", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/tickets?limit=3");

    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  test("creating a ticket validates, then opens the new ticket", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/tickets");
    await page.getByRole("button", { name: "New ticket" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Create ticket" }).click();
    await expect(dialog.getByText("Subject must be between 3 and 200 characters")).toBeVisible();
    await expect(dialog.getByText("Description is required")).toBeVisible();
    await expect(dialog).toBeVisible();

    const subject = `E2E login broken ${Date.now()}`;
    await dialog.getByLabel("Subject").fill(subject);
    await dialog.getByLabel("Description").fill("Users cannot log in since this morning.");
    await dialog.getByLabel("Priority").selectOption("High");
    await dialog.getByLabel("Assign to").selectOption({ label: "Sam Agent" });
    await dialog.getByRole("button", { name: "Create ticket" }).click();

    await expect(page).toHaveURL(/\/company\/tickets\/\d+$/);
    await expect(page.getByRole("heading", { name: subject })).toBeVisible();
    await expect(page.getByLabel("Priority")).toHaveValue("High");
    await expect(page.getByLabel("Assignee")).toHaveText(/Sam Agent/);
  });

  test("server validation errors render next to the field", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/tickets");
    await page.route("**/api/company/tickets", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          errors: [{ field: "subject", message: "Subject is rejected by the server" }],
        }),
      });
    });

    await page.getByRole("button", { name: "New ticket" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Subject").fill("Valid looking subject");
    await dialog.getByLabel("Description").fill("Some description");
    await dialog.getByRole("button", { name: "Create ticket" }).click();

    await expect(dialog.getByText("Subject is rejected by the server")).toBeVisible();
    await expect(dialog.getByLabel("Subject")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog).toBeVisible();
  });

  test("ticket properties can be edited and persist", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/tickets");
    await page.getByRole("link", { name: "Widget not loading on Safari" }).click();
    await expect(page.getByRole("heading", { name: "Widget not loading on Safari" })).toBeVisible();

    await page.getByLabel("Status").selectOption("Resolved");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Status")).toHaveValue("Resolved");

    await page.getByLabel("Assignee").selectOption("");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Assignee")).toHaveValue("");

    await page.route("**/api/company/tickets/*", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Internal server error" }),
      });
    });
    await page.getByLabel("Status").selectOption("Closed");
    await expect(page.getByRole("alert")).toContainText("Internal server error");
    await expect(page.getByLabel("Status")).toHaveValue("Resolved");
  });

  test("unknown, foreign and malformed ticket ids show not found", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    for (const id of ["9999", "9", "abc"]) {
      await page.goto(`/company/tickets/${id}`);
      await expect(page.getByRole("heading", { name: "Ticket not found" })).toBeVisible();
    }
  });

  test("list load failure offers a retry", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    const handler = async (route: import("@playwright/test").Route) => {
      if (route.request().url().includes("assignable-agents")) return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Internal server error" }),
      });
    };
    await page.route("**/api/company/tickets?*", handler);
    await page.goto("/company/tickets");

    await expect(page.getByRole("alert")).toContainText("Internal server error");
    await page.unroute("**/api/company/tickets?*", handler);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Cannot reset my password")).toBeVisible();
  });
});
