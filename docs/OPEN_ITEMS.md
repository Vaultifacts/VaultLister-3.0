<!-- GENERATED FILE. DO NOT EDIT DIRECTLY. Run `bun run open-items` instead. -->

# VaultLister Open Items

Generated at: 2026-04-30T03:24:55.160Z
Commit: 8fd7406c
Generator: `bun scripts/generate-open-items.mjs`
Check: `bun run open-items:check`

Source priority: `docs/open-items/items.json` metadata > current `docs/walkthrough/` status > live GitHub issues > explicit checklists > source scans.

## Summary

| Section | Count |
|---|---:|
| Launch blockers | 2 |
| Open walkthrough/product items | 2 |
| Fixed pending live/manual verification | 26 |
| Deferred/post-launch items | 10 |
| Open GitHub issues | 14 |
| Explicit unchecked checklist items | 359 |
| Source TODO/FIXME hits | 15 |

## Launch Blockers

| ID | Status | Priority | Area | Item | Source | Next Action | Blocker |
|---|---|---|---|---|---|---|---|
| CR-4 | OPEN / NOT VERIFIED — 2026-04-22 live GET /api/shipping-labels-mgmt/easypost/track/TEST123456789 returned 503 {"error":"EasyPost not configured"} | launch-blocker | Shipping / EasyPost | EasyPost not configured -- live GET /api/shipping-labels-mgmt/easypost/track/TEST123456789 returns 503 {"error":"EasyPost not configured"} | docs/walkthrough/environment.md:44<br>docs/walkthrough/shipping.md:7 | Configure EASYPOST_API_KEY in Railway, then run an authenticated EasyPost rates/buy/track verification and update docs/walkthrough/environment.md plus docs/walkthrough/shipping.md. | EasyPost account/API key availability and Railway production environment configuration. |
| CR-10 | OPEN -- verified 2026-04-24 | launch-blocker | Connections / Marketplace OAuth | Marketplace connection state is still incomplete: eBay and Shopify OAuth init are live, but Depop OAuth is unconfigured and several remaining marketplace connects still rely on manual / Playwright credential flows | docs/walkthrough/connections.md:7<br>docs/walkthrough/my-shops.md:7<br>docs/walkthrough/platform-readiness.md:21 | Run authenticated end-to-end verification for the remaining marketplace connect flows and update the specific walkthrough area files with the result. | Marketplace credentials, provider access, and live connect-flow verification. |

## Open Walkthrough / Product Items

| ID | Status | Priority | Area | Item | Source | Next Action | Blocker |
|---|---|---|---|---|---|---|---|
| MANUAL-pub-8 | STILL OPEN — image-29 shows Vendoo-style alternating left/right sections with full product screenshots per feature. landing.html:1114-1245 has 3-card icon grids per group — no screenshots, no alternating layout. |  | Landing | Display main features using the specified format (image-29) | docs/walkthrough/public-site.md:6 |  |  |
| MANUAL-pub-16 | STILL OPEN — image-36 shows Crosslist-style layout with screenshot thumbnails beside feature cards and "See all features" button under each group. landing.html:1114-1245 has 4 feature groups (3-card icon grids) with no product screenshots and no "See all features" buttons. Layout format not matching reference. |  | Landing | Set up the Features outline in the specified format without reviews underneath (image-36) | docs/walkthrough/public-site.md:7 |  |  |

## Fixed Pending Live / Manual Verification

