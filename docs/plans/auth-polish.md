# Plan: Public/auth polish (PROGRESS item 10)

Scope: dead links, Google OAuth UI wiring, role-based redirects, 404 page. Small, one run.
Rules: no DB, never run `npm start`/`node index.js`/dev server in `server/`, no `server/.env`. Verify with `cd server && npm test`, `cd client && npm run lint && npm run build`, Playwright against `cd server && npm run mock`.

## 1. Audit findings

Landing (`client/src/components/landing/*`)
- Anchor targets all exist: `#hero` (HeroSection), `#features`, `#solutions`, `#pricing`, `#faq`. Navbar links OK. Register CTAs go to `/company/register` (Hero, Cta, Pricing, Solutions, Navbar, Footer). OK.
- Footer dead-ish links (all point at `#hero`, no real destination): Terms of Service, Privacy Policy, Security, Status, API Docs, About Us, and the 3 social icons (`#hero`/`#faq`/`#pricing` with misleading aria-labels).
- No link to the customer sign-up `/register` anywhere on the landing page (only inside the login form).
- FaqSection "Still have questions" buttons have handlers (onContactSales/onLiveChat); the `#features` anchor is fine.

Auth (`pages/auth`, `components/auth`)
- `AuthPage.tsx` legal copy links `#terms` / `#privacy`: no targets (dead).
- Google button always renders and navigates to `${API_BASE_URL}/api/auth/google`, even when Google is not configured (passport falls back to `dummy-google-client-id`, so users reach a Google error page).
- LoginForm already links to `/company/register` and `/register`; Company/Customer register forms link back to login. ResetPassword success uses `navigate(ROUTES.LOGIN)` (fine, login page then redirects an authed user; reset does not sign in).
- Router: catch-all `*` silently `Navigate`s to `/` (no 404 page). Admin routes have no route-level guard element (each page wraps AdminRouteGuard; leave).

Google OAuth (server)
- Start: `GET /api/auth/google` (also `/auth/google`), scope profile+email, `session:false`. Callback: `GET /api/auth/google/callback`. Failure -> `${CLIENT_ORIGIN}/login?error=google_auth_failed`. Success -> sets the httpOnly auth cookie (`setAuthCookie`) and redirects to `${CLIENT_ORIGIN}/login?authenticated=true`. AuthPage then calls `/api/auth/me` and redirects via `homeForRole`. So the token handoff is already cookie-based: NO token ever appears in a URL. Keep it (safest; works on same site: localhost:5173 and localhost:5000 share cookies; cross-site prod needs same registrable domain or `JWT_COOKIE_SAME_SITE`, document in PROGRESS).
- Gaps found (server-side, must fix, small):
  a. Config check is inconsistent: `adminService` uses `Boolean(GOOGLE_CLIENT_ID)`; passport accepts `GOOGLE_CLIENT_ID|Google_CLIENT_ID` and falls back to dummy values.
  b. `googleCallback` does not check `accountStatus` (a deactivated agent/customer could get a cookie via Google) nor company status.
  c. Token built with `accountType:"individual"` and `roleName || "Agent"`; Company Admin accounts are `accountType:"company"` with companyId, so a Google token for them is wrong. Customers/agents are DB-verified per request so individual tokens work for them.
  d. `userModel.findOrCreate` auto-creates unknown Google users with role 'Agent'/'User'/'Individual' or `role_id || 1` (could be Platform Admin!). Unacceptable. Smallest safe version: Google is SIGN-IN ONLY for existing accounts (matched by google_id, else linked by email). No auto-create.
- Limitation to document: Google sign-in is not supported for Company Admin accounts (they use company login with the business email) and does not create accounts; unknown email -> `/login?error=google_no_account` ("No SupportPilot account for this Google email. Register first, then use Google to sign in.").

## 2. Server changes

Files: `server/src/config/googleOAuth.js` (new), `server/src/config/passport.js`, `server/src/routes/authRoutes.js`, `server/src/controllers/authController.js`, `server/src/models/userModel.js`, `server/src/services/adminService.js`, `server/scripts/mock-server.js`, `server/AUTHENTICATION.md` (short note).

