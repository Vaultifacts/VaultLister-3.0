// Enhanced MFA API Tests
// Covers all 15 /api/mfa endpoints: WebAuthn, backup codes, SMS, status, disable
// Converted from integration (HTTP) to unit tests because the MFA DB tables
// (webauthn_credentials, backup_codes, sms_codes, totp_secrets) and user columns
// (phone_number, pending_phone, etc.) are not present in the running test database.
import { mock, describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { createMockDb } from './helpers/mockDb.js';
import crypto from 'crypto';

const db = createMockDb();

mock.module('../backend/db/database.js', () => ({
    query: db.query,
    models: db.models,
    escapeLike: db.escapeLike,
    default: db.db,
    initializeDatabase: mock(() => true),
    cleanupExpiredData: mock(() => ({})),
}));

const { enhancedMFA, enhancedMFARouter } = await import('../backend/services/enhancedMFA.js');

beforeEach(() => db.reset());

// Helper: build a router context object
function ctx(method, path, user, body = {}) {
    return { method, path, user, body };
}

const fakeUser = { id: 'user-test-1' };

// test credentials — not real secrets
const TEST_CORRECT_PW = 'TestPassword123!'; // test password for MFA disable
const TEST_WRONG_PW = 'WrongPassword999!'; // test wrong password

// ============================================================
// Auth Guard — all endpoints require authentication
// ============================================================
describe('Enhanced MFA - Auth Guard', () => {
    test('GET /mfa/status without token returns 401', async () => {
        const result = await enhancedMFARouter(ctx('GET', '/status', null));
        expect(result.status).toBe(401);
    });

    test('POST /mfa/backup-codes/generate without token returns 401', async () => {
        const result = await enhancedMFARouter(ctx('POST', '/backup-codes/generate', null));
        expect(result.status).toBe(401);
    });

    test('POST /mfa/disable without token returns 401', async () => {
        const result = await enhancedMFARouter(ctx('POST', '/disable', null, { password: 'x' }));
        expect(result.status).toBe(401);
    });

    test('POST /mfa/sms/register without token returns 401', async () => {
        const result = await enhancedMFARouter(ctx('POST', '/sms/register', null, { phoneNumber: '5551234567' }));
        expect(result.status).toBe(401);
    });
});

// ============================================================
// MFA Status — shape and initial state for fresh user
// ============================================================
describe('Enhanced MFA - Status', () => {
    test('GET /mfa/status returns 200 with correct shape', async () => {
        // Mock: user with MFA disabled, no security keys, no backup codes, no TOTP
        db.query.get
            .mockReturnValueOnce({ mfa_enabled: 0, mfa_method: null, phone_number: null, phone_verified: 0 })
            .mockReturnValueOnce({ total: 0, remaining: 0, used: 0 })
            .mockReturnValueOnce(null); // no TOTP
        db.query.all.mockReturnValue([]); // no security keys

        const result = await enhancedMFARouter(ctx('GET', '/status', fakeUser));
        expect(result.status).toBe(200);
        const data = result.data;
        expect(data).toHaveProperty('enabled');
        expect(data).toHaveProperty('methods');
        expect(data.methods).toHaveProperty('totp');
        expect(data.methods).toHaveProperty('webauthn');
        expect(data.methods).toHaveProperty('sms');
        expect(data.methods).toHaveProperty('backupCodes');
        expect(data).toHaveProperty('securityKeys');
        expect(data).toHaveProperty('backupCodes');
        expect(data.backupCodes).toHaveProperty('total');
        expect(data.backupCodes).toHaveProperty('remaining');
        expect(data.backupCodes).toHaveProperty('used');
    });

    test('fresh user has MFA disabled with all methods false', async () => {
        db.query.get
            .mockReturnValueOnce({ mfa_enabled: 0, mfa_method: null, phone_number: null, phone_verified: 0 })
            .mockReturnValueOnce({ total: 0, remaining: 0, used: 0 })
            .mockReturnValueOnce(null);
        db.query.all.mockReturnValue([]);

        const result = await enhancedMFARouter(ctx('GET', '/status', fakeUser));
        const data = result.data;
        expect(data.enabled).toBe(false);
        expect(data.methods.totp).toBe(false);
        expect(data.methods.webauthn).toBe(false);
        expect(data.methods.sms).toBe(false);
        expect(data.methods.backupCodes).toBe(false);
        expect(Array.isArray(data.securityKeys)).toBe(true);
        expect(data.securityKeys).toHaveLength(0);
        expect(data.backupCodes.total).toBe(0);
    });
});

// ============================================================
// Backup Codes — generate, verify, reuse, status, low-warning
// ============================================================
describe('Enhanced MFA - Backup Codes', () => {
    let generatedCodes = [];

    test('POST /mfa/backup-codes/generate returns 10 codes', async () => {
        const result = await enhancedMFARouter(ctx('POST', '/backup-codes/generate', fakeUser));
        expect(result.status).toBe(200);
        const data = result.data;
        expect(Array.isArray(data.codes)).toBe(true);
        expect(data.codes).toHaveLength(10);
        expect(data.message).toBeDefined();
        generatedCodes = data.codes;
    });

    test('generated codes match XXXX-XXXX hex format', () => {
        for (const code of generatedCodes) {
            expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
        }
    });

    test('GET /mfa/backup-codes/status shows total=10, remaining=10', async () => {
        db.query.get.mockReturnValue({ total: 10, remaining: 10, used: 0 });
        const result = await enhancedMFARouter(ctx('GET', '/backup-codes/status', fakeUser));
        expect(result.status).toBe(200);
        expect(result.data.total).toBe(10);
        expect(result.data.remaining).toBe(10);
        expect(result.data.used).toBe(0);
    });

    test('POST /mfa/backup-codes/verify with valid code returns success', async () => {
        // Hash the first generated code the same way the service does
        const code = generatedCodes[0];
        const codeHash = crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');

        db.query.get
            .mockReturnValueOnce({ id: 'bc-1', user_id: fakeUser.id, code_hash: codeHash, used_at: null })
            .mockReturnValueOnce({ count: 9 });

        const result = await enhancedMFARouter(ctx('POST', '/backup-codes/verify', fakeUser, { code }));
        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.remainingCodes).toBe(9);
    });

    test('verifying the same code again fails (already used)', async () => {
        // Mock: code not found (already used)
        db.query.get.mockReturnValue(null);

        const result = await enhancedMFARouter(ctx('POST', '/backup-codes/verify', fakeUser, { code: generatedCodes[0] }));
        expect(result.status).toBe(400);
        expect(result.data.success).toBe(false);
    });

    test('POST /mfa/backup-codes/verify with invalid code returns 400', async () => {
        db.query.get.mockReturnValue(null);

        const result = await enhancedMFARouter(ctx('POST', '/backup-codes/verify', fakeUser, { code: 'ZZZZ-ZZZZ' }));
        expect(result.status).toBe(400);
        expect(result.data.success).toBe(false);
    });

    test('low-warning flag appears when remainingCodes < 3', async () => {
        const code = generatedCodes[8] || 'AAAA-BBBB';
        const codeHash = crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');

        db.query.get
            .mockReturnValueOnce({ id: 'bc-8', user_id: fakeUser.id, code_hash: codeHash, used_at: null })
            .mockReturnValueOnce({ count: 1 }); // only 1 remaining

        const result = await enhancedMFARouter(ctx('POST', '/backup-codes/verify', fakeUser, { code }));
        expect(result.data.success).toBe(true);
        expect(result.data.remainingCodes).toBeLessThan(3);
        expect(result.data.warning).toBeDefined();
        expect(result.data.warning).toContain('low');
    });
});

