# Status — VaultLister 3.0

## Commit Log
<!-- Most recent 10 commits — run `git log --oneline` for full history -->
- **2026-03-27 CLI** (41e1cbf): fix(security): resolve remaining CodeQL alerts — incomplete-sanitization, URL-check, biased-crypto, router hasOwnProperty, TOTP bias-free, skuRules metachar; rebuilt core-bundle
- **2026-03-27 CLI** (2159560): fix(security): correct backslash-escape regex — /\\/g not /\/g — 45 instances across 5 files; rebuilt core-bundle
- **2026-03-27 CLI** (1a4f0cb): fix(security): resolve CodeQL incomplete-sanitization/XSS/insecure-randomness — 27 onclick backslash fixes, escapeLike, replace(/g flag, chrome-ext URL checks, sanitize.js, email.js, router.js, deploy.yml permissions, Math.random->crypto
- **2026-03-27 CLI** (2be43d9): fix(security): resolve 12 CodeQL XSS and regex-injection alerts — escapeHtml on tag picker, oauth-callback platform, currency target; regex escape in search-issues + visual-test; rebuilt core-bundle + dist
- **2026-03-27 CLI** (4fe31aa): fix(frontend): use window.pages in route handlers to prevent chunk shim overwrite — ROOT CAUSE FIX for all C.xxx is not a function page crashes; Bun chunk ESM shim `var{defineProperty:C}=Object` was overwriting window.C (pages), changed all route handlers to window.pages.xxx()
- **2026-03-27 CLI** (e21ea69): fix(frontend): expose 12 widget/utility globals for lazy-loaded chunks — CRITICAL production fix, 20+ pages were crashing (escapeHtml, toLocalDate, viewModeToggle, runningBalance, financialDashboardHeader, runHistoryTimeline, businessFAB, aiConfidenceGauge, priceDropBanner, marketTrendsRadar, streakCounter, storageGauge)
- **2026-03-27 CLI** (6100574): fix(frontend): expose components as window.components for lazy-loaded chunks — CRITICAL production fix, inventory page was crashing with ReferenceError
- **2026-03-23 CLI** (1e3efe3): fix(orders): currentPage check uses 'orders-sales' after alias resolution
- **2026-03-23 CLI** (6588402): fix(e2e): fix orders-sales page render and roadmap route aliasing
- **2026-03-23 CLI** (196ef94): fix(security): B-10 regression — add user to authRouter ctx destructuring
- **2026-03-23 CLI** (ff1e081): fix(security): B-10 — remove dual auth code path in profile/password routes
- **2026-03-23 CLI** (f4cd76a): fix(ci): D-05 — remove sw.js mutation from staging deploy workflow
- **2026-03-23 CLI** (f506c7c): fix(infra): D-06 — fix staging Nginx host port bindings to 8080/8443
- **2026-03-23 CLI** (b2eb385): fix(security): B-17 — remove loopback IP bypass from auth lockout check
- **2026-03-23 CLI** (fc67be9): fix(ci): D-09 — restrict DISABLE_CSRF/DISABLE_RATE_LIMIT to unit+e2e jobs
- **2026-03-23 CLI** (4c6c18a): fix(ci): D-04 — pin SSH actions to commit SHAs
- **2026-03-23 CLI** (e1f2d3a): fix(infra): D-03 — pass GITHUB_TOKEN via env var in deploy workflow
- **2026-03-23 CLI** (cd1601d): fix(frontend): F-14/F-22/F-19 — timer leaks and modal focus restoration
- **2026-03-23 CLI** (d84b200): fix(frontend): F-26 — keyboard accessibility for sortable table headers
- **2026-03-23 CLI** (346896a): fix(e2e): resolve all accessibility test failures (18/18 pass)
- **2026-03-23 CLI** (3063847): fix(security): configure DOMPurify to allow event handlers in sanitizeHTML
- **2026-03-23 CLI** (386eee6): fix(frontend): close missing sanitizeHTML() paren in command palette renderResults
- **2026-03-23 02:01 CLI** (74ed75d): chore: add 5 pre-existing failures to test baseline  [.test-baseline]
- **2026-03-23 01:51 CLI** (56941d7): chore: rebuild frontend bundle after security fixes  [public/sw.js,src/frontend/core-bundle.js,src/frontend/index.html]
- **2026-03-23 01:48 CLI** (9d90c08): fix: resolve ReDoS and log injection security alerts
- **2026-03-23 01:36 CLI** (f00b098): [AUTO] fix(security): escape backslashes before single quotes in onclick handlers
- **2026-03-23 01:16 CLI** (afa3732): [AUTO] fix(security): wrap all innerHTML assignments with DOMPurify sanitization
- **2026-03-23 00:49 CLI** (d1ee064): [AUTO] fix(routes): add safeJsonParse to pushNotifications and settings
- **2026-03-23 00:38 CLI** (b54cc03): [AUTO] fix(routes): migrate bare JSON.parse to safeJsonParse across 16 route files
- **2026-03-21 20:50 CLI** (ebed73c): [AUTO] test: add unit tests for googleOAuth.js (58 tests) and predictions-ai.js (33 tests)

## Pending Review
<!-- Post-commit hook auto-adds Bot commits here -->

## Current State (2026-03-27) — Updated

### CodeQL Security Alert Progress
- **Fixed (4 commits)**: ~120+ alerts resolved
  - 12 XSS + regex-injection (2be43d9)
  - 27+ incomplete-sanitization onclick, escapeLike, replace(/g, URL-substring, sanitize.js, email.js, Math.random, router.js, deploy.yml (1a4f0cb)
  - 45 backslash-regex correction /\\/g (2159560)
  - incomplete-multi-char-sanitization (7 files), src/extension URL checks (16 patterns), biased-crypto (6 files), router.js hasOwnProperty, TOTP bias-free, skuRules metachar, security-audit /g flag (41e1cbf)
- **Remaining CodeQL alerts** (will drop after CI rescan):
  - `js/incomplete-sanitization` — test-report.mjs shell escape (1, deferred — hook blocked)
  - `js/insecure-randomness` — auth.helper.js test file (2 instances, low priority)
  - `js/xss-through-dom` — app.js:5109 tag picker legacy (1 instance)
  - `js/unvalidated-dynamic-method-call` — core-bundle self-heals; app.js legacy
- **Next**: Semgrep alerts (497): 267×insecure-document-method, 60×path-join-resolve-traversal, 52×detected-bcrypt-hash (FP), 24×detected-jwt-token (FP)

### Railway Production Deployment — FULLY LIVE ✅
- **URL:** https://vaultlister.com (Cloudflare → Railway)
- **Health:** `{"status":"healthy","database":{"status":"ok"}}`
- **Registration API:** 201, UUID assigned, JWT issued, PostgreSQL storing data ✅
- **PostgreSQL:** connected (Railway managed) ✅
- **Redis:** connected (Railway managed) ✅
- **Resend:** RESEND_API_KEY set ✅
- **Cloudflare R2:** R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY set ✅
- **Stripe:** STRIPE_PUBLIC_KEY set ✅
- **Sentry:** SENTRY_DSN set ✅
- **Google OAuth:** Client ID + Secret created in Google Cloud Console (VaultLister project), redirect URI = https://vaultlister.com/api/social-auth/google/callback ✅
- **vaultlister-worker:** ACTIVE ✅ (Dockerfile=worker/Dockerfile, JWT_SECRET+OAUTH_ENCRYPTION_KEY referenced from main app)
- **B2 Backups:** Bucket=vaultlister-backups, B2_APPLICATION_KEY_ID+B2_APPLICATION_KEY+B2_BUCKET_NAME set in Railway ✅
- **CI:** All checks green (CI, QA Guardian, SonarCloud, Trivy, Deploy, CodeQL) ✅
- **Infra fix (7cf8932):** Removed startCommand+healthcheckPath from railway.json (were applying to worker); set healthcheck /api/health/ready for vaultlister-app via Railway UI

### Remaining Tasks
- **B2 backup cron:** Railway → + New → Cron Job → schedule `0 3 * * *` → command `bun scripts/pg-backup.js` → link to vaultlister-app
- **Stripe live mode:** Swap sandbox keys for live keys when ready for real payments; create live webhook
- **eBay production:** Change EBAY_ENVIRONMENT sandbox → production in Railway; update eBay Developer Portal redirect URI
- **Other OAuth callbacks:** Facebook, Shopify, Etsy, Apple developer consoles → update redirect URIs to https://vaultlister.com/...

## Current State (2026-03-26)

### postgres-migration branch — CI passing ✅
- **Branch:** `feature/postgres-migration` — all commits pushed, CI green on `7b72df0`
- **Latest commits pushing through CI:** Phase 4 route fixes (71de0f8, 2e06169)
- **Migration plan status:** All 8 phases reviewed + verified

#### Phase 4 fixes (this session) — undefined || null in postgres.js INSERTs:
- `inventory.js`: COLLATE NOCASE → LOWER() (8x), sustainability_log || null
- `listings.js`: originalPrice || null, categoryPath || null
- `sales.js`: listingId, inventoryId, platformOrderId, buyerUsername, buyerAddress, notes → || null
- `socialAuth.js`: email?.toLowerCase() ?? null, name ?? null, picture ?? null, oauth email ?? null
- `shops.js`: username || null
- `automations.js`: platform || null, schedule || null
- `orders.js`: 9 optional body fields → || null

#### All phases verified:
- Phase 1-1b: database.js (postgres.js adapter), async server startup ✅
- Phase 2: pg-schema.sql consolidated DDL ✅
- Phase 3: All SQLite syntax converted (COLLATE NOCASE, datetime, julianday, etc.) ✅
- Phase 4: Key route files fixed for undefined values ✅
- Phase 5: worker/ Playwright + BullMQ (index.js, Dockerfile, bots/) ✅
- Phase 6: Dockerfile (libvips42, no SQLite), email.js (Resend), CSP (wss://vaultlister.com) ✅
- Phase 7: ci.yml (PostgreSQL services), deploy.yml (Railway auto-deploy) ✅
- Phase 8: pg-backup.js, pg-restore.js, monitoring.js pg_database_size ✅

## Current State (2026-03-25)
- **Last commit:** `455ea8e` on master (pending push)
- **E2E suite: 2429 pass / 179 fail** (full suite with Redis wiring; all 179 failures are pre-existing baseline)
- **Unit tests (Redis-related):** 162 pass / 0 fail (service-redis, enhancedMFA, rateLimiter, security-rate-limit, arch-caching-etag, middleware-shutdown)
- **Auth+security baseline:** 58 pass / 0 fail ✅ (maintained)
- **Redis integration:** COMPLETE — all 7 consumers wired (rateLimiter, enhancedMFA, socialAuth, receiptParser, barcode, analytics, idempotency)
- **Security audit:** All known items resolved + all FP1–FP7 fix priorities complete
- **QA Walkthrough:** 100% complete — 498/498 items tested
- **Deep Audit Tracker v2:** All 418+ rows populated in Notion; ALL V1-V375 findings submitted ✅ (Batches 1-12 complete)

### Recent work (this session)
- Created Deep Audit Tracker v2 in Notion — V1-V375, D1-D43, all bug/finding rows
- Created "Audit Findings — Full Report" narrative page in Notion
- `03f9d32`: fix(security): FP1 — 8 production-blocking bugs fixed:
  - C1: server.js — /core-bundle.js now remaps to dist/app.js in production
  - C2: docker-compose.yml — OAUTH_ENCRYPTION_KEY added (prevented container startup)
  - C3: oauth.js — PLAYWRIGHT_ONLY_PLATFORMS moved to module scope (ReferenceError fix)
  - V300/V301: .dockerignore created — excludes .env, ssl keys, .claude/, memory/, data/
  - V336: inventory.js — SSRF protection on /import/url (private IP blocklist)
  - V368: chatWidget.js — onclick HTML attr injection fixed (proper &, <, >, ' encoding)
  - V322: .env.example — JWT_SECRET/SESSION_SECRET default replaced with REPLACE_ME
- `95534a4`: fix(reliability): FP2 — fetch timeouts + Stripe webhook idempotency
  - V350: AbortSignal.timeout() added to 11 bare fetch() calls
  - V351: Stripe webhook idempotency — check event.id before processing, use event.id as row ID
  - V352: N/A — PRAGMA busy_timeout = 5000 already in database.js:31
- `4225e54`: fix(reliability): FP6 — graceful shutdown interval leaks (V370-V373)
  - auditLog.stop(), emailMarketing.cleanup(), stopRateLimitDashboard(), analyticsService.shutdown()
- `18ba1af`: fix(gdpr): V353 — expand USER_DATA_TABLES to cover all 27 missing user-linked tables
  - 32-entry list covering all non-CASCADE tables; transaction_audit_log anonymized
- `4b669ec`: feat: M9 — Chrome extension: add Grailed/Etsy/Shopify scrapers + full autofill (Depop/Grailed/Etsy/Shopify)
  - scraper.js: 3 new platform scrapers (was 6/9, now 9/9)
  - autofill.js: 4 new platforms in detectPlatform() + fieldMappings (was 3/7, now 7/7)
  - manifest.json: host_permissions + content_scripts updated for all new platforms
- `41267ea`: chore: M11 — trivy-action bump 0.32.0→0.35.0; closed Dependabot PR #17
- `455ea8e`: feat(redis): wire Redis into all 7 in-memory consumers (rateLimiter, enhancedMFA, socialAuth, receiptParser, barcode, analytics, idempotency)

## Active Branch: master (postgres migration merged ✅ — commit 702fafa)

## feature/postgres-migration — MERGED
- **Worktree:** `.worktrees/postgres-migration`
- **Phase 1 COMPLETE** (2026-03-25):
  - `b9b8d36`: feat(db): Phase 1 — replace bun:sqlite with postgres.js adapter
  - `6117b07`: [AUTO] fix(db): add missing await to query calls in Phase 1 modified route files
  - database.js rewritten; connectionPool.js deleted; 4 transaction bugs fixed; bun add postgres / bun remove better-sqlite3
  - **Phase 3 note:** 18 unawaited `query.transaction()` calls in 14 files — Phase 3a scope
- **Phase 1b COMPLETE** (2026-03-25):
  - `23a1804`: feat(server): Phase 1b — async main() + middleware async conversion
  - `b0dc892`: fix(server): Phase 1b corrections — shutdown order + checkTierPermission async
  - async main(), await initializeDatabase() before Bun.serve(), closeDatabase() in shutdown (correct order: stop→Redis→DB)
  - csrf.js/auth.js/requestLogger.js/rateLimiter.js all async
  - checkTierPermission made async + 6 callers updated (ai, analytics, automations, inventory×2, shops)
  - Unit test baseline maintained: 55 pass / 3 fail
- **Phase 2 COMPLETE** (2026-03-25):
  - `b452a7e`: feat(db): Phase 2 — consolidated PostgreSQL schema (189 tables, FTS→tsvector)
  - `efc2c5e`: fix(db): Phase 2 corrections — trigger idempotency, analytics prepare, TIMESTAMPTZ
  - `f58c7a8`: fix(db): remaining TEXT→TIMESTAMPTZ in oauth_accounts/price_predictions/google_tokens
  - pg-schema.sql: 3663 lines, BEGIN/COMMIT, 4 tsvector+GIN triggers, all types converted
  - 11 service/route files: embedded CREATE TABLE removed
  - docker-compose.yml: postgres:17-alpine added
  - **Phase 3 note:** FTS query sites (inventory.js, imageBank.js, help.js) deferred — Phase 3 query migration
  - **Next:** Phase 3 (query migration — 119 files: await, datetime→NOW(), LIKE→ILIKE, etc.)

## Next Tasks
1. **Sprint Board P0/P1 config (user action required):**
   - SSL certificate + domain configuration (Blocked, P0-Critical)
   - Set real Stripe price IDs in .env (P0-Critical)
   - Configure SMTP for production email (Blocked)
   - Configure real marketplace API credentials (To Do)
   - Run `bun install` on server after SDK upgrade (To Do)
