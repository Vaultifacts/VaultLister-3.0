# MEMORY.md – VaultLister 3.0
# First 200 lines auto-loaded each session. Keep concise.

## Project Overview
- **Purpose:** VaultLister 3.0 — multi-channel reselling platform (successor to VaultLister 2.0)
- **Stack:** Bun.js 1.3+ + SQLite (WAL mode, FTS5) + Vanilla JS SPA + Playwright + @anthropic-ai/sdk
- **Auth:** JWT + bcryptjs (12 rounds) + TOTP MFA + OAuth 2.0 (eBay, Etsy, Shopify, Poshmark)
- **Testing:** Bun:test + Playwright + visual-test.js
- **Repo:** https://github.com/Vaultifacts/VaultLister-3.0.git

## Key Commands
- `bun run dev` — start server (port 3000)
- `bun run dev:bg` / `bun run dev:stop` — background server
- `bun run test:all` — full suite (unit + E2E + visual)
- `bun run test:unit` — unit tests only
- `bun run test:e2e` — Playwright E2E
- `bun run test:coverage` — coverage report
- `bun run db:reset` — reset database
- `bun run lint` — syntax check
- `bun scripts/session-start.js` — read pending items before working
- `bun scripts/session-end.js` — safety net at end of session

## Critical Rules
- Never push to main directly — use feature branches
- Never use `git add -A` — add specific files
- Never use `--no-verify` to bypass hooks
- Never modify `.env` — set by the user
- Never remove `'unsafe-inline'` from CSP
- Never remove `token`/`refreshToken` from `store.persist()` / `store.hydrate()`
- Always escape HTML with `escapeHtml()` for user content
- Use TEXT for all ID columns (UUIDs)
- Include CSRF token for all POST/PUT/PATCH/DELETE

## Canonical Entities
InventoryItem, Listing, Sale, Offer, Automation, Platform, PriceHistory, ImageAsset, Analytics, Report, User, Session, Notification, Tag, AuditLog

## Agents
8 specialized agents in `.claude/agents/`:
Architect-Planner, Backend, Frontend-UI, Automations-AI, Security-Auth, Testing, DevOps-Deployment, NoCode-Workflow

## AI Model Routing
- claude-haiku-4-5: fast/cheap tasks (tag detection, short descriptions, price suggestions)
- claude-sonnet-4-6: listing generation, Vault Buddy conversations

## Scaffold Date
Generated: 2026-03-02 from VaultLister 2.0 reference by claude-project-scaffolder

## Audit Fixes (2026-03-08) — merged to master
63-question audit done. 8 items fixed. Commits on master:
- 58eb410 — Q9/Q12: rateLimiter LRU eviction; getKey fixed to `user:${userId}`; CSRF skip for /api/webhooks/incoming + /api/csp-report
- 0e8fd0e — Q3: WebSocket upgrade now requires valid auth token before accepting
- 343567b — Q14/Q53/Q60/Q61: TRUST_PROXY=1 in docker-compose; nginx service_healthy gate; daily backup-scheduler
- 8e74344 — Q16/Q37/Q41: /api/csp-report handler; explicit crypto import in errorHandler.js
- 18a11fd — Q13: tokens → sessionStorage only (never localStorage); hydrate() excludes tokens from localStorage reads
- d9680e7 — Q8: poshmark-bot.js — login() reads from process.env only; shared logger; jitteredDelay(RATE_LIMITS); writeAuditLog for all key actions; try/finally in init()
- d5d5a99 — Q63: both submitCrosslist() now capture per-platform results; warning+error toasts on partial failure
- 9034dbe — Q35: removed stale 051_add_offers_table.sql entry; corrected 080 filename to 080_add_offers_table.sql
- 62968af — Q51: /api/workers/health endpoint; all 5 workers track lastRun; stale detection (3× missed cycles)
Test result: 52/58 pass (6 pre-existing CSRF-in-test-mode failures remain)
Full tracking: audit-table.md in Claude projects folder
All originally-flagged high-priority audit items resolved.

## E2E Fixes + App Defects (2026-03-08) — branch autopilot/roundrobin-20260305-1756
All 49 E2E failures fixed → 620/620 pass. Then 4 app-level defects patched:
- `core-bundle.js` is the file actually served (via `index.html`), NOT `app.js` — critical architecture note
- `const handlers = {` defined at core-bundle.js:24705, closed at :26077, `window.handlers` set at :26674
- Sidebar collapse: `toggleSidebarCollapse` was absent from core handlers (only in lazy chunks) → added to core-bundle.js
- CSV import: `handleImportFile` same issue → added to core handlers
- WS badge: `#notification-badge` element never rendered → changed header bell to always render `<span id="notification-badge">`; `notificationCenter.updateBadge()` uses `getElementById`
- Mobile overflow: `@media(max-width:768px)` guard added at end of main.css
- Hardened: P2-1/P2-2/P2-4 (nav), P1-1 (import), P9-3/P10-3 (WS badge)
- auth.test.js / security.test.js failures: pre-existing 429 rate-limit noise, NOT regressions
- Commit: 0b26054 on master

## Infrastructure Additions (2026-03-07)
All 6 gaps from /compare-project run implemented. New files:
- `src/backend/env.js` — Zod startup env validation (replaces manual JWT_SECRET check)
- `src/backend/middleware/validate.js` — `validateBody(ctx.body, schema)` / `validateQuery(ctx.query, schema)` (zod@4.3.6)
- `src/backend/middleware/cache.js` — `generateETag`, `etagMatches`, `cacheFor`, `cacheForUser`, `immutable`, `NO_CACHE`
Modified files:
- `src/backend/server.js` — env.js imported first; /api/health/live + /api/health/ready added; effectivePath normalization for /api/v1/ versioning; ETag/304 in response pipeline; cache.js import
- `src/backend/middleware/rateLimiter.js` — getKey now `user:${userId}` (was `user:${userId}:${ip}`)
- `public/sw.js` — SWR cache for stable GET API routes (health, size-charts, shipping-profiles, templates, checklist)
Commits: d003af4 (infra) → 1e7e2eb (SW v4.1.0) → 1b1c85d (Dockerfile fix) — all deployed
Post-deploy: 7/7 checks pass; auth+security tests: 43/58 pass (15 pre-existing, not our changes)
Dockerfile: groupadd/useradd (Debian); python3+make+g++ in builder for better-sqlite3
Tests must run against local bun server (PORT=3001), NOT Docker (rate limiting enabled in prod)