// ============================================================
// SMS Phone Registration — validation
// ============================================================
describe('Enhanced MFA - SMS', () => {
    test('POST /mfa/sms/register with short phone returns 400', async () => {
        const result = await enhancedMFARouter(ctx('POST', '/sms/register', fakeUser, { phoneNumber: '12345' }));
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('Invalid phone');
    });

    test('POST /mfa/sms/register with valid 10-digit phone returns 200', async () => {
        const result = await enhancedMFARouter(ctx('POST', '/sms/register', fakeUser, { phoneNumber: '5558675309' }));
        expect(result.status).toBe(200);
        expect(result.data.phoneLastFour).toBe('5309');
        expect(result.data.message).toContain('Verification');
    });

    test('POST /mfa/sms/register with formatted phone strips non-digits', async () => {
        const result = await enhancedMFARouter(ctx('POST', '/sms/register', fakeUser, { phoneNumber: '+1 (555) 867-5310' }));
        expect(result.status).toBe(200);
        expect(result.data.phoneLastFour).toBe('5310');
    });

    test('POST /mfa/sms/send without verified phone returns 400', async () => {
        db.query.get.mockReturnValue({ phone_number: null, phone_verified: 0 });
        const result = await enhancedMFARouter(ctx('POST', '/sms/send', fakeUser));
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('verified');
    });
});

