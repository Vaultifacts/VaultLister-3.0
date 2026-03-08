// Rate Limiting Middleware
// Prevents API abuse by limiting requests per IP address

import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

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

/**
 * In-memory rate limiter using Map
 * Key: IP address or user ID
 * Value: { count, resetTime, blocked }
 */
class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.blocklist = new Map();

        // Clean up old entries every 5 minutes
        this._cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
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
        // Block period for repeated violations
        blockDuration: 60 * 60 * 1000 // 1 hour
    };

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
    check(key, limitType = 'default') {
        const now = Date.now();
        const config = RateLimiter.config[limitType];

        // Check if blocked
        if (this.blocklist.has(key)) {
            const blockedUntil = this.blocklist.get(key);
            if (now < blockedUntil) {
                const retryAfter = Math.ceil((blockedUntil - now) / 1000);
                return { allowed: false, retryAfter, blocked: true };
            } else {
                // Block expired
                this.blocklist.delete(key);
            }
        }

        // Get or create rate limit entry
        let entry = this.requests.get(key);

        if (!entry || now > entry.resetTime) {
            // New window
            entry = {
                count: 0,
                resetTime: now + config.windowMs,
                violations: entry?.violations || 0
            };
            this.requests.set(key, entry);
        }

        // Increment request count
        entry.count++;

        // Check if limit exceeded
        if (entry.count > config.maxRequests) {
            entry.violations++;

            // Block after repeated violations (3 strikes)
            if (entry.violations >= 3) {
                const blockedUntil = now + RateLimiter.config.blockDuration;
                this.blocklist.set(key, blockedUntil);

                // Log security event
                this.logSecurityEvent('RATE_LIMIT_BLOCK', key, {
                    violations: entry.violations,
                    blockedUntil
                });
            }

            const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
            return {
                allowed: false,
                retryAfter,
                blocked: false,
                remaining: 0
            };
        }

        return {
            allowed: true,
            remaining: config.maxRequests - entry.count,
            resetTime: entry.resetTime
        };
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const MAX_MAP_SIZE = 50000;

        // Clean up requests
        for (const [key, entry] of this.requests.entries()) {
            if (now > entry.resetTime) {
                this.requests.delete(key);
            }
        }

        // Clean up blocklist
        for (const [key, blockedUntil] of this.blocklist.entries()) {
            if (now > blockedUntil) {
                this.blocklist.delete(key);
            }
        }

        // Safety cap: LRU evict oldest 10% if Maps grow too large (prevents full-wipe security event)
        if (this.requests.size > MAX_MAP_SIZE) {
            const evictCount = Math.floor(this.requests.size * 0.1);
            let i = 0;
            for (const key of this.requests.keys()) {
                if (i++ >= evictCount) break;
                this.requests.delete(key);
            }
        }
        if (this.blocklist.size > MAX_MAP_SIZE) {
            const evictCount = Math.floor(this.blocklist.size * 0.1);
            let i = 0;
            for (const key of this.blocklist.keys()) {
                if (i++ >= evictCount) break;
                this.blocklist.delete(key);
            }
        }
    }

    /**
     * Log security events to database
     */
    logSecurityEvent(eventType, key, details) {
        try {
            query.run(`
                INSERT INTO security_logs (event_type, ip_or_user, details, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `, [eventType, key, JSON.stringify(details)]);
        } catch (error) {
            logger.error('[RateLimiter] Failed to log security event', error);
        }
    }

    /**
     * Stop the cleanup interval — call during graceful shutdown
     */
    stop() {
        clearInterval(this._cleanupInterval);
        this._cleanupInterval = null;
    }

    /**
     * Manually block an IP or user
     */
    block(key, durationMs = RateLimiter.config.blockDuration) {
        const blockedUntil = Date.now() + durationMs;
        this.blocklist.set(key, blockedUntil);
        this.logSecurityEvent('MANUAL_BLOCK', key, { blockedUntil });
    }

    /**
     * Manually unblock an IP or user
     */
    unblock(key) {
        this.blocklist.delete(key);
        this.logSecurityEvent('MANUAL_UNBLOCK', key, {});
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalTracked: this.requests.size,
            blocked: this.blocklist.size,
            topOffenders: this.getTopOffenders()
        };
    }

    /**
     * Get IPs/users with most requests
     */
    getTopOffenders(limit = 10) {
        const entries = Array.from(this.requests.entries())
            .map(([key, data]) => ({ key, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        return entries;
    }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Rate limiting middleware factory
 * @param {string} limitType - Type of rate limit (default, auth, mutation, expensive)
 */
export function createRateLimiter(limitType = 'default') {
    return function rateLimitMiddleware(ctx) {
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
            if (path.startsWith('/api/auth')) {
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
        const result = rateLimiter.check(key, actualLimitType);

        // Add rate limit headers to response
        ctx.rateLimitHeaders = {
            'X-RateLimit-Limit': RateLimiter.config[actualLimitType].maxRequests,
            'X-RateLimit-Remaining': result.remaining || 0,
            'X-RateLimit-Reset': result.resetTime || Date.now()
        };

        if (!result.allowed) {
            ctx.rateLimitHeaders['Retry-After'] = result.retryAfter;

            // Log rate limit violation
            rateLimiter.logSecurityEvent('RATE_LIMIT_EXCEEDED', key, {
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
export function applyRateLimit(ctx, limitType = 'auto') {
    // Bypass rate limiting in test/dev environments (never in production)
    if (isRateLimitBypassed()) {
        return null; // No rate limit
    }

    const limiter = createRateLimiter(limitType);
    const result = limiter(ctx);

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
