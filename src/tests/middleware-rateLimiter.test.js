// Unit tests for RateLimiter class
import { describe, expect, test, beforeEach } from 'bun:test';

// Import RateLimiter by reading the module
const { RateLimiter, applyRateLimit } = await import('../backend/middleware/rateLimiter.js');
const redis = (await import('../backend/services/redis.js')).default;

describe('RateLimiter', () => {
    let limiter;

    beforeEach(() => {
        redis.flushAll();
        limiter = new RateLimiter();
    });

    describe('getKey()', () => {
        test('should generate IP-based key without userId', () => {
            const key = limiter.getKey('192.168.1.1');
            expect(key).toBe('ip:192.168.1.1');
        });

        test('should generate user-based key with userId', () => {
            const key = limiter.getKey('192.168.1.1', 'user-123');
            expect(key).toBe('user:user-123');
        });
    });

    describe('check()', () => {
        test('should allow first request', async () => {
            const result = await limiter.check('test-key', 'default');
            expect(result.allowed).toBe(true);
            expect(result.blocked).toBeFalsy();
        });

        test('should track remaining requests', async () => {
            const r1 = await limiter.check('test-key', 'default');
            expect(r1.remaining).toBeGreaterThan(0);

            const r2 = await limiter.check('test-key', 'default');
            expect(r2.remaining).toBeLessThan(r1.remaining);
        });

        test('should reject after exceeding limit', async () => {
            const key = 'flood-key';
            // Auth limit is 10 requests per 15 minutes
            for (let i = 0; i < 10; i++) {
                await limiter.check(key, 'auth');
            }
            const result = await limiter.check(key, 'auth');
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeGreaterThan(0);
        });

        test('should block after repeated violations', async () => {
            const key = 'violation-key';
            const ip = '10.0.0.1'; // non-loopback IP required for blocking
            // Exceed auth limit 3 times to trigger block
            for (let round = 0; round < 3; round++) {
                for (let i = 0; i < 12; i++) {
                    await limiter.check(key, 'auth', ip);
                }
            }
            const result = await limiter.check(key, 'auth', ip);
            expect(result.blocked).toBe(true);
        });
    });

    describe('block() / unblock()', () => {
        test('should manually block a key', async () => {
            await limiter.block('bad-key', 60000);
            const result = await limiter.check('bad-key', 'default');
            expect(result.blocked).toBe(true);
        });

        test('should manually unblock a key', async () => {
            await limiter.block('bad-key', 60000);
            await limiter.unblock('bad-key');
            const result = await limiter.check('bad-key', 'default');
            expect(result.blocked).toBeFalsy();
            expect(result.allowed).toBe(true);
        });
    });

    describe('getStats()', () => {
        test('should return stats object', async () => {
            await limiter.check('key1', 'default');
            await limiter.check('key2', 'default');
            const stats = limiter.getStats();
            expect(stats).toBeDefined();
            expect(typeof stats.totalTracked).toBe('number');
            expect(typeof stats.blocked).toBe('number');
            expect(Array.isArray(stats.topOffenders)).toBe(true);
        });
    });

    describe('cleanup()', () => {
        test('should not throw', async () => {
            await limiter.check('test', 'default');
            expect(() => limiter.cleanup()).not.toThrow();
        });
    });
});
