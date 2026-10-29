import { test, expect } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test companyPortal
test.describe("Company portal shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("unauthenticated visitors are sent to the company login", async ({ page }) => {
    await page.goto("/company/dashboard");
    await expect(page).toHaveURL(/\/login\/company/, { timeout: 10000 });
  });

  test("company admin signs in and sees the overview", async ({ page }) => {
    await page.goto("/login/company");
    await page.locator("#company-email").fill("owner@acme-demo.com");
    await page.locator("#company-password").fill("CompanyAdmin@2026!");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/company\/dashboard/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Ada/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ticket activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agent workload" })).toBeVisible();
    await expect(page.getByText("Acme Demo Co").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Overview/ })).toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: /Tickets/ }).click();
    await expect(page).toHaveURL(/\/company\/tickets/);
    await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();
  });

  test("platform admin is shown Access Restricted", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#individual-email").fill("admin@supportpilot.com");
    await page.locator("#individual-password").fill("Admin@SupportPilot2026!");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    await page.goto("/company/dashboard");
    await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
  });
});
