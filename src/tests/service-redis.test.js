// Redis Service — Unit Tests (in-memory fallback, no real Redis needed)
import { describe, expect, test, beforeEach } from 'bun:test';
import redis from '../backend/services/redis.js';

// Redis will use in-memory fallback since no Redis server is running in test

describe('Redis - Connection State', () => {
    test('isRedisConnected returns boolean', () => {
        const result = redis.isConnected();
        expect(typeof result).toBe('boolean');
    });

    test('getClient returns client or null', () => {
        const client = redis.getClient();
        expect(client === null || typeof client === 'object').toBe(true);
    });
});

describe('Redis - Set and Get (in-memory fallback)', () => {
    test('set returns true', async () => {
        const result = await redis.set('test-key-1', 'hello');
        expect(result).toBe(true);
    });

    test('get returns stored value', async () => {
        await redis.set('test-key-get', 'world');
        const result = await redis.get('test-key-get');
        expect(result).toBe('world');
    });

    test('get returns null for nonexistent key', async () => {
        const result = await redis.get('nonexistent-key-xyz');
        expect(result).toBeNull();
    });

    test('set with custom TTL', async () => {
        const result = await redis.set('test-key-ttl', 'value', 60);
        expect(result).toBe(true);
    });
});

describe('Redis - Delete', () => {
    test('del removes key', async () => {
        await redis.set('test-key-del', 'to-delete');
        await redis.del('test-key-del');
        const result = await redis.get('test-key-del');
        expect(result).toBeNull();
    });

    test('del on nonexistent key returns true', async () => {
        const result = await redis.del('nonexistent-del-key');
        expect(result).toBe(true);
    });
});

describe('Redis - Increment', () => {
    test('incr increments counter', async () => {
        await redis.set('test-counter', '0');
        const result = await redis.incr('test-counter');
        expect(result).toBe(1);
    });

    test('incr on nonexistent key starts at 1', async () => {
        await redis.del('test-new-counter');
        const result = await redis.incr('test-new-counter');
        expect(result).toBe(1);
    });

    test('incr increments multiple times', async () => {
        const key = `test-multi-incr-${Date.now()}`;
        await redis.incr(key);
        await redis.incr(key);
        const result = await redis.incr(key);
        expect(result).toBe(3);
    });
});

describe('Redis - Exists', () => {
    test('exists returns 1 for existing key', async () => {
        await redis.set('test-exists', 'yes');
        const result = await redis.exists('test-exists');
        expect(result).toBe(1);
    });

    test('exists returns 0 for nonexistent key', async () => {
        const result = await redis.exists('nonexistent-exists-key');
        expect(result).toBe(0);
    });
});

describe('Redis - TTL and Expire', () => {
    test('expire sets TTL on key', async () => {
        await redis.set('test-expire', 'value');
        const result = await redis.expire('test-expire', 300);
        expect(result).toBe(true);
    });

    test('ttl returns remaining seconds', async () => {
        await redis.set('test-ttl-check', 'value', 600);
        const remaining = await redis.ttl('test-ttl-check');
        expect(typeof remaining).toBe('number');
    });

    test('ttl returns -1 or -2 for nonexistent key', async () => {
        const remaining = await redis.ttl('nonexistent-ttl-key');
        expect(remaining).toBeLessThan(0);
    });
});
