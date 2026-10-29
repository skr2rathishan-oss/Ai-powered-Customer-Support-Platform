# Plan: Support agents - model + invite/deactivate API and UI (PROGRESS item 5)

One run: server API + tests + mock server, then the `/company/agents` page. No DB access, no `npm start`, no `server/.env`.

## Findings
- Layering `routes -> controllers -> services -> models`; `createApp(deps)` builds services from `deps` (`dependencies.agentService || createAgentService(dependencies)`). Tests inject mock models. Raw SQL with `?` via `getMySQLPool().execute`; models take `companyId` first and an optional trailing `options.pool` (see `ticketModel.js`).
- Company comes ONLY from `companyPortalModel.findCompanyAdminContext(userId)` through `createCompanyContextResolver().requireActiveCompanyAdmin(auth)`. Router also applies `authenticate` + `requireRole("Company Admin")` (coarse); the service re-checks DB role/status.
- Agents are `users` rows with `company_id` and `roles.role_name = 'Support Agent'`. No new table, no schema change (prefer none; `initMySQLSchema` untouched).
- `users.password_hash` is nullable (Google users are inserted with NULL). `authService.signIn` rejects any account with a NULL hash, so a NULL hash is a safe "unusable password". Agents sign in through the individual login (`accountType: "individual"`, `users.findByEmail`), which is not company-scoped; fine.
- `password_reset_tokens` + `/reset-password?token=` page + `authService.resetPassword` already set a password from a hashed token (SHA-256 of 32 random bytes, `used`/`used_at`/`expires_at`). Reuse for invites (agent sets password -> becomes able to sign in). `requestPasswordReset` only issues tokens for Active users, so a deactivated agent cannot self-reset; `resetPassword` itself does not re-check status, so deactivation must also invalidate tokens.
- `emailService.sendPasswordResetEmail(to, link)` is the only mailer; add a sibling `sendAgentInviteEmail(to, link, {companyName, inviterName})` using the same transporter/templates.
- Ticket assignment already exists: `ticketModel.findAssignableAgent` / `listAssignableAgents` require company + role + `account_status='Active'`, so deactivated agents are automatically non-assignable.
- `companyService` returns `features.agents: false` and the router shows `CompanyComingSoonPage` for `ROUTES.COMPANY_AGENTS`; `test/api/companyMe.test.js` asserts all features false and must be updated.
- `account_status` values used: `'Active'`; use `'Inactive'` for deactivated (the sign-in check is `!== active` case-insensitive, so any non-Active blocks login).
- JWTs are stateless: an already-issued session of a deactivated agent keeps working until expiry on routes that only check the token. No agent routes exist yet; item 9 MUST re-check DB `account_status` (note in PROGRESS).

## Decisions
1. Invite mechanism: INSERT user with `password_hash = NULL`, `account_status='Active'`, `online_status='Offline'`, role Support Agent, `company_id` from DB. Then create a reset token (`crypto.randomBytes(32).toString("hex")`, store only SHA-256 hash, TTL 72 h, via `tokenModel.createPasswordResetToken`) and email `${CLIENT_ORIGIN}/reset-password?token=...`.
2. The raw token/link is NEVER returned by the API, never logged in production, never in a list response. API returns only `emailSent: boolean`. On send failure the agent row stays (status pending) and response is 201 with `emailSent:false` and the UI offers "Resend invite". Test visibility: service takes injected `sendAgentInviteEmail`; tests capture the link from the fake mailer (do not copy the `resetToken`-in-response-under-NODE_ENV=test pattern). The mock server's injected mailer prints the link to stdout (mock only) so devs/e2e can complete the flow.
3. Resend: `POST /api/company/agents/:agentId/resend-invite` allowed only while `invitePending` (password_hash NULL AND google_id NULL) and agent Active; invalidates prior tokens (`tokenModel.invalidateUserTokens`) then issues a new one. Cooldown: none (no state to hold); noted as follow-up.
4. Deactivate: set `account_status='Inactive'` FIRST, then `UPDATE tickets SET assigned_agent_id = NULL WHERE company_id=? AND assigned_agent_id=? AND status IN ('Open','In Progress')` (Resolved/Closed keep their assignee for history), then `tokenModel.invalidateUserTokens(agentId)`. Response includes `unassignedTickets: n`. Status-first ordering means a concurrent assign fails `findAssignableAgent`. UI confirm dialog states the count of open tickets that will become unassigned.
5. Reactivate: set `Active`; nothing is re-assigned. If invite still pending the agent keeps `invitePending` and can be resent.
6. PATCH is idempotent: setting the status the agent already has returns 200 unchanged with `unassignedTickets: 0`.
7. Only Support Agent rows of the caller's company are addressable; anything else (other company, Company Admin, nonexistent) is `AGENT_NOT_FOUND` 404 (indistinguishable). An admin cannot deactivate themselves because they are not a Support Agent row.
8. Editing name/email, deleting agents, bulk invite, roles: out of scope. No pagination (agents per company are few): list returns all, hard cap `LIMIT 500`; client filters by status/search locally.

