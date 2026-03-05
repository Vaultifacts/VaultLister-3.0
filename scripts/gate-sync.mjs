import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateGates,
  renderCompletionGates,
  renderQualityGates,
  renderFinalAudit
} from './lib/gate-evaluator.mjs';

const repoRoot = process.cwd();
const state = evaluateGates(repoRoot);

const completionPath = path.join(repoRoot, 'claude-docs/docs/project-control/COMPLETION_GATES.md');
const qualityPath = path.join(repoRoot, 'claude-docs/docs/project-control/QUALITY_GATES.md');
const finalAuditPath = path.join(repoRoot, 'docs/evidence/FINAL_COMPLETION_AUDIT.md');
const evalPath = path.join(repoRoot, 'docs/evidence/GATE_EVALUATION.json');

fs.mkdirSync(path.dirname(evalPath), { recursive: true });

fs.writeFileSync(completionPath, renderCompletionGates(state), 'utf8');
fs.writeFileSync(qualityPath, renderQualityGates(state), 'utf8');
fs.writeFileSync(finalAuditPath, renderFinalAudit(state), 'utf8');
fs.writeFileSync(evalPath, JSON.stringify(state, null, 2), 'utf8');

console.log(`Gate sync complete: ${state.generatedAt}`);
console.log(`Completion gates: ${completionPath}`);
console.log(`Quality gates: ${qualityPath}`);
console.log(`Final audit: ${finalAuditPath}`);
console.log(`Evaluation JSON: ${evalPath}`);
