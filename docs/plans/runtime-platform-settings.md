# Plan: Wire stored platform settings into runtime (PROGRESS item 12)

Scope: one run. Server first, then a small client slice. No schema changes (settings already live in `platform_settings`, single JSON row). Secrets stay env-only.

## Findings that shape the design
- `PASSWORD_PATTERN` in `authValidator.js` (also imported by `customerValidator.js`) is already `8-128 chars + lower + upper + digit + special`. So the stored default (min 8, special required) equals current behaviour. Settings can only *change* two knobs: min length (6-128) and whether a special char is required. Upper/lower/digit stay mandatory always.
- `validateSignInPayload` applies `PASSWORD_PATTERN` to the sign-in password too. If an admin loosens the policy (min 6 / no special), users who then register a 6-char password could not sign in. Sign-in must stop enforcing the policy (see 2).
- Agent invite and password reset both end in `POST /api/auth/reset-password` (`validateResetPasswordPayload`), so that is the only "set-password" path. `authService.setPassword` is unused by routes (no validation there; leave, but route it through the same check for safety).
- Sync config: `getAuthConfig()` (sync, env) is used by `utils/token.js`, `utils/authCookie.js`, `middleware/authenticate.js` (cookie *name* only). Settings are async, so resolve them in async service/controller code and pass values down as optional args; do NOT make `getAuthConfig` async.
- `adminService.js` imports `sendMail` from `emailService`, which does not export it. The test-email feature is broken in production (`mailSender` undefined). Fix as part of the SMTP work (3).
- `emailService.createTransporter()` hardcodes `requireTLS: true`, `secure: false`, and reads host/port/user from env at call time.
- Existing `GET /api/auth/providers` test does `deepEqual(body, {success:true,data:{google}})`. Do not change that endpoint; add a new one.

## 1. Runtime settings provider
New `server/src/services/platformSettingsSchema.js`: move (unchanged, mechanical) `buildDefaultSettings`, `SETTINGS_SCHEMA`, `SECTION_NAMES`, `SECRET_KEY_PATTERN`, `mergeSettings` out of `adminService.js`; `adminService.js` imports them. Existing `adminSettings.test.js` must pass untouched.

New `server/src/services/runtimeSettings.js`:
```
createRuntimeSettings({ loader, ttlMs = 10000, timeoutMs = 2000, now = Date.now })
  -> { get(), invalidate(), getSecurity(), getPublic() }
```
- `loader()` returns the merged effective settings (default wiring: `adminModel.getPlatformSettings()` -> `mergeSettings(buildDefaultSettings(), stored)`).
- `get()`: return cached value if younger than ttlMs; otherwise call loader with a `Promise.race` timeout (2s, so an unreachable DB cannot stall every request for the 10s pool connectTimeout). Coalesce concurrent loads into one in-flight promise.
- Failure (throw/timeout/no row): return `buildDefaultSettings()` (env-derived) and cache it for a short negative TTL (e.g. 5s) so a dead DB is not hammered per request. Never throws. Log once per failure window (`console.error`, skipped when NODE_ENV=test).
- `invalidate()` clears cache and any in-flight result (use a generation counter so a load started before the save cannot repopulate stale data).
- Staleness: single process sees changes immediately after save; other instances within ttlMs. Document.
- `getSecurity()` returns the "safe-resolved" values below; `getPublic()` returns the public subset (section 5).

Safe-resolution rules (`resolveSecurity(settings, env)`), stored value wins only if valid, else env:
- `jwtExpiresIn`: must match `/^\d+[smhd]$/` AND be between 1 minute and 30 days (reject `0s`, huge values). Else `getAuthConfig().jwtExpiresIn`. Also derive cookie `maxAge` ms from the resolved expiry so cookie and token agree (if a stored expiry override is used; otherwise keep `JWT_COOKIE_MAX_AGE_MS` behaviour).
- `cookieSameSite`: lax|strict|none; `cookieSecure`: boolean. Stored values override env ONLY when the combination is valid: if resolved sameSite is `none` and secure is false, fall back to env pair entirely (same rule as `getAuthConfig` throws on). Note: `buildDefaultSettings` seeds these from env, and a stored row persists whatever the admin last saved, so a stored `cookieSecure:false` would override production's `NODE_ENV=production` secure default (`JWT_COOKIE_SECURE` unset). Mitigation: in production (`NODE_ENV==='production'`) a stored `cookieSecure:false` is ignored (stays env/secure=true). Say so in a code comment.
- Returned shape: `{ jwtExpiresIn, cookieOptions: { httpOnly:true, secure, sameSite, path:'/', maxAge } }`.

