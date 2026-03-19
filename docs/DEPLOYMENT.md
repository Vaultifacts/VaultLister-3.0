# VaultLister 3.0 — Deployment Runbook

## Prerequisites

**Tools required on the deployment machine:**

- Docker Engine 24+ and Docker Compose v2
- SSH client with key-based auth configured
- `jq` installed (used in health-check scripts)

**GitHub repository secrets** — set these in Settings > Secrets > Actions before running any workflow:

| Secret | Used By | Description |
|--------|---------|-------------|
| `STAGING_HOST` | deploy-staging.yml | IP or hostname of staging server |
| `STAGING_USER` | deploy-staging.yml | SSH user on staging server (e.g. `ubuntu`) |
| `STAGING_SSH_KEY` | deploy-staging.yml | PEM-encoded private key for staging SSH |
| `PRODUCTION_HOST` | deploy.yml | IP or hostname of production server |
| `PRODUCTION_USER` | deploy.yml | SSH user on production server |
| `SSH_PRIVATE_KEY` | deploy.yml | PEM-encoded private key for production SSH |
| `STAGING_SSH_PORT` | deploy.yml | SSH port override (defaults to 22) |
| `PRODUCTION_SSH_PORT` | deploy.yml | SSH port override (defaults to 22) |
| `TELEGRAM_TOKEN` | deploy.yml | Telegram bot token for deploy notifications (optional) |
| `TELEGRAM_CHAT_ID` | deploy.yml | Telegram chat ID for deploy notifications (optional) |

**SSH key setup** — the public key must be in `~/.ssh/authorized_keys` on each server. The key is never stored in the repo.

---

## Staging Deploys

Staging deploys are fully automatic. The pipeline:

1. Push commits to the `staging` branch (or manually trigger `deploy-staging.yml` via workflow_dispatch).
2. The `Deploy Staging` workflow (`deploy-staging.yml`) runs:
   - Checks out the repo
   - Builds a Docker image tagged `staging` and `staging-<sha>`, pushes to GHCR
   - SSHs into the staging server at `/opt/vaultlister-staging/`
   - Creates a minimal `.env` on first deploy (auto-generates `JWT_SECRET`)
   - Copies `docker-compose.staging.yml` and `nginx/nginx.staging.conf` to the server
   - Runs a pre-deploy database backup via `backup.sh`
   - Tags the current running image as `staging-rollback`
   - Pulls the new image, restarts `redis` then `app` with `--no-deps` for zero-downtime
   - Polls `docker inspect` for `healthy` status, up to 90 seconds
   - Runs the smoke test suite (`scripts/smoke-test-staging.sh`) via SSH
   - On failure, automatically executes `/opt/vaultlister-staging/rollback.sh`
   - Updates the GitHub deployment record with success or failure status

The staging app listens on port **3001** internally. The smoke test curls `http://localhost:3001/api/health`.

---

## Production Deploys

Production deploys are **manual only** — triggered via `workflow_dispatch` on the `Deploy` workflow (`deploy.yml`).

**Steps to deploy to production:**

1. Confirm all CI checks pass on `master`/`main`.
2. Go to Actions > Deploy > Run workflow.
3. Select `production` from the environment dropdown.
4. Click "Run workflow".

The workflow then:

1. Builds the Docker image tagged `prod`, `latest`, and the commit SHA, pushes to GHCR.
2. Deploys to staging first (`deploy-staging` job must pass as a prerequisite).
3. SSHs into the production server at `/opt/vaultlister/`.
4. Tags the running image as `rollback`.
5. Backs up the database: `cp data/vaultlister.db data/vaultlister.db.backup.<timestamp>`.
6. Pulls and restarts the `app` container with `--no-deps`.
7. Polls health check for up to 60 seconds.
8. Rolls back automatically if health check fails.

---

## Pre-Deploy Checklist

Before triggering any production deploy, verify:

- [ ] CI is green on the target commit (`Actions > CI` shows all jobs passing)
- [ ] Staging deploy succeeded for the same SHA
- [ ] A recent database backup exists (`backups/` on the server or from the automated 3am cron)
- [ ] No active user sessions that would be disrupted (check metrics if available)
- [ ] `MAINTENANCE_MODE` is **not** set to `true` in the server `.env` (or intentionally is, if downtime is planned)
- [ ] All required `.env` values are populated on the target server (run `node scripts/post-deploy-check.mjs` against staging to validate config parity)

