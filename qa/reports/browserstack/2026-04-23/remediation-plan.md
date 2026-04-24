# VaultLister BrowserStack/Percy Codex Remediation Plan

Generated from the uploaded BrowserStack CSV exports and Percy links supplied in this conversation.

## Source files used
- `exported_reports_site-scanner_Build#6_23+April+'26_Exported_23-04-2026_20776.csv`
- `content_checker_report_vaultlister.com-2_4dawnqozanuccs875juu1gxetg1wjpztnytburdd.csv`
- `form-scanner-report_vaultlister.com-2_4dawnqozanuccs875juu1gxetg1wjpztnytburdd.csv`
- `functional_report_vaultlister.com-2_4dawnqozanuccs875juu1gxetg1wjpztnytburdd.csv`
- `performance_report_vaultlister.com-2_4dawnqozanuccs875juu1gxetg1wjpztnytburdd.csv`

## What the exports actually show

| Area | Rows | Main signal |
|---|---:|---|
| Accessibility | 2437 | color-contrast dominates |
| Content checker | 806 | mostly dictionary false positives |
| Forms | 51 | 23 failed submissions |
| Functional links | 17 | social URLs returning no response |
| Performance | 48 | public pages mostly strong; app/hash routes need investigation |

The dashboard screenshot was useful, but the CSV exports are more precise. They change the plan: content checking is mostly a dictionary/config problem, forms have many more failed rows than the screenshot implied, and functional/broken-link issues are concentrated in a small set of social URLs.

## Accessibility breakdown

| Severity | Count |
|---|---:|
| serious | 1832 |
| moderate | 314 |
| minor | 286 |
| critical | 5 |

| Issue type | Count |
|---|---:|
| color-contrast | 1268 |
| hidden-content | 258 |
| consistent-identification-links | 191 |
| missing-heading | 140 |
| role-required | 133 |
| keyboard-interactive | 128 |
| label-content-name-mismatch | 60 |
| non-text-control-contrast | 39 |
| aria-expandable-region | 38 |
| bypass-blocks-skip-links | 28 |
| consistent-navigation-relative-order | 28 |
| meaningful-alt-text-ai | 19 |
| distinguishable-link | 17 |
| aria-allowed-role | 17 |
| decorative-image | 13 |

### Accessibility root causes

1. **Color contrast is the largest issue.** There are 1,268 color-contrast rows. The most repeated pair is `#9ca3af` on `#ffffff`, which appears 670 times. This strongly points to shared public CSS and footer/text tokens rather than hundreds of unique page bugs.
2. **Public shell/template issues are large.** Public top-level, compare, help, and blog pages account for most rows. Footer labels, repeated nav/dropdown controls, language/currency controls, link naming, and hidden dropdown/FAQ content repeat across pages.
3. **The authenticated SPA has real keyboard/semantic issues.** The `/` route accounts for all 133 `role-required` rows and all 128 `keyboard-interactive` rows. These are not cosmetic. They are clickable `div` patterns such as heatmap cells, calendar days, recent item cards, activity rows, folder items, and upload zones.
4. **The existing axe test baseline cannot be treated as proof of success.** It baselines known issues such as color contrast, labels, button names, select names, and ARIA children. BrowserStack is surfacing the backlog that the current regression test allows.

## Content checker breakdown

| Text | Count | Likely action |
|---|---:|---|
| `VaultLister` | 359 | dictionary |
| `Poshmark` | 69 | dictionary |
| `Vendoo` | 42 | dictionary |
| `Primelister` | 40 | dictionary |
| `Crosslist` | 39 | dictionary |
| `Flyp` | 37 | dictionary |
| `Depop` | 32 | dictionary |
| `Mercari` | 31 | dictionary |
| `OneShop` | 19 | dictionary |
| `SellerAider` | 19 | dictionary |
| `Grailed` | 17 | dictionary |
| `Closo` | 17 | dictionary |

Only four grammar rows are present. Two are clear singular/plural issues: `0 of 1 items sold` and `1 purchases tracked`. The other two are style suggestions around "publish status" vs "publishing status."

## Forms breakdown

| Form | Success | Failed |
|---|---:|---:|
| apply-form | 0 | 12 |
| contact-form | 8 | 0 |
| fr-form | 0 | 1 |
| register-form | 0 | 10 |
| subscribe-form | 20 | 0 |

The important correction: forms are not just "3 issues." The CSV has 23 failed submissions. The recurring failures are `apply-form`, `register-form`, and the `fr-form` on request-feature. Contact and subscribe forms passed in the exported report.

## Functional link breakdown

| Resource | Count |
|---|---:|
| `https://www.instagram.com/vaultlister.co/` | 13 |
| `https://www.facebook.com/profile.php?id=61570865723233` | 2 |
| `https://x.com/VaultListerCo` | 1 |
| `https://www.tiktok.com/@vaultlister.co` | 1 |

These are probably either real social-profile problems or social-site bot/scanner blocking. They should be manually verified before deleting links.

## Performance breakdown