| ID | Status | Priority | Area | Item | Source | Next Action | Blocker |
|---|---|---|---|---|---|---|---|
| changelog-33-fixed-please-add-a-search-bar-above-the-bu | FIXED — local changelog source already matches; live/manual recheck pending |  | Changelog | FIXED — Please add a search bar above the button filters on the changelog page, and also please display the Version information and exact date of each change, on the left side of the Dot next to each associated batch of changes (image-72) | docs/walkthrough/changelog.md:33 |  |  |
| L-18 | CONFIRMED N/A -- connectGmail() has real OAuth popup flow. Functional pending credentials. |  | Connections | Gmail/Outlook/Cloudinary/Google Drive "Connect" buttons -- unclear if functional | docs/walkthrough/connections.md:14 |  |  |
| MANUAL-listings-1 | FIXED — local Listings dropdown now uses SUPPORTED_PLATFORMS and components.platformLogo() assets to match My Shops; live/manual recheck pending |  | Listings | Platform icons in the Platform dropdown menu of the Listings page are not displaying the correct icons for the platform. (Should show the same associated icons as it does on the My Shops page) | docs/walkthrough/listings.md:12 |  |  |
| MANUAL-listings-2 | VERIFIED LOCALLY / NO CODE CHANGE — real demo JWT returned 200 for /api/listings and /api/listings/folders; direct #listings load on bundle 0ed2ca33 showed no error toasts; live/manual recheck pending |  | Listings | When I navigate to the listings page, the following errors show up in the top right corner (image-90) | docs/walkthrough/listings.md:13 |  |  |
| MANUAL-settings-3 | FIXED -- 2026-04-24 local Account tab patch places compact CAD/EN dropdowns beside Timezone with CSS-rendered Canada flags; live/manual recheck pending |  | Settings | Add Currency (CAD) and Language (EN) dropdown menus next to the Timezone field in Account tab (image-83, image-84) | docs/walkthrough/settings.md:45 |  |  |
| P0-pub-1 | FIXED -- local source patch present; live/manual recheck pending |  | Public Nav | When pressing dropdown menu buttons, user is signed out -- should display profile circle instead (image-86) | docs/walkthrough/public-site.md:62 |  |  |
| P0-pub-2 | FIXED -- local source patch present; live/manual recheck pending |  | Routes | Different changelog/roadmap pages shown from public vs signed-in sidebar (image-57) | docs/walkthrough/public-site.md:63 |  |  |
| P0-pub-3 | FIXED -- local source patch present; live/manual recheck pending |  | Sidebar Profile | Bottom left profile icon not clickable -- should display dropdown options (image-54) | docs/walkthrough/public-site.md:64 |  |  |
| P0-pub-4 | FIXED -- 2026-04-23 local patch; live/manual recheck pending |  | Assets | Old logo showing on page refresh (image-87) | docs/walkthrough/public-site.md:65 |  |  |
| P1-pub-1 | FIXED -- local sidebar source already matches; live/manual recheck pending |  | Sidebar | Migrate logo from top bar back to sidebar; sidebar extends to top of page (image-53) | docs/walkthrough/public-site.md:66 |  |  |
| P1-pub-2 | FIXED -- 2026-04-24 local landing source patch; live/manual recheck pending |  | Landing | Coming-soon platform text brighter white and larger; Soon label larger and more vibrant (image-55) | docs/walkthrough/public-site.md:67 |  |  |
| P1-pub-3 | FIXED -- 2026-04-24 local sidebar source patch; live/manual recheck pending |  | Sidebar | Remove 5 deprecated tabs from the sidebar menu (image-105) | docs/walkthrough/public-site.md:68 |  |  |
| P3-pub-1 | FIXED -- local public footer source already matches; live/manual recheck pending |  | Public Footer | Make social media icons slightly larger and black; bottom bar fully extends entire page width (image-61, image-62) | docs/walkthrough/public-site.md:69 |  |  |
| P3-pub-2 | FIXED -- 2026-04-24 local landing source patch; live/manual recheck pending |  | Landing | Make background of a specific landing section white with proper contrasting (image-69) | docs/walkthrough/public-site.md:70 |  |  |
| P3-pub-3 | FIXED -- local public footer source already matches; live/manual recheck pending |  | Public Footer | Change footer copyright text to 2026 VaultLister, Inc. All rights reserved. (image-63) | docs/walkthrough/public-site.md:71 |  |  |
| P3-pub-4 | FIXED -- local Help Center source already matches; live/manual recheck pending |  | Help Center | Center the orange Still need help popup below Related Articles (image-67) | docs/walkthrough/public-site.md:72 |  |  |
| P3-pub-5 | FIXED -- local Help Center source already matches; live/manual recheck pending |  | Help Center | Make all Related Articles buttons display in a single row (image-68) | docs/walkthrough/public-site.md:73 |  |  |
| P3-pub-6 | FIXED -- 2026-04-24 local selector source patch; live/manual recheck pending |  | Language / Currency Selector | Fix two Canada options; add English (U.S.); Currency dropdown same size as Language; matching colour theme (image-71) | docs/walkthrough/public-site.md:74 |  |  |
| P3-pub-7 | FIXED -- local changelog source already matches; live/manual recheck pending |  | Public Changelog | Add search bar above button filters; display Version info and exact date on left side of dot (image-72) | docs/walkthrough/public-site.md:75 |  |  |
| P3-pub-8 | FIXED -- local public nav source already matches; live/manual recheck pending |  | Public Nav | Rearrange top nav so Sign in button appears first (image-74) | docs/walkthrough/public-site.md:76 |  |  |
| P3-pub-9 | FIXED -- local public nav source already matches; live/manual recheck pending |  | Public Nav | Make Sign in buttons follow the same colour theme as Start Free Trial (image-75) | docs/walkthrough/public-site.md:77 |  |  |
| P3-pub-10 | FIXED -- 2026-04-24 local landing hero source patch; live/manual recheck pending |  | Landing Hero | Reorder and centre hero elements in specified sequence (image-76) | docs/walkthrough/public-site.md:78 |  |  |
| P3-pub-11 | FIXED -- 2026-04-24 local feature-request search patch; live/manual recheck pending |  | Feature Requests | Add a search bar under feature requests (image-78) | docs/walkthrough/public-site.md:79 |  |  |
| P3-pub-12 | FIXED -- 2026-04-24 local learning search patch; live/manual recheck pending |  | Learning Page | Add a search bar to the Learning page (image-106) | docs/walkthrough/public-site.md:80 |  |  |
| P4-pub-1 | FIXED -- local compare pages present; live/manual recheck pending |  | Compare Pages | Add an Oneshop Comparison and a Crosslist Magic comparison | docs/walkthrough/public-site.md:81 |  |  |
| settings-34-fixed-settings-sidebar-tab-targeting-so-th | FIXED — 2026-04-23 local route-normalization patch; live/manual recheck pending |  | Settings | FIXED — Settings sidebar tab targeting so the clicked tab renders immediately (image-80) | docs/walkthrough/settings.md:34 |  |  |

## Deferred / Post-Launch Items

| ID | Status | Priority | Area | Item | Source | Next Action | Blocker |
|---|---|---|---|---|---|---|---|
| Analytics-3 | PRE-EXISTING -- requires real ML/AI pipeline with actual sales data; deferred post-launch |  | Predictions | Predictions tab shows hardcoded sample data as real AI-generated insights for a zero-activity account | docs/walkthrough/predictions.md:15 |  |  |
| Analytics-4 | PRE-EXISTING -- requires real platform connections; deferred to post-launch |  | Market Intel / Heatmaps | Platform Engagement shows hardcoded multi-platform data for account with 0 connected shops | docs/walkthrough/market-intel.md:15 |  |  |
| analytics-33-predictions-tab-displays-hardcoded-sample- | PRE-EXISTING ✅ — requires real ML/AI pipeline with actual sales data; deferred to post-launch |  | Analytics | Predictions Tab Displays Hardcoded Sample Data as Real Insights | docs/walkthrough/analytics.md:33 |  |  |
| analytics-34-heatmaps-tab-platform-engagement-shows-har | PRE-EXISTING ✅ — requires real platform connections and engagement data; deferred to post-launch |  | Analytics | Heatmaps Tab — Platform Engagement Shows Hardcoded Multi-Platform Data for account with 0 connected shops | docs/walkthrough/analytics.md:34 |  |  |
| Sentry-1 | DEFERRED |  | Infrastructure | Setup User Feedback | docs/walkthrough/environment.md:63 |  |  |
| Sentry-2 | DEFERRED |  | Infrastructure | Setup Logs | docs/walkthrough/environment.md:64 |  |  |
| Sentry-3 | DEFERRED |  | Infrastructure | Setup Profiling | docs/walkthrough/environment.md:65 |  |  |
| Sentry-4 | DEFERRED |  | Infrastructure | Setup Session Replay | docs/walkthrough/environment.md:66 |  |  |
| Sentry-5 | DEFERRED |  | Infrastructure | Setup Monitor MCP Servers | docs/walkthrough/environment.md:67 |  |  |
| Sentry-6 | DEFERRED |  | Infrastructure | Setup Monitor AI Agents | docs/walkthrough/environment.md:68 |  |  |

