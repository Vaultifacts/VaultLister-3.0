// Orders — Gap-filling tests for 9 untested endpoints
// Covers: deliver, DELETE, return POST+PATCH, sync-all, sync/:platform, priority, split, shipments
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
}, 15000);

describe('Orders deliver', () => {
    test('POST /orders/:id/deliver nonexistent order', async () => {
        const { status } = await client.post('/orders/nonexistent/deliver', {});
        expect([404]).toContain(status);
    });
});

describe('Orders delete', () => {
    test('DELETE /orders/:id nonexistent order', async () => {
        const { status } = await client.delete('/orders/nonexistent');
        expect([404]).toContain(status);
    });
});

describe('Orders return', () => {
    test('POST /orders/:id/return nonexistent order', async () => {
        const { status } = await client.post('/orders/nonexistent/return', {
            return_reason: 'Item not as described'
        });
        expect([404]).toContain(status);
    });

    test('PATCH /orders/:id/return nonexistent order', async () => {
        const { status } = await client.request('/orders/nonexistent/return', {
            method: 'PATCH',
            body: JSON.stringify({ return_status: 'approved' })
        });
        expect([404]).toContain(status);
    });
});

describe('Orders sync', () => {
    test('POST /orders/sync-all triggers sync for all platforms', async () => {
        const { status } = await client.post('/orders/sync-all', {});
        expect([200, 202]).toContain(status);
    });

    test('POST /orders/sync/:platform triggers platform sync', async () => {
        const { status } = await client.post('/orders/sync/ebay', {});
        expect([200, 202, 400]).toContain(status); // 400 when platform not configured
    });
});

describe('Orders priority', () => {
    test('PATCH /orders/:id/priority nonexistent order', async () => {
        const { status } = await client.request('/orders/nonexistent/priority', {
            method: 'PATCH',
            body: JSON.stringify({ priority: 'high' })
        });
        expect([404]).toContain(status);
    });
});

describe('Orders split shipment', () => {
    test('POST /orders/:id/split nonexistent order', async () => {
        const { status } = await client.post('/orders/nonexistent/split', {
            shipment_count: 2
        });
        expect([404]).toContain(status);
    });
});

describe('Orders shipments', () => {
    test('GET /orders/:id/shipments nonexistent order', async () => {
        const { status } = await client.get('/orders/nonexistent/shipments');
        expect([200, 404]).toContain(status);
    });
});
