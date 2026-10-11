# Plan: Company portal ticket management UI (PROGRESS item 4, client only)

## Findings
- Server contract is final (`docs/plans/tickets-api.md`); mock backend (`cd server && npm run mock`, `server/scripts/mock-server.js`) already has an in-memory `ticketModel` seeded with 8 tickets for company 1 (Acme, ids 1-8: statuses Open/In Progress/Resolved/Closed, priorities Low..Urgent, tickets 1 and 2 assigned to user 4 "Sam Agent", others unassigned) and 2 for company 2 (ids 9, 10), plus assignable agents (user 4 for Acme, user 5 for Globex). No server or mock changes needed. Mock logins: `owner@acme-demo.com` / `CompanyAdmin@2026!` (Ada Owner), platform admin `admin@supportpilot.com` / `Admin@SupportPilot2026!`. Mock state is in memory and shared across e2e tests in one run, so specs must tolerate mutation (create new tickets, edit those, avoid asserting exact global counts after mutations).
- Client has no unit test runner (only `@playwright/test`, scripts: dev/build/lint/test:e2e). So NO unit tests; keep helpers pure and in their own module but cover through Playwright. Do not add vitest.
- `routes.ts` already has `COMPANY_TICKETS: "/company/tickets"`; `router/index.tsx` currently renders `CompanyComingSoonPage` there. `CompanyLayout` nav shows a "Soon" badge when `!overview.features.tickets`; server now returns `features.tickets: true`, so the badge disappears with no layout change. Nav active check is `location.pathname === item.to`, so the detail route would not highlight Tickets: change to `item.to === ROUTES.DASHBOARD_COMPANY ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/")` (only layout change).
- `CompanyRouteGuard` already verifies the server session via `/api/company/me` and provides outlet context `{data, refresh, refreshing, refreshError}` read with `useCompanyPortal()`. Ticket pages live inside it, so access is already server-gated (401 -> login, 403 -> Access Restricted). Ticket calls can still return 401/403 mid-session (expired cookie, company suspended): handle in the pages (see Access).
- `apiRequest(endpoint, {data, method, cache})` in `services/apiClient.ts`: `data` implies POST but `method: "PATCH"` in options overrides it (customConfig is spread after). Throws `ApiError(message, status, payload)`; `payload` is the raw JSON body `{success:false,message,code?,errors?:[{field,message}]}`. Network failure -> `ApiError` status 0. No query-string helper: build with `URLSearchParams`.
- Styling conventions (from `CompanyLayout`, `OverviewStatCard`, admin companies pages): Tailwind v4 arbitrary hex tokens `#6D5EF5` primary, `#1c1b23` text, `#787586` muted, `#e2e4e9` borders, `#f6f2ff` hover, `#f8f9fc` page bg; cards `bg-white border border-[#e2e4e9] rounded-2xl shadow-2xs`; Material Symbols icons via `<span className="material-symbols-outlined">`; modal pattern in `components/landing/DemoModal.tsx` (Escape closes) and `admin/companies/CompanyDetailModal.tsx`; filters in `admin/companies/CompaniesFilters.tsx`; table in `CompaniesTable.tsx`. Executor: read those three for exact class strings and copy the look. Spinner class `.spinner` exists in `styles.css`. Toast pattern in `PlatformCompaniesPage` (fixed bottom-right dark pill).
- Ticket "customer" is not in scope (item 8); UI shows `requesterName`/`requesterEmail` only. No reply thread (item 9).

## Routes
- `client/src/router/routes.ts`: keep `COMPANY_TICKETS`; add `COMPANY_TICKET_DETAIL: "/company/tickets/:ticketId"` and a helper `export const companyTicketPath = (id: number | string) => \`/company/tickets/${id}\`` (kept outside the `ROUTES` const so `AppRoute` type stays literal; do not add the param route to places that treat ROUTES values as navigable literals).
- `client/src/router/index.tsx`: replace the Tickets `CompanyComingSoonPage` element with `<CompanyTicketsPage />`; add `<Route path={ROUTES.COMPANY_TICKET_DETAIL} element={<CompanyTicketDetailPage />} />` inside the same `CompanyRouteGuard > CompanyLayout` group. Agents/FAQs/AI Settings placeholders unchanged. Static `/company/tickets` and param route do not collide with `/company/register` or `/company/dashboard`.

