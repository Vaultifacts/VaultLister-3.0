# MEMORY.md – VaultLister 3.0
# First 200 lines auto-loaded each session. Keep concise.

## Project Overview
- **Purpose:** VaultLister 3.0 — multi-channel reselling platform (successor to VaultLister 2.0)
- **Stack:** Bun.js 1.3+ + PostgreSQL (TSVECTOR + GIN) + Vanilla JS SPA + Playwright + @anthropic-ai/sdk
- **Auth:** JWT + bcryptjs (12 rounds) + TOTP MFA + OAuth 2.0 (eBay ✅, Shopify ✅ 2026-04-20, Etsy pending API approval, Depop PKCE pending); Poshmark/Mercari/Grailed/Whatnot use Playwright bot credentials (not OAuth)
- **Testing:** Bun:test + Playwright + visual-test.js
- **Repo:** https://github.com/Vaultifacts/VaultLister-3.0.git

## Recent Verified Changes
- **SonarCloud new-code baseline repair:** committed in `1875b35a` — the Sonar workflow now passes the `package.json` version as `sonar.projectVersion`, replacing the live `not provided` project version that left Sonar's Previous Version new-code period anchored at 2026-03-22 and made the April formatting sweep count as 170,552 new lines. Verified by the live SonarCloud quality-gate API, project analyses API, official Sonar new-code/project-version documentation, `npx yaml-lint .github/workflows/sonarcloud.yml`, and `git diff --check`.
- **Public HTML lint repair after formatting sweep:** committed after `af2d4d92` — restored `html-validate`-required uppercase `<!DOCTYPE html>` and non-self-closing HTML void tags in the seven public pages covered by `lint:html`. Verified by `bun run lint` after `bun install --frozen-lockfile`, plus `bun run open-items:check`.
- **Open-items verification after formatting sweep:** committed after `af2d4d92` — revalidated `docs/OPEN_ITEMS.md` against the latest formatted master and recorded the check result. Verified by `bun run open-items:check`, `node --check scripts/generate-open-items.mjs`, and independent competitor gap reconciliation.
- **Generated open-items report refresh:** committed in `5208c7ee` — refreshed `docs/OPEN_ITEMS.md` against `f33bf869` after later commits changed source-coverage rows. Verified by `bun run open-items:check`, `node --check scripts/generate-open-items.mjs`, `git diff --check`, and an independent competitor gap reconciliation showing 862 expected rows, 862 report rows, 0 unparsed markers, and 0 missing rows.
- **Sonar frontend follow-up cleanup:** committed in `b08266fe` — replaced the nested transactions-template IIFE with precomputed sales markup, moved purchase and batch-photo checkbox attributes out of inline template ternaries, kept concurrent frontend a11y source fixes synchronized with `core-bundle.js`, and rebuilt frontend cache artifacts to bundle version `92a0f6a4`. Verified by `bun run lint`, focused `node --check` runs, and grep checks for the Sonar patterns.
- **Public nav and glossary accessibility cleanup:** committed in `437f5c11`, `ceebde0e`, and `b09aae58` — public nav dropdowns now use `inert` instead of `aria-hidden` while closed, glossary letter anchors now match `aria-labelledby` heading IDs, and the glossary mobile drawer keeps `inert` synchronized while closed/open. Verified by `bun run lint`, `bun x html-validate public/glossary.html`, an aria-labelledby missing-ref check showing 0 missing references, and grep checks for corrupted inert replacements.
- **Sonar April 30 finite issue cleanup:** committed in `5135b350` — removed the concrete April 30 Sonar code-smell patterns in source: EasyPost nested template auth construction, status/complementary `div` roles in the app shell, an ignored Image Bank catch error, and nested ternaries in frontend source. Also repaired the malformed add-item title `oninput` expression and rebuilt checked-in frontend artifacts to bundle version `846190a0`. Verified by `bun run lint`, `bun run open-items:check`, focused syntax checks, and `shippingLabels-easypost.test.js` with 4 pass / 0 fail.
- **Generated items competitor gap consolidation:** committed in `b0a2d474` — the report generator now parses competitor gap rows with prefix markers, suffix markers, and suffix markers followed by qualifiers; heading areas track `##` through deeper subsections; the generator fails fast on unparsed competitor markers. Verified by syntax check, report regeneration, report staleness check, whitespace check, and an independent source/report count showing 862 expected competitor rows, 0 unparsed markers, and 0 missing report rows.
- **Deploy verification hardening:** committed in `73df41d9` — `.github/workflows/deploy.yml` now fails post-deploy SHA/runtime mismatches instead of warning, targets the real Railway app URL for post-deploy checks, and verifies the explicit pushed Git SHA in Railway deployment metadata.
- **Websocket deploy proof path:** committed in `86f6b239` — added `scripts/websocket-upgrade-check.mjs` for Railway origin `101 Switching Protocols` proof and `scripts/browser-websocket-check.mjs` for live browser websocket proof on `https://vaultlister.com`; the deploy workflow now runs both checks.
- **Live websocket smoke stabilization:** committed in `103294c2` — `scripts/launch-ops-check.mjs` now supports reliable `--websocket` verification for the public domain, `package.json` ops scripts call `node`, and Railway app + worker were both verified on `103294c2` with `post-deploy-check` passing `7/7`, browser websocket check passing, and websocket ops smoke passing `3/3` once production env vars were loaded.
- **Execution-sheet carry-over check:** after the deploy verification work, the stale `codex/e2e-session-guardrails` branch was compared against the clean merged checkout and showed no remaining Subset 3/4 or 5 source diffs to port; only stale generated artifacts and user-owned dirty content remain there.
- **Master CI failure-count reduction fix:** committed in `6c1b1d2e` on `codex/master-ci-regression-fix` — fixed stale async test assertions in `middleware-auth.test.js` and `service-featureFlags-unit.test.js`, and aligned `rate-limit-enforcement.test.js` plus `security-rate-limit.test.js` with the actual bun:test bypass contract already exercised by the passing rate-limiter suites. Verified by focused Bun runs across the auth, feature-flag, and rate-limit files. Full local server-backed CI reproduction remains unverified in the clean worktree because it intentionally has no `.env`.
- **Auth/XSS quick-gate timeout fix:** committed in `6738d012` — the 3 unbaselined auth/XSS quick-gate failures were verified as Bun 5s timeouts rather than incorrect auth/XSS behavior, so `src/tests/auth.test.js` and `src/tests/security.test.js` now give those slow live-server cases `15000ms`. Verified by focused Bun runs and by the shared `.test-baseline` quick gate returning `Baseline gate passed: 2 failure(s), all within baseline 370` against `TEST_BASE_URL=http://localhost:3100`.
- **PR #409 review fixes:** committed in `fb825a46` — removed the 3 auth/XSS baseline additions from `.test-baseline`, made `playwright.config.js` derive one coherent local `TEST_BASE_URL`, and changed `start-test-bg.ps1` to report port ownership without killing unrelated `node`/`bun` listeners. Verified via `node --check`, PowerShell parser check, dynamic config imports, and a temporary Node listener that remained alive on the occupied port.
- **E2E/session anti-stall guardrails:** committed in `b7a39d14` — Playwright now defaults to `TEST_PORT=3100`, test server start fails fast on non-app port collisions, and repo instructions now require a fresh thread after repeated compactions/multi-minute retry loops.
- **Auth/security baseline alignment history:** `ad9fd2db` added 3 missing auth/XSS quick-gate failures to unblock a push, and `fb825a46` later removed those 3 entries after PR #409 review so the branch no longer broadens the baseline.

