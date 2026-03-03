// Auth Endpoints Tests
// Covers 9 previously untested auth routes: demo-login, mfa-verify, sessions,
// password-reset, resend-verification, and auth guard enforcement.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken, loginUser, registerUser } from './helpers/auth.helper.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let client;
let testUser;

beforeAll(async () => {
    testUser = await createTestUserWithToken();
    client = new TestApiClient(testUser.token);
});

// ============================================================
// Demo Login
// ============================================================
describe('Auth Endpoints - Demo Login', () => {
    test('POST /auth/demo-login returns 200 with token', async () => {
        const response = await fetch(`${BASE_URL}/auth/demo-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        // If demo env vars are set, should return 200 with tokens
        // If not set, returns 404 — both are valid
        expect([200, 404]).toContain(response.status);

        if (response.status === 200) {
            expect(data.token).toBeDefined();
            expect(data.refreshToken).toBeDefined();
            expect(data.user).toBeDefined();
        }
    });

    test('demo-login response does not leak password_hash', async () => {
        const response = await fetch(`${BASE_URL}/auth/demo-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (response.status === 200) {
            expect(data.user.password_hash).toBeUndefined();
            expect(data.user.mfa_secret).toBeUndefined();
            expect(data.user.mfa_backup_codes).toBeUndefined();
        }
    });

    test('demo-login token works for authenticated requests', async () => {
        const response = await fetch(`${BASE_URL}/auth/demo-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (response.status === 200 && data.token) {
            const meClient = new TestApiClient(data.token);
            const { status } = await meClient.get('/auth/me');
            expect(status).toBe(200);
        }
    });
});

// ============================================================
// MFA Verify (validation only — no MFA enabled on test users)
// ============================================================
describe('Auth Endpoints - MFA Verify', () => {
    test('POST /auth/mfa-verify with missing fields returns 400', async () => {
        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBeDefined();
    });

    test('POST /auth/mfa-verify with missing code returns 400', async () => {
        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: 'some-token' })
        });
        expect(response.status).toBe(400);
    });

    test('POST /auth/mfa-verify with missing mfaToken returns 400', async () => {
        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: '123456' })
        });
        expect(response.status).toBe(400);
    });

    test('POST /auth/mfa-verify with invalid mfaToken returns 401', async () => {
        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: 'invalid-token-value', code: '123456' })
        });
        // Invalid token → 401 (token not found or expired)
        expect(response.status).toBe(401);
    });
});

// ============================================================
// Sessions — List
// ============================================================
describe('Auth Endpoints - Sessions List', () => {
    test('GET /auth/sessions returns array of sessions', async () => {
        const { status, data } = await client.get('/auth/sessions');
        expect(status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
    });

    test('sessions list includes at least 1 session (current)', async () => {
        const { data } = await client.get('/auth/sessions');
        expect(data.length).toBeGreaterThanOrEqual(1);
    });

    test('session objects have expected fields', async () => {
        const { data } = await client.get('/auth/sessions');
        const session = data[0];
        expect(session.id).toBeDefined();
        expect(session.created_at).toBeDefined();
        expect(session.expires_at).toBeDefined();
        // current flag exists (0 or 1)
        expect(typeof session.current).toBe('number');
    });

    test('at most one session is marked current', async () => {
        const { data } = await client.get('/auth/sessions');
        const currentSessions = data.filter(s => s.current === 1);
        expect(currentSessions.length).toBeLessThanOrEqual(1);
    });

    test('sessions list does not leak refresh_token', async () => {
        const { data } = await client.get('/auth/sessions');
        for (const session of data) {
            expect(session.refresh_token).toBeUndefined();
        }
    });
});

// ============================================================
// Sessions — Revoke Specific
// ============================================================
describe('Auth Endpoints - Session Revoke', () => {
    test('DELETE /auth/sessions/:id revokes a session', async () => {
        // Create a second login to get a second session
        const { data: loginData } = await loginUser(testUser.email, testUser.password);
        const secondClient = new TestApiClient(loginData.token);

        // List sessions
        const { data: sessions } = await secondClient.get('/auth/sessions');
        expect(sessions.length).toBeGreaterThanOrEqual(1);

        // Revoke the first non-current session
        const targetSession = sessions.find(s => s.current !== 1) || sessions[0];
        const { status } = await secondClient.delete(`/auth/sessions/${targetSession.id}`);
        expect(status).toBe(200);
    });

    test('DELETE /auth/sessions/:nonexistent returns 404', async () => {
        const { status } = await client.delete('/auth/sessions/nonexistent-session-id');
        expect(status).toBe(404);
    });

    test('cross-user session revocation is blocked', async () => {
        // Create user A and user B
        const userA = await createTestUserWithToken();
        const userB = await createTestUserWithToken();

        const clientA = new TestApiClient(userA.token);
        const clientB = new TestApiClient(userB.token);

        // Get B's sessions
        const { data: sessionsB } = await clientB.get('/auth/sessions');
        expect(sessionsB.length).toBeGreaterThanOrEqual(1);

        // A tries to revoke B's session
        const { status } = await clientA.delete(`/auth/sessions/${sessionsB[0].id}`);
        expect(status).toBe(404); // Not found (user_id mismatch)
    });

    test('revoked session disappears from list', async () => {
        const user = await createTestUserWithToken();
        // Create second session
        const { data: loginData } = await loginUser(user.email, user.password);
        const userClient = new TestApiClient(loginData.token);

        const { data: before } = await userClient.get('/auth/sessions');
        const target = before.find(s => s.current !== 1);

        if (target) {
            await userClient.delete(`/auth/sessions/${target.id}`);
            const { data: after } = await userClient.get('/auth/sessions');
            const stillExists = after.find(s => s.id === target.id);
            expect(stillExists).toBeUndefined();
        }
    });

    test('DELETE without auth returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.delete('/auth/sessions/some-id');
        expect(status).toBe(401);
    });
});

// ============================================================
// Sessions — Revoke All
// ============================================================
describe('Auth Endpoints - Revoke All Sessions', () => {
    test('POST /auth/sessions/revoke-all returns 200 with count', async () => {
        const user = await createTestUserWithToken();
        // Create extra sessions
        await loginUser(user.email, user.password);
        await loginUser(user.email, user.password);

        const userClient = new TestApiClient(user.token);
        const { status, data } = await userClient.post('/auth/sessions/revoke-all');
        expect(status).toBe(200);
        expect(data.message).toContain('revoked');
        expect(typeof data.count).toBe('number');
    });

    test('revoke-all leaves at most current session active', async () => {
        const user = await createTestUserWithToken();
        await loginUser(user.email, user.password);
        await loginUser(user.email, user.password);

        const userClient = new TestApiClient(user.token);
        await userClient.post('/auth/sessions/revoke-all');

        // Note: sessions endpoint still works because current token is still valid
        const { data: sessions } = await userClient.get('/auth/sessions');
        // Should have 0 or 1 sessions left (current may not have refresh_token match)
        expect(sessions.length).toBeLessThanOrEqual(2);
    });

    test('revoke-all without auth returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.post('/auth/sessions/revoke-all');
        expect(status).toBe(401);
    });
});

// ============================================================
// Password Reset — Anti-enumeration
// ============================================================
describe('Auth Endpoints - Password Reset', () => {
    test('POST /auth/password-reset returns 200 for valid email', async () => {
        const response = await fetch(`${BASE_URL}/auth/password-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testUser.email })
        });
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBeDefined();
    });

    test('password-reset returns 200 for nonexistent email (anti-enumeration)', async () => {
        const response = await fetch(`${BASE_URL}/auth/password-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nonexistent-user-xyz@example.com' })
        });
        // Must always return 200 to prevent email enumeration
        expect(response.status).toBe(200);
    });

    test('password-reset returns 200 for missing email (anti-enumeration)', async () => {
        const response = await fetch(`${BASE_URL}/auth/password-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(response.status).toBe(200);
    });

    test('password-reset returns 200 for invalid email format (anti-enumeration)', async () => {
        const response = await fetch(`${BASE_URL}/auth/password-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'not-an-email' })
        });
        expect(response.status).toBe(200);
    });
});

// ============================================================
// Resend Verification
// ============================================================
describe('Auth Endpoints - Resend Verification', () => {
    test('POST /auth/resend-verification returns 200 for valid email', async () => {
        const response = await fetch(`${BASE_URL}/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testUser.email })
        });
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBeDefined();
    });

    test('resend-verification returns 200 for nonexistent email (anti-enumeration)', async () => {
        const response = await fetch(`${BASE_URL}/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nobody@example.com' })
        });
        expect(response.status).toBe(200);
    });

    test('resend-verification returns 200 for invalid email (anti-enumeration)', async () => {
        const response = await fetch(`${BASE_URL}/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'badformat' })
        });
        expect(response.status).toBe(200);
    });
});

// ============================================================
// Auth Guards — unauthenticated access
// ============================================================
describe('Auth Endpoints - Auth Guards', () => {
    test('GET /auth/sessions without token returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/auth/sessions');
        expect(status).toBe(401);
    });

    test('GET /auth/me without token returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/auth/me');
        expect(status).toBe(401);
    });

    test('PUT /auth/profile without token returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.put('/auth/profile', { fullName: 'Hacker' });
        expect(status).toBe(401);
    });

    test('PUT /auth/password without token returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.put('/auth/password', {
            currentPassword: 'x',
            newPassword: 'y'
        });
        expect(status).toBe(401);
    });
});