---

## Post-Deploy Verification

After a deploy completes, the CI workflow runs these checks automatically. You can also run them manually:

**Health endpoint:**
```bash
curl -s https://your-domain.com/api/health | jq .
# Expected: { "status": "healthy", ... }
```

**Liveness and readiness probes:**
```bash
curl -s https://your-domain.com/api/health/live | jq .
# Expected: { "status": "ok" }

curl -s https://your-domain.com/api/health/ready | jq .
# Expected: { "status": "healthy", "checks": { "database": "ok", ... } }
```

**Full post-deploy infrastructure check:**
```bash
node scripts/post-deploy-check.mjs https://your-domain.com
# Runs 7 checks: liveness, readiness, API versioning alias, ETag, 304, Cache-Control, rate-limit bypass
# Exit 0 = all pass. Do not promote until this passes.
```

A deploy is marked successful only when `GET /api/health` returns `{"status":"healthy"}` with HTTP 200.

---

## Rollback Procedure

**Automatic rollback (built into CI):**

The `deploy-staging.yml` and `deploy.yml` workflows tag the running image as `rollback` before pulling a new image. If the post-deploy health check fails, the workflow automatically:

1. Stops the new container
2. Re-tags the `rollback` image as the current tag
3. Restarts the container from the previous image
4. Runs a second health check and logs the result

**Manual rollback on the server:**

SSH into the server and run:

```bash
# Staging
ssh <STAGING_USER>@<STAGING_HOST>
cd /opt/vaultlister-staging
/opt/vaultlister-staging/rollback.sh

# Production
ssh <PRODUCTION_USER>@<PRODUCTION_HOST>
cd /opt/vaultlister
docker compose down app 2>/dev/null || true
docker tag ghcr.io/vaultifacts/vaultlister-3.0:rollback ghcr.io/vaultifacts/vaultlister-3.0:latest
docker compose up -d --no-deps app
```

**Database rollback:**

If application data was corrupted, restore from the pre-deploy backup:

```bash
cd /opt/vaultlister
cp data/vaultlister.db data/vaultlister.db.broken
cp data/vaultlister.db.backup.<timestamp> data/vaultlister.db
docker compose restart app
curl -s http://localhost:3000/api/health | jq .
```

---

## Local Validation (Docker Compose)

Use this to validate the deployment locally before pushing to staging.

**Prerequisites:** Docker Desktop running, Docker daemon reachable, `Dockerfile` and `docker-compose.yml` present at the repo root.

```powershell
docker compose down
docker compose up -d --build
docker compose ps
docker inspect --format='{{.State.Health.Status}}' vaultlister-app
curl.exe -s http://localhost:3000/api/health
```

**Expected results:**
- `docker compose up -d --build` exits 0
- `vaultlister-app` and `vaultlister-redis` are `Up`
- `vaultlister-app` health status becomes `healthy`
- `/api/health` returns JSON with `"status":"healthy"`

**Validation evidence files** (generated during QA):
- `docs/evidence/DEPLOYMENT_VALIDATION.md`
- `docs/evidence/PHASE-04_DOCKER_PS.txt`
- `docs/evidence/PHASE-04_DOCKER_HEALTH_STATUS.txt`
- `docs/evidence/PHASE-04_DOCKER_HEALTH_RESPONSE.json`

---

## Common Issues and Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| SSH timeout during deploy | Firewall or server overload | Verify the server is reachable: `ssh -v <user>@<host>`. Check `STAGING_SSH_PORT` / `PRODUCTION_SSH_PORT` secrets if non-standard. |
| `docker pull` fails: `unauthorized` | GHCR token expired or wrong actor | Re-authenticate: `echo $GITHUB_TOKEN \| docker login ghcr.io -u <actor> --password-stdin` |
| `docker pull` fails: image not found | Build step did not push successfully | Check the `build-and-push` job in Actions — confirm the image exists in `ghcr.io/vaultifacts/vaultlister-3.0` |
| Health check stays `starting` past 90s | App crashed on startup | `docker logs vaultlister-staging-app --tail 50` — check for missing env vars or DB init errors |
| Health check returns `unhealthy` | DB not initialized or WAL corrupted | Run `bun run db:init` inside the container or restore from backup |
| `STAGING_HOST secret not set` | GitHub secret missing | Add the secret in Settings > Secrets > Actions |
| Smoke test fails: `HTTP 000` | App not listening on port 3001 | Check `PORT` in `.env` on the staging server — must be `3000`; nginx proxies 3001→3000 |
| `No rollback image available` | First-ever deploy on the server | No rollback possible — fix forward or redeploy the last known-good SHA manually |
| Build size exceeds 3 MB | New large dependency added | Check `dist/app.js` size; audit recent `package.json` changes |

