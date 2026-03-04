# PROJECT ROADMAP

Generated: 2026-03-04
Aligned with: SCOPE_CONTRACT.md, COMPLETION_GATES.md

---

## Milestone Summary

| # | Milestone | Gates Unblocked | Status |
|---|-----------|-----------------|--------|
| M-1 | Git Hygiene & Environment | CG-1, CG-8 | NOT STARTED |
| M-2 | Test Suite Stability | CG-2 | NOT STARTED |
| M-3 | Monitoring & Health | CG-5 | NOT STARTED |
| M-4 | Backup & Restore Verification | CG-4 | NOT STARTED |
| M-5 | Deployment Pipeline | CG-3 | NOT STARTED |
| M-6 | Documentation & Performance | CG-6, CG-7 | NOT STARTED |

---

## Milestone Details

### M-1: Git Hygiene & Environment (CG-1, CG-8)

**Goal:** Clean git state + reproducible fresh-clone setup.

| Task | Est. | Depends On | Verification |
|------|------|------------|--------------|
| T-01 | 1h | — | See below |
| T-02 | 2h | — | See below |
| T-03 | 2h | T-02 | See below |

### M-2: Test Suite Stability (CG-2)

**Goal:** Zero unexpected test failures; documented baseline.

| Task | Est. | Depends On | Verification |
|------|------|------------|--------------|
| T-04 | 3h | T-01 | See below |
| T-05 | 2h | T-04 | See below |

### M-3: Monitoring & Health (CG-5)

**Goal:** Health endpoint + structured logging.

| Task | Est. | Depends On | Verification |
|------|------|------------|--------------|
| T-06 | 2h | T-01 | See below |

### M-4: Backup & Restore Verification (CG-4)

**Goal:** Verified backup + restore cycle.

| Task | Est. | Depends On | Verification |
|------|------|------------|--------------|
| T-07 | 2h | T-01 | See below |

### M-5: Deployment Pipeline (CG-3)

**Goal:** Docker build + CI green.

| Task | Est. | Depends On | Verification |
|------|------|------------|--------------|
| T-08 | 3h | T-04, T-06, T-07 | See below |

### M-6: Documentation & Performance (CG-6, CG-7)

**Goal:** User-facing docs + performance baseline.

| Task | Est. | Depends On | Verification |
|------|------|------------|--------------|
| T-09 | 3h | T-08 | See below |
| T-10 | 2h | T-01 | See below |

---

## Next 10 Tasks (Dependency-Ordered)

### T-01: Push unpushed commits and clean git state
**Milestone:** M-1 | **Est:** 1 hour | **Depends on:** None | **Gates:** CG-8

**Steps:**
1. Run `git status` — review all unstaged changes and untracked files
2. Stage and commit any legitimate work-in-progress files
3. Audit `.gitignore` — confirm it covers: `node_modules/`, `data/*.db`, `.env`, `uploads/*`, `*.log`
4. Run `git log --all -p | grep -iE "api_key|secret|password|jwt_secret"` — scan for leaked secrets
5. If secrets found: rewrite history with `git filter-branch` or `BFG Repo-Cleaner` (get user approval first)
6. Push all commits: `git push origin master`
7. Verify: `git log --oneline origin/master..HEAD` returns 0 results

**Verification:**
```bash
git status                              # Clean working tree
git log --oneline origin/master..HEAD   # Empty (0 unpushed)
```

**Exit criteria:** Zero unpushed commits. Zero unstaged changes. No secrets in git history.

---

### T-02: Audit and complete .env.example
**Milestone:** M-1 | **Est:** 2 hours | **Depends on:** None | **Gates:** CG-1

**Steps:**
1. Read current `.env` file — list all variables used
2. Grep codebase for `process.env.` and `Bun.env.` — find all referenced env vars
3. Cross-reference: identify any env vars used in code but missing from `.env.example`
4. Add missing variables to `.env.example` with descriptive comments
5. Categorize as REQUIRED vs OPTIONAL in comments
6. Remove any variables that are no longer referenced in code
7. Verify: `diff <(grep -oP '^\w+' .env.example | sort) <(grep -oP '^\w+' .env | sort)` — no gaps

**Verification:**
```bash
# Every env var referenced in code appears in .env.example
grep -roh 'process\.env\.\w\+\|Bun\.env\.\w\+' src/ | sort -u
# Compare against .env.example entries
```

**Exit criteria:** `.env.example` documents every env var. Comments explain each variable's purpose and whether it's required.

