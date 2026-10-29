# Plan: Company AI settings - model + API and UI (PROGRESS item 7)

One run: server model/API + tests + mock server, then the `/company/ai-settings` page. Settings only: NO LLM calls, NO provider keys, nothing that executes the assistant. No DB access, no `npm start`/`dev` in `server/`, no `server/.env`. Mirrors `docs/plans/faqs.md` (layering, factories with injected deps, no-FK table, `ensure*Table`, mock-injected node tests, Playwright against `npm run mock`).

## Findings (from the FAQ implementation)
- Layering: `routes/faqRoutes.js` (`authenticate` + `requireRole("Company Admin")`, `asyncHandler`) -> `controllers/faqController.js` (`send()` sets `Cache-Control: no-store`, `{success:true,data}`) -> `services/faqService.js` (`createFaqService(dependencies)`, first line of every method is `createCompanyContextResolver(portal).requireActiveCompanyAdmin(auth)`, then validate, so 401/403 win over 422) -> `models/faqModel.js` (company id first arg, `?` params, optional trailing `options.pool`). Errors are `AppError(message, status, code, errors)`; validators return `{value, errors}`.
- `app.js` builds `dependencies.faqService || createFaqService(dependencies)` and mounts `/api/company/faqs` BEFORE `/api/company` (line ~74). Do the same for `/api/company/ai-settings`.
- `initMySQLSchema()` calls `ensurePlatformSettingsTable`, `ensureTicketsTable`, `ensureFaqsTable` each with their own try/catch (warn only when `NODE_ENV !== "test"`). Add `ensureCompanyAiSettingsTable` after `ensureFaqsTable`.
- `companyService.getCompanyProfile` hardcodes `features.aiSettings: false` (line 59); `test/api/companyMe.test.js` line ~146 asserts `aiSettings: false` and must flip. `CompanyLayout` nav entry "AI Settings" is already keyed on `feature: "aiSettings"` (the "Soon" badge disappears automatically); `FeatureFlags.aiSettings` already exists in `client/src/types/company.ts`.
- Router: `ROUTES.COMPANY_AI_SETTINGS = "/company/ai-settings"` currently renders `CompanyComingSoonPage` (client/src/router/index.tsx lines 72-81). After replacing it nothing else uses `CompanyComingSoonPage`: remove the import (lint) and leave the file in place (do not delete in this run).
- Dashboard: `CompanyDashboardPage` has the step "Configure AI settings" hard-coded `done: false` and a footer sentence "Ticketing, agents, FAQs and AI settings are rolling out soon" (stale since items 3-6 - replace it).
- `express.json({limit:"10kb"})` bounds the body; all text caps below fit.
- `getCompanyOverviewCounts` (companyPortalModel) already counts published FAQs; the AI-settings "configured" probe must be isolated so a missing table never breaks the other counts.

## Settings model (kept small)
Per company, one document. camelCase in the API, snake_case columns.

| Field | Type / rule | Default |
|---|---|---|
| `enabled` | boolean | `false` (safe: assistant off until the admin turns it on) |
| `assistantName` | string, trimmed, 1-40, no control chars | `"SupportPilot Assistant"` |
| `tone` | enum `friendly` \| `professional` \| `concise` \| `empathetic` | `professional` |
| `greeting` | string, trimmed, 0-300 chars (empty allowed), no control chars | `"Hi! How can I help you today?"` |
| `answerFromFaqsOnly` | boolean: when true the assistant must not answer outside the published FAQs and escalates instead | `true` |
| `confidenceThreshold` | integer 0-100 (percent). Answers below it count as a failed answer. Integer avoids float rounding in DECIMAL/JSON | `70` |
| `escalateAfterFailures` | integer 1-10: hand off to a human after N consecutive failed answers in one conversation | `2` |
| `fallbackMessage` | string, trimmed, 0-300: shown when the assistant cannot answer / hands off | `"I'm connecting you with a member of our support team."` |
| `customInstructions` | string, trimmed, 0-1000, newlines/tabs allowed (same control-char rule as FAQ answers) | `""` |

