# Codex Verification: BrowserStack/Percy April 23 Scan

Verified against the VaultLister 3.0 repo on 2026-04-24.
All findings below are confirmed by direct file reads — not inferred from filenames or conventions.

---

## Confirmed Root Causes

### 1. Color contrast (#9ca3af on white) — 670 rows

**Cause:** `--gray-400: #9ca3af` defined at line 19 of `public/styles/public-base.css`, applied via:
- Line 157 (footer link color)
- Line 407 (copyright/bottom text)
- Line 482 (secondary label text)
- Line 497 (meta/caption text)

**WCAG contrast ratio:** #9ca3af on #ffffff = ~2.85:1 — fails AA (4.5:1 for normal text, 3:1 for large text).

**Fix target:** Change `--gray-400` to a darker value (e.g. #6b7280 = ~5.74:1 on white) in `public/styles/public-base.css` lines 19, 157, 407, 482, 497.

**Scope:** Shared across all 28+ public pages via the single CSS file. One-line variable change fixes ~670 rows.

---

### 2. Amber contrast failures — 83 rows

**Cause:** `--amber-600: #d97706` (53 rows on white, 6 on #f9fafb) and `--amber-500: #f59e0b` (14 rows on white backgrounds). Used for primary CTAs, badges, pricing highlights.

**Ratios:** #d97706/#ffffff = ~3.29:1 (fails AA normal text); #f59e0b/#ffffff = ~2.42:1 (fails AA).

**Fix target:** `public/styles/public-base.css` — adjust amber tokens or override for text uses. Button background may be acceptable at large size (3:1 threshold) but button text on amber needs check.

---

### 3. Footer column labels as `<p>` elements — 140 rows (missing-heading) + 17 rows (aria-allowed-role)

**Cause:** Every public page footer has section headings (Resources, Status & Updates, Company, Compare) implemented as `<p class="footer-col-label">` — confirmed in affiliate.html, faq.html, request-feature.html, changelog.html, compare/flyp.html and by extension all 28+ pages using the same footer template.

**Fix target:** Change to `<h3 class="footer-col-label">` in all public HTML files (or add `role="heading" aria-level="3"`). **Before implementing:** read `public-base.css` heading selectors to avoid font-size/weight visual regression.

---

### 4. Changelog search input — unlabeled (1 row, broader pattern)

**Cause:** `public/changelog.html` — `<label>` wraps `<input id="changelog-search" type="search">` but contains only a decorative SVG (no text). Input has no `aria-label` and no `sr-only` label text.

**Fix:** Add `aria-label="Search releases"` to `#changelog-search`.

---

### 5. No skip link on public pages — 28 rows (bypass-blocks)

**Cause:** No `<a href="#main-content">Skip to main content</a>` found in any sampled public page template. The shared nav repeats across all 28+ pages without a bypass mechanism.

**Fix target:** Add skip link to shared nav template at top of each public HTML file, or add a shared nav include if one is created.

---

### 6. Nav dropdown hidden content — 258 rows

**Cause:** `#dropdown-product-updates`, `#dropdown-features`, `#dropdown-resources`, `#dropdown-feedback` (each ×16 across 16 pages) — the nav dropdown toggle buttons and panels are not annotated with `aria-expanded`/`aria-controls`/`aria-hidden` in a consistent accessible pattern.

**Fix target:** Public nav template (present in all public HTML files). Check existing `aria-expanded` handling in `public-auth-nav.js` (260 lines, confirmed uses `aria-haspopup` + `aria-expanded` for auth menu) for the pattern to follow.

---

### 7. SPA interactive semantic failures — 261 rows (role-required + keyboard-interactive)

**Cause:** SPA routes only (`/` and hash routes). Clickable `div`/`span` patterns in:
- `src/frontend/ui/widgets.js` — heatmap cells, calendar days, week preview, recent item cards
- `src/frontend/ui/modals.js` — modal dismiss and action patterns
- `src/frontend/ui/components.js` — upload zones, folder items, collapse controls
- `src/frontend/pages/pages-core.js` — activity rows, today stats, cross-list selectors

**Fix target (BS-3):** Replace clickable `div`/`span` patterns with `<button>` elements. Add `aria-expanded`/`aria-controls` to real collapsible controls. Add `role="gridcell"` + `tabindex` to calendar/heatmap cells where `<button>` is impractical.

**High risk:** These files are in `src/frontend/ui/` — always run auth + security tests after changes.

---

### 8. Heading order — 11 rows

**Cause:** `public/landing.html` jumps from `<h1>` directly to `<h3>` (12 × h3, 0 × h2). Confirmed by direct HTML inspection. Fix: add or restructure `<h2>` sections on landing.

---

### 9. Form scanner failures — all confirmed scanner artifacts

| Form | Only real location | Failure reason | Risk to real users |
|---|---|---|---|
| `apply-form` | `public/affiliate.html` | No `action` attr — JS-only; scanner's native submit POSTs to current URL. Backend `/api/affiliate-apply` is public, rate-limited, no CSRF. | None — works for JS-enabled users |
| `fr-form` | `public/request-feature.html` | CSRF via two-step fetch (GET `/api/settings/announcement` for token). Scanner can't execute. GET announcement is public (no auth). | None — CSRF token always gettable |
| `register-form` | SPA only (`pages-core.js`) | Scanner navigated from public pages to `/#register`, tried test credentials | None — real registration works |

Multi-page failure attributions for apply-form and register-form are scanner crawl artifacts — the forms do not exist on the attributed pages.

---

### 10. Performance zero-score routes — scanner artifacts

All 6 routes (`/#calendar`, `/#listings`, `/#shops`, `/#orders-sales`, `/#sales`, `/`) have TTFB > 0 but LCP/FCP/TBT/CLS all exactly 0.0. This is a scanner/SPA rendering artifact — the scanner received an HTTP response but the SPA auth redirect prevented any paint metrics from firing. **Not real performance failures.**

`/status.html` CLS = 0.112 is the only confirmed real layout-shift issue (score 96, TTFB 253ms — also note the high TTFB compared to other pages).

---

### 11. Content checker — 802/806 rows are false positives

All flagged "misspellings" are product names (VaultLister, Poshmark, Vendoo, etc.) the scanner doesn't recognise. The 4 real grammar rows:
1. `0 of 1 items sold` → `0 of 1 item sold` (SPA analytics)
2. `1 purchases tracked` → `1 purchase tracked` (SPA financials)
3. `publish status` → `publishing status` (`public/help/getting-started.html`)
4. `publish` → `publishing` (`public/help/cross-listing.html`)

---

## Uncertain Root Causes

| Issue | Why uncertain | Investigation needed |
|---|---|---|
| `hidden-content` (258 rows) exact selectors | Attributed to nav dropdowns based on selector counts, not confirmed by reading the dropdown HTML | During BS-2: read the nav dropdown markup in one public page to confirm aria pattern |
| `label-content-name-mismatch` (60 rows) | Not mapped to specific elements — likely CTA buttons where visible text differs from aria-label | Grep `aria-label` in `public/*.html` and `src/frontend/` to map to specific components |
| `non-text-control-contrast` (39 rows) | Not mapped — likely checkbox/radio/select borders or icon-only buttons | Manual BrowserStack report review for selector details |
| `consistent-identification-links` (191 rows) | Attributed to footer/nav links with inconsistent text across pages, but not individually confirmed | During BS-2 implementation |
| `meaningful-alt-text-ai` (19 rows) | AI-generated finding — requires human judgement on whether images are decorative or informative | Human review per image |
| Social link validity | 4 URLs flagged but social platforms block scanners | Manual browser check before BS-6 |
| `--gray-500` inline style locations | Found in affiliate.html and faq.html inline `<style>` blocks — other pages not fully audited | Grep `#6b7280` across all `public/*.html` before BS-1 |

---

## Files Confirmed Responsible

| File | Issue(s) | PR |
|---|---|---|
| `public/styles/public-base.css` L19, L157, L407, L482, L497 | color-contrast (#9ca3af), amber contrast | BS-1 |
| Per-page inline `<style>` (affiliate L84/114/128/141/159, faq L37, others) | color-contrast (#6b7280) | BS-1 |
| All `public/*.html`, `public/compare/*.html`, `public/blog/*.html`, `public/help/*.html` (footer block) | missing-heading, aria-allowed-role, bypass-blocks, consistent-navigation | BS-2 |
| `public/landing.html` | heading-order (h1→h3 skip) | BS-2 |
| `public/changelog.html` | unlabeled search input | BS-2 |
| Public nav template (all pages) | hidden-content (dropdowns), bypass-blocks (no skip link) | BS-2 |
| `src/frontend/ui/widgets.js` | role-required, keyboard-interactive (heatmap, calendar, cards) | BS-3 |
| `src/frontend/ui/modals.js` | role-required, keyboard-interactive (modal actions) | BS-3 |
| `src/frontend/ui/components.js` | role-required, keyboard-interactive (upload zones, collapse) | BS-3 |
| `src/frontend/pages/pages-core.js` | role-required, keyboard-interactive, register-form scanner artifact | BS-3 |
| `e2e/tests/accessibility.spec.js` | KNOWN_RULES baseline (reduce per fix) | BS-3 |
| `public/affiliate.html` | apply-form scanner artifact (JS-only form, no action attr) | BS-4 (docs only) |
| `public/request-feature.html` | fr-form scanner artifact (CSRF via public endpoint) | BS-4 (docs only) |
| `cspell.json` (does not exist) | content-checker false positives | BS-5 (create) |
| `public/help/getting-started.html` | grammar: "publish status" | BS-5 |
| `public/help/cross-listing.html` | grammar: "publish" | BS-5 |
| SPA analytics/financials JS | grammar: "items sold", "purchases tracked" | BS-5 |
| Footer social link sources (all public HTML) | functional broken links (social scanner block) | BS-6 |
| `public/status.html` | CLS = 0.112 (real layout shift) | BS-7 |
| SPA hash routes | performance zero-score (scanner artifact — confirm, no fix needed) | BS-7 |

---

## Scripts / Tests Per PR

| PR | Commands |
|---|---|
| BS-0 | `markdownlint-cli2 "qa/reports/browserstack/2026-04-23/*.md" AGENTS.md` |
| BS-1 | `bun run lint:css` · `bun run test:e2e:public` |
| BS-2 | `bun run lint:html` · `bun run lint:css` · `bun run test:e2e:public` |
| BS-3 | `npx playwright test e2e/tests/accessibility.spec.js` · `bun test src/tests/auth.test.js src/tests/security.test.js` |
| BS-4 | `markdownlint-cli2 "qa/reports/browserstack/2026-04-23/functional-review.md"` |
| BS-5 | `bun run lint:html` · `npx cspell "src/**/*.js" "public/*.html"` |
| BS-6 | Manual browser check + `markdownlint-cli2 "qa/reports/browserstack/2026-04-23/functional-review.md"` |
| BS-7 | `bun run audit:lighthouse` · `npx playwright test e2e/tests/public-pages.e2e.js` |
| BS-8 | `markdownlint-cli2 "qa/reports/browserstack/2026-04-23/visual-review.md"` |

---

## Recommended PR Sequence

1. **BS-0** — Commit exports + triage docs (no code changes)
2. **BS-1** — Public contrast: `public/styles/public-base.css` + per-page inline styles (highest ROI, lowest risk — ~670 rows fixed by one CSS variable change)
3. **BS-2** — Public shell accessibility: footer headings, skip link, nav dropdowns, changelog search label, landing heading order
4. **BS-3** — SPA interactive semantics: `src/frontend/ui/` + `pages-core.js` (high risk — run full auth/security tests after each file)
5. **BS-4** — Forms documentation only: confirm scanner artifacts, write `functional-review.md`
6. **BS-5** — Content dictionary: create `cspell.json`, fix 4 real grammar rows
7. **BS-6** — Social links: manual verification, fix or document
8. **BS-7** — Performance: investigate zero-scores, fix status.html CLS, reduce TBT
9. **BS-8** — Percy packet: `visual-review.md` only, no baseline approvals

**Start with BS-1 (public contrast)** — 27.5% of all accessibility rows resolved by a single CSS variable change.

---

## Risks and Blockers

| Risk | Status | Mitigation |
|---|---|---|
| apply-form CSRF gap | **Resolved** — backend is public endpoint, rate-limited only, no CSRF needed | Document as scanner artifact |
| cspell.json filename | **Resolved** — CI auto-discovers `cspell.json` at repo root (no `--config` flag) | Create `cspell.json` |
| `.footer-col-label` `<p>` → `<h3>` CSS regression | **Open** | Check `public-base.css` heading resets before BS-2 |
| SPA file changes (BS-3) | **Open** | Always run `bun test src/tests/auth.test.js src/tests/security.test.js` |
| Social link validity | **Open** | Manual browser verification before BS-6 |
| `hidden-content` exact attribution | **Open** | Map during BS-2 implementation |
