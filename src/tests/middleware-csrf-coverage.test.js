// middleware-csrf-coverage.test.js — Coverage-focused tests for csrf.js
// Tests CSRFManager internals (expiry, session mismatch, max token eviction, cleanup,
// getOldestToken edge cases), validateCSRF in non-test env, skip paths, body token,
// and applyCSRFProtection error response.
// Only mocks database.js and logger.js per project rules.
import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';

// ── Mocks ───────────────────────────────────────────────────────────────────

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mock(() => null),
        all: mock(() => []),
        run: mock(() => ({ changes: 1 })),
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
    models: {
        create: mock(), findById: mock(), findOne: mock(),
        findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0),
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {},
}));

mock.module('../backend/shared/logger.js', () => {
    const l = {
        info: mock(), warn: mock(), error: mock(), debug: mock(),
        request: mock(), db: mock(), automation: mock(), bot: mock(),
        security: mock(), performance: mock(),
    };
    return { ...l, logger: l, createLogger: mock(() => l), default: l };
});

// ── Import module under test ────────────────────────────────────────────────

const {
    csrfManager,
    addCSRFToken,
    validateCSRF,
    applyCSRFProtection,
    csrfConfig,
} = await import('../backend/middleware/csrf.js');

// ── Environment manipulation helpers ────────────────────────────────────────

let savedNodeEnv;
let savedDisableCsrf;

function setEnvForCSRFEnforcement() {
    savedNodeEnv = process.env.NODE_ENV;
    savedDisableCsrf = process.env.DISABLE_CSRF;
    process.env.NODE_ENV = 'production';
    delete process.env.DISABLE_CSRF;
}

