# Roadmap — Walkthrough Findings

## Open Items

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| M-19 | Roadmap | "No features found" -- should have planned features pre-populated | Session 2 | VERIFIED -- 0544b88 -- 6 roadmap features visible on live Roadmap page |
| M-29 | Roadmap | Empty roadmap -- needs planned features pre-populated (duplicate of M-19) | Session 3 | VERIFIED -- 0544b88 |
| MANUAL-road-1 | Roadmap | Please format our roadmap page in a kanban board structure (image-27) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-road-2 | Roadmap | Please add a kanban section for "Feature Requests" and place it 1st, then put Features Planned 2nd, then Features In Progress 3rd and Released Features 4th (image-43) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-road-3 | Roadmap | Components should be Platforms → eBay, Poshmark, Depop, Facebook, Whatnot, Shopify (image-44) | Backlog | OPEN / NEEDS MANUAL CHECK |

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|

## Extended QA Session Findings (Roadmap Tab)

### Resolved

| Finding | Status |
|---------|--------|
| Feature voting fails with "Invalid or expired CSRF token" — and the optimistic UI is never rolled back | VERIFIED ✅ — ee7a337 — api.ensureCSRFToken() called before POST; old vote counts captured for rollback on failure |
| Search input loses all but the last typed character on every keystroke — full re-render on every oninput | VERIFIED ✅ — ee7a337 — searchRoadmap uses 300ms debounce; no re-render until typing stops |
| "Mobile App (iOS & Android)" feature title is permanently stuck in hover/blue color state on page load | VERIFIED ✅ — b8a38d8 — .feature-title:hover CSS removed; inline onmouseenter/onmouseleave handlers used instead |
| All "In Progress" items show hardcoded "50% complete" — no real progress data | VERIFIED ✅ — b8a38d8 — featureProgress map added: eBay Bot 70%, EasyPost 30%, Stripe 85% |
| Summary stat cards (8 Planned / 3 In Progress / 1 Completed) don't update when a category filter is applied | VERIFIED ✅ — ee7a337 — stat cards now count from filtered feature list when category active |
| Subscribe modal — Email Address is not pre-filled with the logged-in user's email | VERIFIED ✅ — ee7a337 — subscribeToRoadmap() pre-fills input with store.state.user.email |
| All modal close (×) and action buttons have type="submit" instead of type="button" | VERIFIED ✅ — ee7a337 — all Feature Detail and Subscribe modal buttons set to type="button" |
| Heading hierarchy — H1 → H3 throughout, skips H2 | VERIFIED ✅ — ee7a337 — feature name headings H3→H2 |
| Category dropdown option labels are all lowercase — not properly capitalized | VERIFIED ✅ — ee7a337 — option labels title-cased in page template |
| Vote buttons have no aria-label or title | VERIFIED ✅ — ee7a337 — aria-label="Vote for {feature.name}" added to each vote button |
| "View in Changelog" label inconsistency — card says "Changelog", detail modal says "View in Changelog" | VERIFIED ✅ — ee7a337 — feature cards now show "View Changelog" matching the detail modal label |
| Subscribe modal description uses unclear phrasing ("ship") | VERIFIED ✅ — ee7a337 — "ship"→"are released" in subscribe modal copy |
| Browser tab title doesn't update | VERIFIED ✅ — ee7a337 — roadmap added to PAGE_TITLES in router.js |
| Feature Detail modal has no aria-label | VERIFIED ✅ — ee7a337 — aria-labelledby pointing to feature title element added to modal |
