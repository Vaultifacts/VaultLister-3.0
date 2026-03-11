// GET /api/auth/verify-email tests
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { query } from '../backend/db/database.js';
import crypto from 'crypto';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
const PASS = 'TestVerify1!';

const createdUserIds = [];

// Register a fresh user via HTTP, then call resend-verification to create a server-side token.
// The server skips email_verifications creation during registration in test mode (IS_TEST_RUNTIME),
// so we use resend-verification which has no such guard.
// Returns { userId, email, token } where token is the server-created verification token.
async function registerAndGetToken() {
    const ts = `${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
    const email = `vtest_${ts}@example.com`;
    const username = `vtest${ts}`.slice(0, 30);

    const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password: PASS, full_name: 'Verify Tester' })
    });
    const data = await res.json();
    const userId = data.user?.id;
    if (!userId) throw new Error(`Registration failed: ${JSON.stringify(data)}`);
    createdUserIds.push(userId);

    // Server skips email_verifications in test mode — use resend to create the token via HTTP
    await fetch(`${BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });

    // Read back the server-created token (read-only — server wrote it, so it's visible here)
    const record = query.get(
        'SELECT token FROM email_verifications WHERE user_id = ? ORDER BY rowid DESC LIMIT 1',
        [userId]
    );
    return { userId, email, token: record?.token };
}

// Call resend-verification HTTP endpoint to create a fresh server-side token.
// Only works if email_verified = 0 for this user.
async function resendAndGetToken(email, userId) {
    await fetch(`${BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    const record = query.get(
        'SELECT token FROM email_verifications WHERE user_id = ? ORDER BY rowid DESC LIMIT 1',
        [userId]
    );
    return record?.token;
}

afterAll(() => {
    for (const id of createdUserIds) {
        query.run('DELETE FROM email_verifications WHERE user_id = ?', [id]);
        query.run('DELETE FROM users WHERE id = ?', [id]);
    }
});

describe('GET /api/auth/verify-email', () => {
    test('missing token returns 400', async () => {
        const response = await fetch(`${BASE_URL}/auth/verify-email`);
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('token');
    });

    test('invalid token returns 400', async () => {
        const response = await fetch(`${BASE_URL}/auth/verify-email?token=notarealtoken`);
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('valid token verifies email and returns 200', async () => {
        const { userId, token } = await registerAndGetToken();
        expect(token).toBeDefined();

        const response = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.message).toContain('verified');

        const user = query.get('SELECT email_verified FROM users WHERE id = ?', [userId]);
        expect(user.email_verified).toBe(1);

        const record = query.get('SELECT used_at FROM email_verifications WHERE token = ?', [token]);
        expect(record.used_at).not.toBeNull();
    });

    test('already-used token returns 400', async () => {
        const { token } = await registerAndGetToken();
        query.run('UPDATE email_verifications SET used_at = ? WHERE token = ?',
            [new Date().toISOString(), token]);
        // Flush WAL so the server process can see this write
        query.run('PRAGMA wal_checkpoint(FULL)');

        const response = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('already been used');
    });

    test('expired token returns 400', async () => {
        const { token } = await registerAndGetToken();
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        query.run('UPDATE email_verifications SET expires_at = ? WHERE token = ?',
            [pastDate, token]);
        // Flush WAL so the server process can see this write
        query.run('PRAGMA wal_checkpoint(FULL)');

        const response = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('expired');
    });

    test('already-verified user returns 200 with already-verified message', async () => {
        // Register, then verify via HTTP (server sets email_verified=1, marks token used)
        const { userId, email, token: tokenA } = await registerAndGetToken();
        await fetch(`${BASE_URL}/auth/verify-email?token=${tokenA}`);

        // Reset email_verified to 0 so resend-verification will create a new token
        query.run('UPDATE users SET email_verified = 0 WHERE id = ?', [userId]);
        query.run('PRAGMA wal_checkpoint(FULL)');

        // Get a fresh token via resend
        const tokenB = await resendAndGetToken(email, userId);
        expect(tokenB).toBeDefined();

        // Now set email_verified back to 1 to test the "already verified" path
        query.run('UPDATE users SET email_verified = 1 WHERE id = ?', [userId]);
        query.run('PRAGMA wal_checkpoint(FULL)');

        const response = await fetch(`${BASE_URL}/auth/verify-email?token=${tokenB}`);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.message).toContain('already verified');
    });

    test('valid token is single-use — second request returns 400', async () => {
        const { token } = await registerAndGetToken();

        const first = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        expect(first.status).toBe(200);

        const second = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        const data = await second.json();
        expect(second.status).toBe(400);
        expect(data.error).toContain('already been used');
    });
});
