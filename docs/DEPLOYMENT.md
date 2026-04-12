# VaultLister 3.0 — Deployment Runbook

## Prerequisites

**Tools required for local validation / incident response:**

- Docker Engine 24+ and Docker Compose v2
- `jq` installed (used in health-check scripts)

**GitHub / Railway configuration**

- `deploy.yml` currently hands off to Railway and does not SSH into a repo-managed VPS.
- Production runtime secrets such as `DATABASE_URL`, `REDIS_URL`, marketplace credentials, and backup credentials live in Railway service configuration.
- GitHub Actions repository secrets are still used by other workflows where applicable, but the production deploy handoff itself is no longer driven by server SSH credentials.

---

## Staging Deploys

The legacy VPS staging workflow was retired after the Railway cutover. The repo no longer ships `deploy-staging.yml`, `docker-compose.staging.yml`, or `nginx/nginx.staging.conf`, and staging should not be treated as a live deployment target.

If a dedicated staging environment is needed again, reintroduce it as a fresh Railway service or restore the full VPS staging stack in one scoped change. Do not rely on archived staging runbook steps from older commits.

---

## Production Deploys

Production deploys are driven by the `Deploy` workflow (`deploy.yml`) and Railway's GitHub-based deployment flow.

**Steps to deploy to production:**

1. Push the target commit to `master` or `main`.
2. Confirm the `CI` and blocking `E2E Smoke` jobs pass.
3. Confirm the `Deploy` workflow reports success.
4. Monitor the linked Railway project for the resulting production rollout.

The workflow then:

1. Runs PostgreSQL-backed unit tests.
2. Runs the blocking Playwright smoke suite.
3. Triggers Railway's GitHub-source deploy path once the gates pass.
4. Reports the deployment handoff status back to GitHub Actions.

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

The current production path is Railway-based. Automatic rollback behavior is controlled by Railway's deployment/runtime state, not by a repo-managed VPS rollback workflow.

**Manual rollback on the server:**

SSH into the server and run:

```bash
# Production rollback actions depend on the Railway service state.
# Use Railway deployment history and service logs rather than the retired VPS rollback flow.
```

**Database rollback:**

If application data was corrupted, restore from a verified PostgreSQL backup:

```bash
bun run db:restore <backup-file>
curl -s https://vaultlister.com/api/health | jq .
```

---

## Local Validation (Docker Compose)

Use this to validate the deployment locally before shipping a change to production.

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
| Deploy workflow blocked before Railway handoff | Unit or smoke gate failed | Open the failing Actions run, inspect the failing job, and fix the code/config issue before retrying. |
| Railway deploy unhealthy after GitHub Actions success | Runtime env or service issue | Check Railway deployment logs, verify `DATABASE_URL` / `REDIS_URL`, and run `bun run ops:health:prod`. |
| Backup upload fails | B2 credentials or upload path issue | Review the `Daily Database Backup` run logs and verify `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, and `B2_BUCKET_NAME`. |
| Build size exceeds 3 MB | New large dependency added | Check `dist/app.js` size; audit recent `package.json` changes |

---

## Server Access

Production access is now primarily through Railway rather than a repo-managed VPS.

Use:
- Railway dashboard deployment history
- Railway service logs
- Railway environment variable management
- GitHub Actions run history for the gating workflows

---

## Environment Variables Reference

Full reference: `.env.example` at the repo root.

**Required at minimum for a working server:**

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` or `staging` |
| `PORT` | App port (default `3000`) |
| `JWT_SECRET` | 32+ char random string — `openssl rand -hex 32` |
| `DATA_DIR` | Absolute path to PostgreSQL data directory (e.g. `/app/data`) |

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

# PostgreSQL connection check — daily at 4:00 AM
0 4 * * * psql $DATABASE_URL -c "SELECT 1;" >> /opt/vaultlister/logs/integrity.log 2>&1
```

The retired VPS staging path should not be used as an operational reference.


---

## Secret Rotation

Production runtime secrets are managed through Railway environment configuration. Rotation remains **manual** and should follow [SECRETS-MANAGEMENT.md](./SECRETS-MANAGEMENT.md):

| Secret | Rotation Interval | Procedure |
|--------|-------------------|-----------|
| `JWT_SECRET` + `REFRESH_TOKEN_SECRET` | **Quarterly** | Generate new secrets with `openssl rand -hex 32`; update Railway env; verify fresh sessions work correctly |
| `ANTHROPIC_API_KEY` | **Annually** | Regenerate at api.anthropic.com; update Railway env |
| Marketplace OAuth tokens | **Annually** | Refresh via each marketplace's API; update Railway env or the backing secret store |
| GitHub workflow secrets | **Annually** | Regenerate in GitHub Settings and update repository secrets where still used |

**For production deployment, keep long-lived secrets in Railway or move them to a dedicated secrets manager (HashiCorp Vault, AWS Secrets Manager, or 1Password).** See [SECRETS-MANAGEMENT.md](./SECRETS-MANAGEMENT.md) for migration guidance.

After rotating any secret, verify:
1. Health check passes: `curl https://api.vaultlister.com/api/health`
2. No auth errors in Railway logs for the affected service
3. Marketplace integrations still work (test a sample listing)
