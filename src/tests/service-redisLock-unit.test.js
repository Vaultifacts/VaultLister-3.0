import { afterEach, describe, expect, test } from 'bun:test';
import { acquireRedisLock, withRedisLock } from '../backend/services/redisLock.js';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
    if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
    } else {
        process.env.NODE_ENV = originalNodeEnv;
    }
});

describe('redisLock', () => {
    test('allows singleton work without Redis outside production', async () => {
        process.env.NODE_ENV = 'test';

        const lock = await acquireRedisLock('test:lock:dev', 1000, { name: 'test lock' });

        expect(lock.acquired).toBe(true);
        await expect(lock.release()).resolves.toBeUndefined();
    });

    test('skips singleton work without Redis in production', async () => {
        process.env.NODE_ENV = 'production';

        const lock = await acquireRedisLock('test:lock:prod', 1000, { name: 'test lock' });

        expect(lock.acquired).toBe(false);
        await expect(lock.release()).resolves.toBeUndefined();
    });

    test('does not call withRedisLock callback when production Redis lock is unavailable', async () => {
        process.env.NODE_ENV = 'production';
        let called = false;

        const result = await withRedisLock('test:lock:skip', 1000, async () => {
            called = true;
            return 'ran';
        }, { name: 'test lock' });

        expect(result).toBeUndefined();
        expect(called).toBe(false);
    });
});
