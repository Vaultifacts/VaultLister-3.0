// Email OAuth — Expanded Tests (providers, authorize, accounts, auth guards)
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Email OAuth - Providers', () => {
    test('GET /email/providers returns supported providers', async () => {
        const { status, data } = await client.get('/email/providers');
        expect(status).toBe(200);
        if (status === 200) {
            const providers = data.providers || data;
            expect(Array.isArray(providers) || typeof providers === 'object').toBe(true);
        }
    });
});

describe('Email OAuth - Authorize', () => {
    test('GET /email/authorize/gmail returns auth URL or config error', async () => {
        const { status, data } = await client.get('/email/authorize/gmail');
        expect([200, 400]).toContain(status);
        if (status === 200) {
            expect(data.authorizationUrl || data.authUrl || data.url).toBeDefined();
        }
    });

    test('GET /email/authorize/outlook returns auth URL or config error', async () => {
        const { status } = await client.get('/email/authorize/outlook');
        expect([200, 400]).toContain(status);
    });
});

describe('Email OAuth - Accounts', () => {
    test('GET /email/accounts returns accounts array', async () => {
        const { status, data } = await client.get('/email/accounts');
        expect(status).toBe(200);
        if (status === 200) {
            const accounts = data.accounts || data;
            expect(Array.isArray(accounts)).toBe(true);
        }
    });

    test('PUT /email/accounts/:id nonexistent returns 404', async () => {
        const { status } = await client.put('/email/accounts/nonexistent-id', { enabled: false });
        expect([404]).toContain(status);
    });

    test('DELETE /email/accounts/:id nonexistent returns 404', async () => {
        const { status } = await client.delete('/email/accounts/nonexistent-id');
        expect([404]).toContain(status);
    });
});

describe('Email OAuth - Sync', () => {
    test('POST /email/accounts/:id/sync nonexistent returns 404', async () => {
        const { status } = await client.post('/email/accounts/nonexistent-id/sync', {});
        expect([404]).toContain(status);
    });
});

describe('Email OAuth - Auth Guards', () => {
    test('GET /email/accounts without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/email/accounts`);
        expect(res.status).toBe(401);
    });

    test('GET /email/authorize/gmail without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/email/authorize/gmail`);
        expect(res.status).toBe(401);
    });

    test('DELETE /email/accounts/test without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/email/accounts/test`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(401);
    });
});