1. `config/googleOAuth.js`: `isGoogleOAuthConfigured(env = process.env)` -> true only when client id AND secret are non-empty, not the `dummy-*` strings (accept both `GOOGLE_*` and legacy `Google_*` casing). Passport reads ids through the same helper (keep dummy fallback only so the strategy can register).
2. `adminService`: `googleOAuthEnabled: isGoogleOAuthConfigured()`.
3. New public endpoint `GET /api/auth/providers` (and `/auth/providers` via existing alias) -> `200 {success:true,data:{google:boolean}}`, `Cache-Control: no-store`, no secrets, no rate limiter needed (static). Router accepts `dependencies.isGoogleConfigured` for tests (default helper).
4. `GET /api/auth/google` start: if not configured redirect to `${CLIENT_ORIGIN}/login?error=google_not_configured` (no passport call). Use a tiny shared `clientRedirect(res, path, query)` helper in authRoutes/controller so every redirect uses `CLIENT_ORIGIN` (already the case; never take a redirect target from the request).
5. Callback success target changes from `/login?authenticated=true` to `${CLIENT_ORIGIN}/auth/callback` (clean client route; drop the old `?authenticated=true` handling after client migrates, but keep AuthPage handling for one release is not required: remove it).
6. `passport.js`: verify function calls `User.findOrCreate({...}, cb)` with `allowCreate:false`. `userModel.findOrCreate` honours `allowCreate` (default `true` so existing model tests stay green); when false and no match -> `cb(null,false)`; also remove the `role_id || 1` fallback when creating (error instead).
7. `googleCallback` (and the route's passport callback) failure mapping, all redirect to `/login?error=<code>`:
   - no user (not found / `info`) -> `google_no_account`; passport error -> `google_auth_failed`.
   - `accountStatus` present and not Active -> `google_inactive`.
   - roleName not in {Platform Admin, Support Agent, Customer} (incl. Company Admin) -> `google_role_unsupported`.
   - success: token via `authService.generateToken`/`createAccessToken` with the DB `roleName` (no "Agent" fallback), then redirect `/auth/callback`.
   Controller gets `roleName` from the user row (findByEmail/findByGoogleId already return it and accountStatus).

API contract summary
- `GET /api/auth/providers` -> `{success:true,data:{google:boolean}}`.
- `GET /api/auth/google` -> 302 Google, or 302 `/login?error=google_not_configured`.
- `GET /api/auth/google/callback` -> 302 `${CLIENT_ORIGIN}/auth/callback` (cookie set) or `/login?error=<google_auth_failed|google_no_account|google_inactive|google_role_unsupported>`.
- Existing `GET /api/auth/me` supplies `{roleName, accountType}` after callback.

Mock server (`scripts/mock-server.js`): add `GET /api/auth/providers` returning `{google:true}` unless env `MOCK_GOOGLE=false`, and a mock `GET /api/auth/google` that sets the seeded cookie for an account chosen by `?as=customer|agent|admin|company` (mock only; default customer) and redirects to `${CLIENT_ORIGIN or http://127.0.0.1:5173}/auth/callback`; `?fail=no_account` redirects to the matching `/login?error=...`. Keep it behind the mock only. Use the same token/cookie mechanism the mock's sign-in uses (implementer: read the mock's login handler).

## 3. Client changes

Files: `client/src/router/routes.ts` (add `AUTH_CALLBACK:"/auth/callback"`, `TERMS:"/terms"`, `PRIVACY:"/privacy"`), `router/index.tsx`, `router/roleRedirect.ts`, new `pages/auth/AuthCallbackPage.tsx`, new `pages/NotFoundPage.tsx`, new `pages/legal/LegalPage.tsx` (one component, two routes), `pages/auth/AuthPage.tsx`, `components/auth/LoginForm`/google button extraction (optional), `services/auth.ts` (add `getAuthProviders()`), the four route guards, `components/landing/Footer.tsx`, `Navbar.tsx`.

