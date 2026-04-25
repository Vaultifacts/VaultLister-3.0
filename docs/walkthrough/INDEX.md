# Walkthrough Findings — Index

Reorganized from `docs/WALKTHROUGH_MASTER_FINDINGS.md` (14 sessions, 185+ findings).
Each area file has an **Open (Needs Fix)** section at the top and a **Completed & Verified** section below.

---

## Top Open Items (Launch Blockers)

| ID | Area | Issue | Status |
|----|------|-------|--------|
| CR-10 | [Connections](connections.md) | OAuth credentials for 9 platforms not configured -- blocks all live platform connections | OPEN / NOT VERIFIED |
| MANUAL-conn-1 | [Connections](connections.md) | VaultLister logo missing in top right corner; platform integration cards broken; Depop/Facebook should be OAuth 2.0 | OPEN / NEEDS MANUAL CHECK |
| MANUAL-pub-20 | [Public Site](public-site.md) | Affiliate Program, Documentation, Roadmap, Blog, FAQs, Help Center, AI Info buttons bring user to sign-in page instead of the appropriate page | OPEN / NEEDS MANUAL CHECK |
| MANUAL-pub-39 | [Public Site](public-site.md) | Many sitemap URIs do not route correctly -- e.g. /#login brings to landing page; correct URI is /?app=1#login | OPEN / NEEDS MANUAL CHECK |
| MANUAL-pub-40 | [Public Site](public-site.md) | When navigating to the listings page, errors show in the top right corner (image-90) | OPEN / NEEDS MANUAL CHECK |
| env-open | [Environment](environment.md) | Railway env vars, Sentry setup items, and other infrastructure items -- see environment.md for full list | OPEN / NOT VERIFIED |

---

## Area Files

| File | App Area | Open (Needs Fix) | Completed & Verified |
|------|----------|-----------------|---------------------|
| [affiliate.md](affiliate.md) | Affiliate Program | **2** | 3 |
| [analytics.md](analytics.md) | Analytics | **3** | 9 |
| [auth.md](auth.md) | Auth / Login / Register | **1** | 4 |
| [automations.md](automations.md) | Automations | **2** | 11 |
| [batch-photo.md](batch-photo.md) | Batch Photo / Photo Tools | **1** | 2 |
| [calendar.md](calendar.md) | Calendar | **1** | 7 |
| [changelog.md](changelog.md) | Changelog | **1** | 2 |
| [community.md](community.md) | Community | 0 | 2 |
| [connections.md](connections.md) | Connections / Platform OAuth | **4** | 2 |
| [dashboard.md](dashboard.md) | Dashboard | **1** | 12 |
| [financials.md](financials.md) | Financials | **2** | 9 |
| [help.md](help.md) | Help | 0 | 12 |
| [image-bank.md](image-bank.md) | Image Bank | 0 | 1 |
| [import.md](import.md) | Import | 0 | 0 |
| [inventory.md](inventory.md) | Inventory | 0 | 19 |
| [listings.md](listings.md) | Listings | **2** | 16 |
| [market-intel.md](market-intel.md) | Market Intel | 0 | 6 |
| [my-shops.md](my-shops.md) | My Shops | **3** | 8 |
| [orders-sales.md](orders-sales.md) | Orders, Sales & Offers | 0 | 13 |
| [planner.md](planner.md) | Planner (Daily Checklist) | **2** | 6 |
| [plans-billing.md](plans-billing.md) | Plans & Billing | 0 | 8 |
| [predictions.md](predictions.md) | Predictions | 0 | 5 |
| [privacy.md](privacy.md) | Privacy Policy (In-App) | 0 | 6 |
| [receipts.md](receipts.md) | Receipts | 0 | 0 |
| [refer-a-friend.md](refer-a-friend.md) | Refer a Friend | 0 | 4 |
| [reports.md](reports.md) | Reports | **1** | 0 |
| [roadmap.md](roadmap.md) | Roadmap | **3** | 0 |
| [settings.md](settings.md) | Settings | **1** | 28 |
| [shipping.md](shipping.md) | Shipping | **2** | 3 |
| [size-charts.md](size-charts.md) | Size Charts | 0 | 4 |
| [transactions.md](transactions.md) | Transactions | 0 | 6 |
| [vault-buddy.md](vault-buddy.md) | Vault Buddy | **1** | 6 |

---

## Cross-Cutting Files

| File | Contents | Open (Needs Fix) | Completed & Verified |
|------|----------|-----------------|---------------------|
| [environment.md](environment.md) | Railway env vars, Sentry setup, infrastructure | **2** | 5 |
| [platform-readiness.md](platform-readiness.md) | Platform Readiness Matrix, per-platform connection status | **1** | 13 |
| [public-site.md](public-site.md) | Landing page, public pages, public nav, blog, compare pages | **39** | 5 |
| [source-code-audit.md](source-code-audit.md) | Static source code audit (CA-*, U-* undocumented fixes) | 0 | 0 |

---

## Summary Totals

| Category | Open (Needs Fix) | Completed & Verified |
|----------|-----------------|---------------------|
| App area files (32 files) | 60 | 191 |
| Cross-cutting files (4 files) | 43 | 23 |
| **Total** | **75** | **237** |
