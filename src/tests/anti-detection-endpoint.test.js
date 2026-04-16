import { describe, test, expect } from 'bun:test';
import { monitoringRouter } from '../backend/routes/monitoring.js';

describe('Anti-Detection Diagnostic Endpoint', () => {
    test('should return 401 without user', async () => {
        const result = await monitoringRouter({ method: 'GET', path: '/anti-detection', user: null });
        expect(result.status).toBe(401);
    });

    test('should return 403 for non-admin user', async () => {
        const result = await monitoringRouter({ method: 'GET', path: '/anti-detection', user: { id: '1', is_admin: false } });
        expect(result.status).toBe(403);
    });

    test('should return 200 with checks for admin user', async () => {
        const result = await monitoringRouter({ method: 'GET', path: '/anti-detection', user: { id: '1', is_admin: true } });
        expect(result.status).toBe(200);
        expect(result.data.checks).toBeDefined();
        expect(Array.isArray(result.data.checks)).toBe(true);
        expect(result.data.summary).toBeDefined();
        expect(typeof result.data.summary.passes).toBe('number');
        expect(typeof result.data.summary.warns).toBe('number');
        expect(typeof result.data.summary.fails).toBe('number');
    });

    test('should include profile system check', async () => {
        const result = await monitoringRouter({ method: 'GET', path: '/anti-detection', user: { id: '1', is_admin: true } });
        const profileCheck = result.data.checks.find(c => c.name === 'profiles');
        expect(profileCheck).toBeDefined();
        expect(profileCheck.status).toBe('pass');
    });

    test('should include rate limits check', async () => {
        const result = await monitoringRouter({ method: 'GET', path: '/anti-detection', user: { id: '1', is_admin: true } });
        const rlCheck = result.data.checks.find(c => c.name === 'rate_limits');
        expect(rlCheck).toBeDefined();
        expect(rlCheck.detail).toContain('10/day');
    });

    test('should include platform check', async () => {
        const result = await monitoringRouter({ method: 'GET', path: '/anti-detection', user: { id: '1', is_admin: true } });
        const platformCheck = result.data.checks.find(c => c.name === 'platform');
        expect(platformCheck).toBeDefined();
        // On Windows it's warn, on Linux it's pass
        expect(['pass', 'warn']).toContain(platformCheck.status);
    });
});
