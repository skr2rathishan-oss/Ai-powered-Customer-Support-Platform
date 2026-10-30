import { test, expect, type Page } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test roleDashboards
async function signIn(page: Page, mode: "individual" | "company", email: string, password: string) {
  await page.goto(mode === "company" ? "/login/company" : "/login");
  await page.locator(`#${mode}-email`).fill(email);
  await page.locator(`#${mode}-password`).fill(password);
  await page.locator('button[type="submit"]').click();
}

test.describe("Role dashboards", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("company admin dashboard shows ticket analytics and agent workload", async ({ page }) => {
    await signIn(page, "company", "owner@acme-demo.com", "CompanyAdmin@2026!");
    await expect(page).toHaveURL(/\/company\/dashboard$/, { timeout: 10000 });

    await expect(page.getByRole("heading", { name: /, Ada$/ })).toBeVisible();
    for (const heading of ["Ticket activity", "Status breakdown", "Recent tickets", "Agent workload", "Getting started"]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(page.getByText("new tickets in the last 7 days")).toBeVisible();
    await page.screenshot({ path: "test-results/dashboard-company.png", fullPage: true });

    await page.getByRole("link", { name: "View all →" }).click();
    await expect(page).toHaveURL(/\/company\/tickets$/);
  });

  test("support agent lands on their dashboard with prioritised work", async ({ page }) => {
    await signIn(page, "individual", "agent@acme-demo.com", "CompanyAdmin@2026!");
    await expect(page).toHaveURL(/\/agent\/dashboard$/, { timeout: 10000 });

    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Waiting to start" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "In progress" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My tickets" })).toBeVisible();
    await page.screenshot({ path: "test-results/dashboard-agent.png", fullPage: true });

    await page.getByRole("link", { name: "Open my queue" }).click();
    await expect(page).toHaveURL(/\/agent\/tickets$/);
  });

  test("customer lands on their dashboard with tickets and help", async ({ page }) => {
    await signIn(page, "individual", "casey@customer.example", "Customer@2026!");
    await expect(page).toHaveURL(/\/support$/, { timeout: 10000 });

    await expect(page.getByRole("heading", { name: /How can we help\?/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My recent tickets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Popular answers" })).toBeVisible();

    const orders = page.getByRole("region", { name: "My orders" });
    await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
    await expect(orders.getByText("AC-10517")).toBeVisible();
    await expect(orders.getByText("Denim Trucker Jacket")).toBeVisible();
    await expect(orders.getByText(/AX7731942LK/)).toBeVisible();
    await page.screenshot({ path: "test-results/dashboard-customer.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/dashboard-customer-mobile.png", fullPage: true });

    await page.getByRole("link", { name: "New ticket" }).first().click();
    await expect(page).toHaveURL(/\/support\/tickets\/new$/);
  });
});
