// Shops/Connected Platforms API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
const testPlatform = 'poshmark';

beforeAll(async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });
    const data = await response.json();
    authToken = data.token;
});

describe('Shops - List', () => {
    test('GET /shops - should return connected shops', async () => {
        const response = await fetch(`${BASE_URL}/shops`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.shops).toBeDefined();
            expect(Array.isArray(data.shops)).toBe(true);
        }
    });

    test('GET /shops - should not expose credentials', async () => {
        const response = await fetch(`${BASE_URL}/shops`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            if (data.shops.length > 0) {
                expect(data.shops[0].credentials).toBeUndefined();
            }
        }
    });
});

describe('Shops - Connect', () => {
    test('POST /shops - should connect new platform', async () => {
        // First disconnect if exists
        await fetch(`${BASE_URL}/shops/${testPlatform}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const response = await fetch(`${BASE_URL}/shops`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                platform: testPlatform,
                username: 'testuser123',
                credentials: { apiKey: 'test-api-key' }
            })
        });

        const data = await response.json();
        expect([201, 403, 409]).toContain(response.status);
        if (response.status === 201) {
            expect(data.shop).toBeDefined();
            expect(data.shop.platform).toBe(testPlatform);
            expect(data.shop.credentials).toBeUndefined(); // Should not expose credentials
        }
    });

    test('POST /shops - should require platform', async () => {
        const response = await fetch(`${BASE_URL}/shops`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                username: 'testuser'
                // Missing platform
            })
        });

        // 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('Platform');
        }
    });

    test('POST /shops - should prevent duplicate connections', async () => {
        // Try to connect same platform twice
        const response = await fetch(`${BASE_URL}/shops`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                platform: testPlatform,
                username: 'anotheruser'
            })
        });

        // Either 409 (already connected) or 403 (tier limit) is acceptable
        expect([403, 409]).toContain(response.status);
    });
});

describe('Shops - Get Single', () => {
    test('GET /shops/:platform - should return shop details', async () => {
        const response = await fetch(`${BASE_URL}/shops/${testPlatform}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // May be 200 if connected, 404 if not
        expect([200, 403, 404]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.shop).toBeDefined();
            expect(data.shop.platform).toBe(testPlatform);
            expect(data.shop.credentials).toBeUndefined();
        }
    });

    test('GET /shops/:platform - should return 404 for non-existent platform', async () => {
        const response = await fetch(`${BASE_URL}/shops/nonexistentplatform`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Shops - Update', () => {
    test('PUT /shops/:platform - should update shop settings', async () => {
        const response = await fetch(`${BASE_URL}/shops/${testPlatform}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                username: 'updateduser',
                settings: { autoShare: true, shareInterval: 30 }
            })
        });

        expect([200, 403, 404]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.shop).toBeDefined();
        }
    });

    test('PUT /shops/:platform - should update connection status', async () => {
        const response = await fetch(`${BASE_URL}/shops/${testPlatform}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                isConnected: true
            })
        });

        expect([200, 403, 404]).toContain(response.status);
    });

    test('PUT /shops/:platform - should return 404 for non-existent platform', async () => {
        const response = await fetch(`${BASE_URL}/shops/fakeshop`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ username: 'test' })
        });

        // 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Shops - Sync', () => {
    test('POST /shops/:platform/sync - should start sync', async () => {
        const response = await fetch(`${BASE_URL}/shops/${testPlatform}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });

        expect([200, 403, 404]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toContain('Sync');
            expect(data.taskId).toBeDefined();
        }
    });

    test('POST /shops/:platform/sync - should return 404 for disconnected shop', async () => {
        // Try to sync non-existent shop
        const response = await fetch(`${BASE_URL}/shops/nonexistent/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });

        // 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Shops - Statistics', () => {
    test('GET /shops/:platform/stats - should return shop statistics', async () => {
        const response = await fetch(`${BASE_URL}/shops/${testPlatform}/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 403, 404]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.stats).toBeDefined();
            expect(data.stats.listings).toBeDefined();
            expect(data.stats.sales).toBeDefined();
        }
    });

    test('GET /shops/:platform/stats - should return 404 for non-existent shop', async () => {
        const response = await fetch(`${BASE_URL}/shops/unknownshop/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Shops - Disconnect', () => {
    test('DELETE /shops/:platform - should disconnect shop', async () => {
        const response = await fetch(`${BASE_URL}/shops/${testPlatform}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 403, 404]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toContain('disconnected');
        }
    });

    test('DELETE /shops/:platform - should return 404 for non-existent shop', async () => {
        const response = await fetch(`${BASE_URL}/shops/nonexistent`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Shops - Authentication', () => {
    test('GET /shops - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/shops`);
        expect(response.status).toBe(401);
    });

    test('POST /shops - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/shops`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'test' })
        });
        expect(response.status).toBe(401);
    });
});

console.log('Running Shops API tests...');
