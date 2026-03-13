// Notion — Gap-filling tests for endpoints missing from notion-expanded.test.js
// Covers: /setup/inventory, /setup/sales, /setup/notes
// Note: /databases and /databases/:id hang when Notion is not configured (network timeout)
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Notion setup endpoints', () => {
    test('POST /notion/setup/inventory responds', async () => {
        const { status } = await client.post('/notion/setup/inventory', {
            database_id: 'fake-notion-db-id'
        });
        // 400/500 expected — not connected to Notion
        expect([200, 400]).toContain(status);
    });

    test('POST /notion/setup/sales responds', async () => {
        const { status } = await client.post('/notion/setup/sales', {
            database_id: 'fake-notion-db-id'
        });
        expect([200, 400]).toContain(status);
    });

    test('POST /notion/setup/notes responds', async () => {
        const { status } = await client.post('/notion/setup/notes', {
            database_id: 'fake-notion-db-id'
        });
        expect([200, 400]).toContain(status);
    });

    test('POST /notion/setup/inventory without database_id or parent_page_id', async () => {
        const { status } = await client.post('/notion/setup/inventory', {});
        expect([400]).toContain(status);
    });
});
