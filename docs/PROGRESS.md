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
- [ ] 2. Company-admin guard + `/api/company/me` endpoint and company dashboard shell (layout, nav, overview stats)
- [ ] 3. Tickets data model + API (create/list/get/update status/assign) scoped by company
- [ ] 4. Company portal: ticket management UI
- [ ] 5. Support agents: model + invite/assign API and UI
- [ ] 6. FAQs: model + CRUD API and UI
- [ ] 7. Company AI settings: model + API and UI
- [ ] 8. Customer experience: submit ticket / view own tickets (UI + API)
- [ ] 9. Agent experience: assigned-ticket queue and replies
- [ ] 10. Public/auth polish: dead links, Google OAuth UI wiring, role-based redirects after login
- [ ] 11. Playwright e2e coverage + final lint/build/test pass

## Log