Wiring in `app.js` (create once, pass via `{...dependencies, runtimeSettings}` to `createAuthService`, `createAdminService`, and the maintenance middleware):
```
const runtimeSettings = dependencies.runtimeSettings ||
  createRuntimeSettings({ loader: dependencies.settingsLoader || defaultLoader(dependencies.adminModel || adminModel) });
```
Hermetic tests: when `NODE_ENV==='test'` and neither `runtimeSettings`, `settingsLoader` nor `adminModel` was injected, use a loader returning `buildDefaultSettings()` (never touch `getMySQLPool`). This keeps all ~20 existing API tests unchanged.

`adminService.updatePlatformSettings` calls `runtimeSettings?.invalidate()` after a successful `savePlatformSettings` (optional dep so existing tests that build `createAdminService({adminModel, sendMail})` still work). `getPlatformSettings`/`loadSettings` unchanged (admin console still reads the DB directly, fresh).

## 2. JWT expiry, cookie flags
- `utils/token.js`: `createAccessToken(user, options = {})`; `expiresIn: options.expiresIn || config.jwtExpiresIn`. Backwards compatible (mock-server and tests call it with one arg; DI'd `createAccessToken` stubs ignore extra arg).
- `utils/authCookie.js`: `setAuthCookie(response, token, cookieOptions)` and `clearAuthCookie(response, cookieOptions)`; third arg optional, defaults to env `getAuthConfig().cookieOptions`. Cookie name stays env (`JWT_COOKIE_NAME`) because `authenticate` reads it synchronously.
- `authService`: `signIn`, `registerCompany`, `registerCustomer`, `generateToken` become `await runtimeSettings.getSecurity()` then `createToken(user, { expiresIn })`. `generateToken` is currently sync and used by `googleCallback`; make it async and `await` it, and make `googleCallback` async (route already goes through plain middleware; wrap with `asyncHandler`). Each result also returns `cookieOptions` so controllers do not re-resolve: `{ user, accessToken, cookieOptions }`. Existing service tests deepEqual only `user`/`accessToken` fields individually; verify, and if any deepEquals the whole result adjust by exposing `cookieOptions` via a separate `authService.getCookieOptions()` instead. Preferred (lower risk): add `authService.getCookieOptions()` and have controllers call it; do not change return shapes.
- `authController`: `setAuthCookie(response, token, await authService.getCookieOptions())` in signIn/registerCompany/registerCustomer/googleCallback; `signOut` becomes async and clears with the same options (guards against drifting flags; fall back to env on any error).
- Token verification is unaffected (jwt.verify reads `exp` from the token). Existing sessions keep their original expiry. `sessionIdleTimeoutMinutes` is NOT wired (needs sliding sessions); mark as deferred.

## 3. Password policy
- `authValidator.js`: add `buildPasswordPattern({ minPasswordLength = 8, requireSpecialChar = true })` and `passwordPolicyMessage(policy)`; keep exporting static `PASSWORD_PATTERN` (default policy equals it exactly) so existing validator tests and imports stay green. Validators gain an optional second arg: `validateCompanyRegistrationPayload(payload, policy)`, `validateResetPasswordPayload(payload, policy)`; `customerValidator.validateCustomerRegistrationPayload(body, policy)`. Undefined policy = defaults, so existing validator tests are untouched. Pattern: `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(requireSpecial ? (?=.*[^A-Za-z0-9\s]) : '')[\s\S]{min,128}$`.
- `middleware/validateRequest.js`: the three affected `validate*Request` functions become async-capable via a factory `createPolicyValidators(runtimeSettings)` or by reading `request.app.locals.runtimeSettings` (set in `createApp`). Pick `app.locals.runtimeSettings` (smallest change; routes keep current signatures). Middleware does `const policy = await runtimeSettings.getPasswordPolicy()` (wrap in try/catch -> defaults). Error message becomes policy-aware, e.g. "Password must be 10 to 128 characters and include uppercase, lowercase, number, and special character" (default text unchanged: existing tests match on 422/field, but keep default wording identical to today's company/customer strings to be safe).
- Sign-in: `validateSignInPayload` stops enforcing the pattern; require non-empty string, max 128. Update the one existing validator test (`authValidator.test.js` ~line 83: "short" now passes validation at sign-in, still ends in 401 INVALID_CREDENTIALS from the service) and any authApi test expecting 422 for a weak sign-in password (grep first; `authApi.test.js:208` is the candidate). This is the only existing-test change in the plan and is required to make loosening safe.
- Agent invite flow and company-admin "set password" use `/reset-password`, so they are covered. `authService.setPassword`: enforce policy via `isPasswordAllowed` and throw 422 `VALIDATION_ERROR` (unused by routes today; keeps it safe if wired later).
- Existing passwords are never re-validated (policy applies at set time only).

## 4. SMTP
- `emailService.createTransporter(smtpOverrides = {})` accepts `{ host, port, user, requireTls, senderName }` from settings; password ONLY `process.env.MAIL_PASSWORD || SMTP_PASS`. Precedence: settings value (already env-seeded defaults, so a stored row wins) then env then built-in. `secure: port === 465`; `requireTLS: requireTls !== false && port !== 465`. `senderName` used as the display name in `from` (replacing `APP_NAME`), HTML-escaped / quote-stripped; sender *address* stays `MAIL_FROM || SMTP_FROM || user`.
- `sendPasswordResetEmail(toEmail, resetLink, smtp)` and `sendAgentInviteEmail(toEmail, link, details, smtp)`: new optional trailing `smtp` arg. Callers: `authService.requestPasswordReset` and `agentService` fetch `await runtimeSettings.getEmail()` (host/port/user/senderName/requireTls) and pass it. Mailer failures are unchanged (500 EMAIL_DELIVERY_FAILED). If loader fails, `get()` already returns env defaults.
- Security: validate `smtpHost` at resolve time (hostname chars only, no whitespace/URL); stored `smtpUser` never gets a password; `GET /api/admin/settings` already returns no secrets. Admin choosing an arbitrary SMTP host could redirect reset emails to an attacker-controlled server. This is a Platform Admin-only capability and is the stated feature; note it, no extra code.
- Fix missing export: add `sendMail({ to, subject, text, html, smtp })` to `emailService` (generic transport send, same logging redaction) and export it. `adminService.sendDiagnosticTestEmail` passes `smtp` from the settings it already loads, and uses `senderName`. No new route.
- `verifySMTPConnection`/`scripts/test-smtp.js`: leave env-only (diagnostic script).
- DI: `authService` already accepts `dependencies.sendPasswordResetEmail`; tests assert that the settings object reaches it.

## 5. Maintenance mode, self registration, default company status
New `server/src/middleware/maintenanceMode.js`: `createMaintenanceMiddleware(runtimeSettings)`.
- Reads `(await runtimeSettings.get()).infrastructure.maintenanceMode`; if false (or loader failed -> fail OPEN) call `next()`.
- Exempt (always pass): `GET /health`; everything under `/api/admin` (and `/admin`? not mounted; only `/api/admin`); `POST /api/auth/sign-in` and `/auth/sign-in`; `POST /api/auth/sign-out`; `GET /api/auth/providers`; `GET /api/public/platform`; `OPTIONS` (CORS preflight; `cors()` runs earlier anyway); Google start/callback paths (`/api/auth/google*`, so Platform Admins using Google can still enter; see below).
- Otherwise, if the request carries a valid token (cookie or Bearer, decode with `verifyAccessToken`, never 401 on failure) with `roleName === 'Platform Admin'`, pass. Everyone else: `503` with `Retry-After: 60`, `Cache-Control: no-store`, body `{ success:false, message:'The platform is under maintenance. Please try again shortly.', code:'MAINTENANCE_MODE' }`.
- Mount in `app.js` right after `/health` and before routers: `app.use(createMaintenanceMiddleware(runtimeSettings))`.
- Sign-in under maintenance: exempt from the middleware so admins can authenticate, but `authService.signIn` throws `AppError(..., 503, 'MAINTENANCE_MODE')` AFTER password check when the resolved role is not `Platform Admin` (no account enumeration, no cookie issued to normal users). Same check in `googleCallback` (redirect to `/login?error=maintenance`). Registrations/forgot/reset are blocked by the middleware.
- Admin lock-out safety: `/api/admin/*` stays reachable; PUT `/api/admin/settings` with `maintenanceMode:false` is the recovery path. If DB is down the provider fails open.

Self registration (`general.allowSelfRegistration`), in `authService` (service-level so it is testable with mocks and applies to any caller):
- `registerCompany` and `registerCustomer` first `await runtimeSettings.get()`; if `allowSelfRegistration === false` throw `AppError('Self-registration is currently disabled', 403, 'REGISTRATION_DISABLED')`. Runs before hashing/DB work. Does not affect agent invites or admin-created accounts. Order vs validation: validation 422 runs first (middleware), then 403. Fine.

Default company status: in `registerCompany`, `companyStatus = dependencies.initialCompanyStatus || (settings is stored/valid ? settings.general.defaultCompanyStatus : process.env.COMPANY_REGISTRATION_STATUS || 'Active')`. Problem: `buildDefaultSettings().general.defaultCompanyStatus` is hard-coded `'Active'`, so "no stored value" cannot be distinguished from "admin chose Active", and env `COMPANY_REGISTRATION_STATUS` would be ignored. Fix in `buildDefaultSettings`: `defaultCompanyStatus: ['Active','Pending'].includes(process.env.COMPANY_REGISTRATION_STATUS) ? process.env.COMPANY_REGISTRATION_STATUS : 'Active'`. Then the effective setting already encodes stored-over-env. The explicit `dependencies.initialCompanyStatus` (tests) still wins. Company sign-in remains blocked for non-Active companies (existing `COMPANY_INACTIVE`), so registering as Pending already behaves correctly.

## 6. Public settings endpoint
`GET /api/public/platform` (new, in `publicRoutes.js`; `createPublicRouter(customerModel, runtimeSettings)`), no auth, `Cache-Control: no-store`, never errors (falls back to defaults):
```
200 { success:true, data: {
  platformName, platformNotice, maintenanceMode, allowSelfRegistration,
  passwordPolicy: { minPasswordLength, requireSpecialChar }
}}
```
Explicit allowlist object built in `runtimeSettings.getPublic()`; no supportEmail, SMTP, region, timezone, security flags, AI. Exempt from maintenance (so the client can render the maintenance page). Rate-limit is not required (cached read), noted as an open item like `/api/public/companies`. `/api/auth/providers` untouched.

## Access rules summary
| Route | Maintenance ON, non-admin | Maintenance ON, Platform Admin |
|---|---|---|
| `/health`, `/api/public/platform`, `/api/auth/providers`, sign-out | allowed | allowed |
| `POST /api/auth/sign-in` | 503 for non-admin accounts (after password check) | allowed |
| `/api/admin/*` | existing 401/403 rules (middleware passes through) | allowed |
| all other `/api/*` (tickets, customer, agent, company, register, forgot/reset, `/auth/me`) | 503 MAINTENANCE_MODE | allowed |

## Failure modes
- Settings DB down / no row / timeout: env defaults, maintenance OFF (fail open), registration allowed, policy 8+special.
- Stored row contains invalid values: `mergeSettings` already falls back per key; `resolveSecurity` adds the cross-field checks above.
- Admin sets `sameSite none` with `secure false`: save is accepted by the existing schema (per-field validation) but ignored at runtime (env pair used). Optionally add a cross-field 422 in `updatePlatformSettings` (`security.cookieSameSite==='none' && !cookieSecure`); recommended, small, add a test.
- Loader hang: 2s timeout. Concurrent requests share one load.
- Stale cache on other instances: up to 10s.

## Deferred / not doing
- `sessionIdleTimeoutMinutes`, `googleOAuthEnabled` (Google gating stays on env credentials), cookie name, JWT secret, AI-engine and region/timezone settings: not wired.
- Revoking existing sessions when settings change.
- Multi-instance push invalidation (TTL only).
- SMTP secret management in UI (password remains env-only).

## Tests to add (node --test, mock injection; no DB)
New `test/services/runtimeSettings.test.js`:
- loader called once within TTL, again after TTL (fake `now`), `invalidate()` forces reload, concurrent `get()` coalesces, invalidate during in-flight load discards stale result.
- loader throws / times out / returns null: env defaults returned, no throw, negative cache honoured.
- `resolveSecurity`: valid override wins; `0s`, `abc`, `999d` fall back to env; `none`+insecure falls back; production ignores `cookieSecure:false`.
- `getPublic()` has exactly the 5 allowlisted keys (no secret/`smtp*` leak).

New `test/api/runtimeSettings.test.js` (startTestServer with injected `runtimeSettings` stub or `adminModel` mock + real provider, `userModel`/`companyModel` mocks like `authApi.test.js`):
- Maintenance: non-admin hits `/api/auth/me`, `/api/customer/me`, `/api/auth/forgot-password`, register -> 503 `MAINTENANCE_MODE` with Retry-After; `/health`, `/api/auth/providers`, `/api/public/platform` -> 200; Platform Admin token reaches `/api/admin/settings` and a non-admin route; non-admin token on `/api/admin/*` gets existing 403 not 503; sign-in as non-admin -> 503 and no Set-Cookie; sign-in as Platform Admin -> 200; toggling via `PUT /api/admin/settings` then immediate request reflects new state (invalidate wiring); loader failure -> fail open (200s).
- Self registration off: company/customer register -> 403 `REGISTRATION_DISABLED`, model `createRegistration`/`createCustomer` never called; on -> 201. Invalid body still 422 first.
- defaultCompanyStatus `Pending` -> `createRegistration` receives `companyStatus:'Pending'`; absent stored row + `COMPANY_REGISTRATION_STATUS=Pending` env -> Pending; unset -> Active; `initialCompanyStatus` dep still wins.
- JWT/cookie: stored `jwtExpiresIn:'15m'` -> decoded token `exp-iat === 900`; invalid stored value -> env value; cookie `Set-Cookie` has `SameSite=Strict` / `Secure` per stored; sign-out clears with same attrs; google callback path uses settings (extend `googleAuth.test.js` pattern).
- Password policy (company register, customer register, reset-password): default settings accept/reject exactly as today (reuse existing fixtures); `minPasswordLength:12` rejects 10-char with policy message; `requireSpecialChar:false` accepts `Abcdefg1`; `minPasswordLength:6` accepts a 6-char compliant password; then signing in with that password succeeds (proves sign-in no longer applies the policy).
- SMTP: forgot-password with stored `smtpHost/Port/senderName/requireTls` -> injected `sendPasswordResetEmail` receives the settings object; no password key anywhere; admin test-email passes stored host/port to injected `sendMail`; `adminService` without `runtimeSettings` dep still works.
- Cross-field 422 for `none`+`cookieSecure:false` in `adminSettings.test.js` (if added).
Unit: `test/services/emailService.test.js` mocks `nodemailer.createTransport` (via `require.cache` or an injectable `transportFactory` param) and asserts options: host/port/user from override, pass from env only, `requireTLS`, `secure` for 465.
Update: `test/validators/authValidator.test.js` sign-in weak-password case; any `authApi.test.js` 422-on-weak-signin case; `customerValidator`/company validator tests get default-policy parity cases plus custom policy cases.

## Mock server (`server/scripts/mock-server.js`)
- Already injects `adminModel` with in-memory `getPlatformSettings/savePlatformSettings`, so the real provider works unchanged and the admin portal toggles take effect within seconds (cache invalidated on save).
- Pass `settingsTtlMs` small (e.g. 500ms via `createRuntimeSettings` option or env `MOCK_SETTINGS_TTL_MS`) so Playwright sees changes immediately; or expose the provider via `createApp({ runtimeSettings })` built in the mock.
- Mock Google start route calls `setAuthCookie(response, createAccessToken(...))` with one arg; still valid (defaults). Optionally apply maintenance there for parity (skip; mock-only).
- Seed nothing new; the Platform Admin seed (`admin@supportpilot.com`) is used to flip maintenance in e2e.

## Client slice (small; do only after server is green)
Files:
- `client/src/types/auth.ts`: add `PlatformPublicSettings` type.
- `client/src/services/auth.ts` (or new `client/src/services/platform.ts`): `getPublicPlatformSettings()` -> GET `/api/public/platform`, fallback `{ maintenanceMode:false, allowSelfRegistration:true, platformName:'SupportPilot', platformNotice:'', passwordPolicy:{minPasswordLength:8, requireSpecialChar:true} }` on any error.
- New `client/src/components/common/PlatformSettingsProvider.tsx` (context + hook `usePlatformSettings`, fetched once on mount, refetch on window focus), mounted in `client/src/main.tsx`/`App.tsx`.
- New `client/src/components/common/MaintenanceBanner.tsx`: top banner when `maintenanceMode` (and, for Platform Admin routes, a non-blocking "Maintenance mode is ON" reminder); mount in `App.tsx`. Non-admin portals: `apiRequest` 503 `MAINTENANCE_MODE` is surfaced by the banner (no per-page work). Login page stays reachable.
- Sign-up hint: `client/src/components/auth/PasswordField.tsx` (or a hint prop used by `CompanyRegistrationForm.tsx`, `CustomerRegistrationForm.tsx`, `pages/auth/ResetPasswordPage.tsx`); `client/src/validation/companyRegistration.ts` and `customerRegistration.ts` accept the policy to mirror the server (`min` length, optional special char) while keeping defaults identical.
- Hide sign-up links when `allowSelfRegistration` is false: `client/src/components/auth/LoginForm.tsx` (two prompts), `components/landing/{Navbar,HeroSection,CtaBanner,PricingSection,SolutionsSection,Footer}.tsx` (REGISTER links); `CompanyRegisterPage.tsx` / `CustomerRegisterPage.tsx` show a "Registration is closed" notice. Landing links are the bulk of the work; if time is short, hide only Navbar/Hero/LoginForm/Footer and render the closed notice on the register pages (server enforces regardless).
- Optional `platformName` in `AuthShell`/Navbar: skip.
- E2E (written, run against mock if a browser is available): `client/e2e/platformRuntime.spec.ts` flips maintenance via the admin settings UI/API and checks the banner and 503; toggles self-registration and checks the links are hidden.

## Suggested order of work
1. Extract `platformSettingsSchema.js`; run existing tests.
2. `runtimeSettings.js` + unit tests.
3. Token/cookie args, `authService.getCookieOptions`, controller changes (async googleCallback/signOut) + tests.
4. Validators + policy middleware + sign-in validator relaxation + tests.
5. Self-registration, default status (env-seeded default), maintenance middleware + sign-in 503 + tests.
6. `emailService` (`sendMail`, overrides) + agent/auth/admin callers + tests.
7. `/api/public/platform` + mock-server TTL tweak.
8. Client slice, `cd server && npm test`, `cd client && npm run lint && npm run build`.
9. Update `docs/PROGRESS.md` item 12 (note deferred: idle timeout, Google toggle, multi-instance invalidation; real-DB round trip untested).
