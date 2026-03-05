# AGENTS RULES

## Scope
This file defines guardrails for AI/developer agents working in this repository.

## Hard Non-Behavioral Rule
- Documentation and refactors must not change runtime behavior unless explicitly requested.
- Do not modify operational contracts (runbook/gate behavior, evidence path contracts, gate doc paths) unless explicitly requested.

## File-Creation Rules
- Do not create suffix variants such as:
  - `*_v2.*`
  - `*_final.*`
  - `*_new.*`
- If duplicate logic/docs/files exist, consolidate into canonical files instead of forking new variants.

## Bun-First Conventions
- Prefer Bun commands for local workflows:
  - `bun run dev`
  - `bun run start`
  - `bun test`
- Use npm scripts when they are the documented orchestration entrypoints:
  - `npm run runbook:smoke`
  - `npm run runbook:ci:all`
  - `npm run gate:sync`
  - `npm run gate:drift-check`

## Minimum Validation Before Finishing Changes
- Required minimum checks:
  1. `bun test`
  2. `npm run runbook:smoke`
- If changes touch gate/runbook/control-plane docs, also run:
  1. `npm run runbook:ci:all`
  2. `npm run gate:sync`
  3. `npm run gate:drift-check`

## Contract Paths (Do Not Rename)
- Evidence:
  - `docs/evidence/RUNBOOK_CHECKLIST.md`
  - `docs/evidence/RUNBOOK_DASHBOARD.md`
  - `docs/evidence/runbook_state.json`
  - `docs/evidence/GATE_EVALUATION.json`
- Gate docs:
  - `claude-docs/docs/project-control/COMPLETION_GATES.md`
  - `claude-docs/docs/project-control/QUALITY_GATES.md`

## Determinism Rule
- Preserve deterministic gate evaluation:
  - same repo state + same evidence inputs => same gate pass/fail.

## High-Risk Editing Guidance
- Treat `src/frontend/app.js` as high-risk.
- Prefer narrowly scoped, test-backed changes and avoid broad rewrites unless explicitly requested.
