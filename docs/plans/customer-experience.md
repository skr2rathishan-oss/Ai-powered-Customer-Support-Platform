# Plan: Customer experience - submit ticket / view own tickets (PROGRESS item 8, server + client)

## Findings
- Layering: `routes -> controllers -> services -> models`; `createApp(deps)` builds each service from `deps` (`dependencies.xService || createXService(dependencies)`), tests inject mock models (`node --test`, harness as in `server/test/api/tickets.test.js`). Errors: `new AppError(msg, status, code, errors)` -> `{success:false,message,code,errors?}`; validators return `{ value, errors:[{field,message}] }`, 422 `VALIDATION_ERROR`. Success envelope `{success:true,data}`.
- Customers do NOT exist today: no registration, no seed, no code references role `Customer` (README mentions "Customers" as a role). Individual sign-in (`accountType:"individual"`) already works for any `users` row via `userModel.findByEmail`, returns `roleName`, and the JWT carries `userId` + `roleName` (no `companyId` for individual accounts). Google sign-up creates users with role Agent/User/Individual and no company (item 10 territory; they will simply get 403 `ROLE_FORBIDDEN` here).
- Company link: `users.company_id` already exists and is how Support Agents belong to a company. A customer = `users` row with role `Customer` and `company_id` = the company they get support from (one customer account = one company; a person using two companies registers twice with different emails - documented limitation, no new join table).
- `tickets.customer_id` is a plain nullable INT (no FK); `ticketService.createTicket` forces `customerId: null` for admin-created tickets. This item sets it from the DB-resolved customer identity.
- Company admin context comes from `companyContext.js` (DB only). Mirror that for customers: new resolver, never trust token/body/query for company or customer id. JWTs are stateless, so re-check `account_status` and company status on every request.
- Roles are looked up by name (`SELECT role_id FROM roles WHERE role_name = ?`, as `Company Admin` / `Support Agent`); roles rows are not created by app code. We follow that and add an idempotent best-effort `Customer` role insert in schema init (columns of `roles` beyond `role_name` unknown, so insert only `role_name`, in try/catch warn-only).
- FAQ source must stay `faqs.is_published = 1`; AI settings must be read via `resolveAiSettings` honouring `enabled` (PROGRESS item 7). Item 8 makes no LLM calls; it exposes published FAQs for self-help and surfaces the (resolved) assistant settings read-only.
- Conversation/replies = item 9. Customer ticket detail is read-only. No `ticket_messages` table here.

## Scope decision (minimal, coherent)
1. Public: list active companies (id, name) + customer self-registration choosing a company.
2. Customer-scoped authed API under `/api/customer/*` (role `Customer` only): `me`, `faqs`, `tickets` (create, list own, get own).
3. Client: `/register` (customer signup), `/support` area behind a customer guard: My tickets, New ticket, Ticket detail (read-only), Help (FAQs). Login redirect for customers.
Out of scope: customer ticket edit/close/reply, attachments, email notifications, multi-company customers, AI chat, invitation flow, Google customers, password policy wiring (item 12).

## Schema (`server/src/config/database.js`, idempotent, no FKs, errors swallowed with warn when `NODE_ENV !== "test"`)
Add `ensureCustomerSupport(pool)` called from `initMySQLSchema` after `ensureCompanyAiSettingsTable`, with two independent try/catch blocks:
- Role: `INSERT INTO roles (role_name) SELECT 'Customer' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name = 'Customer')`.
- Index for own-ticket listing: `SHOW INDEX FROM tickets WHERE Key_name = 'idx_tickets_customer'`; if empty, `ALTER TABLE tickets ADD INDEX idx_tickets_customer (company_id, customer_id, created_at)`.
No new tables. No change to `users`/`tickets` columns.

## Constants (`server/src/constants/customerConstants.js`)
`CUSTOMER_ROLE = "Customer"`, `CUSTOMER_OPEN_TICKET_LIMIT = 25` (409 `TICKET_LIMIT_REACHED` when exceeded - cheap abuse guard), `CUSTOMER_FAQ_LIMIT = 200`, reuse `ticketConstants` (`SUBJECT_MIN/MAX`, `DESCRIPTION_MAX`, `TICKET_STATUSES`, `OPEN_STATUSES`, `DEFAULT_LIMIT`, `MAX_LIMIT`).

