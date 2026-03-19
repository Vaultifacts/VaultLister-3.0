# Scripts Layer Audit — VaultLister 3.0
**Date:** 2026-03-19
**Auditor:** QA Specialist (Claude)
**Scope:** All files in `scripts/` (top-level + `scripts/lib/` + `scripts/ps/`)
**Method:** Full source read of every file; cross-referenced against `package.json` scripts block; verified disk state of every referenced path.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 11 |
| Medium | 9 |
| Low | 8 |
| Info | 7 |
| **Total** | **39** |

---

## Findings Table

| ID | File | Line | Severity | Category | Description |
|----|------|------|----------|----------|-------------|
| S-01 | `scripts/test-report.mjs` | 26, 92, 95, 111 | Critical | Error Handling / Dead Reference | `HOME` and `PROJECT` are used as plain identifiers — neither is declared or imported. Both are `undefined` at runtime. `join(HOME, ...)` throws `TypeError: Path must be a string` on load. The E2E runner also hard-codes `DISPLAY=:99` (Linux X11 only). Script is broken on every invocation on this platform. |
| S-02 | `scripts/backup-automation.js` | 73-82 | Critical | Backup / WAL Safety | `createBackup()` uses raw `createReadStream -> gzip -> createWriteStream` (or `copyFileSync`) directly against the live SQLite DB file. For a WAL-mode database, WAL frames not yet checkpointed are absent from the main file; the WAL file is not copied atomically. Backups produced this way can be silently corrupt. The safe API is `db.backup()` from `better-sqlite3`, used correctly in `backup.js` but omitted here. All three scheduled backup types (daily/weekly/monthly) are affected. |
| S-03 | `scripts/run-migrations.js` | 8 | Critical | ESM / Runtime Compatibility | Imports `Database from 'bun:sqlite'` — a Bun-only built-in. Shebang is `#!/usr/bin/env node`. Running under Node throws `ERR_MODULE_NOT_FOUND`. Separately, line 22 performs `await import('fs')` inside top-level synchronous code to obtain `mkdirSync`, which is already statically imported at line 5 — redundant and misleading. |
| S-04 | `scripts/lib/env.js` | 18 | Critical | ESM / CJS Conflict | File is loaded as ESM (`package.json` sets `"type":"module"`). Line 18 calls `require('fs').readFileSync(...)`. `require` does not exist in ESM — throws `ReferenceError: require is not defined` on every invocation of `session-end.js` and `transfer-approved.js`. Fix: add `readFileSync` to the existing static `import` at the top of `lib/env.js` and remove the `require()` call. |
| S-05 | `scripts/backup-automation.js` | 145 | High | Path Handling / Windows | Extracts filename with `backupPath.split('/').pop()`. On Windows, `path.join()` produces backslash paths. The split on `'/'` returns the entire Windows path as the filename, breaking rclone copy. Use `path.basename(backupPath)` instead. Same bug exists in `backup-cloud-sync.sh` line 136. |
| S-06 | `scripts/backup-cloud-sync.sh` | 22-23 | High | Path Handling / Windows | Hardcodes `RCLONE="${HOME}/.local/bin/rclone"` and `BUN="${HOME}/.bun/bin/bun"` — Linux conventions. On Windows (Git Bash) neither path exists. Both commands fail with `No such file or directory` with no fallback to PATH lookup. |
| S-07 | `scripts/server-manager.js` | 143-160 | High | Process Cleanup / Windows | `stopServer()` sends `SIGTERM` via `process.kill(pid, 'SIGTERM')`. On Windows, `SIGTERM` is silently ignored for external processes. The code polls for 5 s, observes no exit, tries `SIGKILL` (which throws on Windows for external PIDs), and only then reaches the `taskkill` fallback in the catch block. Effective stop on Windows is a 5 s stall then taskkill, with no feedback that SIGTERM was ignored. |
| S-08 | `scripts/poshmark-scheduler.js` | 359-418 | High | Process Cleanup | SIGINT/SIGTERM handlers call `releaseLock()` and `clearInterval()` but do not await any open Playwright `browser.close()` or `context.close()`. If a browser task is mid-flight when the signal fires, the Chromium subprocess is leaked. Same gap in `poshmark-keepalive.js` and `poshmark-publish-bot.js`. |
| S-09 | `scripts/smoke-test.mjs` | 19 | High | Config / Hardcoded Port | Default port falls back to `3001` but `post-deploy-check.mjs` defaults to `3000`, and the dev server runs on `3000`. Running `node scripts/smoke-test.mjs` without arguments against a dev server silently connects to the wrong port; all checks return connection-refused which the script misreports as failures. |
| S-10 | `scripts/runMigration.js` | 8, 12-13 | High | ESM / Bun-only + Dead Script | Uses `import.meta.dir` (Bun extension, not Node-compatible). Hardcodes a single migration file path (`001_add_deleted_at.sql`) that has already been applied. No `package.json` reference. This dead one-shot emits false confidence when run against a DB where the migration already exists. |
| S-11 | `scripts/tail-audit.js` | 72-78 | High | ESM / Bun-only | File-watch callback uses `Bun.file(LOG_PATH)` — a Bun-specific global. Invoked correctly with `bun ...` in `package.json`. Would throw `ReferenceError: Bun is not defined` under Node. No runtime guard. |
| S-12 | `scripts/lighthouse-audit.js` | 65 | High | ESM / Bun-only | Uses `Bun.file(outputFile).text()`. Invoked with `bun run ...`. Same category as S-11. |
| S-13 | `scripts/sync-visual-test-prompt.js` | 32, 39, 48 | High | ESM / Bun-only | Uses `Bun.file()` and `Bun.write()`. Invoked with `bun ...`. Same category as S-11. |
| S-14 | `scripts/build-dev-bundle.js` and `scripts/build-frontend.js` | 22, 13 | High | ESM / Bun-only | Both use `import.meta.dir` (Bun extension, undefined in Node). Both invoked with `bun ...` in `package.json` so no current defect, but a runtime-switch risk. Noted because `package.json` also invokes some scripts with `node` directly and the mix is easy to break. |
| S-15 | `scripts/run-e2e-chunks.js` | 192-196 | Medium | Config / Test Safety | Injects `DISABLE_CSRF: 'true'` and `DISABLE_RATE_LIMIT: 'true'` into every chunk environment, including security-oriented specs. This is the same D-09 finding from `devops-infra-audit-2026-03-19.md` confirmed to also originate in this script. |
| S-16 | `scripts/restore.js` | 115 | Medium | Backup / WAL Safety | `copyFileSync(restoreFile, DB_PATH)` replaces the main DB file while the server's WAL and SHM files remain in place. If the server is running, WAL state is inconsistent with the restored main file. The script prints a reminder to restart but does not enforce a pre-restore server stop. |
| S-17 | `scripts/restore.js` | 77-80 | Medium | File System Safety | Creates a pre-restore backup via `copyFileSync(DB_PATH, preRestoreBackup)` without a `mkdirSync(DATA_DIR, { recursive: true })` guard. If `data/` does not exist, this throws `ENOENT` before any restore begins. |
| S-18 | `scripts/deploy-local.sh` | 44 | Medium | Path Handling / Windows | `if [ ! -f "data/vaultlister.db" ]` uses a relative path with no `cd "$(dirname "$0")/.."` guard. Running from any directory other than the repo root silently skips database initialisation. `backup-cloud-sync.sh` handles this correctly at its line 19. |
| S-19 | `scripts/gate-sync.mjs` and `scripts/gate-drift-check.mjs` | 10-11 | Medium | Path Handling | Both use `process.cwd()` as the repo root. Invoked from any subdirectory, output files are written to the wrong location. No CWD guard or root-detection logic. |
| S-20 | `scripts/session-start.js` | 65-66 | Medium | Error Handling / Silent Catch | Server health check catches all errors with empty `catch {}`. A broken health endpoint (HTTP 500, malformed JSON) is indistinguishable from the server being down, producing a misleading `NOT RUNNING` status with no diagnostic output. |
| S-21 | `scripts/backup-automation.js` | 34 | Medium | Config / Hardcoded Value | `onedrivePath` defaults to `'/VaultLister/Backups'` — Unix absolute-path format. rclone remote paths use `Remote:path` notation without a leading `/`; the leading slash causes rclone to treat this as a local absolute path. |
| S-22 | `scripts/ps/run-full-validation.ps1` | 7 | Medium | File System Safety | `$logFile = "vaultlister_test_run.log"` is a bare relative path. The log is written to whatever directory PowerShell's CWD is at invocation time, not necessarily the repo root. |
| S-23 | `scripts/backup-automation.js` | 152-162 | Low | Error Handling / Silent Catch | `syncViaRclone()` catches all cloud-sync failures, logs them to stderr, and continues. The process exits 0 regardless. A failed cloud backup is invisible in monitoring. |
| S-24 | `scripts/check-links.sh` | all | Low | Dead Script | Not referenced in `package.json`. No call sites found. Orphaned. |
| S-25 | `scripts/checkDatabase.js`, `checkUsers.js`, `cleanInventory.js`, `fixInventoryStatus.js`, `searchXss.js` | all | Low | Dead Scripts | No `package.json` entries. No call sites. All use `bun:sqlite`. Dev one-offs with no documented invocation path. |
| S-26 | `scripts/simulateRealUsage.js`, `scripts/suggest-features.js`, `scripts/search-issues.js`, `scripts/validate-notion-structure.js` | all | Low | Dead Scripts | No `package.json` entries. No call sites. Development helpers with no documented invocation path. |
| S-27 | `scripts/state_snapshot.ps1` | all | Low | Dead Script | Not referenced in `package.json`. One-off PowerShell snapshot. |
| S-28 | `scripts/add-to-approval.js` | all | Low | Dead Script | No `package.json` entry. Superseded by `session-end.js`. |
| S-29 | `scripts/run-api-tests.js` and `scripts/run-e2e-tests.js` | all | Low | Dead Scripts | No `package.json` entries. Both superseded by `run-e2e-chunks.js` and `bun test`. |
| S-30 | Poshmark scripts (`poshmark-login.js`, `poshmark-keepalive.js`, `poshmark-scheduler.js`) | 21-48 | Info | Config / Credential Handling | `readEnvVar()` is duplicated across three files, each with subtly different error handling. The shared `lib/env.js` loader exists but is not used here (it is also broken — S-04). Maintenance risk when `.env` format changes. |
| S-31 | `scripts/poshmark-scheduler.js` | 43-48 | Info | Config / Credential Handling | `readEnvVar()` re-reads the `.env` file on each call. If `.env` is modified while the scheduler is running, credentials change mid-session without a restart, potentially causing automation credential drift. |
| S-32 | `scripts/smoke-test.mjs` | 160-175 | Info | File System Safety | Writes audit log using bare relative path `./data/logs`. If run from outside the repo root the log is misplaced. Compare `tail-audit.js` which uses `join(__dirname, '..', 'data', ...)` correctly. |
| S-33 | `scripts/test-report.mjs` | 108 | Info | Platform / Linux-only | `DISPLAY=:99` is a Linux X11 display variable. Signals this script was authored for Linux CI and has not been adapted for this Windows project. |
| S-34 | `scripts/visual-test-setup-prompt.md` | all | Info | Misplaced File | A 340 KB Markdown prompt artifact in `scripts/`. Not a script. Belongs in `docs/` or `qa/prompts/`. |
| S-35 | `scripts/qa_*.ps1` (12 files) | all | Info | Tooling Relationship | 12 PowerShell QA generation scripts in `scripts/` with no `package.json` entries. Relationship to `qa/coverage_matrix.md` is implicit and undocumented. No deprecation policy. |
| S-36 | `scripts/poshmark-delete-listing.mjs` and `scripts/poshmark-diagnose.mjs` | all | Info | Dead Scripts (operator tools) | Not in `package.json`. Manual operator tools that are functional but entirely undocumented from an operator runbook perspective. |
| S-37 | `scripts/seed-demo.js` | all | Info | Shadowed Script | `package.json` `db:seed` command calls `bun run src/backend/db/seed.js`, not this file. `seed-demo.js` is a more elaborate version but is never invoked. Operator confusion risk. |

