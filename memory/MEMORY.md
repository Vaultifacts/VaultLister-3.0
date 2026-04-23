# MEMORY.md – VaultLister 3.0
# First 200 lines auto-loaded each session. Keep concise.

## Project Overview
- **Purpose:** VaultLister 3.0 — multi-channel reselling platform (successor to VaultLister 2.0)
- **Stack:** Bun.js 1.3+ + PostgreSQL (TSVECTOR + GIN) + Vanilla JS SPA + Playwright + @anthropic-ai/sdk
- **Auth:** JWT + bcryptjs (12 rounds) + TOTP MFA + OAuth 2.0 (eBay ✅, Shopify ✅ 2026-04-20, Etsy pending API approval, Depop PKCE pending); Poshmark/Mercari/Grailed/Whatnot use Playwright bot credentials (not OAuth)
- **Testing:** Bun:test + Playwright + visual-test.js
- **Repo:** https://github.com/Vaultifacts/VaultLister-3.0.git

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
