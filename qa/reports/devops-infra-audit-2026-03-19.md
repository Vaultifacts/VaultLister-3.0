# VaultLister 3.0 — DevOps & Infrastructure Audit
**Date:** 2026-03-19
**Auditor:** QA Specialist (Claude)
**Scope:** Layer 6 — Docker, CI/CD, Nginx, backup/restore, secrets, service worker
**Files scanned:** `Dockerfile`, `docker-compose.yml`, `docker-compose.staging.yml`, `.github/workflows/ci.yml`, `deploy.yml`, `deploy-staging.yml`, `qa-guardian.yml`, `auto-merge.yml`, `nginx/nginx.staging.conf`, `nginx/nginx.conf` (partial), `scripts/backup.js`, `scripts/restore.js`, `scripts/smoke-test-staging.sh`, `.env.example`, `public/sw.js`

---

## Methodology

Every finding is sourced from direct file reads with line numbers cited. No claim is made without evidence.

Severity levels:
- **CRITICAL** — exploit or data-loss vector reachable today with no prerequisites
- **HIGH** — failure mode that will cause an outage, silent data loss, or security breach on the next trigger event
- **MEDIUM** — operational gap that meaningfully degrades reliability, observability, or security posture
- **LOW** — hygiene, hardening, or best-practice deviation

---

## Findings Table

