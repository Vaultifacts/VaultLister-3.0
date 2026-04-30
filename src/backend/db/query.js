import postgres from 'postgres';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../shared/logger.js';
import { recordQueryMetric, extractQueryInfo, SLOW_QUERY_THRESHOLD_MS } from './metrics.js';
import { prepareSQL } from './sql-helpers.js';

export const __dirname = dirname(fileURLToPath(import.meta.url));

const POOL_MAX = parseInt(process.env.DB_POOL_SIZE, 10) || 25;
const POOL_WARNING_THRESHOLD = 0.8; // warn when >80% of connections are in use

const sql = postgres(process.env.DATABASE_URL || 'postgresql://vaultlister:localdev@localhost:5432/vaultlister_dev', {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, // nosemgrep: problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification -- Railway managed PostgreSQL uses self-signed cert; internal private network connection
    max: POOL_MAX,
    idle_timeout: 20,
    connect_timeout: 10,
});

// Pool monitoring state
let _poolMonitorInterval = null;
let _isShuttingDown = false;

// Track active query count manually since postgres.js does not expose per-query hooks
let _activeQueries = 0;

export function _startPoolMonitor() {
    if (_poolMonitorInterval) return;
    _poolMonitorInterval = setInterval(() => {
        const stats = sql.options;
        // postgres.js exposes current connection state via internal properties;
        // approximate active connections from our own counter
        const activeConnections = _activeQueries;
        const utilizationRatio = activeConnections / POOL_MAX;
        if (utilizationRatio >= POOL_WARNING_THRESHOLD) {
            logger.warn('[DB] Connection pool high utilization', {
                activeQueries: activeConnections,
                poolMax: POOL_MAX,
                utilizationPct: Math.round(utilizationRatio * 100),
            });
        }
    }, 10000);
}

function _stopPoolMonitor() {
    if (_poolMonitorInterval) {
        clearInterval(_poolMonitorInterval);
        _poolMonitorInterval = null;
    }
}

export function getStatementCacheStats() {
    const poolMax = sql.options.max || POOL_MAX;
    const activeConnections = _activeQueries;
    return {
        poolSize: poolMax,
        idleConnections: sql.options.idle_timeout,
        activeConnections,
        utilizationPct: Math.round((activeConnections / poolMax) * 100),
        isShuttingDown: _isShuttingDown,
    };
}

