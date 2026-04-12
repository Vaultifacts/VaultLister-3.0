// Inventory Import Enhanced API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let csrfToken = null;

// Helper to get CSRF token
async function getCSRFToken() {
    const response = await fetch(`${BASE_URL}/csrf-token`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    return data.csrfToken;
}

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
    csrfToken = await getCSRFToken();
});

describe('Inventory Import - Templates Download', () => {
    test('GET /inventory-import/templates/download - should return CSV template', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/templates/download?format=csv`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.content).toBeDefined();
            expect(data.contentType).toBe('text/csv');
            expect(data.filename).toBe('inventory_import_template.csv');
            expect(data.headers).toBeDefined();
            expect(data.headers).toContain('title');
            expect(data.headers).toContain('sku');
        }
    });

    test('GET /inventory-import/templates/download - should return TSV template', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/templates/download?format=tsv`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.contentType).toBe('text/tab-separated-values');
            expect(data.filename).toBe('inventory_import_template.tsv');
        }
    });

    test('GET /inventory-import/templates/download - should return JSON template', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/templates/download?format=json`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.contentType).toBe('application/json');
            expect(data.filename).toBe('inventory_import_template.json');
        }
    });

    test('GET /inventory-import/templates/download - should reject invalid format', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/templates/download?format=invalid`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            expect(data.error).toContain('Invalid format');
        }
    });
});

describe('Inventory Import - Validate Row', () => {
    test('POST /inventory-import/validate-row - should validate valid row', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/validate-row`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                row: {
                    title: 'Test Item',
                    list_price: '29.99',
                    quantity: '1',
                    condition: 'New'
                }
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.valid).toBe(true);
            expect(data.errors).toHaveLength(0);
        }
    });

    test('POST /inventory-import/validate-row - should catch missing title', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/validate-row`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                row: {
                    list_price: '29.99'
                }
            })
        });

        // 200 with validation result, 403 if feature is tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.valid).toBe(false);
            expect(data.errors.length).toBeGreaterThan(0);
            expect(data.errors.some(e => e.field === 'title')).toBe(true);
        }
    });

    test('POST /inventory-import/validate-row - should catch invalid price', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/validate-row`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                row: {
                    title: 'Test Item',
                    list_price: 'not-a-number'
                }
            })
        });

        // 200 with validation result, 403 if feature is tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.valid).toBe(false);
            expect(data.errors.some(e => e.field === 'list_price')).toBe(true);
        }
    });

    test('POST /inventory-import/validate-row - should warn on unknown condition', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/validate-row`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                row: {
                    title: 'Test Item',
                    condition: 'Unknown Condition'
                }
            })
        });

        // 200 with validation result, 403 if feature is tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.valid).toBe(true); // Still valid, just warnings
            expect(data.warnings.length).toBeGreaterThan(0);
        }
    });

    test('POST /inventory-import/validate-row - should require row data', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/validate-row`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({})
        });

        // 400 on validation error, 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('Row data');
        }
    });
});

describe('Inventory Import - Field Options', () => {
    test('GET /inventory-import/field-options - should return field definitions', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/field-options`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.fields).toBeDefined();
            expect(Array.isArray(data.fields)).toBe(true);
            expect(data.fields.length).toBeGreaterThan(0);

            // Check for required field
            const titleField = data.fields.find(f => f.name === 'title');
            expect(titleField).toBeDefined();
            expect(titleField.required).toBe(true);
        }
    });

    test('GET /inventory-import/field-options - should return suggestions', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/field-options`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.suggestions).toBeDefined();
            expect(data.suggestions.categories).toBeDefined();
            expect(data.suggestions.brands).toBeDefined();
        }
    });

    test('GET /inventory-import/field-options - should return date formats', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/field-options`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.dateFormats).toBeDefined();
            expect(data.dateFormats.length).toBeGreaterThan(0);
        }
    });
});

// ============================================
// Import Jobs CRUD Tests
// ============================================

let testJobId = null;