---

## Missing Scripts Verification

All scripts referenced in `package.json` were verified to exist on disk. **Zero missing scripts found.**

Referenced scripts confirmed present:
`scripts/build-dev-bundle.js`, `scripts/build-frontend.js`, `scripts/server-manager.js`, `scripts/kill-port.js`, `scripts/run-e2e-chunks.js`, `scripts/poshmark-login.js`, `scripts/stealth-fingerprint-test.js`, `scripts/visual-test.js`, `scripts/backup.js`, `scripts/restore.js`, `scripts/gate-sync.mjs`, `scripts/gate-drift-check.mjs`, `scripts/ps/run-bun-tests.ps1`, `scripts/ps/set-env-and-run.ps1`, `scripts/ps/run-full-validation.ps1`, `scripts/ps/start-test-bg.ps1`, `runbook/all.ps1`, `tools/autopilot/fix-e2e-failures.ps1`

---

## Dead Script Inventory (22 files)

| File | Reason |
|------|--------|
| `scripts/check-links.sh` | Orphaned, no caller |
| `scripts/runMigration.js` | One-shot, superseded |
| `scripts/checkDatabase.js` | Dev tool, no caller |
| `scripts/checkUsers.js` | Dev tool, no caller |
| `scripts/cleanInventory.js` | Dev tool, no caller |
| `scripts/fixInventoryStatus.js` | Dev tool, no caller |
| `scripts/searchXss.js` | Dev tool, no caller |
| `scripts/simulateRealUsage.js` | Dev tool, no caller |
| `scripts/suggest-features.js` | Dev tool, no caller |
| `scripts/search-issues.js` | Dev tool, no caller |
| `scripts/validate-notion-structure.js` | Dev tool, no caller |
| `scripts/state_snapshot.ps1` | One-off, orphaned |
| `scripts/add-to-approval.js` | Superseded by `session-end.js` |
| `scripts/poshmark-delete-listing.mjs` | Manual operator tool only |
| `scripts/poshmark-diagnose.mjs` | Debug tool only |
| `scripts/test-d3-extension.js` | Debug tool only |
| `scripts/seed-demo.js` | Shadowed by `src/backend/db/seed.js` |
| `scripts/run-api-tests.js` | Superseded |
| `scripts/run-e2e-tests.js` | Superseded by `run-e2e-chunks.js` |
| `scripts/stealth-live-test.js` | Manual debug tool |
| `scripts/visual-test-setup-prompt.md` | Prompt artifact, not a script |
| `scripts/qa_*.ps1` (12 files) | QA generation helpers, no `package.json` entry |

