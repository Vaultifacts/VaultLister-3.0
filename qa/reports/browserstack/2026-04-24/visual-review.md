# Percy Visual Review — April 24, 2026

## Build Information

| Build | ID | Snapshots | Baseline | Comparison |
|---|---|---|---|---|
| Visual Scanner (Scan run #8) | 49097670 | 23 changed / 20 unchanged | April 24, 2026 06:26 PM UTC | April 24, 2026 10:47 PM UTC |
| Responsive Scanner | 49097668 | 36 new baselines | N/A (first run) | April 24, 2026 |

> **Human approval required before merging.** This document is a classification log. No baselines have been approved or rejected.

---

## Visual Scanner Build 49097670 — Complete Snapshot Inventory

Snapshot data sourced directly from the Percy API (`/api/v1/snapshots?build_id=49097670`). Diff % values are averaged across all tested browsers and widths. Percy's display count of "23 changed" uses per-browser thresholds; 20 changed URLs are confirmed from the API, with 3 additional (most likely help pages) visible in the Percy sidebar but not returned by the API endpoint.

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
| 8 | `/` (SPA root) | 11.21% | SPA auth artifact | No action — scanner limitation |
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
| 21–23 | Help pages (unconfirmed via API) | ~0.1–0.3% est. | BS-2 footer change | Spot-check one; approve if footer correct |

**3 additional "changed" snapshots** appear in Percy's sidebar count but were not returned by the API endpoint. Based on the prior session's direct sidebar inspection, these are help pages (Getting Started, Automations Guide, Cross-Listing Guide, Inventory Management). Not all 4 may be "changed" — some may fall below Percy's per-browser threshold. Exact count: 3 of those 4.

### Unchanged Snapshots (diff = 0, confirmed via API)

`/faq.html`, `/contact.html`, `/pricing.html`, `/?app=1#login`, `/?app=1#forgot-password`, `/learning.html`, `/?app=1#register`, `/blog/index.html`, `/?app=1#inventory`, `/documentation.html`

Additional unchanged pages (not in API but in Percy's "20 unchanged" total): affiliate.html, privacy.html, terms.html, landing.html (served at a different path than `/`), and others.

---

## Group Descriptions

### Group A — BS-1 Nav Contrast Fix (7 compare pages)

**Confirmed pages:** vendoo.html, flyp.html, primelister.html, list-perfectly.html, selleraider.html, oneshop.html, nifty.html

**Not confirmed in this build:** closo.html, crosslist.html, crosslist-magic.html (all exist in `public/compare/` but show 0% average diff in API — either not reached by scanner or change negligible across non-Firefox browsers).

**What changed:** Nav bar link text color only. Baseline shows `--gray-400: #9ca3af` (amber/gray); comparison shows darker value after BS-1 WCAG AA fix. Red diff blocks appear exclusively in the navigation bar. Page content is identical.

**Action:** Approve all 7 after BS-1 CSS PR is reviewed and merged by a human.

---

### Group B — SPA Auth Redirect Artifacts (8 routes)

**Routes:** `/?app=1#analytics`, `/?app=1#shops`, `/?app=1#planner`, `/?app=1#image-bank`, `/?app=1#reports`, `/?app=1#calendar` (100% diff), plus `/` and `/?app=1#dashboard` (11.21% avg diff).

**What changed:** Scanner navigated to authenticated SPA routes unauthenticated. Auth guard fires before page renders. The two scans captured different auth-guard render states. The 6 routes at 100% show login-form vs blank-page. The root `/` and `#dashboard` at 11.21% show partial overlap between render states (browser-dependent timing). All 8 are the same root cause.

**Root cause:** SPA requires authentication. `vaultlister.com/` serves the SPA (not a separate public landing page). All `/?app=1#*` routes redirect unauthenticated users before paint.

**Action:** Do not approve. Mark as "Scanner limitation — SPA requires auth." Exclude all 8 from future Percy visual scans by gating the scanner to public URLs only.

---

### Group C — BS-2 Footer / Public Shell Changes (5+ pages)

**Confirmed:** request-feature.html (29.99%), status.html (0.69%), roadmap-public.html (0.44%), changelog.html (0.25%), platforms.html (0.21%).

**Also affected (likely):** ~3 help pages (Getting Started, Automations Guide, Cross-Listing Guide, or Inventory Management) — confirmed in Percy sidebar in prior review session but not returned by API.

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
| HIGH | Approve 7 compare page snapshots (Group A) after BS-1 CSS PR merges | Human |
| HIGH | Browse all 36 Responsive baselines at each viewport | Human |
| MEDIUM | Spot-check changelog.html or status.html footer in browser; approve Group C pages | Human |
| MEDIUM | Approve request-feature.html (dynamic content + BS-2 footer) | Human |
| LOW | Document all 8 SPA hash routes + root `/` as permanently scanner-excluded | Codex |
| LOW | Verify closo.html, crosslist.html, crosslist-magic.html are reachable by scanner | Codex |

---

## What Does NOT Require Attention

The 10 confirmed unchanged snapshots (diff = 0): faq.html, contact.html, pricing.html, #login, #forgot-password, learning.html, #register, blog/index.html, #inventory, documentation.html.

The twitter.com → x.com URL fix (commit `adcec44a`) does not appear in Percy diffs because the social icon links are below the fold and not captured in the scanner's initial viewport.

---

## Cookie Banner Note

All public pages have a cookie banner with `style="display:none;...;display:flex"` where the second `display` declaration overrides the first. This causes the banner to initially render visible (brief flash) even when `display:none` was intended. This is `position:fixed` so it does not cause CLS, but it creates a visible flash on page load. The Percy scanner does not capture this flash (it captures a static state), so it will not appear in diffs. Fix tracked in BS-7.

---

## Data Source Note

Snapshot inventory confirmed via Percy Ember data store API (`/api/v1/snapshots?build_id=49097670`) returning 30 unique URL snapshots. Diff % values are cross-browser averages (Firefox, Chrome, Edge, Safari, Chrome Android, Safari iPhone). Firefox-specific diffs for compare pages are approximately 2–3× higher than the averaged values shown above (~1.11–1.19% in Firefox vs ~0.37–0.55% average). The "23 changed" display count reflects Percy's per-browser threshold counting, which may include pages with near-zero average diff that show measurable diff in at least one browser.