Not a setting (fixed invariant, documented on the page and in code comments): the knowledge source is ONLY `faqs` rows with `is_published = 1` for the company (items 8/9 consumers must keep that filter). Business hours are out of scope (follow-up). No model name / API key / provider field exists anywhere (neither column nor validator key; unknown keys such as `apiKey` are silently ignored and never stored or echoed).

## Constants
`server/src/constants/aiSettingsConstants.js`: `AI_TONES`, `AI_ASSISTANT_NAME_MAX=40`, `AI_GREETING_MAX=300`, `AI_FALLBACK_MAX=300`, `AI_INSTRUCTIONS_MAX=1000`, `AI_CONFIDENCE_MIN=0`, `AI_CONFIDENCE_MAX=100`, `AI_ESCALATE_MIN=1`, `AI_ESCALATE_MAX=10`, and `DEFAULT_AI_SETTINGS` (the table above, frozen). Client mirrors the limits in a small `client/src/types/aiSettings.ts` consts block (server also returns `defaults`, which the "Reset to defaults" button uses).

## Schema (`server/src/config/database.js`)
`async function ensureCompanyAiSettingsTable(pool)` modelled on `ensureFaqsTable` (own try/catch, warn only when `NODE_ENV !== "test"`, message "AI settings schema notice:"); call right after `await ensureFaqsTable(pool);`. Idempotent, no seeding, no FK (comment: same reason as tickets/faqs):
```
CREATE TABLE IF NOT EXISTS company_ai_settings (
  settings_id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  assistant_name VARCHAR(40) NOT NULL DEFAULT 'SupportPilot Assistant',
  tone VARCHAR(20) NOT NULL DEFAULT 'professional',
  greeting VARCHAR(300) NOT NULL DEFAULT '',
  answer_from_faqs_only TINYINT(1) NOT NULL DEFAULT 1,
  confidence_threshold TINYINT UNSIGNED NOT NULL DEFAULT 70,
  escalate_after_failures TINYINT UNSIGNED NOT NULL DEFAULT 2,
  fallback_message VARCHAR(300) NOT NULL DEFAULT '',
  custom_instructions TEXT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_ai_settings_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```
The API always writes every column (full document), so column defaults only matter for manual inserts. `updated_by` = admin `userId` from the DB context, never exposed.

## API (`server/src/routes/aiSettingsRoutes.js`, mounted in `app.js` at `/api/company/ai-settings` before `/api/company`)
`router.use(authenticate); router.use(requireRole("Company Admin"));` `Cache-Control: no-store`, envelope `{success:true,data}`.

`AiSettings = { enabled, assistantName, tone, greeting, answerFromFaqsOnly, confidenceThreshold, escalateAfterFailures, fallbackMessage, customInstructions }` (no `companyId`, no `updatedBy`).

- `GET /api/company/ai-settings` -> 200 `{ settings: AiSettings, defaults: AiSettings, configured: boolean, updatedAt: string|null }`. When no row: `settings = defaults`, `configured=false`, `updatedAt=null` (no row is written by GET).
- `PUT /api/company/ai-settings` body = full `AiSettings` document -> 200 same shape with `configured=true` (always 200, whether it created or updated; idempotent). Upsert: `INSERT ... (company_id, ...) VALUES (...) ON DUPLICATE KEY UPDATE <all columns>` then re-read, so there is no read-modify-write race and `company_id` never comes from the body. No PATCH, no DELETE (deliberate: a settings document, whole-replace avoids merge ambiguity; "reset" in the UI just PUTs defaults).
- Required keys: all nine. `greeting`, `fallbackMessage`, `customInstructions` may be empty strings; `null` is rejected (422) to keep one representation; `customInstructions` stored as NULL when empty and returned as `""`.

