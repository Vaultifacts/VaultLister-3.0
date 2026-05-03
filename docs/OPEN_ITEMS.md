<!-- GENERATED FILE. DO NOT EDIT DIRECTLY. Run `bun run open-items` instead. -->

# VaultLister Open Items

Generated at: 2026-05-03T23:13:15.281Z
Commit: 22efee17
Generator: `bun scripts/generate-open-items.mjs`
Check: `bun run open-items:check`

Source priority: `docs/open-items/items.json` metadata > current `docs/walkthrough/` status > structural/refactor backlog > live GitHub issues > explicit checklists > specialized research/design backlogs > source scans.

## Summary

| Section | Count |
|---|---:|
| Launch blockers | 2 |
| Open walkthrough/product items | 0 |
| Fixed pending live/manual verification | 1 |
| Deferred/post-launch items | 10 |
| Structural/refactor backlog items | 10 |
| Competitor intelligence gaps | 862 |
| Anti-detection/design gaps | 11 |
| Open GitHub issues | 1 |
| Explicit unchecked checklist items | 359 |
| Repo-wide unchecked checkbox hits | 624 |
| Repo-wide unchecked checkbox hits included | 359 |
| Repo-wide unchecked checkbox hits excluded or review-only | 265 |
| Open-marker source files discovered | 215 |
| Source TODO/FIXME hits | 14 |

## Source Coverage Audit

This section proves the consolidation boundary. It lists every source with unchecked Markdown task boxes and every text/config source with open-style markers found by the generator. Sources marked excluded are not treated as active backlog unless a current source promotes them.

### Unchecked Checklist Source Coverage

Command: `rg -n "^\s*[-*]\s+\[ \]" <document targets> --glob "*.md"`

| Source | Matches | First Match | Treatment |
|---|---:|---:|---|
| docs/reference/cr10-oauth-connect-checklist.md | 41 | 10 | Excluded pending source-policy review |
| .agents/skills/mobile-audit/SKILL.md | 6 | 75 | Excluded: agent skill runbook checklist, not persistent backlog |
| docs/archive/evidence-2026-03/RUNBOOK_CHECKLIST.md | 4 | 25 | Excluded: historical evidence, verify before promotion |
| docs/LAUNCH_AUDIT_FINDINGS_2026-04-05.md | 9 | 284 | Excluded: historical evidence, verify before promotion |
| docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md | 97 | 18 | Excluded: point-in-time certification runbook |
| docs/commands/debug.md | 5 | 77 | Excluded: procedural runbook checklist, not persistent backlog |
| docs/commands/deploy.md | 19 | 28 | Excluded: procedural runbook checklist, not persistent backlog |
| docs/commands/evolve.md | 7 | 78 | Excluded: procedural runbook checklist, not persistent backlog |
| docs/commands/feature.md | 19 | 112 | Excluded: procedural runbook checklist, not persistent backlog |
| docs/commands/pr.md | 9 | 49 | Excluded: procedural runbook checklist, not persistent backlog |
| docs/commands/review.md | 20 | 28 | Excluded: procedural runbook checklist, not persistent backlog |
| docs/DEPLOYMENT.md | 7 | 50 | Excluded: procedural runbook checklist, not persistent backlog |
| docs/reference/security.md | 8 | 272 | Excluded: procedural runbook checklist, not persistent backlog |
| docs/SECURITY-GUIDE.md | 10 | 364 | Excluded: procedural runbook checklist, not persistent backlog |
| .github/PULL_REQUEST_TEMPLATE.md | 4 | 11 | Excluded: pull request template checklist, not persistent backlog |
| chrome-extension/README.md | 7 | 233 | Included as explicit checklist backlog |
| docs/FACEBOOK_OAUTH_COMPLIANCE.md | 42 | 597 | Included as explicit checklist backlog |
| docs/superpowers/plans/2026-04-12-ui-restructure.md | 50 | 69 | Included as explicit checklist backlog |
| docs/superpowers/plans/2026-04-13-sentry-metrics.md | 6 | 36 | Included as explicit checklist backlog |
| docs/superpowers/plans/2026-04-13-sentry-tracing.md | 20 | 31 | Included as explicit checklist backlog |
| docs/superpowers/plans/2026-04-14-anti-detection-hardening.md | 60 | 50 | Included as explicit checklist backlog |
| docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md | 6 | 18 | Included as explicit checklist backlog |
| docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md | 27 | 34 | Included as explicit checklist backlog |
| docs/superpowers/plans/2026-04-15-camoufox-migration.md | 28 | 40 | Included as explicit checklist backlog |
| docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md | 34 | 33 | Included as explicit checklist backlog |
| docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md | 20 | 28 | Included as explicit checklist backlog |
| memory/project_automation_roadmap.md | 59 | 19 | Included as explicit checklist backlog |

### Open-Marker Source Coverage

Command: `rg -n -i "(^|\b)(OPEN|STILL OPEN|OPEN / NOT VERIFIED|NEEDS FIX|NEEDS TRIAGE|BLOCKED|DEFERRED|PENDING|RECHECK|TODO|FIXME|TBD|BACKLOG|NOT VERIFIED)(\b|\s|:|—|-)" <document targets>`

| Source | Matches | First Match | Treatment |
|---|---:|---:|---|
| docs/open-items/items.json | 1 | 4 | Canonical open-items configuration |
| docs/open-items/source-policy.md | 36 | 1 | Canonical open-items configuration |
| docs/COMPETITOR_ANTIDETECTION_2026-04-19.md | 1 | 386 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_CLOSABLE_UNKNOWNS_2026-04-19.md | 6 | 86 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_DASHBOARD_VERIFICATION_2026-04-18.md | 1 | 191 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_EXTENSION_AUDIT_2026-04-18.md | 1 | 192 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_EXTERNAL_RESEARCH_2026-04-19.md | 1 | 434 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_FINAL_GAP_CLOSURE_2026-04-19.md | 5 | 32 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_FULL_WALKTHROUGH_2026-04-18.md | 1 | 269 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_GAP_CLOSURE_2026-04-18.md | 3 | 39 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_MASTER_2026-04-18.md | 9 | 21 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_NIFTY_POSHMARK_DEPOP_2026-04-19.md | 1 | 258 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_POLICY_PRICING_2026-04-19.md | 3 | 3 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_POPUPS_AND_FLYP_2026-04-19.md | 2 | 86 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_SELLERAIDER_ONESHOP_2026-04-19.md | 2 | 102 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_TECHNICAL_APPENDIX_2026-04-18.md | 4 | 245 | Competitor research evidence; canonical gaps parsed from gap inventory |
| docs/COMPETITOR_TRIAL_UNLOCK_2026-04-19.md | 3 | 100 | Competitor research evidence; canonical gaps parsed from gap inventory |
| .github/dependabot.yml | 1 | 14 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/auto-create-issue-on-ci-failure.yml | 5 | 25 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/automation-coverage-audit.yml | 3 | 68 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/backfill-projects.yml | 3 | 29 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/backup-verify.yml | 1 | 187 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/backup.yml | 1 | 62 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/blog-auto-publish.yml | 1 | 51 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/bot-scheduler.yml | 1 | 62 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/bot-session-health.yml | 3 | 107 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/changelog.yml | 3 | 127 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/ci.yml | 1 | 591 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/cloudflare-ops.yml | 4 | 139 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/db-maintenance.yml | 2 | 75 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/deploy.yml | 1 | 394 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/dlq-alert.yml | 1 | 67 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/domain-expiry-check.yml | 5 | 111 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/e2e-regression.yml | 3 | 110 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/image-cleanup.yml | 1 | 64 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/infra-audit.yml | 1 | 191 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/internal-service-health.yml | 8 | 179 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/lighthouse.yml | 1 | 112 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/load-test.yml | 1 | 143 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/marketplace-health.yml | 2 | 157 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/npm-audit.yml | 3 | 74 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/observability-health.yml | 2 | 356 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/open-items-check.yml | 10 | 1 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/orphan-cleanup.yml | 1 | 84 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/production-smoke.yml | 4 | 74 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/project-status-update.yml | 9 | 32 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/push-cleanup.yml | 3 | 34 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/queue-health.yml | 1 | 89 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/redis-health.yml | 1 | 97 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/scheduled-reminders.yml | 4 | 38 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/secret-rotation-check.yml | 4 | 138 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/security-audit-extended.yml | 1 | 162 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/service-health-checks.yml | 4 | 192 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/slow-query-check.yml | 1 | 125 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/sonarcloud.yml | 1 | 8 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/spend-ai-services.yml | 3 | 27 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/spend-anthropic.yml | 3 | 25 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/spend-b2.yml | 3 | 166 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/spend-railway.yml | 3 | 25 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/ssl-cert-check.yml | 5 | 60 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/test-baseline-update.yml | 2 | 4 | Config/workflow text; parsed separately only if promoted |
| .github/workflows/uptime-slack-alert.yml | 3 | 74 | Config/workflow text; parsed separately only if promoted |
| .gitignore | 1 | 157 | Config/workflow text; parsed separately only if promoted |
| package-lock.json | 8 | 2253 | Config/workflow text; parsed separately only if promoted |
| package.json | 2 | 70 | Config/workflow text; parsed separately only if promoted |
| public/api-docs/openapi.yaml | 9 | 3288 | Config/workflow text; parsed separately only if promoted |
| docs/superpowers/specs/2026-04-12-ui-restructure-design.md | 1 | 120 | Design spec; implementation tasks live in plans/checklists |
| docs/superpowers/specs/2026-04-14-vault-buddy-sse-streaming-design.md | 1 | 183 | Design spec; implementation tasks live in plans/checklists |
| .agents/skills/release-readiness/SKILL.md | 11 | 3 | Excluded: agent skill runbook, not persistent backlog |
| .agents/skills/status/SKILL.md | 2 | 27 | Excluded: agent skill runbook, not persistent backlog |
| docs/archive/AUDIT-FINDINGS.md | 30 | 179 | Excluded: historical evidence, verify before promotion |
| docs/archive/BUG_LOG.md | 3 | 22 | Excluded: historical evidence, verify before promotion |
| docs/archive/CONSOLIDATED_OPEN_ITEMS_2026-04-29.md | 62 | 1 | Excluded: historical evidence, verify before promotion |
| docs/archive/DATABASE_SCHEMA.md | 31 | 12 | Excluded: historical evidence, verify before promotion |
| docs/archive/evidence-2026-03/FINAL_GATE_BUN_TEST_FULL.txt | 49 | 299 | Excluded: historical evidence, verify before promotion |
| docs/archive/evidence-2026-03/manual_test_output_after_csrf_fix.txt | 49 | 299 | Excluded: historical evidence, verify before promotion |
| docs/archive/evidence-2026-03/manual_test_output_final.txt | 49 | 299 | Excluded: historical evidence, verify before promotion |
| docs/archive/evidence-2026-03/manual_test_output.txt | 54 | 510 | Excluded: historical evidence, verify before promotion |
| docs/archive/evidence-2026-03/PHASE-02_PLAYWRIGHT_ANALYSIS.md | 1 | 23 | Excluded: historical evidence, verify before promotion |
| docs/archive/evidence-2026-03/PHASE-04_DOCKER_VERSION_AFTER_START.txt | 1 | 9 | Excluded: historical evidence, verify before promotion |
| docs/archive/evidence-2026-03/RUNBOOK_CHECKLIST.md | 4 | 24 | Excluded: historical evidence, verify before promotion |
| docs/archive/evidence-2026-03/TEST_UNIT.md | 49 | 345 | Excluded: historical evidence, verify before promotion |
| docs/archive/PROJECT_ROADMAP.md | 1 | 39 | Excluded: historical evidence, verify before promotion |
| docs/archive/STATE_SNAPSHOT.md | 7 | 35 | Excluded: historical evidence, verify before promotion |
| docs/archive/WALKTHROUGH-2026-03-29.md | 1 | 74 | Excluded: historical evidence, verify before promotion |
| docs/archive/WALKTHROUGH-SESSION-1.md | 5 | 26 | Excluded: historical evidence, verify before promotion |
| docs/archive/WALKTHROUGH-SESSION-2.md | 3 | 36 | Excluded: historical evidence, verify before promotion |
| docs/archive/WALKTHROUGH-SESSION-3.md | 2 | 33 | Excluded: historical evidence, verify before promotion |
| docs/audits/mobile/mobile-audit-2026-04-12.md | 1 | 11 | Excluded: historical evidence, verify before promotion |
| docs/audits/mobile/mobile-audit-2026-04-12b.md | 1 | 106 | Excluded: historical evidence, verify before promotion |
| docs/audits/mobile/mobile-audit-2026-04-13.md | 1 | 84 | Excluded: historical evidence, verify before promotion |
| docs/EXHAUSTIVE_AUDIT_LEDGER_2026-04-20.md | 60 | 28 | Excluded: historical evidence, verify before promotion |
| docs/LAUNCH_AUDIT_2026-04-03.md | 6 | 102 | Excluded: historical evidence, verify before promotion |
| docs/LAUNCH_AUDIT_FINDINGS_2026-04-05.md | 7 | 30 | Excluded: historical evidence, verify before promotion |
| docs/LAUNCH_READINESS_2026-04-05.md | 21 | 36 | Excluded: historical evidence, verify before promotion |
| docs/OPEN_ISSUE_TRIAGE_2026-04-12.md | 144 | 1 | Excluded: historical evidence, verify before promotion |
| docs/REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md | 11 | 3 | Excluded: historical evidence, verify before promotion |
| docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md | 5 | 62 | Excluded: historical evidence, verify before promotion |
| docs/SNAPSHOT_CERTIFICATION_REPORT_2026-04-20.md | 7 | 72 | Excluded: historical evidence, verify before promotion |
| docs/SNAPSHOT_CERTIFICATION_REPORT_2026-04-21.md | 3 | 62 | Excluded: historical evidence, verify before promotion |
| docs/SNAPSHOT_FREEZE_2026-04-21.md | 4 | 33 | Excluded: historical evidence, verify before promotion |
| docs/WALKTHROUGH_MASTER_FINDINGS.md | 280 | 5 | Excluded: historical evidence, verify before promotion |
| qa/reports/audits/architecture_reliability_audit.md | 1 | 178 | Excluded: historical evidence, verify before promotion |
| qa/reports/audits/backend-security-audit-2026-03-19.md | 9 | 43 | Excluded: historical evidence, verify before promotion |
| qa/reports/audits/chrome-extension-audit-2026-03-19.md | 2 | 32 | Excluded: historical evidence, verify before promotion |
| qa/reports/audits/core_product_audit.md | 3 | 196 | Excluded: historical evidence, verify before promotion |
| qa/reports/audits/data_systems_audit.md | 2 | 77 | Excluded: historical evidence, verify before promotion |
| qa/reports/audits/environment_quality_audit.md | 4 | 79 | Excluded: historical evidence, verify before promotion |
| qa/reports/audits/infrastructure_delivery_audit.md | 3 | 42 | Excluded: historical evidence, verify before promotion |
| qa/reports/audits/security_governance_audit.md | 4 | 33 | Excluded: historical evidence, verify before promotion |
| qa/reports/browserstack/2026-04-23/codex-verification.md | 4 | 197 | Excluded: historical evidence, verify before promotion |
| qa/reports/browserstack/2026-04-23/functional-review.md | 5 | 57 | Excluded: historical evidence, verify before promotion |
| qa/reports/browserstack/2026-04-23/performance-notes.md | 3 | 37 | Excluded: historical evidence, verify before promotion |
| qa/reports/browserstack/2026-04-23/remediation-plan.md | 2 | 56 | Excluded: historical evidence, verify before promotion |
| qa/reports/browserstack/2026-04-24/remediation-plan.md | 5 | 270 | Excluded: historical evidence, verify before promotion |
| qa/reports/browserstack/2026-04-24/visual-review.md | 1 | 86 | Excluded: historical evidence, verify before promotion |
| qa/reports/db-layer-audit-2026-03-19.md | 1 | 54 | Excluded: historical evidence, verify before promotion |
| qa/reports/devops-infra-audit-2026-03-19.md | 1 | 92 | Excluded: historical evidence, verify before promotion |
| qa/reports/final/remediation_plan.md | 1 | 210 | Excluded: historical evidence, verify before promotion |
| qa/reports/final/remediation_status.md | 3 | 279 | Excluded: historical evidence, verify before promotion |
| qa/reports/frontend-audit-2026-03-19.md | 8 | 29 | Excluded: historical evidence, verify before promotion |
| qa/reports/generation/architecture_reliability_generation.md | 3 | 75 | Excluded: historical evidence, verify before promotion |
| qa/reports/generation/core_product_generation.md | 6 | 45 | Excluded: historical evidence, verify before promotion |
| qa/reports/generation/security_governance_generation.md | 4 | 40 | Excluded: historical evidence, verify before promotion |
| qa/reports/scripts-layer-audit-2026-03-19.md | 1 | 33 | Excluded: historical evidence, verify before promotion |
| docs/commands/api.md | 1 | 87 | Excluded: runbook/checklist gate, not persistent backlog |
| docs/commands/rate-limit-options.md | 4 | 142 | Excluded: runbook/checklist gate, not persistent backlog |
| docs/commands/seed.md | 1 | 84 | Excluded: runbook/checklist gate, not persistent backlog |
| docs/DEPLOYMENT.md | 1 | 148 | Excluded: runbook/checklist gate, not persistent backlog |
| docs/reference/security.md | 1 | 85 | Excluded: runbook/checklist gate, not persistent backlog |
| docs/SECURITY-GUIDE.md | 1 | 298 | Excluded: runbook/checklist gate, not persistent backlog |
| memory/COMPLETED.md | 2 | 61 | Excluded: session memory, promote only after current verification |
| memory/LAUNCH_PRIORITY.md | 5 | 14 | Excluded: session memory, promote only after current verification |
| memory/MEMORY.md | 9 | 7 | Excluded: session memory, promote only after current verification |
| memory/STATUS.md | 23 | 7 | Excluded: session memory, promote only after current verification |
| memory/TIER0_PLAYBOOK.md | 3 | 11 | Excluded: session memory, promote only after current verification |
| data/qa-report-2026-04-04-chrome-walkthrough.md | 2 | 20 | Excluded: timestamped QA evidence, not current truth |
| data/qa-report-2026-04-04-exhaustive.md | 4 | 39 | Excluded: timestamped QA evidence, not current truth |
| data/qa-report-2026-04-04-final.md | 6 | 32 | Excluded: timestamped QA evidence, not current truth |
| data/qa-report-2026-04-04.md | 40 | 6 | Excluded: timestamped QA evidence, not current truth |
| docs/PERFECT_ANTI_DETECTION_SYSTEM.md | 13 | 68 | Included as anti-detection design gap source |
| docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md | 7 | 31 | Included as competitor intelligence gap source |
| chrome-extension/README.md | 8 | 43 | Included as explicit checklist source |
| docs/FACEBOOK_OAUTH_COMPLIANCE.md | 5 | 76 | Included as explicit checklist source |
| docs/reference/deep-dive-backlog.md | 5 | 1 | Included as structural/refactor backlog |
| docs/walkthrough/affiliate.md | 3 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/analytics.md | 6 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/auth.md | 2 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/automations.md | 4 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/batch-photo.md | 3 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/calendar.md | 3 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/changelog.md | 3 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/community.md | 1 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/connections.md | 5 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/dashboard.md | 7 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/environment.md | 12 | 38 | Included via walkthrough parser when table status is active |
| docs/walkthrough/financials.md | 5 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/help.md | 3 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/image-vault.md | 1 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/import.md | 1 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/INDEX.md | 9 | 4 | Included via walkthrough parser when table status is active |
| docs/walkthrough/inventory.md | 1 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/listings.md | 3 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/market-intel.md | 3 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/my-shops.md | 7 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/orders-sales.md | 2 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/planner.md | 5 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/plans-billing.md | 2 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/platform-readiness.md | 3 | 14 | Included via walkthrough parser when table status is active |
| docs/walkthrough/predictions.md | 4 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/privacy.md | 1 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/public-site.md | 31 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/receipts.md | 2 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/refer-a-friend.md | 1 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/reports.md | 2 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/roadmap.md | 5 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/settings.md | 14 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/shipping.md | 3 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/size-charts.md | 1 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/source-code-audit.md | 12 | 5 | Included via walkthrough parser when table status is active |
| docs/walkthrough/transactions.md | 1 | 3 | Included via walkthrough parser when table status is active |
| docs/walkthrough/vault-buddy.md | 4 | 3 | Included via walkthrough parser when table status is active |
| docs/superpowers/plans/2026-04-12-ui-restructure.md | 3 | 832 | Included when unchecked checklist rows exist |
| docs/superpowers/plans/2026-04-13-sentry-metrics.md | 1 | 121 | Included when unchecked checklist rows exist |
| docs/superpowers/plans/2026-04-13-sentry-tracing.md | 2 | 136 | Included when unchecked checklist rows exist |
| docs/superpowers/plans/2026-04-14-anti-detection-hardening.md | 2 | 165 | Included when unchecked checklist rows exist |
| docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md | 9 | 24 | Included when unchecked checklist rows exist |
| docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md | 1 | 1432 | Included when unchecked checklist rows exist |
| docs/superpowers/plans/2026-05-01-fake-data-audit.md | 24 | 21 | Included when unchecked checklist rows exist |
| AGENTS.md | 6 | 52 | Project instructions; not backlog source |
| CLAUDE.md | 5 | 52 | Project instructions; not backlog source |
| qa/coverage_matrix.md | 8 | 25 | QA coverage reference; individual gaps require current verification before promotion |
| qa/full_testing_taxonomy.md | 1 | 231 | QA coverage reference; individual gaps require current verification before promotion |
| docs/reference/api-route-inventory.md | 2 | 112 | Reference/design source; verify before promotion |
| docs/reference/api.md | 1 | 160 | Reference/design source; verify before promotion |
| docs/reference/cr10-oauth-connect-checklist.md | 1 | 39 | Reference/design source; verify before promotion |
| docs/reference/database.md | 1 | 112 | Reference/design source; verify before promotion |
| docs/reference/docs-index.md | 6 | 39 | Reference/design source; verify before promotion |
| docs/reference/frontend-fetch-inventory.md | 21 | 23 | Reference/design source; verify before promotion |
| docs/reference/frontend.md | 1 | 327 | Reference/design source; verify before promotion |
| docs/reference/generated-files.md | 2 | 18 | Reference/design source; verify before promotion |
| docs/reference/repo-map.md | 1 | 103 | Reference/design source; verify before promotion |
| docs/reference/worker-ownership.md | 1 | 146 | Reference/design source; verify before promotion |
| CHANGELOG.md | 2 | 12 | Reference/product documentation; not parsed as backlog unless promoted |
| CONTRIBUTING.md | 1 | 131 | Reference/product documentation; not parsed as backlog unless promoted |
| docs/CLOUDFLARE-AUDIT-2026-03-29.md | 1 | 142 | Reference/product documentation; not parsed as backlog unless promoted |
| docs/FEATURE_INVENTORY.md | 11 | 46 | Reference/product documentation; not parsed as backlog unless promoted |
| docs/FRONTEND_SOURCE_OF_TRUTH.md | 4 | 12 | Reference/product documentation; not parsed as backlog unless promoted |
| docs/PRD.md | 1 | 409 | Reference/product documentation; not parsed as backlog unless promoted |
| docs/SETUP.md | 4 | 19 | Reference/product documentation; not parsed as backlog unless promoted |
| public/llms.txt | 1 | 35 | Reference/product documentation; not parsed as backlog unless promoted |
| RAILWAY_OPERATIONS.md | 5 | 68 | Reference/product documentation; not parsed as backlog unless promoted |
| README.md | 1 | 69 | Reference/product documentation; not parsed as backlog unless promoted |
| RELEASE.md | 2 | 88 | Reference/product documentation; not parsed as backlog unless promoted |
| SECURITY.md | 1 | 15 | Reference/product documentation; not parsed as backlog unless promoted |

