# Plan: FAQs - model + CRUD API and UI (PROGRESS item 6)

One run: server API + tests + mock server, then the `/company/faqs` page. No DB access, no `npm start`/`dev` in `server/`, no `server/.env`. Same layering and conventions as `docs/plans/tickets-api.md` and `docs/plans/support-agents.md`.

## Findings
- `companyService.getCompanyProfile` hardcodes `faqArticles: 0` and `features.faqs: false`; `test/api/companyMe.test.js` (line ~146) asserts `faqs: false` and must change. `getCompanyOverviewCounts(companyId)` in `server/src/models/companyPortalModel.js` returns `{supportAgents, openTickets, resolvedToday}`; extend it with `faqArticles` (published count). The dashboard checklist ("Publish FAQ articles", `overview.faqArticles > 0`) and the "FAQ articles" stat card already read it. Client `FeatureFlags`/`overview.faqArticles` types already exist in `client/src/types/company.ts`. `CompanyLayout` nav already has the FAQs entry keyed on `feature: "faqs"` (Soon badge disappears automatically).
- Router currently shows `CompanyComingSoonPage` for `ROUTES.COMPANY_FAQS` (`client/src/router/index.tsx`).
- Company comes ONLY from `createCompanyContextResolver(portal).requireActiveCompanyAdmin(auth)` (DB context). Router also applies `authenticate` + `requireRole("Company Admin")`.
- Existing `tickets` table has NO foreign keys on purpose (`initMySQLSchema` swallows errors; unknown `companies` column type could silently skip creation). Follow that: `company_id INT NOT NULL` plus indexes, tenancy enforced in every WHERE. Do not add a FK, and say so in a code comment. (Task asked for "company_id FK"; the precedent decision wins for the stated safety reason.)
- `express.json({limit:"10kb"})` bounds bodies; answer max must fit (use 4000 chars).
- No agent/customer reads of FAQs yet; `is_published` exists so item 7 (AI) and item 8 (customers) can later read only published rows.

## Decisions
1. Hard delete (no soft delete); UI confirm dialog. Unpublish is the reversible option.
2. Publish state is part of PATCH (`isPublished`), no separate publish endpoint; the UI row has a quick Publish/Unpublish button that sends `PATCH {isPublished}`.
3. Manual ordering: `sort_order INT NOT NULL DEFAULT 0` stored and returned, editable as an integer in the edit modal ("Display order", 0-9999). No drag and drop. List order: `sort_order ASC, faq_id ASC`. New FAQs default to `MAX(sort_order)+10` computed in the model INSERT via subselect on same company (`COALESCE((SELECT MAX(sort_order) FROM faqs WHERE company_id=?),0)+10`; use `INSERT ... SELECT ?,?,?,?,?, COALESCE(MAX(sort_order),0)+10 FROM faqs WHERE company_id=?`) when the client omits it.
4. Category is free text (optional, max 60), not a table. Filter dropdown options come from `categories` returned by the list endpoint (distinct non-empty categories of the company).
5. No pagination: cap per company `LIMIT 500` on list; create returns 409 `FAQ_LIMIT_REACHED` at 500 FAQs (cheap COUNT check in service). Client filters nothing locally except it sends filters to server (server filter is the source of truth, search debounced 300 ms).
6. Duplicate questions are allowed (no uniqueness); trimmed only.
7. PATCH is partial: only provided keys change; empty body of known keys -> 422 `body` "Provide at least one field to update". Idempotent.
8. Another company's FAQ, nonexistent, or malformed id behave the same except malformed -> 400. Never 403 for cross-tenant (404 `FAQ_NOT_FOUND`).

## Schema (`server/src/config/database.js`)
Add `async function ensureFaqsTable(pool)` modelled on `ensureTicketsTable` (own try/catch, warn only when `NODE_ENV !== "test"`, message "FAQs schema notice:"); call it in `initMySQLSchema` right after `await ensureTicketsTable(pool);`. Idempotent, no seeding:
```
CREATE TABLE IF NOT EXISTS faqs (
  faq_id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  question VARCHAR(300) NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(60) NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_faqs_company_order (company_id, sort_order, faq_id),
  INDEX idx_faqs_company_published (company_id, is_published),
  INDEX idx_faqs_company_category (company_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```
