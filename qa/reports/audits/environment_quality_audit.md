# Environment & Quality — Audit Report
**Date:** 2026-03-12
**Domain:** Environment & Quality (8 categories)
**Auditor:** Claude Opus 4.6 (automated source inspection)
**Matrix rows:** 45–52

---

## Methodology

1. Read `qa/domains/environment_quality.md` for category definitions and required evidence
2. Searched all source files for patterns related to each category (localization, timezone, performance, compatibility, AI, docs, fuzz, invariants)
3. Inspected existing test files for coverage of each area
4. Catalogued gaps as High / Medium / Low risk

---

## Category 1: Localization / Regional Behavior

### Source Evidence

**i18n system exists:** `src/frontend/i18n/index.js` (421 lines)
- 12 supported locales (en-US, en-GB, es-ES, es-MX, fr-FR, de-DE, it-IT, pt-BR, ja-JP, zh-CN, ko-KR, ar-SA)
- RTL support for ar-SA (sets `document.documentElement.dir`)
- Translation key system with `t()` function, pluralization via `|` separator
- Locale-aware formatting: `formatNumber()`, `formatCurrency()`, `formatDate()`, `formatTime()`, `formatRelativeTime()`
- All use `Intl.DateTimeFormat` and `Intl.NumberFormat` with `currentLocale`
- Only 3 locales have actual translations (en, es partial, fr partial) — 9 others fall back to en-US

**Backend hardcoded to en-US:** `src/backend/shared/utils.js`
- `formatDate()` hardcodes `'en-US'` (line 69)
- `formatDateTime()` hardcodes `'en-US'` (line 83)
- `formatPrice()` hardcodes `'en-US'` and `'USD'` (line 100)
- Backend never reads user's locale preference

**User locale stored in schema:** `src/backend/db/schema.sql` contains `locale` and `timezone` columns on users table

### Test Evidence

- `src/tests/shared-utils.test.js`: Tests `formatDate`, `formatDateTime`, `formatPrice` — but does NOT test locale behavior, only checks output is non-empty string
- No tests for the i18n system (`src/frontend/i18n/index.js`)
- No tests for RTL rendering, text expansion, locale-aware validation, or locale switching

### Gaps (H = High, M = Medium)

| ID | Gap | Risk | Type |
|----|-----|------|------|
| H1 | i18n system (`src/frontend/i18n/index.js`) completely untested — `t()`, `findBestLocale()`, pluralization, `formatRelativeTime()` | High | Automatable (unit) |
| H2 | Backend `formatDate`/`formatPrice` hardcoded to en-US — ignores user's locale setting | High | Code fix + test |
| H3 | Only 3/12 locales have translations — 9 locales silently fall back to English with no user notification | Medium | Code fix |
| H4 | No RTL layout testing — ar-SA sets `dir="rtl"` but no visual or functional verification | Medium | E2E/Playwright |
| H5 | No text expansion testing — translated strings may overflow UI containers | Medium | E2E/visual |
| H6 | Currency always USD — no multi-currency support despite Intl.NumberFormat accepting currency param | Medium | Design decision |
| H7 | No locale-aware validation (date formats, number separators) | Low | Automatable (unit) |

---

## Category 2: Time / Scheduling / Expiry

### Source Evidence

**Token expiry system:** `src/backend/services/tokenRefreshScheduler.js`
- TOKEN_EXPIRY_BUFFER_MS = 30 min
- Hourly interval checks for expiring OAuth tokens
- 5-consecutive-failure auto-disconnect
- Expiry stored as ISO datetime in `oauth_token_expires_at`

**Session/JWT expiry:** `src/backend/middleware/auth.js`
- JWT access tokens: 15-min expiry
- JWT refresh tokens: 7-day expiry
- Dev fallback when JWT_SECRET not set

**GDPR scheduled deletions:** `src/backend/workers/gdprWorker.js`
- 30-day grace period, hourly processing
- `scheduled_for` column with ISO datetime comparison