A. Google button (AuthPage)
- On mount call `getAuthProviders()` (use `apiRequest`, swallow errors -> `google:false`). States: loading (button + divider hidden, no layout jump: render nothing until resolved), `google:true` -> render divider + "Continue with Google" navigating to `${API_BASE_URL}/api/auth/google`, `google:false`/error -> hide divider and button entirely (no dead button).
- Login page error banner mapping for `?error=`: `google_auth_failed` "Google sign-in failed or was cancelled. Please try again."; `google_no_account` "No SupportPilot account found for that Google email. Register first, then sign in with Google."; `google_inactive` "This account is not active."; `google_role_unsupported` "Google sign-in is not available for this account type. Use company sign-in."; `google_not_configured` "Google sign-in is not available right now."; unknown -> generic. Strip the query param after reading (`replace`), so refresh does not re-show it. Remove the `authenticated=true` branch.
- Legal links: `<Link to={ROUTES.TERMS}>` and `<Link to={ROUTES.PRIVACY}>` (target `_blank` not needed).

B. `/auth/callback` (AuthCallbackPage)
- No tokens in URL. On mount call `/api/auth/me`; success -> dispatch `supportpilot:authenticated`, `navigate(homeForRole(user.roleName,user.accountType),{replace:true})`; show "Finishing sign-in..." spinner (`role="status"`) while loading; 401/any error -> `navigate(ROUTES.LOGIN + "?error=google_auth_failed",{replace:true})`. Run effect once (guard against StrictMode double call with a ref).

C. Role redirects
- `homeForRole` stays the single source. Add `isAuthPath` not needed. Changes:
  1. AuthPage already-authenticated effect: call `homeForRole(user.roleName, user.accountType)` and redirect for ALL roles whose home != `/` (remove the "company admins are not auto-redirected" exclusion; update `e2e/auth.spec.ts` or other specs if any depend on it). Applies to `/login` and `/login/company`, `/register`, `/company/register` (add the same small `useRedirectIfSignedIn()` hook in `router/useRedirectIfSignedIn.ts`, used by AuthPage, CustomerRegisterPage, CompanyRegisterPage, ResetPasswordPage excluded since reset links must work).
  2. Verified OK already: individual+company submit, CompanyRegister -> DASHBOARD_COMPANY, CustomerRegister -> CUSTOMER_TICKETS, Google (now via /auth/callback). Reset-password success -> `/login`, which auto-redirects if signed in; no change.
  3. Wrong-role guard UX: the Company/Customer/Agent/Admin guards' forbidden cards currently only offer "sign in with X account"/Home. Add a shared `useSessionHome()` hook (calls `/api/auth/me`, returns `homeForRole(...)` or null) and, when it yields a path different from the current area, show a primary "Go to my workspace" `<Link>` in the forbidden card (keep existing sign-out button and text, so existing specs asserting "Access Restricted" still pass). Unauthenticated (401) behaviour unchanged (to login).
- 404: new `NotFoundPage` (heading "Page not found", link "Go to my workspace" when signed in via `useSessionHome`, else "Back to home" and "Sign in"). Replace `path="*"` Navigate with it. Keep `/company` legacy and `/agent` redirects.