## Models
### `server/src/models/customerModel.js` (new; every fn takes optional trailing `options.pool` for tests)
- `listPublicCompanies(options) -> [{companyId, companyName}]`: `SELECT company_id AS companyId, company_name AS companyName FROM companies WHERE status = 'Active' ORDER BY company_name LIMIT 200`.
- `findActiveCompany(companyId, options) -> {companyId, companyName} | null` (status 'Active').
- `findCustomerContext(userId, options) -> {userId, firstName, lastName, email, userStatus, roleName, companyId, companyName, companyStatus} | null`: `users u JOIN roles r ON r.role_id=u.role_id JOIN companies c ON c.company_id=u.company_id WHERE u.user_id = ? LIMIT 1` (inner join on company: no company -> null -> `COMPANY_ACCESS_DENIED`). Role is returned, not filtered in SQL; the resolver checks it.
- `createCustomer({companyId, firstName, lastName, email, passwordHash}, options) -> {userId, ...}`: single `INSERT INTO users (role_id, company_id, first_name, last_name, email, password_hash, online_status, account_status) SELECT role_id, ?, ?, ?, ?, ?, 'Offline', 'Active' FROM roles WHERE role_name = 'Customer' LIMIT 1` (same pattern as `agentModel.createAgent`); `ER_BAD_NULL_ERROR` -> `AppError(500, CUSTOMER_ROLE_MISSING)`; `ER_DUP_ENTRY` -> `AppError(409, EMAIL_EXISTS, [{field:"email"}])`. Pre-check with `userModel.findByEmail` in the service for the friendly path; DB unique error is the race backstop.

### `server/src/models/ticketModel.js` additions (existing fns untouched)
Customer-scoped, `company_id = ? AND customer_id = ?` in EVERY WHERE (first two params, in that order):
- `listCustomerTickets(companyId, customerId, {status, page, limit}, options) -> {tickets, total, page, limit}` using `TICKET_SELECT`, `ORDER BY t.created_at DESC, t.ticket_id DESC`, COUNT then `pool.query` with `LIMIT ? OFFSET ?` (same as `listTickets`). Only optional filter: `status` (exact enum) or `state=open|closed` handled in service by passing `status`.
- `findCustomerTicketById(companyId, customerId, ticketId, options) -> row | null`.
- `countOpenCustomerTickets(companyId, customerId, options) -> number` (`status IN ('Open','In Progress')`).
- Creating reuses existing `createTicket(companyId, {customerId, requesterName, requesterEmail, subject, description, status:"Open", priority:"Medium", assignedAgentId:null})`.

## Validators
- `server/src/validators/customerValidator.js`:
  - `validateCustomerRegistrationPayload(body)`: plain object; allowlist `firstName, lastName, email, password, companyId`, unknown keys -> `[{field:"body",message:"Unexpected fields: ..."}]` (like company registration). `firstName/lastName` trimmed 1..60 with `NAME_PATTERN`; `email` lowercased, `EMAIL_PATTERN`, <=254; `password` `PASSWORD_PATTERN` (export `EMAIL_PATTERN`, `PASSWORD_PATTERN`, `NAME_PATTERN` from authValidator, or move to a shared helper - no behaviour change); `companyId` positive safe integer (number or digit string) -> number.
  - `validateCustomerCreateTicketPayload(body)`: plain object; `subject` trimmed 3..200 required; `description` trimmed 1..5000 required. Every other key (`priority`, `status`, `companyId`, `customerId`, `assignedAgentId`, `requesterName`, ...) is ignored and never copied into `value` (customers cannot set them).
  - `validateCustomerTicketListQuery(query)`: `status` optional exact enum of TICKET_STATUSES; `page` int>=1 default 1; `limit` int 1..100 default 20 (invalid -> 422).
  - `validateFaqQuery(query)`: `search` optional trimmed <=100; `category` optional trimmed <=60.
  - `parseCustomerTicketId` = reuse `parseTicketId` from ticketValidator.

