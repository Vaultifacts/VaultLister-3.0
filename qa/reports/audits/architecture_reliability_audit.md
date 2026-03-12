# Architecture & Reliability — Audit Report
**Date:** 2026-03-12
**Domain:** Architecture & Reliability (6 categories)
**Auditor:** Claude Code (automated)
**Source taxonomy:** qa/domains/architecture_reliability.md, qa/full_testing_taxonomy.md

---

## Summary

| Metric | Value |
|--------|-------|
| Categories audited | 6 |
| High-risk gaps found | 12 |
| Medium-risk gaps found | 9 |
| Low-risk gaps found | 5 |
| Real bugs discovered | 0 |
| Design concerns documented | 6 |

---

## Design Concerns Discovered During Audit

### DC-1: Zod validation middleware exists but is unused
**Severity:** Medium
**Location:** `src/backend/middleware/validate.js`
**Impact:** A full Zod-based request validation middleware exists and is imported nowhere. All routes do ad-hoc field checks instead, leading to inconsistent error shapes and missing validation on some endpoints.
**Recommendation:** Wire `validate.js` into routes incrementally, starting with high-traffic endpoints (inventory, listings, sales).

### DC-2: Silent error swallowing in AI integrations
**Severity:** High
**Location:** `src/shared/ai/` — multiple files
**Impact:** AI service calls use `catch (_) {}` patterns that silently discard errors. Failures in listing generation or chatbot responses produce no log entry, no metric, and no user feedback — the request simply returns empty/default data.
**Recommendation:** Add structured error logging in catch blocks; surface user-facing error state.

### DC-3: No timeouts on 6 external integration paths
**Severity:** High
**Location:** Anthropic SDK calls, OAuth refresh fetch, platform sync fetch (6 services), Notion SDK, Slack webhook
**Impact:** A hung external service blocks the request indefinitely. No AbortController or timeout wrapper on these paths.
**Recommendation:** Add AbortController with timeout to all external fetch calls. Outgoing webhooks already implement this pattern (30s timeout) and can serve as the template.

### DC-4: Duplicate health endpoints with different response shapes
**Severity:** Low
**Location:** `src/backend/server.js` (`/api/health`) and `src/backend/routes/monitoring.js` (`/api/monitoring/health`)
**Impact:** Monitoring tools may hit different endpoints and get incompatible response shapes. The server.js version returns `{ status, timestamp, uptime }` while monitoring.js returns a richer shape with memory/cpu/db checks.
**Recommendation:** Deprecate the simple `/api/health` endpoint; alias it to the monitoring version.

### DC-5: Frontend Cache class has no size limit
**Severity:** Medium
**Location:** `src/frontend/app.js` — Cache class
**Impact:** Long-running browser sessions accumulate unbounded cache entries. No TTL eviction, no max-size cap. Could cause memory issues on devices with limited RAM.
**Recommendation:** Add LRU eviction or max-entry cap to the Cache class.

### DC-6: WebSocket client gives up permanently after 5 reconnect attempts
**Severity:** Medium
**Location:** `src/frontend/app.js` — WebSocket reconnect logic
**Impact:** After 5 failed reconnect attempts (e.g., during a brief network outage longer than ~2 minutes), the client permanently loses real-time updates for the rest of the session. No UI indication, no manual retry option.
**Recommendation:** Add a "reconnect" button or periodic background retry with exponential backoff beyond the initial 5 attempts.

---

## Category-by-Category Findings

### 1. API / protocol / contracts — Partial

**Pre-existing coverage:**
- `src/tests/api-docs.test.js` — OpenAPI spec validation (300+ paths, tags, schemas)
- `src/tests/inventory-validation-http.test.js` — HTTP-layer field validation (22 tests)
- `src/tests/validation-schemas.test.js` — Zod schema unit tests
- `src/tests/middleware-errorHandler*.test.js` — error response formatting, AppError hierarchy
- `src/tests/middleware-csrf*.test.js` — CSRF token lifecycle
- `src/tests/routes-stub-coverage.test.js` — all routes have handler stubs
- `src/tests/performance.test.js` — response time assertions
- Per-route test files exist for most routes (inventory, listings, sales, offers, automations)

**Gaps identified:**
- **Content-Type enforcement** — server does not validate `Content-Type: application/json` on POST/PUT/PATCH requests; sending `text/plain` with JSON body succeeds silently (High)
- **Pagination response shape inconsistency** — 6+ different pagination shapes across routes: some return `{ items, total, page }`, others `{ data, pagination }`, others flat arrays with no pagination metadata (Medium)
- **Response envelope inconsistency** — `success: true/false` wrapper present in some routes, absent in most; no standard error envelope (Medium)
- **Zod validate middleware unused** — see DC-1 (Medium)
- **API versioning untested** — `/api/v1/` alias exists in server.js but no test verifies it routes correctly (Low)
- **WebSocket message contracts superficial** — tests verify constant names exist but not message payload shapes or protocol sequences (Medium)

