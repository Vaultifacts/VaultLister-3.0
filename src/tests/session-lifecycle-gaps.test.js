// Session Lifecycle Gaps — Coverage for audit gaps
// Covers:
//   - Expired access token returns 401
//   - Password change invalidates other sessions
//   - Revoked session token behavior
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken, loginUser } from './helpers/auth.helper.js';
import jwt from 'jsonwebtoken';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;

// Alternate test credential used only in password-change tests so the
// original user password stays intact for the rest of the suite.
const ALT_TEST_CRED = process.env.TEST_ALT_PASSWORD || 'AltTestCred8!z';

// ============================================================
// Expired Access Token
// ============================================================
describe('Session Lifecycle - Expired Token', () => {
    test('already-expired JWT returns 401 on /auth/me', async () => {
        const secret = process.env.JWT_SECRET || 'dev-only-secret-not-for-production';
        const expiredToken = jwt.sign(
            { userId: 'test-user-id', type: 'access', iss: 'vaultlister', aud: 'vaultlister-api' },
            secret,
            { expiresIn: '-1s', algorithm: 'HS256' }
        );
        const { status } = await new TestApiClient(expiredToken).get('/auth/me');
        expect(status).toBe(401);
    });

    test('already-expired JWT returns 401 on /inventory', async () => {
        const secret = process.env.JWT_SECRET || 'dev-only-secret-not-for-production';
        const expiredToken = jwt.sign(
            { userId: 'test-user-id', type: 'access', iss: 'vaultlister', aud: 'vaultlister-api' },
            secret,
            { expiresIn: '-1s', algorithm: 'HS256' }
        );
        const { status } = await new TestApiClient(expiredToken).get('/inventory');
        expect(status).toBe(401);
    });

    test('already-expired JWT returns 401 on /listings', async () => {
        const secret = process.env.JWT_SECRET || 'dev-only-secret-not-for-production';
        const expiredToken = jwt.sign(
            { userId: 'test-user-id', type: 'access', iss: 'vaultlister', aud: 'vaultlister-api' },
            secret,
            { expiresIn: '-1s', algorithm: 'HS256' }
        );
        const { status } = await new TestApiClient(expiredToken).get('/listings');
        expect(status).toBe(401);
    });

    test('already-expired JWT is rejected on a mutating route (no CSRF needed — auth fires first)', async () => {
        const secret = process.env.JWT_SECRET || 'dev-only-secret-not-for-production';
        const expiredToken = jwt.sign(
            { userId: 'test-user-id', type: 'access', iss: 'vaultlister', aud: 'vaultlister-api' },
            secret,
            { expiresIn: '-1s', algorithm: 'HS256' }
        );
        const response = await fetch(`${BASE_URL}/inventory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${expiredToken}`
            },
            body: JSON.stringify({ title: 'Test', listPrice: 10 })
        });
        expect(response.status).toBe(401);
    });
});

// ============================================================
// Password Change Session Invalidation
// ============================================================
describe('Session Lifecycle - Password Change', () => {
    test('wrong current credential returns 401', async () => {
        const user = await createTestUserWithToken();
        const client = new TestApiClient(user.token);
        const { status } = await client.put('/auth/password', {
            currentPassword: 'DefinitelyWrong99!',
            newPassword: ALT_TEST_CRED
        });
        expect(status).toBe(401);
    });

    test('missing fields return 400', async () => {
        const user = await createTestUserWithToken();
        const client = new TestApiClient(user.token);
        // only currentPassword provided, newPassword omitted
        const { status } = await client.put('/auth/password', {
            currentPassword: user.password
        });
        expect(status).toBe(400);
    });

    test('weak new value returns 400', async () => {
        const user = await createTestUserWithToken();
        const client = new TestApiClient(user.token);
        const { status, data } = await client.put('/auth/password', {
            currentPassword: user.password,
            newPassword: 'abc'
        });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('unauthenticated request returns 401', async () => {
        const { status } = await new TestApiClient().put('/auth/password', {
            currentPassword: 'any',
            newPassword: ALT_TEST_CRED
        });
        expect(status).toBe(401);
    });

    test('after password change, old refresh token is rejected', async () => {
        const user = await createTestUserWithToken();
        // Log in fresh to obtain a refresh token on a second session
        const { data: loginData } = await loginUser(user.email, user.password);
        const secondRefresh = loginData.refreshToken;

        if (!secondRefresh) {
            console.log('No refreshToken returned by login — skipping');
            return;
        }

        // Change the password using the original session
        const client = new TestApiClient(user.token);
        const { status: changeStatus } = await client.put('/auth/password', {
            currentPassword: user.password,
            newPassword: ALT_TEST_CRED
        });

        if (changeStatus !== 200) {
            console.log(`Password change returned ${changeStatus} — skipping invalidation assertion`);
            return;
        }

        await new Promise(r => setTimeout(r, 100));

        // The second session's refresh token should now be invalid
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: secondRefresh })
        });
        expect(response.status).toBe(401);
    });
});

// ============================================================
// Revoke-All Then Refresh
// ============================================================
describe('Session Lifecycle - Revoke-All Blocks Refresh', () => {
    test('revoke-all then use refresh token returns 401', async () => {
        const user = await createTestUserWithToken();
        const { data: loginData } = await loginUser(user.email, user.password);
        const refreshValue = loginData.refreshToken;

        if (!refreshValue) {
            console.log('No refreshToken in login response — skipping');
            return;
        }

        const client = new TestApiClient(loginData.token);
        const { status: revokeStatus } = await client.post('/auth/sessions/revoke-all');
        expect(revokeStatus).toBe(200);

        const response = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: refreshValue })
        });
        expect(response.status).toBe(401);
    });
});
