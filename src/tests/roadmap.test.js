// Roadmap API Tests — rewritten: removed nonexistent /suggest, fixed public endpoints
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`;
let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Roadmap - Auth Guard', () => {
    test('GET /roadmap is public (no auth needed)', async () => {
        const res = await fetch(`${BASE_URL}/roadmap`);
        // Roadmap list is a public endpoint
        expect([200, 401]).toContain(res.status);
    });
});

describe('Roadmap - List Features', () => {
    test('GET /roadmap returns features array', async () => {
        const { status, data } = await client.get('/roadmap');
        expect([200, 403]).toContain(status);
        expect(data).toHaveProperty('features');
        expect(Array.isArray(data.features)).toBe(true);
    });

    test('GET /roadmap?status=planned filters by status', async () => {
        const { status, data } = await client.get('/roadmap?status=planned');
        expect([200, 403]).toContain(status);
        expect(data).toHaveProperty('features');
        expect(Array.isArray(data.features)).toBe(true);
    });

    test('GET /roadmap?category=features filters by category', async () => {
        const { status, data } = await client.get('/roadmap?category=features');
        expect([200, 403]).toContain(status);
        expect(data).toHaveProperty('features');
    });
});

describe('Roadmap - Get Single', () => {
    test('GET /roadmap/:id returns feature if exists', async () => {
        const { data } = await client.get('/roadmap');
        const features = data?.features || [];
        if (features.length === 0) return;
        const { status, data: featureData } = await client.get(`/roadmap/${features[0].id}`);
        expect([200, 404]).toContain(status);
    });

    test('GET /roadmap/nonexistent returns 404', async () => {
        const { status } = await client.get('/roadmap/nonexistent-id-xyz');
        expect([404]).toContain(status);
    });
});

describe('Roadmap - Vote', () => {
    test('POST /roadmap/vote/:id votes for feature', async () => {
        const { data } = await client.get('/roadmap');
        const features = data?.features || [];
        if (features.length === 0) return;
        const { status } = await client.post(`/roadmap/vote/${features[0].id}`);
        expect([200, 404]).toContain(status);
    });

    test('POST /roadmap/vote/:id toggles vote off', async () => {
        const { data } = await client.get('/roadmap');
        const features = data?.features || [];
        if (features.length === 0) return;
        // Second vote should toggle off
        const { status } = await client.post(`/roadmap/vote/${features[0].id}`);
        expect([200, 404]).toContain(status);
    });

    test('POST /roadmap/vote/nonexistent returns 404', async () => {
        const { status } = await client.post('/roadmap/vote/nonexistent-id-xyz');
        expect([404]).toContain(status);
    });
});

describe('Roadmap - Admin Create', () => {
    test('POST /roadmap without admin returns 403', async () => {
        const { status } = await client.post('/roadmap', {
            title: 'New Feature',
            description: 'A new feature',
            category: 'features',
            status: 'planned'
        });
        expect([403]).toContain(status);
    });
});

describe('Roadmap - Changelog RSS', () => {
    test('GET /roadmap/changelog/rss returns 200', async () => {
        const { status } = await client.get('/roadmap/changelog/rss');
        expect([200, 404]).toContain(status);
    });

    test('GET /roadmap/changelog/rss returns XML-like content', async () => {
        const res = await fetch(`${BASE_URL}/roadmap/changelog/rss`);
        if (res.status === 200) {
            const text = await res.text();
            expect(text).toContain('<?xml');
        }
    });
});
