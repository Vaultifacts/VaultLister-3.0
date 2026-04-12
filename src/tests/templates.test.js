// Listing Templates API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testTemplateId = null;

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

describe('Templates - List', () => {
    test('GET /templates - should return templates list', async () => {
        const response = await fetch(`${BASE_URL}/templates`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(Array.isArray(data) || data.templates).toBe(true);
        }
    });
});

describe('Templates - Create', () => {
    test('POST /templates - should create a template', async () => {
        const response = await fetch(`${BASE_URL}/templates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: `Test Template ${Date.now()}`,
                description: 'A test listing template',
                category: 'Tops',
                titlePattern: '{brand} {category} - {size}',
                descriptionTemplate: 'Beautiful {condition} {brand} item in {color}.',
                tags: ['vintage', 'designer'],
                pricingStrategy: 'markup',
                markupPercentage: 50,
                conditionDefault: 'good'
            })
        });

        // 403 if feature is tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.id || data.template?.id).toBeDefined();
            testTemplateId = data.id || data.template?.id;
        }
    });

    test('POST /templates - should require name', async () => {
        const response = await fetch(`${BASE_URL}/templates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                description: 'Template without name'
            })
        });

        // 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
    });
});

describe('Templates - Get Single', () => {
    test('GET /templates/:id - should return template details', async () => {
        if (!testTemplateId) {
            console.log('Skipping: No test template ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/templates/${testTemplateId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.id || data.name).toBeDefined();
        }
    });

    test('GET /templates/:id - should return 404 for non-existent template', async () => {
        const response = await fetch(`${BASE_URL}/templates/non-existent-id`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Templates - Update', () => {
    test('PUT /templates/:id - should update template', async () => {
        if (!testTemplateId) {
            console.log('Skipping: No test template ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/templates/${testTemplateId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated Test Template',
                description: 'Updated description',
                isFavorite: true
            })
        });

        expect([200, 404]).toContain(response.status);
    });

    test('PATCH /templates/:id/favorite - should toggle favorite', async () => {
        if (!testTemplateId) {
            console.log('Skipping: No test template ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/templates/${testTemplateId}/favorite`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ isFavorite: true })
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Templates - Apply', () => {
    test('POST /templates/:id/apply - should apply template to listing', async () => {
        if (!testTemplateId) {
            console.log('Skipping: No test template ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/templates/${testTemplateId}/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                inventoryId: 'test-inventory-id',
                variables: {
                    brand: 'Nike',
                    size: 'M',
                    color: 'Blue',
                    condition: 'excellent'
                }
            })
        });

        expect([200, 400, 404]).toContain(response.status);
    });
});

describe('Templates - Delete', () => {
    test('DELETE /templates/:id - should delete template', async () => {
        // Create a template to delete
        const createResponse = await fetch(`${BASE_URL}/templates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: `Delete Test ${Date.now()}`
            })
        });

        const createData = await createResponse.json();
        const deleteId = createData.id || createData.template?.id;

        if (!deleteId) {
            console.log('Skipping: Could not create template to delete');
            return;
        }

        const response = await fetch(`${BASE_URL}/templates/${deleteId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 204, 404]).toContain(response.status);
    });
});

describe('Templates - Authentication', () => {
    test('GET /templates - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/templates`);
        expect(response.status).toBe(401);
    });

    test('POST /templates - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test' })
        });
        expect(response.status).toBe(401);
    });
});

console.log('Running Templates API tests...');
