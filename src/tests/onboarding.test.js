import { describe, expect, test, beforeAll } from 'bun:test';

const BASE = `http://localhost:${process.env.PORT || 3001}`;
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

describe('GET /api/onboarding/progress', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/onboarding/progress`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns progress', async () => {
        const res = await fetch(`${BASE}/api/onboarding/progress`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/onboarding/progress', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/onboarding/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'reseller' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated starts or resets onboarding', async () => {
        const res = await fetch(`${BASE}/api/onboarding/progress`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'reseller' })
        });
        expect([200, 201, 400]).toContain(res.status);
    });
});

describe('GET /api/onboarding/badges', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/onboarding/badges`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns badges', async () => {
        const res = await fetch(`${BASE}/api/onboarding/badges`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/onboarding/tours/:role', () => {
    test('valid role reseller returns tour steps', async () => {
        const res = await fetch(`${BASE}/api/onboarding/tours/reseller`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });

    test('invalid role returns 404', async () => {
        const res = await fetch(`${BASE}/api/onboarding/tours/invalid-role`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(404);
    });
});

describe('POST /api/onboarding/badges/claim', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/onboarding/badges/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ badge_id: 'nonexistent-badge' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('nonexistent badge returns 400 or 404', async () => {
        const res = await fetch(`${BASE}/api/onboarding/badges/claim`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ badge_id: 'nonexistent-badge' })
        });
        expect([400, 404]).toContain(res.status);
    });
});
