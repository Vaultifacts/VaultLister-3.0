// Rate Limiting Middleware
// Prevents API abuse by limiting requests per IP address

import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import redis from '../services/redis.js';

// Snapshot at module load so test runs stay hermetic even if individual tests mutate NODE_ENV.
// Include common test-runner signals to keep this stable when NODE_ENV is overridden in specific tests.
const IS_TEST_RUNTIME = (() => {
    if (process.env.NODE_ENV === 'test') {
        return true;
    }
    if (process.env.BUN_TEST === '1') {
        return true;
    }
    if (process.env.JEST_WORKER_ID) {
        return true;
    }
    if (process.env.VITEST === 'true') {
        return true;
    }
    return false;
})();

function isRateLimitBypassed() {
    return (process.env.DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production') || process.env.NODE_ENV === 'test' || IS_TEST_RUNTIME;
}

// Loopback IPs should never receive a permanent IP ban — they are always local
// dev traffic or health checks, never real abuse.
function isLoopbackIp(ip) {
    if (!ip) return true;
    return ip === '127.0.0.1' ||
        ip === '::1' ||
        ip === 'localhost' ||
        ip === 'unknown' ||
        ip.startsWith('::ffff:127.') || // IPv4-mapped loopback (Windows)
        ip.startsWith('127.');           // entire 127.x.x.x loopback range
}

/**
 * In-memory rate limiter using Map
 * Key: IP address or user ID
 * Value: { count, resetTime, blocked }
 */
class RateLimiter {
    constructor() {
        // Rate limit data stored in Redis (or in-memory fallback via redis.js)
    }

    /**
     * Rate limit configuration
     */
    static config = {
        // General API endpoints
        default: {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 100,
            message: 'Too many requests, please try again later'
        },
        // Authentication endpoints (stricter)
        auth: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 10,
            message: 'Too many login attempts, please try again in 15 minutes'
        },
        // Mutation endpoints (POST, PUT, DELETE)
        mutation: {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 30,
            message: 'Too many write requests, please slow down'
        },
        // Expensive operations (AI, analytics)
        expensive: {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 10,
            message: 'Rate limit exceeded for this operation'
        },
        // Chrome extension API requests
        api: {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 60,
            message: 'Too many extension requests, please slow down'
        },
        // Block period for repeated violations
        blockDuration: 60 * 60 * 1000 // 1 hour
    };

    // Entries live for the full block duration so violations accumulate across windows
    static ENTRY_TTL = Math.ceil(RateLimiter.config.blockDuration / 1000); // 3600s

    /**
     * Get rate limit key from request
     * Authenticated: keyed on user ID only (IP-independent) — prevents shared IPs
     * (offices, mobile NAT) from causing cross-user throttling.
     * Unauthenticated: keyed on IP address.
     */
    getKey(ip, userId = null) {
        return userId ? `user:${userId}` : `ip:${ip}`;
    }

    /**
     * Check if request is allowed
     * @returns { allowed: boolean, retryAfter: number }
     */
    async check(key, limitType = 'default', ip = '') {
        const now = Date.now();
        const config = RateLimiter.config[limitType];

        // Check if blocked
        const blockedUntilStr = await redis.get('rl:block:' + key);
        if (blockedUntilStr) {
            const blockedUntil = Number(blockedUntilStr);
            if (now < blockedUntil) {
                const retryAfter = Math.ceil((blockedUntil - now) / 1000);
                return { allowed: false, retryAfter, blocked: true };
            } else {
                await redis.del('rl:block:' + key);
            }
        }

        // Get or create rate limit entry
        let entry = await redis.getJson('rl:' + key);

        if (!entry || now > entry.resetTime) {
            // New window — preserve violations from previous entry
            entry = {
                count: 0,
                resetTime: now + config.windowMs,
                violations: entry?.violations || 0
            };
            await redis.setJson('rl:' + key, entry, RateLimiter.ENTRY_TTL);
        }

        // Increment request count
        entry.count++;

        // Check if limit exceeded
        if (entry.count > config.maxRequests) {
            entry.violations++;

            // Block after repeated violations (3 strikes) — never ban loopback IPs
            if (entry.violations >= 3 && !isLoopbackIp(ip)) {
                const blockedUntil = now + RateLimiter.config.blockDuration;
                await redis.set('rl:block:' + key, String(blockedUntil), Math.ceil(RateLimiter.config.blockDuration / 1000));

                // Log security event
                await this.logSecurityEvent('RATE_LIMIT_BLOCK', key, {
                    violations: entry.violations,
                    blockedUntil
                });
            }

            // Write-back: persist mutated entry (count + violations) to Redis
            await redis.setJson('rl:' + key, entry, RateLimiter.ENTRY_TTL);

            const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
            return {
                allowed: false,
                retryAfter,
                blocked: false,
                remaining: 0
            };
        }

        // Write-back: persist mutated entry (count) to Redis
        await redis.setJson('rl:' + key, entry, RateLimiter.ENTRY_TTL);

        return {
            allowed: true,
            remaining: config.maxRequests - entry.count,
            resetTime: entry.resetTime
        };
    }

    /**
     * Clean up expired entries — no-op: Redis handles key expiration
     */
    cleanup() {}

    /**
     * Log security events to database
     */
    async logSecurityEvent(eventType, key, details) {
        try {
            await query.run(`
                INSERT INTO security_logs (event_type, ip_or_user, details, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `, [eventType, key, JSON.stringify(details)]);
        } catch (error) {
            logger.error('[RateLimiter] Failed to log security event', error);
        }
    }

    /**
     * Stop the cleanup interval — no-op: no local interval when using Redis
     */
    stop() {}

    /**
     * Manually block an IP or user
     */
    async block(key, durationMs = RateLimiter.config.blockDuration) {
        const blockedUntil = Date.now() + durationMs;
        await redis.set('rl:block:' + key, String(blockedUntil), Math.ceil(durationMs / 1000));
        await this.logSecurityEvent('MANUAL_BLOCK', key, { blockedUntil });
    }

    /**
     * Manually unblock an IP or user
     */
    async unblock(key) {
        await redis.del('rl:block:' + key);
        await this.logSecurityEvent('MANUAL_UNBLOCK', key, {});
    }

    /**
     * Get statistics — stats now managed by Redis; return empty structure for compat
     */
    getStats() {
        return { totalTracked: 0, blocked: 0, topOffenders: [] };
    }

    /**
     * Get IPs/users with most requests
     */
    getTopOffenders(limit = 10) {
        return [];
    }
}

