// Cross-user authorization tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let tokenA = null;
let tokenB = null;

beforeAll(async () => {
    const resA = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' })
    });
    const dataA = await resA.json();
    tokenA = dataA.token;

    const uniqueEmail = `testuser_${Date.now()}@test.com`;
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: uniqueEmail, username: `testuser_${Date.now()}`, password: 'TestPassword123!' })
    });
    const regData = await regRes.json();
    tokenB = regData.token;
});

describe('Cross-User Authorization', () => {
    test('User B cannot access User A inventory', async () => {
        if (!tokenB) return;
        const resA = await fetch(`${BASE_URL}/inventory`, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        const dataA = await resA.json();
        const resB = await fetch(`${BASE_URL}/inventory`, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        const dataB = await resB.json();
        expect(resB.status).toBe(200);
        const itemsB = dataB.items || dataB.inventory || [];
        const itemsA = dataA.items || dataA.inventory || [];
        if (itemsA.length > 0 && itemsB.length > 0) {
            const aIds = new Set(itemsA.map(i => i.id));
            const overlap = itemsB.filter(i => aIds.has(i.id));
            expect(overlap.length).toBe(0);
        }
    });

    test('User B cannot access User A reports', async () => {
        if (!tokenB) return;
        const resB = await fetch(`${BASE_URL}/reports`, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        expect(resB.status).toBe(200);
        const dataB = await resB.json();
        expect((dataB.reports || []).length).toBe(0);
    });

    test('User B cannot access User A webhooks', async () => {
        if (!tokenB) return;
        const resB = await fetch(`${BASE_URL}/webhooks/endpoints`, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        expect(resB.status).toBe(200);
        const dataB = await resB.json();
        expect((Array.isArray(dataB) ? dataB : (dataB.endpoints || [])).length).toBe(0);
    });

    test('Unauthenticated requests are rejected', async () => {
        for (const ep of ['/inventory', '/reports', '/webhooks/endpoints', '/automations']) {
            const res = await fetch(`${BASE_URL}${ep}`);
            expect([401, 403, 404]).toContain(res.status);
        }
    });

    test('Invalid token is rejected', async () => {
        const res = await fetch(`${BASE_URL}/inventory`, {
            headers: { 'Authorization': 'Bearer invalid.token.here' }
        });
        expect([401, 403]).toContain(res.status);
    });
});