## Launch Blockers

| ID | Status | Priority | Area | Item | Source | Next Action | Blocker |
|---|---|---|---|---|---|---|---|
| CR-4 | OPEN / NOT VERIFIED — 2026-04-30 local code fix routes default rates, explicit EasyPost rates/buy, and batch purchase through EasyPost with focused unit coverage; production EASYPOST_API_KEY and live authenticated verification still pending | launch-blocker | Shipping / EasyPost | EasyPost production key and authenticated rates/buy/track verification still pending | docs/walkthrough/environment.md:46<br>docs/walkthrough/shipping.md:7 | Deploy the EasyPost routing fix, configure EASYPOST_API_KEY in Railway, then run authenticated production EasyPost rates/buy/track verification and update docs/walkthrough/environment.md plus docs/walkthrough/shipping.md. | EasyPost account/API key availability, Railway production environment configuration, and live authenticated verification. |
| CR-10 | OPEN -- verified 2026-04-24 | launch-blocker | Connections / Marketplace OAuth | Marketplace connection state is still incomplete: eBay and Shopify OAuth init are live, but Depop OAuth is unconfigured and several remaining marketplace connects still rely on manual / Playwright credential flows | docs/walkthrough/connections.md:7<br>docs/walkthrough/my-shops.md:7<br>docs/walkthrough/platform-readiness.md:21 | Run authenticated end-to-end verification for the remaining marketplace connect flows and update the specific walkthrough area files with the result. | Marketplace credentials, provider access, and live connect-flow verification. |

## Open Walkthrough / Product Items

_None._

## Fixed Pending Live / Manual Verification

| ID | Status | Priority | Area | Item | Source | Next Action | Blocker |
|---|---|---|---|---|---|---|---|
| L-18 | CONFIRMED N/A -- connectGmail() has real OAuth popup flow. Functional pending credentials. |  | Connections | Gmail/Outlook/Cloudinary/Google Drive "Connect" buttons -- unclear if functional | docs/walkthrough/connections.md:14 |  |  |

## Deferred / Post-Launch Items

| ID | Status | Priority | Area | Item | Source | Next Action | Blocker |
|---|---|---|---|---|---|---|---|
| Analytics-3 | PRE-EXISTING -- requires real ML/AI pipeline with actual sales data; deferred post-launch |  | Predictions | Predictions tab shows hardcoded sample data as real AI-generated insights for a zero-activity account | docs/walkthrough/predictions.md:15 |  |  |
| Analytics-4 | PRE-EXISTING -- requires real platform connections; deferred to post-launch |  | Market Intel / Heatmaps | Platform Engagement shows hardcoded multi-platform data for account with 0 connected shops | docs/walkthrough/market-intel.md:15 |  |  |
| analytics-33-predictions-tab-displays-hardcoded-sample- | PRE-EXISTING ✅ — requires real ML/AI pipeline with actual sales data; deferred to post-launch |  | Analytics | Predictions Tab Displays Hardcoded Sample Data as Real Insights | docs/walkthrough/analytics.md:33 |  |  |
| analytics-34-heatmaps-tab-platform-engagement-shows-har | PRE-EXISTING ✅ — requires real platform connections and engagement data; deferred to post-launch |  | Analytics | Heatmaps Tab — Platform Engagement Shows Hardcoded Multi-Platform Data for account with 0 connected shops | docs/walkthrough/analytics.md:34 |  |  |
| Sentry-1 | DEFERRED |  | Infrastructure | Setup User Feedback | docs/walkthrough/environment.md:66 |  |  |
| Sentry-2 | DEFERRED |  | Infrastructure | Setup Logs | docs/walkthrough/environment.md:67 |  |  |
| Sentry-3 | DEFERRED |  | Infrastructure | Setup Profiling | docs/walkthrough/environment.md:68 |  |  |
| Sentry-4 | DEFERRED |  | Infrastructure | Setup Session Replay | docs/walkthrough/environment.md:69 |  |  |
| Sentry-5 | DEFERRED |  | Infrastructure | Setup Monitor MCP Servers | docs/walkthrough/environment.md:70 |  |  |
| Sentry-6 | DEFERRED |  | Infrastructure | Setup Monitor AI Agents | docs/walkthrough/environment.md:71 |  |  |

## Structural / Refactor Backlog

These are read-only refactor risk items from `docs/reference/deep-dive-backlog.md`. They are not launch blockers unless separately promoted in `docs/open-items/items.json`.

