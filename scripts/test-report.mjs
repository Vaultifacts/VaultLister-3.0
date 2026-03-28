#!/usr/bin/env node
/**
 * VaultLister Test Regression Tracker
 *
 * Runs the test suite, captures results, logs to audit trail,
 * and alerts on regression via Telegram.
 *
 * Usage:
 *   node scripts/test-report.mjs                  # run unit tests
 *   node scripts/test-report.mjs --e2e            # run E2E (chromium)
 *   node scripts/test-report.mjs --all            # run both
 *   node scripts/test-report.mjs --check-only     # just check last run
 *   node scripts/test-report.mjs --history        # show last 10 runs
 *
 * Output: writes to ./data/logs/test-history.jsonl
 * Alerts: calls ~/scripts/tg-notify.sh on regression
 */

import { execSync } from 'child_process';
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = process.cwd();
const HOME = process.env.HOME || process.env.USERPROFILE || '';

const LOG_DIR = './data/logs';
const HISTORY_FILE = join(LOG_DIR, 'test-history.jsonl');
const BASELINE_FILE = '.test-baseline';
const TG_NOTIFY = join(HOME, 'scripts/tg-notify.sh');

// Ensure log dir exists
try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}

function getBaseline() {
    try {
        const content = readFileSync(BASELINE_FILE, 'utf8');
        const match = content.match(/KNOWN_FAILURES=(\d+)/);
        return match ? parseInt(match[1]) : 6;
    } catch {
        return 6;
    }
}

function parseTestOutput(output) {
    const passMatch = output.match(/(\d+)\s+pass/);
    const failMatch = output.match(/(\d+)\s+fail/);
    const skipMatch = output.match(/(\d+)\s+skip/);
    const totalMatch = output.match(/Ran\s+(\d+)\s+tests/);
    const timeMatch = output.match(/\[(\d+\.?\d*)s\]/);

    return {
        pass: passMatch ? parseInt(passMatch[1]) : 0,
        fail: failMatch ? parseInt(failMatch[1]) : 0,
        skip: skipMatch ? parseInt(skipMatch[1]) : 0,
        total: totalMatch ? parseInt(totalMatch[1]) : 0,
        durationSec: timeMatch ? parseFloat(timeMatch[1]) : 0
    };
}

function parseE2EOutput(output) {
    const passMatch = output.match(/(\d+)\s+passed/);
    const failMatch = output.match(/(\d+)\s+failed/);
    const skipMatch = output.match(/(\d+)\s+skipped/);

    return {
        pass: passMatch ? parseInt(passMatch[1]) : 0,
        fail: failMatch ? parseInt(failMatch[1]) : 0,
        skip: skipMatch ? parseInt(skipMatch[1]) : 0,
        total: (passMatch ? parseInt(passMatch[1]) : 0) +
               (failMatch ? parseInt(failMatch[1]) : 0) +
               (skipMatch ? parseInt(skipMatch[1]) : 0)
    };
}

function getHistory(limit = 10) {
    if (!existsSync(HISTORY_FILE)) return [];
    const lines = readFileSync(HISTORY_FILE, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map(l => {
        try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
}

function logResult(entry) {
    appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n');
}

function notify(msg) {
    try {
        execSync(`bash "${TG_NOTIFY}" "${msg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`, { stdio: 'ignore' });  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process -- lgtm[js/incomplete-sanitization] -- dev/CI only; msg is test output, not user input
    } catch {}
}

function runUnit() {
    console.log('Running unit tests...');
    const cmd = `NODE_ENV=test DISABLE_CSRF=true DISABLE_RATE_LIMIT=true ${HOME}/.bun/bin/bun test src/tests/ 2>&1`;
    try {
        const output = execSync(cmd, {  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
            cwd: PROJECT,
            timeout: 300000,
            encoding: 'utf8'
        });
        return { output, results: parseTestOutput(output) };
    } catch (err) {
        const output = err.stdout || err.stderr || '';
        return { output, results: parseTestOutput(output) };
    }
}

function runE2E() {
    console.log('Running E2E tests (Chromium)...');
    // Only set DISPLAY on Linux; Windows/macOS don't need it
    const isLinux = process.platform === 'linux';
    const displayEnv = isLinux ? 'DISPLAY=:99 ' : '';
    const cmd = `${displayEnv}NODE_ENV=test npx playwright test --project=chromium --reporter=line 2>&1`;
    try {
        const output = execSync(cmd, {  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
            cwd: PROJECT,
            timeout: 600000,
            encoding: 'utf8'
        });
        return { output, results: parseE2EOutput(output) };
    } catch (err) {
        const output = err.stdout || err.stderr || '';
        return { output, results: parseE2EOutput(output) };
    }
}

// --- Main ---

const args = process.argv.slice(2);

if (args.includes('--history')) {
    const history = getHistory(20);
    console.log(`\nTest History (last ${history.length} runs)\n${'─'.repeat(70)}`);
    for (const h of history) {
        const d = new Date(h.timestamp).toLocaleString();
        const type = h.type.padEnd(5);
        const rate = h.total > 0 ? ((h.pass / h.total) * 100).toFixed(1) : '0.0';
        const status = h.regression ? 'REGR' : 'OK  ';
        console.log(`${d}  ${type}  ${h.pass}/${h.total} (${rate}%) ${status}  fail=${h.fail}`);
    }
    console.log();
    process.exit(0);
}

if (args.includes('--check-only')) {
    const history = getHistory(1);
    if (history.length === 0) {
        console.log('No previous test runs found.');
        process.exit(0);
    }
    const last = history[0];
    console.log(`Last run: ${last.timestamp}`);
    console.log(`  Type: ${last.type}, Pass: ${last.pass}, Fail: ${last.fail}, Total: ${last.total}`);
    console.log(`  Regression: ${last.regression ? 'YES' : 'no'}`);
    process.exit(last.regression ? 1 : 0);
}

const baseline = getBaseline();
let hasRegression = false;

// Unit tests
if (!args.includes('--e2e')) {
    const { results } = runUnit();
    const entry = {
        timestamp: new Date().toISOString(),
        type: 'unit',
        ...results,
        baseline,
        regression: results.fail > baseline
    };
    logResult(entry);

    console.log(`\nUnit: ${results.pass} pass, ${results.fail} fail, ${results.skip} skip (${results.total} total, ${results.durationSec}s)`);
    console.log(`Baseline: ${baseline} known failures`);

    if (results.fail > baseline) {
        hasRegression = true;
        const msg = `REGRESSION: Unit tests ${results.fail} failures (baseline: ${baseline}). ${results.pass}/${results.total} passing.`;
        console.log(`\n  >>> ${msg}\n`);
        notify(msg);
    } else {
        console.log(`  OK (${results.fail}/${baseline} known failures)`);
    }
}

// E2E tests
if (args.includes('--e2e') || args.includes('--all')) {
    const { results } = runE2E();
    const entry = {
        timestamp: new Date().toISOString(),
        type: 'e2e',
        ...results,
        regression: results.fail > 0
    };
    logResult(entry);

    console.log(`\nE2E (Chromium): ${results.pass} pass, ${results.fail} fail, ${results.skip} skip`);

    if (results.fail > 0) {
        hasRegression = true;
        const msg = `REGRESSION: E2E ${results.fail} failures. ${results.pass}/${results.total} passing.`;
        console.log(`\n  >>> ${msg}\n`);
        notify(msg);
    } else {
        console.log('  OK (0 failures)');
    }
}

process.exit(hasRegression ? 1 : 0);
