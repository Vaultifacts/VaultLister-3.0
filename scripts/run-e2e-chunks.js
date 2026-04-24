#!/usr/bin/env node
/**
 * Chunked E2E Test Runner
 * Splits the test suite into memory-safe batches and runs them sequentially.
 * Each chunk gets its own Playwright process to prevent OOM crashes.
 *
 * Usage:
 *   node scripts/run-e2e-chunks.js              # run all chunks
 *   node scripts/run-e2e-chunks.js --chunk 2    # run only chunk 2
 *   node scripts/run-e2e-chunks.js --list       # list chunks without running
 *   node scripts/run-e2e-chunks.js --summary    # run all, show summary at end
 */

import { readdirSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEST_DIR = join(ROOT, 'e2e', 'tests');
const REPORT_DIR = join(ROOT, 'playwright-report');
const PLAYWRIGHT_TEST_CLI = join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

// Get all spec files sorted by size (largest first for better balancing)
const specFiles = readdirSync(TEST_DIR)
    .filter(f => f.endsWith('.spec.js'))
    .sort();

// Chunk definitions — grouped by domain to keep related tests together
// Each chunk targets ~150-200 tests (safe for 4GB RAM with 2 workers)
const CHUNKS = [
    {
        name: 'auth-core',
        description: 'Authentication, login, register, forgot-password, remember-me',
        files: [
            'auth.spec.js',
            'quinn-v3-login-audit.spec.js',
            'quinn-v3-register-audit.spec.js',
            'quinn-v3-forgot-password-audit.spec.js',
            'remember-me.spec.js',
        ]
    },
    {
        name: 'inventory-listings',
        description: 'Inventory, listings, import flows',
        files: [
            'inventory.spec.js',
            'quinn-v3-inventory-audit.spec.js',
            'quinn-v3-inventory-table-audit.spec.js',
            'quinn-v3-listings-table-audit.spec.js',
            'quinn-v3-import-flow-audit.spec.js',
            'imageBank.spec.js',
        ]
    },
    {
        name: 'sales-orders-offers',
        description: 'Orders, sales, offers, financials, transactions',
        files: [
            'orders.spec.js',
            'offers.spec.js',
            'quinn-v3-orders-table-audit.spec.js',
            'quinn-v3-sales-orders-table-audit.spec.js',
            'financials.spec.js',
            'transactions-financials.spec.js',
        ]
    },
    {
        name: 'analytics-settings',
        description: 'Analytics, settings, teams, shops',
        files: [
            'analytics.spec.js',
            'quinn-v3-analytics-table-audit.spec.js',
            'settings.spec.js',
            'quinn-v3-settings-audit.spec.js',
            'teams.spec.js',
            'shops.spec.js',
        ]
    },
    {
        name: 'navigation-ui',
        description: 'Navigation, modals, mobile viewport, accessibility, error states',
        files: [
            'quinn-v3-navigation-audit.spec.js',
            'quinn-v3-modals-audit.spec.js',
            'quinn-v3-mobile-viewport-audit.spec.js',
            'quinn-v3-accessibility-audit.spec.js',
            'quinn-v3-error-states-audit.spec.js',
            'route-chunking.spec.js',
            'accessibility.spec.js',
        ]
    },
    {
        name: 'community-help',
        description: 'Help, community, changelog, roadmap, GDPR, push notifications',
        files: [
            'help.spec.js',
            'community.spec.js',
            'changelog-roadmap-offers.spec.js',
            'gdpr.spec.js',
            'push-notifications.spec.js',
            'suppliers.spec.js',
        ]
    },
    {
        name: 'integrations',
        description: 'WebSocket, eBay, Poshmark, Chrome extension, service worker',
        files: [
            'websocket.spec.js',
            'quinn-v3-websocket-audit.spec.js',
            'quinn-v3-ws-server-push-audit.spec.js',
            'ebay-integration.spec.js',
            'poshmark-automation.spec.js',
            'chrome-extension.spec.js',
            'service-worker.spec.js',
        ]
    },
    {
        name: 'audits-misc',
        description: 'Comprehensive audits, automations, monitoring, QA, screenshots',
        files: [
            'comprehensive-audit.spec.js',
            'comprehensive-audit-v2.spec.js',
            'automations.spec.js',
            'monitoring-routes.spec.js',
            'qa-guardian.spec.js',
            'screenshot.spec.js',
            'ai.spec.js',
            'billing.spec.js',
            'oauth.spec.js',
            'onboarding.spec.js',
            'reports.spec.js',
        ]
    },
];

// Verify all spec files are covered
const coveredFiles = new Set(CHUNKS.flatMap(c => c.files));
const uncovered = specFiles.filter(f => !coveredFiles.has(f));
if (uncovered.length > 0) {
    console.log(`Warning: ${uncovered.length} spec files not in any chunk:`);
    uncovered.forEach(f => console.log(`  - ${f}`));
    // Add uncovered to last chunk
    CHUNKS[CHUNKS.length - 1].files.push(...uncovered);
}

const args = process.argv.slice(2);
const LIST_ONLY = args.includes('--list');
const SUMMARY = args.includes('--summary');
const chunkIdx = args.indexOf('--chunk');
let SINGLE_CHUNK = chunkIdx !== -1 ? parseInt(args[chunkIdx + 1]) : null;

if (SINGLE_CHUNK !== null) {
    if (isNaN(SINGLE_CHUNK) || SINGLE_CHUNK < 1 || SINGLE_CHUNK > CHUNKS.length) {
        console.error(`Error: --chunk must be a number between 1 and ${CHUNKS.length} (got: ${args[chunkIdx + 1]})`);
        process.exit(1);
    }
}

// List mode
if (LIST_ONLY) {
    console.log(`\n=== E2E Test Chunks (${CHUNKS.length} chunks, ${specFiles.length} spec files) ===\n`);
    CHUNKS.forEach((chunk, i) => {
        console.log(`  Chunk ${i + 1}: ${chunk.name} (${chunk.files.length} files)`);
        console.log(`    ${chunk.description}`);
        chunk.files.forEach(f => console.log(`      - ${f}`));
        console.log('');
    });
    process.exit(0);
}

// Run chunks
const results = [];
const chunksToRun = SINGLE_CHUNK ? [CHUNKS[SINGLE_CHUNK - 1]] : CHUNKS;
const startIdx = SINGLE_CHUNK ? SINGLE_CHUNK : 1;

console.log('');
console.log(`=== Chunked E2E Test Runner ===`);
console.log(`Running ${chunksToRun.length} chunk(s), Chromium only, 2 workers`);
console.log('');

for (let i = 0; i < chunksToRun.length; i++) {
    const chunk = chunksToRun[i];
    const num = SINGLE_CHUNK || (i + 1);
    const fileGlob = chunk.files.map(f => `e2e/tests/${f}`).join(' ');

    console.log(`━━━ Chunk ${num}/${CHUNKS.length}: ${chunk.name} (${chunk.files.length} files) ━━━`);
    console.log(`    ${chunk.description}`);

    const port = process.env.TEST_PORT || '3100';
    const jsonReport = join(REPORT_DIR, `chunk-${num}.json`);
    const args = [PLAYWRIGHT_TEST_CLI, 'test', ...chunk.files.map(f => `e2e/tests/${f}`),
        '--project=chromium', '--workers=2', '--retries=1',
        '--reporter=list,json',
        `--output=${join(REPORT_DIR, `chunk-${num}-results`)}`
    ];
    const start = Date.now();

    mkdirSync(REPORT_DIR, { recursive: true });

    const result = spawnSync(process.execPath, args, {
        cwd: ROOT,
        env: {
            ...process.env,
            NODE_ENV: 'test',
            PORT: port,
            TEST_PORT: port,
            TEST_BASE_URL: `http://localhost:${port}`,
            PW_WORKERS: '2',
            DISABLE_RATE_LIMIT: 'true',
            DISABLE_CSRF: 'true',
            PLAYWRIGHT_JSON_OUTPUT_NAME: jsonReport,
        },
        timeout: 600000, // 10 min per chunk
        stdio: 'inherit',
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    // Parse results from JSON report if available
    let passed = 0, failed = 0;
    try {
        const report = JSON.parse(readFileSync(jsonReport, 'utf8'));
        for (const suite of report.suites || []) {
            for (const spec of suite.specs || []) {
                for (const test of spec.tests || []) {
                    const lastResult = test.results?.[test.results.length - 1];
                    if (lastResult?.status === 'passed') passed++;
                    else failed++;
                }
            }
        }
    } catch {
        // JSON report not available — use exit code
        passed = result.status === 0 ? '?' : 0;
        failed = result.status === 0 ? 0 : '?';
    }

    if (result.status === 0) {
        console.log(`    ✓ ${passed} passed, ${failed} failed (${elapsed}s)`);
        results.push({ chunk: chunk.name, passed, failed, elapsed, status: 'done' });
    } else if (result.status === 1) {
        console.log(`    ⚠ ${passed} passed, ${failed} failed (${elapsed}s)`);
        results.push({ chunk: chunk.name, passed, failed, elapsed, status: 'partial' });
    } else {
        console.log(`    ✗ Crashed or timed out (exit ${result.status}, ${elapsed}s)`);
        results.push({ chunk: chunk.name, passed, failed, elapsed, status: 'crashed' });
    }

    console.log('');
}

// Summary
console.log('━━━ Summary ━━━');
let totalPassed = 0, totalFailed = 0;
for (const r of results) {
    const icon = r.status === 'done' ? '✓' : r.status === 'partial' ? '⚠' : '✗';
    console.log(`  ${icon} ${r.chunk}: ${r.passed} passed, ${r.failed} failed (${r.elapsed}s)`);
    totalPassed += typeof r.passed === 'number' ? r.passed : 0;
    totalFailed += typeof r.failed === 'number' ? r.failed : 0;
}
console.log(`\n  Total: ${totalPassed} passed, ${totalFailed} failed`);
console.log('');

// Save report
try {
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(join(REPORT_DIR, 'chunk-results.json'), JSON.stringify({ timestamp: new Date().toISOString(), results, totalPassed, totalFailed }, null, 2));
} catch {}

process.exit(totalFailed > 0 || results.some(r => r.status === 'crashed') ? 1 : 0);