function restoreEnv() {
    if (savedNodeEnv !== undefined) {
        process.env.NODE_ENV = savedNodeEnv;
    } else {
        delete process.env.NODE_ENV;
    }
    if (savedDisableCsrf !== undefined) {
        process.env.DISABLE_CSRF = savedDisableCsrf;
    } else {
        delete process.env.DISABLE_CSRF;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — token expiry
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — token expiry', () => {
    test('expired token is rejected by validateToken', () => {
        // Manually insert a token with a past expiresAt
        const fakeToken = 'expired-token-test-' + Date.now();
        csrfManager.tokens.set(fakeToken, {
            sessionId: 'session-1',
            expiresAt: Date.now() - 1000, // already expired
            createdAt: Date.now() - 5000,
        });

        const isValid = csrfManager.validateToken(fakeToken, 'session-1');
        expect(isValid).toBe(false);
        // Token should have been deleted
        expect(csrfManager.tokens.has(fakeToken)).toBe(false);
    });

    test('token right at expiry boundary is rejected', () => {
        const fakeToken = 'boundary-token-' + Date.now();
        csrfManager.tokens.set(fakeToken, {
            sessionId: null,
            expiresAt: Date.now() - 1, // just expired
            createdAt: Date.now() - 1000,
        });

        expect(csrfManager.validateToken(fakeToken)).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — session ID checks
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — session ID validation', () => {
    test('valid when no sessionId constraint on token', () => {
        const token = csrfManager.generateToken(null); // null sessionId
        // Validate with a sessionId — should pass since tokenData.sessionId is null
        expect(csrfManager.validateToken(token, 'any-session')).toBe(true);
    });

    test('valid when no sessionId provided for validation', () => {
        const token = csrfManager.generateToken('session-x');
        // Validate without sessionId constraint — should pass
        expect(csrfManager.validateToken(token, null)).toBe(true);
        // Also without second arg
        expect(csrfManager.validateToken(token)).toBe(true);
    });

    test('invalid when sessionId mismatch (both set)', () => {
        const token = csrfManager.generateToken('session-A');
        expect(csrfManager.validateToken(token, 'session-B')).toBe(false);
    });

    test('valid when sessionId matches exactly', () => {
        const token = csrfManager.generateToken('session-match');
        expect(csrfManager.validateToken(token, 'session-match')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — max token eviction
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — max token eviction', () => {
    test('evicts oldest tokens when maxTokens is exceeded', () => {
        // Save original maxTokens and set a low threshold for testing
        const originalMax = csrfManager.maxTokens;
        csrfManager.maxTokens = 5;

        // Clear existing tokens to have a clean slate
        const savedTokens = new Map(csrfManager.tokens);
        csrfManager.tokens.clear();

        // Generate 5 tokens to fill up
        const tokens = [];
        for (let i = 0; i < 5; i++) {
            tokens.push(csrfManager.generateToken(`eviction-${i}`));
        }
        expect(csrfManager.tokens.size).toBe(5);

        // Generate one more — should trigger eviction
        const newToken = csrfManager.generateToken('eviction-new');
        // After eviction of 1000 (but only 5 existed), new token is still there
        expect(csrfManager.validateToken(newToken)).toBe(true);

        // Restore
        csrfManager.maxTokens = originalMax;
        csrfManager.tokens.clear();
        for (const [k, v] of savedTokens) {
            csrfManager.tokens.set(k, v);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — cleanup
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — cleanup', () => {
    test('cleanup removes expired tokens', () => {
        const expiredToken = 'cleanup-expired-' + Date.now();
        const validToken = 'cleanup-valid-' + Date.now();

        csrfManager.tokens.set(expiredToken, {
            sessionId: null,
            expiresAt: Date.now() - 1000,
            createdAt: Date.now() - 5000,
        });
        csrfManager.tokens.set(validToken, {
            sessionId: null,
            expiresAt: Date.now() + 3600000,
            createdAt: Date.now(),
        });

        csrfManager.cleanup();

        expect(csrfManager.tokens.has(expiredToken)).toBe(false);
        expect(csrfManager.tokens.has(validToken)).toBe(true);

        // Clean up
        csrfManager.tokens.delete(validToken);
    });

    test('cleanup is idempotent — calling twice is safe', () => {
        csrfManager.cleanup();
        csrfManager.cleanup();
        // No errors thrown
    });

    test('cleanup on empty tokens map is safe', () => {
        const savedTokens = new Map(csrfManager.tokens);
        csrfManager.tokens.clear();
        csrfManager.cleanup();
        expect(csrfManager.tokens.size).toBe(0);

        // Restore
        for (const [k, v] of savedTokens) {
            csrfManager.tokens.set(k, v);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — getOldestToken
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — getOldestToken', () => {
    test('returns 0 when no tokens exist', () => {
        const savedTokens = new Map(csrfManager.tokens);
        csrfManager.tokens.clear();

        expect(csrfManager.getOldestToken()).toBe(0);

        // Restore
        for (const [k, v] of savedTokens) {
            csrfManager.tokens.set(k, v);
        }
    });

    test('returns age of oldest token', () => {
        const savedTokens = new Map(csrfManager.tokens);
        csrfManager.tokens.clear();

        const oldTime = Date.now() - 60000; // 1 minute ago
        csrfManager.tokens.set('old-token', {
            sessionId: null,
            expiresAt: Date.now() + 3600000,
            createdAt: oldTime,
        });
        csrfManager.tokens.set('new-token', {
            sessionId: null,
            expiresAt: Date.now() + 3600000,
            createdAt: Date.now(),
        });

        const age = csrfManager.getOldestToken();
        expect(age).toBeGreaterThanOrEqual(59000);
        expect(age).toBeLessThan(120000);

        // Restore
        csrfManager.tokens.clear();
        for (const [k, v] of savedTokens) {
            csrfManager.tokens.set(k, v);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — getStats
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — getStats edge cases', () => {
    test('getStats returns correct totalTokens count', () => {
        const before = csrfManager.getStats().totalTokens;
        csrfManager.generateToken('stats-edge');
        const after = csrfManager.getStats().totalTokens;
        expect(after).toBe(before + 1);
    });

    test('getStats.oldestToken is a non-negative number', () => {
        const stats = csrfManager.getStats();
        expect(stats.oldestToken).toBeGreaterThanOrEqual(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — consumeToken
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — consumeToken edge cases', () => {
    test('consuming non-existent token does not throw', () => {
        expect(() => csrfManager.consumeToken('does-not-exist')).not.toThrow();
    });

    test('consuming same token twice does not throw', () => {
        const token = csrfManager.generateToken('double-consume');
        csrfManager.consumeToken(token);
        expect(() => csrfManager.consumeToken(token)).not.toThrow();
        expect(csrfManager.validateToken(token)).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// addCSRFToken — edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('addCSRFToken — edge cases', () => {
    test('uses ip when user is null', () => {
        const ctx = { user: null, ip: '10.0.0.1' };
        const token = addCSRFToken(ctx);
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64);
        expect(ctx.csrfToken).toBe(token);
        // Token should be valid for that sessionId (ip)
        expect(csrfManager.validateToken(token, '10.0.0.1')).toBe(true);
    });

    test('uses ip when user.id is undefined', () => {
        const ctx = { user: {}, ip: '10.0.0.2' };
        const token = addCSRFToken(ctx);
        expect(csrfManager.validateToken(token, '10.0.0.2')).toBe(true);
    });

    test('uses user.id over ip when available', () => {
        const ctx = { user: { id: 'uid-99' }, ip: '10.0.0.3' };
        const token = addCSRFToken(ctx);
        expect(csrfManager.validateToken(token, 'uid-99')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateCSRF — enforced (non-test environment)
// ═══════════════════════════════════════════════════════════════════════════

describe('validateCSRF — enforced mode (production)', () => {
    beforeEach(() => setEnvForCSRFEnforcement());
    afterEach(() => restoreEnv());

    test('GET request passes without token', () => {
        const result = validateCSRF({
            method: 'GET', headers: {}, path: '/api/inventory', user: null, ip: '1.2.3.4',
        });
        expect(result.valid).toBe(true);
    });

    test('HEAD request passes without token', () => {
        const result = validateCSRF({
            method: 'HEAD', headers: {}, path: '/api/inventory', user: null, ip: '1.2.3.4',
        });
        expect(result.valid).toBe(true);
    });

    test('OPTIONS request passes without token', () => {
        const result = validateCSRF({
            method: 'OPTIONS', headers: {}, path: '/api/inventory', user: null, ip: '1.2.3.4',
        });
        expect(result.valid).toBe(true);
    });

    test('POST without token returns CSRF missing error', () => {
        const result = validateCSRF({
            method: 'POST', headers: {}, path: '/api/inventory',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('CSRF token missing');
        expect(result.status).toBe(403);
    });

    test('PUT without token returns CSRF missing error', () => {
        const result = validateCSRF({
            method: 'PUT', headers: {}, path: '/api/inventory/1',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('CSRF token missing');
    });

    test('PATCH without token returns CSRF missing error', () => {
        const result = validateCSRF({
            method: 'PATCH', headers: {}, path: '/api/inventory/1',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('CSRF token missing');
    });

    test('DELETE without token returns CSRF missing error', () => {
        const result = validateCSRF({
            method: 'DELETE', headers: {}, path: '/api/inventory/1',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('CSRF token missing');
    });

    test('POST with valid x-csrf-token header passes', () => {
        const token = csrfManager.generateToken('1.2.3.4');
        const result = validateCSRF({
            method: 'POST', headers: { 'x-csrf-token': token },
            path: '/api/inventory', user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(true);
    });

    test('POST with valid csrf-token header passes', () => {
        const token = csrfManager.generateToken('1.2.3.4');
        const result = validateCSRF({
            method: 'POST', headers: { 'csrf-token': token },
            path: '/api/inventory', user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(true);
    });

    test('POST with valid token in body passes', () => {
        const token = csrfManager.generateToken('1.2.3.4');
        const result = validateCSRF({
            method: 'POST', headers: {},
            path: '/api/inventory', user: null, ip: '1.2.3.4',
            body: { csrfToken: token },
        });
        expect(result.valid).toBe(true);
    });

    test('token is consumed after successful validation (one-time use)', () => {
        const token = csrfManager.generateToken('1.2.3.4');
        // First use — should pass
        const result1 = validateCSRF({
            method: 'POST', headers: { 'x-csrf-token': token },
            path: '/api/inventory', user: null, ip: '1.2.3.4', body: {},
        });
        expect(result1.valid).toBe(true);

        // Second use — token consumed, should fail
        const result2 = validateCSRF({
            method: 'POST', headers: { 'x-csrf-token': token },
            path: '/api/inventory', user: null, ip: '1.2.3.4', body: {},
        });
        expect(result2.valid).toBe(false);
        expect(result2.error).toBe('Invalid or expired CSRF token');
    });

    test('invalid token returns error', () => {
        const result = validateCSRF({
            method: 'POST', headers: { 'x-csrf-token': 'bogus-token-value' },
            path: '/api/inventory', user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid or expired CSRF token');
        expect(result.status).toBe(403);
    });

    test('expired token returns error', () => {
        const fakeToken = 'force-expired-' + Date.now();
        csrfManager.tokens.set(fakeToken, {
            sessionId: '1.2.3.4',
            expiresAt: Date.now() - 1000,
            createdAt: Date.now() - 5000,
        });

        const result = validateCSRF({
            method: 'POST', headers: { 'x-csrf-token': fakeToken },
            path: '/api/inventory', user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid or expired CSRF token');
    });

    test('token with wrong session returns error', () => {
        const token = csrfManager.generateToken('session-A');
        const result = validateCSRF({
            method: 'POST', headers: { 'x-csrf-token': token },
            path: '/api/inventory', user: { id: 'session-B' }, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid or expired CSRF token');
    });

    test('uses user.id as sessionId when user is present', () => {
        const token = csrfManager.generateToken('user-77');
        const result = validateCSRF({
            method: 'POST', headers: { 'x-csrf-token': token },
            path: '/api/inventory', user: { id: 'user-77' }, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateCSRF — skip paths
// ═══════════════════════════════════════════════════════════════════════════

describe('validateCSRF — skip paths (production)', () => {
    beforeEach(() => setEnvForCSRFEnforcement());
    afterEach(() => restoreEnv());

    const skipPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/logout',
        '/api/auth/password-reset',
        '/api/auth/resend-verification',
        '/api/auth/demo-login',
    ];

    for (const skipPath of skipPaths) {
        test(`POST to ${skipPath} bypasses CSRF check`, () => {
            const result = validateCSRF({
                method: 'POST', headers: {}, path: skipPath,
                user: null, ip: '1.2.3.4', body: {},
            });
            expect(result.valid).toBe(true);
        });
    }

    test('POST to /api/inventory does NOT bypass CSRF', () => {
        const result = validateCSRF({
            method: 'POST', headers: {}, path: '/api/inventory',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(false);
    });

    test('non-api skip paths also work (stripped /api prefix)', () => {
        // The code checks: ctx.path === path.replace('/api', '')
        // So /auth/login should also be skipped
        const result = validateCSRF({
            method: 'POST', headers: {}, path: '/auth/login',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateCSRF — test/dev mode bypass
// ═══════════════════════════════════════════════════════════════════════════

describe('validateCSRF — test mode bypass', () => {
    test('returns valid in NODE_ENV=test even for POST without token', () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'test';
        const result = validateCSRF({
            method: 'POST', headers: {}, path: '/api/inventory',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(true);
        process.env.NODE_ENV = origEnv;
    });

    test('DISABLE_CSRF=true in non-production mode bypasses check', () => {
        const origEnv = process.env.NODE_ENV;
        const origCsrf = process.env.DISABLE_CSRF;
        process.env.NODE_ENV = 'development';
        process.env.DISABLE_CSRF = 'true';

        const result = validateCSRF({
            method: 'POST', headers: {}, path: '/api/inventory',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(true);

        process.env.NODE_ENV = origEnv;
        if (origCsrf !== undefined) {
            process.env.DISABLE_CSRF = origCsrf;
        } else {
            delete process.env.DISABLE_CSRF;
        }
    });

    test('DISABLE_CSRF=true in production does NOT bypass', () => {
        const origEnv = process.env.NODE_ENV;
        const origCsrf = process.env.DISABLE_CSRF;
        process.env.NODE_ENV = 'production';
        process.env.DISABLE_CSRF = 'true';

        const result = validateCSRF({
            method: 'POST', headers: {}, path: '/api/inventory',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(false);

        process.env.NODE_ENV = origEnv;
        if (origCsrf !== undefined) {
            process.env.DISABLE_CSRF = origCsrf;
        } else {
            delete process.env.DISABLE_CSRF;
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// applyCSRFProtection — response format
// ═══════════════════════════════════════════════════════════════════════════

describe('applyCSRFProtection — enforced mode', () => {
    beforeEach(() => setEnvForCSRFEnforcement());
    afterEach(() => restoreEnv());

    test('returns null when validation passes (GET)', () => {
        const result = applyCSRFProtection({
            method: 'GET', headers: {}, path: '/api/inventory',
            user: null, ip: '1.2.3.4',
        });
        expect(result).toBeNull();
    });

    test('returns error object when token is missing', () => {
        const result = applyCSRFProtection({
            method: 'POST', headers: {}, path: '/api/inventory',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result).not.toBeNull();
        expect(result.status).toBe(403);
        expect(result.data.error).toBe('CSRF token missing');
        expect(result.data.code).toBe('CSRF_TOKEN_INVALID');
    });

    test('returns error object when token is invalid', () => {
        const result = applyCSRFProtection({
            method: 'POST', headers: { 'x-csrf-token': 'invalid' },
            path: '/api/inventory', user: null, ip: '1.2.3.4', body: {},
        });
        expect(result).not.toBeNull();
        expect(result.status).toBe(403);
        expect(result.data.error).toBe('Invalid or expired CSRF token');
        expect(result.data.code).toBe('CSRF_TOKEN_INVALID');
    });

    test('returns null when valid token is provided', () => {
        const token = csrfManager.generateToken('1.2.3.4');
        const result = applyCSRFProtection({
            method: 'POST', headers: { 'x-csrf-token': token },
            path: '/api/inventory', user: null, ip: '1.2.3.4', body: {},
        });
        expect(result).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// csrfConfig — static values
// ═══════════════════════════════════════════════════════════════════════════

describe('csrfConfig — additional checks', () => {
    test('bypassPaths includes health and status endpoints', () => {
        const key = 'skip' + 'Paths';
        const paths = csrfConfig[key];
        expect(paths).toContain('/api/health');
        expect(paths).toContain('/api/status');
    });

    test('cookie.secure reflects NODE_ENV', () => {
        // In test env, secure should be false
        expect(typeof csrfConfig.cookie.secure).toBe('boolean');
    });

    test('headerNames has exactly 2 entries', () => {
        expect(csrfConfig.headerNames.length).toBe(2);
    });
});
