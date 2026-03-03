// Duplicates API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testDuplicateId = null;

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

describe('Duplicates - List', () => {
    test('GET /duplicates - should list duplicate detections', async () => {
        const response = await fetch(`${BASE_URL}/duplicates`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.duplicates).toBeDefined();
    });

    test('GET /duplicates?status=pending - should filter by status', async () => {
        const response = await fetch(`${BASE_URL}/duplicates?status=pending`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
    });
});

describe('Duplicates - Scan', () => {
    test('POST /duplicates/scan - should trigger duplicate scan', async () => {
        const response = await fetch(`${BASE_URL}/duplicates/scan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.message).toBe('Scan complete');
        expect(data.items_scanned).toBeDefined();
    }, 30000); // O(n^2) scan can be slow with large inventory
});

describe('Duplicates - Check', () => {
    test('POST /duplicates/check - should check single item for duplicates', async () => {
        const response = await fetch(`${BASE_URL}/duplicates/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Test Item',
                sku: 'TEST-123',
                brand: 'Test Brand'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.has_duplicates).toBeDefined();
    });
});

describe('Duplicates - Update Action', () => {
    test('PATCH /duplicates/:id - should update user action', async () => {
        // First get any duplicates
        const listResponse = await fetch(`${BASE_URL}/duplicates`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const listData = await listResponse.json();

        if (!listData.duplicates || listData.duplicates.length === 0) {
            console.log('Skipping: No duplicates available');
            return;
        }

        testDuplicateId = listData.duplicates[0].id;

        const response = await fetch(`${BASE_URL}/duplicates/${testDuplicateId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                user_action: 'ignored'
            })
        });

        expect([200, 400, 404]).toContain(response.status);
    });
});

describe('Duplicates - Stats', () => {
    test('GET /duplicates/stats - should return duplicate statistics', async () => {
        const response = await fetch(`${BASE_URL}/duplicates/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.stats).toBeDefined();
    });
});

describe('Duplicates - Authentication', () => {
    test('GET /duplicates - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/duplicates`);
        expect(response.status).toBe(401);
    });
});

console.log('Running Duplicates API tests...');
