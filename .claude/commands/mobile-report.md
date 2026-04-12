# /mobile-report — Mobile Findings Summary (Release-Ready)

Reads the latest mobile audit report and produces a concise release-ready summary grouped by severity and page.

## Steps

1. `Glob docs/audits/mobile/*.md` — find all audit reports.
2. Select the most recent (by filename date). If none exist: "No mobile audit reports found. Run /mobile-audit first."
3. `Read` the full report.
4. Generate the summary below.

## Output Format

Print directly (do not write to a file unless user asks):

```markdown
# Mobile Readiness Report — [audit date]
Viewport tested: 390×844 (iPhone 14 Pro)
Source: docs/audits/mobile/mobile-audit-YYYY-MM-DD.md

## Status: [GO / NO-GO / NEEDS ATTENTION]

> NO-GO if any VERIFIED Critical or High issues are unresolved.
> NEEDS ATTENTION if VERIFIED Medium issues exist.
> GO if only Low/Cosmetic remain.

---

## Unresolved Issues

### Critical
| Page | Issue | Class | Notes |
|------|-------|-------|-------|

### High
| Page | Issue | Class | Notes |
|------|-------|-------|-------|

### Medium
| Page | Issue | Class | Notes |
|------|-------|-------|-------|

### Low / Cosmetic
| Page | Issue | Class | Notes |
|------|-------|-------|-------|

---

## Resolved Issues (this audit cycle)
| Page | Issue | Fix Commit |
|------|-------|------------|

---

## Blockers for Release
[List only VERIFIED Critical/High unresolved items. "None" if clear.]
```

## Severity Classification Guide

If the audit report doesn't already classify severity, use this:

| Issue Type | Severity |
|------------|----------|
| Page fails to render / blank screen | Critical |
| Core feature unusable on mobile (nav broken, form unsubmittable) | Critical |
| Touch targets < 44px on primary actions | High |
| iOS auto-zoom on forms | High |
| Horizontal scroll / content clipped | High |
| Widget grid unusable | High |
| Secondary touch targets < 44px | Medium |
| Minor layout misalignment | Medium |
| Text slightly tight but readable | Low |
| Cosmetic spacing issues | Cosmetic |
