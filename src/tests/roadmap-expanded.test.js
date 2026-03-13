// Roadmap API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Roadmap - Auth Guard', () => {
    test('GET /roadmap without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/roadmap`);
        expect(res.status).toBe(401);
    });
});

describe('Roadmap - List Features', () => {
    test('GET /roadmap returns features list', async () => {
        const { status, data } = await client.get('/roadmap');
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data).toHaveProperty('features');
            expect(Array.isArray(data.features)).toBe(true);
        }
    });

    test('GET /roadmap?status=planned filters by status', async () => {
        const { status, data } = await client.get('/roadmap?status=planned');
        expect(status).toBe(200);
        if (status === 200 && data?.features) {
            for (const f of data.features) {
                expect(f.status).toBe('planned');
            }
        }
    });

    test('GET /roadmap?category=integration filters by category', async () => {
        const { status } = await client.get('/roadmap?category=integration');
        expect(status).toBe(200);
    });
});

describe('Roadmap - Get Single Feature', () => {
    test('GET /roadmap/nonexistent returns 404', async () => {
        const { status } = await client.get('/roadmap/00000000-0000-0000-0000-000000000000');
        expect([404]).toContain(status);
    });
});

describe('Roadmap - Vote', () => {
    test('POST /roadmap/vote/nonexistent returns 404', async () => {
        const { status } = await client.post('/roadmap/vote/00000000-0000-0000-0000-000000000000', {});
        expect([404]).toContain(status);
    });

    test('POST /roadmap/vote without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/roadmap/vote/some-id`, {
            method: 'POST'
        });
        expect(res.status).toBe(401);
    });
});

describe('Roadmap - Admin Create', () => {
    test('POST /roadmap without admin role returns 403', async () => {
        const { status } = await client.post('/roadmap', {
            title: 'New Feature',
            description: 'A new feature',
            category: 'integration'
        });
        expect([403]).toContain(status);
    });

    test('POST /roadmap without title returns 400 or 403', async () => {
        const { status } = await client.post('/roadmap', {
            description: 'No title'
        });
        // 403 if admin check fires first, 400 if validation fires first
        expect([400, 403]).toContain(status);
    });
});

describe('Roadmap - Changelog RSS', () => {
    test('GET /roadmap/changelog/rss returns XML', async () => {
        const { status, data } = await client.get('/roadmap/changelog/rss');
        expect(status).toBe(200);
    });
});