`created_by` is the admin `userId` from context (informational only, never exposed in output). Default `is_published=0` at DB level, but the API defaults new FAQs to `isPublished: false` too (draft first).

## Constants
`server/src/constants/faqConstants.js`: `FAQ_QUESTION_MAX=300`, `FAQ_ANSWER_MAX=4000`, `FAQ_CATEGORY_MAX=60`, `FAQ_SORT_MAX=9999`, `FAQ_SEARCH_MAX=100`, `FAQ_LIST_LIMIT=500`, `FAQ_MAX_PER_COMPANY=500`, `FAQ_PUBLISHED_FILTERS=["published","draft"]`.

## API (`server/src/routes/faqRoutes.js`, mounted in `app.js` at `/api/company/faqs` BEFORE `/api/company`, next to agents)
`router.use(authenticate); router.use(requireRole("Company Admin"));` handlers via `asyncHandler`; `Cache-Control: no-store`; envelope `{success:true,data}`.

`Faq = { faqId, question, answer, category: string|null, isPublished: boolean, sortOrder: number, createdAt, updatedAt }` (no `companyId`, no `createdBy`).

- `GET /api/company/faqs?search=&category=&status=` -> 200 `{ faqs: Faq[], categories: string[], summary: { total, published, draft } }`. `search` matches `question LIKE ? OR answer LIKE ? OR category LIKE ?` with `%` and `_` and `\` escaped (`ESCAPE '\\'`, same helper as ticketModel search); `category` exact match; `status` is `published` or `draft`; unknown values -> 422. `summary` counts the whole company (ignores filters) so chips stay stable; `categories` likewise unfiltered.
- `POST /api/company/faqs` body `{question, answer, category?, isPublished?, sortOrder?}` -> 201 `{ faq }`.
- `PATCH /api/company/faqs/:faqId` body any of `{question, answer, category, isPublished, sortOrder}` -> 200 `{ faq }`. `category: null` or `""` clears it.
- `DELETE /api/company/faqs/:faqId` -> 200 `{ deleted: true, faqId }` (keeps the envelope style; not 204).
- `GET /:faqId` not needed (list is complete; PATCH/POST return fresh rows).

### Validation (`server/src/validators/faqValidator.js`, returns `{value, errors}` like agentValidator/ticketValidator)
- Body must be a plain object else `{field:"body"}`. Unknown keys ignored; `companyId`, `createdBy`, `faqId` in body never read.
- `question`: string, trimmed, 5-300 chars (min 5 so it is a real question; message "Question must be at least 5 characters"), no control chars (`/[\u0000-\u001f\u007f]/`).
- `answer`: string, trimmed, 1-4000 chars, newlines/tabs allowed (only reject control chars other than `\n`, `\r`, `\t`).
- `category`: optional; string trimmed, max 60, no control chars; empty string -> null.
- `isPublished`: must be boolean (reject strings "true"/1) else 422.
- `sortOrder`: integer 0-9999 (accept JS number only, `Number.isInteger`).
- `validateListQuery(query)`: `search` trimmed max 100 (longer -> 422), `category` trimmed max 60, `status` in allowed or empty; repeated query keys (arrays) -> 422 for that field.
- `parseFaqId(raw)`: positive-integer string parser; reuse `parseTicketId`/shared helper from ticketValidator (as agentValidator does) -> 400 `INVALID_FAQ_ID`.
- Rendering: answer is plain text; the client renders it as text (`whitespace-pre-wrap`), never `dangerouslySetInnerHTML`. No HTML sanitising server side; stored verbatim after trim.

### Errors
| Status | code | When |
|---|---|---|
| 401 | AUTHENTICATION_REQUIRED / INVALID_SESSION | middleware / resolver |
| 403 | ROLE_FORBIDDEN | token role or DB role not Company Admin (Support Agent, Platform Admin, Customer) |
| 403 | COMPANY_ACCESS_DENIED / ACCOUNT_INACTIVE / COMPANY_INACTIVE | context resolver |
| 400 | INVALID_FAQ_ID | non-positive-integer param |
| 404 | FAQ_NOT_FOUND | missing or belongs to another company (PATCH and DELETE) |
| 409 | FAQ_LIMIT_REACHED | company already has 500 FAQs |
| 422 | VALIDATION_ERROR | with `errors:[{field,message}]` |

## Server files
Add:
- `server/src/models/faqModel.js`: all functions take `companyId` first, `?`-parameterized, `company_id = ?` in every WHERE, camelCase aliases in SQL, `is_published` mapped to boolean in JS (`Boolean(row.isPublished)`), optional trailing `options.pool` like ticketModel. `listFaqs(companyId, {search, category, status})`, `listFaqMeta(companyId)` -> `{categories, total, published}` (two small queries), `countFaqs(companyId)`, `findFaq(companyId, faqId)`, `createFaq(companyId, userId, data)` (INSERT...SELECT as in Decision 3, throws if `insertId` missing, returns `findFaq`), `updateFaq(companyId, faqId, changes)` (SET built from allowlist keys question/answer/category/isPublished/sortOrder with hard-coded column names; returns row or null; null when `affectedRows` 0 AND row absent: do `findFaq` after update since MySQL reports 0 changed rows for no-op), `deleteFaq(companyId, faqId)` -> boolean (`affectedRows > 0`).
- `server/src/services/faqService.js`: `createFaqService(dependencies = {})` with injected `faqModel`, `companyPortalModel`; exposes `listFaqs`, `createFaq`, `updateFaq`, `deleteFaq`; each starts with `requireActiveCompanyAdmin(auth)` then validates (validate before touching the model but after auth so 401/403 win over 422).
- `server/src/controllers/faqController.js`, `server/src/routes/faqRoutes.js`, `server/src/validators/faqValidator.js`, `server/src/constants/faqConstants.js`.
Change:
- `server/src/config/database.js` (ensureFaqsTable), `server/src/app.js` (`dependencies.faqService || createFaqService(dependencies)`, mount router before `/api/company`).
- `server/src/models/companyPortalModel.js`: `getCompanyOverviewCounts` adds `faqArticles` = `SELECT COUNT(*) FROM faqs WHERE company_id=? AND is_published=1`.
- `server/src/services/companyService.js`: use `faqArticles` from counts (default 0 on count failure like the other counts), `features.faqs: true`.
- `server/scripts/mock-server.js`: see below.
- `docs/PROGRESS.md`: tick item 6, add Run 6 log line, note that items 7/8 must read only `is_published=1` rows.

## Mock server additions (`server/scripts/mock-server.js`)
- In-memory `faqs` array, `nextFaqId` counter. Seed (stable ids, company-scoped):
  - Acme (company 1): id 1 "How do I reset my password?" (Account, published, order 10); id 2 "What are your support hours?" (General, published, 20); id 3 "How do I request a refund?" (Billing, draft, 30); id 4 "Which plans include API access?" (Billing, published, 40); id 5 "Can I export my data?" (no category, draft, 50).
  - Globex (company 2): id 6 "Globex warranty policy" (Warranty, published, 10), id 7 "Globex secret draft question" (draft, 20) for isolation tests.
- `faqModel` mock implementing the same method set over that array (same filters, escape-free substring search, `ER`-free, company-scoped, copy on return, same sort, MAX+10 default order).
- Extend mock `companyPortalModel.getCompanyOverviewCounts` to include `faqArticles` (count of published for the company; Acme = 3, so the dashboard checklist is ticked).
- Pass `faqModel` into `createApp({... faqModel})` (the existing pattern with `agentModel`).

## Server tests (node --test, mock-injected; no DB)
`server/test/api/faqs.test.js` (helpers as in `agents.test.js`: `startTestServer`, `companyToken`, in-memory fake `faqModel` and `companyPortalModel` with two companies; fake records the `companyId` args) and `server/test/validators/faqValidator.test.js`.
1. Auth: 401 with no cookie on each of the 4 routes; 403 for Support Agent token, Platform Admin token, Company Admin token whose DB role differs (`ROLE_FORBIDDEN`); 403 inactive company / inactive user.
2. List: only own-company FAQs; summary/categories correct and unaffected by filters; `status=published|draft`, `category`, `search` (matches question, answer, category; `%`/`_` treated literally) filters; `status=bogus` -> 422; `Cache-Control: no-store`; model called with company from DB even if the token claims `companyId: "999"` and `?companyId=2` is passed.
3. Create: 201, defaults (`isPublished:false`, order MAX+10), trims fields, category `""` -> null; body `companyId`/`faqId`/`createdBy` ignored (model receives DB company, not body's); 422 cases (missing/short/long question, missing/long answer, long category, `isPublished:"true"`, `sortOrder:1.5` / `-1` / `10000`, non-object body, control chars); 409 `FAQ_LIMIT_REACHED` when count = 500; response has no `companyId`/`createdBy`.
4. Update: partial update changes only given keys; publish toggle; `category:null` clears; empty body -> 422; other company's FAQ -> 404 `FAQ_NOT_FOUND` and the other company's row unchanged; `INVALID_FAQ_ID` (400) for `abc`, `0`, `1.5`, `-1`; body `companyId` cannot move an FAQ.
5. Delete: 200 `{deleted:true}`; second delete 404; other company's FAQ 404 and still present; invalid id 400.
6. `companyMe.test.js`: update expectations to `features.faqs === true`, and add a `faqArticles` value to the fake `getCompanyOverviewCounts` and assert it appears in `overview.faqArticles`.
7. Optional `test/models/faqModel.test.js` (fake `pool.execute`, as ticketModel test): every statement has `company_id = ?` with the company param, `ESCAPE`d LIKE parameters, no user input interpolated in SQL text, UPDATE column names only from allowlist.
8. Optional database test only if one exists for `ensureTicketsTable` (fake pool `query` records `CREATE TABLE IF NOT EXISTS faqs`; ensure a thrown error does not reject `initMySQLSchema`).

## Client (`/company/faqs`)
Add:
- `client/src/types/faqs.ts` (`Faq`, `FaqListResult`, `FaqInput`, `FaqFilters`, `FaqStatusFilter`).
- `client/src/services/faqs.ts` (`listFaqs(filters)`, `createFaq`, `updateFaq`, `deleteFaq`) via `apiRequest`, `cache: "no-store"`, `ApiError` field errors like `services/agents.ts`/`tickets.ts`.
- `client/src/components/company/faqs/{FaqList,FaqFormModal,FaqDeleteDialog,FaqStatusBadge}.tsx` (reuse modal/dialog and auth-error patterns from `components/company/agents/*`; if the shared modal chrome is duplicated, copy rather than refactor).
- `client/src/pages/company/CompanyFaqsPage.tsx`.
Change: `client/src/router/index.tsx` (real page instead of `CompanyComingSoonPage` for FAQs; drop the unused import only if no other route uses it - AI Settings still does), nothing in `CompanyLayout` (keyed on `features.faqs`), `e2e/companyPortal.spec.ts` only if it asserts FAQs "Soon".

### Page behaviour
- Header "FAQs" + summary chips (Published n, Draft n) + "Add FAQ" button. Filter bar: search input (label "Search FAQs", debounced 300 ms), Status select (All/Published/Draft), Category select (All + categories from the server), "Clear filters" when any active. Filters live in component state (URL sync optional, not required).
- List: card-style rows (question as heading, answer preview clamped to 3 lines with `whitespace-pre-wrap`, category chip, status badge with text "Published"/"Draft", display order). Row actions: Edit, Publish/Unpublish, Delete, with names in `aria-label` including the question (e.g. `Delete "How do I reset my password?"`). Rows ordered as returned by the server.
- Create/Edit modal: Question (input, counter), Answer (textarea, counter, 4000), Category (input with `<datalist>` of existing categories), Display order (number, edit only; blank on create), "Publish immediately" checkbox on create / "Published" checkbox on edit. Client checks mirror server limits; server 422 `errors[]` shown under matching fields; non-field error as `role="alert"` at the top; submit disabled while saving; on success close, refresh list (keep filters), live-region message "FAQ created"/"FAQ updated".
- Delete dialog: "Delete this FAQ? 'question…' will be removed permanently. This cannot be undone." Cancel focused by default; success message "FAQ deleted"; failure shows an alert in the dialog.
- Publish/Unpublish: inline pending state on the button, row-level `role="alert"` error on failure, status unchanged.
- States: loading (skeleton rows, `aria-busy`), empty (no FAQs at all: "No FAQs yet" + hint about the AI assistant + Add FAQ button), no-match (filters active: "No FAQs match your filters" + Clear filters), error (`role="alert"` + Try again), 401/403 via the same auth-error handling used on the agents page (redirect to login or Access Restricted).
- A11y: labelled controls, dialogs `role="dialog" aria-modal aria-labelledby`, focus first field on open, Escape closes, focus returns to the trigger, `role="status"` live region for success text, visible focus rings, no page horizontal scroll at 375 px.
- After any mutation, nothing else needs invalidating (dashboard refetches `/api/company/me` on mount).

## Playwright outline (`client/e2e/companyFaqs.spec.ts`, mock backend)
Header: `E2E_SERVER_COMMAND="npm run mock" npx playwright test companyFaqs`. Reuse `loginAsCompanyAdmin` pattern from `companyAgents.spec.ts`; clear cookies in `beforeEach`; role/label locators; no exact counts after mutations.
1. Unauthenticated `/company/faqs` -> `/login/company`; platform admin -> "Access Restricted".
2. Nav: FAQs link has no "Soon", `aria-current="page"`; Acme FAQs visible ("How do I reset my password?"); Globex FAQs ("Globex warranty policy", "Globex secret draft question") NOT visible; Draft and Published badges present.
3. Filters: Status Draft shows "How do I request a refund?" and hides "What are your support hours?"; Category Billing shows two; search "export" shows one; nonsense -> no-match state; Clear restores.
4. Create: empty submit shows field errors (question, answer); too-short question error; valid FAQ -> dialog closes, new row appears as Draft, success status shown; Escape closes the dialog with focus back on "Add FAQ".
5. Edit: change the answer of an existing FAQ, row shows updated text; unpublish a Published FAQ -> badge Draft; Publish it again.
6. Delete: Cancel keeps it; confirm removes it and status text appears.
7. Dashboard: `/company` "FAQ articles" stat is greater than 0 after login (seeded published FAQs) and the "Publish FAQ articles" checklist item is done.
8. Error and empty states: `page.route` 500 on `GET **/api/company/faqs*` -> alert + Try again, unroute + click -> rows; fulfil `{faqs:[],categories:[],summary:{total:0,published:0,draft:0}}` -> empty state with Add FAQ; `page.route` 500 on a PATCH shows row alert, status unchanged.

## Verification
- `cd server && npm test` (all green, incl. new tests); `cd client && npm run lint && npm run build`.
- Playwright only if Chromium is available (as in Runs 4-5: throwaway config pointing at the local chromium, mock backend via `npm run mock`); otherwise state it was not executed.
- Never connect to a database, never run `npm start`/`dev` in `server/`, never create `server/.env`.

## Out of scope / follow-ups
Drag-and-drop reordering, bulk actions/import/export, rich text/markdown, versioning/soft delete, public or customer-facing FAQ endpoints (item 8), AI retrieval over FAQs (item 7), categories as a managed entity, pagination beyond the 500 cap, FK constraints (revisit if the `companies` PK type is confirmed).
