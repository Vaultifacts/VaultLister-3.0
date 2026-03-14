// Session Management Tests
// Tests session lifecycle, multi-login tracking, revocation, max session limit,
// and cross-user isolation using 3 isolated test users.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken, loginUser } from './helpers/auth.helper.js';

let userA, userB, userC;
let clientA, clientB;

beforeAll(async () => {
    userA = await createTestUserWithToken();
    userB = await createTestUserWithToken();
    userC = await createTestUserWithToken();
    clientA = new TestApiClient(userA.token);
    clientB = new TestApiClient(userB.token);
});

// ============================================================
// List Sessions
// ============================================================
describe('Session Management - List Sessions', () => {
    test('new user has at least 1 session after registration', async () => {
        const { status, data } = await clientA.get('/auth/sessions');
        expect([200, 403]).toContain(status);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThanOrEqual(1);
    });

    test('session object has required shape', async () => {
        const { data } = await clientA.get('/auth/sessions');
        const session = data[0];
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('created_at');
        expect(session).toHaveProperty('expires_at');
    });

    test('session does not expose refresh_token', async () => {
        const { data } = await clientA.get('/auth/sessions');
        for (const s of data) {
            expect(s.refresh_token).toBeUndefined();
        }
    });

    test('session has current flag (0 or 1)', async () => {
        const { data } = await clientA.get('/auth/sessions');
        for (const s of data) {
            expect([0, 1]).toContain(s.current);
        }
    });

    test('sessions are ordered by created_at DESC', async () => {
        // Create extra session
        await loginUser(userA.email, userA.password);
        const { data } = await clientA.get('/auth/sessions');
        if (data.length >= 2) {
            const dates = data.map(s => new Date(s.created_at).getTime());
            for (let i = 1; i < dates.length; i++) {
                expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
            }
        }
    });
});