**Tests generated:** None (audit-only pass)

### 2. Integrations / dependencies — Partial

**Pre-existing coverage:**
- Mock infrastructure: mockDb, mockFetch, mockNodemailer, mockNotionClient used across test suite
- `src/tests/ai.test.js` + `src/tests/chatbot.test.js` — AI API timeout tests (AbortController, 4s/20s)
- Worker test files for all 4 workers (task, price, email, GDPR)
- `src/tests/service-tokenRefresh.test.js` — token refresh scheduler
- `src/tests/service-websocket*.test.js` — WebSocket service constants and method existence

**External integrations inventoried (9):**

| Integration | Timeout | Retry | Error Handling |
|------------|---------|-------|----------------|
| Anthropic SDK | None | None | Silent catch |
| Grok/X.AI | 60s | None | Logged |
| Cloudinary | 30s (upload) | None | Logged |
| Notion SDK | None | None | 350ms rate limit only |
| Platform Sync (6 services) | None | None | Varies |
| Outgoing Webhooks | 30s | 3x exponential backoff | Best pattern |
| Slack Monitoring | None | None | Silent catch |
| OAuth Token Refresh | None | 5-failure auto-disconnect | Logged |
| Playwright Bots | Task-level | Up to 3 attempts | Logged + alert |

**Gaps identified:**
- **No network failure simulation tests** — no test rejects a fetch to verify error handling (High)
- **No external service unavailability tests** — e.g., what happens when Notion API returns 503 (High)
- **No partial sync failure tests** — platform sync can fail mid-batch with no rollback (High)
- **No webhook retry/backoff logic tests** — outgoing webhooks have the best retry pattern but it's untested (Medium)
- **No token refresh failure scenario tests** — auto-disconnect after 5 failures is untested (Medium)
- **Silent error swallowing in AI** — see DC-2 (High)
- **Missing timeouts on 6 integration paths** — see DC-3 (High)

**Tests generated:** None (audit-only pass)

### 3. Reliability / failure modes / recovery — Partial

**Pre-existing coverage:**
- `src/tests/middleware-errorHandler*.test.js` — AppError hierarchy, catchAsync wrapper, 500 hiding in production
- `src/tests/db-database-unit.test.js` — transaction commit/rollback
- `src/tests/db-connectionPool-coverage.test.js` — transaction error propagation
- `src/tests/archive-listing.test.js` — constraint failure fallback
- Error handler middleware: AppError class hierarchy, error logging to `error_logs` DB table, production error sanitization
- 13 locations use DB transactions properly

**Gaps identified:**
- **`expect([200, 500]).toContain(status)` anti-pattern** — found in 30+ expanded test files; these tests pass on server errors, masking real failures (High)
- **No circuit breaker pattern** — no external call has circuit breaker protection; a failing dependency hammers it indefinitely (High)
- **No idempotency protection** — webhooks, platform sync, and automations can process the same event twice with duplicate side effects (High)
- **Missing timeouts on critical paths** — see DC-3 (High)
- **Cross-listing and bulk import lack transactions** — partial failure leaves inconsistent state (Medium)
- **No database lock contention tests** — WAL mode concurrency behavior untested under concurrent writes (Medium)
- **Rate limiter bypassed in test mode** — `rateLimiter()` returns `next()` immediately when `NODE_ENV=test`, so rate limiting is never actually tested (Medium)

**Tests generated:** None (audit-only pass)

### 4. Async / messaging / distributed behavior — Partial

**Pre-existing coverage:**
- 13 worker test files across 4 workers (taskWorker, priceCheck, emailPolling, GDPR)
- Task queue implementation: SQLite-backed, 10s polling interval, max 3 concurrent, exponential backoff retry
- Email worker: consecutive failure tracking, auto-disable after 5 failures
- Token refresh: consecutive failure tracking, auto-disconnect after 5 failures
- `src/tests/middleware-shutdown.test.js` — worker shutdown behavior
- Graceful shutdown sequence in `src/backend/server.js`

**Gaps identified:**
- **No dead-letter queue** — failed tasks remain in `task_queue` table forever with no alerting or cleanup (High)
- **No task retry/backoff behavior test** — exponential backoff logic exists but is untested (Medium)
- **No concurrent task execution limit test** — `MAX_CONCURRENT = 3` exists but no test verifies it (Medium)
- **No task queue ordering guarantee test** — FIFO ordering assumed but untested (Low)
- **No out-of-order event handling test** — WebSocket messages and webhook deliveries may arrive out of order (Medium)
- **WebSocket permanent disconnect** — see DC-6 (Medium)

