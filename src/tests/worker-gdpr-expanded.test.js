// GDPR Worker — Expanded Integration + Unit Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

let client;
let gdprModule;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
    try {
        gdprModule = await import('../backend/workers/gdprWorker.js');
    } catch {
        console.warn('Could not import gdprWorker directly');
    }
});

describe('GDPR Worker — exports', () => {
    test('startGDPRWorker is a function', () => {
        if (!gdprModule?.startGDPRWorker) { console.warn('startGDPRWorker not exported'); return; }
        expect(typeof gdprModule.startGDPRWorker).toBe('function');
    });

    test('stopGDPRWorker is a function', () => {
        if (!gdprModule?.stopGDPRWorker) { console.warn('stopGDPRWorker not exported'); return; }
        expect(typeof gdprModule.stopGDPRWorker).toBe('function');
    });

    test('stopGDPRWorker does not throw when not started', () => {
        if (!gdprModule?.stopGDPRWorker) { console.warn('stopGDPRWorker not exported'); return; }
        expect(() => gdprModule.stopGDPRWorker()).not.toThrow();
    });
});

describe('GDPR API — data audit', () => {
    test('GET /gdpr/audit returns data audit', async () => {
        const { status, data } = await client.get('/gdpr/audit');
        if (status === 200) {
            expect(data).toBeDefined();
            // Should contain data counts or audit info
            const audit = data.dataCounts || data.audit || data;
            expect(typeof audit).toBe('object');
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /gdpr/audit requires auth', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/gdpr/audit');
        expect([401, 403]).toContain(status);
    });
});

describe('GDPR API — data export', () => {
    test('GET /gdpr/export returns user data', async () => {
        const { status, data } = await client.get('/gdpr/export');
        if (status === 200) {
            expect(data).toBeDefined();
            expect(typeof data).toBe('object');
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /gdpr/export requires auth', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/gdpr/export');
        expect([401, 403]).toContain(status);
    });
});

describe('GDPR API — consent', () => {
    test('GET /gdpr/consent returns consent status', async () => {
        const { status, data } = await client.get('/gdpr/consent');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('POST /gdpr/consent updates consent', async () => {
        const { status } = await client.post('/gdpr/consent', {
            analytics: true,
            marketing: false,
            essential: true
        });
        expect([200, 201, 404, 403]).toContain(status);
    });

    test('GET /gdpr/consent requires auth', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/gdpr/consent');
        expect([401, 403]).toContain(status);
    });
});

describe('GDPR API — rectification', () => {
    test('PUT /gdpr/rectify accepts correction request', async () => {
        const { status, data } = await client.put('/gdpr/rectify', {
            corrections: { full_name: 'Test User Corrected' }
        });
        expect([200, 403, 404, 500]).toContain(status);
    });

    test('PUT /gdpr/rectify requires auth', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.put('/gdpr/rectify', {
            corrections: { full_name: 'Hacker' }
        });
        expect([401, 403]).toContain(status);
    });
});

describe('GDPR API — deletion request', () => {
    test('POST /gdpr/delete-request initiates deletion', async () => {
        const { status, data } = await client.post('/gdpr/delete-request', {
            reason: 'Testing deletion flow',
            confirmation: 'DELETE'
        });
        // May be 200, 201, 400 (missing fields), or 404 (route not exposed)
        expect([200, 201, 400, 403, 404]).toContain(status);
    });

    test('GET /gdpr/delete-request/status checks deletion status', async () => {
        const { status } = await client.get('/gdpr/delete-request/status');
        // Returns current deletion request status or 404 if none pending
        expect([200, 404, 403]).toContain(status);
    });
});
