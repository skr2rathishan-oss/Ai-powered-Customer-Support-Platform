# SupportPilot build progress

Environment notes:
- backend not runnable: no MYSQL_*/MONGODB_URI/JWT_SECRET env vars in the automation environment; using mocked `cd server && npm test` plus `cd client && npm run lint && npm run build`.
- Baseline: `server/scripts/test-smtp.js` is picked up by `node --test` and fails without SMTP env vars (environmental, not a code bug; item 1 makes it skip cleanly).

## Audit findings
- `/company/dashboard` is `DashboardPlaceholderPage` (no company portal).
- Platform settings are held in memory in `adminService.js` (lost on restart).
- No ticket, FAQ, agent, customer, or AI-settings data model or API exists.
- Roles besides Platform Admin / company admin have no UI (agent, customer).
- Google OAuth / password reset exist server-side; verify UI wiring later.

## Checklist (foundations first)
- [x] 1. Persist platform settings in MySQL (`platform_settings` table), make test-smtp script not break `npm test` — settings now stored in MySQL `platform_settings` (single JSON row), validated allowlist, secrets never stored; npm test runs only test/**
- [x] 2. Company-admin guard + `GET /api/company/me` + company portal shell (layout, nav, overview) — done; dev mock backend via `cd server && npm run mock`; reviewer: no blocking issues
- [x] 3. Tickets data model + API (create/list/get/update status/assign) scoped by company — `tickets` table, `/api/company/tickets` routes, overview counts and `features.tickets` live; mock server seeded
- [x] 4. Company portal: ticket management UI — list (URL-synced filters, search, pagination), create modal, detail page with status/priority/assignee editing at /company/tickets; plan in docs/plans/ticket-management-ui.md
- [x] 5. Support agents: model + invite/assign API and UI — `/api/company/agents` (list, invite via set-password token email, resend, activate/deactivate with open-ticket unassign), /company/agents page; plan in docs/plans/support-agents.md
- [x] 6. FAQs: model + CRUD API and UI — `faqs` table, `/api/company/faqs` (list/filter, create, partial update incl. publish toggle, delete), /company/faqs page; plan in docs/plans/faqs.md. Items 7 and 8 must read only `is_published = 1` rows
- [x] 7. Company AI settings: model + API and UI — `company_ai_settings` table, `GET/PUT /api/company/ai-settings` (whole-document upsert), /company/ai-settings page; plan in docs/plans/company-ai-settings.md. Settings only, no LLM calls
- [x] 8. Customer experience: submit ticket / view own tickets (UI + API) — customer = `users` row with role `Customer` + `company_id`; `/api/customer/*` (me, faqs, tickets create/list/get), public `GET /api/public/companies`, `POST /api/auth/customer/register`; client `/register` and `/support/*` portal; plan in docs/plans/customer-experience.md. Item 9 may add replies on `/api/customer/tickets/:id`; item 10 can generalise role redirects and Google customers
- [x] 9. Agent experience: assigned-ticket queue and replies — `ticket_replies` table; `/api/agent/*` (me, assigned-ticket queue, detail, replies with internal notes, status); customer and company-admin reply endpoints; `/agent/tickets` portal; `homeForRole` login redirect (agents go to the agent portal); plan in docs/plans/agent-experience.md
- [ ] 10. Public/auth polish: dead links, Google OAuth UI wiring, role-based redirects after login
- [ ] 12. Wire stored platform settings into runtime (JWT expiry, cookie flags, password policy, SMTP, maintenance mode); they are currently stored but env vars still drive behavior
- [ ] 11. Playwright e2e coverage + final lint/build/test pass

## Log
- Run 1: item 1 done (reviewer: no blocking issues; follow-up item 12 added).
- Run 2: item 2 done (company portal shell, mock-server added; Playwright spec written but not executed, no Chromium here).
- Run 3: item 3 done (server only; contract in docs/plans/tickets-api.md).
- Run 4: item 4 done (client only; Playwright 14/14 passed against mock backend via a throwaway config pointing at chromium-1194; reviewer findings fixed in one round).
- Run 5: item 5 done (server 213 pass; client lint/build clean; Playwright 22/22 against mock). Notes for item 9: JWTs are stateless, so re-check DB `account_status` on every agent request. Invite resend has no cooldown.
- Run 6: item 6 done (server 250 tests, 248 pass, 2 skipped; client lint/build clean; Playwright 21/21 against mock). Reviewer: no blocking issues; optional follow-ups: strict 500-FAQ cap under concurrency, isolate the FAQ count failure in overview counts.
- Run 7: item 7 done (settings model/API/UI; server tests green, client lint/build clean; Playwright companyAiSettings 10/10 against mock). Items 8/9 must read effective settings via `resolveAiSettings` (aiSettingsService), honour `enabled`, and keep the FAQ source at `is_published = 1`.
- Run 8: item 8 done (customer registration, `/api/customer/*`, `/support/*` portal; server 375 tests, 373 pass, 2 skipped; client lint/build clean; customerPortal Playwright 12/12 against mock). Deploy note: the `Customer` role row is inserted best-effort by `initMySQLSchema`; create it by hand if registration returns CUSTOMER_ROLE_MISSING. Open: adminPlatform.spec.ts:17 failed once in the full Playwright run (unverified whether pre-existing); `/api/public/companies` has no rate limiter.
- Run 9: item 9 done (server 417 tests, 415 pass, 2 skipped; client lint/build clean; agentPortal Playwright 11/11 against mock; full suite 80/81, with adminPlatform.spec.ts test 2 failing, unrelated per review and unverified on baseline). Reviewer: no blocking issues; fixed the customer reopen race with a conditional update. Open: the model SQL (`FIELD()`, `INSERT ... SELECT`) has only been tested against a mock pool, so run it once against the real DB.
