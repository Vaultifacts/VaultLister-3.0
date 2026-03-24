// src/backend/env.js
// Startup-time environment variable validation using Zod.
// Import this as the FIRST statement in server.js — before any other imports.
// The process exits immediately with a clear error list if any required var is
// missing or malformed, rather than crashing deep in application code.

import { z } from 'zod';

const IS_PROD = process.env.NODE_ENV === 'production';

const envSchema = z.object({
    // ── Runtime ──────────────────────────────────────────────────────────
    NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    // ── Security — always required ────────────────────────────────────────
    JWT_SECRET: z
        .string({ required_error: 'JWT_SECRET is required' })
        .min(32, 'JWT_SECRET must be at least 32 characters'),

    // ── Security — required in production only ───────────────────────────
    OAUTH_ENCRYPTION_KEY: IS_PROD
        ? z.string({ required_error: 'OAUTH_ENCRYPTION_KEY is required in production' })
              .min(32, 'OAUTH_ENCRYPTION_KEY must be at least 32 characters')
        : z.string().min(32, 'OAUTH_ENCRYPTION_KEY must be at least 32 characters').optional(),

    // ── Database ─────────────────────────────────────────────────────────
    DATA_DIR: z.string().default('./data'),

    // ── Optional — validated for shape when present ───────────────────────
    ANTHROPIC_API_KEY: z.string().min(1).optional().or(z.literal('')),
    REDIS_URL: z.string().url('REDIS_URL must be a valid URL').optional().or(z.literal('')),
    FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').optional().or(z.literal('')),
    TRUST_PROXY: z.enum(['0', '1', 'true', 'false']).optional(),
    DISABLE_RATE_LIMIT: z.enum(['true', 'false']).optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
    const issues = result.error.issues.map(issue => {
        const field = issue.path.join('.') || '(root)';
        return `  • ${field}: ${issue.message}`;
    });

    console.error('\n[FATAL] Invalid environment configuration. Fix the following before starting:\n');
    console.error(issues.join('\n'));
    console.error('\nSee .env.example for required values.\n');
    process.exit(1);
}

if (result.data.JWT_SECRET.includes('change-this') || result.data.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
    console.error('\n[FATAL] JWT_SECRET contains the default placeholder value. Set a strong random secret in .env before starting.\n');
    process.exit(1);
}

export const env = result.data;
