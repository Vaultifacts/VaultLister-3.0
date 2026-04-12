# Open Issue Triage — 2026-04-12

Classification model used in this report:
- `VERIFIED`: category supported by current repo state, workflow state, or issue metadata.
- `HIGH-PROBABILITY`: category inferred from issue content/labels with no contrary repo evidence found in this pass.

Summary counts:
- `close`: 6
- `keep`: 126
- `merge -> #120`: 1
- `move to launch checklist`: 14
- `re-audit`: 3

Post-action status on 2026-04-12 after applying verified GitHub hygiene:
- `6` verified stale issues were closed: `#32 #34 #36 #40 #41 #371`
- open issue count moved from `150` to `144`
- milestones created:
  - `Now / Verified Infra` (`5` issues)
  - `Re-Audit` (`3` issues)
  - `Launch Checklist` (`14` issues)
- `Copilot` bot co-assignment was removed from all open issues

Notes:
- 147 of 150 open issues were created on 2026-03-28 in one audit wave.
- 150 of 150 have no milestone.
- 131 of 150 are assigned to both `Copilot` and `Vaultifacts`, so assignment does not represent real ownership.
- 137 of 150 have no comments; 11 more only have Copilot bot failure comments.

| # | Title | Labels | Action | Confidence | Basis |
| --- | --- | --- | --- | --- | --- |
| 24 | Silent failure: no error UI when inventory API returns 500 | bug | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 25 | App ignores 401 responses — expired sessions not redirected to login | bug | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 26 | Token refresh 401 not handled — users stuck in broken state | bug | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 27 | Sidebar active state stale when page-load JS throws (Orders, Image Bank) | bug | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 28 | Login: email input becomes invisible after invalid input (Defect D1) | bug | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 29 | Import paste modal: Import button not visible | bug | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 30 | P0: `scripts/backup.sh` missing — staging deploy fails on every run | bug, infrastructure, p0-critical | keep | VERIFIED | VERIFIED: .github/workflows/deploy-staging.yml still copies scripts/backup.sh, but the repo has no scripts/backup.sh file. |
| 31 | P0: staging `.env` bootstrap missing `DATABASE_URL` — staging boots without a database | bug, infrastructure, p0-critical | keep | VERIFIED | VERIFIED: .github/workflows/deploy-staging.yml still bootstraps staging .env without DATABASE_URL. |
| 32 | E2E tests permanently disabled in CI (`if: false`) | tech-debt, infrastructure | close | VERIFIED | VERIFIED: .github/workflows/ci.yml now runs blocking E2E Smoke instead of a disabled test-e2e job. |
| 33 | Bulk suppress 27 `insecure-document-method` Semgrep false positives | tech-debt, security | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 34 | `add-to-project.yml` missing `permissions` block — open CodeQL alert | security, infrastructure | close | VERIFIED | VERIFIED: .github/workflows/add-to-project.yml now has an explicit permissions block with repository-projects: write. |
| 35 | `semgrep.yml` push trigger misconfigured — source code pushes skip Semgrep scan | security, infrastructure | keep | VERIFIED | VERIFIED: .github/workflows/semgrep.yml currently has only workflow_dispatch and schedule, not push scanning. |
| 36 | `trivy.yml` uses version tag not SHA pin — inconsistent with rest of repo | tech-debt, infrastructure | close | VERIFIED | VERIFIED: .github/workflows/trivy.yml pins aquasecurity/trivy-action by commit SHA. |
| 37 | Fix ~200 pg-migration regression failures: update async postgres stubs in test suite | bug, tech-debt | re-audit | VERIFIED | VERIFIED: issue body sizing is stale; it cites a 585-failure baseline, but current repo state differs and needs a fresh regression audit. |
| 38 | `sql.unsafe()` in `searchInventory` — replace with parameterized query | tech-debt, security | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 39 | Update repo topics: replace `sqlite` with `postgresql`; fix `package.json` repo URL | tech-debt | re-audit | VERIFIED | VERIFIED: package.json repository/bugs URLs are fixed, but GitHub repo topics still include sqlite. |
| 40 | Monitoring: alert email body empty — alerts silently dropped when ALERT_EMAIL is set | bug, enhancement | close | VERIFIED | VERIFIED: src/backend/services/monitoring.js now sends alert email via sendEmail(...). |
| 41 | `/api/health` Redis status hardcoded `false` — inaccurate health reporting | bug, enhancement | close | VERIFIED | VERIFIED: src/backend/services/monitoring.js now performs a real Redis ping in healthCheck(). |
| 42 | Remove hardcoded demo feedback entries from `store.js` initial state | bug, tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 43 | Phase 3: implement tsvector full-text search (replace ILIKE fallback in `searchInventory`) | enhancement, tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 44 | Implement email parsing (`/api/financials/email-parse`) — Phase 2 | enhancement | merge -> #120 | HIGH-PROBABILITY | HIGH-PROBABILITY duplicate endpoint scope: both issues target /api/financials/email-parse. |
| 45 | Facebook Marketplace bot: implement `shareListing()` (AU-11) | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 46 | Configure Cloudflare SSL — Full (strict) mode + HSTS enabled | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 47 | Set Stripe live keys — STRIPE_PRICE_MONTHLY + STRIPE_PRICE_ANNUAL in Railway env | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 48 | Configure Resend SMTP — set RESEND_API_KEY + FROM_EMAIL in Railway env | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 49 | Add eBay OAuth credentials — EBAY_CLIENT_ID + EBAY_CLIENT_SECRET in Railway env | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 50 | Activate Etsy OAuth — apply for production API access (deferred post-release) | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 51 | Add Poshmark credentials — POSHMARK_USERNAME + POSHMARK_PASSWORD in Railway env | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 52 | Add Mercari credentials — MERCARI_EMAIL + MERCARI_PASSWORD in Railway env | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 53 | Verify Backblaze B2 backup cron — confirm pg_dump scheduled job runs in production | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 54 | Update OAuth redirect URIs — set production callback URLs in all marketplace developer dashboards | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 55 | Enable Sentry 2FA — secure Sentry organization account before launch | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 56 | Set OAUTH_ENCRYPTION_KEY in Railway — AES-256-GCM key for marketplace token encryption | p0-critical, launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 57 | Set BACKUP_CODE_SECRET in Railway env | p0-critical, launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 58 | Set UNSUBSCRIBE_SECRET in Railway env | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 59 | Run production load test — verify Railway handles expected concurrent users before launch | launch-checklist | move to launch checklist | VERIFIED | VERIFIED: manual/env/vendor configuration task; track outside the engineering code backlog. |
| 86 | Consolidate duplicate `safeJsonParse` definitions into shared utility | tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 87 | Remove stale SQLite references from comments and code | tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 88 | Add global error toast/notification component for API failures | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 89 | Add loading spinners to page transitions | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 90 | Add empty state UI for inventory, sales, and listings pages | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 91 | Add `GET /api/inventory/export/csv` endpoint | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 92 | Add `GET /api/sales/export/csv` endpoint | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 93 | Add inventory item duplication endpoint `POST /api/inventory/:id/duplicate` | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 94 | Add Docker HEALTHCHECK to worker Dockerfile | infrastructure | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 95 | Add Playwright bot retry logic with exponential backoff | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 96 | Add bot failure screenshot capture for debugging | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 97 | Add unit tests for token refresh flow in app.js | testing | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 98 | Add unit tests for graceful shutdown sequence | testing | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 99 | Normalize error response shape across all API routes | tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 100 | Add listing status sync from marketplace platforms back to inventory | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 101 | Add AI listing quality score after generation | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 118 | Replace SQLite-style boolean `= 1` / `= 0` with PostgreSQL `= TRUE` / `= FALSE` | tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 119 | Add ARIA attributes and keyboard handlers to onclick elements (accessibility) | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 120 | Implement email sale parser endpoint `/api/financials/email-parse` | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 121 | Validate Stripe price IDs on startup — reject placeholders | bug, enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 122 | Add rate limit headers (`Retry-After`, `X-RateLimit-*`) to API responses | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 124 | Add dependency review workflow for Dependabot PRs | infrastructure | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 125 | Chrome extension: add offline queue and batch scraping | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 126 | Add cross-listing history API endpoint | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 127 | Poshmark bot: implement follow-back automation | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 128 | Image bank: fix silent catch, add MIME type validation on upload | bug, security | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 130 | Add account activity log endpoint (`GET /api/security/activity`) | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 133 | Add automated backup restore verification workflow | infrastructure | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 150 | Wrap offer accept/decline in database transactions to prevent race conditions | bug | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 151 | Fix N+1 query patterns in listings, analytics, and reports routes | enhancement, tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 152 | Add rate limiting and file size validation to image upload endpoint | enhancement, security | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 153 | Add webhook retry logic with exponential backoff and dead-letter queue | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 154 | Add safe parseInt/parseFloat validation across route handlers | bug, tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 155 | Validate custom field keys and values on inventory items | enhancement, security | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 156 | Generate OpenAPI 3.0 spec for all API routes | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 157 | Add graceful cancellation to long-running bot operations | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 158 | Add integration tests for Redis in-memory fallback behavior | testing | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 159 | Replace console.warn/log in middleware with structured logger | tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 170 | Extract hardcoded millisecond magic numbers into named timing constants | tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 171 | Add missing database indices to 22 tables for query performance | enhancement, tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 172 | Add unit tests for 5 untested services and workers | testing | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 173 | Audit and resolve duplicate route path conflicts across route files | bug | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 174 | Complete dark mode implementation — full CSS coverage and system preference detection | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 175 | Improve offline sync — auto-flush, queue indicator, conflict resolution | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 176 | Enhance service worker — API cache TTL, background sync, push notifications | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 177 | Add price prediction history tracking and accuracy metrics | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 178 | Add bulk operations for inventory — update, delete, cross-list | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 180 | Add guided onboarding wizard for new users | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 181 | Add role-based access control for team members | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 182 | Add auto-purge for recently deleted items after 30-day retention | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 183 | Add response caching to high-traffic GET endpoints | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 198 | P0: Fix IDOR vulnerabilities — add user_id checks to 15+ query-by-id routes | security, p0-critical | re-audit | VERIFIED | VERIFIED: cited route examples now mostly include user_id checks; re-run a focused IDOR audit before keeping this as active P0. |
| 200 | Document 78 undocumented environment variables in `.env.example` | tech-debt | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 202 | Create event listener cleanup registry to prevent memory leaks on SPA navigation | bug, enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 203 | Add gzip/brotli response compression middleware for non-CDN traffic | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 204 | Auto-optimize uploaded images — thumbnails, WebP conversion, EXIF stripping | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 205 | Add GDPR data export download endpoint and status tracking | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 206 | Add startup preflight check script — validate env, database, Redis, Bun version | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 207 | Improve CORS configuration — credentials, expose headers, origin validation | enhancement, security | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 208 | Add API versioning with `/api/v1/` prefix | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 209 | Add profit/loss report endpoint combining expenses and sales | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 210 | Add batch barcode scanning endpoint with caching | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 211 | Add shipping rate comparison across carriers | enhancement | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 226 | Add request deduplication and AbortController support to frontend API client | enhancement, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 228 | Fix router — add token expiry check in auth guard, chunk load cancellation, scroll restore | bug, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 229 | Add state versioning, subscriber cleanup, and schema validation to store.js | enhancement, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 231 | Fix modal accessibility — focus trap cleanup, aria-hidden, backdrop behavior, z-index stacking | bug, frontend, accessibility | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 232 | Add aria-expanded to dropdowns and keyboard navigation to components.js | enhancement, frontend, accessibility | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 233 | Add retry logic, cost tracking, and timeout to Claude AI client | enhancement, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 234 | Add file size/format validation and JSON parse safety to image-analyzer.js | bug, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 235 | Add prompt injection protection and platform-aware length limits to listing-generator.js | security, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 236 | Add outlier detection, confidence scores, and price bounds to price-predictor.js | enhancement, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 237 | Harden AI input sanitizer — RTL text attacks, punctuation bypass, control characters | security, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 238 | Add WebSocket auth timeout, rate limiting, and chat room permission checks | security, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 239 | Configure BullMQ job options — attempts, timeout, backoff, stale job detection | bug, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 240 | Add screenshot-on-failure and browser close timeout to Playwright bots | enhancement, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 241 | Replace console.log/warn/error with structured logger in worker bots | enhancement, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 242 | Add database connection pool monitoring and graceful drain on shutdown | enhancement, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 243 | Add dedicated error page, offline page, and WebSocket connection status indicator | enhancement, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 244 | Centralize CSS z-index values, add smooth dark mode transition, and 320px breakpoint | enhancement, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 245 | Fix AR preview — camera permission handling, memory cleanup, FPS limiter | bug, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 247 | Add WebSocket message deduplication on client reconnect | enhancement, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 248 | Add sustainability data source citations and accuracy ranges | enhancement, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 249 | Add HTML validation attributes to 376 frontend form inputs missing validation | enhancement, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 274 | Remove duplicate code in handlers-deferred.js and add DOM validity guards | enhancement, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 275 | Add page lifecycle cleanup — clear intervals, timeouts, and listeners on navigation | bug, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 276 | Add URL protocol whitelist validation for user-uploaded image rendering | security, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 278 | Add resource limits, Redis eviction policy, and health checks to docker-compose.yml | enhancement, devops | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 279 | Add Redis graceful shutdown and listener cleanup | bug, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 280 | Improve CI workflow robustness — startup timeout, syntax check capture, baseline check | enhancement, ci | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 281 | Replace unbounded analytics queue and rate limit maps with bounded data structures | bug, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 282 | Add null checks and localStorage error handling to prevent frontend runtime crashes | bug, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 283 | Validate JWT_SECRET format strength and add rate limiter fallback logging | security, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 284 | Add frontend linting, reduce max-warnings, and add postinstall env validation | enhancement, ci | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 285 | Fix audit log interval duplication and add webhook query timeout with circuit breaker | bug, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 286 | Validate cron expression ranges and bound Set sizes in taskWorker | bug, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 287 | Add browser null-guard in platformSync publish files to prevent crash on launch failure | bug, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 288 | Add unit tests for 5 untested route files — mock-oauth, rateLimitDashboard, calendar, roadmap, receiptParser | enhancement, testing | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 299 | Improve E2E test isolation — add data cleanup, strict locking, and accessibility assertions | enhancement, testing | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 300 | Consolidate PWA manifests and fix broken icon/screenshot references | bug, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 301 | Fix service worker sync race condition, cache eviction logic, and push deduplication | bug, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 302 | Redact PII from request logger — user-agent truncation and query param filtering | security, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 305 | Add preconnect, preload, and PWA meta tags to index.html for performance | enhancement, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 306 | Sanitize BUILD_HASH in sw.js replacement and validate chunk filenames in static serving | security, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 307 | Fix Permissions-Policy camera conflict with AR preview and review COEP setting | security, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 308 | Enhance visual regression tests — pixel-diff, responsive viewports, dark mode variants | enhancement, testing | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 309 | Add post-merge and post-checkout Husky hooks for auto dependency install | enhancement, ci | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 310 | Audit and clean up stale TODO/FIXME/HACK comments across codebase | enhancement, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 320 | Add ON DELETE CASCADE to 10 foreign keys missing cascade behavior | bug, backend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 321 | Enforce cookie consent before setting cookies and add OG/Twitter meta tags | enhancement, frontend | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 322 | Add E2E security integration tests with real CSRF/rate limiting and expand a11y coverage | enhancement, testing | keep | HIGH-PROBABILITY | HIGH-PROBABILITY: still-open engineering work with no contrary repo evidence found during this pass. |
| 369 | auto-create-issue-on-ci-failure: dedup check only scans first 100 open issues — duplicates leak once backlog grows | bug, infrastructure, ci | keep | VERIFIED | VERIFIED: auto-create-issue-on-ci-failure.yml still dedupes by listForRepo(per_page: 100) without pagination/search. |
| 370 | [Backup Failure] Daily database backup — Run #21 | automated, backup-failure | keep | VERIFIED | VERIFIED: Daily Database Backup run #21 failed on 2026-04-12; keep open until a later successful backup is confirmed. |
| 371 | [CI Failure] master - Run #963 | ci-failure, automated | close | VERIFIED | VERIFIED: this automated CI-failure issue is stale; current master CI is green. |

Verified stale/fixed issues in this pass:
- #32 E2E tests permanently disabled in CI (`if: false`)
- #34 `add-to-project.yml` missing `permissions` block — open CodeQL alert
- #36 `trivy.yml` uses version tag not SHA pin — inconsistent with rest of repo
- #40 Monitoring: alert email body empty — alerts silently dropped when ALERT_EMAIL is set
- #41 `/api/health` Redis status hardcoded `false` — inaccurate health reporting
- #371 [CI Failure] master - Run #963

Verified still-live infra/ops issues in this pass:
- #30 P0: `scripts/backup.sh` missing — staging deploy fails on every run
- #31 P0: staging `.env` bootstrap missing `DATABASE_URL` — staging boots without a database
- #35 `semgrep.yml` push trigger misconfigured — source code pushes skip Semgrep scan
- #369 auto-create-issue-on-ci-failure: dedup check only scans first 100 open issues — duplicates leak once backlog grows
- #370 [Backup Failure] Daily database backup — Run #21
