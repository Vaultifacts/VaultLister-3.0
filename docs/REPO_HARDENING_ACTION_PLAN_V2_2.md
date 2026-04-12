# VaultLister 3.0 — Repo Hardening Action Plan V2.2

**Status:** Phase 1 decision-complete planning revision  
**Revision basis:** V2.1 resolved most structural blockers; V2.2 pins the final two implementation-critical decisions: exact smoke-suite creation mechanism/membership and exact `/api/workers/health` contract boundary plus app monitoring init call site  
**Scope:** Gate migration, health/observability contract hardening, repo trust restoration, worker split rollout design, platform containment design, and failed-job operability MVP  
**Target outcome:** Make Phase 1 implementation-safe without leaving smoke membership, health-envelope interpretation, or monitoring startup behavior to implementer judgment.

---

## 1. Why V2.2 exists

V2.1 was close, but still left two implementation-critical areas open:

1. the smoke suite was still defined by intent rather than as an exact repo artifact
2. the `/api/workers/health` contract still needed its envelope boundary pinned, and app monitoring init still needed an exact startup call-site requirement

V2.2 resolves those last blockers.

---

## 2. Updated verified current-state facts that Phase 1 depends on

### 2.1 `.test-baseline` consumers are grep-based today
Current baseline consumers are grep/sed based and expect the current token style:
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.husky/pre-push`

Important detail: `.husky/pre-push` currently warns on non-comment, non-empty lines that are not `KNOWN_FAIL...`. Optional section headers cannot be introduced safely until the validator is updated to intentionally ignore them.

### 2.2 Current worker health route uses concrete emitted worker keys
`/api/workers/health` currently reports these concrete worker domains:
- `taskWorker`
- `gdprWorker`
- `priceCheckWorker`
- `emailPollingWorker`
- `tokenRefreshScheduler`

These exact keys are the correct initial domains for the Phase 1 health contract.

### 2.3 There is currently no smoke E2E command or smoke tagging system
Current `package.json` includes:
- `test:e2e:all`
- `test:e2e:ui`
- `test:e2e:headed`

There is no current `test:e2e:smoke` script, no `@smoke` tagging system, and no smoke-only Playwright project already in place. Phase 1 must therefore create the smoke suite as a new explicit repo artifact.

### 2.4 Current candidate coverage is scattered
Current repo tests touch pieces of the intended smoke flows, but they are not pinned today as a single smoke manifest. Known candidate files include:
- `e2e/tests/auth.spec.js`
- `e2e/tests/settings.e2e.js`
- `e2e/tests/integrations.e2e.js`
- `e2e/tests/e2e.test.js`
- `e2e/tests/ebay-integration.spec.js`

Because that coverage is scattered, Phase 1 must define an exact smoke manifest and may need to create new smoke-specific specs if existing tests are too broad or not cleanly reusable.

### 2.5 Correct breaker path
The correct path is:
- `src/backend/shared/circuitBreaker.js`

---

## 3. Strategic objective

The objective remains unchanged:
1. restore trust in release gates
2. restore trust in observability and operator artifacts
3. define worker-split rollout safely before implementation
4. improve platform containment
5. improve failed-job operability

V2.2 removes the last two areas where implementers would otherwise still need to invent policy.

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
- `playwright.config.js`
- `e2e/tests/**`

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

### Smoke-suite locked creation mechanism
Phase 1 will create a **new explicit Playwright spec-manifest-based smoke suite**.

This is now locked. Phase 1 will **not** use an open-ended “grep/tag or manifest” decision.

### Smoke-suite locked command
Phase 1 will add this command to `package.json`:

```bash
bun run test:e2e:smoke
```

### Smoke-suite locked command behavior
The initial `test:e2e:smoke` command must run **Chromium only** against an **explicit spec list**, not a conceptual tag filter.

### Initial smoke manifest (exact Phase 1 target)
The implementation PR must either:
1. reuse these exact existing files if they can be made narrow and stable enough, or
2. create smoke-specific replacements with the exact same coverage intent

Initial exact candidate manifest to validate in the implementation PR:
- `e2e/tests/auth.spec.js`
- `e2e/tests/settings.e2e.js`
- `e2e/tests/integrations.e2e.js`
- `e2e/tests/e2e.test.js`

`e2e/tests/ebay-integration.spec.js` is **not** part of the initial blocking smoke manifest by default unless the implementation PR proves it is fast, non-flaky, and needed for the marketplace-initiation requirement.

### Smoke-manifest rule
If any of the candidate files above are too broad, too flaky, or do not cleanly cover the required flow in a blocking-safe way, Phase 1 must create **new smoke-only spec files** and use those exact files in the manifest instead.

### Required smoke coverage outcomes
The final committed manifest must cover these outcomes:
1. login/auth happy path
2. dashboard load after auth
3. create listing
4. save draft
5. publish listing via safe/mock/non-destructive path
6. settings page load
7. one marketplace connection/initiation page render

### Required implementation output for smoke creation
Before making `test:e2e:smoke` blocking, the implementation PR must specify:
- the exact `package.json` script
- the exact Playwright invocation
- the exact spec files in the smoke manifest
- whether any new smoke-only specs were created

### Acceptance criteria
- `bun run test:e2e:smoke` exists.
- The smoke suite uses an explicit spec manifest.
- The exact test membership is pinned in the repo.
- CI and deploy gates invoke the same smoke command.
- `.test-baseline` remains parser-safe throughout the migration.

### Failure checkpoints
- Do not change baseline structure before parser support lands.
- Do not make `test:e2e:smoke` blocking until the exact command and exact spec list are committed.
- Do not treat conceptual flow bullets as sufficient smoke membership.

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

### Contract boundary (LOCKED)
The v1 contract refers to the **JSON inside the existing `data` field**.

Phase 1 does **not** reshape the full HTTP response wrapper.

The outer route response remains:

```json
{
  "status": 200,
  "data": { ...v1 payload... }
}
```

### `/api/workers/health` v1 payload contract
Inside the existing `data` field, the Phase 1 target contract is:

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
- Phase 1 may add `version` and `staleThresholdMs` fields inside `data`.
- Existing `data.workers.<key>.status`, `lastRun`, and `intervalMs` fields must remain compatible.
- Do not collapse the current concrete keys into abstract groups in Phase 1.

### App monitoring init call-site requirement (LOCKED)
`src/backend/server.js` must call `monitoring.init()` **exactly once during process startup before serving requests**.

For Phase 1 planning purposes, the required startup behavior is:
1. initialize database
2. initialize Redis
3. initialize email service
4. call `monitoring.init()`
5. begin serving requests

The worker side already initializes monitoring in `worker/index.js`; Phase 1 must make the app-side startup behavior equally explicit.

### Error capture requirement
Before any runtime refactor:
1. App runtime must retain explicit uncaught exception / unhandled rejection reporting.
2. Worker runtime must retain explicit uncaught exception / unhandled rejection reporting.
3. Production smoke must validate the versioned inner `data` contract, not an informal shape.

### Acceptance criteria
- `/api/workers/health` has an explicit versioned v1 payload contract inside `data`.
- Production smoke validates that inner `data` payload contract.
- `src/backend/server.js` explicitly calls `monitoring.init()` exactly once during startup before serving requests.
- Monitoring initialization behavior is explicit in both app and worker runtimes.
- No refactor proceeds without this visibility in place.

### Failure checkpoints
- Do not rename current health domains before worker topology changes exist.
- Do not change the outer `{ status, data }` wrapper in Phase 1.
- Do not leave app monitoring init as an implied policy rather than a pinned startup call site.

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

### V2.2 implementation tasks
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

V2.2 recommendation: prefer reuse/extension unless a clear incompatibility exists.

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

### V2.2 implementation tasks
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

## 12. Definition of done for V2.2 planning

Phase 1 is considered implementation-safe to begin only when all of the following are true:

1. `.test-baseline` parser migration order is explicit and parser-safe.
2. `test:e2e:smoke` exists with exact command and pinned explicit spec membership.
3. `/api/workers/health` v1 is pinned to current concrete worker keys.
4. The contract boundary is explicit: v1 refers to the payload inside the existing `data` wrapper.
5. `src/backend/server.js` startup behavior explicitly includes one `monitoring.init()` call before serving requests.
6. The breaker path is corrected to `src/backend/shared/circuitBreaker.js` everywhere in the plan.
7. Repo trust gaps in lint/docs/secrets are explicitly addressed or queued.

---

## 13. Summary

VaultLister still does **not** need a rebuild.

But Phase 1 must start from a document that is actually decision-complete and repo-accurate. V2.2 is intended to be that document:
- parser-safe baseline migration
- explicit smoke-manifest-based suite creation
- pinned `/api/workers/health` v1 payload contract using current worker keys
- pinned contract boundary inside the existing `data` wrapper
- pinned app monitoring startup call site
- corrected breaker path
- repo-hygiene trust restoration

Only after those are committed and reviewed should Phase 1 implementation begin.
