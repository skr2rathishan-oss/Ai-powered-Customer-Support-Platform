# Plan: Tickets data model + company-scoped API (PROGRESS item 3, server only)

## Findings
- Same layering as item 2: `routes -> controllers -> services -> models`, `createApp(deps)` builds services from `deps` (`dependencies.ticketService || createTicketService(dependencies)`), tests inject mock models. Raw SQL with `?` params through `getMySQLPool().execute` (list queries with `LIMIT ? OFFSET ?` and Number params already work in `adminModel.js`, follow that).
- Errors: `new AppError(message, status, code, errors)`; `errorHandler` emits `{success:false,message,code?,errors?}`. Validation failures use 422 with `errors: [{field,message}]` (see `authValidator`: validators return `{ value, errors }`).
- Company comes ONLY from DB (`companyPortalModel.findCompanyAdminContext(userId)` via `company_admins.admin_id`). Never from token, body, query or params. `requireRole("Company Admin")` is only a coarse token check; the service re-checks DB role/status.
- Support agents belong to a company through `users.company_id` and `roles.role_name = 'Support Agent'` (exactly the lookup already in `getCompanyOverviewCounts`). No separate agents table. Assignable = same `company_id`, role 'Support Agent', `account_status = 'Active'`.
- There is no customer model/role usage yet (item 8). `customer_id` is a plain nullable INT with no FK, and an admin-created ticket records the requester in free text fields.
- `initMySQLSchema` swallows errors and column types of `users`/`companies` are unknown to us, so NO foreign keys (a type mismatch would silently skip table creation). Use plain INT columns + indexes; enforce tenancy in the app.
- `docs/plans/company-portal-shell.md` conventions followed. `test/api/companyMe.test.js` currently asserts `features` all false (line ~145) and openTickets 0; it must be updated (see Tests).

## Schema (`server/src/config/database.js`)
Add `async function ensureTicketsTable(pool)` modelled on `ensurePlatformSettingsTable` (own try/catch, warn only when `NODE_ENV !== "test"`). Call it in `initMySQLSchema` right after `await ensurePlatformSettingsTable(pool);`. Idempotent `CREATE TABLE IF NOT EXISTS`, no data seeding:
```
tickets (
  ticket_id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  customer_id INT NULL,
  requester_name VARCHAR(150) NULL,
  requester_email VARCHAR(255) NULL,
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Open',
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
  assigned_agent_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  INDEX idx_tickets_company_status (company_id, status, created_at),
  INDEX idx_tickets_company_priority (company_id, priority),
  INDEX idx_tickets_company_agent (company_id, assigned_agent_id),
  INDEX idx_tickets_company_resolved (company_id, resolved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```
VARCHAR (not ENUM) so values can evolve; allowed values enforced in the validator. No `ticket_messages` table: replies/conversation belong to item 9. Export nothing new from database.js.

## Constants
New `server/src/constants/ticketConstants.js` (CommonJS): `TICKET_STATUSES = ["Open","In Progress","Resolved","Closed"]`, `OPEN_STATUSES = ["Open","In Progress"]`, `TICKET_PRIORITIES = ["Low","Medium","High","Urgent"]`, `ASSIGNEE_UNASSIGNED = "unassigned"`, `SUBJECT_MAX=200`, `DESCRIPTION_MAX=5000`, `SEARCH_MAX=100`, `DEFAULT_LIMIT=20`, `MAX_LIMIT=100`.

NOTE: `express.json({limit:"10kb"})` in app.js still bounds description; 5000 chars fits. Do not change the limit.

