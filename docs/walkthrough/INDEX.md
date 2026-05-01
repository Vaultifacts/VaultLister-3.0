# Walkthrough Findings — Index

Reorganized from `docs/WALKTHROUGH_MASTER_FINDINGS.md` (14 sessions, 185+ findings).
Each area file has an **Open (Needs Fix)** section at the top and a **Completed & Verified** section below.

---

## Top Open Items (Launch Blockers)

| ID | Area | Issue | Status |
|----|------|-------|--------|
| CR-10 | [Connections](connections.md) | OAuth flows for Poshmark/Depop/Grailed/Whatnot not live-verified (credentials now in Railway — need end-to-end OAuth test); Whatnot/Facebook/Mercari still bot-credential-only | OPEN / NOT VERIFIED |
| env-open | [Environment](environment.md) | `EASYPOST_API_KEY` not in Railway (production shipping verification blocked) — local EasyPost routing fixed 2026-04-30; all other production vars confirmed set 2026-04-26; M-33 email delivery ✅ verified 2026-04-29 | OPEN |

---

## Area Files

| File | App Area | Open (Needs Fix) | Completed & Verified |
|------|----------|-----------------|---------------------|
| [affiliate.md](affiliate.md) | Affiliate Program | 0 | 5 |
| [analytics.md](analytics.md) | Analytics | 0 | 27 |
| [auth.md](auth.md) | Auth / Login / Register | 0 | 11 |
| [automations.md](automations.md) | Automations | 0 | 13 |
| [batch-photo.md](batch-photo.md) | Batch Photo / Photo Tools | 0 | 4 |
| [calendar.md](calendar.md) | Calendar | 0 | 21 |
| [changelog.md](changelog.md) | Changelog | 0 | 16 |
| [community.md](community.md) | Community | 0 | 13 |
| [connections.md](connections.md) | Connections / Platform OAuth | **1** | 7 |
| [dashboard.md](dashboard.md) | Dashboard | 0 | 36 |
| [financials.md](financials.md) | Financials | 0 | 19 |
| [help.md](help.md) | Help | 0 | 29 |
| [image-bank.md](image-bank.md) | Image Bank | 0 | 15 |
| [import.md](import.md) | Import | 0 | 12 |
| [inventory.md](inventory.md) | Inventory | 0 | 30 |
| [listings.md](listings.md) | Listings | 0 | 44 |
| [market-intel.md](market-intel.md) | Market Intel | 0 | 6 |
| [my-shops.md](my-shops.md) | My Shops | **1** | 20 |
| [orders-sales.md](orders-sales.md) | Orders, Sales & Offers | 0 | 43 |
| [planner.md](planner.md) | Planner (Daily Checklist) | 0 | 29 |
| [plans-billing.md](plans-billing.md) | Plans & Billing | 0 | 23 |
| [predictions.md](predictions.md) | Predictions | 0 | 5 |
| [privacy.md](privacy.md) | Privacy Policy (In-App) | 0 | 6 |
| [receipts.md](receipts.md) | Receipts | 0 | 13 |
| [refer-a-friend.md](refer-a-friend.md) | Refer a Friend | 0 | 4 |
| [reports.md](reports.md) | Reports | 0 | 11 |
| [roadmap.md](roadmap.md) | Roadmap | 0 | 19 |
| [settings.md](settings.md) | Settings | 0 | 30 |
| [shipping.md](shipping.md) | Shipping | **1** | 4 |
| [size-charts.md](size-charts.md) | Size Charts | 0 | 4 |
| [transactions.md](transactions.md) | Transactions | 0 | 6 |
| [vault-buddy.md](vault-buddy.md) | Vault Buddy | 0 | 7 |

---

## Cross-Cutting Files

| File | Contents | Open (Needs Fix) | Completed & Verified |
|------|----------|-----------------|---------------------|
| [environment.md](environment.md) | Railway env vars, Sentry setup, infrastructure | **1** | 7 |
| [platform-readiness.md](platform-readiness.md) | Platform Readiness Matrix, per-platform connection status | **1** | 13 |
| [public-site.md](public-site.md) | Landing page, public pages, public nav, blog, compare pages | **2** | 66 |
| [source-code-audit.md](source-code-audit.md) | Static source code audit (CA-*, U-* undocumented fixes) | **1** | 49 |

---

## Counting Convention (DO NOT CHANGE)

**Completed counts are canonical. Do not recalculate from scripts using different conventions.**

- `public-site.md`: counts **both** `## Completed & Verified` (45 items) AND `## Completed & Verified (Local Patches...)` (21 items) = **66 total**
- `source-code-audit.md`: counts all 49 completed items (CA-*, U-*, Session-Based Findings) = **49 total**
- `predictions.md`: heading is `## Completed & Verified / Deferred` (not standard heading) — 5 items all completed
- `my-shops.md`: counts **both** `## Completed & Verified` (11 items) AND `### Completed & Verified` under `## Extended QA Session Findings` (9 items) = **20 total**
- `environment.md`: `## Sentry Setup — Deferred (Post-Launch Infrastructure)` section is **NOT counted** in the open total — 6 Sentry dashboard config tasks, not launch blockers
- All other files: count items in `## Completed & Verified` **plus** any `### Completed & Verified` under `## Extended QA Session Findings` (most area files have both sections)

---

## Summary Totals

| Category | Open (Needs Fix) | Completed & Verified |
|----------|-----------------|---------------------|
| App area files (32 files) | 3 | 532 |
| Cross-cutting files (4 files) | 5 | 135 |
| **Total** | **8** | **667** |
