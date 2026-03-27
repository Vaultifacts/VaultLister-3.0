# REPOSITORY ANALYSIS

Last verified: 2026-03-05
Verification basis: runbook evidence + gate evaluation artifacts in `docs/evidence/`

---

## Repository Identity

| Field | Value |
|-------|-------|
| Project | VaultLister |
| Runtime | Bun + Node tooling |
| Primary DB | PostgreSQL |
| Test stack | Bun tests + Playwright |
| Runbook system | PowerShell (`runbook/`) with state + checklist + CI gate mode |

---

## Current Operational State

| Area | Status | Source |
|------|--------|--------|
| Completion gates | PASS (8/8) | `docs/evidence/GATE_EVALUATION.json` |
| Quality gates | PASS (4/4) | `docs/evidence/GATE_EVALUATION.json` |
| Runbook CI gate | PASS | `docs/evidence/RUNBOOK_CHECKLIST.md` |
| Step state tracking | PASS | `docs/evidence/runbook_state.json` |
| Runbook dashboard | PASS | `docs/evidence/RUNBOOK_DASHBOARD.md` |

---

## Architecture Notes

- Frontend, backend, database, and evidence/runbook artifacts are all present in-repo.
- Production-readiness validation currently depends on:
  - automated runbook steps
  - generated evidence documents
  - gate sync/drift scripts

---

## Known Caveats

- `docs/evidence/` is intentionally artifact-heavy and changes frequently.
- User-local config files may remain modified without affecting production gates.

---

## Source-of-Truth Pointers

- `scripts/lib/gate-evaluator.mjs`
- `runbook/all.ps1`
- `runbook/_checklist.ps1`
- `claude-docs/docs/project-control/COMPLETION_GATES.md`
- `claude-docs/docs/project-control/QUALITY_GATES.md`
