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

Only four grammar rows are present. Two are clear singular/plural issues: `0 of 1 items sold` and `1 purchases tracked`. The other two are style suggestions around “publish status” vs “publishing status.”

## Forms breakdown

| Form | Success | Failed |
|---|---:|---:|
| apply-form | 0 | 12 |
| contact-form | 8 | 0 |
| fr-form | 0 | 1 |
| register-form | 0 | 10 |
| subscribe-form | 20 | 0 |

The important correction: forms are not just “3 issues.” The CSV has 23 failed submissions. The recurring failures are `apply-form`, `register-form`, and the `fr-form` on request-feature. Contact and subscribe forms passed in the exported report.

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

Do not accept the checker’s suggestions blindly. Create/update a project dictionary for VaultLister, marketplace names, product terms, and technical terms. Fix the two clear singular/plural rows and list the style suggestions separately.

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


