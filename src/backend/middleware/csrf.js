// CSRF (Cross-Site Request Forgery) Protection
// Prevents unauthorized state-changing requests from external sites

import crypto from 'crypto';

/**
 * CSRF Token Manager
 * Uses cryptographic tokens to prevent CSRF attacks
 */
class CSRFManager {
    constructor() {
        // Store valid tokens (in production, use Redis or database)
        this.tokens = new Map();
        this.maxTokens = 10000; // Max tokens before eviction

        // Clean up expired tokens every 10 minutes
        setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }

    /**
     * Generate a cryptographically secure CSRF token
     */
    generateToken(sessionId = null) {
        // Create random token
        const token = crypto.randomBytes(32).toString('hex');

        // Store token with expiry (4 hours)
        const expiresAt = Date.now() + (4 * 60 * 60 * 1000);

        // Enforce max token count — evict oldest when full
        if (this.tokens.size >= this.maxTokens) {
            const toDelete = [...this.tokens.keys()].slice(0, 1000);
            toDelete.forEach(k => this.tokens.delete(k));
        }

        this.tokens.set(token, {
            sessionId,
            expiresAt,
            createdAt: Date.now()
        });

        return token;
    }

    /**
     * Validate a CSRF token
     */
    validateToken(token, sessionId = null) {
        if (!token) {
            return false;
        }

        const tokenData = this.tokens.get(token);

        if (!tokenData) {
            return false;
        }

        // Check expiry
        if (Date.now() > tokenData.expiresAt) {
            this.tokens.delete(token);
            return false;
        }

        // Check session ID if provided
        if (sessionId && tokenData.sessionId && tokenData.sessionId !== sessionId) {
            return false;
        }

        return true;
    }

    /**
     * Consume (invalidate) a token after use
     * Enforces one-time use for better security
     */
    consumeToken(token) {
        this.tokens.delete(token);
    }

    /**
     * Clean up expired tokens
     */
    cleanup() {
        const now = Date.now();
        for (const [token, data] of this.tokens.entries()) {
            if (now > data.expiresAt) {
                this.tokens.delete(token);
            }
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalTokens: this.tokens.size,
            oldestToken: this.getOldestToken()
        };
    }

    /**
     * Get oldest token age
     */
    getOldestToken() {
        let oldest = null;
        for (const [, data] of this.tokens.entries()) {
            if (!oldest || data.createdAt < oldest) {
                oldest = data.createdAt;
            }
        }
        return oldest ? Date.now() - oldest : 0;
    }
}

// Singleton instance
const csrfManager = new CSRFManager();

/**
 * CSRF middleware for generating tokens
 * Add CSRF token to responses that will need it
 */
export function addCSRFToken(ctx) {
    // Generate token for this session/user
    const sessionId = ctx.user?.id || ctx.ip;
    const token = csrfManager.generateToken(sessionId);

    // Add to response headers
    ctx.csrfToken = token;

    return token;
}

/**
 * CSRF middleware for validating tokens
 * Protect state-changing operations (POST, PUT, DELETE)
 */
export function validateCSRF(ctx) {
    const { method, headers, user, ip } = ctx;

    // Disable CSRF in test/dev environment only (never in production)
    if ((process.env.DISABLE_CSRF === 'true' && process.env.NODE_ENV !== 'production') || process.env.NODE_ENV === 'test') {
        return { valid: true };
    }

    // Only check state-changing methods
    const stateMutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!stateMutatingMethods.includes(method)) {
        return { valid: true };
    }

    // Skip CSRF for certain paths (public auth endpoints only — profile/password need CSRF)
    // Incoming webhooks from external services (Stripe, marketplace callbacks) never have CSRF tokens.
    const skipPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/logout',
        '/api/auth/password-reset',
        '/api/auth/resend-verification',
        '/api/auth/demo-login',
        '/api/webhooks/incoming',
        '/api/csp-report'
    ];
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

    // Validate token
    const sessionId = user?.id || ip;
    const isValid = csrfManager.validateToken(token, sessionId);

    if (!isValid) {
        return {
            valid: false,
            error: 'Invalid or expired CSRF token',
            status: 403
        };
    }

    // Consume token after successful validation (one-time use)
    csrfManager.consumeToken(token);

    return { valid: true };
}

/**
 * Apply CSRF protection to request
 */
export function applyCSRFProtection(ctx) {
    const validation = validateCSRF(ctx);

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
    skipPaths: [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/logout',
        '/api/auth/password-reset',
        '/api/auth/resend-verification',
        '/api/health',
        '/api/status',
        '/api/webhooks/incoming',
        '/api/csp-report'
    ]
};

// Export manager for admin operations
export { csrfManager };
