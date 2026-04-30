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
3. Live GitHub issue API
   - `gh issue list --state open --limit 200 --json number,title,labels,updatedAt,url`
   - This is a timestamped snapshot, not durable registry data.
   - The generator strips GitHub token environment variables for the first local `gh` attempt because Bun auto-loads `.env` and a stale token can override the working `gh` keyring login. It falls back to the normal environment for CI-style token auth.
4. Explicit unchecked checklist sources
   - `docs/FACEBOOK_OAUTH_COMPLIANCE.md`
   - `memory/project_automation_roadmap.md`
   - `docs/superpowers/plans/*.md`
   - `chrome-extension/README.md`
5. Source scan
   - `rg -n "TODO|FIXME" src public scripts worker design e2e qa data .github archive chrome-extension mobile nginx .agents`
   - These are engineering notes, not launch blockers unless promoted into the registry.

Dirty worktree state is intentionally excluded from the canonical generated report because it is volatile and would make `open-items:check` depend on unrelated local edits or staging state.

## Historical Inputs

These files are evidence only and must not be parsed as canonical open-item sources:

- `docs/WALKTHROUGH_MASTER_FINDINGS.md`
- `docs/MANUAL_INSPECTION.md`
- `docs/OPEN_ISSUE_TRIAGE_2026-04-12.md`
- `docs/archive/CONSOLIDATED_OPEN_ITEMS_2026-04-29.md`
- archived docs and QA reports unless a current source references them directly

## Verification

Regenerate the report with:

```powershell
bun run open-items
```

Check that the committed report is current with:

```powershell
bun run open-items:check
```
