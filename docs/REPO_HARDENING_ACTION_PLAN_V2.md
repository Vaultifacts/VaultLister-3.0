# VaultLister 3.0 — Repo Hardening Action Plan V2

**Status:** Revised implementation plan  
**Revision basis:** Updated to incorporate Codex review feedback and reduce drift between plan and repository reality  
**Scope:** CI/CD gate trust restoration, observability prerequisites, worker rollout design, platform containment, failed-job operability, and repo-hygiene hardening  
**Target outcome:** Make VaultLister materially more self-defending while preserving rollout safety for a solo operator.

---

## 1. Purpose of this revision

V1 was directionally strong but not implementation-ready enough. The main problems identified in review were:

1. stale repo-state facts
2. under-specified `.test-baseline` migration planning
3. worker split recommendations without deployment topology prerequisites
4. queue simplification being too large for a hardening pass
5. observability sequenced too late
6. missing repo-specific hygiene / trust-restoration work

V2 fixes those problems by narrowing scope, moving observability earlier, and converting the plan into rollout-safe workstreams.

---

## 2. Updated verified current-state findings

These findings are intentionally limited to items that materially affect rollout sequencing.

### 2.1 Test and gate state
- `.test-baseline` now reports `KNOWN_FAILURES=756` at the top of the file.
- The baseline is consumed by multiple enforcement points, not just one workflow:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy.yml`
  - `.husky/pre-push`
- E2E in CI remains disabled in the current main CI workflow.

### 2.2 Production smoke / operations coverage already present
The repository already has stronger production operations coverage than V1 stated. Production smoke and ops tooling already cover multiple important controls, including:
- worker heartbeats
- queue backlog thresholds
- BullMQ failure thresholds
- DB/Redis connectivity
- safe task_queue execution checks

V2 therefore treats smoke and ops as an **existing control to extend**, not a new system to introduce.

### 2.3 Current worker/runtime topology
- There is currently a single `vaultlister-worker` Railway service.
- Current runbooks already warn that worker replica count must stay at 1 until scheduler ownership is separated or locked.
- `worker/index.js` still owns multiple unrelated runtime responsibilities.

### 2.4 Existing worker health surface
- `/api/workers/health` already exists.
- V2 treats that route as a versioned contract that must be explicitly defined before health changes are made.

### 2.5 Async execution reality
- `task_queue` is not local to just one worker file.
- It is referenced by queue tooling, automation flows, scheduler-related behavior, and production smoke.
- Because of this, queue-engine simplification is **not** part of the immediate hardening implementation plan. It is deferred into a separate design/RFC track.

### 2.6 Existing operator tooling and gaps
- The repo already has queue operator tooling in `scripts/queue-ops.mjs`.
- Current task queue schema does **not** natively store every field imagined in V1, such as first failure time, explicit error category, or explicit platform on each task row.
- MVP operator hardening must therefore start from the existing data shape.

### 2.7 Repo-hygiene trust gaps
Codex correctly identified additional repo-specific hardening debt that affects operator trust:
- local lint still references missing `src/frontend/app.js`
- backup/restore docs still contain PostgreSQL/SQLite drift
- secrets-management docs are incomplete as an operational control
- platform breaker design must decide whether to reuse the existing `circuitBreaker.js`

---

## 3. Strategic objective

The goal of V2 is **not** to redesign the entire backend.

The goal is to:
1. restore trust in release gates
2. restore trust in observability and operator artifacts
3. define worker-split rollout safely before implementation
4. improve platform containment
5. improve failed-job operability

This version intentionally removes or defers any change large enough to dominate the whole program unless prerequisite design work is completed first.

---

## 4. Workstream A — gate migration plan (CI + baseline + smoke)

### Objective
Create a trusted release gate without trying to solve the entire 756-failure landscape at once.

### Files
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.husky/pre-push`
- `.test-baseline`
- `package.json`
- `e2e/**`

### Root cause
The current gate is weak because:
- E2E is disabled in CI
- `.test-baseline` is too large and too mixed to represent a trusted release signal
- multiple consumers parse `.test-baseline`, so its structure cannot be changed casually

### Required design decision
Before editing `.test-baseline`, define a **versioned baseline format** and a migration plan for every consumer.

