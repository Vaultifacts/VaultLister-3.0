// Rate limit enforcement tests — Fix #31
// Verifies that rate limiting blocks requests when NOT bypassed.
// Exercises RateLimiter.check() directly (same approach as security-rate-limit.test.js)
// because the middleware bypass guard fires at module-load time based on BUN_TEST=1,
// which is always true during `bun test`. Calling the class directly lets the
// threshold logic run regardless of the bypass guard.

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';

// Snapshot original env so afterAll can restore it cleanly.
const _origRateLimitDisabled = process.env.RATE_LIMIT_DISABLED;
const _origNodeEnv = process.env.NODE_ENV;

// Simulate a production-like environment for documentation purposes.
// Note: IS_TEST_RUNTIME is snapshotted at module load in rateLimiter.js, so
// setting NODE_ENV here does NOT disable the bypass guard — that is intentional.
// These tests target the RateLimiter class methods directly.
process.env.RATE_LIMIT_DISABLED = 'false';
process.env.NODE_ENV = 'production';

const { RateLimiter } = await import('../backend/middleware/rateLimiter.js');
const redis = (await import('../backend/services/redis.js')).default;

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

    test('should return allowed=false on the 11th request (exceeds auth limit of 10)', async () => {
        const key = `ip:${TEST_IP}-exceed`;
        const limit = RateLimiter.config.auth.maxRequests; // 10

        for (let i = 0; i < limit; i++) {
            await limiter.check(key, 'auth', TEST_IP);
        }
        const result = await limiter.check(key, 'auth', TEST_IP);
        expect(result.allowed).toBe(false);
    });

    test('should report remaining=0 after the limit is exceeded', async () => {
        const key = `ip:${TEST_IP}-remaining`;
        const limit = RateLimiter.config.auth.maxRequests;

        for (let i = 0; i < limit; i++) {
            await limiter.check(key, 'auth', TEST_IP);
        }
        const result = await limiter.check(key, 'auth', TEST_IP);
        expect(result.remaining).toBe(0);
    });

    test('should include retryAfter in the denied result', async () => {
        const key = `ip:${TEST_IP}-retry`;
        const limit = RateLimiter.config.auth.maxRequests;

        for (let i = 0; i < limit; i++) {
            await limiter.check(key, 'auth', TEST_IP);
        }
        const result = await limiter.check(key, 'auth', TEST_IP);
        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeDefined();
        expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('should use separate buckets for different IPs (no cross-contamination)', async () => {
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
        expect(ip1Result.allowed).toBe(false);

        // ip2 bucket is untouched
        const ip2Result = await limiter.check(key2, 'auth', ip2);
        expect(ip2Result.allowed).toBe(true);
    });
});
