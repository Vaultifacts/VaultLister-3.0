# VaultLister 3.0 — Canonical Docs Index
# Generated: 2026-04-24
# READ-ONLY — do not edit other files from this index

This file classifies every documentation location in the repository so AI
agents know how to treat each source, whether it is safe to use as ground
truth, and whether code verification is required before acting on it.

**Override order (highest to lowest):**
1. Current source code
2. `docs/reference/repo-map.md`
3. This index + `docs/reference/` files
4. `design/` files
5. `memory/` files
6. Everything else (archive, QA reports, audit snapshots)

---

## 1. Current Canonical Docs — read first, source of truth

These files reflect the current intended architecture. Always prefer these
over any other source. If they conflict with code, verify code — the code is
the ultimate truth.

| Path | Purpose |
|------|---------|
| `CLAUDE.md` (project root) | Project-wide agent rules, stack, conventions, agent scope boundaries |
| `.claude/rules/src/RULES.md` | Source-editing rules: naming, security, SQL, auth patterns |
| `.claude/rules/tests/RULES.md` | Test rules: naming, scope, port, failure protocol |
| `docs/reference/repo-map.md` | **Highest-priority structural reference** — canonical file/folder map |
| `docs/reference/api.md` | API patterns, route conventions, auth headers |
| `docs/reference/backend.md` | Backend architecture, service layer |
| `docs/reference/database.md` | Schema, migrations, query patterns |
| `docs/reference/frontend.md` | SPA structure, store, page/handler conventions |
| `docs/reference/security.md` | CSRF, JWT, rate limiting, AES-256-GCM |
| `docs/reference/testing.md` | Test commands, baseline, protocols |
| `docs/reference/api-route-inventory.md` | Enumerated route list (derived but kept current) |
| `docs/reference/db-query-inventory.md` | Enumerated DB query inventory |
| `docs/OPEN_ITEMS.md` | **Generated canonical open-items report** — current launch blockers, pending verification items, GitHub issues, checklist backlog, and TODO/FIXME scan |
| `docs/open-items/source-policy.md` | Source precedence and regeneration rules for `docs/OPEN_ITEMS.md` |

**How to treat:** Use directly as reference for code decisions.

**Source of truth:** Yes — but always verify against actual source files
when in doubt. `docs/reference/` files dated Feb–Mar 2026 (`api.md`,
`backend.md`, `database.md`, `frontend.md`, `security.md`, `testing.md`)
may be partially stale. When writing new code, grep the actual source rather
than relying solely on reference docs.

**Verification required before use:** No for general guidance. Yes when
looking up a specific function signature, route path, or config value —
grep the source to confirm.

---

## 2. Design / Architecture Source of Truth

Design files define the intended product. They are the origin of schema,
route, and entity decisions — but the code is what is actually running.

| Path | Purpose |
|------|---------|
| `design/README.md` | Project overview, entity count, stack summary |
| `design/architecture.md` | ADRs and system decisions (ADR-001 through ADR-017) |
| `design/data-model.md` | Entities, relationships, canonical schema reference |
| `design/api-overview.md` | Route index and API patterns |
| `design/platform-integrations.md` | Marketplace OAuth details, rate limits, bot paths |
| `docs/ARCHITECTURE.md` | Architecture narrative |
| `docs/architecture-diagram.md` | Architecture diagram (may lag design/) |
| `docs/PRD.md` | Product requirements document |

**How to treat:** Use as intent/design reference. Before implementing any
entity or route, read the relevant design file.

**Source of truth:** Yes for intent. For current running state, verify
against code.

**Verification required before use:** Verify schema facts against
`src/backend/db/` migrations. Verify route facts against
`src/backend/routes/`.

---

## 3. Reference Docs — verified, use directly

These docs have been maintained during active development and are generally
safe to use as references, with the staleness caveat noted above.

