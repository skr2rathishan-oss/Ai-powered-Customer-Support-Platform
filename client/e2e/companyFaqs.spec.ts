import { test, expect, type Page } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test companyFaqs
async function loginAsCompanyAdmin(page: Page) {
  await page.goto("/login/company");
  await page.locator("#company-email").fill("owner@acme-demo.com");
  await page.locator("#company-password").fill("CompanyAdmin@2026!");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/company\/dashboard/, { timeout: 10000 });
}

const faqRow = (page: Page, question: string) =>
  page.getByTestId("faq-row").filter({ hasText: question });

const jsonError = {
  status: 500,
  contentType: "application/json",
  body: JSON.stringify({ success: false, message: "Internal server error" }),
};

test.describe("Company FAQ management", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("unauthenticated visitors are sent to the company login", async ({ page }) => {
    await page.goto("/company/faqs");
    await expect(page).toHaveURL(/\/login\/company/, { timeout: 10000 });
  });

  test("platform admin is shown Access Restricted", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#individual-email").fill("admin@supportpilot.com");
    await page.locator("#individual-password").fill("Admin@SupportPilot2026!");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    await page.goto("/company/faqs");
    await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
  });

  test("FAQ nav is live and lists only this company's FAQs", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    const nav = page.getByRole("link", { name: /FAQs/ });
    await nav.click();

    await expect(page).toHaveURL(/\/company\/faqs$/);
    await expect(nav).toHaveAttribute("aria-current", "page");
    await expect(nav).not.toContainText("Soon");
    await expect(page.getByText("Coming soon")).toHaveCount(0);

    await expect(faqRow(page, "How do I reset my password?")).toBeVisible();
    await expect(page.getByText("Globex warranty policy")).toHaveCount(0);
    await expect(page.getByText("Globex secret draft question")).toHaveCount(0);
    await expect(faqRow(page, "How do I reset my password?").getByTestId("faq-status-badge")).toHaveText("Published");
    await expect(faqRow(page, "How do I request a refund?").getByTestId("faq-status-badge")).toHaveText("Draft");
  });

  test("filters narrow the list and Clear restores it", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/faqs");
    await expect(faqRow(page, "What are your support hours?")).toBeVisible();

    await page.getByLabel("Status", { exact: true }).selectOption("draft");
    await expect(faqRow(page, "How do I request a refund?")).toBeVisible();
    await expect(faqRow(page, "What are your support hours?")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear", exact: true }).click();

    await page.getByLabel("Category", { exact: true }).selectOption("Billing");
    await expect(faqRow(page, "How do I request a refund?")).toBeVisible();
    await expect(faqRow(page, "Which plans include API access?")).toBeVisible();
    await expect(faqRow(page, "What are your support hours?")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear", exact: true }).click();

    await page.getByLabel("Search FAQs").fill("export");
    await expect(faqRow(page, "Can I export my data?")).toBeVisible();
    await expect(faqRow(page, "What are your support hours?")).toHaveCount(0);

    await page.getByLabel("Search FAQs").fill("zzz-no-such-faq");
    await expect(page.getByText("No FAQs match your filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(faqRow(page, "What are your support hours?")).toBeVisible();
    await expect(faqRow(page, "Can I export my data?")).toBeVisible();
  });

  test("create validates, adds a draft and Escape returns focus", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/faqs");
    const trigger = page.getByRole("button", { name: "Add FAQ" }).first();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Question")).toBeFocused();
    await dialog.getByRole("button", { name: "Save FAQ" }).click();
    await expect(dialog.getByText("Question is required")).toBeVisible();
    await expect(dialog.getByText("Answer is required")).toBeVisible();

    await dialog.getByLabel("Question").fill("Hi?");
    await dialog.getByRole("button", { name: "Save FAQ" }).click();
    await expect(dialog.getByText(/at least 5 characters/)).toBeVisible();

    const question = `Where can I find invoice ${Date.now()}?`;
    await dialog.getByLabel("Question").fill(question);
    await dialog.getByLabel("Answer").fill("Open Billing and choose Invoices.");
    await dialog.getByLabel("Category (optional)").fill("Billing");
    await dialog.getByRole("button", { name: "Save FAQ" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "FAQ created" })).toBeVisible();
    await expect(faqRow(page, question)).toBeVisible();
    await expect(faqRow(page, question).getByTestId("faq-status-badge")).toHaveText("Draft");

    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("edit changes the answer and publish toggles the badge", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/faqs");

    await page.getByRole("button", { name: 'Edit "What are your support hours?"' }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Answer").fill("We answer tickets around the clock.");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "FAQ updated" })).toBeVisible();
    await expect(faqRow(page, "What are your support hours?")).toContainText("We answer tickets around the clock.");

    const hours = faqRow(page, "What are your support hours?");
    await page.getByRole("button", { name: 'Unpublish "What are your support hours?"' }).click();
    await expect(hours.getByTestId("faq-status-badge")).toHaveText("Draft");
    await page.getByRole("button", { name: 'Publish "What are your support hours?"' }).click();
    await expect(hours.getByTestId("faq-status-badge")).toHaveText("Published");
  });

  test("delete asks for confirmation", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/faqs");
    const question = "Can I export my data?";

    await page.getByRole("button", { name: `Delete "${question}"` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(faqRow(page, question)).toBeVisible();

    await page.getByRole("button", { name: `Delete "${question}"` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(faqRow(page, question)).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "FAQ deleted" })).toBeVisible();
  });

  test("dashboard counts published FAQs", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    const card = page
      .getByText("FAQ articles", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await expect(card).toContainText(/[1-9]/);
    await expect(page.getByText("Publish FAQ articles for the AI assistant")).toBeVisible();
  });

  test("error and empty states", async ({ page }) => {
    await loginAsCompanyAdmin(page);

    await page.route("**/api/company/faqs*", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill(jsonError);
    });
    await page.goto("/company/faqs");
    await expect(page.getByRole("alert").filter({ hasText: "Internal server error" })).toBeVisible();
    await page.unroute("**/api/company/faqs*");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(faqRow(page, "How do I reset my password?")).toBeVisible();

    await page.route("**/api/company/faqs*", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { faqs: [], categories: [], summary: { total: 0, published: 0, draft: 0 } },
        }),
      });
    });
    await page.goto("/company/faqs");
    await expect(page.getByText("No FAQs yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add FAQ" })).toHaveCount(2);
  });

  test("a failed publish shows a row alert and keeps the status", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/company/faqs");
    await expect(faqRow(page, "Which plans include API access?")).toBeVisible();

    await page.route("**/api/company/faqs/*", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill(jsonError);
    });
    await page.getByRole("button", { name: 'Unpublish "Which plans include API access?"' }).click();
    const row = faqRow(page, "Which plans include API access?");
    await expect(row.getByRole("alert")).toContainText("Internal server error");
    await expect(row.getByTestId("faq-status-badge")).toHaveText("Published");
  });
});
