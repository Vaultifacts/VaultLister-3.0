// Structured logger for worker processes.
// Outputs newline-delimited JSON to stdout/stderr for log aggregation.
// Use this in worker/bots/* when the src/backend/shared/logger.js import
// path is inconvenient (e.g. standalone scripts outside the src tree).
const logger = {
    info: (msg, ctx = {}) => console.log(JSON.stringify({ level: 'info', msg, ...ctx, ts: new Date().toISOString() })),
    warn: (msg, ctx = {}) => console.warn(JSON.stringify({ level: 'warn', msg, ...ctx, ts: new Date().toISOString() })),
    error: (msg, ctx = {}) => console.error(JSON.stringify({ level: 'error', msg, ...ctx, ts: new Date().toISOString() }))
};

export default logger;
