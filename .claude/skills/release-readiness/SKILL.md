---
name: release-readiness
description: Pre-deploy go/no-go check for VaultLister. Verifies open critical/high launch blockers, latest mobile audit status, and CI health. Produces an explicit GO or NO-GO with a specific blocker list.
trigger: /release-readiness
---

# /release-readiness — VaultLister Pre-Deploy Go/No-Go

You are assessing whether VaultLister is ready to deploy to production. Produce an explicit GO or NO-GO with a specific list of blockers. No hedging.

## Step 1: Check Launch Audit Blockers

Read `docs/LAUNCH_AUDIT_2026-04-03.md` — this is the canonical launch audit with 12 hard blockers.

For each blocker, determine if it is:
- **RESOLVED** — fix committed and verified (check git log or MEMORY.md)
- **BLOCKED** — waiting on external action (e.g., EasyPost anti-fraud review, OAuth credentials)
- **OPEN** — not yet addressed

```bash
git log --oneline -20
```

Cross-reference with `memory/MEMORY.md` "Launch Blockers Status" section for known resolutions.

## Step 2: Check Mobile Audit

1. `Glob docs/audits/mobile/*.md` — find the most recent audit report.
2. If no report exists: note "No mobile audit on file — run /mobile-audit first."
3. If report exists: count VERIFIED issues by severity.
   - Any VERIFIED Critical or High = mobile NO-GO
   - VERIFIED Medium = conditional (note it, don't block)

## Step 3: Check CI Status

```bash
gh run list --limit 5 --branch master
```

- If latest run FAILED: NO-GO (CI is broken)
- If latest run SUCCEEDED: CI is green

## Step 4: Check for Uncommitted Changes

```bash
git status --short
```

Any staged or modified source files = note them. Uncommitted fixes don't count as resolved.

## Step 5: Produce Result

Print the report:

```
━━━ RELEASE READINESS — [date] ━━━

Result: [GO / NO-GO / CONDITIONAL GO]

━━━ HARD BLOCKERS (NO-GO if any exist) ━━━
[list of OPEN launch blockers from audit]
[list of VERIFIED Critical/High mobile issues]
[CI failures]

━━━ SOFT BLOCKERS (CONDITIONAL — note and proceed) ━━━
[BLOCKED items waiting on external action — EasyPost, OAuth credentials, etc.]
[VERIFIED Medium mobile issues]

━━━ RESOLVED ━━━
[LB-1 thru LB-12 status summary with commit hashes]
[Mobile fixes: 659ac3a, ef5daa9, 4deaa78, f80adad]

━━━ CI ━━━
Last master run: [passed/failed] — [workflow name] — [run URL]

━━━ RECOMMENDATION ━━━
[1-2 sentences: what must be done before deploying, or "Clear to deploy."]
```

## GO/NO-GO Criteria

| Condition | Result |
|-----------|--------|
| Any OPEN hard launch blocker | NO-GO |
| CI failing on master | NO-GO |
| Any VERIFIED Critical/High mobile issue | NO-GO |
| Only BLOCKED (external) items remain | CONDITIONAL GO |
| Only VERIFIED Medium mobile issues | CONDITIONAL GO |
| All clear | GO |

## Known Launch Blocker Status (as of 2026-04-10)

From MEMORY.md — verify each before trusting:
- LB-1 thru LB-9, LB-11, LB-12: RESOLVED
- LB-10 Shipping (EasyPost): BLOCKED — anti-fraud review in progress, API key not yet available
- CR-3 (Stripe price IDs): BLOCKED — user must set env vars in Railway
- CR-10 (OAuth flows, 9 platforms): OPEN — last major launch blocker
- CR-4 (EasyPost): BLOCKED — same as LB-10

Do NOT assume these statuses are current. Verify against actual git log and MEMORY.md "Active Work" section.
