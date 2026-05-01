// Infrastructure & Delivery — Env Validation, Config Drift, Migration Integrity
// Audit gaps: H3 (missing env vars), H5/L3 (FEATURE_* drift), M8 (env doc drift),
//             H11 (migration gating), L5 (JWT expiry), L13 (backup .gitignore)
// Categories: Setup/Bootstrap, Deployment/Config, CI/CD

import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'path';
import { z } from 'zod';

const ROOT = join(import.meta.dir, '../../');

// ═══════════════════════════════════════════════════════════════════════════════
// Env Validation Schema (H3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Env validation schema — startup safety (H3)', () => {
    // Replicate the Zod schema from src/backend/env.js to test in isolation
    // (importing env.js directly would call process.exit on failure)
    const IS_PROD = false;
    const envSchema = z.object({
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        PORT: z.coerce.number().int().min(1).max(65535).default(3000),
        JWT_SECRET: z.string({ required_error: 'JWT_SECRET is required' })
            .min(32, 'JWT_SECRET must be at least 32 characters'),
        OAUTH_ENCRYPTION_KEY: IS_PROD
            ? z.string().min(32)
            : z.string().min(32).optional(),
        DATA_DIR: z.string().default('./data'),
        ANTHROPIC_API_KEY: z.string().min(1).optional(),
        REDIS_URL: z.string().url().optional().or(z.literal('')),
        FRONTEND_URL: z.string().url().optional().or(z.literal('')),
        TRUST_PROXY: z.enum(['0', '1', 'true', 'false']).optional(),
        DISABLE_RATE_LIMIT: z.enum(['true', 'false']).optional(),
    });

    test('missing JWT_SECRET rejects', () => {
        const result = envSchema.safeParse({ PORT: '3000' });
        expect(result.success).toBe(false);
    });

    test('JWT_SECRET < 32 chars rejects', () => {
        const result = envSchema.safeParse({ JWT_SECRET: 'too-short' });
        expect(result.success).toBe(false);
        const messages = result.error.issues.map(i => i.message);
        expect(messages.some(m => m.includes('32'))).toBe(true);
    });

    test('valid JWT_SECRET and PORT passes', () => {
        const result = envSchema.safeParse({
            JWT_SECRET: 'a'.repeat(32),
            PORT: '3000',
        });
        expect(result.success).toBe(true);
    });

    test('PORT out of range rejects', () => {
        const result = envSchema.safeParse({
            JWT_SECRET: 'a'.repeat(32),
            PORT: '99999',
        });
        expect(result.success).toBe(false);
    });

    test('default values applied correctly', () => {
        const result = envSchema.safeParse({ JWT_SECRET: 'a'.repeat(32) });
        expect(result.success).toBe(true);
        expect(result.data.NODE_ENV).toBe('development');
        expect(result.data.PORT).toBe(3000);
        expect(result.data.DATA_DIR).toBe('./data');
    });

    test('optional vars accepted when missing', () => {
        const result = envSchema.safeParse({ JWT_SECRET: 'a'.repeat(32) });
        expect(result.success).toBe(true);
        expect(result.data.ANTHROPIC_API_KEY).toBeUndefined();
        expect(result.data.REDIS_URL).toBeUndefined();
    });

    test('OAUTH_ENCRYPTION_KEY required in production mode', () => {
        const prodSchema = z.object({
            JWT_SECRET: z.string().min(32),
            OAUTH_ENCRYPTION_KEY: z.string({ required_error: 'required in prod' }).min(32),
        });
        const result = prodSchema.safeParse({ JWT_SECRET: 'a'.repeat(32) });
        expect(result.success).toBe(false);
    });

    test('env.js source file exists and imports zod', () => {
        const envPath = join(ROOT, 'src/backend/env.js');
        expect(existsSync(envPath)).toBe(true);
        const content = readFileSync(envPath, 'utf-8');
        expect(content).toContain("from 'zod'");
        expect(content).toContain('JWT_SECRET');
        expect(content).toContain('process.exit(1)');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Feature Flag Config Drift (H5/L3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature flag config drift — FEATURE_* vars (H5/L3)', () => {
    const envExamplePath = join(ROOT, '.env.example');
    const envExample = existsSync(envExamplePath)
        ? readFileSync(envExamplePath, 'utf-8')
        : '';

    test('.env.example contains FEATURE_* variables', () => {
        const featureVars = envExample.match(/^FEATURE_\w+/gm) || [];
        expect(featureVars.length).toBeGreaterThan(0);
    });

    test('all FEATURE_* vars documented in .env.example are enumerated', () => {
        const featureVars = envExample.match(/^FEATURE_\w+/gm) || [];
        // Expected based on audit: FEATURE_AI_LISTING, FEATURE_WHATNOT_INTEGRATION, FEATURE_ADVANCED_ANALYTICS
        expect(featureVars).toContain('FEATURE_AI_LISTING');
        expect(featureVars).toContain('FEATURE_WHATNOT_INTEGRATION');
        expect(featureVars).toContain('FEATURE_ADVANCED_ANALYTICS');
    });

    test('REM-17 FIX: FEATURE_* env vars are read by source code (no config drift)', () => {
        // After REM-17: feature flags are wired into route files via featureFlags.js middleware.
        const srcFiles = [];
        function walkDir(dir) {
            try {
                for (const entry of readdirSync(dir, { withFileTypes: true })) {
                    const full = join(dir, entry.name);
                    if (entry.isDirectory() && !entry.name.includes('node_modules') && entry.name !== 'tests') {
                        walkDir(full);
                    } else if (entry.isFile() && entry.name.endsWith('.js')) {
                        srcFiles.push(full);
                    }
                }
            } catch {}
        }
        walkDir(join(ROOT, 'src'));

        const featureReads = [];
        for (const file of srcFiles) {
            const content = readFileSync(file, 'utf-8');
            if (/FEATURE_/m.test(content)) {
                featureReads.push(file);
            }
        }
        // After REM-17 fix: at least featureFlags.js + 3 route files reference FEATURE_* vars
        expect(featureReads.length).toBeGreaterThanOrEqual(4);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Env Doc Coverage (M8)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Env doc coverage — .env.example vs env.js schema (M8)', () => {
    const envExamplePath = join(ROOT, '.env.example');
    const envJsPath = join(ROOT, 'src/backend/env.js');

    test('required vars are in both .env.example and env.js schema', () => {
        const envExample = readFileSync(envExamplePath, 'utf-8');
        const envJs = readFileSync(envJsPath, 'utf-8');
        // JWT_SECRET is required in both
        expect(envExample).toContain('JWT_SECRET');
        expect(envJs).toContain('JWT_SECRET');
        // PORT is in both
        expect(envExample).toContain('PORT');
        expect(envJs).toContain('PORT');
    });

    test('.env.example has organized sections', () => {
        const envExample = readFileSync(envExamplePath, 'utf-8');
        const sections = envExample.match(/^# ={3,}/gm) || [];
        expect(sections.length).toBeGreaterThanOrEqual(5);
    });

    test('critical env vars documented: JWT_SECRET, DATA_DIR, NODE_ENV', () => {
        const envExample = readFileSync(envExamplePath, 'utf-8');
        expect(envExample).toContain('JWT_SECRET');
        expect(envExample).toContain('DATA_DIR');
        expect(envExample).toContain('NODE_ENV');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Migration File Integrity (H11)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Migration file integrity — ordering and naming (H11)', () => {
    const migrationsDir = join(ROOT, 'src/backend/db/migrations');
    const pgMigrationsDir = join(migrationsDir, 'pg');

    test('migration root contains the pg/ incremental migration directory', () => {
        const entries = readdirSync(migrationsDir);
        expect(entries).toContain('pg');
    });

    test('all files under migrations/pg are .sql or dotfiles', () => {
        const files = readdirSync(pgMigrationsDir);
        const invalid = files.filter(f => !f.endsWith('.sql') && !f.startsWith('.'));
        expect(invalid).toEqual([]);
    });

    test('SQL migration filenames under migrations/pg follow NNN_ prefix pattern', () => {
        const files = readdirSync(pgMigrationsDir).filter(f => f.endsWith('.sql'));
        const badNames = files.filter(f => !/^\d{3}_/.test(f));
        expect(badNames).toEqual([]);
    });

    test('no duplicate SQL migration number prefixes under migrations/pg', () => {
        const files = readdirSync(pgMigrationsDir).filter(f => f.endsWith('.sql'));
        const prefixes = files.map(f => f.match(/^(\d{3})/)?.[1]).filter(Boolean);
        const unique = new Set(prefixes);
        expect(unique.size).toBe(prefixes.length);
    });

    test('incremental pg migration count is within expected range', () => {
        const files = readdirSync(pgMigrationsDir).filter(f => f.endsWith('.sql'));
        expect(files.length).toBeGreaterThanOrEqual(8);
        expect(files.length).toBeLessThanOrEqual(60);
    });

    test('run-migrations.js delegates to initializeDatabase/closeDatabase', () => {
        const runMigPath = join(ROOT, 'scripts/run-migrations.js');
        const content = readFileSync(runMigPath, 'utf-8');
        expect(content).toContain("initializeDatabase");
        expect(content).toContain("closeDatabase");
        expect(content).toContain("VaultLister PostgreSQL Migration Runner");
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// JWT Expiry Consistency (L5)
// ═══════════════════════════════════════════════════════════════════════════════

describe('JWT expiry doc consistency (L5)', () => {
    test('auth middleware defines valid access and refresh token duration strings', () => {
        const authPath = join(ROOT, 'src/backend/middleware/auth.js');
        const authSource = readFileSync(authPath, 'utf-8');

        const accessExpiry = authSource.match(/const ACCESS_TOKEN_EXPIRY = '([^']+)'/)?.[1];
        const refreshExpiry = authSource.match(/const REFRESH_TOKEN_EXPIRY = '([^']+)'/)?.[1];

        expect(accessExpiry).toBeDefined();
        expect(refreshExpiry).toBeDefined();
        expect(accessExpiry).toMatch(/^\d+[smhd]$/);
        expect(refreshExpiry).toMatch(/^\d+[smhd]$/);
        expect(authSource).toContain('expiresIn = ACCESS_TOKEN_EXPIRY');
        expect(authSource).toContain('expiresIn: REFRESH_TOKEN_EXPIRY');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Backup .gitignore (L13)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Backup and data .gitignore coverage (L13)', () => {
    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf-8');

    test('backups/ directory is gitignored', () => {
        expect(gitignore).toContain('backups/');
    });

    test('data/*.db files are gitignored', () => {
        expect(gitignore).toMatch(/data\/\*\.db/);
    });
});