## GitHub Open Issues

Command: `gh issue list --state open --limit 200 --json number,title,labels,updatedAt,url`

| Issue | Title | Labels | Updated | URL |
|---|---|---|---|---|
| #463 | [CI Failure] dependabot/github_actions/actions/github-script-9.0.0 - Run #1432 | ci-failure, automated | 2026-04-30T01:02:45Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/463 |
| #460 | [Automation] Project status update workflow failed — boards may be stale | ci-failure, automated | 2026-04-27T17:13:14Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/460 |
| #459 | [Automation] Project status update workflow failed — boards may be stale | ci-failure, automated | 2026-04-27T17:13:12Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/459 |
| #458 | [CI Failure] dependabot/npm_and_yarn/anthropic-ai/sdk-0.91.1 - Run #1384 | ci-failure, automated | 2026-04-27T16:18:23Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/458 |
| #456 | [Automation Coverage] 27 gap(s) detected — 2026-04-27 | automated, automation-coverage | 2026-04-27T15:50:17Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/456 |
| #455 | [Infra Audit] Issues detected — 2026-04-27 | automated, infra-audit | 2026-04-27T15:08:38Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/455 |
| #454 | [Service Health] 1 service(s) need attention — 2026-04-27 | automated, service-health | 2026-04-27T14:11:23Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/454 |
| #453 | [Redis] Health check failed — Redis may be down or misconfigured | infrastructure, automated | 2026-04-27T11:09:35Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/453 |
| #447 | [Observability] 3 pipeline issue(s) — 2026-04-27 | automated, observability | 2026-04-27T10:21:28Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/447 |
| #446 | Maintenance: Push subscription cleanup reminder (2026-W17) | maintenance | 2026-04-26T08:47:19Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/446 |
| #445 | [Lighthouse] Performance score below 50 — immediate attention required | automated, performance | 2026-04-30T00:57:56Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/445 |
| #443 | [CI Failure] release-please--branches--master--components--vaultlister - Run #1323 | ci-failure, automated | 2026-04-25T04:42:20Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/443 |
| #442 | [Deploy Failure] 0351ced — Run #899 | automated, deploy-failure | 2026-04-25T04:05:45Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/442 |
| #441 | [CI Failure] master - Run #1321 | ci-failure, automated | 2026-04-25T01:43:38Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/441 |

## Explicit Checklist Backlogs

### Automation Roadmap

Count: 59

| Item | Source |
|---|---|
| 1. Auto-merge version-check PRs | memory/project_automation_roadmap.md:19 |
| 2. VACUUM/ANALYZE cron | memory/project_automation_roadmap.md:20 |
| 3. SSL cert expiry monitoring | memory/project_automation_roadmap.md:21 |
| 4. Secret rotation reminders | memory/project_automation_roadmap.md:22 |
| 5. Domain expiry monitoring | memory/project_automation_roadmap.md:23 |
| 6. Expired session cleanup | memory/project_automation_roadmap.md:24 |
| 7. npm audit cron | memory/project_automation_roadmap.md:27 |
| 8. Stale branch cleanup | memory/project_automation_roadmap.md:28 |
| 9. Uptime push notifications (phone alerts via Slack) | memory/project_automation_roadmap.md:29 |
| 10. Changelog/release notes generation | memory/project_automation_roadmap.md:30 |
| 11. GDPR data retention purge | memory/project_automation_roadmap.md:31 |
| 12. Orphaned records cleanup | memory/project_automation_roadmap.md:32 |
| 13. Unused image cleanup | memory/project_automation_roadmap.md:33 |
| 14. .env.example sync check in CI | memory/project_automation_roadmap.md:34 |
| 15. Migration registration check in CI | memory/project_automation_roadmap.md:35 |
| 16. Railway spend alerts | memory/project_automation_roadmap.md:38 |
| 17. Anthropic API spend alerts | memory/project_automation_roadmap.md:39 |
| 18. B2 storage cost alerts | memory/project_automation_roadmap.md:40 |
| 19. Token usage budget caps | memory/project_automation_roadmap.md:41 |
| 20. OpenAI/xAI spend tracking | memory/project_automation_roadmap.md:42 |
| 21. Lighthouse score regression | memory/project_automation_roadmap.md:45 |
| 22. Slow query detection | memory/project_automation_roadmap.md:46 |
| 23. Bundle size regression tracking | memory/project_automation_roadmap.md:47 |
| 24. Index bloat check | memory/project_automation_roadmap.md:48 |
| 25. Redis memory alerts | memory/project_automation_roadmap.md:49 |
| 26. Worker queue depth monitoring | memory/project_automation_roadmap.md:50 |
| 27. Periodic load testing | memory/project_automation_roadmap.md:51 |
| 28. Accessibility + ethics audits in CI | memory/project_automation_roadmap.md:52 |
| 29. Transactional email health (Resend) | memory/project_automation_roadmap.md:55 |
| 30. Cache purge on deploy (Cloudflare) | memory/project_automation_roadmap.md:56 |
| 31. OAuth token refresh monitoring | memory/project_automation_roadmap.md:57 |
| 32. Rate limit budget tracking | memory/project_automation_roadmap.md:58 |
| 33. Marketplace API deprecation alerts | memory/project_automation_roadmap.md:59 |
| 34. DNS record change detection | memory/project_automation_roadmap.md:60 |
| 35. WAF rule review reminders | memory/project_automation_roadmap.md:61 |
| 36. Test baseline auto-update | memory/project_automation_roadmap.md:62 |
| 37. PR size alerts | memory/project_automation_roadmap.md:63 |
| 38. Commit message lint in CI | memory/project_automation_roadmap.md:64 |
| 39. Backup retention alerting | memory/project_automation_roadmap.md:65 |
| 40. Connection pool monitoring | memory/project_automation_roadmap.md:66 |
| 41. Disk/volume alerts | memory/project_automation_roadmap.md:67 |
| 42. Runbook freshness check | memory/project_automation_roadmap.md:68 |
| 43. Log rotation | memory/project_automation_roadmap.md:69 |
| 44. Dead letter queue processing | memory/project_automation_roadmap.md:70 |
| 45. Web push subscription cleanup | memory/project_automation_roadmap.md:71 |
| 46. Stripe webhook endpoint health | memory/project_automation_roadmap.md:72 |
| 47. Wire Slack webhook to all alerts | memory/project_automation_roadmap.md:73 |
| 48. SonarCloud quality gate alerting | memory/project_automation_roadmap.md:74 |
| 49. Google/Outlook OAuth credential expiry | memory/project_automation_roadmap.md:75 |
| 50. Prometheus → alerting pipeline | memory/project_automation_roadmap.md:78 |
| 51. BetterStack log drain health | memory/project_automation_roadmap.md:79 |
| 52. Currency exchange API health (frankfurter.app) | memory/project_automation_roadmap.md:80 |
| 53. Marketplace bot health/success rate monitoring | memory/project_automation_roadmap.md:81 |
| 54. Firebase SA key staleness | memory/project_automation_roadmap.md:82 |
| 55. VAPID key rotation monitoring | memory/project_automation_roadmap.md:83 |
| 56. Playwright bot session keepalive scheduling | memory/project_automation_roadmap.md:84 |
| 57. BrowserStack quota monitoring | memory/project_automation_roadmap.md:85 |
| 58. Grok/xAI separate spend monitoring | memory/project_automation_roadmap.md:86 |
| 59. Sentry error rate trend alerting | memory/project_automation_roadmap.md:87 |

