# COMPLETED.md – VaultLister 3.0
# Reference-only: detailed notes on completed features. NOT auto-loaded.
# Read specific sections on demand.

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
- 6a9cf3b — Q4: rateLimiter._cleanupInterval + stopRateLimiter(); csrfManager._cleanupInterval + stopCSRF(); both called in gracefulShutdown()
- e8dab56 — Q17: SW v4.2.0 CLEAR_USER_CACHE handler; auth.logout() posts to SW; SWR cache wiped on logout
- 9a222b0 — Q22: name-based .test-baseline; CI+pre-push flag new failures by name not count
- d5bdebd — Q4b: stopGDPRWorker() added to gracefulShutdown()
- 42a9228 — Q29: build scripts compute SHA-256 content hash; auto-sync ?v= in index.html, sw.js PRECACHE_URLS, core-bundle.js
- 21326c3 — Q21: CSRFManager.clearTokens() + exported clearCSRFTokens(); beforeEach isolation in csrf tests (78/78 pass)
Full tracking: audit-table.md in Claude projects folder

## Unit Baseline Finalized (2026-03-08) — 5289/0 — commit 7df5afb
- `getRefreshSchedulerStatus()` returns `isRunning`, `bufferMs`, `maxFailures` (aliases alongside existing fields)
- `getPriceCheckWorkerStatus()` returns `interval_ms`, `interval_minutes`, `max_items_per_cycle` (aliases)

## E2E Fixes + App Defects (2026-03-08) — merged to master
All 49 E2E failures fixed → 620/620 pass. Then 4 app-level defects patched:
- `core-bundle.js` is the file actually served (via `index.html`), NOT `app.js`
- `const handlers = {` defined at core-bundle.js:24705, closed at :26077, `window.handlers` set at :26674
- Sidebar collapse: `toggleSidebarCollapse` was absent from core handlers → added to core-bundle.js
- CSV import: `handleImportFile` same issue → added to core handlers
- WS badge: `#notification-badge` element never rendered → changed header bell to always render `<span id="notification-badge">`
- Mobile overflow: `@media(max-width:768px)` guard added at end of main.css

## Generic Publish Route Fixed (2026-03-08) — commit dd5ffa3
`POST /api/listings/:id/publish` is now a multi-platform dispatcher — routes to correct publisher based on `listing.platform`. `generateListing()` added to listing-generator.js (Claude Haiku with template fallback), `analyzeImage()` now uses Claude Vision, `predictPrice()` accepts `historicalSales`.

## Poshmark Publish Bot — WORKING (2026-03-08/09)
`scripts/poshmark-publish-bot.js` — standalone ESM subprocess, spawned by `poshmarkPublish.js`.
Key patterns:
- **Category picker**: hierarchical in ONE dropdown — click dept (Men via `A.dropdown__link`) → wait 2.5-3.5s → click category — all via `page.evaluate` with `dispatchEvent(mouseenter/down/up) + click()`
- **Size dropdown**: `isVisible()` returns false on Vue components. Fix: use `page.evaluate` + `getBoundingClientRect()` coords then `page.mouse.click(x, y)`. Labels are "US L", "US M" etc.
- **Multi-step form**: "Next" button (step 1→2), then "List This Item" (step 2). Both via `page.evaluate` + `page.mouse.click()`.
- **Price**: click `input[data-vv-name="listingPrice"]` → opens modal → `humanType()` → click `.listing-price-suggestion-modal button.btn--primary`
- **Session**: 41 poshmark.ca cookies at `data/poshmark-cookies.json`
- **Success URL**: after "List This Item", navigates to `/closet/[username]`
- **POSHMARK_COUNTRY=ca** env var required for Canadian account
- Size mapping: `resolvePoshmarkSize(rawSize, catParts)` — "32x30" → "32" (numeric waist), letter sizes → "US L"

## B-1 Auto-Offer Rule — COMPLETE (2026-03-09)
- Offer C$38 (84%) on C$45 listing → auto-countered at C$40.50 in <5s
- Offer sync script: `scripts/poshmark-offer-sync.mjs` (run with `node`, not `bun`; pass `POSHMARK_COUNTRY=ca`)

## B-2 eBay — COMPLETE (2026-03-09)
- Full OAuth → inventory_item → offer → publishOffer verified in sandbox
- `publishOffer` requires `{ marketplaceId: 'EBAY_US' }` body
- `listings.js POST /api/listings/:id/publish`: must look up shop before calling publisher

## B-3 Etsy — BLOCKED (pending Etsy approval)
- App created (keystring: 1sgc9xd1hwi3zt5k33pn9k7d), status "Pending Personal Approval"
- PKCE fix committed: `isPKCE=platform==='etsy'` skips clientSecret check
- Once approved: add callback URL `https://semianatomic-adelina-unspent.ngrok-free.dev/oauth-callback`

