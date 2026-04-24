# Percy Visual Review — April 23, 2026

## Status: AWAITING HUMAN APPROVAL

Percy visual snapshots require human review and approval before baselines can be accepted.
Claude Code must never auto-approve Percy baselines.

## What Changed in BS-1 through BS-7

The following code changes may produce Percy diffs that require baseline updates:

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

## Review Instructions

1. Open Percy dashboard for the April 23, 2026 build
2. For each diff:
   - If the diff matches an expected change listed above → **Approve**
   - If the diff is unexpected or shows a regression → **Reject and file a bug**
3. Pay particular attention to:
   - Footer text color (should be darker — correct)
   - Button/badge colors (amber → darker brown — correct)
   - Any layout shifts or unexpected element repositioning
   - Mobile viewports (320px, 375px, 768px) — skip link must not be visible by default

## Approval Authority

Only the project owner (Mathew Cheung) may approve Percy baselines.
No automated approval is permitted.

## Percy Build Links

Add Percy build URLs here after running a new scan:
- Build URL: _[paste here after next Percy run]_
