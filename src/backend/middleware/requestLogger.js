// Request Logging Middleware
// Structured logging for all HTTP requests

import { now, generateId, logInfo, logError } from '../shared/utils.js';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

/**
 * Performance timing helper
 */
function getProcessTime(startTime) {
    return Math.round(performance.now() - startTime);
}

/**
 * Get client IP address from request
 */
function getClientIP(request, headers) {
    // Only trust proxy headers when explicitly configured
    const trustProxy = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';

    if (trustProxy) {
        const forwardedFor = headers['x-forwarded-for'];
        if (forwardedFor) {
            return forwardedFor.split(',')[0].trim();
        }

        const realIP = headers['x-real-ip'];
        if (realIP) {
            return realIP;
        }
    }

    // Fallback to connection info
    return 'unknown';
}

/**
 * Anonymize IP address by zeroing the last octet (IPv4) or last 80 bits (IPv6)
 */
function anonymizeIP(ip) {
    if (!ip || ip === 'unknown') return ip;
    // IPv4: zero last octet
    if (ip.includes('.') && !ip.includes(':')) {
        const parts = ip.split('.');
        if (parts.length === 4) {
            parts[3] = '0';
            return parts.join('.');
        }
    }
    // IPv6: zero last 5 groups
    if (ip.includes(':')) {
        const parts = ip.split(':');
        if (parts.length >= 4) {
            return parts.slice(0, 3).join(':') + '::0';
        }
    }
    return ip;
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
export function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = [
        'password', 'newPassword', 'currentPassword', 'confirmPassword',
        'token', 'accessToken', 'refreshToken', 'refresh_token', 'apiKey', 'secret',
        'creditCard', 'cardNumber', 'cvv', 'ssn', 'imageBase64',
        'code', 'state', 'client_secret', 'code_verifier', 'authorization_code'
    ];

    const sanitized = { ...body };

    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
        }
    }

    // Truncate large fields
    for (const [key, value] of Object.entries(sanitized)) {
        if (typeof value === 'string' && value.length > 200) {
            sanitized[key] = value.substring(0, 200) + '...[truncated]';
        }
    }

    return sanitized;
}

const SENSITIVE_QUERY_PARAMS = new Set(['token', 'password', 'key', 'secret', 'access_token', 'refresh_token', 'api_key', 'apikey', 'auth']);
const MAX_USER_AGENT_LENGTH = 200;
const AUTH_PATH_PREFIXES = ['/api/auth', '/api/oauth'];

/**
 * Redact sensitive query parameters from a params object
 */
function redactQueryParams(params) {
    const redacted = { ...params };
    for (const key of Object.keys(redacted)) {
        if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
            redacted[key] = '[REDACTED]';
        }
    }
    return redacted;
}

/**
 * Return true if the path belongs to an auth endpoint that should not have
 * its request body logged.
 */
function isAuthPath(path) {
    return AUTH_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * Create request context with unique ID
 */
export function createRequestContext(request) {
    const headers = Object.fromEntries(request.headers.entries());
    const url = new URL(request.url);
    const rawUserAgent = headers['user-agent'] || 'unknown';

    return {
        requestId: generateId(),
        method: request.method,
        path: url.pathname,
        query: redactQueryParams(Object.fromEntries(url.searchParams)),
        ip: getClientIP(request, headers),
        userAgent: rawUserAgent.substring(0, MAX_USER_AGENT_LENGTH),
        referer: headers['referer'] || null,
        timestamp: now(),
        startTime: performance.now(),
        isAuthPath: isAuthPath(url.pathname)
    };
}

/**
 * Log request start
 */
export function logRequestStart(ctx) {
    if (shouldSkipLogging(ctx.path)) return;

    logInfo('Request started', {
        requestId: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        ...(ctx.isAuthPath ? {} : { query: ctx.query })
    });
}

/**
 * Log request completion
 */
export function logRequestComplete(ctx, response, error = null) {
    if (shouldSkipLogging(ctx.path)) return;

    const duration = getProcessTime(ctx.startTime);
    const status = response?.status || (error ? 500 : 200);

    const logData = {
        requestId: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        status,
        duration: `${duration}ms`,
        userId: ctx.user?.id || null,
        ip: ctx.ip
    };

    if (error) {
        logError('Request failed', error, logData);
    } else if (status >= 400) {
        logInfo('Request completed with error', {
            ...logData,
            error: response?.data?.error
        });
    } else {
        logInfo('Request completed', logData);
    }

    if (duration > 100) {
        logger.warn('[SlowResponse] Response exceeded 100ms threshold', {
            method: ctx.method,
            path: ctx.path,
            duration: `${duration}ms`,
            status
        });
    }

    // Store in database for analytics (async, don't wait)
    storeRequestLog(ctx, status, duration, error).catch(() => {});
}

/**
 * Skip logging for certain paths
 */
function shouldSkipLogging(path) {
    const skipPaths = [
        '/api/health',
        '/api/status',
        '/favicon.ico',
        '/robots.txt'
    ];

    return skipPaths.some(p => path.startsWith(p)) ||
           path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/);
}

