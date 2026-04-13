# Sentry Performance Tracing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Sentry performance tracing into the Bun.js custom HTTP server so transactions appear in the Sentry Performance and Mobile Vitals dashboards.

**Architecture:** Create `src/backend/instrument.js` that initializes Sentry before any other modules load. Import it as the second module in `server.js` (after `env.js`), then wrap the API route block with `Sentry.continueTrace` + `Sentry.startSpan` to create one transaction per HTTP request. Remove the duplicate lazy `Sentry.init()` in `monitoring.js` and import the shared Sentry instance from `instrument.js` instead.

**Tech Stack:** `@sentry/node` v10.45.0 (already installed), Bun.js custom fetch-based HTTP server, ESM imports.

**Key constraint:** Bun's HTTP server does NOT use Node's `http` module, so `@sentry/node` cannot auto-instrument incoming requests. Manual `startSpan` is required. When `SENTRY_DSN` is absent, all Sentry SDK methods are no-ops — no crashes.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/backend/instrument.js` | **Create** | New file: initializes Sentry early with `tracesSampleRate` and `nativeNodeFetchIntegration` |
| `src/backend/server.js` | **Modify** | Add `import './instrument.js'` (line 4); wrap API IIFE with `Sentry.continueTrace` + `Sentry.startSpan` |
| `src/backend/services/monitoring.js` | **Modify** | Remove lazy `initSentry()` / `_sentryModule`; import Sentry from `instrument.js` |
| `.env.example` | **Modify** | Add `SENTRY_TRACES_SAMPLE_RATE` |

---

### Task 1: Create `src/backend/instrument.js`

**Files:**
- Create: `src/backend/instrument.js`

- [ ] **Step 1: Write instrument.js**

```javascript
// src/backend/instrument.js
// Sentry instrumentation — imported as the second module in server.js (after env.js).
// Calling Sentry.init() here ensures integrations are registered before routes and
// services load. When SENTRY_DSN is absent, all Sentry methods are no-ops.

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.SENTRY_RELEASE || undefined,
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
        integrations: [
            // Instruments outgoing fetch() calls — works with Bun's native fetch.
            Sentry.nativeNodeFetchIntegration(),
        ],
    });
}

// Re-export so monitoring.js can call captureException without re-importing.
export default Sentry;
```

- [ ] **Step 2: Syntax-check the new file**

```bash
bun --check src/backend/instrument.js
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/backend/instrument.js
git commit -m "[AUTO] feat(monitoring): add Sentry instrument.js for early init

Verified: bun --check src/backend/instrument.js exits 0"
```

---

### Task 2: Wire instrument.js into server.js and add request spans

**Files:**
- Modify: `src/backend/server.js` (lines 3–4 and lines 1244, 1493)

This task makes two edits to `server.js`:
1. Add the `instrument.js` import immediately after `env.js`.
2. Wrap the API handler IIFE with `Sentry.continueTrace` + `Sentry.startSpan`.

- [ ] **Step 1: Add the import (Edit 1 of 2)**

Find this line in `src/backend/server.js`:
```javascript
import './env.js'; // Validate required env vars before anything else — exits with clear errors on misconfiguration
```

Replace with:
```javascript
import './env.js'; // Validate required env vars before anything else — exits with clear errors on misconfiguration
import Sentry from './instrument.js'; // Init Sentry before any other module loads
```

- [ ] **Step 2: Wrap the API handler (Edit 2 of 2)**

Find this line in `src/backend/server.js` (inside the `if (pathname.startsWith('/api/'))` block):
```javascript
            return withRequestTimeout((async () => {
```

Replace with:
```javascript
            return withRequestTimeout(Sentry.continueTrace(
                {
                    sentryTrace: request.headers.get('sentry-trace') || '',
                    baggage: request.headers.get('baggage') || '',
                },
                () => Sentry.startSpan(
                    { name: `${method} ${pathname}`, op: 'http.server', forceTransaction: true },
                    async () => {
```

Then find this line (the closing of that same IIFE, immediately before the closing `}` of the `if (pathname.startsWith('/api/'))` block):
```javascript
            })(), apiTimeoutMs);
```

Replace with:
```javascript
            })), apiTimeoutMs);