## Model: `server/src/models/ticketModel.js`
All functions take `companyId` first and put `company_id = ?` in every WHERE. Row mapping aliases to camelCase in SQL: `ticketId, companyId, customerId, requesterName, requesterEmail, subject, description, status, priority, assignedAgentId, assigneeName, createdAt, updatedAt, resolvedAt`. `assigneeName` = `NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), '')` from `LEFT JOIN users AS a ON a.user_id = t.assigned_agent_id AND a.company_id = t.company_id`. Shared `const TICKET_SELECT` string.
- `createTicket(companyId, { customerId, requesterName, requesterEmail, subject, description, status, priority, assignedAgentId }) -> Promise<ticketRow>`: INSERT (resolved_at = NOW() when status is Resolved/Closed, else NULL), then `findTicketById(companyId, insertId)`.
- `findTicketById(companyId, ticketId) -> row | null` (`WHERE t.company_id = ? AND t.ticket_id = ?`).
- `listTickets(companyId, { status, priority, assigneeId, unassigned, search, page, limit }) -> { tickets, total, page, limit }`. Builds WHERE from non-empty filters only: `t.status = ?`, `t.priority = ?`, `t.assigned_agent_id = ?` or `t.assigned_agent_id IS NULL`, search = `(t.subject LIKE ? OR t.requester_name LIKE ? OR t.requester_email LIKE ?)` with `%term%` after escaping `\ % _` in the term (use `ESCAPE '\\'`). Order `t.created_at DESC, t.ticket_id DESC`. Two queries (COUNT(*) then page with `LIMIT ? OFFSET ?`, Number params).
- `updateTicket(companyId, ticketId, changes) -> row | null`. `changes` allowlist only `status`, `priority`, `assignedAgentId` (null clears). Build `SET` from provided keys only (column names hard-coded, never from input). If `status` provided: Resolved/Closed adds `resolved_at = COALESCE(resolved_at, NOW())`; Open/In Progress adds `resolved_at = NULL`. `WHERE company_id = ? AND ticket_id = ?`; then returns `findTicketById`. Empty `changes` just returns find result.
- `findAssignableAgent(companyId, agentId) -> { userId, firstName, lastName, email } | null`: `users u JOIN roles r ON r.role_id=u.role_id WHERE u.user_id=? AND u.company_id=? AND r.role_name='Support Agent' AND u.account_status='Active'`.
- `listAssignableAgents(companyId) -> [{ userId, firstName, lastName, email, onlineStatus }]` same predicate, ordered by first_name, last_name.

Also extend `companyPortalModel.getCompanyOverviewCounts(companyId)` to return `{ supportAgents, openTickets, resolvedToday }` with two extra single-row queries on `tickets` (`status IN ('Open','In Progress')`; `resolved_at >= CURDATE() AND resolved_at < CURDATE() + INTERVAL 1 DAY AND status IN ('Resolved','Closed')`), each `company_id = ?`. Keep the existing supportAgents query.

## Service: `server/src/services/ticketService.js`
`createTicketService(dependencies = {})` with `ticketModel = dependencies.ticketModel || default`, `portal = dependencies.companyPortalModel || default`. Returns `{ listTickets, getTicket, createTicket, updateTicket, listAssignableAgents }`, each `(auth, ...)`.

Shared company resolution: extract the guard logic from `companyService.getCompanyProfile` into new `server/src/services/companyContext.js`: `createCompanyContextResolver(portal) -> { requireActiveCompanyAdmin(auth) }` returning the context. It must keep the exact existing errors/order (401 `AUTHENTICATION_REQUIRED`; 403 `COMPANY_ACCESS_DENIED`; 403 `ROLE_FORBIDDEN`; 403 `ACCOUNT_INACTIVE`; 403 `COMPANY_INACTIVE`). Refactor `companyService` to use it with zero behaviour change (companyMe tests must stay green). Both services construct the resolver from the same injected `companyPortalModel`. Every ticketService method starts with `const { companyId } = await requireActiveCompanyAdmin(auth)`.

