/**
 * Reports Routes E2E Tests
 *
 * Covers: GET /reports (list), POST /reports (create), GET /reports/:id,
 * PUT /reports/:id (update), DELETE /reports/:id, GET /templates,
 * POST /from-template, GET /widgets, POST /generate,
 * GET /pnl (error contract), POST /query (admin guard).
 * All tests are API-level (no UI navigation required).
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

let token;
let headers;
let createdReportId;

async function getPostHeaders(request) {
    const res = await request.get(`${BASE_URL}/api/billing/plans`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const csrf = res.headers()['x-csrf-token'] || '';
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {})
    };
}

test.beforeAll(async ({ request }) => {
    const loginData = await apiLogin(request);
    token = loginData.token;
    headers = { Authorization: `Bearer ${token}` };
});

// ── Auth guard ────────────────────────────────────────────────────────────────

test.describe('Reports routes — auth guard', () => {
    test('should return 401 when GET /reports called without token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/reports`);
        expect(res.status()).toBe(401);
    });

    test('should return 401 when GET /reports/templates called without token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/reports/templates`);
        expect(res.status()).toBe(401);
    });
});

// ── GET /api/reports ─────────────────────────────────────────────────────────

test.describe('GET /api/reports', () => {
    test('should return a reports array', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/reports`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.reports)).toBe(true);
    });
});

// ── GET /api/reports/templates ───────────────────────────────────────────────

test.describe('GET /api/reports/templates', () => {
    test('should return all pre-built report templates with id and name', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/reports/templates`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);

        for (const template of data) {
            expect(typeof template.id).toBe('string');
            expect(typeof template.name).toBe('string');
            expect(typeof template.description).toBe('string');
            expect(template.config).toBeDefined();
        }
    });

    test('should include monthly-sales and platform-performance templates', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/reports/templates`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        const ids = data.map(t => t.id);
        expect(ids).toContain('monthly-sales');
        expect(ids).toContain('platform-performance');
    });
});

// ── GET /api/reports/widgets ─────────────────────────────────────────────────

test.describe('GET /api/reports/widgets', () => {
    test('should return widget catalog with type, label, and category', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/reports/widgets`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.widgets)).toBe(true);
        expect(data.widgets.length).toBeGreaterThan(0);

        for (const widget of data.widgets) {
            expect(typeof widget.type).toBe('string');
            expect(typeof widget.label).toBe('string');
            expect(typeof widget.category).toBe('string');
        }
    });
});

// ── POST /api/reports — create + full CRUD cycle ─────────────────────────────

test.describe('Reports CRUD', () => {
    test.describe.configure({ mode: 'serial' });

    test('should create a new report and return 201 with report object', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/reports`, {
            headers: ph,
            data: {
                name: '[E2E TEST] Revenue Report',
                description: 'Test report for E2E coverage',
                widgets: [{ type: 'revenue_chart' }, { type: 'profit_margin' }],
                date_range: '30d'
            }
        });
        expect(res.status()).toBe(201);
        const data = await res.json();
        expect(data.report).toBeDefined();
        expect(data.report.name).toBe('[E2E TEST] Revenue Report');
        expect(typeof data.report.id).toBe('string');
        expect(data.message).toMatch(/created/i);
        createdReportId = data.report.id;
    });

    test('should return 400 when report name is missing', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/reports`, {
            headers: ph,
            data: { description: 'Missing name' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/report name required/i);
    });

    test('should retrieve the created report by id with widget data', async ({ request }) => {
        if (!createdReportId) test.skip();
        const res = await request.get(`${BASE_URL}/api/reports/${createdReportId}`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.report.id).toBe(createdReportId);
        expect(data.report.name).toBe('[E2E TEST] Revenue Report');
        expect(data.widgetData).toBeDefined();
    });

    test('should return 404 when getting a report that does not belong to the user', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/reports/00000000-0000-0000-0000-000000000000`, { headers });
        expect(res.status()).toBe(404);
        const data = await res.json();
        expect(data.error).toMatch(/not found/i);
    });

    test('should update the report name and return updated report', async ({ request }) => {
        if (!createdReportId) test.skip();
        const ph = await getPostHeaders(request);
        const res = await request.put(`${BASE_URL}/api/reports/${createdReportId}`, {
            headers: ph,
            data: { name: '[E2E TEST] Revenue Report UPDATED' }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.report.name).toBe('[E2E TEST] Revenue Report UPDATED');
    });

    test('should return 400 when PUT is called with no updatable fields', async ({ request }) => {
        if (!createdReportId) test.skip();
        const ph = await getPostHeaders(request);
        const res = await request.put(`${BASE_URL}/api/reports/${createdReportId}`, {
            headers: ph,
            data: {}
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/no fields to update/i);
    });

    test('should delete the report and return success message', async ({ request }) => {
        if (!createdReportId) test.skip();
        const ph = await getPostHeaders(request);
        const res = await request.delete(`${BASE_URL}/api/reports/${createdReportId}`, {
            headers: ph
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.message).toMatch(/deleted/i);
    });

    test('should return 404 when getting a deleted report', async ({ request }) => {
        if (!createdReportId) test.skip();
        const res = await request.get(`${BASE_URL}/api/reports/${createdReportId}`, { headers });
        expect(res.status()).toBe(404);
    });
});

// ── POST /api/reports/from-template ──────────────────────────────────────────

test.describe('POST /api/reports/from-template', () => {
    test.describe.configure({ mode: 'serial' });

    let fromTemplateReportId;

    test('should create a report from template monthly-sales and return 201', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/reports/from-template`, {
            headers: ph,
            data: { template_id: 'monthly-sales' }
        });
        expect(res.status()).toBe(201);
        const data = await res.json();
        expect(data.report).toBeDefined();
        expect(data.report.name).toBe('Monthly Sales Summary');
        expect(data.message).toMatch(/monthly sales summary/i);
        fromTemplateReportId = data.report.id;
    });

    test('should return 400 when template_id is missing', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/reports/from-template`, {
            headers: ph,
            data: {}
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/template_id is required/i);
    });

    test('should return 404 when template_id does not exist', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/reports/from-template`, {
            headers: ph,
            data: { template_id: 'nonexistent-template-xyz' }
        });
        expect(res.status()).toBe(404);
        const data = await res.json();
        expect(data.error).toMatch(/not found/i);
    });

    test.afterAll(async ({ request }) => {
        if (!fromTemplateReportId) return;
        const ph = await getPostHeaders(request);
        await request.delete(`${BASE_URL}/api/reports/${fromTemplateReportId}`, { headers: ph });
    });
});

// ── POST /api/reports/generate ────────────────────────────────────────────────

test.describe('POST /api/reports/generate', () => {
    test('should return widgetData object when valid widget types are provided', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/reports/generate`, {
            headers: ph,
            data: {
                widgets: [{ type: 'inventory_value' }, { type: 'sell_through_rate' }]
            }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.widgetData).toBeDefined();
        expect(data.widgetData.inventory_value).toBeDefined();
        expect(data.widgetData.sell_through_rate).toBeDefined();
    });

    test('should return empty widgetData when no widgets are provided', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/reports/generate`, {
            headers: ph,
            data: { widgets: [] }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.widgetData).toBe('object');
    });
});

// ── GET /api/reports/pnl — error contract ────────────────────────────────────

test.describe('GET /api/reports/pnl', () => {
    test('should return 400 when startDate and endDate query params are missing', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/reports/pnl`, { headers });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/startDate and endDate/i);
    });

    test('should return P&L data with lineItems and totals when dates are provided', async ({ request }) => {
        const res = await request.get(
            `${BASE_URL}/api/reports/pnl?startDate=2025-01-01&endDate=2025-12-31`,
            { headers }
        );
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.lineItems)).toBe(true);
        expect(data.totals).toHaveProperty('net_profit');
        expect(data.totals).toHaveProperty('revenue');
    });
});

// ── POST /api/reports/query — admin guard ─────────────────────────────────────

test.describe('POST /api/reports/query — admin guard', () => {
    test('should return 403 when non-admin user attempts custom SQL query', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/reports/query`, {
            headers: ph,
            data: { sql: 'SELECT id FROM inventory' }
        });
        // Demo user is not admin — should return 403
        expect(res.status()).toBe(403);
        const data = await res.json();
        expect(data.error).toMatch(/admin access required/i);
    });
});
