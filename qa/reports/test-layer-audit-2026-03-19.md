# Test Layer Audit — VaultLister 3.0 (Layer 8)
**Date:** 2026-03-19 | **Auditor:** Claude Code (QA Specialist)
**Scope:** `src/tests/`, `e2e/tests/`, `e2e/fixtures/`, `playwright.config.js`, `scripts/run-e2e-chunks.js`

---

## Summary

301 test files in `src/tests/`. 54 E2E spec files in `e2e/tests/`. 8 chunk groups in `run-e2e-chunks.js`. Audit found 29 findings: 3 Critical, 7 High, 12 Medium, 7 Low.

**Critical findings (require action before next CI run):**
- T-01/T-23: `authToken`/`refreshToken` assigned inside test bodies across `auth.test.js` — downstream tests pass vacuously when login fails
- T-02: Same mutable-token anti-pattern in 59 other test files; all downstream create/read/update/delete chains are test-order-dependent
- T-03: Port fallback hardcoded to 3000 or 3001 in 185 test files; `test:unit` server starts on port 3100 — standalone invocations silently hit the wrong server
- T-10: 5 E2E spec files (`ai`, `billing`, `oauth`, `onboarding`, `reports`) absent from all chunk definitions; never execute under `--chunk N` selective re-runs
- T-12: `run-e2e-chunks.js` JSON result parsing reads wrong Playwright schema path — pass/fail summary is always 0/0 or `?`

---

## Findings Table