## B-4 Stub Platforms — COMPLETE (2026-03-09)
- Mercari, Depop, Grailed, Facebook, Whatnot, Shopify marked Coming Soon
- Live platforms: Poshmark, eBay, Etsy

## C-1 Listing Generator — COMPLETE (2026-03-09) — commit b8d303c
- `generateListing()` calls `claude-haiku-4-5-20251001` with template fallback
- API flow: login → GET /api/csrf-token → POST /api/ai/generate-listing
- Test script: `scripts/test-generate-listing.py`

## C-2 Image Analyzer — COMPLETE (2026-03-09) — commit bfd8ad8
- `analyzeImage()` in `src/shared/ai/image-analyzer.js` → `claude-haiku-4-5-20251001` Vision API
- Handles URL and base64 data URI; falls back to text helpers
- Test script: `scripts/test-image-analyzer.py`

## C-3 Price Predictor — COMPLETE (2026-03-09) — commit a9ab1ed
- `predictPrice()` uses `historicalAvg` as PRIMARY base when 3+ sales exist
- Returns `{ price, priceSource }` — callers must destructure
- `getPriceRange()` returns `{ low, suggested, high, priceSource }`
- Test script: `scripts/test-price-predictor.py`

## C-4 Vault Buddy — COMPLETE (2026-03-09) — commit a42dea6
- Model: `claude-sonnet-4-6`; `getUserStats()` returns inventory total, last-30d sales+profit, top 5 platforms
- Test script: `scripts/test-vault-buddy.py`

## C-5 Vault Buddy Platform Awareness — COMPLETE (2026-03-09)
- System prompt lists LIVE vs COMING SOON platforms; queries `shops` table for connected accounts

## D-3 Chrome Extension — COMPLETE (2026-03-09) — commit dad6f9e
- Icons at icon16/48/128.png (solid #6366f1 purple)
- `high_memory` alert fix: `v8.getHeapStatistics().heap_size_limit` replaces `heapTotal`
- Extension POSTs don't include CSRF in dev mode; workaround: fetch token separately

## E-1 Email Verification + MFA Setup — COMPLETE (2026-03-09)
- Email send wired in auth.js register route (IS_TEST_RUNTIME guard)
- `#verify-email?token=...` SPA route validates token, marks used_at
- Build: `bun scripts/build-dev-bundle.js` → core-bundle.js (12 source files); app.js is NOT in the bundle
- Bundle cache: after rebuild+restart, force fresh with `/?v=<newHash>#route`

## QA Remediation Complete (2026-03-12) — commit e7508fd (151 files)
20 REM items across 4 phases. Key fixes:
- Cross-listing integration tests with real DB; deploy rollback in deploy.yml
- expect([200,500]) anti-pattern removed from 105 test files (544 occurrences)
- Prompt injection protection (sanitizeForAI); file upload validation (validateBase64Image)
- Circuit breaker (circuitBreaker.js) wrapping Anthropic, Notion, webhooks
- External integration timeouts (fetchWithTimeout.js) on 10+ services
- Feature flags middleware (featureFlags.js) — FEATURE_AI_LISTING, FEATURE_WHATNOT_INTEGRATION, FEATURE_ADVANCED_ANALYTICS
- Backend locale parameter on formatDate/formatDateTime/formatPrice
- New files: circuitBreaker.js, featureFlags.js, sanitize-input.js, fetchWithTimeout.js, rotate-encryption-key.js

## Infrastructure Additions (2026-03-07)
- `src/backend/env.js` — Zod startup env validation
- `src/backend/middleware/validate.js` — validateBody/validateQuery (zod@4.3.6)
- `src/backend/middleware/cache.js` — ETag, cacheFor, cacheForUser, immutable, NO_CACHE
- server.js: /api/health/live + /api/health/ready; ETag/304 pipeline; /api/v1/ versioning
- Dockerfile: groupadd/useradd (Debian); python3+make+g++ in builder for better-sqlite3
- Tests must run against local bun server (PORT=3000), NOT Docker (rate limiting enabled in prod)

## Frontend Accessibility Fixes (2026-03-19) — commit b8bf0b0
- F-12: Keyboard navigation in date range picker (ArrowUp/ArrowDown/Escape; button with aria-haspopup/aria-expanded)
- F-13: CSS `button[aria-expanded="true"] svg { transform: rotate(90deg); }` for caret rotation
- F-16: `alt="Listing preview image ${idx + 1}"` at core-bundle.js line 62152
- F-20: `aria-atomic="true"` on toast elements
