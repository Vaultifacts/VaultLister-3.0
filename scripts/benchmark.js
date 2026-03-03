#!/usr/bin/env bun
// VaultLister Performance Benchmark
// Usage: bun run scripts/benchmark.js [--iterations=100] [--concurrency=10]

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Parse arguments
const args = process.argv.slice(2);
const iterations = parseInt(args.find(a => a.startsWith('--iterations='))?.split('=')[1] || '100');
const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '10');

// Test endpoints
const endpoints = [
    { name: 'Health Check', method: 'GET', path: '/api/health', auth: false },
    { name: 'Login', method: 'POST', path: '/api/auth/login', auth: false,
      body: { email: 'demo@vaultlister.com', password: 'DemoPassword123!' } },
    { name: 'Inventory List', method: 'GET', path: '/api/inventory', auth: true },
    { name: 'Listings List', method: 'GET', path: '/api/listings', auth: true },
    { name: 'Analytics Overview', method: 'GET', path: '/api/analytics/overview', auth: true },
];

// Results storage
const results = {};

// Auth token
let authToken = null;

async function getAuthToken() {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' })
    });
    const data = await response.json();
    return data.token;
}

async function makeRequest(endpoint) {
    const headers = { 'Content-Type': 'application/json' };
    if (endpoint.auth && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const options = {
        method: endpoint.method,
        headers
    };

    if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
    }

    const start = performance.now();
    try {
        const response = await fetch(`${BASE_URL}${endpoint.path}`, options);
        const end = performance.now();
        return {
            success: response.ok,
            status: response.status,
            duration: end - start
        };
    } catch (error) {
        return {
            success: false,
            status: 0,
            duration: performance.now() - start,
            error: error.message
        };
    }
}

async function runBenchmark(endpoint, iterations, concurrency) {
    const times = [];
    const errors = [];
    let successCount = 0;

    // Run in batches for concurrency
    for (let i = 0; i < iterations; i += concurrency) {
        const batch = Math.min(concurrency, iterations - i);
        const promises = Array(batch).fill().map(() => makeRequest(endpoint));
        const results = await Promise.all(promises);

        for (const result of results) {
            if (result.success) {
                successCount++;
                times.push(result.duration);
            } else {
                errors.push(result);
            }
        }
    }

    // Calculate statistics
    times.sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);

    return {
        name: endpoint.name,
        iterations,
        concurrency,
        successCount,
        errorCount: errors.length,
        successRate: ((successCount / iterations) * 100).toFixed(2) + '%',
        avgMs: (sum / times.length || 0).toFixed(2),
        minMs: (times[0] || 0).toFixed(2),
        maxMs: (times[times.length - 1] || 0).toFixed(2),
        p50Ms: (times[Math.floor(times.length * 0.5)] || 0).toFixed(2),
        p95Ms: (times[Math.floor(times.length * 0.95)] || 0).toFixed(2),
        p99Ms: (times[Math.floor(times.length * 0.99)] || 0).toFixed(2),
        requestsPerSecond: (successCount / (sum / 1000 || 1)).toFixed(2)
    };
}

async function main() {
    console.log('VaultLister Performance Benchmark');
    console.log('==================================');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Iterations: ${iterations}`);
    console.log(`Concurrency: ${concurrency}`);
    console.log('');

    // Get auth token first
    console.log('Authenticating...');
    try {
        authToken = await getAuthToken();
        if (!authToken) {
            console.error('Failed to get auth token');
            process.exit(1);
        }
        console.log('Authenticated successfully\n');
    } catch (error) {
        console.error('Auth failed:', error.message);
        console.log('Make sure the server is running on', BASE_URL);
        process.exit(1);
    }

    // Run benchmarks
    for (const endpoint of endpoints) {
        console.log(`Testing: ${endpoint.name}...`);
        const result = await runBenchmark(endpoint, iterations, concurrency);
        results[endpoint.name] = result;
    }

    // Print results
    console.log('\n\nResults');
    console.log('=======\n');

    console.log('| Endpoint | Success | Avg (ms) | P50 (ms) | P95 (ms) | P99 (ms) | RPS |');
    console.log('|----------|---------|----------|----------|----------|----------|-----|');

    for (const [name, stats] of Object.entries(results)) {
        console.log(`| ${name.padEnd(16)} | ${stats.successRate.padStart(7)} | ${stats.avgMs.padStart(8)} | ${stats.p50Ms.padStart(8)} | ${stats.p95Ms.padStart(8)} | ${stats.p99Ms.padStart(8)} | ${stats.requestsPerSecond.padStart(3)} |`);
    }

    console.log('\n');

    // Summary
    const allAvg = Object.values(results).map(r => parseFloat(r.avgMs));
    const overallAvg = (allAvg.reduce((a, b) => a + b, 0) / allAvg.length).toFixed(2);

    console.log('Summary');
    console.log('-------');
    console.log(`Overall Average Response: ${overallAvg}ms`);

    // Performance grade
    if (parseFloat(overallAvg) < 50) {
        console.log('Performance Grade: A (Excellent)');
    } else if (parseFloat(overallAvg) < 100) {
        console.log('Performance Grade: B (Good)');
    } else if (parseFloat(overallAvg) < 200) {
        console.log('Performance Grade: C (Acceptable)');
    } else if (parseFloat(overallAvg) < 500) {
        console.log('Performance Grade: D (Needs Improvement)');
    } else {
        console.log('Performance Grade: F (Poor)');
    }

    // Warnings for slow endpoints
    const slowEndpoints = Object.entries(results).filter(([_, stats]) => parseFloat(stats.p95Ms) > 500);
    if (slowEndpoints.length > 0) {
        console.log('\nWarnings:');
        for (const [name, stats] of slowEndpoints) {
            console.log(`  - ${name}: P95 is ${stats.p95Ms}ms (should be < 500ms)`);
        }
    }

    console.log('\nBenchmark complete!');
}

main().catch(console.error);
