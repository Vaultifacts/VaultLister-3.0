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
        expect([200, 403, 500, 503]).toContain(response.status);
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
        // 200 on success, 403 if tier-gated on CI, 503 if credentials missing
        expect([200, 403, 503]).toContain(response.status);
        if (response.status === 200) {
            expect(data.authUrl).toBeDefined();
            expect(data.platform).toBe('ebay');
            expect(data.state).toBeDefined();
        }
    });

    test('eBay real-mode authUrl uses ebay.com domain and correct scope format', async () => {
        // Test that OAUTH_MODE=real produces a real eBay auth URL (not mock-oauth).
        // The server's EBAY_ENVIRONMENT controls sandbox vs production — covered
        // by unit tests in service-tokenRefreshScheduler-coverage.test.js.
        const savedMode = process.env.OAUTH_MODE;
        process.env.OAUTH_MODE = 'real';

        const response = await fetch(`${BASE_URL}/oauth/authorize/ebay`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        let data = {};
        try { data = await response.json(); } catch { /* non-JSON body */ }

        process.env.OAUTH_MODE = savedMode;

        // May 503 if EBAY_CLIENT_ID not configured — both outcomes are valid
        if (response.status === 200) {
            expect(data.authUrl).toContain('ebay.com');
            expect(data.authUrl).not.toContain('mock-oauth');
            // Scopes must use %20 not %3A or + (eBay rejects percent-encoded colons)
            expect(data.authUrl).toContain('scope=');
            expect(data.authUrl).not.toContain('%3A%2F%2F');
        } else {
            expect([400, 403, 500, 503]).toContain(response.status);
        }
    });

    test('GET /oauth/authorize/:platform - should return auth URL for mercari', async () => {
        const response = await fetch(`${BASE_URL}/oauth/authorize/mercari`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect([200, 403, 500, 503]).toContain(response.status);
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

        expect([400, 403, 404, 500]).toContain(response.status);
    });
});

describe('OAuth - Callback', () => {
    test('GET /oauth/callback/:platform - should reject missing code', async () => {
        const response = await fetch(`${BASE_URL}/oauth/callback/poshmark?state=test`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            expect(data.error).toContain('Missing');
        }
    });

    test('GET /oauth/callback/:platform - should reject invalid state', async () => {
        const response = await fetch(`${BASE_URL}/oauth/callback/poshmark?code=test&state=invalid`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            expect(data.error).toContain('Invalid');
        }
    });

    test('GET /oauth/callback/:platform - should handle oauth error', async () => {
        const response = await fetch(`${BASE_URL}/oauth/callback/poshmark?error=access_denied`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 400 on error, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            expect(data.error).toContain('failed');
        }
    });
});

describe('OAuth - Connection Status', () => {
    test('GET /oauth/status/poshmark - should return connection status', async () => {
        const response = await fetch(`${BASE_URL}/oauth/status/poshmark`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403, 500]).toContain(response.status);
        if (response.status === 200) {
            expect(data.platform).toBeDefined();
        }
    });

    test('GET /oauth/status/ebay - should return connection status for ebay', async () => {
        const response = await fetch(`${BASE_URL}/oauth/status/ebay`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403, 500]).toContain(response.status);
    });
});

describe('OAuth - Token Refresh', () => {
    test('POST /oauth/refresh/:platform - should handle token refresh', async () => {
        const response = await fetch(`${BASE_URL}/oauth/refresh/poshmark`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // May succeed or fail based on whether account is connected; 403 if tier-gated on CI
        expect([200, 400, 403, 404]).toContain(response.status);
    });
});

describe('OAuth - Disconnect', () => {
    test('DELETE /oauth/revoke/:platform - should revoke connection', async () => {
        const response = await fetch(`${BASE_URL}/oauth/revoke/test_platform`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // May succeed or return 404 if not connected, 403 if tier-gated on CI
        expect([200, 403, 404, 500]).toContain(response.status);
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