| Path | Purpose |
|------|---------|
| `docs/API.md` | MFA/auth-specific API documentation (unique content) |
| `docs/API_ROUTES.md` | Route listing (may duplicate reference/api.md — verify) |
| `docs/DEPLOYMENT.md` | Railway + Cloudflare deployment procedure |
| `docs/SETUP.md` | Local dev setup |
| `docs/SECRETS-MANAGEMENT.md` | Secret rotation, env var management |
| `docs/SECURITY-GUIDE.md` | OWASP guidance, auth flows |
| `docs/BACKUP-RESTORE.md` | Backblaze B2 backup and restore procedure |
| `docs/CLOUD_BACKUP_SETUP.md` | Backup infrastructure setup |
| `docs/HEALTH-CHECK.md` | Health check endpoints |
| `docs/FACEBOOK_OAUTH_COMPLIANCE.md` | Facebook OAuth compliance notes |
| `docs/PERFECT_ANTI_DETECTION_SYSTEM.md` | Anti-detection system spec |
| `docs/FEATURE_INVENTORY.md` | Feature listing |
| `docs/FRONTEND_SOURCE_OF_TRUTH.md` | Frontend patterns reference |
| `docs/commands/` | Per-domain command runbooks (api.md, route.md, migration.md, etc.) |

**How to treat:** Use for procedural guidance (deploy, backup, dev setup).
For code facts, grep the source.

**Source of truth:** Procedural yes. Code-level details require
verification.

**Verification required before use:** For code-level facts (function names,
env vars, route paths), verify against source.

---

## 4. Historical / Archive Docs — do not treat as current truth without code verification

These files reflect a point-in-time state. Many predate the PostgreSQL
migration (March 2026), the Railway deployment, or significant refactors.
**Archived docs must not override current code.**

| Path | Notes |
|------|-------|
| `docs/archive/DATABASE_SCHEMA.md` | **Deprecated.** Old SQLite schema. Superseded by `src/backend/db/migrations/` and `pg-schema.sql`. Has deprecation notice. Do not use. |
| `docs/archive/AUDIT-FINDINGS.md` | March 2026 audit snapshot |
| `docs/archive/BUG_LOG.md` | Historical bug log |
| `docs/archive/COMPLETION_GATES.md` | Historical completion gates |
| `docs/archive/DEEP_AUDIT_2026-03-19.md` | March 2026 deep audit |
| `docs/archive/DEVOPS-AUDIT-SUMMARY.md` | March 2026 DevOps audit |
| `docs/archive/PERFORMANCE_BASELINE.md` | March 2026 performance baseline |
| `docs/archive/PROJECT_ROADMAP.md` | Historical roadmap |
| `docs/archive/STATE_SNAPSHOT.md` | Point-in-time state snapshot |
| `docs/archive/WALKTHROUGH-*.md` | March 2026 walkthrough sessions |
| `docs/archive/evidence-2026-03/` | Raw test output, gate evaluation, Docker logs from March 2026 — evidence only |

**How to treat:** Background context only. Never act on archive content
without first verifying the current code matches.

**Source of truth:** No.

**Verification required before use:** Always — assume stale.

---

## 5. QA Evidence — evidence of past state, not current truth

QA reports capture what was true when the test was run. They are not
re-verified automatically.

| Path | Notes |
|------|-------|
| `docs/LAUNCH_AUDIT_2026-04-03.md` | **Read before any launch work.** 33 findings, 12 hard blockers as of 2026-04-03. Some resolved since — verify per item. |
| `docs/LAUNCH_READINESS_2026-04-05.md` | 185 findings snapshot (2026-04-05) |
| `docs/WALKTHROUGH_MASTER_FINDINGS.md` | Legacy master walkthrough findings. Current walkthrough status is split into `docs/walkthrough/*.md`; current consolidated open items are generated into `docs/OPEN_ITEMS.md`. |
| `docs/OPEN_ISSUE_TRIAGE_2026-04-12.md` | Issue triage snapshot |
| `docs/SNAPSHOT_CERTIFICATION_REPORT_2026-04-20.md` | Snapshot cert as of 2026-04-20 |
| `docs/SNAPSHOT_CERTIFICATION_REPORT_2026-04-21.md` | Snapshot cert as of 2026-04-21 |
| `docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md` | Checklist for snapshot certs |
| `docs/SNAPSHOT_FREEZE_2026-04-21.md` | Freeze notice |
| `docs/EXHAUSTIVE_AUDIT_LEDGER_2026-04-20.md` | Full audit ledger |
| `docs/MANUAL_INSPECTION.md` | Manual inspection notes |
| `docs/CLOUDFLARE-AUDIT-2026-03-29.md` | Cloudflare audit |
| `docs/REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md` | Work execution tracking |
| `docs/REPO_HARDENING_ACTION_PLAN_V2_3.md` | Hardening plan |
| `docs/audits/` | Layered audit reports (frontend, backend, DB, scripts, tests) from March 2026 |
| `qa/reports/` | BrowserStack, generation, final reports — timestamped test evidence |
| `qa/audits/` | Domain-specific QA audits |
| `qa/domains/` | Domain-scoped QA taxonomy files |
| `qa/full_testing_taxonomy.md` | Full QA taxonomy |
| `qa/coverage_matrix.md` | Coverage matrix |
| `qa/domain_order.md` | Domain testing order |

