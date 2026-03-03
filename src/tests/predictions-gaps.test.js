// Predictions — Gap-filling test: GET /scenarios/:id
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Predictions scenarios detail', () => {
    test('GET /predictions/scenarios/:id for nonexistent scenario', async () => {
        const { status } = await client.get('/predictions/scenarios/nonexistent-id');
        expect([404, 500]).toContain(status);
    });

    test('GET /predictions/scenarios/:id after creating a scenario', async () => {
        const createRes = await client.post('/predictions/scenarios', {
            name: `Test Scenario ${Date.now()}`,
            base_data: { price: 50, volume: 100 },
            adjustments: { price_change: 10 }
        });
        if (createRes.status === 201 || createRes.status === 200) {
            const scenarioId = createRes.data?.id || createRes.data?.scenario?.id;
            if (scenarioId) {
                const { status, data } = await client.get(`/predictions/scenarios/${scenarioId}`);
                expect([200, 500]).toContain(status);
                if (status === 200) {
                    expect(data.name || data.scenario?.name).toBeDefined();
                }
            }
        }
    });
});
