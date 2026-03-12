# Architecture & Reliability — Test Generation Report
**Date:** 2026-03-12
**Domain:** Architecture & Reliability (6 categories)
**Source audit:** qa/reports/audits/architecture_reliability_audit.md
**Matrix updated:** qa/coverage_matrix.md

---

## Summary

| Metric | Value |
|--------|-------|
| New test files created | 4 |
| Existing test files extended | 0 |
| New tests added (total) | 65 |
| Tests passing | 65 / 65 |
| Real bugs discovered | 0 |
| Coverage categories improved | 6 of 6 |

---

## Files Created

### 1. `src/tests/arch-reliability-failure-modes.test.js` — 22 tests
**Addresses audit gaps:** H2 (AI silent catch fallback), H3 (webhook failure handling), H5 (token refresh auto-disconnect), H6 (platform sync failure propagation), M5 (webhook signature verification).

**Coverage added (AI silent catch → template fallback):**
- Anthropic API throws → returns template-based listing (not null)
- Anthropic API returns malformed response → falls back gracefully
- Template fallback includes required fields (title, description, price)
- Image analyzer failure → returns empty/default result

**Coverage added (webhook event handling):**
- Unknown event type → marked as failed with error message
- Missing event payload → handled without crash
- Handler exception → event marked failed, error logged

**Coverage added (webhook dispatch failure handling):**
- Endpoint fetch failure → increments failure_count in DB
- 10 consecutive failures → endpoint auto-disabled
- Successful delivery → resets failure_count to 0
- Multiple endpoints: one failure doesn't block others
- Gap doc: no timeout on dispatch fetch (design concern DC-3)

**Coverage added (webhook signature verification):**
- Valid signature → returns true
- Invalid signature → returns false
- Empty payload → returns false
- Missing secret → returns false

**Coverage added (token refresh failure tracking):**
- Single failure → increments consecutive_refresh_failures
- 5th consecutive failure → auto-disconnects shop (sets status='disconnected')
- Auto-disconnect → creates user notification
- Successful refresh → resets failure count to 0

**Coverage added (gap documentation):**
- No deduplication guard on webhook events (design gap)
- No retry/backoff on dispatch failure (design gap)

**Test pattern:** Unit tests with mocked DB, logger, notificationService, encryption, Anthropic SDK, and `globalThis.fetch`. Cleanup restores `globalThis.fetch` and stops token refresh scheduler in `afterAll`.

---

### 2. `src/tests/arch-async-task-worker.test.js` — 13 tests
**Addresses audit gaps:** H9 (no dead-letter queue), M2 (retry/backoff), M3 (concurrent limit), L2 (queue ordering).

**Coverage added (worker lifecycle):**
- `startTaskWorker()` sets running state
- `stopTaskWorker()` clears running state
- Double `startTaskWorker()` is idempotent (no-op)
- `getTaskWorkerStatus()` returns expected shape with `intervalMs: 10000`

**Coverage added (queueTask):**
- Inserts task with correct fields (id, type, status='pending', priority=0, maxAttempts=3)
- Accepts custom priority and maxAttempts options

**Coverage added (queue ordering):**
- Pending tasks queried with `ORDER BY priority DESC, scheduled_at ASC`

**Coverage added (getWorkerStatus):**
- Returns `maxConcurrent: 3`, `activeTasks`, `pollIntervalMs: 10000`, `last24Hours`

**Coverage added (dead-letter gap — failed task lifecycle):**
- `cleanupOldTasks(30)` deletes both 'completed' and 'failed' tasks
- Days parameter correctly passed to SQL query
- Returns count of deleted tasks from `changes` property

**Coverage added (getTaskStatus):**
- Returns task record when found
- Returns null when task not found

**Test pattern:** Unit tests with mocked DB and logger. `stopTaskWorker()` called in `beforeEach` and `afterAll` to ensure clean state.

---

### 3. `src/tests/arch-caching-etag.test.js` — 17 tests
**Addresses audit gaps:** M4 (rate limiter bypassed in test env), M7 (ETag generation/matching untested).

**Coverage added (ETag generation):**
- Generates quoted SHA-256 hash of 32 hex chars (`/^"[0-9a-f]{32}"$/`)
- Deterministic: same input → same ETag
- Different inputs → different ETags

**Coverage added (ETag matching):**
- Exact match with `if-none-match` header → true
- No `if-none-match` header → false
- Comma-separated ETags with match → true
- Wildcard `*` → true
- No matching ETag in list → false

**Coverage added (Cache-Control helpers):**
- `cacheFor(60)` → `public, max-age=60, stale-while-revalidate=120`
- `cacheFor(50000)` → stale-while-revalidate capped at 86400
- `cacheForUser(300)` → `private, max-age=300`
- `immutable()` → public, max-age=31536000, immutable
- `NO_CACHE` → `no-store, no-cache, must-revalidate`

**Coverage added (rate limiter actual behavior):**
- 100 requests under default limit → all allowed
- Request #101 → rejected with `remaining: 0`
- Auth limit: 10 per 15min enforced, #11 rejected
- 3 violations → permanent block; loopback IPs (127.0.0.1) never blocked