## API (`server/src/routes/agentRoutes.js`, mounted in `app.js` at `/api/company/agents` BEFORE `/api/company`)
`router.use(authenticate); router.use(requireRole("Company Admin"));` all handlers via `asyncHandler`, responses `Cache-Control: no-store`, envelope `{success:true,data}`.

- `GET /api/company/agents` -> 200 `{ agents: Agent[], summary: {total, active, inactive, invitePending} }`
  `Agent = { agentId, firstName, lastName, name, email, status: "Active"|"Inactive", onlineStatus, invitePending: boolean, openTickets: number, createdAt? }`
  `openTickets` = tickets with `status IN ('Open','In Progress')` assigned to the agent in this company. SQL: users INNER JOIN roles (`Support Agent`) LEFT JOIN `(SELECT assigned_agent_id, COUNT(*) c FROM tickets WHERE company_id=? AND status IN (...) GROUP BY assigned_agent_id)`; `WHERE u.company_id=?`; ORDER BY `u.account_status`, `u.first_name`, `u.last_name`. No password hash or google id in output (compute `invitePending` in SQL as `(u.password_hash IS NULL AND u.google_id IS NULL)`).
- `POST /api/company/agents` body `{firstName,lastName,email}` -> 201 `{ agent: Agent, emailSent: boolean }`
- `POST /api/company/agents/:agentId/resend-invite` -> 200 `{ emailSent: boolean }`
- `PATCH /api/company/agents/:agentId` body `{status: "Active"|"Inactive"}` -> 200 `{ agent: Agent, unassignedTickets: number }`
- (`GET .../:agentId` not needed; the PATCH/POST return the fresh Agent.)

### Validation (`validators/agentValidator.js`, returns `{value, errors}` like ticketValidator)
- Body must be a plain object else `{field:"body"}`.
- create: `firstName`, `lastName`: trimmed string, 1-50 chars, required, must not contain control chars; `email`: trimmed, lowercased, `EMAIL_PATTERN` from authValidator, max 255. Unknown keys ignored (never read `companyId`/`role` from body).
- patch: `status` required, must be exactly `"Active"` or `"Inactive"`; other keys ignored.
- `agentId` param via the same positive-integer parser as `parseTicketId` (export a shared `parsePositiveIntegerString` or reuse `parseTicketId`).

### Errors
| Status | code | When |
|---|---|---|
| 401 | AUTHENTICATION_REQUIRED / INVALID_SESSION | middleware |
| 403 | ROLE_FORBIDDEN | token role or DB role not Company Admin |
| 403 | COMPANY_ACCESS_DENIED / ACCOUNT_INACTIVE / COMPANY_INACTIVE | context resolver |
| 400 | INVALID_AGENT_ID | non-positive-integer param |
| 404 | AGENT_NOT_FOUND | missing, other company, or not a Support Agent |
| 409 | EMAIL_IN_USE | `userModel.findByEmail` hit or `ER_DUP_ENTRY` on insert (race) |
| 409 | INVITE_NOT_PENDING | resend for an agent who already has a password/google, or is Inactive |
| 422 | VALIDATION_ERROR | with `errors:[{field,message}]` |
| 500 | AGENT_ROLE_MISSING | no 'Support Agent' role row (insert subselect returns NULL) |
Email send failure is not an error response; it yields `emailSent:false` (logged without the link, with error code only).

