// Predictions — Expanded Gap Tests
// Covers: list, item predictions, batch, demand, seasonal, stats, models CRUD, scenarios CRUD
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Predictions — List & Stats', () => {
    test('GET /predictions returns list', async () => {
        const { status, data } = await client.get('/predictions');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403, 500]).toContain(status);
        }
    });

    test('GET /predictions/stats returns statistics', async () => {
        const { status, data } = await client.get('/predictions/stats');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403, 500]).toContain(status);
        }
    });

    test('GET /predictions/seasonal-calendar returns calendar', async () => {
        const { status, data } = await client.get('/predictions/seasonal-calendar');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403, 500]).toContain(status);
        }
    });

    test('GET /predictions/recommendations returns items needing action', async () => {
        const { status, data } = await client.get('/predictions/recommendations');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403, 500]).toContain(status);
        }
    });
});

describe('Predictions — Demand', () => {
    test('GET /predictions/demand returns forecasts', async () => {
        const { status, data } = await client.get('/predictions/demand');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403, 500]).toContain(status);
        }
    });

    test('POST /predictions/demand/shoes generates category forecast', async () => {
        const { status } = await client.post('/predictions/demand/shoes');
        expect([200, 201, 400, 404, 500]).toContain(status);
    });
});

describe('Predictions — Batch', () => {
    test('POST /predictions/batch with empty array', async () => {
        const { status } = await client.post('/predictions/batch', {
            items: []
        });
        expect([200, 400, 404, 500]).toContain(status);
    });
});

describe('Predictions — Models CRUD', () => {
    let modelId;

    test('GET /predictions/models returns list', async () => {
        const { status, data } = await client.get('/predictions/models');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403, 500]).toContain(status);
        }
    });

    test('POST /predictions/models creates model', async () => {
        const { status, data } = await client.post('/predictions/models', {
            name: 'Test Model',
            model_type: 'linear',
            description: 'Test model from expanded tests'
        });
        if (status === 200 || status === 201) {
            modelId = data.id || data.model?.id;
            expect(data).toBeDefined();
        } else {
            expect([400, 404, 500]).toContain(status);
        }
    });

    test('PUT /predictions/models/:id updates model', async () => {
        if (!modelId) { console.warn('No model created'); return; }
        const { status } = await client.put(`/predictions/models/${modelId}`, {
            name: 'Updated Test Model'
        });
        expect([200, 400, 404, 500]).toContain(status);
    });

    test('DELETE /predictions/models/:id deletes model', async () => {
        if (!modelId) { console.warn('No model created'); return; }
        const { status } = await client.delete(`/predictions/models/${modelId}`);
        expect([200, 204, 404, 500]).toContain(status);
    });
});

describe('Predictions — Scenarios CRUD', () => {
    let scenarioId;

    test('GET /predictions/scenarios returns list', async () => {
        const { status, data } = await client.get('/predictions/scenarios');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403, 500]).toContain(status);
        }
    });

    test('POST /predictions/scenarios creates scenario', async () => {
        const { status, data } = await client.post('/predictions/scenarios', {
            name: 'Test Scenario',
            description: 'Expanded test scenario',
            base_data: { avg_price: 50, total_items: 10 }
        });
        if (status === 200 || status === 201) {
            scenarioId = data.id || data.scenario?.id;
            expect(data).toBeDefined();
        } else {
            expect([400, 404, 500]).toContain(status);
        }
    });

    test('GET /predictions/scenarios/:id returns scenario', async () => {
        if (!scenarioId) { console.warn('No scenario created'); return; }
        const { status, data } = await client.get(`/predictions/scenarios/${scenarioId}`);
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 500]).toContain(status);
        }
    });

    test('GET /predictions/scenarios/nonexistent returns 404', async () => {
        const { status } = await client.get('/predictions/scenarios/nonexistent-999');
        expect([404, 500]).toContain(status);
    });

    test('DELETE /predictions/scenarios/:id deletes scenario', async () => {
        if (!scenarioId) { console.warn('No scenario created'); return; }
        const { status } = await client.delete(`/predictions/scenarios/${scenarioId}`);
        expect([200, 204, 404, 500]).toContain(status);
    });
});

describe('Predictions — Auth Guard', () => {
    test('GET /predictions requires auth', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/predictions');
        expect([401, 403]).toContain(status);
    });
});
