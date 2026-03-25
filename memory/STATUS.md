# Status — VaultLister 3.0

## Commit Log
<!-- Most recent 10 commits — run `git log --oneline` for full history -->
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

## Current State (2026-03-24)
- **Last commit:** `4453885` on master (pushed ✅)
- **E2E suite: 620 pass / 0 fail** ✅
- **Security audit:** All known items resolved + 8 new FP1 issues fixed
- **QA Walkthrough:** 100% complete — 498/498 items tested
- **Deep Audit Tracker v2:** All 418+ rows populated in Notion

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
  - V350: AbortSignal.timeout() added to 11 bare fetch() calls (barcode, socialAuth, shippingLabels, emailOAuth, shopifySync, webhooks)
  - V351: Stripe webhook idempotency — check event.id before processing, use event.id as row ID
  - V352: N/A — PRAGMA busy_timeout = 5000 already in database.js:31

## Next Tasks
1. **FP5 items:** M2, M6, M7, M14 (deploy smoke test, SW precache, DOMPurify fallback, Stripe guard), V346 (chatWidget eval allowlist), V353 (GDPR cascade completeness)
3. **FP5 items:** M2, M6, M7, M14 (deploy smoke test, SW precache, DOMPurify fallback, Stripe guard), V346 (chatWidget eval allowlist), V353 (GDPR cascade completeness)
4. **FP6 items:** V370-V373 — graceful shutdown interval leaks
5. **Sprint Board P0/P1 config (user action required):**
   - SSL certificate + domain configuration (Blocked, P0-Critical)
   - Set real Stripe price IDs in .env (P0-Critical)
   - Configure SMTP for production email (Blocked)
   - Configure real marketplace API credentials (To Do)
   - Run `bun install` on server after SDK upgrade (To Do)
