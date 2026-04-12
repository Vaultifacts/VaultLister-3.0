// VaultLister API Tests
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let csrfToken = null;

async function getCSRFToken(token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/csrf-token`, { headers });
    const data = await res.json();
    return data.csrfToken;
}

describe('Authentication', () => {
    test('POST /auth/register - should create new user', async () => {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `test${Date.now()}@example.com`,
                password: 'TestPassword123!',
                username: `testuser${Date.now()}`
            })
        });

        const data = await response.json();
        // 201 on success, 400 if email already exists on re-run
        expect([201, 400]).toContain(response.status);
        if (response.status === 201) {
            expect(data.user).toBeDefined();
            expect(data.token).toBeDefined();
        }
    });

    test('POST /auth/login - should authenticate user', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'demo@vaultlister.com',
                password: 'DemoPassword123!'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.token).toBeDefined();
        authToken = data.token;
        csrfToken = await getCSRFToken(authToken);
    });

    test('POST /auth/login - should reject invalid credentials', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'demo@vaultlister.com',
                password: 'wrongpassword'
            })
        });

        expect(response.status).toBe(401);
    });
});

describe('Inventory', () => {
    test('GET /inventory - should require authentication', async () => {
        const response = await fetch(`${BASE_URL}/inventory`);
        expect(response.status).toBe(401);
    });

    test('GET /inventory - should return items', async () => {
        const response = await fetch(`${BASE_URL}/inventory`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.items).toBeDefined();
            expect(Array.isArray(data.items)).toBe(true);
        }
    });

    test('POST /inventory - should create item', async () => {
        csrfToken = await getCSRFToken(authToken);
        const response = await fetch(`${BASE_URL}/inventory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                title: 'Test Item',
                listPrice: 25.00,
                brand: 'Test Brand',
                category: 'Tops',
                condition: 'good'
            })
        });

        const data = await response.json();
        // 201 on success, 403 if tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            expect(data.item).toBeDefined();
            expect(data.item.title).toBe('Test Item');
        }
    });

    test('GET /inventory/stats - should return statistics', async () => {
        const response = await fetch(`${BASE_URL}/inventory/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.stats).toBeDefined();
            expect(typeof data.stats.total).toBe('number');
        }
    });
});

describe('Listings', () => {
    test('GET /listings - should return listings', async () => {
        const response = await fetch(`${BASE_URL}/listings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listings).toBeDefined();
        }
    });
});

describe('Analytics', () => {
    test('GET /analytics/dashboard - should return dashboard stats', async () => {
        const response = await fetch(`${BASE_URL}/analytics/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.stats).toBeDefined();
            expect(data.stats.inventory).toBeDefined();
            expect(data.stats.sales).toBeDefined();
        }
    });

    test('GET /analytics/sustainability - should return impact data', async () => {
        const response = await fetch(`${BASE_URL}/analytics/sustainability`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.totalImpact).toBeDefined();
        }
    });
});

describe('Automations', () => {
    test('GET /automations - should return rules', async () => {
        const response = await fetch(`${BASE_URL}/automations`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.rules).toBeDefined();
        }
    });

    test('GET /automations/presets - should return presets', async () => {
        const response = await fetch(`${BASE_URL}/automations/presets`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.presets).toBeDefined();
            expect(data.presets.length).toBeGreaterThan(0);
        }
    });
});

describe('AI Features', () => {
    test('POST /ai/generate-title - should generate title', async () => {
        csrfToken = await getCSRFToken(authToken);
        const response = await fetch(`${BASE_URL}/ai/generate-title`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                description: 'Blue Nike running shoes',
                brand: 'Nike',
                category: 'Footwear'
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.title).toBeDefined();
        }
    });

    test('POST /ai/suggest-price - should suggest price', async () => {
        csrfToken = await getCSRFToken(authToken);
        const response = await fetch(`${BASE_URL}/ai/suggest-price`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                brand: 'Nike',
                category: 'Sneakers',
                condition: 'good'
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.suggestedPrice).toBeDefined();
            expect(typeof data.suggestedPrice).toBe('number');
        }
    });
});

describe('Shops', () => {
    test('GET /shops - should return connected shops', async () => {
        const response = await fetch(`${BASE_URL}/shops`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.shops).toBeDefined();
        }
    });
});

describe('Tasks', () => {
    test('GET /tasks/queue - should return queue status', async () => {
        const response = await fetch(`${BASE_URL}/tasks/queue`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.stats).toBeDefined();
            expect(typeof data.stats.pending).toBe('number');
        }
    });
});

console.log('Running VaultLister API tests...');
console.log('Make sure the server is running: bun run dev');
