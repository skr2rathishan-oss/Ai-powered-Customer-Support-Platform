import { test, expect } from "@playwright/test";

test.describe("SupportPilot E2E Tests", () => {
  test("Landing page loads and displays hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav").getByText("SupportPilot")).toBeVisible();
    await expect(page.getByText("human-centric", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Login$/i })).toBeVisible();
  });

  test("Navbar Login button navigates to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^Login$/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#individual-email")).toBeVisible();
  });

  test("Auth mode switcher toggles between Individual and Company forms", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#individual-email")).toBeVisible();

    // Switch to Company tab
    await page.getByRole("tab", { name: /Company Sign In/i }).click();
    await expect(page).toHaveURL(/\/login\/company/);
    await expect(page.locator("#company-email")).toBeVisible();
    await expect(page.getByRole("link", { name: /Register now/i })).toBeVisible();

    // Switch back to Individual tab
    await page.getByRole("tab", { name: /Individual Sign In/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("#individual-email")).toBeVisible();
  });

  test("Form validation shows error for invalid email", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.locator("#individual-email");
    await emailInput.fill("invalid-email");
    await emailInput.blur();
    await expect(page.locator("text=Enter a valid email address.")).toBeVisible();
  });

  test("In-place Forgot Password section replaces popup dialog seamlessly", async ({ page }) => {
    await page.goto("/login");
    // Verify modal backdrop is NOT present
    await expect(page.locator(".dialog-backdrop")).toHaveCount(0);

    // Click Forgot Password?
    await page.getByRole("button", { name: /Forgot Password\?/i }).click();

    // Verify in-place Forgot Password section rendered without modal popup
    await expect(page.locator(".dialog-backdrop")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Password recovery" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Reset password/i })).toBeVisible();
    await expect(page.locator("#forgot-password-email")).toBeVisible();

    // Test validation
    await page.getByRole("button", { name: /Send Reset Link/i }).click();
    await expect(page.getByText("Please enter your email address.")).toBeVisible();

    // Fill valid email and send
    await page.locator("#forgot-password-email").fill("test.user@example.com");
    await page.getByRole("button", { name: /Send Reset Link/i }).click();
    await expect(page.getByText("Check your inbox")).toBeVisible();
    await expect(page.getByText("test.user@example.com")).toBeVisible();

    // Return to sign in
    await page.getByRole("button", { name: /Return to Sign In/i }).click();
    await expect(page.locator("#individual-email")).toBeVisible();
  });

  test("Google Sign-In button is rendered with branding", async ({ page }) => {
    await page.goto("/login");
    const googleButton = page.locator("button.google-button");
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toContainText("Continue with Google");
  });
});