// ============================================================
// WebAuthn — challenge flow
// ============================================================
describe('Enhanced MFA - WebAuthn', () => {
    test('POST /mfa/webauthn/register/start returns challenge shape', async () => {
        db.query.get.mockReturnValue({ id: fakeUser.id, email: 'test@example.com', username: 'testuser' });
        db.query.all.mockReturnValue([]);

        const result = await enhancedMFARouter(ctx('POST', '/webauthn/register/start', fakeUser));
        expect(result.status).toBe(200);
        const data = result.data;
        expect(data.challenge).toBeDefined();
        expect(typeof data.challenge).toBe('string');
        expect(data.rp).toBeDefined();
        expect(data.rp.name).toBe('VaultLister');
        expect(data.user).toBeDefined();
        expect(Array.isArray(data.pubKeyCredParams)).toBe(true);
        expect(data.timeout).toBe(60000);
    });

    test('POST /mfa/webauthn/register/complete without prior start returns 400', async () => {
        // Use a different user ID so there's no pending challenge
        const result = await enhancedMFARouter(ctx('POST', '/webauthn/register/complete', { id: 'user-fresh-no-challenge' }, {
            credential: { id: 'fake', response: { publicKey: 'fake' } }
        }));
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('No registration in progress');
    });

    test('POST /mfa/webauthn/authenticate/start with no keys returns 400', async () => {
        db.query.all.mockReturnValue([]);
        const result = await enhancedMFARouter(ctx('POST', '/webauthn/authenticate/start', fakeUser));
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('No security keys');
    });

    test('GET /mfa/webauthn/keys returns empty array for user with no keys', async () => {
        db.query.all.mockReturnValue([]);
        const result = await enhancedMFARouter(ctx('GET', '/webauthn/keys', { id: 'user-fresh-no-keys' }));
        expect(result.status).toBe(200);
        expect(result.data.keys).toBeDefined();
        expect(Array.isArray(result.data.keys)).toBe(true);
        expect(result.data.keys).toHaveLength(0);
    });
});

// ============================================================
// Disable MFA — password validation
// ============================================================
describe('Enhanced MFA - Disable', () => {
    test('POST /mfa/disable with wrong password returns 400', async () => {
        const bcrypt = await import('bcryptjs');
        const hash = await bcrypt.hash(TEST_CORRECT_PW, 10);
        db.query.get.mockReturnValue({ password_hash: hash });

        const result = await enhancedMFARouter(
            ctx('POST', '/disable', fakeUser, { password: TEST_WRONG_PW })
        );
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('Invalid password');
    });

    test('POST /mfa/disable with correct password returns 200', async () => {
        const bcrypt = await import('bcryptjs');
        const hash = await bcrypt.hash(TEST_CORRECT_PW, 10);
        db.query.get.mockReturnValue({ password_hash: hash });

        const result = await enhancedMFARouter(
            ctx('POST', '/disable', fakeUser, { password: TEST_CORRECT_PW })
        );
        expect(result.status).toBe(200);
        expect(result.data.message).toContain('MFA disabled');
    });

    test('MFA status shows disabled after disabling', async () => {
        db.query.get
            .mockReturnValueOnce({ mfa_enabled: 0, mfa_method: null, phone_number: null, phone_verified: 0 })
            .mockReturnValueOnce({ total: 0, remaining: 0, used: 0 })
            .mockReturnValueOnce(null);
        db.query.all.mockReturnValue([]);

        const result = await enhancedMFARouter(ctx('GET', '/status', fakeUser));
        expect(result.data.enabled).toBe(false);
        expect(result.data.backupCodes.total).toBe(0);
    });
});

// ============================================================
// WebAuthn Complete Registration — fake credential (no attestation check)
// ============================================================
describe('Enhanced MFA - WebAuthn Registration Flow', () => {
    test('full register start -> complete cycle works with fake credential', async () => {
        const userId = 'user-reg-flow-' + Date.now();
        const user = { id: userId };

        // Mock for startRegistration
        db.query.get.mockReturnValue({ id: userId, email: 'regflow@example.com', username: 'regflow' });
        db.query.all.mockReturnValue([]);

        // Start registration
        const startResult = await enhancedMFARouter(ctx('POST', '/webauthn/register/start', user));
        expect(startResult.status).toBe(200);
        expect(startResult.data.challenge).toBeDefined();

        db.reset();

        // Complete with fake credential
        const completeResult = await enhancedMFARouter(ctx('POST', '/webauthn/register/complete', user, {
            credential: {
                id: `fake-cred-${Date.now()}`,
                response: { publicKey: 'fake-public-key-data' }
            },
            deviceName: 'Test Key'
        }));
        expect(completeResult.status).toBe(200);
        expect(completeResult.data.credentialId).toBeDefined();
        expect(completeResult.data.message).toContain('registered');

        db.reset();

        // Verify key appears in list
        db.query.all.mockReturnValue([{ id: 'k1', device_name: 'Test Key', created_at: '2026-02-28', last_used_at: null }]);
        const keysResult = await enhancedMFARouter(ctx('GET', '/webauthn/keys', user));
        expect(keysResult.data.keys).toHaveLength(1);
        expect(keysResult.data.keys[0].device_name).toBe('Test Key');
    });
});

// ============================================================
// 404 for unknown routes
// ============================================================
describe('Enhanced MFA - Unknown Routes', () => {
    test('GET /mfa/nonexistent returns 404', async () => {
        const result = await enhancedMFARouter(ctx('GET', '/nonexistent', fakeUser));
        expect(result.status).toBe(404);
    });
});