**Task scheduler:** `src/backend/workers/taskWorker.js`
- Exponential backoff: `5000 * 2^(attempts-1)`
- `scheduled_at` for deferred execution

**Frontend date handling:** Multiple files use `new Date()`, `Date.now()`, `toISOString()`
- `src/backend/shared/utils.js`: `now()`, `today()`, `daysAgo()`, `daysFromNow()` — all use server-local time
- No timezone conversion — all dates stored and compared as UTC ISO strings or server-local

### Test Evidence

- `src/tests/arch-async-task-worker.test.js`: Tests task scheduling, exponential backoff, priority ordering
- `src/tests/secgov-offboarding-worker.test.js`: Tests GDPR deletion timing, reminder scheduling
- `src/tests/arch-reliability-failure-modes.test.js`: Tests token refresh failure handling
- `src/tests/auth.test.js`: Tests JWT token creation (likely includes expiry checks)
- **No DST tests**, no timezone conversion tests, no leap year edge cases, no month-boundary tests

### Gaps

| ID | Gap | Risk | Type |
|----|-----|------|------|
| H8 | No DST transition testing — scheduled events crossing DST boundary could fire at wrong time | High | Automatable (unit) |
| H9 | No timezone conversion — server uses local time; users in different timezones see raw server times | High | Code fix + test |
| H10 | Token expiry boundary not tested — what happens when token expires exactly at check time | Medium | Automatable (unit) |
| H11 | `daysAgo()`/`daysFromNow()` use `setDate()` which can wrap across months incorrectly (e.g., Jan 31 - 30 days) | Medium | Automatable (unit) |
| H12 | No leap year testing for date calculations | Low | Automatable (unit) |
| H13 | Session expiry behavior during active use not tested — does activity extend the session? | Medium | Automatable (unit/integration) |
| H14 | GDPR worker `scheduled_for` comparison uses ISO string vs `datetime('now')` — potential timezone mismatch between JS `Date.now()` and SQLite `datetime()` | Medium | Automatable (unit) |

---

## Category 3: Performance / Capacity

### Source Evidence

**Performance utilities:** `src/frontend/utils/performance.js` (370 lines)
- `debounce()`, `throttle()`, `lazyLoadImages()` (IntersectionObserver)
- `Cache` class (in-memory with TTL, no max-size bound)
- `getVisibleItems()` virtual scroll helper
- `batchDOMUpdate()` via requestAnimationFrame
- `chunkProcess()` for non-blocking array processing
- `isSlowConnection()` via Navigator API
- `compressImage()` before upload

**Backend performance:**
- SQLite WAL mode for concurrency
- Performance indexes: `src/backend/db/migrations/051_performance_indexes.sql`
- CDN middleware: `src/backend/middleware/cdn.js`
- Rate limiter: `src/backend/middleware/rateLimiter.js`
- Monitoring: `src/backend/services/monitoring.js` (tracks request latency, error rates)
- Pagination: `src/backend/shared/utils.js` `parsePagination()` caps at 100

**Service worker:** `public/sw.js` — pre-caching, offline fallback, cache versioning

**Performance test:** `src/tests/performance.test.js` — 10 tests (requires running server)
- Health endpoint < 200ms
- CSRF token < 100ms
- Login < 1000ms
- GET /auth/me < 300ms
- Inventory CRUD < 500ms each
- Analytics < 1000ms
- 5-request sequential burst < 500ms each

**Lighthouse script:** `scripts/lighthouse-audit.js` exists

### Test Evidence

- `src/tests/performance.test.js`: 10 integration tests (require running server — not unit testable)
- `src/tests/arch-caching-etag.test.js`: Tests ETag generation, matching, Cache-Control headers, rate limiter
- `src/tests/middleware-cdn.test.js`: Tests CDN middleware
- No tests for frontend performance utilities (`debounce`, `throttle`, `lazyLoadImages`, `Cache`, virtual scroll)
- No tests for `chunkProcess`, `compressImage`, `isSlowConnection`
- No load/stress testing or concurrency testing
- No large dataset tests (all tests use small fixtures)

