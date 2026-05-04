#!/usr/bin/env bun
import { spawnSync } from 'child_process';

const steps = [
  { name: 'Internal link check', cmd: 'bun', args: ['scripts/check-links.js'] },
  { name: 'Spelling check', cmd: 'npx', args: ['cspell', 'lint', 'public/**/*.html', '--no-progress'] },
  { name: 'HTML validation', cmd: 'npx', args: ['html-validate', 'public/', '--ext', '.html'] },
  { name: 'CSS lint (contrast bans)', cmd: 'bun', args: ['run', 'lint:css'] },
  { name: 'Semgrep a11y rules', cmd: 'semgrep', args: ['scan', '--config', './semgrep-rules/', 'src/frontend/', '--quiet'] },
];

let failures = 0;

for (const { name, cmd, args } of steps) {
  process.stdout.write(`\n=== ${name} ===\n`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', timeout: 120_000 });
  if (result.status === 0) {
    console.log(`PASS: ${name}`);
  } else {
    console.error(`FAIL: ${name}`);
    failures++;
  }
}

console.log(`\n=== Summary: ${steps.length - failures}/${steps.length} passed ===`);
process.exit(failures > 0 ? 1 : 0);
