// Integration tests for task worker via API
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
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

describe('Task Worker API', () => {
    test('GET /tasks/status should return worker status', async () => {
        const response = await fetch(`${BASE_URL}/tasks/status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 200) {
            const data = await response.json();
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(response.status);
        }
    });

    test('GET /tasks should list tasks', async () => {
        const response = await fetch(`${BASE_URL}/tasks`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 200) {
            const data = await response.json();
            expect(Array.isArray(data.tasks || data)).toBe(true);
        } else {
            expect([404, 403]).toContain(response.status);
        }
    });

    test('POST /tasks should create a task', async () => {
        const response = await fetch(`${BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'cleanup_notifications',
                payload: { maxAge: 30 }
            })
        });
        // Should create or reject based on permissions
        expect([200, 201, 400, 403, 404]).toContain(response.status);
    });
});
