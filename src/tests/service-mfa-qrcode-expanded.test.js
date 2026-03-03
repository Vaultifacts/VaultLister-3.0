// MFA Service — Expanded Unit Tests
// Tests generateSecret, verifyToken, generateBackupCodes, verifyBackupCode
import { describe, expect, test, beforeAll } from 'bun:test';
import {
    generateSecret,
    generateQRCode,
    verifyToken,
    generateBackupCodes,
    verifyBackupCode
} from '../backend/services/mfa.js';

describe('generateSecret', () => {
    test('returns object with secret and otpauth', () => {
        const result = generateSecret('test@example.com');
        expect(typeof result.secret).toBe('string');
        expect(typeof result.otpauth).toBe('string');
        expect(result.secret.length).toBeGreaterThan(0);
    });

    test('otpauth contains issuer and label', () => {
        const result = generateSecret('alice@test.com');
        expect(result.otpauth).toContain('VaultLister');
        expect(result.otpauth).toContain('alice%40test.com');
    });

    test('different emails produce different secrets', () => {
        const s1 = generateSecret('a@test.com');
        const s2 = generateSecret('b@test.com');
        expect(s1.secret).not.toBe(s2.secret);
    });

    test('otpauth is a valid URI', () => {
        const result = generateSecret('user@example.com');
        expect(result.otpauth.startsWith('otpauth://totp/')).toBe(true);
    });
});

describe('generateQRCode', () => {
    test('returns data URL for valid input', async () => {
        const { otpauth } = generateSecret('test@example.com');
        const qr = await generateQRCode(otpauth);
        expect(qr.startsWith('data:image/png;base64,')).toBe(true);
    });

    test('base64 data is substantial (not trivially small)', async () => {
        const { otpauth } = generateSecret('user@test.com');
        const qr = await generateQRCode(otpauth);
        const b64 = qr.replace('data:image/png;base64,', '');
        expect(b64.length).toBeGreaterThan(100);
    });
});

describe('verifyToken', () => {
    test('rejects empty token', () => {
        const { secret } = generateSecret('test@example.com');
        const result = verifyToken('', secret);
        expect(result).toBe(false);
    });

    test('rejects non-numeric token', () => {
        const { secret } = generateSecret('test@example.com');
        const result = verifyToken('abcdef', secret);
        expect(result).toBe(false);
    });

    test('rejects wrong-length token', () => {
        const { secret } = generateSecret('test@example.com');
        const result = verifyToken('123', secret);
        expect(result).toBe(false);
    });

    test('rejects invalid token format', () => {
        const { secret } = generateSecret('test@example.com');
        // Non-numeric tokens should always fail
        const result = verifyToken('ABCDEF', secret);
        expect(result).toBe(false);
    });
});

describe('generateBackupCodes', () => {
    // Generate once — bcrypt hashing 10 codes is expensive (~5s)
    let codes, hashedCodes;
    beforeAll(() => {
        const result = generateBackupCodes();
        codes = result.codes;
        hashedCodes = result.hashedCodes;
    });

    test('returns codes and hashedCodes arrays', () => {
        expect(Array.isArray(codes)).toBe(true);
        expect(Array.isArray(hashedCodes)).toBe(true);
    });

    test('generates exactly 10 codes', () => {
        expect(codes.length).toBe(10);
        expect(hashedCodes.length).toBe(10);
    });

    test('codes are in XXXX-XXXX format', () => {
        for (const code of codes) {
            expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
        }
    });

    test('all codes are unique', () => {
        const unique = new Set(codes);
        expect(unique.size).toBe(codes.length);
    });

    test('hashed codes are bcrypt hashes', () => {
        for (const hash of hashedCodes) {
            expect(hash.startsWith('$2')).toBe(true);
            expect(hash.length).toBeGreaterThan(50);
        }
    });

    test('all 10 codes are distinct within a single generation', () => {
        const unique = new Set(codes);
        expect(unique.size).toBe(10);
    });
});

describe('verifyBackupCode', () => {
    // Generate one set of codes for all verify tests (bcrypt is slow)
    let sharedCodes, sharedHashes;
    beforeAll(() => {
        const result = generateBackupCodes();
        sharedCodes = result.codes;
        sharedHashes = [...result.hashedCodes];
    });

    test('verifies a valid backup code and invalidates it', async () => {
        const result = await verifyBackupCode(sharedCodes[0], sharedHashes);
        expect(result.valid).toBe(true);
        expect(result.index).toBe(0);
        // Code 0 is now invalidated — reuse should fail
        const reuse = await verifyBackupCode(sharedCodes[0], result.updatedCodes);
        expect(reuse.valid).toBe(false);
    });

    test('accepts lowercase input', async () => {
        const lower = sharedCodes[1].toLowerCase();
        const result = await verifyBackupCode(lower, sharedHashes);
        expect(result.valid).toBe(true);
    });

    test('rejects invalid code', async () => {
        const result = await verifyBackupCode('ZZZZ-ZZZZ', sharedHashes);
        expect(result.valid).toBe(false);
    });
});