D. Landing/dead links
- Footer: Terms -> `<Link to=/terms>`, Privacy -> `<Link to=/privacy>`; Security -> `/privacy`; remove Status, API Docs, About Us, and the 3 social icon links (no real destinations; do not invent URLs). Add "Customer Sign Up" (`ROUTES.REGISTER_CUSTOMER`) in Resources or Company column, and "Company Sign In" (`ROUTES.LOGIN_COMPANY`). Keep Help Center/FAQ (#faq), Enterprise (#pricing).
- Navbar: unchanged (Login + Get Started). Optional: none.
- LegalPage: short, honest placeholder-style Terms and Privacy copy with "Last updated" and a link home; reuse `AuthShell` styling or a simple centered card; page title via `document.title`.
- A hash link used from a non-landing route is not an issue (Footer only on landing).

## 4. UI states / access rules
- Login page: provider loading (no button), google on, google off/error (no button), error banners above, signed-in redirect before form interaction (brief form flash acceptable).
- `/auth/callback`: loading, error->login. Public routes (`/`, `/login*`, `/register`, `/company/register`, `/reset-password`, `/terms`, `/privacy`, `/auth/callback`, `*`). Signed-in users on login/register pages go to `homeForRole`. Wrong-role users on portal routes see Access Restricted with "Go to my workspace". Platform Admin -> `/admin/dashboard`, Company Admin -> `/company/dashboard`, Support Agent -> `/agent/tickets`, Customer -> `/support/tickets`, unknown role -> `/`.
- Security: cookie handoff only, no token in URL, redirect targets built from `CLIENT_ORIGIN` env only, no secrets in `/providers`, inactive/unsupported/unknown accounts never get a cookie from Google, no auto-created accounts.

## 5. Tests

Server (`cd server && npm test`, mock-injected; extend `test/api/googleAuth.test.js`, `test/api/authApi.test.js`, add `test/config/googleOAuth.test.js` if folder pattern fits, else `test/services/`):
- `isGoogleConfigured` unit: true with id+secret, false when missing, dummy, empty, only one set, legacy casing true.
- `GET /api/auth/providers`: `{google:true}` / `{google:false}` via injected `isGoogleConfigured`; no-store; no secret fields.
- `GET /api/auth/google` when not configured -> 302 to `/login?error=google_not_configured`.
- Callback with injected fake passport: Customer/Support Agent/Platform Admin user -> 302 `/auth/callback` + auth cookie (httpOnly) and `Location` contains no `token`; inactive user -> `google_inactive` and no `Set-Cookie`; Company Admin -> `google_role_unsupported`; no user -> `google_no_account`; error -> `google_auth_failed`; redirect origin always `CLIENT_ORIGIN`.
- `userModel.findOrCreate` with `allowCreate:false` and fake pool: no INSERT executed, cb(null,false); default path unchanged; no `role_id || 1` fallback (throws when no role).
- `adminService` settings: `googleOAuthEnabled` follows the helper.

Client: `npm run lint && npm run build`.

Playwright `client/e2e/authPolish.spec.ts` (header: `E2E_SERVER_COMMAND="npm run mock" npx playwright test authPolish`; clear cookies/localStorage in `beforeEach`; seeded creds as in `agentPortal.spec.ts`):
1. Footer: Terms/Privacy links navigate to `/terms`/`/privacy` with headings; no footer link has `href="#hero"` except none (assert zero `a[href="#hero"]` in footer); footer has a link to `/register`; every in-page `#id` anchor on the landing page has a matching element id.
2. Login page shows "Continue with Google" when mock providers true; with `page.route('**/api/auth/providers')` fulfilled `{google:false}` (and a 500) the button and "or" divider are absent.
3. Google flow via mock: click button -> mock sets cookie -> lands on `/support/tickets` (customer); `?as=agent` start URL visited directly -> `/agent/tickets`. `/login?error=google_no_account` shows the message and the param is stripped.
4. `/auth/callback` without a session -> `/login` with the failure banner.
5. Signed-in redirects: agent, customer, company admin, platform admin visiting `/login` each land on their home (`homeForRole`).
6. Wrong role: customer visiting `/agent/tickets` and `/company/dashboard` shows Access Restricted with a "Go to my workspace" link to `/support/tickets`.
7. `/does-not-exist` shows "Page not found" (URL unchanged) with a working link.
Also grep existing specs (`auth.spec.ts`, `companyPortal.spec.ts`) for expectations that a signed-in company admin stays on `/login` and adjust.

## 6. Docs
Update `docs/PROGRESS.md`: tick item 10 with one-line summary + Run 10 log (providers endpoint, `/auth/callback`, sign-in-only Google, limitation for Company Admin and no account creation, cookie handoff and cross-site cookie note, legal placeholder pages need real content before launch). Add a short note to `server/AUTHENTICATION.md`.

## 7. Risks / open points
- Real Google round-trip cannot be tested here (no credentials/DB); only mock-injected and mock-server flows are verified. `GOOGLE_CALLBACK_URL` must be registered in the Google console.
- Legal copy is placeholder; flag for product/legal.
- Removing the company-admin auto-redirect may change an existing e2e expectation; check first.
