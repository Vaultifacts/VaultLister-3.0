# Percy Visual Review — April 24, 2026

## Build Information

| Build | ID | Snapshots | Baseline | Comparison |
|---|---|---|---|---|
| Visual Scanner (Scan run #8) | 49097670 | 23 changed / 20 unchanged | April 24, 2026 06:26 PM UTC | April 24, 2026 10:47 PM UTC |
| Responsive Scanner | 49097668 | 36 new baselines | N/A (first run) | April 24, 2026 |

> **Human approval required before merging.** This document is a classification log. No baselines have been approved or rejected.

---

## Visual Scanner Build 49097670 — Complete Snapshot Inventory

Snapshot data sourced directly from the Percy API (`/api/v1/snapshots?build_id=49097670`). Diff % values are averaged across all tested browsers and widths. Percy's display count of "23 changed" uses per-browser thresholds; 20 changed URLs are confirmed from the API, with 3–4 additional (most likely help pages) visible in the Percy sidebar but not returned by the API endpoint.

### All Changed Snapshots (diff > 0), Sorted High to Low

| # | URL | API Avg Diff | Category | Action |
|---|---|---|---|---|
| 1 | `/?app=1#analytics` | 100% | SPA auth artifact | No action — scanner limitation |
| 2 | `/?app=1#shops` | 100% | SPA auth artifact | No action — scanner limitation |
| 3 | `/?app=1#planner` | 100% | SPA auth artifact | No action — scanner limitation |
| 4 | `/?app=1#image-bank` | 100% | SPA auth artifact | No action — scanner limitation |
| 5 | `/?app=1#reports` | 100% | SPA auth artifact | No action — scanner limitation |
| 6 | `/?app=1#calendar` | 99.96% | SPA auth artifact | No action — scanner limitation |
| 7 | `/request-feature.html` | 29.99% | Dynamic content + BS-2 footer | Approve after BS-2 footer check |
| 8 | `/` (public landing page) | 11.21% | Real change — BS-1/BS-2 + dynamic content | Human review required — see Group D |
| 9 | `/?app=1#dashboard` | 11.21% | SPA auth artifact | No action — scanner limitation |
| 10 | `/status.html` | 0.69% | BS-2 footer change | Approve after BS-2 footer check |
| 11 | `/compare/vendoo.html` | 0.55% | BS-1 nav contrast | Approve after BS-1 merges |
| 12 | `/compare/flyp.html` | 0.53% | BS-1 nav contrast | Approve after BS-1 merges |
| 13 | `/compare/primelister.html` | 0.52% | BS-1 nav contrast | Approve after BS-1 merges |
| 14 | `/roadmap-public.html` | 0.44% | BS-2 footer change | Approve after BS-2 footer check |
| 15 | `/compare/list-perfectly.html` | 0.42% | BS-1 nav contrast | Approve after BS-1 merges |
| 16 | `/compare/selleraider.html` | 0.39% | BS-1 nav contrast | Approve after BS-1 merges |
| 17 | `/compare/oneshop.html` | 0.38% | BS-1 nav contrast | Approve after BS-1 merges |
| 18 | `/compare/nifty.html` | 0.37% | BS-1 nav contrast | Approve after BS-1 merges |
| 19 | `/changelog.html` | 0.25% | BS-2 footer change | Approve after BS-2 footer check |
| 20 | `/platforms.html` | 0.21% | BS-2 footer change | Approve after BS-2 footer check |
| 21–23 or 24 | Help pages (unconfirmed via API) | ~0.1–0.3% est. | BS-2 footer change | Spot-check one; approve if footer correct |

**3–4 additional "changed" snapshots** appear in Percy's sidebar count but were not returned by the API endpoint. The prior session's direct sidebar inspection confirmed 4 help page names: Getting Started, Automations Guide, Cross-Listing Guide, Inventory Management. The exact count in Percy's "changed" bucket depends on whether `platforms.html` (0.21% avg diff) is above or below Percy's per-browser detection threshold — if platforms is "unchanged" by Percy's logic, all 4 help pages are "changed" (19 API + 4 help = 23); if platforms is "changed", only 3 help pages are (20 API + 3 help = 23). Either way, 3–4 help pages have BS-2 footer changes requiring human spot-check.

### Unchanged Snapshots (diff = 0, confirmed via API)

`/faq.html`, `/contact.html`, `/pricing.html`, `/?app=1#login`, `/?app=1#forgot-password`, `/learning.html`, `/?app=1#register`, `/blog/index.html`, `/?app=1#inventory`, `/documentation.html`

Additional unchanged pages (not in API but in Percy's "20 unchanged" total): affiliate.html, privacy.html, terms.html, and others.

---

## Group Descriptions

### Group A — BS-1 Nav Contrast Fix (7 compare pages)

**Confirmed pages:** vendoo.html, flyp.html, primelister.html, list-perfectly.html, selleraider.html, oneshop.html, nifty.html

**Not confirmed in this build:** closo.html, crosslist.html, crosslist-magic.html (all exist in `public/compare/` but do not appear in the API's 30-snapshot result set — either not reached by the scanner, or their diffs fall below Percy's per-browser detection threshold in all tested browsers).

**What changed:** Nav bar link text color only. Baseline shows `--gray-400: #9ca3af` (light gray, fails WCAG AA at ~2.54:1 on white); comparison shows `#767676` after BS-1 WCAG AA fix (4.54:1 on white, passes). Red diff blocks appear exclusively in the navigation bar. Page content is identical.

**Action:** Approve all 7 after BS-1 CSS PR is reviewed and merged by a human.

---

### Group B — SPA Auth Redirect Artifacts (7 routes)

**Routes:** `/?app=1#analytics`, `/?app=1#shops`, `/?app=1#planner`, `/?app=1#image-bank`, `/?app=1#reports`, `/?app=1#calendar` (100% diff), plus `/?app=1#dashboard` (11.21% avg diff).

**What changed:** Scanner navigated to authenticated SPA routes unauthenticated. Auth guard fires before page renders. The two scans captured different auth-guard render states. The 6 routes at 100% show login-form vs blank-page. `#dashboard` at 11.21% shows partial overlap between render states (browser-dependent timing). All 7 are the same root cause.

**Root cause:** SPA requires authentication. Routes with `?app=1` are served as the SPA regardless of auth cookie (server.js:1155 — `url.searchParams.has('app')` check bypasses the landing page branch). All `/?app=1#*` routes redirect unauthenticated users before paint.

**Action:** Do not approve. Mark as "Scanner limitation — SPA requires auth." Exclude all 7 routes from future Percy visual scans by gating the scanner to public URLs only.

---

### Group D — Public Landing Page (1 page)

**URL:** `https://vaultlister.com/` (11.21% avg diff)

**What changed:** The server routes unauthenticated requests to `/` → `public/landing.html` when no `vl_access` cookie is present and no `?app` parameter is in the URL (server.js:1152–1166). The Percy scanner is unauthenticated, so it renders the full public marketing page — not the SPA. The 11.21% average diff across 6 browsers is a real visual change. Likely causes: BS-1 nav contrast fix (affects nav link colors across the hero and header), BS-2 footer heading change (`.footer-col-label` `<p>` → `<h3>`), and possibly dynamic hero content drift between the 06:26 PM and 10:47 PM scans.

**Action:** Human review required. Open the Percy diff for the `/` snapshot and inspect which areas changed. If the diff is limited to nav bar and footer (consistent with BS-1/BS-2), approve after those PRs merge. If hero or body content changed unexpectedly, investigate before approving.

---

### Group C — BS-2 Footer / Public Shell Changes (5+ pages)

**Confirmed:** request-feature.html (29.99%), status.html (0.69%), roadmap-public.html (0.44%), changelog.html (0.25%), platforms.html (0.21%).

**Also affected (likely):** 3–4 help pages (Getting Started, Automations Guide, Cross-Listing Guide, or Inventory Management) — confirmed in Percy sidebar in prior review session but not returned by API.

**What changed:** Two independent causes appear across these pages:
1. **BS-2 structural fix** — `.footer-col-label` elements changed from `<p>` to `<h3>`. Visible as diff in footer column heading area on all public pages.
2. **Dynamic content drift** (request-feature.html only) — Feature request list showed a test entry ("E2E feature request 177690B771273") in the baseline; comparison scan shows different content.

**Action:** Spot-check one help page and one of the smaller public pages (e.g. changelog.html) in browser. If footer headings render correctly (legible, properly styled `<h3>`), approve all pages in this group. The dynamic content change on request-feature.html is not a regression.

---

## Responsive Scanner Build 49097668 — 36 New Baselines

**Status:** First-run baselines only. No prior build exists to diff against. All 36 snapshots are "new" — there is no baseline comparison.

**Action required (human):** Manually browse through all 36 baseline snapshots in Percy to confirm each page renders correctly at each viewport width. Pay particular attention to:
- Mobile nav hamburger menu (does it appear at correct breakpoint?)
- Compare table columns (do they collapse correctly on narrow viewports?)
- Footer columns (do they stack correctly?)
- Cookie banner (does it overlay correctly on mobile?)
- Images and hero sections (do they scale without overflow?)

No code change is triggered by these. Approve the baselines once visually confirmed.

---

## Outstanding Actions

| Priority | Item | Owner |
|---|---|---|
| HIGH | Review `/` (landing page) Percy diff — inspect which areas changed at 11.21% | Human |
| HIGH | Approve 7 compare page snapshots (Group A) after BS-1 CSS PR merges | Human |
| HIGH | Browse all 36 Responsive baselines at each viewport | Human |
| MEDIUM | Spot-check changelog.html or status.html footer in browser; approve Group C pages | Human |
| MEDIUM | Approve request-feature.html (dynamic content + BS-2 footer) | Human |
| LOW | Document 7 SPA hash routes as permanently scanner-excluded | Codex |
| LOW | Verify closo.html, crosslist.html, crosslist-magic.html are reachable by scanner | Codex |

---

## What Does NOT Require Attention

The 10 confirmed unchanged snapshots (diff = 0): faq.html, contact.html, pricing.html, #login, #forgot-password, learning.html, #register, blog/index.html, #inventory, documentation.html.

The twitter.com → x.com URL fix (commit `adcec44a`) does not appear in Percy diffs because only the `href` attribute changed — the icon and aria-label are identical. Percy compares pixel screenshots, so an href-only change produces no visual diff.

---

## Cookie Banner Note

All public pages have a cookie banner with `style="display:none;...;display:flex"` where the second `display` declaration overrides the first. This causes the banner to initially render visible (brief flash) even when `display:none` was intended. This is `position:fixed` so it does not cause CLS, but it creates a visible flash on page load. The Percy scanner does not capture this flash (it captures a static state), so it will not appear in diffs. Fix tracked in BS-7.

---

## Data Source Note

Snapshot inventory confirmed via Percy Ember data store API (`/api/v1/snapshots?build_id=49097670`) returning 30 unique URL snapshots. Diff % values are cross-browser averages (Firefox, Chrome, Edge, Safari, Chrome Android, Safari iPhone). Firefox-specific diffs for compare pages are approximately 2–3× higher than the averaged values shown above (~1.11–1.19% in Firefox vs ~0.37–0.55% average). The "23 changed" display count reflects Percy's per-browser threshold counting, which may include pages with near-zero average diff that show measurable diff in at least one browser.
