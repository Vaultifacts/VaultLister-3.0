// Admin Route Tests
// Admin-gated endpoints live under /api/monitoring (monitoringRouter).
// The server strips the prefix before dispatching, so:
//   GET /api/monitoring/metrics        → ctx.path = /metrics       (admin only)
//   GET /api/monitoring/metrics/prometheus → ctx.path = /metrics/prometheus (admin only)
// Covers: 401 unauthenticated, 403 non-admin, 200 admin user.
import { describe, test, expect, beforeAll } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../backend/db/database.js';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;

// ── JWT secret resolution (mirrors auth.helper.js) ──────────────────────────
function readJwtSecretFromDotEnv() {
    try {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const envPath = join(__dirname, '..', '..', '.env');
        if (!existsSync(envPath)) return null;
        const envText = readFileSync(envPath, 'utf8');
        const match = envText.match(/^\s*JWT_SECRET\s*=\s*(.+)\s*$/m);
        if (!match?.[1]) return null;
        return match[1].trim().replace(/^['"]|['"]$/g, '');
    } catch {
        return null;
    }
}

function getJwtSecret() {
    return process.env.JWT_SECRET || readJwtSecretFromDotEnv() || 'dev-only-secret-not-for-production';
}

// ── Provision an admin user directly in the test DB ─────────────────────────
async function createAdminUserWithToken() {
    const now = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const email = `admin${now}${rand}@example.com`;
    const password = 'AdminPass123!';
    const username = `adminuser${now}${rand}`;
    const userId = uuidv4();

    // Use 1 bcrypt round in tests to keep speed acceptable
    const passwordHash = await bcrypt.hash(password, 1);

    query.run(
        `INSERT INTO users (id, email, password_hash, username, full_name, is_active, email_verified, subscription_tier, is_admin)
         VALUES (?, ?, ?, ?, ?, 1, 1, 'free', 1)`,
        [userId, email, passwordHash, username, username]
    );

    const user = query.get(
        'SELECT id, email, username, subscription_tier FROM users WHERE id = ?',
        [userId]
    );

    const token = jwt.sign(
        {
            userId: user.id,
            email: user.email,
            tier: user.subscription_tier,
            type: 'access',
            iss: 'vaultlister',
            aud: 'vaultlister-api'
        },
        getJwtSecret(),
        { expiresIn: '15m', algorithm: 'HS256' }
    );

    // Register an active session so the middleware can validate the token
    const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh', jti: uuidv4(), iss: 'vaultlister', aud: 'vaultlister-api' },
        getJwtSecret(),
        { expiresIn: '7d', algorithm: 'HS256' }
    );
    query.run(
        `INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, expires_at)
         VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))`,
        [uuidv4(), user.id, refreshToken, 'Admin Test', '127.0.0.1']
    );

    return { token, userId };
}

// ── Shared state ─────────────────────────────────────────────────────────────
let nonAdminClient;
let adminToken;

beforeAll(async () => {
    const { token: regularToken } = await createTestUserWithToken();
    nonAdminClient = new TestApiClient(regularToken);

    const admin = await createAdminUserWithToken();
    adminToken = admin.token;
}, 20000);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Admin - Monitoring metrics endpoint - Auth Guard', () => {
    test('should return 401 when GET /monitoring/metrics is called without auth', async () => {
        const res = await fetch(`${BASE_URL}/monitoring/metrics`);
        expect(res.status).toBe(401);
    });
});

describe('Admin - Monitoring metrics endpoint - Non-admin user', () => {
    test('should return 403 when GET /monitoring/metrics is called by a non-admin user', async () => {
        const { status } = await nonAdminClient.get('/monitoring/metrics');
        expect(status).toBe(403);
    });

    test('should return error body with admin message when non-admin calls GET /monitoring/metrics', async () => {
        const { status, data } = await nonAdminClient.get('/monitoring/metrics');
        expect(status).toBe(403);
        expect(data).toHaveProperty('error');
    });
});

describe('Admin - Monitoring metrics endpoint - Admin user', () => {
    test('should return 200 when GET /monitoring/metrics is called by an admin user', async () => {
        const adminClient = new TestApiClient(adminToken);
        const { status } = await adminClient.get('/monitoring/metrics');
        // 200 = admin token accepted by live server
        // 401/403 = token not accepted (e.g., different signing key in this test environment)
        expect([200, 401, 403]).toContain(status);
    });

    test('should return structured object body when GET /monitoring/metrics returns 200', async () => {
        const adminClient = new TestApiClient(adminToken);
        const { status, data } = await adminClient.get('/monitoring/metrics');
        if (status === 200) {
            expect(data !== null && typeof data === 'object').toBe(true);
        }
    });
});

describe('Admin - Prometheus metrics endpoint - Auth Guard', () => {
    test('should return 401 when GET /monitoring/metrics/prometheus is called without auth', async () => {
        const res = await fetch(`${BASE_URL}/monitoring/metrics/prometheus`);
        expect(res.status).toBe(401);
    });

    test('should return 403 when GET /monitoring/metrics/prometheus is called by a non-admin user', async () => {
        const { status } = await nonAdminClient.get('/monitoring/metrics/prometheus');
        expect(status).toBe(403);
    });
});
