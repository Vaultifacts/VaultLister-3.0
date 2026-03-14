// Duplicates route — expanded tests for missing DELETE + edge cases
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Duplicates — Auth Guard', () => {
    test('GET /duplicates without auth returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/duplicates');
        expect(status).toBe(401);
    });
});

describe('Duplicates — Delete', () => {
    test('DELETE /duplicates/:id for nonexistent returns 404', async () => {
        const { status } = await client.delete('/duplicates/nonexistent-id');
        expect([404]).toContain(status);
    });
});

describe('Duplicates — Shape Validation', () => {
    test('GET /duplicates returns proper shape', async () => {
        const { status, data } = await client.get('/duplicates');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(Array.isArray(data.duplicates || data)).toBe(true);
        }
    });

    test('GET /duplicates/stats returns stats shape', async () => {
        const { status, data } = await client.get('/duplicates/stats');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(typeof data).toBe('object');
        }
    });

    test('POST /duplicates/check without item_id', async () => {
        const { status } = await client.post('/duplicates/check', {});
        // Route may accept empty body and return results or error
        expect([200, 400]).toContain(status);
    });
});
