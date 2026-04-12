# VaultLister 3.0 — Repo Hardening Action Plan V2.1

**Status:** Decision-complete Phase 1 planning revision  
**Revision basis:** V2 corrected major sequencing and scope issues; V2.1 pins the remaining concrete decisions required before Phase 1 implementation begins  
**Scope:** Gate migration, health/observability contract hardening, repo trust restoration, worker split rollout design, platform containment design, and failed-job operability MVP  
**Target outcome:** Make Phase 1 implementation-safe without inventing policy mid-stream or drifting from actual repo behavior.

---

## 1. Why V2.1 exists

V2 was substantially better than V1, but still left 4 critical blockers open:

1. baseline migration was still phrased as a decision instead of a pinned plan
2. smoke-suite creation was still conceptual rather than explicit
3. `/api/workers/health` was still too abstract relative to current repo state
4. `circuitBreaker.js` path references were still wrong in places

V2.1 resolves those blockers directly.

---

## 2. Updated verified current-state facts that Phase 1 depends on

### 2.1 `.test-baseline` consumers are grep-based today
Current baseline consumers are grep/sed based and expect the current token style:
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.husky/pre-push`

Important detail: `.husky/pre-push` currently warns on non-comment, non-empty lines that are not `KNOWN_FAIL...`. That means optional section headers cannot be introduced safely until the validator is updated to intentionally ignore them.

### 2.2 Current worker health route uses concrete emitted worker keys
`/api/workers/health` currently reports these concrete worker domains:
- `taskWorker`
- `gdprWorker`
- `priceCheckWorker`
- `emailPollingWorker`
- `tokenRefreshScheduler`

These are the correct initial domains for the Phase 1 health contract. Phase 1 must not rename them to abstract role groups before runtime topology changes exist.

### 2.3 There is currently no smoke E2E command or smoke tagging system
Current `package.json` includes:
- `test:e2e:all`
- `test:e2e:ui`
- `test:e2e:headed`

There is no current `test:e2e:smoke` script and no established `@smoke` tag system in the repo. Phase 1 therefore must create one explicitly rather than assuming it already exists.

### 2.4 Correct breaker path
The current correct path is:
- `src/backend/shared/circuitBreaker.js`

Any reference to `src/shared/circuitBreaker.js` is wrong.

---

## 3. Strategic objective

The objective remains unchanged:
1. restore trust in release gates
2. restore trust in observability and operator artifacts
3. define worker-split rollout safely before implementation
4. improve platform containment
5. improve failed-job operability

But V2.1 locks the Phase 1 decisions so implementation can begin without more planning drift.

---

## 4. Workstream A — gate migration plan (LOCKED)

### Objective
Create a trusted release gate without trying to solve the full 756-failure landscape at once.

### Files
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.husky/pre-push`
- `.test-baseline`
- `package.json`
- `e2e/**`

### Locked decisions
#### A1. Baseline file structure
Keep a **single `.test-baseline` file** for Phase 1.

Do **not** split into multiple files in Phase 1.

#### A2. Canonical baseline tokens
Phase 1 canonical baseline tokens remain:
- `KNOWN_FAILURES=<n>`
- `KNOWN_FAIL: <test name>`

These remain the source of truth for all existing consumers.

#### A3. Optional section headers are allowed only after parser support lands
Optional future section headers may be added, but **only after** every parser/validator is updated to ignore them intentionally.

The section-header feature is therefore gated behind parser support.

### Required parser migration order
1. Update `.husky/pre-push` validation so it explicitly ignores:
   - comments
   - blank lines
   - `KNOWN_FAILURES=` lines
   - optional future section headers such as `[core-blocking]`
2. Update any grep-based logic in CI/deploy that would mis-handle future section headers.
3. Commit parser support first.
4. Only after parser support lands, optionally introduce section headers.
5. Only after that, enforce any section-aware behavior.

### Smoke-suite locked creation plan
Phase 1 will create a **new blocking smoke command**:

```bash
bun run test:e2e:smoke
```

### Smoke-suite creation mechanism
Phase 1 initial implementation must use a **dedicated grep/tag or dedicated spec manifest**, but the first implementation must pin exact membership. To prevent ambiguity, the first version should use a dedicated script that invokes an explicit manifest or explicit grep targets, not a vague future tag taxonomy.

