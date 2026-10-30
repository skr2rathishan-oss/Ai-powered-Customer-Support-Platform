import { test, expect, type Page } from "@playwright/test";

// Requires the mock backend: E2E_SERVER_COMMAND="npm run mock" npx playwright test customerChat
async function signInAsCasey(page: Page) {
  await page.goto("/login");
  await page.locator("#individual-email").fill("casey@customer.example");
  await page.locator("#individual-password").fill("Customer@2026!");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/support$/, { timeout: 10000 });
}

async function ask(page: Page, text: string) {
  await page.getByLabel("Message Acme Assistant").fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

test.describe("Customer AI chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("the assistant answers from the FAQs and escalates what it can't answer to an agent", async ({ page }) => {
    await signInAsCasey(page);
    await page.getByRole("link", { name: "Chat with Acme Assistant" }).click();
    await expect(page).toHaveURL(/\/support\/chat$/);
    await expect(page.getByText("Welcome to Acme support.")).toBeVisible();

    await ask(page, "What are your support hours?");
    await expect(page.getByText("Our team answers tickets Monday to Friday, 9am to 6pm.")).toBeVisible();

    await ask(page, "My parcel was delivered to the wrong city");
    await expect(page.getByText("I couldn't find an answer to that in our help articles.")).toBeVisible();
    await ask(page, "It was sent to Kandy instead of Colombo");

    await expect(page.getByText("An Acme agent will take over.")).toBeVisible();
    await expect(page.getByText(/I've created ticket #\d+ and .+ from our team will take it from here/)).toBeVisible();
    await expect(page.getByText("This conversation was handed to our support team.")).toBeVisible();
    await expect(page.getByLabel("Message Acme Assistant")).toHaveCount(0);
    await page.screenshot({ path: "test-results/chat-escalated.png", fullPage: true });

    await page.getByRole("link", { name: /View ticket #\d+/ }).click();
    await expect(page).toHaveURL(/\/support\/tickets\/\d+$/);
    await expect(page.getByText("My parcel was delivered to the wrong city").first()).toBeVisible();
  });

  test("the customer can ask for a person or close the chat as solved", async ({ page }) => {
    await signInAsCasey(page);
    await page.goto("/support/chat");

    await ask(page, "Which plans include API access?");
    await expect(page.getByText("API access is included in the Pro and Enterprise plans.")).toBeVisible();
    await page.getByRole("button", { name: "That solved it" }).click();
    await expect(page.getByText("Glad I could help! This conversation is now closed.")).toBeVisible();

    await page.getByRole("button", { name: "New chat" }).click();
    await ask(page, "Hello there");
    await page.getByRole("button", { name: "Talk to a person" }).click();
    await expect(page.getByText(/I've created ticket #\d+/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/chat-mobile.png", fullPage: true });
  });
});
