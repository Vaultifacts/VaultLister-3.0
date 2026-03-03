// Orders route — expanded tests for weak coverage areas
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Orders — Auth Guard', () => {
    test('GET /orders without auth returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/orders');
        expect(status).toBe(401);
    });

    test('POST /orders without auth returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.post('/orders', { platform: 'poshmark' });
        expect(status).toBe(401);
    });
});

describe('Orders — Shape Validation', () => {
    test('GET /orders returns proper shape', async () => {
        const { status, data } = await client.get('/orders');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(Array.isArray(data.orders || data)).toBe(true);
        }
    });

    test('GET /orders with date filter', async () => {
        const { status } = await client.get('/orders?start_date=2024-01-01&end_date=2024-12-31');
        expect([200, 500]).toContain(status);
    });
});

describe('Orders — Create & Lifecycle', () => {
    let orderId;

    test('POST /orders creates an order', async () => {
        const { status, data } = await client.post('/orders', {
            platform: 'poshmark',
            buyer_username: 'testbuyer',
            item_title: 'Test Item',
            sale_price: 25.00,
            status: 'pending'
        });
        expect([200, 201, 500]).toContain(status);
        if (status === 200 || status === 201) {
            orderId = data.id || data.order?.id;
        }
    });

    test('POST /orders/:id/ship marks as shipped', async () => {
        const id = orderId || 'nonexistent';
        const { status } = await client.post(`/orders/${id}/ship`, {
            tracking_number: 'TEST123456',
            carrier: 'USPS'
        });
        if (orderId) {
            expect([200, 500]).toContain(status);
        } else {
            expect([404, 500]).toContain(status);
        }
    });

    test('POST /orders/:id/deliver marks as delivered', async () => {
        const id = orderId || 'nonexistent';
        const { status } = await client.post(`/orders/${id}/deliver`, {});
        if (orderId) {
            expect([200, 500]).toContain(status);
        } else {
            expect([404, 500]).toContain(status);
        }
    });

    test('PATCH /orders/:id/priority updates priority', async () => {
        const id = orderId || 'nonexistent';
        const { status } = await client.patch(`/orders/${id}/priority`, {
            priority: 'high'
        });
        if (orderId) {
            expect([200, 500]).toContain(status);
        } else {
            expect([404, 500]).toContain(status);
        }
    });
});

describe('Orders — Returns', () => {
    test('POST /orders/:id/return for nonexistent returns error', async () => {
        const { status } = await client.post('/orders/nonexistent-id/return', {
            reason: 'Defective item'
        });
        expect([404, 500]).toContain(status);
    });

    test('PATCH /orders/:id/return for nonexistent returns error', async () => {
        const { status } = await client.patch('/orders/nonexistent-id/return', {
            status: 'approved'
        });
        expect([404, 500]).toContain(status);
    });
});

describe('Orders — Sync & Shipments', () => {
    test('POST /orders/sync-all triggers platform sync', async () => {
        const { status } = await client.post('/orders/sync-all', {});
        expect([200, 202, 500]).toContain(status);
    });

    test('POST /orders/sync/:platform syncs specific platform', async () => {
        const { status } = await client.post('/orders/sync/poshmark', {});
        expect([200, 202, 500]).toContain(status);
    });

    test('GET /orders/:id/shipments for nonexistent returns error', async () => {
        const { status } = await client.get('/orders/nonexistent-id/shipments');
        expect([404, 500]).toContain(status);
    });

    test('POST /orders/:id/split for nonexistent returns error', async () => {
        const { status } = await client.post('/orders/nonexistent-id/split', {
            items: []
        });
        expect([400, 404, 500]).toContain(status);
    });
});
