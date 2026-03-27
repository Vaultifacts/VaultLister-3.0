import crypto from 'crypto';
import { logger } from '../shared/logger.js';

const IS_ENABLED = !!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production';

function parseDsn(dsn) {
    if (!dsn) return null;
    try {
        const url = new URL(dsn);
        return {
            publicKey: url.username,
            host: url.host,
            projectId: url.pathname.replace('/', '')
        };
    } catch {
        return null;
    }
}

const sentryService = {
    dsn: process.env.SENTRY_DSN,
    initialized: false,
    _breadcrumbs: undefined,
    _currentUser: null,
    _lastStatus: undefined,

    init() {
        if (!this.dsn) {
            logger.info('[Sentry] No DSN configured — error tracking disabled');
            return;
        }
        if (!IS_ENABLED) {
            logger.info('[Sentry] Not in production mode — error tracking disabled');
            return;
        }
        this.initialized = true;
        this._breadcrumbs = [];
        logger.info('[Sentry] Initialized');
    },

    captureException(error, context = {}) {
        if (!IS_ENABLED) {
            logger.error('[Sentry]', error?.message || String(error));
            return null;
        }
        const eventId = this._generateEventId();
        const event = {
            event_id: eventId,
            level: 'error',
            exception: {
                values: [{
                    type: error?.name || 'Error',
                    value: error?.message || String(error),
                    stacktrace: { frames: this._parseStackTrace(error?.stack) }
                }]
            },
            extra: context,
            user: this._currentUser || undefined,
            breadcrumbs: this._breadcrumbs ? { values: [...this._breadcrumbs] } : undefined,
            timestamp: new Date().toISOString()
        };
        this._sendToSentry(event);
        return eventId;
    },

    captureMessage(message, level = 'info', context = {}) {
        if (!IS_ENABLED) {
            logger.info('[Sentry]', message);
            return null;
        }
        const eventId = this._generateEventId();
        const event = {
            event_id: eventId,
            level,
            message,
            extra: context,
            user: this._currentUser || undefined,
            timestamp: new Date().toISOString()
        };
        this._sendToSentry(event);
        return eventId;
    },

    setUser(user) {
        if (!IS_ENABLED) return;
        this._currentUser = user || null;
    },

    clearUser() {
        this._currentUser = null;
    },

    addBreadcrumb(crumb) {
        if (!IS_ENABLED) return;
        if (!this._breadcrumbs) this._breadcrumbs = [];
        this._breadcrumbs.push({ ...crumb, timestamp: new Date().toISOString() });
        if (this._breadcrumbs.length > 100) {
            this._breadcrumbs.shift();
        }
    },

    startTransaction(name, op) {
        if (!IS_ENABLED) {
            return { finish: () => {} };
        }
        const startTime = Date.now();
        const eventId = this._generateEventId();
        return {
            finish: () => {
                const duration = Date.now() - startTime;
                if (duration > 1000) {
                    logger.warn(`[Sentry] Slow transaction: ${name} took ${duration}ms`);
                }
                this._sendToSentry({
                    event_id: eventId,
                    type: 'transaction',
                    transaction: name,
                    contexts: { trace: { op: op || 'default', status: 'ok' } },
                    timestamp: new Date().toISOString(),
                    start_timestamp: new Date(startTime).toISOString()
                });
            }
        };
    },

    _generateEventId() {
        return crypto.randomBytes(16).toString('hex');
    },

    _parseStackTrace(stack) {
        if (!stack) return [];
        const frames = [];
        const lines = stack.split('\n').slice(1);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const match = trimmed.match(/^at\s+(\S+)\s+\((.+):(\d+):(\d+)\)$/);
            if (match) {
                frames.push({
                    function: match[1],
                    filename: match[2],
                    lineno: parseInt(match[3], 10),
                    colno: parseInt(match[4], 10)
                });
            } else {
                frames.push({ filename: trimmed });
            }
        }
        return frames;
    },

    async _sendToSentry(event) {
        if (!this.dsn) return;
        const parsed = parseDsn(this.dsn);
        if (!parsed) return;
        const { publicKey, host, projectId } = parsed;
        const timestamp = Math.floor(Date.now() / 1000);
        try {
            const response = await fetch(`https://${host}/api/${projectId}/store/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_timestamp=${timestamp}`
                },
                body: JSON.stringify(event)
            });
            if (!response.ok) {
                logger.error(`[Sentry] Failed to send event — HTTP ${response.status}`);
            }
        } catch (err) {
            logger.error('[Sentry] Failed to send event to Sentry:', err.message);
        }
    }
};

export function sentryMiddleware(ctx) {
    if (!IS_ENABLED) return null;
    return sentryService.startTransaction(`${ctx.method} ${ctx.path}`, 'http.server');
}

export function sentryErrorHandler(error, ctx) {
    const headers = { ...ctx.headers };
    delete headers.authorization;
    delete headers.cookie;
    delete headers['x-csrf-token'];

    const query = { ...(ctx.query || {}) };
    delete query.token;
    delete query.api_key;
    delete query.key;

    sentryService.captureException(error, {
        method: ctx.method,
        path: ctx.path,
        headers,
        query,
        ...(ctx.user ? { user: { id: ctx.user.id } } : {})
    });
}

export { sentryService };
export default sentryService;
