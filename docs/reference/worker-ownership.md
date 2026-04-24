# Worker Ownership Inventory — VaultLister 3.0
<!-- Generated 2026-04-24 — READ-ONLY reference; do not edit runtime files -->

## 1. Worker Entrypoint

The confirmed CMD from `worker/Dockerfile`:

```
CMD ["bun", "worker/index.js"]
```

Entry file: `worker/index.js`
Runtime: Bun (pinned to v1.3.6 in `worker/Dockerfile`)
Base image: `mcr.microsoft.com/playwright:v1.58.2-noble`

---

## 2. BullMQ Queues

Only one BullMQ queue is consumed by `worker/index.js`:

| Queue name | Consumer | Concurrency | Timeout |
|---|---|---|---|
| `automation-jobs` | `worker/index.js` (inline `Worker`) | 1 | 300 000 ms (5 min) |

The DLQ processor (`worker/dlq-processor.js`) scans the same `automation-jobs` queue for failed/dead jobs. No additional queues are declared or consumed.

---

## 3. Worker Modules (imported and started by worker/index.js)

| Import path | Exported start/stop | Purpose |
|---|---|---|
| `../src/backend/db/database.js` | `initializeDatabase`, `closeDatabase`, `cleanupExpiredData` | PostgreSQL connection pool; expired-data cleanup |
| `../src/backend/services/tokenRefreshScheduler.js` | `startTokenRefreshScheduler`, `stopTokenRefreshScheduler` | Proactively refreshes expiring OAuth access tokens |
| `../src/backend/services/syncScheduler.js` | `startSyncScheduler`, `stopSyncScheduler` | Schedules periodic platform sync jobs |
| `../src/backend/workers/taskWorker.js` | `startTaskWorker`, `stopTaskWorker` | Polls `tasks` table; executes background task queue (max 3 concurrent) |
| `../src/backend/workers/emailPollingWorker.js` | `startEmailPollingWorker`, `stopEmailPollingWorker` | Fetches Gmail/Outlook emails; parses receipts |
| `../src/backend/workers/priceCheckWorker.js` | `startPriceCheckWorker`, `stopPriceCheckWorker` | Polls supplier prices every 30 min; fires drop alerts |
| `../src/backend/workers/gdprWorker.js` | `startGDPRWorker`, `stopGDPRWorker` | Processes GDPR account deletions after 30-day grace period |
| `../src/backend/workers/uptimeProbeWorker.js` | `startUptimeProbeWorker`, `stopUptimeProbeWorker` | Hourly HTTP probes of all marketplaces; writes to `platform_uptime_samples` |
| `../src/backend/services/redis.js` | `redisService.init()`, `redisService.close()` | Shared ioredis client |
| `../src/backend/services/redisLock.js` | `withRedisLock` | Distributed lock helper used for cleanup and worker guards |
| `../src/backend/services/monitoring.js` | `monitoring.init()`, `monitoring.stopMetricsCollection()`, `monitoring.reportToSentry()` | Sentry error reporting + metrics |
| `../src/backend/shared/logger.js` | `logger` | Structured logger |
| `./dlq-processor.js` | `startDLQProcessor`, `stopDLQProcessor` | Dead Letter Queue processor — retries or removes failed BullMQ jobs |

Bot modules are lazy-imported inside the BullMQ job handler switch (not at startup):

| Job type | Lazy import |
|---|---|
| `share_listing`, `share_closet`, `follow_user`, `follow_back` | `./bots/poshmark-bot.js` |
| `mercari_refresh` | `./bots/mercari-bot.js` |
| `depop_refresh`, `depop_share` | `./bots/depop-bot.js` |
| `grailed_bump` | `./bots/grailed-bot.js` |
| `facebook_refresh` | `./bots/facebook-bot.js` |
| `whatnot_refresh` | `./bots/whatnot-bot.js` |

---

## 4. src/backend/workers/ Files

| File | Apparent purpose |
|---|---|
| `taskWorker.js` | Polls `tasks` table every 10 s; dispatches up to 3 concurrent background tasks including platform sync via `syncShop`; writes audit log entries; heartbeat via Redis |
| `emailPollingWorker.js` | Polls Gmail and Outlook accounts; decrypts OAuth tokens; fetches recent emails; detects and parses receipts; queues parsed receipt data |
| `priceCheckWorker.js` | Polls supplier item prices every 30 min (max 50 items/cycle with 500 ms inter-check delay); fires notifications on price drops; heartbeat + distributed lock |
| `gdprWorker.js` | Processes rows in `deletion_requests` after 30-day grace period; purges user data; revokes OAuth tokens; sends confirmation email; heartbeat + distributed lock |
| `uptimeProbeWorker.js` | Hourly HTTP probes for every platform in `SUPPORTED_PLATFORMS`; retries up to 3 times with 2 s backoff; persists samples to `platform_uptime_samples`; prunes rows older than 90 days; heartbeat + distributed lock |

---

## 5. Dockerfile.worker vs worker/Dockerfile

### Which is active

