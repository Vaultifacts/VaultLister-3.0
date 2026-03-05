# Clean-Clone Reproducibility Runbook

Date: 
2026-03-05T11:21:58.0672069-07:00
RepoRoot: C:\Users\Matt1\OneDrive\Desktop\Claude Code Project Brainstormer\vaultlister-3

## Setup Commands
1. git worktree add .tmp-cleanclone HEAD
2. Copy updated package.json and bun.lock into .tmp-cleanclone
3. bun install --frozen-lockfile (with BUN_INSTALL/BUN_TMPDIR/TEMP/TMP pinned)
4. Copy .env.example -> .env and set NODE_ENV=test, PORT=3000
5. bun run db:reset

## Verification Commands
- bun run dev (from .tmp-cleanclone)
- GET http://localhost:3000/api/health
- GET http://localhost:3000/
- POST http://localhost:3000/api/auth/register
- POST http://localhost:3000/api/auth/login
- POST http://localhost:3000/api/inventory
- GET http://localhost:3000/api/inventory?limit=5&offset=0

## Results
PASS

### Health Response
```json
{
  "status": "healthy",
  "timestamp": "2026-03-05T18:21:22.405Z",
  "version": "1.0.0",
  "uptime_seconds": 636,
  "database": {
    "status": "ok"
  },
  "migrations": {
    "applied": 95
  },
  "disk": {
    "status": "ok",
    "path": "./data",
    "free_bytes": 8165212160,
    "total_bytes": 999556489216
  }
}
```

### Functional Summary
```json
{
  "health": "ok",
  "inventoryListCount": 1,
  "register": "ok",
  "username": "cleanclone1772734884512",
  "email": "cleanclone-1772734884512@example.com",
  "spaStatus": 200,
  "login": "ok",
  "inventoryCreateId": "052ebfb8-399d-4a44-ae16-bef2c1f9b632"
}
```

## Notes
- Clean-clone install blocker resolved by upgrading better-sqlite3 to 12.6.2.
- Minimal inventory flow verified with real register/login/token auth.
- Evidence artifacts: PHASE-03_CLEANCLONE_SUMMARY.json, PHASE-03_HEALTH_RESPONSE.json, PHASE-03_SPA_STATUS.txt, PHASE-03_CLEANCLONE_SERVER.out.log, PHASE-03_CLEANCLONE_SERVER.err.log