### Initial smoke membership (exact Phase 1 target)
The first blocking smoke suite must cover these exact flows:
1. login/auth happy path
2. dashboard load after auth
3. create listing
4. save draft
5. publish listing via safe/mock/non-destructive path
6. settings page load
7. one marketplace connection/initiation page render

### Required implementation output for smoke creation
Before making `test:e2e:smoke` blocking, the implementation PR must specify:
- the exact script added to `package.json`
- the exact tests/specs included in the smoke command
- the exact selection mechanism used (explicit spec list, grep, or Playwright project)

### Acceptance criteria
- `bun run test:e2e:smoke` exists.
- The exact test membership is pinned in the repo.
- CI and deploy gates invoke the same smoke command.
- `.test-baseline` remains parser-safe throughout the migration.

### Failure checkpoints
- Do not change baseline structure before parser support lands.
- Do not make `test:e2e:smoke` blocking until the exact command and exact test membership are committed.
- Do not assume tags/projects already exist.

---

## 5. Workstream B — observability and `/api/workers/health` contract hardening (LOCKED)

### Objective
Make observability strong enough before runtime refactors begin.

### Files
- `src/backend/services/monitoring.js`
- `src/backend/server.js`
- `worker/index.js`
- `.github/workflows/production-smoke.yml`
- any worker-emitter files that write `worker:health:*`

### Locked decision
Phase 1 `/api/workers/health` v1 uses the **current concrete emitted worker keys first**, not abstract future role names.

### `/api/workers/health` v1 worker domains
The v1 contract must report these exact domains:
- `taskWorker`
- `gdprWorker`
- `priceCheckWorker`
- `emailPollingWorker`
- `tokenRefreshScheduler`

### `/api/workers/health` v1 response contract
The route should remain backward compatible while formalizing the shape. The Phase 1 target contract is:

```json
{
  "version": "v1",
  "overall": "ok | degraded",
  "timestamp": "ISO-8601",
  "workers": {
    "taskWorker": {
      "status": "ok | starting | stale | stopped",
      "lastRun": "ISO-8601 | null",
      "intervalMs": 10000,
      "staleThresholdMs": 30000
    },
    "gdprWorker": {
      "status": "ok | starting | stale | stopped",
      "lastRun": "ISO-8601 | null",
      "intervalMs": 3600000,
      "staleThresholdMs": 10800000
    },
    "priceCheckWorker": {
      "status": "ok | starting | stale | stopped",
      "lastRun": "ISO-8601 | null",
      "intervalMs": 1800000,
      "staleThresholdMs": 5400000
    },
    "emailPollingWorker": {
      "status": "ok | starting | stale | stopped",
      "lastRun": "ISO-8601 | null",
      "intervalMs": 300000,
      "staleThresholdMs": 900000
    },
    "tokenRefreshScheduler": {
      "status": "ok | starting | stale | stopped",
      "lastRun": "ISO-8601 | null",
      "intervalMs": 300000,
      "staleThresholdMs": 900000
    }
  }
}
```

### Compatibility policy
- Phase 1 may add `version` and `staleThresholdMs` fields.
- Existing `workers.<key>.status`, `lastRun`, and `intervalMs` fields must remain compatible.
- Do not collapse the current concrete keys into abstract groups in Phase 1.

### Monitoring initialization requirement
Before any runtime refactor:
1. App runtime must have explicit monitoring initialization policy.
2. Worker runtime must have explicit monitoring initialization policy.
3. Both app and worker must continue uncaught exception / unhandled rejection reporting.
4. Production smoke should validate the versioned contract, not an informal shape.

### Acceptance criteria
- `/api/workers/health` has an explicit versioned v1 contract.
- Production smoke validates the v1 contract.
- Monitoring initialization behavior is explicit in both app and worker runtimes.
- No refactor proceeds without this visibility in place.

### Failure checkpoints
- Do not rename current health domains before worker topology changes exist.
- Do not change health shape in a breaking way during Phase 1.

---

## 6. Workstream C — repo hygiene and trust restoration