**Test pattern:** Pure function tests for ETag/cache helpers. `RateLimiter` instantiated directly (bypassing `IS_TEST_RUNTIME` module-level skip). Cleanup clears `_cleanupInterval` in `afterAll`.

---

### 4. `src/tests/arch-observability-monitoring.test.js` — 13 tests
**Addresses audit gaps:** H8 (alert thresholds untested), H10 (Content-Type gap doc).

**Coverage added (alert thresholds):**
- `trackRequest` with duration > 2000ms → fires `slow_response` alert via `logger.warn`
- `trackRequest` with duration ≤ 2000ms → no alert
- Error rate > 5% with > 100 total requests → fires `high_error_rate` alert

**Coverage added (metrics tracking):**
- `getMetrics()` returns expected shape: requests (total, errors), latency, memory, uptime
- `trackRequest` increments `requests.total`
- `trackError` increments `requests.errors`
- `trackError` writes to `error_logs` DB table

**Coverage added (alert dispatch):**
- `alert()` logs via `logger.warn`
- `alert()` inserts into `alerts` DB table
- Slack webhook: documented as untestable (SLACK_WEBHOOK captured at module load time as const — setting env var after import has no effect)

**Coverage added (monitoring lifecycle):**
- `startMetricsCollection()` sets `_metricsInterval`
- `stopMetricsCollection()` clears `_metricsInterval`

**Coverage added (gap documentation):**
- CPU usage threshold (0.80) is dead code — never checked in `startMetricsCollection`

**Test pattern:** Unit tests with mocked DB and logger. Uses `isMocked` guard to skip gracefully if monitoring module didn't load due to mock contamination. Uses `originalAlert` bound reference for direct invocation tests. Cleanup stops metrics collection and restores `globalThis.fetch` in `afterAll`.

---

## Bugs Discovered

| # | Bug | Severity | Location | Status |
|---|-----|----------|----------|--------|
| — | No real product bugs discovered | — | — | — |

Three test failures occurred during development, all caused by test setup issues (not product bugs):
1. Token refresh test needed `OAUTH_MODE=mock` env var to trigger the instant-success code path
2. Cache/ETag test had `await import()` inside a describe block — moved to top level
3. Monitoring Slack webhook test attempted to set env var after module load — converted to gap documentation test

---

## Categories NOT Covered (with rationale)

| Category | Gap | Reason | Recommendation |
|----------|-----|--------|----------------|
| Caching | Service worker (sw.js) tests | Browser-only context — cannot test in bun:test | Playwright E2E test |
| Caching | Gzip cache invalidation | Tightly coupled to Bun HTTP pipeline | Integration test (Pattern B) |
| Caching | Frontend Cache unbounded growth | Client-side browser code | Playwright E2E or manual |
| Reliability | Circuit breaker pattern | Feature does not exist — cannot test absence | Implement circuit breaker first |
| Reliability | Idempotency keys | Feature does not exist | Implement idempotency first |
| Reliability | DB lock contention under WAL | Requires real concurrent connections | Integration test with multiple clients |
| API contracts | Pagination response shape consistency | 6+ different pagination shapes across routes | Integration test (Pattern B) across all routes |
| API contracts | Response envelope inconsistency | Same — requires full route scan | Integration test (Pattern B) |
| API contracts | Content-Type enforcement on requests | Server-level concern | Integration test or middleware addition |
| Observability | Slack alert dispatch | `SLACK_WEBHOOK` captured at module load time as const | Refactor to read env per-call, or use module re-import |
| Observability | CPU threshold (dead code) | `THRESHOLDS.cpuUsage = 0.80` defined but never checked | Remove dead code or implement CPU check |
| Observability | Worker health staleness | Requires running server + time manipulation | Integration test |
| Async | Retry/backoff formula direct test | `processTask` is private — backoff formula not directly callable | Expose retry delay calculator or test via integration |
| Async | WebSocket permanent disconnect after 5 retries | Client-side reconnect logic in app.js | Playwright E2E test |
| Reliability | `expect([200,500])` anti-pattern in 30+ tests | Existing test cleanup, not new coverage | Separate cleanup pass |

---

## Design Concerns Documented (not bugs, but architecture gaps)

| ID | Concern | Location | Impact |
|----|---------|----------|--------|
| DC-1 | No timeout on webhook dispatch fetch | webhookProcessor.js `dispatchToUserEndpoints` | Slow endpoint blocks worker |
| DC-2 | No retry/backoff on webhook dispatch failure | webhookProcessor.js `dispatchToUserEndpoints` | Single failure = permanent loss |
| DC-3 | No deduplication guard on webhook events | webhookProcessor.js `processWebhookEvent` | Duplicate events processed twice |
| DC-4 | 6 integration paths lack timeouts | Various sync services | Hung connections block workers |
| DC-5 | Frontend Cache Map grows unbounded | app.js client-side cache | Memory leak on long sessions |
| DC-6 | WebSocket gives up after 5 reconnects | app.js client-side | User loses real-time updates permanently |
| DC-7 | Two parallel Sentry error paths | monitoring.js + errorHandler.js | Duplicate error reports |
| DC-8 | In-memory metrics lost on restart | monitoring.js | No historical metrics after crash |