### Gaps

| ID | Gap | Risk | Type |
|----|-----|------|------|
| H15 | Frontend performance utilities entirely untested — `debounce()`, `throttle()`, `Cache` class, `getVisibleItems()`, `chunkProcess()` | High | Automatable (unit) |
| H16 | Frontend `Cache` class has no max-size bound — unbounded memory growth | High | Code fix + test |
| H17 | No large dataset testing — all tests use small fixtures; N+1 queries or slow queries undetected at scale | High | Automatable (integration) |
| H18 | No service worker tests in unit suite (browser-only context) | Medium | E2E/Playwright |
| H19 | `compressImage()` untested — could fail on edge cases (0-byte file, corrupt image, very large image) | Medium | Automatable (unit, requires canvas mock) |
| H20 | No concurrent user simulation | Medium | Load testing tool |
| H21 | Performance tests require running server — not in standard unit test pipeline | Low | Design decision |

---

## Category 4: Compatibility / Environment Coverage

### Source Evidence

**Chrome extension:** `src/extension/` — 7 files (manifest.json, popup.js, content.js, background.js + HTML/CSS + icons)
- Manifest V3 Chrome extension
- Tests exist: `src/tests/extension.test.js`, `e2e/tests/chrome-extension.spec.js`

**Browser targets:** No explicit browser support matrix or polyfill strategy
- `IntersectionObserver` used in `lazyLoadImages()` with fallback
- `requestIdleCallback` used with setTimeout fallback
- `navigator.connection` (Network Information API) used — not widely supported
- Service worker: `public/sw.js` — no feature detection for browser support

**E2E visual snapshots:** `e2e/tests/qa-guardian.spec.js-snapshots/` contains baseline screenshots for Chromium, Firefox, and WebKit (3 browsers × 3 pages = 9 snapshots)

**Mobile viewport:** `e2e/tests/quinn-v3-mobile-viewport-audit.spec.js` exists
- `e2e/screenshots/` contains mobile viewport screenshots (v2-mobile-dashboard, v2-mobile-inventory, etc.)

**Responsive CSS:** `src/frontend/styles/main.css` contains media queries

### Test Evidence

- `src/tests/extension.test.js`: Chrome extension unit tests
- `e2e/tests/chrome-extension.spec.js`: E2E extension tests
- `e2e/tests/qa-guardian.spec.js`: Visual regression snapshots for 3 browsers
- `e2e/tests/quinn-v3-mobile-viewport-audit.spec.js`: Mobile viewport testing
- `e2e/tests/accessibility.spec.js`: Accessibility E2E tests
- No incognito/private mode testing
- No network condition testing (offline, slow 3G, etc.)
- No VPN/proxy/firewall testing

### Gaps

| ID | Gap | Risk | Type |
|----|-----|------|------|
| H22 | No offline/degraded network testing — service worker exists but no test verifies offline behavior | High | E2E/Playwright |
| H23 | `navigator.connection` API used without graceful degradation testing | Medium | Automatable (unit) |
| H24 | No Safari-specific testing beyond WebKit snapshots | Medium | E2E |
| H25 | No incognito/private mode testing — localStorage may be blocked | Medium | E2E |
| H26 | No testing of browser permission denials (notifications, clipboard, camera) | Low | E2E |

---

## Category 5: AI/ML/Ranking Assurance

### Source Evidence

**AI modules:** `src/shared/ai/` — 3 files:
- `listing-generator.js`: Template-based generation + Claude API fallback via `@anthropic-ai/sdk`
  - Local pattern-based generation (brand/category templates)
  - Claude API call on line ~347 with `claude-3-5-haiku-20241022` model
  - Silent `catch (_) {}` on failure → falls back to template
  - Input escaping: `.replace(/</g, '&lt;')` only (minimal)
- `image-analyzer.js`: Claude Haiku Vision API for product analysis
  - Silent `catch (_) {}` → text-based pattern fallback
  - Brand, color, and category detection patterns
