# VaultLister 3.0 — Consolidated Open Items

> **Historical snapshot — do not use as current source of truth.**
> Current consolidated open items are generated in [`docs/OPEN_ITEMS.md`](../OPEN_ITEMS.md).
> Update current status in `docs/walkthrough/*.md` or durable metadata in `docs/open-items/items.json`, then run `bun run open-items`.

**Generated:** 2026-04-29 (revised) | **Sources:** 12 files + 9 plan files + source code scan + live GitHub API
**Total open items:** ~339 + 259 plan steps

---

## Table of Contents

1. [Critical / Launch Blockers (2)](#1-critical--launch-blockers)
2. [Deploy Config (2)](#2-deploy-config)
3. [FIXED — Pending Live Verification (38)](#3-fixed--pending-live-verification)
4. [OPEN / NEEDS MANUAL CHECK — Product/Design (75)](#4-open--needs-manual-check--productdesign)
5. [User UI/UX Requests — MANUAL_INSPECTION.md (48 + 7 guides)](#5-user-uiux-requests--manual_inspectionmd)
6. [OPEN / NOT VERIFIED — Ops/Infra Setup (6)](#6-open--not-verified--opsinfra-setup)
7. [OPEN QUESTION / NEEDS TRIAGE (2)](#7-open-question--needs-triage)
8. [STILL OPEN — Landing Page Layout (2)](#8-still-open--landing-page-layout)
9. [GitHub Issues — Currently Open (13)](#9-github-issues--currently-open)
10. [Uncommitted A11y + CSS Changes (78 files)](#10-uncommitted-a11y--css-changes)
11. [Execution Sheet — Uncommitted Work (6 subsets)](#11-execution-sheet--uncommitted-work)
12. [Exhaustive Audit Ledger — Pending Passes (9)](#12-exhaustive-audit-ledger--pending-passes)
13. [Facebook OAuth Compliance Checklist (34)](#13-facebook-oauth-compliance-checklist)
14. [Source Code TODOs (8)](#14-source-code-todos)
15. [Post-Launch Items (2)](#15-post-launch-items)
16. [Automation Roadmap (59)](#16-automation-roadmap-59)
17. [Email Verification (1)](#17-email-verification)
18. [Deep-Dive Refactoring Backlog (12)](#18-deep-dive-refactoring-backlog)
19. [Chrome Extension Future Features (7)](#19-chrome-extension-future-features)
20. [Unfinished Implementation Plans (259 steps)](#20-unfinished-implementation-plans)

---

## 1. Critical / Launch Blockers

| ID | Source | Component | Description | Status |
|----|--------|-----------|-------------|--------|
| CR-10 | WALKTHROUGH | My Shops / OAuth | OAuth incomplete: eBay + Shopify live, Depop 503, Poshmark/Grailed/Whatnot/Facebook Playwright-only, Mercari/Etsy deferred. See also Section 13 (Facebook OAuth Compliance). | OPEN — verified 2026-04-24 |
| CR-4 | WALKTHROUGH | Shipping / EasyPost | EasyPost not configured — live returns `503 {"error":"EasyPost not configured"}` despite EASYPOST_API_KEY set in Railway | OPEN / NOT VERIFIED — 2026-04-22 |

> **Note:** GitHub issues #30 (backup.sh missing) and #31 (staging .env missing DATABASE_URL) were listed as critical in the prior version but are now **CLOSED** on GitHub.

---

## 2. Deploy Config

| ID | Source | Component | Description | Status |
|----|--------|-----------|-------------|--------|
| H-18 | WALKTHROUGH | Forgot Password | "Send Reset Link" requires `RESEND_API_KEY`/SMTP — will fail silently if unset | DEPLOY CONFIG |
| H-25 | WALKTHROUGH | Forgot Password | Same as H-18 — duplicate finding | DEPLOY CONFIG |

---

## 3. FIXED — Pending Live Verification

These items have local source patches but have NOT been visually verified on the live site. 38 unique items (75 entries including duplicates in the master doc).

| # | Description | Patch Date |
|---|-------------|------------|
| 1 | Platform icons in Listings dropdown not showing correct icons | 2026-04-24 |
| 2 | Feature request submission shows error | 2026-04-23 |
| 3 | Settings sidebar dropdown shows wrong tab on click | 2026-04-23 |
| 4 | Clicking public page dropdown signs user out | local patch |
| 5 | Old logo shows on page refresh | 2026-04-23 |
| 6 | Changelog/Roadmap show different pages from public vs sidebar | local patch |
| 7 | Bottom-left profile icon not clickable | local patch |
| 8 | Platform matrix missing Shopify/Grailed/Kijiji/Etsy/Vinted entries | 2026-04-23 |
| 9 | Logo migration from top bar to sidebar | local patch |
| 10 | Coming Soon platform text size/brightness | 2026-04-24 |
| 11 | Offers/Orders/Shipping sidebar dropdown | local patch |
| 12 | Sidebar planning/tools items removal | 2026-04-24 |
| 13 | 5 sidebar tabs removal | 2026-04-24 |
| 14 | Settings Account tab country/language dropdowns | 2026-04-24 |
| 15 | Analytics page content removal | 2026-04-24 |
| 16 | Analytics tabs removal/rename | 2026-04-24 |
| 17 | Automations page content removal | 2026-04-24 |
| 18 | Dashboard content trim | 2026-04-24 |
| 19 | Daily checklist source cleanup | 2026-04-24 |
| 20 | Keyboard shortcut removal | 2026-04-24 |
| 21 | Inventory table fit | 2026-04-24 |
| 22 | Status page uptime bar | 2026-04-24 |
| 23 | Financials tab cleanup | 2026-04-24 |
| 24 | Vault Buddy source patch | 2026-04-24 |
| 25 | Public footer updates | local patch |
| 26 | Landing page updates | 2026-04-24 |
| 27 | Help Center updates | local patch |
| 28 | Language/currency selector | 2026-04-24 |
| 29 | Changelog updates | local patch |
| 30 | Public nav updates | local patch |
| 31 | Landing hero updates | 2026-04-24 |
| 32 | Feature-request search | 2026-04-24 |
| 33 | Learning page search | 2026-04-24 |
| 34 | Compare pages | local patch |
| 35 | Affiliate page updates | 2026-04-24 |
| 36 | Sidebar source updates | local patch |
| 37 | Landing source updates | local patch |
| 38 | Analytics source updates | 2026-04-24 |

---

## 4. OPEN / NEEDS MANUAL CHECK — Product/Design

75 items requiring manual UI verification. These are product/design decisions from the user's walkthrough session (from WALKTHROUGH_MASTER_FINDINGS.md backlog).

| # | Description |
|---|-------------|
| 1 | Integrate the Account Tab to the Settings page |
| 2 | Integrate the "Plans & Billing" Tab to the Settings page |
| 3 | "Learn More" Button text/size inconsistent with sidebar |
| 4 | Plans & Billing content not migrated to Settings tab |
| 5 | Move reports to the Reports page (image-13) |
| 6 | Add horizontal scrollbar for Analytics tabs |
| 7 | Remove item from Appearance tab (image-14) |
| 8 | Platforms show "connected" when not actually connected (image-15) |
| 9 | Migrate Shipping Profiles to Offers/Orders/Shipping page |
| 10 | Move Affiliate Program to its own Settings tab |
| 11 | Move content to Plans & Billing (image-16) |
| 12 | Replace sidebar icon with vertical-1024 PNG (image-17) |
| 13 | Replace icon with app_icon image (image-18) |
| 14 | Use horizontal-2048 PNG on every page (image-19) |
| 15 | Connect top bars into same bar; separate icon section (image-21) |
| 16 | Logo missing; platform cards broken; Depop/Facebook should be OAuth 2.0 (image-22) |
| 17 | Logo missing on changelog; add interactive legend (image-23) |
| 18 | Platform icons not set to official icons (image-24) |
| 19 | Migrate pricing to own page with comparison table (image-25) |
| 20 | Remove developer-focused content (image-26) |
| 21 | Add social media footer with Instagram/Facebook/X/TikTok/Reddit (image-27) |
| 22 | Footer sections: Resources, Company, Community, Compare (image-28) |
| 23 | Landing page feature display format (image-29) — MANUAL-pub-8 |
| 24 | Landing page tagline section (image-30) |
| 25 | Features dropdown menu restructure; rename "Platforms" to "Marketplaces"; restructure Resources; add Contact Us (image-31) |
| 26 | Freeze top bar on scroll (image-32) |
| 27 | Recreate platforms page (image-33) |
| 28 | Add "Media Kit" to Company section (image-34) |
| 29 | Ensure page consistency (image-35) |
| 30 | Documentation page with TOS/Privacy/AI Info/Media Kit tabs |
| 31 | Features outline format (image-36) — MANUAL-pub-16 |
| 32 | Larger marketplace icons; white bolded text (image-37) |
| 33 | Country/language dropdown with auto-detection (image-38) |
| 34 | Verify all comparison page accuracy (image-39) |
| 35 | Public pages accessible without sign-in (Affiliate, Docs, Roadmap, Blog, FAQs, Help, AI Info) |
| 36 | Social media icons link to profiles (image-40) |
| 37 | Roadmap in kanban board format |
| 38 | Migrate Changelog & Roadmap to "Product Updates" dropdown (image-41) |
| 39 | Add Status Page button (image-41) |
| 40 | Add Help Center and Documentation to Resources dropdown |
| 41 | Roadmap kanban sections order (image-43) |
| 42 | Status page components should be platforms (image-44) |
| 43 | Language dropdown dark grey with white text |
| 44 | All prices show CAD suffix |
| 45 | Reddit logo use official SVG |
| 46 | Replace pricing section text (image-46) |
| 47 | Remove section from Status Page (image-45) |
| 48 | Rename "Product Updates" to "Status & Updates" |
| 49 | Rename "Get Started Free" to "Start Free Trial" |
| 50 | Add Currency selection dropdown next to Language |
| 51 | Add search bar on Blog Page |
| 52 | Add "Learning" page to Resources (tips, tricks, guides) |
| 53 | Add "Feedback & Support" dropdown menu; migrate Help Center, FAQs, Contact Us |
| 54 | Reword platform integrations text |
| 55 | Add pulsing status icons (image-47/48) |
| 56 | Settings tabs horizontal orientation (image-52) |
| 57 | Settings tabs reorder: Integrations, Account, Subscription, Affiliate, Customization, Notifications, Data |
| 58 | Add sidebar dropdown menus matching public pages (image-56) |
| 59 | Proper platform icons with (CA) suffix; Shopify import option (image-51/59/81) |
| 60 | Apply colour theme to top bar and bottom section of public pages (image-66/70/64) |
| 61 | Remove section from bottom of public pages; move Compare section (image-73) |
| 62 | Change outdated logo; dark theme background (image-99) |
| 63 | Make VaultLister logo slightly larger (image-100) |
| 64 | Determine best photo service |
| 65 | Create listing description template option |
| 66 | Master Form with platform-specific sub-forms for listing (image-50) |
| 67 | Duplicate of #64 |
| 68 | Duplicate of #65 |
| 69 | Duplicate of #66 |
| 70 | Duplicate of #59 |
| 71 | Duplicate of #60 |
| 72 | Duplicate of #61 |
| 73 | Duplicate of #62 |
| 74 | Duplicate of #63 |
| 75 | Sitemap URIs don't direct to proper pages (hash routing inconsistency) |

---

## 5. User UI/UX Requests — MANUAL_INSPECTION.md

48 UI/UX requests from user's manual inspection session (with screenshot references). Many overlap with Section 4 items — cross-reference needed to deduplicate. Source: `docs/MANUAL_INSPECTION.md`

| # | Request Summary |
|---|----------------|
| 1 | Oneshop comparison page + Crosslist Magic comparison page |
| 2 | Listing description template option |
| 3 | Master Form with platform-specific sub-forms for cross-listing (image-50) |
| 4 | Proper platform icons with (CA) suffix; Shopify import option (image-51/59/81) |
| 5 | Migrate logo from top bar back to sidebar; extend sidebar to top (image-53) |
| 6 | Bottom-left profile icon clickable with dropdown options (image-54) |
| 7 | Coming Soon platform text brighter/larger; Soon label more vibrant (image-55) |
| 8 | Changelog/Roadmap should be same page from public and sidebar (image-57/58) |
| 9 | Remove content from analytics page (image-60) |
| 10 | Social media icons larger + black on every public page (image-61/62) |
| 11 | Landing page section white background with proper contrasting (image-69) |
| 12 | Footer copyright text update (image-63) |
| 13 | Apply colour theme to top bar and bottom section of public pages (image-66/70/64) |
| 14 | Center "Still need help" popup on Help Center pages (image-67) |
| 15 | Related Articles buttons in single row (image-68) |
| 16 | Language/Currency dropdown fixes (image-71) |
| 17 | Changelog search bar + version/date display (image-72) |
| 18 | Remove newsletter section from public pages; move Compare section (image-73) |
| 19 | Rearrange Sign in button order (image-74) |
| 20 | Sign in button colour theme matching Start Free Trial (image-75) |
| 21 | Landing page hero section restructure (image-76) |
| 22 | Affiliate program: 25% recurring commission; 25% off first month for referral (image-77) |
| 23 | Add search bar under feature request header (image-78) |
| 24 | Feature request submission error fix (image-79) |
| 25 | Settings tab shows wrong content on sidebar click (image-80) |
| 26 | Missing platforms on Integrations page (image-82) |
| 27 | Account tab country/language dropdowns (image-83/84) |
| 28 | Red status bars showing black lines (image-85) |
| 29 | Public page dropdown signs out user (image-86) |
| 30 | Old logo showing on page refresh (image-87) |
| 31 | Inventory table columns not all visible; adaptive sizing needed (image-88) |
| 32 | Offers/Orders/Shipping as sidebar dropdown |
| 33 | Listings page navigation errors (image-90) |
| 34 | Google Calendar & Outlook Calendar integration status (image-91) |
| 35 | Planning Tools dropdown on sidebar; Daily Checklist + Calendar as tabs |
| 36 | Daily Checklist page cleanup — remove Analytics button, duplicate Add Task; rename buttons; add view toggle (image-92/93/94) |
| 37 | Remove all keyboard shortcut features |
| 38 | Remove content below View Changelog on dashboard (image-95) |
| 39 | Chatbot size larger + resizable; add Home tab (image-96/97) |
| 40 | Continue with Apple Sign-In setup (image-98) |
| 41 | Update login page logo + dark theme background (image-99) |
| 42 | Make VaultLister logo slightly larger (image-100) |
| 43 | Move Cash Flow Projection to its own Financial tab (image-101) |
| 44 | Remove content from Automations page (image-102) |
| 45 | Remove Analytics tabs; rename Sourcing to "Supplier Analytics" (image-103) |
| 46 | Remove 5 sidebar tabs (image-105) |
| 47 | Learning page: add search bar + Guides section with per-platform guides (image-106) |
| 48 | Determine best photo service |

**Additionally: 7 detailed learning guides** (each ~370 lines of content specification):
- eBay Canada Guide (lines 52-517)
- Poshmark Canada Guide (lines 518-891)
- Depop Canada Guide (lines 892-1252)
- Facebook Marketplace Canada Guide (lines 1253-1633)
- Shopify Canada Guide (lines 1634-2017)
- Grailed Canada Guide (lines 2018-2385)
- Whatnot Canada Guide (lines 2386-2748)

---

## 6. OPEN / NOT VERIFIED — Ops/Infra Setup

| # | Description | Source |
|---|-------------|--------|
| 1 | Setup User Feedback | WALKTHROUGH |
| 2 | Setup Logs | WALKTHROUGH |
| 3 | Setup Profiling | WALKTHROUGH |
| 4 | Setup Session Replay | WALKTHROUGH |
| 5 | Setup Monitor MCP Servers | WALKTHROUGH |
| 6 | Setup Monitor AI Agents | WALKTHROUGH |

---

## 7. OPEN QUESTION / NEEDS TRIAGE

| # | Description | Source |
|---|-------------|--------|
| 1 | Google Calendar & Outlook Calendar integration status? (image-91) | WALKTHROUGH |
| 2 | How to setup Continue with Apple Sign-In? (image-98) | WALKTHROUGH |

---

## 8. STILL OPEN — Landing Page Layout

| ID | Description | Source |
|----|-------------|--------|
| MANUAL-pub-8 | Display main features using alternating left/right layout with product screenshots (image-29) | walkthrough/public-site.md |
| MANUAL-pub-16 | Features outline in Crosslist-style layout with screenshot thumbnails (image-36) | walkthrough/public-site.md |

---

## 9. GitHub Issues — Currently Open

**As of 2026-04-29, only 13 issues remain open.** All 129+ issues from the April 12 triage (issues #24-#370) have been **closed**. The remaining open issues are all automated/CI/infrastructure alerts:

| # | Title | Labels |
|---|-------|--------|
| 441 | [CI Failure] master - Run #1321 | ci-failure, automated |
| 442 | [Deploy Failure] 0351ced — Run #899 | deploy-failure, automated |
| 443 | [CI Failure] release-please--branches--master--components--vaultlister - Run #1323 | ci-failure, automated |
| 445 | [Lighthouse] Performance score below 50 — immediate attention required | performance, automated |
| 446 | Maintenance: Push subscription cleanup reminder (2026-W17) | maintenance |
| 447 | [Observability] 3 pipeline issue(s) — 2026-04-27 | observability, automated |
| 453 | [Redis] Health check failed — Redis may be down or misconfigured | infrastructure, automated |
| 454 | [Service Health] 1 service(s) need attention — 2026-04-27 | service-health, automated |
| 455 | [Infra Audit] Issues detected — 2026-04-27 | infra-audit, automated |
| 456 | [Automation Coverage] 27 gap(s) detected — 2026-04-27 | automation-coverage, automated |
| 458 | [CI Failure] dependabot/npm_and_yarn/anthropic-ai/sdk-0.91.1 - Run #1384 | ci-failure, automated |
| 459 | [Automation] Project status update workflow failed — boards may be stale | ci-failure, automated |
| 460 | [Automation] Project status update workflow failed — boards may be stale | ci-failure, automated |

---

## 10. Uncommitted A11y + CSS Changes

78 files with unstaged changes. These are accessibility fixes applied after the execution sheet was written (2026-04-21). 49 public HTML + 29 frontend source files.

**49 public HTML files** — adding `aria-hidden="true"` to nav dropdown menus across all public pages:
`public/about.html`, `public/affiliate.html`, `public/ai-info.html`, `public/api-changelog.html`, `public/api-docs.html`, `public/blog/*.html` (6 files), `public/careers.html`, `public/changelog.html`, `public/compare/*.html` (10 files), `public/contact.html`, `public/cookies.html`, `public/documentation.html`, `public/er-diagram.html`, `public/faq.html`, `public/glossary.html`, `public/help.html`, `public/help/*.html` (4 files), `public/landing.html`, `public/learning.html`, `public/platforms.html`, `public/pricing.html`, `public/privacy.html`, `public/quickstart.html`, `public/rate-limits.html`, `public/request-feature.html`, `public/roadmap-public.html`, `public/schema.html`, `public/status.html`, `public/terms.html`

**29 frontend source files** (322 insertions, 323 deletions) — wrapping `&times;` close button text in `<span aria-hidden="true">` for screen reader compatibility, plus CSS fixes:
`chatWidget.js`, `core-bundle.js`, `auth.js`, `utils.js`, `handlers-community-help.js`, `handlers-core.js`, `handlers-deferred.js`, `handlers-intelligence.js`, `handlers-inventory-catalog.js`, `handlers-sales-orders.js`, `handlers-settings-account.js`, `handlers-tools-tasks.js`, `index.html`, `init.js`, `pages-core.js`, `pages-deferred.js`, `pages-inventory-catalog.js`, `pages-sales-orders.js`, `pages-settings-account.js`, `pages-tools-tasks.js`, `base.css`, `features.css`, `main.css`, `page-heroes.css`, `variables.css`, `widgets.css`, `components.js`, `modals.js`, `widgets.js`

> **Note:** 9 of these 29 files overlap with execution sheet subsets 3-5 (init.js, pages-settings-account.js, base.css, components.js, core-bundle.js, index.html, main.css, pages-deferred.js, handlers-deferred.js). The remaining 20 are NOT in the execution sheet.

---

## 11. Execution Sheet — Uncommitted Work

From `docs/REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md`:

| Subset | Description | Files |
|--------|-------------|-------|
| 1 | Docs-only cleanup | WALKTHROUGH_MASTER_FINDINGS.md, STATUS.md |
| 2 | Backend / dev tooling hardening | .env.example, build-dev-bundle.js, server-manager.js, server.js |
| 3+4 | Frontend shell / settings redesign + generated artifacts | init.js, pages-settings-account.js, base.css, components.js, core-bundle.js, index.html |
| 5 | Deferred page cleanup | pages-deferred.js, handlers-deferred.js |
| 6 | robots.txt formatting | public/robots.txt |

---

## 12. Exhaustive Audit Ledger — Pending Passes

From `docs/EXHAUSTIVE_AUDIT_LEDGER_2026-04-20.md`:

| Directory | Status |
|-----------|--------|
| `src/backend` | PENDING — routes, middleware, services, DB, workers |
| `src/frontend` | PENDING — SPA routes/pages/components |
| `src/shared` | PENDING — shared logic |
| `src/tests` | PENDING — unit coverage and gaps |
| `e2e/tests` | PENDING — spec-by-spec coverage |
| `scripts` | PENDING — CLI, deploy, smoke, ops, security |
| `.github/workflows` | PENDING — workflow-by-workflow review |
| `docs` | PENDING — system truth and stale guidance |
| `qa` | PENDING — reports and coverage matrices |

---

## 13. Facebook OAuth Compliance Checklist

34 unchecked items from `docs/FACEBOOK_OAUTH_COMPLIANCE.md`. These are prerequisites for CR-10 Facebook OAuth:

**App Setup:** Meta App creation, Business Manager, Business Verification, Privacy Policy URL, data deletion callback, deauthorize callback, HTTPS on redirect URIs, app secret server-side, AES-256-GCM token storage, appsecret_proof, state parameter CSRF, working logout

**App Review:** Successful API call per permission (within 30 days), screen recording per permission (1080p), unique usage descriptions, app icon 1024x1024, test account credentials, app publicly accessible, no crashes during testing

**Commerce:** Sandbox Commerce Account, catalog feed configured, System User tokens encrypted, rate limits respected, seller upload flow

**Compliance:** Official Graph API only (no scraping), no prefilling user content, marketplace lead data restrictions, annual Data Use Checkup, data retention/deletion policy, user consent before profile building, no sensitive data to Meta, cookie consent for EU/UK, Meta Business Tools notice, login button brand guidelines

**Ongoing:** Monitor Meta emails, rotate system user tokens, re-certify annually, keep app active (API calls every 30 days), maintain app description, respond to Meta requests, report security incidents

---

## 14. Source Code TODOs

| File | Line | TODO |
|------|------|------|
| src/backend/services/platformSync/facebookSync.js | 8 | TODO(signal-emitter): import signal tracking |
| src/backend/services/platformSync/grailedSync.js | 8 | TODO(signal-emitter): import signal tracking |
| src/backend/services/platformSync/mercariSync.js | 8 | TODO(signal-emitter): import signal tracking |
| src/backend/services/platformSync/poshmarkSync.js | 8 | TODO(signal-emitter): import signal tracking |
| src/backend/services/platformSync/whatnotSync.js | 8 | TODO(signal-emitter): import signal tracking |
| src/frontend/core/utils.js | 66 | TODO(csp-hardening): ADD_ATTR allows inline event handlers |
| src/frontend/core-bundle.js | 68 | TODO(csp-hardening): same (generated from utils.js) |
| public/status.html | 821 | TODO (v2): wire per-platform status from /api/health/platforms |

---

## 15. Post-Launch Items

| # | Description | Source |
|---|-------------|--------|
| 1 | Activate Cloudinary image features: add `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_SECRET` to Railway. Background removal, enhance, upscale, smart crop are fully coded — disabled only because these 2 vars are missing. Prerequisite: confirm AI Background Removal add-on enabled in Cloudinary account. | STATUS.md |
| 2 | CLS regression risk in `public/status.html`: `renderPastIncidents()` replaces static "No resolved incidents" text with a dynamic `<ul>` of different height. Currently no incidents = no shift, but first real incident will cause CLS. Fix: give `#past-incidents-list` a `min-height` or pre-render as `<ul>` with empty-state `<li>`. | qa/reports/browserstack/2026-04-23/performance-notes.md |

---

## 16. Automation Roadmap (59)

59 unchecked automation/ops items from `memory/project_automation_roadmap.md`. These are CI, monitoring, alerting, and maintenance automations not yet implemented:

**CI/Build (8):** Auto-merge version-check PRs, .env.example sync check, migration registration check, commit message lint, PR size alerts, SonarCloud quality gate alerting, test baseline auto-update, bundle size regression tracking

**Database/Storage (7):** VACUUM/ANALYZE cron, orphaned records cleanup, unused image cleanup, index bloat check, slow query detection, connection pool monitoring, disk/volume alerts

**Security (6):** SSL cert expiry monitoring, secret rotation reminders, domain expiry monitoring, WAF rule review reminders, DNS record change detection, VAPID key rotation monitoring

**Monitoring/Alerting (14):** Uptime push notifications, Lighthouse score regression, Redis memory alerts, worker queue depth monitoring, marketplace bot health monitoring, Sentry error rate trend alerting, log rotation, dead letter queue processing, BetterStack log drain health, Prometheus alerting pipeline, Firebase SA key staleness, Playwright bot session keepalive, BrowserStack quota monitoring, web push subscription cleanup

**Cost/Spend (7):** Railway spend alerts, Anthropic API spend alerts, B2 storage cost alerts, token usage budget caps, OpenAI/xAI spend tracking, Grok/xAI separate spend monitoring, rate limit budget tracking

**Operational (10):** Expired session cleanup, npm audit cron, stale branch cleanup, GDPR data retention purge, periodic load testing, accessibility/ethics audits in CI, backup retention alerting, runbook freshness check, currency exchange API health, cache purge on deploy

**Integration Health (7):** Transactional email health (Resend), OAuth token refresh monitoring, marketplace API deprecation alerts, Stripe webhook endpoint health, Google/Outlook OAuth credential expiry, changelog/release notes generation, Slack webhook wiring

---

## 17. Email Verification

| ID | Description | Source |
|----|-------------|--------|
| M-33 | `privacy@vaultlister.com` and `hello@vaultlister.com` — MX records point to Google Workspace, but actual mailbox delivery NOT re-proven. Send test email to confirm delivery before launch. | WALKTHROUGH |

---

## 18. Deep-Dive Refactoring Backlog

**Source:** `docs/reference/deep-dive-backlog.md` (2026-04-24)

Read-only structural refactoring risk items. Each P1 item is **blocked until its inspection steps are completed**. P2 items are lower risk but still need inspection before extraction.

**P1 — Must inspect before any refactor (5):**

| Risk ID | Area | Key Risk |
|---------|------|----------|
| R-001 | `server.js` — 15 inline async handlers, 2087 lines | Silent regressions if handlers with module-level mutable state are extracted without audit |
| R-011 | `auth.js` — 1153 lines, 11 imports across 6 concern domains | MFA/password-reset path coupling; Redis vs DB dependency mapping needed |
| R-012 | `database.js` — 640 lines, 7+ responsibilities | Migration array order is load-bearing; pool monitoring is stateful |
| R-015 | Authorization/ownership checks across all routes | IDOR risk — coverage is UNKNOWN; route-by-route audit not yet completed |
| R-029 | Frontend/backend auth-session coupling (4 files) | Full token lifecycle mapping required before any change to store/api/auth files |

**P2 — Medium risk, inspect before extracting (5):**

| Risk ID | Area | Key Risk |
|---------|------|----------|
| R-003 | 4 service files exporting HTTP routers alongside service logic | Circular import risk if routers moved to `routes/` |
| R-017 | CORS config embedded in `server.js` | Verify stateless before extraction to middleware |
| R-020/R-021 | Playwright version drift (1.59.1 vs 1.58.2) + duplicate Dockerfile | Determine which Dockerfile Railway actually uses |
| R-027 | Upload/media route validation (imageBank, batchPhoto, receiptParser) | MIME type, file size, path traversal, ownership checks unaudited |
| R-028 | Background job schedulers split across `src/backend/workers/` and `worker/` | Potential duplicate queue consumer registration |

**P3 — Partially resolved (2):**

| Risk ID | Status |
|---------|--------|
| R-018 | `docs/reference/env.md` pending creation (documentation only) |
| R-022 | Docs/archive noise — partially resolved, cosmetic only |

---

## 19. Chrome Extension Future Features

**Source:** `chrome-extension/README.md` (7 unchecked items)

| Feature |
|---------|
| Support more retail sites (Walmart, Target, Best Buy) |
| Batch import from search results |
| OCR for reading product info from images |
| Browser history analysis for sourcing opportunities |
| Bulk price tracking from Amazon wish lists |
| Export data to CSV/Excel |
| Dark mode for popup |

---

## 20. Unfinished Implementation Plans

**Source:** `docs/superpowers/plans/` — 9 plan files with 259 unchecked steps total

These are implementation plans created April 12-15 that were never fully executed. Each has `- [ ]` checkboxes tracking progress.

| Plan File | Description | Unchecked Steps |
|-----------|-------------|-----------------|
| `2026-04-12-ui-restructure.md` | 22 manual-review UI/UX fixes across 7 source files | 51 |
| `2026-04-13-sentry-metrics.md` | Sentry `metrics.*` calls at API router dispatch | 7 |
| `2026-04-13-sentry-tracing.md` | Sentry performance tracing for Bun.js HTTP server | 21 |
| `2026-04-14-anti-detection-hardening.md` | 26 anti-detection gaps in Facebook automation | 61 |
| `2026-04-14-facebook-chrome-extension-gaps.md` | Category/condition/location fields in Chrome extension `fillFacebook()` | 7 |
| `2026-04-14-vault-buddy-sse-streaming.md` | SSE streaming for Vault Buddy AI responses | 28 |
| `2026-04-15-camoufox-migration.md` | Camoufox migration for Facebook bot | 28 |
| `2026-04-15-facebook-mock-test-env.md` | Local mock server + HTML fixtures for 53 Facebook DOM interactions | 35 |
| `2026-04-15-facebook-safe-fixes.md` | Harden Facebook automation + fix known failure modes | 21 |

> **Note:** Some of these plans may overlap with items in Sections 4, 5, and 18. The UI restructure plan (51 steps) likely overlaps heavily with MANUAL_INSPECTION.md (Section 5). The anti-detection and Facebook plans overlap with the Facebook integration items already tracked.

---

## Summary by Category

| Category | Count |
|----------|-------|
| Critical / Launch Blockers | 2 |
| Deploy Config | 2 |
| FIXED — Pending Live Verification | 38 |
| OPEN / NEEDS MANUAL CHECK (product/design) | 75 |
| User UI/UX Requests (MANUAL_INSPECTION.md) | 48 + 7 guides |
| OPEN / NOT VERIFIED (ops/infra) | 6 |
| OPEN QUESTION / NEEDS TRIAGE | 2 |
| STILL OPEN — Landing Page | 2 |
| GitHub Issues — Currently Open | 13 |
| Uncommitted A11y + CSS Changes | 78 files (49 HTML + 29 JS/CSS) |
| Execution Sheet — Uncommitted Work | 6 subsets |
| Audit Ledger — Pending Passes | 9 directories |
| Facebook OAuth Compliance Checklist | 34 |
| Source Code TODOs | 8 |
| Post-Launch Items | 2 |
| Automation Roadmap | 59 |
| Email Verification | 1 |
| Deep-Dive Refactoring Backlog | 12 (5 P1 + 5 P2 + 2 P3) |
| Chrome Extension Future Features | 7 |
| Unfinished Implementation Plans | 259 unchecked steps across 9 plans |
| **TOTAL** | **~339 unique items + 259 plan steps** + 7 learning guides + overlap between Sections 4, 5 & 20 to deduplicate |

---

## Appendix A: Product Roadmap & Platform Status (Reference Only)

These are **planned features and known limitations** — not open bugs or tasks. Included for completeness.

**Public Roadmap (planned, from `public/roadmap-public.html`):**
1. AR item preview
2. Blockchain item verification
3. Etsy OAuth full integration
4. AI price suggestion engine
5. Mobile app (iOS & Android)

**Platform Publish Status (from `RELEASE.md`):**

| Platform | Status |
|----------|--------|
| Poshmark | Live (CA account, US untested) |
| eBay | Sandbox-verified (needs production creds) |
| Etsy | OAuth implemented, blocked on Etsy app key approval (pending since 2026-03-09) |
| Mercari | UI stub only — no publish bot |
| Depop | UI stub only — no publish bot |
| Grailed | UI stub only — no publish bot |
| Facebook Marketplace | UI stub only — no publish bot |
| Whatnot | UI stub only — no publish bot |
| Shopify | UI stub only — no publish bot |

**PRD Phase 5 Future Features (from `docs/PRD.md`):**
Multi-user team support, automated relisting with price predictions, bulk label printing, inventory import from spreadsheets

**Known Limitations (from `RELEASE.md`):**
Poshmark CA-only untested US, eBay sandbox-only, Etsy blocked on app key, email needs SMTP creds, Playwright bots fragile to Poshmark UI changes, Redis optional (in-memory fallback works), SSL self-signed for local only

**Intentionally Excluded from V1.0 (from `RELEASE.md`):**
AR previews (needs native app/WebXR), blockchain verification (stub only), Whatnot live auctions (API waitlisted)

---

## Overlap Notes

- **Sections 4 and 5** have significant overlap — many MANUAL_INSPECTION.md items are the same requests captured in the walkthrough backlog. A deduplication pass would reduce the combined ~123 items to likely ~85-90 unique items.
- **GitHub Issues**: The April 12 triage doc (`docs/OPEN_ISSUE_TRIAGE_2026-04-12.md`) is now fully stale — all 129+ issues it tracked have been closed. Only 13 automated/CI issues remain open as of 2026-04-29.
- **Execution Sheet vs Section 10**: The uncommitted a11y changes (Section 10) are separate from the execution sheet subsets (Section 11). Both need to be staged and committed independently.
- **Section 10 vs Section 11**: 9 files overlap between the a11y changes and execution sheet subsets 3-5. The remaining 20 frontend source files in Section 10 are not in the execution sheet.

---

*Generated by exhaustive scan of: `docs/WALKTHROUGH_MASTER_FINDINGS.md`, `docs/walkthrough/*.md`, `docs/MANUAL_INSPECTION.md`, `docs/OPEN_ISSUE_TRIAGE_2026-04-12.md` (verified stale), `docs/REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md`, `docs/EXHAUSTIVE_AUDIT_LEDGER_2026-04-20.md`, `docs/FACEBOOK_OAUTH_COMPLIANCE.md`, `docs/LAUNCH_AUDIT_FINDINGS_2026-04-05.md` (launch blockers verified resolved), `docs/reference/deep-dive-backlog.md`, `docs/superpowers/plans/*.md` (9 plan files), `chrome-extension/README.md`, `qa/reports/browserstack/2026-04-23/performance-notes.md`, `memory/STATUS.md`, `memory/project_automation_roadmap.md`, live GitHub API (`gh issue list --state open`), `git diff --name-only`, source code grep for TODO/FIXME across all directories (src/, public/, scripts/, worker/, design/, e2e/, data/, .github/, archive/, chrome-extension/, mobile/, nginx/, .agents/, qa/, root files), and product state reference from `RELEASE.md`, `docs/PRD.md`, and `public/roadmap-public.html`.*
