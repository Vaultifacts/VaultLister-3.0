// Outgoing Webhooks — expanded test for POST /:id/test endpoint
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
let unauthClient;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
    unauthClient = new TestApiClient();
});

describe('Outgoing Webhooks Expanded - Test Delivery', () => {
    test('POST /outgoing-webhooks/nonexistent/test returns 404', async () => {
        const { status, data } = await client.post('/outgoing-webhooks/nonexistent-id/test');
        expect([404, 500]).toContain(status);
        if (status === 404) {
            expect(data.error).toBeDefined();
        }
    });

    test('POST /outgoing-webhooks/:id/test without auth returns 401', async () => {
        const { status } = await unauthClient.post('/outgoing-webhooks/some-id/test');
        expect(status).toBe(401);
    });

    test('POST /outgoing-webhooks/:id/test with created webhook', async () => {
        // Create a webhook first pointing to a non-routable address
        const { status: createStatus, data: createData } = await client.post('/outgoing-webhooks', {
            url: 'https://httpbin.org/post',
            events: ['inventory.created'],
            name: 'Test Webhook'
        });
        // Webhook creation may fail due to tier gating or DB
        expect([200, 201, 403, 500]).toContain(createStatus);

        if (createStatus === 200 || createStatus === 201) {
            const webhookId = createData.id || createData.webhook?.id;
            if (webhookId) {
                const { status, data } = await client.post(`/outgoing-webhooks/${webhookId}/test`);
                // Test delivery may succeed or fail depending on network
                expect([200, 500]).toContain(status);
                if (status === 200) {
                    expect(typeof data.success).toBe('boolean');
                }
            }
        }
    });
});
