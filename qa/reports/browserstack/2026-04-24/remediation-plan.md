# VaultLister BrowserStack/Percy Remediation Plan — April 24, 2026

**Scan ID:** `onu6cbfsmvfidu40t9vnwfsslzvpcyahduk8vnb2`  
**Scan time:** Apr 24, 2026 4:47 PM  
**Analysis method:** Live report review via browser (no CSV export — all data from dashboard and accessibility report UI)

---

## Executive summary vs April 23

| Category | Apr 23 | Apr 24 | Delta | Notes |
|---|---:|---:|---|---|
| Accessibility | 2,437 | 1,654 | **-783** | BS-1/BS-2 fixes resolved 1,119; Spectra v6.3.1 added 185 new |
| Broken Link | 17 | 383 | **+366** | Inflation only: 352 are new "CTA component" issue type (SPA JS buttons); real unique broken URLs still ~2-4 |
| Spell | 806 | 796 | -10 | Same brand-name FP pattern; 1 grammar error on cross-listing.html unresolved |
| Website Form | many | 1 | **↓** | BS-4 documentation correctly attributed scanner artifacts |
| Performance | 48 | 36 | -12 | Real CLS issues found on contact.html + request-feature.html |
| Visual | — | 28 | new | Percy build 49097670 |
| Responsive | — | 36 | new | Percy build 49097668 |

---

## 1. Accessibility — 1,654 issues, Score 80

### Quick snapshot
- **New:** 185 (Spectra v6.3.1 engine reclassification, not code regressions)
- **Retained:** 1,469
- **Resolved:** 1,119 (BS-1 contrast + BS-2 heading/footer fixes confirmed working)

### Severity breakdown
| Severity | Issues |
|---|---:|
| Serious | 943 |
| Minor | 413 |
| Moderate | 272 |
| Critical | 26 |
| **Total** | **1,654** |

### Rule severity (score impact)
| Severity | Passed rules | Failed rules | Score impact |
|---|---:|---:|---:|
| Critical | 538 | 10 | -1 |
| Serious | 1,014 | 199 | -16 |
| Moderate | 338 | 82 | -3 |
| Minor | 113 | 3 | 0 |

### Top confirmed issues (976 confirmed, 678 needs review)

| Rule | Count | Severity | Attribution |
|---|---:|---|---|
| Links with same href URLs must have identical link texts | 182 | Moderate | Public HTML pages — multiple CTAs pointing to same URL with different text (e.g. "Sign up free" vs "Get started") |
| Elements must meet minimum color contrast ratio thresholds (AI) | 357 | Serious | Extends BS-1 scope — AI engine finding contrast beyond the axe color-contrast rule |
| Elements must have their visible text as part of their accessible name | 90 | Serious | SPA — icon-only buttons, span.check elements, button.public-profile-trigger (188 affected components) |
| Interactive elements must have a correct role assigned (AI) | 95 | Serious | SPA — div/span used as interactive elements (BS-3 scope) |
| Interactive elements must be made accessible via keyboard (AI) | 93 | Serious | SPA — same BS-3 clickable div/span pattern |
| ARIA role should be appropriate for the element | 17 | Minor | SPA + public nav — wrong ARIA role on footer/nav elements |
| Label must be correctly associated with a form control | 17 | Moderate | Public pages — subscribe forms, search inputs |
| Links must be distinguishable from surrounding text | 15 | Serious | SPA + public — links not visually distinct from body text |
| Heading levels should only increase by one | 12 | Moderate | Public pages — heading skip (h1→h3, no h2) still present on some pages |
| Form elements must have labels | 11 | Critical | SPA — unlabeled inputs (inventory filters, search boxes) |
| Select element must have an accessible name | 10 | Critical | SPA — `<select>` dropdowns without associated labels |
| Search functionality must be placed within a landmark region (AI) | 8 | Serious | Public pages — search bars outside `<search>` or `role="search"` landmark |
| Menus with dropdowns must include the aria-haspopup attribute (AI) | 6 | Serious | Public nav — dropdown menus missing `aria-haspopup` |
| Placeholder is used as a label (AI) | 5 | Moderate | Forms — inputs relying only on placeholder, no `<label>` |
| All page content should be contained by landmarks | 4 | Moderate | Public + SPA — content outside landmark regions |
| Certain ARIA roles must be contained by particular parents | 3 | Critical | SPA — ARIA role hierarchy violation |
| Autocomplete attribute must have a valid value | 3 | Moderate | Forms — invalid `autocomplete` attribute values |
| Main landmark should not be contained in another landmark | 3 | Moderate | SPA — nested main/region landmark structure |
| Images must have a meaningful alt text (AI) | 17 | Moderate | Image bank, product images |
| Non-empty `<td>` elements in larger `<table>` must have an associated table header | 1 | Critical | Analytics table in SPA |
| Document should not have more than one main landmark | 1 | Moderate | SPA page structure |
| Page should contain a level-one heading | 1 | Moderate | At least one page missing `<h1>` |

