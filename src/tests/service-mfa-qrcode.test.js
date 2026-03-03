// MFA Service — generateQRCode Pure Function Tests
import { describe, expect, test } from 'bun:test';
import { generateQRCode, generateSecret } from '../backend/services/mfa.js';

describe('generateQRCode', () => {
    test('returns a data URL string', async () => {
        const { otpauth } = generateSecret('test@example.com');
        const qr = await generateQRCode(otpauth);
        expect(typeof qr).toBe('string');
        expect(qr.startsWith('data:image/png;base64,')).toBe(true);
    });

    test('returns non-empty base64 data', async () => {
        const { otpauth } = generateSecret('user@test.com');
        const qr = await generateQRCode(otpauth);
        const base64Part = qr.replace('data:image/png;base64,', '');
        expect(base64Part.length).toBeGreaterThan(100);
    });

    test('different inputs produce different QR codes', async () => {
        const s1 = generateSecret('alice@test.com');
        const s2 = generateSecret('bob@test.com');
        const qr1 = await generateQRCode(s1.otpauth);
        const qr2 = await generateQRCode(s2.otpauth);
        expect(qr1).not.toBe(qr2);
    });
});
