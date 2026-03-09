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

## Behaviour Rules
- **Never assume or guess** — always verify with a tool (Read, Grep, Bash) before stating something is true. This includes checklist status, file contents, env values, and test counts. Taking the user's word is fine, but stating facts without verification is not.

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
- 6a9cf3b — Q4: rateLimiter._cleanupInterval + stopRateLimiter(); csrfManager._cleanupInterval + stopCSRF(); both called in gracefulShutdown(); middleware-shutdown.test.js (6/6 pass)
- e8dab56 — Q17: SW v4.2.0 CLEAR_USER_CACHE handler; auth.logout() posts to SW; SWR cache wiped on logout
- 9a222b0 — Q22: name-based .test-baseline (KNOWN_FAIL entries); CI+pre-push now flag new failures by name not count; fixed 4 Q51 test regressions (isRunning→running, getKey key format)
- d5bdebd — Q4b: stopGDPRWorker() added to gracefulShutdown(); 3 shutdown tests added to middleware-shutdown.test.js (9/9 pass)
- 42a9228 — Q29: build scripts compute SHA-256 content hash; auto-sync ?v= in index.html, sw.js PRECACHE_URLS, core-bundle.js router const; router.js source unchanged
- 21326c3 — Q21: CSRFManager.clearTokens() + exported clearCSRFTokens(); beforeEach isolation in csrf-expanded + csrf-coverage tests (78/78 pass)
Full tracking: audit-table.md in Claude projects folder
All originally-flagged high-priority audit items resolved.

