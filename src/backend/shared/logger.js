// Structured Logger for VaultLister
// Ships logs to Betterstack Telemetry when BETTERSTACK_SOURCE_TOKEN is set.
// Falls back to console-only in local dev when the token is absent.

import { Logtail } from '@logtail/node';
import Sentry from '../instrument.js';

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    SILENT: 4,
};

// Get log level from environment, default to INFO in production, DEBUG in development
const currentLevel =
    LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ??
    (process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);

// Betterstack sink — null when token is absent (local dev / CI without credentials)
const BETTERSTACK_TOKEN = process.env.BETTERSTACK_SOURCE_TOKEN;

let _logtail = null;
if (BETTERSTACK_TOKEN) {
    _logtail = new Logtail(BETTERSTACK_TOKEN, {
        sendLogsToConsoleOutput: false, // we handle console output ourselves below
        ignoreExceptions: true, // never let Betterstack errors surface to callers
    });
}

/**
 * Format log message with timestamp and metadata
 */
function formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
        timestamp,
        level,
        message,
        ...meta,
    };

    // In production, output JSON for log aggregation (Railway stdout drain)
    if (process.env.NODE_ENV === 'production') {
        return JSON.stringify(entry);
    }

    // In development, output human-readable format
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

/**
 * Ship a log entry to Betterstack (fire-and-forget; never throws).
 */
function shipToBetterstack(level, message, meta) {
    if (!_logtail) return;
    _logtail[level](message, meta).catch(() => {});
}

/**
 * Normalize the optional meta argument — always produces a plain object.
 */
function normalizeMeta(meta) {
    if (meta === null || meta === undefined) return {};
    if (meta instanceof Error) return { detail: meta.message };
    if (typeof meta !== 'object') return { detail: meta };
    return meta;
}

/**
 * Logger instance with level-based methods
 */
export const logger = {
    debug(message, meta = {}) {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            meta = normalizeMeta(meta);
            console.debug(formatMessage('DEBUG', message, meta));
            shipToBetterstack('debug', message, meta);
        }
    },

    info(message, meta = {}) {
        if (currentLevel <= LOG_LEVELS.INFO) {
            meta = normalizeMeta(meta);
            console.info(formatMessage('INFO', message, meta));
            shipToBetterstack('info', message, meta);
        }
    },

    warn(message, meta = {}) {
        if (currentLevel <= LOG_LEVELS.WARN) {
            meta = normalizeMeta(meta);
            console.warn(formatMessage('WARN', message, meta));
            shipToBetterstack('warn', message, meta);
            Sentry.addBreadcrumb({ level: 'warning', message, data: meta });
            Sentry.logger.warn(message, meta);
        }
    },

    error(message, error = null, meta = {}) {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            if (typeof error === 'string') {
                meta = { ...normalizeMeta(meta), detail: error };
                error = null;
            } else {
                meta = normalizeMeta(meta);
            }
            const errorMeta = error
                ? {
                      ...meta,
                      error: {
                          message: error.message,
                          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                          code: error.code,
                      },
                  }
                : meta;
            console.error(formatMessage('ERROR', message, errorMeta));
            shipToBetterstack('error', message, errorMeta);
            Sentry.addBreadcrumb({ level: 'error', message, data: errorMeta });
            Sentry.logger.error(message, errorMeta);
        }
    },

    // Specialized loggers for common use cases
    request(method, path, statusCode, durationMs, meta = {}) {
        this.info(`${method} ${path} ${statusCode}`, { ...normalizeMeta(meta), durationMs });
    },

    db(operation, table, meta = {}) {
        this.debug(`DB ${operation} on ${table}`, normalizeMeta(meta));
    },

    automation(action, platform, meta = {}) {
        this.info(`[Automation] ${action}`, { platform, ...normalizeMeta(meta) });
    },

    bot(platform, action, meta = {}) {
        this.debug(`[Bot:${platform}] ${action}`, normalizeMeta(meta));
    },

    security(event, meta = {}) {
        this.warn(`[Security] ${event}`, normalizeMeta(meta));
    },

    performance(operation, durationMs, meta = {}) {
        if (durationMs > 1000) {
            this.warn(`Slow operation: ${operation}`, { durationMs, ...normalizeMeta(meta) });
        } else {
            this.debug(`Performance: ${operation}`, { durationMs, ...normalizeMeta(meta) });
        }
    },

    // Flush pending Betterstack batches — call during graceful shutdown
    async flush() {
        if (_logtail) {
            try {
                await _logtail.flush();
            } catch {
                /* ignore */
            }
        }
    },
};

/**
 * Create a child logger with preset context
 */
export function createLogger(context = {}) {
    return {
        debug: (msg, meta = {}) => logger.debug(msg, { ...context, ...normalizeMeta(meta) }),
        info: (msg, meta = {}) => logger.info(msg, { ...context, ...normalizeMeta(meta) }),
        warn: (msg, meta = {}) => logger.warn(msg, { ...context, ...normalizeMeta(meta) }),
        error: (msg, err, meta = {}) => logger.error(msg, err, { ...context, ...normalizeMeta(meta) }),
    };
}

export default logger;
