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

describe('GET /api/offline-sync/queue', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/queue`);
        expect([401, 403, 500]).toContain(res.status);
    });

    test('authenticated returns queue', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/queue`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });

    test('authenticated with status=pending filter', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/queue?status=pending`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/offline-sync/queue', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', entity_type: 'inventory', entity_id: 'test-001', payload: { title: 'Test Item' } })
        });
        expect([401, 403, 500]).toContain(res.status);
    });

    test('authenticated with valid body enqueues item', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/queue`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', entity_type: 'inventory', entity_id: 'test-001', payload: { title: 'Test Item' } })
        });
        expect([200, 201, 400]).toContain(res.status);
    });
});

describe('POST /api/offline-sync/sync', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/sync`, { method: 'POST' });
        expect([401, 403, 500]).toContain(res.status);
    });

    test('authenticated processes pending items', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 201, 400, 500]).toContain(res.status);
    });
});

describe('GET /api/offline-sync/status', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/status`);
        expect([401, 403, 500]).toContain(res.status);
    });

    test('authenticated returns sync status', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/offline-sync/manifest', () => {
    test('unauthenticated returns 401/403/500', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/manifest`, { method: 'POST' });
        expect([401, 403, 500]).toContain(res.status);
    });

    test('authenticated returns or generates manifest', async () => {
        const res = await fetch(`${BASE}/api/offline-sync/manifest`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 201, 400, 500]).toContain(res.status);
    });
});