### Objective
Restore trust in local/operator artifacts before larger system changes.

### Files
- `package.json`
- local lint/syntax scripts
- `docs/BACKUP-RESTORE.md`
- `docs/SECRETS-MANAGEMENT.md`
- related operational docs

### V2.1 implementation tasks
1. Fix local lint and syntax commands so they reference real paths and can be trusted.
2. Remove PostgreSQL/SQLite drift from backup/restore docs.
3. Expand secrets-management docs so they are usable as an operational control.
4. Verify that local operator instructions match current production architecture.

### Acceptance criteria
- `bun run lint` and related trust commands are meaningful.
- Backup/restore docs reflect current database reality.
- Secrets-management docs are actionable enough for operator use.

---

## 7. Workstream D — worker split rollout design (design-first)

### Objective
Produce an infrastructure-aware worker split plan before changing runtime topology.

### Files
- `worker/index.js`
- `worker/Dockerfile`
- `worker/railway.json`
- Railway/runbook docs
- relevant worker/service files

### Required questions to answer
1. What Railway services will exist after the split?
2. Which service owns singleton scheduler responsibilities?
3. Which env vars and secrets belong to which service?
4. What health endpoints/contracts are required for each service?
5. What is deploy order?
6. What is rollback order?
7. What owns `priceCheckWorker` and `gdprWorker` in the target topology?

### Acceptance criteria
- Railway topology is explicit.
- Singleton scheduler ownership is explicit.
- Rollback order is documented.
- No runtime split begins until the rollout design is approved.

---

## 8. Workstream E — platform containment and breaker design

### Objective
Contain marketplace instability without fragmenting failure-handling abstractions.

### Files
- `src/backend/workers/taskWorker.js`
- `worker/index.js`
- `src/backend/shared/circuitBreaker.js`
- platform automation and platform sync code

### Locked correction
The correct breaker path is:
- `src/backend/shared/circuitBreaker.js`

### Required design decision
Explicitly decide whether platform containment should:
- reuse/extend `src/backend/shared/circuitBreaker.js`, or
- introduce a separate model for platform breakers

V2.1 recommendation: prefer reuse/extension unless a clear incompatibility exists.

### Acceptance criteria
- Breaker reuse decision is explicit.
- Platform breaker design does not fork into a second abstraction without reason.
- Platform breaker state is visible to health and operator tooling.

---

## 9. Workstream F — failed-job operability MVP

### Objective
Improve operator handling of failed jobs using current schema and tooling first.

### Files
- `scripts/queue-ops.mjs`
- `src/backend/workers/taskWorker.js`
- relevant API/pages if added
- `src/backend/db/pg-schema.sql`

### V2.1 implementation tasks
1. Audit current queue-ops capabilities and task_queue schema.
2. Define MVP operator flows around existing fields first.
3. Add schema fields only when justified by concrete operator need.

### Acceptance criteria
- Operator tooling improves without requiring a large schema redesign up front.
- MVP is grounded in current fields and scripts.

---

## 10. Deferred track — async engine simplification RFC

### Status
Deferred. Not part of immediate hardening implementation.

### Reason
It is too large and cross-cutting to stay inside Phase 1 or the initial hardening stream.

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

## 12. Definition of done for V2.1 planning

Phase 1 is considered implementation-safe to begin only when all of the following are true:

1. `.test-baseline` parser migration order is explicit and parser-safe.
2. `test:e2e:smoke` exists with exact command and pinned membership.
3. `/api/workers/health` v1 is pinned to current concrete worker keys.
4. Monitoring initialization expectations are explicit for app and worker.
5. The breaker path is corrected to `src/backend/shared/circuitBreaker.js` everywhere in the plan.
6. Repo trust gaps in lint/docs/secrets are explicitly addressed or queued.

---

## 13. Summary

VaultLister still does **not** need a rebuild.

But Phase 1 must start from a document that is actually decision-complete and repo-accurate. V2.1 is intended to be that document:
- parser-safe baseline migration
- pinned smoke-suite creation
- pinned `/api/workers/health` v1 contract using current worker keys
- corrected breaker path
- repo-hygiene trust restoration

Only after those are committed and reviewed should Phase 1 implementation begin.
