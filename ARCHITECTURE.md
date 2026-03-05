# ARCHITECTURE OVERVIEW

## System Summary
VaultLister is organized as a Bun/JavaScript application with clear backend/frontend/shared boundaries and a runbook-based operational control plane.

## Top-Level Architecture
- `src/backend`
  - Bun HTTP server entry (`src/backend/server.js`)
  - API routes
  - middleware/auth/security
  - domain services and background workers
  - SQLite integration and migrations
- `src/frontend`
  - Vanilla JS SPA
  - high-risk large entry surface: `src/frontend/app.js`
- `src/shared`
  - shared modules, integrations, and reusable utility logic
- `runbook`
  - PowerShell runbook execution framework
  - step orchestration, state tracking, dashboard/checklist generation
- `claude-docs/docs/project-control`
  - completion and quality gate docs (rendered/synced by gate scripts)
- `docs/evidence`
  - generated evidence artifacts consumed by runbook/gate evaluators

## Runtime/Execution Model
- Development:
  - `bun run dev`
  - Build dev bundle, then watch/run backend server.
- Standard start:
  - `bun run start`
- Testing:
  - `bun test`
  - `bun run test:e2e` or `npx playwright test`

## Operational Control Plane
- Runbook entrypoints:
  - `npm run runbook:smoke`
  - `npm run runbook:ci:all`
- Gate entrypoints:
  - `npm run gate:sync`
  - `npm run gate:drift-check`

## Stable Contract Surfaces
These paths are contract-level and should not be renamed or relocated without coordinated migration.

### Evidence contracts
- `docs/evidence/RUNBOOK_CHECKLIST.md`
- `docs/evidence/RUNBOOK_DASHBOARD.md`
- `docs/evidence/runbook_state.json`
- `docs/evidence/GATE_EVALUATION.json`

### Gate docs
- `claude-docs/docs/project-control/COMPLETION_GATES.md`
- `claude-docs/docs/project-control/QUALITY_GATES.md`

## Determinism Requirement
Gate outcomes must remain deterministic:
- same repository state + same evidence inputs => same PASS/FAIL results.

## Risk Notes
- `src/frontend/app.js` is a major risk concentration due to size and breadth.
- Operational accuracy depends on keeping runbook evidence and gate sync in lockstep.
