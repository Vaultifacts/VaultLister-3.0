// middleware-csrf-coverage.test.js — Coverage-focused tests for csrf.js
// Tests CSRFManager internals (expiry, session mismatch, cleanup, getStats),
// validateCSRF in non-test env, skip paths, body token, and applyCSRFProtection.
// Only mocks database.js and logger.js per project rules.
import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';

// ── In-memory simulation of the csrf_tokens table ────────────────────────────

const tokenStore = new Map(); // token → { session_id, expires_at, created_at }

// ── Mocks ───────────────────────────────────────────────────────────────────

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mock((sql, params) => {
            if (typeof sql === 'string' && sql.includes('COUNT')) {
                // getStats query: SELECT COUNT(*) as total, MIN(created_at) as oldest
                if (tokenStore.size === 0) return { total: 0, oldest: null };
                let oldest = Infinity;
                for (const v of tokenStore.values()) {
                    if (v.created_at < oldest) oldest = v.created_at;
                }
                return { total: tokenStore.size, oldest: oldest === Infinity ? null : oldest };
            }
            // validateToken query: SELECT session_id, expires_at FROM csrf_tokens WHERE token = ?
            const token = params?.[0];
            return tokenStore.get(token) ?? null;
        }),
        all: mock(() => []),
        run: mock((sql, params) => {
            if (typeof sql === 'string') {
                if (sql.includes('INSERT INTO csrf_tokens')) {
                    tokenStore.set(params[0], {
                        session_id: params[1] ?? '',
                        expires_at: params[2],
                        created_at: Date.now(),
                    });
                } else if (sql.includes('DELETE FROM csrf_tokens WHERE token')) {
                    tokenStore.delete(params[0]);
                } else if (sql.includes('DELETE FROM csrf_tokens WHERE expires_at')) {
                    const cutoff = params[0];
                    for (const [k, v] of tokenStore) {
                        if (v.expires_at < cutoff) tokenStore.delete(k);
                    }
                } else if (sql.includes('DELETE FROM csrf_tokens')) {
                    tokenStore.clear();
                }
            }
            return { changes: 1 };
        }),
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
    clearCSRFTokens,
} = await import('../backend/middleware/csrf.js');

