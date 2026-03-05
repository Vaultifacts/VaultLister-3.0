// OAuth API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

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

describe('OAuth - Authorization', () => {
    test('GET /oauth/authorize/:platform - should return auth URL for poshmark', async () => {
        const response = await fetch(`${BASE_URL}/oauth/authorize/poshmark`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect([200, 503]).toContain(response.status);
        if (response.status === 200) {
            expect(data.authUrl).toBeDefined();
            expect(data.state).toBeDefined();
            expect(data.platform).toBe('poshmark');
        } else {
            expect(data.error || data.message).toBeDefined();
        }
    });

    test('GET /oauth/authorize/:platform - should return auth URL for ebay', async () => {
        const response = await fetch(`${BASE_URL}/oauth/authorize/ebay`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.authUrl).toBeDefined();
    });

    test('GET /oauth/authorize/:platform - should return auth URL for mercari', async () => {
        const response = await fetch(`${BASE_URL}/oauth/authorize/mercari`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect([200, 503]).toContain(response.status);
        if (response.status === 200) {
            expect(data.authUrl).toBeDefined();
        } else {
            expect(data.error || data.message).toBeDefined();
        }
    });

    test('GET /oauth/authorize - should require platform', async () => {
        const response = await fetch(`${BASE_URL}/oauth/authorize/`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([400, 404]).toContain(response.status);
    });
});

describe('OAuth - Callback', () => {
    test('GET /oauth/callback/:platform - should reject missing code', async () => {
        const response = await fetch(`${BASE_URL}/oauth/callback/poshmark?state=test`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('Missing');
    });

    test('GET /oauth/callback/:platform - should reject invalid state', async () => {
        const response = await fetch(`${BASE_URL}/oauth/callback/poshmark?code=test&state=invalid`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('Invalid');
    });

    test('GET /oauth/callback/:platform - should handle oauth error', async () => {
        const response = await fetch(`${BASE_URL}/oauth/callback/poshmark?error=access_denied`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('failed');
    });
});

describe('OAuth - Connection Status', () => {
    test('GET /oauth/status/poshmark - should return connection status', async () => {
        const response = await fetch(`${BASE_URL}/oauth/status/poshmark`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.platform).toBeDefined();
    });

    test('GET /oauth/status/ebay - should return connection status for ebay', async () => {
        const response = await fetch(`${BASE_URL}/oauth/status/ebay`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
    });
});

describe('OAuth - Token Refresh', () => {
    test('POST /oauth/refresh/:platform - should handle token refresh', async () => {
        const response = await fetch(`${BASE_URL}/oauth/refresh/poshmark`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // May succeed or fail based on whether account is connected
        expect([200, 400, 404]).toContain(response.status);
    });
});

describe('OAuth - Disconnect', () => {
    test('DELETE /oauth/revoke/:platform - should revoke connection', async () => {
        const response = await fetch(`${BASE_URL}/oauth/revoke/test_platform`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // May succeed or return 404 if not connected
        expect([200, 404]).toContain(response.status);
    });
});

describe('OAuth - Authentication Required', () => {
    test('GET /oauth/authorize/:platform - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/oauth/authorize/poshmark`);
        expect(response.status).toBe(401);
    });

    test('GET /oauth/status/:platform - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/oauth/status/poshmark`);
        expect(response.status).toBe(401);
    });
});

console.log('Running OAuth API tests...');