### Validation (`server/src/validators/aiSettingsValidator.js`, returns `{value, errors:[{field,message}]}`)
- Body must be a plain object else `{field:"body"}`; unknown keys (`companyId`, `settingsId`, `updatedBy`, `apiKey`, `model`, ...) ignored and never in `value`.
- Booleans (`enabled`, `answerFromFaqsOnly`): JS booleans only ("true"/1 rejected).
- `assistantName`: string, trimmed, required, 1-40, no control chars.
- `tone`: one of `AI_TONES`, else "Tone must be one of: ...".
- `greeting`/`fallbackMessage`: string (empty ok), trimmed, max 300, no control chars.
- `customInstructions`: string (empty ok), trimmed, max 1000, only `\n \r \t` allowed among control chars.
- `confidenceThreshold`: `Number.isInteger`, 0-100. `escalateAfterFailures`: `Number.isInteger`, 1-10.
- Plain text only; client renders it as text; no sanitising server-side. These strings are NEVER logged.

### Errors
| Status | code | When |
|---|---|---|
| 401 | AUTHENTICATION_REQUIRED / INVALID_SESSION | middleware / resolver |
| 403 | ROLE_FORBIDDEN | Support Agent, Platform Admin, Customer, or DB role differs |
| 403 | COMPANY_ACCESS_DENIED / ACCOUNT_INACTIVE / COMPANY_INACTIVE | context resolver |
| 422 | VALIDATION_ERROR | with `errors:[{field,message}]` |

No 404/400 (no ids in the URL).

## Access rules
Company comes ONLY from `requireActiveCompanyAdmin(auth)` (DB). Token `companyId`, body `companyId`, and `?companyId=` are never read. Every SQL statement has `company_id = ?` with the DB company. Other companies' settings are unreachable by design (single resource per caller).

## Server files
Add:
- `server/src/constants/aiSettingsConstants.js`
- `server/src/validators/aiSettingsValidator.js` (`validateAiSettingsPayload(body)`)
- `server/src/models/aiSettingsModel.js`: `findAiSettings(companyId, options)` -> normalized `AiSettings & {updatedAt}` or `null` (maps TINYINT to boolean, number coercion, NULL instructions to `""`); `upsertAiSettings(companyId, userId, settings, options)` (hard-coded column list, `?` params, `ON DUPLICATE KEY UPDATE`, returns `findAiSettings`); `hasAiSettings(companyId, options)` is not needed (the overview uses a dedicated query in companyPortalModel).
- `server/src/services/aiSettingsService.js`: `createAiSettingsService({aiSettingsModel, companyPortalModel})` exposing `getSettings(auth)` and `updateSettings(auth, body)`; both start with `requireActiveCompanyAdmin`. Also export a plain helper `resolveAiSettings(row)` (row or defaults) so items 8/9 can later read effective settings server-side; no caller yet.
- `server/src/controllers/aiSettingsController.js`, `server/src/routes/aiSettingsRoutes.js`.
Change:
- `server/src/config/database.js` (ensure function + call), `server/src/app.js` (`dependencies.aiSettingsService || createAiSettingsService(dependencies)`, mount before `/api/company`).
- `server/src/models/companyPortalModel.js`: `getCompanyOverviewCounts` also returns `aiConfigured` = `SELECT 1 FROM company_ai_settings WHERE company_id = ? LIMIT 1`, wrapped in its own try/catch (false on error) so a missing table cannot zero the other counts.
- `server/src/services/companyService.js`: `features.aiSettings: true`, `overview.aiConfigured = Boolean(counts?.aiConfigured)` (false on count failure).
- `docs/PROGRESS.md`: tick item 7, add Run 7 log line (note: items 8/9 must read effective settings via `resolveAiSettings`, honour `enabled`, and the FAQ source stays `is_published = 1`).

## Mock server (`server/scripts/mock-server.js`)
- In-memory `aiSettingsRows` (Map keyed by companyId). Seed: Acme (1) NO row (exercises default state and open checklist); Globex (2) a configured row with distinctive values (`assistantName: "Globex Helper"`, `tone: "concise"`, `enabled: true`, `escalateAfterFailures: 5`) for isolation tests.
- `aiSettingsModel` mock with `findAiSettings`/`upsertAiSettings` (copy on return, `updatedAt` = now). Pass into `createApp({... aiSettingsModel})`.
- Mock `companyPortalModel.getCompanyOverviewCounts` adds `aiConfigured: aiSettingsRows.has(Number(companyId))`.