## Services
### `server/src/services/customerContext.js`
`createCustomerContextResolver(customerModel) -> { requireActiveCustomer(auth) }`, errors in this order: 401 `AUTHENTICATION_REQUIRED` (bad userId); 403 `COMPANY_ACCESS_DENIED` (no context row: "No company is associated with this account"); 403 `ROLE_FORBIDDEN` (DB roleName != Customer, case-insensitive); 403 `ACCOUNT_INACTIVE`; 403 `COMPANY_INACTIVE` ("This company is not accepting support requests"). Returns the context (companyId/userId come ONLY from DB).

### `server/src/services/customerService.js`
`createCustomerService(dependencies)`: `customerModel`, `ticketModel`, `faqModel`, `aiSettingsModel` (each `dependencies.x || default`). Reuse `resolveAiSettings` from aiSettingsService. Methods `(auth, ...)`:
- `getProfile(auth)` -> `{ customer:{userId,firstName,lastName,email}, company:{companyId,companyName}, assistant:{enabled,assistantName,greeting} }`. `assistant` built from `resolveAiSettings(await aiSettingsModel.findAiSettings(companyId))` picking only those three fields (never custom instructions/thresholds). AI lookup failure -> `enabled:false` defaults (isolated try/catch; do not fail the guard).
- `listFaqs(auth, query)` -> `{ faqs:[{faqId,question,answer,category}], categories:[string] }`: calls `faqModel.listFaqs(companyId, {status:"published", search, category})` - status ALWAYS forced to `"published"`, query cannot override. Categories derived from the returned rows (distinct, sorted) so drafts' categories never leak. Do not call `listFaqMeta`.
- `listTickets(auth, query)` -> `{ tickets:[customerTicket], pagination:{page,limit,total,totalPages} }`.
- `getTicket(auth, rawId)` -> `{ ticket }`; 400 `INVALID_TICKET_ID`; 404 `TICKET_NOT_FOUND` for missing OR another customer's OR another company's (indistinguishable).
- `createTicket(auth, body)`: validate (422) -> `countOpenCustomerTickets` >= limit -> 409 `TICKET_LIMIT_REACHED` -> `ticketModel.createTicket(companyId, {customerId: ctx.userId, requesterName: "<first> <last>", requesterEmail: ctx.email, subject, description, status:"Open", priority:"Medium", assignedAgentId:null})` -> 201 `{ ticket }`.
- Presenter `toCustomerTicket(row)` whitelists: `ticketId, subject, description, status, priority, assigneeName, createdAt, updatedAt, resolvedAt`. Omits `companyId, customerId, requesterEmail/Name, assignedAgentId`.

### Registration + public companies
- `authService.registerCustomer(registration)` (add to `createAuthService`, uses `dependencies.customerModel || customerModel`): `findActiveCompany` else 422 `COMPANY_NOT_FOUND` (`errors:[{field:"companyId",message:"Select an active company"}]`); `users.findByEmail` exists -> 409 `EMAIL_EXISTS` (`errors:[{field:"email",message:"An account with this email already exists"}]`); hash via the existing `hashPassword`; `createCustomer`; safeUser `{accountType:"individual", userId, email, firstName, lastName, onlineStatus:"Offline", roleName:"Customer"}`; return `{ user, accessToken }` via `createToken`.
- `authController.registerCustomer`: sets auth cookie, `Cache-Control: no-store`, `201 {success:true,message:"Registration successful",data:{user,token}}` (mirrors `registerCompany`).
- Route: `POST /api/auth/customer/register` (also reachable as `/auth/...` through the existing double mount), with its own `rateLimit` (10 / 15 min, same `skip` rules, code `REGISTRATION_RATE_LIMITED`) + validator middleware `validateCustomerRegistrationRequest` added to `validateRequest.js` (sets `request.validatedBody`, 422 on error like the siblings).
- Public companies: tiny `server/src/routes/publicRoutes.js` `createPublicRouter(customerModel)` with `GET /companies` (no auth; `Cache-Control: no-store`; response `{success:true,data:{companies:[{companyId,companyName}]}}`), mounted `app.use("/api/public", ...)`. Only id+name of Active companies are exposed.