**How to treat:** Check dates. Re-verify any specific finding against
current code before treating as open or closed. Do not use QA pass/fail
status as evidence that a feature currently works.

**Source of truth:** No — past state only.

**Verification required before use:** Always.

---

## 6. Agent / Session Memory — session continuity only, not runtime truth

These files exist to help AI agents resume context across sessions. They
are maintained by convention and may lag code changes by hours or days.

| Path | Notes |
|------|-------|
| `memory/STATUS.md` | Current in-progress and pending tasks — check at session start |
| `memory/MEMORY.md` | Cross-session facts index — pointers to memory detail files |
| `memory/COMPLETED.md` | Completed task log |
| `memory/LAUNCH_PRIORITY.md` | Launch priority list |
| `memory/TIER0_PLAYBOOK.md` | Tier-0 incident playbook |
| `memory/feedback_*.md` | Behavioral feedback for agents |
| `memory/project_*.md` | Project-scoped memory files |
| `~/.claude/projects/.../memory/MEMORY.md` | Global memory index (cross-project) |

**How to treat:** Use for task continuity and behavioral context only.
**Never** use memory files to answer questions about current code state
(function signatures, route existence, schema columns, env vars). Memory
files describe what was believed to be true at the time of writing —
always verify against source code.

**Source of truth:** No — session continuity aid only.

**Verification required before use:** Always. Grep or read the actual
source file to confirm before acting on any memory claim about code.

---

## 7. Generated or Derived Reports

These files are produced by tools, scripts, or automated processes. They
are accurate at generation time but are not maintained.

| Path | Notes |
|------|-------|
| `docs/COMPETITOR_*.md` (17 files) | Competitor research generated 2026-04-18/19. T1-verified at generation time. |
| `docs/audits/mobile/` | Mobile audit reports |
| `qa/reports/browserstack/` | BrowserStack test run outputs |
| `qa/reports/audits/` | Audit report outputs |
| `qa/reports/final/` | Final QA report outputs |
| `qa/reports/generation/` | AI-generated QA content |
| `qa/prompts/` | QA prompt templates |
| `qa/specs/` | QA test specs |
| `docs/superpowers/plans/` | Plan files from superpowers plugin |
| `docs/superpowers/specs/` | Spec files from superpowers plugin |
| `docs/image*.png` (106 images) | Screenshot evidence — visual only, not executable |

**How to treat:** Treat as point-in-time snapshots. Competitor research
reflects market state as of April 2026. BrowserStack reports reflect the
build that was tested — re-run tests to get current state.

**Source of truth:** No — derived/generated.

**Verification required before use:** Yes, for any factual claim about
current code or product state.

---

## Quick-Reference Rules for AI Agents

1. **Archived docs must not override current code.** If `docs/archive/`
   says X and the source code says Y, Y is correct.

2. **`memory/` files are session continuity aids — verify against code
   before acting on them.** Never trust a memory file claim about a
   function name, route path, or schema column without grepping the source.

3. **QA reports reflect past state — re-verify before treating as current.**
   A QA Pass from April 2026 does not mean the feature passes today.

4. **`docs/reference/` files dated Feb–Mar 2026 may be stale.** Specifically:
   `api.md`, `backend.md`, `database.md`, `frontend.md`, `security.md`,
   `testing.md` were written during early development. Use them for
   orientation, then confirm specifics in source.

5. **`docs/reference/repo-map.md` and current source code take priority
   over all other sources.** When any two sources conflict, check the code.

6. **`docs/archive/DATABASE_SCHEMA.md` is deprecated.** It documents the
   old SQLite schema. The current schema is PostgreSQL — see
   `src/backend/db/migrations/` and any `pg-schema.sql` file.

7. **`docs/LAUNCH_AUDIT_2026-04-03.md` is the authoritative blocker list**
   as of its date. Some blockers have been resolved since — check
   `memory/STATUS.md` and `memory/COMPLETED.md` for resolution status,
   then verify in code.
