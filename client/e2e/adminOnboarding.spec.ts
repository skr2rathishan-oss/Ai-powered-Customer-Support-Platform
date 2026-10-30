import { test, expect, type Page } from "@playwright/test";

const API_BASE_URL = process.env.VITE_API_BASE_URL ?? "http://localhost:5000";

async function signInAsPlatformAdmin(page: Page) {
  await page.goto("/login");
  await page.locator("#individual-email").fill("admin@supportpilot.com");
  await page.locator("#individual-password").fill("Admin@SupportPilot2026!");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
}

test.describe("Platform Admin company onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("dashboard onboarding form shows validation errors and can be cancelled", async ({ page }) => {
    await signInAsPlatformAdmin(page);

    await page.getByRole("button", { name: "Onboard Company" }).click();
    const dialog = page.getByRole("dialog", { name: "Onboard Enterprise" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Onboard Company" }).click();
    await expect(dialog.getByText("Please fix the highlighted fields.")).toBeVisible();
    await expect(dialog.getByText("Company name is required.")).toBeVisible();
    await expect(dialog.getByText("Business email is required.")).toBeVisible();
    await expect(dialog.getByText("Password is required.")).toBeVisible();
    await page.screenshot({ path: "test-results/onboarding-validation.png", fullPage: false });

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("companies page onboards a new company that appears in the directory", async ({ page }) => {
    const suffix = Date.now();
    const companyName = `E2E Onboard ${suffix}`;

    await signInAsPlatformAdmin(page);
    await page.goto("/admin/companies");
    await page.getByRole("button", { name: "Onboard Enterprise" }).click();

    const dialog = page.getByRole("dialog", { name: "Onboard Enterprise" });
    await dialog.getByLabel("Company name").fill(companyName);
    await dialog.getByLabel("Industry").selectOption("SaaS");
    await dialog.getByLabel("Business email").fill(`e2e-onboard-${suffix}@example.com`);
    await dialog.getByLabel("Website").fill("https://example.com");
    await dialog.getByLabel("First name").fill("Eve");
    await dialog.getByLabel("Last name").fill("Tester");
    await dialog.getByLabel("Administrator email").fill(`e2e-admin-${suffix}@example.com`);
    await dialog.getByLabel("Temporary password").fill("Str0ng!Pass");
    await dialog.getByLabel("Confirm password").fill("Str0ng!Pass");
    await page.screenshot({ path: "test-results/onboarding-filled.png", fullPage: false });

    const created = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/companies") && response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Onboard Company" }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const { data } = await response.json();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(`${companyName} onboarded successfully.`)).toBeVisible();
    await expect(page.getByText(companyName).first()).toBeVisible();

    // Remove the test company through the API so the real database stays clean
    const token = await page.evaluate(() => localStorage.getItem("supportpilot.auth_token"));
    const cleanup = await page.request.delete(`${API_BASE_URL}/api/admin/companies/${data.companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(cleanup.ok()).toBe(true);
  });
});
