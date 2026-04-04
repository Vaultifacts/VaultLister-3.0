# QA Walkthrough — Final Session Plan
Generated: 2026-03-30 (Step 0)
Total items: 498 across 40 sections

## Route Coverage Status
- All routes confirmed covered by existing Notion sections
- No new Notion items needed
- Notable routes verified: report-builder (Financials), size-charts (Tools), feedback-suggestions/analytics (Community)

## Session Map (25 sessions, ~20 items each)

| Session | Focus | Notion Sections | Est. Items |
|---------|-------|-----------------|------------|
| 1 | Auth & Session | S1: Auth & Session | 18 |
| 2 | Dashboard Part 1 | S3: Dashboard (items 1-20) | 20 |
| 3 | Dashboard Part 2 + Nav Part 1 | S3: Dashboard (items 21-32), S2: Navigation (1-8) | 20 |
| 4 | Navigation Part 2 + SPA Shell + Backend Error | S2: Navigation (9-16), S39: SPA Shell, S38: Backend Error UI | 19 |
| 5 | Inventory Part 1 | S4: Inventory (items 1-20) | 20 |
| 6 | Inventory Part 2 + Listings | S4: Inventory (21-24), S5: Listings | 22 |
| 7 | Automations | S6: Automations, S32: Automation Config | 21 |
| 8 | Sales & Orders Part 1 | S7: Sales & Orders (items 1-20) | 20 |
| 9 | Sales Part 2 + Offers + Financials Part 1 | S7: Sales (21-22), S27: Offer Decline, S29: Order Modals, S8: Financials (1-9) | 20 |
| 10 | Financials Part 2 + Exports | S8: Financials (10-20), S17: Exports & Imports | 19 |
| 11 | Analytics Part 1 | S9: Analytics & Intelligence (items 1-20) | 20 |
| 12 | Analytics Part 2 + Tools Part 1 | S9: Analytics (21-24), S10: Tools (1-16) | 20 |
| 13 | Tools Part 2 + Additional Tools | S10: Tools (17-22), S11: Additional Tools, S30: Checklist CRUD, S31: Marketplace Import | 20 |
| 14 | Settings Part 1 | S12: Settings (items 1-20) | 20 |
| 15 | Settings Part 2 + Community Part 1 | S12: Settings (21-25), S13: Community & Help (1-15) | 20 |
| 16 | Community Part 2 + AI Features + Public Pages | S13: Community (16-18), S14: AI Features, S34: Public Pages | 18 |
| 17 | Chrome Extension + SW/Push + Final Audit | S37: Chrome Extension, S35: SW & Push, S36: Final Audit | 22 |
| 18 | Handler Modals Part 1 | S24: Handler Modals (items 1-20) | 20 |
| 19 | Handler Modals Part 2 + Modals Part 1 | S24: Handler Modals (21-35), S15: Modals (1-5) | 20 |
| 20 | Modals Part 2 + Specialty Widgets | S15: Modals (6-12), S23: Specialty Widgets | 19 |
| 21 | Component + Widget Interactions | S25: Component Interactions, S26: Widget Interactions | 22 |
| 22 | Utility Widgets + Supplier Modals + Discovered | S33: Utility Widgets, S28: Supplier Modals, S40: Discovered Items | 22 |
| 23 | Keyboard + Accessibility | S16: Keyboard Shortcuts, S20: Accessibility | 20 |
| 24 | Performance + Cross-Cutting Quality | S21: Performance & PWA, S22: Cross-Cutting Quality | 20 |
| 25 | Drag & Drop + Mobile + Final Sweep | S18: Drag & Drop, S19: Mobile & Responsive | 16 |

## Pre-Skip (mark Skipped before testing)
- S37 Chrome Extension (15 items) — needs extension installed
- Marketplace OAuth items (eBay, Etsy, Poshmark, Mercari, Shopify connect) — in S5/S13
- Stripe/Payments items — in S14/S15
- Camera/Scanner items — wherever they appear
- Multi-user/Teams items — in S14

## AI Features (S14)
- Verify ANTHROPIC_API_KEY on live site before Session 16
- If not set: mark all 10 AI items as Skipped

## Section Quick Reference
| # | Section Name | Items |
|---|-------------|-------|
| 1 | Auth & Session | 18 |
| 2 | Navigation & Layout | 16 |
| 3 | Dashboard | 32 |
| 4 | Inventory | 24 |
| 5 | Listings | 18 |
| 6 | Automations | 16 |
| 7 | Sales & Orders | 22 |
| 8 | Financials | 20 |
| 9 | Analytics & Intelligence | 24 |
| 10 | Tools | 22 |
| 11 | Additional Tools | 8 |
| 12 | Settings | 25 |
| 13 | Community & Help | 18 |
| 14 | AI Features | 10 |
| 15 | Modals & Overlays | 12 |
| 16 | Keyboard Shortcuts | 10 |
| 17 | Exports & Imports | 8 |
| 18 | Drag & Drop | 8 |
| 19 | Mobile & Responsive | 8 |
| 20 | Accessibility | 10 |
| 21 | Performance & PWA | 10 |
| 22 | Cross-Cutting Quality | 10 |
| 23 | Specialty Widgets | 12 |
| 24 | Handler Modals | 35 |
| 25 | Component Interactions | 12 |
| 26 | Widget Interactions | 10 |
| 27 | Offer Decline/Counter | 4 |
| 28 | Supplier Modals | 6 |
| 29 | Order Modals | 5 |
| 30 | Checklist CRUD | 3 |
| 31 | Marketplace Import | 3 |
| 32 | Automation Config | 5 |
| 33 | Utility Widgets | 13 |
| 34 | Public Pages | 5 |
| 35 | SW & Push | 3 |
| 36 | Final Audit | 4 |
| 37 | Chrome Extension | 15 |
| 38 | Backend Error UI | 8 |
| 39 | SPA Shell | 3 |
| 40 | Discovered Items | 3 |