`worker/railway.json` specifies:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "worker/Dockerfile"
  }
}
```

**`worker/Dockerfile` is the active build file.** Railway uses it exclusively.

### Comparison

| Feature | worker/Dockerfile (active) | Dockerfile.worker (root, unused) |
|---|---|---|
| Base image | `mcr.microsoft.com/playwright:v1.58.2-noble` | `mcr.microsoft.com/playwright:v1.58.2-noble` |
| Bun install | Pinned: `bun-v1.3.6`; copied to `/usr/local/bin/bun`; `chmod 755` | Unpinned: `curl ... \| bash`; relies on `$PATH` only |
| GTK3/Xvfb libs | Installed (required for Camoufox headless Firefox) | Not installed |
| Non-root user | Yes — `vaultlister` user created; `USER vaultlister` set | No — runs as root |
| `RAILWAY_SHM_SIZE_BYTES` | Set to 2 GiB | Not set |
| `bun.lock*` pattern | Copies `bun.lock*` and `bun.lockb*` | Copies `bun.lockb*` only (misses `bun.lock`) |
| CMD | `["bun", "worker/index.js"]` | `["bun", "worker/index.js"]` |

### Verdict

`Dockerfile.worker` at the project root is **stale and unused**. It is missing the GTK3/Xvfb dependencies required for Camoufox (headless Firefox), runs as root, omits the Bun version pin, and is not referenced by any Railway config. It can be safely removed.

---

## 6. Playwright Version Split

| Location | Version | Source |
|---|---|---|
| Root `package.json` (`playwright` + `@playwright/test`) | **1.59.1** | Used by E2E test suite |
| `worker/package.json` (`playwright`) | **1.58.2** | Used by Playwright bots in `worker/bots/` |
| `worker/Dockerfile` base image | `v1.58.2-noble` | Matches worker package.json |

The split is **intentional in effect** — the worker Dockerfile is pinned to the same version as `worker/package.json` (1.58.2). However, there is **no explicit documentation** in `CLAUDE.md`, `design/architecture.md`, or any ADR explaining why the versions differ. The gap (1.58.2 vs 1.59.1) is minor but could drift further over time. If Camoufox compatibility is the reason the worker is held back, that constraint should be documented in an ADR or in `worker/Dockerfile` as a comment.

---

## 7. Required Environment Variables

From `worker/index.js` startup guards (process exits if missing):

| Variable | Required | Notes |
|---|---|---|
| `REDIS_URL` | Hard required — exits with code 1 if absent | BullMQ connection + redisService |
| `DATABASE_URL` | Hard required — exits with code 1 if absent | PostgreSQL connection via `initializeDatabase()` |

Additional env vars consumed by imported modules (not guarded at worker startup but needed at runtime):

| Variable | Consumed by |
|---|---|
| `RESEND_API_KEY` | `emailPollingWorker.js` → email service |
| `ENCRYPTION_KEY` | `emailPollingWorker.js`, `gdprWorker.js` → `encryptToken`/`decryptToken` |
| `SENTRY_DSN` | `monitoring.js` → Sentry error reporting |

---

## 8. Shutdown Handlers

`worker/index.js` implements graceful shutdown via a `shutdown(exitCode)` function protected by an `isShuttingDown` guard to prevent double-invocation.

Shutdown sequence (in order):

1. Clear `staleCleanupInterval` (5-min stale-job sweep)
2. Clear `startupCleanupTimeout` (30-s deferred expired-data cleanup)
3. Clear `cleanupInterval` (24-h expired-data cleanup)
4. `stopTokenRefreshScheduler()`
5. `stopSyncScheduler()`
6. `stopTaskWorker()`
7. `stopEmailPollingWorker()`
8. `stopPriceCheckWorker()`
9. `stopGDPRWorker()`
10. `stopUptimeProbeWorker()`
11. `stopDLQProcessor()`
12. `monitoring.stopMetricsCollection()`
13. `await worker.close()` — drains in-flight BullMQ job (concurrency: 1)
14. `await redisService.close()`
15. `await closeDatabase()`
16. `process.exit(exitCode)`

Signal handlers registered: `SIGTERM` (exit 0), `SIGINT` (exit 0), `uncaughtException` (exit 1, Sentry report), `unhandledRejection` (Sentry report only — does not exit).

Railway deploy config sets `drainingSeconds: 300` (5 min) to allow in-flight jobs to complete before the old container is terminated.

---

## 9. Duplicate Scheduler Risk

**No duplicate scheduler risk detected.**

All seven scheduled services (`tokenRefreshScheduler`, `syncScheduler`, `taskWorker`, `emailPollingWorker`, `priceCheckWorker`, `gdprWorker`, `uptimeProbeWorker`) are started exclusively in `worker/index.js`. A grep of `src/backend/server.js` confirms none of the `start*` functions are called from the main app process.

Workers that could run duplicate work if accidentally started twice use distributed Redis locks:

| Worker | Lock key | Lock TTL |
|---|---|---|
| `priceCheckWorker` | `worker:lock:priceCheckWorker` | 45 min |
| `gdprWorker` | `worker:lock:gdprWorker` | 50 min |
| `uptimeProbeWorker` | `worker:lock:uptimeProbeWorker` | 10 min |
| `cleanupExpiredData` | `worker:lock:cleanupExpiredData` | 60 min |

`taskWorker` and `emailPollingWorker` do not use distributed locks — if a second worker instance were deployed (e.g., horizontally scaled), they could process the same task rows concurrently. The `tasks` table update (`status = 'processing'`) provides partial protection but is not atomic under a racing condition. This is low risk under the current single-instance Railway deployment but worth noting if horizontal scaling is considered.
