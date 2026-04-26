# Shipping -- Walkthrough Findings

## Open (Needs Fix)

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CR-4 | Shipping / EasyPost | EasyPost not configured -- live GET /api/shipping-labels-mgmt/easypost/track/TEST123456789 returns 503 {"error":"EasyPost not configured"} | Session 1 | OPEN / NOT VERIFIED -- verified 2026-04-22: still 503 |

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| MANUAL-ship-1 | Shipping | Migrate Shipping Profiles from settings tools tab to the Shipping tab of the Offers, Orders, & Shipping Page | Backlog | VERIFIED ✅ — pages-sales-orders.js:1794 now renders window.pages.shippingProfiles() inline instead of navigating away |
| H-15 | Shipping Labels | "Create Label" and "Compare Rates" buttons present but EasyPost not built | Session 2 | VERIFIED -- a0a4901 -- routes built (rates, buy, track in shippingLabels.js) |
| H-23 | Shipping Labels | "Create Label" + "Compare Rates" buttons enabled -- EasyPost not built (duplicate of H-15) | Session 3 | VERIFIED -- a0a4901 -- same fix |
| #149 | Shipping Calculator | Shows USPS carriers with imperial units (lbs/inches) -- should show Canada Post/Purolator with kg/cm and CAD | Session 6 | VERIFIED -- 23a4729 |
