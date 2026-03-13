// Expense Tracker API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Expense Tracker - Auth Guard', () => {
    test('GET /expenses/categories without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/expenses/categories`);
        expect(res.status).toBe(401);
    });

    test('POST /expenses/categories without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/expenses/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test' })
        });
        expect(res.status).toBe(401);
    });
});

describe('Expense Tracker - Categories List', () => {
    test('GET /expenses/categories returns categories', async () => {
        const { status, data } = await client.get('/expenses/categories');
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data).toHaveProperty('categories');
            expect(Array.isArray(data.categories)).toBe(true);
        }
    });
});

describe('Expense Tracker - Create Category', () => {
    test('POST /expenses/categories creates category', async () => {
        const uniqueName = `TestCat-${Date.now()}`;
        const { status, data } = await client.post('/expenses/categories', {
            name: uniqueName,
            type: 'expense'
        });
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data.success).toBe(true);
        }
    });

    test('POST /expenses/categories without name returns 400', async () => {
        const { status } = await client.post('/expenses/categories', {
            type: 'expense'
        });
        expect([400]).toContain(status);
    });

    test('POST /expenses/categories with invalid type returns 400', async () => {
        const { status } = await client.post('/expenses/categories', {
            name: 'InvalidType',
            type: 'invalid'
        });
        expect([400]).toContain(status);
    });

    test('POST /expenses/categories with deduction type', async () => {
        const uniqueName = `Deduction-${Date.now()}`;
        const { status } = await client.post('/expenses/categories', {
            name: uniqueName,
            type: 'deduction'
        });
        expect(status).toBe(200);
    });

    test('POST /expenses/categories with cogs type', async () => {
        const uniqueName = `COGS-${Date.now()}`;
        const { status } = await client.post('/expenses/categories', {
            name: uniqueName,
            type: 'cogs'
        });
        expect(status).toBe(200);
    });

    test('POST /expenses/categories with too-long name returns 400', async () => {
        const { status } = await client.post('/expenses/categories', {
            name: 'A'.repeat(101),
            type: 'expense'
        });
        expect([400]).toContain(status);
    });
});

describe('Expense Tracker - Tax Report', () => {
    test('GET /expenses/tax-report with year and quarter', async () => {
        const { status, data } = await client.get('/expenses/tax-report?year=2025&quarter=1');
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data).toHaveProperty('period');
            expect(data).toHaveProperty('total_deductible');
            expect(data).toHaveProperty('estimated_tax_savings');
        }
    });

    test('GET /expenses/tax-report with date range', async () => {
        const { status } = await client.get('/expenses/tax-report?startDate=2025-01-01&endDate=2025-03-31');
        expect(status).toBe(200);
    });

    test('GET /expenses/tax-report with invalid quarter returns 400', async () => {
        const { status } = await client.get('/expenses/tax-report?year=2025&quarter=5');
        expect([400]).toContain(status);
    });
});

describe('Expense Tracker - Auto-Categorize', () => {
    test('POST /expenses/categorize auto-categorizes transactions', async () => {
        const { status, data } = await client.post('/expenses/categorize', {});
        expect(status).toBe(200);
        if (status === 200 && data) {
            expect(data.success).toBe(true);
            expect(typeof data.categorized).toBe('number');
        }
    });
});
