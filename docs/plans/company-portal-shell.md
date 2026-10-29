# Plan: Company-admin guard, GET /api/company/me, company portal shell (PROGRESS item 2)

## Findings
- `createApp(deps)` builds services from `deps`; tests inject mock models. `authenticate` sets `request.auth`; `requireRole("Company Admin")` is case-insensitive, 403 `ROLE_FORBIDDEN`.
- Company admins log in via two paths; the individual-mode token may lack `companyId`. The company MUST be resolved from the DB via `company_admins.admin_id = auth.userId`, never from the token or query params.
- Known columns: `companies(company_id, company_name, industry, business_email, company_phone, website_url, description, status, registration_date)`, `users(user_id, role_id, company_id, first_name, last_name, email, password_hash, online_status, account_status, created_at)`, `company_admins(admin_id, company_id)`, `roles(role_id, role_name)`.
- No schema changes in this item. No tickets/FAQ/AI tables yet.

## Backend
New: `server/src/models/companyPortalModel.js`, `services/companyService.js`, `controllers/companyController.js`, `routes/companyRoutes.js`, `test/api/companyMe.test.js`, `scripts/mock-server.js`. Changed: `src/app.js` (mount `/api/company` before notFound, `dependencies.companyService || createCompanyService(dependencies)`), `package.json` (`"mock"` script).

Model (raw SQL, `?` params via `getMySQLPool().execute`):
- `findCompanyAdminContext(userId)`: join users/roles/company_admins/companies, camelCase aliases, null if none.
- `getCompanyOverviewCounts(companyId)` -> `{ supportAgents }` (role looked up by name 'Support Agent').

Service `createCompanyService({ companyPortalModel })`.`getCompanyProfile(auth)`: Number(userId) else 401; no context -> 403 `COMPANY_ACCESS_DENIED`; DB role not Company Admin -> 403 `ROLE_FORBIDDEN`; user not Active -> 403 `ACCOUNT_INACTIVE`; company not Active -> 403 `COMPANY_INACTIVE`; counts failure falls back to 0.

Routes: `router.use(authenticate); router.use(requireRole("Company Admin")); router.get("/me", asyncHandler(...))`. Response `Cache-Control: no-store`.

Contract `GET /api/company/me` 200:
`{success:true,data:{user:{userId,firstName,lastName,email,roleName,onlineStatus},company:{companyId,companyName,industry,businessEmail,phone,website,description,status,registrationDate},overview:{openTickets:0,resolvedToday:0,supportAgents,faqArticles:0,aiResolutionRate:null,avgFirstResponseMinutes:null,features:{tickets:false,agents:false,faqs:false,aiSettings:false}}}}`. Never return password hashes.

## Mock server (dev only)
`server/scripts/mock-server.js`: set NODE_ENV=test, dummy JWT_SECRET (>=32 chars), JWT_COOKIE_SECURE=false, PORT 5000 BEFORE requiring src; never connect to DBs or read .env. In-memory mock userModel, companyModel, tokenModel, adminModel, companyPortalModel mirroring real signatures. Seed: Platform Admin admin@supportpilot.com / Admin@SupportPilot2026! (bcrypt hash at startup), company admin owner@acme-demo.com / CompanyAdmin@2026! for Acme Demo Co, second company Globex, a support agent. Export `buildMockApp`, run `listen` only when `require.main === module`. Add `"mock": "node scripts/mock-server.js"`.

## Frontend
New: `services/company.ts`, `types/company.ts`, `components/company/CompanyRouteGuard.tsx`, `CompanyLayout.tsx`, `OverviewStatCard.tsx`, `pages/company/CompanyDashboardPage.tsx`, `CompanyComingSoonPage.tsx`. Changed: `router/routes.ts` (add COMPANY_TICKETS `/company/tickets`, COMPANY_AGENTS, COMPANY_FAQS, COMPANY_AI_SETTINGS), `router/index.tsx` (layout route wrapping guard + layout; replace DashboardPlaceholderPage if unused elsewhere).
- Guard: fetch `/api/company/me` once, share via context/outlet. States loading/ready/unauth (401 -> clear stored auth, redirect to company login)/forbidden (Access Restricted card, role-aware links)/inactive messages/error with retry. Server decides; localStorage never authorizes.
- Layout: modelled on AdminLayout (brand #6D5EF5, material-symbols icons), responsive hamburger below lg, nav Overview/Tickets/Agents/FAQs/AI Settings with "Soon" badge when feature flag false, aria-current, sign-out via `logout()`.
- Overview page: welcome, company status, stat cards (null -> "—"), profile card ("Not provided" fallbacks), getting-started panel, refresh with inline error banner.

## Tests
Server `companyMe.test.js` (mock injection): 401 no auth; 401 bad token; 403 Platform Admin (model not called); 403 Support Agent; 200 shape (no password keys); 200 individual token without companyId; isolation (forged token companyId / ?companyId ignored); 403 no company; 403 inactive company/user; DB role mismatch; counts throw -> 200 with 0; context throws -> 500; no-store header. Client: lint + build; optional Playwright `e2e/companyPortal.spec.ts` against mock server (allow `E2E_SERVER_COMMAND` override in playwright config).
