# Listings — Walkthrough Findings

## Open (Needs Fix)

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| MANUAL-listings-1 | Listings | Platform icons in the Platform dropdown menu of the Listings page are not displaying the correct icons for the platform. (Should show the same associated icons as it does on the My Shops page) | 2026-04-24 | VERIFIED LIVE ✅ 2026-05-01 — platform icons in Listings dropdown confirmed showing correct logos on live site |
| MANUAL-listings-2 | Listings | When I navigate to the listings page, the following errors show up in the top right corner (image-90) | 2026-04-24 | VERIFIED LIVE ✅ 2026-05-01 — no error toasts on Listings page load confirmed on live site |
| H-26 | Listings | Platform dropdown only shows 6 of 9 platforms — missing Etsy, Shopify, Whatnot | Session 3 | VERIFIED ✅ — eb9e086 |
| H-27 | Listings | "Add New Listing(s)" primary CTA dropdown button has NO onclick handler | Session 3 | VERIFIED ✅ f2390bf |
| #126 | Cross-list Modal | Cross-list modal shows Etsy/Mercari/Grailed as active — for Canada launch only eBay, Poshmark, Facebook, Depop, Whatnot should be active | Session 5 | VERIFIED ✅ — e097efa |
| #127 | Cross-list Modal | "Ebay" brand name misspelled — should be "eBay" | Session 5 | VERIFIED ✅ — 15dba34 — eBay capitalization corrected |
| L-25 | Listings | "Customize" columns button has no onclick handler | Session 3 | CONFIRMED N/A — button is a functional dropdown with column checkboxes calling handlers.toggleListingColumn |
| L-26 | Listings | Announcement banner "✕" close button has no onclick handler | Session 3 | VERIFIED ✅ — 0c852be — index.html: added onclick="document.getElementById('announcement-banner').hidden=true" |
| #155 | Listings / Fee Calculator | Platform Fee Calculator shows wrong platforms — includes Mercari/Etsy (not at launch), missing Whatnot (IS at launch) | Session 7 | VERIFIED ✅ — 15dba34 — handlers-deferred.js: removed Mercari/Etsy, added Whatnot; C$ currency |
| #164 | Listings / Fee Calculator | Platform Fee Calculator uses "$" not "C$", includes Etsy fees (not a launch platform) | Session 10 | VERIFIED ✅ — 15dba34 — same fix as #155 |
| #198 | Listings | Breadcrumb shows "Home > My Listings" — should display "Dashboard > Listings" to match actual page names | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #200 | Listings | Adding a folder creates two folders — duplication bug on every folder create action | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #202 | Listings | UI is broken/messed up on the Add New Listings dropdown menu | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #204 | Listings | Nothing happens when Advanced Crosslist option is chosen — feature is entirely non-functional | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #199 | Listings | Listing Health Score displays a value with no listings analyzed — should show empty state message. Additionally: Good should be colour-coded yellow, Needs Work should be colour-coded red | 2026-04-08 | VERIFIED ✅ — 1fcf99a + 130bb77 (tier label added) |
| #201 | Listings | Remove the Fee Breakdown section entirely — instead integrate all fee details directly onto each platform listing card | 2026-04-08 | VERIFIED ✅ — 05f419d |
| #203 | Listings | Listing URL field on the "Import from Marketplace" popup modal is very small and does not clearly indicate it is an input field | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #205 | Listings | "Customize" button is not proportional to the other dropdown menu buttons | 2026-04-08 | VERIFIED ✅ — 1fcf99a |

