// Architecture & Reliability — Caching / CDN / Proxy Behavior
// Category: #5 Caching, CDN, edge, proxy behavior
// Audit gaps: M4 (rate limiter bypassed in test), M7 (ETag untested)

import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

// ─── Mocks for RateLimiter (before imports) ─────────────────────────────────

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mock(() => null), all: mock(() => []),
        run: mock(() => ({ changes: 1 })),
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
mock.module('../backend/shared/logger.js', () => ({
    logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
    default: { info: mock(), error: mock(), warn: mock(), debug: mock() },
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

const { generateETag, etagMatches, cacheFor, cacheForUser, immutable, NO_CACHE } =
    await import('../backend/middleware/cache.js');

const { RateLimiter } = await import('../backend/middleware/rateLimiter.js');
const redis = (await import('../backend/services/redis.js')).default;

// ═══════════════════════════════════════════════════════════════════════════
// ETAG GENERATION (Medium #7)
// ═══════════════════════════════════════════════════════════════════════════

describe('ETag generation', () => {
    test('should generate a quoted SHA-256 hash of 32 hex chars', () => {
        const etag = generateETag('test body content');
        expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
    });

    test('should generate deterministic ETags for same input', () => {
        const a = generateETag('identical body');
        const b = generateETag('identical body');
        expect(a).toBe(b);
    });

    test('should generate different ETags for different bodies', () => {
        const a = generateETag('body A');
        const b = generateETag('body B');
        expect(a).not.toBe(b);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// ETAG MATCHING
// ═══════════════════════════════════════════════════════════════════════════

describe('ETag matching', () => {
    const etag = generateETag('test body');

    test('should return true when if-none-match matches', () => {
        const request = new Request('http://localhost/api/test', {
            headers: { 'if-none-match': etag }
        });
        expect(etagMatches(request, etag)).toBe(true);
    });

    test('should return false when no if-none-match header', () => {
        const request = new Request('http://localhost/api/test');
        expect(etagMatches(request, etag)).toBe(false);
    });

    test('should support comma-separated ETags', () => {
        const request = new Request('http://localhost/api/test', {
            headers: { 'if-none-match': `"aaa", ${etag}, "bbb"` }
        });
        expect(etagMatches(request, etag)).toBe(true);
    });

    test('should support wildcard *', () => {
        const request = new Request('http://localhost/api/test', {
            headers: { 'if-none-match': '*' }
        });
        expect(etagMatches(request, etag)).toBe(true);
    });

    test('should return false when no ETags match', () => {
        const request = new Request('http://localhost/api/test', {
            headers: { 'if-none-match': '"aaa", "bbb", "ccc"' }
        });
        expect(etagMatches(request, etag)).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// CACHE-CONTROL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

describe('Cache-Control helpers', () => {
    test('cacheFor should return public with correct max-age and stale-while-revalidate', () => {
        const result = cacheFor(60);
        expect(result).toBe('public, max-age=60, stale-while-revalidate=120');
    });

    test('cacheFor should cap stale-while-revalidate at 86400', () => {
        const result = cacheFor(50000);
        expect(result).toContain('max-age=50000');
        expect(result).toContain('stale-while-revalidate=86400');
    });

    test('cacheForUser should return private max-age', () => {
        expect(cacheForUser(300)).toBe('private, max-age=300');
    });

    test('immutable should return public max-age with immutable directive', () => {
        const result = immutable();
        expect(result).toContain('public');
        expect(result).toContain('immutable');
        expect(result).toContain('max-age=31536000');
    });

    test('NO_CACHE should be exact no-store directive', () => {
        expect(NO_CACHE).toBe('no-store, no-cache, must-revalidate');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITER — ACTUAL BEHAVIOR (Medium #4)
// Uses direct class instantiation to bypass test-mode skip
// ═══════════════════════════════════════════════════════════════════════════

describe('Rate limiter — actual behavior (bypassing test-mode skip)', () => {
    let limiter;

    beforeEach(() => {
        redis.flushAll();
        limiter = new RateLimiter();
    });

    afterAll(() => {});

    test('should allow requests under the default limit (100/min)', async () => {
        for (let i = 0; i < 100; i++) {
            const result = await limiter.check('test-key', 'default');
            expect(result.allowed).toBe(true);
        }
    });

    test('should reject request #101 over the default limit', async () => {
        for (let i = 0; i < 100; i++) {
            await limiter.check('test-key-101', 'default');
        }
        const result = await limiter.check('test-key-101', 'default');
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    test('should enforce auth limit (10 per 15min)', async () => {
        for (let i = 0; i < 10; i++) {
            const r = await limiter.check('auth-key', 'auth');
            expect(r.allowed).toBe(true);
        }
        const rejected = await limiter.check('auth-key', 'auth');
        expect(rejected.allowed).toBe(false);
    });

    test('should block after 3 violations but never block loopback IPs', async () => {
        const key = 'ip:192.168.1.100';
        for (let v = 0; v < 3; v++) {
            for (let i = 0; i <= 100; i++) {
                await limiter.check(key, 'default', '192.168.1.100');
            }
            const entry = await redis.getJson('rl:' + key);
            if (entry) {
                entry.resetTime = 0;
                await redis.setJson('rl:' + key, entry, 3600);
            }
        }

        const blocked = await limiter.check(key, 'default', '192.168.1.100');
        expect(blocked.blocked).toBe(true);

        // Loopback should never be permanently blocked
        const loopKey = 'ip:127.0.0.1';
        for (let v = 0; v < 3; v++) {
            for (let i = 0; i <= 100; i++) {
                await limiter.check(loopKey, 'default', '127.0.0.1');
            }
            const entry = await redis.getJson('rl:' + loopKey);
            if (entry) {
                entry.resetTime = 0;
                await redis.setJson('rl:' + loopKey, entry, 3600);
            }
        }

        const loopResult = await limiter.check(loopKey, 'default', '127.0.0.1');
        expect(loopResult.blocked).toBeFalsy();
    });
});