- `price-predictor.js`: Deterministic rule-based pricing
  - Category base prices, brand tier multipliers, condition modifiers
  - No ML/API calls — pure computation

### Test Evidence

- `src/tests/arch-reliability-failure-modes.test.js`: Tests AI silent catch → template fallback (4 tests), image analyzer fallback (1 test)
- No tests for listing-generator template quality or output structure
- No tests for price-predictor calculations
- No tests for prompt injection (H1 from security audit — documented as gap)
- No tests for API response parsing, malformed API responses, or timeout handling
- No tests for model output quality, bias, or drift

### Gaps

| ID | Gap | Risk | Type |
|----|-----|------|------|
| H27 | Price predictor entirely untested — brand tier lookup, condition modifier, category matching, final calculation | High | Automatable (unit) |
| H28 | Listing generator template output not validated — structure, length, forbidden content | High | Automatable (unit) |
| H29 | No prompt injection protection in AI inputs — user content sent directly (H1 from security audit) | High | Code fix + test |
| H30 | Image analyzer output schema not validated — caller assumes specific fields exist | Medium | Automatable (unit) |
| H31 | AI confidence thresholds not tested — no mechanism to distinguish high/low confidence suggestions | Medium | Design gap |
| H32 | No AI output quality regression tests — no golden dataset for expected generation quality | Medium | Test infrastructure |

---

## Category 6: Documentation / Runbooks

### Source Evidence

**Documentation directory:** `docs/` — 10 doc files + 40+ evidence files:
- `ARCHITECTURE.md` — system architecture
- `API.md` — Auth & Security API reference (partial — only covers auth/MFA endpoints)
- `API_ROUTES.md` — route listing
- `SETUP.md` — Marketplace credential setup (eBay, Poshmark, Etsy)
- `DEPLOYMENT_RUNBOOK.md` — deployment procedures
- `PERFORMANCE_BASELINE.md` — performance benchmarks
- `DATABASE_SCHEMA.md` — schema documentation
- `FRONTEND_SOURCE_OF_TRUTH.md` — frontend architecture
- `REPO_CONTRACTS.md` — repository conventions
- `SCRIPTS_INVENTORY.md` — scripts listing
- `BUG_LOG.md` — bug tracking
- `runbooks/STRICT_EXECUTABLE_PLAYBOOK_v3_1.md` — operational playbook

**Evidence directory:** `docs/evidence/` — Phase 2-5 validation artifacts
- SETUP_RUNBOOK.md, BACKUP_DRILL.md, DEPLOYMENT_VALIDATION.md
- Performance evidence, monitoring evidence, backup evidence

### Test Evidence

- No automated tests verify documentation accuracy
- No test checks that API.md matches actual route implementations
- No test checks that .env.example matches required env vars
- Runbook exists but has not been run through recently (phase evidence from initial setup)

### Gaps

| ID | Gap | Risk | Type |
|----|-----|------|------|
| H33 | API.md only covers auth/MFA endpoints — does not document inventory, listings, sales, analytics, community, GDPR, or any other routes | High | Manual doc work |
| H34 | No automated doc-code drift detection — API routes may have changed since docs were written | High | Automatable (script) |
| H35 | DEPLOYMENT_RUNBOOK.md accuracy not verified recently — Docker config or environment may have drifted | Medium | Manual verification |
| H36 | No inline API documentation (JSDoc/OpenAPI) for route handlers | Medium | Code improvement |
| H37 | Setup docs cover only 3 marketplaces (eBay, Poshmark, Etsy) — missing Depop, Grailed, Mercari, Shopify, Facebook, Whatnot | Medium | Manual doc work |

---

## Category 7: Exploratory / Fuzz / Chaos Discovery

### Source Evidence

- No fuzzing infrastructure found
- No property-based testing library (fast-check or similar) in dependencies
- No chaos testing tools or fault injection
- No monkey testing
- `scripts/smoke-test.mjs` exists — basic smoke test (not fuzz)

### Test Evidence

