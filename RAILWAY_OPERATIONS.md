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

## Automated Production Smoke

GitHub Actions runs `.github/workflows/production-smoke.yml`:

- every 15 minutes
- manually through `workflow_dispatch`
- after the `Deploy` workflow completes successfully

The workflow runs the CI-stable production smoke checks with three attempts and a 30 second settle delay between attempts:

- app readiness
- worker heartbeat health
- safe `task_queue` smoke
- queue backlog and failure thresholds

WebSocket Redis pub/sub is intentionally excluded from the scheduled GitHub workflow because GitHub-hosted runners produced false WebSocket connect errors against the production edge while the same check passed from the Railway-linked operator shell. Keep WebSocket verification in the full manual smoke command:

```powershell
bun run ops:smoke:prod
```

If all scheduled attempts fail, the workflow opens or updates a GitHub issue labeled `production-smoke-failure`. When checks recover, it closes the open issue.

Required GitHub repository secrets:

- `JWT_SECRET`
- `DATABASE_PUBLIC_URL`
- `REDIS_PUBLIC_URL`

Manual trigger:

```powershell
gh workflow run production-smoke.yml
```

Check latest runs:

```powershell
gh run list --workflow production-smoke.yml --limit 5
```

## Queue Operations

Use these commands only from a trusted shell with production credentials loaded. Read-only commands do not modify production data.

Load credentials from Railway:

```powershell
$pgVarsJson = railway variable list -s Postgres -e production --json
$pgVars = $pgVarsJson | ConvertFrom-Json
$redisVarsJson = railway variable list -s Redis -e production --json
$redisVars = $redisVarsJson | ConvertFrom-Json
$env:DATABASE_URL = $pgVars.DATABASE_PUBLIC_URL
$env:REDIS_PUBLIC_URL = $redisVars.REDIS_PUBLIC_URL
```

Inspect queues:

```powershell
bun run ops:queue summary
bun run ops:queue list-failed --limit 20
bun run ops:queue list-stale --minutes 5 --limit 20
bun run ops:queue bullmq-failed --limit 20
```

Requeue one failed task after reviewing it:

```powershell
bun run ops:queue requeue-failed --id TASK_ID --yes
```

Requeue one stale processing task:

```powershell
bun run ops:queue requeue-stale --id TASK_ID --minutes 5 --yes
```

Requeue all stale processing tasks older than the threshold:

```powershell
bun run ops:queue reset-stale --minutes 10 --yes
```

Failure checkpoints:

- Do not requeue a task if the underlying platform credentials are invalid.
- Do not reset stale tasks while a worker deployment is actively starting or stopping.
- Do not use `reset-stale` until `list-stale` has been reviewed first.

## Rollback Runbook

Use rollback when the newest deployment is unhealthy and a prior deployment is known good.

1. Confirm current state:

```powershell
railway deployment list -s vaultlister-app --json
railway deployment list -s vaultlister-worker --json
bun run ops:smoke:prod
```

2. Roll back the failing service in Railway dashboard:

- Open Railway project `vaultlister`.
- Select the failing service.
- Open `Deployments`.
- Choose the latest known-good successful deployment.
- Use Railway's redeploy/rollback action for that deployment.

3. Prefer rollback order based on failure type:

- API/web/frontend failure: roll back `vaultlister-app` first.
- Worker/scheduler/automation failure: roll back `vaultlister-worker` first.
- Shared schema or queue-contract failure: roll back both services to the same known-good commit.

4. Verify after rollback:

```powershell
bun run ops:smoke:prod
railway service logs -s vaultlister-app -n 200
railway service logs -s vaultlister-worker -n 200
```

Expected result: app readiness, worker heartbeat health, task queue smoke, queue thresholds, and WebSocket pub/sub all pass.

Failure checkpoints:

- Stop if app and worker are on incompatible commits and queue jobs are failing.
- Stop if database migrations ran in the bad deploy and are not backward compatible.
- Stop if worker heartbeats stay stale after rollback; inspect worker logs before retrying.

## Controlled Scale Test

Run this only during a quiet production window.

Scale API to two replicas, verify cross-replica behavior, then return to one:

```powershell
railway scale -s vaultlister-app -e production --us-west2=2
Start-Sleep -Seconds 60
bun run ops:smoke:prod
railway scale -s vaultlister-app -e production --us-west2=1
```

Scale worker to two replicas, verify queue safety, then return to one:

```powershell
railway scale -s vaultlister-worker -e production --us-west2=2
Start-Sleep -Seconds 60
bun run ops:smoke:prod
railway scale -s vaultlister-worker -e production --us-west2=1
```

Expected result:

- WebSocket Redis pub/sub smoke passes with two API replicas.
- Safe `task_queue` smoke completes exactly once with two worker replicas.
- Queue thresholds remain below configured limits.

Failure checkpoints:

- Immediately scale back to one replica if duplicate task execution is observed.
- Immediately scale back if worker heartbeat health becomes stale.
- Keep scale changes out of active deploy windows to avoid mixing rollout and capacity signals.
