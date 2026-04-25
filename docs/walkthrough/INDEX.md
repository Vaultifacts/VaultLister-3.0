# Walkthrough Findings — Index

Reorganized from `docs/WALKTHROUGH_MASTER_FINDINGS.md` (14 sessions, 185+ findings).
Each area file has an **Open (Needs Fix)** section at the top and a **Completed & Verified** section below.

---

## Top Open Items (Launch Blockers)

| ID | Area | Issue | Status |
|----|------|-------|--------|
| CR-10 | [Connections](connections.md) | OAuth credentials for 9 platforms not configured -- blocks all live platform connections | OPEN / NOT VERIFIED |
| MANUAL-conn-1 | [Connections](connections.md) | VaultLister logo missing in top right corner; platform integration cards broken; Depop/Facebook should be OAuth 2.0 | OPEN / NEEDS MANUAL CHECK |
| MANUAL-pub-39 | [Public Site](public-site.md) | Many sitemap URIs do not route correctly -- e.g. /#login brings to landing page; correct URI is /?app=1#login | OPEN / NEEDS MANUAL CHECK |
| env-open | [Environment](environment.md) | Railway env vars, Sentry setup items, and other infrastructure items -- see environment.md for full list | OPEN / NOT VERIFIED |

---

## Area Files

| File | App Area | Open (Needs Fix) | Completed & Verified |
|------|----------|-----------------|---------------------|
| [affiliate.md](affiliate.md) | Affiliate Program | 0 | 5 |
| [analytics.md](analytics.md) | Analytics | 0 | 24 |
| [auth.md](auth.md) | Auth / Login / Register | **1** | 8 |
| [automations.md](automations.md) | Automations | 0 | 4 |
| [batch-photo.md](batch-photo.md) | Batch Photo / Photo Tools | **1** | 2 |
| [calendar.md](calendar.md) | Calendar | **1** | 16 |
| [changelog.md](changelog.md) | Changelog | 0 | 16 |
| [community.md](community.md) | Community | 0 | 11 |
| [connections.md](connections.md) | Connections / Platform OAuth | **2** | 7 |
| [dashboard.md](dashboard.md) | Dashboard | 0 | 35 |
| [financials.md](financials.md) | Financials | 0 | 12 |
| [help.md](help.md) | Help | 0 | 23 |
| [image-bank.md](image-bank.md) | Image Bank | 0 | 15 |
| [import.md](import.md) | Import | 0 | 12 |
| [inventory.md](inventory.md) | Inventory | 0 | 18 |
| [listings.md](listings.md) | Listings | 0 | 31 |
| [market-intel.md](market-intel.md) | Market Intel | 0 | 6 |
| [my-shops.md](my-shops.md) | My Shops | **2** | 12 |
| [orders-sales.md](orders-sales.md) | Orders, Sales & Offers | 0 | 37 |
| [planner.md](planner.md) | Planner (Daily Checklist) | 0 | 23 |
| [plans-billing.md](plans-billing.md) | Plans & Billing | 0 | 19 |
| [predictions.md](predictions.md) | Predictions | 0 | 5 |
| [privacy.md](privacy.md) | Privacy Policy (In-App) | 0 | 4 |
| [receipts.md](receipts.md) | Receipts | 0 | 13 |
| [refer-a-friend.md](refer-a-friend.md) | Refer a Friend | 0 | 4 |
| [reports.md](reports.md) | Reports | **1** | 8 |
| [roadmap.md](roadmap.md) | Roadmap | 0 | 19 |
| [settings.md](settings.md) | Settings | 0 | 29 |
| [shipping.md](shipping.md) | Shipping | **1** | 3 |
| [size-charts.md](size-charts.md) | Size Charts | 0 | 4 |
| [transactions.md](transactions.md) | Transactions | 0 | 4 |
| [vault-buddy.md](vault-buddy.md) | Vault Buddy | 0 | 4 |

---

## Cross-Cutting Files

| File | Contents | Open (Needs Fix) | Completed & Verified |
|------|----------|-----------------|---------------------|
| [environment.md](environment.md) | Railway env vars, Sentry setup, infrastructure | **2** | 5 |
| [platform-readiness.md](platform-readiness.md) | Platform Readiness Matrix, per-platform connection status | **1** | 13 |
| [public-site.md](public-site.md) | Landing page, public pages, public nav, blog, compare pages | **15** | 30 |
| [source-code-audit.md](source-code-audit.md) | Static source code audit (CA-*, U-* undocumented fixes) | 0 | 0 |

---

## Summary Totals

| Category | Open (Needs Fix) | Completed & Verified |
|----------|-----------------|---------------------|
| App area files (32 files) | 9 | 433 |
| Cross-cutting files (4 files) | 18 | 48 |
| **Total** | **27** | **481** |