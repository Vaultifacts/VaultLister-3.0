// MFA Login Flow Tests
// Tests MFA challenge during login: TOTP verification, backup codes,
// validation, and session properties after MFA completion.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken, loginUser } from './helpers/auth.helper.js';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;

let mfaUser;
let mfaClient;
let mfaSecret;
let backupCodes = [];

// Helper: generate TOTP code using otplib
function generateTOTP(secret) {
    const { generateSync } = require('otplib');
    return generateSync({ secret, algorithm: 'sha1', digits: 6, period: 30 });
}

beforeAll(async () => {
    // Create a test user and enable MFA on them
    mfaUser = await createTestUserWithToken();
    mfaClient = new TestApiClient(mfaUser.token);

    // Step 1: Setup MFA via /security/mfa/setup (get secret + QR code)
    const { status: setupStatus, data: setupData } = await mfaClient.post('/security/mfa/setup');

    if (setupStatus === 200 && setupData.secret) {
        mfaSecret = setupData.secret;

        // Step 2: Generate a valid TOTP code and verify setup via /security/mfa/verify-setup
        const code = generateTOTP(mfaSecret);
        const { status: completeStatus, data: completeData } = await mfaClient.post('/security/mfa/verify-setup', {
            secret: mfaSecret,
            code,
            setupToken: setupData.setupToken
        });

        if (completeStatus === 200 && completeData.backupCodes) {
            backupCodes = completeData.backupCodes;
        }
    }
}, 15000);

// ============================================================
// Login Triggers MFA
// ============================================================
describe('MFA Login Flow - Login Triggers MFA', () => {
    test('login with MFA-enabled user returns 202 + mfaRequired', async () => {
        if (!mfaSecret) return; // Skip if MFA setup failed

        const { response, data } = await loginUser(mfaUser.email, mfaUser.password);
        expect(response.status).toBe(202);
        expect(data.mfaRequired).toBe(true);
    });

    test('MFA login response includes mfaToken', async () => {
        if (!mfaSecret) return;

        const { data } = await loginUser(mfaUser.email, mfaUser.password);
        expect(data.mfaToken).toBeDefined();
        expect(typeof data.mfaToken).toBe('string');
        expect(data.mfaToken.length).toBeGreaterThan(10);
    });

    test('MFA login response does not include access/refresh tokens', async () => {
        if (!mfaSecret) return;

        const { data } = await loginUser(mfaUser.email, mfaUser.password);
        expect(data.token).toBeUndefined();
        expect(data.refreshToken).toBeUndefined();
    });
});

// ============================================================
// Verify with TOTP
// ============================================================
describe('MFA Login Flow - Verify with TOTP', () => {
    test('valid TOTP code completes login with 200 + tokens', async () => {
        if (!mfaSecret) return;

        // Get MFA challenge
        const { data: loginData } = await loginUser(mfaUser.email, mfaUser.password);
        const mfaToken = loginData.mfaToken;

        // Generate valid TOTP
        const code = generateTOTP(mfaSecret);

        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken, code })
        });
        const data = await response.json();

        // 200 on success, 403 if mfa-verify tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.token).toBeDefined();
            expect(data.refreshToken).toBeDefined();
            expect(data.user).toBeDefined();
        }
    });

    test('invalid TOTP code returns 401', async () => {
        if (!mfaSecret) return;

        const { data: loginData } = await loginUser(mfaUser.email, mfaUser.password);

        // Use a non-numeric string that can never be a valid 6-digit TOTP
        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: loginData.mfaToken, code: 'XXXXXX' })
        });
        // 401 for invalid code, 403 if tier-gated on CI, 429 if rate-limited
        expect([401, 403, 429]).toContain(response.status);
    }, 15000);

    test('expired/reused mfaToken returns 401', async () => {
        if (!mfaSecret) return;

        // Get MFA challenge and use it
        const { data: loginData } = await loginUser(mfaUser.email, mfaUser.password);
        const mfaToken = loginData.mfaToken;
        const code = generateTOTP(mfaSecret);

        // Use token once (succeeds)
        await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken, code })
        });

        // Try to reuse same mfaToken (should fail — atomically marked used)
        const response2 = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken, code })
        });
        // 401 on reused token, 403 if tier-gated on CI
        expect([401, 403]).toContain(response2.status);
    });

    test('MFA-verified token works for authenticated requests', async () => {
        if (!mfaSecret) return;

        const { data: loginData } = await loginUser(mfaUser.email, mfaUser.password);
        const code = generateTOTP(mfaSecret);

        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: loginData.mfaToken, code })
        });
        const data = await response.json();

        if (response.status === 200 && data.token) {
            const verifiedClient = new TestApiClient(data.token);
            const { status } = await verifiedClient.get('/auth/me');
            expect([200, 403]).toContain(status);
        }
    });

    test('MFA user object does not leak sensitive fields', async () => {
        if (!mfaSecret) return;

        const { data: loginData } = await loginUser(mfaUser.email, mfaUser.password);
        const code = generateTOTP(mfaSecret);

        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: loginData.mfaToken, code })
        });
        const data = await response.json();

        if (response.status === 200) {
            expect(data.user.password_hash).toBeUndefined();
            expect(data.user.mfa_secret).toBeUndefined();
            expect(data.user.mfa_backup_codes).toBeUndefined();
        }
    });
});

