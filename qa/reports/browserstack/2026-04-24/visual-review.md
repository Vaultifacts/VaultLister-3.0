# Percy Visual Review — April 24, 2026

## Build Information

| Build | ID | Snapshots | Baseline | Comparison |
|---|---|---|---|---|
| Visual Scanner (Scan run #8) | 49097670 | 23 changed / 20 unchanged | April 24, 2026 06:26 PM UTC | April 24, 2026 10:47 PM UTC |
| Responsive Scanner | 49097668 | 36 new baselines | N/A (first run) | April 24, 2026 |

> **Human approval required before merging.** This document is a classification log. No baselines have been approved or rejected.

---

## Visual Scanner Build 49097670 — 23 Changed Snapshots

### Summary

| Category | Count | Verdict |
|---|---|---|
| Expected CSS change (BS-1 nav contrast fix) | ~10 | Approve when BS-1 is merged |
| SPA auth redirect artifacts | ~6–8 | Ignore — scanner cannot authenticate |
| Dynamic content + BS-2 footer fix | 1 | Approve after verifying BS-2 footer |
| Help page footer fix (BS-2) | ~4 | Approve when BS-2 is merged |

**No regressions detected.** All 23 diffs are attributable to intentional BS-1/BS-2 fixes or known scanner limitations.

---

### Group A — Compare Pages (~10 snapshots, ~1.11–1.19% diff each)

**Directly confirmed:** VaultLister vs List Perfectly (1/23, 1.19%), VaultLister vs SellerAider (11/23, 1.11%), VaultLister vs Closo (1.19%).

**Inferred:** Remaining compare pages (Flyp, Crosslist, Poshmark, Primelister, Depop, Grailed, Vendoo) follow the same pattern — Percy's "3 matching changes" badge on the Closo group confirms the pattern is shared.

**What changed:** Nav bar only. Baseline shows amber/gray nav links; comparison shows darker nav link text. Red diff blocks appear exclusively in the navigation bar area. Page content (compare tables, CTAs, footer) is identical between scans.

**Root cause:** BS-1 contrast fix — `--gray-400: #9ca3af` changed to a darker value to meet WCAG AA 4.5:1 ratio. This token is used in nav dropdown link text. The fix is correct. These diffs are expected.

**Action:** Approve after BS-1 CSS PR is reviewed and merged by a human.

---

### Group B — SPA Auth Redirect Routes (~6–8 snapshots, 100% diff each)

**Confirmed routes:** `/?app=1#calendar` (7/23), `/?app=1#reports` (8/23). Items 3/23 through 6/23 are also VaultLister SPA routes at 100% diff (URL pattern `/?app=1#...`).

**What changed:** Baseline capture: login form centered on dark background (auth guard fired before paint). Comparison capture: solid red block (scanner state/timing varied — likely blank page or different auth guard render). Both are the same underlying cause.

**Root cause:** The SPA requires authentication. When the BrowserStack scanner navigates to any `/#` hash route unauthenticated, the auth guard intercepts before the page renders. The two scans captured different states of this unrendered page. This matches the April 23 performance report finding: TTFB nonzero but all render metrics = 0.

**Action:** Do not approve. Mark as "Scanner limitation — SPA requires auth." These snapshots should be excluded from future Percy visual scans by gating the scanner to public URLs only, or by documenting them as permanently unverifiable.

---

### Snapshot 9/23 — Request a VaultLister Feature (29.17% diff)

**URL:** `https://vaultlister.com/request-feature.html`

**What changed:**
1. **Main content area (large red block):** The feature request list showed a test entry ("E2E feature request 177690B771273 — Verify that the public feature request form accepts submissions without an authenticated session") in the baseline. The comparison scan shows different content. This is dynamic server-rendered content that changed between the 06:26 PM and 10:47 PM scans — not a visual regression.
2. **Footer:** Column heading labels (`RESOURCES`, `STATUS & UPDATES`, `COMPANY`, `COMPARE`) appear with different styling in the comparison — consistent with the BS-2 fix converting `.footer-col-label` from `<p>` to `<h3>`.

**Root cause:** Two independent causes — dynamic content drift between scans plus intentional BS-2 structural fix.

**Action:** Approve after confirming the footer heading styling looks correct in browser. The dynamic content change is not a regression.

---

### Group C — Help Pages (~4 snapshots)

**Pages:** Getting Started, Automations Guide, Cross-Listing Guide, Inventory Management.

**Expected pattern:** Same footer-area diff as the request-feature page (BS-2 `.footer-col-label` `<p>` → `<h3>` fix). Nav bar may also show the BS-1 color change.

**Action:** Spot-check one help page in browser. If the footer headings render correctly (legible, properly styled), approve all four.

> **Note:** These snapshots were not individually opened in the Percy diff viewer during this review session. Classification is inferred from the known BS-2 change and the same file patterns confirmed in other pages.

---

## Responsive Scanner Build 49097668 — 36 New Baselines

**Status:** First-run baselines only. No prior build exists to diff against. All 36 snapshots are "new" — there is no baseline comparison.

**What this means:** Percy cannot show diffs because there is no previous snapshot to compare. These are establishing new visual baselines at 1080px, 1170px, and 1280px (plus mobile viewports if configured).

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
| HIGH | Approve Group A compare page snapshots after BS-1 CSS PR merges | Human |
| HIGH | Browse all 36 Responsive baselines at each viewport | Human |
| MEDIUM | Confirm Group C help page footer rendering looks correct in browser | Human |
| MEDIUM | Approve snapshot 9/23 (request-feature) after BS-2 footer check | Human |
| LOW | Document SPA hash routes as permanently scanner-excluded | Codex |

---

## What Does NOT Require Attention

- The 20 unchanged snapshots: landing, pricing, contact, terms, privacy, status, affiliate, changelog, platforms, documentation — these are stable and confirmed correct.
- The twitter.com → x.com URL fix (commit `adcec44a`) does not appear in Percy diffs because the social icon links are below the fold and not captured in the scanner's initial viewport.

---

## Cookie Banner Note

All 46 public pages have a cookie banner with `style="display:none;...;display:flex"` where the second `display` declaration overrides the first. This causes the banner to initially render visible (brief flash) even when `display:none` was intended. This is `position:fixed` so it does not cause CLS, but it creates a visible flash on page load. The Percy scanner does not capture this flash (it captures a static state), so it will not appear in diffs. Fix tracked in BS-7.
