# Scripts Inventory

This inventory separates canonical operational commands from legacy or one-off tooling.

## Canonical Commands (Use These)

Runbook and gate flow:

- `npm run runbook:smoke`
- `npm run runbook:ci`
- `npm run runbook:ci:all`
- `npm run gate:sync`
- `npm run gate:drift-check`
- `npm run release:finalize`

Core development:

- `bun run dev`
- `bun run start`
- `bun run build`
- `bun run lint`
- `bun test`
- `bun run test:e2e`

Database operations:

- `bun run db:init`
- `bun run db:seed`
- `bun run db:reset`
- `bun run db:backup`
- `bun run db:restore`

## Canonical Script Files

Referenced directly by active package scripts and runbook flow:

- `scripts/build-dev-bundle.js`
- `scripts/build-frontend.js`
- `scripts/server-manager.js`
- `scripts/kill-port.js`
- `scripts/backup.js`
- `scripts/restore.js`
- `scripts/gate-sync.mjs`
- `scripts/gate-drift-check.mjs`
- `scripts/lib/gate-evaluator.mjs`

## Legacy / One-Off Scripts

These are not part of the required runbook/gate release contract and should be treated as legacy tooling until explicitly re-adopted:

- `scripts/archive/*` (legacy Notion and approval workflow utilities)
- ad-hoc diagnostics and one-off helpers under `scripts/` not referenced by `package.json` scripts

## Policy

- Do not remove legacy scripts without proof-based reference checks.
- Prefer package scripts over direct ad-hoc script execution for repeatable workflows.
- Keep runbook and gate command surface stable.
