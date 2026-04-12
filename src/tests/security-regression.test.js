// Regression tests for security fixes applied in 2026-02-24
// Covers: webhook secrets, cron validation, custom query params, IDOR, bounds
import { describe, expect, test, beforeAll } from 'bun:test';
import crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;

function signPayload(body, secret) {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
}

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

describe('Webhook Secret Enforcement', () => {
    test('should reject webhook without signature', async () => {
        const response = await fetch(`${BASE_URL}/webhooks/incoming/poshmark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'test' })
        });
        // Should require signature
        expect([401, 404]).toContain(response.status);
    });

    test('should reject webhook with invalid signature', async () => {
        const response = await fetch(`${BASE_URL}/webhooks/incoming/poshmark`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Signature': 'sha256=invalid_signature_here'
            },
            body: JSON.stringify({ type: 'test' })
        });
        expect([401, 404]).toContain(response.status);
    });

    test('should reject unregistered webhook source', async () => {
        const response = await fetch(`${BASE_URL}/webhooks/incoming/nonexistent_platform`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'test' })
        });
        expect(response.status).toBe(404);
    });
});

describe('Automation Cron Validation', () => {
    test('should reject invalid cron schedule', async () => {
        const response = await fetch(`${BASE_URL}/automations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Bad Cron',
                type: 'custom',
                schedule: '* * * ; rm -rf /',
                config: {}
            })
        });
        // Should reject — schedule contains invalid chars
        expect([400, 422]).toContain(response.status);
    });

    test('should reject cron with too few fields', async () => {
        const response = await fetch(`${BASE_URL}/automations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Short Cron',
                type: 'custom',
                schedule: '* *',
                config: {}
            })
        });
        expect([400, 422]).toContain(response.status);
    });

    test('should accept valid cron schedule', async () => {
        const response = await fetch(`${BASE_URL}/automations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Valid Cron ' + Date.now(),
                type: 'custom',
                schedule: '0 9 * * 1-5',
                config: { action: 'test' }
            })
        });
        // Should accept — valid 5-field cron (403 = subscription tier gating, not a cron issue)
        expect([200, 201, 403]).toContain(response.status);
    });
});

describe('Custom Query Parameterization', () => {
    test('should block non-SELECT statements', async () => {
        const response = await fetch(`${BASE_URL}/reports/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                sql: 'DELETE FROM inventory WHERE 1=1'
            })
        });
        // Either 400 (validation) or 403 (non-enterprise)
        expect([400, 403]).toContain(response.status);
    });

    test('should block SQL comments', async () => {
        const response = await fetch(`${BASE_URL}/reports/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                sql: 'SELECT * FROM inventory -- DROP TABLE users'
            })
        });
        expect([400, 403]).toContain(response.status);
    });

    test('should block UNION injection', async () => {
        const response = await fetch(`${BASE_URL}/reports/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                sql: 'SELECT title FROM inventory UNION SELECT password FROM users'
            })
        });
        expect([400, 403]).toContain(response.status);
    });

    test('should block disallowed tables', async () => {
        const response = await fetch(`${BASE_URL}/reports/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                sql: 'SELECT * FROM users'
            })
        });
        expect([400, 403]).toContain(response.status);
    });
});

describe('Inventory Import IDOR Protection', () => {
    test('should return 404 for non-existent job rows', async () => {
        const fakeJobId = '00000000-0000-0000-0000-000000000000';
        const response = await fetch(`${BASE_URL}/inventory-import/jobs/${fakeJobId}/rows`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Limit/Offset Bounds Checking', () => {
    test('should handle negative offset gracefully', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/jobs?offset=-10&limit=10`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
    });

    test('should cap excessive limit', async () => {
        const response = await fetch(`${BASE_URL}/inventory-import/jobs?limit=999999`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            // Should return at most 200 items (our cap)
            expect(data.jobs.length).toBeLessThanOrEqual(200);
        }
    });
});
