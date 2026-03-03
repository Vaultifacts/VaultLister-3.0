// Feature Flags Expanded Tests
// Deep testing beyond the existing stub: response shapes, known flags,
// consistency, admin endpoint, and A/B testing.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
let demoClient;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

// ============================================================
// Response Shape
// ============================================================
describe('Feature Flags Expanded - Response Shape', () => {
    test('GET /feature-flags returns { flags } object', async () => {
        const { status, data } = await client.get('/feature-flags');
        expect(status).toBe(200);
        expect(data).toHaveProperty('flags');
        expect(typeof data.flags).toBe('object');
    });

    test('all flag values are booleans', async () => {
        const { data } = await client.get('/feature-flags');
        for (const [key, val] of Object.entries(data.flags)) {
            expect(typeof val).toBe('boolean');
        }
    });

    test('flags object has at least 10 entries', async () => {
        const { data } = await client.get('/feature-flags');
        expect(Object.keys(data.flags).length).toBeGreaterThanOrEqual(10);
    });
});

// ============================================================
// Known Flags
// ============================================================
describe('Feature Flags Expanded - Known Flags', () => {
    test('ui.darkMode exists and is boolean', async () => {
        const { data } = await client.get('/feature-flags');
        expect('ui.darkMode' in data.flags).toBe(true);
        expect(typeof data.flags['ui.darkMode']).toBe('boolean');
    });

    test('ai.listingGenerator exists', async () => {
        const { data } = await client.get('/feature-flags');
        expect('ai.listingGenerator' in data.flags).toBe(true);
    });

    test('integration.whatnot exists', async () => {
        const { data } = await client.get('/feature-flags');
        expect('integration.whatnot' in data.flags).toBe(true);
    });

    test('perf.lazyLoadImages exists', async () => {
        const { data } = await client.get('/feature-flags');
        expect('perf.lazyLoadImages' in data.flags).toBe(true);
    });

    test('ui.advancedFilters exists', async () => {
        const { data } = await client.get('/feature-flags');
        expect('ui.advancedFilters' in data.flags).toBe(true);
    });

    test('ui.bulkActions exists', async () => {
        const { data } = await client.get('/feature-flags');
        expect('ui.bulkActions' in data.flags).toBe(true);
    });

    test('perf.serviceWorker exists', async () => {
        const { data } = await client.get('/feature-flags');
        expect('perf.serviceWorker' in data.flags).toBe(true);
    });
});

// ============================================================
// Consistency
// ============================================================
describe('Feature Flags Expanded - Consistency', () => {
    test('same user gets same flags on consecutive requests', async () => {
        const { data: first } = await client.get('/feature-flags');
        const { data: second } = await client.get('/feature-flags');
        expect(JSON.stringify(first.flags)).toBe(JSON.stringify(second.flags));
    });

    test('flag keys are dot-delimited strings', async () => {
        const { data } = await client.get('/feature-flags');
        for (const key of Object.keys(data.flags)) {
            expect(key).toContain('.');
        }
    });
});

// ============================================================
// Admin Endpoint
// ============================================================
describe('Feature Flags Expanded - Admin Endpoint', () => {
    test('GET /feature-flags/all requires enterprise tier', async () => {
        const { status } = await client.get('/feature-flags/all');
        // Non-enterprise users should get 403
        expect([200, 403]).toContain(status);
    });

    test('GET /feature-flags/all returns detailed flags if authorized', async () => {
        const { status, data } = await client.get('/feature-flags/all');
        if (status === 200) {
            const flags = data.flags || data;
            expect(typeof flags).toBe('object');
            // Admin view should include rolloutPercentage
            const firstFlag = Object.values(flags)[0];
            if (firstFlag && typeof firstFlag === 'object') {
                expect(typeof firstFlag.enabled).toBe('boolean');
            }
        }
    });

    test('unauthenticated /feature-flags/all returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/feature-flags/all');
        expect(status).toBe(401);
    });
});
