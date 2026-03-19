# VaultLister 3.0 — Deep 9-Layer Audit
> Completed: 2026-03-19 | Auditor: Claude Opus 4.6
> Full detailed reports in qa/reports/

---

## GRAND TOTAL: 230 findings across 9 layers

| Layer | Critical | High | Medium | Low | Total |
|-------|----------|------|--------|-----|-------|
| 1. Frontend | 2 | 9 | 9 | 10 | 30 |
| 2. Backend Security | 2 | 5 | 7 | 3 | 17 |
| 3. Database | 5 | 7 | 11 | 10 | 33 |
| 4. Shared AI | 0 | 3 | 4 | 4 | 11 |
| 5. Automations | 1 | 9 | 6 | 2 | 18 |
| 6. DevOps | 2 | 10 | 13 | 9 | 34 |
| 7. Chrome Extension | 1 | 8 | 9 | 12 | 30 |
| 8. Tests | 3 | 7 | 12 | 7 | 29 |
| 9. Scripts | 4 | 11 | 15 | 9 | 39 |
| **TOTAL** | **20** | **69** | **86** | **66** | **241** |

---

## Layer 1: Frontend — 30 findings
*Report: qa/reports/frontend-audit-2026-03-19.md*

| Sev | ID | Description |
|-----|----|-------------|
| CRIT | F-01 | `init.js:1623` — `app.toast` undefined, crashes legal PDF download |
| CRIT | F-06 | Triple code duplication (app.js + core-bundle.js + source files) |
| HIGH | F-02 | store.state direct mutation bypasses persist() |
| HIGH | F-05 | richTooltip XSS sink — user content unescaped |
| HIGH | F-07/08 | Quick Photo stubs (toast-only, no API call) |
| HIGH | F-10 | Dark mode key split across 3 files (preference lost) |
| HIGH | F-11 | Raw fetch() bypasses api.request() auth retry |

---

## Layer 2: Backend Security — 17 findings
*Report: qa/reports/audits/backend-security-audit-2026-03-19.md*

| Sev | ID | Description |
|-----|----|-------------|
| CRIT | B-01 | Mock OAuth registered in production (no NODE_ENV guard) |
| CRIT | B-02 | 3 route trees missing from protectedPrefixes (no auth on /integrations, /monitoring, /settings) |
| HIGH | B-03 | /api/status public — leaks process.version, NODE_ENV, uptime |
| HIGH | B-05 | Enterprise tier accepted as admin — audit log access |
| HIGH | B-06 | demo-login no rate limit (bcrypt DoS) |
| HIGH | B-07 | password reset CSRF-exempt + no rate limit |

---

## Layer 3: Database — 33 findings
*Report: qa/reports/db-layer-audit-2026-03-19.md*

| Sev | ID | Description |
|-----|----|-------------|
| CRIT | DB-01/02/03 | Migration registration mismatches — 4+ tables never created |
| CRIT | DB-05 | listings_folders.user_id INTEGER vs TEXT — cross-user readable |
| CRIT | DB-20 | sales.js transaction broken — query.db not exported, sale creation NOT atomic |
| HIGH | DB-18/19 | Offer accept + crosslist loops no transaction wrapper |
| HIGH | DB-31 | net_profit stored as raw float — SUM() penny drift |

---

## Layer 4: Shared AI — 11 findings

| Sev | ID | Description |
|-----|----|-------------|
| HIGH | A-01 | predictions cache unbounded Map (memory leak) |
| HIGH | A-02/03 | Cache not invalidated on item mutation or new sales |
| MED | A-04/05 | Circuit breaker no fallback function (works by accident) |
| MED | A-07 | Prompt injection sanitizer covers limited phrase set |

---

## Layer 5: Automations — 18 findings

| Sev | ID | Description |
|-----|----|-------------|
| CRIT | B-01 | 5 bots don't close browser on init() failure (session leak) |
| HIGH | B-02 | 5 bots use plain Playwright (no stealth) — trivially detectable |
| HIGH | B-03 | 5 bots ignore RATE_LIMITS entirely |
| HIGH | B-05 | 4 bots write no per-action audit log entries |
| HIGH | B-07 | automation-runner credential passthrough silently ignored (multi-tenant bug) |
| HIGH | B-09 | No concurrency guard — same bot shared by concurrent tasks |

---

## Layer 6: DevOps — 34 findings
*Report: qa/reports/devops-infra-audit-2026-03-19.md*

