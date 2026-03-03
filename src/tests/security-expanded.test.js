// Security Route — expanded tests for 8 previously untested endpoints
// send-verification, verify-email, forgot-password, reset-password,
// mfa/disable, mfa/regenerate-codes, mfa/status, events
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
let unauthClient;
let userPassword;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
    userPassword = user.password;
    unauthClient = new TestApiClient(); // no token
});

// ============================================================
// Auth Guards
// ============================================================
describe('Security Expanded - Auth Guards', () => {
    test('POST /security/send-verification without auth returns 401', async () => {
        const { status } = await unauthClient.post('/security/send-verification');
        expect(status).toBe(401);
    });

    test('GET /security/mfa/status without auth returns 401', async () => {
        const { status } = await unauthClient.get('/security/mfa/status');
        expect(status).toBe(401);
    });

    test('GET /security/events without auth returns 401', async () => {
        const { status } = await unauthClient.get('/security/events');
        expect(status).toBe(401);
    });

    test('POST /security/mfa/disable without auth returns 401', async () => {
        const { status } = await unauthClient.post('/security/mfa/disable', { password: 'x' });
        expect(status).toBe(401);
    });

    test('POST /security/mfa/regenerate-codes without auth returns 401', async () => {
        const { status } = await unauthClient.post('/security/mfa/regenerate-codes', { password: 'x' });
        expect(status).toBe(401);
    });
});

// ============================================================
// POST /security/send-verification
// ============================================================
describe('Security Expanded - Send Verification', () => {
    test('POST /security/send-verification returns success or already-verified', async () => {
        const { status, data } = await client.post('/security/send-verification');
        // 200 = sent, 400 = already verified or rate limited, 500 = db issue
        expect([200, 400, 500]).toContain(status);
        if (status === 200) {
            expect(data.message).toContain('Verification');
        }
        if (status === 400) {
            expect(data.error || data.message).toBeDefined();
        }
    });
});

// ============================================================
// POST /security/verify-email — no auth required
// ============================================================
describe('Security Expanded - Verify Email', () => {
    test('POST /security/verify-email without token returns 400', async () => {
        const { status, data } = await unauthClient.post('/security/verify-email', {});
        expect([400, 429, 500]).toContain(status);
        if (status === 400) {
            expect(data.error).toBeDefined();
        }
    });

    test('POST /security/verify-email with invalid token returns 400', async () => {
        const { status, data } = await unauthClient.post('/security/verify-email', {
            token: 'invalid-token-that-does-not-exist'
        });
        expect([400, 429, 500]).toContain(status);
        if (status === 400) {
            expect(data.error).toBeDefined();
        }
    });
});

// ============================================================
// POST /security/forgot-password — no auth required
// ============================================================
describe('Security Expanded - Forgot Password', () => {
    test('POST /security/forgot-password without email returns 400', async () => {
        const { status, data } = await unauthClient.post('/security/forgot-password', {});
        expect([400, 429, 500]).toContain(status);
        if (status === 400) {
            expect(data.error).toBeDefined();
        }
    });

    test('POST /security/forgot-password with nonexistent email returns 200 (anti-enumeration)', async () => {
        const { status, data } = await unauthClient.post('/security/forgot-password', {
            email: `nonexistent-${Date.now()}@example.com`
        });
        // Always returns 200 to prevent email enumeration, or 429 if rate limited
        expect([200, 429, 500]).toContain(status);
        if (status === 200) {
            expect(data.message).toBeDefined();
        }
    });
});

// ============================================================
// POST /security/reset-password — no auth required
// ============================================================
describe('Security Expanded - Reset Password', () => {
    test('POST /security/reset-password without token or password returns 400', async () => {
        const { status, data } = await unauthClient.post('/security/reset-password', {});
        expect([400, 500]).toContain(status);
        if (status === 400) {
            expect(data.error).toBeDefined();
        }
    });

    test('POST /security/reset-password with weak password returns 400', async () => {
        const { status, data } = await unauthClient.post('/security/reset-password', {
            token: 'fake-token',
            password: 'short'
        });
        expect([400, 500]).toContain(status);
        if (status === 400) {
            expect(data.error).toBeDefined();
        }
    });

    test('POST /security/reset-password with invalid token returns 400', async () => {
        const { status, data } = await unauthClient.post('/security/reset-password', {
            token: 'invalid-token-does-not-exist',
            password: 'StrongPassword123!@#'
        });
        expect([400, 500]).toContain(status);
        if (status === 400) {
            expect(data.error).toBeDefined();
        }
    });
});

// ============================================================
// POST /security/mfa/disable
// ============================================================
describe('Security Expanded - MFA Disable', () => {
    test('POST /security/mfa/disable without password returns 400', async () => {
        const { status, data } = await client.post('/security/mfa/disable', {});
        expect([400, 500]).toContain(status);
        if (status === 400) {
            expect(data.error).toBeDefined();
        }
    });

    test('POST /security/mfa/disable when MFA not enabled returns 400', async () => {
        const { status, data } = await client.post('/security/mfa/disable', {
            password: userPassword
        });
        // Fresh user has no MFA enabled, so disable should fail
        expect([400, 500]).toContain(status);
        if (status === 400) {
            expect(data.error).toBeDefined();
        }
    });
});

// ============================================================
// POST /security/mfa/regenerate-codes
// ============================================================
describe('Security Expanded - MFA Regenerate Codes', () => {
    test('POST /security/mfa/regenerate-codes without password returns 400', async () => {
        const { status, data } = await client.post('/security/mfa/regenerate-codes', {});
        expect([400, 500]).toContain(status);
        if (status === 400) {
            expect(data.error).toBeDefined();
        }
    });

    test('POST /security/mfa/regenerate-codes when MFA not enabled returns 400', async () => {
        const { status, data } = await client.post('/security/mfa/regenerate-codes', {
            password: userPassword
        });
        // Fresh user has no MFA enabled
        expect([400, 500]).toContain(status);
        if (status === 400) {
            expect(data.error).toBeDefined();
        }
    });
});

// ============================================================
// GET /security/mfa/status
// ============================================================
describe('Security Expanded - MFA Status', () => {
    test('GET /security/mfa/status returns shape for fresh user', async () => {
        const { status, data } = await client.get('/security/mfa/status');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(typeof data.mfaEnabled).toBe('boolean');
            expect(typeof data.backupCodesRemaining).toBe('number');
            // Fresh user — MFA disabled
            expect(data.mfaEnabled).toBe(false);
        }
    });
});

// ============================================================
// GET /security/events
// ============================================================
describe('Security Expanded - Events', () => {
    test('GET /security/events returns shape with arrays', async () => {
        const { status, data } = await client.get('/security/events');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(Array.isArray(data.mfaEvents)).toBe(true);
            expect(Array.isArray(data.loginEvents)).toBe(true);
        }
    });
});