| URL | Score | Main issue |
|---|---:|---|
| `/#calendar` | 0 | scanner zero / route capture |
| `/#listings` | 0 | scanner zero / route capture |
| `/#shops` | 0 | scanner zero / route capture |
| `/#orders-sales` | 0 | scanner zero / route capture |
| `/#sales` | 0 | scanner zero / route capture |
| `/` | 0 | scanner zero / route capture |
| `/#forgot-password` | 90 | TBT |
| `/#register` | 94 | TBT |
| `/#reports` | 95 | TBT |
| `/#planner` | 96 | TBT |
| `/#analytics` | 96 | TBT |
| `/#automations` | 96 | TBT |

The six zero-score rows are suspicious because LCP/FCP/TBT/CLS are all zero while TTFB is nonzero. Treat those as scanner/route-capture investigation first, not as confirmed slow pages.

## Final Codex PR sequence

### PR 0 — Commit exports and update instructions

No application-code changes. Put the CSVs under `qa/reports/browserstack/2026-04-23/`, commit this remediation plan, commit `issue-groups.json`, and add a concise BrowserStack section to the existing `AGENTS.md`. Do not replace `AGENTS.md`.

### PR 1 — Public-site contrast and shared CSS tokens

Fix `#9ca3af` on white, amber-on-white, white-on-amber, footer text, copyright text, badges, and button/focus contrast from shared CSS first. Prefer `public/styles/public-base.css` and page-level shared styles. Do not blindly change global colors if a component-specific rule is safer.

### PR 2 — Public shell accessibility

Fix footer labels currently marked as headings, consistent link text, language/currency button accessible names, `aria-haspopup`, skip link/bypass block, link underlines/visual cues, and public dropdown/hidden-content review states.

### PR 3 — Authenticated SPA semantic controls

Fix clickable `div` patterns and keyboard access in heatmap cells, calendar days, week preview days, recent item cards, activity rows, today stats, folder items, upload zones, and collapse controls. Use native buttons where possible. Add `aria-expanded`/`aria-controls` to real collapsible controls.

### PR 4 — Forms

Fix `apply-form`, `register-form`, and `fr-form` submission failures. Contact and subscribe passed, so do not churn those except for shared form accessibility. Use dummy data only. Add Playwright coverage for success and validation failure paths.

### PR 5 — Content checker dictionary and real grammar fixes

Do not accept the checker's suggestions blindly. Create/update a project dictionary for VaultLister, marketplace names, product terms, and technical terms. Fix the two clear singular/plural rows and list the style suggestions separately.

### PR 6 — Social link review

Manually verify Instagram, Facebook, X, and TikTok URLs. If valid but blocked by scanners, document/ignore. If invalid, fix once in the shared footer/source of truth.

### PR 7 — Performance

Investigate the six zero-score app/hash routes first. Then reduce TBT on register/login/dashboard/analytics/reports/planner/automations and the CLS issue on `status.html`. Public static pages mostly scored 100.

### PR 8 — Percy visual/responsive review

Codex should not approve Percy baselines. It should prepare a `visual-review.md` from exported screenshots or manual notes. Human approval is required for visual/responsive differences.

## Ready-to-paste first Codex prompt

```text
Read the BrowserStack exports under qa/reports/browserstack/2026-04-23/.
Do not change application code yet.
Create or update qa/reports/browserstack/2026-04-23/remediation-plan.md and issue-groups.json.
Validate the issue grouping against the repo, especially public/styles/public-base.css, public/*.html, public/public-auth-nav.js, src/frontend/ui, src/frontend/components, src/frontend/pages, e2e/tests/accessibility.spec.js, and e2e/tests/public-pages.e2e.js.
Then update the existing AGENTS.md with a short BrowserStack remediation section. Do not replace AGENTS.md.
Do not approve visual baselines. Do not touch secrets, auth persistence, billing, marketplace automation, database schema, backend routes, or deployment config.
```

---

## Repo Verification — Confirmed File Mappings (2026-04-24)

The following mappings were confirmed by direct file reads against the repo. These correct or supplement the draft plan above.

### Color Contrast (1,268 rows — largest single issue group)

