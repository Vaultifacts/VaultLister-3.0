# VaultLister 3.0 — Repo Hardening Action Plan

**Status:** Draft implementation plan  
**Scope:** CI/CD hardening, worker isolation, queue resilience, platform containment, monitoring, and test-debt reduction  
**Target outcome:** Make VaultLister materially more self-defending and lower the solo operator burden at scale.

---

## 1. Verified current-state findings

These findings are based on the current repository state and are intended to anchor the work plan to actual evidence rather than assumptions.

### 1.1 CI/CD
- `.github/workflows/ci.yml` includes lint, unit tests, security scan, dependency audit, Docker build, accessibility audit, visual tests, performance check, and build.
- The E2E job is currently disabled with `if: false` and is marked `continue-on-error: true` in comments for when it is re-enabled.
- `.github/workflows/deploy.yml` gates deploy on a test job, but the test job still tolerates known baseline failures.
- `.github/workflows/production-smoke.yml` runs every 15 minutes and after successful deploy workflows, and auto-opens/closes GitHub issues on failure/recovery.

### 1.2 Test baseline
- `.test-baseline` currently carries `KNOWN_FAILURES=585`.
- The baseline includes a wide mix of categories: auth/CSRF, monitoring, task worker, notification service, platform sync, AI routes, migration legacy tests, and external-service dependent failures.
- The current baseline is too broad to serve as a high-trust release signal.

### 1.3 Worker/runtime architecture
- `worker/index.js` currently runs multiple responsibilities inside one process:
  - BullMQ automation worker
  - token refresh scheduler
  - sync scheduler
  - task worker
  - email polling worker
  - price check worker
  - GDPR worker
  - monitoring init
  - cleanup loops
- `worker/Dockerfile` health check currently validates process presence via `pgrep`, which is only a liveness signal.
- `worker/railway.json` includes a restart policy and draining/overlap behavior.

### 1.4 Queueing
- The repo currently uses both:
  - BullMQ/Redis for automation jobs
  - PostgreSQL `task_queue` for DB-backed task scheduling/execution
- Retry logic exists in both systems.
- Redis locks are already used in several places to prevent duplicate periodic work.

### 1.5 Monitoring / observability
- `src/backend/services/monitoring.js` supports Sentry, DB-backed alerts/error logging, Slack/email alerting, health checks, and internal metrics.
- Internal metrics storage is still partly in-memory and explicitly noted as demo-style in comments.
- Production smoke monitoring already exists and is one of the strongest current operational controls.

### 1.6 Platform automation
- Platform-specific routing exists in `src/backend/workers/taskWorker.js`.
- Platform-specific job types exist in `worker/index.js`.
- I did **not** find a verified, centralized platform kill-switch / circuit-breaker control plane in the current implementation.

---

## 2. Strategic goal

The goal is **not** to rewrite VaultLister.

The goal is to perform a **hardening pass** that makes the current system:
- safer to deploy
- easier to observe
- easier to recover
- more isolated when marketplace automation breaks
- less dependent on manual intervention by a solo operator

This plan is organized into workstreams that can be executed incrementally.

---

## 3. Workstream A — CI/CD hardening

### Objective
Convert CI from a broad-but-permissive signal into a smaller, trusted release gate.

