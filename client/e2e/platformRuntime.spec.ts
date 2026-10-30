import { test, expect, type Page } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test platformRuntime
const API = "http://127.0.0.1:5000";
const ADMIN = {
  accountType: "individual",
  email: "admin@supportpilot.com",
  password: "Admin@SupportPilot2026!",
};

type SettingsPatch = Record<string, Record<string, unknown>>;

async function updateSettings(page: Page, patch: SettingsPatch) {
  const signIn = await page.request.post(`${API}/api/auth/sign-in`, { data: ADMIN });
  expect(signIn.ok()).toBeTruthy();
  const response = await page.request.put(`${API}/api/admin/settings`, { data: patch });
  expect(response.ok()).toBeTruthy();
  await page.context().clearCookies();
}

const RESET: SettingsPatch = {
  infrastructure: { maintenanceMode: false },
  general: { allowSelfRegistration: true },
  security: { minPasswordLength: 8, requireSpecialChar: true },
};

test.describe("Runtime platform settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await updateSettings(page, RESET);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test.afterEach(async ({ page }) => {
    await updateSettings(page, RESET);
  });

  test("public platform endpoint exposes only the allowlisted fields", async ({ page }) => {
    const response = await page.request.get(`${API}/api/public/platform`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Object.keys(body.data).sort()).toEqual([
      "allowSelfRegistration",
      "maintenanceMode",
      "passwordPolicy",
      "platformName",
      "platformNotice",
    ]);
  });

  test("maintenance mode shows the banner and blocks non-admin API calls", async ({ page }) => {
    await expect(page.getByTestId("maintenance-banner")).toHaveCount(0);

    await updateSettings(page, { infrastructure: { maintenanceMode: true } });

    const blocked = await page.request.get(`${API}/api/customer/me`);
    expect(blocked.status()).toBe(503);
    expect((await blocked.json()).code).toBe("MAINTENANCE_MODE");
    expect((await page.request.get(`${API}/health`)).ok()).toBeTruthy();

    await page.goto("/login");
    await expect(page.getByTestId("maintenance-banner")).toBeVisible();
    await expect(page.getByTestId("maintenance-banner")).toContainText("maintenance");

    // Platform Admins can still sign in and see the softer reminder
    const adminSignIn = await page.request.post(`${API}/api/auth/sign-in`, { data: ADMIN });
    expect(adminSignIn.ok()).toBeTruthy();
    await page.goto("/admin/settings");
    await expect(page.getByTestId("maintenance-banner")).toContainText("Maintenance mode is ON");
  });

  test("non-admin sign-in is refused during maintenance", async ({ page }) => {
    await updateSettings(page, { infrastructure: { maintenanceMode: true } });
    const response = await page.request.post(`${API}/api/auth/sign-in`, {
      data: { accountType: "individual", email: "casey@customer.example", password: "Customer@2026!" },
    });
    expect(response.status()).toBe(503);
  });

  test("closing self-registration hides sign-up links and shows a closed notice", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href="/company/register"]').first()).toBeVisible();

    await updateSettings(page, { general: { allowSelfRegistration: false } });

    await page.goto("/");
    await expect(page.locator('a[href="/company/register"]')).toHaveCount(0);
    await expect(page.locator('a[href="/register"]')).toHaveCount(0);

    await page.goto("/login");
    await expect(page.getByText("Need support from a company?")).toHaveCount(0);

    await page.goto("/register");
    await expect(page.getByTestId("registration-closed")).toBeVisible();
    await page.goto("/company/register");
    await expect(page.getByTestId("registration-closed")).toBeVisible();

    const response = await page.request.post(`${API}/api/auth/customer/register`, {
      data: {
        firstName: "Casey",
        lastName: "Closed",
        email: "closed@customer.example",
        password: "Customer@2026!",
        companyId: 1,
      },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe("REGISTRATION_DISABLED");
  });

  test("password policy hint and validation follow the stored policy", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByTestId("customer-password-hint")).toContainText("8–128 characters");

    await updateSettings(page, { security: { minPasswordLength: 12, requireSpecialChar: false } });

    await page.goto("/register");
    await expect(page.getByTestId("customer-password-hint")).toContainText("12–128 characters");
    await expect(page.getByTestId("customer-password-hint")).not.toContainText("symbol");

    const password = page.locator("#customer-password");
    await password.fill("Short1Aa");
    await password.blur();
    await expect(page.getByRole("alert").filter({ hasText: "12–128" })).toBeVisible();
  });
});
