# VaultLister BrowserStack/Percy Codex Handoff

## Purpose

Use this package to hand the BrowserStack Website Scanner and Percy scan cleanup to Codex in a controlled, evidence-based way.

The goal is not to ask Codex to “fix everything.” The goal is to make Codex prove the issue grouping against the repo first, then implement small, reviewable PRs with test evidence.

## Files included

Place these files in the repo root by unzipping this package there:

```text
qa/reports/browserstack/2026-04-23/accessibility.csv
qa/reports/browserstack/2026-04-23/content-checker.csv
qa/reports/browserstack/2026-04-23/forms.csv
qa/reports/browserstack/2026-04-23/functional.csv
qa/reports/browserstack/2026-04-23/performance.csv
qa/reports/browserstack/2026-04-23/remediation-plan.md
qa/reports/browserstack/2026-04-23/issue-groups.json
```

## Non-negotiable rules for Codex

- Do not fix everything in one PR.
- Do not approve Percy or BrowserStack visual baselines automatically.
- Do not replace `AGENTS.md`; only add a short BrowserStack remediation section.
- Do not touch secrets, `.env`, auth persistence, billing, marketplace automation, database schema, backend routes, or deployment configuration unless a specific task explicitly requires it.
- Use the existing repo QA tools before adding new tools.
- Treat existing axe tests as regression guards, not proof that the BrowserStack backlog is fixed.
- Fix root causes first: shared CSS, public templates, shared components, and repeated SPA patterns.

## First Codex task: verification only, no code changes

Paste this into Codex first:

```text
You are working in the VaultLister repo.

Goal: verify the BrowserStack/Percy remediation strategy against the current repo before any app-code changes.

Inputs:
- qa/reports/browserstack/2026-04-23/accessibility.csv
- qa/reports/browserstack/2026-04-23/content-checker.csv
- qa/reports/browserstack/2026-04-23/forms.csv
- qa/reports/browserstack/2026-04-23/functional.csv
- qa/reports/browserstack/2026-04-23/performance.csv
- qa/reports/browserstack/2026-04-23/remediation-plan.md
- qa/reports/browserstack/2026-04-23/issue-groups.json

Read, verify, and update the remediation plan against the actual repository.

Inspect at minimum:
- AGENTS.md
- package.json
- public/*.html
- public/styles/public-base.css
- public/public-auth-nav.js
- src/frontend/ui/
- src/frontend/components/
- src/frontend/pages/
- src/frontend/styles/
- e2e/tests/accessibility.spec.js
- e2e/tests/public-pages.e2e.js
- scripts/
- .github/workflows/

Do not edit application code.
Do not add dependencies.
Do not approve or update Percy/BrowserStack visual baselines.

Deliverables:
1. Update qa/reports/browserstack/2026-04-23/remediation-plan.md with repo-verified file mappings.
2. Update qa/reports/browserstack/2026-04-23/issue-groups.json if the existing grouping is wrong.
3. Create qa/reports/browserstack/2026-04-23/codex-verification.md with:
   - confirmed root causes
   - uncertain root causes
   - exact files likely responsible
   - scripts/tests that should be run per PR
   - recommended final PR sequence
   - risks or blockers
4. Update the existing AGENTS.md with a short BrowserStack remediation section.

AGENTS.md change constraints:
- Do not replace the file.
- Add only a concise BrowserStack remediation section.
- Mention that exports live under qa/reports/browserstack/YYYY-MM-DD/.
- Mention priority order: accessibility, forms, broken-link/CTA semantics, responsive, performance, spelling/content, visual review.
- Mention that existing axe tests baseline known violations and should be reduced only after fixes are verified.
- Mention that Percy/visual baselines require human approval.

Before finishing, run only lightweight checks needed for documentation/config-only changes, such as formatting or markdown checks if available.

Final response must include:
- files changed
- checks run
- findings that changed the proposed plan
- whether the next PR should begin with public contrast, public shell accessibility, SPA interactive semantics, forms, content, social links, performance, or visual review
```

## Confidence gate after first task

Do not let Codex proceed to code fixes until it has produced `codex-verification.md` and you have reviewed whether the plan changed.

A satisfactory verification result should say:

- the exported CSVs were parsed successfully;
- the highest-volume accessibility failures were mapped to concrete files/components;
- form failures were mapped to exact form files or handlers;
- content-checker false positives were separated from real copy issues;
- functional/social link issues were either confirmed as real URLs or scanner-blocked social URLs;
- performance zero-score routes were treated as investigation items, not proof of broad slowness;
- visual/Percy diffs were left for human review.

## PR sequence after verification

Use these as separate Codex tasks only after the verification pass.

### PR 1: Public-site contrast

