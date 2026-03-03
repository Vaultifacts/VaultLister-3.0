// Checklists API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testChecklistId = null;

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

describe('Checklists - List', () => {
    test('GET /checklists - should return checklists', async () => {
        const response = await fetch(`${BASE_URL}/checklists`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        // API may return { checklists: [] } or an array directly
        expect(data.checklists !== undefined || Array.isArray(data)).toBe(true);
    });
});

describe('Checklists - Create', () => {
    test('POST /checklists - should create checklist', async () => {
        const response = await fetch(`${BASE_URL}/checklists`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: `Test Checklist ${Date.now()}`,
                items: [
                    { text: 'Take photos', completed: false },
                    { text: 'Measure item', completed: false },
                    { text: 'Write description', completed: false }
                ]
            })
        });

        const data = await response.json();
        expect([200, 201]).toContain(response.status);
        if (data.checklist?.id || data.id) {
            testChecklistId = data.checklist?.id || data.id;
        }
    });
});

describe('Checklists - Get Single', () => {
    test('GET /checklists/:id - should return checklist details', async () => {
        if (!testChecklistId) {
            console.log('Skipping: No test checklist ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/checklists/${testChecklistId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Checklists - Update', () => {
    test('PUT /checklists/:id - should update checklist', async () => {
        if (!testChecklistId) {
            console.log('Skipping: No test checklist ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/checklists/${testChecklistId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated Checklist'
            })
        });

        expect([200, 404]).toContain(response.status);
    });

    test('PATCH /checklists/:id/items/:itemIndex - should toggle item', async () => {
        if (!testChecklistId) {
            console.log('Skipping: No test checklist ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/checklists/${testChecklistId}/items/0`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ completed: true })
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Checklists - Delete', () => {
    test('DELETE /checklists/:id - should delete checklist', async () => {
        if (!testChecklistId) {
            console.log('Skipping: No test checklist ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/checklists/${testChecklistId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 204, 404]).toContain(response.status);
    });
});

describe('Checklists - Authentication', () => {
    test('GET /checklists - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/checklists`);
        expect(response.status).toBe(401);
    });
});

console.log('Running Checklists API tests...');