## Controller + routes
- `server/src/controllers/customerController.js`: `{ me, listFaqs, listTickets, getTicket, createTicket }`, all `Cache-Control: no-store`; pass `request.auth`, `request.query`, `request.params.ticketId`, `request.body`.
- `server/src/routes/customerRoutes.js` `createCustomerRouter(customerService)`: `router.use(authenticate); router.use(requireRole("Customer"));` (coarse token check; service re-checks DB). Routes: `GET /me`, `GET /faqs`, `GET /tickets`, `POST /tickets`, `GET /tickets/:ticketId`. No PATCH/PUT/DELETE (Express 404 via `notFoundHandler`).
- `app.js`: require the new modules, `const customerService = dependencies.customerService || createCustomerService(dependencies);`, mount `/api/customer` and `/api/public` before `notFoundHandler`. `dependencies.customerModel` is shared by authService and customerService (same injection key).

## API contract
Ticket (customer view): `{ticketId, subject, description, status, priority, assigneeName, createdAt, updatedAt, resolvedAt}`.
- `GET /api/public/companies` -> 200 `{data:{companies:[{companyId,companyName}]}}`
- `POST /api/auth/customer/register` `{firstName,lastName,email,password,companyId}` -> 201 `{message,data:{user,token}}` + cookie. Errors: 422 `VALIDATION_ERROR`, 422 `COMPANY_NOT_FOUND`, 409 `EMAIL_EXISTS`, 429 `REGISTRATION_RATE_LIMITED`, 500 `CUSTOMER_ROLE_MISSING`.
- Sign-in unchanged: `POST /api/auth/sign-in {accountType:"individual",...}`; `roleName:"Customer"` in the response.
- `GET /api/customer/me` -> `{data:{customer,company,assistant}}`
- `GET /api/customer/faqs?search=&category=` -> `{data:{faqs,categories}}` (published only)
- `GET /api/customer/tickets?status=&page=&limit=` -> `{data:{tickets,pagination}}`
- `POST /api/customer/tickets` `{subject,description}` -> 201 `{data:{ticket}}`
- `GET /api/customer/tickets/:ticketId` -> `{data:{ticket}}`
Error codes (all customer routes): 401 `AUTHENTICATION_REQUIRED` / `INVALID_SESSION`; 403 `ROLE_FORBIDDEN` (non-Customer token or DB role), `COMPANY_ACCESS_DENIED`, `ACCOUNT_INACTIVE`, `COMPANY_INACTIVE`; 400 `INVALID_TICKET_ID`; 404 `TICKET_NOT_FOUND`; 409 `TICKET_LIMIT_REACHED`; 422 `VALIDATION_ERROR`; 500 generic.
Security invariants: company and customer id come from `findCustomerContext(token.userId)` only; all ticket SQL is parameterized with `company_id = ? AND customer_id = ?`; body `companyId/customerId/priority/status/assignedAgentId` ignored; customer tokens get 403 on `/api/company/*` (existing `requireRole("Company Admin")`), and Company Admin/agent tokens get 403 on `/api/customer/*`.

## Mock server (`server/scripts/mock-server.js`)
- Hash `CUSTOMER_PASSWORD = "Customer@2026!"` (bcrypt cost 4) and seed users: userId 20 "Casey Customer" `casey@customer.example` role Customer company 1 Active; userId 21 "Dana Other" `dana@customer.example` Customer company 1 (to prove cross-customer isolation); userId 22 "Gus Globex" `gus@customer.example` Customer company 2; userId 23 "Ina Inactive" Customer company 1 `accountStatus:"Inactive"`. Make sure new ids do not collide with existing seeded ids.
- Seed tickets with `customerId`: 4 for Casey (mixed Open / In Progress with assignee / Resolved), 2 for Dana (company 1), 1 for Gus (company 2). Reuse the in-memory `tickets` array and `nextTicketId`.
- Add `customerModel` implementing the signatures above (`listPublicCompanies` over `companies` where status Active, `findActiveCompany`, `findCustomerContext`, `createCustomer` pushing a Customer user with `nextUserId++`, duplicate email -> 409 AppError), add `listCustomerTickets`, `findCustomerTicketById`, `countOpenCustomerTickets` to the mock `ticketModel` (filter on companyId AND customerId, same ordering/pagination as `listTickets`). Pass `customerModel` into `createApp({...})`. `userModel.findByEmail` already reads the shared `users` array so sign-in works for the seeded and newly registered customers.
- Seed one unpublished and 2-3 published FAQs for company 1 (check existing `faqs` seed first; reuse) and ensure company 2 has an unpublished-only or different FAQ so isolation/draft hiding is testable. Seed AI settings for company 1 with `enabled: true`, `assistantName: "Acme Assistant"` if not already.
- Print `[mock] Customer: casey@customer.example / ...` in `listen()`.