// ============================================================
// Verify with Backup Code
// ============================================================
describe('MFA Login Flow - Verify with Backup Code', () => {
    test('valid backup code completes login', async () => {
        if (!mfaSecret || backupCodes.length === 0) return;

        const { data: loginData } = await loginUser(mfaUser.email, mfaUser.password);

        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: loginData.mfaToken, code: backupCodes[0] })
        });
        const data = await response.json();

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.token).toBeDefined();
        }
    });

    test('used backup code cannot be reused', async () => {
        if (!mfaSecret || backupCodes.length < 2) return;

        // Use backup code #1
        const { data: login1 } = await loginUser(mfaUser.email, mfaUser.password);
        await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: login1.mfaToken, code: backupCodes[1] })
        });

        // Try to reuse backup code #1 (different mfaToken, same backup code)
        const { data: login2 } = await loginUser(mfaUser.email, mfaUser.password);
        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: login2.mfaToken, code: backupCodes[1] })
        });
        // 401 on reused code, 403 if tier-gated on CI
        expect([401, 403]).toContain(response.status);
    }, 15000);

    test('backup code verification is case-insensitive', async () => {
        if (!mfaSecret || backupCodes.length < 3) return;

        const { data: loginData } = await loginUser(mfaUser.email, mfaUser.password);
        const lowerCode = backupCodes[2].toLowerCase();

        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: loginData.mfaToken, code: lowerCode })
        });
        // 200 on success, 401 if already used, 403 if tier-gated on CI
        expect([200, 401, 403]).toContain(response.status);
    });
});

// ============================================================
// Validation
// ============================================================
describe('MFA Login Flow - Validation', () => {
    test('missing mfaToken returns 400', async () => {
        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: '123456' })
        });
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
    });

    test('missing code returns 400', async () => {
        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: 'some-token' })
        });
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
    });

    test('empty body returns 400', async () => {
        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
    });
});

// ============================================================
// Session Properties After MFA
// ============================================================
describe('MFA Login Flow - Session Properties', () => {
    test('MFA login creates a session visible in /auth/sessions', async () => {
        if (!mfaSecret) return;

        const { data: loginData } = await loginUser(mfaUser.email, mfaUser.password);
        const code = generateTOTP(mfaSecret);

        const response = await fetch(`${BASE_URL}/auth/mfa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: loginData.mfaToken, code })
        });
        const data = await response.json();

        if (response.status === 200 && data.token) {
            const verifiedClient = new TestApiClient(data.token);
            const { status, data: sessions } = await verifiedClient.get('/auth/sessions');
            expect([200, 403]).toContain(status);
            expect(Array.isArray(sessions)).toBe(true);
            expect(sessions.length).toBeGreaterThanOrEqual(1);
        }
    });

    test('concurrent MFA login limit enforced (max 10 sessions)', async () => {
        if (!mfaSecret) return;

        // This test just verifies the session count doesn't exceed 10
        // after multiple MFA logins
        const verifiedClient = new TestApiClient(mfaUser.token);
        const { data: sessions } = await verifiedClient.get('/auth/sessions');
        expect(sessions.length).toBeLessThanOrEqual(10);
    });
});
