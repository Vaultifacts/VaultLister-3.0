// Shipping Labels Enhanced API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;

// Setup - Login before tests
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

describe('Shipping Labels - Print Enhancement', () => {
    test('POST /shipping-labels-mgmt/print-batch - should require label_ids', async () => {
        const response = await fetch(`${BASE_URL}/shipping-labels-mgmt/print-batch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        // 400 on validation error, 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('Label IDs');
        }
    });

    test('POST /shipping-labels-mgmt/print-batch - should accept format', async () => {
        const response = await fetch(`${BASE_URL}/shipping-labels-mgmt/print-batch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                label_ids: ['test-id'],
                format: 'thermal_4x6'
            })
        });

        // 200 on success, 403 if feature is tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.format).toBe('thermal_4x6');
        }
    });
});

describe('Shipping Labels - Download Batch', () => {
    test('GET /shipping-labels-mgmt/download-batch - should require label_ids', async () => {
        const response = await fetch(`${BASE_URL}/shipping-labels-mgmt/download-batch`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('Label IDs');
        }
    });

    test('GET /shipping-labels-mgmt/download-batch - should accept label_ids param', async () => {
        const response = await fetch(`${BASE_URL}/shipping-labels-mgmt/download-batch?label_ids=id1,id2`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.labels).toBeDefined();
            expect(data.total).toBeDefined();
        }
    });
});

describe('Shipping Labels - Stats', () => {
    test('GET /shipping-labels-mgmt/stats - should return stats', async () => {
        const response = await fetch(`${BASE_URL}/shipping-labels-mgmt/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.stats).toBeDefined();
            expect(typeof data.stats.total_labels).toBe('number');
            expect(typeof data.stats.printed_labels).toBe('number');
        }
    });

    test('GET /shipping-labels-mgmt/stats - should accept date range', async () => {
        const response = await fetch(`${BASE_URL}/shipping-labels-mgmt/stats?startDate=2024-01-01&endDate=2024-12-31`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.stats).toBeDefined();
        }
    });
});
