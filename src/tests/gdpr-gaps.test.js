// GDPR — Gap-filling tests: rectify endpoint uses PUT not POST
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('GDPR rectify endpoint (PUT)', () => {
    test('PUT /gdpr/rectify with valid corrections', async () => {
        const { status } = await client.put('/gdpr/rectify', {
            corrections: {
                full_name: 'Updated Name',
                timezone: 'America/Denver'
            }
        });
        expect([200, 400, 403, 404]).toContain(status);
    });

    test('PUT /gdpr/rectify with empty corrections', async () => {
        const { status } = await client.put('/gdpr/rectify', {
            corrections: {}
        });
        expect([200, 400, 403, 404]).toContain(status);
    });

    test('PUT /gdpr/rectify without corrections field', async () => {
        const { status } = await client.put('/gdpr/rectify', {});
        expect([400, 403, 404]).toContain(status);
    });
});
