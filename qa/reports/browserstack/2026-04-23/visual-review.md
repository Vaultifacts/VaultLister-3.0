# Percy Visual Review — April 23, 2026

## Status: COMPLETE — BASELINES APPROVED (2026-04-24)

Percy baselines approved by Mathew Cheung on 2026-04-24. Both builds merged to master via PR #440.
**Only the project owner (Mathew Cheung) may approve Percy baselines. No automated approval is permitted.**

---

## Build Summary

| Build | Scanner | Snapshots | Status |
|---|---|---|---|
| 49088785 | Visual Scanner | 46 changed | Unreviewed: 46, Approved: 0 |
| 49088786 | Responsive Scanner | 48 new | All new (no prior baselines) |

Percy org slug: `f9ff0f68`

---

## Build 49088785 — Visual Scanner (Fully Classified)

All 46 snapshots have been manually verified via side-by-side view. Sorted by Diff % High to Low.

### Classification Key

- **SPA auth mismatch**: Baseline = authenticated SPA view; new scan = unauthenticated → auth guard fires `window.location.hash = '#login'` before any paint → solid red new screenshot. These are scanner artifacts, not code regressions.
- **Public page diff**: Both baseline and new show real public page content. Red overlay in new screenshot = Percy diff highlighting where BS-1 color tokens changed (footer text, amber buttons, badges).
- **SPA register form diff**: Register form is pre-auth accessible (no auth guard fires). Both scans show the register form. Diff = BS-1 color changes on form elements.

### Verified Snapshot Table

| # | Title | Diff% | Classification | Action |
|---|---|---|---|---|
| 1 | VaultLister (Dashboard) | 100% | SPA auth mismatch | Approve — scanner artifact |
| 2 | VaultLister (My Shops) | 100% | SPA auth mismatch | Approve — scanner artifact |
| 3 | Dashboard \| VaultLister | 100% | SPA auth mismatch | Approve — scanner artifact |
| 4 | VaultLister (Custom Reports) | 100% | SPA auth mismatch | Approve — scanner artifact |
| 5 | VaultLister (Inventory) | 76.65% | SPA auth mismatch | Approve — scanner artifact |
| 6 | VaultLister (Calendar) | 75.69% | SPA auth mismatch | Approve — scanner artifact |
| 7 | VaultLister (Offers/Orders/Shipping) | 74.75% | SPA auth mismatch | Approve — scanner artifact |
| 8 | VaultLister (Sales & Purchases) | 72.84% | SPA auth mismatch | Approve — scanner artifact |
| 9 | VaultLister (Listings) | 69.71% | SPA auth mismatch | Approve — scanner artifact |
| 10 | VaultLister (Image Bank) | 66.24% | SPA auth mismatch | Approve — scanner artifact |
| 11 | VaultLister (Financials) | 44.16% | SPA auth mismatch | Approve — scanner artifact |
| 12 | VaultLister (Daily Checklist) | 42.48% | SPA auth mismatch | Approve — scanner artifact |
| 13 | Feature Requests — VaultLister | 41.91% | Public page diff | Approve — intentional BS-1 colors |
| 14 | VaultLister (Analytics) | 39.62% | SPA auth mismatch | Approve — scanner artifact |
| 15 | VaultLister (Automations) | 26.66% | SPA auth mismatch | Approve — scanner artifact |
| 16 | Changelog — VaultLister | 24.17% | Public page diff | Approve — intentional BS-1 colors |
| 17 | Automations — VaultLister Help Center | 18.87% | Public page diff | Approve — intentional BS-1 colors |
| 18 | Inventory Management — VaultLister Help Center | 17.52% | Public page diff | Approve — intentional BS-1 colors |
| 19 | Cross-Listing — VaultLister Help Center | 17.49% | Public page diff | Approve — intentional BS-1 colors |
| 20 | Troubleshooting — VaultLister Help Center | 14.02% | Public page diff | Approve — intentional BS-1 colors |
| 21 | Status — VaultLister | 8.47% | Public page diff | Approve — intentional BS-1 colors |
| 22 | Getting Started — VaultLister Help Center | 7.83% | Public page diff | Approve — intentional BS-1 colors |
| 23 | Marketplace Integrations — VaultLister | 2.56% | Public page diff | Approve — intentional BS-1 colors |
| 24 | Help Center — VaultLister | 2.38% | Public page diff | Approve — intentional BS-1 colors |
| 25 | Pricing — VaultLister | 1.86% | Public page diff | Approve — intentional BS-1 colors |
| 26 | Learning — VaultLister | 1.82% | Public page diff | Approve — intentional BS-1 colors |
| 27 | Blog — VaultLister | 1.70% | Public page diff | Approve — intentional BS-1 colors |
| 28 | Documentation — VaultLister | 1.49% | Public page diff | Approve — intentional BS-1 colors |
| 29 | Affiliate Program — VaultLister | 1.40% | Public page diff | Approve — intentional BS-1 colors |
| 30 | Documentation — VaultLister | 1.37% | Public page diff | Approve — intentional BS-1 colors |
| 31 | FAQs — VaultLister | 1.15% | Public page diff | Approve — intentional BS-1 colors |
| 32 | Contact Us — VaultLister | 1% | Public page diff | Approve — intentional BS-1 colors |
| 33 | VaultLister vs List Perfectly — VaultLister | 0.83% | Public page diff | Approve — intentional BS-1 colors |
| 34 | Documentation — VaultLister | 0.82% | Public page diff | Approve — intentional BS-1 colors |
| 35 | VaultLister vs Closo — VaultLister | 0.81% | Public page diff | Approve — intentional BS-1 colors |
| 36 | VaultLister vs SellerAider — VaultLister | 0.80% | Public page diff | Approve — intentional BS-1 colors |
| 37 | VaultLister vs Crosslist Magic — VaultLister | 0.78% | Public page diff | Approve — intentional BS-1 colors |
| 38 | Documentation — VaultLister | 0.77% | Public page diff | Approve — intentional BS-1 colors |
| 39 | VaultLister vs OneShop — VaultLister | 0.76% | Public page diff | Approve — intentional BS-1 colors |
| 40 | VaultLister vs Crosslist — VaultLister | 0.76% | Public page diff | Approve — intentional BS-1 colors |
| 41 | VaultLister vs Vendoo — VaultLister | 0.74% | Public page diff | Approve — intentional BS-1 colors |
| 42 | VaultLister vs Nifty — VaultLister | 0.73% | Public page diff | Approve — intentional BS-1 colors |
| 43 | VaultLister vs Flyp — VaultLister | 0.71% | Public page diff | Approve — intentional BS-1 colors |
| 44 | VaultLister vs Primelister — VaultLister | 0.69% | Public page diff | Approve — intentional BS-1 colors |
| 45 | Roadmap — VaultLister | 0.24% | Public page diff | Approve — intentional BS-1 colors |
| 46 | VaultLister (Register form, 1170px Safari) | 0.78% | SPA register form diff | Approve — intentional BS-1 colors on form |

