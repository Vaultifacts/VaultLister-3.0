# Market Intel -- Walkthrough Findings

## Open Items

None -- all Market Intel findings have been resolved or deferred.

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CO-3 | Market Intel | "Updated Just now" -- misleading when no data has been fetched | Session 1 | VERIFIED -- 00e1551 -- shows "no data yet" when marketIntelLastUpdated not set |
| CR-6 | Market Intel | Hardcoded fake demand data removed -- shows empty state / N/A | Session 4 | VERIFIED -- 8247946 |
| L-12 | Market Intel | "Competitor Activity -- Live Activity" with green dot suggesting live feed that does not exist | Session 1 | VERIFIED -- 00e1551 -- "Live" badge changed to "Coming Soon" |
| M-10 | Market Intel | "Your items: 89" hardcoded -- should reflect actual inventory count | Session 1 | VERIFIED -- 01384e8 -- reads store.state.inventoryItems.length |
| Analytics-4 | Market Intel / Heatmaps | Platform Engagement shows hardcoded multi-platform data for account with 0 connected shops | Extended QA | PRE-EXISTING -- requires real platform connections; deferred to post-launch |
| Analytics-5 | Market Intel | Market Opportunity shows 0% with High potential indicator -- contradictory | Extended QA | VERIFIED -- 4a20226 -- shows No data yet label when opportunity is 0 |