---

## Server Access

**Staging:**
```bash
ssh <STAGING_USER>@<STAGING_HOST> -i ~/.ssh/<your-key>
# Working directory: /opt/vaultlister-staging/
```

**Production:**
```bash
ssh <PRODUCTION_USER>@<PRODUCTION_HOST> -i ~/.ssh/<your-key>
# Working directory: /opt/vaultlister/
```

SSH key location: stored as GitHub repository secrets (`STAGING_SSH_KEY`, `SSH_PRIVATE_KEY`). The corresponding private key on your local machine is wherever you generated it — keep it out of the repo.

---

## Environment Variables Reference

Full reference: `.env.example` at the repo root.

**Required at minimum for a working server:**

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` or `staging` |
| `PORT` | App port (default `3000`) |
| `JWT_SECRET` | 32+ char random string — `openssl rand -hex 32` |
| `DATA_DIR` | Absolute path to SQLite data directory (e.g. `/app/data`) |

**Recommended for production:**

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Error tracking |
| `SLACK_WEBHOOK` | Alert delivery |
| `REDIS_URL` | Caching and rate limiting |
| `SMTP_*` | Email notifications |

See `.env.example` for the full list including marketplace OAuth credentials, AI API keys, cloud backup config, and monitoring thresholds.

---

## Cron Jobs on Server

These jobs run on the server via crontab. Install with `crontab -e` as the service user:

```cron
# Database backup — daily at 3:00 AM
0 3 * * * /opt/vaultlister/backup.sh >> /opt/vaultlister/logs/backup.log 2>&1

# Health check — every 5 minutes
*/5 * * * * curl -sf http://localhost:3000/api/health > /dev/null || echo "$(date): health check failed" >> /opt/vaultlister/logs/health-alert.log

# WAL checkpoint — every 6 hours (keeps SQLite WAL file from growing unbounded)
0 */6 * * * sqlite3 /opt/vaultlister/data/vaultlister.db "PRAGMA wal_checkpoint(TRUNCATE);" >> /opt/vaultlister/logs/wal.log 2>&1

# Database integrity check — daily at 4:00 AM
0 4 * * * sqlite3 /opt/vaultlister/data/vaultlister.db "PRAGMA integrity_check;" >> /opt/vaultlister/logs/integrity.log 2>&1
```

For staging, replace `/opt/vaultlister/` with `/opt/vaultlister-staging/`.


---

## Secret Rotation

Secrets are currently stored in `.env` on each server (staging and production). Rotation is **manual** and must follow the schedule documented in [SECRETS-MANAGEMENT.md](./SECRETS-MANAGEMENT.md):

| Secret | Rotation Interval | Procedure |
|--------|-------------------|-----------|
| `JWT_SECRET` + `REFRESH_TOKEN_SECRET` | **Quarterly** | Generate new secrets with `openssl rand -hex 32`; update `.env` on both servers; restart containers |
| `ANTHROPIC_API_KEY` | **Annually** | Regenerate at api.anthropic.com; update `.env` |
| Marketplace OAuth tokens | **Annually** | Refresh via each marketplace's API; update encrypted tokens in `.env` |
| `GITHUB_TOKEN` | **Annually** | Regenerate on GitHub Settings; update `.env` |

**For production deployment, migrate to a secrets manager (HashiCorp Vault, AWS Secrets Manager, or 1Password).** See [SECRETS-MANAGEMENT.md](./SECRETS-MANAGEMENT.md) for migration guidance.

After rotating any secret, verify:
1. Health check passes: `curl https://api.vaultlister.com/api/health`
2. No auth errors in logs: `docker logs vaultlister-app 2>&1 | grep -i "auth|error"`
3. Marketplace integrations still work (test a sample listing)
