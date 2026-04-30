# Open Items Source Policy

This directory defines the canonical open-items system for VaultLister.

## Rule

`docs/OPEN_ITEMS.md` is generated. Do not edit it directly.

Durable metadata lives in `docs/open-items/items.json`. Current status comes from the highest-priority source that can be verified.

## Source Precedence

1. `docs/open-items/items.json`
   - Durable metadata only: priority, category, blocker, next action, owner notes.
   - For walkthrough-derived items, do not let the registry override the status in `docs/walkthrough/`.
   - Registry-only items must include status and source evidence.
2. `docs/walkthrough/INDEX.md` and linked `docs/walkthrough/*.md`
   - Canonical product and walkthrough status.
   - Only explicit active-work statuses are included in the generated open-items report: `OPEN`, `OPEN / NOT VERIFIED`, `OPEN QUESTION`, `BLOCKED`, `DEFERRED`, deferred post-launch statuses, and rows explicitly marked pending/recheck.
3. `docs/reference/deep-dive-backlog.md`
   - Structural/refactor backlog only.
   - These items are read-only risk records and are not launch blockers unless promoted in `docs/open-items/items.json`.
   - The generator includes the P1/P2 rows that still require inspection before extraction/refactor work.
4. Live GitHub issue API
   - `gh issue list --state open --limit 200 --json number,title,labels,updatedAt,url`
   - This is a timestamped snapshot, not durable registry data.
   - The generator strips GitHub token environment variables for the first local `gh` attempt because Bun auto-loads `.env` and a stale token can override the working `gh` keyring login. It falls back to the normal environment for CI-style token auth.
5. Explicit unchecked checklist sources
   - `docs/FACEBOOK_OAUTH_COMPLIANCE.md`
   - `memory/project_automation_roadmap.md`
   - `docs/superpowers/plans/*.md`
   - `chrome-extension/README.md`
6. Source scan
   - `rg -n "TODO|FIXME" src public scripts worker design e2e qa data .github archive chrome-extension mobile nginx .agents`
   - These are engineering notes, not launch blockers unless promoted into the registry.

Dirty worktree state is intentionally excluded from the canonical generated report because it is volatile and would make `open-items:check` depend on unrelated local edits or staging state.

## Retirement Classification

| Source | Classification | Treatment |
|---|---|---|
| `docs/OPEN_ITEMS.md` | Canonical generated report | Use for active backlog decisions; never edit directly. |
| `docs/open-items/items.json` | Active metadata input | Edit only for durable priority, blocker, owner, and next-action metadata. |
| `docs/walkthrough/INDEX.md` and `docs/walkthrough/*.md` | Active status inputs | Update when walkthrough/product item status changes; generator parses active statuses. |
| `docs/reference/deep-dive-backlog.md` | Active read-only structural backlog | Generator surfaces P1/P2 refactor risks separately; do not treat as launch blockers unless promoted. |
| Live GitHub issues | Active live input | Generator snapshots current open issues with `gh issue list`. |
| `docs/FACEBOOK_OAUTH_COMPLIANCE.md` | Active checklist input | Generator includes unchecked compliance checklist rows. |
| `memory/project_automation_roadmap.md` | Active checklist input | Generator includes unchecked automation roadmap rows; verify before implementation. |
| `docs/superpowers/plans/*.md` | Active checklist input | Generator includes unchecked plan rows as plan backlogs; verify against current source before implementation. |
| `chrome-extension/README.md` | Active checklist input | Generator includes unchecked future-feature rows. |
| `docs/commands/*.md`, `docs/DEPLOYMENT.md`, `docs/reference/security.md`, `docs/SECURITY-GUIDE.md` | Procedure/runbook checklists | Do not parse as product backlog; unchecked boxes are per-execution gates. |
| `docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md` | Certification runbook | Do not parse as persistent backlog; unchecked boxes apply only to a frozen certification window. |
| `docs/WALKTHROUGH_MASTER_FINDINGS.md` | Historical evidence | Do not parse; current status lives in `docs/walkthrough/*.md` and `docs/OPEN_ITEMS.md`. |
| `docs/MANUAL_INSPECTION.md` | Historical evidence | Do not parse; manual findings should be represented through walkthrough area files if still active. |
| `docs/OPEN_ISSUE_TRIAGE_2026-04-12.md` | Historical issue snapshot | Do not parse; live GitHub issue API supersedes it. |
| `docs/REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md` | Historical execution plan | Do not parse; only useful as dirty-worktree execution evidence. |
| `docs/EXHAUSTIVE_AUDIT_LEDGER_2026-04-20.md` | Historical/incomplete audit ledger | Do not parse as current backlog without re-verifying each finding. |
| `docs/LAUNCH_AUDIT_2026-04-03.md`, `docs/LAUNCH_AUDIT_FINDINGS_2026-04-05.md`, `docs/LAUNCH_READINESS_2026-04-05.md` | Historical launch-audit snapshots | Do not parse as current blockers; promote only currently verified unresolved items. |
| `docs/REPO_HARDENING_ACTION_PLAN_V2_3.md` | Historical hardening plan | Do not parse unless a fresh repo-truth check proves acceptance criteria remain open. |
| `docs/SNAPSHOT_CERTIFICATION_REPORT_*.md`, `docs/SNAPSHOT_FREEZE_2026-04-21.md` | Snapshot evidence | Do not parse as backlog; valid only for the recorded commit/deploy window. |
| `docs/archive/**`, `docs/audits/**`, `qa/reports/**` | Archived/test evidence | Do not parse as current open items unless a current source references them directly. |

## Historical Inputs

These files are evidence only and must not be parsed as canonical open-item sources:

- `docs/WALKTHROUGH_MASTER_FINDINGS.md`
- `docs/MANUAL_INSPECTION.md`
- `docs/OPEN_ISSUE_TRIAGE_2026-04-12.md`
- `docs/REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md`
- `docs/EXHAUSTIVE_AUDIT_LEDGER_2026-04-20.md`
- `docs/LAUNCH_AUDIT_2026-04-03.md`
- `docs/LAUNCH_AUDIT_FINDINGS_2026-04-05.md`
- `docs/LAUNCH_READINESS_2026-04-05.md`
- `docs/REPO_HARDENING_ACTION_PLAN_V2_3.md`
- `docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md`
- `docs/SNAPSHOT_CERTIFICATION_REPORT_2026-04-20.md`
- `docs/SNAPSHOT_CERTIFICATION_REPORT_2026-04-21.md`
- `docs/SNAPSHOT_FREEZE_2026-04-21.md`
- `docs/archive/CONSOLIDATED_OPEN_ITEMS_2026-04-29.md`
- archived docs, `docs/audits/**`, and QA reports unless a current source references them directly

## Archive/Delete Rule

Do not delete a historical tracker just because it is stale. Archive first unless every unique item has been mapped into an active input, superseded by live source truth, or explicitly classified as non-backlog runbook material.

## Verification

Regenerate the report with:

```powershell
bun run open-items
```

Check that the committed report is current with:

```powershell
bun run open-items:check
```