## Server files
Add:
- `server/src/models/agentModel.js`: `listAgents(companyId)`, `findAgent(companyId, agentId)`, `createAgent(companyId, {firstName,lastName,email})` (role_id via `(SELECT role_id FROM roles WHERE role_name='Support Agent' LIMIT 1)`; throws if insertId missing; returns `findAgent`), `setAgentStatus(companyId, agentId, status)` (`UPDATE users u JOIN roles r ... WHERE u.user_id=? AND u.company_id=? AND r.role_name='Support Agent'`), `unassignOpenTickets(companyId, agentId)` returns `affectedRows`. All `?`-parameterized, company in every WHERE.
- `server/src/services/agentService.js`: `createAgentService(dependencies)` with injected `agentModel`, `companyPortalModel`, `userModel` (email lookup), `tokenModel`, `sendAgentInviteEmail`, `generateToken` (default crypto), `now`. Exposes `listAgents`, `inviteAgent`, `resendInvite`, `setAgentStatus`. Always begins with `requireActiveCompanyAdmin(auth)`.
- `server/src/controllers/agentController.js`, `server/src/routes/agentRoutes.js`, `server/src/validators/agentValidator.js`, `server/src/constants/agentConstants.js` (name max 50, TTL 72 h, statuses).
Change:
- `server/src/services/emailService.js`: add `sendAgentInviteEmail` (+ text/html template, link only in body, subject "You're invited to join {company} on SupportPilot"); export it.
- `server/src/app.js`: wire service + router.
- `server/src/services/companyService.js`: `features.agents: true`; update `test/api/companyMe.test.js` expectations.
- `server/scripts/mock-server.js`: see below.
- `docs/PROGRESS.md`: tick item 5, add Run 5 log, note item 9 must re-check DB status.

## Mock server additions
- Seed more agents: acme (company 1): keep Sam Agent (id 4, Active, 2 open tickets), add Riya Patel (id 6, Active, 0 tickets), Dev Inactive (id 7, `accountStatus: "Inactive"`, one Open ticket assigned? no - inactive must have none; give him a Resolved ticket assigned), Nia Pending (id 8, Active, `passwordHash: null`, invitePending). Globex keeps Gina (5) for isolation. Add a Company 1 ticket assigned to Riya? keep Riya at 0 to show empty workload.
- `agentModel` mock implementing the 5 methods over the `users`/`tickets` arrays (company-scoped, same filter as real SQL; `nextUserId` counter, throws `{code:"ER_DUP_ENTRY"}` on duplicate email).
- `tokenModel` mock already exists: extend with `createPasswordResetToken`/`invalidateUserTokens` if missing, and make `/reset-password` flow set the hash so the invited agent can sign in (verify against the existing mock `userModel.setPassword`).
- Inject `sendAgentInviteEmail: async (to, link) => console.log("[mock] invite link for", to, link)`.
- `companyPortalModel`/`ticketModel` mocks: confirm assignable list excludes Inactive (already `isAssignableAgent`).

## Server tests (node --test, mock-injected; no DB)
`server/test/api/agents.test.js` (same helpers as `tickets.test.js`: `startTestServer`, `companyToken`, `baseContext`, in-memory fake models with two companies) and `server/test/validators/agentValidator.test.js`.
1. Auth: 401 no cookie; 403 for Support Agent token, Platform Admin token, token with Company Admin role but DB role differing (`ROLE_FORBIDDEN`); 403 inactive company/user.
2. List: returns only own-company Support Agents, with correct `openTickets` (Resolved excluded), `invitePending`, summary; no `passwordHash`/`googleId`/token fields in body; company id comes from DB even if token claims another (`companyId: "999"`) and `?companyId=2` is ignored; `Cache-Control: no-store`; model called with company 7.
3. Invite: 201, user created with company from DB (body `companyId`/`roleName` injected values ignored), fake mailer called once with link `.../reset-password?token=<64 hex>`, token hash stored equals SHA-256 of the link token, expiry ~72 h, response JSON does NOT contain the token or link; email lowercased; 409 EMAIL_IN_USE for existing email (any company); ER_DUP_ENTRY race maps to 409; 422 for missing/long names, bad email, non-object body; mailer throwing -> still 201 with `emailSent:false` and nothing leaked.
4. Resend: success invalidates old tokens + new mail; 409 INVITE_NOT_PENDING when password set / Inactive; 404 for other company's agent.
5. PATCH deactivate: sets Inactive, calls `unassignOpenTickets` for own company only, invalidates tokens, returns `unassignedTickets`; idempotent second call; reactivate does not touch tickets; 422 for status `"Banned"`; 400 `INVALID_AGENT_ID` for `abc`, `0`, `1.5`; 404 for another company's agent, for a Company Admin's id, for nonexistent.
6. Integration with tickets: after deactivation `ticketModel.findAssignableAgent` fake (or real service with shared fake) rejects assignment with `INVALID_ASSIGNEE`.
7. `companyMe` test updated: `features.agents === true`.
8. Optional model SQL test (`test/models/agentModel.test.js`, fake `pool.execute`, as `ticketModel.test.js`): every statement includes `company_id = ?` and the company param, no string interpolation of input.

