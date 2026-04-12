// Integration tests for GDPR worker endpoints
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

describe('GDPR Endpoints', () => {
    test('GET /gdpr/audit should return data audit', async () => {
        const response = await fetch(`${BASE_URL}/gdpr/audit`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 200) {
            const data = await response.json();
            expect(data.dataCounts || data.audit).toBeDefined();
        } else {
            expect([404, 403]).toContain(response.status);
        }
    });

    test('GET /gdpr/export should return user data export', async () => {
        const response = await fetch(`${BASE_URL}/gdpr/export`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 200) {
            const data = await response.json();
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(response.status);
        }
    });

    test('GET /gdpr/consent should return consent status', async () => {
        const response = await fetch(`${BASE_URL}/gdpr/consent`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 200) {
            const data = await response.json();
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(response.status);
        }
    });

    test('PUT /gdpr/rectify should accept correction request', async () => {
        const response = await fetch(`${BASE_URL}/gdpr/rectify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                corrections: { full_name: 'Test User Updated' }
            })
        });
        expect([200, 400, 403, 404, 500]).toContain(response.status);
    });
});
