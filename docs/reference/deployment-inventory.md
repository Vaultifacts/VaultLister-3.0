# Deployment Inventory — VaultLister 3.0

> Generated 2026-04-24. Read-only audit of all deployment artifacts.
> Do not edit Dockerfiles or workflows based solely on this document — verify live Railway config first.

---

## 1. Main App Deployment

**File:** `Dockerfile` (root)

| Property | Value |
|---|---|
| Build stages | 2 (`builder` → `production`) |
| Base image (builder) | `oven/bun:1.3` |
| Base image (runtime) | `oven/bun:1.3-slim` |
| Build step | `bun run build` (generates `dist/main.css`, `dist/core-bundle.js`, JS chunks) |
| Production dependencies | Re-installed with `--production --frozen-lockfile` after build |
| Runtime user | `vaultlister` (UID 1001, non-root) |
| Exposed port | `3000` |
| Start command (CMD) | `bun run src/backend/server.js` |
| Health check | `fetch('http://localhost:3000/api/health')` every 30s, 60s timeout, 3 retries |
| System packages installed at runtime | `ca-certificates`, `curl`, `gnupg`, `libvips42`, `postgresql-client-18` |
| Directories created | `/app/data`, `/app/logs`, `/app/backups` |
| Key env vars set in image | `NODE_ENV=production`, `PORT=3000`, `DATA_DIR=/app/data`, `LOG_DIR=/app/logs`, `TRUST_PROXY=1`, `BUN_RUNTIME_SYMLINKS_ENABLED=1` |

**Build comment in Dockerfile:** "Rebuild trigger: 2026-04-17 (deploy anti-detection system)"

---

## 2. Worker Deployment

**File:** `worker/Dockerfile`

| Property | Value |
|---|---|
| Build stages | Single stage (no multi-stage) |
| Base image | `mcr.microsoft.com/playwright:v1.58.2-noble` |
| Bun installation | Pinned to `bun-v1.3.6`; copied to `/usr/local/bin/bun` |
| Additional system packages | `libgtk-3-0`, `libx11-xcb1`, `libasound2t64`, `xvfb`, `libdbus-1-3`, `fonts-liberation` (GTK3/X11 for Camoufox headless Firefox) |
| Runtime user | `vaultlister` (non-root, no home dir) |
| Start command (CMD) | `bun worker/index.js` |
| Health check | `pgrep -f "bun worker/index.js"` every 30s, 10s timeout, 3 retries |
| Special env var | `RAILWAY_SHM_SIZE_BYTES=2147483648` (2 GB shared memory for Camoufox/Firefox) |
| Workdir | `/app` |
| Source copied | `src/` and `worker/` directories; root and worker `package.json` |

