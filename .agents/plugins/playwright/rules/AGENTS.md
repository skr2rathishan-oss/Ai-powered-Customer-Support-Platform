# Playwright MCP Testing Guidelines

This project uses the **Playwright MCP Server** (`@playwright/mcp`) for end-to-end browser testing and user journey validation.

## Local Test Endpoints
- **Frontend App**: `http://localhost:5173/` (Landing page)
- **Login Page**: `http://localhost:5173/login` (Individual / Company toggle)
- **Company Registration**: `http://localhost:5173/company/register`
- **Backend API**: `http://localhost:5000/api`
- **Google OAuth**: `http://localhost:5000/api/auth/google`

## Core Test Scenarios
1. **Landing Page Navigation**: Verify hero section, features, solution vertical switchers, pricing cards, FAQ accordion, and demo modal opening.
2. **Auth & Role Switching**: Test switching between Individual and Company sign-in views.
3. **Form Validation**: Test client-side field validation for invalid emails, weak passwords, and required company registration fields.
4. **Google Sign-In Trigger**: Verify clicking "Continue with Google" navigates to the Google OAuth initiation endpoint.

