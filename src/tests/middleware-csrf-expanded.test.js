// CSRF Middleware — Pure Function & Lifecycle Unit Tests
import { describe, expect, test } from 'bun:test';
import { csrfConfig, csrfManager, addCSRFToken, validateCSRF, applyCSRFProtection } from '../backend/middleware/csrf.js';

describe('csrfConfig', () => {
    test('has headerNames array with expected values', () => {
        expect(Array.isArray(csrfConfig.headerNames)).toBe(true);
        expect(csrfConfig.headerNames).toContain('X-CSRF-Token');
        expect(csrfConfig.headerNames).toContain('CSRF-Token');
    });

    test('has cookie configuration', () => {
        expect(csrfConfig.cookie).toBeDefined();
        expect(csrfConfig.cookie.name).toBe('XSRF-TOKEN');
        expect(csrfConfig.cookie.httpOnly).toBe(false);
        expect(csrfConfig.cookie.sameSite).toBe('strict');
    });

    test('has skipPaths array', () => {
        expect(Array.isArray(csrfConfig.skipPaths)).toBe(true);
        expect(csrfConfig.skipPaths).toContain('/api/auth/login');
        expect(csrfConfig.skipPaths).toContain('/api/auth/register');
        expect(csrfConfig.skipPaths).toContain('/api/health');
    });
});

describe('CSRFManager lifecycle', () => {
    test('generateToken returns a hex string', () => {
        const token = csrfManager.generateToken('test-session');
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64); // 32 bytes = 64 hex chars
        expect(token).toMatch(/^[0-9a-f]+$/);
    });

    test('validateToken returns true for a valid token', () => {
        const token = csrfManager.generateToken('session-1');
        expect(csrfManager.validateToken(token, 'session-1')).toBe(true);
    });

    test('validateToken returns false for unknown token', () => {
        expect(csrfManager.validateToken('nonexistent-token')).toBe(false);
    });

    test('validateToken returns false for null token', () => {
        expect(csrfManager.validateToken(null)).toBe(false);
    });

    test('validateToken fails with wrong session ID', () => {
        const token = csrfManager.generateToken('session-a');
        expect(csrfManager.validateToken(token, 'session-b')).toBe(false);
    });

    test('consumeToken invalidates the token', () => {
        const token = csrfManager.generateToken('session-consume');
        expect(csrfManager.validateToken(token)).toBe(true);
        csrfManager.consumeToken(token);
        expect(csrfManager.validateToken(token)).toBe(false);
    });

    test('getStats returns object with totalTokens and oldestToken', () => {
        const stats = csrfManager.getStats();
        expect(typeof stats.totalTokens).toBe('number');
        expect(typeof stats.oldestToken).toBe('number');
    });

    test('getStats.totalTokens increases after generating tokens', () => {
        const before = csrfManager.getStats().totalTokens;
        csrfManager.generateToken('stats-test');
        const after = csrfManager.getStats().totalTokens;
        expect(after).toBeGreaterThan(before);
    });
});

describe('addCSRFToken', () => {
    test('returns a token string and sets ctx.csrfToken', () => {
        const ctx = { ip: '127.0.0.1' };
        const token = addCSRFToken(ctx);
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64);
        expect(ctx.csrfToken).toBe(token);
    });

    test('uses user.id as session ID when available', () => {
        const ctx = { user: { id: 'user-123' }, ip: '127.0.0.1' };
        const token = addCSRFToken(ctx);
        expect(csrfManager.validateToken(token, 'user-123')).toBe(true);
    });
});

describe('validateCSRF', () => {
    // In NODE_ENV=test, CSRF validation is disabled — always returns { valid: true }
    test('returns valid:true in test environment', () => {
        const result = validateCSRF({ method: 'POST', headers: {}, path: '/api/test' });
        expect(result.valid).toBe(true);
    });

    test('returns valid:true for GET requests', () => {
        const result = validateCSRF({ method: 'GET', headers: {}, path: '/api/test' });
        expect(result.valid).toBe(true);
    });
});

describe('applyCSRFProtection', () => {
    test('returns null (no error) in test environment', () => {
        const result = applyCSRFProtection({ method: 'POST', headers: {}, path: '/api/test' });
        expect(result).toBeNull();
    });
});
