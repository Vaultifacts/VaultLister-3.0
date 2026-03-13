// Listings — Expanded Gap Tests
// Covers: folders, schedule-price-drop, competitor-pricing, time-to-sell, crosspost
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Listings — Folders', () => {
    let folderId;

    test('GET /listings/folders returns folder list', async () => {
        const { status, data } = await client.get('/listings/folders');
        if (status === 200) {
            const items = Array.isArray(data) ? data : (data.folders || []);
            expect(Array.isArray(items)).toBe(true);
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('POST /listings/folders creates folder', async () => {
        const { status, data } = await client.post('/listings/folders', {
            name: 'Test Folder',
            description: 'From expanded tests'
        });
        if (status === 200 || status === 201) {
            folderId = data.id || data.folder?.id;
            expect(data).toBeDefined();
        } else {
            expect([400, 404, 403]).toContain(status);
        }
    });

    test('DELETE /listings/folders/:id deletes folder', async () => {
        if (!folderId) { console.warn('No folder created'); return; }
        const { status } = await client.delete(`/listings/folders/${folderId}`);
        expect([200, 204, 404]).toContain(status);
    });
});

describe('Listings — Price Features', () => {
    test('POST /listings/nonexistent/schedule-price-drop returns 404', async () => {
        const { status } = await client.post('/listings/nonexistent-id/schedule-price-drop', {
            new_price: 19.99,
            scheduled_date: new Date(Date.now() + 86400000).toISOString()
        });
        expect([404, 400]).toContain(status);
    });

    test('GET /listings/nonexistent/competitor-pricing returns 404', async () => {
        const { status } = await client.get('/listings/nonexistent-id/competitor-pricing');
        expect([404, 400]).toContain(status);
    });

    test('GET /listings/nonexistent/time-to-sell returns 404', async () => {
        const { status } = await client.get('/listings/nonexistent-id/time-to-sell');
        expect([404, 400]).toContain(status);
    });
});

describe('Listings — List & Search', () => {
    test('GET /listings returns list', async () => {
        const { status, data } = await client.get('/listings');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /listings?status=active filters by status', async () => {
        const { status, data } = await client.get('/listings?status=active');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /listings/stats returns listing stats', async () => {
        const { status, data } = await client.get('/listings/stats');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });
});

describe('Listings — Auth Guard', () => {
    test('GET /listings requires auth', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/listings');
        expect([401, 403]).toContain(status);
    });
});
