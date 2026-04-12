// Monitoring — Expanded tests covering inline health/status endpoints
// plus the mounted, auth-protected /monitoring/* router behavior.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
}, 15000);

// ============================================================
// Public health check (inline in server.js, no auth required)
// ============================================================
describe('Public health check', () => {
    test('GET /health without auth returns 200', async () => {
        const res = await fetch(`${BASE_URL}/health`);
        expect(res.status).toBe(200);
    });

    test('GET /health includes status, timestamp, version', async () => {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        expect(data.status).toBe('healthy');
        expect(data.timestamp).toBeDefined();
        expect(data.version).toBeDefined();
    });

    test('GET /health includes database status', async () => {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        expect(data.database).toBeDefined();
        expect(data.database.status).toBeDefined();
    });
});

// ============================================================
// Public status endpoint (inline in server.js, no auth required)
// ============================================================
describe('Public status', () => {
    test('GET /status returns 200 with ok', async () => {
        const res = await fetch(`${BASE_URL}/status`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('ok');
    });
});

// ============================================================
// Auth guard on /monitoring/* (mounted and protected in server.js)
// ============================================================
describe('Monitoring auth guard', () => {
    test('GET /monitoring/health/detailed without auth returns 401', async () => {
        const res = await fetch(`${BASE_URL}/monitoring/health/detailed`);
        expect(res.status).toBe(401);
    });

    test('GET /monitoring/metrics without auth returns 401', async () => {
        const res = await fetch(`${BASE_URL}/monitoring/metrics`);
        expect(res.status).toBe(401);
    });

    test('GET /monitoring/alerts without auth returns 401', async () => {
        const res = await fetch(`${BASE_URL}/monitoring/alerts`);
        expect(res.status).toBe(401);
    });
});

// ============================================================
// Authenticated /monitoring/* routes
// ============================================================
describe('Monitoring authenticated', () => {
    test('GET /monitoring/health with auth returns 200 or 503', async () => {
        const { status } = await client.get('/monitoring/health');
        expect([200, 503]).toContain(status);
    });

    test('GET /monitoring/metrics with auth returns 403 for non-admin user', async () => {
        const { status } = await client.get('/monitoring/metrics');
        expect(status).toBe(403);
    });

    test('GET /monitoring/errors with auth returns 403 for non-admin user', async () => {
        const { status } = await client.get('/monitoring/errors');
        expect(status).toBe(403);
    });

    test('GET /monitoring/alerts with auth returns 403 for non-admin user', async () => {
        const { status } = await client.get('/monitoring/alerts');
        expect(status).toBe(403);
    });

    test('GET /monitoring/health/detailed with auth returns 404 because the detailed route lives at /api/health/detailed', async () => {
        const { status } = await client.get('/monitoring/health/detailed');
        expect(status).toBe(404);
    });
});
