// Inventory Import Tests
// Tests CSV/JSON upload, job lifecycle, field mappings, templates, and validation.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
let uploadedJobId;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

// ============================================================
// Upload
// ============================================================
describe('Inventory Import - Upload', () => {
    test('POST /inventory-import/upload with CSV data returns 201', async () => {
        const csvData = 'title,sku,list_price,quantity\nTest Item,TST-001,25.00,1\nAnother Item,TST-002,50.00,2';
        const { status, data } = await client.post('/inventory-import/upload', {
            source_type: 'csv',
            data: csvData,
            has_header_row: true,
            name: `Import-${Date.now()}`
        });
        expect([201]).toContain(status);
        if (status === 201) {
            expect(data.id).toBeDefined();
            expect(data.preview).toBeDefined();
            uploadedJobId = data.id;
        }
    });

    test('POST /inventory-import/upload with JSON data returns 201', async () => {
        const jsonData = [
            { title: 'JSON Item 1', sku: 'JSON-001', list_price: 30, quantity: 1 },
            { title: 'JSON Item 2', sku: 'JSON-002', list_price: 60, quantity: 3 }
        ];
        const { status, data } = await client.post('/inventory-import/upload', {
            source_type: 'json',
            data: jsonData,
            name: `JSON-Import-${Date.now()}`
        });
        expect([201]).toContain(status);
    });

    test('POST /inventory-import/upload without source_type returns 400', async () => {
        const { status } = await client.post('/inventory-import/upload', {
            data: 'title,sku\nItem,SKU-1'
        });
        expect([400]).toContain(status);
    });

    test('POST /inventory-import/upload without data returns 400', async () => {
        const { status } = await client.post('/inventory-import/upload', {
            source_type: 'csv'
        });
        expect([400]).toContain(status);
    });

    test('POST /inventory-import/upload with invalid source_type returns 400', async () => {
        const { status } = await client.post('/inventory-import/upload', {
            source_type: 'xlsx',
            data: 'title\nItem'
        });
        expect([400]).toContain(status);
    });
});

// ============================================================
// Jobs List
// ============================================================
describe('Inventory Import - Jobs List', () => {
    test('GET /inventory-import/jobs returns array', async () => {
        const { status, data } = await client.get('/inventory-import/jobs');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data.jobs).toBeDefined();
            expect(Array.isArray(data.jobs)).toBe(true);
        }
    });

    test('GET /inventory-import/jobs/:id for nonexistent returns 404', async () => {
        const { status } = await client.get('/inventory-import/jobs/00000000-0000-0000-0000-000000000000');
        expect([404]).toContain(status);
    });

    test('GET /inventory-import/jobs/:id returns job if created', async () => {
        if (!uploadedJobId) return;
        const { status, data } = await client.get(`/inventory-import/jobs/${uploadedJobId}`);
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data.job).toBeDefined();
            expect(data.job.id).toBe(uploadedJobId);
        }
    });
});

// ============================================================
// Field Mapping
// ============================================================
describe('Inventory Import - Field Mapping', () => {
    test('POST /inventory-import/jobs/:id/mapping with valid mapping', async () => {
        if (!uploadedJobId) return;
        const { status } = await client.post(`/inventory-import/jobs/${uploadedJobId}/mapping`, {
            field_mapping: { title: 'title', sku: 'sku', listPrice: 'list_price', quantity: 'quantity' }
        });
        expect([200, 403]).toContain(status);
    });

    test('POST /inventory-import/jobs/:id/mapping without field_mapping returns 400', async () => {
        if (!uploadedJobId) return;
        const { status } = await client.post(`/inventory-import/jobs/${uploadedJobId}/mapping`, {});
        expect([400]).toContain(status);
    });

    test('POST /inventory-import/jobs/nonexistent/mapping returns 404', async () => {
        const { status } = await client.post('/inventory-import/jobs/00000000-0000-0000-0000-000000000000/mapping', {
            field_mapping: { title: 'title' }
        });
        expect([404]).toContain(status);
    });
});

// ============================================================
// Validate & Execute
// ============================================================
describe('Inventory Import - Validate & Execute', () => {
    test('POST /inventory-import/jobs/:id/validate runs validation', async () => {
        if (!uploadedJobId) return;
        const { status, data } = await client.post(`/inventory-import/jobs/${uploadedJobId}/validate`);
        expect([200, 400]).toContain(status);
        if (status === 200) {
            expect(typeof data.valid).toBe('number');
            expect(typeof data.total).toBe('number');
        }
    });

    test('POST /inventory-import/jobs/:id/execute runs import', async () => {
        if (!uploadedJobId) return;
        const { status, data } = await client.post(`/inventory-import/jobs/${uploadedJobId}/execute`, {
            update_existing: false,
            skip_duplicates: true
        });
        expect([200, 400]).toContain(status);
        if (status === 200) {
            expect(typeof data.imported).toBe('number');
            expect(typeof data.total).toBe('number');
        }
    });
});

// ============================================================
// Cancel & Delete
// ============================================================
describe('Inventory Import - Cancel & Delete', () => {
    test('POST /inventory-import/jobs/nonexistent/cancel returns 404', async () => {
        const { status } = await client.post('/inventory-import/jobs/00000000-0000-0000-0000-000000000000/cancel');
        expect([404]).toContain(status);
    });

    test('DELETE /inventory-import/jobs/nonexistent returns 404', async () => {
        const { status } = await client.delete('/inventory-import/jobs/00000000-0000-0000-0000-000000000000');
        expect([404]).toContain(status);
    });
});

// ============================================================
// Saved Mappings CRUD
// ============================================================
describe('Inventory Import - Saved Mappings', () => {
    test('GET /inventory-import/mappings returns array', async () => {
        const { status, data } = await client.get('/inventory-import/mappings');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data.mappings).toBeDefined();
            expect(Array.isArray(data.mappings)).toBe(true);
        }
    });

    test('POST /inventory-import/mappings creates template', async () => {
        const { status, data } = await client.post('/inventory-import/mappings', {
            name: `Template-${Date.now()}`,
            field_mapping: { title: 'Title', sku: 'SKU', listPrice: 'Price' }
        });
        expect([201]).toContain(status);
        if (status === 201) {
            expect(data.id).toBeDefined();
        }
    });

    test('DELETE /inventory-import/mappings/nonexistent returns 404', async () => {
        const { status } = await client.delete('/inventory-import/mappings/00000000-0000-0000-0000-000000000000');
        expect([404]).toContain(status);
    });
});

// ============================================================
// Templates & Helpers
// ============================================================
describe('Inventory Import - Templates & Helpers', () => {
    test('GET /inventory-import/templates/download returns template content', async () => {
        const { status, data } = await client.get('/inventory-import/templates/download');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data.content).toBeDefined();
            expect(data.filename).toBeDefined();
            expect(data.headers).toBeDefined();
        }
    });

    test('GET /inventory-import/field-options returns fields array', async () => {
        const { status, data } = await client.get('/inventory-import/field-options');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data.fields).toBeDefined();
            expect(Array.isArray(data.fields)).toBe(true);
            if (data.fields.length > 0) {
                expect(data.fields[0]).toHaveProperty('name');
                expect(data.fields[0]).toHaveProperty('label');
            }
        }
    });
});

// ============================================================
// Auth Guard
// ============================================================
describe('Inventory Import - Auth Guard', () => {
    test('unauthenticated upload returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.post('/inventory-import/upload', { source_type: 'csv', data: 'x' });
        expect(status).toBe(401);
    });

    test('unauthenticated jobs list returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/inventory-import/jobs');
        expect(status).toBe(401);
    });
});