## Key Commands
- `bun run dev` — start server (port 3000)
- `bun run dev:bg` / `bun run dev:stop` — background server
- `bun run test:all` — full suite (unit + E2E + visual)
- `bun run test:unit` — unit tests only
- `bun run test:e2e` — Playwright E2E
- `bun run test:coverage` — coverage report
- `bun run db:reset` — reset database
- `bun run lint` — syntax check
- `bun scripts/session-start.js` — read pending items before working
- `bun scripts/session-end.js` — safety net at end of session

## Behaviour Rules
- **Never assume or guess** — always verify with a tool (Read, Grep, Bash) before stating something is true. This includes checklist status, file contents, env values, and test counts. Taking the user's word is fine, but stating facts without verification is not.
- **Verify before creating tasks** — before marking any task as "remaining", cross-check ALL available evidence: STATUS.md, MEMORY.md, git log, commit messages, audit-log.md, and codebase artifacts. If working code proves a feature exists, mark the prerequisite tasks as done. Never create open tasks for things already proven complete by evidence.
- **Always run long operations in background** — test suite runs (`npx playwright test`, `bun test`), server starts, build scripts, and any operation taking >10s must use `run_in_background: true` on Bash or be launched as a background agent. Never block the main conversation waiting for them.
- **Keep E2E on the test port** — Playwright/E2E defaults to `TEST_PORT=3100`. Never infer the E2E target from `.env` or the normal app port.
- **Refresh the thread before it bloats** — if a task hits 3 compactions, two consecutive multi-minute retries on the same command, or obviously near-ceiling context, checkpoint to `memory/STATUS.md` and continue in a fresh thread.

## Critical Rules
- Never push to main directly — use feature branches
- Never use `git add -A` — add specific files
- Never use `--no-verify` to bypass hooks
- Never modify `.env` — set by the user
- Never remove `'unsafe-inline'` from CSP
- Never remove `token`/`refreshToken` from `store.persist()` / `store.hydrate()`
- Always escape HTML with `escapeHtml()` for user content
- Use TEXT for all ID columns (UUIDs)
- Include CSRF token for all POST/PUT/PATCH/DELETE

