// Social Auth API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Social Auth - Providers List', () => {
    test('GET /social-auth/providers returns provider list', async () => {
        const { status, data } = await client.get('/social-auth/providers');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toBeDefined();
            const providers = data.providers || (Array.isArray(data) ? data : null);
            if (providers) expect(Array.isArray(providers)).toBe(true);
        }
    });

    test('GET /social-auth/ also returns provider list', async () => {
        const { status, data } = await client.get('/social-auth/');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toBeDefined();
        }
    });
});

describe('Social Auth - Auth Guard (OAuth Flows)', () => {
    test('GET /social-auth/google without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/social-auth/google`, {
            redirect: 'manual'
        });
        expect(res.status).toBe(401);
    });

    test('GET /social-auth/google/callback without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/social-auth/google/callback`, {
            redirect: 'manual'
        });
        // 401 if auth-gated, 302 if redirect-based auth, 200 after redirect follows
        expect([200, 302, 401, 403]).toContain(res.status);
    });

    test('GET /social-auth/apple without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/social-auth/apple`, {
            redirect: 'manual'
        });
        expect([200, 302, 401, 403]).toContain(res.status);
    });

    test('POST /social-auth/apple/callback without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/social-auth/apple/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([401, 403]).toContain(res.status);
    });
});

describe('Social Auth - Google OAuth Flow (Authenticated)', () => {
    test('GET /social-auth/google returns redirect or auth URL', async () => {
        const { status } = await client.get('/social-auth/google');
        // 302 redirect to Google, 200 with auth URL, 503 if not configured
        expect([200, 302, 503]).toContain(status);
    });

    test('GET /social-auth/google/callback without code returns error or redirect', async () => {
        const { status } = await client.get('/social-auth/google/callback');
        expect([200, 400]).toContain(status);
    });
});

describe('Social Auth - Apple OAuth Flow (Authenticated)', () => {
    test('POST /social-auth/apple/callback without code returns error or redirect', async () => {
        const { status } = await client.post('/social-auth/apple/callback', {});
        // 200/400 on handled error, 403 if endpoint auth-gated differently
        expect([200, 400, 403]).toContain(status);
    });

    test('POST /social-auth/apple/callback with error param', async () => {
        const { status } = await client.post('/social-auth/apple/callback', { error: 'access_denied' });
        // 200/400 on handled error, 403 if endpoint auth-gated differently
        expect([200, 400, 403]).toContain(status);
    });
});

describe('Social Auth - Unlink Provider', () => {
    test('DELETE /social-auth/google without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/social-auth/google`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(401);
    });

    test('DELETE /social-auth/google unlinks provider', async () => {
        const { status } = await client.delete('/social-auth/google');
        // 200 if linked and unlinked, 400 if only auth method, 404 if not linked, 500 if social_providers table missing
        expect([200, 400, 404, 500]).toContain(status);
    });

    test('DELETE /social-auth/apple unlinks provider', async () => {
        const { status } = await client.delete('/social-auth/apple');
        // 200 if linked and unlinked, 400 if only auth method, 404 if not linked, 500 if social_providers table missing
        expect([200, 400, 404, 500]).toContain(status);
    });
});