### Needs review (678) — root causes

| Rule | Count | Notes |
|---|---:|---|
| Hidden content on the page should be analyzed | 385 | Same pattern as Apr 23: nav dropdowns + FAQ accordions hidden with display:none. Need `aria-expanded` pattern, not removal. |
| Elements must meet minimum color contrast ratio thresholds (AI) | 223 | Additional contrast checks flagged by AI engine needing human confirmation |
| Non-text elements must have at least a 3:1 contrast ratio with adjacent colors | 45 | Icon/border contrast; overlaps with BS-1 scope |
| Images must have a meaningful alt text (AI) | 16 | Additional image checks |
| Elements must only use permitted ARIA attributes | 2 | ARIA attribute validity |

### WCAG 2.1 AA: 14 failing criteria
| Criterion | Description |
|---|---|
| 1.1.1 | Non-text Content (missing alt text) |
| 1.3.1 | Info and Relationships (semantic markup) |
| 1.3.5 | Identify Input Purpose (autocomplete) |
| 1.4.1 | Use of Color |
| 1.4.3 | Contrast (Minimum) |
| 1.4.11 | Non-text Contrast |
| 2.1.1 | Keyboard |
| 2.4.4 | Link Purpose (In Context) |
| 2.4.6 | Headings and Labels |
| 2.5.3 | Label in Name |
| 3.2.4 | Consistent Identification |
| 3.3.2 | Labels or Instructions |
| 4.1.2 | Name, Role, Value |
| 4.1.3 | Status Messages |

### Top affected pages
| # | URL | Score | Issues |
|---|---|---:|---:|
| 1 | vaultlister.com/ (SPA) | 77 | 563 |
| 2 | vaultlister.com/changelog.html | 75 | 124 |
| 3 | vaultlister.com/status.html | 78 | 67 |
| 4 | vaultlister.com/documentation.html | 79 | 65 |
| 5 | vaultlister.com/platforms.html | 79 | 49 |
| 6 | vaultlister.com/compare/vendoo.html | 85 | 43 |

### Top affected components
| # | Component | Issues |
|---|---|---:|
| 1 | span.check | 124 |
| 2 | div.nav-dropdown-menu | 112 |
| 3 | button | 58 |
| 4 | button.public-profile-trigger | 56 |
| 5 | span.inventory-actions-label | 56 |
| 6 | div.mini-calendar-day | 55 |

### Attribution: what's new vs retained

The 185 "new" issues are from Spectra v6.3.1 rule additions, not code regressions:
- "Links with same href URLs must have identical link texts" (2.4.9) — new rule in Spectra; flags multiple CTAs per page pointing to same URL with different anchor text
- "Elements must have their visible text as part of their accessible name" (2.5.3) — new/expanded rule
- "Menus with dropdowns must include the aria-haspopup attribute" — new AI rule
- "Non-text contrast" detection improved in 6.3.1 — catching more icon/border issues

---

## 2. Performance — 36 routes

### High performers (real data — public pages)
| URL | Score | LCP | TBT | CLS | FCP | TTFB |
|---|---:|---:|---:|---:|---:|---:|
| vaultlister.com/warning.html | 100 | 1.11 | 0.08 | 0 | 0.76 | 0.15 |
| vaultlister.com/#image-bank | 99 | 1.25 | 0.14 | 0 | 0.68 | 0.02 |
| vaultlister.com/#shops | 97 | 1.27 | 0.2 | 0.01 | 0.47 | 0.02 |
| vaultlister.com/#orders-sales | 97 | 1.18 | 0.2 | 0.01 | 0.46 | 0.01 |
| vaultlister.com/#financials | 96 | 1.36 | 0.21 | 0 | 0.75 | 0 |
| vaultlister.com/#planner | 96 | 1.34 | 0.23 | 0.01 | 0.46 | 0.02 |

### Real CLS issues — needs investigation (BS-7)
| URL | CLS | Risk |
|---|---|---|
| vaultlister.com/contact.html | ~0.85 | **Poor** (>0.25 threshold) — real layout shift during page load |
| vaultlister.com/request-feature.html | ~0.86 | **Poor** (>0.25 threshold) — real layout shift during page load |
| vaultlister.com/status.html | 0.112 | Needs improvement (0.1–0.25) — retained from Apr 23 |

