#!/usr/bin/env node
/**
 * VaultLister Smoke Test — fast post-restart validation (~30 seconds)
 *
 * Checks:
 * 1. Server health endpoint
 * 2. Auth login/logout cycle
 * 3. Core API endpoints respond (inventory, listings, dashboard data)
 * 4. Frontend serves correctly (SPA loads, no 500s)
 *
 * Usage:
 *   node scripts/smoke-test.mjs                    # default: http://localhost:3001
 *   node scripts/smoke-test.mjs http://localhost:3000
 *   node scripts/smoke-test.mjs --json             # machine-readable output
 *
 * Exit codes: 0 = all pass, 1 = failures detected
 */

const BASE = process.argv.find(a => a.startsWith('http')) || `http://localhost:${process.env.PORT || 3001}`;
const JSON_MODE = process.argv.includes('--json');
const TIMEOUT = 8000;

const results = [];
let token = null;

function log(msg) {
    if (!JSON_MODE) process.stdout.write(msg);
}

async function check(name, fn) {
    const start = Date.now();
    try {
        await fn();
        const ms = Date.now() - start;
        results.push({ name, status: 'pass', ms });
        log(`  PASS  ${name} (${ms}ms)\n`);
    } catch (err) {
        const ms = Date.now() - start;
        results.push({ name, status: 'fail', ms, error: err.message });
        log(`  FAIL  ${name} (${ms}ms): ${err.message}\n`);
    }
}

async function fetchJSON(path, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const resp = await fetch(`${BASE}${path}`, {
            ...opts,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...(opts.headers || {})
            }
        });
        const body = await resp.json().catch(() => ({}));
        return { status: resp.status, body };
    } finally {
        clearTimeout(timer);
    }
}

// --- Checks ---

async function checkHealth() {
    const { status, body } = await fetchJSON('/api/health');
    if (status !== 200) throw new Error(`status ${status}`);
    if (body.status !== 'healthy') throw new Error(`unhealthy: ${JSON.stringify(body)}`);
}

async function checkLogin() {
    const { status, body } = await fetchJSON('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });
    if (status !== 200) throw new Error(`login status ${status}`);
    if (!body.token) throw new Error('no token in response');
    token = body.token;
}

async function checkInventory() {
    const { status } = await fetchJSON('/api/inventory');
    if (status !== 200) throw new Error(`status ${status}`);
}

async function checkListings() {
    const { status } = await fetchJSON('/api/listings');
    if (![200, 404].includes(status)) throw new Error(`status ${status}`);
}

async function checkDashboard() {
    const { status } = await fetchJSON('/api/reports');
    if (![200, 404].includes(status)) throw new Error(`status ${status}`);
}

async function checkFrontend() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const resp = await fetch(BASE, { signal: controller.signal });
        if (resp.status !== 200) throw new Error(`status ${resp.status}`);
        const html = await resp.text();
        if (!html.includes('VaultLister')) throw new Error('SPA not loaded — missing VaultLister in HTML');
    } finally {
        clearTimeout(timer);
    }
}

async function checkAuthProtection() {
    // Without token, protected endpoint should reject
    const saved = token;
    token = null;
    try {
        const { status } = await fetchJSON('/api/inventory');
        if (status !== 401 && status !== 403) throw new Error(`expected 401/403, got ${status}`);
    } finally {
        token = saved;
    }
}

// --- Main ---

async function main() {
    log(`\nVaultLister Smoke Test\n`);
    log(`Target: ${BASE}\n`);
    log(`${'─'.repeat(50)}\n`);

    await check('1. Health endpoint', checkHealth);
    await check('2. Auth login', checkLogin);
    await check('3. Inventory API', checkInventory);
    await check('4. Listings API', checkListings);
    await check('5. Dashboard/Reports API', checkDashboard);
    await check('6. Frontend serves SPA', checkFrontend);
    await check('7. Auth protection (no token)', checkAuthProtection);

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const totalMs = results.reduce((s, r) => s + r.ms, 0);

    log(`${'─'.repeat(50)}\n`);
    log(`${passed} passed, ${failed} failed (${totalMs}ms total)\n\n`);

    if (JSON_MODE) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            target: BASE,
            passed,
            failed,
            total: results.length,
            totalMs,
            checks: results
        }, null, 2));
    }

    // Write result to audit log if available
    const auditDir = `${process.env.HOME || process.env.USERPROFILE}/.openclaw/logs`;
    try {
        const fs = await import('fs');
        const date = new Date().toISOString().split('T')[0];
        const logFile = `${auditDir}/smoke-${date}.jsonl`;
        const entry = JSON.stringify({
            timestamp: new Date().toISOString(),
            type: 'smoke_test',
            target: BASE,
            passed,
            failed,
            totalMs,
            checks: results
        });
        fs.appendFileSync(logFile, entry + '\n');
    } catch {}

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Smoke test error:', err.message);
    process.exit(1);
});