## Server tests (node --test, mock-injected, no DB)
`server/test/api/aiSettings.test.js` (helpers copied from `faqs.test.js`: `startTestServer`, `companyToken`, fake `aiSettingsModel` recording `companyId` args, fake `companyPortalModel` with two companies), `server/test/validators/aiSettingsValidator.test.js`, `server/test/models/aiSettingsModel.test.js`.
1. Auth on GET and PUT: 401 without cookie; 403 for Support Agent token, Platform Admin token, token role Company Admin but DB role different; 403 inactive user / inactive company.
2. GET with no row -> 200, `configured:false`, `updatedAt:null`, `settings` deep-equals `defaults` (enabled false); GET does not call `upsertAiSettings`; `Cache-Control: no-store`; with a row returns stored values, `configured:true`; response has no `companyId`/`updatedBy`.
3. Tenancy: token claims `companyId:"999"` and `?companyId=2` + body `companyId:2` -> model receives only the DB company; Globex's row never returned or changed; PUT as Acme leaves Globex's row untouched.
4. PUT: creates (no prior row) and updates (prior row) both 200; second identical PUT idempotent; strings trimmed; empty greeting/fallback/instructions accepted; unknown keys (`apiKey`, `model`, `companyId`, `updatedBy`) not passed to the model nor echoed.
5. PUT 422 cases (each with correct `field`): non-object/array body, missing field, `assistantName` empty/41 chars/control char, bad `tone`, greeting/fallback 301 chars, instructions 1001 chars, `enabled:"true"`, `confidenceThreshold` 101/-1/70.5/"70", `escalateAfterFailures` 0/11/2.5; model not called on 422; multi-line instructions with `\n` accepted.
6. Model test (fake `pool.execute`): every statement contains `company_id` with the company param; upsert uses `ON DUPLICATE KEY UPDATE`; no user text interpolated into SQL; TINYINT -> boolean mapping; NULL instructions -> `""`.
7. `companyMe.test.js`: update to `features.aiSettings === true`; add `aiConfigured` true/false cases; a throwing `getCompanyOverviewCounts` yields `aiConfigured:false`.
8. Optional: database test (if one exists for faqs) that a fake pool records `CREATE TABLE IF NOT EXISTS company_ai_settings` and a thrown error does not reject `initMySQLSchema`.

## Client (`/company/ai-settings`)
Add:
- `client/src/types/aiSettings.ts` (`AiSettings`, `AiTone`, `AiSettingsResult`, field-error type, limits consts).
- `client/src/services/aiSettings.ts`: `getAiSettings()` (`cache: "no-store"`), `saveAiSettings(settings)` (PUT via `apiRequest`), `getAiSettingsFieldErrors(error)` (same pattern as `getFaqFieldErrors`).
- `client/src/pages/company/CompanyAiSettingsPage.tsx` (single page, no modals; split a `components/company/aiSettings/` folder only if the file exceeds ~350 lines).
Change:
- `client/src/router/index.tsx`: real page at `ROUTES.COMPANY_AI_SETTINGS`; remove the now-unused `CompanyComingSoonPage` import.
- `client/src/types/company.ts`: `overview.aiConfigured: boolean`.
- `client/src/pages/company/CompanyDashboardPage.tsx`: step "Configure AI settings" `done: overview.aiConfigured` and link it to `ROUTES.COMPANY_AI_SETTINGS` (keep the label text); replace the stale "rolling out soon" paragraph with a short line linking to AI settings or remove it (and drop unused imports). No change to `CompanyLayout` (flag-driven) or the mock `useCompanyPortal` shape beyond the type.
- `client/e2e/companyPortal.spec.ts`: only if something asserts AI Settings "Soon" (current grep shows none).

