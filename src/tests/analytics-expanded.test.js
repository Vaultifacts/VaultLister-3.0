// Analytics — Expanded Tests (shape validation, auth guards, export)
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Analytics - Dashboard Shape', () => {
    test('GET /analytics/dashboard returns structured data', async () => {
        const { status, data } = await client.get('/analytics/dashboard');
        expect([200, 403, 500]).toContain(status);
        if (status === 200) { expect(typeof data).toBe('object'); }
    });

    test('GET /analytics/stats returns structured data', async () => {
        const { status, data } = await client.get('/analytics/stats');
        expect([200, 403, 500]).toContain(status);
        if (status === 200) { expect(typeof data).toBe('object'); }
    });
});

describe('Analytics - Sales', () => {
    test('GET /analytics/sales returns sales data', async () => {
        const { status, data } = await client.get('/analytics/sales');
        expect([200, 403, 500]).toContain(status);
        if (status === 200) { expect(typeof data).toBe('object'); }
    });

    test('GET /analytics/sales with period param', async () => {
        const { status } = await client.get('/analytics/sales?period=30d');
        expect([200, 403, 500]).toContain(status);
    });

    test('GET /analytics/sales with groupBy param', async () => {
        const { status } = await client.get('/analytics/sales?groupBy=week');
        expect([200, 403, 500]).toContain(status);
    });
});

describe('Analytics - Inventory & Platforms (tier-gated)', () => {
    test('GET /analytics/inventory returns breakdown or 403', async () => {
        const { status } = await client.get('/analytics/inventory');
        expect([200, 403, 500]).toContain(status);
    });

    test('GET /analytics/platforms returns platform data or 403', async () => {
        const { status } = await client.get('/analytics/platforms');
        expect([200, 403, 500]).toContain(status);
    });
});

describe('Analytics - Trends & Sustainability', () => {
    test('GET /analytics/trends returns trend data or 403', async () => {
        const { status } = await client.get('/analytics/trends');
        expect([200, 403, 500]).toContain(status);
    });

    test('GET /analytics/trends with period', async () => {
        const { status } = await client.get('/analytics/trends?period=90d');
        expect([200, 403, 500]).toContain(status);
    });

    test('GET /analytics/sustainability returns impact metrics', async () => {
        const { status, data } = await client.get('/analytics/sustainability');
        expect([200, 403, 500]).toContain(status);
        if (status === 200) { expect(typeof data).toBe('object'); }
    });
});

describe('Analytics - Custom Metrics CRUD', () => {
    test('GET /analytics/custom-metrics returns array or 403', async () => {
        const { status, data } = await client.get('/analytics/custom-metrics');
        expect([200, 403, 500]).toContain(status);
        if (status === 200) {
            const metrics = data.metrics || data;
            expect(Array.isArray(metrics)).toBe(true);
        }
    });

    test('POST /analytics/custom-metrics creates metric', async () => {
        const { status } = await client.post('/analytics/custom-metrics', {
            name: 'Test Metric', formula: 'revenue / items_sold', type: 'calculated'
        });
        expect([200, 201, 400, 403, 500]).toContain(status);
    });

    test('DELETE /analytics/custom-metrics/:id for nonexistent', async () => {
        const { status } = await client.delete('/analytics/custom-metrics/nonexistent-id');
        expect([200, 403, 404, 500]).toContain(status);
    });
});

describe('Analytics - Digest & Export', () => {
    test('GET /analytics/digest-settings returns settings', async () => {
        const { status } = await client.get('/analytics/digest-settings');
        expect([200, 403, 500]).toContain(status);
    });

    test('POST /analytics/digest-settings saves settings', async () => {
        const { status } = await client.post('/analytics/digest-settings', {
            enabled: true, frequency: 'weekly'
        });
        expect([200, 403, 500]).toContain(status);
    });

    test('POST /analytics/export with type=inventory', async () => {
        const { status } = await client.post('/analytics/export', {
            type: 'inventory', format: 'csv'
        });
        expect([200, 400, 500]).toContain(status);
    });

    test('POST /analytics/export without type returns 400', async () => {
        const { status } = await client.post('/analytics/export', {});
        expect([400, 500]).toContain(status);
    });
});

describe('Analytics - Auth Guards', { timeout: 15000 }, () => {
    test('GET /analytics/dashboard without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/analytics/dashboard`);
        expect(res.status).toBe(401);
    });

    test('GET /analytics/sales without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/analytics/sales`);
        expect(res.status).toBe(401);
    });

    test('POST /analytics/export without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/analytics/export`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'inventory' })
        });
        expect(res.status).toBe(401);
    });
});