### V2 implementation tasks
1. Inventory every `.test-baseline` consumer and document the current parsing contract.
2. Decide whether to:
   - keep one file with versioned sections, or
   - split into multiple files with an explicit new parser contract.
3. Define the smoke-suite source of truth:
   - which tests are blocking
   - where they live
   - how they are invoked in CI, deploy, and pre-push contexts
4. Re-enable only the **minimal smoke E2E path** as blocking.
5. Keep broad diagnostic suites non-blocking until stabilized.
6. Define rollback behavior if the new parser or gate migration causes friction.

### Acceptance criteria
- A minimal smoke path is blocking in CI.
- Deploy gating is based on trusted checks only.
- `.test-baseline` migration is explicit and parser-safe.
- Pre-push, CI, and deploy use a consistent and documented interpretation of the gate.

### Failure checkpoints
- Do not change baseline structure without updating every parser.
- Do not make the full broad E2E suite blocking as part of this first gate restoration step.

---

## 5. Workstream B — observability and health contract hardening (prerequisite work)

### Objective
Make observability strong enough **before** runtime refactors begin.

### Files
- `src/backend/services/monitoring.js`
- `src/backend/server.js`
- `worker/index.js`
- `.github/workflows/production-smoke.yml`
- any worker health route files / app route files involved in `/api/workers/health`

### Root cause
Observability is currently uneven:
- worker calls `monitoring.init()`
- app imports monitoring but does not initialize it the same way in all paths
- process-level error capture exists, but runtime telemetry needs to be made more explicit before refactors

### Required design decision
Define the `/api/workers/health` contract explicitly before changing it.

### V2 implementation tasks
1. Define a **versioned health contract** for `/api/workers/health`.
2. Document required fields, thresholds, and data sources for each worker domain.
3. Ensure app-side monitoring initialization is explicit and intentional.
4. Ensure worker-side uncaught exception / rejection capture is explicit.
5. Extend existing production smoke to validate the versioned health contract rather than generic assumptions.
6. Add release/version tagging where practical so smoke/telemetry can identify what is running.

### Required minimum `/api/workers/health` contract (V2 target)
For each worker domain reported, the contract should specify:
- `name`
- `status`
- `lastHeartbeatAt`
- `heartbeatAgeSeconds`
- `dataSource`
- `thresholdSeconds`
- `details` (queue lag / stalled count / recent failure count if available)

### Acceptance criteria
- `/api/workers/health` is treated as a stable contract, not an informal shape.
- Production smoke asserts that contract.
- App and worker runtime telemetry are both initialized intentionally.
- Refactors do not proceed without this visibility in place.

### Failure checkpoints
- Do not split the worker first.
- Do not refactor queue ownership first.
- Do not treat in-memory or ad hoc health output as sufficient production truth.

---

## 6. Workstream C — repo hygiene and trust restoration

### Objective
Restore trust in local/operator artifacts before larger system changes.

### Files
- `package.json`
- local lint/syntax scripts
- `docs/BACKUP-RESTORE.md`
- `docs/SECRETS-MANAGEMENT.md`
- any related operational docs

### Root cause
A hardening plan is weaker if the repo still has clearly broken or stale operator artifacts.

### V2 implementation tasks
1. Fix local lint and syntax commands so they reference real paths and can be trusted.
2. Remove PostgreSQL/SQLite drift from backup/restore docs.
3. Expand secrets-management docs so they are usable as an operational control, not just a placeholder.
4. Verify that local operator instructions match current production architecture.

### Acceptance criteria
- `bun run lint` and related local trust commands are meaningful.
- Backup/restore docs reflect current database reality.
- Secrets-management docs are actionable enough for operator use.

### Failure checkpoints
- Do not leave broken local gates in place while improving CI gates.
- Do not keep stale SQLite wording in PostgreSQL-era operational runbooks.

---

## 7. Workstream D — worker split rollout design (not immediate implementation)

### Objective
Produce an infrastructure-aware worker split plan before changing runtime topology.

### Files
- `worker/index.js`
- `worker/Dockerfile`
- `worker/railway.json`
- Railway/runbook docs
- relevant worker/service files

### Root cause
V1 recommended a worker split without a topology and rollback plan. That is unsafe.

### V2 scope
This workstream is **design-first**. The immediate output is a rollout design, not code changes.

