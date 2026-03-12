# Infrastructure & Delivery — Audit Report
**Date:** 2026-03-12
**Domain:** Infrastructure & Delivery (9 categories)
**Source taxonomy:** qa/full_testing_taxonomy.md §1, §27–§31, §33–§34, §44
**Domain definition:** qa/domains/infrastructure_delivery.md
**Auditor:** Claude (automated code inspection + evidence review)

---

## Summary

| Metric | Value |
|--------|-------|
| Categories audited | 9 |
| Total gaps identified | 49 |
| High-risk gaps | 16 |
| Medium-risk gaps | 18 |
| Low-risk gaps | 15 |
| Categories with zero automated coverage | 1 (Requirements/Scope) |
| Categories with strong existing evidence | 3 (Setup, Deployment, Backup) |

---

## Category 1: Requirements, Scope, and Acceptance Integrity

**Taxonomy ref:** §1
**Status:** Uncovered
**Automation:** Not Determined
**Risk:** Medium

### Evidence
- No formal requirements document linked to code
- Design files exist in `design/` but no acceptance-criteria-to-test traceability
- `docs/REPO_CONTRACTS.md` exists — not inspected for completeness
- `docs/runbooks/STRICT_EXECUTABLE_PLAYBOOK_v3_1.md` tracks 5 phases of production-readiness work, all marked complete

### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H1 | No traceability from design/03-Feature-Specs.md acceptance criteria to test files | High | Partial — could auto-scan test names against AC IDs |
| M1 | No formal scope boundary document distinguishing V1 vs deferred features | Medium | Manual |
| M2 | No change log linking PRs/commits to requirements changes | Medium | Partial — could generate from conventional commits |
| L1 | design/ folder referenced in CLAUDE.md but may be stale relative to implemented code | Low | Partial — drift detection similar to doc-code tests |

---

## Category 2: Setup, Provisioning, Bootstrap, and First-Run Behavior

**Taxonomy ref:** §27
**Status:** Partial
**Automation:** Partial Automation
**Risk:** Medium

### Evidence
- **`scripts/deploy-local.sh`** — Checks Bun, .env, node_modules, DB existence; seeds on prompt; starts server
- **`bun run db:init`** → `src/backend/db/init.js` — Creates DB, runs schema.sql, applies all migrations via `run-migrations.js`
- **`bun run db:seed`** → `src/backend/db/seed.js` — Seeds demo data (user, inventory, listings, shops)
- **`docs/evidence/SETUP_RUNBOOK.md`** — Clean-clone reproducibility drill PASSED (2026-03-05): git worktree, bun install --frozen-lockfile, db:reset, health + register + login + inventory verified
- **`.env.example`** — 335 lines, all required/optional vars documented with comments
- **CI `test-unit` job** runs db:init + db:seed before tests (evidence CI can bootstrap from scratch)

### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H2 | No test for first-run with missing/empty DB_PATH or DATA_DIR | High | Yes — unit test init.js with bad path |
| H3 | No test for startup with missing required env vars (JWT_SECRET, PORT) | High | Yes — spawn server process, verify error message |
| M3 | seed.js idempotency untested — running db:seed twice may fail on UNIQUE constraints | Medium | Yes — run seed twice in test |
| M4 | No test for startup with zero-state DB (schema exists but no users/data) | Medium | Yes — test health endpoint after db:init without seed |
| L2 | deploy-local.sh uses interactive `read -p` — not testable in CI without modification | Low | Manual |
| L3 | .env.example has FEATURE_AI_LISTING=true, FEATURE_WHATNOT_INTEGRATION=false, FEATURE_ADVANCED_ANALYTICS=true but no code reads FEATURE_* env vars anywhere in src/ | Low | Yes — drift detection test |

---

## Category 3: Deployment, Release, Versioning, and Configuration Assurance

**Taxonomy ref:** §28
**Status:** Partial
**Automation:** Partial Automation
**Risk:** High