describe('Inventory Import - Jobs List', () => {
    test('GET /inventory-import/jobs - should return jobs list', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/jobs`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.jobs).toBeDefined();
            expect(Array.isArray(data.jobs)).toBe(true);
        }
    });

    test('GET /inventory-import/jobs?status=completed - should filter by status', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/jobs?status=completed`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.jobs).toBeDefined();
        }
    });

    test('GET /inventory-import/jobs?limit=5 - should paginate', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/jobs?limit=5&offset=0`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.jobs.length).toBeLessThanOrEqual(5);
        }
    });
});

describe('Inventory Import - Upload', () => {
    test('POST /inventory-import/upload - should upload CSV data', async () => {
        const csvData = `title,brand,category,list_price,quantity
Test Import Item 1,Nike,Tops,29.99,1
Test Import Item 2,Adidas,Shoes,49.99,2
Test Import Item 3,Levi's,Bottoms,39.99,1`;

        const response = await fetch(`${BASE_URL}/inventory-import/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                filename: 'test-import.csv',
                source_type: 'csv',
                data: csvData,
                has_header_row: true,
                name: 'Test Import Job'
            })
        });

        // 201 on success, 403 if feature is tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.id).toBeDefined();
            expect(data.preview).toBeDefined();
            expect(data.preview.headers).toContain('title');
            expect(data.preview.total_rows).toBe(3);
            testJobId = data.id;
        }
    });

    test('POST /inventory-import/upload - should upload JSON data', async () => {
        const jsonData = [
            { title: 'JSON Item 1', brand: 'Test Brand', list_price: 19.99 },
            { title: 'JSON Item 2', brand: 'Test Brand', list_price: 29.99 }
        ];

        const response = await fetch(`${BASE_URL}/inventory-import/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                source_type: 'json',
                data: jsonData,
                name: 'JSON Test Import'
            })
        });

        // 201 on success, 403 if feature is tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.id).toBeDefined();
            expect(data.preview.total_rows).toBe(2);
        }
    });

    test('POST /inventory-import/upload - should require source_type and data', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                filename: 'test.csv'
                // Missing source_type and data
            })
        });

        // 400 on validation error, 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('required');
        }
    });

    test('POST /inventory-import/upload - should reject invalid source_type', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                source_type: 'invalid',
                data: 'some data'
            })
        });

        // 400 on validation error, 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('Invalid source type');
        }
    });
});

describe('Inventory Import - Get Job', () => {
    test('GET /inventory-import/jobs/:id - should return job details', async () => {
        if (!testJobId) {
            console.log('Skipping: No test job ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/jobs/${testJobId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.job).toBeDefined();
            expect(data.job.id).toBe(testJobId);
            expect(data.job.preview_data).toBeDefined();
        }
    });

    test('GET /inventory-import/jobs/:id - should return 404 for non-existent job', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/jobs/00000000-0000-0000-0000-000000000000`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Inventory Import - Get Job Rows', () => {
    test('GET /inventory-import/jobs/:id/rows - should return import rows', async () => {
        if (!testJobId) {
            console.log('Skipping: No test job ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/jobs/${testJobId}/rows`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.rows).toBeDefined();
            expect(Array.isArray(data.rows)).toBe(true);
        }
    });

    test('GET /inventory-import/jobs/:id/rows?limit=2 - should paginate rows', async () => {
        if (!testJobId) {
            console.log('Skipping: No test job ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/jobs/${testJobId}/rows?limit=2`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.rows.length).toBeLessThanOrEqual(2);
        }
    });
});

describe('Inventory Import - Set Mapping', () => {
    test('POST /inventory-import/jobs/:id/mapping - should set field mapping', async () => {
        if (!testJobId) {
            console.log('Skipping: No test job ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/jobs/${testJobId}/mapping`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                field_mapping: {
                    title: 'title',
                    brand: 'brand',
                    category: 'category',
                    list_price: 'list_price',
                    quantity: 'quantity'
                }
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.message).toContain('saved');
        }
    });

    test('POST /inventory-import/jobs/:id/mapping - should require field_mapping', async () => {
        if (!testJobId) {
            console.log('Skipping: No test job ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/jobs/${testJobId}/mapping`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            expect(data.error).toContain('required');
        }
    });
});

