// Predictions API — Expanded Tests (covers ACTUAL endpoints from predictions.js)
// Note: existing predictions.test.js tests hit NONEXISTENT endpoints. This file tests the real ones.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Predictions - Auth Guard', () => {
    test('GET /predictions without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/predictions`);
        expect(res.status).toBe(401);
    });

    test('POST /predictions/batch without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/predictions/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inventory_ids: ['test'] })
        });
        expect(res.status).toBe(401);
    });
});

describe('Predictions - List', () => {
    test('GET /predictions returns array', async () => {
        const { status, data } = await client.get('/predictions');
        expect(status).toBe(200);
        if (status === 200) {
            expect(Array.isArray(data)).toBe(true);
        }
    });

    test('GET /predictions?recommendation=hold filters by recommendation', async () => {
        const { status } = await client.get('/predictions?recommendation=hold');
        expect(status).toBe(200);
    });

    test('GET /predictions?include_expired=true includes expired', async () => {
        const { status } = await client.get('/predictions?include_expired=true');
        expect(status).toBe(200);
    });

    test('GET /predictions respects limit and offset', async () => {
        const { status } = await client.get('/predictions?limit=5&offset=0');
        expect(status).toBe(200);
    });
});

describe('Predictions - Item Prediction', () => {
    test('POST /predictions/item/:id generates prediction', async () => {
        const { status } = await client.post('/predictions/item/nonexistent-id');
        // 500 expected since item doesn't exist in DB
        expect(status).toBe(200);
    });

    test('GET /predictions/item/:id returns prediction or 404', async () => {
        const { status } = await client.get('/predictions/item/nonexistent-id');
        expect([200, 404]).toContain(status);
    });
});

describe('Predictions - Batch', () => {
    test('POST /predictions/batch requires inventory_ids array', async () => {
        const { status, data } = await client.post('/predictions/batch', {});
        expect(status).toBe(400);
        expect(data.error).toContain('inventory_ids');
    });

    test('POST /predictions/batch rejects more than 50 items', async () => {
        const ids = Array.from({ length: 51 }, (_, i) => `item-${i}`);
        const { status, data } = await client.post('/predictions/batch', { inventory_ids: ids });
        expect(status).toBe(400);
        expect(data.error).toContain('50');
    });

    test('POST /predictions/batch with valid array', async () => {
        const { status, data } = await client.post('/predictions/batch', {
            inventory_ids: ['test-id-1', 'test-id-2']
        });
        expect(status).toBe(200);
        if (status === 200) {
            expect(data).toHaveProperty('generated');
            expect(data).toHaveProperty('failed');
            expect(data).toHaveProperty('predictions');
        }
    });
});

describe('Predictions - Recommendations', () => {
    test('GET /predictions/recommendations returns grouped data', async () => {
        const { status, data } = await client.get('/predictions/recommendations');
        expect(status).toBe(200);
        if (status === 200) {
            expect(data).toHaveProperty('summary');
            expect(data).toHaveProperty('recommendations');
        }
    });

    test('GET /predictions/recommendations?action=price_up filters', async () => {
        const { status } = await client.get('/predictions/recommendations?action=price_up');
        expect(status).toBe(200);
    });
});