| ID | Priority | Area | Evidence | Required Inspection / Next Action | Blocker | Source |
|---|---|---|---|---|---|---|
| R-001 | refactor-p1 | src/backend/server.js (2087 lines, dispatch table with 15 inline async handlers) | server.js:577 — /api/health/platforms handler; server.js:237 — CORS config block; server.js:304 — in-process platform health cache | Identify which of the 15 inline handlers contain non-trivial business logic vs trivial delegation. /api/health/platforms (starts line 577) runs 4 parallel DB queries with bucket-building logic (~180 LOC). Determine whether any inline handler reads module-level mutable state (e.g., _platformHealthCache) that would break if moved to a separate file. | Required inspection steps are not complete. | docs/reference/deep-dive-backlog.md:25 |
| R-003 | refactor-p2 | 4 service files that export HTTP routers alongside service logic | emailMarketing.js:317 — emailMarketingRouter; enhancedMFA.js:514 — enhancedMFARouter; auditLog.js:430 — auditLogRouter; outgoingWebhooks.js:265 — outgoingWebhooksRouter. Actual file lengths: emailMarketing.js 384 lines, enhancedMFA.js 657 lines, auditLog.js 557 lines, outgoingWebhooks.js 484 lines | Confirm that the router function in each file only calls service functions defined in the same file (not across service boundaries). Determine whether moving the router to src/backend/routes/ would create a circular import (router imports service; service imports route would be new). Verify that server.js mounts these routers by path prefix and that no path collision exists with any dedicated route file. |  | docs/reference/deep-dive-backlog.md:39 |
| R-011 | refactor-p1 | src/backend/routes/auth.js (1153 lines, 11 imports spanning 6 concern domains) | auth.js:1–12 — imports: uuid, bcryptjs, crypto, direct SQL via query, mfa.js, email.js, rateLimiter, websocket.js, logger, redis.js, auth.js middleware | Count how many exported route handler functions exist. Identify which functions depend on Redis vs which depend only on DB. Determine whether WebSocket emission is fire-and-forget (safe to keep) or awaited (creates ordering dependency). Verify that MFA validation paths share no mutable state with password-reset paths. | Required inspection steps are not complete. | docs/reference/deep-dive-backlog.md:26 |
| R-012 | refactor-p1 | src/backend/db/database.js (640 lines, 7+ distinct responsibilities) | database.js:1–640 — connection pool init, query.get / query.all / query.run wrappers, migration runner, seeder, metrics collection, pool monitoring, graceful shutdown | Map which exported symbols are imported by routes vs middleware vs workers. Verify that the migration array order is load-bearing (migrations run sequentially). Check whether pool monitoring (on('connect'), on('error')) is stateful — cannot be split without passing the pool reference. Confirm shutdown hook is registered once and not duplicated if the module is re-imported. | Required inspection steps are not complete. | docs/reference/deep-dive-backlog.md:27 |
| R-015 | refactor-p1 | Authorization/ownership checks across src/backend/routes/* | All files under src/backend/routes/ — audit not yet completed; coverage is UNKNOWN | Route-by-route audit: for every route that reads or mutates a user-owned resource (InventoryItem, Listing, Sale, Offer, ImageAsset), verify that a WHERE user_id = $N clause or equivalent ownership check exists. Flag any route that accepts a resource ID from the request body/params without verifying ownership before the query executes. | Required inspection steps are not complete. | docs/reference/deep-dive-backlog.md:28 |
| R-017 | refactor-p2 | CORS config embedded in server.js | server.js:237–265 — allowedOrigins array construction and getCORSHeaders() function | Determine whether CORS_ORIGINS env var parsing is done once at startup (safe to extract) or on every request (stateful). Verify that getCORSHeaders() is called only from the main request handler and not from any middleware. Check that the Access-Control-Allow-Credentials: true response is only sent for whitelisted origins — never for wildcard. |  | docs/reference/deep-dive-backlog.md:40 |
| R-020 / R-021 | refactor-p2 | Playwright version drift + duplicate Dockerfile | Root package.json: playwright@1.59.1, @playwright/test@1.59.1. worker/package.json: playwright@1.58.2. Dockerfiles: Dockerfile.worker at repo root AND worker/Dockerfile both exist | Determine which Dockerfile is actually used by Railway for the worker service (check railway.json in worker/). Verify whether the 1.58.2 vs 1.59.1 difference affects any bot behavior in worker/bots/. Check if Dockerfile.worker at root is a legacy artifact or actively referenced. |  | docs/reference/deep-dive-backlog.md:41 |
| R-027 | refactor-p2 | Upload/media route validation in imageBank.js, batchPhoto.js, receiptParser.js | src/backend/routes/imageBank.js, src/backend/routes/batchPhoto.js, src/backend/routes/receiptParser.js — not yet inspected | Audit each file for: (1) MIME type validation before file processing, (2) file size limits enforced server-side, (3) upload path sanitization (no path traversal), (4) ownership check before serving a stored asset, (5) whether escapeHtml() is called on any user-supplied filename before storage or logging. |  | docs/reference/deep-dive-backlog.md:42 |
| R-028 | refactor-p2 | Background job schedulers split across two locations | src/backend/workers/ contains: emailPollingWorker.js, gdprWorker.js, priceCheckWorker.js, taskWorker.js, uptimeProbeWorker.js. worker/ contains: index.js, dlq-processor.js, bots/. | Determine whether any job type is scheduled in both locations (duplicate scheduler). Verify that src/backend/workers/ files are imported and started from server.js (in-process) while worker/index.js is the out-of-process BullMQ worker — these are distinct execution contexts and must not share the same queue consumer registration. |  | docs/reference/deep-dive-backlog.md:43 |
| R-029 | refactor-p1 | Frontend/backend auth-session coupling | src/backend/routes/auth.js, src/backend/middleware/auth.js, src/frontend/core/api.js, src/frontend/core/store.js | Map the full token lifecycle: issue → store → refresh → revoke. Verify that store.persist() and store.hydrate() cover both token and refreshToken. Confirm api.refreshAccessToken() reads store.state.refreshToken (not localStorage directly). Check that the backend /api/auth/refresh route invalidates the old refresh token (rotation). Any change to these four files together requires the full auth chain to be re-verified. | Required inspection steps are not complete. | docs/reference/deep-dive-backlog.md:29 |

## Competitor Intelligence Gaps

These are research backlog items from `docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md`. They are not VaultLister launch blockers unless separately promoted.

| ID | Closability | Area | Gap | Source |
|---|---|---|---|---|
| COMP-GAP-21 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | eBay automation panel control sets | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:21 |
| COMP-GAP-22 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | Mercari automation panel control sets | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:22 |
| COMP-GAP-23 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | Depop automation panel control sets | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:23 |
| COMP-GAP-24 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | Etsy automation (if supported) — confirm existence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:24 |
| COMP-GAP-25 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | Facebook automation (if supported) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:25 |
| COMP-GAP-26 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | Grailed automation (if supported) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:26 |
| COMP-GAP-27 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | Shopify automation (if supported) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:27 |
| COMP-GAP-28 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | Audit log / task history schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:28 |
| COMP-GAP-29 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | Team/collaborator support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:29 |
| COMP-GAP-30 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | Annual-vs-monthly pricing exact delta for each module | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:30 |
| COMP-GAP-31 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / PrimeLister (11 gaps) | roadmap.primelister.com — was blocked in pricing agent fetch; retry from browser | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:31 |
| COMP-GAP-34 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist (9 gaps) | Entire dashboard (never logged in) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:34 |
| COMP-GAP-35 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist (9 gaps) | Whether Relist button actually exists in UI (OVERSTATE verification) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:35 |
| COMP-GAP-36 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist (9 gaps) | Inventory management UI | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:36 |
| COMP-GAP-37 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist (9 gaps) | Cross-listing flow controls | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:37 |
| COMP-GAP-38 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist (9 gaps) | Supported-platforms list confirmation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:38 |
| COMP-GAP-39 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist (9 gaps) | User settings / billing UI | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:39 |
| COMP-GAP-40 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist (9 gaps) | Team features | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:40 |
| COMP-GAP-41 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist (9 gaps) | Support flow | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:41 |
| COMP-GAP-42 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist (9 gaps) | What specific sales data is relayed via alarm beacon | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:42 |
| COMP-GAP-45 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist Magic (5 gaps) | Icon-on-listing-page flow (clicking crosslist icon on live Poshmark/eBay page) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:45 |
| COMP-GAP-46 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist Magic (5 gaps) | Target platform selector after icon click | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:46 |
| COMP-GAP-47 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist Magic (5 gaps) | Field mapping preview | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:47 |
| COMP-GAP-48 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist Magic (5 gaps) | Error handling when target rejects listing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:48 |
| COMP-GAP-49 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Crosslist Magic (5 gaps) | AI Lister beta accuracy rate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:49 |
| COMP-GAP-53 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / SellerAider (10 gaps) | Extension popup — CONFIRMED lacks Share/Relist/Offers (3 OVERSTATES validated) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:53 |
| COMP-GAP-55 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / SellerAider (10 gaps) | Photo editing tool | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:55 |
| COMP-GAP-56 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / SellerAider (10 gaps) | AI listing generation flow | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:56 |
| COMP-GAP-57 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / SellerAider (10 gaps) | Price suggestion tool | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:57 |
| COMP-GAP-58 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / SellerAider (10 gaps) | Audit log | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:58 |
| COMP-GAP-59 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / SellerAider (10 gaps) | How Tier-A automation runs without server delegation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:59 |
| COMP-GAP-60 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / SellerAider (10 gaps) | CAPTCHA handling absence confirmed (no references in code) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:60 |
| COMP-GAP-61 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / SellerAider (10 gaps) | What happens when Chrome closes during active automation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:61 |
| COMP-GAP-64 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | Non-Poshmark sub-tabs CONFIRMED absent (no eBay/Mercari/Depop/Facebook Sharer exist) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:64 |
| COMP-GAP-65 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | Flyp Crosslister extension popup CONFIRMED none (no action.default_popup) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:65 |
| COMP-GAP-66 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | Flyp Bot Sharer extension popup CONFIRMED none | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:66 |
| COMP-GAP-67 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | Post-trial exact pricing tiers (fetch blocked on tools.joinflyp.com) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:67 |
| COMP-GAP-68 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | How CAPTCHA solving actually works (108 code references but integration opaque) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:68 |
| COMP-GAP-69 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | Bot behavior when Poshmark flags suspicious activity | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:69 |
| COMP-GAP-70 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | Cloud vs local execution decision logic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:70 |
| COMP-GAP-71 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | Multi-account support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:71 |
| COMP-GAP-72 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | Bulk Delist & Relist full modal (button labels only documented) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:72 |
| COMP-GAP-73 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | Settings dropdown beyond Profile/Account/Logout | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:73 |
| COMP-GAP-74 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Flyp (11 gaps) | Whether higher tiers exist beyond the single free trial view | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:74 |
| COMP-GAP-77 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | Otto beta features (isOttoBetaUser: true role-gated) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:77 |
| COMP-GAP-78 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | Smart Credits "Buy more" per-pack pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:78 |
| COMP-GAP-79 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | Whatnot automation (isWhatnotBetaUser: false) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:79 |
| COMP-GAP-80 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | Facebook automation (absent from UI — confirm if coming) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:80 |
| COMP-GAP-81 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | Grailed automation (absent) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:81 |
| COMP-GAP-82 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | Kidizen / TheRealReal / Vinted automation (absent) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:82 |
| COMP-GAP-83 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | eBay "Recreates" mechanism (delete + repost? list-alike?) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:83 |
| COMP-GAP-84 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | Otto inventory-specific query capability — never tested **PARTIALLY CLOSED 2026-04-19:** Otto prompt sent successfully but no AI response generated — isOttoBetaUser: false. Beta enrollment is role-gated (not plan-gated); Bundle II trial alone insufficient. | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:84 |
| COMP-GAP-86 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | Annual pricing for Bundle Pro | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:86 |
| COMP-GAP-87 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | Team/enterprise tier | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:87 |
| COMP-GAP-88 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | API access if any | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:88 |
| COMP-GAP-89 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Nifty (13 gaps) | Rebrand history (AutoPosher → Nifty) — when, why | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:89 |
| COMP-GAP-92 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / OneShop (11 gaps) | All 6 bot configs per institution: account-shares, follows, offer-to-likers, otl-listings, relisting, share-order — **PARTIALLY CLOSED 2026-04-19:** Route names confirmed from Next.js build manifest; all redirect to /u/settings paywall. Controls undocumented until Premium activated. | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:92 |
| COMP-GAP-94 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / OneShop (11 gaps) | Annual pricing — no annual plan shown on pricing page | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:94 |
| COMP-GAP-95 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / OneShop (11 gaps) | Analytics section (not in free-tier nav) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:95 |
| COMP-GAP-96 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / OneShop (11 gaps) | Crosslisting publish flow controls | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:96 |
| COMP-GAP-97 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / OneShop (11 gaps) | AI/autofill capabilities beyond label **PARTIALLY CLOSED 2026-04-19:** "Smart autofill" described as pattern/template-based field population (not generative AI). No LLM vendor identified. Autofill Settings accessible from /u/listings. | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:97 |
| COMP-GAP-105 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Closo (5 gaps) | Will app revive (30-60 day re-check needed) **CLOSED 2026-04-19:** REVIVED. AI agent suite launched 2025. Blog active Feb 2026. **RE-OPENED 2026-04-19 (same-day):** Second live check confirms app is still a skeleton. app.closo.co = near-empty shell; blog, AI agents, pricing, dashboard all return 404. Website nav lists many features but all links resolve to 404. Revival is cosmetic-only. Gap remains open — re-check in 60 days. | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:105 |
| COMP-GAP-106 | Insider-only/opaque | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Closo (5 gaps) | Former feature set documentation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:106 |
| COMP-GAP-107 | Insider-only/opaque | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Closo (5 gaps) | Historical pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:107 |
| COMP-GAP-108 | Insider-only/opaque | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Closo (5 gaps) | Abandonment reason / who still maintains | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:108 |
| COMP-GAP-109 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Closo (5 gaps) | Whether prior Pro accounts unlock anything on revival | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:109 |
| COMP-GAP-112 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | /v2/automations/mapping-rules controls — **CONFIRMED Business-tier-only 2026-04-19:** Not unlocked by Pro ($59.99). Redirects to /login on Pro; resolves to enterprise.vendoo.co/... = Firebase 404 from within v2 session. | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:112 |
| COMP-GAP-113 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | /v2/automations/pricing-rules controls — same Business-tier gate; Firebase 404 | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:113 |
| COMP-GAP-114 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | /v2/automations/marketplace-defaults controls — same Business-tier gate; Firebase 404 | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:114 |
| COMP-GAP-115 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | /v2/automations/shopify controls — same Business-tier gate; Firebase 404 | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:115 |
| COMP-GAP-116 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | Enterprise tier at enterprise.vendoo.co (separate Firebase app) — **NOTE 2026-04-19:** Enterprise subdomain itself is broken (returns Firebase 404 on all routes) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:116 |
| COMP-GAP-119 | Free/public verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | Extension popup CONFIRMED absent (content-script-only) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:119 |
| COMP-GAP-121 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | Listing Videos feature depth | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:121 |
| COMP-GAP-122 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | Background removal edge cases (1500/mo limit but quality unknown) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:122 |
| COMP-GAP-123 | Behavioral/benchmark test | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | Queue prioritization logic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:123 |
| COMP-GAP-124 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | Multi-account / team support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:124 |
| COMP-GAP-126 | Paid/gated verification | Competitor Intelligence / 1. Per-competitor product feature gaps (89) / Vendoo (14 gaps) | Analytics drill-down beyond top-level KPIs | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:126 |
| COMP-GAP-133 | Free/public verification | Competitor Intelligence / 2. External / public data gaps (47) / SimilarWeb traffic (9 gaps — all unresolved) | SimilarWeb monthly visits for PrimeLister, Crosslist, Crosslist Magic, SellerAider, Flyp, Nifty, OneShop, Closo, Vendoo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:133 |
| COMP-GAP-136 | Insider-only/opaque | Competitor Intelligence / 2. External / public data gaps (47) / Founder identities (7 gaps) | PrimeLister CEO / founders — not publicly named | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:136 |
| COMP-GAP-137 | Insider-only/opaque | Competitor Intelligence / 2. External / public data gaps (47) / Founder identities (7 gaps) | SellerAider founders — not publicly named | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:137 |
| COMP-GAP-138 | Insider-only/opaque | Competitor Intelligence / 2. External / public data gaps (47) / Founder identities (7 gaps) | Crosslist Magic founders | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:138 |
| COMP-GAP-139 | Insider-only/opaque | Competitor Intelligence / 2. External / public data gaps (47) / Founder identities (7 gaps) | Nifty founders (post-AutoPosher rebrand) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:139 |
| COMP-GAP-140 | Insider-only/opaque | Competitor Intelligence / 2. External / public data gaps (47) / Founder identities (7 gaps) | OneShop founders (post-YC) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:140 |
| COMP-GAP-141 | Insider-only/opaque | Competitor Intelligence / 2. External / public data gaps (47) / Founder identities (7 gaps) | Closo founders | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:141 |
| COMP-GAP-142 | Insider-only/opaque | Competitor Intelligence / 2. External / public data gaps (47) / Founder identities (7 gaps) | Vendoo individual co-founder names (4 total confirmed, names not all public) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:142 |
| COMP-GAP-145 | Free/public verification | Competitor Intelligence / 2. External / public data gaps (47) / Status pages (9 gaps) | None of 9 competitors operate a public status page (e.g., status.vendoo.co) — confirmed absent for all | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:145 |
| COMP-GAP-148 | Free/public verification | Competitor Intelligence / 2. External / public data gaps (47) / GitHub public repos (9 gaps) | No public repos identified for any of the 9 — all closed-source | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:148 |
| COMP-GAP-151 | Free/public verification | Competitor Intelligence / 2. External / public data gaps (47) / YouTube channels / subs (9 gaps) | Official YouTube channels not surfaced for 7 of 9; subscriber counts not found for any | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:151 |
| COMP-GAP-154 | Free/public verification | Competitor Intelligence / 2. External / public data gaps (47) / TikTok / Instagram handles (4 gaps) | Crosslist: Facebook + X/Twitter confirmed; no official TikTok/Instagram found | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:154 |
| COMP-GAP-155 | Free/public verification | Competitor Intelligence / 2. External / public data gaps (47) / TikTok / Instagram handles (4 gaps) | Most others: social presence not enumerated beyond marketing-site links | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:155 |
| COMP-GAP-161 | Free/public verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | PrimeLister refund policy (not published) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:161 |
| COMP-GAP-162 | Free/public verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | PrimeLister roadmap.primelister.com changelog (blocked in fetch) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:162 |
| COMP-GAP-163 | Free/public verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Crosslist Magic /privacy returned 404 | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:163 |
| COMP-GAP-164 | Free/public verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Flyp post-trial exact pricing page (blocked on tools.joinflyp.com) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:164 |
| COMP-GAP-165 | Free/public verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Closo current pricing (dead app) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:165 |
| COMP-GAP-167 | Free/public verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Nifty annual pricing option | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:167 |
| COMP-GAP-168 | Paid/gated verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Vendoo Business tier pricing (not public) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:168 |
| COMP-GAP-169 | Paid/gated verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Vendoo Enterprise tier pricing (separate app, not public) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:169 |
| COMP-GAP-170 | Free/public verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Family / multi-account pricing for all 9 | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:170 |
| COMP-GAP-171 | Free/public verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Affiliate / referral commissions (Flyp has $10 referral; others unknown) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:171 |
| COMP-GAP-172 | Free/public verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Coupon / promo code availability | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:172 |
| COMP-GAP-173 | Free/public verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Cancellation flow screenshots for any competitor | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:173 |
| COMP-GAP-174 | Paid/gated verification | Competitor Intelligence / 3. Pricing / refund / billing gaps (14) | Free-tier conversion rate estimates | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:174 |
| COMP-GAP-181 | Insider-only/opaque | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Privacy policy weaknesses identified | PrimeLister: no GDPR/CCPA, no deletion rights, no breach notification | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:181 |
| COMP-GAP-182 | Insider-only/opaque | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Privacy policy weaknesses identified | Most competitors: no documented breach notification procedure | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:182 |
| COMP-GAP-183 | Free/public verification | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Privacy policy weaknesses identified | Data retention periods (all 9 — only Crosslist explicit) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:183 |
| COMP-GAP-184 | Free/public verification | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Privacy policy weaknesses identified | Cookie scope analysis (which sites can read session cookies each extension sets) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:184 |
| COMP-GAP-185 | Free/public verification | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Privacy policy weaknesses identified | Third-party SDKs embedded in each extension (analytics, Sentry, DataDog confirmed for Vendoo) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:185 |
| COMP-GAP-188 | Behavioral/benchmark test | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | XSS vulnerabilities in each web app | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:188 |
| COMP-GAP-189 | Behavioral/benchmark test | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | CSRF in each web app | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:189 |
| COMP-GAP-190 | Behavioral/benchmark test | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | Session hijacking feasibility | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:190 |
| COMP-GAP-191 | Behavioral/benchmark test | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | Extension injection attack surface | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:191 |
| COMP-GAP-192 | Behavioral/benchmark test | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | Content script scope creep per extension | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:192 |
| COMP-GAP-193 | Behavioral/benchmark test | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | Extension permission escalation paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:193 |
| COMP-GAP-194 | Behavioral/benchmark test | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | Cookie leakage between sites | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:194 |
| COMP-GAP-195 | Behavioral/benchmark test | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | Token refresh race conditions | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:195 |
| COMP-GAP-196 | Insider-only/opaque | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | SOC 2 / ISO 27001 certifications (none advertised) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:196 |
| COMP-GAP-197 | Insider-only/opaque | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | PCI DSS for billing handling | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:197 |
| COMP-GAP-198 | Free/public verification | Competitor Intelligence / 4. Privacy / security / compliance gaps (22) / Never-performed security tests | Privacy policy deep diff (clause-by-clause) across 9 | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:198 |
| COMP-GAP-207 | Insider-only/opaque | Competitor Intelligence / 5. Legal / regulatory gaps (8) | ToS compliance audit per competitor vs Poshmark/Mercari/eBay/Depop ToS | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:207 |
| COMP-GAP-208 | Insider-only/opaque | Competitor Intelligence / 5. Legal / regulatory gaps (8) | Cease-and-desist history (none found) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:208 |
| COMP-GAP-209 | Insider-only/opaque | Competitor Intelligence / 5. Legal / regulatory gaps (8) | Class-action lawsuits (none found) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:209 |
| COMP-GAP-210 | Insider-only/opaque | Competitor Intelligence / 5. Legal / regulatory gaps (8) | Patent filings (USPTO check never done) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:210 |
| COMP-GAP-211 | Insider-only/opaque | Competitor Intelligence / 5. Legal / regulatory gaps (8) | Trademark registrations | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:211 |
| COMP-GAP-212 | Free/public verification | Competitor Intelligence / 5. Legal / regulatory gaps (8) | Jurisdictional restrictions per competitor (does each support CA/UK/AU/EU sellers?) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:212 |
| COMP-GAP-213 | Free/public verification | Competitor Intelligence / 5. Legal / regulatory gaps (8) | 1099-K reporting integration | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:213 |
| COMP-GAP-214 | Free/public verification | Competitor Intelligence / 5. Legal / regulatory gaps (8) | VAT/GST handling for non-US sellers | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:214 |
| COMP-GAP-220 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Time from signup to first listing (per competitor) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:220 |
| COMP-GAP-221 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Time from listing to first crosspost | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:221 |
| COMP-GAP-222 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Number of clicks per operation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:222 |
| COMP-GAP-223 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Error message clarity audit | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:223 |
| COMP-GAP-224 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Mobile responsiveness on touch devices | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:224 |
| COMP-GAP-225 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Screen reader / WCAG compliance | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:225 |
| COMP-GAP-226 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Color contrast per competitor | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:226 |
| COMP-GAP-227 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Dark mode support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:227 |
| COMP-GAP-228 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Keyboard navigation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:228 |
| COMP-GAP-229 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Multi-language / localization | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:229 |
| COMP-GAP-230 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Currency handling for international sellers | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:230 |
| COMP-GAP-231 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Onboarding flow quality | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:231 |
| COMP-GAP-232 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Help / documentation quality comparison | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:232 |
| COMP-GAP-233 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Loading states and skeleton UIs | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:233 |
| COMP-GAP-234 | Behavioral/benchmark test | Competitor Intelligence / 6. UX / accessibility gaps (15 — NEVER AUDITED) | Empty states design | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:234 |
| COMP-GAP-240 | Insider-only/opaque | Competitor Intelligence / 7. Technical infrastructure gaps (12) | Each competitor's CI/CD pipeline | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:240 |
| COMP-GAP-241 | Insider-only/opaque | Competitor Intelligence / 7. Technical infrastructure gaps (12) | Deployment frequency | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:241 |
| COMP-GAP-242 | Free/public verification | Competitor Intelligence / 7. Technical infrastructure gaps (12) | Chrome Web Store install counts verified (partial — 60K Vendoo, 3.2K PrimeLister, 40K Crosslist) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:242 |
| COMP-GAP-243 | Free/public verification | Competitor Intelligence / 7. Technical infrastructure gaps (12) | Edge Add-ons Store presence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:243 |
| COMP-GAP-244 | Free/public verification | Competitor Intelligence / 7. Technical infrastructure gaps (12) | Firefox Add-on equivalents (if any) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:244 |
| COMP-GAP-245 | Behavioral/benchmark test | Competitor Intelligence / 7. Technical infrastructure gaps (12) | p50/p95/p99 API latency per competitor | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:245 |
| COMP-GAP-246 | Behavioral/benchmark test | Competitor Intelligence / 7. Technical infrastructure gaps (12) | Error rates (Sentry if exposed) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:246 |
| COMP-GAP-247 | Behavioral/benchmark test | Competitor Intelligence / 7. Technical infrastructure gaps (12) | Max inventory size supported | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:247 |
| COMP-GAP-248 | Behavioral/benchmark test | Competitor Intelligence / 7. Technical infrastructure gaps (12) | API rate limiting per competitor's own API | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:248 |
| COMP-GAP-249 | Behavioral/benchmark test | Competitor Intelligence / 7. Technical infrastructure gaps (12) | Webhook availability | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:249 |
| COMP-GAP-250 | Free/public verification | Competitor Intelligence / 7. Technical infrastructure gaps (12) | OAuth scopes requested per marketplace | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:250 |
| COMP-GAP-251 | Behavioral/benchmark test | Competitor Intelligence / 7. Technical infrastructure gaps (12) | Session timeout behavior | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:251 |
| COMP-GAP-257 | Free/public verification | Competitor Intelligence / 8. Ecosystem integration gaps (10) | Zapier integrations for all 9 | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:257 |
| COMP-GAP-258 | Free/public verification | Competitor Intelligence / 8. Ecosystem integration gaps (10) | Make (Integromat) integrations | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:258 |
| COMP-GAP-259 | Free/public verification | Competitor Intelligence / 8. Ecosystem integration gaps (10) | IFTTT support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:259 |
| COMP-GAP-260 | Free/public verification | Competitor Intelligence / 8. Ecosystem integration gaps (10) | Airtable connectors | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:260 |
| COMP-GAP-261 | Free/public verification | Competitor Intelligence / 8. Ecosystem integration gaps (10) | Google Sheets integrations | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:261 |
| COMP-GAP-262 | Free/public verification | Competitor Intelligence / 8. Ecosystem integration gaps (10) | QuickBooks / Xero accounting integrations | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:262 |
| COMP-GAP-263 | Free/public verification | Competitor Intelligence / 8. Ecosystem integration gaps (10) | Shopify app listings (Crosslist Magic hinted) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:263 |
| COMP-GAP-264 | Free/public verification | Competitor Intelligence / 8. Ecosystem integration gaps (10) | Etsy App listings | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:264 |
| COMP-GAP-265 | Free/public verification | Competitor Intelligence / 8. Ecosystem integration gaps (10) | eBay Developer Program registrations | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:265 |
| COMP-GAP-266 | Free/public verification | Competitor Intelligence / 8. Ecosystem integration gaps (10) | Native marketplace app-store presence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:266 |
| COMP-GAP-274 | Behavioral/benchmark test | Competitor Intelligence / 9. Mobile app gaps (9) | Feature parity with web | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:274 |
| COMP-GAP-275 | Behavioral/benchmark test | Competitor Intelligence / 9. Mobile app gaps (9) | Automation support on mobile | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:275 |
| COMP-GAP-276 | Insider-only/opaque | Competitor Intelligence / 9. Mobile app gaps (9) | App Store download counts | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:276 |
| COMP-GAP-277 | Insider-only/opaque | Competitor Intelligence / 9. Mobile app gaps (9) | Mobile-specific user counts | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:277 |
| COMP-GAP-278 | Free/public verification | Competitor Intelligence / 9. Mobile app gaps (9) | Price tier differences on mobile | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:278 |
| COMP-GAP-279 | Behavioral/benchmark test | Competitor Intelligence / 9. Mobile app gaps (9) | Mobile analytics capability | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:279 |
| COMP-GAP-280 | Behavioral/benchmark test | Competitor Intelligence / 9. Mobile app gaps (9) | Push notification design | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:280 |
| COMP-GAP-286 | Behavioral/benchmark test | Competitor Intelligence / 10. Comparative operational benchmarks (NEVER PERFORMED — 10) | 100-item closet-share speed benchmark across Flyp/Nifty/PrimeLister/Closo/Vendoo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:286 |
| COMP-GAP-287 | Behavioral/benchmark test | Competitor Intelligence / 10. Comparative operational benchmarks (NEVER PERFORMED — 10) | Cost-per-action ($ per offer sent) at each tier | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:287 |
| COMP-GAP-288 | Behavioral/benchmark test | Competitor Intelligence / 10. Comparative operational benchmarks (NEVER PERFORMED — 10) | Platform-safe detection rate (how often throttled) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:288 |
| COMP-GAP-289 | Behavioral/benchmark test | Competitor Intelligence / 10. Comparative operational benchmarks (NEVER PERFORMED — 10) | Reliability / uptime | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:289 |
| COMP-GAP-290 | Behavioral/benchmark test | Competitor Intelligence / 10. Comparative operational benchmarks (NEVER PERFORMED — 10) | CAPTCHA handling comparison (only Flyp confirmed integrated) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:290 |
| COMP-GAP-291 | Behavioral/benchmark test | Competitor Intelligence / 10. Comparative operational benchmarks (NEVER PERFORMED — 10) | Failed-run recovery | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:291 |
| COMP-GAP-292 | Behavioral/benchmark test | Competitor Intelligence / 10. Comparative operational benchmarks (NEVER PERFORMED — 10) | Multi-day endurance | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:292 |
| COMP-GAP-293 | Behavioral/benchmark test | Competitor Intelligence / 10. Comparative operational benchmarks (NEVER PERFORMED — 10) | Peak-hour vs off-peak performance | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:293 |
| COMP-GAP-294 | Behavioral/benchmark test | Competitor Intelligence / 10. Comparative operational benchmarks (NEVER PERFORMED — 10) | Concurrent automation stress test | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:294 |
| COMP-GAP-295 | Behavioral/benchmark test | Competitor Intelligence / 10. Comparative operational benchmarks (NEVER PERFORMED — 10) | Queue depth behavior under load | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:295 |
| COMP-GAP-301 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Subscriber counts (public earnings not disclosed; Nifty $10.5M revenue self-reported only) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:301 |
| COMP-GAP-302 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | ARPU (average revenue per user) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:302 |
| COMP-GAP-303 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Growth rates | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:303 |
| COMP-GAP-304 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Churn / retention | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:304 |
| COMP-GAP-305 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Engineering team size (LinkedIn estimate: PrimeLister 2-10, others not enumerated) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:305 |
| COMP-GAP-306 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Funding round details beyond top-level ($15.7M Flyp, $990K Closo, others undisclosed) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:306 |
| COMP-GAP-307 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Investor list (Flyp: Asymmetric Capital + Mercari CEO known; others not) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:307 |
| COMP-GAP-308 | Free/public verification | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Founder backgrounds / LinkedIn profiles where names public | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:308 |
| COMP-GAP-309 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Exit strategy / acquisition rumors | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:309 |
| COMP-GAP-310 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Media coverage volume | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:310 |
| COMP-GAP-311 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Conference / event presence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:311 |
| COMP-GAP-312 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Podcast appearances | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:312 |
| COMP-GAP-313 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Patent portfolios | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:313 |
| COMP-GAP-314 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Customer NPS / NPS published | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:314 |
| COMP-GAP-315 | Insider-only/opaque | Competitor Intelligence / 11. Business intelligence gaps (15 — mostly insider) | Annual revenue for 6 of 9 competitors | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:315 |
| COMP-GAP-321 | Behavioral/benchmark test | Competitor Intelligence / 12. Customer support gaps (10 — NONE tested) | Support response time via email for each competitor | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:321 |
| COMP-GAP-322 | Behavioral/benchmark test | Competitor Intelligence / 12. Customer support gaps (10 — NONE tested) | Live chat availability tested (PrimeLister advertises "24/7"; others unknown) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:322 |
| COMP-GAP-323 | Behavioral/benchmark test | Competitor Intelligence / 12. Customer support gaps (10 — NONE tested) | Phone support availability | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:323 |
| COMP-GAP-324 | Behavioral/benchmark test | Competitor Intelligence / 12. Customer support gaps (10 — NONE tested) | Knowledge base depth beyond article counts | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:324 |
| COMP-GAP-325 | Behavioral/benchmark test | Competitor Intelligence / 12. Customer support gaps (10 — NONE tested) | Tutorial video quality | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:325 |
| COMP-GAP-326 | Behavioral/benchmark test | Competitor Intelligence / 12. Customer support gaps (10 — NONE tested) | Live webinars / office hours | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:326 |
| COMP-GAP-327 | Behavioral/benchmark test | Competitor Intelligence / 12. Customer support gaps (10 — NONE tested) | Onboarding coaching availability | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:327 |
| COMP-GAP-328 | Behavioral/benchmark test | Competitor Intelligence / 12. Customer support gaps (10 — NONE tested) | Refund request success rate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:328 |
| COMP-GAP-329 | Behavioral/benchmark test | Competitor Intelligence / 12. Customer support gaps (10 — NONE tested) | Bug report turnaround time | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:329 |
| COMP-GAP-330 | Free/public verification | Competitor Intelligence / 12. Customer support gaps (10 — NONE tested) | Discord / community server activity levels | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:330 |
| COMP-GAP-336 | Behavioral/benchmark test | Competitor Intelligence / 13. Marketing / SEO / brand gaps (10) | Keyword rankings (Ahrefs/SEMrush) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:336 |
| COMP-GAP-337 | Behavioral/benchmark test | Competitor Intelligence / 13. Marketing / SEO / brand gaps (10) | Backlink profiles | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:337 |
| COMP-GAP-338 | Insider-only/opaque | Competitor Intelligence / 13. Marketing / SEO / brand gaps (10) | Content marketing budgets | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:338 |
| COMP-GAP-339 | Free/public verification | Competitor Intelligence / 13. Marketing / SEO / brand gaps (10) | YouTube channel subscriber counts (missing for 7 of 9) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:339 |
| COMP-GAP-340 | Free/public verification | Competitor Intelligence / 13. Marketing / SEO / brand gaps (10) | TikTok follower counts (mostly unknown) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:340 |
| COMP-GAP-341 | Free/public verification | Competitor Intelligence / 13. Marketing / SEO / brand gaps (10) | Instagram follower counts (mostly unknown) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:341 |
| COMP-GAP-342 | Free/public verification | Competitor Intelligence / 13. Marketing / SEO / brand gaps (10) | Facebook Groups community size | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:342 |
| COMP-GAP-343 | Free/public verification | Competitor Intelligence / 13. Marketing / SEO / brand gaps (10) | Reddit mention frequency per sub (r/poshmark, r/Flipping, etc.) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:343 |
| COMP-GAP-344 | Free/public verification | Competitor Intelligence / 13. Marketing / SEO / brand gaps (10) | Discord server member counts | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:344 |
| COMP-GAP-345 | Insider-only/opaque | Competitor Intelligence / 13. Marketing / SEO / brand gaps (10) | Brand sentiment beyond Trustpilot | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:345 |
| COMP-GAP-352 | Insider-only/opaque | Competitor Intelligence / 14. Roadmap / future gaps (7) | Beta features pipeline beyond what's surfaced (Whatnot for Nifty, AI Lister for Crosslist Magic) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:352 |
| COMP-GAP-355 | Insider-only/opaque | Competitor Intelligence / 14. Roadmap / future gaps (7) | Community-driven feature prioritization | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:355 |
| COMP-GAP-356 | Insider-only/opaque | Competitor Intelligence / 14. Roadmap / future gaps (7) | AI roadmap (LLM integrations, vision models) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:356 |
| COMP-GAP-357 | Insider-only/opaque | Competitor Intelligence / 14. Roadmap / future gaps (7) | Marketplace expansion roadmap | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:357 |
| COMP-GAP-363 | Free/public verification | Competitor Intelligence / 15. Session-access gaps (residual) | OneShop Premium trial activation — free tier accessed; bot configs paywalled | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:363 |
| COMP-GAP-364 | Free/public verification | Competitor Intelligence / 15. Session-access gaps (residual) | Crosslist login | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:364 |
| COMP-GAP-366 | Free/public verification | Competitor Intelligence / 15. Session-access gaps (residual) | Poshmark + 5 other per-platform automations in PrimeLister (each $25/mo) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:366 |
| COMP-GAP-367 | Paid/gated verification | Competitor Intelligence / 15. Session-access gaps (residual) | Vendoo Business tier upgrade — Pro unlocked; Business-tier routes confirmed broken on enterprise subdomain | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:367 |
| COMP-GAP-368 | Insider-only/opaque | Competitor Intelligence / 15. Session-access gaps (residual) | Closo if functional UI ships (revival currently cosmetic-only) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:368 |
| COMP-GAP-695 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / PrimeLister endpoints (confirmed + unknown) | GET /user-action-queue-requests/* shape | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:695 |
| COMP-GAP-696 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / PrimeLister endpoints (confirmed + unknown) | GET /account/cookies — writeback shape | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:696 |
| COMP-GAP-697 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / PrimeLister endpoints (confirmed + unknown) | /listings/* CRUD paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:697 |
| COMP-GAP-698 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / PrimeLister endpoints (confirmed + unknown) | /automations/* config paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:698 |
| COMP-GAP-699 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / PrimeLister endpoints (confirmed + unknown) | /analytics/* paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:699 |
| COMP-GAP-700 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / PrimeLister endpoints (confirmed + unknown) | /orders/* paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:700 |
| COMP-GAP-701 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / PrimeLister endpoints (confirmed + unknown) | /crosslist/* paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:701 |
| COMP-GAP-702 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / PrimeLister endpoints (confirmed + unknown) | Versioning scheme (v1/v2) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:702 |
| COMP-GAP-703 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / PrimeLister endpoints (confirmed + unknown) | Pagination strategy | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:703 |
| COMP-GAP-704 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / PrimeLister endpoints (confirmed + unknown) | Bulk operation paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:704 |
| COMP-GAP-707 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Crosslist endpoints | GET /Api/SalesPolling/GetSalesDetectionConfig — response fields beyond polling config | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:707 |
| COMP-GAP-708 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Crosslist endpoints | POST /Api/SalesPolling/SubmitSales — payload shape | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:708 |
| COMP-GAP-709 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Crosslist endpoints | Cross-listing initiation endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:709 |
| COMP-GAP-710 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Crosslist endpoints | Auth endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:710 |
| COMP-GAP-711 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Crosslist endpoints | User settings endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:711 |
| COMP-GAP-712 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Crosslist endpoints | Inventory endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:712 |
| COMP-GAP-715 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Crosslist Magic endpoints | GET /api/get-product — response schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:715 |
| COMP-GAP-716 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Crosslist Magic endpoints | POST /apiv2/extension/* — all sub-paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:716 |
| COMP-GAP-717 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Crosslist Magic endpoints | GET /error-status — response format | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:717 |
| COMP-GAP-718 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Crosslist Magic endpoints | AI Lister endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:718 |
| COMP-GAP-721 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / SellerAider endpoints | app.selleraider.com API paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:721 |
| COMP-GAP-722 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / SellerAider endpoints | dashboard.selleraider.com API paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:722 |
| COMP-GAP-723 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / SellerAider endpoints | Auth endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:723 |
| COMP-GAP-724 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / SellerAider endpoints | Crosslisting job submission path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:724 |
| COMP-GAP-725 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / SellerAider endpoints | Inventory endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:725 |
| COMP-GAP-728 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Flyp endpoints | tools.joinflyp.com crosslister API paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:728 |
| COMP-GAP-729 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Flyp endpoints | Share/offer scheduling endpoint | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:729 |
| COMP-GAP-730 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Flyp endpoints | CAPTCHA solving webhook path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:730 |
| COMP-GAP-731 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Flyp endpoints | Analytics endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:731 |
| COMP-GAP-732 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Flyp endpoints | Orders endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:732 |
| COMP-GAP-733 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Flyp endpoints | Settings/billing endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:733 |
| COMP-GAP-736 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Nifty endpoints | Automation config GET/PATCH paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:736 |
| COMP-GAP-737 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Nifty endpoints | Otto AI chat endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:737 |
| COMP-GAP-738 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Nifty endpoints | Smart Credits purchase endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:738 |
| COMP-GAP-739 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Nifty endpoints | Analytics data endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:739 |
| COMP-GAP-740 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Nifty endpoints | Cross-list publish endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:740 |
| COMP-GAP-741 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Nifty endpoints | Poshmark cookie exchange endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:741 |
| COMP-GAP-744 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / OneShop endpoints | gql-api.oneshop.com/graphql — full schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:744 |
| COMP-GAP-745 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / OneShop endpoints | metadata.app.oneshop.com — response shape | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:745 |
| COMP-GAP-746 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / OneShop endpoints | Bot config mutation names | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:746 |
| COMP-GAP-747 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / OneShop endpoints | Institution link mutation shape | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:747 |
| COMP-GAP-750 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Closo endpoints | wss://app.closo.co/ws/ message types | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:750 |
| COMP-GAP-751 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Closo endpoints | REST fallback endpoint paths | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:751 |
| COMP-GAP-752 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Closo endpoints | X-Closo-Token issuance endpoint | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:752 |
| COMP-GAP-755 | Paid/gated verification | Competitor Intelligence / L3-1: API endpoint paths per competitor / Vendoo endpoints | GET /v2/automations/mapping-rules — full schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:755 |
| COMP-GAP-756 | Paid/gated verification | Competitor Intelligence / L3-1: API endpoint paths per competitor / Vendoo endpoints | GET /v2/automations/pricing-rules — full schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:756 |
| COMP-GAP-757 | Paid/gated verification | Competitor Intelligence / L3-1: API endpoint paths per competitor / Vendoo endpoints | GET /v2/automations/marketplace-defaults — full schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:757 |
| COMP-GAP-758 | Paid/gated verification | Competitor Intelligence / L3-1: API endpoint paths per competitor / Vendoo endpoints | GET /v2/automations/shopify — full schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:758 |
| COMP-GAP-759 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Vendoo endpoints | GET /app/offers — response shape | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:759 |
| COMP-GAP-760 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Vendoo endpoints | GET /app/auto-offers — response shape | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:760 |
| COMP-GAP-761 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Vendoo endpoints | GET /v2/automations/sharing — full config options | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:761 |
| COMP-GAP-762 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Vendoo endpoints | Analytics export endpoint path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:762 |
| COMP-GAP-763 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Vendoo endpoints | Bulk edit submission path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:763 |
| COMP-GAP-764 | Insider-only/opaque | Competitor Intelligence / L3-1: API endpoint paths per competitor / Vendoo endpoints | VendooQueuePulling command schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:764 |
| COMP-GAP-771 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / PrimeLister | Cookie relay POST body schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:771 |
| COMP-GAP-772 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / PrimeLister | Cookie writeback GET response schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:772 |
| COMP-GAP-773 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / PrimeLister | Task queue response schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:773 |
| COMP-GAP-774 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / PrimeLister | Automation panel config schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:774 |
| COMP-GAP-777 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Crosslist | SalesPolling config response fields | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:777 |
| COMP-GAP-778 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Crosslist | SubmitSales payload schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:778 |
| COMP-GAP-781 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Crosslist Magic | /api/get-product response fields | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:781 |
| COMP-GAP-782 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Crosslist Magic | AI Lister response schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:782 |
| COMP-GAP-785 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Flyp | Share task response schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:785 |
| COMP-GAP-786 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Flyp | Offer task response schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:786 |
| COMP-GAP-787 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Flyp | CAPTCHA solve webhook schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:787 |
| COMP-GAP-790 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Nifty | Automation config response schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:790 |
| COMP-GAP-791 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Nifty | Otto chat response schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:791 |
| COMP-GAP-792 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Nifty | Smart Credits balance schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:792 |
| COMP-GAP-795 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / OneShop | invsysStartInstitutionLink mutation response | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:795 |
| COMP-GAP-796 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / OneShop | Bot status query response | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:796 |
| COMP-GAP-799 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Closo | WebSocket message envelope schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:799 |
| COMP-GAP-800 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Closo | REST task response schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:800 |
| COMP-GAP-803 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Vendoo | TN action dispatch schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:803 |
| COMP-GAP-804 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Vendoo | Queue command envelope format | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:804 |
| COMP-GAP-805 | Insider-only/opaque | Competitor Intelligence / L3-2: Response schemas per endpoint / Vendoo | corsRules.json full rule set (16 rules: 7 confirmed platforms + 9 unknown) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:805 |
| COMP-GAP-814 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Poshmark-US | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:814 |
| COMP-GAP-815 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Poshmark-CA | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:815 |
| COMP-GAP-816 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Mercari | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:816 |
| COMP-GAP-817 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | eBay-US | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:817 |
| COMP-GAP-818 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | eBay-CA | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:818 |
| COMP-GAP-819 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | eBay-UK | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:819 |
| COMP-GAP-820 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | eBay-AU | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:820 |
| COMP-GAP-821 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Depop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:821 |
| COMP-GAP-822 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Etsy | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:822 |
| COMP-GAP-823 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Facebook | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:823 |
| COMP-GAP-824 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Grailed | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:824 |
| COMP-GAP-825 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Shopify | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:825 |
| COMP-GAP-826 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Amazon-US | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:826 |
| COMP-GAP-827 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Tradesy | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:827 |
| COMP-GAP-828 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / PrimeLister OAuth scopes | Vestiaire | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:828 |
| COMP-GAP-831 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | Poshmark | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:831 |
| COMP-GAP-832 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | Mercari | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:832 |
| COMP-GAP-833 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | eBay-US | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:833 |
| COMP-GAP-834 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | eBay-UK | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:834 |
| COMP-GAP-835 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | eBay-CA | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:835 |
| COMP-GAP-836 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | Depop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:836 |
| COMP-GAP-837 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | Etsy | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:837 |
| COMP-GAP-838 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | Facebook | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:838 |
| COMP-GAP-839 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | Grailed | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:839 |
| COMP-GAP-840 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | Vinted-US | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:840 |
| COMP-GAP-841 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | Vinted-CA | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:841 |
| COMP-GAP-842 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist OAuth scopes | Vinted-UK | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:842 |
| COMP-GAP-845 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Amazon | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:845 |
| COMP-GAP-846 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Depop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:846 |
| COMP-GAP-847 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | eBay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:847 |
| COMP-GAP-848 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Etsy | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:848 |
| COMP-GAP-849 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Facebook | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:849 |
| COMP-GAP-850 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Grailed | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:850 |
| COMP-GAP-851 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Instagram | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:851 |
| COMP-GAP-852 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Mercari | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:852 |
| COMP-GAP-853 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Poshmark | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:853 |
| COMP-GAP-854 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Shopify | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:854 |
| COMP-GAP-855 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Vinted | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:855 |
| COMP-GAP-856 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Crosslist Magic OAuth scopes | Walmart | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:856 |
| COMP-GAP-859 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Flyp OAuth scopes | Poshmark (uses cookie-as-Bearer, not standard OAuth) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:859 |
| COMP-GAP-860 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Flyp OAuth scopes | Mercari | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:860 |
| COMP-GAP-861 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Flyp OAuth scopes | eBay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:861 |
| COMP-GAP-862 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Flyp OAuth scopes | Depop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:862 |
| COMP-GAP-863 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Flyp OAuth scopes | Facebook | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:863 |
| COMP-GAP-866 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Nifty OAuth scopes | Poshmark (uses cookie bridge, not OAuth) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:866 |
| COMP-GAP-867 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Nifty OAuth scopes | Mercari | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:867 |
| COMP-GAP-868 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Nifty OAuth scopes | eBay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:868 |
| COMP-GAP-869 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Nifty OAuth scopes | Depop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:869 |
| COMP-GAP-870 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Nifty OAuth scopes | Etsy | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:870 |
| COMP-GAP-873 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / OneShop OAuth scopes | Poshmark | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:873 |
| COMP-GAP-874 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / OneShop OAuth scopes | Mercari | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:874 |
| COMP-GAP-875 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / OneShop OAuth scopes | All others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:875 |
| COMP-GAP-878 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Vendoo OAuth scopes | Poshmark | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:878 |
| COMP-GAP-879 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Vendoo OAuth scopes | eBay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:879 |
| COMP-GAP-880 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Vendoo OAuth scopes | Mercari | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:880 |
| COMP-GAP-881 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Vendoo OAuth scopes | Depop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:881 |
| COMP-GAP-882 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Vendoo OAuth scopes | Etsy | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:882 |
| COMP-GAP-883 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Vendoo OAuth scopes | Facebook | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:883 |
| COMP-GAP-884 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Vendoo OAuth scopes | Kidizen | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:884 |
| COMP-GAP-885 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Vendoo OAuth scopes | TheRealReal | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:885 |
| COMP-GAP-886 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Vendoo OAuth scopes | Vinted | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:886 |
| COMP-GAP-887 | Insider-only/opaque | Competitor Intelligence / L3-3: OAuth scope strings per marketplace per competitor / Vendoo OAuth scopes | Grailed | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:887 |
| COMP-GAP-896 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / PrimeLister | API session token TTL | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:896 |
| COMP-GAP-897 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / PrimeLister | Marketplace cookie refresh interval | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:897 |
| COMP-GAP-898 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / PrimeLister | Per-platform token refresh strategy | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:898 |
| COMP-GAP-901 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / Crosslist | SalesPolling alarm interval: confirmed 30 min; token TTL behind that | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:901 |
| COMP-GAP-902 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / Crosslist | Vinted session TTL | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:902 |
| COMP-GAP-905 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / Flyp | Crosslister Bearer token TTL per platform (Poshmark, Mercari, eBay, Depop) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:905 |
| COMP-GAP-906 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / Flyp | Bot Sharer session TTL | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:906 |
| COMP-GAP-909 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / Nifty | Extension cookie handshake TTL | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:909 |
| COMP-GAP-910 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / Nifty | Per-platform token refresh schedule | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:910 |
| COMP-GAP-913 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / OneShop | GraphQL session token TTL | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:913 |
| COMP-GAP-914 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / OneShop | Institution link token TTL | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:914 |
| COMP-GAP-917 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / Vendoo | cookies.set injected token TTL per platform | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:917 |
| COMP-GAP-918 | Insider-only/opaque | Competitor Intelligence / L3-4: Token expiry times per competitor / Vendoo | Queue polling alarm minimum: confirmed 5 min; token TTL | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:918 |
| COMP-GAP-925 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / PrimeLister | Cookie name(s) set on primelister.com domain | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:925 |
| COMP-GAP-926 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / PrimeLister | Cookies set on marketplace domains after writeback | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:926 |
| COMP-GAP-929 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / Crosslist | Cookie name(s) relayed to app.crosslist.com | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:929 |
| COMP-GAP-930 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / Crosslist | Vinted cookie field name | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:930 |
| COMP-GAP-933 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / Flyp Crosslister | Cookie / localStorage key on tools.joinflyp.com | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:933 |
| COMP-GAP-934 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / Flyp Crosslister | Marketplace cookies read per platform | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:934 |
| COMP-GAP-937 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / Nifty | Cookie fields passed to nifty.ai via onConnectExternal | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:937 |
| COMP-GAP-938 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / Nifty | chrome.cookies.getAll domains: confirmed Poshmark; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:938 |
| COMP-GAP-941 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / OneShop | Session key extracted from oneshop.com | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:941 |
| COMP-GAP-942 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / OneShop | GraphQL auth header derivation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:942 |
| COMP-GAP-945 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / Closo | X-Closo-Token cookie/storage key | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:945 |
| COMP-GAP-948 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / Vendoo | Cookie names injected per platform via cookies.set (16 corsRules targets) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:948 |
| COMP-GAP-949 | Insider-only/opaque | Competitor Intelligence / L3-5: Cookie names set by each extension / Vendoo | VendooQueuePulling storage key | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:949 |
| COMP-GAP-956 | Free/public verification | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Closet Share | Min/max slider: confirmed 1–9,000/day | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:956 |
| COMP-GAP-957 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Closet Share | Randomization jitter value | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:957 |
| COMP-GAP-958 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Closet Share | Price filter minimum increments | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:958 |
| COMP-GAP-959 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Closet Share | Time-block DST handling | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:959 |
| COMP-GAP-960 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Closet Share | Default preset on first activation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:960 |
| COMP-GAP-963 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Re-list | Age filter granularity (days/weeks/months) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:963 |
| COMP-GAP-964 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Re-list | Likes threshold minimum | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:964 |
| COMP-GAP-965 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Re-list | Price filter options | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:965 |
| COMP-GAP-966 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Re-list | Max 200/day confirmed; burst limit | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:966 |
| COMP-GAP-969 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Offer to Likers | 15-min enforced delay: confirmed [F]; bypass if any | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:969 |
| COMP-GAP-970 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Offer to Likers | Max rules per config | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:970 |
| COMP-GAP-971 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Offer to Likers | Discount % input range | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:971 |
| COMP-GAP-972 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Offer to Likers | Shipping discount tiers available | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:972 |
| COMP-GAP-975 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Bundle Creation | Min-likes threshold range | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:975 |
| COMP-GAP-976 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Bundle Creation | Comment template variables | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:976 |
| COMP-GAP-977 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Bundle Creation | Max rules count | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:977 |
| COMP-GAP-980 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Follow New Closets | Confirmed 1–9,000/day; per-session burst limit | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:980 |
| COMP-GAP-981 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Follow New Closets | Follow source options (new users / party attendees / etc.) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:981 |
| COMP-GAP-984 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Posh Parties Sharer | Day limit 250 confirmed; source of that limit | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:984 |
| COMP-GAP-985 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Posh Parties Sharer | Evening limit 1,000 confirmed; time cutoff | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:985 |
| COMP-GAP-986 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / PrimeLister Posh Parties Sharer | Loop mode repeat interval | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:986 |
| COMP-GAP-989 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Sharer | Fast speed: actual millisecond delay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:989 |
| COMP-GAP-990 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Sharer | Slow speed: actual millisecond delay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:990 |
| COMP-GAP-991 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Sharer | HDT time picker resolution (15-min blocks vs 1-hr) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:991 |
| COMP-GAP-992 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Sharer | Daily limit 6,000 confirmed; enforcement mechanism | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:992 |
| COMP-GAP-993 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Sharer | Share-order switch cycle logic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:993 |
| COMP-GAP-996 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Community Share | Fast/Medium/Slow/Sloth actual delays | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:996 |
| COMP-GAP-997 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Community Share | Return-rate target range (min/max) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:997 |
| COMP-GAP-998 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Community Share | Date-range picker maximum window | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:998 |
| COMP-GAP-1001 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Auto-Offers | Trigger interval minimum (confirmed "every N minutes") | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1001 |
| COMP-GAP-1002 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Auto-Offers | Discount range (min/max %) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1002 |
| COMP-GAP-1003 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Flyp Auto-Offers | Shipping discount tier count | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1003 |
| COMP-GAP-1006 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Nifty Waterfall Offers | Number of waterfall steps | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1006 |
| COMP-GAP-1007 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Nifty Waterfall Offers | Time between rounds | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1007 |
| COMP-GAP-1008 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Nifty Waterfall Offers | Min-price floor enforcement | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1008 |
| COMP-GAP-1009 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Nifty Waterfall Offers | Rejected-offer trigger behavior | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1009 |
| COMP-GAP-1012 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Nifty Poshmark Closet Share | Dynamic daily recommendation formula (confirmed closet-size-based) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1012 |
| COMP-GAP-1013 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Nifty Poshmark Closet Share | Override manual limit granularity | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1013 |
| COMP-GAP-1016 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Nifty eBay Recreates | Delete + repost vs relist-alike mechanism | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1016 |
| COMP-GAP-1017 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Nifty eBay Recreates | Recreate frequency limit | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1017 |
| COMP-GAP-1020 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Vendoo Marketplace Refresh | Refresh speed field: range (seconds) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1020 |
| COMP-GAP-1021 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Vendoo Marketplace Refresh | Max daily 6,000 confirmed; enforcement | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1021 |
| COMP-GAP-1022 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Vendoo Marketplace Refresh | Refresh-order options beyond "most-recently-edited" and "marketplace order" | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1022 |
| COMP-GAP-1023 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Vendoo Marketplace Refresh | Whether Depop sees refresh as new listing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1023 |
| COMP-GAP-1026 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Vendoo Auto Offers Manager | Max price threshold input range | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1026 |
| COMP-GAP-1027 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Vendoo Auto Offers Manager | Schedule granularity (cron vs interval) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1027 |
| COMP-GAP-1028 | Insider-only/opaque | Competitor Intelligence / L3-6: Per-automation-panel micro-config values / Vendoo Auto Offers Manager | Shipping discount tier options | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1028 |
| COMP-GAP-1035 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / PrimeLister error handling | Poshmark throttle response | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1035 |
| COMP-GAP-1036 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / PrimeLister error handling | eBay 429 response | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1036 |
| COMP-GAP-1037 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / PrimeLister error handling | Marketplace session expiry recovery | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1037 |
| COMP-GAP-1038 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / PrimeLister error handling | Image upload failure | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1038 |
| COMP-GAP-1039 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / PrimeLister error handling | CAPTCHA challenge (no CAPTCHA integration confirmed) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1039 |
| COMP-GAP-1042 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Crosslist error handling | Target-platform rejection on crosspost | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1042 |
| COMP-GAP-1043 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Crosslist error handling | Vinted delete 403 response | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1043 |
| COMP-GAP-1044 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Crosslist error handling | SalesPolling timeout | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1044 |
| COMP-GAP-1047 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Crosslist Magic error handling | Proxy API 500/503 response | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1047 |
| COMP-GAP-1048 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Crosslist Magic error handling | GET /error-status endpoint behavior | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1048 |
| COMP-GAP-1049 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Crosslist Magic error handling | AI Lister failure mode | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1049 |
| COMP-GAP-1052 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Flyp error handling | CAPTCHA solve failure (108 references; failure path unknown) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1052 |
| COMP-GAP-1053 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Flyp error handling | Poshmark suspicious-activity flag response | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1053 |
| COMP-GAP-1054 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Flyp error handling | Mid-run session expiry recovery | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1054 |
| COMP-GAP-1055 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Flyp error handling | Cloud vs local execution fallback trigger | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1055 |
| COMP-GAP-1058 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Nifty error handling | eBay Recreates failure on active offer | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1058 |
| COMP-GAP-1059 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Nifty error handling | Mercari relist rejection | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1059 |
| COMP-GAP-1060 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Nifty error handling | Depop expired token recovery | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1060 |
| COMP-GAP-1061 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Nifty error handling | Otto AI timeout | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1061 |
| COMP-GAP-1064 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / OneShop error handling | Bot config validation errors | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1064 |
| COMP-GAP-1065 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / OneShop error handling | Institution re-auth flow | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1065 |
| COMP-GAP-1068 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Closo error handling | WebSocket disconnect recovery | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1068 |
| COMP-GAP-1069 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Closo error handling | REST fallback trigger condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1069 |
| COMP-GAP-1070 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Closo error handling | SOLD_CHECK_ALARM failure path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1070 |
| COMP-GAP-1073 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Vendoo error handling | itemHasOffers delist skip — confirmed; resolution path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1073 |
| COMP-GAP-1074 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Vendoo error handling | deniedDelist response | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1074 |
| COMP-GAP-1075 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Vendoo error handling | unhandledDelistingError escalation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1075 |
| COMP-GAP-1076 | Insider-only/opaque | Competitor Intelligence / L3-7: Error handling per marketplace per competitor / Vendoo error handling | Header-spoof (corsRules) detected by marketplace | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1076 |
| COMP-GAP-1085 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / PrimeLister | Poshmark variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1085 |
| COMP-GAP-1086 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / PrimeLister | eBay variations (multi-SKU) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1086 |
| COMP-GAP-1087 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / PrimeLister | Mercari multiple sizes | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1087 |
| COMP-GAP-1088 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / PrimeLister | Etsy variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1088 |
| COMP-GAP-1089 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / PrimeLister | Shopify variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1089 |
| COMP-GAP-1092 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Crosslist Magic | eBay variations | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1092 |
| COMP-GAP-1093 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Crosslist Magic | Etsy variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1093 |
| COMP-GAP-1094 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Crosslist Magic | Shopify variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1094 |
| COMP-GAP-1097 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Flyp | Poshmark variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1097 |
| COMP-GAP-1098 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Flyp | Mercari multiple sizes | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1098 |
| COMP-GAP-1099 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Flyp | eBay variations | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1099 |
| COMP-GAP-1102 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Nifty | Poshmark variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1102 |
| COMP-GAP-1103 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Nifty | eBay variation support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1103 |
| COMP-GAP-1104 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Nifty | Mercari size options | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1104 |
| COMP-GAP-1105 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Nifty | Depop variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1105 |
| COMP-GAP-1108 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Vendoo | Poshmark variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1108 |
| COMP-GAP-1109 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Vendoo | eBay variation sync | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1109 |
| COMP-GAP-1110 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Vendoo | Mercari variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1110 |
| COMP-GAP-1111 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Vendoo | Depop variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1111 |
| COMP-GAP-1112 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Vendoo | Etsy variants | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1112 |
| COMP-GAP-1113 | Insider-only/opaque | Competitor Intelligence / L3-8: Per-marketplace-per-competitor variant mapping / Vendoo | Shopify variant sync | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1113 |
| COMP-GAP-1120 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / PrimeLister | Poshmark prepaid label handling | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1120 |
| COMP-GAP-1121 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / PrimeLister | eBay shipping profiles sync | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1121 |
| COMP-GAP-1122 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / PrimeLister | Mercari shipping method options | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1122 |
| COMP-GAP-1123 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / PrimeLister | Depop shipping options | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1123 |
| COMP-GAP-1126 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Flyp | Poshmark shipping discount confirmed (discount tiers in UI); profile sync | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1126 |
| COMP-GAP-1127 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Flyp | eBay shipping options | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1127 |
| COMP-GAP-1128 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Flyp | Mercari shipping method | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1128 |
| COMP-GAP-1131 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Nifty | Poshmark shipping discount tiers | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1131 |
| COMP-GAP-1132 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Nifty | eBay shipping profile | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1132 |
| COMP-GAP-1133 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Nifty | Mercari shipping | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1133 |
| COMP-GAP-1136 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Vendoo | Poshmark shipping discount (confirmed in Auto Offers) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1136 |
| COMP-GAP-1137 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Vendoo | eBay shipping profile mapping | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1137 |
| COMP-GAP-1138 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Vendoo | Mercari shipping options | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1138 |
| COMP-GAP-1139 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Vendoo | Depop shipping method | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1139 |
| COMP-GAP-1140 | Insider-only/opaque | Competitor Intelligence / L3-9: Per-marketplace shipping profile mapping / Vendoo | Etsy shipping profile | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1140 |
| COMP-GAP-1147 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / PrimeLister (15 platforms) | Poshmark: NWT / NWoT / Good / Fair mapping | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1147 |
| COMP-GAP-1148 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / PrimeLister (15 platforms) | eBay: New / Used / For parts condition codes | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1148 |
| COMP-GAP-1149 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / PrimeLister (15 platforms) | Mercari: Like New / Good / Fair / Poor | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1149 |
| COMP-GAP-1150 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / PrimeLister (15 platforms) | Depop: New with tags / Used etc. | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1150 |
| COMP-GAP-1151 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / PrimeLister (15 platforms) | Etsy: New / Used / Handmade | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1151 |
| COMP-GAP-1152 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / PrimeLister (15 platforms) | Grailed: Deadstock / Used conditions | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1152 |
| COMP-GAP-1153 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / PrimeLister (15 platforms) | All others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1153 |
| COMP-GAP-1156 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Crosslist Magic (12 platforms) | eBay condition code | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1156 |
| COMP-GAP-1157 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Crosslist Magic (12 platforms) | Etsy condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1157 |
| COMP-GAP-1158 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Crosslist Magic (12 platforms) | Depop condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1158 |
| COMP-GAP-1159 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Crosslist Magic (12 platforms) | Poshmark condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1159 |
| COMP-GAP-1160 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Crosslist Magic (12 platforms) | All others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1160 |
| COMP-GAP-1163 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Flyp (5 platforms) | Poshmark condition → eBay condition mapping | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1163 |
| COMP-GAP-1164 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Flyp (5 platforms) | Poshmark → Mercari condition mapping | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1164 |
| COMP-GAP-1165 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Flyp (5 platforms) | Poshmark → Depop condition mapping | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1165 |
| COMP-GAP-1168 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Nifty (4 platforms) | Poshmark → eBay condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1168 |
| COMP-GAP-1169 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Nifty (4 platforms) | Poshmark → Mercari condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1169 |
| COMP-GAP-1170 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Nifty (4 platforms) | Poshmark → Depop condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1170 |
| COMP-GAP-1173 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Vendoo (10 platforms) | Poshmark → eBay condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1173 |
| COMP-GAP-1174 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Vendoo (10 platforms) | Poshmark → Mercari condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1174 |
| COMP-GAP-1175 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Vendoo (10 platforms) | Poshmark → Depop condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1175 |
| COMP-GAP-1176 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Vendoo (10 platforms) | Poshmark → Etsy condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1176 |
| COMP-GAP-1177 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Vendoo (10 platforms) | Poshmark → Grailed condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1177 |
| COMP-GAP-1178 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Vendoo (10 platforms) | Poshmark → Kidizen condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1178 |
| COMP-GAP-1179 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Vendoo (10 platforms) | Poshmark → TheRealReal condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1179 |
| COMP-GAP-1180 | Insider-only/opaque | Competitor Intelligence / L3-10: Per-marketplace condition label mapping / Vendoo (10 platforms) | Poshmark → Vinted condition | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1180 |
| COMP-GAP-1187 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / PrimeLister | US → UK size conversion presence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1187 |
| COMP-GAP-1188 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / PrimeLister | US → EU size conversion presence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1188 |
| COMP-GAP-1189 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / PrimeLister | Grailed size (S/M/L vs numeric) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1189 |
| COMP-GAP-1190 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / PrimeLister | Vestiaire size system | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1190 |
| COMP-GAP-1193 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Crosslist | US → UK/EU size toggle | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1193 |
| COMP-GAP-1194 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Crosslist | Vinted size system (EU numeric) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1194 |
| COMP-GAP-1197 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Crosslist Magic | Vinted EU size handling | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1197 |
| COMP-GAP-1198 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Crosslist Magic | eBay international size | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1198 |
| COMP-GAP-1201 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Flyp | Poshmark → Depop size | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1201 |
| COMP-GAP-1202 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Flyp | Poshmark → eBay size | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1202 |
| COMP-GAP-1205 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Nifty | Poshmark → Depop size | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1205 |
| COMP-GAP-1206 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Nifty | Poshmark → Mercari size | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1206 |
| COMP-GAP-1209 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Vendoo | Vinted EU size handling | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1209 |
| COMP-GAP-1210 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Vendoo | TheRealReal size system | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1210 |
| COMP-GAP-1211 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Vendoo | Kidizen children's sizing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1211 |
| COMP-GAP-1212 | Insider-only/opaque | Competitor Intelligence / L3-11: Per-marketplace size system conversion / Vendoo | Grailed numeric vs letter | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1212 |
| COMP-GAP-1219 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / PrimeLister (15 platforms) | Max image count per platform | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1219 |
| COMP-GAP-1220 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / PrimeLister (15 platforms) | Min resolution per platform | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1220 |
| COMP-GAP-1221 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / PrimeLister (15 platforms) | Background color requirements | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1221 |
| COMP-GAP-1222 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / PrimeLister (15 platforms) | Watermark rules | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1222 |
| COMP-GAP-1225 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Crosslist Magic | Amazon image count / resolution | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1225 |
| COMP-GAP-1226 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Crosslist Magic | Instagram aspect ratio | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1226 |
| COMP-GAP-1227 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Crosslist Magic | Facebook Commerce image rules | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1227 |
| COMP-GAP-1230 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Flyp | eBay image count limit | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1230 |
| COMP-GAP-1231 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Flyp | Depop image limit | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1231 |
| COMP-GAP-1232 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Flyp | Mercari image limit | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1232 |
| COMP-GAP-1235 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Nifty | eBay image count | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1235 |
| COMP-GAP-1236 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Nifty | Depop image requirements | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1236 |
| COMP-GAP-1237 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Nifty | Mercari image count | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1237 |
| COMP-GAP-1240 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Vendoo | AI background removal output resolution | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1240 |
| COMP-GAP-1241 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Vendoo | Kidizen image rules | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1241 |
| COMP-GAP-1242 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Vendoo | TheRealReal image requirements | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1242 |
| COMP-GAP-1243 | Insider-only/opaque | Competitor Intelligence / L3-12: Per-marketplace image requirements / Vendoo | Vinted image rules | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1243 |
| COMP-GAP-1249 | Insider-only/opaque | Competitor Intelligence / L3-13: Per-marketplace video support | PrimeLister: Poshmark video [I]; eBay video [I]; all others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1249 |
| COMP-GAP-1250 | Insider-only/opaque | Competitor Intelligence / L3-13: Per-marketplace video support | Crosslist: Poshmark video support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1250 |
| COMP-GAP-1251 | Insider-only/opaque | Competitor Intelligence / L3-13: Per-marketplace video support | Crosslist Magic: Instagram video [I]; eBay video | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1251 |
| COMP-GAP-1252 | Insider-only/opaque | Competitor Intelligence / L3-13: Per-marketplace video support | Flyp: Poshmark video | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1252 |
| COMP-GAP-1253 | Insider-only/opaque | Competitor Intelligence / L3-13: Per-marketplace video support | Nifty: Poshmark video [I]; Depop video | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1253 |
| COMP-GAP-1254 | Insider-only/opaque | Competitor Intelligence / L3-13: Per-marketplace video support | Vendoo: Confirmed "Listing Videos" feature [P]; per-platform video support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1254 |
| COMP-GAP-1255 | Insider-only/opaque | Competitor Intelligence / L3-13: Per-marketplace video support | SellerAider: Poshmark video | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1255 |
| COMP-GAP-1256 | Insider-only/opaque | Competitor Intelligence / L3-13: Per-marketplace video support | OneShop: Poshmark video | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1256 |
| COMP-GAP-1265 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / PrimeLister | Poshmark title (80 char): enforced? [I]; description (500): | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1265 |
| COMP-GAP-1266 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / PrimeLister | eBay title (80 char): [I]; description: | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1266 |
| COMP-GAP-1267 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / PrimeLister | Mercari title (40 char): | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1267 |
| COMP-GAP-1268 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / PrimeLister | Etsy title (140 char): | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1268 |
| COMP-GAP-1269 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / PrimeLister | Depop title (50 char): | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1269 |
| COMP-GAP-1272 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / Crosslist / Crosslist Magic | Per-platform char limit enforcement (all 12 platforms) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1272 |
| COMP-GAP-1275 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / Flyp | Poshmark → Mercari title truncation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1275 |
| COMP-GAP-1276 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / Flyp | Poshmark → eBay title truncation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1276 |
| COMP-GAP-1277 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / Flyp | Poshmark → Depop title truncation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1277 |
| COMP-GAP-1280 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / Nifty / Vendoo | Auto-truncate vs warn-user on limit | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1280 |
| COMP-GAP-1281 | Insider-only/opaque | Competitor Intelligence / L3-14: Per-marketplace character-count limits per field / Nifty / Vendoo | Per-platform field limit list | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1281 |
| COMP-GAP-1287 | Insider-only/opaque | Competitor Intelligence / L3-15: Per-marketplace emoji and HTML support | PrimeLister: Poshmark emoji [I]; eBay HTML [I]; Etsy HTML | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1287 |
| COMP-GAP-1288 | Insider-only/opaque | Competitor Intelligence / L3-15: Per-marketplace emoji and HTML support | Crosslist: Vinted emoji/HTML [I]; eBay HTML tags | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1288 |
| COMP-GAP-1289 | Insider-only/opaque | Competitor Intelligence / L3-15: Per-marketplace emoji and HTML support | Crosslist Magic: Instagram emoji [I]; Facebook HTML | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1289 |
| COMP-GAP-1290 | Insider-only/opaque | Competitor Intelligence / L3-15: Per-marketplace emoji and HTML support | Flyp: Poshmark emoji passthrough [I]; Mercari emoji | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1290 |
| COMP-GAP-1291 | Insider-only/opaque | Competitor Intelligence / L3-15: Per-marketplace emoji and HTML support | Nifty: Poshmark emoji [I]; eBay HTML | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1291 |
| COMP-GAP-1292 | Insider-only/opaque | Competitor Intelligence / L3-15: Per-marketplace emoji and HTML support | Vendoo: Depop HTML [I]; Grailed HTML [I]; all others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1292 |
| COMP-GAP-1298 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | PrimeLister: Chrome min version [F]; Edge [F]; Brave [F]; Vivaldi [F]; Arc [F]; Opera | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1298 |
| COMP-GAP-1299 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | Crosslist: Chrome min [F]; Edge [F]; Brave [F]; Arc | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1299 |
| COMP-GAP-1300 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | Crosslist Magic: Chrome min [F]; Edge [F]; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1300 |
| COMP-GAP-1301 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | SellerAider: Chrome min [F]; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1301 |
| COMP-GAP-1302 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | Flyp Crosslister: Chrome min [F]; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1302 |
| COMP-GAP-1303 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | Flyp Bot Sharer: Chrome min [F]; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1303 |
| COMP-GAP-1304 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | Nifty: Chrome min [F]; Edge [F]; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1304 |
| COMP-GAP-1305 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | OneShop: Chrome min [F]; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1305 |
| COMP-GAP-1306 | Insider-only/opaque | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | Closo: Chrome min (abandoned) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1306 |
| COMP-GAP-1307 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | Vendoo: Chrome min [F]; Edge [F]; Brave [F]; Arc | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1307 |
| COMP-GAP-1308 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | Firefox port exists: all 10 extensions | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1308 |
| COMP-GAP-1309 | Free/public verification | Competitor Intelligence / L3-16: Per-competitor browser minimum versions | Safari Web Extension port: all 10 | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1309 |
| COMP-GAP-1318 | Behavioral/benchmark test | Competitor Intelligence / L3-17: Per-competitor mobile app features / PrimeLister (iOS + Android confirmed — T1 verified 2026-04-19) | iOS feature parity vs web | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1318 |
| COMP-GAP-1319 | Behavioral/benchmark test | Competitor Intelligence / L3-17: Per-competitor mobile app features / PrimeLister (iOS + Android confirmed — T1 verified 2026-04-19) | Android feature parity vs web | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1319 |
| COMP-GAP-1320 | Behavioral/benchmark test | Competitor Intelligence / L3-17: Per-competitor mobile app features / PrimeLister (iOS + Android confirmed — T1 verified 2026-04-19) | iOS automation support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1320 |
| COMP-GAP-1321 | Behavioral/benchmark test | Competitor Intelligence / L3-17: Per-competitor mobile app features / PrimeLister (iOS + Android confirmed — T1 verified 2026-04-19) | Android automation support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1321 |
| COMP-GAP-1322 | Behavioral/benchmark test | Competitor Intelligence / L3-17: Per-competitor mobile app features / PrimeLister (iOS + Android confirmed — T1 verified 2026-04-19) | iOS push notification types | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1322 |
| COMP-GAP-1323 | Behavioral/benchmark test | Competitor Intelligence / L3-17: Per-competitor mobile app features / PrimeLister (iOS + Android confirmed — T1 verified 2026-04-19) | Android push notification types | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1323 |
| COMP-GAP-1327 | Free/public verification | Competitor Intelligence / L3-17: Per-competitor mobile app features / OneShop (iOS + Android confirmed — T1 verified 2026-04-19) | Feature list on mobile | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1327 |
| COMP-GAP-1328 | Behavioral/benchmark test | Competitor Intelligence / L3-17: Per-competitor mobile app features / OneShop (iOS + Android confirmed — T1 verified 2026-04-19) | Automation on mobile | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1328 |
| COMP-GAP-1332 | Behavioral/benchmark test | Competitor Intelligence / L3-17: Per-competitor mobile app features / Vendoo (iOS + Android confirmed — T1 verified 2026-04-19) | If exists: feature parity | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1332 |
| COMP-GAP-1336 | Behavioral/benchmark test | Competitor Intelligence / L3-17: Per-competitor mobile app features / Crosslist, Crosslist Magic, SellerAider, Flyp, Nifty, Closo (T1 verified 2026-04-19) | If exists: feature parity (each) — N/A for all 6 (no native apps) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1336 |
| COMP-GAP-1342 | Insider-only/opaque | Competitor Intelligence / L3-18: Per-competitor webhook event types | PrimeLister: webhook presence [I]; event types | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1342 |
| COMP-GAP-1343 | Insider-only/opaque | Competitor Intelligence / L3-18: Per-competitor webhook event types | Crosslist: webhook presence [I]; event types | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1343 |
| COMP-GAP-1344 | Insider-only/opaque | Competitor Intelligence / L3-18: Per-competitor webhook event types | Crosslist Magic: webhook presence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1344 |
| COMP-GAP-1345 | Insider-only/opaque | Competitor Intelligence / L3-18: Per-competitor webhook event types | SellerAider: webhook presence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1345 |
| COMP-GAP-1346 | Insider-only/opaque | Competitor Intelligence / L3-18: Per-competitor webhook event types | Flyp: webhook presence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1346 |
| COMP-GAP-1347 | Free/public verification | Competitor Intelligence / L3-18: Per-competitor webhook event types | Nifty: webhook presence [I]; API access | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1347 |
| COMP-GAP-1348 | Insider-only/opaque | Competitor Intelligence / L3-18: Per-competitor webhook event types | OneShop: webhook presence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1348 |
| COMP-GAP-1349 | Insider-only/opaque | Competitor Intelligence / L3-18: Per-competitor webhook event types | Closo: webhook presence | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1349 |
| COMP-GAP-1350 | Insider-only/opaque | Competitor Intelligence / L3-18: Per-competitor webhook event types | Vendoo: webhook presence [I]; event types | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1350 |
| COMP-GAP-1356 | Free/public verification | Competitor Intelligence / L3-19: Per-competitor payment methods | PrimeLister: credit card [F]; PayPal [F]; Apple Pay [F]; Google Pay [F]; bank transfer | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1356 |
| COMP-GAP-1357 | Free/public verification | Competitor Intelligence / L3-19: Per-competitor payment methods | Crosslist: credit card [F]; PayPal [F]; Apple Pay [F]; Google Pay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1357 |
| COMP-GAP-1358 | Free/public verification | Competitor Intelligence / L3-19: Per-competitor payment methods | Crosslist Magic: credit card [F]; PayPal [F]; Apple Pay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1358 |
| COMP-GAP-1359 | Free/public verification | Competitor Intelligence / L3-19: Per-competitor payment methods | SellerAider: credit card [F]; PayPal [F]; Apple Pay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1359 |
| COMP-GAP-1360 | Free/public verification | Competitor Intelligence / L3-19: Per-competitor payment methods | Flyp: credit card [F]; PayPal [F]; Apple Pay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1360 |
| COMP-GAP-1361 | Free/public verification | Competitor Intelligence / L3-19: Per-competitor payment methods | Nifty: credit card [F]; PayPal [F]; Apple Pay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1361 |
| COMP-GAP-1362 | Free/public verification | Competitor Intelligence / L3-19: Per-competitor payment methods | OneShop: credit card [F]; PayPal [F]; Apple Pay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1362 |
| COMP-GAP-1363 | Insider-only/opaque | Competitor Intelligence / L3-19: Per-competitor payment methods | Closo: current payment methods | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1363 |
| COMP-GAP-1364 | Free/public verification | Competitor Intelligence / L3-19: Per-competitor payment methods | Vendoo: credit card [F]; PayPal [F]; Apple Pay [F]; Google Pay | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1364 |
| COMP-GAP-1370 | Free/public verification | Competitor Intelligence / L3-20: Per-competitor currency and region restrictions | PrimeLister: USD confirmed; CAD [F]; GBP [F]; EUR [F]; AUD [F]; region blocks | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1370 |
| COMP-GAP-1371 | Free/public verification | Competitor Intelligence / L3-20: Per-competitor currency and region restrictions | Crosslist: USD + EUR (Belgium HQ); others [F]; EU seller support | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1371 |
| COMP-GAP-1372 | Free/public verification | Competitor Intelligence / L3-20: Per-competitor currency and region restrictions | Crosslist Magic: USD; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1372 |
| COMP-GAP-1373 | Free/public verification | Competitor Intelligence / L3-20: Per-competitor currency and region restrictions | SellerAider: USD; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1373 |
| COMP-GAP-1374 | Free/public verification | Competitor Intelligence / L3-20: Per-competitor currency and region restrictions | Flyp: USD; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1374 |
| COMP-GAP-1375 | Free/public verification | Competitor Intelligence / L3-20: Per-competitor currency and region restrictions | Nifty: USD; CAD [F]; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1375 |
| COMP-GAP-1376 | Free/public verification | Competitor Intelligence / L3-20: Per-competitor currency and region restrictions | OneShop: USD; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1376 |
| COMP-GAP-1377 | Insider-only/opaque | Competitor Intelligence / L3-20: Per-competitor currency and region restrictions | Closo: unknown | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1377 |
| COMP-GAP-1378 | Free/public verification | Competitor Intelligence / L3-20: Per-competitor currency and region restrictions | Vendoo: USD; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1378 |
| COMP-GAP-1384 | Free/public verification | Competitor Intelligence / L3-21: Per-competitor regional pricing variations | PrimeLister: US vs CA vs AU pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1384 |
| COMP-GAP-1385 | Free/public verification | Competitor Intelligence / L3-21: Per-competitor regional pricing variations | Crosslist: EU vs US pricing (BE-based company) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1385 |
| COMP-GAP-1386 | Free/public verification | Competitor Intelligence / L3-21: Per-competitor regional pricing variations | Crosslist Magic: regional pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1386 |
| COMP-GAP-1387 | Free/public verification | Competitor Intelligence / L3-21: Per-competitor regional pricing variations | SellerAider: regional pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1387 |
| COMP-GAP-1388 | Free/public verification | Competitor Intelligence / L3-21: Per-competitor regional pricing variations | Flyp: regional pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1388 |
| COMP-GAP-1389 | Free/public verification | Competitor Intelligence / L3-21: Per-competitor regional pricing variations | Nifty: regional pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1389 |
| COMP-GAP-1390 | Free/public verification | Competitor Intelligence / L3-21: Per-competitor regional pricing variations | OneShop: regional pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1390 |
| COMP-GAP-1391 | Insider-only/opaque | Competitor Intelligence / L3-21: Per-competitor regional pricing variations | Closo: pricing unknown | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1391 |
| COMP-GAP-1392 | Free/public verification | Competitor Intelligence / L3-21: Per-competitor regional pricing variations | Vendoo: regional pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1392 |
| COMP-GAP-1398 | Insider-only/opaque | Competitor Intelligence / L3-22: Per-competitor grandfathered pricing preservation | PrimeLister: grandfathered users on legacy plans | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1398 |
| COMP-GAP-1399 | Insider-only/opaque | Competitor Intelligence / L3-22: Per-competitor grandfathered pricing preservation | Crosslist: Crosslist 2.0 migration pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1399 |
| COMP-GAP-1400 | Insider-only/opaque | Competitor Intelligence / L3-22: Per-competitor grandfathered pricing preservation | Crosslist Magic: no tier changes visible; grandfathering | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1400 |
| COMP-GAP-1401 | Insider-only/opaque | Competitor Intelligence / L3-22: Per-competitor grandfathered pricing preservation | SellerAider: grandfathering policy | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1401 |
| COMP-GAP-1402 | Insider-only/opaque | Competitor Intelligence / L3-22: Per-competitor grandfathered pricing preservation | Flyp: post-trial legacy pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1402 |
| COMP-GAP-1403 | Insider-only/opaque | Competitor Intelligence / L3-22: Per-competitor grandfathered pricing preservation | Nifty: AutoPosher → Nifty migration pricing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1403 |
| COMP-GAP-1404 | Insider-only/opaque | Competitor Intelligence / L3-22: Per-competitor grandfathered pricing preservation | OneShop: YC-era pricing vs current | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1404 |
| COMP-GAP-1405 | Insider-only/opaque | Competitor Intelligence / L3-22: Per-competitor grandfathered pricing preservation | Closo: no active users likely | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1405 |
| COMP-GAP-1406 | Insider-only/opaque | Competitor Intelligence / L3-22: Per-competitor grandfathered pricing preservation | Vendoo: Lite → Pro migration grandfathering | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1406 |
| COMP-GAP-1412 | Insider-only/opaque | Competitor Intelligence / L3-23: Per-competitor dunning retry schedules | PrimeLister: retry schedule | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1412 |
| COMP-GAP-1413 | Insider-only/opaque | Competitor Intelligence / L3-23: Per-competitor dunning retry schedules | Crosslist: retry schedule | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1413 |
| COMP-GAP-1414 | Insider-only/opaque | Competitor Intelligence / L3-23: Per-competitor dunning retry schedules | Crosslist Magic: retry schedule | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1414 |
| COMP-GAP-1415 | Insider-only/opaque | Competitor Intelligence / L3-23: Per-competitor dunning retry schedules | SellerAider: retry schedule | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1415 |
| COMP-GAP-1416 | Insider-only/opaque | Competitor Intelligence / L3-23: Per-competitor dunning retry schedules | Flyp: retry schedule | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1416 |
| COMP-GAP-1417 | Insider-only/opaque | Competitor Intelligence / L3-23: Per-competitor dunning retry schedules | Nifty: retry schedule | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1417 |
| COMP-GAP-1418 | Insider-only/opaque | Competitor Intelligence / L3-23: Per-competitor dunning retry schedules | OneShop: retry schedule | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1418 |
| COMP-GAP-1419 | Insider-only/opaque | Competitor Intelligence / L3-23: Per-competitor dunning retry schedules | Closo: not applicable | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1419 |
| COMP-GAP-1420 | Insider-only/opaque | Competitor Intelligence / L3-23: Per-competitor dunning retry schedules | Vendoo: retry schedule | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1420 |
| COMP-GAP-1426 | Insider-only/opaque | Competitor Intelligence / L3-24: Per-competitor coupon stackability | PrimeLister: coupons exist; stackability | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1426 |
| COMP-GAP-1427 | Free/public verification | Competitor Intelligence / L3-24: Per-competitor coupon stackability | Crosslist: coupon system | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1427 |
| COMP-GAP-1428 | Free/public verification | Competitor Intelligence / L3-24: Per-competitor coupon stackability | Crosslist Magic: 7-day trial only; coupon system | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1428 |
| COMP-GAP-1429 | Free/public verification | Competitor Intelligence / L3-24: Per-competitor coupon stackability | SellerAider: coupon system | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1429 |
| COMP-GAP-1430 | Free/public verification | Competitor Intelligence / L3-24: Per-competitor coupon stackability | Flyp: 99-day trial; coupon system | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1430 |
| COMP-GAP-1431 | Free/public verification | Competitor Intelligence / L3-24: Per-competitor coupon stackability | Nifty: 7-day trial; coupon system | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1431 |
| COMP-GAP-1432 | Free/public verification | Competitor Intelligence / L3-24: Per-competitor coupon stackability | OneShop: coupon system | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1432 |
| COMP-GAP-1433 | Insider-only/opaque | Competitor Intelligence / L3-24: Per-competitor coupon stackability | Closo: not applicable | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1433 |
| COMP-GAP-1434 | Free/public verification | Competitor Intelligence / L3-24: Per-competitor coupon stackability | Vendoo: coupon system | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1434 |
| COMP-GAP-1445 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Which LLM provider per competitor | PrimeLister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1445 |
| COMP-GAP-1446 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Which LLM provider per competitor | Crosslist | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1446 |
| COMP-GAP-1447 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Which LLM provider per competitor | Crosslist Magic: AI Lister beta — provider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1447 |
| COMP-GAP-1448 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Which LLM provider per competitor | SellerAider: "AI listing generation" claimed — provider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1448 |
| COMP-GAP-1449 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Which LLM provider per competitor | Flyp | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1449 |
| COMP-GAP-1450 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Which LLM provider per competitor | Nifty: AI Bulk Generate + Otto — provider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1450 |
| COMP-GAP-1451 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Which LLM provider per competitor | OneShop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1451 |
| COMP-GAP-1452 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Which LLM provider per competitor | Closo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1452 |
| COMP-GAP-1453 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Which LLM provider per competitor | Vendoo: AI background removal (likely CV, not LLM) — provider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1453 |
| COMP-GAP-1456 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Token budgets per AI request | Crosslist Magic AI Lister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1456 |
| COMP-GAP-1457 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Token budgets per AI request | SellerAider AI listing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1457 |
| COMP-GAP-1458 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Token budgets per AI request | Nifty AI Bulk Generate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1458 |
| COMP-GAP-1459 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Token budgets per AI request | Nifty Otto chat | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1459 |
| COMP-GAP-1462 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Vision model provider (for photo-to-listing) | Crosslist Magic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1462 |
| COMP-GAP-1463 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Vision model provider (for photo-to-listing) | SellerAider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1463 |
| COMP-GAP-1464 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Vision model provider (for photo-to-listing) | Nifty AI Bulk Generate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1464 |
| COMP-GAP-1467 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Fine-tuning presence | Crosslist Magic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1467 |
| COMP-GAP-1468 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Fine-tuning presence | Nifty | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1468 |
| COMP-GAP-1469 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Fine-tuning presence | SellerAider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1469 |
| COMP-GAP-1472 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Streaming vs non-streaming AI response | Crosslist Magic AI Lister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1472 |
| COMP-GAP-1473 | Behavioral/benchmark test | Competitor Intelligence / Category 25: AI/LLM integration details / Streaming vs non-streaming AI response | Nifty Otto chat | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1473 |
| COMP-GAP-1474 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Streaming vs non-streaming AI response | SellerAider AI | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1474 |
| COMP-GAP-1477 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / AI response caching strategy | Crosslist Magic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1477 |
| COMP-GAP-1478 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / AI response caching strategy | Nifty | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1478 |
| COMP-GAP-1481 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Fallback provider | Crosslist Magic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1481 |
| COMP-GAP-1482 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Fallback provider | Nifty | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1482 |
| COMP-GAP-1483 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / Fallback provider | SellerAider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1483 |
| COMP-GAP-1486 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / AI credit reset schedule | Nifty Smart Credits: confirmed monthly renewal, 50/mo on Bundle Pro [F]; exact reset date | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1486 |
| COMP-GAP-1487 | Insider-only/opaque | Competitor Intelligence / Category 25: AI/LLM integration details / AI credit reset schedule | SellerAider AI credits if any | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1487 |
| COMP-GAP-1494 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / ID format per competitor (UUID / sequential / snowflake) | PrimeLister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1494 |
| COMP-GAP-1495 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / ID format per competitor (UUID / sequential / snowflake) | Crosslist | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1495 |
| COMP-GAP-1496 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / ID format per competitor (UUID / sequential / snowflake) | Crosslist Magic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1496 |
| COMP-GAP-1497 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / ID format per competitor (UUID / sequential / snowflake) | SellerAider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1497 |
| COMP-GAP-1498 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / ID format per competitor (UUID / sequential / snowflake) | Flyp | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1498 |
| COMP-GAP-1499 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / ID format per competitor (UUID / sequential / snowflake) | Nifty | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1499 |
| COMP-GAP-1500 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / ID format per competitor (UUID / sequential / snowflake) | OneShop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1500 |
| COMP-GAP-1501 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / ID format per competitor (UUID / sequential / snowflake) | Closo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1501 |
| COMP-GAP-1502 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / ID format per competitor (UUID / sequential / snowflake) | Vendoo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1502 |
| COMP-GAP-1505 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Timestamp format (ISO-8601 / epoch / custom) | PrimeLister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1505 |
| COMP-GAP-1506 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Timestamp format (ISO-8601 / epoch / custom) | Crosslist | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1506 |
| COMP-GAP-1507 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Timestamp format (ISO-8601 / epoch / custom) | Flyp | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1507 |
| COMP-GAP-1508 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Timestamp format (ISO-8601 / epoch / custom) | Nifty | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1508 |
| COMP-GAP-1509 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Timestamp format (ISO-8601 / epoch / custom) | Vendoo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1509 |
| COMP-GAP-1512 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Pagination token format (cursor / offset / page / opaque) | PrimeLister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1512 |
| COMP-GAP-1513 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Pagination token format (cursor / offset / page / opaque) | Flyp | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1513 |
| COMP-GAP-1514 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Pagination token format (cursor / offset / page / opaque) | Nifty | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1514 |
| COMP-GAP-1515 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Pagination token format (cursor / offset / page / opaque) | OneShop GraphQL (cursor likely) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1515 |
| COMP-GAP-1516 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Pagination token format (cursor / offset / page / opaque) | Vendoo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1516 |
| COMP-GAP-1519 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Bulk operation semantics (all-or-nothing vs partial) | PrimeLister bulk crosslist | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1519 |
| COMP-GAP-1520 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Bulk operation semantics (all-or-nothing vs partial) | Vendoo bulk edit | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1520 |
| COMP-GAP-1521 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Bulk operation semantics (all-or-nothing vs partial) | Nifty bulk generate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1521 |
| COMP-GAP-1522 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Bulk operation semantics (all-or-nothing vs partial) | Flyp bulk offers | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1522 |
| COMP-GAP-1525 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Soft delete vs hard delete | PrimeLister delist | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1525 |
| COMP-GAP-1526 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Soft delete vs hard delete | Crosslist delist (Vinted confirmed DELETE; others) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1526 |
| COMP-GAP-1527 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Soft delete vs hard delete | Flyp delist | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1527 |
| COMP-GAP-1528 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Soft delete vs hard delete | Nifty delist | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1528 |
| COMP-GAP-1529 | Behavioral/benchmark test | Competitor Intelligence / Category 26: Data model / schema inferences / Soft delete vs hard delete | Vendoo delist confirmed (archive/delete options visible) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1529 |
| COMP-GAP-1532 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Record versioning | PrimeLister inventory item revisions | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1532 |
| COMP-GAP-1533 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Record versioning | Nifty listing revision history | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1533 |
| COMP-GAP-1534 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Record versioning | Vendoo listing revision history | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1534 |
| COMP-GAP-1537 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Entity relationship model inferred from API | PrimeLister: User → Task → Platform → Listing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1537 |
| COMP-GAP-1538 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Entity relationship model inferred from API | Nifty: User → Platform → AutomationRule → Listing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1538 |
| COMP-GAP-1539 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Entity relationship model inferred from API | OneShop: User → Institution → Bot → Listing (GraphQL inferred) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1539 |
| COMP-GAP-1540 | Insider-only/opaque | Competitor Intelligence / Category 26: Data model / schema inferences / Entity relationship model inferred from API | Vendoo: User → Listing → Platform × Status | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1540 |
| COMP-GAP-1547 | Insider-only/opaque | Competitor Intelligence / Category 27: Notifications / Email notification types per competitor | PrimeLister: sale notification [I]; task complete [I]; billing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1547 |
| COMP-GAP-1548 | Insider-only/opaque | Competitor Intelligence / Category 27: Notifications / Email notification types per competitor | Crosslist: sale notification [I]; billing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1548 |
| COMP-GAP-1549 | Insider-only/opaque | Competitor Intelligence / Category 27: Notifications / Email notification types per competitor | Flyp: sale notification [I]; task complete [I]; billing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1549 |
| COMP-GAP-1550 | Insider-only/opaque | Competitor Intelligence / Category 27: Notifications / Email notification types per competitor | Nifty: sale notification [I]; task complete [I]; billing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1550 |
| COMP-GAP-1551 | Insider-only/opaque | Competitor Intelligence / Category 27: Notifications / Email notification types per competitor | OneShop: sale notification [I]; billing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1551 |
| COMP-GAP-1552 | Insider-only/opaque | Competitor Intelligence / Category 27: Notifications / Email notification types per competitor | Vendoo: sale notification [I]; task complete [I]; billing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1552 |
| COMP-GAP-1553 | Insider-only/opaque | Competitor Intelligence / Category 27: Notifications / Email notification types per competitor | SellerAider: email types | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1553 |
| COMP-GAP-1554 | Insider-only/opaque | Competitor Intelligence / Category 27: Notifications / Email notification types per competitor | Crosslist Magic: email types | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1554 |
| COMP-GAP-1557 | Behavioral/benchmark test | Competitor Intelligence / Category 27: Notifications / Push notification support (mobile) | PrimeLister iOS/Android push | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1557 |
| COMP-GAP-1558 | Behavioral/benchmark test | Competitor Intelligence / Category 27: Notifications / Push notification support (mobile) | OneShop iOS/Android push | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1558 |
| COMP-GAP-1562 | Behavioral/benchmark test | Competitor Intelligence / Category 27: Notifications / In-app toast patterns | PrimeLister task status toast | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1562 |
| COMP-GAP-1563 | Behavioral/benchmark test | Competitor Intelligence / Category 27: Notifications / In-app toast patterns | Flyp activity log confirmation | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1563 |
| COMP-GAP-1564 | Behavioral/benchmark test | Competitor Intelligence / Category 27: Notifications / In-app toast patterns | Nifty Smart Credits depletion toast | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1564 |
| COMP-GAP-1565 | Free/public verification | Competitor Intelligence / Category 27: Notifications / In-app toast patterns | Vendoo delist-blocked toast (confirmed itemHasOffers message) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1565 |
| COMP-GAP-1568 | Free/public verification | Competitor Intelligence / Category 27: Notifications / SMS notification support | All 9 competitors (none confirmed, need verification) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1568 |
| COMP-GAP-1571 | Insider-only/opaque | Competitor Intelligence / Category 27: Notifications / Webhook delivery guarantees (if webhooks exist) | All 9 competitors | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1571 |
| COMP-GAP-1578 | Free/public verification | Competitor Intelligence / Category 28: Localization / i18n / Languages supported beyond English | PrimeLister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1578 |
| COMP-GAP-1579 | Free/public verification | Competitor Intelligence / Category 28: Localization / i18n / Languages supported beyond English | Crosslist: French/Dutch possible (Belgium HQ) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1579 |
| COMP-GAP-1580 | Free/public verification | Competitor Intelligence / Category 28: Localization / i18n / Languages supported beyond English | Crosslist Magic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1580 |
| COMP-GAP-1581 | Free/public verification | Competitor Intelligence / Category 28: Localization / i18n / Languages supported beyond English | SellerAider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1581 |
| COMP-GAP-1582 | Free/public verification | Competitor Intelligence / Category 28: Localization / i18n / Languages supported beyond English | Flyp | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1582 |
| COMP-GAP-1583 | Free/public verification | Competitor Intelligence / Category 28: Localization / i18n / Languages supported beyond English | Nifty | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1583 |
| COMP-GAP-1584 | Free/public verification | Competitor Intelligence / Category 28: Localization / i18n / Languages supported beyond English | OneShop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1584 |
| COMP-GAP-1585 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Languages supported beyond English | Closo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1585 |
| COMP-GAP-1586 | Free/public verification | Competitor Intelligence / Category 28: Localization / i18n / Languages supported beyond English | Vendoo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1586 |
| COMP-GAP-1589 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Date format handling (MM/DD/YYYY vs DD/MM/YYYY vs ISO) | PrimeLister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1589 |
| COMP-GAP-1590 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Date format handling (MM/DD/YYYY vs DD/MM/YYYY vs ISO) | Crosslist (Belgium: likely DD/MM) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1590 |
| COMP-GAP-1591 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Date format handling (MM/DD/YYYY vs DD/MM/YYYY vs ISO) | Flyp | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1591 |
| COMP-GAP-1592 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Date format handling (MM/DD/YYYY vs DD/MM/YYYY vs ISO) | Nifty | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1592 |
| COMP-GAP-1593 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Date format handling (MM/DD/YYYY vs DD/MM/YYYY vs ISO) | Vendoo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1593 |
| COMP-GAP-1596 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Timezone handling | PrimeLister HDT schedule timezone | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1596 |
| COMP-GAP-1597 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Timezone handling | Flyp HDT schedule timezone | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1597 |
| COMP-GAP-1598 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Timezone handling | Nifty schedule timezone | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1598 |
| COMP-GAP-1599 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Timezone handling | Vendoo schedule timezone | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1599 |
| COMP-GAP-1600 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Timezone handling | Closo alarm timezone | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1600 |
| COMP-GAP-1603 | Free/public verification | Competitor Intelligence / Category 28: Localization / i18n / RTL text support | All 9 competitors (none expected, need verification) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1603 |
| COMP-GAP-1606 | Free/public verification | Competitor Intelligence / Category 28: Localization / i18n / Locale-specific pricing (PPP) | All 9 competitors | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1606 |
| COMP-GAP-1609 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Currency display in analytics | PrimeLister: USD only | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1609 |
| COMP-GAP-1610 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Currency display in analytics | Flyp: USD; other currencies | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1610 |
| COMP-GAP-1611 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Currency display in analytics | Nifty: USD confirmed ($28 revenue shown); others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1611 |
| COMP-GAP-1612 | Insider-only/opaque | Competitor Intelligence / Category 28: Localization / i18n / Currency display in analytics | Vendoo: USD; others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1612 |
| COMP-GAP-1619 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Referral program mechanics per competitor | PrimeLister: referral program | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1619 |
| COMP-GAP-1620 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Referral program mechanics per competitor | Crosslist: referral program | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1620 |
| COMP-GAP-1621 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Referral program mechanics per competitor | Crosslist Magic: referral program | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1621 |
| COMP-GAP-1622 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Referral program mechanics per competitor | SellerAider: referral program | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1622 |
| COMP-GAP-1623 | Insider-only/opaque | Competitor Intelligence / Category 29: Referral / viral mechanics / Referral program mechanics per competitor | Flyp: $10 referral confirmed [F]; credit cap [I]; payout timing | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1623 |
| COMP-GAP-1624 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Referral program mechanics per competitor | Nifty: referral program | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1624 |
| COMP-GAP-1625 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Referral program mechanics per competitor | OneShop: referral program | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1625 |
| COMP-GAP-1626 | Insider-only/opaque | Competitor Intelligence / Category 29: Referral / viral mechanics / Referral program mechanics per competitor | Closo: referral program | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1626 |
| COMP-GAP-1627 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Referral program mechanics per competitor | Vendoo: referral program | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1627 |
| COMP-GAP-1630 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Affiliate program details | PrimeLister affiliate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1630 |
| COMP-GAP-1631 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Affiliate program details | Crosslist affiliate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1631 |
| COMP-GAP-1632 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Affiliate program details | SellerAider affiliate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1632 |
| COMP-GAP-1633 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Affiliate program details | Flyp affiliate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1633 |
| COMP-GAP-1634 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Affiliate program details | Nifty affiliate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1634 |
| COMP-GAP-1635 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Affiliate program details | Vendoo affiliate | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1635 |
| COMP-GAP-1638 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Share-to-earn / invite credit | All 9 competitors | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1638 |
| COMP-GAP-1641 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Network effects / community programs | PrimeLister community | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1641 |
| COMP-GAP-1642 | Free/public verification | Competitor Intelligence / Category 29: Referral / viral mechanics / Network effects / community programs | Flyp community share feature (existing) vs referral program | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1642 |
| COMP-GAP-1643 | Insider-only/opaque | Competitor Intelligence / Category 29: Referral / viral mechanics / Network effects / community programs | Nifty Otto beta waitlist mechanics | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1643 |
| COMP-GAP-1650 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / User profile pages (public listings) | PrimeLister: public profile | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1650 |
| COMP-GAP-1651 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / User profile pages (public listings) | Crosslist: public profile | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1651 |
| COMP-GAP-1652 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / User profile pages (public listings) | Crosslist Magic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1652 |
| COMP-GAP-1653 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / User profile pages (public listings) | SellerAider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1653 |
| COMP-GAP-1654 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / User profile pages (public listings) | Flyp | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1654 |
| COMP-GAP-1655 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / User profile pages (public listings) | Nifty | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1655 |
| COMP-GAP-1656 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / User profile pages (public listings) | OneShop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1656 |
| COMP-GAP-1657 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / User profile pages (public listings) | Vendoo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1657 |
| COMP-GAP-1660 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Messaging between users | All 9 competitors (none expected inside the tool) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1660 |
| COMP-GAP-1663 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Discord / community server details | PrimeLister Discord | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1663 |
| COMP-GAP-1664 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Discord / community server details | Crosslist Discord | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1664 |
| COMP-GAP-1665 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Discord / community server details | SellerAider Discord | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1665 |
| COMP-GAP-1666 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Discord / community server details | Flyp Discord | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1666 |
| COMP-GAP-1667 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Discord / community server details | Nifty Discord | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1667 |
| COMP-GAP-1668 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Discord / community server details | Vendoo Discord | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1668 |
| COMP-GAP-1671 | Behavioral/benchmark test | Competitor Intelligence / Category 30: Community / social features / Gamification (badges, streaks, leaderboards) | All 9 competitors | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1671 |
| COMP-GAP-1674 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Facebook Groups (seller communities) | PrimeLister FB Group | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1674 |
| COMP-GAP-1675 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Facebook Groups (seller communities) | Crosslist FB Group | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1675 |
| COMP-GAP-1676 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Facebook Groups (seller communities) | Nifty FB Group | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1676 |
| COMP-GAP-1677 | Free/public verification | Competitor Intelligence / Category 30: Community / social features / Facebook Groups (seller communities) | Vendoo FB Group | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1677 |
| COMP-GAP-1684 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / CSV import format per competitor | PrimeLister: CSV import columns | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1684 |
| COMP-GAP-1685 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / CSV import format per competitor | Crosslist: CSV import columns | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1685 |
| COMP-GAP-1686 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / CSV import format per competitor | Crosslist Magic: no inventory DB, not applicable | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1686 |
| COMP-GAP-1687 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / CSV import format per competitor | SellerAider: CSV import | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1687 |
| COMP-GAP-1688 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / CSV import format per competitor | Flyp: CSV import | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1688 |
| COMP-GAP-1689 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / CSV import format per competitor | Nifty: CSV import | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1689 |
| COMP-GAP-1690 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / CSV import format per competitor | OneShop: CSV import | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1690 |
| COMP-GAP-1691 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / CSV import format per competitor | Vendoo: CSV import confirmed; column schema | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1691 |
| COMP-GAP-1694 | Behavioral/benchmark test | Competitor Intelligence / Category 31: Import / export / migration / CSV export format | PrimeLister orders CSV (confirmed) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1694 |
| COMP-GAP-1695 | Behavioral/benchmark test | Competitor Intelligence / Category 31: Import / export / migration / CSV export format | Flyp: orders CSV | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1695 |
| COMP-GAP-1696 | Behavioral/benchmark test | Competitor Intelligence / Category 31: Import / export / migration / CSV export format | Nifty: Reports CSV export | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1696 |
| COMP-GAP-1697 | Behavioral/benchmark test | Competitor Intelligence / Category 31: Import / export / migration / CSV export format | Vendoo: inventory CSV export confirmed [B]; analytics CSV confirmed | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1697 |
| COMP-GAP-1700 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / JSON / XML export | All 9 competitors | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1700 |
| COMP-GAP-1703 | Behavioral/benchmark test | Competitor Intelligence / Category 31: Import / export / migration / Direct migration from competing tools | Vendoo → from Poshmark/eBay/Mercari/Depop/Etsy/Facebook/Kidizen/TheRealReal/Vinted/Grailed: confirmed import [F]; mapping fidelity | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1703 |
| COMP-GAP-1704 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / Direct migration from competing tools | PrimeLister → import sources beyond Poshmark | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1704 |
| COMP-GAP-1705 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / Direct migration from competing tools | Flyp crosslister → import sources | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1705 |
| COMP-GAP-1706 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / Direct migration from competing tools | Nifty → import sources | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1706 |
| COMP-GAP-1707 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / Direct migration from competing tools | OneShop → import sources | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1707 |
| COMP-GAP-1710 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / Shopify migration wizard | PrimeLister: Shopify content-script target confirms integration; migration wizard | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1710 |
| COMP-GAP-1711 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / Shopify migration wizard | SellerAider: Shopify bundle confirms integration; wizard | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1711 |
| COMP-GAP-1712 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / Shopify migration wizard | Crosslist Magic: Shopify supported; wizard | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1712 |
| COMP-GAP-1713 | Paid/gated verification | Competitor Intelligence / Category 31: Import / export / migration / Shopify migration wizard | Vendoo: Shopify in v2 automations (paywall); full wizard | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1713 |
| COMP-GAP-1714 | Free/public verification | Competitor Intelligence / Category 31: Import / export / migration / Shopify migration wizard | Nifty: Shopify not confirmed in automations | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1714 |
| COMP-GAP-1717 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / eBay migration from competing tools | PrimeLister eBay → Vendoo migration path | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1717 |
| COMP-GAP-1718 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / eBay migration from competing tools | Flyp eBay → Nifty migration | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1718 |
| COMP-GAP-1719 | Insider-only/opaque | Competitor Intelligence / Category 31: Import / export / migration / eBay migration from competing tools | Cross-tool migration generally (all pairs) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1719 |
| COMP-GAP-1726 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / 1099-K generation | PrimeLister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1726 |
| COMP-GAP-1727 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / 1099-K generation | Crosslist | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1727 |
| COMP-GAP-1728 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / 1099-K generation | Flyp | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1728 |
| COMP-GAP-1729 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / 1099-K generation | Nifty | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1729 |
| COMP-GAP-1730 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / 1099-K generation | OneShop | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1730 |
| COMP-GAP-1731 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / 1099-K generation | Vendoo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1731 |
| COMP-GAP-1732 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / 1099-K generation | SellerAider | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1732 |
| COMP-GAP-1733 | Insider-only/opaque | Competitor Intelligence / Category 32: Compliance reporting / 1099-K generation | Closo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1733 |
| COMP-GAP-1734 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / 1099-K generation | Crosslist Magic | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1734 |
| COMP-GAP-1737 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / VAT/GST reports for non-US sellers | PrimeLister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1737 |
| COMP-GAP-1738 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / VAT/GST reports for non-US sellers | Crosslist (Belgium-based; EU sellers): VAT report | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1738 |
| COMP-GAP-1739 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / VAT/GST reports for non-US sellers | Vendoo | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1739 |
| COMP-GAP-1740 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / VAT/GST reports for non-US sellers | All others | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1740 |
| COMP-GAP-1743 | Insider-only/opaque | Competitor Intelligence / Category 32: Compliance reporting / Sales tax reports (US state-level) | PrimeLister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1743 |
| COMP-GAP-1744 | Insider-only/opaque | Competitor Intelligence / Category 32: Compliance reporting / Sales tax reports (US state-level) | Flyp | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1744 |
| COMP-GAP-1745 | Insider-only/opaque | Competitor Intelligence / Category 32: Compliance reporting / Sales tax reports (US state-level) | Nifty (P&L report confirmed; sales tax line) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1745 |
| COMP-GAP-1746 | Insider-only/opaque | Competitor Intelligence / Category 32: Compliance reporting / Sales tax reports (US state-level) | Vendoo (analytics confirmed; tax line) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1746 |
| COMP-GAP-1749 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / International tax reports | Crosslist EU sellers | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1749 |
| COMP-GAP-1750 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / International tax reports | PrimeLister CA/AU sellers | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1750 |
| COMP-GAP-1751 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / International tax reports | Vendoo global | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1751 |
| COMP-GAP-1754 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / Annual tax summary export | PrimeLister | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1754 |
| COMP-GAP-1755 | Free/public verification | Competitor Intelligence / Category 32: Compliance reporting / Annual tax summary export | Flyp | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1755 |
| COMP-GAP-1756 | Behavioral/benchmark test | Competitor Intelligence / Category 32: Compliance reporting / Annual tax summary export | Nifty (Reports tab confirmed) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1756 |
| COMP-GAP-1757 | Behavioral/benchmark test | Competitor Intelligence / Category 32: Compliance reporting / Annual tax summary export | Vendoo (analytics CSV) | docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md:1757 |

## Anti-Detection / Facebook Automation Design Gaps

These are design and operational gaps from `docs/PERFECT_ANTI_DETECTION_SYSTEM.md`. They are not launch blockers unless separately promoted.

| ID | Status | Gap | Source |
|---|---|---|---|
| ANTI-01 | PARTIALLY RESOLVED — remaining gap open | **No session warmup** — **PARTIALLY RESOLVED** (2026-04-15). warmup() method added to FacebookBot (homepage feed scroll → marketplace sidebar → browse 2-3 listings). facebookPublish.js now browses homepage and marketplace before navigating to the create form. Not yet a full 3-5 minute warmup with post-listing verification, but eliminates the "direct navigation to listing creation" signal. | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:529 |
| ANTI-02 | PARTIALLY RESOLVED — remaining gap open | **No per-account sticky proxy assignment** — **PARTIALLY RESOLVED** (2026-05-02). browser-profiles.js exposes setProfileProxy(id, proxyUrl) to assign a distinct proxy per profile, and validateProfiles() warns when multiple profiles share the same proxy URL. The infrastructure is in place; full resolution requires the operator to configure distinct residential proxy endpoints per account in profiles.json. | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:531 |
| ANTI-05 | PARTIALLY RESOLVED — remaining gap open | **No Content Safety Scanner** — **PARTIALLY RESOLVED** (2026-04-15). contentSafetyScanner.js added with payment keyword blocklist, URL/phone/email pattern detection, price sanity, ALL CAPS detection, title/description checks. Wired into all 9 platform publish paths. Still missing: PDQ image hash, NSFW classifier. | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:537 |
| ANTI-10 | OPEN | **DataDome has a named Camoufox detection profile** — DataDome publishes specific detection pages for anti-detect browsers including Camoufox, targeting Canvas/WebGL coherence, AudioContext signatures, and timezone consistency. Any platform behind DataDome has Camoufox-specific fingerprint checks. **Maintenance cadence: retest monthly** against https://antoinevastel.com/bots/datadome and https://bot.sannysoft.com/ from Railway (Linux). If score degrades, evaluate CloverLabsAI/camoufox upgrade (FF146, see item 17) or Patchright as Chromium fallback. Platforms confirmed behind DataDome: Depop, Grailed. | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:547 |
| ANTI-12 | OPEN | **JA4 fingerprinting is now passive at CDN infrastructure level** — AWS WAF (March 2025) and Cloudflare offer JA4 hash matching as a built-in feature. Camoufox's JA4 fingerprint has not been verified against target platform CDNs. A block at the CDN edge prevents any JavaScript from running. **Verification task:** run bun worker/bots/fingerprint-self-test.js on Railway and capture the TLS/JA4 output; compare Firefox 135 JA4 hash against known Camoufox block lists. If blocked, the only fix is upgrading to CloverLabsAI/camoufox (FF146) or using a residential proxy that terminates TLS before the CDN sees the JA4 hash. | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:551 |
| ANTI-14 | OPEN | **No Mercari cancellation rate tracking** — **DEFERRED** (2026-05-03). Mercari removed from live platforms (Coming Soon). No active bot automation runs against Mercari. Will revisit when Mercari is re-enabled. | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:555 |
| ANTI-15 | VERIFICATION REQUIRED | **CDP serialization leak** — TOOLING BUILT (fingerprint-self-test.js tests for JSON.stringify getter leak). Run on Railway/Linux to verify. Cannot run on Windows (Camoufox instability). | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:557 |
| ANTI-16 | VERIFICATION REQUIRED | **WebGPU adapter info** — TOOLING BUILT (fingerprint-self-test.js checks WebGPU adapter vendor/device). Run on Railway to verify whether Camoufox overrides the software renderer string. | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:559 |
| ANTI-17 | OPEN | **Camoufox upgrade path identified** — EVALUATED (2026-04-15). CloverLabsAI/camoufox **is the official continuation** (daijro's README links to it). Firefox 146 base (vs our 135), per-context fingerprint isolation (8 C++ patches), hardware spoofing per context. Available via cloverlabs-camoufox pip package (v0.5.5). No npm package yet — camoufox-js is hardcoded to daijro's FF135 builds. **Migration path**: set CAMOUFOX_EXECUTABLE_PATH env var in Railway to the FF146 binary path, or pass executablePath to launchCamoufox(). Code support added 2026-05-03 (stealth.js). Issue #328 remains open in both forks. **Remaining**: install CloverLabsAI binary on Railway and verify fingerprint quality. | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:561 |
| ANTI-19 | OPERATIONAL / NO CODE FIX | **Desktop listings algorithmically penalized** — Facebook gives app-created listings ~23% more impressions than desktop-created ones. Playwright automation creates desktop listings by definition, reducing visibility even when detection is avoided. The Chrome extension path does not have this penalty (it runs in the user's real mobile or desktop browser). This reinforces the Chrome extension as the primary recommended path. **No code fix possible** — inherent to desktop automation. | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:565 |
| ANTI-21 | OPERATIONAL / NO CODE FIX | **FIRE/GSE cross-industry IP reputation** — Meta's IP reputation checking now draws from 370M+ threat signals across 230+ organizations including 50+ banks. Datacenter and VPN IPs are flagged before reaching Marketplace. Per-profile proxy assignment is implemented (getProfileProxy()), but purchasing residential proxies is an operational requirement. **No code fix** — requires proxy service subscription. | docs/PERFECT_ANTI_DETECTION_SYSTEM.md:569 |

## GitHub Open Issues

Command: `gh issue list --state open --limit 200 --json number,title,labels,updatedAt,url`

| Issue | Title | Labels | Updated | URL |
|---|---|---|---|---|
| #514 | [CI Failure] master - Run #1649 | ci-failure, automated | 2026-05-03T21:44:20Z | https://github.com/Vaultifacts/VaultLister-3.0/issues/514 |

## Explicit Checklist Backlogs

### Automation Roadmap

Count: 59

| Item | Source |
|---|---|
| 1. Auto-merge version-check PRs | memory/project_automation_roadmap.md:19 |
| 2. VACUUM/ANALYZE cron | memory/project_automation_roadmap.md:20 |
| 3. SSL cert expiry monitoring | memory/project_automation_roadmap.md:21 |
| 4. Secret rotation reminders | memory/project_automation_roadmap.md:22 |
| 5. Domain expiry monitoring | memory/project_automation_roadmap.md:23 |
| 6. Expired session cleanup | memory/project_automation_roadmap.md:24 |
| 7. npm audit cron | memory/project_automation_roadmap.md:27 |
| 8. Stale branch cleanup | memory/project_automation_roadmap.md:28 |
| 9. Uptime push notifications (phone alerts via Slack) | memory/project_automation_roadmap.md:29 |
| 10. Changelog/release notes generation | memory/project_automation_roadmap.md:30 |
| 11. GDPR data retention purge | memory/project_automation_roadmap.md:31 |
| 12. Orphaned records cleanup | memory/project_automation_roadmap.md:32 |
| 13. Unused image cleanup | memory/project_automation_roadmap.md:33 |
| 14. .env.example sync check in CI | memory/project_automation_roadmap.md:34 |
| 15. Migration registration check in CI | memory/project_automation_roadmap.md:35 |
| 16. Railway spend alerts | memory/project_automation_roadmap.md:38 |
| 17. Anthropic API spend alerts | memory/project_automation_roadmap.md:39 |
| 18. B2 storage cost alerts | memory/project_automation_roadmap.md:40 |
| 19. Token usage budget caps | memory/project_automation_roadmap.md:41 |
| 20. OpenAI/xAI spend tracking | memory/project_automation_roadmap.md:42 |
| 21. Lighthouse score regression | memory/project_automation_roadmap.md:45 |
| 22. Slow query detection | memory/project_automation_roadmap.md:46 |
| 23. Bundle size regression tracking | memory/project_automation_roadmap.md:47 |
| 24. Index bloat check | memory/project_automation_roadmap.md:48 |
| 25. Redis memory alerts | memory/project_automation_roadmap.md:49 |
| 26. Worker queue depth monitoring | memory/project_automation_roadmap.md:50 |
| 27. Periodic load testing | memory/project_automation_roadmap.md:51 |
| 28. Accessibility + ethics audits in CI | memory/project_automation_roadmap.md:52 |
| 29. Transactional email health (Resend) | memory/project_automation_roadmap.md:55 |
| 30. Cache purge on deploy (Cloudflare) | memory/project_automation_roadmap.md:56 |
| 31. OAuth token refresh monitoring | memory/project_automation_roadmap.md:57 |
| 32. Rate limit budget tracking | memory/project_automation_roadmap.md:58 |
| 33. Marketplace API deprecation alerts | memory/project_automation_roadmap.md:59 |
| 34. DNS record change detection | memory/project_automation_roadmap.md:60 |
| 35. WAF rule review reminders | memory/project_automation_roadmap.md:61 |
| 36. Test baseline auto-update | memory/project_automation_roadmap.md:62 |
| 37. PR size alerts | memory/project_automation_roadmap.md:63 |
| 38. Commit message lint in CI | memory/project_automation_roadmap.md:64 |
| 39. Backup retention alerting | memory/project_automation_roadmap.md:65 |
| 40. Connection pool monitoring | memory/project_automation_roadmap.md:66 |
| 41. Disk/volume alerts | memory/project_automation_roadmap.md:67 |
| 42. Runbook freshness check | memory/project_automation_roadmap.md:68 |
| 43. Log rotation | memory/project_automation_roadmap.md:69 |
| 44. Dead letter queue processing | memory/project_automation_roadmap.md:70 |
| 45. Web push subscription cleanup | memory/project_automation_roadmap.md:71 |
| 46. Stripe webhook endpoint health | memory/project_automation_roadmap.md:72 |
| 47. Wire Slack webhook to all alerts | memory/project_automation_roadmap.md:73 |
| 48. SonarCloud quality gate alerting | memory/project_automation_roadmap.md:74 |
| 49. Google/Outlook OAuth credential expiry | memory/project_automation_roadmap.md:75 |
| 50. Prometheus → alerting pipeline | memory/project_automation_roadmap.md:78 |
| 51. BetterStack log drain health | memory/project_automation_roadmap.md:79 |
| 52. Currency exchange API health (frankfurter.app) | memory/project_automation_roadmap.md:80 |
| 53. Marketplace bot health/success rate monitoring | memory/project_automation_roadmap.md:81 |
| 54. Firebase SA key staleness | memory/project_automation_roadmap.md:82 |
| 55. VAPID key rotation monitoring | memory/project_automation_roadmap.md:83 |
| 56. Playwright bot session keepalive scheduling | memory/project_automation_roadmap.md:84 |
| 57. BrowserStack quota monitoring | memory/project_automation_roadmap.md:85 |
| 58. Grok/xAI separate spend monitoring | memory/project_automation_roadmap.md:86 |
| 59. Sentry error rate trend alerting | memory/project_automation_roadmap.md:87 |

### Chrome Extension Future Features

Count: 7

| Item | Source |
|---|---|
| Support more retail sites (Walmart, Target, Best Buy) | chrome-extension/README.md:233 |
| Batch import from search results | chrome-extension/README.md:234 |
| OCR for reading product info from images | chrome-extension/README.md:235 |
| Browser history analysis for sourcing opportunities | chrome-extension/README.md:236 |
| Bulk price tracking from Amazon wish lists | chrome-extension/README.md:237 |
| Export data to CSV/Excel | chrome-extension/README.md:238 |
| Dark mode for popup | chrome-extension/README.md:239 |

### Facebook OAuth Compliance

Count: 42

| Item | Source |
|---|---|
| Meta App created with Business type | docs/FACEBOOK_OAUTH_COMPLIANCE.md:597 |
| Business Manager set up with all assets consolidated | docs/FACEBOOK_OAUTH_COMPLIANCE.md:598 |
| Business Verification completed with valid documents | docs/FACEBOOK_OAUTH_COMPLIANCE.md:599 |
| Privacy Policy URL: live, accessible, non-geo-blocked, crawlable | docs/FACEBOOK_OAUTH_COMPLIANCE.md:600 |
| Privacy Policy covers: what FB data collected, how used, how to request deletion | docs/FACEBOOK_OAUTH_COMPLIANCE.md:601 |
| Data deletion callback implemented (POST /api/facebook/data-deletion) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:602 |
| Deauthorize callback implemented (POST /api/facebook/deauth) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:603 |
| HTTPS enforced on all redirect URIs and callbacks | docs/FACEBOOK_OAUTH_COMPLIANCE.md:604 |
| App secret stored server-side only (in .env) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:605 |
| Token storage uses AES-256-GCM encryption | docs/FACEBOOK_OAUTH_COMPLIANCE.md:606 |
| appsecret_proof implemented for server-to-server calls | docs/FACEBOOK_OAUTH_COMPLIANCE.md:607 |
| State parameter for CSRF in OAuth flow | docs/FACEBOOK_OAUTH_COMPLIANCE.md:608 |
| Working logout functionality (easily discoverable) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:609 |
| At least 1 successful API call per requested permission (within 30 days) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:612 |
| Screen recording for EVERY permission (1080p, no audio, English UI, mouse-driven) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:613 |
| Unique usage description for each permission (no copy-paste) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:614 |
| App icon 1024x1024, no Meta trademarks | docs/FACEBOOK_OAUTH_COMPLIANCE.md:615 |
| Test account credentials prepared for reviewers | docs/FACEBOOK_OAUTH_COMPLIANCE.md:616 |
| App publicly accessible or access instructions provided | docs/FACEBOOK_OAUTH_COMPLIANCE.md:617 |
| App does not crash during testing | docs/FACEBOOK_OAUTH_COMPLIANCE.md:618 |
| Sandbox Commerce Account onboarded | docs/FACEBOOK_OAUTH_COMPLIANCE.md:621 |
| Catalog feed with required product attributes configured | docs/FACEBOOK_OAUTH_COMPLIANCE.md:622 |
| System User tokens configured and encrypted | docs/FACEBOOK_OAUTH_COMPLIANCE.md:623 |
| Rate limits respected | docs/FACEBOOK_OAUTH_COMPLIANCE.md:624 |
| Seller upload flow: sellers first, then products | docs/FACEBOOK_OAUTH_COMPLIANCE.md:625 |
| All data access via official Graph API only — no scraping | docs/FACEBOOK_OAUTH_COMPLIANCE.md:628 |
| No prefilling of user messages or content | docs/FACEBOOK_OAUTH_COMPLIANCE.md:629 |
| Marketplace lead data used only for contacting about specific listings | docs/FACEBOOK_OAUTH_COMPLIANCE.md:630 |
| Annual Data Use Checkup process planned | docs/FACEBOOK_OAUTH_COMPLIANCE.md:631 |
| Data retention/deletion policy documented and implemented | docs/FACEBOOK_OAUTH_COMPLIANCE.md:632 |
| User consent obtained before any profile building | docs/FACEBOOK_OAUTH_COMPLIANCE.md:633 |
| No sensitive data sent to Meta (health, financial, children under 13) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:634 |
| Cookie consent mechanism for EU/UK users | docs/FACEBOOK_OAUTH_COMPLIANCE.md:635 |
| Meta Business Tools notice on every page using Meta tools | docs/FACEBOOK_OAUTH_COMPLIANCE.md:636 |
| Login button follows brand guidelines (#1877F2, "Log in with Facebook", f logo) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:637 |
| Monitor emails from meta.com, fb.com, facebookmail.com — never filter | docs/FACEBOOK_OAUTH_COMPLIANCE.md:640 |
| Rotate system user tokens periodically | docs/FACEBOOK_OAUTH_COMPLIANCE.md:641 |
| Re-certify Data Use Checkup annually (within 60 days of notice) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:642 |
| Keep app active (API calls at least every 30 days) | docs/FACEBOOK_OAUTH_COMPLIANCE.md:643 |
| Maintain updated app description and categorization | docs/FACEBOOK_OAUTH_COMPLIANCE.md:644 |
| Respond promptly to all Meta requests | docs/FACEBOOK_OAUTH_COMPLIANCE.md:645 |
| Report security incidents immediately | docs/FACEBOOK_OAUTH_COMPLIANCE.md:646 |

### Plan: 2026-04-12-ui-restructure.md

Count: 50

| Item | Source |
|---|---|
| **Step 1: Update the navItems array** | docs/superpowers/plans/2026-04-12-ui-restructure.md:69 |
| **Step 2: Add "Learn more" button after Get Help** | docs/superpowers/plans/2026-04-12-ui-restructure.md:107 |
| **Step 3: Remove Focus Mode button from header** | docs/superpowers/plans/2026-04-12-ui-restructure.md:145 |
| **Step 4: Update breadcrumb/page label map** | docs/superpowers/plans/2026-04-12-ui-restructure.md:153 |
| **Step 5: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:161 |
| **Step 1: Change default tab and tab bar — Profile → Account** | docs/superpowers/plans/2026-04-12-ui-restructure.md:181 |
| **Step 2: Update the tab buttons in the tab bar** | docs/superpowers/plans/2026-04-12-ui-restructure.md:192 |
| **Step 3: Update Billing → Plans & Billing tab button** | docs/superpowers/plans/2026-04-12-ui-restructure.md:213 |
| **Step 4: Add 'account' case to renderTabContent switch** | docs/superpowers/plans/2026-04-12-ui-restructure.md:231 |
| **Step 5: Add 'plans-billing' case to renderTabContent switch** | docs/superpowers/plans/2026-04-12-ui-restructure.md:246 |
| **Step 6: Remove Accent Color section from Appearance tab** | docs/superpowers/plans/2026-04-12-ui-restructure.md:257 |
| **Step 7: Remove Display (Density + Font Size) section from Appearance tab** | docs/superpowers/plans/2026-04-12-ui-restructure.md:271 |
| **Step 8: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:294 |
| **Step 1: Reorder the array** | docs/superpowers/plans/2026-04-12-ui-restructure.md:310 |
| **Step 2: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:346 |
| **Step 1: Add Financials Analytics tab button to the tab bar** | docs/superpowers/plans/2026-04-12-ui-restructure.md:366 |
| **Step 2: Add tab content for Financials Analytics** | docs/superpowers/plans/2026-04-12-ui-restructure.md:381 |
| **Step 3: Add tab content for Inventory, Sales, Purchases** | docs/superpowers/plans/2026-04-12-ui-restructure.md:467 |
| **Step 4: Wire new tabs into the render ternary chain** | docs/superpowers/plans/2026-04-12-ui-restructure.md:538 |
| **Step 5: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:554 |
| **Step 1: Change ordersMainTab default** | docs/superpowers/plans/2026-04-12-ui-restructure.md:568 |
| **Step 2: Replace the tab bar** | docs/superpowers/plans/2026-04-12-ui-restructure.md:579 |
| **Step 3: Add Shipping tab to the content conditional** | docs/superpowers/plans/2026-04-12-ui-restructure.md:613 |
| **Step 4: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:633 |
| **Step 1: Remove Sourcing Platforms card from Purchases tab** | docs/superpowers/plans/2026-04-12-ui-restructure.md:647 |
| **Step 2: Remove the Create Report button from the reports() empty state** | docs/superpowers/plans/2026-04-12-ui-restructure.md:664 |
| **Step 3: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:684 |
| **Step 1: Remove the four always-visible financial cards** | docs/superpowers/plans/2026-04-12-ui-restructure.md:704 |
| **Step 2: Move Tax Estimate Calculator into a new tab** | docs/superpowers/plans/2026-04-12-ui-restructure.md:708 |
| **Step 3: Move Bank Reconciliation into a new tab** | docs/superpowers/plans/2026-04-12-ui-restructure.md:731 |
| **Step 4: Remove Expense Categories section** | docs/superpowers/plans/2026-04-12-ui-restructure.md:737 |
| **Step 5: Add new tabs to the tab bar** | docs/superpowers/plans/2026-04-12-ui-restructure.md:741 |
| **Step 6: Confirm switchFinancialsTab handler supports new keys** | docs/superpowers/plans/2026-04-12-ui-restructure.md:763 |
| **Step 7: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:767 |
| **Step 1: Remove the Catalog/Analytics tab buttons** | docs/superpowers/plans/2026-04-12-ui-restructure.md:783 |
| **Step 2: Remove the Analytics tab pane wrapper** | docs/superpowers/plans/2026-04-12-ui-restructure.md:799 |
| **Step 3: Remove the catalog pane wrapper but keep its content** | docs/superpowers/plans/2026-04-12-ui-restructure.md:810 |
| **Step 4: Find the Listings page header actions area** | docs/superpowers/plans/2026-04-12-ui-restructure.md:823 |
| **Step 5: Add the Import dropdown button** | docs/superpowers/plans/2026-04-12-ui-restructure.md:827 |
| **Step 6: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:847 |
| **Step 1: Find and delete the stats row** | docs/superpowers/plans/2026-04-12-ui-restructure.md:861 |
| **Step 2: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:867 |
| **Step 1: Find the Most Popular badge** | docs/superpowers/plans/2026-04-12-ui-restructure.md:881 |
| **Step 2: Fix the style** | docs/superpowers/plans/2026-04-12-ui-restructure.md:889 |
| **Step 3: Check main.css for .most-popular-badge** | docs/superpowers/plans/2026-04-12-ui-restructure.md:898 |
| **Step 4: Commit** | docs/superpowers/plans/2026-04-12-ui-restructure.md:913 |
| **Step 1: Run the bundle build** | docs/superpowers/plans/2026-04-12-ui-restructure.md:927 |
| **Step 2: Run linter** | docs/superpowers/plans/2026-04-12-ui-restructure.md:935 |
| **Step 3: Commit the regenerated bundle** | docs/superpowers/plans/2026-04-12-ui-restructure.md:943 |
| **Step 4: Smoke-check key pages** | docs/superpowers/plans/2026-04-12-ui-restructure.md:950 |

### Plan: 2026-04-13-sentry-metrics.md

Count: 6

| Item | Source |
|---|---|
| **Step 1: Add timing + success metrics (Edit 1 of 2)** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:36 |
| **Step 2: Syntax check** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:63 |
| **Step 3: Add error metrics (Edit 2 of 2)** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:71 |
| **Step 4: Syntax check** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:92 |
| **Step 5: Commit** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:100 |
| **Step 6: Push and verify in Sentry dashboard** | docs/superpowers/plans/2026-04-13-sentry-metrics.md:113 |

### Plan: 2026-04-13-sentry-tracing.md

Count: 20

| Item | Source |
|---|---|
| **Step 1: Write instrument.js** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:31 |
| **Step 2: Syntax-check the new file** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:60 |
| **Step 3: Commit** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:68 |
| **Step 1: Add the import (Edit 1 of 2)** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:88 |
| **Step 2: Wrap the API handler (Edit 2 of 2)** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:101 |
| **Step 3: Syntax-check server.js** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:130 |
| **Step 4: Commit** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:138 |
| **Step 1: Add import at the top of monitoring.js** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:160 |
| **Step 2: Remove _sentryModule and initSentry() from the monitoring object** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:180 |
| **Step 3: Remove the initSentry() call from init()** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:206 |
| **Step 4: Simplify reportToSentry()** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:218 |
| **Step 5: Syntax-check monitoring.js** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:244 |
| **Step 6: Commit** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:252 |
| **Step 1: Add SENTRY_TRACES_SAMPLE_RATE to .env.example** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:272 |
| **Step 2: Full syntax check** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:289 |
| **Step 3: Start the server and verify it boots** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:297 |
| **Step 4: Verify transactions appear in Sentry dashboard** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:312 |
| **Step 5: Set SENTRY_TRACES_SAMPLE_RATE in Railway** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:325 |
| **Step 6: Commit .env.example** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:334 |
| **Step 7: Push all commits** | docs/superpowers/plans/2026-04-13-sentry-tracing.md:343 |

### Plan: 2026-04-14-anti-detection-hardening.md

Count: 60

| Item | Source |
|---|---|
| **Step 1: Replace the playwright import with stealth infrastructure imports** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:50 |
| **Step 2: Replace chromium.launch() with stealthChromium.launch()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:61 |
| **Step 3: Replace hardcoded newContext() with stealthContextOptions()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:77 |
| **Step 4: Inject chrome.runtime stub and browser API stubs after creating the page** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:92 |
| **Step 5: Replace direct .click() calls with humanClick() for major actions** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:104 |
| **Step 6: Add mouseWiggle() calls between major form steps** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:142 |
| **Step 7: Add CAPTCHA check after navigating to create page and after clicking Publish** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:159 |
| **Step 8: Syntax check** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:177 |
| **Step 9: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:184 |
| **Step 1: Add injectChromeRuntimeStub and injectBrowserApiStubs to the import line** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:217 |
| **Step 2: Change headless default from true to 'new'** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:228 |
| **Step 3: Inject stubs after page creation in init()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:239 |
| **Step 4: Add CAPTCHA check in refreshListing() after navigation** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:247 |
| **Step 5: Add CAPTCHA check in refreshListing() after clicking the save button** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:254 |
| **Step 6: Add CAPTCHA check in relistItem() after navigation** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:261 |
| **Step 7: Add CAPTCHA check in relistItem() after clicking confirm** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:268 |
| **Step 8: Syntax check** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:275 |
| **Step 9: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:282 |
| **Step 1: Add path import (already imported — verify)** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:306 |
| **Step 2: Add SESSION_PATH constant after AUDIT_LOG constant** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:310 |
| **Step 3: Add clearSession() method to FacebookBot class** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:318 |
| **Step 4: Update init() to load session if fresh** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:333 |
| **Step 5: Update login() to skip login if session is loaded and still valid** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:370 |
| **Step 6: Save session after successful login** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:395 |
| **Step 7: Clear session on CAPTCHA detection** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:407 |
| **Step 8: Syntax check** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:416 |
| **Step 9: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:423 |
| **Step 1: Add timezone and locale pools after VIEWPORT_SIZES** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:446 |
| **Step 2: Add --disable-infobars to STEALTH_ARGS** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:461 |
| **Step 3: Update stealthContextOptions() to use random timezone and locale** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:483 |
| **Step 4: Add randomSlowMo() export after randomViewport()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:514 |
| **Step 5: Add injectBrowserApiStubs() export after injectChromeRuntimeStub()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:522 |
| **Step 6: Syntax check** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:603 |
| **Step 7: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:610 |
| **Step 1: Update facebook-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:643 |
| **Step 2: Update poshmark-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:668 |
| **Step 3: Update depop-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:693 |
| **Step 4: Update mercari-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:718 |
| **Step 5: Update grailed-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:743 |
| **Step 6: Update whatnot-bot.js import and newContext** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:768 |
| **Step 7: Syntax check all 6 bot files** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:793 |
| **Step 8: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:805 |
| **Step 1: Add daily cap fields to facebook config in rate-limits.js** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:827 |
| **Step 2: Add DAILY_STATS_PATH constant to facebook-bot.js** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:850 |
| **Step 3: Add readDailyStats() and writeDailyStats() helpers** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:857 |
| **Step 4: Increment login counter in login() and enforce maxLoginsPerDay** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:883 |
| **Step 5: Enforce maxListingsPerDay in refreshListing() and relistItem()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:901 |
| **Step 6: Add lockout/checkpoint detection in login()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:935 |
| **Step 7: Syntax check both files** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:952 |
| **Step 8: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:963 |
| **Step 1: Add randomDelay() helper before fillFacebook()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:988 |
| **Step 2: Add inter-field delays throughout fillFacebook()** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:997 |
| **Step 3: Replace hardcoded waits in clickDropdownOption() with jittered values** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1031 |
| **Step 4: Syntax check** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1051 |
| **Step 5: Commit** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1058 |
| **Step 1: Verify injectBrowserApiStubs is exported from stealth.js** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1085 |
| **Step 2: Verify facebookPublish.js imports and calls injectBrowserApiStubs** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1092 |
| **Step 3: Verify facebook-bot.js imports and calls injectBrowserApiStubs** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1099 |
| **Step 4: Final syntax check — all 4 touched files** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1106 |
| **Step 5: Commit verification result** | docs/superpowers/plans/2026-04-14-anti-detection-hardening.md:1116 |

### Plan: 2026-04-14-facebook-chrome-extension-gaps.md

Count: 6

| Item | Source |
|---|---|
| **Step 1: Add CONDITION_MAP and CATEGORY_MAP constants** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:18 |
| **Step 2: Add helper to click a dropdown option by text** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:52 |
| **Step 3: Replace fillFacebook() with the complete version** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:81 |
| **Step 4: Update fillAndSubmit() to show skipped fields in the overlay** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:192 |
| **Step 5: Syntax check** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:216 |
| **Step 6: Commit** | docs/superpowers/plans/2026-04-14-facebook-chrome-extension-gaps.md:221 |

### Plan: 2026-04-14-vault-buddy-sse-streaming.md

Count: 27

| Item | Source |
|---|---|
| **Step 1: Create the test file** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:34 |
| **Step 2: Run to confirm tests fail (function not exported yet)** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:101 |
| **Step 1: Append the generator at the end of grokService.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:117 |
| **Step 2: Run the tests from Task 1 to confirm they now pass** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:259 |
| **Step 3: Commit** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:272 |
| **Step 1: Update the import in chatbot.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:294 |
| **Step 2: Add the body.stream branch in chatbot.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:305 |
| **Step 3: Add isStream passthrough to server.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:377 |
| **Step 4: Add an integration test to chatbot-streaming.test.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:407 |
| **Step 5: Verify the server starts without errors** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:442 |
| **Step 6: Commit** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:453 |
| **Step 1: Add the failing unit tests for api.stream()** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:475 |
| **Step 2: Run the new tests to confirm they pass (they don't depend on the unimplemented method)** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:537 |
| **Step 3: Add stream() method to api.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:545 |
| **Step 4: Commit** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:601 |
| **Step 1: Update renderMessage() to emit data-streaming attribute** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:623 |
| **Step 2: Replace sendMessage() with streaming version** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:639 |
| **Step 3: Commit** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:726 |
| **Step 1: Update renderMessages() in components.js to emit data-streaming** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:750 |
| **Step 2: Replace sendVaultBuddyMessage in handlers-community-help.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:764 |
| **Step 3: Replace sendVaultBuddyMessage in handlers-deferred.js** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:880 |
| **Step 4: Commit** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:884 |
| **Step 1: Build the bundle** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:904 |
| **Step 2: Run unit tests to confirm nothing broke** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:912 |
| **Step 3: Start the server and smoke-test manually** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:920 |
| **Step 4: Verify non-streaming path still works** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:936 |
| **Step 5: Commit the bundle** | docs/superpowers/plans/2026-04-14-vault-buddy-sse-streaming.md:942 |

### Plan: 2026-04-15-camoufox-migration.md

Count: 28

| Item | Source |
|---|---|
| Verify data/ directory exists at project root | docs/superpowers/plans/2026-04-15-camoufox-migration.md:40 |
| Create worker/bots/browser-profiles.js with the following content: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:46 |
| Syntax-check the new file: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:166 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:174 |
| Add launchCamoufox import and export to stealth.js. All existing exports (stealthChromium, humanClick, mouseWiggle, humanScroll, injectChromeRuntimeStub, injectBrowserApiStubs, randomChromeUA, randomFirefoxUA, randomViewport, randomSlowMo, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, stealthContextOptions) must remain untouched. | docs/superpowers/plans/2026-04-15-camoufox-migration.md:195 |
| Syntax-check stealth.js: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:236 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:244 |
| Add profileCooldown: 3600000 to the facebook config block. The current block ends with sessionCooldown: 300000. Insert after sessionCooldown: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:265 |
| Syntax-check rate-limits.js: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:286 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:294 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:473 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:611 |
| Locate the Facebook section in .env.example: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:633 |
| Add the FACEBOOK_PROXY_URL comment line directly after the last FACEBOOK_* line found. The exact insertion depends on what grep shows — add: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:639 |
| Verify the line was added: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:645 |
| Commit: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:653 |
| Run the fingerprint smoke test: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:673 |
| If the smoke test passes, run launchCamoufox via stealth.js: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:693 |
| If both pass, run initProfiles() smoke test: | docs/superpowers/plans/2026-04-15-camoufox-migration.md:712 |
| browser-profiles.js exists and syntax-checks clean | docs/superpowers/plans/2026-04-15-camoufox-migration.md:759 |
| stealth.js exports launchCamoufox and all existing exports remain | docs/superpowers/plans/2026-04-15-camoufox-migration.md:760 |
| rate-limits.js has facebook.profileCooldown: 3600000 | docs/superpowers/plans/2026-04-15-camoufox-migration.md:761 |
| facebook-bot.js uses launchCamoufox + profiles, no references to stealthChromium, SESSION_PATH, injectChromeRuntimeStub, injectBrowserApiStubs | docs/superpowers/plans/2026-04-15-camoufox-migration.md:762 |
| facebookPublish.js uses launchCamoufox + profiles, no references to stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs | docs/superpowers/plans/2026-04-15-camoufox-migration.md:763 |
| .env.example has FACEBOOK_PROXY_URL comment | docs/superpowers/plans/2026-04-15-camoufox-migration.md:764 |
| Smoke test: launchCamoufox() returns Firefox UA | docs/superpowers/plans/2026-04-15-camoufox-migration.md:765 |
| Smoke test: initProfiles() + getNextProfile() create and return valid profile | docs/superpowers/plans/2026-04-15-camoufox-migration.md:766 |
| All 6 commits created with [AUTO] prefix + Verified: trailers | docs/superpowers/plans/2026-04-15-camoufox-migration.md:767 |

### Plan: 2026-04-15-facebook-mock-test-env.md

Count: 34

| Item | Source |
|---|---|
| **Step 1.1: Write a failing test that verifies the server starts and stops** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:33 |
| **Step 1.2: Create the directory** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:118 |
| **Step 1.3: Implement mock-server.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:124 |
| **Step 1.4: Run server tests — core routing tests PASS, page-HTML tests FAIL with 404 (correct)** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:272 |
| **Step 1.5: Commit skeleton** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:277 |
| **Step 2.1: Write failing test — add to mock-server.test.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:297 |
| **Step 2.2: Create login.html** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:320 |
| **Step 2.3: Run tests — login selector test PASS** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:390 |
| **Step 2.4: Commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:395 |
| **Step 3.1: Write failing tests — add to mock-server.test.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:425 |
| **Step 3.2: Create marketplace-create.html** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:478 |
| **Step 3.3: Run tests — all marketplace-create tests PASS** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:736 |
| **Step 3.4: Commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:741 |
| **Step 4.1: Write failing test — add to mock-server.test.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:764 |
| **Step 4.2: Create marketplace-item.html** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:781 |
| **Step 4.3: Run tests — marketplace-item test PASS** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:864 |
| **Step 4.4: Commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:869 |
| **Step 5.1: Write failing test — add to mock-server.test.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:886 |
| **Step 5.2: Create marketplace-selling.html** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:900 |
| **Step 5.3: Run all server tests — all PASS (14+ tests)** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:953 |
| **Step 5.4: Delete temp test file and commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:958 |
| **Step 6.1: Patch facebook-bot.js to accept _baseUrl option** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:976 |
| **Step 6.2: Check Playwright availability** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1029 |
| **Step 6.3: Write facebook-bot.test.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1037 |
| **Step 6.4: Run bot tests** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1180 |
| **Step 6.5: Commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1185 |
| **Step 7.1: Confirm fillFacebook is not exported** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1201 |
| **Step 7.2: Create poster-facebook.spec.js** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1206 |
| **Step 7.3: Run the spec** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1331 |
| **Step 7.4: Commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1339 |
| **Step 8.1: Lint all new JS files** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1350 |
| **Step 8.2: Run full bot test suite** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1358 |
| **Step 8.3: Run E2E spec** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1380 |
| **Step 8.4: Final commit** | docs/superpowers/plans/2026-04-15-facebook-mock-test-env.md:1388 |

### Plan: 2026-04-15-facebook-safe-fixes.md

Count: 20

| Item | Source |
|---|---|
| **Step 1: Update facebook-bot.js route handlers** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:28 |
| **Step 2: Update facebookPublish.js route handlers** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:48 |
| **Step 3: Replace setContentEditable function** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:76 |
| **Step 4: Replace networkidle at line 119 (login goto)** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:129 |
| **Step 5: Replace networkidle at line 130 (post-login navigation)** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:141 |
| **Step 6: Replace networkidle at line 180 (refreshListing goto)** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:153 |
| **Step 7: Replace networkidle at line 224 (refreshAllListings goto)** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:165 |
| **Step 8: Replace networkidle at line 266 (relistItem goto)** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:177 |
| **Step 9: Replace the Location block in fillFacebook()** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:197 |
| **Step 10: Add RESTART_EVERY_N_LISTINGS constant** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:267 |
| **Step 11: Add restart logic inside refreshAllListings() loop** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:275 |
| **Step 12: Add minAccountAgeDays to rate-limits.js facebook config** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:319 |
| **Step 13: Add FACEBOOK_MIN_ACCOUNT_AGE_DAYS to .env.example** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:353 |
| **Step 14: Extend checkpoint detection in facebook-bot.js** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:372 |
| **Step 15: Extend checkpoint detection in facebookPublish.js** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:407 |
| **Step 16: Add AI pre-population guard after navigating to create page** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:440 |
| **Step 17: Add shm-size env and GTK3/xvfb dependencies** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:470 |
| **Step 18: Update camoufox-js** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:529 |
| **Step 19: Syntax check all modified JavaScript files** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:555 |
| **Step 20: Single commit covering all changes** | docs/superpowers/plans/2026-04-15-facebook-safe-fixes.md:569 |

## Source TODO/FIXME Scan

Command: `rg -n "TODO|FIXME" src public scripts worker design e2e qa data .github archive chrome-extension mobile nginx .agents`

| Source | Text |
|---|---|
| .github/workflows/ci.yml:591 | if grep -rn "password\s*=\s*['\"][^'\"]*['\"]" src/ --include="*.js" \| grep -v "password.*=.*body" \| grep -v "password.*=.*formData" \| grep -v "password.*=.*process.env" \| grep -v "test" \| grep -v "demo" \| grep -v "placeholder" \| grep -v "TODO"; then |
| public/status.html:288 | /* TODO: wire to real uptime data (v2) */ |
| qa/reports/audits/architecture_reliability_audit.md:178 | - **In-memory monitoring metrics lost on restart** — metrics accumulate in RAM only; code has `// TODO: use Redis` comment (Low) |
| qa/reports/browserstack/2026-04-23/performance-notes.md:63 | **TODO (future regression risk):** `renderPastIncidents()` replaces the static "No resolved incidents in the last 90 days." text with a dynamically-built `<ul>` of different height when incidents exist. Currently no incidents → no shift. When the first real incident is posted, this will cause CLS. Fix: give `#past-incidents-list` a `min-height` matching the empty state, or pre-render as a `<ul>` with an empty-state `<li>`. |
| scripts/generate-blog-article.js:126 | - No placeholders or TODOs in the output. |
| scripts/visual-test.js:5263 | console.log(`TODO: ${testFile.name \|\| basename(resolvedPath)}`); |
| scripts/visual-test.js:5691 | console.log(`\nTODO: ${name}`); |
| src/backend/services/platformSync/facebookSync.js:8 | // TODO(signal-emitter): import { trackApiLatency, checkListingInvisibility, checkEngagementDrop } from './signalEmitter.js'; |
| src/backend/services/platformSync/grailedSync.js:8 | // TODO(signal-emitter): import { trackApiLatency, checkListingInvisibility, checkEngagementDrop } from './signalEmitter.js'; |
| src/backend/services/platformSync/mercariSync.js:8 | // TODO(signal-emitter): import { trackApiLatency, checkListingInvisibility, checkEngagementDrop } from './signalEmitter.js'; |
| src/backend/services/platformSync/poshmarkSync.js:8 | // TODO(signal-emitter): import { trackApiLatency, checkListingInvisibility, checkEngagementDrop } from './signalEmitter.js'; |
| src/backend/services/platformSync/whatnotSync.js:8 | // TODO(signal-emitter): import { trackApiLatency, checkListingInvisibility, checkEngagementDrop } from './signalEmitter.js'; |
| src/frontend/core-bundle.js:68 | // TODO(csp-hardening): ADD_ATTR allows inline event handlers so developer-controlled |
| src/frontend/core/utils.js:66 | // TODO(csp-hardening): ADD_ATTR allows inline event handlers so developer-controlled |

## Historical Sources Excluded

These files are evidence only. They are not parsed as canonical open-item sources.

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
- `docs/archive/**`
- `docs/audits/**`
- `qa/reports/**`
