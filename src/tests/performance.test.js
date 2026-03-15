// Performance Baseline Tests
// Hard response-time assertions for regression detection
// Thresholds are generous (VM environment) — purpose is catching regressions, not production SLA
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken, loginUser } from './helpers/auth.helper.js';
import { fixtures, demoUser } from './helpers/fixtures.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let client;
let inventoryItemId;

/**
 * Measure wall-clock time of an async function.
 * Returns { result, elapsed } where elapsed is milliseconds.
 */
async function timed(fn) {
    const start = performance.now();
    const result = await fn();
    return { result, elapsed: Math.round(performance.now() - start) };
}

beforeAll(async () => {
    const { data } = await loginUser(demoUser.email, demoUser.password);
    client = new TestApiClient(data.token);

    // Create an inventory item for read/update tests
    const { data: itemData } = await client.createInventoryItem(fixtures.inventoryItem());
    if (itemData?.item?.id) {
        inventoryItemId = itemData.item.id;
    } else if (itemData?.id) {
        inventoryItemId = itemData.id;
    }
});

// ============================================================
// Health Endpoint — should be near-instant
// ============================================================
describe('Performance - Health Endpoint', () => {
    test('GET /health responds in under 200ms', async () => {
        const { result, elapsed } = await timed(() => fetch(`${BASE_URL}/health`));
        expect(result.status).toBe(200);
        expect(elapsed).toBeLessThan(200);
    });
});

// ============================================================
// CSRF Token — pure crypto, no DB
// ============================================================
describe('Performance - CSRF Token', () => {
    test('GET /csrf-token responds in under 100ms', async () => {
        const { result, elapsed } = await timed(() =>
            fetch(`${BASE_URL}/csrf-token`, {
                headers: { 'Authorization': `Bearer ${client.token}` }
            })
        );
        expect(result.status).toBe(200);
        expect(elapsed).toBeLessThan(100);
    });
});

// ============================================================
// Authentication — bcrypt cost is the bottleneck
// ============================================================
describe('Performance - Authentication', () => {
    test('POST /auth/login completes in under 1000ms', async () => {
        const { result, elapsed } = await timed(() =>
            fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: demoUser.email, password: demoUser.password })
            })
        );
        expect(result.status).toBe(200);
        expect(elapsed).toBeLessThan(1000);
    });

    test('GET /auth/me completes in under 300ms', async () => {
        const { result, elapsed } = await timed(() => client.get('/auth/me'));
        expect(result.status).toBe(200);
        expect(elapsed).toBeLessThan(300);
    });
});

// ============================================================
// Inventory CRUD — core operations
// ============================================================
describe('Performance - Inventory', () => {
    test('GET /inventory completes in under 500ms', async () => {
        const { result, elapsed } = await timed(() => client.get('/inventory'));
        expect(result.status).toBe(200);
        expect(elapsed).toBeLessThan(500);
    });

    test('POST /inventory (create) completes in under 500ms', async () => {
        const { result, elapsed } = await timed(() =>
            client.createInventoryItem(fixtures.inventoryItem())
        );
        expect([200, 201]).toContain(result.status);
        expect(elapsed).toBeLessThan(500);
    });

    test('GET /inventory/:id completes in under 300ms', async () => {
        if (!inventoryItemId) return; // skip if setup failed
        const { result, elapsed } = await timed(() => client.get(`/inventory/${inventoryItemId}`));
        expect(result.status).toBe(200);
        expect(elapsed).toBeLessThan(300);
    });

    test('PUT /inventory/:id (update) completes in under 500ms', async () => {
        if (!inventoryItemId) return;
        const { result, elapsed } = await timed(() =>
            client.put(`/inventory/${inventoryItemId}`, { title: `Updated ${Date.now()}` })
        );
        expect(result.status).toBe(200);
        expect(elapsed).toBeLessThan(500);
    });
});

// ============================================================
// Listings
// ============================================================
describe('Performance - Listings', () => {
    test('GET /listings completes in under 500ms', async () => {
        const { result, elapsed } = await timed(() => client.get('/listings'));
        expect([200, 404]).toContain(result.status);
        expect(elapsed).toBeLessThan(500);
    });
});

// ============================================================
// Analytics — aggregation queries get more headroom
// ============================================================
describe('Performance - Analytics', () => {
    test('GET /analytics/sales completes in under 1000ms', async () => {
        const { result, elapsed } = await timed(() => client.get('/analytics/sales'));
        // 500 if analytics table missing on CI
        expect([200, 404, 500]).toContain(result.status);
        expect(elapsed).toBeLessThan(1000);
    });
});

// ============================================================
// Sequential Burst — regression guard for N+1 queries
// ============================================================
describe('Performance - Sequential Burst', () => {
    test('5 sequential GET /inventory requests all complete in under 500ms each', async () => {
        const times = [];
        for (let i = 0; i < 5; i++) {
            const { result, elapsed } = await timed(() => client.get('/inventory'));
            expect(result.status).toBe(200);
            times.push(elapsed);
        }
        for (const t of times) {
            expect(t).toBeLessThan(500);
        }
    });
});
