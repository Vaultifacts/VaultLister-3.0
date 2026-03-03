// Structured Logger for VaultLister
// Replaces console.log with configurable logging levels

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    SILENT: 4
};

// Get log level from environment, default to INFO in production, DEBUG in development
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ??
    (process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);

/**
 * Format log message with timestamp and metadata
 */
function formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
        timestamp,
        level,
        message,
        ...meta
    };

    // In production, output JSON for log aggregation
    if (process.env.NODE_ENV === 'production') {
        return JSON.stringify(entry);
    }

    // In development, output human-readable format
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

/**
 * Logger instance with level-based methods
 */
export const logger = {
    debug(message, meta = {}) {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            if (typeof meta !== 'object' || meta === null || meta instanceof Error) {
                meta = { detail: meta instanceof Error ? meta.message : meta };
            }
            console.debug(formatMessage('DEBUG', message, meta));
        }
    },

    info(message, meta = {}) {
        if (currentLevel <= LOG_LEVELS.INFO) {
            if (typeof meta !== 'object' || meta === null || meta instanceof Error) {
                meta = { detail: meta instanceof Error ? meta.message : meta };
            }
            console.info(formatMessage('INFO', message, meta));
        }
    },

    warn(message, meta = {}) {
        if (currentLevel <= LOG_LEVELS.WARN) {
            if (typeof meta !== 'object' || meta === null || meta instanceof Error) {
                meta = { detail: meta instanceof Error ? meta.message : meta };
            }
            console.warn(formatMessage('WARN', message, meta));
        }
    },

    error(message, error = null, meta = {}) {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            if (typeof error === 'string') { meta = { ...meta, detail: error }; error = null; }
            const errorMeta = error ? {
                ...meta,
                error: {
                    message: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                    code: error.code
                }
            } : meta;
            console.error(formatMessage('ERROR', message, errorMeta));
        }
    },

    // Specialized loggers for common use cases
    request(method, path, statusCode, durationMs, meta = {}) {
        this.info(`${method} ${path} ${statusCode}`, { ...meta, durationMs });
    },

    db(operation, table, meta = {}) {
        this.debug(`DB ${operation} on ${table}`, meta);
    },

    automation(action, platform, meta = {}) {
        this.info(`[Automation] ${action}`, { platform, ...meta });
    },

    bot(platform, action, meta = {}) {
        this.debug(`[Bot:${platform}] ${action}`, meta);
    },

    security(event, meta = {}) {
        this.warn(`[Security] ${event}`, meta);
    },

    performance(operation, durationMs, meta = {}) {
        if (durationMs > 1000) {
            this.warn(`Slow operation: ${operation}`, { durationMs, ...meta });
        } else {
            this.debug(`Performance: ${operation}`, { durationMs, ...meta });
        }
    }
};

/**
 * Create a child logger with preset context
 */
export function createLogger(context = {}) {
    return {
        debug: (msg, meta = {}) => logger.debug(msg, { ...context, ...meta }),
        info: (msg, meta = {}) => logger.info(msg, { ...context, ...meta }),
        warn: (msg, meta = {}) => logger.warn(msg, { ...context, ...meta }),
        error: (msg, err, meta = {}) => logger.error(msg, err, { ...context, ...meta })
    };
}

export default logger;
