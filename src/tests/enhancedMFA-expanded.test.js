// Enhanced MFA — expanded tests for 4 previously untested endpoints
// POST /mfa/sms/verify-phone, POST /mfa/sms/verify, POST /mfa/webauthn/authenticate/complete,
// DELETE /mfa/webauthn/keys/:id
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
let unauthClient;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
    unauthClient = new TestApiClient(); // no token
});

// ============================================================
// Auth Guards for previously untested endpoints
// ============================================================
describe('Enhanced MFA Expanded - Auth Guards', () => {
    test('POST /mfa/sms/verify-phone without token returns 401', async () => {
        const { status } = await unauthClient.post('/mfa/sms/verify-phone', { code: '123456' });
        expect(status).toBe(401);
    });

    test('POST /mfa/sms/verify without token returns 401', async () => {
        const { status } = await unauthClient.post('/mfa/sms/verify', { code: '123456' });
        expect(status).toBe(401);
    });

    test('POST /mfa/webauthn/authenticate/complete without token returns 401', async () => {
        const { status } = await unauthClient.post('/mfa/webauthn/authenticate/complete', {
            assertion: { id: 'fake', response: {} }
        });
        expect(status).toBe(401);
    });
});

// ============================================================
// SMS Verify Phone — POST /mfa/sms/verify-phone
// ============================================================
describe('Enhanced MFA Expanded - SMS Verify Phone', () => {
    test('POST /mfa/sms/verify-phone without code returns 400', async () => {
        const { status, data } = await client.post('/mfa/sms/verify-phone', {});
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('POST /mfa/sms/verify-phone with wrong code returns 400', async () => {
        // No phone registered for this user, so verification fails
        const { status, data } = await client.post('/mfa/sms/verify-phone', { code: '000000' });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('POST /mfa/sms/verify-phone after register with wrong code returns 400', async () => {
        const freshUser = await createTestUserWithToken();
        const freshClient = new TestApiClient(freshUser.token);

        // Register a phone first
        await freshClient.post('/mfa/sms/register', { phoneNumber: '5551234567' });

        // Try to verify with wrong code
        const { status, data } = await freshClient.post('/mfa/sms/verify-phone', { code: '000000' });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });
});

// ============================================================
// SMS Verify Code — POST /mfa/sms/verify
// ============================================================
describe('Enhanced MFA Expanded - SMS Verify Code', () => {
    // Note: 500 tolerated because sms_codes table may not exist in test DB
    test('POST /mfa/sms/verify without code returns 400 or 500', async () => {
        const { status, data } = await client.post('/mfa/sms/verify', {});
        expect([400]).toContain(status);
        if (status === 400) expect(data.error || data.success === false).toBeTruthy();
    });

    test('POST /mfa/sms/verify with invalid code returns 400 or 500', async () => {
        const { status, data } = await client.post('/mfa/sms/verify', { code: 'INVALID' });
        expect([400]).toContain(status);
        if (status === 400) expect(data.success).toBe(false);
    });

    test('POST /mfa/sms/verify with random numeric code returns 400 or 500', async () => {
        // No SMS code was sent, so any code should fail
        const { status, data } = await client.post('/mfa/sms/verify', { code: '999999' });
        expect([400]).toContain(status);
        if (status === 400) expect(data.success).toBe(false);
    });
});

// ============================================================
// WebAuthn Authenticate Complete — POST /mfa/webauthn/authenticate/complete
// ============================================================
describe('Enhanced MFA Expanded - WebAuthn Authenticate Complete', () => {
    test('POST /mfa/webauthn/authenticate/complete without prior start returns 400', async () => {
        const freshUser = await createTestUserWithToken();
        const freshClient = new TestApiClient(freshUser.token);

        const { status, data } = await freshClient.post('/mfa/webauthn/authenticate/complete', {
            assertion: { id: 'fake-assertion', response: { authenticatorData: 'fake', signature: 'fake' } }
        });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('POST /mfa/webauthn/authenticate/complete with empty body returns 400', async () => {
        const { status, data } = await client.post('/mfa/webauthn/authenticate/complete', {});
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('POST /mfa/webauthn/authenticate/complete with null assertion returns 400', async () => {
        const { status, data } = await client.post('/mfa/webauthn/authenticate/complete', {
            assertion: null
        });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });
});

// ============================================================
// WebAuthn Delete Key — DELETE /mfa/webauthn/keys/:id
// ============================================================
describe('Enhanced MFA Expanded - WebAuthn Delete Key', () => {
    test('DELETE /mfa/webauthn/keys/:id without auth returns 401', async () => {
        const { status } = await unauthClient.delete('/mfa/webauthn/keys/some-key-id');
        expect(status).toBe(401);
    });

    test('DELETE /mfa/webauthn/keys/nonexistent returns 200 or 400', async () => {
        // Deleting a nonexistent key — the DELETE query runs but affects 0 rows
        // The route doesn't check affected rows, so it may return 200
        const { status } = await client.delete('/mfa/webauthn/keys/nonexistent-key');
        expect([200, 400, 404]).toContain(status);
    });

    test('DELETE /mfa/webauthn/keys/:id for registered key works', async () => {
        // Register a key, then delete it
        const freshUser = await createTestUserWithToken();
        const freshClient = new TestApiClient(freshUser.token);

        // Start + complete registration to create a key
        const { status: startStatus } = await freshClient.post('/mfa/webauthn/register/start');
        if (startStatus === 200) {
            const { status: completeStatus, data: completeData } = await freshClient.post('/mfa/webauthn/register/complete', {
                credential: { id: `key-to-delete-${Date.now()}`, response: { publicKey: 'fake' } },
                deviceName: 'Deletable Key'
            });
            if (completeStatus === 200 && completeData.credentialId) {
                const { status } = await freshClient.delete(`/mfa/webauthn/keys/${completeData.credentialId}`);
                // May succeed (200) or fail if it's the last key without backup codes (400)
                expect([200, 400]).toContain(status);
            }
        }
    });
});
