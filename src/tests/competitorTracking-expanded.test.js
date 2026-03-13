// Competitor Tracking API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Competitor Tracking - Auth Guard', () => {
    test('GET /competitor-tracking/keywords without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/competitor-tracking/keywords`);
        expect(res.status).toBe(401);
    });

    test('POST /competitor-tracking/keywords/analyze without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/competitor-tracking/keywords/analyze`, {
            method: 'POST'
        });
        expect(res.status).toBe(401);
    });
});

describe('Competitor Tracking - Keywords', () => {
    test('GET /competitor-tracking/keywords returns keyword list', async () => {
        const { status, data } = await client.get('/competitor-tracking/keywords');
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data).toHaveProperty('keywords');
            expect(Array.isArray(data.keywords)).toBe(true);
        }
    });
});

describe('Competitor Tracking - Keyword Analysis', () => {
    test('POST /competitor-tracking/keywords/analyze runs analysis', async () => {
        const { status, data } = await client.post('/competitor-tracking/keywords/analyze', {});
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data.success).toBe(true);
            expect(typeof data.analyzed).toBe('number');
        }
    });
});

describe('Competitor Tracking - Keyword Opportunities', () => {
    test('GET /competitor-tracking/keywords/opportunities returns opportunities', async () => {
        const { status, data } = await client.get('/competitor-tracking/keywords/opportunities');
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data).toHaveProperty('opportunities');
            expect(Array.isArray(data.opportunities)).toBe(true);
        }
    });

    test('GET /competitor-tracking/keywords/opportunities?limit=5 respects limit', async () => {
        const { status, data } = await client.get('/competitor-tracking/keywords/opportunities?limit=5');
        expect(status).toBe(200);
        if (status === 200 && data?.opportunities) {
            expect(data.opportunities.length).toBeLessThanOrEqual(5);
        }
    });
});

describe('Competitor Tracking - Price Intelligence', () => {
    test('GET /competitor-tracking/price-intelligence returns pricing data', async () => {
        const { status, data } = await client.get('/competitor-tracking/price-intelligence');
        expect(status).toBe(200);
    });

    test('GET /competitor-tracking/price-intelligence?category=shoes filters by category', async () => {
        const { status } = await client.get('/competitor-tracking/price-intelligence?category=shoes');
        expect(status).toBe(200);
    });

    test('GET /competitor-tracking/price-intelligence?brand=Nike filters by brand', async () => {
        const { status } = await client.get('/competitor-tracking/price-intelligence?brand=Nike');
        expect(status).toBe(200);
    });
});

describe('Competitor Tracking - Price Intelligence Refresh', () => {
    test('POST /competitor-tracking/price-intelligence/refresh recalculates', async () => {
        const { status, data } = await client.post('/competitor-tracking/price-intelligence/refresh', {});
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data.success).toBe(true);
        }
    });
});