/**
 * Store request log in database
 */
async function storeRequestLog(ctx, status, duration, error = null) {
    try {
        await query.run(`
            INSERT INTO request_logs (
                id, request_id, method, path, status_code,
                duration_ms, user_id, ip_address, user_agent,
                error_message, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            generateId(),
            ctx.requestId || null,
            ctx.method,
            ctx.path,
            status,
            duration,
            ctx.user?.id || null,
            anonymizeIP(ctx.ip) || null,
            ctx.userAgent?.substring(0, MAX_USER_AGENT_LENGTH) || null,
            error?.message || null,
            ctx.timestamp || now()
        ]);
    } catch (dbError) {
        // Silently fail
    }
}

/**
 * Audit log for important actions
 */
export async function logAuditEvent(ctx, action, resourceType, resourceId, details = {}) {
    try {
        await query.run(`
            INSERT INTO audit_logs (
                id, user_id, action, resource_type, resource_id,
                details, ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            generateId(),
            ctx.user?.id || null,
            action,
            resourceType,
            resourceId,
            JSON.stringify(details),
            anonymizeIP(ctx.ip),
            ctx.userAgent?.substring(0, MAX_USER_AGENT_LENGTH) || null,
            now()
        ]);

        logInfo('Audit event', {
            action,
            resourceType,
            resourceId,
            userId: ctx.user?.id
        });
    } catch (error) {
        logger.error('[RequestLogger] Failed to log audit event', null, { detail: error.message });
    }
}

/**
 * Common audit actions
 */
export const AuditActions = {
    // Authentication
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
    PASSWORD_RESET: 'PASSWORD_RESET',

    // CRUD operations
    CREATE: 'CREATE',
    READ: 'READ',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',

    // Bulk operations
    BULK_CREATE: 'BULK_CREATE',
    BULK_UPDATE: 'BULK_UPDATE',
    BULK_DELETE: 'BULK_DELETE',

    // Import/Export
    IMPORT: 'IMPORT',
    EXPORT: 'EXPORT',

    // Settings
    SETTINGS_UPDATE: 'SETTINGS_UPDATE',

    // Integrations
    OAUTH_CONNECT: 'OAUTH_CONNECT',
    OAUTH_DISCONNECT: 'OAUTH_DISCONNECT',
    WEBHOOK_CREATE: 'WEBHOOK_CREATE',
    WEBHOOK_DELETE: 'WEBHOOK_DELETE',

    // Admin
    ADMIN_ACTION: 'ADMIN_ACTION',
    USER_IMPERSONATION: 'USER_IMPERSONATION'
};

/**
 * Request logging middleware factory
 */
export function createRequestLogger() {
    return {
        before: (ctx) => {
            const requestCtx = createRequestContext(ctx.request);
            Object.assign(ctx, requestCtx);
            logRequestStart(ctx);
        },
        after: (ctx, response, error) => {
            logRequestComplete(ctx, response, error);
        }
    };
}
