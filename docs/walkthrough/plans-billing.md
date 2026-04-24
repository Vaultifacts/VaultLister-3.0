# Plans & Billing — Walkthrough Findings

## Open (Needs Fix)

None — all Plans & Billing findings have been resolved.

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CR-3 | Plans & Billing / Stripe | "Upgrade to Pro" / "Upgrade to Business" buttons will fail — `STRIPE_PRICE_ID_*` not set in Railway | Session 1 | VERIFIED ✅ — 2026-04-22 live `/api/billing/checkout` returned 200 with Stripe Checkout session URL |
| H-8 | Plans & Billing | Pricing shows USD ($19/$49) not CAD — plans page uses US pricing for Canadian launch *(See also: #175 — same issue, discovered independently)* | Session 1 | VERIFIED ✅ f2390bf |
| H-9 | Plans & Billing | "Upgrade to Premium" (top button) vs "Upgrade to Pro" (plan cards) — naming inconsistency *(See also: #176 — same issue, discovered independently)* | Session 1 | VERIFIED ✅ — bc2c9f4 |
| #160 | Plans & Billing | "Upgrade to Pro" crashes immediately: "Cannot read properties of undefined (reading 'get')" — same crash pattern as #150/#151. Core monetization flow broken | Session 8 | VERIFIED ✅ — aca307f — selectPlan('pro') shows success toast, no crash |
| #161 | Plans & Billing | "Upgrade to Business" crashes with same error — core monetization flow broken | Session 8 | VERIFIED ✅ — aca307f — selectPlan('business') shows success toast, no crash |
| M-14 | Plans | "Cross-list to 3 platforms" on Free plan confusing — only 5 available at launch; Pro says "all 9" but 4 are Coming Soon | Session 1 | VERIFIED ✅ — 82a8408 (plans page) + this commit (settings/account page) |
| #175 | Plans & Billing | Shows USD pricing ($19, $49) for Canadian launch. Pro plan claims "Cross-list to all 9 platforms" — only 5 at launch *(See also: H-8 — same issue, discovered independently)* | Session 11 | CONFIRMED N/A — confirmed correct in source (documented 15dba34) |
| #177 | Plans & Billing | "Upgrade to Pro" / "Upgrade to Business" buttons produce no UI response — no toast, no modal, no Stripe redirect | Session 11 | VERIFIED ✅ — selectPlan() shows "Upgrade coming soon! Contact us at hello@vaultlister.com to upgrade." confirmed live (2026-04-07) |

## Extended QA Session Findings (Plans & Billing Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| Clicking "Upgrade to Pro" permanently corrupts page state until hard reload — strips the entire page down to a degraded layout | VERIFIED ✅ — ed6b3f5 — plan buttons use type="button"; showPlanComparison() scrolls to plan cards instead of re-navigating |
| AI Generations and Automations progress bars render as 100% full (width: NaN%) — division-by-zero bug | VERIFIED ✅ — ed6b3f5 — guard: max > 0 ? used/max*100 : 0; NaN% eliminated |
| Free plan card incorrectly highlighted with "Most Popular" ring (wrong card) | VERIFIED ✅ — ed6b3f5 — Pro card always gets ring-2 ring-primary; current plan gets "Your Plan" badge instead |
| Inventory Items usage shows 0 instead of actual count (3 items in account) | VERIFIED ✅ — ed6b3f5 — usage reads store.state.inventory?.length directly |
| Billing period initially shows "Save X%" placeholder text (before any API load) | VERIFIED ✅ — ed6b3f5 — hardcoded "Save 10%" / "Save 20%" in toggle buttons; no placeholder |
| "Upgrade to Pro" header button calls handlers.showPlanComparison() which just navigates to the current page | VERIFIED ✅ — ed6b3f5 — showPlanComparison() now scrolls to #plan-cards instead of re-navigating |
| Billing period toggle does NOT update prices when in corrupted state | VERIFIED ✅ — ed6b3f5 — toggle sets billingPeriod in state + calls renderApp(); prices recompute via getPrice() on each render |
| "Starter" plan price shows "TBD" on initial load before pricing API resolves | VERIFIED ✅ — ed6b3f5 — all prices read synchronously from getPrice(); no TBD placeholder |
| Pro plan card "Basic automations ✓" label conflicts with Plan Comparison table "20 active" | VERIFIED ✅ — ed6b3f5 — Pro card now shows "20 active automations" matching comparison table |
| Pro card floating badge positioned at top: -24px — potentially clipped | VERIFIED ✅ — ed6b3f5 — Pro card container gets padding-top: 32px so badge clears viewport |
| All 4 plan upgrade buttons use type="submit" instead of type="button" | VERIFIED ✅ — ed6b3f5 — all plan action buttons changed to type="button" |
| H1 → H3 heading hierarchy skip (no H2 used anywhere on page) | VERIFIED ✅ — ed6b3f5 — section headings promoted to H2; plan tier names remain H3 |
| Usage progress bars have no accessibility attributes | VERIFIED ✅ — ed6b3f5 — role="progressbar" aria-valuenow aria-valuemax aria-label added to all usage bars |
| Sidebar "Upgrade to Pro" CTA link navigates to the current page when already on Plans & Billing | VERIFIED ✅ — ed6b3f5 — CTA hidden when store.state.currentPage === 'plans-billing' |
| Browser tab title does not update — stays "VaultLister" | VERIFIED ✅ — ed6b3f5 — 'plans-billing': 'Plans & Billing' added to PAGE_TITLES in router.js |