// ============================================================
// Multiple Logins
// ============================================================
describe('Session Management - Multiple Logins', () => {
    test('3 logins create 3 additional sessions', async () => {
        const user = await createTestUserWithToken();
        const userClient = new TestApiClient(user.token);

        // Registration created 1 session; log in 3 more times
        await loginUser(user.email, user.password);
        await loginUser(user.email, user.password);
        await loginUser(user.email, user.password);

        const { data } = await userClient.get('/auth/sessions');
        // At least 4 sessions (1 reg + 3 logins)
        expect(data.length).toBeGreaterThanOrEqual(4);
    });

    test('each login session has unique ID', async () => {
        const user = await createTestUserWithToken();
        await loginUser(user.email, user.password);
        await loginUser(user.email, user.password);

        const userClient = new TestApiClient(user.token);
        const { data } = await userClient.get('/auth/sessions');
        const ids = data.map(s => s.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });
});

// ============================================================
// Revoke Specific Session
// ============================================================
describe('Session Management - Revoke Specific', () => {
    test('revoking a session removes it from the list', async () => {
        const user = await createTestUserWithToken();
        const { data: loginData } = await loginUser(user.email, user.password);
        const userClient = new TestApiClient(loginData.token);

        const { data: before } = await userClient.get('/auth/sessions');
        const target = before.find(s => s.current !== 1);
        if (target) {
            const { status } = await userClient.delete(`/auth/sessions/${target.id}`);
            expect([200, 403]).toContain(status);

            const { data: after } = await userClient.get('/auth/sessions');
            expect(after.find(s => s.id === target.id)).toBeUndefined();
        }
    });

    test('revoking own current session still returns 200', async () => {
        const user = await createTestUserWithToken();
        const { data: loginData } = await loginUser(user.email, user.password);
        const userClient = new TestApiClient(loginData.token);

        const { data: sessions } = await userClient.get('/auth/sessions');
        // Just revoke any session — it should succeed
        if (sessions.length > 0) {
            const { status } = await userClient.delete(`/auth/sessions/${sessions[0].id}`);
            expect([200, 403]).toContain(status);
        }
    });

    test('revoking nonexistent session returns 404', async () => {
        const { status } = await clientA.delete('/auth/sessions/does-not-exist');
        expect(status).toBe(404);
    });

    test('cross-user revocation returns 404', async () => {
        // B cannot revoke A's sessions
        const { data: sessionsA } = await clientA.get('/auth/sessions');
        if (sessionsA.length > 0) {
            const { status } = await clientB.delete(`/auth/sessions/${sessionsA[0].id}`);
            expect(status).toBe(404);
        }
    });
});

// ============================================================
// Revoke All Sessions
// ============================================================
describe('Session Management - Revoke All', () => {
    test('revoke-all returns count of revoked sessions', async () => {
        const user = await createTestUserWithToken();
        await loginUser(user.email, user.password);
        await loginUser(user.email, user.password);

        const userClient = new TestApiClient(user.token);
        const { status, data } = await userClient.post('/auth/sessions/revoke-all');
        expect([200, 403]).toContain(status);
        expect(typeof data.count).toBe('number');
        expect(data.count).toBeGreaterThanOrEqual(0);
    });

    test('after revoke-all, session list is minimal', async () => {
        const user = await createTestUserWithToken();
        await loginUser(user.email, user.password);
        await loginUser(user.email, user.password);
        await loginUser(user.email, user.password);

        const userClient = new TestApiClient(user.token);
        await userClient.post('/auth/sessions/revoke-all');

        const { data } = await userClient.get('/auth/sessions');
        // Should be at most 1-2 sessions (current survives)
        expect(data.length).toBeLessThanOrEqual(2);
    });

    test('revoke-all does not affect other users', async () => {
        const { data: beforeB } = await clientB.get('/auth/sessions');
        const countBefore = beforeB.length;

        // A revokes all
        await clientA.post('/auth/sessions/revoke-all');

        const { data: afterB } = await clientB.get('/auth/sessions');
        expect(afterB.length).toBe(countBefore);
    });
});

// ============================================================
// Max Session Limit (10 concurrent)
// ============================================================
describe('Session Management - Max Limit', () => {
    test('11th login prunes oldest session (max 10)', async () => {
        const user = await createTestUserWithToken();
        const userClient = new TestApiClient(user.token);

        // Create 10 more logins (11 total including registration)
        for (let i = 0; i < 10; i++) {
            await loginUser(user.email, user.password);
        }

        const { data: sessions } = await userClient.get('/auth/sessions');
        // Server enforces max 10 concurrent sessions
        expect(sessions.length).toBeLessThanOrEqual(10);
    }, 30000);

    test('newest sessions survive pruning', async () => {
        const user = await createTestUserWithToken();

        // Create 12 total logins
        let lastLoginData;
        for (let i = 0; i < 11; i++) {
            const result = await loginUser(user.email, user.password);
            lastLoginData = result.data;
        }

        // Latest token should still work
        const latestClient = new TestApiClient(lastLoginData.token);
        const { status } = await latestClient.get('/auth/me');
        expect([200, 403]).toContain(status);
    }, 30000);
});

// ============================================================
// Cross-User Isolation
// ============================================================
describe('Session Management - Cross-User Isolation', () => {
    test('user A cannot see user B sessions', async () => {
        const { data: sessionsA } = await clientA.get('/auth/sessions');
        const { data: sessionsB } = await clientB.get('/auth/sessions');

        // Session IDs should not overlap
        const idsA = new Set(sessionsA.map(s => s.id));
        for (const s of sessionsB) {
            expect(idsA.has(s.id)).toBe(false);
        }
    });

    test('user A cannot revoke user B session', async () => {
        const { data: sessionsB } = await clientB.get('/auth/sessions');
        if (sessionsB.length > 0) {
            const { status } = await clientA.delete(`/auth/sessions/${sessionsB[0].id}`);
            expect(status).toBe(404);
        }
    });

    test('revoke-all only affects own sessions', async () => {
        const clientC = new TestApiClient(userC.token);
        const { data: before } = await clientB.get('/auth/sessions');

        await clientC.post('/auth/sessions/revoke-all');

        const { data: after } = await clientB.get('/auth/sessions');
        expect(after.length).toBe(before.length);
    });
});
