# Round-Robin Autopilot Task

## Current Task
Achieve `npm test` exit code 0 — full 5289-test suite green without any manual env setup.

### Background
`npm test` runs: `test:setup` (kills port 3100, starts test server) → `run-bun-tests.ps1`
(sets NODE_ENV=test, TEST_BASE_URL=http://localhost:3100, PORT=3100) → `bun test`.

Unit baseline with `run-bun-tests.ps1` alone: **5289 pass / 0 fail** (2026-03-08).

### Previously Applied Fixes (do not re-apply)
- `auth.helper.js:133` — bcrypt rounds = 1 in test mode (was 12) ✅
- `tokenRefreshScheduler.js` — `getRefreshSchedulerStatus()` returns `isRunning`, `bufferMs`, `maxFailures` ✅
- `priceCheckWorker.js` — `getPriceCheckWorkerStatus()` returns `interval_ms`, `interval_minutes`, `max_items_per_cycle` ✅

### Remaining failures (if any)
Run `npm test` and look for failures that occur specifically when all 265 test files run
concurrently (not in isolated runs). These would be server-not-ready races or resource
contention issues.

## Target Signature
TargetSignatureRegex: \d+ fail
TargetThreshold: 0

## Scope Rules
- Keep production behavior unchanged.
- Any bypass or softening must apply only in test mode.
- Use minimal, PR-like patches each iteration.
- Always write clear logs and a concise next-step recommendation.

## Contracts (Do Not Break)
- Do not change runbook/gate commands.
- Do not change evidence contract paths:
  - `docs/evidence/RUNBOOK_CHECKLIST.md`
  - `docs/evidence/RUNBOOK_DASHBOARD.md`
  - `docs/evidence/runbook_state.json`
  - `docs/evidence/GATE_EVALUATION.json`
- Do not change gate doc paths:
  - `claude-docs/docs/project-control/COMPLETION_GATES.md`
  - `claude-docs/docs/project-control/QUALITY_GATES.md`
- Do not change `scripts/lib/gate-evaluator.mjs` exported API:
  - `evaluateGates`
  - `renderCompletionGates`
  - `renderQualityGates`
  - `renderFinalAudit`

## Iteration Validation (Required Every Iteration)
1. `npm test`
2. `npm run runbook:smoke`

## Stop Conditions
- `npm test` exits `0`
- OR target signature count reaches threshold from task settings
- OR `npm run runbook:smoke` fails
- OR max iterations reached