**File:** `worker/railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "worker/Dockerfile"
  },
  "deploy": {
    "overlapSeconds": 30,
    "drainingSeconds": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

`railway.json` references `worker/Dockerfile` explicitly. The `startCommand` is not set in `railway.json` — it relies on the `CMD` defined inside `worker/Dockerfile` (`bun worker/index.js`). Railway blue/green overlap is 30 seconds with a 5-minute drain window; worker restarts on failure up to 3 times.

---

## 3. Root `Dockerfile.worker` — Active or Dead?

**File:** `Dockerfile.worker` (project root)

**Full contents summary:**

| Property | Value |
|---|---|
| Base image | `mcr.microsoft.com/playwright:v1.58.2-noble` |
| Bun installation | Installed via `curl bun.sh/install | bash` (no version pin) |
| GTK3/X11 packages | NOT present (missing `libgtk-3-0`, `xvfb`, etc.) |
| Non-root user | NOT created |
| RAILWAY_SHM_SIZE_BYTES | NOT set |
| CMD | `bun worker/index.js` |

**Verdict: DEAD — not referenced anywhere in the active deploy path.**

Evidence:
- `worker/railway.json` specifies `"dockerfilePath": "worker/Dockerfile"` — it points to `worker/Dockerfile`, not the root `Dockerfile.worker`.
- The root `Dockerfile` (main app) does not reference `Dockerfile.worker`.
- No CI workflow references `Dockerfile.worker` by name.
- `Dockerfile.worker` is an earlier draft: it installs Bun without a version pin, omits the GTK3/X11 packages needed for Camoufox, and does not create a non-root user. `worker/Dockerfile` supersedes it with all of these improvements.

**Safe to remove?** Almost certainly yes, but verify two things first before deleting:

1. Confirm no Railway service (dashboard → Settings → Build) has been manually overridden to point at `Dockerfile.worker` outside of `railway.json`.
2. Confirm no CI workflow job uses `docker build -f Dockerfile.worker` or equivalent.

A `grep -r "Dockerfile.worker"` across `.github/workflows/` is the verification step (not done here per read-only scope).

**Risk level:** Low. Deleting it cannot break the production deploy path as long as `worker/railway.json` continues to point to `worker/Dockerfile`. Flag for explicit deletion in a dedicated chore commit with a Railway dashboard cross-check first.

---

## 4. CI/CD Workflows

All files in `.github/workflows/` — 61 total.

| Workflow file | Purpose |
|---|---|
| `ci.yml` | Main CI: lint, version-drift checks (Postgres/Bun/Node/Redis), unit tests, build verification |
| `deploy.yml` | Production deployment trigger to Railway |
| `e2e-regression.yml` | Playwright E2E regression suite |
| `codeql.yml` | GitHub code scanning (CodeQL SAST) |
| `semgrep.yml` | Semgrep static analysis |
| `gitleaks.yml` | Secret scanning (Gitleaks) |
| `trivy.yml` | Container/dependency vulnerability scanning (Trivy) |
| `sonarcloud.yml` | SonarCloud code quality gate |
| `dependency-review.yml` | GitHub dependency review on PRs |
| `npm-audit.yml` | npm/bun audit for known vulnerabilities |
| `security-audit-extended.yml` | Extended security audit sweep |
| `lighthouse.yml` | Lighthouse performance/accessibility CI scores |
| `load-test.yml` | Load testing suite |
| `production-smoke.yml` | Post-deploy production smoke tests |
| `changelog.yml` | Changelog generation/update |
| `release-please.yml` | Automated release PR creation (release-please) |
| `backup.yml` | Scheduled database backup job |
| `backup-verify.yml` | Verifies backup integrity |
| `db-maintenance.yml` | Scheduled database maintenance tasks |
| `slow-query-check.yml` | Detects slow PostgreSQL queries |
| `pg-version-check.yml` | Postgres version drift check |
| `bun-version-check.yml` | Bun runtime version drift check |
| `node-version-check.yml` | Node.js version drift check |
| `redis-version-check.yml` | Redis version drift check |
| `bot-scheduler.yml` | Schedules Playwright bot automation runs |
| `bot-session-health.yml` | Monitors Playwright bot session health |
| `marketplace-health.yml` | Health checks for marketplace API connectivity |
| `service-health-checks.yml` | General service health monitoring |
| `internal-service-health.yml` | Internal service health checks |
| `observability-health.yml` | Observability stack health check |
| `uptime-slack-alert.yml` | Slack alerts on uptime failures |
| `dlq-alert.yml` | Dead-letter queue alert for BullMQ |
| `queue-health.yml` | BullMQ queue depth/health monitoring |
| `redis-health.yml` | Redis connectivity health check |
| `session-cleanup.yml` | Scheduled expired session cleanup |
| `data-retention-purge.yml` | Scheduled data retention enforcement |
| `orphan-cleanup.yml` | Removes orphaned DB/storage records |
| `image-cleanup.yml` | Cloudflare R2 / storage image cleanup |
| `infra-audit.yml` | Infrastructure audit sweep |
| `ssl-cert-check.yml` | SSL certificate expiry monitoring |
| `domain-expiry-check.yml` | Domain registration expiry check |
| `secret-rotation-check.yml` | Checks for stale/overdue secret rotation |
| `spend-railway.yml` | Railway spend monitoring |
| `spend-ai-services.yml` | AI API (Anthropic) spend monitoring |
| `spend-anthropic.yml` | Anthropic-specific spend monitoring |
| `spend-b2.yml` | Backblaze B2 storage spend monitoring |
| `auto-create-issue-on-ci-failure.yml` | Opens GitHub issues on CI failure |
| `auto-merge.yml` | Auto-merge for approved Dependabot/release PRs |
| `add-to-project.yml` | Adds issues/PRs to GitHub Project board |
| `backfill-projects.yml` | Backfills existing items to GitHub Project board |
| `project-status-update.yml` | Syncs GitHub Project status fields |
| `copilot-review.yml` | GitHub Copilot PR review integration |
| `labeler.yml` | Auto-labels PRs by changed file paths |
| `stale-branch-cleanup.yml` | Deletes stale feature branches |
| `push-cleanup.yml` | Post-push cleanup tasks |
| `qa-guardian.yml` | QA trait system enforcement gate |
| `scheduled-reminders.yml` | Scheduled Slack/notification reminders |
| `test-baseline-update.yml` | Updates `.test-baseline` after passing runs |
| `automation-coverage-audit.yml` | Audits automation code coverage |
| `cloudflare-ops.yml` | Cloudflare cache purge and ops automation |
| `blog-auto-publish.yml` | Automated blog post publishing |

---

## 5. `docker-compose.override.yml`

**Purpose:** Development-only hot-reload overlay. Auto-loaded by `docker compose up` in local development. Overrides the production `CMD` with `bun --watch` and bind-mounts source directories so code edits take effect without rebuilding the image.

**Full contents:**

```yaml
services:
  app:
    volumes:
      - vaultlister-data:/app/data
      - vaultlister-logs:/app/logs
      - vaultlister-backups:/app/backups
      - ./src:/app/src
      - ./public:/app/public
      - ./scripts:/app/scripts
      - ./package.json:/app/package.json
    command: ["bun", "--watch", "src/backend/server.js"]