### Files
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/production-smoke.yml`
- `.test-baseline`
- `package.json`

### Problems to solve
1. Critical E2E protection is effectively off.
2. The main test signal is diluted by a giant baseline.
3. Advisory checks and release-critical checks are mixed together.

### Implementation tasks
1. Split CI into **required blocking** vs **advisory** jobs.
2. Add a **small smoke E2E suite** and make it required.
3. Keep broad E2E, visual, and long-form diagnostic suites advisory until stabilized.
4. Ensure deploy is gated on only trusted required checks.
5. Keep `production-smoke.yml` as a post-deploy and scheduled external monitor.

### Acceptance criteria
- A small smoke E2E suite runs in CI on PRs and pushes.
- That smoke E2E suite is blocking.
- Deploy is gated by required checks only.
- Broad diagnostic suites can fail without falsely signaling release unsafety.

### Notes
Do **not** attempt to make all 585 known failures disappear before recovering deploy trust. Rebuild trust first with a smaller required path.

---

## 4. Workstream B — test baseline decomposition

### Objective
Turn `.test-baseline` into actionable debt instead of one undifferentiated bucket.

### Files
- `.test-baseline`
- `src/tests/**`
- `.github/workflows/ci.yml`

### Implementation tasks
1. Split baseline debt by category, either by file or workflow grouping:
   - core-blocking
   - extended-diagnostic
   - migration-legacy
   - external-service
2. Triage each baseline item into one of:
   - fix
   - rewrite
   - remove obsolete test
   - move to advisory workflow
3. Create a burn-down issue or project grouping that tracks counts by category.

### Acceptance criteria
- Baseline items are grouped into meaningful categories.
- Core blocking tests are separated from migration legacy and diagnostic noise.
- New regressions are easy to identify without digging through unrelated debt.

---

## 5. Workstream C — critical E2E smoke path

### Objective
Restore a trusted browser-level release gate.

### Files
- `.github/workflows/ci.yml`
- `package.json`
- `e2e/**`

### Recommended minimum smoke coverage
- sign in
- dashboard loads
- create listing
- save draft
- publish listing mock path or safe publish path
- billing/settings page loads
- one integration/connect page renders

### Implementation tasks
1. Add a dedicated smoke test project or tag set.
2. Add scripts in `package.json`:
   - `test:e2e:smoke`
   - `test:e2e:critical`
   - `test:e2e:full`
3. Wire `test:e2e:smoke` into required CI.
4. Leave `test:e2e:full` diagnostic until stable.

### Acceptance criteria
- Core user journeys are browser-tested in blocking CI.
- E2E is no longer fully disabled.
- Production deploys are no longer blind to browser regressions.

---

## 6. Workstream D — worker runtime split

### Objective
Reduce background-job blast radius and make health/ownership clearer.

### Files
- `worker/index.js`
- `worker/Dockerfile`
- `worker/railway.json`
- `src/backend/workers/**`
- `src/backend/services/**`

### Current problem
One worker process currently owns too many unrelated responsibilities.

### Recommended target structure
- `worker/automation/index.js`
- `worker/task/index.js`
- `worker/scheduler/index.js`
- `worker/email/index.js` (optional if needed)

### Responsibilities
#### automation worker
- BullMQ automation jobs
- browser automation only

#### task worker
- DB-backed task execution (temporary until further consolidation)

#### scheduler worker
- token refresh scheduling
- sync schedule checks
- summaries
- cleanup jobs

#### email worker (optional)
- email polling / email-related background jobs

### Acceptance criteria
- A crash or memory issue in one background domain does not restart all others.
- Each worker has a clear purpose and separate health view.
- Deploy/restart impact is reduced.

---

## 7. Workstream E — worker health and capability checks

### Objective
Replace process-only liveness with meaningful capability health.

### Files
- `worker/Dockerfile`
- `worker/index.js`
- `src/backend/services/monitoring.js`
- any health route files used by `/api/workers/health`

### Implementation tasks
1. Add worker-specific capability checks for:
   - DB ping
   - Redis ping
   - queue lag threshold
   - failed job threshold
   - stalled processing threshold
   - last heartbeat freshness
2. Publish per-worker health state through Redis keys or explicit health endpoints.
3. Update smoke checks to assert capability health, not just process presence.

### Acceptance criteria
- Worker health proves useful operational capability.
- Unhealthy queues/stalls/failure surges show up in health.
- Health is specific enough to identify which worker domain is degraded.

---

## 8. Workstream F — async model simplification

### Objective
Reduce split-brain queue semantics and unify operational behavior.

### Files
- `src/backend/workers/taskWorker.js`
- `worker/index.js`
- related queue/scheduling routes/services

### Current problem
Execution is split across BullMQ and Postgres `task_queue`.

### Recommended direction
Use BullMQ as the dominant execution plane while retaining Postgres as:
- business/audit state
- scheduling metadata
- user-visible history/status

### Implementation tasks
1. Audit all task types in `taskWorker.js`.
2. Decide which tasks should move fully to BullMQ execution.
3. Keep DB state transitions for audit/history while moving actual execution semantics toward BullMQ.
4. Avoid adding more custom executor logic to the DB queue unless it is explicitly required.

### Acceptance criteria
- Retry logic is easier to reason about.
- Queue observability is simpler.
- The system has one dominant async execution engine.

---

## 9. Workstream G — idempotency hardening

### Objective
Make retries safe and eliminate duplicate external actions where possible.

### Files
- `src/backend/workers/taskWorker.js`
- `worker/index.js`
- webhook processing services/routes
- email sending services
- publish/sync/automation services

### Implementation tasks
1. Define deterministic idempotency keys for every external side-effect action.
2. Use stable BullMQ `jobId` values where appropriate.
3. Add dedupe guards for:
   - publish listing
   - automation run windows
   - daily summaries
   - webhook processing
   - sync windows
   - email sends tied to specific events
4. Record idempotency state in DB or Redis where needed.

### Example key patterns
- `publish_listing:{listingId}`
- `automation:{ruleId}:{yyyy-mm-dd-hh-mm}`
- `daily_summary:{userId}:{yyyy-mm-dd}`
- `webhook:{provider}:{eventId}`
- `sync_shop:{shopId}:{windowStart}`
- `email:{template}:{userId}:{entityId}`

### Acceptance criteria
- Retries do not routinely duplicate external user-visible effects.
- Queue replays are safer.
- Manual cleanup from duplicate side effects is reduced.

---

## 10. Workstream H — failed-job operability

### Objective
Give the operator a structured way to inspect and act on failures.

### Files
- `src/backend/workers/taskWorker.js`
- `src/backend/routes/**`
- `src/frontend/pages/**`
- `scripts/queue-ops.mjs`

### Implementation tasks
1. Add a failed-job view or operator route/page.
2. Include fields such as:
   - job id
   - type
   - platform
   - attempts
   - first failure time
   - last failure time
   - error category
   - retry action
   - abandon action
   - mute platform action
3. Add grouped views by platform and job type.
4. Link jobs to audit/notification context if possible.

### Acceptance criteria
- The operator can inspect and requeue/abandon failed jobs without raw DB spelunking.
- Platform-specific failure clusters are visible.
- Incident handling time decreases.

---

## 11. Workstream I — platform kill switches and circuit breakers

### Objective
Ensure one marketplace can fail without dragging the whole app into operator work.

### Files
- `src/backend/workers/taskWorker.js`
- `worker/index.js`
- `src/shared/automations/**`
- platform sync/automation service files

### Implementation tasks
1. Add a platform control plane with fields such as:
   - `enabled`
   - `allowPublish`
   - `allowRefresh`
   - `allowShare`
   - `maxConcurrency`
   - `breakerState`
   - `cooldownUntil`
2. Enforce those controls before platform job execution.
3. Add failure-window tracking and automatic circuit breaking.
4. Surface breaker state in operator tooling and health checks.

### Example breaker policy
- If a platform has 5 failures in 15 minutes, open the breaker for 30 minutes.
- New tasks for that platform are skipped/quarantined while the breaker is open.

### Acceptance criteria
- A broken marketplace can be isolated immediately.
- Platform instability becomes a localized issue.
- The operator can disable a marketplace without redeploying code.

---

## 12. Workstream J — queue partitioning by platform

### Objective
Improve containment and future throughput planning.

### Files
- `worker/index.js`
- BullMQ queue creation sites
- task routing code

### Implementation tasks
1. Consider per-platform queue names or queue groups:
   - `automation:poshmark`
   - `automation:mercari`
   - `automation:depop`
   - etc.
2. Keep concurrency 1 initially if platform fragility warrants it.
3. Use per-platform metrics and health thresholds.

### Acceptance criteria
- Queue lag is attributable by platform.
- Throughput and instability are easier to isolate.
- Future concurrency tuning is safer.

---

## 13. Workstream K — observability hardening

### Objective
Keep current internal monitoring, but ensure production truth comes from durable signals.

### Files
- `src/backend/services/monitoring.js`
- app/worker entrypoints
- `.github/workflows/production-smoke.yml`

### Implementation tasks
1. Ensure Sentry initialization/reporting is present across all runtime entrypoints.
2. Treat in-app monitoring stats as secondary diagnostics, not sole truth.
3. Expand production smoke to assert:
   - queue lag
   - worker heartbeat freshness
   - failed-job thresholds
   - DB and Redis connectivity
   - platform breaker status visibility
4. Tie release identifiers into monitoring if practical.

### Acceptance criteria
- Production debugging does not depend solely on in-memory metrics.
- Failures are visible through durable signals.
- Smoke checks reflect real operational readiness.

---

## 14. Workstream L — migration/test-debt cleanup

### Objective
Stop carrying obsolete test debt from old architecture assumptions.

### Files
- `.test-baseline`
- `src/tests/**`
- `src/backend/db/**`

### Implementation tasks
1. Classify migration-era failures into:
   - still valid and must fix
   - obsolete and should delete
   - valid but needs Postgres-aware rewrite
2. Remove tests that assert old SQLite-only behavior if those assumptions are no longer relevant.
3. Rewrite tests to reflect current production architecture rather than historic implementation details.

### Acceptance criteria
- The test suite reflects current system truth.
- Legacy migration noise stops polluting release confidence.
- Remaining failures are actionable and current.

---

## 15. Recommended execution order

### Phase 1 — restore deploy trust
1. Workstream A — CI/CD hardening
2. Workstream B — baseline decomposition
3. Workstream C — critical E2E smoke path

### Phase 2 — reduce background-job blast radius
4. Workstream D — worker runtime split
5. Workstream E — worker health and capability checks

### Phase 3 — make async safe
6. Workstream F — async model simplification
7. Workstream G — idempotency hardening
8. Workstream H — failed-job operability

### Phase 4 — isolate marketplace instability
9. Workstream I — platform kill switches and circuit breakers
10. Workstream J — queue partitioning by platform

### Phase 5 — improve production truth
11. Workstream K — observability hardening
12. Workstream L — migration/test-debt cleanup

---

## 16. Claude Code implementation prompt pack

These prompts are intended to be pasted into Claude Code as focused work packets.

### Prompt 1 — CI hardening
```text
Operate in strict engineering mode.

Repo objective:
Rework VaultLister CI so that required release gates are small, trusted, and blocking, while broad diagnostic suites remain advisory.

Tasks:
1. Inspect .github/workflows/ci.yml, .github/workflows/deploy.yml, package.json, and .test-baseline.
2. Create a concrete plan to split required blocking checks from advisory diagnostic checks.
3. Re-enable only a minimal smoke E2E path for blocking CI.
4. Do not make the full E2E suite blocking yet.
5. Minimize noise while improving actual deploy trust.

Output required:
- verified findings
- exact file changes proposed
- acceptance criteria
- rollback considerations
- any risks or unknowns
```

### Prompt 2 — worker split
```text
Operate in strict engineering mode.

Repo objective:
Split the current worker/index.js monolith into smaller runtime entrypoints with clearer blast-radius boundaries.

Tasks:
1. Inspect worker/index.js, worker/Dockerfile, worker/railway.json, and related worker/service files.
2. Propose a concrete target runtime split: automation worker, task worker, scheduler worker, and optional email worker.
3. Specify exact file moves/new files and what each runtime owns.
4. Preserve current behavior where possible while reducing blast radius.

Output required:
- verified current worker responsibilities
- proposed file structure
- exact migration steps
- health check implications
- failure checkpoints
```

### Prompt 3 — idempotency and queue hardening
```text
Operate in strict engineering mode.

Repo objective:
Make retries safer and reduce duplicate side effects across async processing.

Tasks:
1. Inspect worker/index.js, src/backend/workers/taskWorker.js, webhook processing, email sending, and publish/sync flows.
2. Identify where deterministic idempotency keys and/or BullMQ jobIds should be added.
3. Propose an implementation plan that minimizes duplicate external actions.
4. Be explicit about where DB or Redis state is needed.

Output required:
- verified findings
- per-job-type idempotency scheme
- exact file-level implementation plan
- expected result
- risks and tradeoffs
```

### Prompt 4 — platform containment
```text
Operate in strict engineering mode.

Repo objective:
Add platform kill switches, circuit breakers, and clearer per-platform isolation for automation jobs.

Tasks:
1. Inspect platform execution paths in taskWorker.js, worker/index.js, and shared automation code.
2. Design a concrete platform control plane for enable/disable, per-action allow flags, max concurrency, and breaker state.
3. Propose how failures should open and close circuit breakers.
4. Ensure one platform failure does not force global operational work.

Output required:
- verified findings
- control-plane schema
- enforcement points in code
- breaker behavior
- acceptance criteria
```

### Prompt 5 — failed-job operability
```text
Operate in strict engineering mode.

Repo objective:
Create a practical solo-operator failed-job review flow.

Tasks:
1. Inspect queue/task failure handling paths and any existing operator tooling.
2. Propose an internal API/page or CLI path to list, inspect, retry, abandon, and group failed jobs.
3. Focus on what reduces manual DB/log digging.

Output required:
- verified findings
- exact routes/pages/scripts to add or modify
- data shape for failed job inspection
- acceptance criteria
- minimal viable first version
```

---

## 17. Definition of done

This hardening plan is considered materially successful when all of the following are true:

1. A small E2E smoke path is blocking in CI.
2. The release gate is no longer dependent on a giant mixed baseline.
3. Worker responsibilities are split enough to reduce blast radius.
4. Worker health reflects actual operational capability.
5. Idempotency exists for major external side-effect paths.
6. Failed jobs are reviewable and actionable without raw DB spelunking.
7. Platforms can be disabled or automatically quarantined independently.
8. Production smoke reflects actual subsystem health and queue safety.

---

## 18. Summary

VaultLister 3.0 does **not** need a rebuild.

It needs a focused hardening pass centered on:
- trusted CI gates
- worker isolation
- queue/idempotency safety
- platform containment
- production-grade operability

The fastest path to lower maintenance is **not** more features. It is to make the current system narrower, stricter, and easier to recover when a platform or deploy goes sideways.
