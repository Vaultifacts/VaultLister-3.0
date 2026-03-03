// Unit tests for webhook processor
import { describe, expect, test } from 'bun:test';
import crypto from 'crypto';
import { verifySignature } from '../backend/services/webhookProcessor.js';

function computeSignature(payload, secret) {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('Webhook Signature Verification', () => {
    const secret = 'test-webhook-secret-123';

    test('should accept valid signature', () => {
        const payload = JSON.stringify({ event: 'test', data: { id: 1 } });
        const sig = computeSignature(payload, secret);
        expect(verifySignature(payload, sig, secret)).toBe(true);
    });

    test('should reject invalid signature', () => {
        const payload = JSON.stringify({ event: 'test' });
        expect(verifySignature(payload, 'sha256=invalid', secret)).toBe(false);
    });

    test('should reject wrong secret', () => {
        const payload = JSON.stringify({ event: 'test' });
        const sig = computeSignature(payload, secret);
        expect(verifySignature(payload, sig, 'wrong-secret')).toBe(false);
    });

    test('should reject tampered payload', () => {
        const originalPayload = JSON.stringify({ event: 'test', amount: 100 });
        const sig = computeSignature(originalPayload, secret);
        const tamperedPayload = JSON.stringify({ event: 'test', amount: 999 });
        expect(verifySignature(tamperedPayload, sig, secret)).toBe(false);
    });

    test('should reject empty signature', () => {
        const payload = JSON.stringify({ event: 'test' });
        expect(verifySignature(payload, '', secret)).toBe(false);
    });

    test('should reject null/undefined inputs', () => {
        expect(verifySignature(null, 'sha256=abc', secret)).toBe(false);
        expect(verifySignature('{}', null, secret)).toBe(false);
    });

    test('should handle empty payload', () => {
        const payload = '';
        const sig = computeSignature(payload, secret);
        expect(verifySignature(payload, sig, secret)).toBe(true);
    });
});
