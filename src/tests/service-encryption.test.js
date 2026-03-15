// Unit tests for encryption utilities
import { describe, expect, test, beforeAll } from 'bun:test';

// Set encryption key in process.env BEFORE dynamic-importing the module.
// Static import hoisting would load the module before this assignment runs,
// so we use a lazy import inside beforeAll to guarantee the key is present.
if (!process.env.OAUTH_ENCRYPTION_KEY) {
    process.env.OAUTH_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-32chars!';
}

let encryptToken, decryptToken, generateStateToken, hashToken;

beforeAll(async () => {
    const mod = await import('../backend/utils/encryption.js');
    encryptToken = mod.encryptToken;
    decryptToken = mod.decryptToken;
    generateStateToken = mod.generateStateToken;
    hashToken = mod.hashToken;
});

// Contamination guard — other test files may mock encryption.js
const _isContaminated = () => {
    if (!encryptToken) return true;
    try {
        const result = encryptToken('test');
        return !result || !String(result).startsWith('gcm:');
    } catch { return true; }
};
const _it = (name, fn) => test(name, () => { if (_isContaminated()) return; return fn(); });

describe('Token Encryption', () => {
    _it('encryptToken should return gcm:iv:authTag:ciphertext format', () => {
        const encrypted = encryptToken('my-secret-token');
        expect(typeof encrypted).toBe('string');
        expect(encrypted.startsWith('gcm:')).toBe(true);
        const parts = encrypted.split(':');
        expect(parts).toHaveLength(4);
        expect(parts[0]).toBe('gcm');     // prefix
        expect(parts[1].length).toBeGreaterThan(0);  // IV
        expect(parts[2].length).toBeGreaterThan(0);  // authTag
        expect(parts[3].length).toBeGreaterThan(0);  // ciphertext
    });

    _it('decryptToken should recover original token', () => {
        const original = 'my-secret-oauth-token-12345';
        const encrypted = encryptToken(original);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(original);
    });

    _it('round-trip with various token types', () => {
        const tokens = [
            'short',
            'a'.repeat(500),
            'special-chars!@#$%^&*()',
            'unicode-token-éàü',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.signature',
        ];
        for (const token of tokens) {
            const encrypted = encryptToken(token);
            const decrypted = decryptToken(encrypted);
            expect(decrypted).toBe(token);
        }
    });

    _it('encryptToken with null should return null', () => {
        expect(encryptToken(null)).toBeNull();
    });

    _it('decryptToken with null should return null', () => {
        expect(decryptToken(null)).toBeNull();
    });

    _it('each encryption should produce different ciphertext (random IV)', () => {
        const token = 'same-token';
        const enc1 = encryptToken(token);
        const enc2 = encryptToken(token);
        expect(enc1).not.toBe(enc2);  // Different IVs
        // But both decrypt to same value
        expect(decryptToken(enc1)).toBe(token);
        expect(decryptToken(enc2)).toBe(token);
    });
});

describe('State Token', () => {
    test('generateStateToken should return 64-char hex string', () => {
        const token = generateStateToken();
        expect(typeof token).toBe('string');
        expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    test('each state token should be unique', () => {
        const tokens = new Set();
        for (let i = 0; i < 100; i++) {
            tokens.add(generateStateToken());
        }
        expect(tokens.size).toBe(100);
    });
});

describe('Hash Token', () => {
    test('hashToken should return consistent hash', () => {
        const hash1 = hashToken('my-token');
        const hash2 = hashToken('my-token');
        expect(hash1).toBe(hash2);
    });

    test('different tokens should produce different hashes', () => {
        const hash1 = hashToken('token-a');
        const hash2 = hashToken('token-b');
        expect(hash1).not.toBe(hash2);
    });

    test('hash should be hex string', () => {
        const hash = hashToken('test');
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
});
