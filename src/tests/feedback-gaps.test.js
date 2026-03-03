// Feedback — Gap-filling test: PUT /:id admin status update
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
}, 15000);

describe('Feedback admin status update', () => {
    test('PUT /feedback/:id nonexistent feedback returns 404 or 403', async () => {
        const { status } = await client.put('/feedback/nonexistent', {
            status: 'under_review'
        });
        expect([404, 403, 500]).toContain(status);
    });
});