## Client
Routes (`client/src/router/routes.ts`): `REGISTER_CUSTOMER: "/register"`, `CUSTOMER_TICKETS: "/support/tickets"`, `CUSTOMER_NEW_TICKET: "/support/tickets/new"`, `CUSTOMER_TICKET_DETAIL: "/support/tickets/:ticketId"`, `CUSTOMER_HELP: "/support/help"`; helper `customerTicketPath(id)`. Register in `index.tsx` (`/support` index redirects to tickets; `tickets/new` declared before `:ticketId`).

Files:
- `client/src/types/customer.ts`: `CustomerTicket`, `CustomerMe`, `PublicFaq`, `PublicCompany`, `CustomerRegistrationValues`, pagination type (reuse `TicketPagination`, `FieldError` from `types/tickets`).
- `client/src/services/customer.ts`: `listPublicCompanies`, `registerCustomer` (stores token/user via `setAuthToken`/`setStoredUser`, dispatches `supportpilot:authenticated` like sign-in), `getCustomerMe`, `listCustomerFaqs`, `listCustomerTickets(filters)`, `getCustomerTicket`, `createCustomerTicket` - all via `apiRequest` with `cache:"no-store"` and `ApiError` preserved (`payload.errors` for field errors, as `services/tickets.ts` does).
- `client/src/components/customer/CustomerRouteGuard.tsx`: modelled on `CompanyRouteGuard` (calls `getCustomerMe`; states loading / ready / forbidden / error; 401 -> clear token + user, navigate to `ROUTES.LOGIN`; 403 -> "Access Restricted" card with a message per code `ROLE_FORBIDDEN | COMPANY_ACCESS_DENIED | ACCOUNT_INACTIVE | COMPANY_INACTIVE` and a "Sign in with a customer account" button that logs out then goes to `/login`; error -> retry card). Provides `Outlet context {data: CustomerMe}`; hook `useCustomerPortal.ts`.
- `client/src/components/customer/CustomerLayout.tsx`: simple top-bar layout (brand, company name, nav links My tickets / New ticket / Help center with `aria-current`, user initials + Sign out via `logout()` then `/login`), responsive, same Tailwind tokens as `CompanyLayout` (`#f8f9fc` bg, `#6D5EF5` primary, white cards with `border-[#e2e4e9]`, Material Symbols icons).
- `client/src/pages/customer/CustomerTicketsPage.tsx`: heading "My tickets" + "New ticket" button; status filter (select, URL-synced `?status=&page=`); card/table list reusing `TicketStatusBadge` / `TicketPriorityBadge` (`data-testid` status-badge / priority-badge preserved) and `TicketsPagination` from `components/company/tickets` (import as-is, only change them if they hardcode company paths - then pass an `onSelect`/path prop rather than copying); states: loading skeleton (role=status), empty ("You have not submitted any tickets yet" + CTA; filtered-empty variant with clear filter), error with Retry (`role="alert"`), 401 -> login redirect.
- `client/src/pages/customer/CustomerNewTicketPage.tsx`: form (Subject 3-200, Description 1-5000 with live char counters, labels, client validation mirroring server, per-field server `errors` mapping, 409 `TICKET_LIMIT_REACHED` banner, double-submit disabled state). Side panel "Maybe this helps": published FAQs (top 5 matching typed subject by simple client-side substring filter of the already-fetched list; collapsible answers), plus when `assistant.enabled` the assistant greeting line ("<assistantName>: <greeting>") as static text (no chat). On success navigate to the new ticket detail with a success notice.
- `client/src/pages/customer/CustomerTicketDetailPage.tsx`: read-only: subject, status/priority badges, assignee ("Unassigned" -> "Waiting for an agent"), created/updated/resolved dates (use `ticketFormat.ts` helpers), description in `whitespace-pre-wrap`; note "Replies are coming soon" (item 9). Loading / error / 404 "Ticket not found" with link back (also shown for other customers' ids) / 400 handled as 404.
- `client/src/pages/customer/CustomerHelpPage.tsx`: searchable (debounced `search` param) + category filter list of published FAQs as accordions; loading/empty ("No help articles yet")/error states; CTA "Still need help? Submit a ticket".
- `client/src/pages/auth/CustomerRegisterPage.tsx` (+ small form component in `components/auth/CustomerRegistrationForm.tsx`, reuse `AuthShell`, `RegistrationField`, `PasswordField`): company `<select>` loaded from `listPublicCompanies` (loading/empty/error states), first/last name, email, password + confirm; reuses the password rule text; on success redirect to `ROUTES.CUSTOMER_TICKETS`. Client validation helper added to `client/src/validation/customerRegistration.ts`.
- Edits: `LoginForm.tsx` individual mode gets "Create a customer account" link to `/register`; `AuthPage.tsx` role redirects (3 places: Google callback effect, already-authenticated effect, post sign-in) add `role === "customer"` -> `ROUTES.CUSTOMER_TICKETS` (mount-effect also redirects customers when already signed in); `routes.ts`/`index.tsx` as above; `types/auth.ts` unchanged.

## Tests
### Server (`node --test`, mock-injected models only, no DB/env files)
1. `test/api/customer.test.js` (harness copied from `tickets.test.js`: inject `customerModel`, `ticketModel`, `faqModel`, `aiSettingsModel` in-memory mocks that record args):
   - 401 no credentials / invalid token on every route; 403 `ROLE_FORBIDDEN` for Company Admin, Support Agent, Platform Admin tokens (models untouched); a Customer token on `/api/company/tickets` and `/api/company/faqs` -> 403.
   - Resolver: no context -> `COMPANY_ACCESS_DENIED`; DB role not Customer despite token role Customer -> `ROLE_FORBIDDEN`; inactive user -> `ACCOUNT_INACTIVE`; inactive company -> `COMPANY_INACTIVE`; ticket model not called in each.
   - Identity from DB: token `companyId: 99`, `?companyId=99`, body `companyId/customerId: 99` ignored; model called with DB company and the token userId's customer id.
   - POST /tickets: 201 with `customerId` = caller, status Open, priority Medium, requester name/email from DB; body `priority:"Urgent"`, `status:"Closed"`, `assignedAgentId` ignored; response omits `companyId/customerId/requesterEmail/assignedAgentId`; 422 for missing/short/long subject, missing/oversize description, non-object body; 409 `TICKET_LIMIT_REACHED` when count >= 25 and create not called.
   - GET /tickets: defaults (page 1, limit 20) and pagination shape; status filter pass-through; 422 for bad status / page=0 / limit=101; only caller's tickets (model asserts both ids); empty list shape.
   - GET /tickets/:id: 200 own; other customer's ticket in same company -> 404; other company's -> 404; `abc`/`0`/`-1` -> 400 `INVALID_TICKET_ID`; `/tickets/new` is not a route in the API (404 or 400, not 200).
   - PATCH/PUT/DELETE on `/api/customer/tickets/:id` -> 404.
   - GET /faqs: faq model always called with `status:"published"` even if `?status=draft` sent; drafts never in output; presenter omits `isPublished/sortOrder/createdAt`; categories derived from returned rows only.
   - GET /me: `assistant.enabled` false when no settings row / row disabled; true with name+greeting when enabled; response never includes `customInstructions`/thresholds; AI model throwing -> still 200 with `enabled:false`.
   - `Cache-Control: no-store`; model errors -> 500 `Internal server error`.
2. `test/api/customerRegistration.test.js`: 201 + cookie + token role `Customer` (verify via `verifyAccessToken`) + `createCustomer` args (hashed password, never plaintext, company from body validated via `findActiveCompany`); 422 `VALIDATION_ERROR` (weak password, bad email, missing/non-integer companyId, unexpected fields incl. `roleName`/`accountStatus`); 422 `COMPANY_NOT_FOUND` (missing or inactive); 409 `EMAIL_EXISTS` (pre-check) and DB duplicate error mapped; privilege escalation attempt (`roleName: "Platform Admin"`) rejected; `GET /api/public/companies` returns id+name only (no email/status/phone) and needs no auth; signed-in registered customer can call `/api/customer/me`.
3. `test/validators/customerValidator.test.js`: table-driven for the four validators (trimming, bounds, ignored keys never in `value`, companyId coercion).
4. `test/models/customerModel.test.js` and additions to a new `test/models/customerTicketModel.test.js` using the existing pool-stub pattern (see `test/models/ticketModel.test.js`): assert generated SQL parameterized, `company_id = ? AND customer_id = ?` with params order `[companyId, customerId, ...]` for list/find/count, `createCustomer` selects role by name 'Customer' and maps `ER_BAD_NULL_ERROR`/`ER_DUP_ENTRY`, `listPublicCompanies` filters `status = 'Active'`.
5. Update `test/api/companyMe.test.js` / any test that enumerates users/roles only if affected (not expected). Do not alter existing item 3/6/7 tests.
Verification command: `cd server && npm test` (no DB, no `.env`, no `npm start`). Client: `cd client && npm run lint && npm run build`.

### Playwright (`client/e2e/customerPortal.spec.ts`, mock backend: `E2E_SERVER_COMMAND="npm run mock"`; selectors follow `companyTickets.spec.ts`)
- Unauthenticated `/support/tickets` -> redirected to `/login`.
- Customer login (`#individual-email`/`#individual-password`, casey) lands on `/support/tickets`, sees own 4 tickets, does NOT see Dana's or Globex's subjects.
- Company admin visiting `/support/tickets` sees "Access Restricted"; customer visiting `/company/tickets` sees Access Restricted (company guard) and `/admin/dashboard` is restricted.
- Submit ticket: client validation errors (short subject, empty description), successful submit -> detail page shows subject, status badge "Open", success notice; ticket appears at the top of the list.
- Detail read-only: no editing controls/no status select; navigating to Dana's ticket id -> "Ticket not found".
- Help page lists only published FAQs of company 1 (draft question absent), search narrows results.
- FAQ suggestions + assistant greeting visible on New ticket page for Acme (assistant enabled).
- Registration: `/register`, choose "Acme Demo Co", fill form, land on `/support/tickets` with empty state; duplicate email shows field error; Inactive customer (Ina) login shows account-inactive message.
- Mobile viewport (375px) renders list without horizontal overflow.

## File list
Server new: `src/constants/customerConstants.js`, `src/models/customerModel.js`, `src/validators/customerValidator.js`, `src/services/customerContext.js`, `src/services/customerService.js`, `src/controllers/customerController.js`, `src/routes/customerRoutes.js`, `src/routes/publicRoutes.js`, `test/api/customer.test.js`, `test/api/customerRegistration.test.js`, `test/validators/customerValidator.test.js`, `test/models/customerModel.test.js`, `test/models/customerTicketModel.test.js`.
Server edited: `src/app.js`, `src/config/database.js`, `src/models/ticketModel.js`, `src/services/authService.js`, `src/controllers/authController.js`, `src/routes/authRoutes.js`, `src/middleware/validateRequest.js`, `src/validators/authValidator.js` (export patterns), `scripts/mock-server.js`.
Client new: `src/types/customer.ts`, `src/services/customer.ts`, `src/validation/customerRegistration.ts`, `src/components/customer/{CustomerRouteGuard,CustomerLayout}.tsx`, `src/components/customer/useCustomerPortal.ts`, `src/components/auth/CustomerRegistrationForm.tsx`, `src/pages/customer/{CustomerTicketsPage,CustomerNewTicketPage,CustomerTicketDetailPage,CustomerHelpPage}.tsx`, `src/pages/auth/CustomerRegisterPage.tsx`, `e2e/customerPortal.spec.ts`.
Client edited: `src/router/routes.ts`, `src/router/index.tsx`, `src/pages/auth/AuthPage.tsx`, `src/components/auth/LoginForm.tsx`.
Docs: tick item 8 in `docs/PROGRESS.md` with notes (customer = users row with role Customer + company_id; item 9 may add replies on `/api/customer/tickets/:id`; item 10 can generalise role redirects and Google customers).

## Risks / notes for the implementer
- `roles` table shape is unknown; keep the role insert best-effort and never fail startup. Real deployments may need the `Customer` role row created manually (log a one-line non-test warning when the insert fails).
- Never read `process.env` outside existing config patterns; no new env vars required.
- Public company list is deliberately limited to id+name of Active companies; if this is undesirable later, switch to a per-company signup link (item 10).
- Keep `express.json` 10kb limit; 5000-char description fits.
