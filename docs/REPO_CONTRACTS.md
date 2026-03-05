# Repository Contracts

This file defines interfaces and file paths that must remain stable for runbook and gate automation.

## Command Contracts

Do not rename or remove these `package.json` scripts without coordinated migration:

- `runbook`
- `runbook:all`
- `runbook:force`
- `runbook:smoke`
- `runbook:ci`
- `runbook:ci:all`
- `gate:sync`
- `gate:drift-check`
- `release:finalize`

## Evidence Path Contracts

These evidence files are consumed by runbook and gate logic:

- `docs/evidence/RUNBOOK_CHECKLIST.md`
- `docs/evidence/RUNBOOK_DASHBOARD.md`
- `docs/evidence/runbook_state.json`
- `docs/evidence/GATE_EVALUATION.json`

## Gate Document Path Contracts

Automation reads and updates these files:

- `claude-docs/docs/project-control/COMPLETION_GATES.md`
- `claude-docs/docs/project-control/QUALITY_GATES.md`

## Gate Evaluator API Contract

Do not change exported API shape from `scripts/lib/gate-evaluator.mjs` without updating all callers:

- `evaluateGates(repoRoot)`
- `renderCompletionGates(state)`
- `renderQualityGates(state)`
- `renderFinalAudit(state)`

## Runbook Orchestration Contract

`runbook/all.ps1` is the canonical orchestrator. Current step order contract:

1. `ENV_SANITY`
2. `LINT_SYNTAX`
3. `TEST_UNIT`
4. `MONITORING_EVIDENCE`
5. `BACKUP_EVIDENCE`
6. `DEPLOYMENT_EVIDENCE`
7. `PERFORMANCE_EVIDENCE`
8. `SMOKE_PLAYWRIGHT`

Behavior contract:

- `-Only <STEP>` must run a single named step.
- Completed `PASS` steps are skipped unless `-Force`.
- `RUNBOOK_DASHBOARD.md` and `RUNBOOK_CHECKLIST.md` are regenerated each loop iteration.
- `-CI` exits with non-zero status when required checklist items fail.

## Determinism Contract

Given the same repository state and the same evidence inputs, gate pass/fail outcomes must remain deterministic.