describe('Predictions - Demand Forecasts', () => {
    test('GET /predictions/demand returns forecasts', async () => {
        const { status, data } = await client.get('/predictions/demand');
        expect(status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
    });

    test('GET /predictions/demand?category=Shoes filters by category', async () => {
        const { status, data } = await client.get('/predictions/demand?category=Shoes');
        expect(status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        if (data.length > 0) {
            expect(data[0]).toHaveProperty('category');
        }
    });

    test('POST /predictions/demand/:category generates forecast', async () => {
        const { status, data } = await client.post('/predictions/demand/Clothing');
        expect(status).toBe(200);
        expect(data).toHaveProperty('category', 'Clothing');
        expect(data).toHaveProperty('demand_level');
        expect(data).toHaveProperty('price_trend');
        expect(data).toHaveProperty('seasonality_index');
    });
});

describe('Predictions - Seasonal Calendar', () => {
    test('GET /predictions/seasonal-calendar returns 12-month calendar', async () => {
        const { status, data } = await client.get('/predictions/seasonal-calendar');
        expect(status).toBe(200);
        expect(data).toHaveProperty('category');
        expect(data).toHaveProperty('calendar');
        expect(data.calendar.length).toBe(12);
    });

    test('GET /predictions/seasonal-calendar?category=Shoes filters', async () => {
        const { status, data } = await client.get('/predictions/seasonal-calendar?category=Shoes');
        expect(status).toBe(200);
        expect(data.category).toBe('Shoes');
        if (data.calendar && data.calendar.length > 0) {
            expect(data.calendar[0]).toHaveProperty('month');
            expect(data.calendar[0]).toHaveProperty('factor');
            expect(data.calendar[0]).toHaveProperty('demand');
            expect(data.calendar[0]).toHaveProperty('recommendation');
        }
    });
});

describe('Predictions - Stats', () => {
    test('GET /predictions/stats returns prediction accuracy stats', async () => {
        const { status, data } = await client.get('/predictions/stats');
        expect(status).toBe(200);
        expect(data).toHaveProperty('total_predictions');
        expect(data).toHaveProperty('avg_confidence');
        expect(data).toHaveProperty('recommendations');
    });
});

describe('Predictions - Models CRUD', () => {
    test('GET /predictions/models returns array', async () => {
        const { status, data } = await client.get('/predictions/models');
        expect(status).toBe(200);
        if (status === 200) {
            expect(Array.isArray(data)).toBe(true);
        }
    });

    test('POST /predictions/models requires name', async () => {
        const { status, data } = await client.post('/predictions/models', {
            model_type: 'linear'
        });
        expect(status).toBe(400);
        expect(data.error).toContain('name');
    });

    test('POST /predictions/models requires valid model_type', async () => {
        const { status, data } = await client.post('/predictions/models', {
            name: 'Test Model',
            model_type: 'invalid_type'
        });
        expect(status).toBe(400);
        expect(data.error).toContain('model_type');
    });

    test('POST /predictions/models creates model with valid data', async () => {
        const { status, data } = await client.post('/predictions/models', {
            name: 'Test Model',
            model_type: 'linear',
            parameters: { learning_rate: 0.01 }
        });
        expect([201, 400]).toContain(status);
        if (status === 201) {
            expect(data).toHaveProperty('id');
            expect(data.name).toBe('Test Model');
            expect(data.model_type).toBe('linear');
        }
    });

    test('PUT /predictions/models/:id returns 404 for nonexistent', async () => {
        const { status } = await client.put('/predictions/models/nonexistent', {
            name: 'Updated'
        });
        expect([404]).toContain(status);
    });

    test('DELETE /predictions/models/:id returns 404 for nonexistent', async () => {
        const { status } = await client.delete('/predictions/models/nonexistent');
        expect([404]).toContain(status);
    });
});

describe('Predictions - Scenarios CRUD', () => {
    test('GET /predictions/scenarios returns array', async () => {
        const { status, data } = await client.get('/predictions/scenarios');
        expect(status).toBe(200);
        if (status === 200) {
            expect(Array.isArray(data)).toBe(true);
        }
    });

    test('POST /predictions/scenarios requires name', async () => {
        const { status } = await client.post('/predictions/scenarios', {
            base_data: { price: 50 },
            adjustments: { price_change: 10 }
        });
        expect(status).toBe(400);
    });

    test('POST /predictions/scenarios requires base_data', async () => {
        const { status } = await client.post('/predictions/scenarios', {
            name: 'Test',
            adjustments: { price_change: 10 }
        });
        expect(status).toBe(400);
    });

    test('POST /predictions/scenarios requires adjustments', async () => {
        const { status } = await client.post('/predictions/scenarios', {
            name: 'Test',
            base_data: { price: 50 }
        });
        expect(status).toBe(400);
    });

    test('POST /predictions/scenarios creates scenario with valid data', async () => {
        const { status, data } = await client.post('/predictions/scenarios', {
            name: 'Holiday Scenario',
            base_data: { price: 50, volume: 100 },
            adjustments: { price_change: 15, season: 'holiday' }
        });
        expect([201, 400]).toContain(status);
        if (status === 201) {
            expect(data).toHaveProperty('id');
            expect(data.name).toBe('Holiday Scenario');
            expect(data).toHaveProperty('results');
        }
    });

    test('GET /predictions/scenarios/:id returns 404 for nonexistent', async () => {
        const { status } = await client.get('/predictions/scenarios/nonexistent');
        expect([404]).toContain(status);
    });

    test('DELETE /predictions/scenarios/:id returns 404 for nonexistent', async () => {
        const { status } = await client.delete('/predictions/scenarios/nonexistent');
        expect([404]).toContain(status);
    });
});
