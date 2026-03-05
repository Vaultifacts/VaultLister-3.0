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

function normalize(content) {
  return content
    .replace(/^Generated:\s+.*$/gm, 'Generated: <normalized>')
    .replace(/^Date:\s*$/gm, 'Date:')
    .replace(/^Date:\n.*$/gm, 'Date:\n<normalized>');
}

const targets = [
  {
    name: 'COMPLETION_GATES.md',
    path: path.join(repoRoot, 'claude-docs/docs/project-control/COMPLETION_GATES.md'),
    expected: renderCompletionGates(state)
  },
  {
    name: 'QUALITY_GATES.md',
    path: path.join(repoRoot, 'claude-docs/docs/project-control/QUALITY_GATES.md'),
    expected: renderQualityGates(state)
  },
  {
    name: 'FINAL_COMPLETION_AUDIT.md',
    path: path.join(repoRoot, 'docs/evidence/FINAL_COMPLETION_AUDIT.md'),
    expected: renderFinalAudit(state)
  }
];

const drifted = [];
for (const target of targets) {
  const actual = fs.existsSync(target.path) ? fs.readFileSync(target.path, 'utf8') : '';
  if (normalize(actual) !== normalize(target.expected)) drifted.push(target.name);
}

if (drifted.length > 0) {
  console.error('Gate drift detected. Run: npm run gate:sync');
  for (const name of drifted) console.error(` - ${name}`);
  process.exit(1);
}

console.log('Gate drift check PASS');
