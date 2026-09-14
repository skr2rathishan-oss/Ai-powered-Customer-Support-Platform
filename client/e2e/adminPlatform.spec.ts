import { test, expect } from "@playwright/test";

test.describe("Platform Admin Companies & Settings E2E Suite", () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await page.context().clearCookies();
  });

  test("1. Unauthenticated users cannot access /admin/companies or /admin/settings", async ({ page }) => {
    await page.goto("/admin/companies");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("2. Platform Admin sign-in, navigate to Companies Directory, filter, inspect drawer", async ({
    page,
  }) => {
    // Sign in
    await page.goto("/login");
    await page.locator("#individual-email").fill("admin@supportpilot.com");
    await page.locator("#individual-password").fill("Admin@SupportPilot2026!");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    // Navigate to Companies Directory
    await page.goto("/admin/companies");
    await expect(page).toHaveURL(/\/admin\/companies/);

    // Verify Title and KPI stat cards
    await expect(page.getByRole("heading", { name: "Enterprise Companies" })).toBeVisible();
    await expect(page.getByText("Total Enterprises")).toBeVisible();
    await expect(page.getByText("Active & Verified")).toBeVisible();
    await expect(page.getByText("Pending Review")).toBeVisible();
    await expect(page.getByText("Suspended Tenants")).toBeVisible();

    // Verify Filter pills
    const allTab = page.locator("button", { hasText: "All" }).first();
    await expect(allTab).toBeVisible();

    // Test Search input
    const searchInput = page.locator('input[placeholder*="Search by name"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("SupportPilot");
    await page.waitForTimeout(500);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Check if table contains rows or empty state
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // If there are company rows, click "Inspect" on the first row
    const inspectBtn = page.locator('button:has-text("Inspect")').first();
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click();
      // Verify detail drawer opens
      await expect(page.getByText("Enterprise Profile")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Account Status")).toBeVisible();
      // Close modal
      const closeBtn = page.locator('button:has-text("close")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });

  test("3. Platform Settings navigation, tab switching, and live diagnostics", async ({
    page,
  }) => {
    // Sign in
    await page.goto("/login");
    await page.locator("#individual-email").fill("admin@supportpilot.com");
    await page.locator("#individual-password").fill("Admin@SupportPilot2026!");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    // Navigate to Settings
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/settings/);

    // Verify Title & Navigation Tabs
    await expect(page.getByRole("heading", { name: "System Settings & Telemetry" })).toBeVisible();
    await expect(page.getByRole("button", { name: "General & Branding" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Security & Auth" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Email & SMTP Gateway" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Copilot & Models" })).toBeVisible();
    await expect(page.getByRole("button", { name: "System Telemetry" })).toBeVisible();

    // 1. General Tab - Save
    const saveGeneralBtn = page.getByRole("button", { name: "Save General Settings" });
    await expect(saveGeneralBtn).toBeVisible();
    await saveGeneralBtn.click();
    await expect(page.getByText("Platform configurations saved successfully.")).toBeVisible({ timeout: 5000 });

    // 2. Switch to Security Tab
    await page.getByRole("button", { name: "Security & Auth" }).click();
    await expect(page.getByText("Authentication & Access Security")).toBeVisible();
    const saveSecurityBtn = page.getByRole("button", { name: "Save Security Policy" });
    await expect(saveSecurityBtn).toBeVisible();
    await saveSecurityBtn.click();
    await expect(page.getByText("Platform configurations saved successfully.")).toBeVisible({ timeout: 5000 });

    // 3. Switch to Email / SMTP Tab
    await page.getByRole("button", { name: "Email & SMTP Gateway" }).click();
    await expect(page.getByText("Gmail SMTP Gateway Configuration")).toBeVisible();
    await expect(page.getByText("Live Diagnostic Email Sender")).toBeVisible();

    // 4. Switch to AI Copilot Tab
    await page.getByRole("button", { name: "AI Copilot & Models" }).click();
    await expect(page.getByText("AI Copilot & Model Intelligence")).toBeVisible();
    await expect(page.getByText("Default AI Foundation Model")).toBeVisible();

    // 5. Switch to System Telemetry Tab
    await page.getByRole("button", { name: "System Telemetry" }).click();
    await expect(page.getByText("Infrastructure & System Telemetry")).toBeVisible();
    await expect(page.getByText("MySQL Database Pool")).toBeVisible();
    await expect(page.getByText("MongoDB Atlas Cluster")).toBeVisible();
    await expect(page.getByText("Node.js Runtime")).toBeVisible();

    // Ping systems
    const pingBtn = page.getByRole("button", { name: "Ping Systems" });
    await expect(pingBtn).toBeVisible();
    await pingBtn.click();
    await expect(page.getByText("System Status")).toBeVisible();
  });
});
