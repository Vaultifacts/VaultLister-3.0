// Unit tests for auth middleware: token generation, verification, tier checks
import { describe, expect, test, beforeAll } from 'bun:test';
import { generateToken, verifyToken, generateRefreshToken, checkTierPermission } from '../backend/middleware/auth.js';

// Ensure JWT_SECRET is set for testing
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-secret-for-unit-tests-only';
}

const mockUser = {
    id: 'user-test-123',
    email: 'test@example.com',
    tier: 'pro'
};

describe('Token Generation & Verification', () => {
    let accessToken, refreshToken;

    test('generateToken should return a JWT string', () => {
        accessToken = generateToken(mockUser);
        expect(typeof accessToken).toBe('string');
        expect(accessToken.split('.')).toHaveLength(3);
    });

    test('verifyToken should decode a valid access token', () => {
        const decoded = verifyToken(accessToken);
        expect(decoded).not.toBeNull();
        expect(decoded.userId).toBe(mockUser.id);
        expect(decoded.email).toBe(mockUser.email);
        expect(decoded.type).toBe('access');
    });

    test('generateRefreshToken should return a JWT string', () => {
        refreshToken = generateRefreshToken(mockUser);
        expect(typeof refreshToken).toBe('string');
        expect(refreshToken.split('.')).toHaveLength(3);
    });

    test('verifyToken should decode a valid refresh token', () => {
        const decoded = verifyToken(refreshToken);
        expect(decoded).not.toBeNull();
        expect(decoded.userId).toBe(mockUser.id);
        expect(decoded.type).toBe('refresh');
    });

    test('verifyToken should reject tampered token', () => {
        const tampered = accessToken.slice(0, -5) + 'xxxxx';
        const decoded = verifyToken(tampered);
        expect(decoded).toBeNull();
    });

    test('verifyToken should reject empty/null token', () => {
        expect(verifyToken('')).toBeNull();
        expect(verifyToken(null)).toBeNull();
        expect(verifyToken(undefined)).toBeNull();
    });

    test('generateToken with custom expiry', () => {
        const shortToken = generateToken(mockUser, '1s');
        expect(typeof shortToken).toBe('string');
        const decoded = verifyToken(shortToken);
        expect(decoded).not.toBeNull();
    });
});

describe('Tier Permission Checks', () => {
    const freeUser = { id: 'u1', subscription_tier: 'free' };
    const starterUser = { id: 'u2', subscription_tier: 'starter' };
    const proUser = { id: 'u3', subscription_tier: 'pro' };

    test('free tier should have listing limit', async () => {
        const result = await checkTierPermission(freeUser, 'listings');
        expect(result.limit).toBeDefined();
        expect(typeof result.allowed).toBe('boolean');
    });

    test('free tier should not allow AI features', async () => {
        const result = await checkTierPermission(freeUser, 'aiFeatures');
        expect(result.allowed).toBe(false);
    });

    test('pro tier should allow AI features', async () => {
        const result = await checkTierPermission(proUser, 'aiFeatures');
        expect(result.allowed).toBe(true);
    });

    test('starter tier should allow automations', async () => {
        const result = await checkTierPermission(starterUser, 'automations');
        expect(result.allowed).toBe(true);
    });

    test('free tier should not allow automations', async () => {
        const result = await checkTierPermission(freeUser, 'automations');
        expect(result.allowed).toBe(false);
    });

    test('should handle unknown feature gracefully', async () => {
        const result = await checkTierPermission(proUser, 'nonexistent_feature');
        // Should not throw, return some default
        expect(result).toBeDefined();
    });
});
