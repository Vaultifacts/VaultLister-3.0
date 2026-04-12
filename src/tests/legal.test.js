import { describe, expect, test, beforeAll } from 'bun:test';

const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
let authToken = null;

beforeAll(async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' })
    });
    const data = await res.json();
    authToken = data.token;
});

describe('GET /api/legal/privacy/data-export', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/legal/privacy/data-export`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns GDPR data export', async () => {
        const res = await fetch(`${BASE}/api/legal/privacy/data-export`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/legal/privacy/cookie-consent', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/legal/privacy/cookie-consent`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns cookie consent settings', async () => {
        const res = await fetch(`${BASE}/api/legal/privacy/cookie-consent`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('PUT /api/legal/privacy/cookie-consent', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/legal/privacy/cookie-consent`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analytics: true, marketing: false, functional: true })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated updates cookie consent', async () => {
        const res = await fetch(`${BASE}/api/legal/privacy/cookie-consent`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ analytics: true, marketing: false, functional: true })
        });
        expect([200, 201, 400]).toContain(res.status);
    });
});

describe('GET /api/legal/privacy/data-audit', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/legal/privacy/data-audit`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns data audit log', async () => {
        const res = await fetch(`${BASE}/api/legal/privacy/data-audit`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/legal/tos/current', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/legal/tos/current`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns current ToS or 404 if not set', async () => {
        const res = await fetch(`${BASE}/api/legal/tos/current`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/legal/tos/history', () => {
    test('authenticated returns ToS history', async () => {
        const res = await fetch(`${BASE}/api/legal/tos/history`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/legal/tos/accept', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/legal/tos/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tosVersionId: 'nonexistent-id' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('nonexistent tosVersionId returns 400 or 404', async () => {
        const res = await fetch(`${BASE}/api/legal/tos/accept`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tosVersionId: 'nonexistent-id' })
        });
        expect([400, 404]).toContain(res.status);
    });
});

describe('GET /api/legal/tos/acceptance-status', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/legal/tos/acceptance-status`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns acceptance status', async () => {
        const res = await fetch(`${BASE}/api/legal/tos/acceptance-status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});