## Unit Baseline Finalized (2026-03-08) — 5289/0 — commit 7df5afb on master
- `getRefreshSchedulerStatus()` returns `isRunning`, `bufferMs`, `maxFailures` (aliases alongside existing fields)
- `getPriceCheckWorkerStatus()` returns `interval_ms`, `interval_minutes`, `max_items_per_cycle` (aliases)
- Tests must run via `run-bun-tests.ps1` (sets TEST_BASE_URL=http://localhost:3100, PORT=3100, NODE_ENV=test)
- security.test.js BASE_URL defaults to port 3000; auth.helper.js to 3001 — TEST_BASE_URL must be set

## E2E Fixes + App Defects (2026-03-08) — merged to master
All 49 E2E failures fixed → 620/620 pass. Then 4 app-level defects patched:
- `core-bundle.js` is the file actually served (via `index.html`), NOT `app.js` — critical architecture note
- `const handlers = {` defined at core-bundle.js:24705, closed at :26077, `window.handlers` set at :26674
- Sidebar collapse: `toggleSidebarCollapse` was absent from core handlers (only in lazy chunks) → added to core-bundle.js
- CSV import: `handleImportFile` same issue → added to core handlers
- WS badge: `#notification-badge` element never rendered → changed header bell to always render `<span id="notification-badge">`; `notificationCenter.updateBadge()` uses `getElementById`
- Mobile overflow: `@media(max-width:768px)` guard added at end of main.css
- Hardened: P2-1/P2-2/P2-4 (nav), P1-1 (import), P9-3/P10-3 (WS badge)
- auth.test.js / security.test.js: now 0 fail when TEST_BASE_URL/PORT env vars are set correctly
- Commit: 0b26054 on master (app defects); 7df5afb (unit baseline cleanup)

## ngrok — ALWAYS run when needed
User has authorized always starting ngrok. Reserved domain command:
```
ngrok http --domain=semianatomic-adelina-unspent.ngrok-free.app 3000
```
Auth token already in ngrok config. Check if running first: `curl -s http://localhost:4040/api/tunnels`

## Server Restart (Windows) — ALWAYS use this
User has explicitly authorized always running this to restart the server:
```
powershell -Command "Get-Process bun | Stop-Process -Force"
bun run dev:bg
```
`bun run dev:stop` alone is unreliable — PID file goes stale and old process keeps running.

## Auto-Offer Rule Live — commits dd5ffa3, e8229f7
- Rule created: "Auto-Offer Rule (80% min, counter at 90%)" — type=offer, platform=poshmark, schedule=`*/5 * * * *`, conditions={minPercentage:80, counterPercentage:90}, actions={autoCounter:true}
- `executeOffer()` in taskWorker.js now guards autoCounter with minPercentage threshold — offers below 80% are skipped, ≥80% are countered at 90% of asking price
- End-to-end verified: test offer at 85% ($38.25) → auto-countered at 90% ($40.50) in <15s — automation_logs confirms `action_taken: auto_counter`
- `POST /api/automations/:id/run` is the manual trigger; CSRF token must come from a prior GET response header, not /auth/csrf

## Generic Publish Route Fixed (2026-03-08) — commit dd5ffa3
`POST /api/listings/:id/publish` is now a multi-platform dispatcher — routes to the correct publisher (poshmark/ebay/etsy/mercari/depop/grailed/facebook/whatnot/shopify) based on `listing.platform`. Previously it was Poshmark-only and used a task-queue stub. Also: `generateListing()` added to listing-generator.js (Claude Haiku with template fallback), `analyzeImage()` now uses Claude Vision, `predictPrice()` accepts `historicalSales`, model IDs updated to claude-sonnet-4-6 / claude-haiku-4-5-20251001.

## Poshmark Publish Bot — WORKING (2026-03-08) — commit 3a255bd
`scripts/poshmark-publish-bot.js` — standalone ESM subprocess, spawned by `poshmarkPublish.js`.
Key patterns discovered for Poshmark's Vue.js SPA:
- **Category picker is hierarchical in ONE dropdown**: click dept (Men via `A.dropdown__link`) → wait 2.5-3.5s → click category (Jackets & Coats via `LI.dropdown__link`) — all via `page.evaluate` with `dispatchEvent(mouseenter/down/up) + click()`
- **Size dropdown**: Playwright `isVisible()` returns false on Vue components even when element has height > 0. Fix: use `page.evaluate` to get `getBoundingClientRect()` coords then `page.mouse.click(x, y)`. Poshmark size labels are "US L", "US M" etc.
- **Multi-step form**: "Next" button (step 1→2), then "List This Item" (step 2, publishes). Both found via `page.evaluate` + `page.mouse.click()` at coordinates.
- **Price**: click `input[data-vv-name="listingPrice"]` → opens `.listing-price-suggestion-modal` → `humanType()` in modal → click `.listing-price-suggestion-modal button.btn--primary`
- **Photo**: `setInputFiles()` triggers Cropper.js modal → dismiss via `.modal button[class*="primary"]` with text "Apply"
- **Session**: 41 poshmark.ca cookies at `data/poshmark-cookies.json`, loaded at startup
- **Success URL**: after "List This Item", navigates to `/closet/[username]` (not `/listing/...`)
- **POSHMARK_COUNTRY=ca** env var required for Canadian account

## B-1 Auto-Offer Rule — COMPLETE (2026-03-09)
- Rule: "Auto-Offer Rule (80% min, counter at 90%)" — verified end-to-end via DB simulation
- Offer C$38 (84%) on C$45 listing → auto-countered at C$40.50 in <5s — automation_logs confirmed
- `executeOffer()` in taskWorker.js: DB-only logic (correct). Poshmark-side counter-sending (`bot.counterOffer()`) requires a real buyer offer; selectors unverified against live UI
- Offer sync script: `scripts/poshmark-offer-sync.mjs` (run with `node`, not `bun`; pass `POSHMARK_COUNTRY=ca`)
- Per-item share audit log entries: working (commit 9b0d0e6)

## B-2 eBay — COMPLETE (2026-03-09)
- Full OAuth → inventory_item → offer → publishOffer verified in sandbox
- Test listing published (listingId: 110589145468), confirmed PUBLISHED, withdrawn via API
- Fixes committed in 4e13d1e: marketplaceId body required for publishOffer; shop lookup in listings.js

## Poshmark Publish — FIXED + VERIFIED (2026-03-09) — commit f528d45
- Bot now uses `resolveImageFiles()` (imageUploadHelper.js) — same as Depop
- Hard error if no real photos attached (no more placeholder fallback that triggers moderation)
- Post-publish verification: bot navigates back to closet, confirms listing by title, returns real listing URL
- Category default changed from 'Men>Jackets & Coats' → 'Men>Tops' (with warning log)
- Size mapping FIXED (commit 2fd934d): `resolvePoshmarkSize(rawSize, catParts)` — "32x30" → "32" (numeric waist for pants), letter sizes → "US L" etc.
- Test listing (stock photo) removed by Poshmark moderation — 404 confirmed. Delete script at `scripts/poshmark-delete-listing.mjs`.
- `POSHMARK_COUNTRY=ca` now in .env (required for Canadian account)
- Test listing live: https://poshmark.ca/listing/Vintage-Levis-501-Jeans-32x30-69ae6ca4db3a6fed550412ac

## B-4 Stub Platforms — COMPLETE (2026-03-09) — commit f0e8769
- Mercari, Depop, Grailed, Facebook, Whatnot, Shopify marked Coming Soon in cross-lister UI
- Platform buttons: `.coming-soon-btn` class — greyed out, `pointer-events: none`, tooltip "Coming soon — join the waitlist"
- Basic cross-list modal: live=[poshmark,ebay,etsy]; coming-soon platforms have `disabled` checkbox + `.coming-soon-badge`
- `updateCrosslistSelection()` no longer toggles coming-soon buttons
- CSS in `main.css`: `.coming-soon-btn`, `.coming-soon-badge`
- Live platforms: Poshmark, eBay, Etsy

## B-3 Etsy — BLOCKED (pending Etsy approval)
- App created (keystring: 1sgc9xd1hwi3zt5k33pn9k7d), status "Pending Personal Approval"
- oauth.js PKCE fix committed (4e13d1e): isPKCE=platform==='etsy' skips clientSecret check
- Authorize URL verified: returns code_challenge + S256 correctly
- Once approved: add callback URL https://semianatomic-adelina-unspent.ngrok-free.dev/oauth-callback in Etsy developer portal

## eBay + Etsy Integration (2026-03-09) — commit 4e13d1e
- **eBay end-to-end VERIFIED**: Full OAuth → inventory_item → offer → publishOffer flow working in sandbox
  - `publishOffer` requires `{ marketplaceId: 'EBAY_US' }` body — missing body causes error 25002
  - `listings.js POST /api/listings/:id/publish`: must look up shop before calling publisher (null crash fix)
  - Test listing published (listingId: 110589145468), confirmed PUBLISHED, then withdrawn via API
- **Etsy OAuth**: App created (keystring `1sgc9xd1hwi3zt5k33pn9k7d`), status "Pending Personal Approval"
  - Etsy uses PKCE (no client_secret) — `oauth.js` fixed: `isPKCE = platform === 'etsy'` skips clientSecret check
  - Authorize URL verified: returns `code_challenge` + `code_challenge_method=S256` correctly
  - BLOCKED: Etsy key pending manual approval by Etsy team — cannot complete OAuth until approved
  - Once approved: add callback URL `https://semianatomic-adelina-unspent.ngrok-free.dev/oauth-callback` in Etsy developer portal
- **Per-item audit log (B-1)**: Share entries now write per-item with `listingId`/`title` (commit 9b0d0e6)

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
Tests must run against local bun server (PORT=3100 via start-test-bg.ps1), NOT Docker (rate limiting enabled in prod)