---

### T-03: Verify fresh-clone reproducibility
**Milestone:** M-1 | **Est:** 2 hours | **Depends on:** T-02 | **Gates:** CG-1

**Steps:**
1. Clone repo into a fresh temporary directory
2. Copy `.env.example` → `.env` and fill in test values
3. Run `bun install` — confirm zero errors
4. Run `bun run db:reset` — confirm database created with all 96 migrations
5. Run `bun run dev` — confirm server starts and listens
6. Open browser → navigate to app → register new account → login → view inventory
7. Document any missing steps or errors encountered
8. Fix any issues found; re-test

**Verification:**
```bash
# Full sequence succeeds in a clean directory without manual intervention
# (except filling in .env values)
```

**Exit criteria:** A developer with only `.env.example` and the README can get the app running in < 15 minutes.

---

### T-04: Triage and fix test failures
**Milestone:** M-2 | **Est:** 3 hours | **Depends on:** T-01 | **Gates:** CG-2

**Steps:**
1. Run full suite: `DISABLE_CSRF=true DISABLE_RATE_LIMIT=true bun run test:all`
2. Capture output — categorize the 372 failures:
   - **Category A:** Fixable (wrong assertions, outdated mocks, missing setup)
   - **Category B:** Environment-dependent (need specific .env, external service)
   - **Category C:** Flaky (timing, race conditions)
   - **Category D:** Obsolete (test for removed feature)
3. Fix Category A failures (highest count, most impact)
4. Skip or mark Category B/C with `test.skip()` and a TODO comment explaining why
5. Delete Category D tests (obsolete)
6. Re-run suite — target: 0 unexpected failures

**Verification:**
```bash
DISABLE_CSRF=true DISABLE_RATE_LIMIT=true bun run test:all
# Output: X pass, 0 fail (Y skipped)
```

**Exit criteria:** Zero unexpected failures. Every skip has a documented reason.

---

### T-05: Create test baseline file
**Milestone:** M-2 | **Est:** 2 hours | **Depends on:** T-04 | **Gates:** CG-2

**Steps:**
1. Run full test suite and capture results
2. Create `.test-baseline` file with:
   - Date of baseline
   - Total tests, pass count, skip count
   - List of skipped tests with reasons
   - Known flaky tests (if any remain)
3. Run auth + security tests separately: `bun test src/tests/auth.test.js src/tests/security.test.js`
4. Confirm all auth/security tests pass (fix the 14 CSRF failures)
5. Document the DISABLE_CSRF test-mode issue and whether it's a real security gap or a test configuration problem

**Verification:**
```bash
bun test src/tests/auth.test.js src/tests/security.test.js
# Output: X pass, 0 fail
cat .test-baseline  # Exists and is current
```

**Exit criteria:** `.test-baseline` exists. Auth + security tests: 0 failures. CSRF test-mode issue resolved or documented.

---

### T-06: Implement health check endpoint
**Milestone:** M-3 | **Est:** 2 hours | **Depends on:** T-01 | **Gates:** CG-5

**Steps:**
1. Check if `GET /api/health` already exists in routes
2. If not, create a health route that returns:
   - `status: "ok"`
   - `db: "connected"` (run a simple SELECT 1 query)
   - `migrations: <count>` (count applied migrations)
   - `uptime: <seconds>`
   - `timestamp: <ISO 8601>`
3. This route should NOT require authentication
4. Add request logging verification: confirm requestLogger.js captures method, path, status, duration
5. Verify error handler middleware logs unhandled errors with stack traces
6. Test: `curl http://localhost:PORT/api/health`

**Verification:**
```bash
curl -s http://localhost:PORT/api/health | python -m json.tool
# Returns: { "status": "ok", "db": "connected", ... }
```

**Exit criteria:** Health endpoint returns structured JSON. No auth required. DB connectivity confirmed.

---

### T-07: Verify backup and restore cycle
**Milestone:** M-4 | **Est:** 2 hours | **Depends on:** T-01 | **Gates:** CG-4

**Steps:**
1. Start server and create test data (1 user, 3 inventory items, 1 listing)
2. Run `bun run db:backup` — confirm backup file created with timestamp
3. Verify backup is a valid SQLite file: `sqlite3 <backup> "SELECT count(*) FROM users;"`
4. Add more test data (2 more items)
5. Run `bun run db:restore` — confirm data reverts to backup state
6. Verify: original 3 items present, 2 new items gone
7. Document backup file location and naming convention
8. If scripts are broken or missing, fix them

