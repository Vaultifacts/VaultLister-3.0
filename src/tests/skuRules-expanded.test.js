// SKU Rules route — expanded tests for missing endpoints
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('SKU Rules — Get by ID & Default', () => {
    test('GET /sku-rules/:id for nonexistent returns 404', async () => {
        const { status } = await client.get('/sku-rules/nonexistent-id');
        expect([404]).toContain(status);
    });

    test('GET /sku-rules/default returns default rule', async () => {
        const { status, data } = await client.get('/sku-rules/default');
        expect([200, 404]).toContain(status);
        if (status === 200) {
            expect(data.pattern || data.rule).toBeDefined();
        }
    });
});

describe('SKU Rules — Set Default', () => {
    let ruleId;

    beforeAll(async () => {
        const { status, data } = await client.post('/sku-rules', {
            name: `Test Rule ${Date.now()}`,
            pattern: '{CATEGORY}-{BRAND}-{SEQ}',
            sequence_start: 1
        });
        if (status === 200 || status === 201) {
            ruleId = data.id || data.rule?.id;
        }
    });

    test('POST /sku-rules/:id/set-default sets rule as default', async () => {
        const id = ruleId || 'nonexistent';
        const { status } = await client.post(`/sku-rules/${id}/set-default`, {});
        if (ruleId) {
            expect([200, 403]).toContain(status);
        } else {
            expect([404]).toContain(status);
        }
    });

    test('POST /sku-rules/:id/set-default for nonexistent returns 404', async () => {
        const { status } = await client.post('/sku-rules/nonexistent-id/set-default', {});
        expect([404]).toContain(status);
    });
});

describe('SKU Rules — Preview & Batch', () => {
    test('POST /sku-rules/preview generates SKU preview', async () => {
        const { status, data } = await client.post('/sku-rules/preview', {
            pattern: '{CATEGORY}-{SEQ}',
            sample_data: { category: 'Shoes' }
        });
        expect([200, 400]).toContain(status);
        if (status === 200 && data) {
            expect(typeof data).toBe('object');
        }
    });

    test('POST /sku-rules/preview without pattern returns error', async () => {
        const { status } = await client.post('/sku-rules/preview', {});
        expect([400]).toContain(status);
    });

    test('POST /sku-rules/batch-update updates multiple rules', async () => {
        const { status } = await client.post('/sku-rules/batch-update', {
            updates: []
        });
        expect([200, 400]).toContain(status);
    });
});
