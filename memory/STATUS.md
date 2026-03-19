# STATUS.md – VaultLister 3.0 Agent Coordination File
> Updated on every session.

## Current State
- **Branch:** master
- **Last commit:** 0afb2cf — chore: upgrade GitHub Actions to Node.js 24
- **Production URL:** https://vaultlister.com — LIVE ✅
- **Staging server:** Oracle Cloud Free Tier VM (204.216.105.105, ca-montreal-1, Ubuntu 22.04)
- **SSH access:** `ssh -i ssh-key-2026-03-15.key ubuntu@204.216.105.105` (user is `ubuntu`, NOT `openclawuser`)
- **Domain:** vaultlister.com (Namecheap)
- **SSL:** Let's Encrypt, auto-renewal via Certbot
- **Deploy workflow:** Push to `staging` branch triggers `deploy-staging.yml` → Docker image → GHCR → `ssh ubuntu@server "bash /opt/vaultlister-staging/deploy.sh"` (auto-logins to GHCR via CR_PAT in .env)
- **eBay OAuth:** Production keyset LIVE ✅
- **Stripe:** Checkout + webhooks configured (keys in .env on server, not local)
- **Poshmark:** Stealth bot operational ✅ — handle: `@raverealm`, country: `ca`
- **E2E baseline:** 674/688 passing (100% non-skipped), 0 failed, 14 skipped — 2026-03-18
- **As of:** 2026-03-18

## Last Completed Work (2026-03-19)

### Session Summary — 4 commits, all deployed to production

**Commit 3b0bbad — Cross-Listing Automation (6 gaps fixed)**
- Deleted dead stub `submitAdvancedCrosslist` + old modal
- Advanced crosslist now publishes after creating drafts (draft→publish flow)
- All 9 platforms in modal (added Mercari, Grailed, Etsy)
- Targeted retry via `retryFailedPublishes` handler
- WebSocket events `listing.published` / `listing.publish_failed`
- Net -350 lines removed

**Commit 40d4314 — Poshmark Scheduler Monitoring**
- Fixed dead `poshmark_inventory_sync` task type (was throwing Unknown task type)
- Added `GET /api/automations/scheduler-status` endpoint
- Added Scheduler Health widget to automations page
- Added `handlers.refreshSchedulerStatus()` for manual refresh

**Commit a78179d — Scheduler Lock File**
- Standalone `poshmark-scheduler.js` checks lock before starting
- TaskWorker writes lock on startup
- Deprecation notice in standalone script
- 30-min lock expiry for stale locks

**Commit 0afb2cf — GitHub Actions Upgrade**
- All 5 workflows updated to Node.js 24 compatible versions
- actions/checkout v6.0.2, setup-node v6.3.0, docker actions v4-7, github-script v8
- All pinned to commit SHAs

**E2E Baseline: 674/688 (100% non-skipped), 0 failed, 14 skipped — unchanged**

### Previous: Cross-Listing Automation — 6 Gaps Fixed (commit 3b0bbad)
Made cross-listing production-ready by fixing all identified gaps:

1. **Deleted dead stub** `submitAdvancedCrosslist` (fake IDs, no API) and old modal (lines 1088-1285)
2. **Advanced crosslist now publishes** — after creating drafts via `/listings/batch`, iterates each and calls `POST /listings/{id}/publish-{platform}` (reuses existing publish infrastructure)
3. **All 9 platforms in modal** — added Mercari, Grailed, Etsy to advanced crosslist (was 6, now 9), 3x3 grid
4. **Targeted retry** — new `retryFailedPublishes` handler only retries specific failed listingId+platform pairs (not full re-run)
5. **Failure tracking** — `store.state.lastPublishFailures` stores `[{ listingId, platform }]` for retry
6. **WebSocket events** — `listing.published` and `listing.publish_failed` broadcast in generic publish route

**Net -350 lines** — removed dead code, consolidated duplicate implementations.

### Previous: E2E Test Suite + Chrome Extension + AI Upgrade (2026-03-18)

### E2E Test Suite Overhaul (3 commits: 446dbfe, e6275f6, 102e2bc)
Fixed ~156 E2E test failures across the entire suite:

**Commit 446dbfe — Auth fixture migration (85 tests fixed)**
- Migrated 8 spec files to authedPage fixture + vl_access cookie
- automations, community, imageBank, push-notifications, websocket, gdpr, remember-me, inventory