### Zero-score SPA routes — confirmed scanner artifacts
All hash routes that scored 0 on all render metrics (LCP/FCP/TBT/CLS all exactly 0.0 with TTFB > 0) are SPA auth redirect artifacts: scanner measured server response (TTFB) but SPA auth guard fired before any paint. Not real failures.

### CLS root cause investigation (contact.html + request-feature.html)

**Note:** CLS values (~0.85/0.86) are from the Apr 23 session reading — not directly re-verified this session (performance table sort/filter was unresponsive in Apr 24 UI). Treat as approximate.

All 46 public pages share the same async CSS loading pattern (`<link rel="preload" onload>`), the same nav logo SVG without `width` attribute, and the same cookie banner. This shared pattern alone can't explain why contact.html and request-feature.html specifically have high CLS — status.html (83 CSS custom property usages vs contact.html's 7) has only 0.112 CLS with the same pattern.

**What's unique to these two pages that needs DevTools investigation:**
- Both are form-heavy pages with significant above-fold form content
- `contact.html` has a form section with `min-height: 140px` on textarea — if the form height is impacted by late CSS, this could shift the entire page
- The cookie banner has `style="display:none;...;display:flex"` — the `display:flex` overrides `display:none` (last declaration wins in inline style). This means the banner renders visibly initially, then JS hides it. Since it's `position:fixed`, it doesn't cause CLS — but it IS a visual bug (flash of cookie banner for users who've already accepted).
- `request-feature.html` has a larger, more complex form structure

**Investigation steps:**
1. Open contact.html in Chrome DevTools → Performance tab → record load → use Layout Instability API to find which element(s) caused the shift
2. Check the cookie banner bug: `style="display:none;...;display:flex"` — the second `display` overrides the first across all public pages. Fix by removing the redundant `display:none` and letting JS control visibility instead
3. Verify whether the CLS is real by testing in Chrome locally (Lighthouse audit → CLS score)

---

## 3. Broken Link — 383

### Root cause analysis (same scan ID)

**April 23:** 17 broken links — all social media blocks  
**April 24:** 383 — 366 increase is entirely due to a new scanner issue type

| Category | Count | Attribution |
|---|---:|---|
| Component issues (CTA buttons) | 352 | **New scanner type** — JS-driven CTA buttons the headless scanner can't click. SPA `<button>` elements with `onclick` handlers. Not broken URLs. |
| Social media blocks | ~27 | Instagram (×13), Facebook (×2), X/Twitter (×1), TikTok (×1) + more. Platforms block headless scanners with 429/403. Scanner artifact FPs. |
| Real broken URLs | 2–4 | See below |

### Confirmed real broken links

| URL | Location | Notes |
|---|---|---|
| `https://twitter.com/vaultlister` | `public/documentation.html:920` | **Real bug — stale URL.** All other 40+ pages use `https://x.com/VaultListerCo`. This is the only file still using twitter.com and the old handle. Fix: change to `https://x.com/VaultListerCo`. |
| `https://rsms.me/inter/` | `public/documentation.html:865` | Inter font homepage link in media kit section. Likely scanner-blocked FP (rsms.me may 403 headless agents). Verify manually before fixing. |

### CTA component issues — why this is a scanner artifact
The 352 "component issues" are SPA `<button>` elements that the scanner correctly identifies as clickable elements but cannot execute their JavaScript `onclick` handlers. This is the same category as the April 23 `role-required` + `keyboard-interactive` pattern — the scanner sees the DOM element but can't interact with it. These map to BS-3 (SPA interactive semantics) and are already in scope.

---

## 4. Spell — 796

### Summary
**All 796 spelling errors are brand/marketplace name false positives.** Same root cause as April 23: scanner has no dictionary for VaultLister, Poshmark, Depop, Mercari, Vendoo, Grailed, etc.

### Grammar errors
| Location | Error | Status |
|---|---|---|
| `public/help/getting-started.html:265` | "publish status" → "publishing status" | **FIXED** in BS-5 prior work |
| `public/help/cross-listing.html` | 1 unknown grammar error | **Unresolved** — grep for common patterns (subject/verb agreement, article errors) found nothing. Scanner may flag a table or code snippet. Investigate by opening page and reading scanner-flagged sentences. |

### Fix: BS-5 `cspell.json`
Create `cspell.json` at repo root with project dictionary containing all marketplace names, brand terms, and technical abbreviations. CI already runs `npx cspell` — this silences the FPs without hiding real typos.

---

## 5. Website Form — 1

Down from the multi-page scanner-attributed failures in April 23. The single remaining issue is likely a form field or submit button on one public page that the scanner couldn't interact with. No code change needed unless the specific form is confirmed to fail for real users.

---

## 6. Visual — 28 unreviewed snapshots

**Percy build:** `49097670` (Visual Scanner)  
**Status:** 28 unreviewed — human approval required before any baseline changes.

### Classification guidance
- Snapshots showing the `#login` page on SPA routes = scanner artifact (auth redirect). Mark as "approved" once confirmed all SPA routes hit login screen consistently.
- Snapshots showing public page diffs since Apr 23 = compare against BS-1/BS-2 changes (contrast fixes, heading changes). If diff matches the intended fix, approve.
- Snapshots showing unexpected layout differences = investigate before approving.

---

## 7. Responsive — 36 unreviewed snapshots

**Percy build:** `49097668` (Responsive Scanner)  
**Status:** 36 unreviewed — all new baselines (no prior comparable scan at these viewports).

Since these are all new baselines, the first-run snapshots should be approved as the baseline after visually confirming each renders correctly at the target viewport. No diffs to compare — this is establishing the baseline.

---

## Action plan by PR

| PR | Title | Files | Priority | Est. effort |
|---|---|---|---|---|
| BS-1b | Extend contrast to AI-detected elements | `public/styles/public-base.css` — additional tokens beyond `--gray-400`/`--amber` | High | Low-Medium |
| BS-2b | Fix "links with same href/different text" CTAs | All public HTML files with multiple CTAs pointing to same URL | Medium | Medium |
| BS-2c | Add `aria-haspopup` to nav dropdowns | Public nav template | Medium | Low |
| BS-2d | Fix form labels on public pages (subscribe forms) | Public HTML files | Medium | Low |
| BS-3 | SPA interactive semantics | `src/frontend/ui/widgets.js`, `modals.js`, `components.js`, `src/frontend/pages/pages-core.js` | High | High |
| BS-5 | Create `cspell.json` | New file at repo root | Low | Low |
| BS-6b | Fix stale Twitter URL | `public/documentation.html:920` | Low | Trivial |
| BS-7b | Fix CLS on contact.html + request-feature.html | `public/contact.html`, `public/request-feature.html` | Medium | Low-Medium |
| BS-8 | Percy visual/responsive review | No code — human approval only | — | Low |

---

## Immediate action items (trivial fixes)

### Fix 1: documentation.html twitter.com stale URL
**File:** `public/documentation.html:920`  
**Change:** `https://twitter.com/vaultlister` → `https://x.com/VaultListerCo`  
**Risk:** None — pure URL string replacement.

### Fix 2: CLS investigation on contact.html + request-feature.html
Run Chrome DevTools Performance recording on both pages to identify the CLS source before attempting any fix. Common causes: font loading without `font-display: swap`, images without explicit dimensions, JS-injected above-fold content.

---

## Relationship to BS-0 through BS-8 plan

| Issue | Apr 23 plan | Apr 24 status |
|---|---|---|
| BS-1 color contrast | Fix `--gray-400`, `--amber-*` in public-base.css | **1,119 issues resolved** — BS-1 confirmed effective. New AI-detected contrast issues extend scope. |
| BS-2 public shell a11y | `.footer-col-label` heading, skip link, changelog search | **Retained in 1,469** — BS-2 partially applied. Heading/skip link fix confirmed. New Spectra rules added "links with same href" (182) to scope. |
| BS-3 SPA semantics | Replace div/span with button + ARIA | **563 issues on `/`** — BS-3 not yet started. Top priority. span.check (124), div.nav-dropdown-menu (112), button.public-profile-trigger (56), span.inventory-actions-label (56), div.mini-calendar-day (55). |
| BS-4 forms | Document as scanner artifact | **Confirmed** — 1 remaining, down from many. |
| BS-5 cspell.json | Create with project dictionary | **Not yet done** — still needed. |
| BS-6 social links | Manual verification | **Still open** — twitter.com in documentation.html confirmed real. Others still need manual browser check. |
| BS-7 performance | CLS on status.html | **Expanded** — contact.html (0.85) and request-feature.html (0.86) are worse than status.html (0.112). |
| BS-8 Percy review | Human approval required | **New builds** 49097670 (28) + 49097668 (36) waiting for approval. |
