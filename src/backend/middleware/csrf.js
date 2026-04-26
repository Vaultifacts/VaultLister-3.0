// CSRF (Cross-Site Request Forgery) Protection
// Prevents unauthorized state-changing requests from external sites

import crypto from 'crypto';
import { query } from '../db/database.js';
import { INTERVALS } from '../shared/constants.js';
import { logger } from '../shared/logger.js';

// Single source of truth for all paths that bypass CSRF enforcement.
// Used by both validateCSRF() (runtime) and csrfConfig.skipPaths (export/docs).
const CSRF_SKIP_PATHS = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/password-reset',
    '/api/auth/resend-verification',
    '/api/auth/demo-login',
    '/api/webhooks/incoming',
    '/api/webhooks/stripe',
    '/api/csp-report',
    '/api/monitoring/rum',
    '/api/contact',
    '/api/incidents/subscribe',
    '/api/affiliate-apply',
    '/api/health',
    '/api/status'
];

/**
 * CSRF Token Manager — PostgreSQL-backed (B-09)
 * Tokens survive server restarts and work across multiple instances.
 */
class CSRFManager {
    constructor() {
        // Clean up expired tokens every 10 minutes
        this._cleanupInterval = setInterval(() => this.cleanup(), INTERVALS.CSRF_TOKEN_CLEANUP_MS);
    }

    async generateToken(sessionId = null) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + (4 * 60 * 60 * 1000);
        await query.run(
            'INSERT INTO csrf_tokens (token, session_id, expires_at) VALUES (?, ?, ?)',
            [token, sessionId ?? '', expiresAt]
        );
        return token;
    }

    async validateToken(token, sessionId = null) {
        if (!token) return false;
        const row = await query.get(
            'SELECT session_id, expires_at FROM csrf_tokens WHERE token = ?',
            [token]
        );
        if (!row) return false;
        if (Date.now() > row.expires_at) {
            await query.run('DELETE FROM csrf_tokens WHERE token = ?', [token]);
            return false;
        }
        // Only enforce session binding when session_id was explicitly stored and matches.
        // Skip IP-based binding: load-balanced deployments (Railway) route requests across
        // instances with different socket IPs, causing false CSRF rejections. Tokens are
        // already one-time-use and user-scoped, so IP binding provides no meaningful security benefit.
        if (sessionId && row.session_id && row.session_id.includes(':')) {
            const storedUserId = row.session_id.split(':').pop();
            const incomingUserId = sessionId.includes(':') ? sessionId.split(':').pop() : sessionId;
            if (storedUserId !== incomingUserId) return false;
        }
        return true;
    }

    async consumeToken(token) {
        await query.run('DELETE FROM csrf_tokens WHERE token = ?', [token]);
    }

    stop() {
        clearInterval(this._cleanupInterval);
        this._cleanupInterval = null;
    }

    async clearTokens() {
        await query.run('DELETE FROM csrf_tokens', []);
    }

    async cleanup() {
        await query.run('DELETE FROM csrf_tokens WHERE expires_at < ?', [Date.now()]);
    }

    async getStats() {
        const row = await query.get('SELECT COUNT(*) as total, MIN(created_at) as oldest FROM csrf_tokens', []);
        return {
            totalTokens: row?.total ?? 0,
            oldestToken: row?.oldest ? Date.now() - row.oldest : 0
        };
    }
}

// Singleton instance
const csrfManager = new CSRFManager();

// Startup guard: warn if DISABLE_CSRF is set outside test mode
if (process.env.DISABLE_CSRF === 'true' && process.env.NODE_ENV !== 'test') {
    logger.warn('[SECURITY] DISABLE_CSRF is set but NODE_ENV is not "test" — CSRF protection remains ENABLED. DISABLE_CSRF only takes effect when NODE_ENV=test.');
}

/**
 * CSRF middleware for generating tokens
 * Add CSRF token to responses that will need it
 */
export async function addCSRFToken(ctx) {
    // B-08: bind to ip:userId when authenticated so tokens aren't shared across
    // users behind the same NAT/proxy. Pre-login calls use ip only; those routes
    // (login, register) are in skipPaths so CSRF is not enforced on them.
    const sessionId = ctx.user?.id ? `${ctx.ip}:${ctx.user.id}` : ctx.ip;
    const token = await csrfManager.generateToken(sessionId);

    // Add to response headers
    ctx.csrfToken = token;

    return token;
}

/**
 * CSRF middleware for validating tokens
 * Protect state-changing operations (POST, PUT, DELETE)
 */
export async function validateCSRF(ctx) {
    const { method, headers, user, ip } = ctx;

    // Disable CSRF only when explicitly requested in test environment
    if (process.env.DISABLE_CSRF === 'true' && process.env.NODE_ENV === 'test') {
        return { valid: true };
    }

    // Only check state-changing methods
    const stateMutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!stateMutatingMethods.includes(method)) {
        return { valid: true };
    }

    // Skip CSRF for certain paths (public auth endpoints only — profile/password need CSRF)
    // Incoming webhooks from external services (Stripe, marketplace callbacks) never have CSRF tokens.
    const skipPaths = CSRF_SKIP_PATHS;
    if (skipPaths.some(path => ctx.path.startsWith(path) || ctx.path === path.replace('/api', ''))) {
        return { valid: true };
    }

    // Get token from header or body
    const token = headers['x-csrf-token'] ||
                  headers['csrf-token'] ||
                  ctx.body?.csrfToken;

    if (!token) {
        return {
            valid: false,
            error: 'CSRF token missing',
            status: 403
        };
    }

    // B-08: match the session ID scheme used in addCSRFToken
    const sessionId = user?.id ? `${ip}:${user.id}` : ip;
    const isValid = await csrfManager.validateToken(token, sessionId);

    if (!isValid) {
        return {
            valid: false,
            error: 'Invalid or expired CSRF token',
            status: 403
        };
    }

    // Consume token after successful validation (one-time use)
    await csrfManager.consumeToken(token);

    return { valid: true };
}

/**
 * Apply CSRF protection to request
 */
export async function applyCSRFProtection(ctx) {
    const validation = await validateCSRF(ctx);

    if (!validation.valid) {
        return {
            status: validation.status || 403,
            data: {
                error: validation.error,
                code: 'CSRF_TOKEN_INVALID'
            }
        };
    }

    return null; // No CSRF error
}

/**
 * CSRF configuration
 */
export const csrfConfig = {
    // Header names to check for token
    headerNames: ['X-CSRF-Token', 'CSRF-Token'],

    // Cookie options (if using cookie-based CSRF)
    cookie: {
        name: 'XSRF-TOKEN',
        httpOnly: false, // Allow JavaScript to read (for AJAX)
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    },

    // Paths that don't require CSRF protection
    skipPaths: CSRF_SKIP_PATHS
};

/**
 * Stop the CSRF cleanup interval — call during graceful shutdown
 */
export function stopCSRF() {
    csrfManager.stop();
}

/**
 * Clear all CSRF tokens — for test isolation only
 * Call in beforeEach() in any test that manipulates csrfManager directly
 */
export function clearCSRFTokens() {
    csrfManager.clearTokens();
}

// Export manager for admin operations
export { csrfManager };
