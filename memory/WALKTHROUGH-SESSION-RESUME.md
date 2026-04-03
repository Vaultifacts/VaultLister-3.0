# Walkthrough Session Resume — Post-Compact

## Status
Plan APPROVED. Step 0 is NEXT. Nothing has been executed yet.

## Plan File
`C:\Users\Matt1\.claude\plans\vectorized-booping-hare.md`

## What Was Decided This Session
- 3rd pass walkthrough (prior: 2026-03-22 all 498 items, 2026-03-29 route sweep)
- ~25 sessions of ~20 items each (NOT 12 — context math showed 12 was too aggressive)
- Chrome DevTools MCP testing in separate window (NOT user's browser)
- Screenshots saved to `data/walkthrough-screenshots/session-{N}/`
- Dark mode tested on EVERY page (not sampled)
- 6 mandatory per-page checks: JS errors, interactivity, dark mode, mobile 480px, empty state, loading state
- Step 0 first: coverage audit + reset all 498 items to "To Do"

## Step 0 Tasks (execute in this order)
1. Add `sections` command to `scripts/notion-qa-audit.py` — lists unique Section values + counts
2. Add `reset-all` command to `scripts/notion-qa-audit.py` — clears all Result values (with confirmation)
3. Run `sections` command to get actual item distribution
4. Cross-reference sections against 52 routes + 33 sub-tabs + 30+ modals
5. Create any missing Notion items for uncovered routes/tabs
6. Run `reset-all` to reset all 498 items to empty ("To Do")
7. Log in to vaultlister.com as demo@vaultlister.com / DemoPassword123!
8. Verify demo data: call /api/inventory, /api/offers, /api/orders, /api/sales counts
9. Check store.state.user.is_admin for admin page access
10. Check if ANTHROPIC_API_KEY configured (GET /api/health or test AI endpoint)
11. Create `data/walkthrough-screenshots/` with session subdirs 0-24
12. Produce final numbered session list based on actual item counts per group

## Key Technical Facts
- Live site: https://vaultlister.com
- Demo credentials: demo@vaultlister.com / DemoPassword123!
- Testing tool: Chrome DevTools MCP (separate window, already navigated to vaultlister.com)
- Navigation rule: ALWAYS use `/?app=1#route` — never bare `/#route`
- NEVER navigate via `window.location.hash` or `window.router.navigate()` — disconnects extension
- Notion QA DB: 298e00f79d854a0fb97daabdfc199dbf
- notion-qa-audit.py location: scripts/notion-qa-audit.py (334 lines, fully read)
- Current state: 442 Pass, 24 Issue, 32 Skipped (all to be reset in Step 0)
- App has: 52 unique routes, 33 sub-tabs, 30+ modals

## Session Map Groups (A-Y, to be split into numbered sessions by Step 0)
A: Landing + Auth
B: Dashboard + Global Chrome
C: Inventory
D: Listings + Templates
E: Orders + Sales
F: Offers
G: Analytics tabs 1-5
H: Analytics tabs 6-11
I: Financials
J: Automations
K: Shops
L: Planner + Calendar
M: Image Bank + Tools
N: Settings tabs 1-4
O: Settings tabs 5-7 + Account
P: Settings peripherals
Q: Community + Help
R: Help peripherals
S: Feedback + Legal
T: Admin + AI Features
U: Handler Modals 1
V: Handler Modals 2
W: Keyboard + Accessibility
X: Responsive + Offline
Y: Final Sweep

## Pre-Skip Categories (mark Skipped before testing starts)
- Marketplace OAuth (eBay, Etsy, Poshmark, Mercari, Shopify)
- Stripe/Payments
- Email/SMTP delivery
- Camera/Scanner
- Chrome Extension
- Multi-user/Teams
- AI Features (only if ANTHROPIC_API_KEY not set)

## Severity Criteria
- Critical: completely broken, data loss, security hole
- High: major feature broken
- Medium: works but UX confusing
- Low: cosmetic/minor
