# Deep-Dive Backlog — VaultLister 3.0 Structural Refactoring

> READ-ONLY reference. Do not edit runtime files based on this document without completing all listed verification steps first.
>
> All line counts and findings were verified against branch `codex/e2e-session-guardrails` (merged to master via b9d608ec).
> **Verified 2026-05-03:**
> - R-001: `server.js` is 1,464 lines (was 2,087). Routes dispatched via `routeRegistry`. Inline handlers minimal.
> - R-011: RESOLVED — `routes/auth/` is now 6 files (index.js, login.js, register.js, session.js, account.js, helpers.js). No monolithic auth.js.
> - R-012: RESOLVED — `db/database.js` is a 6-line barrel re-export. Logic split into query.js, metrics.js, sql-helpers.js, models.js, migrations.js.
> - R-015: RESOLVED — ownership audit completed: all 178 user-data mutations include `WHERE user_id = ?`. No IDOR found.
> - R-017: RESOLVED — CORS correctly whitelists origins; `Access-Control-Allow-Credentials` only sent for explicit matches, never wildcard.
> - R-020/R-021: RESOLVED — Playwright 1.59.1 across root, worker, and Dockerfile. Stale `Dockerfile.worker` at root deleted 2026-05-03.
> - R-027: RESOLVED — upload audit passed (MIME, size, path, ownership). `receiptParser.js` filename sanitization added 2026-05-03.
> - R-028: RESOLVED — `taskWorker.js` is producer-only (Queue), `worker/index.js` is consumer-only (Worker). No duplicate consumers.
> - R-029: RESOLVED — token lifecycle verified: store.persist/hydrate cover both tokens, api.refreshAccessToken reads store.state, backend invalidates old session + issues new refresh token (rotation).

---

## P1 — Must inspect before any refactor

These items carry the highest risk of silent regressions if moved or split without a prior route-by-route audit. Each is blocked from execution until the inspection steps are completed.

| Risk ID | Area | Evidence Path | What to inspect | Verification commands required before/after fix | Blocked until inspection complete |
|---------|------|--------------|-----------------|------------------------------------------------|----------------------------------|
| R-001 | `src/backend/server.js` (2087 lines, dispatch table with 15 inline async handlers) | `server.js:577` — `/api/health/platforms` handler; `server.js:237` — CORS config block; `server.js:304` — in-process platform health cache | Identify which of the 15 inline handlers contain non-trivial business logic vs trivial delegation. `/api/health/platforms` (starts line 577) runs 4 parallel DB queries with bucket-building logic (~180 LOC). Determine whether any inline handler reads module-level mutable state (e.g., `_platformHealthCache`) that would break if moved to a separate file. | Before: `grep -n "'^    '/api/"` server.js to enumerate all 168 dispatch entries. After extraction: `bun test src/tests/auth.test.js src/tests/security.test.js` | Yes |
| R-011 | `src/backend/routes/auth.js` (1153 lines, 11 imports spanning 6 concern domains) | `auth.js:1–12` — imports: `uuid`, `bcryptjs`, `crypto`, direct SQL via `query`, `mfa.js`, `email.js`, `rateLimiter`, `websocket.js`, `logger`, `redis.js`, `auth.js` middleware | Count how many exported route handler functions exist. Identify which functions depend on Redis vs which depend only on DB. Determine whether WebSocket emission is fire-and-forget (safe to keep) or awaited (creates ordering dependency). Verify that MFA validation paths share no mutable state with password-reset paths. | Before: `grep -n "^export async function\|^export function"` auth.js. After any split: `bun test src/tests/auth.test.js` — must pass all previously-passing cases | Yes |
| R-012 | `src/backend/db/database.js` (640 lines, 7+ distinct responsibilities) | `database.js:1–640` — connection pool init, `query.get` / `query.all` / `query.run` wrappers, migration runner, seeder, metrics collection, pool monitoring, graceful shutdown | Map which exported symbols are imported by routes vs middleware vs workers. Verify that the migration array order is load-bearing (migrations run sequentially). Check whether pool monitoring (`on('connect')`, `on('error')`) is stateful — cannot be split without passing the pool reference. Confirm shutdown hook is registered once and not duplicated if the module is re-imported. | Before: `grep -rn "from.*db/database"` src/backend/ to build full import graph. After any restructure: `bun run db:reset` (requires user approval) + full test suite | Yes |
| R-015 | Authorization/ownership checks across `src/backend/routes/*` | All files under `src/backend/routes/` — audit not yet completed; coverage is UNKNOWN | Route-by-route audit: for every route that reads or mutates a user-owned resource (InventoryItem, Listing, Sale, Offer, ImageAsset), verify that a `WHERE user_id = $N` clause or equivalent ownership check exists. Flag any route that accepts a resource ID from the request body/params without verifying ownership before the query executes. | Before: `grep -rn "req\.params\|ctx\.params\|body\.id\|query\.id"` src/backend/routes/ cross-referenced with `grep -rn "WHERE.*id.*=\|AND.*user_id"`. After fixes: add IDOR test cases to `src/tests/` | Yes |
| R-029 | Frontend/backend auth-session coupling | `src/backend/routes/auth.js`, `src/backend/middleware/auth.js`, `src/frontend/core/api.js`, `src/frontend/core/store.js` | Map the full token lifecycle: issue → store → refresh → revoke. Verify that `store.persist()` and `store.hydrate()` cover both `token` and `refreshToken`. Confirm `api.refreshAccessToken()` reads `store.state.refreshToken` (not localStorage directly). Check that the backend `/api/auth/refresh` route invalidates the old refresh token (rotation). Any change to these four files together requires the full auth chain to be re-verified. | Before: `grep -n "refreshToken\|persist\|hydrate"` store.js api.js auth.js (backend). After any change to any of the four files: `bun test src/tests/auth.test.js` — zero regressions permitted | Yes |

