// MFA Service — Unit Tests (pure functions only)
import { describe, expect, test } from 'bun:test';
import {
    generateSecret,
    verifyToken,
    generateBackupCodes,
    verifyBackupCode
} from '../backend/services/mfa.js';

describe('generateSecret', () => {
    test('returns secret and otpauth URI', () => {
        const result = generateSecret('user@example.com');
        expect(result).toHaveProperty('secret');
        expect(result).toHaveProperty('otpauth');
        expect(typeof result.secret).toBe('string');
        expect(result.secret.length).toBeGreaterThan(0);
    });

    test('otpauth contains issuer', () => {
        const result = generateSecret('user@example.com');
        expect(result.otpauth).toContain('VaultLister');
    });

    test('otpauth contains email label (URL-encoded)', () => {
        const result = generateSecret('test@test.com');
        // @ is URL-encoded to %40 in otpauth URI
        expect(result.otpauth).toContain('test%40test.com');
    });

    test('generates unique secrets', () => {
        const s1 = generateSecret('a@a.com');
        const s2 = generateSecret('b@b.com');
        expect(s1.secret).not.toBe(s2.secret);
    });

    test('secret is base32 format', () => {
        const result = generateSecret('user@test.com');
        // Base32 uses A-Z and 2-7
        expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    });
});

describe('verifyToken', () => {
    test('returns boolean', () => {
        const { secret } = generateSecret('test@test.com');
        const result = verifyToken('000000', secret);
        expect(typeof result).toBe('boolean');
    });

    test('rejects empty token', () => {
        const { secret } = generateSecret('test@test.com');
        expect(verifyToken('', secret)).toBe(false);
    });

    test('rejects wrong-length token', () => {
        const { secret } = generateSecret('test@test.com');
        expect(verifyToken('12345', secret)).toBe(false);
    });

    test('rejects non-numeric token', () => {
        const { secret } = generateSecret('test@test.com');
        expect(verifyToken('abcdef', secret)).toBe(false);
    });
});

describe('generateBackupCodes', () => {
    test('generates 10 codes', async () => {
        const result = await generateBackupCodes();
        expect(result).toHaveProperty('codes');
        expect(result).toHaveProperty('hashedCodes');
        expect(result.codes.length).toBe(10);
        expect(result.hashedCodes.length).toBe(10);
    }, 30000);

    test('codes are in XXXX-XXXX format', async () => {
        const result = await generateBackupCodes();
        for (const code of result.codes) {
            expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
        }
    }, 30000);

    test('hashed codes are bcrypt hashes', async () => {
        const result = await generateBackupCodes();
        for (const hash of result.hashedCodes) {
            expect(hash.startsWith('$2')).toBe(true);
        }
    }, 30000);

    test('all codes are unique', async () => {
        const result = await generateBackupCodes();
        expect(new Set(result.codes).size).toBe(10);
    }, 30000);

    test('codes and hashes correspond (different batches are different)', async () => {
        const r1 = await generateBackupCodes();
        const r2 = await generateBackupCodes();
        // Different batches should have different codes
        expect(r1.codes).not.toEqual(r2.codes);
    }, 30000);
});

describe('verifyBackupCode', () => {
    test('verifies valid backup code', async () => {
        const { codes, hashedCodes } = await generateBackupCodes();
        const result = await verifyBackupCode(codes[0], [...hashedCodes]);
        expect(result.valid).toBe(true);
        expect(result.index).toBe(0);
    }, 30000);

    test('rejects invalid backup code', async () => {
        const { hashedCodes } = await generateBackupCodes();
        const result = await verifyBackupCode('ZZZZ-ZZZZ', [...hashedCodes]);
        expect(result.valid).toBe(false);
    }, 30000);

    test('nullifies used code in array', async () => {
        const { codes, hashedCodes } = await generateBackupCodes();
        const codesCopy = [...hashedCodes];
        await verifyBackupCode(codes[0], codesCopy);
        expect(codesCopy[0]).toBeNull();
    }, 30000);

    test('verifies different codes from same batch', async () => {
        const { codes, hashedCodes } = await generateBackupCodes();
        const codesCopy = [...hashedCodes];

        const r1 = await verifyBackupCode(codes[3], codesCopy);
        expect(r1.valid).toBe(true);
        expect(r1.index).toBe(3);

        const r2 = await verifyBackupCode(codes[7], codesCopy);
        expect(r2.valid).toBe(true);
        expect(r2.index).toBe(7);
    }, 30000);

    test('rejects already-used code', async () => {
        const { codes, hashedCodes } = await generateBackupCodes();
        const codesCopy = [...hashedCodes];

        // Use the code
        await verifyBackupCode(codes[0], codesCopy);
        // Try to reuse it
        const result = await verifyBackupCode(codes[0], codesCopy);
        expect(result.valid).toBe(false);
    }, 30000);
});