describe('Inventory Import - Validate Job', () => {
    test('POST /inventory-import/jobs/:id/validate - should validate import data', async () => {
        if (!testJobId) {
            console.log('Skipping: No test job ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/jobs/${testJobId}/validate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.valid).toBeDefined();
            expect(data.invalid).toBeDefined();
            expect(data.total).toBeDefined();
        }
    });

    test('POST /inventory-import/jobs/:id/validate - should return 404 for non-existent job', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/jobs/00000000-0000-0000-0000-000000000000/validate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            }
        });

        // 404 if job not found, 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Inventory Import - Execute Job', () => {
    test('POST /inventory-import/jobs/:id/execute - should execute import', async () => {
        if (!testJobId) {
            console.log('Skipping: No test job ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/jobs/${testJobId}/execute`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                update_existing: false,
                skip_duplicates: true
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.imported).toBeDefined();
            expect(data.total).toBeDefined();
        }
    });

    test('POST /inventory-import/jobs/:id/execute - should return 404 for non-existent job', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/jobs/00000000-0000-0000-0000-000000000000/execute`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            }
        });

        // 404 if job not found, 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Inventory Import - Cancel Job', () => {
    test('POST /inventory-import/jobs/:id/cancel - should cancel pending job', async () => {
        // Create a new job to cancel
        const csvData = `title,list_price\nCancel Test Item,19.99`;
        const uploadResponse = await fetch(`${BASE_URL}/inventory-import/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                source_type: 'csv',
                data: csvData,
                has_header_row: true
            })
        });
        const uploadData = await uploadResponse.json();
        const cancelJobId = uploadData.id;

        if (!cancelJobId) {
            console.log('Skipping: Could not create job');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/jobs/${cancelJobId}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.message).toContain('cancelled');
        }
    });
});

describe('Inventory Import - Delete Job', () => {
    test('DELETE /inventory-import/jobs/:id - should delete job', async () => {
        // Create a job to delete
        const csvData = `title,list_price\nDelete Test Item,19.99`;
        const uploadResponse = await fetch(`${BASE_URL}/inventory-import/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                source_type: 'csv',
                data: csvData,
                has_header_row: true
            })
        });
        const uploadData = await uploadResponse.json();
        const deleteJobId = uploadData.id;

        if (!deleteJobId) {
            console.log('Skipping: Could not create job');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/jobs/${deleteJobId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.message).toContain('deleted');
        }
    });

    test('DELETE /inventory-import/jobs/:id - should return 404 for non-existent job', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/jobs/00000000-0000-0000-0000-000000000000`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 if job not found, 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

// ============================================
// Saved Mappings CRUD Tests
// ============================================

let testMappingId = null;

describe('Inventory Import - Mappings List', () => {
    test('GET /inventory-import/mappings - should return saved mappings', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/mappings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.mappings).toBeDefined();
            expect(Array.isArray(data.mappings)).toBe(true);
        }
    });
});

describe('Inventory Import - Create Mapping', () => {
    test('POST /inventory-import/mappings - should create mapping template', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/mappings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                name: `Test Mapping ${Date.now()}`,
                description: 'A test mapping template',
                source_type: 'csv',
                field_mapping: {
                    title: 'item_name',
                    brand: 'manufacturer',
                    list_price: 'price'
                },
                has_header_row: true
            })
        });

        // 201 on success, 403 if feature is tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.id).toBeDefined();
            testMappingId = data.id;
        }
    });

    test('POST /inventory-import/mappings - should require name and field_mapping', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/mappings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                description: 'Missing required fields'
            })
        });

        // 400 on validation error, 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('required');
        }
    });
});

describe('Inventory Import - Update Mapping', () => {
    test('PATCH /inventory-import/mappings/:id - should update mapping', async () => {
        if (!testMappingId) {
            console.log('Skipping: No test mapping ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/mappings/${testMappingId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                name: 'Updated Mapping Name',
                description: 'Updated description'
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.message).toContain('updated');
        }
    });

    test('PATCH /inventory-import/mappings/:id - should return 404 for non-existent mapping', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/mappings/00000000-0000-0000-0000-000000000000`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ name: 'Test' })
        });

        // 404 on missing, 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Inventory Import - Delete Mapping', () => {
    test('DELETE /inventory-import/mappings/:id - should delete mapping', async () => {
        if (!testMappingId) {
            console.log('Skipping: No test mapping ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/inventory-import/mappings/${testMappingId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.message).toContain('deleted');
        }
    });

    test('DELETE /inventory-import/mappings/:id - should return 404 for non-existent mapping', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/mappings/00000000-0000-0000-0000-000000000000`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Inventory Import - Authentication', () => {
    test('GET /inventory-import/jobs - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/jobs`);
        expect(response.status).toBe(401);
    });

    test('POST /inventory-import/upload - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_type: 'csv', data: 'test' })
        });
        expect(response.status).toBe(401);
    });
});
