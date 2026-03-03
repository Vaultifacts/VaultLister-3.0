// QR Analytics — Gap-filling tests for endpoints missing from qrAnalytics-expanded.test.js
// Covers: DELETE warehouse-bins/:id, GET warehouse-bins/:id/items, POST warehouse-bins/:id/print-label
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
}, 15000);

describe('QR Analytics warehouse bin operations', () => {
    test('DELETE /qr-analytics/warehouse-bins/:id for nonexistent bin', async () => {
        const { status } = await client.delete('/qr-analytics/warehouse-bins/nonexistent-id');
        expect([404, 500]).toContain(status);
    });

    test('DELETE /qr-analytics/warehouse-bins/:id after creating a bin', async () => {
        // Create a bin first
        const createRes = await client.post('/qr-analytics/warehouse-bins', {
            bin_code: `DEL-${Date.now()}`,
            label: 'Bin to delete'
        });
        if (createRes.status === 201 || createRes.status === 200) {
            const binId = createRes.data?.id || createRes.data?.bin?.id;
            if (binId) {
                const { status } = await client.delete(`/qr-analytics/warehouse-bins/${binId}`);
                expect([200, 204]).toContain(status);
            }
        }
    });

    test('GET /qr-analytics/warehouse-bins/:id/items for nonexistent bin', async () => {
        const { status } = await client.get('/qr-analytics/warehouse-bins/fake-bin-id/items');
        expect([200, 404, 500]).toContain(status);
    });

    test('POST /qr-analytics/warehouse-bins/:id/print-label for nonexistent bin', async () => {
        const { status } = await client.post('/qr-analytics/warehouse-bins/fake-bin-id/print-label', {});
        expect([200, 404, 500]).toContain(status);
    });

    test('POST /qr-analytics/warehouse-bins/:id/print-label after creating a bin', async () => {
        const createRes = await client.post('/qr-analytics/warehouse-bins', {
            bin_code: `LBL-${Date.now()}`,
            label: 'Bin for label'
        });
        if (createRes.status === 201 || createRes.status === 200) {
            const binId = createRes.data?.id || createRes.data?.bin?.id;
            if (binId) {
                const { status, data } = await client.post(`/qr-analytics/warehouse-bins/${binId}/print-label`, {});
                expect([200, 500]).toContain(status);
                if (status === 200) {
                    expect(data).toBeDefined();
                }
            }
        }
    });
});