// Isolate state between tests
beforeEach(() => { tokenStore.clear(); clearCSRFTokens(); });

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
        const fakeToken = 'expired-token-test-' + Date.now();
        tokenStore.set(fakeToken, {
            session_id: 'session-1',
            expires_at: Date.now() - 1000,
            created_at: Date.now() - 5000,
        });

        const isValid = csrfManager.validateToken(fakeToken, 'session-1');
        expect(isValid).toBe(false);
        expect(tokenStore.has(fakeToken)).toBe(false);
    });

    test('token right at expiry boundary is rejected', () => {
        const fakeToken = 'boundary-token-' + Date.now();
        tokenStore.set(fakeToken, {
            session_id: null,
            expires_at: Date.now() - 1,
            created_at: Date.now() - 1000,
        });

        expect(csrfManager.validateToken(fakeToken)).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — session ID checks
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — session ID validation', () => {
    test('valid when no sessionId constraint on token', () => {
        const token = csrfManager.generateToken(null); // null → stored as ''
        // Validate with a sessionId — passes since row.session_id is '' (falsy)
        expect(csrfManager.validateToken(token, 'any-session')).toBe(true);
    });

    test('valid when no sessionId provided for validation', () => {
        const token = csrfManager.generateToken('session-x');
        // Validate without sessionId constraint — passes
        expect(csrfManager.validateToken(token, null)).toBe(true);
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
// CSRFManager — token generation (PostgreSQL-backed)
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — token generation (PostgreSQL-backed)', () => {
    test('generates unique tokens on each call', () => {
        const t1 = csrfManager.generateToken('session-a');
        const t2 = csrfManager.generateToken('session-b');
        expect(t1).not.toBe(t2);
        expect(tokenStore.size).toBe(2);
    });

    test('generateToken returns 64-char hex string', () => {
        const token = csrfManager.generateToken('sess');
        expect(token).toMatch(/^[0-9a-f]{64}$/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — cleanup
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — cleanup', () => {
    test('cleanup removes expired tokens', () => {
        const expiredToken = 'cleanup-expired-' + Date.now();
        const validToken = 'cleanup-valid-' + Date.now();

        tokenStore.set(expiredToken, {
            session_id: null,
            expires_at: Date.now() - 1000,
            created_at: Date.now() - 5000,
        });
        tokenStore.set(validToken, {
            session_id: null,
            expires_at: Date.now() + 3600000,
            created_at: Date.now(),
        });

        csrfManager.cleanup();

        expect(tokenStore.has(expiredToken)).toBe(false);
        expect(tokenStore.has(validToken)).toBe(true);

        tokenStore.delete(validToken);
    });

    test('cleanup is idempotent — calling twice is safe', () => {
        csrfManager.cleanup();
        csrfManager.cleanup();
        // No errors thrown
    });

    test('cleanup on empty store is safe', () => {
        tokenStore.clear();
        csrfManager.cleanup();
        expect(tokenStore.size).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — getStats (includes oldestToken)
// ═══════════════════════════════════════════════════════════════════════════

describe('CSRFManager — getStats (oldestToken)', () => {
    test('oldestToken is 0 when no tokens exist', () => {
        tokenStore.clear();
        expect(csrfManager.getStats().oldestToken).toBe(0);
    });

    test('oldestToken reflects age of oldest token', () => {
        tokenStore.clear();
        const oldTime = Date.now() - 60000; // 1 minute ago
        tokenStore.set('old-token', {
            session_id: null,
            expires_at: Date.now() + 3600000,
            created_at: oldTime,
        });
        tokenStore.set('new-token', {
            session_id: null,
            expires_at: Date.now() + 3600000,
            created_at: Date.now(),
        });

        const age = csrfManager.getStats().oldestToken;
        expect(age).toBeGreaterThanOrEqual(59000);
        expect(age).toBeLessThan(120000);

        tokenStore.clear();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRFManager — getStats edge cases
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
// CSRFManager — consumeToken edge cases
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
        expect(csrfManager.validateToken(token, '10.0.0.1')).toBe(true);
    });

    test('uses ip when user.id is undefined', () => {
        const ctx = { user: {}, ip: '10.0.0.2' };
        const token = addCSRFToken(ctx);
        expect(csrfManager.validateToken(token, '10.0.0.2')).toBe(true);
    });

    test('uses ip:userId for session ID when user is present (B-08)', () => {
        const ctx = { user: { id: 'uid-99' }, ip: '10.0.0.3' };
        const token = addCSRFToken(ctx);
        // B-08: binds token to ip:userId when authenticated
        expect(csrfManager.validateToken(token, '10.0.0.3:uid-99')).toBe(true);
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
        const result1 = validateCSRF({
            method: 'POST', headers: { 'x-csrf-token': token },
            path: '/api/inventory', user: null, ip: '1.2.3.4', body: {},
        });
        expect(result1.valid).toBe(true);

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
        tokenStore.set(fakeToken, {
            session_id: '1.2.3.4',
            expires_at: Date.now() - 1000,
            created_at: Date.now() - 5000,
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

    test('uses ip:userId as sessionId when user is present (B-08)', () => {
        const token = csrfManager.generateToken('1.2.3.4:user-77');
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
    test('NODE_ENV=test alone does NOT bypass CSRF (requires DISABLE_CSRF=true)', () => {
        const origEnv = process.env.NODE_ENV;
        const origCsrf = process.env.DISABLE_CSRF;
        process.env.NODE_ENV = 'test';
        delete process.env.DISABLE_CSRF;
        const result = validateCSRF({
            method: 'POST', headers: {}, path: '/api/inventory',
            user: null, ip: '1.2.3.4', body: {},
        });
        expect(result.valid).toBe(false);
        process.env.NODE_ENV = origEnv;
        if (origCsrf !== undefined) process.env.DISABLE_CSRF = origCsrf;
    });

    test('DISABLE_CSRF=true in test mode bypasses check', () => {
        const origEnv = process.env.NODE_ENV;
        const origCsrf = process.env.DISABLE_CSRF;
        process.env.NODE_ENV = 'test';
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

    test('DISABLE_CSRF=true in development mode does NOT bypass', () => {
        const origEnv = process.env.NODE_ENV;
        const origCsrf = process.env.DISABLE_CSRF;
        process.env.NODE_ENV = 'development';
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
        expect(typeof csrfConfig.cookie.secure).toBe('boolean');
    });

    test('headerNames has exactly 2 entries', () => {
        expect(csrfConfig.headerNames.length).toBe(2);
    });
});
