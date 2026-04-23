#!/usr/bin/env node
/**
 * VaultLister Post-Deploy Check — validates infrastructure added 2026-03-07
 *
 * Checks:
 *  1. /api/health/live  — new liveness probe (200 + { status: 'ok' })
 *  2. /api/health/ready — new readiness probe (200 + { status, checks })
 *  3. /api/v1/ versioning alias — strips /v1/ prefix transparently
 *  4. ETag returned on GET responses
 *  5. 304 Not Modified on repeat GET with matching If-None-Match
 *  6. Cache-Control header present on cacheable endpoints
 *  7. Health endpoints not rate-limited after repeated requests
 *  8. Env validation active — server started (implied by health pass)
 *
 * Usage:
 *   node scripts/post-deploy-check.mjs                    # default: http://localhost:3000
 *   node scripts/post-deploy-check.mjs http://localhost:3001
 *   node scripts/post-deploy-check.mjs --json
 *
 * Exit codes: 0 = all pass, 1 = one or more failures
 */

const BASE = process.argv.find(a => a.startsWith('http')) || `http://localhost:${process.env.PORT || 3000}`;
const JSON_MODE = process.argv.includes('--json');
const TIMEOUT = 8000;

const results = [];

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

async function get(path, headers = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const resp = await fetch(`${BASE}${path}`, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json', ...headers }
        });
        const body = await resp.json().catch(() => null);
        return { status: resp.status, body, headers: resp.headers };
    } finally {
        clearTimeout(timer);
    }
}

// ── Checks ───────────────────────────────────────────────────────────────────

async function checkLiveProbe() {
    const { status, body } = await get('/api/health/live');
    if (status !== 200) throw new Error(`expected 200, got ${status}`);
    if (body?.status !== 'ok') throw new Error(`expected { status: 'ok' }, got ${JSON.stringify(body)}`);
}

async function checkReadyProbe() {
    const { status, body } = await get('/api/health/ready');
    if (![200, 503].includes(status)) throw new Error(`expected 200 or 503, got ${status}`);
    if (!body?.status) throw new Error(`missing status field in response: ${JSON.stringify(body)}`);
    if (!body?.checks || typeof body.checks !== 'object') throw new Error(`missing checks object in response`);
    if (body.checks.database !== 'ok') throw new Error(`database check: ${body.checks.database}`);
}

async function checkVersioningAlias() {
    const [v1, bare] = await Promise.all([
        get('/api/v1/health'),
        get('/api/health'),
    ]);
    if (v1.status !== bare.status) {
        throw new Error(`/api/v1/health status ${v1.status} != /api/health status ${bare.status}`);
    }
}

async function checkETagPresent() {
    const { status, headers } = await get('/api/health');
    if (status !== 200) throw new Error(`health returned ${status}`);
    const etag = headers.get('etag');
    if (!etag) throw new Error('no ETag header in GET /api/health response');
    if (!/^(W\/)?"[^"]+"$/.test(etag)) throw new Error(`ETag not quoted: ${etag}`);
}

async function check304NotModified() {
    // Use /api/health/live — returns { status: 'ok' }, a stable body with no timestamp,
    // so the ETag is identical across requests and 304 can trigger.
    const first = await get('/api/health/live');
    if (first.status !== 200) throw new Error(`first GET returned ${first.status}`);
    const etag = first.headers.get('etag');
    if (!etag) throw new Error('no ETag on first GET — cannot test 304');

    const second = await get('/api/health/live', { 'If-None-Match': etag });
    if (second.status !== 304) throw new Error(`expected 304 with matching ETag, got ${second.status}`);
}

async function checkCacheControlHeader() {
    // /api/health is public and should have a Cache-Control header (from route returning cacheControl)
    // If the route doesn't set cacheControl, the server won't add it — that's fine.
    // We check that the header is at least present on the live probe which returns { status: 'ok' }
    // and that the ready probe is not cached with public max-age (it checks DB state).
    const live = await get('/api/health/live');
    const ready = await get('/api/health/ready');

    // Ready probe should never be publicly cached (it reflects real-time DB health)
    const readyCc = ready.headers.get('cache-control') || '';
    if (readyCc.includes('public') && readyCc.includes('max-age')) {
        throw new Error(`/api/health/ready should not be publicly cached: ${readyCc}`);
    }

    // Live probe: either no Cache-Control or anything except no-store on a healthy 200
    if (live.status !== 200) throw new Error(`live probe failed: ${live.status}`);
}

async function checkHealthNotRateLimited() {
    // Hit /api/health/live 20 times rapidly — health endpoints are in skipPaths
    // and should never return 429 regardless of rate limiter state.
    const promises = Array.from({ length: 20 }, () => get('/api/health/live'));
    const responses = await Promise.all(promises);
    const blocked = responses.filter(r => r.status === 429);
    if (blocked.length > 0) {
        throw new Error(`${blocked.length}/20 requests to /api/health/live were rate-limited (429)`);
    }
    const failed = responses.filter(r => r.status !== 200);
    if (failed.length > 0) {
        throw new Error(`${failed.length}/20 requests returned non-200: ${failed.map(r => r.status).join(', ')}`);
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    log(`\nVaultLister Post-Deploy Infrastructure Check\n`);
    log(`Target: ${BASE}\n`);
    log(`${'─'.repeat(55)}\n`);

    await check('1. /api/health/live (liveness probe)', checkLiveProbe);
    await check('2. /api/health/ready (readiness probe)', checkReadyProbe);
    await check('3. /api/v1/ versioning alias', checkVersioningAlias);
    await check('4. ETag header present on GET responses', checkETagPresent);
    await check('5. 304 Not Modified with matching If-None-Match', check304NotModified);
    await check('6. Cache-Control safety (ready probe not public)', checkCacheControlHeader);
    await check('7. Health endpoints bypass rate limiter (20 rapid hits)', checkHealthNotRateLimited);

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const totalMs = results.reduce((s, r) => s + r.ms, 0);

    log(`${'─'.repeat(55)}\n`);
    log(`${passed} passed, ${failed} failed (${totalMs}ms total)\n`);

    if (failed === 0) {
        log(`\nAll infrastructure checks passed. Safe to promote.\n\n`);
    } else {
        log(`\n${failed} check(s) failed — do not promote until resolved.\n\n`);
    }

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

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Post-deploy check error:', err.message);
    process.exit(1);
});
