// Mock OAuth API Tests
import { describe, expect, test } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api/mock-oauth`;

describe('Mock OAuth - Authorize', () => {
    test('GET /:platform/authorize - should return HTML login page', async () => {
        const response = await fetch(`${BASE_URL}/poshmark/authorize?client_id=test&redirect_uri=http://localhost:${process.env.PORT || 3000}/callback&state=test123`);

        expect(response.status).toBe(200);
        const contentType = response.headers.get('content-type');
        expect(contentType).toContain('text/html');

        const html = await response.text();
        expect(html).toContain('Poshmark');
        expect(html).toContain('VaultLister');
        expect(html).toContain('Authorize');
    });

    test('GET /:platform/authorize - should handle different platforms', async () => {
        const platforms = ['ebay', 'whatnot', 'depop', 'mercari', 'shopify'];

        for (const platform of platforms) {
            const response = await fetch(`${BASE_URL}/${platform}/authorize?client_id=test&redirect_uri=http://localhost:${process.env.PORT || 3000}/callback&state=test123`);
            expect(response.status).toBe(200);
        }
    });

    test('GET /:platform/authorize - should fail without required params', async () => {
        const response = await fetch(`${BASE_URL}/poshmark/authorize`);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Missing required parameters');
    });

    test('GET /:platform/authorize - should fail without client_id', async () => {
        const response = await fetch(`${BASE_URL}/poshmark/authorize?redirect_uri=http://localhost:${process.env.PORT || 3000}&state=test`);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Missing required parameters');
    });

    test('GET /:platform/authorize - should fail without redirect_uri', async () => {
        const response = await fetch(`${BASE_URL}/poshmark/authorize?client_id=test&state=test`);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Missing required parameters');
    });

    test('GET /:platform/authorize - should fail without state', async () => {
        const response = await fetch(`${BASE_URL}/poshmark/authorize?client_id=test&redirect_uri=http://localhost:${process.env.PORT || 3000}`);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Missing required parameters');
    });
});

describe('Mock OAuth - Token Exchange', () => {
    test('POST /:platform/token - should return access token', async () => {
        const response = await fetch(`${BASE_URL}/poshmark/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: 'mock_auth_code_test123',
                grant_type: 'authorization_code'
            })
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.access_token).toBeDefined();
        expect(data.access_token).toContain('mock_access_poshmark');
        expect(data.refresh_token).toBeDefined();
        expect(data.token_type).toBe('Bearer');
        expect(data.expires_in).toBe(3600);
        expect(data.scope).toBe('read write listings profile');
    });

    test('POST /:platform/token - should work for all platforms', async () => {
        const platforms = ['ebay', 'whatnot', 'depop', 'mercari'];

        for (const platform of platforms) {
            const response = await fetch(`${BASE_URL}/${platform}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'test_code' })
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.access_token).toContain(`mock_access_${platform}`);
        }
    });
});

describe('Mock OAuth - User Info', () => {
    test('GET /:platform/user - should return user info', async () => {
        const response = await fetch(`${BASE_URL}/poshmark/user`);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.id).toContain('demo_poshmark_user');
        expect(data.username).toBe('demo_poshmark_seller');
        expect(data.email).toBe('demo@poshmark.example.com');
        expect(data.display_name).toBe('Demo Poshmark Seller');
        expect(data.verified).toBe(true);
        expect(data.created_at).toBeDefined();
    });

    test('GET /:platform/user - should return platform-specific user info', async () => {
        const platforms = ['ebay', 'whatnot', 'depop'];

        for (const platform of platforms) {
            const response = await fetch(`${BASE_URL}/${platform}/user`);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.id).toContain(`demo_${platform}_user`);
            expect(data.username).toBe(`demo_${platform}_seller`);
        }
    });
});

describe('Mock OAuth - Token Revocation', () => {
    test('POST /:platform/revoke - should revoke token successfully', async () => {
        const response = await fetch(`${BASE_URL}/poshmark/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: 'mock_access_poshmark_test123'
            })
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toBe('Token revoked successfully');
    });

    test('POST /:platform/revoke - should work for all platforms', async () => {
        const platforms = ['ebay', 'whatnot', 'mercari'];

        for (const platform of platforms) {
            const response = await fetch(`${BASE_URL}/${platform}/revoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: 'test_token' })
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
        }
    });
});

describe('Mock OAuth - Error Handling', () => {
    test('GET /unknown-route - should return 404', async () => {
        const response = await fetch(`${BASE_URL}/poshmark/unknown`);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Mock OAuth route not found');
    });

    test('should handle unknown platforms gracefully', async () => {
        const response = await fetch(`${BASE_URL}/unknownplatform/authorize?client_id=test&redirect_uri=http://localhost:${process.env.PORT || 3000}&state=test`);

        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('Unknownplatform');
    });
});