### Final Count

| Category | Count | What it means |
|---|---|---|
| SPA auth mismatch artifacts | 14 | Scanner ran unauthenticated; auth guard fired before paint → solid red new screenshot. No regression. |
| Public page diffs | 31 | BS-1 color token changes (`--gray-400`, amber tokens) visible in footer text, nav, buttons, badges. Intentional. |
| SPA register form diff | 1 | Pre-auth accessible form; BS-1 color changes on form elements. Intentional. |
| **Total** | **46** | **All diffs are intentional or expected scanner artifacts** |

### Why SPA diff% varies (not all 100%)

SPA auth mismatch routes do not uniformly produce 100% diff. The diff% depends on how much of the baseline screenshot was light-colored:
- Custom Reports (empty white page) → 100% diff vs solid red new
- Analytics (dark charts, amber elements) → 39.62% diff vs solid red new
- Automations (dark sidebar, few bright elements) → 26.66% diff vs solid red new

This is why SPA routes are interspersed with public pages in the Diff % High to Low ranking rather than clustered at the top.

---

## Build 49088786 — Responsive Scanner

All 48 snapshots are **New** (no prior baselines at these viewport widths). There is no regression risk — Percy has nothing to regress against. The new scan establishes the baseline for the first time.

**Recommendation**: Safe to "Approve All." Review a sample to confirm responsive layouts look correct before approving, but there is no correctness bar to meet beyond your own judgment of the current responsive design.

---

## What Changed in BS-1 through BS-7 (for reference)

### BS-1 — Color contrast (public CSS)
- `--gray-400` changed from `#9ca3af` to `#767676` (darker gray)
- `--gray-500` changed from `#6b7280` to `#595959` (darker gray)
- Amber text on light backgrounds changed from `#d97706`/`#f59e0b` to `#b45309`
- Affected: all public pages (footer text, nav links, badges, buttons)
- Expected Percy diff: slightly darker text throughout public pages

### BS-2 — Public shell accessibility
- `.footer-col-label` `<p>` → `<h3>` (same CSS class, no visual change expected)
- Skip link added (hidden by default, visible on focus only — no visible diff expected)
- `aria-label` added to changelog search (no visual change)

### BS-3 — SPA semantics
- Goals widget outer div: `role=button` removed (no visual change)

### BS-5 — Grammar fixes
- Text changes: "items sold" → "item sold" (singular), "purchases tracked" → "purchase tracked"
- Help pages: "publish status" → "publishing status"

### BS-7 — status.html CLS
- Nav and footer logo `<img>` elements: explicit `width` attributes added
- `.platform-hero` and `.status-row-title img`: `min-height` and `aspect-ratio` CSS added
- Expected Percy diff: platform logo cards may show slightly different reserved height

---

## Approval Authority

Only the project owner (Mathew Cheung) may approve Percy baselines.
No automated approval is permitted.

## Percy Build Links

- Visual Scanner (49088785): `https://percy.io/f9ff0f68/visual_scanner/CS_vaultlister.com-2_CS-981cad37/builds/49088785/`
- Responsive Scanner (49088786): `https://percy.io/f9ff0f68/visual_scanner/CS_vaultlister.com-2_CS-981cad37/builds/49088786/`
