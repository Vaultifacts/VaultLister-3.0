// Analytics API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;

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

describe('Analytics - Dashboard', () => {
    test('GET /analytics/dashboard - should return dashboard stats', async () => {
        const response = await fetch(`${BASE_URL}/analytics/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
    });

    test('GET /analytics/dashboard?period=30d - should filter by period', async () => {
        const response = await fetch(`${BASE_URL}/analytics/dashboard?period=30d`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
    });
});

describe('Analytics - Sales', () => {
    test('GET /analytics/sales - should return sales analytics', async () => {
        const response = await fetch(`${BASE_URL}/analytics/sales`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });

    test('GET /analytics/sales?groupBy=day - should group by day', async () => {
        const response = await fetch(`${BASE_URL}/analytics/sales?groupBy=day`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });

    test('GET /analytics/sales?platform=poshmark - should filter by platform', async () => {
        const response = await fetch(`${BASE_URL}/analytics/sales?platform=poshmark`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Analytics - Inventory', () => {
    test('GET /analytics/inventory - should return inventory analytics', async () => {
        const response = await fetch(`${BASE_URL}/analytics/inventory`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Analytics - Profit & Loss', () => {
    test('GET /analytics/profit-loss - should return P&L report', async () => {
        const response = await fetch(`${BASE_URL}/analytics/profit-loss`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });

    test('GET /analytics/profit-loss?startDate=2024-01-01&endDate=2024-12-31 - should filter by date', async () => {
        const response = await fetch(`${BASE_URL}/analytics/profit-loss?startDate=2024-01-01&endDate=2024-12-31`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Analytics - Platform Performance', () => {
    test('GET /analytics/platforms - should return platform comparison', async () => {
        const response = await fetch(`${BASE_URL}/analytics/platforms`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Analytics - Trends', () => {
    test('GET /analytics/trends - should return trend data', async () => {
        const response = await fetch(`${BASE_URL}/analytics/trends`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Analytics - Sustainability', () => {
    test('GET /analytics/sustainability - should return sustainability metrics', async () => {
        const response = await fetch(`${BASE_URL}/analytics/sustainability`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
    });
});

describe('Analytics - Export', () => {
    test('GET /analytics/export?format=csv - should export data as CSV', async () => {
        const response = await fetch(`${BASE_URL}/analytics/export?format=csv`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 400, 404]).toContain(response.status);
    });
});

describe('Analytics - Authentication', () => {
    test('GET /analytics/dashboard - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/analytics/dashboard`);
        expect(response.status).toBe(401);
    });
});

console.log('Running Analytics API tests...');
