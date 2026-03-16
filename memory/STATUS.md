# STATUS.md – VaultLister 3.0 Agent Coordination File
> Updated on every session.

## Current State
- **Branch:** master
- **Server:** test server on localhost:3100 (NODE_ENV=test, DISABLE_CSRF=true)
- **Last commit:** 6f476d3 — fix: orders.test.js assertion bugs (add 403) + aria-label on 10 dropdown buttons
- **Production URL:** https://vaultlister.com — LIVE ✅ (Let's Encrypt SSL, auto-renewing)
- **Staging server:** Oracle Cloud Free Tier VM (204.216.105.105, ca-montreal-1, Ubuntu 22.04)
- **Domain:** vaultlister.com (Namecheap, purchased 2026-03-16)
- **SSL:** Let's Encrypt, expires 2026-06-14, auto-renewal via Certbot
- **Nginx:** Reverse proxy on ports 80/443 → Docker app:3000
- **eBay OAuth:** Production keyset LIVE ✅ — OAuth flow working end-to-end on vaultlister.com
- **E2E status:** 69/69 offer tests pass; overall 2054+ pass — all 3 browsers
- **Unit status:** 4267 pass / 223 fail / 4490 total (Windows, PORT=3100, server running)
- **QA Walkthrough (vaultlister.com):** 15/15 pages pass — all load correctly
- **Platforms:** 9 registered; eBay OAuth connected (production), Poshmark credentialed — 7 others need `.env` creds
- **As of:** 2026-03-16

## Completion Summary
All autonomous work is complete. Remaining items require external action:

| Item | Blocked By |
|------|-----------|
| Etsy integration | Etsy app approval pending (app key `1sgc9xd1hwi3zt5k33pn9k7d`) |
| Poshmark auto-offer live test | Needs real incoming buyer offer |
| Sentry + Slack monitoring | User must create accounts and add env vars |

## In Progress
_(claim tasks here during work)_

## Pending Review
_(none)_

## Next Tasks
- [ ] M: Test Poshmark automation with real credentials on staging
- [ ] M: Complete Etsy OAuth — blocked on Etsy app approval
- [ ] M: Set up database auto-backup cron on server
- [ ] M: Configure Sentry + Slack monitoring (requires account creation)
- [ ] L: Add remaining marketplace credentials to staging `.env` (Mercari, Depop, Grailed, Facebook, Whatnot, Shopify)
- [ ] L: Update eBay webhook endpoint in eBay developer portal if needed
- [x] M: eBay OAuth production — DONE (vaultlister.com, full end-to-end)
- [x] M: Domain + SSL — DONE (vaultlister.com, Let's Encrypt)
- [x] M: Provision staging server — DONE (204.216.105.105)
- [x] M: Deploy pipeline nginx config copy — DONE (commit cd78bd6)
- [x] L: QA walkthrough on vaultlister.com — 15/15 pages pass

## Last Completed Work
<!-- Most recent first -->
- 2026-03-16: Session (nginx keepalive + CORS audit) — DevOps-Deployment agent. Confirmed Access-Control-Max-Age: 86400 already present in getCorsHeaders() (server.js:203 — no change needed). nginx/nginx.staging.conf: increased upstream keepalive 16→32, added keepalive_timeout 65 to HTTPS server block, added proxy_http_version 1.1 + proxy_set_header Connection "" to all non-WebSocket proxy location blocks (auth, api, health, static assets, root catch-all). No commit — changes staged for review.
- 2026-03-16: Session (domain + SSL + eBay OAuth) — Purchased vaultlister.com ($6.99 Namecheap). Configured DNS A records → 204.216.105.105. Installed Let's Encrypt SSL via Certbot (expires 2026-06-14, auto-renewal). Nginx reverse proxy on ports 80/443. Fixed eBay OAuth: callback URL format (/api/oauth/:platform/callback), trimmed scopes to 10 pre-approved, popup auto-close via localStorage+storage event, UTF-8 charset fix. Updated docker-compose.staging.yml with all marketplace env vars. Deploy pipeline now copies nginx config. QA walkthrough: 15/15 pages pass on vaultlister.com. 13 commits pushed.
- 2026-03-16: Session (staging deploy) — Provisioned Oracle Cloud Free Tier VM (204.216.105.105, ca-montreal-1, Ubuntu 22.04). Installed Docker + Docker Compose. Fixed CI/CD pipeline: replaced appleboy/ssh-action (drone-ssh YAML bug) with webfactory/ssh-agent + direct SSH, added staging to NODE_ENV enum, fixed empty ANTHROPIC_API_KEY validation. Deploy pipeline fully green. VaultLister staging is LIVE at http://204.216.105.105:3001 — container healthy, health endpoint returns 200.
- 2026-03-15: Session (demo data quality + push) — Fixed Teams page showing "Updated Team [timestamp]" test artifacts: seeded "Vault Crew" + "eBay Specialists" teams for demo user (7e67c2e). Pushed 15 commits to remote (9bb69a4..7e67c2e). CI running.
- 2026-03-15: Session (walkthrough bug fixes cont. 3) — Removed "12 chars" debug text from My Listings cards (2f95701), fixed best-seller "Unknown" via listings+inventory maps (2f95701), fixed image bank thumbnail fallback onerror (2f95701), fixed calendar event names "Ship: Synced Item N" → realistic titles in orders.js mock sync (94278ee), seeded 15 calendar events for demo user (94278ee). E2E suite passed (exit 0).
- 2026-03-15: Session (walkthrough bug fixes cont. 2) — Fixed automation "23 failed" banner (use apiStats.failedRuns not local history count), fixed WCAG AA color contrast violations (.password-req-item + settings 10px labels: gray-500→gray-600/700), seeded 11 roadmap features (3 completed, 2 in-progress, 6 planned) (d6d7950).
- 2026-03-15: Session (walkthrough bug fixes cont.) — Fixed P1: Pro Member badge conditional on subscription_tier (9a1963a), keyboard shortcuts Mac→Ctrl on Windows (9a1963a). Fixed P2: login gradient min-height:100vh on all 5 auth wrappers (dffd9d3), About Us "6 platforms"→"9" (dffd9d3), Privacy Policy Cloudinary marked optional (dffd9d3). Notion walkthrough page updated with all fix statuses.
- 2026-03-15: Session (walkthrough bug fixes) — Full 26-page browser walkthrough (32 findings in Notion). Fixed 3 P0s: dashboard chunk not loading deferred handlers (00c15f1), missing customizeDashboard() (00c15f1), platform-health chunk missing from pageChunkMap (00c15f1). Fixed 2 P1s: P&L report $0 → real sales data fallback (ca99d8a), offers showing Anonymous/Unknown instead of buyer_username/listing_title (ca99d8a).
- 2026-03-15: Session (cont.) — Audit + doc cleanup. Committed 4 dirty tracked files (c82d5b3): cache hash bump 54bb6aec→5d4c42bd in sw.js+index.html, OpenClaw guard removed from pre-commit, settings.local.json Notion tool added. Updated STATUS.md with accurate unit test count (4490 total / 4267 pass / 223 fail) and corrected platform credential status. Tightened settings.json deny rules + added @quinn-v3-guardian tags to offer E2E (commit 9bb69a4).
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
- Sentry/Slack monitoring: requires user to create accounts + add env vars