export const query = {
    // Get single row
    async get(sqlStr, params = [], requestId = null) {
        if (_isShuttingDown) throw new Error('Database is shutting down — not accepting new queries');
        _activeQueries++;
        const start = performance.now();
        try {
            const converted = prepareSQL(sqlStr);
            const paramArray = Array.isArray(params) ? params : [params];
            const rows = await sql.unsafe(converted, paramArray);
            const duration = performance.now() - start;
            const { operation, table } = extractQueryInfo(sqlStr);
            recordQueryMetric(sqlStr, duration, requestId);
            logger.debug('DB query', { type: 'db_query', operation, table, duration, requestId });
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                logger.warn('Slow query detected', { sql: sqlStr.substring(0, 200), duration, requestId });
            }
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            const duration = performance.now() - start;
            recordQueryMetric(sqlStr, duration, requestId);
            logger.error('Query error:', error.message, process.env.NODE_ENV !== 'production' ? sqlStr : '');
            throw error;
        } finally {
            _activeQueries--;
        }
    },

    // Get all rows
    async all(sqlStr, params = [], requestId = null) {
        if (_isShuttingDown) throw new Error('Database is shutting down — not accepting new queries');
        _activeQueries++;
        const start = performance.now();
        try {
            const converted = prepareSQL(sqlStr);
            const paramArray = Array.isArray(params) ? params : [params];
            const rows = await sql.unsafe(converted, paramArray);
            const duration = performance.now() - start;
            const { operation, table } = extractQueryInfo(sqlStr);
            recordQueryMetric(sqlStr, duration, requestId);
            logger.debug('DB query', { type: 'db_query', operation, table, duration, requestId });
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                logger.warn('Slow query detected', { sql: sqlStr.substring(0, 200), duration, requestId });
            }
            return rows;
        } catch (error) {
            const duration = performance.now() - start;
            recordQueryMetric(sqlStr, duration, requestId);
            logger.error('Query error:', error.message, process.env.NODE_ENV !== 'production' ? sqlStr : '');
            throw error;
        } finally {
            _activeQueries--;
        }
    },

    // Execute mutation (INSERT, UPDATE, DELETE)
    async run(sqlStr, params = [], requestId = null) {
        if (_isShuttingDown) throw new Error('Database is shutting down — not accepting new queries');
        _activeQueries++;
        const start = performance.now();
        try {
            const converted = prepareSQL(sqlStr);
            const paramArray = Array.isArray(params) ? params : [params];
            const result = await sql.unsafe(converted, paramArray);
            const duration = performance.now() - start;
            const { operation, table } = extractQueryInfo(sqlStr);
            recordQueryMetric(sqlStr, duration, requestId);
            logger.debug('DB query', { type: 'db_query', operation, table, duration, requestId });
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                logger.warn('Slow query detected', { sql: sqlStr.substring(0, 200), duration, requestId });
            }
            return { changes: result.count, lastInsertRowid: 0 };
        } catch (error) {
            const duration = performance.now() - start;
            recordQueryMetric(sqlStr, duration, requestId);
            logger.error('Query error:', error.message, process.env.NODE_ENV !== 'production' ? sqlStr : '');
            throw error;
        } finally {
            _activeQueries--;
        }
    },

    // Execute raw SQL (DDL, no params)
    async exec(sqlStr) {
        if (_isShuttingDown) throw new Error('Database is shutting down — not accepting new queries');
        _activeQueries++;
        try {
            await sql.unsafe(sqlStr);
        } catch (error) {
            logger.error('Exec error:', error.message);
            throw error;
        } finally {
            _activeQueries--;
        }
    },

    // Transaction helper — returns a promise (callers: await query.transaction(fn))
    // Retries on PostgreSQL deadlock (40P01) and serialization failure (40001)
    async transaction(fn, { maxRetries = 3 } = {}) {
        let attempt = 0;
        while (true) {
            try {
                return await sql.begin(async (tx) => {
                    const txQuery = {
                        async get(s, p = []) {
                            const paramArray = Array.isArray(p) ? p : [p];
                            const r = await tx.unsafe(prepareSQL(s), paramArray);
                            return r.length > 0 ? r[0] : null;
                        },
                        async all(s, p = []) {
                            const paramArray = Array.isArray(p) ? p : [p];
                            return await tx.unsafe(prepareSQL(s), paramArray);
                        },
                        async run(s, p = []) {
                            const paramArray = Array.isArray(p) ? p : [p];
                            const r = await tx.unsafe(prepareSQL(s), paramArray);
                            return { changes: r.count, lastInsertRowid: 0 };
                        },
                        async exec(s) {
                            await tx.unsafe(s);
                        },
                    };
                    return await fn(txQuery);
                });
            } catch (err) {
                // Retry on deadlock (40P01) or serialization failure (40001)
                const retryable = err.code === '40P01' || err.code === '40001';
                if (retryable && attempt < maxRetries) {
                    attempt++;
                    const delay = attempt * 50;
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                }
                throw err;
            }
        }
    },

    // Full-text search on inventory — tsvector primary, ILIKE fallback.
    async searchInventory(searchTerm, userId, limit = 50) {
        const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
        try {
            const rows =
                await sql`SELECT * FROM inventory WHERE user_id = ${userId} AND search_vector @@ plainto_tsquery('english', ${searchTerm}) LIMIT ${safeLimit}`;
            return rows;
        } catch {
            const term = `%${searchTerm}%`;
            const rows =
                await sql`SELECT * FROM inventory WHERE user_id = ${userId} AND (title ILIKE ${term} OR description ILIKE ${term}) LIMIT ${safeLimit}`;
            return rows;
        }
    },
};

// Close database connection pool with graceful drain
export async function closeDatabase() {
    _isShuttingDown = true;
    _stopPoolMonitor();

    logger.info(`[DB] Draining connection pool (${_activeQueries} active queries)...`);

    // Wait for in-flight queries to finish (up to 10 seconds)
    const drainDeadline = Date.now() + 10000;
    while (_activeQueries > 0 && Date.now() < drainDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (_activeQueries > 0) {
        logger.warn(`[DB] Drain timeout — ${_activeQueries} queries still in flight; closing pool`);
    } else {
        logger.info('[DB] All queries drained, closing pool');
    }

    await sql.end();
}

// Graceful shutdown on SIGTERM/SIGINT — stop accepting new queries and drain pool
async function _gracefulDbShutdown(signal) {
    logger.info(`[DB] Received ${signal} — initiating graceful pool drain`);
    await closeDatabase();
}

process.on('SIGTERM', () => _gracefulDbShutdown('SIGTERM').catch(() => {}));
process.on('SIGINT', () => _gracefulDbShutdown('SIGINT').catch(() => {}));

// Close database on process exit
process.on('exit', () => {
    // sql.end() is async but process exit is synchronous — best effort
    sql.end({ timeout: 0 });
});

export default sql;