### Evidence
- **Dockerfile** — Multi-stage build (builder + production). Bun 1.3 base. Non-root user `vaultlister`. HEALTHCHECK using `bun -e fetch(...)`. Exposes port 3000. `CMD ["bun", "run", "src/backend/server.js"]`.
- **docker-compose.yml** — 4 services: app (+ JWT_SECRET required), redis (7-alpine, 256mb, allkeys-lru), nginx (production profile), backup-scheduler (production profile). Named volumes for data/logs/backups.
- **`.github/workflows/deploy.yml`** — Triggers on CI success or manual dispatch. Builds + pushes to GHCR. SSH deploys to staging → production. Pre-deploy DB backup on production. Health check loop (12×5s). Telegram notifications on success/failure.
- **`nginx/nginx.conf`** — TLS 1.2+1.3, HSTS, rate limit zones (api:30r/s, auth:5r/s), gzip, WebSocket upgrade, /api/health bypasses rate limit, client_max_body_size 50m.
- **`scripts/post-deploy-check.mjs`** — 7 infrastructure checks: liveness, readiness, /api/v1/ alias, ETag, 304, Cache-Control, health rate-limit bypass.
- **`docs/evidence/DEPLOYMENT_VALIDATION.md`** — Docker deployment validated 2026-03-05, PASSED.
- **Server graceful shutdown** — `gracefulShutdown()` in server.js: stops workers/schedulers/WebSocket, flushes DB statements, removes PID file, calls `server.stop()`. 30s force-exit timeout. Handles SIGINT + SIGTERM.
- **`config/gate-thresholds.json`** — Performance gate thresholds for startup, health, inventory, and search latency.

### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H4 | No rollback mechanism tested — deploy.yml does `docker compose up -d --no-deps app` but no rollback step if health check fails after 60s | High | Manual — add rollback step to deploy.yml |
| H5 | FEATURE_* env vars in .env.example but no code reads them — config drift | High | Yes — test that each documented feature flag is read somewhere |
| H6 | No migration sequencing gate in CI — deploy happens regardless of pending migration state | High | Partial — could add migration check to CI |
| M5 | Nginx SSL certs are self-signed placeholders (`nginx/ssl/cert.pem`, `key.pem`) — no Let's Encrypt automation | Medium | Manual |
| M6 | docker-compose.yml references Redis but app code has REDIS_ENABLED env var commented out — Redis unused at runtime | Medium | Yes — test redis connectivity or document as unused |
| M7 | deploy.yml uses `appleboy/ssh-action@v1.0.3` without SHA pin (unlike other actions in ci.yml which use SHA pins) | Medium | Manual — pin the SHA |
| M8 | No config drift detection between .env.example and actual env var reads in source code | Medium | Yes — test that all documented vars are referenced |
| L4 | config/settings.json has mixed concerns: app config, Claude Code settings, platform limits — unclear which is runtime vs dev-time | Low | Manual |
| L5 | `config/settings.json` JWT expiresIn="7d" conflicts with ARCHITECTURE.md "15-min access / 7-day refresh" — ambiguous which is authoritative | Low | Yes — test that JWT expiry matches documented value |

---

## Category 4: Build, Packaging, Supply Chain, and Artifact Integrity

**Taxonomy ref:** §29
**Status:** Partial
**Automation:** Partial Automation
**Risk:** High

### Evidence
- **`scripts/build-frontend.js`** — Concatenates 24 source files in order, injects bundle version hash (SHA256), syncs `?v=` in index.html and sw.js, minifies via `bun build --minify --sourcemap=external`, outputs to `dist/app.js`. Fallback: writes unminified if bun build fails.
- **CI `build` job** — Runs after lint + unit tests. Checks `dist/app.js` < 3MB threshold. Uploads build artifacts with 30-day retention.
- **`bun.lock`** — Lockfile exists (text format).
- **Dockerfile** uses `bun install --frozen-lockfile` (both builder stage and production prune).
- **CI** uses `bun install --frozen-lockfile` in all jobs.
- **`.github/dependabot.yml`** — Weekly updates for npm and github-actions. Groups minor/patch dev deps. Ignores majors. Reviews assigned to `Vaultifacts`.
- **`auto-merge.yml`** — Auto-merges Dependabot patch updates and minor dev deps after CI passes. Comments on major updates.

### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H7 | CI lint job runs `find src -name "*.js" -exec node --check {} +` which hangs on ESM files (same issue as pre-commit hook) — CI lint may timeout or fail | High | Yes — fix CI to use bun or skip ESM files |
| H8 | Build script has silent fallback: if `bun build --minify` fails, it writes unminified JS with no CI error — production could serve unminified bundle | High | Yes — test that dist/app.js is minified |
| M9 | No build reproducibility test — same source should produce identical dist/app.js | Medium | Yes — build twice, compare hashes |
| M10 | Source maps (dist/app.js.map) included in Docker image — may leak source in production | Medium | Yes — test that source maps are excluded from production image |
| M11 | `scripts/build-frontend.js` writes to `src/frontend/index.html` and `public/sw.js` during build (mutates source) — side-effects in build step | Medium | Manual — refactor to write to dist/ only |
| L6 | No SBOM (Software Bill of Materials) generation | Low | Manual |
| L7 | Dockerfile COPY . . in builder stage copies test files, docs, scripts — larger build context than needed | Low | Manual — add .dockerignore |

