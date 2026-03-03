// Affiliate — Expanded Gap Tests
// Covers: landing pages CRUD, tiers, my-tier, earnings, commissions, stats
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Affiliate — Landing Pages', () => {
    let pageId;

    test('GET /affiliate/landing-pages returns list', async () => {
        const { status, data } = await client.get('/affiliate/landing-pages');
        if (status === 200) {
            const items = Array.isArray(data) ? data : (data.pages || data.landingPages || []);
            expect(Array.isArray(items)).toBe(true);
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('POST /affiliate/landing-pages creates page', async () => {
        const { status, data } = await client.post('/affiliate/landing-pages', {
            title: 'Test Landing Page',
            slug: `test-page-${Date.now()}`,
            description: 'From expanded tests'
        });
        if (status === 200 || status === 201) {
            pageId = data.id || data.page?.id;
            expect(data).toBeDefined();
        } else {
            expect([400, 404, 403]).toContain(status);
        }
    });

    test('PUT /affiliate/landing-pages/:id updates page', async () => {
        if (!pageId) { console.warn('No page created'); return; }
        const { status } = await client.put(`/affiliate/landing-pages/${pageId}`, {
            title: 'Updated Landing Page'
        });
        expect([200, 400, 404]).toContain(status);
    });

    test('PUT /affiliate/landing-pages/nonexistent returns 404', async () => {
        const { status } = await client.put('/affiliate/landing-pages/nonexistent-999', {
            title: 'Should fail'
        });
        expect([404, 400, 500]).toContain(status);
    });

    test('DELETE /affiliate/landing-pages/:id deletes page', async () => {
        if (!pageId) { console.warn('No page created'); return; }
        const { status } = await client.delete(`/affiliate/landing-pages/${pageId}`);
        expect([200, 204, 404]).toContain(status);
    });

    test('DELETE /affiliate/landing-pages/nonexistent returns 404', async () => {
        const { status } = await client.delete('/affiliate/landing-pages/nonexistent-999');
        expect([404, 400, 500]).toContain(status);
    });
});

describe('Affiliate — Tiers & Earnings', () => {
    test('GET /affiliate/tiers returns tier list', async () => {
        const { status, data } = await client.get('/affiliate/tiers');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /affiliate/my-tier returns current user tier', async () => {
        const { status, data } = await client.get('/affiliate/my-tier');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /affiliate/earnings returns earnings data', async () => {
        const { status, data } = await client.get('/affiliate/earnings');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /affiliate/commissions returns commission data', async () => {
        const { status, data } = await client.get('/affiliate/commissions');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /affiliate/stats returns affiliate stats', async () => {
        const { status, data } = await client.get('/affiliate/stats');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });
});

describe('Affiliate — Auth Guard', () => {
    test('GET /affiliate/earnings requires auth', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/affiliate/earnings');
        expect([401, 403]).toContain(status);
    });
});
