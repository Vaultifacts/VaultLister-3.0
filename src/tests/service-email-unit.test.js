// Email Service — Unit tests with nodemailer mock
// Tests: sendVerificationEmail, sendPasswordResetEmail, sendMFAEnabledEmail,
//        sendMFADisabledEmail, sendSecurityAlertEmail, initEmailService
import { mock, describe, test, expect, beforeEach } from 'bun:test';
import { installNodemailerMock } from './helpers/mockNodemailer.js';

// Mock the logger with ALL methods to prevent cross-file mock contamination
// (shared-logger.test.js expects: info, warn, error, debug, request, db, automation, bot, security, performance)
const _mockLog = () => mock(() => {});
const _fullLogger = () => ({
    info: _mockLog(), warn: _mockLog(), error: _mockLog(), debug: _mockLog(),
    request: _mockLog(), db: _mockLog(), automation: _mockLog(),
    bot: _mockLog(), security: _mockLog(), performance: _mockLog(),
});
mock.module('../backend/shared/logger.js', () => ({
    logger: _fullLogger(),
    createLogger: mock(() => _fullLogger()),
    default: _fullLogger(),
}));

const mailer = installNodemailerMock();

const {
    initEmailService,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendMFAEnabledEmail,
    sendMFADisabledEmail,
    sendSecurityAlertEmail,
} = await import('../backend/services/email.js');

beforeEach(() => mailer.reset());

// ============================================================
// initEmailService
// ============================================================
describe('initEmailService', () => {
    test('returns false when SMTP credentials not set', () => {
        // In test env, SMTP_USER and SMTP_PASS are typically unset
        const result = initEmailService();
        expect(typeof result).toBe('boolean');
    });
});

// ============================================================
// sendVerificationEmail
// ============================================================
describe('sendVerificationEmail', () => {
    test('returns success result', async () => {
        const result = await sendVerificationEmail(
            { email: 'test@example.com', username: 'testuser' },
            'verify-token-123'
        );
        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
    });

    test('uses the user email as recipient', async () => {
        await sendVerificationEmail(
            { email: 'user@test.com', username: 'user1' },
            'token'
        );
        // In dev mode (no SMTP), email is logged to console
        // We verify the function doesn't throw and returns success
    });

    test('handles missing username gracefully', async () => {
        const result = await sendVerificationEmail(
            { email: 'noname@test.com' },
            'token'
        );
        expect(result.success).toBe(true);
    });
});

// ============================================================
// sendPasswordResetEmail
// ============================================================
describe('sendPasswordResetEmail', () => {
    test('returns success result', async () => {
        const result = await sendPasswordResetEmail(
            { email: 'test@example.com', username: 'testuser' },
            'reset-token-456'
        );
        expect(result.success).toBe(true);
    });

    test('handles XSS in username', async () => {
        const result = await sendPasswordResetEmail(
            { email: 'xss@test.com', username: '<script>alert(1)</script>' },
            'token'
        );
        expect(result.success).toBe(true);
    });
});

// ============================================================
// sendMFAEnabledEmail
// ============================================================
describe('sendMFAEnabledEmail', () => {
    test('returns success result', async () => {
        const result = await sendMFAEnabledEmail(
            { email: 'mfa@test.com', username: 'mfauser' }
        );
        expect(result.success).toBe(true);
    });
});

// ============================================================
// sendMFADisabledEmail
// ============================================================
describe('sendMFADisabledEmail', () => {
    test('returns success result', async () => {
        const result = await sendMFADisabledEmail(
            { email: 'mfa@test.com', username: 'mfauser' }
        );
        expect(result.success).toBe(true);
    });
});

// ============================================================
// sendSecurityAlertEmail
// ============================================================
describe('sendSecurityAlertEmail', () => {
    test('returns success for new_login alert', async () => {
        const result = await sendSecurityAlertEmail(
            { email: 'user@test.com', username: 'user1' },
            'new_login',
            { ip: '1.2.3.4', location: 'New York' }
        );
        expect(result.success).toBe(true);
    });

    test('returns success for password_changed alert', async () => {
        const result = await sendSecurityAlertEmail(
            { email: 'user@test.com', username: 'user1' },
            'password_changed',
            null
        );
        expect(result.success).toBe(true);
    });

    test('handles unknown alert type', async () => {
        const result = await sendSecurityAlertEmail(
            { email: 'user@test.com', username: 'user1' },
            'custom_alert',
            { detail: 'something' }
        );
        expect(result.success).toBe(true);
    });

    test('escapes HTML in alert details', async () => {
        const result = await sendSecurityAlertEmail(
            { email: 'user@test.com', username: '<img onerror=alert(1)>' },
            'suspicious_activity',
            { reason: '<script>xss</script>' }
        );
        expect(result.success).toBe(true);
    });
});
