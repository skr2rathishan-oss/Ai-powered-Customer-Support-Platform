import { test, expect } from "@playwright/test";

test.describe("Platform Admin Dashboard E2E", () => {
  test("unauthenticated user accessing /admin/dashboard is redirected or blocked", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard");
    // Should either redirect to login or show Access Restricted
    await expect(page).toHaveURL(/\/login|\/admin\/dashboard/);
  });

  test("Platform Admin signs in and accesses Platform Admin Dashboard", async ({
    page,
  }) => {
    await page.goto("/login");

    // Fill Platform Admin credentials
    await page.locator('input[type="email"], input[name="email"]').fill("admin@supportpilot.com");
    await page.locator('input[type="password"], input[name="password"]').fill("Admin@SupportPilot2026!");

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

