# Analytics — Walkthrough Findings

## Open (Needs Fix)

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| MANUAL-analytics-1 | Analytics | Please remove all of this from the analytics page (image-60) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-analytics-2 | Analytics | Please Remove the following tabs from the Analytics page — Live, Performance, Reports, Profitability Analysis, Sales, and Purchases. Also Please rename the Sourcing tab to "Supplier Analytics" (image-103) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-analytics-3 | Analytics | Add a horizontal scroll bar to allow user to scroll through Analytic tabs extending past visibility | Backlog | OPEN / NEEDS MANUAL CHECK |

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CR-9 | Analytics | Sales Funnel "Views 50" is hardcoded fake data | Session 1 | VERIFIED ✅ — 01384e8 — reads real analyticsData.stats |
| M-2 | Analytics | Market Trends Radar labels truncated — "intage" (Vintage), "Electron" (Electronics) | Session 1 | VERIFIED ✅ — DOM confirms labels: Fashion/Tech/Home/Sports/Vintage — "Electronics" replaced with "Tech" (2026-04-07) |
| M-4 | Analytics | Financial score "30" with no data — should be 0 or N/A | Session 1 | VERIFIED ✅ — e9e689f — pages-sales-orders.js push(10) fallbacks → push(0); profitMargin >= 0 → > 0 |
| M-5 | Analytics | "Consider optimizing costs" advice shown with no data — irrelevant for empty-state users | Session 1 | VERIFIED ✅ — efe7ab1 — advice gated on hasData |
| M-6 | Analytics | "Profit margin below target (15%)" warning shown with no sales data | Session 1 | VERIFIED ✅ — efe7ab1 — margin warning gated on sales data |
| CO-2 | Analytics | Financial score 30 color (red) — arbitrary default looks alarming | Session 1 | CONFIRMED N/A — M-4 fix sets empty-state score to 0; "needs-attention" for 0 is correct |
| #223 | Analytics | Load time when navigating to Analytics from the sidebar is extremely delayed and glitchy | 2026-04-08 | VERIFIED ✅ — 05f419d |
| #224 | Analytics | "More" dropdown menu UI is broken/misaligned | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #225 | Analytics | Cards have no collapse options and no ability to manually resize, unlike the Dashboard page | 2026-04-08 | VERIFIED ✅ — 1fcf99a |

## Extended QA Session Findings (Analytics Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| Compare Mode Shows Hardcoded Fake Data — Revenue Change: +8.7%, Sales Volume Change: +6, Avg Order Value Change: +C$4.00, Profit Margin Change: +5.1% — all impossible on zero-activity account | VERIFIED ✅ — 4a20226 — compare panel guards against missing previousPeriod data; shows "No prior-period data" instead of fake percentages |
| Live Graphs Stat Cards Show Fake Trend Percentages — Total Revenue (C$0.00) shows ↑ 15% vs last week, Profit Margin (0%) shows ↑ 5%, Sell-Through (0%) shows ↑ 12% | VERIFIED ✅ — 4a20226 — trend badges pass null when no prior-period data; badge hidden instead of showing fake % |
| Predictions Tab Displays Hardcoded Sample Data as Real Insights | PRE-EXISTING ✅ — requires real ML/AI pipeline with actual sales data; deferred to post-launch |
| Heatmaps Tab — Platform Engagement Shows Hardcoded Multi-Platform Data for account with 0 connected shops | PRE-EXISTING ✅ — requires real platform connections and engagement data; deferred to post-launch |
| Market Opportunity Shows Contradictory Data — "Market Opportunity: 0% ↑ High potential" | VERIFIED ✅ — 4a20226 — shows "—" with "No data yet" label when opportunity is 0; removes false "High potential" indicator |
| Error Reports Data Inconsistency Between Sections — Performance tab shows 7 Total Errors, Reports tab shows 0 | VERIFIED ✅ — 4a20226 — Performance and Reports tabs now both read from same perfTotalErrors/perfErrorRate source |
| Low Contrast Text on Total Revenue Progress Bar | VERIFIED ✅ — 4a20226 — .snapshot-metric.primary .metric-change text color set to white for contrast on blue background |
| Revenue by Platform and Sold Items by Marketplace — Neither Toggle Active | VERIFIED ✅ — 4a20226 — active state logic was correct in source; stale bundle artifact resolved by rebuild |
| Seasonal Trends Modal — "Slowest Month" is the Current Partial Month | VERIFIED ✅ — 4a20226 — current partial month excluded from best/worst calculation; shows N/A when no complete months |
| Sales Velocity & Weekly Performance Modals — Asymmetric Grid Layout (2×2 with empty cell) | VERIFIED ✅ — 4a20226 — .velocity-summary and .report-metrics-grid changed to repeat(3,1fr) |
| Ratio Analysis — "N/A%" Formatting | VERIFIED ✅ — 4a20226 — N/A ratio values display without % suffix; badge shows "No data" instead of broken threshold comparison |
| Weekly Report "Best Day: Sun" With Zero Data | VERIFIED ✅ — 4a20226 — Best Day shows "N/A" when all days have zero revenue |
| Customer Insights Modal — "Repeat Buyers" Card Inconsistent Styling | VERIFIED ✅ — 4a20226 — highlight class removed from Repeat Buyers card; all 4 stat cards now consistent |
| Page Scrolling Is Broken — overflow-x: clip CSS rule unintentionally disables browser's native vertical scroll | VERIFIED ✅ — 4a20226 — overflow-x:clip changed to overflow-x:hidden on 4 selectors in main.css; vertical scroll restored |
| "Performance insights for last 30 days" Subtitle Appears as Hyperlink | VERIFIED ✅ — 4a20226 — color was stale bundle artifact; resolved by rebuild |
