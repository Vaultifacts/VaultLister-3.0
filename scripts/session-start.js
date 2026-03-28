/**
 * VaultLister Session Start Script
 *
 * Run at the beginning of each coding session to:
 * 1. Show all COMPLETED features (to avoid duplicate suggestions)
 * 2. Show pending issues, waiting approvals, and items ready to move
 *
 * Usage: bun scripts/session-start.js
 */

import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = `${__dirname}/${scriptName}`;
    const proc = spawn('bun', [scriptPath], {
      stdio: 'inherit',
      cwd: dirname(__dirname),
      shell: true  // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}`));
    });

    proc.on('error', reject);
  });
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           VAULTLISTER SESSION START                        ║');
  console.log('║           ' + new Date().toLocaleString().padEnd(36) + '║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    // First, show completed features (to avoid suggesting them)
    console.log('STEP 1: Loading completed features...\n');
    await runScript('fetch-completed-features.js');

    console.log('\n\n');

    // Then, show current Notion status
    console.log('STEP 2: Checking Notion status...\n');
    await runScript('check-notion-status.js');

    // Check server status
    console.log('STEP 3: Checking server status...\n');
    let serverStatus = 'NOT RUNNING';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('http://localhost:3000/api/health', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        serverStatus = `RUNNING on port 3000 (db: ${data.database?.status || 'unknown'})`;
      } else {
        serverStatus = `ERROR: Server returned ${res.status}`;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        serverStatus = 'NOT RUNNING (timeout)';
      } else if (err.code === 'ECONNREFUSED') {
        serverStatus = 'NOT RUNNING (connection refused)';
      } else {
        serverStatus = `NOT RUNNING (${err.message})`;
      }
    }

    console.log(`  Server Status: ${serverStatus}`);
    if (serverStatus === 'NOT RUNNING') {
      console.log('  Start with:    bun run dev       (foreground with file watching)');
      console.log('                 bun run dev:bg    (background mode)');
    }
    console.log('');

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           SESSION START COMPLETE                           ║');
    console.log('║                                                            ║');
    console.log('║  REMINDERS:                                                ║');
    console.log('║  • Do NOT suggest features from "Completed" list above     ║');
    console.log('║  • Work on "Pending" items from Notion status              ║');
    console.log('║  • Transfer "Approved to Move" items to Complete           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');

  } catch (error) {
    console.error('Session start failed:', error.message);
    process.exit(1);
  }
}

main();