---

## Category 5: CI/CD Pipeline, Test Harness, and Delivery Process Assurance

**Taxonomy ref:** §30
**Status:** Partial
**Automation:** Partial Automation
**Risk:** High

### Evidence
- **`ci.yml`** — 9 parallel jobs: lint, test-unit, test-e2e, security-scan, dep-audit, docker-build, accessibility-audit, visual-tests (3 shards), performance-check, build. All SHA-pinned except qa-guardian.yml actions.
- **`.test-baseline`** — Named failure tracking: KNOWN_FAIL entries + KNOWN_FAILURES count (currently 0). CI regression detection: any failure not in the named list blocks the build.
- **Coverage threshold** — 60% line coverage enforced in CI.
- **QA Guardian** (`qa-guardian.yml`) — Runs on push, PR, and nightly cron (6 AM UTC). Unit tests + Playwright E2E guardian suite.
- **Visual tests** — Sharded 3-way in CI, advisory only (warn but don't fail).
- **Concurrency** — CI uses `cancel-in-progress: true` (good for branches), Deploy uses `cancel-in-progress: false` (good for deploys).
- **Deploy gating** — deploy.yml triggers only on CI workflow_run success.

### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H9 | qa-guardian.yml uses unpinned action versions (`@v4`, `@v1`) — supply chain risk vs ci.yml which SHA-pins all actions | High | Yes — pin to SHA |
| H10 | CI lint step (`node --check`) will hang or fail on ESM files — same issue as local pre-commit hook | High | Yes — replace with bun or skip ESM |
| H11 | No migration gating — CI does not verify migration count or ordering before deploy | High | Yes — add migration check step |
| M12 | Visual tests are advisory-only — failures don't block. No mechanism to promote visual failures to blocking | Medium | Manual — add severity-based gating |
| M13 | qa-guardian.yml uses bun 1.1 while ci.yml uses bun 1.3.9 — version mismatch between CI workflows | Medium | Yes — unify bun versions |
| M14 | test-unit job starts server and runs all tests including integration tests — no separation between pure unit tests and server-dependent tests | Medium | Manual — split test targets |
| L8 | No flaky test retry mechanism in CI — a single flaky test fails the build | Low | Manual — add retry for known-flaky |
| L9 | Performance check job has no fail threshold — it runs load-test.js and checks for p95 text but doesn't enforce a gate | Low | Yes — enforce gate-thresholds.json values |

---

## Category 6: Admin, Operator, Support, and Internal Tooling Assurance

**Taxonomy ref:** §31
**Status:** Partial
**Automation:** Partial Automation
**Risk:** High

### Evidence
- **Admin routes** — `is_admin` checks found in: monitoring.js, reports.js, roadmap.js, feedback.js, pushNotifications.js, rateLimitDashboard.js
- **`src/tests/secgov-admin-monitoring.test.js`** — 18 tests covering admin-only path gating (non-admin 403, unauth 401, admin allowed) for monitoring routes
- **Admin gating inconsistency** — monitoring.js checks `is_admin` only; auditLog.js also accepts enterprise tier (documented in Security & Governance audit)
- **Scripts inventory** — `docs/SCRIPTS_INVENTORY.md` exists. 80+ scripts in `scripts/` directory. `scripts/help.js` provides CLI help.
- **Memory/STATUS.md** — Agent handoff protocol with Pending Review, In Progress, Last Completed Work sections

### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H12 | No admin user creation mechanism — `is_admin` column referenced in routes but no documented way to make a user admin | High | Yes — test admin creation flow |
| H13 | Admin gating inconsistency: monitoring.js uses `is_admin` only, auditLog.js accepts enterprise tier — different privilege models | High | Yes — test consistent admin gating across all admin routes |
| M15 | No admin dashboard or panel — admin routes exist but no UI to access them | Medium | Manual |
| M16 | 80+ scripts in scripts/ with many in scripts/archive/ — no cleanup or deprecation policy | Medium | Manual |
| L10 | scripts/help.js exists but may not cover all scripts | Low | Yes — compare help.js output against scripts/ directory |

---

## Category 7: Infrastructure, Runtime, and Platform Failure Behavior

**Taxonomy ref:** §33
**Status:** Partial
**Automation:** Partial Automation
**Risk:** High

### Evidence
- **Graceful shutdown** — `gracefulShutdown()` in server.js: stops token refresh scheduler, email polling, task worker, price check worker, metrics collection, WebSocket connections, flushes prepared statements, removes PID file, calls `server.stop()`. 30s force-exit timeout. Handles SIGINT + SIGTERM.
- **Uncaught exception handler** — `process.on('uncaughtException')` logs and exits with code 1.
- **Unhandled rejection handler** — `process.on('unhandledRejection')` logs but does NOT crash (keeps running).
- **Docker HEALTHCHECK** — `bun -e fetch('/api/health')` with 30s interval, 10s timeout, 3 retries, 5s start period.
- **Health endpoints** — `/api/health` (full: DB, disk, migrations, uptime), `/api/health/live` (simple process-alive), `/api/health/ready` (DB connectivity check, returns 503 if DB unavailable), `/api/workers/health` (background worker staleness detection).
- **Container restart policy** — `restart: unless-stopped` in docker-compose.yml.

### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H14 | No disk-full behavior test — health endpoint checks disk but no test verifies behavior when disk is critically low | High | Partial — mock disk check |
| H15 | No memory exhaustion test or OOM behavior — no memory limits in Dockerfile or docker-compose.yml | High | Manual — add resource limits |
| M17 | Graceful shutdown stops workers but doesn't drain in-flight HTTP requests — requests during shutdown may 503 | Medium | Partial — test shutdown behavior |
| M18 | No TLS certificate expiry monitoring — nginx/ssl has placeholder certs with no renewal automation | Medium | Manual |
| L11 | Worker health endpoint `/api/workers/health` is unauthenticated — potentially exposes internal state | Low | Yes — test that worker health doesn't expose sensitive data |
| L12 | Container has no resource limits (memory, CPU) in docker-compose.yml — host resource exhaustion possible | Low | Manual — add resource limits |

---

## Category 8: Backup, Restore, Disaster Recovery, and Business Continuity

**Taxonomy ref:** §34
**Status:** Partial
**Automation:** Partial Automation
**Risk:** High

### Evidence
- **`scripts/backup.js`** — Uses better-sqlite3 `.backup()` API (WAL-safe). Supports `--compress` (gzip). Cleans up old backups (keeps last 7). Reports sizes.
- **`scripts/restore.js`** — Validates SQLite integrity via `PRAGMA integrity_check`. Creates pre-restore backup. Decompresses `.gz` files. Verifies table counts after restore. Interactive confirmation (or `--force`).
- **docker-compose.yml backup services** — `backup-scheduler` (production profile): runs backup on start then every 24h. `backup` (backup profile): manual one-shot.
- **`docs/evidence/BACKUP_DRILL.md`** — Full backup/restore drill executed 2026-03-05, PASSED. Verified mutation → restore → baseline restoration.
- **`backups/`** — Contains 4 timestamped backups from 2026-03-05 with .db, .db-wal, .db-shm files.
- **Cloud backup** — `.env.example` documents S3/OneDrive via rclone. `scripts/backup-cloud-sync.sh` exists.
- **`BACKUP_EVIDENCE.md`** — Evidence file exists in docs/evidence/.

### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H16 | No automated restore validation test — backup drill was manual. No CI/CD step verifies backup→restore→integrity cycle | High | Yes — script backup, mutate, restore, verify in test |
| M19 | Backup retention policy (keep 7) not configurable — hardcoded in backup.js | Medium | Yes — test retention behavior |
| M20 | WAL/SHM sidecar files in backups/ directory — these should be consolidated before backup or excluded | Medium | Partial — verify .backup() API handles WAL |
| M21 | No RPO/RTO documented — backup-scheduler runs every 24h but no formal RPO/RTO targets | Medium | Manual |
| M22 | Cloud backup (rclone, S3) script exists but is not tested — no evidence of successful cloud backup | Medium | Manual — run and capture evidence |
| L13 | Backup files committed to git (backups/*.db) — should be .gitignored | Low | Yes — verify .gitignore covers backups/ |
| L14 | No backup encryption — backups are plaintext SQLite files | Low | Manual — encrypt at rest |

---

## Category 9: Coverage Model Assurance

**Taxonomy ref:** §44
**Status:** Partial
**Automation:** Partial Automation
**Risk:** High

### Evidence
- **`qa/coverage_matrix.md`** — 61-row matrix tracking all 44 taxonomy categories across 7 domains. Each row has Status, Automation, Risk, Evidence (with file:line references), Missing Coverage, and Last Updated.
- **`qa/full_testing_taxonomy.md`** — Master taxonomy with 44 categories across all domains.
- **`qa/domains/`** — 7 domain definition files with audit goals, required evidence, and common missing cases.
- **`qa/reports/audits/`** — Audit reports for security_governance, environment_quality domains.
- **`qa/reports/generation/`** — Generation reports for security_governance, environment_quality, data_systems, architecture_reliability domains.
- **`.test-baseline`** — Named failure tracking with history. Currently 0 known failures. 5289 unit tests pass, 620 E2E tests pass.
- **CI coverage enforcement** — 60% line coverage threshold in ci.yml.
- **`expect([200,500])` anti-pattern** — Documented in Architecture & Reliability audit. 30+ tests accept both success and failure as passing — masks real failures.

### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H17 | `expect([200,500])` anti-pattern in 30+ test files — tests pass regardless of whether the endpoint succeeds or fails, creating false coverage confidence | High | Yes — scan for the pattern and flag |
| H18 | Coverage matrix rows 53-61 (this domain) all marked "Uncovered" with "audit not run" — zero prior inspection of infrastructure/delivery domain | High | This audit resolves this gap |
| M23 | No test for test infrastructure itself — e.g., does `test:setup` reliably start the server? Does TestApiClient work correctly? | Medium | Partial |
| M24 | Integration tests mixed with unit tests in same directory (src/tests/) — no way to run unit-only without server | Medium | Manual — separate test targets |
| L15 | Visual tests advisory-only in CI — no mechanism to detect visual regressions that matter | Low | Manual |

---

## Top 10 Gaps by Priority

| Rank | ID | Gap | Risk | Category |
|------|-----|-----|------|----------|
| 1 | H7 | CI lint `node --check` hangs on ESM files | High | Build/Packaging |
| 2 | H10 | Same `node --check` hang in CI lint job | High | CI/CD |
| 3 | H17 | `expect([200,500])` anti-pattern in 30+ tests | High | Coverage Model |
| 4 | H4 | No rollback mechanism in deploy workflow | High | Deployment |
| 5 | H16 | No automated backup/restore validation test | High | Backup/DR |
| 6 | H8 | Build script silent fallback serves unminified JS | High | Build/Packaging |
| 7 | H9 | qa-guardian.yml unpinned action versions | High | CI/CD |
| 8 | H3 | No test for startup with missing required env vars | High | Setup/Bootstrap |
| 9 | H12 | No admin user creation mechanism documented | High | Admin Tooling |
| 10 | H11 | No migration gating in CI | High | CI/CD |

---

## Gaps Summary by Category

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| Requirements/Scope | 1 | 2 | 1 | 4 |
| Setup/Bootstrap | 2 | 2 | 2 | 6 |
| Deployment/Config | 2 | 4 | 2 | 8 |
| Build/Packaging | 2 | 3 | 2 | 7 |
| CI/CD Pipeline | 3 | 3 | 2 | 8 |
| Admin/Operator | 2 | 2 | 1 | 5 |
| Infrastructure/Runtime | 2 | 2 | 2 | 6 |
| Backup/DR | 1 | 4 | 2 | 7 |
| Coverage Model | 2 | 2 | 1 | 5 |
| **Total** | **16** | **18** | **15** | **49** |

---

## Automatable vs Manual

| Type | Count |
|------|-------|
| Fully automatable | 22 |
| Partially automatable | 10 |
| Manual only | 17 |

---

## Strong Existing Evidence (No New Tests Needed)

| Item | Evidence |
|------|---------|
| Clean-clone reproducibility | docs/evidence/SETUP_RUNBOOK.md — PASSED 2026-03-05 |
| Docker deployment validation | docs/evidence/DEPLOYMENT_VALIDATION.md — PASSED 2026-03-05 |
| Backup/restore drill | docs/evidence/BACKUP_DRILL.md — PASSED 2026-03-05 |
| Post-deploy infrastructure check | scripts/post-deploy-check.mjs — 7 checks covering liveness, readiness, ETag, 304, rate-limit bypass |
| Graceful shutdown | server.js:1244-1281 — SIGINT/SIGTERM handlers with 30s timeout, worker drain, PID cleanup |
| CI regression detection | .test-baseline — named failure tracking, zero known failures |
| Dependency updates | dependabot.yml + auto-merge.yml — weekly updates with CI gating |
