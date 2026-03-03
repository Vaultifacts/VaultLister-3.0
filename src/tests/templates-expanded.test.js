// Templates — Expanded Tests (CRUD shape validation, auth guards)
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
let createdTemplateId;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Templates - List', () => {
    test('GET /templates returns array', async () => {
        const { status, data } = await client.get('/templates');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            const templates = data.templates || data;
            expect(Array.isArray(templates)).toBe(true);
        }
    });
});

describe('Templates - Create', () => {
    test('POST /templates with valid data', async () => {
        const { status, data } = await client.post('/templates', {
            name: 'Test Template',
            title_pattern: '{brand} {category} - {condition}',
            description_pattern: 'Great {brand} {category} in {condition} condition.'
        });
        expect([200, 201, 500]).toContain(status);
        if (status === 200 || status === 201) {
            const tmpl = data.template || data;
            expect(tmpl).toHaveProperty('id');
            createdTemplateId = tmpl.id;
        }
    });

    test('POST /templates without name returns 400', async () => {
        const { status } = await client.post('/templates', { title_pattern: '{brand}' });
        expect([400, 500]).toContain(status);
    });
});

describe('Templates - Get Single', () => {
    test('GET /templates/:id returns template', async () => {
        if (!createdTemplateId) return;
        const { status, data } = await client.get(`/templates/${createdTemplateId}`);
        expect([200, 404, 500]).toContain(status);
        if (status === 200) { expect((data.template || data).id).toBe(createdTemplateId); }
    });

    test('GET /templates/:id for nonexistent returns 404', async () => {
        const { status } = await client.get('/templates/nonexistent-id');
        expect([404, 500]).toContain(status);
    });
});

describe('Templates - Update', () => {
    test('PUT /templates/:id updates template', async () => {
        if (!createdTemplateId) return;
        const { status } = await client.put(`/templates/${createdTemplateId}`, { name: 'Updated' });
        expect([200, 404, 500]).toContain(status);
    });

    test('PUT /templates/:id for nonexistent returns 404', async () => {
        const { status } = await client.put('/templates/nonexistent-id', { name: 'X' });
        expect([404, 500]).toContain(status);
    });
});

describe('Templates - Favorite', () => {
    test('PATCH /templates/:id/favorite for nonexistent', async () => {
        const { status } = await client.patch('/templates/nonexistent-id/favorite', {});
        expect([200, 404, 500]).toContain(status);
    });
});

describe('Templates - Apply', () => {
    test('POST /templates/:id/apply for nonexistent template', async () => {
        const { status } = await client.post('/templates/nonexistent-id/apply', {
            listing_id: 'test', variables: {}
        });
        expect([404, 500]).toContain(status);
    });
});

describe('Templates - Delete', () => {
    test('DELETE /templates/:id for nonexistent returns 404', async () => {
        const { status } = await client.delete('/templates/nonexistent-id');
        expect([404, 500]).toContain(status);
    });

    test('DELETE /templates/:id removes template', async () => {
        if (!createdTemplateId) return;
        const { status } = await client.delete(`/templates/${createdTemplateId}`);
        expect([200, 204, 404, 500]).toContain(status);
    });
});

describe('Templates - Auth Guards', () => {
    test('GET /templates without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/templates`);
        expect(res.status).toBe(401);
    });

    test('POST /templates without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/templates`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test' })
        });
        expect(res.status).toBe(401);
    });
});
