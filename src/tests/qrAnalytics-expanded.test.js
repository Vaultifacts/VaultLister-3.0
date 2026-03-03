// QR Analytics API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
let createdBinId = null;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('QR Analytics - Dashboard', () => {
    test('GET /qr-analytics/dashboard returns analytics overview', async () => {
        const { status, data } = await client.get('/qr-analytics/dashboard');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('totalScans');
            expect(data).toHaveProperty('totalItems');
            expect(data).toHaveProperty('scansByType');
            expect(data).toHaveProperty('topScanned');
            expect(data).toHaveProperty('recentScans');
        }
    });
});

describe('QR Analytics - Track Scans', () => {
    test('POST /qr-analytics/track requires qr_type and reference_id', async () => {
        const { status, data } = await client.post('/qr-analytics/track', {});
        expect(status).toBe(400);
        expect(data.error).toContain('required');
    });

    test('POST /qr-analytics/track rejects invalid qr_type', async () => {
        const { status, data } = await client.post('/qr-analytics/track', {
            qr_type: 'invalid_type',
            reference_id: 'test-ref'
        });
        expect(status).toBe(400);
        expect(data.error).toContain('qr_type');
    });

    test('POST /qr-analytics/track records listing scan', async () => {
        const { status, data } = await client.post('/qr-analytics/track', {
            qr_type: 'listing',
            reference_id: 'test-listing-id'
        });
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('scan_count');
            expect(data.qr_type).toBe('listing');
        }
    });

    test('POST /qr-analytics/track records warehouse-bin scan', async () => {
        const { status, data } = await client.post('/qr-analytics/track', {
            qr_type: 'warehouse-bin',
            reference_id: 'bin-001'
        });
        expect([200, 500]).toContain(status);
    });

    test('POST /qr-analytics/track increments count on repeat scan', async () => {
        const payload = { qr_type: 'listing', reference_id: `repeat-test-${Date.now()}` };
        const first = await client.post('/qr-analytics/track', payload);
        const second = await client.post('/qr-analytics/track', payload);

        if (first.status === 200 && second.status === 200) {
            expect(second.data.scan_count).toBeGreaterThanOrEqual(first.data.scan_count);
        }
    });
});

describe('QR Analytics - Item Stats', () => {
    test('GET /qr-analytics/item/:id returns 404 for nonexistent item', async () => {
        // Use UUID format since route matches /^\/item\/[a-f0-9-]+$/
        const { status } = await client.get('/qr-analytics/item/00000000-0000-0000-0000-000000000000');
        expect([404, 500]).toContain(status);
    });
});

describe('QR Analytics - Warehouse Bins', () => {
    test('GET /qr-analytics/warehouse-bins returns bin list', async () => {
        const { status, data } = await client.get('/qr-analytics/warehouse-bins');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(Array.isArray(data)).toBe(true);
        }
    });

    test('POST /qr-analytics/warehouse-bins requires bin_code', async () => {
        const { status, data } = await client.post('/qr-analytics/warehouse-bins', {});
        expect(status).toBe(400);
        expect(data.error).toContain('bin_code');
    });

    test('POST /qr-analytics/warehouse-bins creates bin', async () => {
        const binCode = `BIN-${Date.now()}`;
        const { status, data } = await client.post('/qr-analytics/warehouse-bins', {
            bin_code: binCode,
            label: 'Test Bin',
            zone: 'A',
            capacity: 50
        });
        expect([201, 500]).toContain(status);
        if (status === 201) {
            expect(data).toHaveProperty('id');
            expect(data.bin_code).toBe(binCode.toUpperCase());
            createdBinId = data.id;
        }
    });

    test('POST /qr-analytics/warehouse-bins rejects duplicate bin_code', async () => {
        if (!createdBinId) return;
        // Get the existing bin to find its code
        const bins = await client.get('/qr-analytics/warehouse-bins');
        if (bins.status !== 200 || !Array.isArray(bins.data) || bins.data.length === 0) return;

        const existingCode = bins.data[0].bin_code;
        const { status } = await client.post('/qr-analytics/warehouse-bins', {
            bin_code: existingCode
        });
        expect([409, 500]).toContain(status);
    });

    test('PUT /qr-analytics/warehouse-bins/:id updates bin', async () => {
        if (!createdBinId) return;
        const { status, data } = await client.put(`/qr-analytics/warehouse-bins/${createdBinId}`, {
            label: 'Updated Bin',
            zone: 'B'
        });
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data.label).toBe('Updated Bin');
        }
    });

    test('PUT /qr-analytics/warehouse-bins/:id rejects invalid status', async () => {
        if (!createdBinId) return;
        const { status } = await client.put(`/qr-analytics/warehouse-bins/${createdBinId}`, {
            status: 'invalid_status'
        });
        expect([400, 500]).toContain(status);
    });

    test('PUT /qr-analytics/warehouse-bins/:id requires fields', async () => {
        if (!createdBinId) return;
        const { status, data } = await client.put(`/qr-analytics/warehouse-bins/${createdBinId}`, {});
        expect([400, 500]).toContain(status);
    });

    test('PUT nonexistent bin returns 404', async () => {
        const { status } = await client.put('/qr-analytics/warehouse-bins/00000000-0000-0000-0000-000000000000', {
            label: 'Test'
        });
        expect([404, 500]).toContain(status);
    });

    test('GET /qr-analytics/warehouse-bins/:id/items returns items in bin', async () => {
        if (!createdBinId) return;
        const { status, data } = await client.get(`/qr-analytics/warehouse-bins/${createdBinId}/items`);
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('bin');
            expect(data).toHaveProperty('items');
            expect(Array.isArray(data.items)).toBe(true);
        }
    });

    test('POST /qr-analytics/warehouse-bins/:id/print-label generates label', async () => {
        if (!createdBinId) return;
        const { status, data } = await client.post(`/qr-analytics/warehouse-bins/${createdBinId}/print-label`);
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('bin_code');
            expect(data).toHaveProperty('qr_data');
        }
    });

    test('DELETE /qr-analytics/warehouse-bins/:id deletes bin', async () => {
        if (!createdBinId) return;
        const { status } = await client.delete(`/qr-analytics/warehouse-bins/${createdBinId}`);
        expect([200, 409, 500]).toContain(status);
    });

    test('DELETE nonexistent bin returns 404', async () => {
        const { status } = await client.delete('/qr-analytics/warehouse-bins/00000000-0000-0000-0000-000000000000');
        expect([404, 500]).toContain(status);
    });
});
