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
- **Last commit:** `77ac027` on master (pushed ✅)
- **E2E suite: 620 pass / 0 fail** ✅
- **Security audit:** All known items resolved (B-08/09/10/17, D-03–D-09, EXT-23/24/26)
- **QA Walkthrough:** 100% complete — 498/498 items tested
- **Sprint Board:** 14 non-Done items remaining; shipping labels + financials email-parse marked Done

### Recent work (this session)
- `bfa21be`: fix(shipping) — Shippo API integration replacing simulated rates/purchase
- `5f5f75f`: feat(backup) — cloud sync wired into Docker scheduler
- `21cba1f`: chore — husky hooks hardened (portable MEMORY_DIR)
- `d58b9f5`: fix(a11y) — Lighthouse accessibility 94→100
- `77ac027`: chore(sw) — CACHE_VERSION bump

## Next Tasks
1. **Sprint Board P1 items (user action required):**
   - Configure SMTP for production email (Blocked)
   - Configure real marketplace API credentials (To Do)
   - Run `bun install` on server after SDK upgrade (To Do)
   - Fill marketplace credentials in staging .env (To Do)
   - BLOCKER: Set real Stripe price IDs in .env (P0-Critical)
   - SSL certificate + domain configuration (Blocked, P0-Critical)
2. **Sprint Board P2 code items:**
   - Mobile responsiveness verification
   - Load testing (50+ concurrent users)
   - Chrome extension: full listing capture
3. **Production deploy** — when all P0/P1 items resolved
