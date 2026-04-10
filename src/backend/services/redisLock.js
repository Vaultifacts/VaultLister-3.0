import crypto from 'crypto';
import { getClient } from './redis.js';
import { logger } from '../shared/logger.js';

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

function shouldRunWithoutRedis() {
    return process.env.NODE_ENV !== 'production';
}

function unlockedResult() {
    return {
        acquired: true,
        release: async () => {}
    };
}

function skippedResult() {
    return {
        acquired: false,
        release: async () => {}
    };
}

export async function acquireRedisLock(key, ttlMs, options = {}) {
    const name = options.name || key;
    const runWithoutRedis = options.runWithoutRedis ?? shouldRunWithoutRedis();
    const client = getClient();

    if (!client) {
        if (runWithoutRedis) {
            logger.warn(`[RedisLock] Redis unavailable for ${name}; running without distributed lock`);
            return unlockedResult();
        }

        logger.warn(`[RedisLock] Redis unavailable for ${name}; skipping singleton cycle`);
        return skippedResult();
    }

    const token = crypto.randomUUID();

    try {
        const result = await client.set(key, token, 'PX', ttlMs, 'NX');
        if (result !== 'OK') {
            logger.info(`[RedisLock] ${name} already running on another replica; skipping`);
            return skippedResult();
        }
    } catch (error) {
        if (runWithoutRedis) {
            logger.warn(`[RedisLock] Failed to acquire ${name}; running without distributed lock`, { detail: error.message });
            return unlockedResult();
        }

        logger.warn(`[RedisLock] Failed to acquire ${name}; skipping singleton cycle`, { detail: error.message });
        return skippedResult();
    }

    return {
        acquired: true,
        release: async () => {
            try {
                await client.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
            } catch (error) {
                logger.warn(`[RedisLock] Failed to release ${name}`, { detail: error.message });
            }
        }
    };
}

export async function withRedisLock(key, ttlMs, fn, options = {}) {
    const lock = await acquireRedisLock(key, ttlMs, options);
    if (!lock.acquired) {
        return undefined;
    }

    try {
        return await fn();
    } finally {
        await lock.release();
    }
}