---

## P2 — Medium risk, inspect before extracting

These items are unlikely to cause silent regressions on their own but will create confusion or duplicate behavior if extracted without first understanding their current wiring.

| Risk ID | Area | Evidence Path | What to inspect | Verification commands required before/after fix | Blocked until inspection complete |
|---------|------|--------------|-----------------|------------------------------------------------|----------------------------------|
| R-003 | 4 service files that export HTTP routers alongside service logic | `emailMarketing.js:317` — `emailMarketingRouter`; `enhancedMFA.js:514` — `enhancedMFARouter`; `auditLog.js:430` — `auditLogRouter`; `outgoingWebhooks.js:265` — `outgoingWebhooksRouter`. Actual file lengths: emailMarketing.js 384 lines, enhancedMFA.js 657 lines, auditLog.js 557 lines, outgoingWebhooks.js 484 lines | Confirm that the router function in each file only calls service functions defined in the same file (not across service boundaries). Determine whether moving the router to `src/backend/routes/` would create a circular import (router imports service; service imports route would be new). Verify that `server.js` mounts these routers by path prefix and that no path collision exists with any dedicated route file. | Before: `grep -rn "emailMarketingRouter\|enhancedMFARouter\|auditLogRouter\|outgoingWebhooksRouter"` src/backend/ to see all callsites. After split: `bun test src/tests/auth.test.js src/tests/security.test.js` | No |
| R-017 | CORS config embedded in `server.js` | `server.js:237–265` — `allowedOrigins` array construction and `getCORSHeaders()` function | Determine whether `CORS_ORIGINS` env var parsing is done once at startup (safe to extract) or on every request (stateful). Verify that `getCORSHeaders()` is called only from the main request handler and not from any middleware. Check that the `Access-Control-Allow-Credentials: true` response is only sent for whitelisted origins — never for wildcard. | Before: `grep -n "getCORSHeaders\|allowedOrigins"` server.js to count callsites. After extraction to middleware: confirm existing security tests still pass | No |
| R-020 / R-021 | Playwright version drift + duplicate Dockerfile | Root `package.json`: `playwright@1.59.1`, `@playwright/test@1.59.1`. `worker/package.json`: `playwright@1.58.2`. Dockerfiles: `Dockerfile.worker` at repo root AND `worker/Dockerfile` both exist | Determine which Dockerfile is actually used by Railway for the worker service (check `railway.json` in `worker/`). Verify whether the 1.58.2 vs 1.59.1 difference affects any bot behavior in `worker/bots/`. Check if `Dockerfile.worker` at root is a legacy artifact or actively referenced. | Before: `cat worker/railway.json` to confirm which Dockerfile Railway uses. After resolving: confirm `bun run test:e2e:smoke` still passes | No |
| R-027 | Upload/media route validation in `imageBank.js`, `batchPhoto.js`, `receiptParser.js` | `src/backend/routes/imageBank.js`, `src/backend/routes/batchPhoto.js`, `src/backend/routes/receiptParser.js` — not yet inspected | Audit each file for: (1) MIME type validation before file processing, (2) file size limits enforced server-side, (3) upload path sanitization (no path traversal), (4) ownership check before serving a stored asset, (5) whether `escapeHtml()` is called on any user-supplied filename before storage or logging. | Before: `grep -n "mimetype\|contentType\|fileSize\|maxSize\|\.path\|escapeHtml"` across all three files. After any validation additions: verify security tests pass | No |
| R-028 | Background job schedulers split across two locations | `src/backend/workers/` contains: `emailPollingWorker.js`, `gdprWorker.js`, `priceCheckWorker.js`, `taskWorker.js`, `uptimeProbeWorker.js`. `worker/` contains: `index.js`, `dlq-processor.js`, `bots/`. | Determine whether any job type is scheduled in both locations (duplicate scheduler). Verify that `src/backend/workers/` files are imported and started from `server.js` (in-process) while `worker/index.js` is the out-of-process BullMQ worker — these are distinct execution contexts and must not share the same queue consumer registration. | Before: `grep -rn "new Worker\|new Queue\|schedule\|setInterval"` src/backend/workers/ worker/index.js to map all scheduler registrations. After any consolidation: confirm no queue is double-consumed | No |