**Tests generated:** None (audit-only pass)

### 5. Caching / CDN / proxy behavior — Partial

**Pre-existing coverage:**
- `src/tests/middleware-cdn.test.js` — CDN cache durations, Cache-Control header values
- `src/tests/middleware-securityHeaders.test.js` — includes Cache-Control assertions for API routes
- `src/tests/db-database-unit.test.js` — SQLite prepared statement cache behavior
- ETag/304 middleware exists and is applied globally via middleware stack
- Service worker (`public/sw.js` v4.2.1) with 4 distinct fetch strategies (cache-first for static, network-first for API, stale-while-revalidate for images, network-only for auth)
- Redis service exists (`src/backend/services/redisService.js`) with in-memory fallback

**Gaps identified:**
- **No service worker test** — `sw.js` has 4 fetch strategies, offline fallback, and cache versioning, all untested (High)
- **No gzip response cache test** — `server.js` populates a gzip cache on first request per file, never invalidates it (Medium)
- **No ETag 304 response test** — ETag middleware is applied but no test verifies conditional GET returns 304 (Medium)
- **No stale-while-revalidate test** — SW strategy for API responses untested (Low)
- **Frontend Cache unbounded** — see DC-5 (Medium)
- **Redis service unused** — `redisService.js` exists with in-memory fallback but is not wired into monitoring or caching middleware (Low)
- **In-memory monitoring metrics lost on restart** — metrics accumulate in RAM only; code has `// TODO: use Redis` comment (Low)

**Tests generated:** None (audit-only pass)

### 6. Observability / alerting — Partial

**Pre-existing coverage:**
- `src/tests/a-shared-logger.test.js` — logger shape, core methods, specialized loggers, createLogger factory
- `src/tests/middleware-requestLogger.test.js` — AuditActions enum, createRequestContext, createRequestLogger
- `src/tests/monitoring*.test.js` (4 files) — health endpoints, metrics collection, Prometheus format, security events, alert definitions
- Structured logger: JSON format in production, log levels (debug/info/warn/error), specialized loggers per domain
- Request logger: request ID generation, IP anonymization, sensitive field scrubbing (password, token, etc.)
- Sentry integration: custom `sentry.js` implementation, activated when `SENTRY_DSN` is set in production
- Error logging to `error_logs` DB table with stack traces
- Audit logging to `audit_logs` with 25 defined action types

**Gaps identified:**
- **Duplicate health endpoints** — see DC-4 (Low)
- **Worker health staleness untested** — `/api/workers/health` has staleness detection (marks unhealthy if no heartbeat in 60s) but no test verifies this behavior (Medium)
- **Raw console.log/console.error still present** — structured logger exists but raw console calls persist alongside it in some modules (Low)
- **In-memory metrics not persisted** — monitoring metrics accumulate in RAM, lost on restart; comment indicates Redis intent but not wired (Medium)
- **Two parallel Sentry paths** — custom `sentry.js` AND dynamic `@sentry/node` import in `monitoring.js`; unclear which is authoritative (Medium)
- **Alert threshold firing untested** — alert definitions exist (5% error rate, 2s response time, 95% memory, 80% CPU) but no test verifies thresholds trigger alerts (High)

**Tests generated:** None (audit-only pass)

---

## Risk Summary

### High-Risk Gaps (Recommended for Test Generation)
1. **Reliability anti-pattern:** `expect([200, 500]).toContain(status)` in 30+ tests masks real failures
2. **No network failure simulation** for any external integration
3. **No idempotency protection** on webhooks, platform sync, automations
4. **No circuit breaker** on any external dependency
5. **Missing timeouts** on 6 external integration paths
6. **Silent error swallowing** in AI service calls
7. **No service worker tests** despite complex 4-strategy caching
8. **No alert threshold tests** despite defined thresholds
9. **No dead-letter queue** for failed async tasks
10. **Content-Type header not enforced** on API requests
11. **No external service unavailability tests**
12. **No partial sync failure tests**

### Medium-Risk Gaps
1. Pagination response shape inconsistency across routes
2. Response envelope inconsistency (success wrapper)
3. Cross-listing and bulk import lack transactions
4. Rate limiter bypassed in test mode — never actually tested
5. WebSocket permanent disconnect after 5 failures
6. Gzip response cache never invalidated
7. ETag 304 behavior untested
8. Worker health staleness detection untested
9. Two parallel Sentry integration paths

### Low-Risk Gaps
1. API versioning (`/api/v1/`) untested
2. Task queue ordering guarantees untested
3. Redis service exists but unused
4. In-memory monitoring metrics lost on restart
5. Raw console.log calls alongside structured logger