### Page behaviour
- Header "AI Settings" with subtitle; a read-only info panel: "Your assistant answers only from your published FAQs (n published)" - n from `listFaqs` is NOT fetched; instead link to `/company/faqs` with static copy (avoids a second request/failure mode).
- Form sections (labelled controls, `fieldset/legend`): 1) Assistant: Enable assistant (checkbox/switch with visible text "Enabled"/"Disabled"), Assistant name (input, counter 40), Tone (select), Greeting (textarea, counter 300). 2) Answering: "Only answer from published FAQs" checkbox, Confidence threshold (number 0-100, % with help text), Escalate to a human after N failed answers (number 1-10), Fallback message (textarea, 300). 3) Custom instructions (textarea, 1000 counter, `whitespace-pre-wrap` not needed for input). Buttons: Save changes (disabled while saving or when not dirty or when client validation fails), Reset to defaults (fills the form with `defaults`, does not save, marks dirty), Discard changes (restores last saved). `beforeunload` not required.
- Client validation mirrors the server limits; server 422 `errors[]` shown under matching fields (`aria-describedby`, `aria-invalid`); non-field error as `role="alert"` above the form.
- States: loading (skeleton form, `aria-busy`), not-configured/empty (`configured:false`: banner "Not configured yet - showing defaults. Save to activate your settings."; form pre-filled with defaults, enabled off), loaded, error on load (`role="alert"` + Try again), saving (button text "Saving..." disabled, fields disabled), success (`role="status"` "AI settings saved" and banner changes to configured; updated-at text), save failure (alert, form values preserved, stays dirty), 401/403 via the same auth-error handling as the FAQs/agents pages (`useTicketAuthError`).
- A11y: labels, focus first invalid field on failed submit, visible focus rings, Enter in single-line inputs does not submit accidentally only if dirty-guarded (normal form submit is fine), no horizontal scroll at 375 px. Text content only (no `dangerouslySetInnerHTML`).

## Playwright (`client/e2e/companyAiSettings.spec.ts`, mock backend)
Header: `E2E_SERVER_COMMAND="npm run mock" npx playwright test companyAiSettings`. Reuse `loginAsCompanyAdmin` from `companyFaqs.spec.ts`, clear cookies in `beforeEach`, role/label locators. NOTE the mock keeps state in memory per server process: Acme starts unconfigured, so tests that need the default state must run first or use `page.route` fulfilments; keep mutating tests order-independent (assert on values they set themselves, not on the unconfigured banner after a save).
1. Unauthenticated `/company/ai-settings` -> `/login/company`; platform admin -> "Access Restricted".
2. Nav: AI Settings link has no "Soon" and `aria-current="page"` on the page; heading visible.
3. Default state (via `page.route` fulfilling `configured:false` + defaults on GET): banner "Not configured yet", Enabled unchecked, name "SupportPilot Assistant", threshold 70, escalate 2.
4. Validation: clear assistant name -> client error; threshold 101 -> error; 1001-char instructions -> error; Save does not send a PUT (assert via request listener).
5. Save: change name, tone, escalate count, enable; Save -> "AI settings saved" status, reload page, values persist; Globex values ("Globex Helper") never visible.
6. Reset to defaults then Discard behaviour: Reset fills defaults and marks dirty; Discard restores the saved values.
7. Server 422 on PUT (`page.route` fulfilling `errors:[{field:"assistantName",...}]`) shows the field message under the field and keeps the entered values.
8. Errors: 500 on GET -> alert + Try again, unroute + click -> form loads; 500 on PUT -> alert, form still dirty and values preserved.
9. Dashboard: after saving, `/company/dashboard` "Configure AI settings" step is checked (done styling/`line-through` class or icon text `check_circle`).

## Verification
- `cd server && npm test` (all green incl. new and updated tests); `cd client && npm run lint && npm run build`.
- Playwright only if Chromium is available (throwaway config + `npm run mock`, as in Runs 4-6); otherwise state it was not executed.
- Never connect to a database, never run `npm start`/`dev` in `server/`, never create `server/.env`.

## Out of scope / follow-ups
Actually running the assistant (LLM provider, keys, prompt assembly, conversation widget), business hours, per-channel overrides, settings audit history, PATCH partial updates, FK to `companies` (revisit when its PK type is confirmed), wiring `enabled`/escalation into ticket flows (items 8/9), `aiResolutionRate` metric.
