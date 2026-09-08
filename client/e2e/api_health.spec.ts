import { test, expect } from "@playwright/test";

test.describe("Backend API & System Health E2E Tests", () => {
  const BACKEND_URL = "http://localhost:5000";

  test("Backend /health endpoint returns 200 OK", async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  test("Google OAuth initiation endpoint redirects without 404", async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/auth/google`, {
      maxRedirects: 0,
    });
    // 302 Found redirecting to accounts.google.com
    expect(response.status()).toBe(302);
    const location = response.headers()["location"];
    expect(location).toContain("accounts.google.com/o/oauth2");
  });

  test("Sign-in endpoint validates account credentials correctly", async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/api/auth/sign-in`, {
      data: {
        accountType: "individual",
        email: "nonexistent.user@example.com",
        password: "WrongPassword@123",
      },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain("Invalid email or password");
  });

  test("Company registration endpoint validates required fields", async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/api/auth/company/register`, {
      data: {
        companyName: "",
        businessEmail: "invalid-email",
      },
    });
    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});

