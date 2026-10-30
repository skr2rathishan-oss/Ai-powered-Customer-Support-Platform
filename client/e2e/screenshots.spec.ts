import { test, expect, type Page } from "@playwright/test";

// Captures the README / report screenshots into docs/screenshots. Opt-in and
// uses the mock backend:
//   CAPTURE_SCREENSHOTS=1 E2E_SERVER_COMMAND="npm run mock" npx playwright test screenshots
const OUT = "../docs/screenshots";

test.skip(!process.env.CAPTURE_SCREENSHOTS, "Set CAPTURE_SCREENSHOTS=1 to refresh the documentation screenshots");

async function signIn(page: Page, mode: "individual" | "company", email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(mode === "company" ? "/login/company" : "/login");
  await page.evaluate(() => localStorage.clear());
  await page.goto(mode === "company" ? "/login/company" : "/login");
  await page.locator(`#${mode}-email`).fill(email);
  await page.locator(`#${mode}-password`).fill(password);
  await page.locator('button[type="submit"]').click();
}

async function shot(page: Page, name: string) {
  // The landing page keeps loading media, so wait for load plus a moment for data
  await page.waitForLoadState("load");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

test("public and authentication pages", async ({ page }) => {
  await page.goto("/");
  await shot(page, "01-landing");
  await page.goto("/login");
  await shot(page, "02-login");
});

test("platform admin pages", async ({ page }) => {
  await signIn(page, "individual", "admin@supportpilot.com", "Admin@SupportPilot2026!");
  await expect(page.getByRole("heading", { name: "Platform Overview" })).toBeVisible({ timeout: 15000 });
  await shot(page, "03-admin-dashboard");

  await page.goto("/admin/companies");
  await expect(page.getByRole("heading", { name: "Enterprise Companies" })).toBeVisible();
  await shot(page, "04-admin-companies");

  await page.getByRole("button", { name: "Onboard Enterprise" }).click();
  await page.getByRole("dialog", { name: "Onboard Enterprise" }).getByRole("button", { name: "Onboard Company" }).click();
  await shot(page, "05-admin-onboard-validation");
});

test("company admin pages", async ({ page }) => {
  await signIn(page, "company", "owner@acme-demo.com", "CompanyAdmin@2026!");
  await expect(page.getByRole("heading", { name: "Ticket activity" })).toBeVisible({ timeout: 15000 });
  await shot(page, "06-company-dashboard");

  await page.goto("/company/faqs");
  await expect(page.getByRole("heading", { name: "FAQs", level: 1 })).toBeVisible();
  await shot(page, "07-company-faqs");
  await page.getByRole("button", { name: "Add FAQ" }).first().click();
  await shot(page, "08-company-faq-form");

  await page.goto("/company/tickets");
  await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();
  await shot(page, "09-company-tickets");

  await page.goto("/company/agents");
  await expect(page.getByRole("heading", { name: "Agents", level: 1 })).toBeVisible();
  await shot(page, "10-company-agents");

  await page.goto("/company/ai-settings");
  await expect(page.getByRole("heading", { name: "AI Settings", level: 1 })).toBeVisible();
  await shot(page, "11-company-ai-settings");
});

test("customer AI chat, escalation and agent handling", async ({ page }) => {
  await signIn(page, "individual", "casey@customer.example", "Customer@2026!");
  await expect(page.getByRole("heading", { name: /How can we help\?/ })).toBeVisible({ timeout: 15000 });
  await shot(page, "12-customer-dashboard");

  await page.goto("/support/chat");
  const input = page.getByLabel("Message Acme Assistant");
  await input.fill("What are your support hours?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Monday to Friday")).toBeVisible();
  await input.fill("My parcel was delivered to the wrong city");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("I couldn't find an answer")).toBeVisible();
  await shot(page, "13-customer-ai-chat");

  await page.getByRole("button", { name: "Talk to a person" }).click();
  await expect(page.getByText(/I've created ticket #\d+/)).toBeVisible();
  await shot(page, "14-customer-chat-escalated");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/support");
  await expect(page.getByRole("heading", { name: /How can we help\?/ })).toBeVisible();
  await shot(page, "15-customer-dashboard-mobile");
});

test("support agent pages", async ({ page }) => {
  await signIn(page, "individual", "agent@acme-demo.com", "CompanyAdmin@2026!");
  await expect(page.getByRole("heading", { name: "Waiting to start" })).toBeVisible({ timeout: 15000 });
  await shot(page, "16-agent-dashboard");

  await page.goto("/agent/tickets");
  await expect(page.getByRole("heading", { name: "My queue", level: 1 })).toBeVisible();
  await shot(page, "17-agent-queue");
});