---

## Verified Correct (No Finding)

| File | Evidence |
|------|---------|
| `scripts/backup.js` | Uses `db.backup()` — WAL-safe. `mkdirSync` guard before write. Retention cleanup is correctly best-effort. |
| `scripts/kill-port.js` | Windows and Unix both handled. Error swallow on port-not-in-use is intentional and correct. |
| `scripts/rotate-encryption-key.js` | Both keys validated present and unequal. Round-trip decrypt verification after re-encrypt. Exits 1 on any failure with clear next-step instructions. |
| `scripts/post-deploy-check.mjs` | All checks wrapped in try/catch. JSON mode for CI. Correct non-zero exit on failure. |
| `scripts/check-publish-credentials.js` | Does not print secret values. Placeholder detection present. Exits 1 on missing `.env`. |
| `scripts/poshmark-scheduler.js` | Lock file prevents duplicate instances. SIGINT/SIGTERM clear timers. (Browser leak noted as S-08.) |
| `scripts/gate-sync.mjs` | `mkdirSync` guard present. |
| `scripts/lib/backup-manifest.js` | Checksum computed and stored. `mkdirSync` guard. Corrupt JSON falls back to empty manifest. |
| `scripts/ps/start-test-bg.ps1` | Stale PID cleanup, health poll, error log captured, correct port 3100. |
| `scripts/run-e2e-chunks.js` | Self-check for uncovered spec files. `mkdirSync` before report write. JSON parse with exit-code fallback. |

---

## Priority Fix Recommendations

1. **S-04** (`scripts/lib/env.js` — `require()` in ESM) — breaks `session-end.js` and `transfer-approved.js` on every invocation. One-line fix: add `readFileSync` to the static import and remove `require('fs')`.
2. **S-01** (`scripts/test-report.mjs` — `HOME`/`PROJECT` undefined) — crashes on script load. Replace `HOME` with `process.env.HOME` and `PROJECT` with `process.cwd()` (or `fileURLToPath`).
3. **S-02** (`scripts/backup-automation.js` — unsafe WAL backup) — scheduled backups may be silently corrupt. Replace `createReadStream/copyFileSync` with `better-sqlite3`'s `db.backup(destPath)`.
4. **S-09** (`scripts/smoke-test.mjs` — port 3001 default) — silently tests wrong port. Change default to `3000`.
5. **S-07** (`scripts/server-manager.js` — SIGTERM ignored on Windows) — server stop silently fails for 5 s. On `win32` skip SIGTERM/SIGKILL entirely and call `taskkill` directly.
