import { test, expect, type Page } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test companyAiSettings
async function loginAsCompanyAdmin(page: Page) {
  await page.goto("/login/company");
  await page.locator("#company-email").fill("owner@acme-demo.com");
  await page.locator("#company-password").fill("CompanyAdmin@2026!");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/company\/dashboard/, { timeout: 10000 });
}

const API = "**/api/company/ai-settings";

const defaults = {
  enabled: false,
  assistantName: "SupportPilot Assistant",
  tone: "professional",
  greeting: "Hi! How can I help you today?",
  answerFromFaqsOnly: true,
  confidenceThreshold: 70,
  escalateAfterFailures: 2,
  fallbackMessage: "I'm connecting you with a member of our support team.",
  customInstructions: "",
};

const jsonError = {
  status: 500,
  contentType: "application/json",
  body: JSON.stringify({ success: false, message: "Internal server error" }),
};

async function openPage(page: Page) {
  await loginAsCompanyAdmin(page);
  await page.getByRole("link", { name: /AI Settings/ }).click();
  await expect(page).toHaveURL(/\/company\/ai-settings$/);
  await expect(page.getByLabel("Assistant name")).toBeVisible();
}

test.describe("Company AI settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("unauthenticated visitors are sent to the company login", async ({ page }) => {
    await page.goto("/company/ai-settings");
    await expect(page).toHaveURL(/\/login\/company/, { timeout: 10000 });
  });

  test("platform admin is shown Access Restricted", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#individual-email").fill("admin@supportpilot.com");
    await page.locator("#individual-password").fill("Admin@SupportPilot2026!");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    await page.goto("/company/ai-settings");
    await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
  });

  test("nav is live and the page heading shows", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    const nav = page.getByRole("link", { name: /AI Settings/ });
    await expect(nav).not.toContainText("Soon");
    await nav.click();

    await expect(page).toHaveURL(/\/company\/ai-settings$/);
    await expect(nav).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "AI Settings", level: 1 })).toBeVisible();
    await expect(page.getByText("Coming soon")).toHaveCount(0);
  });

  test("default state shows the not-configured banner and defaults", async ({ page }) => {
    await page.route(API, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: { settings: defaults, defaults, configured: false, updatedAt: null },
            }),
          })
        : route.continue(),
    );
    await openPage(page);

    await expect(page.getByText("Not configured yet")).toBeVisible();
    await expect(page.getByLabel("Enable assistant")).not.toBeChecked();
    await expect(page.getByLabel("Assistant name")).toHaveValue("SupportPilot Assistant");
    await expect(page.getByLabel("Confidence threshold (%)")).toHaveValue("70");
    await expect(page.getByLabel(/Escalate to a human/)).toHaveValue("2");
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  test("client validation blocks saving and sends no PUT", async ({ page }) => {
    const puts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes("/ai-settings")) {
        puts.push(request.url());
      }
    });
    await openPage(page);

    const save = page.getByRole("button", { name: "Save changes" });

    await page.getByLabel("Assistant name").fill("");
    await expect(page.getByText("Assistant name is required")).toBeVisible();
    await expect(save).toBeDisabled();
    await page.getByLabel("Assistant name").fill("Valid name");

    await page.getByLabel("Confidence threshold (%)").fill("101");
    await expect(page.getByText(/Confidence threshold must be a whole number/)).toBeVisible();
    await expect(save).toBeDisabled();
    await page.getByLabel("Confidence threshold (%)").fill("70");

    await page.getByLabel("Custom instructions", { exact: true }).fill("x".repeat(1001));
    await expect(page.getByText(/Custom instructions must not exceed 1000/)).toBeVisible();
    await expect(save).toBeDisabled();

    expect(puts).toHaveLength(0);
  });

  test("save persists across reload and never shows another company's values", async ({ page }) => {
    await openPage(page);

    await page.getByLabel("Enable assistant").check();
    await page.getByLabel("Assistant name").fill("Acme Helper");
    await page.getByLabel("Tone").selectOption("empathetic");
    await page.getByLabel(/Escalate to a human/).fill("4");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("status").filter({ hasText: "AI settings saved" })).toBeVisible();
    await expect(page.getByText("Not configured yet")).toHaveCount(0);

    await page.reload();
    await expect(page.getByLabel("Assistant name")).toHaveValue("Acme Helper");
    await expect(page.getByLabel("Tone")).toHaveValue("empathetic");
    await expect(page.getByLabel(/Escalate to a human/)).toHaveValue("4");
    await expect(page.getByLabel("Enable assistant")).toBeChecked();
    await expect(page.getByText("Globex Helper")).toHaveCount(0);
    await expect(page.locator("input, textarea").evaluateAll((els) =>
      els.some((el) => (el as HTMLInputElement).value.includes("Globex")),
    )).resolves.toBe(false);
  });

  test("reset to defaults marks dirty and discard restores saved values", async ({ page }) => {
    await openPage(page);
    await page.getByLabel("Assistant name").fill("Saved Name");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("AI settings saved")).toBeVisible();

    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await expect(page.getByLabel("Assistant name")).toHaveValue("SupportPilot Assistant");
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();

    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page.getByLabel("Assistant name")).toHaveValue("Saved Name");
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  test("server 422 shows the field message and keeps entered values", async ({ page }) => {
    await openPage(page);
    await page.route(API, (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({
              success: false,
              message: "Validation failed",
              code: "VALIDATION_ERROR",
              errors: [{ field: "assistantName", message: "Name is not allowed" }],
            }),
          })
        : route.continue(),
    );

    await page.getByLabel("Assistant name").fill("Rejected Name");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Name is not allowed")).toBeVisible();
    await expect(page.getByLabel("Assistant name")).toHaveValue("Rejected Name");
    await expect(page.getByLabel("Assistant name")).toHaveAttribute("aria-invalid", "true");
  });

  test("load failure offers retry; save failure keeps the form dirty", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.route(API, (route) => route.fulfill(jsonError));
    await page.getByRole("link", { name: /AI Settings/ }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await page.unroute(API);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByLabel("Assistant name")).toBeVisible();

    await page.route(API, (route) =>
      route.request().method() === "PUT" ? route.fulfill(jsonError) : route.continue(),
    );
    await page.getByLabel("Assistant name").fill("Unsaved Name");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Assistant name")).toHaveValue("Unsaved Name");
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  test("dashboard checklist step is done after saving", async ({ page }) => {
    await openPage(page);
    await page.getByLabel("Assistant name").fill("Dashboard Helper");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("AI settings saved")).toBeVisible();

    await page.goto("/company/dashboard");
    await expect(page).toHaveURL(/\/company\/dashboard/);
    const step = page.getByRole("listitem").filter({ hasText: "Configure AI settings" });
    await expect(step).toContainText("check_circle");
  });
});