## Client (`/company/agents`)
Add:
- `client/src/types/agents.ts` (`Agent`, `AgentStatus`, `InviteAgentInput`, `AgentListResult`).
- `client/src/services/agents.ts` (`listAgents`, `inviteAgent`, `resendInvite`, `setAgentStatus`) via `apiRequest`, `cache: "no-store"`, `ApiError` field errors like `services/tickets.ts`.
- `client/src/components/company/agents/{AgentsTable,InviteAgentModal,AgentStatusDialog,AgentStatusBadge}.tsx`.
- `client/src/pages/company/CompanyAgentsPage.tsx`.
Change: `router/index.tsx` (real page instead of `CompanyComingSoonPage` for agents), `CompanyLayout` (no change if it keys off `features.agents`; Soon badge disappears), `e2e/companyPortal.spec.ts` if it asserts agents "Soon".

### Page behaviour
- Header "Agents" + summary chips (Active n, Inactive n, Invite pending n) + "Invite agent" button. Controls: search (name/email, client-side), status filter select (All/Active/Inactive).
- Table columns: Name (+ "Invite pending" badge), Email, Status badge (text "Active"/"Inactive"), Open tickets (link to `/company/tickets?assignee=<id>&status=Open` is optional; plain number is fine), Actions (Resend invite when pending, Deactivate / Reactivate).
- Invite modal: First name, Last name, Email (labels, required, client checks mirror server), submit "Send invite"; server 422/409 shown against fields (EMAIL_IN_USE under Email); on success close, refresh list, show status line: "Invite sent to x" or alert "Agent created but the email could not be sent. Use Resend invite." Does not display any link.
- Deactivate: confirm dialog "Deactivate Sam Agent? N open tickets will become unassigned. They will no longer be able to sign in." On success, status message includes the unassigned count. Reactivate: single click with inline pending state.
- States: loading (skeleton rows, `aria-busy`), empty ("No support agents yet" + Invite button), no-match-after-filter ("No agents match your filters" + Clear), error (`role="alert"` + Try again), per-row action error alert, 401/403 reuse `useTicketAuthError` pattern (rename/generalize or copy) to redirect or show Access Restricted.
- A11y: table `<caption className="sr-only">`; modals `role="dialog" aria-modal aria-labelledby`, focus first field, Escape closes, focus returns to trigger; buttons have accessible names including the agent name (`aria-label="Deactivate Sam Agent"`); live region (`role="status"`) for success messages; badges carry text; visible focus rings; mobile table scrolls inside its card, no page horizontal scroll.

## Playwright outline (`client/e2e/companyAgents.spec.ts`, mock backend)
Header: `E2E_SERVER_COMMAND="npm run mock" npx playwright test companyAgents`. Reuse `loginAsCompanyAdmin`; `beforeEach` clears cookies. Locators by role/label; specs must not rely on exact counts after mutations.
1. Unauthenticated `/company/agents` -> `/login/company`; platform admin -> "Access Restricted".
2. Nav: Agents link has no "Soon" badge, `aria-current="page"`; shows Sam Agent, Riya Patel, Dev Inactive, Nia Pending (+ badges); Globex's Gina NOT visible; Sam shows 2 open tickets.
3. Filter: Status "Inactive" shows only Dev; search "riya" shows one row; nonsense shows empty-match state; Clear restores.
4. Invite: empty submit shows field errors; duplicate email `agent@acme-demo.com` shows email-in-use error and dialog stays; existing Globex agent email also rejected; valid new agent -> dialog closes, row appears with "Invite pending", success status visible, no link text on page; Escape closes dialog and focus returns to button.
5. Deactivate Sam: confirm dialog mentions 2 open tickets; confirm -> badge Inactive; `/company/tickets` assignee select no longer lists Sam and tickets 1 and 2 show Unassigned; reactivate Sam -> Active and Sam appears in assignee select again.
6. Resend invite on Nia -> success status; `page.route` 500 on PATCH shows row error alert and status unchanged.
7. Error state: `page.route` 500 on `GET **/api/company/agents` -> alert + Try again; unroute + click -> rows. Empty state via `page.route` fulfilling `{agents:[],summary:{...0}}`.
8. Optional full loop: read invite link from mock stdout is not feasible in Playwright; skip, covered by server tests.

## Verification
- `cd server && npm test` (all green, incl. new tests); `cd client && npm run lint && npm run build`.
- Playwright only if Chromium is available (as in Run 4; throwaway config). Otherwise state not executed.
- Never run `npm start`/`dev` in `server/`, never connect to a database, never create `server/.env`.

## Out of scope / follow-ups
Agent sign-in redirect and portal (item 9, must re-check DB status per request), editing/removing agents, invite rate limiting/cooldown, per-company agent cap, platform-setting-driven password policy on the set-password page (item 12), customers (item 8).
