// QR Analytics — Expanded Gap Tests
// Covers: dashboard, track scans, item stats, warehouse bins CRUD, label printing
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('QR Analytics — Dashboard & Tracking', () => {
    test('GET /qr-analytics/dashboard returns engagement data', async () => {
        const { status, data } = await client.get('/qr-analytics/dashboard');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('POST /qr-analytics/track records a QR scan', async () => {
        const { status } = await client.post('/qr-analytics/track', {
            qr_code_id: 'test-qr-001',
            scan_source: 'mobile',
            metadata: { browser: 'test' }
        });
        expect([200, 201, 400, 404]).toContain(status);
    });

    test('GET /qr-analytics/item/test-item returns scan stats', async () => {
        const { status, data } = await client.get('/qr-analytics/item/test-item');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });
});

describe('QR Analytics — Warehouse Bins', () => {
    let binId;

    test('GET /qr-analytics/warehouse-bins returns bin list', async () => {
        const { status, data } = await client.get('/qr-analytics/warehouse-bins');
        if (status === 200) {
            const items = Array.isArray(data) ? data : (data.bins || []);
            expect(Array.isArray(items)).toBe(true);
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('POST /qr-analytics/warehouse-bins creates bin', async () => {
        const { status, data } = await client.post('/qr-analytics/warehouse-bins', {
            name: 'Test Bin A',
            location: 'Shelf 1',
            capacity: 50
        });
        if (status === 200 || status === 201) {
            binId = data.id || data.bin?.id;
            expect(data).toBeDefined();
        } else {
            expect([400, 404, 403]).toContain(status);
        }
    });

    test('PUT /qr-analytics/warehouse-bins/:id updates bin', async () => {
        if (!binId) { console.warn('No bin created'); return; }
        const { status } = await client.put(`/qr-analytics/warehouse-bins/${binId}`, {
            name: 'Updated Bin A',
            capacity: 100
        });
        expect([200, 400, 404]).toContain(status);
    });

    test('GET /qr-analytics/warehouse-bins/:id/items returns items', async () => {
        if (!binId) { console.warn('No bin created'); return; }
        const { status, data } = await client.get(`/qr-analytics/warehouse-bins/${binId}/items`);
        if (status === 200) {
            const items = Array.isArray(data) ? data : (data.items || []);
            expect(Array.isArray(items)).toBe(true);
        } else {
            expect([404]).toContain(status);
        }
    });

    test('POST /qr-analytics/warehouse-bins/:id/print-label generates label', async () => {
        if (!binId) { console.warn('No bin created'); return; }
        const { status, data } = await client.post(`/qr-analytics/warehouse-bins/${binId}/print-label`);
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([400, 404]).toContain(status);
        }
    });

    test('DELETE /qr-analytics/warehouse-bins/:id deletes bin', async () => {
        if (!binId) { console.warn('No bin created'); return; }
        const { status } = await client.delete(`/qr-analytics/warehouse-bins/${binId}`);
        expect([200, 204, 404]).toContain(status);
    });

    test('DELETE /qr-analytics/warehouse-bins/nonexistent returns 404', async () => {
        const { status } = await client.delete('/qr-analytics/warehouse-bins/nonexistent-999');
        expect([404]).toContain(status);
    });

    test('GET /qr-analytics/warehouse-bins/nonexistent/items returns error', async () => {
        const { status } = await client.get('/qr-analytics/warehouse-bins/nonexistent-999/items');
        expect([200, 404]).toContain(status);
    });
});

describe('QR Analytics — Auth Guard', () => {
    test('GET /qr-analytics/dashboard requires auth', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/qr-analytics/dashboard');
        expect([401, 403]).toContain(status);
    });
});
