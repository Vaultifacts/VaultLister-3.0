# Railway Operations Runbook

## Service Roles

- `vaultlister-app`: API, frontend, WebSocket server.
- `vaultlister-worker`: BullMQ automation worker, schedulers, email polling, price checks, GDPR worker, cleanup jobs.
- `Postgres`: production database.
- `Redis`: BullMQ, worker heartbeats, WebSocket pub/sub.

## Healthy State

`vaultlister-worker` logs must include:

```text
[Worker] Database connected
[Worker] Redis service initialized
[Worker] Listening on queue: automation-jobs
[TaskWorker] Worker started
```

`vaultlister-worker` logs must not include:

```text
Server running at http://localhost:8080
[Server] Started
```

Health endpoints must pass:

```powershell
curl.exe -s https://vaultlister.com/api/health/ready
curl.exe -s https://vaultlister.com/api/workers/health
```

Expected:

```json
{"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

```json
{"overall":"ok"}
```

## Standard Post-Deploy Check

Run the public health checks:

```powershell
bun run ops:health:prod
```

Run full smoke checks when production credentials are available locally:

```powershell
$appVarsJson = railway variable list -s vaultlister-app -e production --json
$appVars = $appVarsJson | ConvertFrom-Json
$pgVarsJson = railway variable list -s Postgres -e production --json
$pgVars = $pgVarsJson | ConvertFrom-Json
$redisVarsJson = railway variable list -s Redis -e production --json
$redisVars = $redisVarsJson | ConvertFrom-Json
$env:JWT_SECRET = $appVars.JWT_SECRET
$env:DATABASE_URL = $pgVars.DATABASE_PUBLIC_URL
$env:REDIS_PUBLIC_URL = $redisVars.REDIS_PUBLIC_URL
bun run ops:smoke:prod
```

The full smoke check verifies app readiness, worker heartbeats, safe `task_queue` claiming/completion, queue backlog thresholds, BullMQ failure thresholds, and WebSocket Redis pub/sub delivery with a synthetic user.

Optional threshold environment variables:

- `TASK_QUEUE_PENDING_MAX`, default `50`
- `TASK_QUEUE_FAILED_24H_MAX`, default `10`
- `TASK_QUEUE_STALE_PROCESSING_MAX`, default `0`
- `BULLMQ_WAITING_MAX`, default `50`
- `BULLMQ_FAILED_MAX`, default `10`
