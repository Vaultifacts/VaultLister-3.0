// Search Analytics API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Search Analytics - Auth Guard', () => {
    test('POST /search-analytics/track without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/search-analytics/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term: 'test' })
        });
        expect(res.status).toBe(401);
    });

    test('GET /search-analytics/dashboard without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/search-analytics/dashboard`);
        expect(res.status).toBe(401);
    });
});

describe('Search Analytics - Track Search', () => {
    test('POST /search-analytics/track records search term', async () => {
        const { status, data } = await client.post('/search-analytics/track', {
            term: 'vintage denim jacket',
            results_found: 15
        });
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data.success).toBe(true);
            expect(typeof data.search_count).toBe('number');
        }
    });

    test('POST /search-analytics/track without term returns 400', async () => {
        const { status } = await client.post('/search-analytics/track', {
            results_found: 5
        });
        expect([400]).toContain(status);
    });

    test('POST /search-analytics/track with empty term returns 400', async () => {
        const { status } = await client.post('/search-analytics/track', {
            term: '   '
        });
        expect([400]).toContain(status);
    });

    test('POST /search-analytics/track with term over 500 chars returns 400', async () => {
        const { status } = await client.post('/search-analytics/track', {
            term: 'a'.repeat(501)
        });
        expect([400]).toContain(status);
    });

    test('POST /search-analytics/track increments existing term count', async () => {
        const term = `search-incr-${Date.now()}`;
        await client.post('/search-analytics/track', { term, results_found: 1 });
        const { status, data } = await client.post('/search-analytics/track', { term, results_found: 2 });
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data.search_count).toBeGreaterThanOrEqual(2);
        }
    });
});

describe('Search Analytics - Popular', () => {
    test('GET /search-analytics/popular returns popular searches', async () => {
        const { status, data } = await client.get('/search-analytics/popular');
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data).toHaveProperty('popular');
            expect(Array.isArray(data.popular)).toBe(true);
        }
    });

    test('GET /search-analytics/popular?limit=3 respects limit', async () => {
        const { status, data } = await client.get('/search-analytics/popular?limit=3');
        expect(status).toBe(200);
        if (status === 200 && data?.popular) {
            expect(data.popular.length).toBeLessThanOrEqual(3);
        }
    });
});

describe('Search Analytics - No Results', () => {
    test('GET /search-analytics/no-results returns zero-result searches', async () => {
        const { status, data } = await client.get('/search-analytics/no-results');
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data).toHaveProperty('no_results');
            expect(data).toHaveProperty('message');
        }
    });
});

describe('Search Analytics - Dashboard', () => {
    test('GET /search-analytics/dashboard returns aggregated stats', async () => {
        const { status, data } = await client.get('/search-analytics/dashboard');
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data).toHaveProperty('total_searches');
            expect(data).toHaveProperty('unique_terms');
            expect(data).toHaveProperty('top_searches');
            expect(typeof data.total_searches).toBe('number');
        }
    });
});