```

- [ ] **Step 3: Syntax-check server.js**

```bash
bun --check src/backend/server.js
```

Expected: no output (clean). If you see a syntax error, the two edits from Step 2 are mis-paired — verify the open/close counts: the old code had `(async () => { ... })()` (IIFE) and the new code has `async () => { ... }` (callback passed to `startSpan`). The outermost wrapper changes from `(async () => { ... })()` to `() => Sentry.startSpan(..., async () => { ... })`.

- [ ] **Step 4: Commit**

```bash
git add src/backend/server.js
git commit -m "[AUTO] feat(monitoring): add per-request Sentry spans to API handler

Each API request now creates a Sentry transaction via continueTrace +
startSpan. Distributed tracing headers (sentry-trace, baggage) are
propagated from incoming requests.

Verified: bun --check src/backend/server.js exits 0"
```

---

### Task 3: Refactor monitoring.js to use shared Sentry from instrument.js

**Files:**
- Modify: `src/backend/services/monitoring.js`

Currently `monitoring.js` lazy-imports `@sentry/node` and calls `Sentry.init()` again inside `initSentry()`. This is now wrong: Sentry is already initialized by `instrument.js` when `server.js` starts, so a second `Sentry.init()` would reset the SDK. This task removes the lazy init and uses the shared instance.

- [ ] **Step 1: Add import at the top of monitoring.js**

Find this line near the top of `src/backend/services/monitoring.js`:
```javascript
import { INTERVALS } from '../shared/constants.js';
```

Replace with:
```javascript
import { INTERVALS } from '../shared/constants.js';
import Sentry from './instrument.js';
```

Wait — `monitoring.js` is in `src/backend/services/` and `instrument.js` is in `src/backend/`. The relative import path must be:
```javascript
import Sentry from '../instrument.js';
```

Use that path.

- [ ] **Step 2: Remove `_sentryModule` and `initSentry()` from the monitoring object**

Find and remove this block from the `monitoring` object literal:
```javascript
    _sentryModule: null,

    // Initialize Sentry error tracking
    async initSentry() {
        try {
            const Sentry = await import('@sentry/node');
            Sentry.init({
                dsn: SENTRY_DSN,
                environment: process.env.NODE_ENV || 'development',
                release: process.env.SENTRY_RELEASE || undefined,
                tracesSampleRate: 1.0
            });
            this._sentryModule = Sentry;
            logger.info('[Monitoring] Sentry initialized');
        } catch (e) {
            logger.info('[Monitoring] Sentry not available, using local error tracking');
        }
    },
```

Replace with nothing (delete entirely).

- [ ] **Step 3: Remove the `initSentry()` call from `init()`**

Find this block inside the `init()` method:
```javascript
        // Initialize Sentry if configured
        if (SENTRY_DSN) {
            this.initSentry();
        }
```

Replace with nothing (delete entirely).

- [ ] **Step 4: Simplify `reportToSentry()`**

Find:
```javascript
    // Forward error to Sentry SDK (no DB logging or metrics — use trackError for full pipeline)
    reportToSentry(error, context = {}) {
        if (SENTRY_DSN && this._sentryModule) {
            try {
                this._sentryModule.captureException(error, { extra: context });
            } catch (e) {}
        }
    },
```

Replace with:
```javascript
    // Forward error to Sentry SDK (no DB logging or metrics — use trackError for full pipeline)
    reportToSentry(error, context = {}) {
        try {
            Sentry.captureException(error, { extra: context });
        } catch (e) {}
    },