## Types and service
`client/src/types/tickets.ts`:
- `TICKET_STATUSES = ["Open","In Progress","Resolved","Closed"] as const`, `TICKET_PRIORITIES = ["Low","Medium","High","Urgent"] as const`, types `TicketStatus`, `TicketPriority`.
- `Ticket { ticketId; companyId; customerId: number|null; requesterName: string|null; requesterEmail: string|null; subject; description; status: TicketStatus; priority: TicketPriority; assignedAgentId: number|null; assigneeName: string|null; createdAt; updatedAt; resolvedAt: string|null }`.
- `TicketPagination { page; limit; total; totalPages }`, `TicketListFilters { status?; priority?; assignee?: "unassigned" | string; search?; page?; limit? }`, `TicketListResult { tickets: Ticket[]; pagination }`, `AssignableAgent { userId; firstName: string|null; lastName: string|null; email; onlineStatus: string|null }`, `CreateTicketInput { subject; description; priority?; status?; requesterName?; requesterEmail?; assignedAgentId?: number|null }`, `UpdateTicketInput { status?; priority?; assignedAgentId?: number|null }`, `FieldError { field; message }`.

`client/src/services/tickets.ts` (all `cache: "no-store"` on GET; unwrap `response.data`):
- `listTickets(filters): Promise<TicketListResult>` -> `GET /api/company/tickets?` built with URLSearchParams, skipping empty/undefined values.
- `getTicket(ticketId): Promise<Ticket>`; `createTicket(input): Promise<Ticket>` (POST); `updateTicket(ticketId, changes): Promise<Ticket>` (`method: "PATCH"`, `data: changes`); `listAssignableAgents(): Promise<AssignableAgent[]>` (`/api/company/tickets/assignable-agents`).
- `getFieldErrors(error: unknown): FieldError[]` pure helper: if `error instanceof ApiError && error.status === 422` return `payload.errors` array filtered to `{field:string,message:string}`, else `[]`. `getErrorCode(error)` returning `payload.code ?? null` (guard already has a private copy; do not refactor it).
- Pure helpers in `client/src/components/company/tickets/ticketFormat.ts`: `agentLabel(agent)` (`First Last` or email), `formatTicketDate(iso)` (`Intl.DateTimeFormat`, invalid -> "-"), `statusBadgeClasses(status)`, `priorityBadgeClasses(priority)`, `ticketFiltersFromSearchParams(sp)` / `ticketFiltersToSearchParams(filters)` (see URL state), `PAGE_SIZE = 10`.

## Components (`client/src/components/company/tickets/`)
All presentational pieces take props; pages own data fetching.
- `TicketFilters.tsx`: controlled bar with search input (placeholder "Search subject or requester", `aria-label="Search tickets"`, maxLength 100), selects Status ("All statuses" + 4), Priority ("All priorities" + 4), Assignee ("All assignees", "Unassigned", then each agent by `agentLabel`), and a "Clear" button shown only when any filter active. Agent options come from `listAssignableAgents` loaded once by the page (if that call fails, hide agent options except "Unassigned" and show nothing else; do not block the list). Search is debounced inside the page via a small `useDebouncedValue(value, 300)` hook in `client/src/components/company/tickets/useDebouncedValue.ts`; selects apply immediately. Any filter change resets `page` to 1.
- `TicketsTable.tsx`: columns Ticket (subject as `<Link>` to `companyTicketPath(id)`, `#id` + requester under it), Status badge, Priority badge, Assignee (`assigneeName` or "Unassigned"), Created. Wrapper `overflow-x-auto`; at <640px hide Created/Requester columns (`hidden sm:table-cell`). `TicketStatusBadge.tsx` / `TicketPriorityBadge.tsx` (small, use format helpers).
- `TicketsPagination.tsx`: "Showing X-Y of N", Previous/Next buttons disabled at bounds, "Page p of totalPages"; hidden when `total === 0`.
- `CreateTicketModal.tsx`: props `{ agents, onClose, onCreated(ticket) }`. Fields: Subject (required, 3-200), Description (textarea, required, max 5000, live char counter), Priority (default Medium), Requester name (optional, max 150), Requester email (optional), Assign to (optional agent select, default Unassigned). Status is NOT in the form (server defaults Open). Client-side checks mirror server (subject length, description non-empty, email regex) shown per-field on submit, but the server 422 remains authoritative: map `getFieldErrors` by `field` (subject, description, priority, requesterName, requesterEmail, assignedAgentId) onto the matching inputs with `aria-invalid` + `aria-describedby` + `role="alert"` text; unmapped/other errors (`INVALID_ASSIGNEE` is mapped via its field; others) go to a form-level alert. Submit button shows spinner + "Creating..." and disables form while saving; Escape and backdrop click close unless saving; focus first field on open; `role="dialog" aria-modal="true" aria-labelledby`. Send only trimmed values; omit empty optional strings; send `assignedAgentId` only when chosen; never send `companyId`/`customerId`.
- `TicketPropertyEditor.tsx` (used by detail page): three labelled selects (Status, Priority, Assignee incl. "Unassigned" -> `null`). Each change PATCHes just that field immediately (`updateTicket(id, {field: value})`), with that control disabled and a small inline spinner while saving; on success replace ticket state with returned ticket; on failure revert the control to the previous value and show an inline alert (422 messages from `getFieldErrors`, else `error.message`). Serialize saves: disable all three controls while any save is in flight (prevents race on `updatedAt`). A short "Saved" confirmation (`role="status"`, auto-clears after 2s).