### Chrome Extension Future Features

Count: 7

| Item | Source |
|---|---|
| Support more retail sites (Walmart, Target, Best Buy) | chrome-extension/README.md:233 |
| Batch import from search results | chrome-extension/README.md:234 |
| OCR for reading product info from images | chrome-extension/README.md:235 |
| Browser history analysis for sourcing opportunities | chrome-extension/README.md:236 |
| Bulk price tracking from Amazon wish lists | chrome-extension/README.md:237 |
| Export data to CSV/Excel | chrome-extension/README.md:238 |
| Dark mode for popup | chrome-extension/README.md:239 |

### Facebook OAuth Compliance

Count: 42

| Item | Source |
|---|---|
| Meta App created with Business type | docs/FACEBOOK_OAUTH_COMPLIANCE.md:597 |
| Business Manager set up with all assets consolidated | docs/FACEBOOK_OAUTH_COMPLIANCE.md:598 |
| Business Verification completed with valid documents | docs/FACEBOOK_OAUTH_COMPLIANCE.md:599 |
| Privacy Policy URL: live, accessible, non-geo-blocked, crawlable | docs/FACEBOOK_OAUTH_COMPLIANCE.md:600 |
| Privacy Policy covers: what FB data collected, how used, how to request deletion | docs/FACEBOOK_OAUTH_COMPLIANCE.md:601 |
| Data deletion callback implemented (POST /api/facebook/data-deletion) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:602 |
| Deauthorize callback implemented (POST /api/facebook/deauth) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:603 |
| HTTPS enforced on all redirect URIs and callbacks | docs/FACEBOOK_OAUTH_COMPLIANCE.md:604 |
| App secret stored server-side only (in .env) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:605 |
| Token storage uses AES-256-GCM encryption | docs/FACEBOOK_OAUTH_COMPLIANCE.md:606 |
| appsecret_proof implemented for server-to-server calls | docs/FACEBOOK_OAUTH_COMPLIANCE.md:607 |
| State parameter for CSRF in OAuth flow | docs/FACEBOOK_OAUTH_COMPLIANCE.md:608 |
| Working logout functionality (easily discoverable) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:609 |
| At least 1 successful API call per requested permission (within 30 days) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:612 |
| Screen recording for EVERY permission (1080p, no audio, English UI, mouse-driven) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:613 |
| Unique usage description for each permission (no copy-paste) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:614 |
| App icon 1024x1024, no Meta trademarks | docs/FACEBOOK_OAUTH_COMPLIANCE.md:615 |
| Test account credentials prepared for reviewers | docs/FACEBOOK_OAUTH_COMPLIANCE.md:616 |
| App publicly accessible or access instructions provided | docs/FACEBOOK_OAUTH_COMPLIANCE.md:617 |
| App does not crash during testing | docs/FACEBOOK_OAUTH_COMPLIANCE.md:618 |
| Sandbox Commerce Account onboarded | docs/FACEBOOK_OAUTH_COMPLIANCE.md:621 |
| Catalog feed with required product attributes configured | docs/FACEBOOK_OAUTH_COMPLIANCE.md:622 |
| System User tokens configured and encrypted | docs/FACEBOOK_OAUTH_COMPLIANCE.md:623 |
| Rate limits respected | docs/FACEBOOK_OAUTH_COMPLIANCE.md:624 |
| Seller upload flow: sellers first, then products | docs/FACEBOOK_OAUTH_COMPLIANCE.md:625 |
| All data access via official Graph API only — no scraping | docs/FACEBOOK_OAUTH_COMPLIANCE.md:628 |
| No prefilling of user messages or content | docs/FACEBOOK_OAUTH_COMPLIANCE.md:629 |
| Marketplace lead data used only for contacting about specific listings | docs/FACEBOOK_OAUTH_COMPLIANCE.md:630 |
| Annual Data Use Checkup process planned | docs/FACEBOOK_OAUTH_COMPLIANCE.md:631 |
| Data retention/deletion policy documented and implemented | docs/FACEBOOK_OAUTH_COMPLIANCE.md:632 |
| User consent obtained before any profile building | docs/FACEBOOK_OAUTH_COMPLIANCE.md:633 |
| No sensitive data sent to Meta (health, financial, children under 13) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:634 |
| Cookie consent mechanism for EU/UK users | docs/FACEBOOK_OAUTH_COMPLIANCE.md:635 |
| Meta Business Tools notice on every page using Meta tools | docs/FACEBOOK_OAUTH_COMPLIANCE.md:636 |
| Login button follows brand guidelines (#1877F2, "Log in with Facebook", f logo) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:637 |
| Monitor emails from meta.com, fb.com, facebookmail.com — never filter | docs/FACEBOOK_OAUTH_COMPLIANCE.md:640 |
| Rotate system user tokens periodically | docs/FACEBOOK_OAUTH_COMPLIANCE.md:641 |
| Re-certify Data Use Checkup annually (within 60 days of notice) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:642 |
| Keep app active (API calls at least every 30 days) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:643 |
| Maintain updated app description and categorization | docs/FACEBOOK_OAUTH_COMPLIANCE.md:644 |
| Respond promptly to all Meta requests | docs/FACEBOOK_OAUTH_COMPLIANCE.md:645 |
| Report security incidents immediately | docs/FACEBOOK_OAUTH_COMPLIANCE.md:646 |

### Plan: 2026-04-12-ui-restructure.md

Count: 50

| Item | Source |
|---|---|
| **Step 1: Update the navItems array** | docs/superpowers/plans/2026-04-12-ui-restructure.md:69 |
| **Step 2: Add "Learn more" button after Get Help** | docs/superpowers/plans/2026-04-12-ui-restructure.md:107 |
| **Step 3: Remove Focus Mode button from header** | docs/superpowers/plans/2026-04-12-ui-restructure.md:145 |
| **Step 4: Update breadcrumb/page label map** | docs/superpowers/plans/2026-04-12-ui-restructure.md:153 |
| **Step 5: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:161 |
| **Step 1: Change default tab and tab bar — Profile → Account** | docs/superpowers/plans/2026-04-12-ui-restructure.md:181 |
| **Step 2: Update the tab buttons in the tab bar** | docs/superpowers/plans/2026-04-12-ui-restructure.md:192 |
| **Step 3: Update Billing → Plans & Billing tab button** | docs/superpowers/plans/2026-04-12-ui-restructure.md:213 |
| **Step 4: Add 'account' case to renderTabContent switch** | docs/superpowers/plans/2026-04-12-ui-restructure.md:231 |
| **Step 5: Add 'plans-billing' case to renderTabContent switch** | docs/superpowers/plans/2026-04-12-ui-restructure.md:246 |
| **Step 6: Remove Accent Color section from Appearance tab** | docs/superpowers/plans/2026-04-12-ui-restructure.md:257 |
| **Step 7: Remove Display (Density + Font Size) section from Appearance tab** | docs/superpowers/plans/2026-04-12-ui-restructure.md:271 |
| **Step 8: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:294 |
| **Step 1: Reorder the array** | docs/superpowers/plans/2026-04-12-ui-restructure.md:310 |
| **Step 2: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:346 |
| **Step 1: Add Financials Analytics tab button to the tab bar** | docs/superpowers/plans/2026-04-12-ui-restructure.md:366 |
| **Step 2: Add tab content for Financials Analytics** | docs/superpowers/plans/2026-04-12-ui-restructure.md:381 |
| **Step 3: Add tab content for Inventory, Sales, Purchases** | docs/superpowers/plans/2026-04-12-ui-restructure.md:467 |
| **Step 4: Wire new tabs into the render ternary chain** | docs/superpowers/plans/2026-04-12-ui-restructure.md:538 |
| **Step 5: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:554 |
| **Step 1: Change ordersMainTab default** | docs/superpowers/plans/2026-04-12-ui-restructure.md:568 |
| **Step 2: Replace the tab bar** | docs/superpowers/plans/2026-04-12-ui-restructure.md:579 |
| **Step 3: Add Shipping tab to the content conditional** | docs/superpowers/plans/2026-04-12-ui-restructure.md:613 |
| **Step 4: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:633 |
| **Step 1: Remove Sourcing Platforms card from Purchases tab** | docs/superpowers/plans/2026-04-12-ui-restructure.md:647 |
| **Step 2: Remove the Create Report button from the reports() empty state** | docs/superpowers/plans/2026-04-12-ui-restructure.md:664 |
| **Step 3: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:684 |
| **Step 1: Remove the four always-visible financial cards** | docs/superpowers/plans/2026-04-12-ui-restructure.md:704 |
| **Step 2: Move Tax Estimate Calculator into a new tab** | docs/superpowers/plans/2026-04-12-ui-restructure.md:708 |
| **Step 3: Move Bank Reconciliation into a new tab** | docs/superpowers/plans/2026-04-12-ui-restructure.md:731 |
| **Step 4: Remove Expense Categories section** | docs/superpowers/plans/2026-04-12-ui-restructure.md:737 |
| **Step 5: Add new tabs to the tab bar** | docs/superpowers/plans/2026-04-12-ui-restructure.md:741 |
| **Step 6: Confirm switchFinancialsTab handler supports new keys** | docs/superpowers/plans/2026-04-12-ui-restructure.md:763 |
| **Step 7: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:767 |
| **Step 1: Remove the Catalog/Analytics tab buttons** | docs/superpowers/plans/2026-04-12-ui-restructure.md:783 |
| **Step 2: Remove the Analytics tab pane wrapper** | docs/superpowers/plans/2026-04-12-ui-restructure.md:799 |
| **Step 3: Remove the catalog pane wrapper but keep its content** | docs/superpowers/plans/2026-04-12-ui-restructure.md:810 |
| **Step 4: Find the Listings page header actions area** | docs/superpowers/plans/2026-04-12-ui-restructure.md:823 |
| **Step 5: Add the Import dropdown button** | docs/superpowers/plans/2026-04-12-ui-restructure.md:827 |
| **Step 6: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:847 |
| **Step 1: Find and delete the stats row** | docs/superpowers/plans/2026-04-12-ui-restructure.md:861 |
| **Step 2: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:867 |
| **Step 1: Find the Most Popular badge** | docs/superpowers/plans/2026-04-12-ui-restructure.md:881 |
| **Step 2: Fix the style** | docs/superpowers/plans/2026-04-12-ui-restructure.md:889 |
| **Step 3: Check main.css for .most-popular-badge** | docs/superpowers/plans/2026-04-12-ui-restructure.md:898 |
| **Step 4: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:913 |
| **Step 1: Run the bundle build** | docs/superpowers/plans/2026-04-12-ui-restructure.md:927 |
| **Step 2: Run linter** | docs/superpowers/plans/2026-04-12-ui-restructure.md:935 |
| **Step 3: Commit the regenerated bundle** | docs/superpowers/plans/2026-04-12-ui-restructure.md:943 |
| **Step 4: Smoke-check key pages** | docs/superpowers/plans/2026-04-12-ui-restructure.md:950 |

### Plan: 2026-04-13-sentry-metrics.md

Count: 6

| Item | Source |
|---|---|
| **Step 1: Add timing + success metrics (Edit 1 of 2)** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:36 |
| **Step 2: Syntax check** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:63 |
| **Step 3: Add error metrics (Edit 2 of 2)** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:71 |
| **Step 4: Syntax check** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:92 |
| **Step 5: Commit** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:100 |
| **Step 6: Push and verify in Sentry dashboard** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:113 |

### Plan: 2026-04-13-sentry-tracing.md

Count: 20

| Item | Source |
|---|---|
| **Step 1: Write instrument.js** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:31 |
| **Step 2: Syntax-check the new file** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:60 |
| **Step 3: Commit** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:68 |
| **Step 1: Add the import (Edit 1 of 2)** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:88 |
| **Step 2: Wrap the API handler (Edit 2 of 2)** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:101 |
| **Step 3: Syntax-check server.js** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:130 |
| **Step 4: Commit** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:138 |
| **Step 1: Add import at the top of monitoring.js** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:160 |
| **Step 2: Remove _sentryModule and initSentry() from the monitoring object** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:180 |
| **Step 3: Remove the initSentry() call from init()** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:206 |
| **Step 4: Simplify reportToSentry()** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:218 |
| **Step 5: Syntax-check monitoring.js** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:244 |
| **Step 6: Commit** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:252 |
| **Step 1: Add SENTRY_TRACES_SAMPLE_RATE to .env.example** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:272 |
| **Step 2: Full syntax check** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:289 |
| **Step 3: Start the server and verify it boots** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:297 |
| **Step 4: Verify transactions appear in Sentry dashboard** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:312 |
| **Step 5: Set SENTRY_TRACES_SAMPLE_RATE in Railway** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:325 |
| **Step 6: Commit .env.example** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:334 |
| **Step 7: Push all commits** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:343 |

### Plan: 2026-04-14-anti-detection-hardening.md

Count: 60

| Item | Source |
|---|---|
| **Step 1: Replace the playwright import with stealth infrastructure imports** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:50 |
| **Step 2: Replace chromium.launch() with stealthChromium.launch()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:61 |
| **Step 3: Replace hardcoded newContext() with stealthContextOptions()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:77 |
| **Step 4: Inject chrome.runtime stub and browser API stubs after creating the page** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:92 |
| **Step 5: Replace direct .click() calls with humanClick() for major actions** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:104 |
| **Step 6: Add mouseWiggle() calls between major form steps** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:142 |
| **Step 7: Add CAPTCHA check after navigating to create page and after clicking Publish** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:159 |
| **Step 8: Syntax check** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:177 |
| **Step 9: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:184 |
| **Step 1: Add injectChromeRuntimeStub and injectBrowserApiStubs to the import line** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:217 |
| **Step 2: Change headless default from true to 'new'** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:228 |
| **Step 3: Inject stubs after page creation in init()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:239 |
| **Step 4: Add CAPTCHA check in refreshListing() after navigation** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:247 |
| **Step 5: Add CAPTCHA check in refreshListing() after clicking the save button** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:254 |
| **Step 6: Add CAPTCHA check in relistItem() after navigation** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:261 |
| **Step 7: Add CAPTCHA check in relistItem() after clicking confirm** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:268 |
| **Step 8: Syntax check** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:275 |
| **Step 9: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:282 |
| **Step 1: Add path import (already imported — verify)** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:306 |
| **Step 2: Add SESSION_PATH constant after AUDIT_LOG constant** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:310 |
| **Step 3: Add clearSession() method to FacebookBot class** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:318 |
| **Step 4: Update init() to load session if fresh** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:333 |
| **Step 5: Update login() to skip login if session is loaded and still valid** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:370 |
| **Step 6: Save session after successful login** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:395 |
| **Step 7: Clear session on CAPTCHA detection** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:407 |
| **Step 8: Syntax check** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:416 |
| **Step 9: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:423 |
| **Step 1: Add timezone and locale pools after VIEWPORT_SIZES** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:446 |
| **Step 2: Add --disable-infobars to STEALTH_ARGS** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:461 |
| **Step 3: Update stealthContextOptions() to use random timezone and locale** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:483 |
| **Step 4: Add randomSlowMo() export after randomViewport()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:514 |
| **Step 5: Add injectBrowserApiStubs() export after injectChromeRuntimeStub()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:522 |
| **Step 6: Syntax check** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:603 |
| **Step 7: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:610 |
| **Step 1: Update facebook-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:643 |
| **Step 2: Update poshmark-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:668 |
| **Step 3: Update depop-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:693 |
| **Step 4: Update mercari-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:718 |
| **Step 5: Update grailed-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:743 |
| **Step 6: Update whatnot-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:768 |
| **Step 7: Syntax check all 6 bot files** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:793 |
| **Step 8: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:805 |
| **Step 1: Add daily cap fields to facebook config in rate-limits.js** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:827 |
| **Step 2: Add DAILY_STATS_PATH constant to facebook-bot.js** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:850 |
| **Step 3: Add readDailyStats() and writeDailyStats() helpers** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:857 |
| **Step 4: Increment login counter in login() and enforce maxLoginsPerDay** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:883 |
| **Step 5: Enforce maxListingsPerDay in refreshListing() and relistItem()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:901 |
| **Step 6: Add lockout/checkpoint detection in login()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:935 |
| **Step 7: Syntax check both files** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:952 |
| **Step 8: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:963 |
| **Step 1: Add randomDelay() helper before fillFacebook()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:988 |
| **Step 2: Add inter-field delays throughout fillFacebook()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:997 |
| **Step 3: Replace hardcoded waits in clickDropdownOption() with jittered values** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1031 |
| **Step 4: Syntax check** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1051 |
| **Step 5: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1058 |
| **Step 1: Verify injectBrowserApiStubs is exported from stealth.js** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1085 |
| **Step 2: Verify facebookPublish.js imports and calls injectBrowserApiStubs** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1092 |
| **Step 3: Verify facebook-bot.js imports and calls injectBrowserApiStubs** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1099 |
| **Step 4: Final syntax check — all 4 touched files** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1106 |
| **Step 5: Commit verification result** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1116 |

### Plan: 2026-04-14-facebook-chrome-extension-gaps.md

Count: 6

| Item | Source |
|---|---|
| **Step 1: Add CONDITION_MAP and CATEGORY_MAP constants** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:18 |
| **Step 2: Add helper to click a dropdown option by text** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:52 |
| **Step 3: Replace fillFacebook() with the complete version** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:81 |
| **Step 4: Update fillAndSubmit() to show skipped fields in the overlay** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:192 |
| **Step 5: Syntax check** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:216 |
| **Step 6: Commit** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:221 |

### Plan: 2026-04-14-vault-buddy-sse-streaming.md

Count: 27

| Item | Source |
|---|---|
| **Step 1: Create the test file** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:34 |
| **Step 2: Run to confirm tests fail (function not exported yet)** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:101 |
| **Step 1: Append the generator at the end of grokService.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:117 |
| **Step 2: Run the tests from Task 1 to confirm they now pass** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:259 |
| **Step 3: Commit** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:272 |
| **Step 1: Update the import in chatbot.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:294 |
| **Step 2: Add the body.stream branch in chatbot.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:305 |
| **Step 3: Add isStream passthrough to server.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:377 |
| **Step 4: Add an integration test to chatbot-streaming.test.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:407 |
| **Step 5: Verify the server starts without errors** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:442 |
| **Step 6: Commit** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:453 |
| **Step 1: Add the failing unit tests for api.stream()** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:475 |
| **Step 2: Run the new tests to confirm they pass (they don't depend on the unimplemented method)** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:537 |
| **Step 3: Add stream() method to api.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:545 |
| **Step 4: Commit** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:601 |
| **Step 1: Update renderMessage() to emit data-streaming attribute** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:623 |
| **Step 2: Replace sendMessage() with streaming version** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:639 |
| **Step 3: Commit** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:726 |
| **Step 1: Update renderMessages() in components.js to emit data-streaming** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:750 |
| **Step 2: Replace sendVaultBuddyMessage in handlers-community-help.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:764 |
| **Step 3: Replace sendVaultBuddyMessage in handlers-deferred.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:880 |
| **Step 4: Commit** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:884 |
| **Step 1: Build the bundle** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:904 |
| **Step 2: Run unit tests to confirm nothing broke** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:912 |
| **Step 3: Start the server and smoke-test manually** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:920 |
| **Step 4: Verify non-streaming path still works** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:936 |
| **Step 5: Commit the bundle** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:942 |

### Plan: 2026-04-15-camoufox-migration.md

Count: 28

| Item | Source |
|---|---|
| Verify data/ directory exists at project root | docs/superpowers/plans/2026-04-15-camoufox-migration.md:40 |
| Create worker/bots/browser-profiles.js with the following content: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:46 |
| Syntax-check the new file: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:166 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:174 |
| Add launchCamoufox import and export to stealth.js. All existing exports (stealthChromium, humanClick, mouseWiggle, humanScroll, injectChromeRuntimeStub, injectBrowserApiStubs, randomChromeUA, randomFirefoxUA, randomViewport, randomSlowMo, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, stealthContextOptions) must remain untouched. | docs/superpowers/plans/2026-04-15-camoufox-migration.md:195 |
| Syntax-check stealth.js: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:236 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:244 |
| Add profileCooldown: 3600000 to the facebook config block. The current block ends with sessionCooldown: 300000. Insert after sessionCooldown: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:265 |
| Syntax-check rate-limits.js: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:286 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:294 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:473 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:611 |
| Locate the Facebook section in .env.example: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:633 |
| Add the FACEBOOK_PROXY_URL comment line directly after the last FACEBOOK_* line found. The exact insertion depends on what grep shows — add: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:639 |
| Verify the line was added: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:645 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:653 |
| Run the fingerprint smoke test: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:673 |
| If the smoke test passes, run launchCamoufox via stealth.js: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:693 |
| If both pass, run initProfiles() smoke test: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:712 |
| browser-profiles.js exists and syntax-checks clean | docs/superpowers/plans/2026-04-15-camoufox-migration.md:759 |
| stealth.js exports launchCamoufox and all existing exports remain | docs/superpowers/plans/2026-04-15-camoufox-migration.md:760 |
| rate-limits.js has facebook.profileCooldown: 3600000 | docs/superpowers/plans/2026-04-15-camoufox-migration.md:761 |
| facebook-bot.js uses launchCamoufox + profiles, no references to stealthChromium, SESSION_PATH, injectChromeRuntimeStub, injectBrowserApiStubs | docs/superpowers/plans/2026-04-15-camoufox-migration.md:762 |
| facebookPublish.js uses launchCamoufox + profiles, no references to stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs | docs/superpowers/plans/2026-04-15-camoufox-migration.md:763 |
| .env.example has FACEBOOK_PROXY_URL comment | docs/superpowers/plans/2026-04-15-camoufox-migration.md:764 |
| Smoke test: launchCamoufox() returns Firefox UA | docs/superpowers/plans/2026-04-15-camoufox-migration.md:765 |
| Smoke test: initProfiles() + getNextProfile() create and return valid profile | docs/superpowers/plans/2026-04-15-camoufox-migration.md:766 |
| All 6 commits created with [AUTO] prefix + Verified: trailers | docs/superpowers/plans/2026-04-15-camoufox-migration.md:767 |

### Plan: 2026-04-15-facebook-mock-test-env.md

Count: 34

| Item | Source |
|---|---|
| **Step 1.1: Write a failing test that verifies the server starts and stops** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:33 |
| **Step 1.2: Create the directory** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:118 |
| **Step 1.3: Implement mock-server.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:124 |
| **Step 1.4: Run server tests — core routing tests PASS, page-HTML tests FAIL with 404 (correct)** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:272 |
| **Step 1.5: Commit skeleton** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:277 |
| **Step 2.1: Write failing test — add to mock-server.test.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:297 |
| **Step 2.2: Create login.html** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:320 |
| **Step 2.3: Run tests — login selector test PASS** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:390 |
| **Step 2.4: Commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:395 |
| **Step 3.1: Write failing tests — add to mock-server.test.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:425 |
| **Step 3.2: Create marketplace-create.html** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:478 |
| **Step 3.3: Run tests — all marketplace-create tests PASS** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:736 |
| **Step 3.4: Commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:741 |
| **Step 4.1: Write failing test — add to mock-server.test.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:764 |
| **Step 4.2: Create marketplace-item.html** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:781 |
| **Step 4.3: Run tests — marketplace-item test PASS** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:864 |
| **Step 4.4: Commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:869 |
| **Step 5.1: Write failing test — add to mock-server.test.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:886 |
| **Step 5.2: Create marketplace-selling.html** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:900 |
| **Step 5.3: Run all server tests — all PASS (14+ tests)** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:953 |
| **Step 5.4: Delete temp test file and commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:958 |
| **Step 6.1: Patch facebook-bot.js to accept _baseUrl option** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:976 |
| **Step 6.2: Check Playwright availability** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1029 |
| **Step 6.3: Write facebook-bot.test.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1037 |
| **Step 6.4: Run bot tests** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1180 |
| **Step 6.5: Commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1185 |
| **Step 7.1: Confirm fillFacebook is not exported** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1201 |
| **Step 7.2: Create poster-facebook.spec.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1206 |
| **Step 7.3: Run the spec** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1331 |
| **Step 7.4: Commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1339 |
| **Step 8.1: Lint all new JS files** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1350 |
| **Step 8.2: Run full bot test suite** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1358 |
| **Step 8.3: Run E2E spec** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1380 |
| **Step 8.4: Final commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1388 |

### Plan: 2026-04-15-facebook-safe-fixes.md

Count: 20

| Item | Source |
|---|---|
| **Step 1: Update facebook-bot.js route handlers** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:28 |
| **Step 2: Update facebookPublish.js route handlers** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:48 |
| **Step 3: Replace setContentEditable function** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:76 |
| **Step 4: Replace networkidle at line 119 (login goto)** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:129 |
| **Step 5: Replace networkidle at line 130 (post-login navigation)** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:141 |
| **Step 6: Replace networkidle at line 180 (refreshListing goto)** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:153 |
| **Step 7: Replace networkidle at line 224 (refreshAllListings goto)** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:165 |
| **Step 8: Replace networkidle at line 266 (relistItem goto)** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:177 |
| **Step 9: Replace the Location block in fillFacebook()** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:197 |
| **Step 10: Add RESTART_EVERY_N_LISTINGS constant** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:267 |
| **Step 11: Add restart logic inside refreshAllListings() loop** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:275 |
| **Step 12: Add minAccountAgeDays to rate-limits.js facebook config** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:319 |
| **Step 13: Add FACEBOOK_MIN_ACCOUNT_AGE_DAYS to .env.example** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:353 |
| **Step 14: Extend checkpoint detection in facebook-bot.js** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:372 |
| **Step 15: Extend checkpoint detection in facebookPublish.js** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:407 |
| **Step 16: Add AI pre-population guard after navigating to create page** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:440 |
| **Step 17: Add shm-size env and GTK3/xvfb dependencies** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:470 |
| **Step 18: Update camoufox-js** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:529 |
| **Step 19: Syntax check all modified JavaScript files** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:555 |
| **Step 20: Single commit covering all changes** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:569 |

## Source TODO/FIXME Scan

Command: `rg -n "TODO|FIXME" src public scripts worker design e2e qa data .github archive chrome-extension mobile nginx .agents`

| Source | Text |
|---|---|
| .github/workflows/ci.yml:591 | if grep -rn "password\s*=\s*['\"][^'\"]*['\"]" src/ --include="*.js" \| grep -v "password.*=.*body" \| grep -v "password.*=.*formData" \| grep -v "password.*=.*process.env" \| grep -v "test" \| grep -v "demo" \| grep -v "placeholder" \| grep -v "TODO"; then |
| public/status.html:190 | /* TODO: wire to real uptime data (v2) */ |
| public/status.html:821 | // TODO (v2): wire per-platform status from /api/health/platforms |
| qa/reports/audits/architecture_reliability_audit.md:178 | - **In-memory monitoring metrics lost on restart** — metrics accumulate in RAM only; code has `// TODO: use Redis` comment (Low) |
| qa/reports/browserstack/2026-04-23/performance-notes.md:63 | **TODO (future regression risk):** `renderPastIncidents()` replaces the static "No resolved incidents in the last 90 days." text with a dynamically-built `<ul>` of different height when incidents exist. Currently no incidents → no shift. When the first real incident is posted, this will cause CLS. Fix: give `#past-incidents-list` a `min-height` matching the empty state, or pre-render as a `<ul>` with an empty-state `<li>`. |
| scripts/generate-blog-article.js:126 | - No placeholders or TODOs in the output. |
| scripts/visual-test.js:5263 | console.log(`TODO: ${testFile.name \|\| basename(resolvedPath)}`); |
| scripts/visual-test.js:5691 | console.log(`\nTODO: ${name}`); |
| src/backend/services/platformSync/facebookSync.js:8 | // TODO(signal-emitter): import { trackApiLatency, checkListingInvisibility, checkEngagementDrop } from './signalEmitter.js'; |
| src/backend/services/platformSync/grailedSync.js:8 | // TODO(signal-emitter): import { trackApiLatency, checkListingInvisibility, checkEngagementDrop } from './signalEmitter.js'; |
| src/backend/services/platformSync/mercariSync.js:8 | // TODO(signal-emitter): import { trackApiLatency, checkListingInvisibility, checkEngagementDrop } from './signalEmitter.js'; |
| src/backend/services/platformSync/poshmarkSync.js:8 | // TODO(signal-emitter): import { trackApiLatency, checkListingInvisibility, checkEngagementDrop } from './signalEmitter.js'; |
| src/backend/services/platformSync/whatnotSync.js:8 | // TODO(signal-emitter): import { trackApiLatency, checkListingInvisibility, checkEngagementDrop } from './signalEmitter.js'; |
| src/frontend/core-bundle.js:68 | // TODO(csp-hardening): ADD_ATTR allows inline event handlers so developer-controlled |
| src/frontend/core/utils.js:66 | // TODO(csp-hardening): ADD_ATTR allows inline event handlers so developer-controlled |

## Historical Sources Excluded

These files are evidence only. They are not parsed as canonical open-item sources.

- `docs/WALKTHROUGH_MASTER_FINDINGS.md`
- `docs/MANUAL_INSPECTION.md`
- `docs/OPEN_ISSUE_TRIAGE_2026-04-12.md`
- `docs/archive/CONSOLIDATED_OPEN_ITEMS_2026-04-29.md`
- `docs/archive/**`
- `qa/reports/**`
