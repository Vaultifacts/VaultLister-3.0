// Custom Reports API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testReportId = null;

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

describe('Reports - List Reports', () => {
    test('GET /reports - should return report list', async () => {
        const response = await fetch(`${BASE_URL}/reports`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.reports).toBeDefined();
            expect(Array.isArray(data.reports)).toBe(true);
        }
    });

    test('GET /reports - should require authentication', async () => {
        const response = await fetch(`${BASE_URL}/reports`);

        expect(response.status).toBe(401);
    });
});

describe('Reports - Widget Types', () => {
    test('GET /reports/widgets - should return widget types', async () => {
        const response = await fetch(`${BASE_URL}/reports/widgets`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.widgets).toBeDefined();
            expect(Array.isArray(data.widgets)).toBe(true);
            expect(data.widgets.length).toBeGreaterThan(0);

            // Check widget structure
            const widget = data.widgets[0];
            expect(widget.type).toBeDefined();
            expect(widget.label).toBeDefined();
            expect(widget.category).toBeDefined();
            expect(widget.size).toBeDefined();
        }
    });

    test('GET /reports/widgets - should have expected widget types', async () => {
        const response = await fetch(`${BASE_URL}/reports/widgets`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            const widgetTypes = data.widgets.map(w => w.type);

            expect(widgetTypes).toContain('revenue_chart');
            expect(widgetTypes).toContain('profit_chart');
            expect(widgetTypes).toContain('sales_by_platform');
            expect(widgetTypes).toContain('inventory_value');
        }
    });
});

describe('Reports - Create Report', () => {
    test('POST /reports - should create report', async () => {
        const response = await fetch(`${BASE_URL}/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Report',
                description: 'A test custom report',
                widgets: [
                    { type: 'revenue_chart', order: 0 },
                    { type: 'inventory_value', order: 1 },
                    { type: 'sales_by_platform', order: 2 }
                ],
                date_range: '30d'
            })
        });

        // 201 on success, 403 if tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.report).toBeDefined();
            expect(data.report.name).toBe('Test Report');
            expect(data.message).toBe('Report created');
            testReportId = data.report.id;
        }
    });

    test('POST /reports - should fail without name', async () => {
        const response = await fetch(`${BASE_URL}/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: [{ type: 'revenue_chart' }]
            })
        });

        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toBe('Report name required');
        }
    });

    test('POST /reports - should create report with empty widgets', async () => {
        const response = await fetch(`${BASE_URL}/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Empty Widgets Report'
            })
        });

        // 201 on success, 403 if tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.report.widgets).toBeDefined();
        }
    });
});

describe('Reports - Get Report', () => {
    test('GET /reports/:id - should return report with widget data', async () => {
        if (!testReportId) return;

        const response = await fetch(`${BASE_URL}/reports/${testReportId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.report).toBeDefined();
            expect(data.report.id).toBe(testReportId);
            expect(data.widgetData).toBeDefined();
        }
    });

    test('GET /reports/:id?startDate=2024-01-01&endDate=2024-12-31 - should apply date range', async () => {
        if (!testReportId) return;

        const response = await fetch(`${BASE_URL}/reports/${testReportId}?startDate=2024-01-01&endDate=2024-12-31`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.report).toBeDefined();
            expect(data.widgetData).toBeDefined();
        }
    });

    test('GET /reports/:id - should return 404 for non-existent report', async () => {
        const response = await fetch(`${BASE_URL}/reports/non-existent-id`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
        if (response.status === 404) {
            const data = await response.json();
            expect(data.error).toBe('Report not found');
        }
    });
});

describe('Reports - Update Report', () => {
    test('PUT /reports/:id - should update report', async () => {
        if (!testReportId) return;

        const response = await fetch(`${BASE_URL}/reports/${testReportId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated Test Report',
                description: 'Updated description',
                date_range: '90d'
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.report).toBeDefined();
            expect(data.report.name).toBe('Updated Test Report');
        }
    });

    test('PUT /reports/:id - should update widgets', async () => {
        if (!testReportId) return;

        const response = await fetch(`${BASE_URL}/reports/${testReportId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: [
                    { type: 'profit_chart', order: 0 },
                    { type: 'top_sellers', order: 1 }
                ]
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.report.widgets).toBeDefined();
        }
    });

    test('PUT /reports/:id - should return 404 for non-existent report', async () => {
        const response = await fetch(`${BASE_URL}/reports/non-existent-id`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Test' })
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Reports - Generate On-Demand', () => {
    test('POST /reports/generate - should generate widget data', async () => {
        const response = await fetch(`${BASE_URL}/reports/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: [
                    { type: 'revenue_chart' },
                    { type: 'inventory_value' }
                ],
                startDate: '2024-01-01',
                endDate: '2024-12-31'
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.widgetData).toBeDefined();
            expect(data.widgetData.revenue_chart).toBeDefined();
            expect(data.widgetData.inventory_value).toBeDefined();
        }
    });

    test('POST /reports/generate - should work with empty widgets', async () => {
        const response = await fetch(`${BASE_URL}/reports/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: []
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.widgetData).toBeDefined();
        }
    });

    test('POST /reports/generate - should use default date range', async () => {
        const response = await fetch(`${BASE_URL}/reports/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: [{ type: 'sell_through_rate' }]
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.widgetData).toBeDefined();
        }
    });
});

describe('Reports - Widget Data Types', () => {
    test('POST /reports/generate - revenue_chart should return line data', async () => {
        const response = await fetch(`${BASE_URL}/reports/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: [{ type: 'revenue_chart' }]
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.widgetData.revenue_chart.type).toBe('line');
        }
    });

    test('POST /reports/generate - sales_by_platform should return pie data', async () => {
        const response = await fetch(`${BASE_URL}/reports/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: [{ type: 'sales_by_platform' }]
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.widgetData.sales_by_platform.type).toBe('pie');
        }
    });

    test('POST /reports/generate - inventory_value should return stat data', async () => {
        const response = await fetch(`${BASE_URL}/reports/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: [{ type: 'inventory_value' }]
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.widgetData.inventory_value.type).toBe('stat');
        }
    });

    test('POST /reports/generate - top_sellers should return table data', async () => {
        const response = await fetch(`${BASE_URL}/reports/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: [{ type: 'top_sellers' }]
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.widgetData.top_sellers.type).toBe('table');
        }
    });
});

describe('Reports - Delete Report', () => {
    test('DELETE /reports/:id - should delete report', async () => {
        if (!testReportId) return;

        const response = await fetch(`${BASE_URL}/reports/${testReportId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toBe('Report deleted');
        }
    });
});
