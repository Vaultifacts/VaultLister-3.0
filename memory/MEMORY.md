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

## Audit Fixes (2026-03-08) — branch: feature/audit-fixes-20260308
63-question audit done. 7 items fixed in first pass. Commits:
- 58eb410 — Q9/Q12: rateLimiter LRU eviction (no more clear-all on overflow); getKey fixed to `user:${userId}`; CSRF skip for /api/webhooks/incoming + /api/csp-report
- 0e8fd0e — Q3: WebSocket upgrade now requires valid auth token before accepting
- 343567b — Q14/Q53/Q60/Q61: TRUST_PROXY=1 in docker-compose; nginx depends_on: service_healthy; daily backup-scheduler service added
- 8e74344 — Q16/Q37/Q41: /api/csp-report handler registered; crypto import explicit in errorHandler.js
Test result: 52/58 pass (was 43/58) — 9 more tests passing; 6 pre-existing CSRF-in-test-mode failures remain
Q13 deferred: CLAUDE.md hard rule prohibits removing token/refreshToken from store.persist()/hydrate() — needs explicit user override
Full tracking: audit-table.md in Claude projects folder

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