---

## P3 — Documentation/no-risk (already resolved or low impact)

These items are recorded here for traceability. No further code inspection is required before proceeding with other work.

| Risk ID | Area | Status | Evidence | Notes |
|---------|------|--------|----------|-------|
| R-016 | CSRF skip path duplication — two divergent `skipPaths` arrays in `csrf.js` | RESOLVED — commit `3f0dfe19` (2026-04-24) | `git show 3f0dfe19 --stat` confirms file: `src/backend/middleware/csrf.js` | Consolidated into single source of truth. No further action needed. |
| R-018 | Env docs conflict between `.env.example`, `CLAUDE.md`, and docs | RESOLVED — `docs/reference/env.md` created (168 lines, 83 vars) | `.env.example` is the canonical env var registry; `docs/reference/env.md` provides grouped reference | No further action needed. |
| R-019 | License conflict — `package.json` declared `MIT` while README stated Proprietary | RESOLVED — commit `ce848dd9` (2026-04-24) | `git show ce848dd9 --stat` confirms `package.json` updated to `UNLICENSED` + `private: true` | No further action needed. |
| R-022 | Docs/archive noise — stale files in `docs/` and archive directories | Partially resolved — `docs/reference/repo-map.md` and `docs/reference/docs-index.md` have been created | `ls docs/reference/` confirms: api.md, backend.md, database.md, frontend.md, security.md, testing.md, repo-map.md, api-route-inventory.md, db-query-inventory.md present | Remaining noise (if any) is cosmetic. No runtime or security impact. |

---

## Rollback

To remove this document: `rm docs/reference/deep-dive-backlog.md`

This file has no runtime imports and no effect on the application.
