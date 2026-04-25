# Financials — Walkthrough Findings

## Open (Needs Fix)

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| MANUAL-fin-2 | Status Page / Uptime History | Red bars are showing black lines in them, please fix this. (image-85) | Backlog | VERIFIED ✅ — cc1c8c5b — repeating black hatch gradient removed from outage bars; Playwright confirmed hasBlackRgba=false |
| MANUAL-fin-1 | Financials | Please move the Cash Flow Projection section to its own tab on the Financial page next to the Chart of Accounts Tab (image-101) | Backlog | VERIFIED ✅ — 02e124d3 — "Cash Flow Projection" tab added to financials tab bar; section renders only when that tab is active |
| #167 | Financials | Financials page uses "$" not "C$" for all monetary values | Session 10 | VERIFIED ✅ — 15dba34 — pages-deferred.js: all $ → C$ across financials section |
| #217 | Financials | Health text is displaying behind the Health score number — text is obscured and unreadable | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #219 | Financials | Export dropdown menu UI is broken/misaligned | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #220 | Financials | Revenue, Expenses, Net Profit, and Profit Margin summary cards below the main Financial Overview are duplicate information — remove all four | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #221 | Financials | Chart of Accounts tab is missing "Purchases" and "Sales" tabs on the left side | 2026-04-08 | VERIFIED ✅ — 05f419d |
| #222 | Financials | No collapse options on any cards and no ability to manually resize cards, unlike the Dashboard page | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #218 | Financials | No option to set a custom budget alert threshold | 2026-04-08 | VERIFIED ✅ — 05f419d |
| M-16 | Sales | "Sales Tax Nexus" — US concept, Canada uses GST/HST/PST | Session 2 | VERIFIED ✅ — efe7ab1 — renamed to GST/HST/PST |
| M-30 | Sales | "Sales Tax Nexus" — US concept, Canada uses GST/HST/PST (duplicate of M-16) | Session 3 | VERIFIED ✅ — efe7ab1 — same fix as M-16 |

## Extended QA Session Findings (Financials Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| Budget Progress – Missing Category Labels — all four Budget Progress bars have empty category name labels | VERIFIED ✅ — 682c8b6 — widget reads b.name\|\|b.category; category names now render on all bars |
| Cash Flow Chart – Data Inconsistency with Financial Overview — Net Profit (-$35.99) doesn't match chart's Net value (-$36); Expenses ($35.99) doesn't equal COGS alone ($22) | VERIFIED ✅ — 682c8b6 — waterfallCOGS = totalExpenses-shipping-fees so chart and overview cards share same computed values |
| Tax Estimate Calculator – Currency Mismatch (USD vs CAD) | VERIFIED ✅ — 682c8b6 — all ($) labels changed to (C$) in calculator inputs and output |
| Multi-Currency Converter – Wrong Base Currency — defaults to USD but app operates in CAD | VERIFIED ✅ — 682c8b6 — From selector added defaulting to CAD; rates computed CAD-relative; shows "1 CAD = X USD" |
| Health Score – No Scale Indicator — circular gauge shows "25" with no indication of scale (e.g., "out of 100") | VERIFIED ✅ — 682c8b6 — "/ 100" subscript added below score; .health-score-scale CSS class in main.css |
| Cash Flow Breakdown – Misleading "+" Sign on $0 Values — Revenue, Shipping, and Fees all display "+C$0" in green | VERIFIED ✅ — 682c8b6 — zero waterfall values now render "C$0" with no sign instead of "+C$0" |
| Profit Margin Gauge – Misaligned Indicator Arrow | VERIFIED ✅ — 682c8b6 — SVG needle + pivot added with trigonometric rotation to exact arc position |
| Financial Ratios – All Values Show "Review" Badge — N/A ratio badges with no explanation | VERIFIED ✅ — 682c8b6 — N/A ratio badges now show tooltip "N/A — no sales data recorded yet" |
