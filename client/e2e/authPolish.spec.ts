import { test, expect, type Page } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test authPolish
const API = "http://127.0.0.1:5000";

const ACCOUNTS = {
  agent: { accountType: "individual", email: "agent@acme-demo.com", password: "CompanyAdmin@2026!", home: /\/agent\/tickets$/ },
  customer: { accountType: "individual", email: "casey@customer.example", password: "Customer@2026!", home: /\/support\/tickets$/ },
  company: { accountType: "company", email: "owner@acme-demo.com", password: "CompanyAdmin@2026!", home: /\/company\/dashboard$/ },
  admin: { accountType: "individual", email: "admin@supportpilot.com", password: "Admin@SupportPilot2026!", home: /\/admin\/dashboard$/ },
} as const;

async function signInViaApi(page: Page, who: keyof typeof ACCOUNTS) {
  const { accountType, email, password } = ACCOUNTS[who];
  const response = await page.request.post(`${API}/api/auth/sign-in`, {
    data: { accountType, email, password },
  });
  expect(response.ok()).toBeTruthy();
}

test.describe("Public and auth polish", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("footer links go to real pages and in-page anchors resolve", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");

    await expect(footer.locator('a[href="#hero"]')).toHaveCount(0);
    await expect(footer.locator('a[href="/register"]')).toHaveCount(1);

    const anchors = await page.locator('a[href^="#"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") as string),
    );
    for (const href of new Set(anchors)) {
      if (href === "#") continue;
      await expect(page.locator(`[id="${href.slice(1)}"]`), `anchor ${href}`).toHaveCount(1);
    }

    await footer.getByRole("link", { name: "Terms of Service" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { name: "Terms of Service", level: 1 })).toBeVisible();

    await page.goto("/");
    await page.locator("footer").getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();
  });

  test("login page shows the Google button only when the server reports it", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.locator(".divider")).toBeVisible();

    await page.route("**/api/auth/providers", (route) =>
      route.fulfill({ json: { success: true, data: { google: false } } }),
    );
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in", exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
    await expect(page.locator(".divider")).toHaveCount(0);

    await page.unroute("**/api/auth/providers");
    await page.route("**/api/auth/providers", (route) =>
      route.fulfill({ status: 500, json: { success: false, message: "boom" } }),
    );
    await page.goto("/login");
    await expect(page.locator(".legal-copy")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
    await expect(page.locator(".divider")).toHaveCount(0);
  });

  test("Google sign-in via the mock lands on the right home", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/support\/tickets$/, { timeout: 15000 });

    await page.context().clearCookies();
    await page.goto(`${API}/api/auth/google?as=agent`);
    await expect(page).toHaveURL(/\/agent\/tickets$/, { timeout: 15000 });
  });

  test("Google error codes show a message and the param is stripped", async ({ page }) => {
    await page.goto("/login?error=google_no_account");
    await expect(page.getByText("No SupportPilot account found for that Google email")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto(`${API}/api/auth/google?fail=no_account`);
    await expect(page.getByText("No SupportPilot account found for that Google email")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("/auth/callback without a session returns to login with a failure message", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 });
    await expect(page.getByText("Google sign-in failed or was cancelled")).toBeVisible();
  });

  for (const who of ["agent", "customer", "company", "admin"] as const) {
    test(`signed-in ${who} visiting /login is sent to their home`, async ({ page }) => {
      await signInViaApi(page, who);
      await page.goto("/login");
      await expect(page).toHaveURL(ACCOUNTS[who].home, { timeout: 15000 });
    });
  }

  test("signed-in visitors are also redirected away from sign-up pages", async ({ page }) => {
    await signInViaApi(page, "customer");
    await page.goto("/register");
    await expect(page).toHaveURL(/\/support\/tickets$/, { timeout: 15000 });
  });

  test("a customer in the wrong area gets a link back to their workspace", async ({ page }) => {
    await signInViaApi(page, "customer");

    for (const path of ["/agent/tickets", "/company/dashboard"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible({ timeout: 15000 });
      const link = page.getByRole("link", { name: "Go to my workspace" });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/support/tickets");
    }

    await page.getByRole("link", { name: "Go to my workspace" }).click();
    await expect(page).toHaveURL(/\/support\/tickets$/);
  });

  test("unknown URLs show the not-found page", async ({ page }) => {
    await page.goto("/does-not-exist");
    await expect(page).toHaveURL(/\/does-not-exist$/);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:5173\/$/);

    await signInViaApi(page, "agent");
    await page.goto("/does-not-exist");
    await page.getByRole("link", { name: "Go to my workspace" }).click();
    await expect(page).toHaveURL(/\/agent\/tickets$/, { timeout: 15000 });
  });
});
