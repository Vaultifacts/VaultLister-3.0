# Secrets Management

## Rules

- Never commit secrets to the repo.
- Keep local secrets in `.env` only.
- Store production runtime secrets in Railway environment variables.
- Store CI/CD secrets in GitHub Actions secrets.
- Use `*_OLD` rotation windows only when a component explicitly supports dual-key verification.

## Runtime Secrets Inventory

| Secret | Required | Used by | Storage |
|--------|----------|---------|---------|
| `JWT_SECRET` | Yes | API auth, websocket auth, production smoke | Railway env, local `.env`, GitHub secret for smoke |
| `DATABASE_URL` | Yes | API server, worker, local backup/restore tooling | Railway env, local `.env` |
| `OAUTH_ENCRYPTION_KEY` | Production | OAuth token encryption/decryption | Railway env, local `.env` |
| `REDIS_URL` | Production/worker | worker process, Redis-backed runtime services | Railway env, local `.env` |
| `REDIS_PUBLIC_URL` | Production smoke | external smoke checks | GitHub Actions secret |
| `DATABASE_PUBLIC_URL` | Production smoke, backup workflows | external smoke checks, backups | GitHub Actions secret |
| `SENTRY_DSN` | Optional but recommended | app and worker error reporting | Railway env |
| `ANTHROPIC_API_KEY` | Optional | AI listing generation and AI routes | Railway env, local `.env` |
| `RESEND_API_KEY` | Optional | transactional email delivery | Railway env, local `.env` |
| `SLACK_WEBHOOK` | Optional | monitoring alerts | Railway env |
| `B2_APPLICATION_KEY_ID` | Backup workflows | Backblaze B2 upload/download | GitHub Actions secret |
| `B2_APPLICATION_KEY` | Backup workflows | Backblaze B2 upload/download | GitHub Actions secret |
| `B2_BUCKET_NAME` | Backup workflows | Backblaze B2 upload/download | GitHub Actions secret |
| `JWT_SECRET_OLD` | Rotation window only | JWT key rotation fallback | Railway env during rotation only |
| `OAUTH_ENCRYPTION_KEY_OLD` | Rotation window only | OAuth token re-encryption fallback | Railway env during rotation only |

## GitHub Actions Secret Inventory

Current workflows consume these secrets:

- `production-smoke.yml`
  - `JWT_SECRET`
  - `DATABASE_PUBLIC_URL`
  - `REDIS_PUBLIC_URL`
- `backup.yml`
  - `DATABASE_PUBLIC_URL`
  - `B2_APPLICATION_KEY_ID`
  - `B2_APPLICATION_KEY`
  - `B2_BUCKET_NAME`
- `backup-verify.yml`
  - `B2_APPLICATION_KEY_ID`
  - `B2_APPLICATION_KEY`
  - `B2_BUCKET_NAME`

`deploy.yml` uses fixed test-only values for CI jobs and does not currently consume repository secrets for the pre-deploy gates.

## Rotation Policy

Minimum rotation schedule:

| Secret | Rotation Interval |
|--------|-------------------|
| `JWT_SECRET` | Quarterly (90 days) |
| `OAUTH_ENCRYPTION_KEY` | Quarterly (90 days) |
| `DATABASE_URL` / DB credentials | Quarterly or whenever DB access changes |
| `REDIS_URL` | Quarterly or whenever Redis access changes |
| `SENTRY_DSN` | Annually or on vendor-side exposure |
| `ANTHROPIC_API_KEY` | Annually or on exposure |
| `RESEND_API_KEY` | Annually or on exposure |
| `B2_APPLICATION_KEY_ID` / `B2_APPLICATION_KEY` | Annually or on exposure |

Rotate immediately when:

- a secret appears in logs, screenshots, commits, tickets, or chat
- a contributor with access leaves the team
- a third-party integration is compromised
- a platform reports leaked or abused credentials

## Rotation Procedure

1. Generate the replacement secret in the source system.
2. Update the secret in Railway or GitHub Actions, depending on where it is used.
3. For JWT or OAuth encryption rotations, set the corresponding `*_OLD` fallback only if the runtime supports it.
4. Restart or redeploy the affected services.
5. Remove `*_OLD` fallback values after the rotation window closes.

For OAuth token re-encryption, use:

```bash
OAUTH_ENCRYPTION_KEY=<new> OAUTH_ENCRYPTION_KEY_OLD=<old> bun scripts/rotate-encryption-key.js
```

## Validation After Rotation

Run these checks after changing any runtime secret:

```bash
bun run validate:env
curl -sf http://localhost:3000/api/health
curl -sf http://localhost:3000/api/workers/health
bun run ops:health
```

For GitHub Actions secrets, also validate the relevant workflow:

- production smoke secrets: run `production-smoke.yml`
- backup secrets: run `backup.yml`
- B2 restore-readiness: run `backup-verify.yml`

## Failure Checkpoints

Stop and investigate if any of these happen after a rotation:

- login fails for valid users
- `/api/health` or `/api/workers/health` degrades
- worker process cannot connect to Redis
- backup or production smoke workflows start failing
- OAuth-connected shops can no longer decrypt stored tokens