### Required questions to answer
1. What Railway services would exist after the split?
2. Which service owns singleton scheduler responsibilities?
3. Which env vars and secrets belong to which service?
4. What health endpoints or health contracts are required for each service?
5. What is the deploy order?
6. What is the rollback order?
7. What is the ownership of `priceCheckWorker` and `gdprWorker` in the target runtime map?

### Suggested target runtime map to validate
- `vaultlister-worker-automation`
- `vaultlister-worker-scheduler`
- `vaultlister-worker-task`
- optional `vaultlister-worker-email`

### Acceptance criteria
- Railway topology is explicit.
- Singleton scheduler ownership is explicit.
- Rollback order is documented.
- No runtime split begins until the rollout design is approved.

### Failure checkpoints
- Do not split the current worker while scheduler singleton ownership is ambiguous.
- Do not increase worker replicas beyond documented safe ownership rules.

---

## 8. Workstream E — platform containment and breaker design

### Objective
Contain marketplace instability without introducing parallel failure-handling models unnecessarily.

### Files
- `src/backend/workers/taskWorker.js`
- `worker/index.js`
- `src/shared/circuitBreaker.js`
- platform automation and platform sync code

### Root cause
V1 proposed kill switches and circuit breakers, but did not decide whether they extend the existing breaker abstraction or create a second model.

### Required design decision
Explicitly decide whether platform containment should:
- reuse/extend `src/backend/shared/circuitBreaker.js`, or
- introduce a separate model for platform breakers

V2 recommendation: **prefer reuse/extension unless a clear incompatibility exists**.

### V2 implementation tasks
1. Audit existing breaker usage and capabilities.
2. Decide whether it is sufficient for platform containment.
3. Define a platform control-plane schema with fields such as:
   - `enabled`
   - `allowPublish`
   - `allowRefresh`
   - `allowShare`
   - `maxConcurrency`
   - `breakerState`
   - `cooldownUntil`
4. Define where those controls live (DB/config/Redis/etc.).
5. Enforce the controls in platform execution paths.

### Acceptance criteria
- Platform failure handling does not fork into unrelated breaker models without reason.
- One marketplace can be disabled or quarantined without affecting others.
- Breaker state is visible to health and operator tooling.

---

## 9. Workstream F — failed-job operability MVP

### Objective
Improve operator handling of failed jobs using current data realities first.

### Files
- `scripts/queue-ops.mjs`
- `src/backend/workers/taskWorker.js`
- relevant API/pages if added
- `src/backend/db/pg-schema.sql`

### Root cause
V1 asked for fields that current schema does not store. MVP should begin from current available fields.

### V2 implementation tasks
1. Audit current queue-ops capabilities and current task_queue schema.
2. Define MVP operator flows around existing fields first:
   - list failed jobs
   - inspect current error / attempts / status / timestamps already present
   - retry / requeue / abandon flows
3. Only then identify minimal schema additions required for richer triage, such as:
   - first failure timestamp
   - normalized error category
   - platform hint if needed
4. Keep the first version simple and operationally useful.

### Acceptance criteria
- Operator tooling is improved without requiring a large schema redesign up front.
- Failed-job review starts from real current fields and scripts.
- Any schema additions are explicit and justified.

---

## 10. Deferred track — async engine simplification RFC

### Status
**Deferred / not part of immediate hardening implementation**

### Reason
Queue-engine simplification is too large and too cross-cutting to remain an implementation item inside the initial hardening pass.

### Scope of deferred RFC
- task_queue role in automations
- task_queue role in scripts/queue-ops.mjs
- task_queue role in production smoke
- relationship to BullMQ execution
- rollback plan if execution semantics change

### Output required later
A separate design document/RFC with:
- target architecture
- migration stages
- data compatibility plan
- rollout metrics
- rollback strategy

---

## 11. Recommended execution order

### Phase 1 — trust restoration
1. Workstream A — gate migration plan
2. Workstream B — observability and health contract hardening
3. Workstream C — repo hygiene and trust restoration

### Phase 2 — design the safe topology changes
4. Workstream D — worker split rollout design
5. Workstream E — platform containment and breaker design

### Phase 3 — targeted operability improvements
6. Workstream F — failed-job operability MVP

### Deferred
7. Async engine simplification RFC

---

## 12. Claude Code prompt pack (V2)

