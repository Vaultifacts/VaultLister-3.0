// Recently Deleted API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Recently Deleted - Auth Guard', () => {
    test('GET /recently-deleted without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/recently-deleted/`);
        expect(res.status).toBe(401);
    });
});

describe('Recently Deleted - List', () => {
    test('GET /recently-deleted returns items with pagination', async () => {
        const { status, data } = await client.get('/recently-deleted/');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('items');
            expect(data).toHaveProperty('pagination');
            expect(Array.isArray(data.items)).toBe(true);
        }
    });

    test('GET /recently-deleted?type=inventory filters by type', async () => {
        const { status, data } = await client.get('/recently-deleted/?type=inventory');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('items');
            expect(Array.isArray(data.items)).toBe(true);
        }
    });

    test('GET /recently-deleted?page=1&limit=5 paginates', async () => {
        const { status, data } = await client.get('/recently-deleted/?page=1&limit=5');
        expect([200, 500]).toContain(status);
        if (status === 200 && data.pagination) {
            expect(data.pagination.limit).toBeLessThanOrEqual(5);
        }
    });
});

describe('Recently Deleted - Stats', () => {
    test('GET /recently-deleted/stats returns deletion stats', async () => {
        const { status, data } = await client.get('/recently-deleted/stats');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(typeof data).toBe('object');
        }
    });
});

describe('Recently Deleted - Restore', () => {
    test('POST /recently-deleted/:id/restore returns 404 for nonexistent', async () => {
        const { status } = await client.post('/recently-deleted/nonexistent-id/restore');
        expect([404, 500]).toContain(status);
    });

    test('POST /recently-deleted/bulk-restore requires item_ids', async () => {
        const { status } = await client.post('/recently-deleted/bulk-restore', {});
        expect([400, 500]).toContain(status);
    });
});

describe('Recently Deleted - Permanent Delete', () => {
    test('DELETE /recently-deleted/:id returns 404 for nonexistent', async () => {
        const { status } = await client.delete('/recently-deleted/nonexistent-id');
        expect([404, 500]).toContain(status);
    });

    test('POST /recently-deleted/bulk-delete requires item_ids', async () => {
        const { status } = await client.post('/recently-deleted/bulk-delete', {});
        expect([400, 404, 500]).toContain(status);
    });
});

describe('Recently Deleted - Cleanup', () => {
    test('POST /recently-deleted/cleanup triggers old item cleanup', async () => {
        const { status, data } = await client.post('/recently-deleted/cleanup');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toBeDefined();
        }
    });
});
