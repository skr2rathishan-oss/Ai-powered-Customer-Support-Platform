# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SupportPilot is a multi-tenant AI customer support platform. It is split into two independent npm projects with no root `package.json`:

- `server/`: Express 5 API in CommonJS JavaScript, port 5000
- `client/`: React 19 + Vite 7 + TypeScript + Tailwind v4 SPA, port 5173, routed with `react-router` v8

Run `npm install` separately in each directory.

## Commands

### Server (`cd server`)
```bash
npm run dev            # nodemon index.js (needs MongoDB + MySQL reachable; see .env.example)
npm start              # node index.js
npm test               # node --test (built-in Node test runner, all test/**/*.test.js)
npm run test:auth      # validator + authService + auth API tests
npm run test:admin     # admin dashboard/companies/settings API tests
npm run test:db        # real DB connectivity test (sets RUN_DB_TESTS=true)
npm run test:smtp      # scripts/test-smtp.js: verify SMTP credentials
node --test test/api/passwordReset.test.js   # run a single test file
```
Unit and API tests do not need a database, because they inject mock models (see "Dependency injection" below). Only `test:db` touches real databases.

### Client (`cd client`)
```bash
npm run dev            # vite on 127.0.0.1:5173 (--strictPort)
npm run build          # tsc -b && vite build (type-check + bundle)
npm run lint           # eslint .
npm run test:e2e       # Playwright (chromium, workers: 1)
npx playwright test e2e/auth.spec.ts          # single spec
npx playwright test -g "Unauthenticated"      # single test by title
```
`playwright.config.ts` starts both `../server` (`node index.js` with `NODE_ENV=test`) and the Vite dev server, and reuses them if they are already running. Because the server's startup connects to MongoDB and MySQL, e2e runs need working DB credentials in `server/.env`. The e2e specs sign in with the seeded Platform Admin account: `admin@supportpilot.com` / `Admin@SupportPilot2026!`.

## Server architecture

`index.js` loads dotenv, connects **both** MongoDB (mongoose) and MySQL (mysql2 pool) in parallel, then listens. `src/app.js` exports `createApp(dependencies)`, which builds the Express app without connecting to any database.

**Layering:** `routes/` → `middleware/validateRequest` → `controllers/` → `services/` → `models/`. Routes, controllers and services are factories: `createAuthRouter(authService, { passport })`, `createAdminController(adminService)`, `createAuthService(deps)`.

**Dependency injection:** `createApp(deps)` passes `deps` into the service factories, and each factory falls back to the real module for anything not supplied. For example, `createAuthService` uses `deps.userModel || userModel`. API tests call `createApp({ adminModel: mock, ... })`, listen on port 0 and hit the endpoints with `fetch`. New services and models should follow this pattern so they stay testable without a DB.

**Data stores:**
- MySQL is the primary relational store. Models in `src/models/` run raw SQL through `getMySQLPool()`, with no ORM. Core tables are `users`, `roles`, `companies`, `company_admins` and `password_reset_tokens`. There is no migration tool; `initMySQLSchema()` in `config/database.js` adds missing columns and tables idempotently at startup. TLS is enabled when `MYSQL_CA_PATH` is set (e.g. `certificates/isrgrootx1.pem` for TiDB Cloud).
- MongoDB is connected, but at present it is only used for health and diagnostics reporting in `adminService`.
- Platform settings (`GET/PUT /api/admin/settings`) are kept **in memory** (`platformSettingsState` in `services/adminService.js`). They are not persisted and reset when the server restarts.

**Errors:** throw `new AppError(message, statusCode, code, errors[])` from `utils/AppError.js`, and wrap async handlers in `utils/asyncHandler`. `middleware/errorHandler.js` formats every error as `{ success: false, message, code?, errors? }`, and successful responses use `{ success: true, data }`.

**Auth** (details in `server/AUTHENTICATION.md`):
- There are two sign-in account types, `individual` and `company`, and the service never falls back from one to the other. Company sign-in matches `companies.business_email` (or the admin's email) and verifies the password of the linked `company_admins` user.
- The JWT (`utils/token.js`) is set as an HTTP-only cookie (`utils/authCookie.js`) **and** returned in the JSON body. The client stores it in localStorage and sends it as `Authorization: Bearer`. `middleware/authenticate.js` accepts either the cookie or the header. `AUTHENTICATION.md` still says the token is left out of the JSON response, which is out of date.
- Role guards are `requireRole("Platform Admin")` and `requireAccountType(...)`. All `/api/admin/*` routes require the Platform Admin role.
- Google OAuth runs through Passport (`config/passport.js`), and password reset emails go out through Nodemailer (`services/emailService.js`, Gmail SMTP).
- The auth router is mounted at both `/api/auth` and `/auth`. `GET /health` is unauthenticated.

## Client architecture

- Every route path is defined in `src/router/routes.ts` (`ROUTES`) and wired up in `src/router/index.tsx`. When you add a page, register it in both files.
- `src/pages/` holds route-level pages grouped by area (`landing/`, `auth/`, `admin/`), and `src/components/<area>/` holds their building blocks.
- All HTTP requests go through `apiRequest()` in `src/services/apiClient.ts`. It sends `credentials: "include"` plus the Bearer token from localStorage and throws `ApiError(message, status, payload)`. Domain wrappers live in `src/services/{auth,admin,leads}.ts`.
- The API base URL comes from `VITE_API_BASE_URL` (`client/.env`), defaulting to `http://localhost:5000`. The server's CORS allowlist covers `CLIENT_ORIGIN` plus localhost and 127.0.0.1 on ports 5173 and 5000. If you change hosts or ports, update the allowlist too.
- Admin pages are wrapped in `components/admin/AdminRouteGuard.tsx`. The guard checks the stored user first, confirms it with `GET /api/auth/me`, and redirects to `/login` if that request fails.
- Form validation for company registration is in `src/validation/`, and shared types are in `src/types/`.

## Repo notes

- `awesome-design-md/` is a vendored third-party collection of design references and is not part of the app.
- `.agents/plugins/playwright/rules/AGENTS.md` lists the core e2e scenarios to cover: landing page navigation, switching between individual and company login, form validation, and the Google sign-in redirect.