```

This file is committed to the repository. The header comment states "Do NOT commit this file if you want production behaviour in CI" — this is advisory; the file is present in the repo but CI and Railway do not use `docker compose` so it has no effect on production builds.

---

## 6. Staging / Preview Environments

No staging environment exists. This is an accepted risk documented in `CLAUDE.md`:

> "No staging environment — accepted risk for solo developer workflow. All testing via CI + local dev. Consider Railway preview environments for major migrations."

All pre-production validation is handled via:
- Unit tests in CI (`ci.yml`)
- E2E regression suite (`e2e-regression.yml`)
- Production smoke tests run post-deploy (`production-smoke.yml`)
- Load tests (`load-test.yml`) and Lighthouse (`lighthouse.yml`)

---

## 7. Deployment Path Summary

### Main App

```
Code push to master
    │
    ├─ GitHub Actions: ci.yml
    │     lint → version-drift checks → unit tests → build verify
    │
    ├─ GitHub Actions: deploy.yml (triggers on CI pass)
    │
    └─ Railway (main app service)
          build.builder: NIXPACKS (default) or Dockerfile (root)
          Dockerfile stages: builder (oven/bun:1.3) → production (oven/bun:1.3-slim)
          CMD: bun run src/backend/server.js
          Port: 3000
          Health: GET /api/health every 30s
```

### Worker Service

```
Code push to master
    │
    ├─ Railway (worker service) — separate Railway service
    │     worker/railway.json → builder: DOCKERFILE
    │                         → dockerfilePath: worker/Dockerfile
    │
    └─ worker/Dockerfile
          Base: mcr.microsoft.com/playwright:v1.58.2-noble
          Installs: Bun 1.3.6 + GTK3/X11 libs for Camoufox
          CMD: bun worker/index.js
          SHM: 2 GB (RAILWAY_SHM_SIZE_BYTES)
          Restart: ON_FAILURE, max 3 retries
          Drain: 300s before replacement
```

### What railway.json Controls (Worker Only)

The worker is the only service with a `railway.json`. The main app's Railway service build/deploy config is managed via the Railway dashboard or Railway's auto-detection — there is no `railway.json` at the project root.

---

## 8. Risk Items

| # | Risk | Severity | Action Required |
|---|---|---|---|
| 1 | **Root `Dockerfile.worker` is dead code** — superseded by `worker/Dockerfile` but not deleted. Confusion risk for future contributors. | Medium | Verify no Railway service points to it (dashboard check), then delete in a `chore:` commit. |
| 2 | **Root `Dockerfile.worker` installs Bun without a version pin** (`curl bun.sh/install | bash` with no `bun-v1.x.x` argument). If the file were ever used, it would pull latest Bun at build time. | Low (file is dead) | Delete the file to eliminate the risk. |
| 3 | **Root `Dockerfile.worker` missing GTK3/X11 packages and shared memory config** — if accidentally activated it would fail to run Camoufox. | Medium (if activated) | Delete the file. |
| 4 | **`docker-compose.override.yml` is committed** — mounts source dirs and overrides CMD. Has no production impact (Railway does not run `docker compose`), but could mislead a new contributor running `docker compose up` locally into thinking the watch-mode container is the production config. | Low | Add a prominent header comment or keep as-is (current comment is adequate). |
| 5 | **No staging environment** — per CLAUDE.md this is accepted risk. `production-smoke.yml` runs post-deploy, meaning bad deploys are caught after they reach production. | Accepted | Consider Railway preview environments for major schema migrations (documented in CLAUDE.md). |
