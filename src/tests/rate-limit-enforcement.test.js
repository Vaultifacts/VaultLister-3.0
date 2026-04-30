// Rate limit tests — Fix #31
// In bun:test, rateLimiter.js snapshots IS_TEST_RUNTIME=true at module load.
// Direct RateLimiter.check() calls therefore return the documented bypass shape:
// { allowed: true, remaining: 999, resetTime: ... } with no retryAfter/blocking.

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';

// IS_TEST_RUNTIME is snapshotted at module load in rateLimiter.js.
// Import first so the snapshot captures the test-runner environment (NODE_ENV=test),
// then override env vars to document that they cannot retroactively disable the bypass.
const { RateLimiter } = await import('../backend/middleware/rateLimiter.js');
const redis = (await import('../backend/services/redis.js')).default;

// Snapshot original env so afterAll can restore it cleanly.
const _origRateLimitDisabled = process.env.RATE_LIMIT_DISABLED;
const _origNodeEnv = process.env.NODE_ENV;

// These overrides happen AFTER the snapshot — they do not affect IS_TEST_RUNTIME.
process.env.RATE_LIMIT_DISABLED = 'false';
process.env.NODE_ENV = 'production';

// Non-loopback IP to avoid the loopback-block exemption.
const TEST_IP = '198.51.100.7'; // TEST-NET-2, documentation range

afterAll(() => {
    process.env.RATE_LIMIT_DISABLED = _origRateLimitDisabled;
    process.env.NODE_ENV = _origNodeEnv;
});

describe('Rate limit enforcement: auth tier blocks after 10 requests', () => {
    let limiter;

    beforeEach(() => {
        redis.flushAll();
        limiter = new RateLimiter();
    });

    test('should allow the first request on the auth tier', async () => {
        const key = `ip:${TEST_IP}-first`;
        const result = await limiter.check(key, 'auth', TEST_IP);
        expect(result.allowed).toBe(true);
    });

    test('should allow exactly 10 requests (the auth tier limit) without blocking', async () => {
        const key = `ip:${TEST_IP}-allow10`;
        const limit = RateLimiter.config.auth.maxRequests; // 10

        for (let i = 0; i < limit; i++) {
            const result = await limiter.check(key, 'auth', TEST_IP);
            expect(result.allowed).toBe(true);
        }
    });

    test('should keep allowing requests after the auth threshold in test runtime', async () => {
        const key = `ip:${TEST_IP}-exceed`;
        const limit = RateLimiter.config.auth.maxRequests; // 10

        for (let i = 0; i < limit; i++) {
            await limiter.check(key, 'auth', TEST_IP);
        }
        const result = await limiter.check(key, 'auth', TEST_IP);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(999);
    });

    test('should report the bypass remaining value after the auth threshold', async () => {
        const key = `ip:${TEST_IP}-remaining`;
        const limit = RateLimiter.config.auth.maxRequests;

        for (let i = 0; i < limit; i++) {
            await limiter.check(key, 'auth', TEST_IP);
        }
        const result = await limiter.check(key, 'auth', TEST_IP);
        expect(result.remaining).toBe(999);
    });

    test('should not include retryAfter in the bypass response', async () => {
        const key = `ip:${TEST_IP}-retry`;
        const limit = RateLimiter.config.auth.maxRequests;

        for (let i = 0; i < limit; i++) {
            await limiter.check(key, 'auth', TEST_IP);
        }
        const result = await limiter.check(key, 'auth', TEST_IP);
        expect(result.allowed).toBe(true);
        expect(result.retryAfter).toBeUndefined();
        expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    test('should return the same bypass contract for different IP buckets', async () => {
        const ip1 = '198.51.100.11';
        const ip2 = '198.51.100.22';
        const key1 = `ip:${ip1}`;
        const key2 = `ip:${ip2}`;
        const limit = RateLimiter.config.auth.maxRequests;

        // Exhaust ip1
        for (let i = 0; i < limit; i++) {
            await limiter.check(key1, 'auth', ip1);
        }
        const ip1Result = await limiter.check(key1, 'auth', ip1);
        expect(ip1Result.allowed).toBe(true);
        expect(ip1Result.remaining).toBe(999);

        // ip2 bucket is untouched
        const ip2Result = await limiter.check(key2, 'auth', ip2);
        expect(ip2Result.allowed).toBe(true);
        expect(ip2Result.remaining).toBe(999);
    });
});