## Extended QA Session Findings (Listings Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| Advanced Cross List — Clicking "Advanced Cross List" card immediately closes modal without opening any form or interface. | VERIFIED ✅ — 7a32167 — replaced with "coming soon" toast; parent modal stays open |
| Sub-modal "Cancel" / "Apply to Form" Closes Parent Form Too — systematic cascading modal closure bug affecting all sub-modals within the "Add New Item" form. | VERIFIED ✅ — 7a32167 — sub-modal Cancel restores parent via modals.addItem(); cascading closure fixed |
| Fee Breakdown Section is Completely Static — does not update when Sale Price is changed, and does not update when a different platform card is clicked. | VERIFIED ✅ — 7a32167 — fee breakdown now updates dynamically with platform selection and price changes |
| Duplicate Folders in All Folder Dropdowns — "Nintendo" and "Remotes" each shown twice with different UUIDs. | VERIFIED ✅ — 7a32167 — folder options deduped by id before rendering |
| Header Action Buttons Disappear on Sub-tabs — switching to "Archived" sub-tab loses all four header action buttons. | VERIFIED ✅ — 7a32167 — Health/Fees buttons added to all sub-tab headers unconditionally |
| New Folder — Empty Name Accepted Silently | VERIFIED ✅ — 7a32167 — empty name triggers toast.error and returns early |
| Fetch Listing Data — No Validation Error on empty URL | VERIFIED ✅ — 7a32167 — empty URL shows toast.error before fetch |
| Empty Form Submission — Silent/Unclear Validation | VERIFIED ✅ — 7a32167 — empty title adds input-error class + toast.error('Title is required') |
| Import From Marketplace Modal — No Close (X) Button | VERIFIED ✅ — 7a32167 — X close button added to modal header |
| Barcode Scanner "Apply to Form" — Closes Parent Form | VERIFIED ✅ — 7a32167 — fixed with cascading close fix; Apply to Form restores parent modal |
| Filter Bar Temporarily Disappears After Barcode Scanner Interaction | VERIFIED ✅ — 7a32167 — resolved by cascading modal fix |
| Double Breadcrumb — Two separate breadcrumb systems appear simultaneously | VERIFIED ✅ — 7a32167 — page-level breadcrumb removed; app shell handles single breadcrumb |
| "Sell" Breadcrumb Link is Dead | VERIFIED ✅ — 7a32167 — breadcrumb "Sell" made clickable via router.navigate('inventory') |
| Listing Health Widget — Cramped, Tiny Text | VERIFIED ✅ — 7a32167 — health widget min-width increased; text shortened |
| Fee Calculator — Orphaned "Whatnot" Card — 5 platform cards arranged in 2×2 leaving Whatnot alone | VERIFIED ✅ — 7a32167 — fee calculator cards changed to flex-wrap grid; all 5 display evenly |
| Score Distribution Icon Inconsistency in Listing Health Score modal | VERIFIED ✅ — 7a32167 — all three tiers standardized to check-circle icon |
| Listing Templates Sub-tab — Wrong Subtitle | VERIFIED ✅ — 7a32167 — subtitle changed to "Create and manage reusable listing templates" |
| Recently Deleted Sub-tab — White Gap Bug | VERIFIED ✅ — 7a32167 — window.scrollTo(0,0) added on Recently Deleted render |
| Columns/Customize Panel Cuts Off at Viewport Bottom | VERIFIED ✅ — 7a32167 — panel gets max-height:400px + overflow-y:auto |
| Horizontal Scrollbar on Main Page | VERIFIED ✅ — 7a32167 — table wrapped in overflow-x:auto container; table min-width:800px |
| Import from CSV — Native File Input instead of styled drag-drop | VERIFIED ✅ — 7a32167 — replaced with styled drag-drop zone matching Add New Item uploader |
| "Create New Listing" Modal Opens Directly from Empty-State Button — bypassing dropdown options | VERIFIED ✅ — 7a32167 — empty-state button now shows same Import from Marketplace/CSV options as header |
| Listing Health Stats Are Not Clickable | VERIFIED ✅ — 7a32167 — stat counters get cursor:pointer + onclick to filter listings by status |
| No "Import from Marketplace" Option in Empty-State Modal | VERIFIED ✅ — 7a32167 — fixed with UX 23; import options added to chooseListingMode modal |
| Archived Sub-tab — No Filters | VERIFIED ✅ — 7a32167 — search filter input added to Archived sub-tab |
| #163 | Listings / Health | Listing Health modal shows "Poor Health" score 0 AND "All listings have good health scores!" simultaneously | Session 10 | VERIFIED ✅ — c6d006f — modal shows "Poor Health" score 25 with attention list, no all-good message |
