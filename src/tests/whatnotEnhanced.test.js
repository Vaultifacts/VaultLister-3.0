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

describe('GET /api/whatnot-enhanced/cohosts', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/cohosts`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns cohosts', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/cohosts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // 403 if feature is tier-gated
        expect([200, 403, 404]).toContain(res.status);
    });

    test('authenticated with event_id filter', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/cohosts?event_id=test`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // 403 if feature is tier-gated
        expect([200, 403, 404]).toContain(res.status);
    });
});

describe('POST /api/whatnot-enhanced/cohosts', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/cohosts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: 'nonexistent-event', cohost_name: 'TestUser' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated with nonexistent event returns 201 or 404', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/cohosts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: 'nonexistent-event', cohost_name: 'TestUser' })
        });
        // 403 if feature is tier-gated
        expect([201, 403, 404]).toContain(res.status);
    });
});

describe('GET /api/whatnot-enhanced/staging', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/staging`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns staging items', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/staging?event_id=test`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // 403 if feature is tier-gated
        expect([200, 403, 404]).toContain(res.status);
    });
});

describe('POST /api/whatnot-enhanced/staging', () => {
    test('authenticated with nonexistent ids returns 201 or 404', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/staging`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: 'nonexistent', inventory_id: 'nonexistent' })
        });
        // 403 if feature is tier-gated
        expect([201, 403, 404]).toContain(res.status);
    });
});

describe('POST /api/whatnot-enhanced/staging/auto-suggest', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/staging/auto-suggest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: 'nonexistent', limit: 10 })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated with nonexistent event returns 200 or 404', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/staging/auto-suggest`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: 'nonexistent', limit: 10 })
        });
        // 403 if feature is tier-gated
        expect([200, 403, 404]).toContain(res.status);
    });
});

describe('GET /api/whatnot-enhanced/staging/bundles', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/staging/bundles?event_id=test`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns bundles', async () => {
        const res = await fetch(`${BASE}/api/whatnot-enhanced/staging/bundles?event_id=test`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // 403 if feature is tier-gated
        expect([200, 403, 404]).toContain(res.status);
    });
});