### Prompt 1 — gate migration plan
```text
Operate in strict engineering mode.

Repo objective:
Design a safe gate-migration plan for VaultLister that restores deploy trust without trying to fix the entire 756-failure baseline first.

Tasks:
1. Inspect .github/workflows/ci.yml, .github/workflows/deploy.yml, .husky/pre-push, .test-baseline, package.json, and the current E2E entrypoints.
2. Inventory every consumer of .test-baseline and document the parsing contract.
3. Design a versioned baseline migration plan or an explicit multi-file replacement plan.
4. Define the minimal smoke E2E suite that should become blocking.
5. Specify rollout order and rollback plan.

Output required:
- verified findings
- exact consumer map
- proposed gate model
- rollout order
- rollback plan
- acceptance criteria
```

### Prompt 2 — observability and health contract hardening
```text
Operate in strict engineering mode.

Repo objective:
Make observability and worker health strong enough before any worker/runtime refactors begin.

Tasks:
1. Inspect src/backend/services/monitoring.js, src/backend/server.js, worker/index.js, .github/workflows/production-smoke.yml, and any worker health routes.
2. Define the current and target /api/workers/health contract.
3. Identify missing initialization, missing error capture, and missing release/version visibility.
4. Propose exact file-level changes to make telemetry and health contract explicit.

Output required:
- verified findings
- exact health contract
- exact file changes proposed
- rollout sequence
- failure checkpoints
```

### Prompt 3 — worker split rollout design
```text
Operate in strict engineering mode.

Repo objective:
Design a safe worker topology split for Railway without implementing it yet.

Tasks:
1. Inspect worker/index.js, worker/Dockerfile, worker/railway.json, current runbooks, and worker/service ownership.
2. Produce a target runtime map.
3. Specify scheduler singleton ownership, env/secret ownership, health contract expectations, deploy order, and rollback order.
4. Explicitly assign ownership of priceCheckWorker and gdprWorker in the target design.

Output required:
- verified current-state responsibilities
- target Railway service map
- rollout order
- rollback order
- unresolved prerequisites
```

### Prompt 4 — platform containment design
```text
Operate in strict engineering mode.

Repo objective:
Add platform kill-switch and breaker design without fragmenting failure-handling abstractions.

Tasks:
1. Inspect src/backend/workers/taskWorker.js, worker/index.js, src/shared/circuitBreaker.js, and relevant platform execution paths.
2. Decide whether platform containment should reuse or extend circuitBreaker.js.
3. Propose the platform control-plane schema and enforcement points.
4. Keep rollout safe and explicit.

Output required:
- verified findings
- breaker reuse decision
- control-plane schema
- enforcement points
- acceptance criteria
```

### Prompt 5 — failed-job operability MVP
```text
Operate in strict engineering mode.

Repo objective:
Improve failed-job operability starting from the current schema and current queue tooling.

Tasks:
1. Inspect scripts/queue-ops.mjs, task_queue schema, and current task failure handling.
2. Define an MVP operator flow using existing fields first.
3. Identify minimal schema additions only if clearly necessary.
4. Focus on what lowers manual DB/log digging fastest.

Output required:
- verified findings
- MVP operator flow
- exact scripts/routes/pages to change
- optional schema additions with justification
- acceptance criteria
```

---

## 13. Definition of done for V2 planning

This revised hardening plan is considered implementation-ready enough to proceed when:

1. Gate migration has a parser-safe baseline rollout plan.
2. Observability and `/api/workers/health` are treated as prerequisites, not late cleanup.
3. Repo trust gaps in lint/docs/secrets are addressed or explicitly queued.
4. Worker split has a topology design before any runtime decomposition starts.
5. Platform breaker design explicitly decides whether to reuse the existing breaker abstraction.
6. Failed-job operability MVP is grounded in the current schema/tooling, not imagined fields.
7. Queue-engine simplification is deferred into its own RFC instead of hiding inside the hardening stream.

---

## 14. Summary

VaultLister still does **not** need a rebuild.

But the next step is not “start implementing V1.” The next step is to use this revised V2 as the execution-safe plan:
- restore gate trust
- restore observability trust
- restore repo/operator artifact trust
- design topology changes safely before implementation
- improve containment and operability in narrow, repo-accurate increments

That is the highest-confidence path to lowering solo maintenance burden without introducing rollout chaos.
