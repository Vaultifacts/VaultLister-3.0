# Sentry Application Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit `Sentry.metrics.*` calls at the API router dispatch point so HTTP request counts, response times, and error counts appear in the Sentry Metrics dashboard.

**Architecture:** `@sentry/node` v10.45.0 (already installed, requirement is >= 10.25.0) exposes `Sentry.metrics.increment()` and `Sentry.metrics.distribution()` with no additional package or init change needed. Two small edits to the router dispatch block in `server.js`: (1) record start time before calling the route handler and emit a distribution + counter after, (2) emit an error counter in the catch block. The `Sentry` import from `instrument.js` is already in scope.

**Tech Stack:** `@sentry/node` v10.45.0, Bun.js custom HTTP server (`src/backend/server.js`).

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/backend/server.js` | **Modify** | Add `Sentry.metrics.*` calls at the router dispatch and error catch sites |

---

### Task 1: Emit HTTP metrics at the API router dispatch point

**Files:**
- Modify: `src/backend/server.js` (around the `for (const [prefix, router] of _sortedApiRoutes)` block, currently near lines 1402–1492)

The current code calls `const result = await router(context);` inside a `try` block. This task wraps that call with timing and emits three metrics per request:

| Metric name | Type | Tags | Meaning |
|-------------|------|------|---------|
| `http.response_ms` | distribution | `method`, `route`, `status` | Response time histogram per route |
| `http.requests` | counter | `method`, `route`, `status` | Total request count per route |
| `http.errors` | counter | `method`, `route`, `status` | Error count (catch block only) |

The `route` tag uses the matched **prefix** (e.g. `/api/inventory`), not the full path, to keep cardinality manageable.

- [ ] **Step 1: Add timing + success metrics (Edit 1 of 2)**

Find this exact block in `src/backend/server.js`:
```javascript
                    try {
                        const result = await router(context);

                        // Apply security headers
```

Replace with:
```javascript
                    try {
                        const _t0 = performance.now();
                        const result = await router(context);
                        const _statusStr = String(result.status || 200);
                        Sentry.metrics.distribution('http.response_ms', performance.now() - _t0, {
                            unit: 'millisecond',
                            tags: { method, route: prefix, status: _statusStr }
                        });
                        Sentry.metrics.increment('http.requests', 1, {
                            tags: { method, route: prefix, status: _statusStr }
                        });

                        // Apply security headers
```

- [ ] **Step 2: Syntax check**

```bash
node --check src/backend/server.js
```

Expected: no output (exit 0).

- [ ] **Step 3: Add error metrics (Edit 2 of 2)**

Find this exact block in `src/backend/server.js`:
```javascript
                    } catch (error) {
                        // Use structured error handler
                        const errorResult = handleError(error, context);
                        const securityHeaders = applySecurityHeaders(context);
```

Replace with:
```javascript
                    } catch (error) {
                        // Use structured error handler
                        const errorResult = handleError(error, context);
                        Sentry.metrics.increment('http.errors', 1, {
                            tags: { method, route: prefix, status: String(errorResult.status || 500) }
                        });
                        const securityHeaders = applySecurityHeaders(context);
```

- [ ] **Step 4: Syntax check**

```bash
node --check src/backend/server.js
```

Expected: no output (exit 0).

- [ ] **Step 5: Commit**

```bash
git add src/backend/server.js
git commit -m "[AUTO] feat(monitoring): emit Sentry metrics per API request

Tracks http.response_ms (distribution), http.requests (counter), and
http.errors (counter) at the route dispatcher. Each metric is tagged with
HTTP method, route prefix, and status code.

Verified: node --check src/backend/server.js exits 0"
```

- [ ] **Step 6: Push and verify in Sentry dashboard**

```bash
git push origin master
```

Wait for CI to pass (all workflows green). Then:
1. Make 5+ requests to the live app: `curl https://vaultlister-app-production.up.railway.app/api/health`
2. Open Sentry → Explore → Metrics
3. Search for `http.requests` — should show a counter graph within ~30 seconds of the requests

---

## Self-Review

**Spec coverage:**
- ✅ `@sentry/node >= 10.25.0` already installed (10.45.0)
- ✅ `http.response_ms` distribution — response time histogram per route
- ✅ `http.requests` counter — total requests tagged by method/route/status
- ✅ `http.errors` counter — error events from the catch block
- ✅ No new packages, no init changes — Sentry metrics work with existing `Sentry.init()` in `instrument.js`

**Placeholder scan:** No TBDs. All code is complete and ready to paste.

**Type consistency:** `Sentry` is the default export of `instrument.js`, already imported at the top of `server.js` from the previous plan. `prefix` is the loop variable from `for (const [prefix, router] of _sortedApiRoutes)`. `method` is defined earlier in the fetch handler. All names are correct.