- `--gray-400: #9ca3af` is defined at **line 19** of `public/styles/public-base.css` and applied at lines 157, 407, 482, 497. This single token is responsible for ~670 of the 1,268 contrast violations (footer text, copyright, labels). Changing it is the highest-ROI single fix.
- `--amber-600: #d97706` and `--amber-500: #f59e0b` are also in `public-base.css` — used for primary buttons and badges. Amber-on-white (#d97706/#ffffff) fails AA.
- `--gray-500: #6b7280` used in contrast-failing pairs does NOT appear in `public-base.css` as a shared rule. It is in inline `<style>` blocks on individual pages (affiliate.html lines 84/114/128/141/159, faq.html line 37, and others). PR BS-1 must fix both the CSS variable in `public-base.css` AND the per-page inline blocks.

### Semantic Headings / Missing Heading (140 rows)

- `.footer-col-label` elements are `<p>` tags — confirmed in affiliate.html, faq.html, request-feature.html, changelog.html, compare/flyp.html (and by extension all pages sharing the same footer template). These are visually styled as section headings but carry no heading semantics.
- `aria-allowed-role` (17 rows, public top-level pages): same elements — the ARIA role mismatch derives from using `<p>` where a heading is expected.
- `public/landing.html`: confirmed h1 → h3 jump with no h2 (12 × h3, 0 × h2).
- Fix for BS-2: change `.footer-col-label` `<p>` to `<h3>` (or add `role="heading" aria-level="3"` as fallback). Verify `public-base.css` heading resets before implementing to avoid visual regression.

### Changelog Search Input (unlabeled — confirmed a11y bug)

- `public/changelog.html` has `<label class="search-shell">` wrapping `<input id="changelog-search" type="search">` but the label contains only a decorative SVG — no text, no `for=` attribute, no `aria-label` on the input.
- Screen readers will announce only the placeholder text, which is not a reliable accessible name.
- Fix: add `aria-label="Search releases"` to `#changelog-search`. Belongs in BS-2.

### Skip Link / Bypass Blocks (28 rows)

- No skip link found in any sampled public page template (landing, affiliate, faq, request-feature). These pages share the same nav template but none has a `<a href="#main-content">Skip to main content</a>` or equivalent.
- Fix for BS-2: add a skip link to the shared nav template or to every public HTML file.

### Nav Dropdowns / Hidden Content (258 rows)

- `#dropdown-product-updates`, `#dropdown-features`, `#dropdown-resources`, `#dropdown-feedback` each appear 16× across 16 pages. These are the hidden nav dropdown panels not annotated with `aria-expanded` or `aria-controls`.
- Fix for BS-2: ensure nav toggle buttons set `aria-expanded` and the panels use `aria-hidden` toggling correctly.

### Forms — Scanner Attribution Confirmed

- **`apply-form`**: Static HTML exists ONLY in `public/affiliate.html` (confirmed by grep across all `public/**/*.html` and all `public/*.js`). Not injected by `public-auth-nav.js` or any shared script.
  - The form has no `action` attribute — entirely JS-driven via inline IIFE that fetches `POST /api/affiliate-apply`.
  - `/api/affiliate-apply` is a **public endpoint** (confirmed: `src/backend/routes/affiliate-apply.js` line 2 comment, rate-limited only, no CSRF check).
  - Scanner failure: native `form.submit()` with no `action` POSTs to current page URL. Multi-page failures are crawl-attribution artifacts.
  - **No code change needed for BS-4.** Document as scanner artifact.

- **`fr-form`**: In `public/request-feature.html` only (confirmed).
  - Uses `getMutationHeaders()` → GETs `X-CSRF-Token` from `/api/settings/announcement` response header.
  - `GET /api/settings/announcement` is a **public endpoint** (confirmed: `src/backend/routes/settings.js` lines 11–26, no auth check).
  - Scanner failure: scanner does not execute the two-step CSRF fetch.
  - Real users (authenticated or not) can always get the CSRF token. **No code change needed.**

- **`register-form`**: In SPA only (`src/frontend/pages/pages-core.js` + `core-bundle.js`). Failures on public pages are scanner navigation artifacts from clicking "Get Started" CTAs.

### Performance Zero-Score Routes

- All 6 zero-score routes (`/#calendar`, `/#listings`, `/#shops`, `/#orders-sales`, `/#sales`, `/`) have TTFB > 0 but LCP/FCP/TBT/CLS all exactly 0.0.
- This is physically impossible for a real rendered page. It occurs when the scanner receives a TCP/HTTP response (TTFB measured) but the SPA requires auth and redirects before any paint event fires.
- **Not real performance failures.** Investigate only to confirm (BS-7).
- `/status.html` CLS = 0.112 is a **real issue** — the only non-SPA page with a confirmed layout-shift value.

### cspell Dictionary

- `cspell.json` does NOT exist in the repo (confirmed by glob). Must be created in BS-5.
- CI runs `npx cspell "src/**/*.js" "public/*.html" --no-progress` with no `--config` flag. cspell auto-discovers `cspell.json` at repo root.

### SPA Interactive Elements

- `src/frontend/ui/` contains: `modals.js`, `widgets.js`, `components.js` (confirmed).
- `src/frontend/components/` contains: `photoEditor.js`, `chatWidget.js` (confirmed — smaller scope than initially estimated; BS-3 focus is `src/frontend/ui/` and `src/frontend/pages/`).
- `e2e/tests/accessibility.spec.js` uses a `KNOWN_RULES` per-page baseline (confirmed, 178 lines). Baseline includes `color-contrast`, `label`, `button-name`, `select-name`, `aria-required-children`. Reduce ONLY after corresponding BrowserStack group is fixed.

### Content Checker

- 802 of 806 rows are Spell false positives for product/marketplace names. Only 4 Grammar rows are real:
  1. `0 of 1 items sold` → `0 of 1 item sold` (SPA analytics, `/?app=1#analytics`)
  2. `1 purchases tracked` → `1 purchase tracked` (SPA financials, `/?app=1#financials`)
  3. `publish status` → `publishing status` (`public/help/getting-started.html`)
  4. `publish` → `publishing` (`public/help/cross-listing.html`)
