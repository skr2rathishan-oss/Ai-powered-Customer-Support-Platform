import { test, expect } from "@playwright/test";

test.describe("Platform Admin Dashboard E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("unauthenticated user accessing /admin/dashboard is redirected to login", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("Platform Admin signs in and accesses Platform Admin Dashboard", async ({
    page,
  }) => {
    await page.goto("/login");

    // Fill Platform Admin credentials using specific IDs
    await page.locator("#individual-email").fill("admin@supportpilot.com");
    await page.locator("#individual-password").fill("Admin@SupportPilot2026!");

    // Submit login
    await page.locator('button[type="submit"]').click();

    // Verify redirection to /admin/dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    // Verify main components rendered
    await expect(page.getByText("Platform Overview")).toBeVisible();
    await expect(page.getByText("Total Companies")).toBeVisible();
    await expect(page.getByText("Active Companies")).toBeVisible();
    await expect(page.getByText("Platform Growth")).toBeVisible();
    await expect(page.getByText("Distribution")).toBeVisible();
    await expect(page.getByText("Recent Registrations")).toBeVisible();
    await expect(page.getByText("Platform Health")).toBeVisible();
  });
});
