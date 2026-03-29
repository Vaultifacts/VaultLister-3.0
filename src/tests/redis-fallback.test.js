// Redis in-memory fallback integration tests
// Tests that the service degrades gracefully when Redis is unavailable
// Uses mock.module to replace ioredis with a stub that simulates connection failure,
// forcing all operations through the in-memory fallback path.
import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock ioredis BEFORE importing redis.js so the fallback path is exercised
// The mock Redis client always rejects connection, simulating unavailability
mock.module('ioredis', () => {
    const EventEmitter = require('events');

    class MockRedis extends EventEmitter {
        constructor() {
            super();
            // Simulate failed connection by not emitting 'connect'
        }
        async connect() {
            throw new Error('ECONNREFUSED: Redis unavailable in test environment');
        }
        async get() { throw new Error('Not connected'); }
        async set() { throw new Error('Not connected'); }
        async setex() { throw new Error('Not connected'); }
        async del() { throw new Error('Not connected'); }
        async incr() { throw new Error('Not connected'); }
        async expire() { throw new Error('Not connected'); }
        async ttl() { throw new Error('Not connected'); }
        async exists() { throw new Error('Not connected'); }
        async ping() { throw new Error('Not connected'); }
        async quit() {}
    }

    return { default: MockRedis };
});

mock.module('../backend/shared/logger.js', () => ({
    logger: { info: mock(), warn: mock(), error: mock() }
}));

// Dynamic import after mocks are in place
const {
    get,
    set,
    del,
    incr,
    expire,
    ttl,
    exists,
    getJson,
    setJson,
    flushAll,
    isRedisConnected,
} = await import('../backend/services/redis.js');

describe('Redis fallback — activation', () => {
    test('should report Redis as not connected when server is unavailable', () => {
        const connected = isRedisConnected();
        // With mock that fails on connect, isConnected should be false
        expect(connected).toBe(false);
    });

    test('should return a boolean from isRedisConnected', () => {
        const result = isRedisConnected();
        expect(typeof result).toBe('boolean');
    });
});

describe('Redis fallback — set/get operations degrade gracefully', () => {
    beforeEach(() => {
        flushAll();
    });

    test('should store and retrieve a string value via in-memory fallback when Redis is down', async () => {
        await set('fallback-key-1', 'hello-fallback', 60);
        const value = await get('fallback-key-1');
        expect(value).toBe('hello-fallback');
    });

    test('should return null for missing key via in-memory fallback', async () => {
        const value = await get('fallback-missing-key-xyz');
        expect(value).toBeNull();
    });

    test('should overwrite existing value when set is called again', async () => {
        await set('fallback-overwrite', 'first', 60);
        await set('fallback-overwrite', 'second', 60);
        const value = await get('fallback-overwrite');
        expect(value).toBe('second');
    });

    test('should return true from set operation even when Redis is unavailable', async () => {
        const result = await set('fallback-return', 'value', 60);
        expect(result).toBe(true);
    });
});

describe('Redis fallback — delete operations degrade gracefully', () => {
    beforeEach(() => {
        flushAll();
    });

    test('should delete an existing key via in-memory fallback', async () => {
        await set('fallback-del-key', 'to-delete', 60);
        await del('fallback-del-key');
        const value = await get('fallback-del-key');
        expect(value).toBeNull();
    });

    test('should return true when deleting a nonexistent key', async () => {
        const result = await del('fallback-nonexistent-del');
        expect(result).toBe(true);
    });
});

describe('Redis fallback — rate limiting still works with in-memory store', () => {
    beforeEach(() => {
        flushAll();
    });

    test('should increment counter starting from 0 when Redis is unavailable', async () => {
        const result = await incr('fallback-rate-counter');
        expect(result).toBe(1);
    });

    test('should support repeated increments for rate limiting when Redis is down', async () => {
        const key = `fallback-rate-limit-${Date.now()}`;
        await incr(key);
        await incr(key);
        const count = await incr(key);
        expect(count).toBe(3);
    });

    test('should track separate counters per key for per-user rate limiting', async () => {
        const userAKey = `rate:user-a:${Date.now()}`;
        const userBKey = `rate:user-b:${Date.now()}`;
        await incr(userAKey);
        await incr(userAKey);
        await incr(userBKey);
        const countA = await get(userAKey);
        const countB = await get(userBKey);
        expect(parseInt(countA, 10)).toBe(2);
        expect(parseInt(countB, 10)).toBe(1);
    });

    test('should allow expire to set TTL on rate limit keys in memory fallback', async () => {
        const key = `fallback-rate-expire-${Date.now()}`;
        await set(key, '5', 60);
        const result = await expire(key, 120);
        expect(result).toBe(true);
        const remaining = await ttl(key);
        expect(remaining).toBeGreaterThan(0);
    });
});

describe('Redis fallback — TTL expiry behavior in memory store', () => {
    beforeEach(() => {
        flushAll();
    });

    test('should set TTL on key and report remaining seconds', async () => {
        const key = `fallback-expiry-${Date.now()}`;
        await set(key, 'expiring', 60);
        const remaining = await ttl(key);
        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(60);
    });

    test('should return negative TTL for nonexistent key', async () => {
        const remaining = await ttl('nonexistent-ttl-xyz');
        expect(remaining).toBeLessThan(0);
    });
});

describe('Redis fallback — cache operations degrade gracefully', () => {
    beforeEach(() => {
        flushAll();
    });

    test('should store and retrieve JSON objects via in-memory fallback', async () => {
        await setJson('fallback-json-1', { userId: 'u1', hits: 42 }, 60);
        const result = await getJson('fallback-json-1');
        expect(result).toEqual({ userId: 'u1', hits: 42 });
    });

    test('should return null for malformed JSON stored in fallback cache', async () => {
        await set('fallback-bad-json', 'not{valid}json', 60);
        const result = await getJson('fallback-bad-json');
        expect(result).toBeNull();
    });

    test('should return null from getJson when key is absent in fallback', async () => {
        const result = await getJson('fallback-missing-json-xyz');
        expect(result).toBeNull();
    });

    test('should check key existence via in-memory fallback when Redis is down', async () => {
        const key = `fallback-exists-${Date.now()}`;
        expect(await exists(key)).toBe(0);
        await set(key, 'present', 60);
        expect(await exists(key)).toBe(1);
    });

    test('should flush all in-memory keys', async () => {
        await set('flush-a', 'v1', 60);
        await set('flush-b', 'v2', 60);
        flushAll();
        expect(await get('flush-a')).toBeNull();
        expect(await get('flush-b')).toBeNull();
    });
});