**Verification:**
```bash
bun run db:backup   # Creates timestamped file
bun run db:restore  # Restores successfully
# Spot-check: item count matches pre-backup state
```

**Exit criteria:** Full backup → modify → restore cycle works. Backup file is valid SQLite.

---

### T-08: Verify Docker build and CI pipeline
**Milestone:** M-5 | **Est:** 3 hours | **Depends on:** T-04, T-06, T-07 | **Gates:** CG-3

**Steps:**
1. Run `docker build -t vaultlister .` — fix any build failures
2. Verify Dockerfile uses pinned Bun version (not `latest`)
3. Run `docker-compose up -d` — confirm container starts and app responds
4. Test health endpoint from outside container: `curl http://localhost:PORT/api/health`
5. Review `.github/workflows/` — confirm CI runs tests on push
6. Verify CI blocks merge on test failure
7. If CI workflow missing or broken, create/fix it
8. Push a test commit and verify CI runs green

**Verification:**
```bash
docker build -t vaultlister .           # Exits 0
docker-compose up -d                     # Container healthy
curl http://localhost:PORT/api/health    # Returns 200
# GitHub Actions: green check on latest push
```

**Exit criteria:** Docker builds and runs. CI runs tests and blocks on failure. Health endpoint accessible from container.

---

### T-09: Write user-facing documentation
**Milestone:** M-6 | **Est:** 3 hours | **Depends on:** T-08 | **Gates:** CG-7

**Steps:**
1. Create or update `README.md` at repo root:
   - What VaultLister is (1 paragraph)
   - Prerequisites (Bun, Docker, etc.)
   - Quick start (clone → install → configure → run)
   - How to run tests
   - How to deploy (Docker)
   - How to backup/restore
2. Create `docs/API_ROUTES.md` — list all 65 route modules with HTTP methods and paths
3. Create `docs/DATABASE_SCHEMA.md` — entity list with key columns and relationships
4. Verify `.env.example` has inline comments (from T-02)
5. Complete remaining project-control docs (QUALITY_GATES, RISK_REGISTER, PROGRESS_ACCOUNTING)

**Verification:** Manual review — a new developer can understand and run the project from docs alone.

**Exit criteria:** README exists. API routes listed. Schema documented. Project control docs complete.

---

### T-10: Establish performance baseline
**Milestone:** M-6 | **Est:** 2 hours | **Depends on:** T-01 | **Gates:** CG-6

**Steps:**
1. Measure server startup time: `time bun run dev`
2. Seed database with 1,000 inventory items (script or manual)
3. Measure inventory page load time (browser DevTools or curl timing)
4. Measure full-text search response time with 1,000 items
5. Confirm SQLite WAL mode is active: `PRAGMA journal_mode;`
6. Measure `app.js` parse time in browser (Performance tab)
7. Record all measurements in `docs/PERFORMANCE_BASELINE.md`
8. Flag any metric that exceeds target (startup > 5s, page load > 2s, search > 500ms)

**Verification:**
```bash
time bun run dev                    # < 5 seconds
# Browser: inventory page load     # < 2 seconds with 1K items
# FTS5 search query                # < 500ms
```

**Exit criteria:** All performance targets met or gaps documented with remediation plan.

---

## Task Dependency Graph

```
T-01 (Push + Git) ──────┬──→ T-04 (Triage Tests) ──→ T-05 (Baseline) ──┐
                        ├──→ T-06 (Health Check)                        │
                        ├──→ T-07 (Backup/Restore)                      │
                        └──→ T-10 (Performance)                         │
                                                                        │
T-02 (.env.example) ──→ T-03 (Fresh Clone)                              │
                                                                        │
                              T-04 + T-06 + T-07 ──→ T-08 (Docker/CI) ──→ T-09 (Docs)
```

**Critical path:** T-01 → T-04 → T-05 → T-08 → T-09

**Parallelizable after T-01:** T-02, T-04, T-06, T-07, T-10 can all run concurrently.

---

## Backlog (Post-Gates)

These items are valid work but OUT OF SCOPE until all 8 completion gates PASS:

- New marketplace integrations (Poshmark, Mercari, Depop, Grailed, Shopify, Facebook, Whatnot)
- Additional automation features
- Frontend redesign or framework migration
- Multi-user support
- Mobile native app
- Payment processing integration
- Large-scale refactoring (app.js decomposition)