Behaviour:
- `listTickets(auth, rawQuery)`: validated via `validateListQuery`; returns `{ tickets, pagination: { page, limit, total, totalPages } }`.
- `getTicket(auth, rawId)`: id validated; not found in this company -> 404 `TICKET_NOT_FOUND` (same for another company's ticket, never 403, to avoid leaking existence).
- `createTicket(auth, body)`: validated; if `assignedAgentId` set, `findAssignableAgent(companyId, id)` else 422 `INVALID_ASSIGNEE`; `customerId` is NOT accepted from the client in this item (always null; item 8 sets it). Default status Open, priority Medium. Returns the row (201).
- `updateTicket(auth, rawId, body)`: validate; load ticket (404 `TICKET_NOT_FOUND`); if `assignedAgentId` is a number, check `findAssignableAgent` -> 422 `INVALID_ASSIGNEE` (`null` unassigns, no check); reject re-assigning to the already assigned agent? No - idempotent, allowed. Closed tickets: changing status away from Closed is allowed (reopen); no extra state machine. Calls `ticketModel.updateTicket`; if it returns null -> 404.
- `listAssignableAgents(auth)`: returns `{ agents }`.

## Validator: `server/src/validators/ticketValidator.js`
Return `{ value, errors }` (errors `[{field,message}]`), unknown body keys ignored but never copied into `value`. Body must be a plain object else `[{field:"body",message:"Request body must be a JSON object"}]`.
- `validateCreateTicketPayload(body)`: `subject` string trimmed 3..200 required; `description` trimmed 1..5000 required; `priority` optional in TICKET_PRIORITIES (case-sensitive exact, default Medium); `status` optional in TICKET_STATUSES (default Open); `requesterName` optional trimmed <=150 (empty -> null); `requesterEmail` optional valid email (reuse `EMAIL_PATTERN`: export it from authValidator or copy) <=255, lowercased; `assignedAgentId` optional positive integer or null.
- `validateUpdateTicketPayload(body)`: at least one of `status`, `priority`, `assignedAgentId` else 422 with `[{field:"body",message:"Provide at least one of status, priority, assignedAgentId"}]`; same per-field rules; `assignedAgentId: null` allowed.
- `validateListQuery(query)`: `status`, `priority` optional exact enum; `assignee` optional: `"unassigned"` or positive integer string; `search` optional trimmed <=100; `page` int >=1 default 1; `limit` int 1..100 default 20. Anything invalid -> 422.
- `parseTicketId(raw) -> number | null` (positive safe integer string only); service throws 400 `INVALID_TICKET_ID` when null.

Error codes summary: 401 `AUTHENTICATION_REQUIRED`/`INVALID_SESSION` (middleware); 403 `ROLE_FORBIDDEN`, `COMPANY_ACCESS_DENIED`, `ACCOUNT_INACTIVE`, `COMPANY_INACTIVE`; 400 `INVALID_TICKET_ID`; 404 `TICKET_NOT_FOUND`; 422 `VALIDATION_ERROR` (message "Validation failed", `errors` array); 422 `INVALID_ASSIGNEE` ("Assignee must be an active support agent of your company", `errors:[{field:"assignedAgentId",message}]`).

## Controller + routes
`server/src/controllers/ticketController.js`: `createTicketController(ticketService)` returning `{ list, get, create, update, listAgents }`; all set `Cache-Control: no-store`; responses `{success:true,data}`: list 200 `data:{tickets,pagination}`; get 200 `data:{ticket}`; create 201 `data:{ticket}`; update 200 `data:{ticket}`; agents 200 `data:{agents}`. Pass `request.auth`, `request.query`/`request.body`/`request.params.ticketId`.

`server/src/routes/ticketRoutes.js`: `createTicketRouter(ticketService)`: `router.use(authenticate); router.use(requireRole("Company Admin"));` then (order matters, static before param):
`GET /assignable-agents`, `GET /`, `POST /`, `GET /:ticketId`, `PATCH /:ticketId`, each `asyncHandler`. No DELETE.

`server/src/app.js`: require both, `const ticketService = dependencies.ticketService || createTicketService(dependencies);` and mount `app.use("/api/company/tickets", createTicketRouter(ticketService));` BEFORE `app.use("/api/company", createCompanyRouter(...))` (otherwise nothing breaks since company router only has `/me`, but keep specific-first) and before `notFoundHandler`.

## Overview + flag
`companyService.getCompanyProfile`: read `openTickets`, `resolvedToday` from `getCompanyOverviewCounts` (`Number(x||0)`, failure -> all 0 as now); set `features.tickets: true` (agents/faqs/aiSettings stay false).

## Mock server (`server/scripts/mock-server.js`)
Build an in-memory `tickets` array (module-scoped in `buildMockApp`, `nextTicketId`). Seed ~8 tickets for company 1 (mixed statuses/priorities, two assigned to user 4 "Sam Agent", one unassigned, one Resolved with `resolvedAt` = today, one Closed) and 2 for company 2 (Globex) so isolation is demonstrable. Add `ticketModel` implementing the exact signatures above (filtering, search, pagination, `assigneeName` from `users`, resolved_at rules, `findAssignableAgent` / `listAssignableAgents` using `users` with roleName 'Support Agent' + same companyId + accountStatus Active). Extend mock `companyPortalModel.getCompanyOverviewCounts` to also return `openTickets` and `resolvedToday` computed from `tickets`. Pass `ticketModel` into `createApp({...})`. Optionally add a second Active agent for company 2 to test cross-company assignment rejection.

## Tests
1. Update `test/api/companyMe.test.js`: features.tickets expected `true`; add a case that counts `{supportAgents:3, openTickets:5, resolvedToday:2}` surface in `overview`; missing keys default to 0.
2. New `test/api/tickets.test.js` (same harness as companyMe: env vars first, `startTestServer`, cookie token via `createAccessToken`; inject `companyPortalModel` (context for admin userId 2 -> companyId 7) and an in-memory `ticketModel` mock that records `companyId` args). Cases:
   - 401 no credentials / invalid token on GET list; 403 `ROLE_FORBIDDEN` for Platform Admin and Support Agent tokens with models untouched (all 5 routes).
   - 403 `COMPANY_ACCESS_DENIED` (no context), `COMPANY_INACTIVE`, `ACCOUNT_INACTIVE`, DB role mismatch; ticket model not called.
   - Company comes from DB: token `companyId: 99` and `?companyId=99` / body `companyId: 99` are ignored; model always called with 7.
   - POST create: 201 with defaults (status Open, priority Medium, customerId null); body `customerId`/`companyId` ignored; 422 on missing subject, short subject (<3), subject >200, description missing/>5000, bad priority, bad status, bad requesterEmail, non-integer assignedAgentId, non-object body; 422 `INVALID_ASSIGNEE` when `findAssignableAgent` returns null (agent from another company or inactive), 201 with valid agent.
   - GET list: defaults page 1/limit 20 and pagination shape; filters pass through (status, priority, assignee=5, assignee=unassigned, search); invalid status/priority/assignee/page=0/limit=101 -> 422; search wildcard characters passed through to the model unescaped (model tested separately if feasible) .
   - GET :id: 200; `abc`/`0`/`-1` -> 400 `INVALID_TICKET_ID`; other company's ticket (model returns null for that company) -> 404 `TICKET_NOT_FOUND`.
   - PATCH :id: status change 200; empty body / only unknown keys -> 422; bad enum -> 422; `assignedAgentId: null` unassigns without agent lookup; assigning to non-agent -> 422 `INVALID_ASSIGNEE`; other company's ticket -> 404 and `updateTicket` NOT called; model returning null after update -> 404.
   - GET /assignable-agents: returns agents for company 7 only; not captured by `/:ticketId` (no 400).
   - Model errors -> 500 `Internal server error`; `Cache-Control: no-store` on responses.
3. New `test/validators/ticketValidator.test.js`: table-driven unit tests for the three validators and `parseTicketId` (trimming, defaults, limits, enum case-sensitivity, null assignee).
4. New `test/models/ticketModel.test.js` only if the repo pattern in `test/models/companyModel.test.js` allows stubbing the pool; mirror it to assert generated SQL always includes `company_id = ?` as first param, search escaping, and that `updateTicket` only sets allowlisted columns. If that pattern isn't pool-stubbable, skip and rely on the API tests.
5. Mock-server smoke (no listening): optional `test/api/mockServer.test.js` building `buildMockApp()` and checking login-free unit behaviour is out of scope; manually verify via `npm run mock` is NOT needed for this item.

Verification: `cd server && npm test` only (no DB, no `.env`, no `npm start`). Do not touch client; item 4 consumes this contract. Update `docs/PROGRESS.md` item 3 when done.

## API contract (for item 4)
Ticket object: `{ticketId,companyId,customerId,requesterName,requesterEmail,subject,description,status,priority,assignedAgentId,assigneeName,createdAt,updatedAt,resolvedAt}`.
- `GET /api/company/tickets?status=&priority=&assignee=<id|unassigned>&search=&page=&limit=` -> `{success,data:{tickets,pagination:{page,limit,total,totalPages}}}`
- `POST /api/company/tickets` `{subject,description,priority?,status?,requesterName?,requesterEmail?,assignedAgentId?}` -> 201 `{data:{ticket}}`
- `GET /api/company/tickets/:ticketId` -> `{data:{ticket}}`
- `PATCH /api/company/tickets/:ticketId` `{status?,priority?,assignedAgentId?}` -> `{data:{ticket}}`
- `GET /api/company/tickets/assignable-agents` -> `{data:{agents:[{userId,firstName,lastName,email,onlineStatus}]}}`
