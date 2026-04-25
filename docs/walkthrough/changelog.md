# Changelog — Walkthrough Findings

## Open (Needs Fix)

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| MANUAL-cl-1 | Changelog | Vaultlister logo is missing on this page. Also please add a legend for the Changelog. The legend should be interactive to filter for specific things (image-23) | Backlog | PARTIAL ✅ — Legend added with 5 colored badges (feature/improvement/fix/breaking/security) at pages-community-help.js line 1942. Logo NOT implemented. |

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CR-13 | Changelog | All version dates are wrong — v1.6.0 "Jan 26", v1.0.0 "Nov 30" — product didn't exist then. Fabricated changelog | Session 2 | VERIFIED ✅ — 07338ae |
| H-21 | Changelog | All version dates fabricated — v1.6.0 "Jan 26", v1.0.0 "Nov 30" | Session 3 | VERIFIED ✅ — 07338ae |

## Extended QA Session Findings (Changelog Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| Subscribe modal form submission destroys the app (page goes blank) — form has method="get"; event.preventDefault() doesn't prevent navigation | VERIFIED ✅ — ee1767a — form method="post"; subscribe button type="button" with onclick |
| Native browser scrolling destroys the app (page goes blank) — overflow-x: clip CSS rule | VERIFIED ✅ — 4a20226 — overflow-x: clip changed to overflow-x: hidden; scroll no longer destroys the page |
| "Latest" badge appears on ALL versions when that version is selected as a filter | VERIFIED ✅ — e68a2eb — badge now checks version.version === versions[0].version instead of vIdx===0 |
| RSS Feed modal has no close button (×) and no ESC key support | VERIFIED ✅ — ee1767a — × close button added to RSS modal header; type="button" + aria-label |
| Filter tab counts do not update when search is active | VERIFIED ✅ — ee1767a — counts derived from filteredVersions when searchQuery active |
| Changelog entry expand/collapse only works via JS .click() on parent container — chevron button misroutes clicks | VERIFIED ✅ — ee1767a — chevron gets onclick delegating to this.closest('.change-item') |
| "Stay Updated" inline email form has no label for the email input | VERIFIED ✅ — ee1767a — sr-only label added with for="changelog-subscribe-email" |
| RSS Feed modal "Feed URL" label is incorrect blue color and has no for attribute | VERIFIED ✅ — ee1767a — color removed; for="rss-feed-url" added to label and id to input |
| "Versions" sidebar heading is H4 — incorrect heading hierarchy (H1 → H4 skip) | VERIFIED ✅ — ee1767a — H4→H2 |
| Browser tab title does not update to reflect the Changelog page | VERIFIED ✅ — ee1767a — 'changelog': 'Changelog' added to PAGE_TITLES |
| Changelog entry change-item containers are not keyboard accessible | VERIFIED ✅ — ee1767a — role="button" tabindex="0" aria-expanded + onkeydown added |
| All modal buttons throughout Changelog use type="submit" instead of type="button" | VERIFIED ✅ — ee1767a — RSS Copy and Subscribe close buttons changed to type="button" |
| FIXED — Please add a search bar above the button filters on the changelog page, and also please display the Version information and exact date of each change, on the left side of the Dot next to each associated batch of changes (image-72) | FIXED — local changelog source already matches; live/manual recheck pending |
