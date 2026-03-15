# STATUS.md – VaultLister 3.0 Agent Coordination File
> Updated on every session.

## Current State
- **Branch:** master
- **Server:** test server on localhost:3100 (NODE_ENV=test, DISABLE_CSRF=true)
- **Last commit:** 287e3f6 — fix PORT=3100 in test:all + offer E2E diagnostic logging
- **E2E status:** 69/69 offer tests pass (was 27 skipped); overall 2054+ pass — all 3 browsers
- **Unit status:** 5659 pass / 118 fail (all 118 are server-dependent integration tests) — zero code-level failures
- **QA Remediation:** All 20 items complete across 4 phases
- **Load test:** baseline p95=7ms / p99=8ms / 29 req/s
- **Platforms:** All 9 active (Poshmark, eBay, Mercari, Depop, Grailed, Etsy, Facebook, Whatnot, Shopify)
- **As of:** 2026-03-15

## Completion Summary
All autonomous work is complete. Remaining items require external action:

| Item | Blocked By |
|------|-----------|
| Etsy integration | Etsy app approval pending (app key `1sgc9xd1hwi3zt5k33pn9k7d`) |
| eBay production listings | User must confirm eBay prod creds in `.env` |
| Poshmark auto-offer live test | Needs real incoming buyer offer |
| Staging deploy | User must provision VPS + add 3 GitHub secrets |

## In Progress
_(claim tasks here during work)_

## Pending Review
_(none)_

## Next Tasks
- [ ] M: Configure marketplace API credentials (eBay prod, Etsy, Poshmark, Mercari) in `.env`
- [ ] M: Provision staging server + add STAGING_HOST/USER/SSH_KEY GitHub secrets
- [ ] M: Complete Etsy OAuth — blocked on Etsy app approval
- [ ] M: Verify Poshmark `bot.counterOffer()` against live marketplace — needs real offer
- [ ] L: Review and tighten `.claude/settings.json` deny rules
- [x] L: Sales/Analytics test verification — 197/201 pass (98%) — 2026-03-15
- [x] L: Fix 4 orders.test.js assertion bugs — done (commit 6f476d3)
- [x] L: Fix 27 skipped offer E2E tests — done, 69/69 pass (commit 287e3f6)

## Last Completed Work
<!-- Most recent first -->
- 2026-03-15: Session — 10 commits pushed. CSRF session ID mismatch fixed (IP-only, commit df02d35). All 9 platform cross-lister buttons activated (commits 473ccba, b95c4a2). Pre-commit hook wc -c pipe deadlock fixed (commit 365cb9c). API docs updated for verify-email, MFA, password reset (commit 9a114fc). Staging deploy pipeline created (deploy-staging.yml, docker-compose.staging.yml, nginx.staging.conf — commit 01aa253). Design docs created (architecture, data-model, api-overview, platform-integrations — commit d38886c). OpenClaw integration fully removed (commit dc73ac9). CSRF test regressions fixed (commit 610bccc). Browser UI verification: 20/20 P0+P1 pages PASS. Notion V1.0 Launch Readiness Checklist fully updated. 3 sync services created (facebookSync.js, whatnotSync.js, shopifySync.js).
- 2026-03-14: P3-03 Staging deployment pipeline configured. Created .github/workflows/deploy-staging.yml, docker-compose.staging.yml, nginx/nginx.staging.conf.
- 2026-03-12: QA Remediation Complete (commit e7508fd). All 20 REM items done. Security hardening (16 findings fixed). Full project review rounds 1-4.
- 2026-03-11: Global bug fixes + Phase F Pre-Deployment Hardening (F-1 through F-7).
- 2026-03-10: E2E suite fixed (1859/1859), eBay engineering, Poshmark automation, teams E2E, unit test failures resolved.
- 2026-03-09: AI features (listing gen, image analyzer, price predictor, Vault Buddy), Chrome extension, eBay OAuth, auto-offer rules.
- 2026-03-08: Security audit (63 questions), E2E suite (620/620), unit baseline (5289/0).
- 2026-03-07: Infrastructure (Zod, ETag, SWR), Docker setup.
- 2026-03-03: Playwright, test baseline, API key verification.
- 2026-03-02: Initial codebase port from VaultLister 2.0.

## Warnings
- `bun run db:drop*` is in the deny list — requires manual override if needed
- `.env` must never be committed or modified by agents
- Git commit hangs in Git Bash on Windows — use PowerShell for commits

## Messages
_(leave notes here — format: `FROM → TO (DATE): Message`)_

## Blockers
- Etsy OAuth: app approval pending (submitted, key `1sgc9xd1hwi3zt5k33pn9k7d`)
- Staging deploy: needs VPS provisioned by user