## Pages (`client/src/pages/company/`)
### `CompanyTicketsPage.tsx` (list, `/company/tickets`)
- Header: icon + "Tickets" h1, subtitle, "New ticket" primary button (opens modal).
- URL is the source of truth for filters: `useSearchParams` with keys `status, priority, assignee, search, page` (and optional `limit` 1-100, default `PAGE_SIZE`; exists so e2e can force pagination with `?limit=3`). Parse with `ticketFiltersFromSearchParams`, discard invalid values (unknown status etc.) instead of sending them to the API (avoids a 422 from hand-edited URLs). Debounced search updates the URL with `replace: true`; other filters push.
- Data: `useEffect` on serialized filters; use a `cancelled` flag/`AbortController`-free request-id ref so stale responses are ignored. States:
  - Loading (first load): skeleton rows or spinner with `role="status"` "Loading tickets..."; on subsequent filter changes keep the previous rows dimmed (`aria-busy`) instead of flashing.
  - Error: card with `role="alert"`, message, "Try again" button (refetch). 401 -> clear stored auth (`removeAuthToken`, `removeStoredUser`) and `navigate(ROUTES.LOGIN_COMPANY, {replace:true})`. 403 (e.g. `COMPANY_INACTIVE`) -> call `portal.refresh()` (from `useCompanyPortal`), whose guard re-runs and shows the Access Restricted screen; also show the error text meanwhile.
  - Empty, no filters: "No tickets yet" + "Create your first ticket" button. Empty with filters: "No tickets match your filters" + "Clear filters".
  - Out-of-range page (user lands on page 5 with 2 pages, or deletes leave fewer): if `page > totalPages && totalPages > 0` replace URL with last page.
- After create success: close modal, toast "Ticket #id created", navigate to the new ticket detail (`companyTicketPath`) and call `portal.refresh()` so sidebar/overview counts update.

