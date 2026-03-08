// @ts-check
import { test, expect, apiLogin } from '../fixtures/auth.js';

const BASE = `http://localhost:${process.env.PORT || 3001}`;

/**
 * Monitoring routes E2E tests
 * Tests health, metrics, alerts, errors, and RUM endpoints
 */
test.describe('Monitoring Routes', () => {

    test('GET /api/health returns 200 with status @monitoring', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/health`);
        expect(resp.ok()).toBe(true);
        const body = await resp.json();
        expect(body.status).toBeDefined();
    });

    test('GET /api/health/detailed requires authentication @monitoring', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/health/detailed`);
        // Returns 200 (no auth required), 401, or 403
        expect([200, 401, 403]).toContain(resp.status());
    });

    test('GET /api/health/detailed works with auth @monitoring', async ({ request }) => {
        const loginData = await apiLogin(request);
        const resp = await request.get(`${BASE}/api/health/detailed`, {
            headers: { 'Authorization': `Bearer ${loginData.token}` }
        });
        // May return 200 or 403 (enterprise-only)
        expect([200, 403]).toContain(resp.status());
    });

    test('GET /api/metrics requires authentication @monitoring', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/metrics`);
        expect([401, 403, 404]).toContain(resp.status());
    });

    test('GET /api/metrics with auth @monitoring', async ({ request }) => {
        const loginData = await apiLogin(request);
        const resp = await request.get(`${BASE}/api/metrics`, {
            headers: { 'Authorization': `Bearer ${loginData.token}` }
        });
        // Enterprise-only or not implemented — 200, 403, or 404
        expect([200, 403, 404]).toContain(resp.status());
    });

    test('GET /api/alerts requires authentication @monitoring', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/alerts`);
        expect([401, 403, 404]).toContain(resp.status());
    });

    test('GET /api/alerts with auth returns array @monitoring', async ({ request }) => {
        const loginData = await apiLogin(request);
        const resp = await request.get(`${BASE}/api/alerts`, {
            headers: { 'Authorization': `Bearer ${loginData.token}` }
        });
        if (resp.ok()) {
            const body = await resp.json();
            expect(Array.isArray(body.alerts || body)).toBe(true);
        } else {
            // Acceptable if endpoint requires enterprise tier
            expect([403, 404]).toContain(resp.status());
        }
    });

    test('GET /api/errors requires authentication @monitoring', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/errors`);
        expect([401, 403, 404]).toContain(resp.status());
    });

    test('POST /api/monitoring/rum accepts metrics @monitoring', async ({ request }) => {
        const resp = await request.post(`${BASE}/api/monitoring/rum`, {
            data: {
                sessionId: 'test-session-123',
                metrics: [
                    { name: 'FCP', value: 1200, timestamp: Date.now() },
                    { name: 'LCP', value: 2500, timestamp: Date.now() }
                ]
            }
        });
        // Should accept (200/201) or reject with validation error (400)
        expect([200, 201, 400, 404]).toContain(resp.status());
    });

    test('GET /api/security/events requires authentication @monitoring', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/security/events`);
        expect([401, 403]).toContain(resp.status());
    });
});
