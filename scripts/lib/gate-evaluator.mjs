import fs from 'node:fs';
import path from 'node:path';

function p(repoRoot, rel) {
  return path.join(repoRoot, rel);
}

function fileExists(repoRoot, rel) {
  return fs.existsSync(p(repoRoot, rel));
}

function readText(repoRoot, rel) {
  const full = p(repoRoot, rel);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8');
}

function readJson(repoRoot, rel, fallback) {
  try {
    const txt = readText(repoRoot, rel).replace(/^\uFEFF/, '');
    if (!txt.trim()) return fallback;
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

function readNumber(repoRoot, rel) {
  const raw = readText(repoRoot, rel).trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function allPass(state) {
  if (!state || !state.steps) return false;
  const names = Object.keys(state.steps);
  if (names.length === 0) return false;
  return names.every((name) => String(state.steps[name]?.status || '').toUpperCase() === 'PASS');
}

function hasNoUncheckedRequired(checklistText) {
  const lines = checklistText.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('## Optional')) break;
    if (line.includes('[ ]')) return false;
  }
  return true;
}

function toStatus(pass, partial = false) {
  if (pass) return 'PASS';
  return partial ? 'PARTIAL' : 'FAIL';
}

export function evaluateGates(repoRoot) {
  const now = new Date().toISOString();
  const thresholds = readJson(repoRoot, 'config/gate-thresholds.json', {
    performance: {
      startup_seconds: { fail: 8 },
      health_latency_ms: { fail: 300 },
      inventory_latency_ms: { fail: 300 },
      search_latency_ms: { fail: 300 }
    }
  });

  const runbookChecklist = readText(repoRoot, 'docs/evidence/RUNBOOK_CHECKLIST.md');
  const runbookState = readJson(repoRoot, 'docs/evidence/runbook_state.json', { steps: {} });

  const startup = readNumber(repoRoot, 'docs/evidence/PHASE-04_STARTUP_SECONDS.txt');
  const health = readNumber(repoRoot, 'docs/evidence/PHASE-04_HEALTH_LATENCY_MS.txt');
  const inventory = readNumber(repoRoot, 'docs/evidence/PHASE-04_INVENTORY_LATENCY_MS.txt');
  const search = readNumber(repoRoot, 'docs/evidence/PHASE-04_SEARCH_LATENCY_MS.txt');

  const perfPass =
    Number.isFinite(startup) &&
    Number.isFinite(health) &&
    Number.isFinite(inventory) &&
    Number.isFinite(search) &&
    startup < thresholds.performance.startup_seconds.fail &&
    health < thresholds.performance.health_latency_ms.fail &&
    inventory < thresholds.performance.inventory_latency_ms.fail &&
    search < thresholds.performance.search_latency_ms.fail;

  const secretScan = readText(repoRoot, 'docs/evidence/PHASE-03_SECRET_SCAN.md');
  const secretScanReviewed = /Working tree scan result:\s*PASS \(reviewed\)/i.test(secretScan);

  const cg = {
    CG1: fileExists(repoRoot, 'docs/evidence/SETUP_RUNBOOK.md') && fileExists(repoRoot, 'docs/evidence/runbook_state.json') && allPass(runbookState) && hasNoUncheckedRequired(runbookChecklist),
    CG2: fileExists(repoRoot, 'docs/evidence/manual_test_output_final.txt') &&
      fileExists(repoRoot, 'playwright-report/results.json') &&
      fileExists(repoRoot, 'docs/evidence/PHASE-02_FAILING_SPECS.txt') &&
      fileExists(repoRoot, 'docs/evidence/PHASE-02_FAILURE_CLASSIFICATION.json') &&
      fileExists(repoRoot, 'docs/evidence/PHASE-02_PLAYWRIGHT_ANALYSIS.md'),
    CG3: fileExists(repoRoot, 'docs/evidence/DEPLOYMENT_VALIDATION.md') &&
      fileExists(repoRoot, 'docs/evidence/PHASE-04_DOCKER_PS.txt') &&
      /healthy/i.test(readText(repoRoot, 'docs/evidence/PHASE-04_DOCKER_HEALTH_STATUS.txt')),
    CG4: fileExists(repoRoot, 'docs/evidence/BACKUP_DRILL.md'),
    CG5: fileExists(repoRoot, 'docs/evidence/MONITORING_VALIDATION.md') &&
      /PASS/i.test(readText(repoRoot, 'docs/evidence/MONITORING_VALIDATION.md')) &&
      /uptime_seconds/i.test(readText(repoRoot, 'docs/evidence/MONITORING_VALIDATION.md')) &&
      /migrations\.applied/i.test(readText(repoRoot, 'docs/evidence/MONITORING_VALIDATION.md')),
    CG6: perfPass && fileExists(repoRoot, 'docs/PERFORMANCE_BASELINE.md'),
    CG7: fileExists(repoRoot, 'README.md') &&
      fileExists(repoRoot, 'docs/API_ROUTES.md') &&
      fileExists(repoRoot, 'docs/DATABASE_SCHEMA.md') &&
      fileExists(repoRoot, 'docs/DEPLOYMENT_RUNBOOK.md') &&
      fileExists(repoRoot, 'docs/PERFORMANCE_BASELINE.md'),
    CG8: fileExists(repoRoot, 'docs/evidence/PHASE-03_TASK-3.2.md') &&
      fileExists(repoRoot, 'docs/evidence/PHASE-03_SECRET_SCAN.md') &&
      secretScanReviewed
  };

  const completion = {
    CG1: toStatus(cg.CG1),
    CG2: toStatus(cg.CG2),
    CG3: toStatus(cg.CG3),
    CG4: toStatus(cg.CG4),
    CG5: toStatus(cg.CG5),
    CG6: toStatus(cg.CG6),
    CG7: toStatus(cg.CG7),
    CG8: toStatus(cg.CG8)
  };

  const quality = {
    QG1: toStatus(cg.CG1),
    QG2: toStatus(cg.CG2),
    QG3: toStatus(cg.CG8 && cg.CG1),
    QG4: toStatus(cg.CG3 && cg.CG4 && cg.CG5)
  };

  return {
    generatedAt: now,
    thresholds,
    metrics: { startup, health, inventory, search },
    completion,
    quality
  };
}

export function renderCompletionGates(state) {
  const vals = Object.values(state.completion);
  const pass = vals.filter((x) => x === 'PASS').length;
  const partial = vals.filter((x) => x === 'PARTIAL').length;
  const fail = vals.filter((x) => x === 'FAIL').length;
  return `# COMPLETION GATES

Generated: AUTO (see docs/evidence/GATE_EVALUATION.json for timestamp)
Source: auto-generated by scripts/gate-sync.mjs (do not hand-edit statuses)

---

## Gate Status Summary

| Gate | Name | Status | Evidence Required (Commands + Files) |
|------|------|--------|---------------------------------------|
| CG-1 | Reproducible Local Environment | ${state.completion.CG1} | \`npm run runbook:ci:all\`; clean-clone setup evidence file |
| CG-2 | Test Suite Stability | ${state.completion.CG2} | \`bun test\`; Playwright JSON + classification evidence |
| CG-3 | Deployment Pipeline | ${state.completion.CG3} | Docker build/compose evidence + CI merge-block proof |
| CG-4 | Backup & Restore | ${state.completion.CG4} | backup -> mutate -> restore drill evidence |
| CG-5 | Monitoring & Health Checks | ${state.completion.CG5} | \`/api/health\` contract + request/error logging evidence |
| CG-6 | Performance Stability | ${state.completion.CG6} | startup + latency baselines with thresholds |
| CG-7 | Documentation Closure | ${state.completion.CG7} | README/API/DB/deploy/perf docs synchronized and validated |
| CG-8 | Git Hygiene | ${state.completion.CG8} | git status policy, .gitignore coverage, secret scan evidence |

**Overall:** ${pass}/8 gates PASS (${partial} PARTIAL, ${fail} FAIL).

## Performance Threshold Inputs
- startup_seconds.fail: ${state.thresholds.performance.startup_seconds.fail}
- health_latency_ms.fail: ${state.thresholds.performance.health_latency_ms.fail}
- inventory_latency_ms.fail: ${state.thresholds.performance.inventory_latency_ms.fail}
- search_latency_ms.fail: ${state.thresholds.performance.search_latency_ms.fail}

## Performance Evidence Snapshot
- startup_seconds: ${Number.isFinite(state.metrics.startup) ? state.metrics.startup : 'N/A'}
- health_latency_ms: ${Number.isFinite(state.metrics.health) ? state.metrics.health : 'N/A'}
- inventory_latency_ms: ${Number.isFinite(state.metrics.inventory) ? state.metrics.inventory : 'N/A'}
- search_latency_ms: ${Number.isFinite(state.metrics.search) ? state.metrics.search : 'N/A'}
`;
}

export function renderQualityGates(state) {
  return `# QUALITY GATES

Generated: AUTO (see docs/evidence/GATE_EVALUATION.json for timestamp)
Source: auto-generated by scripts/gate-sync.mjs (do not hand-edit statuses)

---

## QG-1 Build Integrity
Current: ${state.quality.QG1}

## QG-2 Test Integrity
Current: ${state.quality.QG2}

## QG-3 Security/Policy Integrity
Current: ${state.quality.QG3}

## QG-4 Operational Integrity
Current: ${state.quality.QG4}

## Evidence Log Template

Date:
Environment:
Command:
Result (PASS/FAIL):
Output snippet:
Notes:
`;
}

export function renderFinalAudit(state) {
  const completion = state.completion;
  const pass = Object.values(completion).filter((x) => x === 'PASS').length;
  const partial = Object.values(completion).filter((x) => x === 'PARTIAL').length;
  const fail = Object.values(completion).filter((x) => x === 'FAIL').length;
  return `# Final Completion Audit

Date:
AUTO (see docs/evidence/GATE_EVALUATION.json for timestamp)

## Gate Results
- CG-1 Reproducible Local Environment: ${completion.CG1}
- CG-2 Test Suite Stability: ${completion.CG2}
- CG-3 Deployment Pipeline: ${completion.CG3}
- CG-4 Backup & Restore: ${completion.CG4}
- CG-5 Monitoring & Health Checks: ${completion.CG5}
- CG-6 Performance Stability: ${completion.CG6}
- CG-7 Documentation Closure: ${completion.CG7}
- CG-8 Git Hygiene: ${completion.CG8}

## Summary
- Gates PASS: ${pass}
- Gates PARTIAL: ${partial}
- Gates FAIL: ${fail}

## Evidence References
- docs/evidence/RUNBOOK_CHECKLIST.md
- docs/evidence/DEPLOYMENT_VALIDATION.md
- docs/evidence/BACKUP_DRILL.md
- docs/evidence/MONITORING_VALIDATION.md
- docs/PERFORMANCE_BASELINE.md
- docs/evidence/PHASE-03_SECRET_SCAN.md
`;
}