### `CompanyTicketDetailPage.tsx` (`/company/tickets/:ticketId`)
- Back link "All tickets" to `/company/tickets` (preserve prior list query by using `navigate(-1)` only if `location.key !== "default"`, else the plain link; keep simple: plain `<Link>` is acceptable).
- Validate `ticketId` param with `/^[1-9]\d*$/`; invalid -> same "Ticket not found" state without calling the API.
- Load `getTicket` and `listAssignableAgents` in parallel (agents failure non-fatal: assignee select then lists only current assignee + Unassigned, with a hint "Could not load agents").
- States: loading (`role="status"`); 404 `TICKET_NOT_FOUND` (also covers other companies' tickets) -> "Ticket not found" card with link back; 400 `INVALID_TICKET_ID` same; other errors -> alert + retry; 401/403 as in list page.
- Layout (two columns >= lg, stacked below): left card = subject (h1), `#id`, created/updated/resolved timestamps, Description (whitespace-pre-wrap, rendered as text only, never as HTML), Requester (name, email as `mailto:`). Right card = `TicketPropertyEditor` plus read-only "Resolved at" when set. After a successful property update call `portal.refresh()` (fire-and-forget; ignore its failure) so overview counts stay right.
- Descriptions use React text nodes only; no `dangerouslySetInnerHTML` anywhere.

## Access rules
- Only Company Admins reach these routes: enforced server-side by `CompanyRouteGuard` (`/api/company/me`) and each ticket endpoint (`requireRole` + DB company re-check). Client adds no role logic of its own and never sends a company id; tenancy is entirely server-derived. Platform admins and unauthenticated users keep existing behaviour (Access Restricted / redirect to `/login/company`), which also applies to deep links like `/company/tickets/3`.
- Mid-session 401/403 handling as described per page. Cross-company ticket id -> server 404 -> "Ticket not found" (UI never distinguishes).

## Accessibility / UX details
- Labels tied to inputs, visible focus rings (`focus:ring-2 focus:ring-[#6D5EF5]/30`), status/priority badges have text (not color only), table has `<caption className="sr-only">`, modal traps Escape and restores focus to the "New ticket" button on close.
- Mobile (<640px): filters stack in one column; table scrolls horizontally inside its card; page has no horizontal scroll.

## Tests (`client/e2e/companyTickets.spec.ts`, mock backend)
Header comment: `E2E_SERVER_COMMAND="npm run mock" npx playwright test companyTickets`. Helper `loginAsCompanyAdmin(page)` copying the sign-in steps from `companyPortal.spec.ts` (`#company-email`, `#company-password`, `button[type="submit"]`, wait for `/company/dashboard`). `beforeEach` clears cookies. Specs:
1. Unauthenticated `/company/tickets` -> `/login/company`.
2. Platform admin visiting `/company/tickets` sees "Access Restricted".
3. Nav: signed in, click Tickets link -> URL `/company/tickets`, "Tickets" link has `aria-current="page"` and no "Soon" badge, "Coming soon" text absent, seeded rows visible ("Cannot reset my password"), Globex tickets ("Order arrived damaged") NOT visible.
4. Filters: select Status "Open" -> every visible status badge is Open and URL has `status=Open`; select Priority "Urgent"; Assignee "Unassigned"; search "password" (type, wait for debounce via `expect(...).toHaveCount`/`toBeVisible`, no fixed sleeps) shows only the matching row; nonsense search shows "No tickets match your filters", Clear restores rows.
5. Pagination: open `/company/tickets?limit=3`, "Page 1 of N" visible, Next -> page 2 and URL `page=2`, Previous disabled on page 1.
6. Create: open "New ticket"; submit empty -> field errors for subject and description, dialog stays open; fill subject "E2E login broken <timestamp>", description, priority High, assign to "Sam Agent" -> dialog closes, lands on detail page showing the subject, Priority High, assignee "Sam Agent". Server 422 path: enter invalid requester email that passes client check only if client check is looser; otherwise rely on a `page.route` fulfilling a 422 `{success:false,message:"Validation failed",code:"VALIDATION_ERROR",errors:[{field:"subject",message:"Subject must be between 3 and 200 characters"}]}` for `POST **/api/company/tickets` and assert the message renders next to Subject.
7. Detail edit: open ticket via list link; change Status to "Resolved" -> "Saved" status shown, reload page, value persisted; set Assignee to "Unassigned" persists; a `page.route` forced 500 on PATCH reverts the select and shows an alert.
8. Not found: `/company/tickets/9999` and `/company/tickets/9` (Globex's ticket) show "Ticket not found"; `/company/tickets/abc` also shows it.
9. Error state: `page.route` abort/500 on `GET **/api/company/tickets` shows alert with "Try again"; unrouting then clicking Try again shows rows.
Use role/label locators (`getByRole`, `getByLabel`) so the component markup requirement above (labels, roles) is what the tests rely on. Specs must not depend on exact total counts after other specs mutate the shared mock.

## Files to change / add
Change:
- `client/src/router/routes.ts` (detail route + `companyTicketPath`)
- `client/src/router/index.tsx` (real pages replace coming-soon for Tickets)
- `client/src/components/company/CompanyLayout.tsx` (nav active match for nested paths only)
- `client/e2e/companyPortal.spec.ts` (the last step of "company admin signs in" currently asserts `Coming soon` on `/company/tickets`; replace with assertion that the Tickets page heading is visible)
- `docs/PROGRESS.md` (tick item 4, add Run 4 log line)
Add:
- `client/src/types/tickets.ts`
- `client/src/services/tickets.ts`
- `client/src/components/company/tickets/{TicketFilters,TicketsTable,TicketsPagination,CreateTicketModal,TicketPropertyEditor,TicketStatusBadge,TicketPriorityBadge}.tsx`, `ticketFormat.ts`, `useDebouncedValue.ts`
- `client/src/pages/company/CompanyTicketsPage.tsx`, `CompanyTicketDetailPage.tsx`
- `client/e2e/companyTickets.spec.ts`

## Verification
- `cd client && npm run lint && npm run build` (must pass with TypeScript strict; eslint react-hooks v7 rules: no setState synchronously in effects, derive state where possible, keep `useEffect` deps complete).
- Playwright run only if Chromium is available (earlier runs had none): `cd server && npm run mock` plus `cd client && E2E_SERVER_COMMAND="npm run mock" npx playwright test companyTickets companyPortal`. If it cannot run, say so in PROGRESS.md as in Run 2. Never run `npm start`/`dev` in `server/`, never connect to a database, never create `server/.env`.
- Server tests unaffected (`cd server && npm test` optional sanity).
- No AI/Claude attribution in code, comments, docs or commit text beyond what the harness mandates for commits.

## Out of scope
Ticket replies/conversation (item 9), customer-facing views (item 8), agent management page (item 5), delete/bulk actions (no API), editing subject/description (API only allows status/priority/assignee), sorting controls (server fixes created_at DESC).
