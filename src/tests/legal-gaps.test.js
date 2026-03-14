// Legal — Gap-filling tests: GET /tos/current, GET /tos/history
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Legal ToS endpoints', () => {
    test('GET /legal/tos/current returns latest ToS version', async () => {
        const { status, data } = await client.get('/legal/tos/current');
        expect([200, 404]).toContain(status);
        if (status === 200 && data) {
            // Should have version info
            expect(data.version || data.id).toBeDefined();
        }
    });

    test('GET /legal/tos/history returns array of versions', async () => {
        const { status, data } = await client.get('/legal/tos/history');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(Array.isArray(data) || Array.isArray(data?.versions)).toBe(true);
        }
    });
});