## Canonical Entities
InventoryItem, Listing, Sale, Offer, Automation, Platform, PriceHistory, ImageAsset, Analytics, Report, User, Session, Notification, Tag, AuditLog

## Agents
14 agents in `.claude/agents/` (8 specialized + 6 QA):
Architect-Planner, Backend, Frontend-UI, Automations-AI, Security-Auth, Testing, DevOps-Deployment, NoCode-Workflow, qa-core-product, qa-data-systems, qa-environment-quality, qa-infrastructure-delivery, qa-reliability, qa-security

## AI Model Routing
- claude-haiku-4-5: fast/cheap tasks (tag detection, short descriptions, price suggestions)
- claude-sonnet-4-6: listing generation, Vault Buddy conversations

## Scaffold Date
Generated: 2026-03-02 from VaultLister 2.0 reference by claude-project-scaffolder

## ngrok — ALWAYS run when needed
User has authorized always starting ngrok. Reserved domain command:
```
ngrok http --domain=semianatomic-adelina-unspent.ngrok-free.app 3000
```
Auth token already in ngrok config. Check if running first: `curl -s http://localhost:4040/api/tunnels`

## Server Restart (Windows) — ALWAYS use this
User has explicitly authorized always running this to restart the server:
```
powershell -Command "Get-Process bun | Stop-Process -Force"
bun run dev:bg
```
`bun run dev:stop` alone is unreliable — PID file goes stale and old process keeps running.

## Auto-Offer Rule Live — commits dd5ffa3, e8229f7
- Rule: "Auto-Offer Rule (80% min, counter at 90%)" — type=offer, platform=poshmark, schedule=`*/5 * * * *`
- `executeOffer()` in taskWorker.js: guards autoCounter with minPercentage threshold (≥80% countered at 90%)
- `POST /api/automations/:id/run` is the manual trigger; CSRF token must come from a prior GET response header, not /api/auth/csrf

## CSRF Pattern
- Get CSRF token from GET response header (not `/auth/csrf` endpoint)
- Include as `X-CSRF-Token` header on all POST/PUT/PATCH/DELETE

## Unit Test Baseline (2026-03-08) — 5289/0 — commit 7df5afb
- Tests use `PORT=process.env.PORT||3000` (standardized 2026-03-20)
- security.test.js BASE_URL defaults to port 3000; auth.helper.js to 3001 — set `TEST_BASE_URL`
- `core-bundle.js` is the file actually served (via `index.html`), NOT `app.js`

## E2E Status (last updated 2026-03-09)
- 1826 pass / 33 fail, 1 flaky (98.2%)
- Remaining 33 failures: monitoring RUM, forgot-pw CSP, CSV upload, inventory CSP, login Remember Me, register CSP, teams invite, transactions split/autocategorize, webkit-only edge cases

## Launch Audit (2026-04-03) — READ BEFORE ANY LAUNCH WORK
Full audit: `docs/LAUNCH_AUDIT_2026-04-03.md` — 33 findings, 12 launch blockers, cleanup matrix, source-of-truth proposal.
**Key facts:**
- Internal docs/evidence overstate readiness (8/8 PASS claims from March 15 predate 416-issue UX audit)
- 12 hard launch blockers (at audit time 2026-04-03): privacy.html wrong ("self-hosted"/"SQLite"), terms.html no jurisdiction, auth lockout commented out, fake data in 5 frontend files (~40 instances), SKU no UNIQUE, ~~OAUTH_MODE defaults mock~~ (RESOLVED 2026-04-07), Sentry not ingesting, no carrier API, eBay sandbox, Google Auth not configured
- DO NOT TRUST: docs/evidence/FINAL_COMPLETION_AUDIT.md, GATE_EVALUATION.json, PROJECT_ROADMAP.md, RELEASE.md, docs/ARCHITECTURE.md (Docker+Nginx refs), docs/DEPLOYMENT.md (SSH not Railway), all public HTML with "SQLite"
- TRUST: CLAUDE.md, memory/STATUS.md, design/*.md, pg-schema.sql, docs/FRONTEND_SOURCE_OF_TRUTH.md, the 5 external audit docs, docs/LAUNCH_AUDIT_2026-04-03.md
- 115 legacy SQLite migrations in migrations/ are dead code — only migrations/pg/ is applied
- CI green is misleading: 585 baselined failures, E2E disabled, Semgrep/SonarCloud soft-fail

## Completed Features Reference
Detailed implementation notes for all completed features (B-1 through E-1, QA Remediation, Infrastructure) are in `memory/COMPLETED.md` — read on demand, not every session.
