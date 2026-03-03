// Redis Service
// Provides Redis connection management with graceful fallback to in-memory

import Redis from 'ioredis';
import { logger } from '../shared/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

let redisClient = null;
let isConnected = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// In-memory fallback for when Redis is unavailable
const memoryStore = new Map();
const memoryExpiry = new Map();

/**
 * Initialize Redis connection
 */
export function initRedis() {
    if (!REDIS_ENABLED) {
        logger.info('[Redis] Disabled via REDIS_ENABLED=false, using in-memory fallback');
        return null;
    }

    try {
        redisClient = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            enableReadyCheck: true,
            lazyConnect: true,
            connectTimeout: 5000,
            commandTimeout: 3000,
        });

        redisClient.on('connect', () => {
            isConnected = true;
            connectionAttempts = 0;
            logger.info('[Redis] Connected successfully');
        });

        redisClient.on('error', (err) => {
            logger.error('[Redis] Connection error:', err.message);
            isConnected = false;
        });

        redisClient.on('close', () => {
            isConnected = false;
            logger.info('[Redis] Connection closed');
        });

        redisClient.on('reconnecting', () => {
            connectionAttempts++;
            if (connectionAttempts > MAX_RECONNECT_ATTEMPTS) {
                logger.warn('[Redis] Max reconnection attempts reached, using in-memory fallback');
            }
        });

        // Attempt connection
        redisClient.connect().catch((err) => {
            logger.warn('[Redis] Failed to connect, using in-memory fallback', { detail: err.message });
            isConnected = false;
        });

        return redisClient;
    } catch (error) {
        logger.warn('[Redis] Initialization failed, using in-memory fallback', { detail: error.message });
        return null;
    }
}

/**
 * Check if Redis is available
 */
export function isRedisConnected() {
    return isConnected && redisClient !== null;
}

/**
 * Get value from Redis or memory fallback
 */
export async function get(key) {
    // Clean expired memory entries
    cleanExpiredMemory();

    if (isRedisConnected()) {
        try {
            return await redisClient.get(key);
        } catch (error) {
            logger.error('[Redis] GET error:', error.message);
        }
    }

    // Fallback to memory
    return memoryStore.get(key) || null;
}

/**
 * Set value in Redis or memory fallback
 * @param {string} key
 * @param {string} value
 * @param {number} ttlSeconds - Time to live in seconds
 */
export async function set(key, value, ttlSeconds = 3600) {
    if (isRedisConnected()) {
        try {
            if (ttlSeconds) {
                await redisClient.setex(key, ttlSeconds, value);
            } else {
                await redisClient.set(key, value);
            }
            return true;
        } catch (error) {
            logger.error('[Redis] SET error:', error.message);
        }
    }

    // Fallback to memory
    memoryStore.set(key, value);
    if (ttlSeconds) {
        memoryExpiry.set(key, Date.now() + ttlSeconds * 1000);
    }
    return true;
}

/**
 * Delete value from Redis or memory fallback
 */
export async function del(key) {
    if (isRedisConnected()) {
        try {
            await redisClient.del(key);
            return true;
        } catch (error) {
            logger.error('[Redis] DEL error:', error.message);
        }
    }

    // Fallback to memory
    memoryStore.delete(key);
    memoryExpiry.delete(key);
    return true;
}

/**
 * Increment value in Redis or memory fallback
 */
export async function incr(key) {
    if (isRedisConnected()) {
        try {
            return await redisClient.incr(key);
        } catch (error) {
            logger.error('[Redis] INCR error:', error.message);
        }
    }

    // Fallback to memory
    const current = parseInt(memoryStore.get(key) || '0', 10);
    const newValue = current + 1;
    memoryStore.set(key, String(newValue));
    return newValue;
}

/**
 * Set expiry on a key
 */
export async function expire(key, ttlSeconds) {
    if (isRedisConnected()) {
        try {
            await redisClient.expire(key, ttlSeconds);
            return true;
        } catch (error) {
            logger.error('[Redis] EXPIRE error:', error.message);
        }
    }

    // Fallback to memory
    memoryExpiry.set(key, Date.now() + ttlSeconds * 1000);
    return true;
}

/**
 * Get TTL of a key
 */
export async function ttl(key) {
    if (isRedisConnected()) {
        try {
            return await redisClient.ttl(key);
        } catch (error) {
            logger.error('[Redis] TTL error:', error.message);
        }
    }

    // Fallback to memory
    const expiryTime = memoryExpiry.get(key);
    if (!expiryTime) return -1;
    const remaining = Math.ceil((expiryTime - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
}

/**
 * Check if key exists
 */
export async function exists(key) {
    if (isRedisConnected()) {
        try {
            return await redisClient.exists(key);
        } catch (error) {
            logger.error('[Redis] EXISTS error:', error.message);
        }
    }

    // Fallback to memory
    cleanExpiredMemory();
    return memoryStore.has(key) ? 1 : 0;
}

/**
 * Clean expired entries from memory store
 */
function cleanExpiredMemory() {
    const now = Date.now();
    for (const [key, expiry] of memoryExpiry.entries()) {
        if (expiry < now) {
            memoryStore.delete(key);
            memoryExpiry.delete(key);
        }
    }
}

/**
 * Get Redis client for advanced operations
 */
export function getClient() {
    return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        isConnected = false;
        logger.info('[Redis] Connection closed');
    }
}

// Export singleton pattern
export default {
    init: initRedis,
    get,
    set,
    del,
    incr,
    expire,
    ttl,
    exists,
    isConnected: isRedisConnected,
    getClient,
    close: closeRedis
};
