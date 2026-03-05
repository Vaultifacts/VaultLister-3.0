# RISK REGISTER

Last updated: 2026-03-05

| Risk ID | Risk | Affected Systems | Probability | Impact | Mitigation | Owner | Status |
|---------|------|------------------|-------------|--------|------------|-------|--------|
| R-001 | Evidence drift due to stale artifact files | Gate docs, evidence, release decisions | Medium | High | Enforce `gate:sync` + `gate:drift-check` in verification flow | Engineering | Active |
| R-002 | Local-only config changes create false git hygiene alarms | Local developer environments | Medium | Medium | Exclude known local config (`.mcp.json`) from strict required-clean checks | Engineering | Active |
| R-003 | Cross-test contamination from shared module mocks | Unit test stability and CI reliability | Medium | High | Keep platform tests scoped; avoid global mocks that override shared crypto/auth modules | Engineering | Active |
| R-004 | Runbook checks pass on old evidence if freshness not enforced | Completion gate reliability | Low | High | Require evidence freshness window in checklist required checks | Engineering | Mitigated |
| R-005 | Large evidence payload growth impacts reviewability | Repo maintainability | Medium | Medium | Periodic evidence pruning policy and archival strategy | Engineering | Active |
