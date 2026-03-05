# PROJECT PROFILE

## One-Line Definition
VaultLister is a Bun/JavaScript multi-channel resale platform with backend, frontend, shared services, and runbook-driven operational gates.

## Primary Users
- End users: resellers using inventory/listing/automation workflows.
- Developers/agents: maintainers validating test, runbook, and gate compliance.

## Platform and Runtime
- Application: cross-platform JavaScript/Bun.
- Operational automation: PowerShell-centric runbook flows are optimized for Windows environments.

## Repo Shape
- `src/backend`: API server, routes, services, middleware, DB.
- `src/frontend`: SPA client (high-risk large entry file: `src/frontend/app.js`).
- `src/shared`: shared logic/integrations/utilities.
- `runbook`: CI/checklist/state orchestration.
- `claude-docs/docs/project-control`: control-plane gate docs.
- `docs/evidence`: generated evidence artifacts.

## Entrypoints
- Dev: `bun run dev`
  - Builds dev bundle, then runs `bun --watch src/backend/server.js`.
- Start: `bun run start`

## Tests
- Unit/integration: `bun test`
- E2E direct: `npx playwright test`
- E2E scripted: `bun run test:e2e`

## Ops and Gates
- Smoke runbook: `npm run runbook:smoke`
- CI runbook gate: `npm run runbook:ci:all`
- Gate sync: `npm run gate:sync`
- Gate drift check: `npm run gate:drift-check`

## Evidence Contract Paths (must remain stable)
- `docs/evidence/RUNBOOK_CHECKLIST.md`
- `docs/evidence/RUNBOOK_DASHBOARD.md`
- `docs/evidence/runbook_state.json`
- `docs/evidence/GATE_EVALUATION.json`

## Gate Doc Paths (must remain stable)
- `claude-docs/docs/project-control/COMPLETION_GATES.md`
- `claude-docs/docs/project-control/QUALITY_GATES.md`

## Determinism Contract
Same repository state plus same evidence inputs must produce the same gate pass/fail outcome.

## Known High-Risk Area
- `src/frontend/app.js` is extremely large and should be treated as a high-regression surface during edits.
