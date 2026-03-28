#!/usr/bin/env bun
// scripts/preflight.js
// Pre-startup validation: required env vars, DB connectivity, Redis, Bun version.
// Exit code 0 = all checks passed (or non-fatal warnings only).
// Exit code 1 = one or more critical checks failed.

import postgres from 'postgres';

const MIN_BUN_MAJOR = 1;
const MIN_BUN_MINOR = 3;

let failures = 0;
let warnings = 0;

function pass(label) {
    console.log(`  [PASS] ${label}`);
}

function warn(label, detail) {
    warnings++;
    console.warn(`  [WARN] ${label}${detail ? `: ${detail}` : ''}`);
}

function fail(label, detail) {
    failures++;
    console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
}

// ── 1. Bun version ────────────────────────────────────────────────────────────
console.log('\nPreflight checks starting...\n');
console.log('── Runtime ──────────────────────────────────────────');
try {
    const bunVersion = Bun.version;
    const [major, minor] = bunVersion.split('.').map(Number);
    if (major > MIN_BUN_MAJOR || (major === MIN_BUN_MAJOR && minor >= MIN_BUN_MINOR)) {
        pass(`Bun version ${bunVersion} (>= ${MIN_BUN_MAJOR}.${MIN_BUN_MINOR} required)`);
    } else {
        fail(`Bun version ${bunVersion} is below minimum ${MIN_BUN_MAJOR}.${MIN_BUN_MINOR}`, 'Run: bun upgrade');
    }
} catch (err) {
    fail('Could not determine Bun version', err.message);
}

// ── 2. Required env vars ──────────────────────────────────────────────────────
console.log('\n── Environment variables ────────────────────────────');
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'PORT'];
for (const key of REQUIRED) {
    const val = process.env[key];
    if (!val || !val.trim()) {
        fail(`${key} is not set`);
    } else if (key === 'JWT_SECRET' && val.includes('change-this')) {
        fail('JWT_SECRET contains the default placeholder — set a strong random value');
    } else {
        pass(`${key} is set`);
    }
}

// ── 3. Database reachability ──────────────────────────────────────────────────
console.log('\n── Database ─────────────────────────────────────────');
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
    let sql;
    try {
        sql = postgres(databaseUrl, {
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 1,
            connect_timeout: 5,
            idle_timeout: 5,
        });
        await sql`SELECT 1`;
        pass('PostgreSQL is reachable');
    } catch (err) {
        fail('PostgreSQL is not reachable', err.message);
    } finally {
        try { await sql?.end({ timeout: 2 }); } catch (_) {}
    }
} else {
    fail('DATABASE_URL is not set — cannot check database reachability');
}

// ── 4. Redis reachability (optional) ─────────────────────────────────────────
console.log('\n── Redis (optional) ─────────────────────────────────');
const redisUrl = process.env.REDIS_URL;
if (redisUrl && redisUrl.trim()) {
    try {
        const { createClient } = await import('redis');
        const client = createClient({ url: redisUrl, socket: { connectTimeout: 3000, commandTimeout: 3000 } });
        await client.connect();
        const pong = await client.ping();
        await client.disconnect();
        if (pong === 'PONG') {
            pass('Redis is reachable');
        } else {
            warn('Redis PING returned unexpected response', pong);
        }
    } catch (err) {
        warn('Redis is not reachable (in-memory fallback will be used)', err.message);
    }
} else {
    warn('REDIS_URL is not set — server will use in-memory fallback (not suitable for production)');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────');
if (failures === 0 && warnings === 0) {
    console.log('All preflight checks passed.\n');
} else if (failures === 0) {
    console.log(`Preflight complete: ${warnings} warning(s). Server may start but some features may be degraded.\n`);
} else {
    console.error(`Preflight failed: ${failures} critical error(s), ${warnings} warning(s). Resolve the errors above before starting the server.\n`);
    process.exit(1);
}
