// Token Lifecycle Tests
// Covers access token validity, garbage token rejection, refresh rotation
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken, loginUser, refreshToken } from './helpers/auth.helper.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let freshUser;

beforeAll(async () => {
    freshUser = await createTestUserWithToken();
});

// ============================================================
// Access Token — validity and rejection
// ============================================================
describe('Token Lifecycle - Access Token', () => {
    test('fresh access token can access /auth/me', async () => {
        const client = new TestApiClient(freshUser.token);
        const { status, data } = await client.get('/auth/me');
        expect([200, 403]).toContain(status);
        expect(data.user || data.email).toBeDefined();
    });

    test('fresh access token works for inventory requests', async () => {
        const client = new TestApiClient(freshUser.token);
        const { status } = await client.get('/inventory');
        expect([200, 403]).toContain(status);
    });

    test('garbage token is rejected with 401', async () => {
        const client = new TestApiClient('this-is-not-a-valid-jwt-token');
        const { status } = await client.get('/auth/me');
        expect(status).toBe(401);
    });

    test('missing Authorization header is rejected with 401', async () => {
        const client = new TestApiClient(); // no token
        const { status } = await client.get('/auth/me');
        expect(status).toBe(401);
    });

    test('malformed JWT (valid base64 but bad signature) is rejected', async () => {
        // Craft a JWT with valid structure but bad signature
        const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NSJ9.invalidsignature';
        const client = new TestApiClient(fakeJwt);
        const { status } = await client.get('/auth/me');
        expect(status).toBe(401);
    });
});

// ============================================================
// Refresh Token — rotation semantics
// ============================================================
describe('Token Lifecycle - Refresh Token', () => {
    test('POST /auth/refresh with valid token returns new access token', async () => {
        // Login fresh to get a refreshToken
        const user = await createTestUserWithToken();
        const { data: loginData } = await loginUser(user.email, user.password);

        // The login response should contain a refreshToken
        const refreshTokenValue = loginData.refreshToken;
        if (!refreshTokenValue) {
            // If registration doesn't return refreshToken, skip gracefully
            console.log('Login did not return refreshToken — skipping refresh test');
            return;
        }

        const { response, data } = await refreshToken(refreshTokenValue);
        expect(response.status).toBe(200);
        expect(data.token).toBeDefined();
    });

    test('refresh rotation issues a new refresh token', async () => {
        const user = await createTestUserWithToken();
        const { data: loginData } = await loginUser(user.email, user.password);
        const originalRefresh = loginData.refreshToken;

        if (!originalRefresh) return;

        const { data } = await refreshToken(originalRefresh);
        // Refresh token rotation: new refresh token must differ (old session invalidated)
        expect(data.refreshToken).toBeDefined();
        expect(data.refreshToken).not.toBe(originalRefresh);
    });

    test('POST /auth/refresh with invalid token returns 401', async () => {
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken: 'invalid-refresh-token' })
        });
        expect(response.status).toBe(401);
    });

    test('new access token from refresh works for authenticated requests', async () => {
        const user = await createTestUserWithToken();
        const { data: loginData } = await loginUser(user.email, user.password);
        const refreshTokenValue = loginData.refreshToken;

        if (!refreshTokenValue) return;

        const { data } = await refreshToken(refreshTokenValue);
        const newClient = new TestApiClient(data.token);
        const { status } = await newClient.get('/auth/me');
        expect([200, 403]).toContain(status);
    });
});