| ID | File | Line | Severity | Category | Description |
|----|------|------|----------|----------|-------------|
| T-01 | `src/tests/auth.test.js` | 5-6, 35, 125, 193 | Critical | Test Isolation | `authToken` and `refreshToken` are module-level `let` variables assigned inside test bodies, not in `beforeAll`. Four downstream describe blocks (Token Refresh, Get Current User, Update Profile, Change Password) reach `if (!authToken) { console.log('Skipping'); return; }` — no formal skip marker, Bun counts these as passing. Evidence: lines 177, 221, 252, 317, 355, 381. |
| T-02 | `src/tests/` (59 files) | 4-7 | High | Test Isolation | Pattern repeated in 59 test files: `let authToken = null; let testXxxId = null;` at module scope, set inside test bodies. No `test.describe.configure({ mode: 'serial' })` guard. If creation test fails, downstream read/update/delete tests pass vacuously on null ID. |
| T-03 | `src/tests/auth.test.js` + 60 others | 4 | Critical | Hardcoded Port | `BASE_URL` fallback is `3000` in 123 test files or `3001` in 62 test files. `test:unit` launches server on port `3100` via `start-test-bg.ps1`. Standalone `bun test` invocations silently target the wrong server. |
| T-04 | `src/tests/api-docs.test.js` | 5 | Medium | Hardcoded Port | Uses `process.env.TEST_BASE_URL` with `3001` fallback — different env var name from `PORT` used in all other test files. If neither is set, this file targets `3001` while others target `3000`. Two variable names, two port values, neither documented as canonical. |
| T-05 | `e2e/tests/comprehensive-audit-v2.spec.js` + 13 others | 39-243 | High | Flaky Pattern | 325 total `waitForTimeout` calls across E2E suite. Breakdown: `comprehensive-audit-v2` 32, `quinn-v3-inventory-table-audit` 40, `websocket` 32, `gdpr` 27. None are condition-gated. Cause intermittent CI failures on slow runners and inflate total run time. |
| T-06 | `e2e/fixtures/auth.js` | 115, 120 | Medium | Flaky Pattern | `waitForTimeout(300)` and `waitForTimeout(200)` in shared auth fixture overlay-dismiss block, firing for every `authedPage` test. Flakiness compounds across all ~40 E2E tests using the fixture. Replaceable with `waitForSelector` with short timeout. |
| T-07 | `e2e/tests/auth.spec.js` | 145 | Medium | Flaky Pattern | `waitForTimeout(2000)` after form submit with no condition. Should be `waitForURL` or `waitForResponse`. |
| T-08 | `e2e/tests/chrome-extension.spec.js` | 82, 101 | High | Test Isolation | `if (!createdItemId) test.skip(true, ...)` — creation failure silently records downstream tests as skipped not failed. `serial` mode is set correctly at line 31 but skip-on-null-ID means CI reports green when the creation test broke. |
| T-09 | `e2e/tests/offers.spec.js` | 165-426 | High | Test Isolation | `seededOfferId`, `acceptOfferId`, `declineOfferId`, `ruleId` populated in `beforeAll`; 20+ tests skip via `if (!id) test.skip()`. When `beforeAll` fails, all 20 downstream tests silently skip. Same vacuous-pass problem as T-02, in E2E. |
| T-10 | `scripts/run-e2e-chunks.js` | 31-129 | Critical | Coverage Gap | 5 spec files absent from all chunk definitions: `ai.spec.js`, `billing.spec.js`, `oauth.spec.js`, `onboarding.spec.js`, `reports.spec.js`. Runtime fallback at line 138 appends them to the last chunk on full runs only. `--chunk N` selective re-runs never execute them. |
| T-11 | `scripts/run-e2e-chunks.js` | 145, 161 | Medium | Runner Defect | No validation on `--chunk` argument. `--chunk 0` causes `CHUNKS[-1] = undefined`, uncaught TypeError crash. `startIdx` at line 162 is assigned but never read — dead code. |
| T-12 | `scripts/run-e2e-chunks.js` | 207-220 | Medium | Runner Defect | JSON report parsing reads `suites[].specs[]` for pass/fail counts. Playwright JSON schema uses `suites[].specs[].tests[]` for actual test results. Code always counts 0 passed, 0 failed. Catch block substitutes string `?` — the summary table is always `? passed, ? failed`. |
| T-13 | `src/backend/routes/integrations.js` + `settings.js` | — | High | Coverage Gap | Zero test file coverage for `integrations.js` (Google Drive OAuth + backup) and `settings.js` (user account settings). Absent from all 301 test files and from `routes-stub-coverage.test.js`. Security finding B-02 also confirms both routes are missing from auth middleware `protectedPrefixes` — auth and security test coverage both absent. |
| T-14 | `src/tests/mockOAuth.test.js` + 11 others | 17-23 | Medium | Assertion Quality | `expect([200, 404, 500]).toContain(response.status)` — accepting `500` means server crashes pass the test. At least 12 test files accept `500` as a valid outcome. A 500 must be a test failure. |
| T-15 | `src/tests/monitoring.test.js` | 17-28 | Medium | Assertion Quality | `GET /api/monitoring/health` — two tests assert only `expect(res.status).toBe(200)` with no body assertions. Empty body, malformed JSON, or missing fields all pass. Same shallow pattern in `monitoring-expanded.test.js`. |
| T-16 | `src/tests/monitoring.test.js` | 40-55 | Medium | Assertion Quality | `expect([200, 401, 404]).toContain(res.status)` on authenticated routes — accepting `404` means route not registered passes. Used in 8+ monitoring assertions. Cannot distinguish a working route from a missing route. |
| T-17 | `e2e/fixtures/auth.js` | 82-103 | High | Auth Fixture Race | SPA auth guard fires on `DOMContentLoaded` and may redirect to `#login` between `goto` and `store.setState()`. `waitForFunction` for `.sidebar` at line 106 has `.catch(() => {})` silently swallowing the timeout — if auth injection races, the fixture hands off an unauthenticated page to the test with no error. |
| T-18 | `e2e/fixtures/auth.js` | 44 | Low | Hardcoded Port | JSDoc example hardcodes `http://localhost:3001/#inventory`. Documentation-only but misleads developers on the expected port. |
| T-19 | `e2e/tests/chrome-extension.spec.js` | 21 | Medium | Hardcoded Port | `BASE_URL` falls back to `3000`, inconsistent with `playwright.config.js` which reads `.env` and defaults to `3001`. |
| T-20 | `src/tests/arch-async-task-worker.test.js` | 14-56 | Low | Mock Leakage | `mock.module()` calls at module level install db/logger/notification/platformSync mocks. Bun `mock.module()` is process-scoped with no restore API. If this file runs before a file that imports the same modules without its own mocks, stale mocks bleed through. |
| T-21 | `src/tests/helpers/mockDb.js` | 73-92 | Medium | Mock Leakage | `installDbMock()` registers `mock.module()` at two relative paths with no teardown exported. Bun has no `mock.module` restore. Any caller contaminates the module registry for the remainder of the worker process lifetime. |
| T-22 | `src/tests/routes-stub-coverage.test.js` | 484 | Low | Test Naming | Test name `"${route.name} route is registered and reachable"` deviates from project convention `"should [behavior] when [condition]"`. Inconsistent naming across the suite with no enforced standard. |
| T-23 | `src/tests/auth.test.js` | 175-216 | High | Test Isolation | `Auth - Token Refresh` describe depends on `refreshToken` set by the login test in a prior describe. `if (!refreshToken) { console.log('Skipping'); return; }` — Bun counts this as a passing test. Same vacuous-pass pattern as T-01. |
| T-24 | `e2e/tests/ebay-integration.spec.js` | 150-151 | Medium | Skipped Tests | `test.skip()` fires when `ebayIsConnected && !testListingId` — should skip only on `!testListingId`. Live eBay connection with no test listing silently skips the publish test rather than failing. |
| T-25 | `e2e/tests/billing.spec.js` | 158 | Medium | Skipped Tests | `if (originalTier === 'starter') test.skip()` — demo account tier is uncontrolled in CI. Billing upgrade path may never execute. No env guard or documented workaround. |
| T-26 | `src/tests/api-docs.test.js` | 62-67 | Medium | Assertion Quality | Counts YAML path lines by regex match, not YAML parsing. 300 duplicate or malformed entries would pass. No schema validation of the OpenAPI document structure. |
| T-27 | `playwright.config.js` | 29-31 | Low | CI Config | `run-e2e-chunks.js` forces `--retries=1` via CLI arg. Direct `npx playwright test` uses config `retries: 2` in CI. Retry counts differ between `test:e2e` (chunk runner) and `test:all` (direct Playwright). Stability metrics are inconsistent between invocation paths. |
| T-28 | `src/tests/` (suite-level) | — | Low | Coverage Model | Triple-file coverage for connection pool (`db-connectionPool.test.js`, `db-connectionPool-coverage.test.js`, `db-connectionPool-unit.test.js`), quadruple-file for monitoring. `z-` prefix files are undocumented gap-fillers. No canonical ownership map — counts may be double-credited in coverage metrics. |
| T-29 | `e2e/global-setup.js` | 4-9 | Low | E2E Setup | `acquireTestLock()` proceeds on lock failure with warning only. Concurrent Playwright processes share the same test server and DB state. No documented CI enforcement against concurrent E2E runs. |

