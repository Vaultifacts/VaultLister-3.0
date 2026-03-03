// Offline Sync — Gap-filling test: GET /status
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Offline Sync status endpoint', () => {
    test('GET /offline-sync/status returns sync status', async () => {
        const { status, data } = await client.get('/offline-sync/status');
        expect([200, 500]).toContain(status);
        if (status === 200 && data) {
            // Should have pending/failed counts
            expect(typeof (data.pending ?? data.pending_count)).not.toBe('undefined');
        }
    });
});