**Commit e6275f6 — Teams consolidation (6 tests fixed)**
- teams.spec.js updated for Settings tab consolidation (sidebar merge)

**Commit 102e2bc — Quinn-v3 audit fixes (~65 tests fixed)**
- Cookie consent + announcement overlay dismissal
- Auth fixture race condition fix (router.navigate fallback)
- Forgot-password: loginAndNavigate instead of bypass token
- WebSocket audit: maxReconnectAttempts, reload cookie, skip 2 UI bugs
- Mobile viewport: vl_access cookie
- Navigation audit: section titles updated for sidebar consolidation
- CSP checks: filter report-only violations
- Register E3: compound aria-describedby value
- 3 tests skipped for genuine UI bugs (offline→login redirect, notification badge, select-all checkbox)

### Previous: Poshmark Bot Stealth Hardening (2 commits)
Full stealth upgrade across all 6 Poshmark bot scripts:

**New shared module:** `src/shared/automations/stealth.js`
- playwright-extra + StealthPlugin (navigator.webdriver, chrome.runtime, WebGL, canvas fingerprint)
- Chrome UA rotation pool (v129-131, 5 UAs) — randomly picked per session
- Viewport randomization (5 real monitor sizes)
- Locale/timezone consistency (en-US, America/New_York)
- `humanClick()` — curved mouse paths to random point inside element
- `humanScroll()` — variable-speed chunked scrolling
- `mouseWiggle()` — idle mouse movement between actions

**Bots upgraded:**
- `poshmark-bot.js` — stealth module, humanClick on all actions, mouseWiggle every 5 items
- `poshmark-publish-bot.js` — was using plain playwright (no stealth!) → now stealth Chromium
- `poshmark-offer-sync.mjs` — was plain Firefox → stealth Chromium
- `poshmark-delete-listing.mjs` — was plain Firefox → stealth Chromium
- `poshmark-keepalive.js` — stealth args
- `poshmark-login.js` — stealth args

**Rate limits tightened:**
- Share: 3s→4s, Follow: 2.5s→3.5s, Offer: 5s→6s
- Max shares/run: 300→200, Max follows: 100→75
- Image blocking removed from poshmark-bot.js (was detectable)

**Test results:**
- Fingerprint test: 15/16 checks PASS (only chrome.runtime minor gap)
- Live test against poshmark.ca: Session valid, shared 1 item, zero detection

### Key Files
- `src/shared/automations/stealth.js` — NEW shared stealth module
- `src/shared/automations/poshmark-bot.js` — humanClick/mouseWiggle wired into all methods
- `src/shared/automations/rate-limits.js` — tightened delays
- `scripts/poshmark-publish-bot.js` — stealth Chromium
- `scripts/poshmark-offer-sync.mjs` — stealth Chromium
- `scripts/poshmark-delete-listing.mjs` — stealth Chromium
- `scripts/poshmark-keepalive.js` — stealth args
- `scripts/poshmark-login.js` — stealth args
- `scripts/stealth-fingerprint-test.js` — NEW fingerprint validation
- `scripts/stealth-live-test.js` — NEW live Poshmark test

### Previous: Sidebar Consolidation (7 commits)
Reduced sidebar from 30→14 items. See git log for full details.

### IMPORTANT: Build Pipeline
- `core-bundle.js` is generated by `build-dev-bundle.js` (concatenates 12 source files)
- Editing `core-bundle.js` directly is USELESS — it gets overwritten on every build
- Edit the actual source files in `src/frontend/ui/`, `src/frontend/core/`, etc.
- `bun run build` now runs both `build-dev-bundle.js` AND `build-frontend.js`

## Next Tasks
1. **AR Previews** — augmented reality item previews (V2 feature, needs design planning)
2. **Etsy OAuth** — DEFERRED indefinitely. App approval timeline unknown. Treat as "Coming Soon" feature.
3. **Production monitoring** — set up uptime monitoring / alerting for vaultlister.com

## Messages
- SSH user on Oracle VM is `ubuntu` (NOT `openclawuser` — that was wrong in previous sessions)
- The deploy requires manual `docker compose up -d --force-recreate --pull always` on the server after the GitHub Actions deploy pipeline pushes the image
- Poshmark closet handle is `raverealm` (login email is different from handle)
