#!/usr/bin/env node
// VaultLister Load Testing Script
// Simulates concurrent users with configurable scenarios and JSON reporting
//
// Usage:
//   bun scripts/load-test.js                    # Standard scenario (default)
//   bun scripts/load-test.js baseline           # Quick baseline (10 users)
//   bun scripts/load-test.js stress             # Stress test (200 users)
//   bun scripts/load-test.js soak               # Sustained load (5 min)
//   bun scripts/load-test.js spike              # Sudden burst (500 users)
//   bun scripts/load-test.js standard --json    # JSON output
//   bun scripts/load-test.js --output report.json   # Save JSON report
//   bun scripts/load-test.js --users 100        # Override user count
//   bun scripts/load-test.js --endpoints-only   # GET-only (no mutations)

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = 'demo@vaultlister.com';
const TEST_PASSWORD = 'DemoPassword123!';

// ==================== SCENARIOS ====================

const SCENARIOS = {
    baseline: { users: 10, requestsPerUser: 5, rampUp: 1000, description: 'Quick baseline test' },
    standard: { users: 50, requestsPerUser: 10, rampUp: 5000, description: 'Standard load test' },
    stress:   { users: 200, requestsPerUser: 20, rampUp: 10000, description: 'Stress test — find breaking point' },
    soak:     { users: 30, requestsPerUser: 100, rampUp: 5000, description: 'Sustained load for ~5 minutes' },
    spike:    { users: 500, requestsPerUser: 5, rampUp: 1000, description: 'Sudden burst of traffic' }
};

// ==================== ENDPOINTS ====================

const GET_ENDPOINTS = [
    { method: 'GET', path: '/api/health', auth: false, tag: 'health' },
    { method: 'GET', path: '/api/status', auth: false, tag: 'health' },
    { method: 'GET', path: '/api/inventory', auth: true, tag: 'inventory' },
    { method: 'GET', path: '/api/listings', auth: true, tag: 'listings' },
    { method: 'GET', path: '/api/analytics/dashboard', auth: true, tag: 'analytics' },
    { method: 'GET', path: '/api/sales?period=30', auth: true, tag: 'sales' },
    { method: 'GET', path: '/api/orders', auth: true, tag: 'orders' },
    { method: 'GET', path: '/api/notifications', auth: true, tag: 'notifications' },
    { method: 'GET', path: '/api/tasks', auth: true, tag: 'tasks' },
    { method: 'GET', path: '/api/calendar', auth: true, tag: 'calendar' },
    { method: 'GET', path: '/api/checklists', auth: true, tag: 'checklists' },
    { method: 'GET', path: '/api/templates', auth: true, tag: 'templates' },
    { method: 'GET', path: '/api/financials/accounts', auth: true, tag: 'financials' },
    { method: 'GET', path: '/api/community/posts', auth: true, tag: 'community' },
    { method: 'GET', path: '/api/feedback', auth: true, tag: 'feedback' },
    { method: 'GET', path: '/api/roadmap', auth: true, tag: 'roadmap' },
    { method: 'GET', path: '/api/monitoring/health', auth: true, tag: 'monitoring' },
];

