// GET /api/auth/verify-email tests
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { query } from '../backend/db/database.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import crypto from 'crypto';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;

let testUser;
const insertedTokens = [];

function insertVerificationToken(userId, { daysFromNow = 1, usedAt = null, emailVerified = 0 } = {}) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

    // Set email_verified on the user
    query.run('UPDATE users SET email_verified = ? WHERE id = ?', [emailVerified ? 1 : 0, userId]);

    query.run(
        `INSERT INTO email_verifications (user_id, token, expires_at, used_at) VALUES (?, ?, ?, ?)`,
        [userId, token, expiresAt, usedAt]
    );
    insertedTokens.push(token);
    return token;
}

beforeAll(async () => {
    testUser = await createTestUserWithToken();
    // Ensure user starts unverified for clean test state
    query.run('UPDATE users SET email_verified = 0 WHERE id = ?', [testUser.user.id]);
});

afterAll(() => {
    // Clean up inserted tokens
    for (const token of insertedTokens) {
        query.run('DELETE FROM email_verifications WHERE token = ?', [token]);
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
        const token = insertVerificationToken(testUser.user.id);

        const response = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.message).toContain('verified');

        // Confirm DB state updated
        const user = query.get('SELECT email_verified FROM users WHERE id = ?', [testUser.user.id]);
        expect(user.email_verified).toBe(1);

        const record = query.get('SELECT used_at FROM email_verifications WHERE token = ?', [token]);
        expect(record.used_at).not.toBeNull();
    });

    test('already-used token returns 400', async () => {
        const usedAt = new Date().toISOString();
        const token = insertVerificationToken(testUser.user.id, { usedAt });

        const response = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('already been used');
    });

    test('expired token returns 400', async () => {
        const token = insertVerificationToken(testUser.user.id, { daysFromNow: -1 });

        const response = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('expired');
    });

    test('already-verified user returns 200 with already-verified message', async () => {
        // Mark user as already verified
        query.run('UPDATE users SET email_verified = 1 WHERE id = ?', [testUser.user.id]);
        const token = insertVerificationToken(testUser.user.id, { emailVerified: 1 });

        const response = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.message).toContain('already verified');
    });

    test('valid token is single-use — second request returns 400', async () => {
        query.run('UPDATE users SET email_verified = 0 WHERE id = ?', [testUser.user.id]);
        const token = insertVerificationToken(testUser.user.id);

        const first = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        expect(first.status).toBe(200);

        const second = await fetch(`${BASE_URL}/auth/verify-email?token=${token}`);
        const data = await second.json();
        expect(second.status).toBe(400);
        expect(data.error).toContain('already been used');
    });
});
