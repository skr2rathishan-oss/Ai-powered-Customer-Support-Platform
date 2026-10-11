import { test, expect, type Page } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test customerPortal
async function loginAsCustomer(
  page: Page,
  email = "casey@customer.example",
  password = "Customer@2026!",
) {
  await page.goto("/login");
  await page.locator("#individual-email").fill(email);
  await page.locator("#individual-password").fill(password);
  await page.locator('button[type="submit"]').click();
}

async function loginAsCaseyAndWait(page: Page) {
  await loginAsCustomer(page);
  await expect(page).toHaveURL(/\/support\/tickets$/, { timeout: 10000 });
  await expect(page.getByRole("heading", { name: "My tickets", level: 1 })).toBeVisible();
}

test.describe("Customer portal", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("unauthenticated visitors are sent to the login page", async ({ page }) => {
    await page.goto("/support/tickets");
    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 });
  });

  test("customer lands on their own tickets and never sees other customers' tickets", async ({ page }) => {
    await loginAsCaseyAndWait(page);

    await expect(page.getByText("Casey: cannot download invoice")).toBeVisible();
    await expect(page.getByText("Casey: app crashes on login")).toBeVisible();
    await expect(page.getByText("Casey: update my shipping address")).toBeVisible();
    await expect(page.getByText("Casey: question about my plan")).toBeVisible();
    await expect(page.getByTestId("status-badge")).toHaveCount(4);

    await expect(page.getByText("Dana:")).toHaveCount(0);
    await expect(page.getByText("Gus:")).toHaveCount(0);
    await expect(page.getByText("Cannot reset my password")).toHaveCount(0);
  });

  test("status filter narrows the list", async ({ page }) => {
    await loginAsCaseyAndWait(page);
    await page.getByLabel("Status").selectOption("Resolved");
    await expect(page).toHaveURL(/status=Resolved/);
    await expect(page.getByText("Casey: update my shipping address")).toBeVisible();
    await expect(page.getByText("Casey: app crashes on login")).toHaveCount(0);
  });

  test("other roles are restricted on both portals", async ({ page }) => {
    // Company admin cannot use the customer area
    await page.goto("/login/company");
    await page.locator("#company-email").fill("owner@acme-demo.com");
    await page.locator("#company-password").fill("CompanyAdmin@2026!");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/company\/dashboard/, { timeout: 10000 });
    await page.goto("/support/tickets");
    await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();

    // Customer cannot use the company or admin areas
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await loginAsCaseyAndWait(page);

    await page.goto("/company/tickets");
    await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();

    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
  });

  test("submit ticket: client validation, success, detail and list update", async ({ page }) => {
    await loginAsCaseyAndWait(page);
    await page.getByRole("link", { name: "New ticket" }).first().click();
    await expect(page).toHaveURL(/\/support\/tickets\/new$/);

    const submit = page.getByRole("button", { name: "Submit ticket" });
    await page.getByLabel("Subject").fill("ab");
    await submit.click();
    await expect(page.getByText(/Subject must be between 3 and 200/)).toBeVisible();
    await expect(page.getByText("Description is required.")).toBeVisible();
    await expect(page).toHaveURL(/\/support\/tickets\/new$/);

    const subject = `Printer on fire ${Date.now()}`;
    await page.getByLabel("Subject").fill(subject);
    await page.getByLabel("Description").fill("Line one\nLine two");
    await submit.click();

    await expect(page).toHaveURL(/\/support\/tickets\/\d+$/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: subject, level: 1 })).toBeVisible();
    await expect(page.getByTestId("status-badge")).toHaveText("Open");
    await expect(page.getByRole("status").filter({ hasText: /submitted/ })).toBeVisible();

    await page.getByRole("link", { name: "My tickets" }).first().click();
    await expect(page).toHaveURL(/\/support\/tickets$/);
    await expect(page.getByRole("listitem").first()).toContainText(subject);
  });

  test("ticket detail is read-only and another customer's ticket is not found", async ({ page }) => {
    await loginAsCaseyAndWait(page);
    await page.getByText("Casey: app crashes on login").click();

    await expect(page).toHaveURL(/\/support\/tickets\/13$/);
    await expect(page.getByRole("heading", { name: "Casey: app crashes on login", level: 1 })).toBeVisible();
    await expect(page.getByText("Riya Patel")).toBeVisible();
    await expect(page.getByText(/Replies are coming soon/)).toBeVisible();
    await expect(page.locator("select")).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);

    // Dana's ticket (same company), Globex's ticket
    for (const id of [16, 18]) {
      await page.goto(`/support/tickets/${id}`);
      await expect(page.getByRole("heading", { name: "Ticket not found" })).toBeVisible();
      await expect(page.getByText("Dana: secret billing dispute")).toHaveCount(0);
    }
  });

  test("help center lists only published FAQs of the company and search narrows", async ({ page }) => {
    await loginAsCaseyAndWait(page);
    await page.getByRole("link", { name: "Help center" }).click();
    await expect(page).toHaveURL(/\/support\/help$/);

    await expect(page.getByText("How do I reset my password?")).toBeVisible();
    await expect(page.getByText("What are your support hours?")).toBeVisible();
    await expect(page.getByText("Which plans include API access?")).toBeVisible();
    await expect(page.getByText("How do I request a refund?")).toHaveCount(0);
    await expect(page.getByText("Can I export my data?")).toHaveCount(0);
    await expect(page.getByText("Globex warranty policy")).toHaveCount(0);

    await page.getByLabel("Search help articles").fill("support hours");
    await expect(page.getByText("What are your support hours?")).toBeVisible();
    await expect(page.getByText("How do I reset my password?")).toHaveCount(0);

    await page.getByLabel("Search help articles").fill("zzzzqqq");
    await expect(page.getByText("No articles match your search")).toBeVisible();
  });

  test("new ticket page suggests FAQs and shows the assistant greeting", async ({ page }) => {
    await loginAsCaseyAndWait(page);
    await page.goto("/support/tickets/new");

    await expect(page.getByTestId("assistant-greeting")).toBeVisible();
    await expect(page.getByTestId("assistant-greeting")).toContainText("Welcome to Acme support.");

    const suggestions = page.getByTestId("faq-suggestions");
    await expect(suggestions).toContainText("How do I reset my password?");
    await expect(suggestions).not.toContainText("How do I request a refund?");

    await page.getByLabel("Subject").fill("password");
    await expect(suggestions).toContainText("How do I reset my password?");
    await expect(suggestions).not.toContainText("What are your support hours?");
  });

  test("registration creates a customer with an empty ticket list; duplicate email is rejected", async ({ page }) => {
    const email = `new.${Date.now()}@customer.example`;

    await page.goto("/login");
    await page.getByRole("link", { name: "Create a customer account" }).click();
    await expect(page).toHaveURL(/\/register$/);

    await page.getByLabel("Company *").selectOption({ label: "Acme Demo Co" });
    await page.locator("#customer-first-name").fill("Nora");
    await page.locator("#customer-last-name").fill("Newcomer");
    await page.locator("#customer-email").fill(email);
    await page.locator("#customer-password").fill("Customer@2026!");
    await page.locator("#customer-confirm-password").fill("Customer@2026!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/support\/tickets$/, { timeout: 10000 });
    await expect(page.getByText("You have not submitted any tickets yet")).toBeVisible();

    // Same email again
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto("/register");
    await page.getByLabel("Company *").selectOption({ label: "Acme Demo Co" });
    await page.locator("#customer-first-name").fill("Nora");
    await page.locator("#customer-last-name").fill("Newcomer");
    await page.locator("#customer-email").fill(email);
    await page.locator("#customer-password").fill("Customer@2026!");
    await page.locator("#customer-confirm-password").fill("Customer@2026!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("An account with this email already exists").first()).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("registration validates the form on the client", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Select a company.")).toBeVisible();
    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();
  });

  test("an inactive customer cannot sign in", async ({ page }) => {
    await loginAsCustomer(page, "ina@customer.example");
    await expect(page.getByText("This account is not active")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("mobile viewport renders the list without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await loginAsCaseyAndWait(page);
    await expect(page.getByText("Casey: cannot download invoice")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
