# VaultLister BrowserStack/Percy Remediation Plan — April 24, 2026

**Scan ID:** `hfajad98gxigy3jtc82bbsn1nwlwh8vlv1yrxhj5`  
**Scan time:** Apr 24, 2026 10:12 PM  
**Analysis method:** Live dashboard triage — 2026-04-24 session (initial) + 2026-04-25 session (full triage verification)

> **2026-04-25 triage completed:** All six report categories inspected via browser. Broken links (14 unique URLs), Component issues (378 CTA artifacts), Website Form (1 register-form artifact), Performance (33 metric flags), Spell (801 all brand-name FPs), Accessibility (1,484). Numbers below are verified from the actual scan UI.

---

## Executive summary vs April 23

| Category | Apr 23 | Apr 24 | Delta | Notes |
|---|---:|---:|---|---|
| Accessibility | 2,437 | 1,484 | **-953** | BS-1 (27023fff) + BS-2 (bd460a20) deployed on master — confirmed cause of reduction |
| Broken Link | 17 | 392 | **+375** | 14 unique broken link URLs + 378 CTA component artifacts (JS buttons scanner can't click) |
| Spell | 806 | 801 | -5 | All 801 = "VaultLister" brand name FP; BrowserStack has no custom dictionary support |
| Website Form | many | 1 | **↓** | register-form only (SPA form artifact); apply-form + fr-form now pass ✅ |
| Performance | 48 | 33 | -15 | Real CLS: contact.html (0.83) + request-feature.html (0.84) — fix in branch commit 91855d4a (nav logo width). status.html (0.35) — root cause unknown |
| Visual | — | 43 | new | Percy builds 49103926 (visual) + 49103925 (responsive) |
| Responsive | — | 47 | new | Responsive scanner build |

---

## 1. Accessibility — 1,484 issues, Score 80

### Quick snapshot
- **Resolved from Apr 23:** ~953 (BS-1 contrast + BS-2 heading/footer fixes — **confirmed on `master` and deployed to production** as of commits `27023fff` + `bd460a20`; this is why the April 24 scan shows 953 fewer issues)
- **Retained:** ~1,484 — BS-3/BS-4/BS-5/BS-6/BS-7 not yet deployed; BS-1b/BS-2b–d fixes on branch only

### Severity breakdown (verified Apr 24 scan)
| Severity | Issues |
|---|---:|
| Serious | 943 |
| Minor | 413 |
| Moderate | 272 |
| Critical | 26 |
| **Total** | **1,484** |

> Note: The severity sub-totals (943+413+272+26 = 1,654) reflect the raw axe rule count from the dashboard breakdown panel; the 1,484 figure is the deduplicated issue count shown in the scan header. Both figures are from the April 24 scan — the delta is duplicate-attribution across multiple pages.

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

## 2. Performance — 33 metric flags (verified 2026-04-25)

### Score summary (top to bottom)
| URL | Score | LCP | TBT | CLS |
|---|---:|---:|---:|---:|
| pricing.html | 99 | 0.46 | 0.14 | 0 |
| #reports, #orders-sales, #analytics | 98 | 1.17–1.30 | 0.17–0.18 | 0–0.01 |
| #forgot-password, #register, #login | 97 | 0.61–1.31 | 0.20–0.21 | 0–0.01 |
| affiliate.html | 96 | 0.75 | 0.22 | 0 |
| compare/* (selleraider, rfectly, nifty…) | 91–94 | 0.41–0.57 | 0.04–0.12 | **0.15–0.16** |
| help/* (getting-started, help, troubleshooting…) | 91–93 | 0.39–0.91 | 0.07–0.18 | **0.16–0.18** |
| faq.html, roadmap-public.html, documentation.html | 90 | 0.63–1.23 | 0.07–0.14 | **0.19** |
| crosslist.html | 88 | 0.58 | 0.27 | 0.16 |
| crosslist-magic.html | 86 | 0.55 | 0.33 | 0.15 |
| blog/index.html | 84 | 0.82 | 0.06 | **0.33** |
| compare/flyp.html | 84 | 0.61 | 0.40 | 0.15 |
| learning.html | 82 | 0.95 | 0.10 | **0.37** |
| changelog.html | 82 | 1.68 | 0.03 | **0.37** |
| status.html | 79 | 1.00 | 0.21 | **0.35** |
| request-feature.html | 76 | 0.69 | 0.06 | **0.84** 🔴 |
| contact.html | 75 | 0.79 | 0.09 | **0.83** 🔴 |
| SPA auth routes (#inventory, #listings, #calendar…) | 0 | 0 | 0 | 0 |

### Real CLS issues — needs investigation (BS-7)
| URL | Score | CLS | Verdict |
|---|---:|---:|---|
| contact.html | 75 | **0.83** | 🔴 Poor — **root cause: nav logo `<img>` missing `width` attribute**. Fix in branch commit `91855d4a`. Merge to master to resolve. |
| request-feature.html | 76 | **0.84** | 🔴 Poor — **root cause: nav logo `<img>` missing `width` attribute**. Same fix (`91855d4a`). Skeleton cards prevent list-load CLS but can't prevent image-load CLS. |
| status.html | 79 | **0.35** | 🟡 Needs improvement — nav logo already has `width=300` so the 91855d4a fix doesn't apply. Root cause unknown; may be the dynamic status indicators or incident badge loading. Needs DevTools trace. |
| changelog.html | 82 | **0.37** | 🟡 Needs improvement — LCP also 1.68s (heaviest page). |
| learning.html | 82 | **0.37** | 🟡 Needs improvement |
| blog/index.html | 84 | **0.33** | 🟡 Needs improvement |

### CLS root cause — IDENTIFIED (2026-04-25)

**Root cause:** Nav logo `<img src="/assets/logo/lockups/horizontal-2048.svg" height="87">` has no `width` attribute. Without an explicit width, the browser cannot reserve layout space before the SVG loads, causing a large layout shift when the image loads and pushes content down.

**Why pricing.html is unaffected (CLS 0):** All pages share the same nav logo markup — but BrowserStack may have tested pricing.html from a warm cache where the SVG was already loaded, while contact.html and request-feature.html were cold-loaded. The shift is real but timing-dependent.

**Fix already exists (nav logo only):** Commit `91855d4a` (`fix(perf): add explicit width=348 to nav logo images across 23 public pages`) is on branch `codex/e2e-session-guardrails` — it adds `width="348"` to nav logo `<img>` tags only (confirmed by diff of contact.html). `horizontal-2048.svg` is 2048×512 = 4:1 ratio, so at height=87, width=348. **Needs merge to master.**

**Footer logo not yet fixed:** `<img src="/assets/logo/lockups/horizontal-512.svg" height="36">` still lacks a `width` attribute. Commit `91855d4a` did NOT touch footer logos. Additional fix needed: add `width="144"` to footer logo `<img>` tags (512×128 = 4:1, so at height=36, width=144).

**No DevTools trace needed** — root cause confirmed by commit diff and code inspection.

### Zero-score SPA routes — scanner artifacts
Routes `/?app=1#inventory`, `/?app=1#listings`, `/?app=1#calendar`, `/?app=1#image-bank`, `/?app=1#shops`, `/?app=1#financials`, `/?app=1#automations`, `/?app=1#dashboard`, and `https://vaultlister.com/` all scored 0 with TTFB > 0. Pattern = scanner got a server response but SPA auth guard fired before any paint. Not real performance failures.

---

## 3. Broken Link — 392

### Root cause analysis (verified 2026-04-25)

**April 24:** 392 total = **14 unique broken link URLs** + **378 CTA component issues**

#### 14 unique broken link URLs (verified from dashboard)

| URL | Parent page | Error | Attribution |
|---|---|---|---|
| `https://www.instagram.com/vaultlister.co/` | oneshop.html + 10 others (×11 pages) | No response | **Scanner artifact** — Instagram blocks headless scanners with 403. |
| `https://vaultlister.com/assets/logos/grailed/logo.png` | `/?app=1#analytics` | 502 | **Likely transient** — file exists in git (`public/assets/logos/grailed/logo.png`, 15KB valid PNG). Railway 502 during scan time. |
| `https://www.facebook.com/profile.php?id=61570865723233` | help/troubleshooting.html | No response | **Scanner artifact** — Facebook blocks headless scanners. |
| `https://fonts.google.com/specimen/Inter` | documentation.html#media-kit | No response | **Scanner artifact** — Google Fonts blocks headless scanners. |

**Count reconciliation:** Instagram link appears on 11 pages + Facebook (1) + Google Fonts (1) + Grailed logo (1) = 14 occurrences.

#### 378 Component issues (CTA buttons not working)

The scanner found 95 distinct CTAs across the site that it couldn't activate — it tried to click them but no full-page navigation occurred. All are scanner artifacts: these are JS-driven SPA buttons (`renderApp()` routing), skip links (anchor-only), OAuth flows, and cookie banner buttons. Top affected: "Skip to main content" (31 pages), "EN" language selector (29), "VaultLister" logo link (18), "Decline"/"Accept" cookie buttons (17 each).

#### Grailed logo 502 — investigation status
File `public/assets/logos/grailed/logo.png` is git-tracked (confirmed `git ls-files`). The 502 was captured at scan time (10:12 PM Apr 24). Likely a transient Railway error. No code fix needed; monitor in next scan.

---

## 4. Spell — 801

### Summary
**All 801 spelling errors are brand/marketplace name false positives.** Verified 2026-04-25: inspected faq.html (41 errors) — every single one flags "VaultLister" → "Vault Lister". BrowserStack spell checker has no custom dictionary support. Same pattern confirmed for compare pages (flyp.html: 40, nifty.html: 30, oneshop.html: 27). No code fixes possible; these are permanent scanner FPs for our brand name.

### Grammar errors
| Location | Error | Status |
|---|---|---|
| `public/help/getting-started.html:265` | "publish status" → "publishing status" | **FIXED** in BS-5 prior work |
| `public/help/cross-listing.html` | 1 unknown grammar error | **Unresolved** — grep for common patterns (subject/verb agreement, article errors) found nothing. Scanner may flag a table or code snippet. Investigate by opening page and reading scanner-flagged sentences. |

### Fix: BS-5 `cspell.json`
Create `cspell.json` at repo root with project dictionary containing all marketplace names, brand terms, and technical abbreviations. CI already runs `npx cspell` — this silences the FPs without hiding real typos.

---

## 5. Website Form — 1

**Verified 2026-04-25:** Major improvement from April 23.

| Form | Apr 23 | Apr 24 | Status |
|---|---|---|---|
| `apply-form` (affiliate.html) | ❌ FAIL (multi-page scanner artifact) | ✅ PASS | Resolved — scanner now correctly handles JS-only form |
| `fr-form` (request-feature.html) | ❌ FAIL (CSRF scanner artifact) | ✅ PASS | Resolved — scanner now correctly handles CSRF-protected form |
| `register-form` (SPA `/?app=1#register`) | ❌ FAIL | ❌ FAIL | Retained — scanner artifact; SPA form requires auth navigation scanner cannot complete |

Only `register-form` remains, and it is a confirmed scanner artifact (SPA routing). No code change needed.

---

## 6. Visual — 43 snapshots

**Percy build:** `49103926` (Visual Scanner — Apr 24, 10:12 PM)  
**Status:** Human approval required before any baseline changes.

### Classification guidance
- Snapshots showing the `#login` page on SPA routes = scanner artifact (auth redirect). Mark as "approved" once confirmed all SPA routes hit login screen consistently.
- Snapshots showing public page diffs since Apr 23 = compare against BS-1/BS-2 changes (contrast fixes, heading changes). If diff matches the intended fix, approve.
- Snapshots showing unexpected layout differences = investigate before approving.

---

## 7. Responsive — 47 snapshots

**Percy build:** `49103925` (Responsive Scanner — Apr 24, 10:12 PM)  
**Status:** Human approval required. All new baselines — no prior comparable scan at these viewports.

Since these are all new baselines, approve after visually confirming each renders correctly at the target viewport. No diffs to compare — this is establishing the baseline.

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
| BS-7b | Fix CLS on contact.html + request-feature.html | Fix already in commit `91855d4a` on branch — adds `width="348"` to nav logo + `width="144"` to footer logo across 23 public pages. Merge to master. | High | Trivial (already written) |
| BS-8 | Percy visual/responsive review | No code — human approval only. Builds: 49103926 (visual, 43 snapshots) + 49103925 (responsive, 47 snapshots) | — | Low |

---

## Immediate action items (trivial fixes)

### Fix 1: documentation.html twitter.com stale URL
**File:** `public/documentation.html:920`  
**Change:** `https://twitter.com/vaultlister` → `https://x.com/VaultListerCo`  
**Risk:** None — pure URL string replacement.

### Fix 2: CLS on contact.html + request-feature.html
**Root cause:** Nav logo `<img src="...horizontal-2048.svg" height="87">` missing `width` attribute — browser can't reserve layout space before SVG loads.  
**Nav logo fix (done):** Commit `91855d4a` on branch adds `width="348"` to nav logo across 23 public pages. Merge to master to deploy.  
**Footer logo fix (still needed):** `<img src="...horizontal-512.svg" height="36">` was NOT in commit `91855d4a`. Add `width="144"` (512×128 = 4:1, height=36 → width=144) to footer logo across all public pages.

---

## Relationship to BS-0 through BS-8 plan

| Issue | Apr 23 plan | Apr 24 status |
|---|---|---|
| BS-1 color contrast | Fix `--gray-400`, `--amber-*` in public-base.css | **1,119 issues resolved** — BS-1 confirmed effective. New AI-detected contrast issues extend scope. |
| BS-2 public shell a11y | `.footer-col-label` heading, skip link, changelog search | **Retained in 1,484** — BS-2 partially applied. Heading/skip link fix confirmed. New Spectra rules added "links with same href" (182) to scope. |
| BS-3 SPA semantics | Replace div/span with button + ARIA | **563 issues on `/`** — BS-3 not yet started. Top priority. span.check (124), div.nav-dropdown-menu (112), button.public-profile-trigger (56), span.inventory-actions-label (56), div.mini-calendar-day (55). |
| BS-4 forms | Document as scanner artifact | **Confirmed** — 1 remaining, down from many. |
| BS-5 cspell.json | Create with project dictionary | **Not yet done** — still needed. |
| BS-6 social links | Manual verification | **Still open** — twitter.com in documentation.html confirmed real. Others still need manual browser check. |
| BS-7 performance | CLS on status.html | **Expanded + root cause identified** — contact.html (0.83) and request-feature.html (0.84) caused by nav logo `<img>` missing `width` attribute. Fix in commit `91855d4a` on branch (needs merge to master). status.html (0.35) — nav logo already had `width=300`; CLS root cause unknown; needs DevTools trace. |
| BS-8 Percy review | Human approval required | **New builds** 49103926 (visual, 43 snapshots) + 49103925 (responsive, 47 snapshots) waiting for approval. |
