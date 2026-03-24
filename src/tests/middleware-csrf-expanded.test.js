// CSRF Middleware — Pure Function & Lifecycle Unit Tests
import { describe, expect, test, mock, beforeEach } from 'bun:test';

// In-memory simulation of the csrf_tokens SQLite table
const tokenStore = new Map();

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mock((sql, params) => {
            if (typeof sql === 'string' && sql.includes('COUNT')) {
                if (tokenStore.size === 0) return { total: 0, oldest: null };
                let oldest = Infinity;
                for (const v of tokenStore.values()) {
                    if (v.created_at < oldest) oldest = v.created_at;
                }
                return { total: tokenStore.size, oldest: oldest === Infinity ? null : oldest };
            }
            return tokenStore.get(params?.[0]) ?? null;
        }),
        all: mock(() => []),
        run: mock((sql, params) => {
            if (typeof sql === 'string') {
                if (sql.includes('INSERT INTO csrf_tokens')) {
                    tokenStore.set(params[0], { session_id: params[1] ?? '', expires_at: params[2], created_at: Date.now() });
                } else if (sql.includes('DELETE FROM csrf_tokens WHERE token')) {
                    tokenStore.delete(params[0]);
                } else if (sql.includes('DELETE FROM csrf_tokens WHERE expires_at')) {
                    const cutoff = params[0];
                    for (const [k, v] of tokenStore) { if (v.expires_at < cutoff) tokenStore.delete(k); }
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
    models: { create: mock(), findById: mock(), findOne: mock(), findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0) },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {},
}));

mock.module('../backend/shared/logger.js', () => {
    const l = { info: mock(), warn: mock(), error: mock(), debug: mock(), request: mock(), db: mock(), automation: mock(), bot: mock(), security: mock(), performance: mock() };
    return { ...l, logger: l, createLogger: mock(() => l), default: l };
});

const { csrfConfig, csrfManager, addCSRFToken, validateCSRF, applyCSRFProtection, clearCSRFTokens } = await import('../backend/middleware/csrf.js');

// Isolate the csrfManager singleton between tests so token state never bleeds
beforeEach(() => { tokenStore.clear(); clearCSRFTokens(); });

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

    test('has exempt paths array', () => {
        const exempt = csrfConfig.skipPaths;
        expect(Array.isArray(exempt)).toBe(true);
        expect(exempt).toContain('/api/auth/login');
        expect(exempt).toContain('/api/auth/register');
        expect(exempt).toContain('/api/health');
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

    test('uses ip:userId for session ID when user is present (B-08)', () => {
        const ctx = { user: { id: 'user-123' }, ip: '127.0.0.1' };
        const token = addCSRFToken(ctx);
        // B-08: binds token to ip:userId when authenticated
        expect(csrfManager.validateToken(token, '127.0.0.1:user-123')).toBe(true);
    });
});

describe('validateCSRF', () => {
    // NODE_ENV=test no longer auto-bypasses CSRF — requires DISABLE_CSRF=true
    test('POST without token returns valid:false (no auto-bypass)', () => {
        const origCsrf = process.env.DISABLE_CSRF;
        delete process.env.DISABLE_CSRF;
        const result = validateCSRF({ method: 'POST', headers: {}, path: '/api/test' });
        expect(result.valid).toBe(false);
        if (origCsrf !== undefined) process.env.DISABLE_CSRF = origCsrf;
    });

    test('returns valid:true for GET requests', () => {
        const result = validateCSRF({ method: 'GET', headers: {}, path: '/api/test' });
        expect(result.valid).toBe(true);
    });
});

describe('applyCSRFProtection', () => {
    test('returns error for POST without CSRF token', () => {
        const origCsrf = process.env.DISABLE_CSRF;
        delete process.env.DISABLE_CSRF;
        const result = applyCSRFProtection({ method: 'POST', headers: {}, path: '/api/test' });
        expect(result).not.toBeNull();
        if (origCsrf !== undefined) process.env.DISABLE_CSRF = origCsrf;
    });
});
