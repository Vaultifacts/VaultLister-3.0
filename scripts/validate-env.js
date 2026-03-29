#!/usr/bin/env node
// scripts/validate-env.js
// Validates that required environment variables are present before server startup.
// Run via: node scripts/validate-env.js
// Also used as a postinstall guard to surface missing .env early.
//
// This is a lightweight pre-flight check. Full schema validation (with Zod) is
// performed at runtime by src/backend/env.js when the server starts.

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Required vars ─────────────────────────────────────────────────────────────
// These MUST be present before the server can start.
const REQUIRED_VARS = [
    'JWT_SECRET',
    'DATABASE_URL',
];

// ── Production-only required vars ─────────────────────────────────────────────
const REQUIRED_IN_PROD = [
    'OAUTH_ENCRYPTION_KEY',
    'REDIS_URL',
];

// ── .env existence check ──────────────────────────────────────────────────────
const envPath = join(ROOT, '.env');

if (!existsSync(envPath)) {
    console.warn('\n[WARN] .env file not found.');
    console.warn('       Copy .env.example to .env and fill in required values:');
    console.warn('       cp .env.example .env\n');
    // Not a fatal error at install time — server startup will fail with a clear
    // message from src/backend/env.js if the file is still missing then.
    process.exit(0);
}

// ── Parse .env file ───────────────────────────────────────────────────────────
function parseEnvFile(filePath) {
    const lines = readFileSync(filePath, 'utf8').split('\n');
    const vars = new Set();
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (key && value) vars.add(key);
    }
    return vars;
}

const definedVars = parseEnvFile(envPath);
const isProd = process.env.NODE_ENV === 'production' ||
    (definedVars.has('NODE_ENV') &&
     readFileSync(envPath, 'utf8').includes('NODE_ENV=production'));

// ── Check required vars ───────────────────────────────────────────────────────
const missing = [];

for (const key of REQUIRED_VARS) {
    if (!definedVars.has(key)) {
        missing.push(key);
    }
}

if (isProd) {
    for (const key of REQUIRED_IN_PROD) {
        if (!definedVars.has(key)) {
            missing.push(`${key} (required in production)`);
        }
    }
}

// ── Check for placeholder values ──────────────────────────────────────────────
const envContent = readFileSync(envPath, 'utf8');
const PLACEHOLDER_PATTERNS = [
    { key: 'JWT_SECRET', pattern: /JWT_SECRET=REPLACE_ME/i },
    { key: 'JWT_SECRET', pattern: /JWT_SECRET=your-super-secret/ },
    { key: 'JWT_SECRET', pattern: /JWT_SECRET=change-this/ },
];

const placeholderWarnings = [];
for (const { key, pattern } of PLACEHOLDER_PATTERNS) {
    if (pattern.test(envContent)) {
        placeholderWarnings.push(key);
    }
}

// ── Report ────────────────────────────────────────────────────────────────────
let exitCode = 0;

if (missing.length > 0) {
    console.error('\n[ERROR] Missing required environment variables in .env:\n');
    for (const v of missing) {
        console.error(`  • ${v}`);
    }
    console.error('\nSee .env.example for required values.\n');
    exitCode = 1;
}

if (placeholderWarnings.length > 0) {
    console.error('\n[ERROR] Placeholder values detected in .env — replace before running:\n');
    for (const k of placeholderWarnings) {
        console.error(`  • ${k} still contains a placeholder value`);
    }
    console.error('\nGenerate a secure value: openssl rand -base64 64\n');
    exitCode = 1;
}

if (exitCode === 0) {
    console.log('[OK] Environment validation passed — all required vars are present.');
}

process.exit(exitCode);