| ID | File | Line(s) | Severity | Category | Description |
|----|------|---------|----------|----------|-------------|
| D-01 | `docker-compose.staging.yml` | 87, 91 | CRITICAL | Secret management | Redis `REDIS_PASSWORD` defaults to literal string `changeme` in both the `command:` start argument and the healthcheck test. If the host `.env` is missing `REDIS_PASSWORD`, Redis starts with a publicly known password. No startup abort guard exists. |
| D-02 | `docker-compose.yml` | 19, 64 | CRITICAL | Secret management | Same `changeme` default for `REDIS_PASSWORD` in production compose. Production Redis is unauthenticated by default if the operator never sets the env var. `JWT_SECRET` uses `:?` (fails fast) but `REDIS_PASSWORD` does not receive the same treatment. |
| D-03 | `deploy.yml` | 92, 162 | HIGH | Secret management | GITHUB_TOKEN is echoed verbatim via `echo ${{ secrets.GITHUB_TOKEN }} \| docker login` in the production deploy job. If runner debug logging is enabled, the token appears in runner logs. `deploy-staging.yml` writes to a temp file first (safer); the production job does not. |
| D-04 | `deploy.yml` | 74 | HIGH | Supply chain | `appleboy/ssh-action@v1.0.3` is referenced by mutable version tag, not by commit SHA. `webfactory/ssh-agent@v0.10.0` in `deploy-staging.yml` line 124 has the same problem. A compromised maintainer can push malicious code under the same tag and gain SSH access to both staging and production servers. All other actions in `ci.yml` are SHA-pinned. |
| D-05 | `deploy-staging.yml` | 51-55 | HIGH | Build / packaging | The SW cache-version bump uses `sed -i` to mutate `public/sw.js` in the CI runner checkout, then immediately runs `docker build`. The modified file is baked into the image but the repo retains the old version string. The shipped artifact diverges from the source-controlled file on every staging deploy. Git status at audit time shows `M public/sw.js` (uncommitted modification) confirming active divergence. |
| D-06 | `docker-compose.staging.yml` | 108-109 | HIGH | Network / ports | Staging Nginx binds host ports `80:80` and `443:443`. The file header comment says it listens on "8080/8443 to avoid collision with any production Nginx on the same host." The actual binding contradicts the stated intent and will conflict with production if both stacks run on the same host. |
| D-07 | `scripts/` (absent) | n/a | HIGH | Backup / DR | `scripts/backup.sh` and `scripts/rollback.sh` do not exist in the repository (confirmed by full directory listing). `deploy-staging.yml` calls `/opt/vaultlister-staging/backup.sh` (line 154) and `/opt/vaultlister-staging/rollback.sh` (line 246) via SSH with no provisioning step, no existence check, and no fallback. A newly provisioned server will fail both steps silently or fatally. |
| D-08 | `scripts/restore.js` | 115 | HIGH | Backup / restore | The restore procedure uses `copyFileSync` to overwrite the live database while the application server may still be running. For WAL-mode SQLite, `copyFileSync` can produce a corrupt result if there are outstanding WAL frames. The correct approach is to stop the server first, or use SQLite's `.restore()` API (as `backup.js` correctly uses `.backup()`). No server-stop step is documented or automated. |
| D-09 | `ci.yml` | 17-18 | HIGH | CI/CD | `DISABLE_CSRF: true` and `DISABLE_RATE_LIMIT: true` are set as workflow-level env vars inherited by all jobs, including `security-scan`. The security test suite runs with CSRF and rate limiting disabled; tests pass conditions that differ from production runtime. The shipped security posture is never tested in CI. |
| D-10 | `nginx/nginx.staging.conf` | (absent) | HIGH | Nginx / security | No `Content-Security-Policy` header is set anywhere in `nginx.staging.conf`. X-Frame-Options, X-Content-Type-Options, and HSTS are present, but without CSP, XSS payloads can load arbitrary scripts from any external origin. |
| D-11 | `nginx/nginx.staging.conf` | 170-179 | HIGH | Nginx / logging | The static-asset location block (`.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$`) sets `Cache-Control: public, immutable` but omits `proxy_set_header Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers that every other location block sets. Requests hitting this path have incorrect IP attribution in application logs, breaking rate-limit source tracking. |
| D-12 | `docker-compose.yml`, `docker-compose.staging.yml` | (absent) | HIGH | Resource limits | No `mem_limit`, `cpus`, `pids_limit`, or `ulimits` are set on any service in either compose file. A runaway request, memory leak, or misbehaving Playwright automation can OOM-kill the host or starve sibling containers without any Docker-level guardrail. |
| D-13 | `nginx/nginx.staging.conf` | 152-159 | MEDIUM | Nginx / security | The `/api/health` location has no `limit_req` zone and `access_log off`. No `allow/deny` IP restriction. A scanner can enumerate the endpoint JSON response at unlimited rate from any IP. |
| D-14 | `docker-compose.staging.yml` | 65-67 | MEDIUM | Backup / DR | Staging has a `vaultlister-staging-backups` named volume but no `backup-scheduler` service equivalent to the one in production compose. Backups are never taken automatically in staging. The pre-deploy step delegates to a shell script on the host that does not exist in the repo (D-07). |
| D-15 | `scripts/backup.js` | 84 | MEDIUM | Backup / DR | Backup retention count is hardcoded to `7`. No env var controls it. `.env.example` does not document a `BACKUP_RETENTION_COUNT` variable. The value cannot be changed without editing source code. |
| D-16 | `scripts/backup.js` | 58-61 | MEDIUM | Backup / DR | Backup verification logs original vs backup size but does not assert equality or compute a checksum. A partially-written backup caused by a mid-write disk-full event is logged as success. |
| D-17 | `scripts/smoke-test-staging.sh` | 22 | MEDIUM | CI/CD / deployment | Test 1 targets `/health` (no `/api/` prefix) while all other tests and the Docker HEALTHCHECK target `/api/health`. If the app only serves the health endpoint under `/api/health`, Test 1 always returns non-200 and the smoke test suite produces a permanent false failure. |
| D-18 | `deploy-staging.yml` | 238 | MEDIUM | CI/CD / deployment | The full smoke-test suite is invoked with hardcoded URL `https://vaultlister.com` (the production domain). If staging runs on a different hostname, every smoke test either fails or silently tests production instead of staging. The URL should be a secret or env var. |
| D-19 | `ci.yml` | 47-51 | MEDIUM | CI/CD / build | The JavaScript syntax check pipes `bun build --no-bundle` output through `grep -i "error"` and exits 1 if the word "error" appears anywhere in stdout. Any warning containing "error" as a substring triggers a false positive exit. The pattern is not anchored to actual build error output. |
| D-20 | `ci.yml` | 466-509 | MEDIUM | CI/CD / deployment | The `build` job uploads `dist/` as an artifact but `deploy.yml` never downloads it. Production Docker build re-runs `bun run build` from scratch inside the Dockerfile. The verified artifact from CI is discarded; the shipped artifact is independently rebuilt without a tested prerequisite. |
| D-21 | `nginx/nginx.staging.conf` | 101 | MEDIUM | Nginx / security | HSTS `max-age=31536000` is set without the `preload` directive. This should be an explicit configuration decision rather than an omission. |
| D-22 | `Dockerfile` | 63-64 | MEDIUM | Health checks | HEALTHCHECK `start-period` is `5s`. Bun.js startup, migration execution, and WAL-mode SQLite initialisation on a cold start routinely exceeds 5 seconds. The staging compose overrides to `15s` (correct), but the Dockerfile default applies to any direct image run without a compose override, causing premature unhealthy status and potential rollback loops. |
| D-23 | `docker-compose.yml` | 44-45 | MEDIUM | Health checks | Production compose `start_period` is `10s`. Staging uses `15s`. Dockerfile default is `5s`. The inconsistency means production may declare a container unhealthy before migrations complete on a schema-migrating deploy, triggering an erroneous automatic rollback. |
| D-24 | `.env.example` | 16 | MEDIUM | Secret management | `JWT_SECRET` is set to the placeholder `your-super-secret-jwt-key-change-this-in-production`. If an operator copies `.env.example` to `.env` without editing it, the placeholder ships to production. No startup-time validation rejects this placeholder string. |
| D-25 | `.env.example` | 81 | MEDIUM | Secret management | `FIREBASE_PRIVATE_KEY` is a multi-line PEM key. Newline escaping is inconsistent between Docker env, dotenv, and shell. No guidance is provided on how to safely load this key. Operators following the example verbatim are likely to produce broken Firebase auth. |
| D-26 | `public/sw.js` | 4, 11-24 | MEDIUM | Service worker | Precached chunk filenames include hardcoded query-string version hashes (`?v=3e7afc1b`). If the deploy process updates the hash in `index.html` but does not correctly regenerate `sw.js` (a real risk given D-05), stale clients precache wrong URLs, getting 404s for app shell files and silently falling back to an outdated offline shell. No mechanism alerts the user when the SW update fails to install. |
| D-27 | `public/sw.js` | 319-341 | MEDIUM | Service worker / security | The `syncInventory` background-sync handler makes mutating `fetch` calls using whatever `change.method` and `change.data` are stored in IndexedDB. If the `pendingInventoryChanges` store is poisoned via XSS or a malicious extension, the SW replays arbitrary HTTP methods to `/api/inventory` with a valid auth token. No method allowlist or payload schema validation is applied before the fetch. |
| D-28 | `qa-guardian.yml` | 36-37 | LOW | CI/CD / supply chain | `oven-sh/setup-bun@v1` and `actions/cache@v4` in `qa-guardian.yml` use floating version tags. The same actions are SHA-pinned in `ci.yml`. `qa-guardian.yml` can silently pick up breaking changes without SHA-pin protection. |
| D-29 | `ci.yml` | 133-145 | LOW | CI/CD / test harness | Coverage enforcement applies only to line coverage (60% minimum). Function coverage is extracted and logged but has no enforcement threshold. New modules can ship with 0% function coverage while CI passes. |
| D-30 | `docker-compose.yml` | 97-117 | LOW | Backup / DR | The `backup-scheduler` service uses `sleep 86400` in a shell loop for daily scheduling. A deploy-time container restart silently shifts the backup window and a missed backup is not alerted. |
| D-31 | `nginx/nginx.staging.conf` | 44-46 | LOW | Nginx / reliability | The `upstream vaultlister_staging` block defines a single server with no `max_fails`, `fail_timeout`, or passive health-check parameters. If the app container becomes unresponsive, Nginx routes requests to it indefinitely with no proxy-layer circuit-breaking. |
| D-32 | `ci.yml` | 395-399 | LOW | CI/CD / test harness | Visual test failures emit `::warning::` but do not fail CI (`set +e` before the run, warning-only exit). A rendering regression that breaks the entire UI will merge to main without blocking the deploy. |
| D-33 | `scripts/restore.js` | 142 | LOW | Backup / DR | After a successful restore, the script prints "You may need to restart the server" but does not restart the Docker container. No automation enforces or verifies the restart. |
| D-34 | `.env.example` | 338-352 | LOW | Documentation | rclone cloud backup env vars (`RCLONE_PATH`, `VAULTLISTER_RCLONE_REMOTE`, `VAULTLISTER_REMOTE_PATH`) are documented in `.env.example` but consumed by `scripts/backup-cloud-sync.sh`, not by `scripts/backup.js`. The relationship is undocumented. Operators may configure these vars expecting `backup.js` to use them and see no cloud backup. |

