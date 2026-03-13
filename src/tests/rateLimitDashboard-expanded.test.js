// Rate Limit Dashboard API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Rate Limit Dashboard - Auth Guard', () => {
    test('GET /rate-limits/stats without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/rate-limits/stats`);
        expect(res.status).toBe(401);
    });

    test('GET /rate-limits/alerts without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/rate-limits/alerts`);
        expect(res.status).toBe(401);
    });
});

describe('Rate Limit Dashboard - Stats', () => {
    test('GET /rate-limits/stats returns stats or 403', async () => {
        const { status, data } = await client.get('/rate-limits/stats');
        // 403 if not enterprise tier, 200 if allowed, 500 on DB error
        expect([200, 403]).toContain(status);
        if (status === 200 && data) {
            expect(data).toHaveProperty('totalRequests');
            expect(data).toHaveProperty('totalBlocked');
        }
    });
});

describe('Rate Limit Dashboard - Blocked IPs', () => {
    test('GET /rate-limits/blocked-ips returns list or 403', async () => {
        const { status, data } = await client.get('/rate-limits/blocked-ips');
        expect([200, 403]).toContain(status);
        if (status === 200 && data) {
            expect(data).toHaveProperty('blockedIps');
            expect(Array.isArray(data.blockedIps)).toBe(true);
        }
    });
});

describe('Rate Limit Dashboard - Blocked Users', () => {
    test('GET /rate-limits/blocked-users returns list or 403', async () => {
        const { status, data } = await client.get('/rate-limits/blocked-users');
        expect([200, 403]).toContain(status);
        if (status === 200 && data) {
            expect(data).toHaveProperty('blockedUsers');
            expect(Array.isArray(data.blockedUsers)).toBe(true);
        }
    });
});

describe('Rate Limit Dashboard - History', () => {
    test('GET /rate-limits/history returns history or 403', async () => {
        const { status, data } = await client.get('/rate-limits/history');
        expect([200, 403]).toContain(status);
    });

    test('GET /rate-limits/history?hours=1 with custom hours', async () => {
        const { status } = await client.get('/rate-limits/history?hours=1');
        expect([200, 403]).toContain(status);
    });
});

describe('Rate Limit Dashboard - Reset', () => {
    test('POST /rate-limits/reset without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/rate-limits/reset`, {
            method: 'POST'
        });
        expect(res.status).toBe(401);
    });

    test('POST /rate-limits/reset resets counters or 403', async () => {
        const { status, data } = await client.post('/rate-limits/reset', {});
        expect([200, 403]).toContain(status);
        if (status === 200 && data) {
            expect(data).toHaveProperty('message');
        }
    });
});

describe('Rate Limit Dashboard - Alerts', () => {
    test('GET /rate-limits/alerts returns alerts or 403', async () => {
        const { status, data } = await client.get('/rate-limits/alerts');
        expect([200, 403]).toContain(status);
        if (status === 200 && data) {
            expect(data).toHaveProperty('alerts');
            expect(Array.isArray(data.alerts)).toBe(true);
        }
    });
});