---

## Routes with Zero Test File Coverage

| Route File | Route Path | Notes |
|------------|-----------|-------|
| `src/backend/routes/integrations.js` | `/api/integrations` | Google Drive OAuth + backup; absent from all 301 test files and `routes-stub-coverage.test.js`; also missing from auth `protectedPrefixes` (security finding B-02) |
| `src/backend/routes/settings.js` | `/api/settings` | User account settings; absent from all 301 test files and `routes-stub-coverage.test.js`; also missing from auth `protectedPrefixes` (security finding B-02) |

All 63 other route files have at least one matching test file by name. Match confirms file existence only, not endpoint coverage depth.

---

## E2E Spec Files Not Covered by Any Chunk Definition

| Spec File | Domain |
|-----------|--------|
| `ai.spec.js` | AI listing generation |
| `billing.spec.js` | Subscription billing |
| `oauth.spec.js` | OAuth platform connections |
| `onboarding.spec.js` | User onboarding flow |
| `reports.spec.js` | Reports generation |

These execute via the runtime fallback (appended to last chunk) on full runs only. Never executed by `--chunk N` selective re-runs.

---

## Verified Evidence

All findings are based on direct source file reads during this audit session. No inference from filenames alone.

- Port fallback inconsistency: verified `auth.test.js:4`, `api-docs.test.js:5`, `package.json test:setup`, `package.json dev:test-bg`
- `waitForTimeout` count 325: verified by grep across all 54 E2E spec files
- T-10 chunk exclusions: verified by cross-referencing `readdirSync` output against chunk `files` arrays in `run-e2e-chunks.js:31-129`
- T-12 JSON parsing bug: verified by comparing Playwright JSON report schema against code at lines 207-220
- T-13 zero-coverage routes: verified by exhaustive Node.js name-match script across all 301 test files
- T-17 auth fixture race: verified by sequential read of `auth.js:73-110` including `.catch(() => {})` at line 109
- T-20/T-21 mock leakage: verified by reading `arch-async-task-worker.test.js:14-56` and `mockDb.js:73-92`; Bun `mock.module()` has no restore API per Bun documentation

---

## Recommended Fixes (Priority Order)

1. **T-10** — Add `ai.spec.js`, `billing.spec.js`, `oauth.spec.js`, `onboarding.spec.js`, `reports.spec.js` to chunk definitions in `run-e2e-chunks.js` before next CI run
2. **T-12** — Fix JSON result parsing: iterate `suites[].specs[].tests[]` not `suites[].specs[]`
3. **T-03** — Standardize all unit test `BASE_URL` fallback to port `3100` to match `test:unit` server startup
4. **T-01/T-02/T-23** — Move token/ID setup into `beforeAll`; add `test.describe.configure({ mode: 'serial' })`; replace silent `if (!token) return` with `test.skip()` or `expect(token).toBeTruthy()`
5. **T-13** — Write `src/tests/integrations.test.js` and `src/tests/settings.test.js` covering auth guard, basic CRUD, and CSRF
6. **T-17** — Remove `.catch(() => {})` on `waitForFunction` in auth fixture; add explicit auth state assertion after injection
7. **T-11** — Add bounds check on `--chunk` argument before `CHUNKS` array access
8. **T-14/T-16** — Remove `500` and `404` from acceptable status arrays; server errors and missing routes must fail tests