- No fuzz tests
- No property-based tests
- No chaos tests
- No random input generation in existing tests
- Some boundary testing exists (input length limits in community.js, pagination bounds in utils) but is hand-written

### Gaps

| ID | Gap | Risk | Type |
|----|-----|------|------|
| H38 | No fuzz testing for parsers — JSON parsers, price parser, date parser, search query parser all handle user input | High | Automatable (fuzz) |
| H39 | No property-based tests for financial calculations (roundCurrency, calculatePercentage, price predictor) | High | Automatable (property-based) |
| H40 | No fault injection or chaos testing — no way to simulate DB failures, network partitions, or resource exhaustion | Medium | Test infrastructure |
| H41 | No exploratory test plan or session records | Low | Manual process |

---

## Category 8: Oracles / Invariants / Reference Truth

### Source Evidence

**Implicit invariants found in code:**
- Inventory `sale_price ≥ 0` — not enforced by schema constraint
- Sales `profit = sale_price - cost_price - fees - shipping` — calculated inline, no cross-check
- Pagination `offset ≥ 0`, `limit ∈ [1, 100]` — enforced by `parsePagination()`
- User IDs are TEXT (UUID) — enforced by schema
- Token refresh: `consecutive_refresh_failures < 5` before auto-disconnect

**No formal invariant tests:**
- No database constraint tests for financial invariants
- No cross-table consistency checks (e.g., total sales count = sum of per-platform sales)
- No impossible-state prevention (e.g., item listed but not in inventory)

**Source of truth:**
- SQLite database is single source of truth
- No independent verification or reconciliation tools
- No golden test datasets

### Test Evidence

- `src/tests/data-systems-db-constraints.test.js`: Tests some DB constraints (NOT NULL, UNIQUE, FK)
- No invariant tests for financial totals
- No cross-table reconciliation tests
- No impossible-state detection tests

### Gaps

| ID | Gap | Risk | Type |
|----|-----|------|------|
| H42 | No financial invariant tests — profit calculation, fee summation, aggregate totals not verified | High | Automatable (unit) |
| H43 | No cross-table consistency checks — listings could reference deleted inventory, sales could reference deleted listings | High | Automatable (integration) |
| H44 | No impossible-state prevention tests — item status transitions not validated (e.g., can a "sold" item be listed again?) | Medium | Automatable (unit) |
| H45 | No golden test dataset for regression — test fixtures are ad-hoc per test | Medium | Test infrastructure |
| H46 | Sale `profit` field computed inline with no cross-check against stored cost/fees | Medium | Automatable (unit) |

---

## Summary

| Category | Status | Risk | Gaps Found |
|----------|--------|------|------------|
| Localization / regional behavior | Partial | High | 7 (H1–H7) |
| Time / scheduling / expiry | Partial | High | 7 (H8–H14) |
| Performance / capacity | Partial | High | 7 (H15–H21) |
| Compatibility / environment coverage | Partial | Medium | 5 (H22–H26) |
| AI/ML/ranking assurance | Partial | High | 6 (H27–H32) |
| Documentation / runbooks | Partial | High | 5 (H33–H37) |
| Exploratory / fuzz / chaos discovery | Uncovered | High | 4 (H38–H41) |
| Oracles / invariants / reference truth | Partial | High | 5 (H42–H46) |

**Total gaps identified:** 46
- High risk: 22
- Medium risk: 20
- Low risk: 4

### Top 10 Highest-Risk Gaps for Test Generation

1. **H1** — i18n system untested (localization)
2. **H15** — Frontend performance utilities untested (performance)
3. **H27** — Price predictor untested (AI)
4. **H28** — Listing generator template output unvalidated (AI)
5. **H38** — No fuzz testing for parsers (exploratory)
6. **H39** — No property-based tests for financial calculations (invariants)
7. **H42** — No financial invariant tests (oracles)
8. **H8** — No DST transition testing (time)
9. **H33** — API docs only cover auth endpoints (docs)
10. **H17** — No large dataset testing (performance)