---

## Critical Path Summary

**Must fix before next staging deploy:**

1. **D-07** — `backup.sh` and `rollback.sh` absent from the repository. The deploy workflow calls them unconditionally via SSH on every push to staging. The next deploy will fail at the pre-deploy backup step or leave rollback unavailable.
2. **D-01** — Redis `changeme` default in staging compose. Fix: change `:-changeme` to `:?REDIS_PASSWORD must be set` on lines 87 and 91 of `docker-compose.staging.yml`.
3. **D-05** — `sw.js` mutated in CI but not committed back. The shipped image SW diverges from the repo on every deploy; stale clients may precache 404 URLs.

**Must fix before next production deploy:**

4. **D-02** — Same `changeme` Redis default in production compose.
5. **D-09** — CSRF and rate limiting disabled in the security test suite; the tested configuration differs from production.
6. **D-08** — `copyFileSync` restore on a live WAL-mode database risks corruption.
7. **D-03** — GITHUB_TOKEN exposed in shell pipeline in the production deploy job.
8. **D-10** — No CSP header in the staging Nginx config; verify production config as well.
9. **D-12** — No container resource limits on any service in either compose file.
10. **D-06** — Staging Nginx binds ports 80/443, conflicting with production on a shared host.
11. **D-04** — Mutable-tag SSH actions in `deploy.yml`; replace with commit SHA pins.