```

Note: `Sentry.captureException` is a no-op when Sentry was not initialized (no DSN), so the `if (SENTRY_DSN)` guard is no longer needed.

- [ ] **Step 5: Syntax-check monitoring.js**

```bash
bun --check src/backend/services/monitoring.js
```

Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/backend/services/monitoring.js
git commit -m "[AUTO] refactor(monitoring): remove duplicate Sentry.init, use shared instance

monitoring.js previously lazy-imported @sentry/node and called Sentry.init()
a second time. Now imports the already-initialized Sentry from instrument.js.
captureException no longer needs a DSN guard (SDK is a no-op without DSN).

Verified: bun --check src/backend/services/monitoring.js exits 0"
```

---

### Task 4: Update env config and verify end-to-end

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add `SENTRY_TRACES_SAMPLE_RATE` to `.env.example`**

Find this block in `.env.example`:
```
# Release tag for Sentry — set via CI (e.g. RAILWAY_GIT_COMMIT_SHA) or a version string
SENTRY_RELEASE=
```

Replace with:
```
# Release tag for Sentry — set via CI (e.g. RAILWAY_GIT_COMMIT_SHA) or a version string
SENTRY_RELEASE=
# Fraction of requests to trace (0.0–1.0). Use 0.1 in production (10% sampling).
# 1.0 traces everything — fine for low-traffic apps, expensive at scale.
SENTRY_TRACES_SAMPLE_RATE=0.1
```

- [ ] **Step 2: Full syntax check**

```bash
bun --check src/backend/instrument.js src/backend/server.js src/backend/services/monitoring.js
```

Expected: all three exit 0 with no output.

- [ ] **Step 3: Start the server and verify it boots**

```bash
bun run src/backend/server.js &
sleep 3
curl -sf http://localhost:3000/api/health | head -c 100
kill %1
```

Expected: JSON health response (status: "ok" or "degraded" depending on DB).

If the server crashes on startup, check for:
- Import cycle: `instrument.js` → `@sentry/node` only (no circular deps)
- Missing `SENTRY_DSN` in `.env`: that's fine — `if (SENTRY_DSN)` guard means Sentry is skipped

- [ ] **Step 4: Verify transactions appear in Sentry dashboard**

With the server running against the live `SENTRY_DSN`:

```bash
# Make a handful of API requests to generate transactions
curl -s http://localhost:3000/api/health > /dev/null
curl -s http://localhost:3000/api/status > /dev/null
curl -s http://localhost:3000/api/health/detailed > /dev/null
```

Then open `https://vaultlister.sentry.io` → Performance → and look for transactions named `GET /api/health`. They appear within ~30 seconds of the request. If tracing sample rate is < 1.0, run 10+ requests to ensure at least one is sampled.

- [ ] **Step 5: Set `SENTRY_TRACES_SAMPLE_RATE` in Railway**

In the Railway dashboard, add environment variable:
```
SENTRY_TRACES_SAMPLE_RATE=0.1
```

This is a manual step — the Railway dashboard or CLI is required. (Claude cannot safely modify Railway env vars for production without explicit confirmation.)

- [ ] **Step 6: Commit .env.example**

```bash
git add .env.example
git commit -m "[AUTO] chore(env): document SENTRY_TRACES_SAMPLE_RATE in .env.example

Verified: bun --check exits 0 for all three modified backend files"
```

- [ ] **Step 7: Push all commits**

```bash
git push origin master
```

Wait for CI to pass (all workflows green for the pushed commits).

---

## Self-Review

**Spec coverage:**
- ✅ Sentry initialized early (instrument.js, imported second in server.js)
- ✅ Per-request transactions (Sentry.continueTrace + Sentry.startSpan wrapping API IIFE)
- ✅ Distributed tracing headers propagated (sentry-trace, baggage)
- ✅ Outgoing fetch instrumentation (nativeNodeFetchIntegration)
- ✅ Duplicate Sentry.init removed from monitoring.js
- ✅ No-op when SENTRY_DSN absent (existing behavior preserved)
- ✅ tracesSampleRate configurable via env var

**Placeholder scan:** No TBDs or incomplete steps. All code is complete.

**Type/name consistency:** `Sentry` is the default export of `instrument.js` in all tasks. `monitoring.js` imports it as `import Sentry from '../instrument.js'` — one `../` up from `services/` to `backend/`. Confirmed path.
