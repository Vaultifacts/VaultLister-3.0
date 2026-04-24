# Size Charts -- Walkthrough Findings

## Open (Needs Fix)

None.

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| M-24 | Size Charts | Measurements in inches (in) -- should offer metric (cm) for Canada | Session 2 | CONFIRMED N/A -- duplicate of shipping fix already applied in #149/23a4729; metric units confirmed in handlers-sales-orders.js |
| L-17 | Size Charts | "us US" in dropdown -- double "US" label | Session 2 | VERIFIED -- DOM inspection confirms options show flag + "United States" (flag renders as "us" in JPEG screenshots -- confirmed working 2026-04-07) |
| L-20 | Size Charts | "us US" dropdown label -- double "US" (duplicate of L-17) | Session 3 | VERIFIED -- same fix as L-17, confirmed 2026-04-07 |
| L-21 | Size Charts | Measurements in inches -- should offer cm for Canada (duplicate of M-24) | Session 3 | CONFIRMED N/A -- duplicate of M-24 |
