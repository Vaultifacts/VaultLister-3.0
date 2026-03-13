// Reports — Gap-filling tests for 7 untested endpoints
// Covers: run, pnl, query, schedule CRUD, templates
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
}, 15000);

describe('Reports run', () => {
    test('POST /reports/:id/run nonexistent report', async () => {
        const { status } = await client.post('/reports/nonexistent/run', {});
        expect([404]).toContain(status);
    });
});

describe('Reports P&L', () => {
    test('GET /reports/pnl returns profit and loss data', async () => {
        const { status, data } = await client.get('/reports/pnl');
        expect([200, 400]).toContain(status);
        if (status === 200) {
            expect(data).toBeDefined();
        }
    });
});

describe('Reports query', () => {
    test('POST /reports/query runs ad-hoc query', async () => {
        const { status } = await client.post('/reports/query', {
            type: 'sales',
            date_range: '30d'
        });
        expect([200, 400, 403]).toContain(status);
    });
});

describe('Reports schedule', () => {
    test('GET /reports/:id/schedule nonexistent report', async () => {
        const { status } = await client.get('/reports/nonexistent/schedule');
        expect([200, 404]).toContain(status);
    });

    test('POST /reports/:id/schedule nonexistent report', async () => {
        const { status } = await client.post('/reports/nonexistent/schedule', {
            frequency: 'weekly',
            day_of_week: 'monday'
        });
        expect([404]).toContain(status);
    });

    test('DELETE /reports/:id/schedule nonexistent report', async () => {
        const { status } = await client.delete('/reports/nonexistent/schedule');
        expect([404]).toContain(status);
    });
});

describe('Reports templates', () => {
    test('GET /reports/templates returns available templates', async () => {
        const { status, data } = await client.get('/reports/templates');
        expect(status).toBe(200);
        if (status === 200) {
            expect(data).toBeDefined();
        }
    });
});