const MUTATION_ENDPOINTS = [
    { method: 'POST', path: '/api/inventory', auth: true, tag: 'inventory',
      body: () => ({ title: `LT-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, description: 'Load test item', category: 'Tops', status: 'draft', price: 9.99 }) },
    { method: 'POST', path: '/api/tasks', auth: true, tag: 'tasks',
      body: () => ({ title: `LT-Task-${Date.now()}`, description: 'Load test task' }) },
    { method: 'POST', path: '/api/monitoring/rum', auth: false, tag: 'rum',
      body: () => ({ sessionId: `lt-${Date.now()}`, metrics: [{ name: 'LCP', value: Math.random() * 3000, url: 'http://test/' }] }) },
];

// ==================== HTTP CLIENT ====================

async function httpRequest(method, path, token = null, body = null) {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const start = performance.now();
    try {
        const res = await fetch(url.href, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(30000)
        });
        const elapsed = Math.round(performance.now() - start);
        let data = null;
        try { data = await res.json(); } catch {}
        return { statusCode: res.status, responseTime: elapsed, data };
    } catch (err) {
        const elapsed = Math.round(performance.now() - start);
        throw Object.assign(err, { responseTime: elapsed });
    }
}

// ==================== CORE RUNNER ====================

async function login() {
    try {
        const res = await httpRequest('POST', '/api/auth/login', null, { email: TEST_EMAIL, password: TEST_PASSWORD });
        if (res.statusCode === 200 && res.data?.token) return res.data.token;
        throw new Error(`Login failed: ${res.statusCode}`);
    } catch (err) {
        console.error('Login error:', err.message);
        return null;
    }
}

async function runLoadTest(config, endpoints, token) {
    const results = {
        totalRequests: 0, successfulRequests: 0, failedRequests: 0,
        responseTimes: [], statusCodes: {}, errors: [],
        byEndpoint: {}, startTime: Date.now(), endTime: null,
        createdIds: []
    };

    function recordResult(endpoint, res) {
        results.totalRequests++;
        results.responseTimes.push(res.responseTime);
        results.statusCodes[res.statusCode] = (results.statusCodes[res.statusCode] || 0) + 1;

        const key = `${endpoint.method} ${endpoint.path.split('?')[0]}`;
        if (!results.byEndpoint[key]) results.byEndpoint[key] = { count: 0, times: [], errors: 0 };
        results.byEndpoint[key].count++;
        results.byEndpoint[key].times.push(res.responseTime);

        if (res.statusCode >= 200 && res.statusCode < 300) {
            results.successfulRequests++;
            // Track created resources for cleanup
            if (endpoint.method === 'POST' && res.data?.id) {
                results.createdIds.push({ path: endpoint.path, id: res.data.id });
            }
        } else {
            results.failedRequests++;
            results.byEndpoint[key].errors++;
        }
    }

    function recordError(endpoint, err) {
        results.totalRequests++;
        results.failedRequests++;
        results.errors.push(`${endpoint.method} ${endpoint.path}: ${err.message}`);

        const key = `${endpoint.method} ${endpoint.path.split('?')[0]}`;
        if (!results.byEndpoint[key]) results.byEndpoint[key] = { count: 0, times: [], errors: 0 };
        results.byEndpoint[key].count++;
        results.byEndpoint[key].errors++;
        if (err.responseTime) results.byEndpoint[key].times.push(err.responseTime);
    }

    async function simulateUser(userId) {
        for (let i = 0; i < config.requestsPerUser; i++) {
            const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
            const body = ep.body ? ep.body() : null;
            try {
                const res = await httpRequest(ep.method, ep.path, ep.auth ? token : null, body);
                recordResult(ep, res);
            } catch (err) {
                recordError(ep, err);
            }
            // Random think time 50-300ms
            await new Promise(r => setTimeout(r, 50 + Math.random() * 250));
        }
    }

    // Ramp up users
    const userDelay = config.rampUp / config.users;
    const promises = [];
    for (let i = 0; i < config.users; i++) {
        promises.push(
            new Promise(async (resolve) => {
                await new Promise(r => setTimeout(r, i * userDelay));
                await simulateUser(i + 1);
                resolve();
            })
        );
        if ((i + 1) % Math.max(1, Math.floor(config.users / 10)) === 0) {
            process.stdout.write(`  Started ${i + 1}/${config.users} users\r`);
        }
    }
    console.log(`  Started ${config.users}/${config.users} users`);

    await Promise.all(promises);
    results.endTime = Date.now();
    return results;
}

// ==================== CLEANUP ====================

async function cleanup(results, token) {
    if (results.createdIds.length === 0) return;
    console.log(`Cleaning up ${results.createdIds.length} test resources...`);
    for (const { path, id } of results.createdIds) {
        try {
            await httpRequest('DELETE', `${path}/${id}`, token);
        } catch {}
    }
}

// ==================== STATISTICS ====================

function calcStats(times) {
    if (times.length === 0) return { min: 0, max: 0, avg: 0, median: 0, p50: 0, p95: 0, p99: 0 };
    const sorted = times.slice().sort((a, b) => a - b);
    const len = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
        min: sorted[0],
        max: sorted[len - 1],
        avg: Math.round(sum / len),
        median: sorted[Math.floor(len / 2)],
        p50: sorted[Math.floor(len * 0.50)],
        p95: sorted[Math.floor(len * 0.95)],
        p99: sorted[Math.floor(len * 0.99)]
    };
}

function gradePerformance(successRate, p95) {
    if (successRate >= 99 && p95 < 200) return 'EXCELLENT';
    if (successRate >= 95 && p95 < 500) return 'GOOD';
    if (successRate >= 90 && p95 < 1000) return 'ACCEPTABLE';
    return 'NEEDS IMPROVEMENT';
}

// ==================== REPORTING ====================

function buildReport(scenarioName, config, results) {
    const duration = (results.endTime - results.startTime) / 1000;
    const stats = calcStats(results.responseTimes);
    const successRate = results.totalRequests > 0 ? (results.successfulRequests / results.totalRequests) * 100 : 0;
    const rps = Math.round(results.totalRequests / duration);
    const grade = gradePerformance(successRate, stats.p95);

    const byEndpoint = {};
    for (const [key, ep] of Object.entries(results.byEndpoint)) {
        const epStats = calcStats(ep.times);
        byEndpoint[key] = { count: ep.count, errors: ep.errors, avg: epStats.avg, p95: epStats.p95, p99: epStats.p99 };
    }

    return {
        timestamp: new Date().toISOString(),
        scenario: scenarioName,
        config: { users: config.users, requestsPerUser: config.requestsPerUser, rampUp: config.rampUp, baseUrl: BASE_URL },
        summary: { duration: parseFloat(duration.toFixed(2)), totalRequests: results.totalRequests, successful: results.successfulRequests, failed: results.failedRequests, successRate: parseFloat(successRate.toFixed(2)), rps },
        responseTimes: stats,
        statusCodes: results.statusCodes,
        byEndpoint,
        errors: [...new Set(results.errors)].slice(0, 20),
        grade
    };
}

function printReport(report) {
    console.log('\n======================================================');
    console.log('                  LOAD TEST RESULTS                    ');
    console.log('======================================================\n');

    console.log(`Scenario:        ${report.scenario} — ${SCENARIOS[report.scenario]?.description || ''}`);
    console.log(`Base URL:        ${report.config.baseUrl}`);
    console.log(`Users:           ${report.config.users}`);
    console.log(`Requests/User:   ${report.config.requestsPerUser}`);
    console.log(`Ramp-up:         ${report.config.rampUp}ms\n`);

    console.log('Summary:');
    console.log(`  Duration:        ${report.summary.duration}s`);
    console.log(`  Total Requests:  ${report.summary.totalRequests}`);
    console.log(`  Successful:      ${report.summary.successful}`);
    console.log(`  Failed:          ${report.summary.failed}`);
    console.log(`  Success Rate:    ${report.summary.successRate}%`);
    console.log(`  Requests/Second: ${report.summary.rps}\n`);

    console.log('Response Times (ms):');
    console.log(`  Min:     ${report.responseTimes.min}ms`);
    console.log(`  Avg:     ${report.responseTimes.avg}ms`);
    console.log(`  Median:  ${report.responseTimes.median}ms`);
    console.log(`  p95:     ${report.responseTimes.p95}ms`);
    console.log(`  p99:     ${report.responseTimes.p99}ms`);
    console.log(`  Max:     ${report.responseTimes.max}ms\n`);

    console.log('Status Codes:');
    for (const [code, count] of Object.entries(report.statusCodes).sort()) {
        const pct = ((count / report.summary.totalRequests) * 100).toFixed(1);
        console.log(`  ${code}: ${count} (${pct}%)`);
    }

    console.log('\nPer-Endpoint:');
    for (const [key, ep] of Object.entries(report.byEndpoint).sort((a, b) => b[1].count - a[1].count)) {
        console.log(`  ${key.padEnd(40)} count=${ep.count} avg=${ep.avg}ms p95=${ep.p95}ms errors=${ep.errors}`);
    }

    if (report.errors.length > 0) {
        console.log('\nErrors (unique):');
        report.errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
        if (report.errors.length > 5) console.log(`  ... and ${report.errors.length - 5} more`);
    }

    console.log('\n======================================================');
    console.log(`Performance: ${report.grade}`);
    console.log('======================================================\n');
}

// ==================== MAIN ====================

async function main() {
    const args = process.argv.slice(2);

    // Parse flags
    let scenarioName = 'standard';
    let jsonOutput = false;
    let outputFile = null;
    let userOverride = null;
    let endpointsOnly = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--json') { jsonOutput = true; continue; }
        if (args[i] === '--output' && args[i + 1]) { outputFile = args[++i]; jsonOutput = true; continue; }
        if (args[i] === '--users' && args[i + 1]) { userOverride = parseInt(args[++i]); continue; }
        if (args[i] === '--endpoints-only') { endpointsOnly = true; continue; }
        if (args[i] === '--help' || args[i] === '-h') {
            console.log(`VaultLister Load Test

Usage: bun scripts/load-test.js [scenario] [options]

Scenarios:
  baseline    10 users, 5 req each (quick sanity check)
  standard    50 users, 10 req each (default)
  stress      200 users, 20 req each (find breaking point)
  soak        30 users, 100 req each (sustained ~5 min)
  spike       500 users, 5 req each (sudden burst)

Options:
  --json             Output as JSON
  --output <file>    Save JSON report to file
  --users <n>        Override concurrent users
  --endpoints-only   GET endpoints only (no POST/PUT/DELETE)
  --help             Show this help`);
            return;
        }
        if (SCENARIOS[args[i]]) { scenarioName = args[i]; }
    }

    const scenario = { ...SCENARIOS[scenarioName] };
    if (userOverride) scenario.users = userOverride;

    const endpoints = endpointsOnly ? GET_ENDPOINTS : [...GET_ENDPOINTS, ...MUTATION_ENDPOINTS];

    if (!jsonOutput) {
        console.log('VaultLister Load Test');
        console.log('=====================');
        console.log(`Scenario: ${scenarioName} — ${scenario.description}`);
        console.log(`Target: ${BASE_URL}`);
        console.log(`Users: ${scenario.users}, Requests/User: ${scenario.requestsPerUser}`);
        console.log(`Endpoints: ${endpoints.length} (${endpointsOnly ? 'GET only' : 'GET + mutations'})\n`);
    }

    // Authenticate
    if (!jsonOutput) console.log('Authenticating...');
    const token = await login();
    if (!token) {
        console.error('Failed to authenticate. Only unauthenticated endpoints will work.');
    } else if (!jsonOutput) {
        console.log('Authentication successful\n');
    }

    if (!jsonOutput) console.log('Starting load test...');
    const results = await runLoadTest(scenario, endpoints, token);

    // Cleanup test resources
    await cleanup(results, token);

    // Build report
    const report = buildReport(scenarioName, scenario, results);

    if (jsonOutput) {
        const json = JSON.stringify(report, null, 2);
        if (outputFile) {
            const { writeFileSync } = await import('fs');
            writeFileSync(outputFile, json);
            console.error(`Report saved to ${outputFile}`);
        } else {
            console.log(json);
        }
    } else {
        printReport(report);
    }
}

main().catch(console.error);