// Log a warning at startup if Redis is unavailable and rate limiter will use in-memory fallback.
// In-memory fallback does not share state across multiple server instances (e.g. horizontal scaling).
if (!redis.isConnected()) {
    logger.warn('[RateLimiter] Redis is unavailable — rate limiter is using in-memory fallback. ' +
        'Rate limits will NOT be shared across server instances. Ensure Redis is configured for production.');
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Rate limiting middleware factory
 * @param {string} limitType - Type of rate limit (default, auth, mutation, expensive)
 */
export function createRateLimiter(limitType = 'default') {
    return async function rateLimitMiddleware(ctx) {
        const { ip, user, method, path } = ctx;

        // Disable rate limiting in test/dev environment only (never in production)
        if (isRateLimitBypassed()) {
            return { allowed: true };
        }

        // Skip rate limiting for certain paths
        const skipPaths = ['/api/health', '/api/health/live', '/api/health/ready', '/api/status'];
        if (skipPaths.includes(path)) {
            return { allowed: true };
        }

        // Determine limit type if not specified
        let actualLimitType = limitType;

        if (limitType === 'auto') {
            if (path.startsWith('/api/auth') || path.startsWith('/api/oauth')) {
                actualLimitType = 'auth';
            } else if (path.startsWith('/api/ai') || path.startsWith('/api/reports') || path.startsWith('/api/analytics')) {
                actualLimitType = 'expensive';
            } else if (method !== 'GET') {
                actualLimitType = 'mutation';
            } else {
                actualLimitType = 'default';
            }
        }

        // Get rate limit key
        const key = rateLimiter.getKey(ip, user?.id);

        // Check rate limit
        const result = await rateLimiter.check(key, actualLimitType, ip);

        // Add rate limit headers to response (X-RateLimit-Reset uses Unix seconds per RFC 6585)
        ctx.rateLimitHeaders = {
            'X-RateLimit-Limit': RateLimiter.config[actualLimitType].maxRequests,
            'X-RateLimit-Remaining': result.remaining || 0,
            'X-RateLimit-Reset': Math.ceil((result.resetTime || Date.now()) / 1000)
        };

        if (!result.allowed) {
            ctx.rateLimitHeaders['Retry-After'] = result.retryAfter;

            // Log rate limit violation
            await rateLimiter.logSecurityEvent('RATE_LIMIT_EXCEEDED', key, {
                path,
                method,
                limitType: actualLimitType,
                blocked: result.blocked
            });
        }

        return result;
    };
}

/**
 * Apply rate limiting to a request
 */
export async function applyRateLimit(ctx, limitType = 'auto') {
    // Bypass rate limiting in test/dev environments (never in production)
    if (isRateLimitBypassed()) {
        return null; // No rate limit
    }

    const limiter = createRateLimiter(limitType);
    const result = await limiter(ctx);

    if (!result.allowed) {
        const message = result.blocked
            ? 'Your IP has been temporarily blocked due to repeated violations'
            : RateLimiter.config[limitType]?.message || 'Rate limit exceeded';

        return {
            status: 429,
            data: {
                error: message,
                retryAfter: result.retryAfter
            },
            headers: ctx.rateLimitHeaders
        };
    }

    return null; // No rate limit error
}

/**
 * Stop the rate limiter cleanup interval — call during graceful shutdown
 */
export function stopRateLimiter() {
    rateLimiter.stop();
}

// Export rate limiter instance for admin operations
export { rateLimiter, RateLimiter };
