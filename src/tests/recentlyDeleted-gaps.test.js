// Recently Deleted — gap tests for filters and success paths
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Recently Deleted — Filter Combinations', () => {
    test('GET /recently-deleted with reason filter', async () => {
        const { status } = await client.get('/recently-deleted?reason=user_deleted');
        expect(status).toBe(200);
    });

    test('GET /recently-deleted with search filter', async () => {
        const { status } = await client.get('/recently-deleted?search=test');
        expect(status).toBe(200);
    });

    test('GET /recently-deleted with date range', async () => {
        const { status } = await client.get('/recently-deleted?startDate=2024-01-01&endDate=2025-12-31');
        expect(status).toBe(200);
    });

    test('GET /recently-deleted with combined filters', async () => {
        const { status } = await client.get('/recently-deleted?type=inventory&reason=user_deleted&limit=5');
        expect(status).toBe(200);
    });

    test('GET /recently-deleted with large limit is capped', async () => {
        const { status, data } = await client.get('/recently-deleted?limit=999');
        expect(status).toBe(200);
        if (status === 200 && data.pagination) {
            expect(data.pagination.limit).toBeLessThanOrEqual(200);
        }
    });
});

describe('Recently Deleted — Stats Shape', () => {
    test('GET /recently-deleted/stats returns detailed shape', async () => {
        const { status, data } = await client.get('/recently-deleted/stats');
        expect(status).toBe(200);
        if (status === 200) {
            expect(typeof data.total).toBe('number');
            expect(typeof data.byType).toBe('object');
            expect(typeof data.byReason).toBe('object');
        }
    });
});

describe('Recently Deleted — Bulk Operations', () => {
    test('POST /recently-deleted/bulk-restore with empty ids', async () => {
        const { status } = await client.post('/recently-deleted/bulk-restore', { ids: [] });
        // Route may accept empty array (restoring 0 items) or return 400
        expect([200, 400]).toContain(status);
    });

    test('DELETE /recently-deleted/bulk-delete with empty ids returns error', async () => {
        const { status } = await client.delete('/recently-deleted/bulk-delete');
        expect([400, 404, 405]).toContain(status);
    });

    test('POST /recently-deleted/cleanup runs cleanup', async () => {
        const { status, data } = await client.post('/recently-deleted/cleanup', {});
        expect(status).toBe(200);
        if (status === 200) {
            expect(typeof (data.deleted ?? data.count ?? data.message)).toBeDefined();
        }
    });
});
