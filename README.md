# VaultLister

VaultLister is a multi-channel reselling platform with inventory, listing, analytics, automation, and operational tooling in a single repository.

## Prerequisites
- Bun 1.3+
- Node.js 20+ (recommended for script/tooling compatibility)
- Windows PowerShell (runbook scripts target PS 5.1+)

## Quick Start
1. Install dependencies: `bun install --frozen-lockfile`
2. Copy environment file: `Copy-Item .env.example .env`
3. Initialize database: `bun run db:init`
4. Seed demo data: `bun run db:seed`
5. Start app: `bun run dev`
6. Open: `http://localhost:3000`

## Core Commands
- Dev server: `bun run dev`
- Stop managed dev server: `bun run dev:stop`
- Unit/integration tests: `npm test`
- Full Bun test suite: `bun test`
- Runbook smoke: `npm run runbook:smoke`
- Runbook CI gate: `npm run runbook:ci:all`

## Backup / Restore
- Backup: `node scripts/backup.js`
- Restore: `node scripts/restore.js <backup-file> --force`

## Health Checks
- Health endpoint: `http://localhost:3000/api/health`
- Status endpoint: `http://localhost:3000/api/status`

## Troubleshooting
- If `bun install` fails in constrained environments, set local temp/install dirs:
  - `$env:BUN_INSTALL=(Resolve-Path '.bun-install').Path`
  - `$env:BUN_TMPDIR=(Resolve-Path '.bun-tmp').Path`
- If port 3000 is busy, stop the existing process or use a different `PORT` in `.env`.
- If Docker build fails due daemon pipe errors, start Docker Desktop/engine first.

## Evidence and Runbooks
- Auto dashboard: `docs/evidence/RUNBOOK_DASHBOARD.md`
- Auto checklist: `docs/evidence/RUNBOOK_CHECKLIST.md`
- Control-plane docs: `claude-docs/docs/project-control/`