```text
Use qa/reports/browserstack/2026-04-23/accessibility.csv and issue-groups.json.

Fix repeated public-site contrast issues first.

Primary files:
- public/styles/public-base.css
- public/*.html only where page-level styles cause the issue

Focus on:
- #9ca3af on white
- muted text
- footer text and links
- copyright text
- amber/primary button text contrast
- badges
- cookie or secondary buttons
- visible focus states

Do not redesign the site.
Do not change copy except where necessary for accessibility labels.
Do not touch backend, billing, auth persistence, marketplace automation, database schema, secrets, or deployment config.

Run relevant existing scripts, especially:
- bun run lint:css
- bun run lint:html
- bun run test:e2e:public if feasible

Final response must include:
- files changed
- BrowserStack issue groups addressed
- tests run and results
- any remaining contrast risks
```

### PR 2: Public shell accessibility

```text
Use accessibility.csv, functional.csv, and issue-groups.json.

Fix repeated public shell/template accessibility issues.

Primary targets:
- public navigation
- mobile nav
- footer
- dropdowns
- language selector
- currency selector
- CTAs
- skip link
- repeated links
- icon-only controls

Rules:
- Use <button> for actions.
- Use <a> for navigation.
- Ensure icon-only controls have accessible names.
- Keep aria-expanded accurate on dropdowns/mobile nav.
- Ensure link text is descriptive or has accessible context.
- Preserve visual design.

Do not change business logic.
Run:
- bun run lint:html
- bun run lint:css
- bun run test:e2e:public if feasible
```

### PR 3: Authenticated SPA interactive semantics

```text
Use accessibility.csv and issue-groups.json.

Fix repeated SPA interactive semantics issues.

Primary targets:
- clickable div/span patterns
- calendar cells
- heatmap cells
- recent item cards
- activity rows
- folder items
- upload zones
- collapse/expand controls
- custom select/menu/listbox patterns

Prefer native <button>, <a>, <select>, and semantic elements over ARIA-heavy fixes.

Primary directories:
- src/frontend/ui/
- src/frontend/components/
- src/frontend/pages/
- src/frontend/styles/
- e2e/tests/accessibility.spec.js

Only reduce axe baselines after the relevant BrowserStack issue group is actually fixed.
```

### PR 4: Forms

```text
Use forms.csv.

Fix failed submissions for:
- apply-form
- register-form
- fr-form

Do not churn contact-form or subscribe-form unless shared code requires it.

Audit labels, input types, validation, aria-describedby, error messaging, success states, and focus after errors.

Use dummy data only.
Do not submit real production data.
```

### PR 5: Content dictionary and real copy fixes

```text
Use content-checker.csv.

Separate false positives from real issues.

Add or update a project dictionary/config for terms like:
- VaultLister
- Poshmark
- Vendoo
- Primelister
- Crosslist
- Depop
- Mercari
- OneShop
- SellerAider
- Grailed
- SKU
- COGS
- OAuth
- PostgreSQL
- Bun
- Playwright

Do not accept incorrect corrections like VaultLister -> Vault Lister or Poshmark -> Postmark.

Fix only real spelling/grammar issues.
Create content-review-needed.md for uncertain items.
Also flag marketplace-count and trial-length copy drift rather than guessing.
```

### PR 6: Social/functional links

```text
Use functional.csv.

Verify the Instagram, Facebook, X, and TikTok links.

If links are invalid, fix them in the shared footer/source.
If links are valid but blocked by scanner/social platform behavior, document them in qa/reports/browserstack/2026-04-23/functional-review.md.

Do not delete social links blindly.
```

### PR 7: Performance investigation and low-risk fixes

```text
Use performance.csv.

Investigate zero-score app/hash routes first.
Treat them as scanner/app-rendering investigation items, not proof of broad slowness.

Then apply only low-risk fixes for:
- TBT on app/auth routes
- CLS on status.html
- oversized or non-lazy images
- render-blocking assets
- font loading issues

Do not change the build system, deployment config, backend architecture, or database.
```

### PR 8: Percy visual/responsive review packet only

```text
Use exported Percy screenshots if available and the provided Percy links for context.

Create:
qa/reports/browserstack/2026-04-23/visual-review.md

For each unreviewed visual/responsive diff, list:
- URL
- viewport/device
- likely file/component
- suspected cause
- risk level
- whether it overlaps with an accessibility or responsive issue

Do not approve Percy baselines.
Do not update visual snapshots.
Do not make styling changes unless they clearly correspond to a verified accessibility/responsive bug.
```

## How to use with GitHub/Codex Cloud

1. Create a branch, for example:

```bash
git checkout -b qa/browserstack-2026-04-23-handoff
```

2. Unzip this package into the repo root.
3. Commit the reports and handoff files.
4. Push the branch.
5. Open a PR called: `BrowserStack/Percy QA handoff: April 23 scan`.
6. In the PR, comment the first Codex task from above.
7. After Codex finishes, comment:

```text
@codex review for scope control, accessibility regressions, accidental visual baseline approvals, and unsafe changes to auth/billing/backend/marketplace automation.
```

## Final confidence target

Treat the project as “operationally confirmed” only when:

- Codex verification pass completed;
- CI passes on each PR;
- relevant Playwright/public/accessibility checks pass;
- BrowserStack re-scan shows resolved issues or documented retained exceptions;
- Percy visual/responsive diffs are reviewed by a human;
- no secrets, auth, billing, database, backend route, deployment, or marketplace automation changes are introduced accidentally.
