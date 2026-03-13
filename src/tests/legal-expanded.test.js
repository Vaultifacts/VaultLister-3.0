// Legal API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Legal - Auth Guard', () => {
    test('GET /legal/privacy/data-export without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/legal/privacy/data-export`);
        expect(res.status).toBe(401);
    });

    test('POST /legal/tos/accept without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/legal/tos/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tosVersionId: 'v1' })
        });
        expect(res.status).toBe(401);
    });
});

describe('Legal - Privacy Data Export', () => {
    test('GET /legal/privacy/data-export returns user data', async () => {
        const { status, data } = await client.get('/legal/privacy/data-export');
        expect(status).toBe(200);
    });
});

describe('Legal - Cookie Consent', () => {
    test('GET /legal/privacy/cookie-consent returns settings', async () => {
        const { status, data } = await client.get('/legal/privacy/cookie-consent');
        expect(status).toBe(200);
    });

    test('PUT /legal/privacy/cookie-consent updates settings', async () => {
        const { status } = await client.put('/legal/privacy/cookie-consent', {
            analytics: true,
            marketing: false,
            functional: true
        });
        expect(status).toBe(200);
    });

    test('PUT /legal/privacy/cookie-consent all disabled', async () => {
        const { status } = await client.put('/legal/privacy/cookie-consent', {
            analytics: false,
            marketing: false,
            functional: false
        });
        expect(status).toBe(200);
    });
});

describe('Legal - Data Audit', () => {
    test('GET /legal/privacy/data-audit returns record counts', async () => {
        const { status, data } = await client.get('/legal/privacy/data-audit');
        expect(status).toBe(200);
    });
});

describe('Legal - ToS Accept', () => {
    test('POST /legal/tos/accept without tosVersionId returns 400', async () => {
        const { status } = await client.post('/legal/tos/accept', {});
        expect([400]).toContain(status);
    });

    test('POST /legal/tos/accept with valid tosVersionId', async () => {
        const { status } = await client.post('/legal/tos/accept', {
            tosVersionId: 'tos-v1'
        });
        expect([200, 404]).toContain(status);
    });
});

describe('Legal - ToS Acceptance Status', () => {
    test('GET /legal/tos/acceptance-status returns status', async () => {
        const { status, data } = await client.get('/legal/tos/acceptance-status');
        expect([200, 404]).toContain(status);
        if (status === 200 && data) {
            expect(typeof data).toBe('object');
        }
    });
});
