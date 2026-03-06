# Round-Robin Autopilot Task

## Current Task
Eliminate `"Your IP has been temporarily blocked due to repeated violations"` test failures by making tests hermetic in `NODE_ENV=test` only, without changing production behavior.

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
- OR the IP-block signature disappears from npm test output:
  - `temporarily blocked due to repeated violations`
- OR `npm run runbook:smoke` fails
- OR max iterations reached

