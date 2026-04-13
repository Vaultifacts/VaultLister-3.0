#!/usr/bin/env node
// scripts/preflight-check.js
// Runtime environment preflight check — validates Bun version, env vars,
// database/Redis connectivity, required directories, and port availability.
// Run via: bun scripts/preflight-check.js
// Exits with code 1 if any hard requirement fails.

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let failed = false;
let warnings = 0;

function pass(msg) { console.log(`  \u2713 ${msg}`); }
function warn(msg) { console.warn(`  \u26a0  ${msg}`); warnings++; }
function fail(msg) { console.error(`  \u2717 ${msg}`); failed = true; }

// ── 1. Bun version ────────────────────────────────────────────────────────────
console.log('\n[Preflight] Checking Bun version...');
const bunVersion = typeof Bun !== 'undefined' ? Bun.version : process.versions.bun;
if (!bunVersion) {
    fail('Bun runtime not detected — run this script with `bun`, not `node`');
} else {
    const [major, minor] = bunVersion.split('.').map(Number);
    if (major > 1 || (major === 1 && minor >= 3)) {
        pass(`Bun ${bunVersion} (>= 1.3)`);
    } else {
        fail(`Bun ${bunVersion} is too old — requires >= 1.3`);
    }
}

// ── 2. Required env vars ─────────────────────────────────────────────────────
console.log('\n[Preflight] Checking environment variables...');
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];
const RECOMMENDED = ['SESSION_SECRET', 'REDIS_URL', 'ANTHROPIC_API_KEY', 'RESEND_API_KEY'];

for (const key of REQUIRED) {
    const val = process.env[key];
    if (!val) {
        fail(`${key} is not set (required)`);
    } else if (val.trim().length < 8) {
        fail(`${key} is too short — use a strong value`);
    } else {
        pass(`${key} is set`);
    }
}
for (const key of RECOMMENDED) {
    if (!process.env[key]) warn(`${key} is not set (optional but recommended)`);
    else pass(`${key} is set`);
}

// ── 3. Required directories ──────────────────────────────────────────────────
console.log('\n[Preflight] Checking required directories...');
const DIRS = ['data', 'public/uploads', 'log'];
for (const dir of DIRS) {
    const fullPath = join(ROOT, dir);
    if (!existsSync(fullPath)) {
        try {
            mkdirSync(fullPath, { recursive: true });
            pass(`${dir}/ created`);
        } catch (e) {
            fail(`${dir}/ missing and could not be created: ${e.message}`);
        }
    } else {
        pass(`${dir}/ exists`);
    }
}

// ── 4. Port availability ─────────────────────────────────────────────────────
console.log('\n[Preflight] Checking port availability...');
const PORT = parseInt(process.env.PORT || '3000');
await new Promise((resolve) => {
    const tester = createServer();
    tester.once('error', (e) => {
        if (e.code === 'EADDRINUSE') warn(`Port ${PORT} is already in use — server may already be running`);
        else warn(`Port ${PORT} check failed: ${e.message}`);
        resolve();
    });
    tester.once('listening', () => {
        tester.close();
        pass(`Port ${PORT} is available`);
        resolve();
    });
    tester.listen(PORT, '127.0.0.1');
});

// ── 5. PostgreSQL connectivity ───────────────────────────────────────────────
console.log('\n[Preflight] Checking PostgreSQL connectivity...');
if (process.env.DATABASE_URL) {
    try {
        const { default: postgres } = await import('postgres');
        const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 5 });
        await sql`SELECT 1`;
        await sql.end();
        pass('PostgreSQL is reachable');
    } catch (e) {
        fail(`PostgreSQL connection failed: ${e.message}`);
    }
} else {
    warn('DATABASE_URL not set — skipping PostgreSQL check');
}

// ── 6. Redis connectivity ────────────────────────────────────────────────────
console.log('\n[Preflight] Checking Redis connectivity...');
if (process.env.REDIS_URL) {
    try {
        const { createClient } = await import('redis');
        const client = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 3000 } });
        await client.connect();
        await client.ping();
        await client.disconnect();
        pass('Redis is reachable');
    } catch (e) {
        warn(`Redis connection failed: ${e.message} — rate limiting will use in-memory fallback`);
    }
} else {
    warn('REDIS_URL not set — rate limiting will use in-memory fallback');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────');
if (failed) {
    console.error(`\n[Preflight] FAILED — fix the errors above before starting the server.\n`);
    process.exit(1);
} else if (warnings > 0) {
    console.warn(`\n[Preflight] PASSED with ${warnings} warning(s). See above for details.\n`);
} else {
    console.log('\n[Preflight] All checks passed.\n');
}