| Sev | ID | Description |
|-----|----|-------------|
| CRIT | D-01/02 | Redis default password `changeme` in both compose files |
| HIGH | D-07 | backup.sh and rollback.sh don't exist (blocks deploy) |
| HIGH | D-08 | restore.js uses copyFileSync on live WAL-mode SQLite (corrupts DB) |
| HIGH | D-09 | Security tests run with CSRF+rate-limiting disabled |
| HIGH | D-10 | No Content-Security-Policy header in Nginx |
| HIGH | D-12 | No container resource limits (OOM risk) |

---

## Layer 7: Chrome Extension — 30 findings
*Report: qa/reports/audits/chrome-extension-audit-2026-03-19.md*

| Sev | ID | Description |
|-----|----|-------------|
| CRIT | EXT-25 | Sync process regex never matches real IDs — entire sync workflow broken |
| HIGH | EXT-02 | HTTP localhost in host_permissions (token in plaintext) |
| HIGH | EXT-04 | No refresh token, no expiry handling (silent logout every 15min) |
| HIGH | EXT-05 | No HTTPS enforcement on API calls |
| HIGH | EXT-07 | Token race on service worker wake |
| HIGH | EXT-08 | onMessage no sender validation (any page can inject) |
| HIGH | EXT-13 | Arbitrary external URL fetch from service worker |
| HIGH | EXT-23 | 3 backend extension handlers missing !user guard |

---

## Layer 8: Tests — 29 findings
*Report: qa/reports/test-layer-audit-2026-03-19.md*

| Sev | ID | Description |
|-----|----|-------------|
| CRIT | T-01 | Unit tests pass vacuously when auth fails (no test.skip, silent return) |
| CRIT | T-03 | 123 files hardcode port 3000, 62 hardcode 3001 — test server runs on 3100 |
| CRIT | T-10 | 5 new spec files missing from chunk definitions (never run in selective mode) |
| HIGH | T-05 | 325 waitForTimeout calls across E2E suite (flakiness source) |
| HIGH | T-09 | offers.spec 20+ tests skip silently on seed failure |
| HIGH | T-13 | integrations.js + settings.js have 0 test coverage |
| HIGH | T-17 | Auth fixture race — swallows timeout, hands off unauthenticated page |

---

## Layer 9: Scripts — 39 findings
*Report: qa/reports/scripts-layer-audit-2026-03-19.md*

| Sev | ID | Description |
|-----|----|-------------|
| CRIT | S-01 | test-report.mjs — undeclared HOME/PROJECT variables, crashes on load |
| CRIT | S-02 | backup-automation.js — raw file copy on live WAL SQLite (corrupt backups) |
| CRIT | S-03 | run-migrations.js — `bun:sqlite` import with node shebang |
| CRIT | S-04 | lib/env.js — `require()` in ESM module, breaks session-end.js |
| HIGH | S-05 | backup-automation.js — Windows path split with forward slash |
| HIGH | S-07 | server-manager.js — SIGTERM ignored on Windows, 5s stall |
| HIGH | S-08 | poshmark-scheduler.js — browser not closed on SIGINT |
| HIGH | S-09 | smoke-test.mjs — default port 3001 vs dev server 3000 |

---

## TOP 20 FIXES FOR TOMORROW (ordered by impact)

### Critical (do first — 20 items, ~8 hours)
1. **B-01** Guard mock OAuth behind NODE_ENV (1 line in server.js)
2. **B-02** Add 3 route prefixes to protectedPrefixes (1 line in server.js)
3. **DB-01/02/03** Fix migration filenames in database.js array (4 lines)
4. **DB-05** Rebuild listings_folders with TEXT user_id (migration)
5. **DB-20** Export db from database.js or fix sales.js transaction
6. **D-01/02** Change Redis password from `changeme` to `${REDIS_PASSWORD:?}` (2 lines)
7. **EXT-25** Fix sync process regex (1 character change)
8. **S-04** Replace require() with import in lib/env.js (1 line)
9. **S-02** Replace backup-automation.js file copy with db.backup()
10. **F-01** Fix app.toast → toast.success in init.js (1 line)

### High (do next — 10 items, ~6 hours)
11. **Bot hardening** — Add stealth+rate-limits+audit-log to 5 non-Poshmark bots
12. **D-07** Create backup.sh + rollback.sh (blocks deploys)
13. **EXT-08** Add sender validation to onMessage handlers
14. **T-10** Add 5 new spec files to chunk definitions
15. **T-03** Standardize test port to 3100 across all files
16. **B-07** Add rate limit to password reset endpoint
17. **D-10** Add Content-Security-Policy to Nginx config
18. **D-12** Add container resource limits to compose files
19. **A-01** Add max size + eviction to prediction cache
20. **DB-18/19** Wrap offer accept + crosslist in transactions