---

## Tested vs Assumed

| Claim | Verification Status |
|-------|-------------------|
| Dockerfile runs as non-root user | VERIFIED — Dockerfile line 67 (`USER vaultlister`) |
| Multi-stage build separates build from runtime | VERIFIED — Stage 1 (builder), Stage 2 (production) |
| Docker HEALTHCHECK configured | VERIFIED — Dockerfile line 63, both compose files |
| CI actions SHA-pinned | VERIFIED for `ci.yml`; PARTIAL — SSH action in `deploy.yml` and actions in `qa-guardian.yml` are not SHA-pinned |
| Rollback mechanism exists on failed health check | VERIFIED in code; UNVERIFIED on first-ever deploy (no prior image to tag as rollback) |
| `backup.sh` exists on staging server | NOT VERIFIED — file absent from repo; server state is unknown |
| Restore procedure stops the server first | REFUTED — `restore.js` does not stop the container |
| Redis password enforced in production | REFUTED — default is `changeme`, no `:?` guard |
| CSRF enabled in the security test suite | REFUTED — `DISABLE_CSRF=true` is a workflow-level env var in `ci.yml` |
| Smoke test targets the staging environment | REFUTED — URL is hardcoded to `https://vaultlister.com` (production domain) |
| SW cache version stays in sync with deployed build | PARTIALLY REFUTED — `sw.js` mutated in CI runner, not committed; active `M` status in git confirmed at audit time |
| Backup file integrity verified post-backup | PARTIAL — file size is logged; no checksum is computed or stored |
| Container resource limits prevent OOM | REFUTED — no `mem_limit` or `cpus` set in either compose file |
