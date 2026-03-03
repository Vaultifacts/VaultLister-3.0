// Sentry Error Tracking Integration
// Provides error tracking and performance monitoring

import { logger } from '../shared/logger.js';

const SENTRY_DSN = process.env.SENTRY_DSN;
const IS_ENABLED = !!SENTRY_DSN && process.env.NODE_ENV === 'production';

// Simple Sentry-like client for error tracking
// In production, replace with actual @sentry/node SDK
const sentryService = {
    initialized: false,
    dsn: SENTRY_DSN,

    init() {
        if (!SENTRY_DSN) {
            logger.info('[Sentry] No DSN configured - error tracking disabled');
            return;
        }

        if (process.env.NODE_ENV !== 'production') {
            logger.info('[Sentry] Not in production mode - error tracking disabled');
            return;
        }

        this.initialized = true;
        logger.info('[Sentry] Error tracking initialized');
    },

    captureException(error, context = {}) {
        if (!IS_ENABLED) {
            // In development, just log to console
            logger.error('[Error]', error.message, context);
            return null;
        }

        // Send error to Sentry
        const eventId = this._generateEventId();

        try {
            // Prepare error payload
            const payload = {
                event_id: eventId,
                timestamp: new Date().toISOString(),
                platform: 'node',
                level: 'error',
                server_name: process.env.HOSTNAME || 'vaultlister',
                environment: process.env.NODE_ENV || 'development',
                exception: {
                    values: [{
                        type: error.name || 'Error',
                        value: error.message,
                        stacktrace: {
                            frames: this._parseStackTrace(error.stack)
                        }
                    }]
                },
                extra: context,
                tags: {
                    version: '1.0.0'
                }
            };

            // Send to Sentry API
            this._sendToSentry(payload);

            return eventId;
        } catch (e) {
            logger.error('[Sentry] Failed to capture exception:', e.message);
            return null;
        }
    },

    captureMessage(message, level = 'info', context = {}) {
        if (!IS_ENABLED) {
            logger.info(`[${level}]`, message, context);
            return null;
        }

        const eventId = this._generateEventId();

        try {
            const payload = {
                event_id: eventId,
                timestamp: new Date().toISOString(),
                platform: 'node',
                level,
                message,
                server_name: process.env.HOSTNAME || 'vaultlister',
                environment: process.env.NODE_ENV || 'development',
                extra: context
            };

            this._sendToSentry(payload);
            return eventId;
        } catch (e) {
            logger.error('[Sentry] Failed to capture message:', e.message);
            return null;
        }
    },

    setUser(user) {
        if (!IS_ENABLED || !user) return;

        this._currentUser = {
            id: user.id,
            email: user.email,
            username: user.username
        };
    },

    clearUser() {
        this._currentUser = null;
    },

    addBreadcrumb(breadcrumb) {
        if (!IS_ENABLED) return;

        if (!this._breadcrumbs) {
            this._breadcrumbs = [];
        }

        this._breadcrumbs.push({
            timestamp: new Date().toISOString(),
            ...breadcrumb
        });

        // Keep only last 100 breadcrumbs
        if (this._breadcrumbs.length > 100) {
            this._breadcrumbs.shift();
        }
    },

    startTransaction(name, op = 'http.server') {
        if (!IS_ENABLED) return { finish: () => {} };

        const start = Date.now();
        const traceId = this._generateEventId();

        return {
            traceId,
            name,
            op,
            start,
            setHttpStatus: (status) => { this._lastStatus = status; },
            finish: () => {
                const duration = Date.now() - start;

                // Log slow transactions
                if (duration > 1000) {
                    logger.warn(`[Sentry] Slow transaction: ${name} took ${duration}ms`);
                }

                // Send transaction to Sentry
                const payload = {
                    type: 'transaction',
                    event_id: traceId,
                    timestamp: new Date().toISOString(),
                    start_timestamp: new Date(start).toISOString(),
                    platform: 'node',
                    transaction: name,
                    contexts: {
                        trace: {
                            trace_id: traceId,
                            span_id: this._generateEventId().substring(0, 16),
                            op
                        }
                    },
                    measurements: {
                        duration: { value: duration, unit: 'millisecond' }
                    }
                };

                this._sendToSentry(payload);
            }
        };
    },

    _generateEventId() {
        return crypto.randomUUID().replace(/-/g, '');
    },

    _parseStackTrace(stack) {
        if (!stack) return [];

        return stack.split('\n').slice(1).map(line => {
            const match = line.match(/at (.+) \((.+):(\d+):(\d+)\)/);
            if (match) {
                return {
                    function: match[1],
                    filename: match[2],
                    lineno: parseInt(match[3]),
                    colno: parseInt(match[4])
                };
            }
            return { filename: line.trim() };
        }).filter(f => f.filename);
    },

    async _sendToSentry(payload) {
        if (!this.dsn) return;

        try {
            // Parse DSN to get project ID and key
            const dsnUrl = new URL(this.dsn);
            const projectId = dsnUrl.pathname.replace('/', '');
            const publicKey = dsnUrl.username;
            const host = dsnUrl.host;

            // Send to Sentry store endpoint
            const response = await fetch(`https://${host}/api/${projectId}/store/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                logger.error('[Sentry] Failed to send event:', response.status);
            }
        } catch (e) {
            logger.error('[Sentry] Network error:', e.message);
        }
    }
};

// Express/Bun middleware for request tracking
export function sentryMiddleware(ctx) {
    if (!IS_ENABLED) return null;

    // Start transaction for this request
    const transaction = sentryService.startTransaction(
        `${ctx.method} ${ctx.path}`,
        'http.server'
    );

    // Add request breadcrumb
    sentryService.addBreadcrumb({
        category: 'http',
        message: `${ctx.method} ${ctx.path}`,
        level: 'info'
    });

    // Set user context if available
    if (ctx.user) {
        sentryService.setUser(ctx.user);
    }

    return transaction;
}

// Error handler middleware
export function sentryErrorHandler(error, ctx) {
    // Scrub sensitive headers before sending to external error tracker
    const safeHeaders = { ...ctx.headers };
    delete safeHeaders['authorization'];
    delete safeHeaders['cookie'];
    delete safeHeaders['x-csrf-token'];

    // Scrub sensitive query params
    const safeQuery = { ...ctx.query };
    delete safeQuery['token'];
    delete safeQuery['api_key'];
    delete safeQuery['key'];

    sentryService.captureException(error, {
        request: {
            method: ctx.method,
            url: ctx.path,
            query: safeQuery,
            headers: safeHeaders
        },
        user: ctx.user ? { id: ctx.user.id } : null
    });
}

export default sentryService;
