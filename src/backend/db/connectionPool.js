// SQLite Connection Pool and Query Profiler
// better-sqlite3 is synchronous, so we implement a simple pool pattern
// with query profiling for performance monitoring

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { logger } from '../shared/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..', '..');
const DB_PATH = process.env.DB_PATH || join(ROOT_DIR, 'data', 'vaultlister.db');
const require = createRequire(import.meta.url);

let DatabaseCtor = null;
function getDatabaseCtor() {
    if (DatabaseCtor) return DatabaseCtor;
    try {
        DatabaseCtor = require('better-sqlite3');
        return DatabaseCtor;
    } catch (error) {
        throw new Error(`Failed to load better-sqlite3: ${error.message}`);
    }
}

// Configuration
const POOL_SIZE = parseInt(process.env.DB_POOL_SIZE || '5');
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD || '100');
const ENABLE_PROFILING = process.env.DB_PROFILING === 'true' || process.env.NODE_ENV !== 'production';

// Query statistics
const queryStats = {
    totalQueries: 0,
    slowQueries: 0,
    errors: 0,
    totalTime: 0,
    queryTimes: new Map(), // query hash -> [times]
};

// Connection pool
class ConnectionPool {
    constructor(dbPath, poolSize) {
        this.dbPath = dbPath;
        this.poolSize = poolSize;
        this.connections = [];
        this.available = [];
        this.waiting = [];
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        const Database = getDatabaseCtor();

        for (let i = 0; i < this.poolSize; i++) {
            const db = new Database(this.dbPath, {
                verbose: ENABLE_PROFILING ? this._logQuery.bind(this) : null
            });

            // Configure for performance
            db.pragma('journal_mode = WAL');
            db.pragma('synchronous = NORMAL');
            db.pragma('cache_size = -64000'); // 64MB cache
            db.pragma('temp_store = MEMORY');
            db.pragma('mmap_size = 268435456'); // 256MB mmap
            db.pragma('busy_timeout = 5000'); // 5s timeout for locked database

            this.connections.push(db);
            this.available.push(db);
        }

        this.initialized = true;
        logger.info(`[ConnectionPool] Initialized with ${this.poolSize} connections`);
    }

    acquire() {
        if (!this.initialized) this.init();

        if (this.available.length > 0) {
            return this.available.pop();
        }

        // If no connections available, use the first one (synchronous fallback)
        return this.connections[0];
    }

    release(connection) {
        if (!this.available.includes(connection)) {
            this.available.push(connection);
        }
    }

    _logQuery(sql) {
        if (!ENABLE_PROFILING) return;

        // Log to structured logger in development
        if (process.env.NODE_ENV !== 'production') {
            logger.info('[ConnectionPool] SQL: ' + sql.substring(0, 100) + (sql.length > 100 ? '...' : ''));
        }
    }

    close() {
        for (const db of this.connections) {
            db.close();
        }
        this.connections = [];
        this.available = [];
        this.initialized = false;
    }

    getStats() {
        return {
            poolSize: this.poolSize,
            availableConnections: this.available.length,
            activeConnections: this.poolSize - this.available.length
        };
    }
}

// Query profiler wrapper
class ProfiledDatabase {
    constructor(pool) {
        this.pool = pool;
    }

    _profile(operation, sql, params, fn) {
        const start = performance.now();
        let result;
        let error = null;

        try {
            result = fn();
        } catch (e) {
            error = e;
            queryStats.errors++;
        } finally {
            const duration = performance.now() - start;
            queryStats.totalQueries++;
            queryStats.totalTime += duration;

            // Track slow queries
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                queryStats.slowQueries++;

                if (ENABLE_PROFILING) {
                    logger.warn(`[ConnectionPool] Slow query ${duration.toFixed(2)}ms: ${sql.substring(0, 200)}`);

                    // Log EXPLAIN for slow queries in development
                    if (process.env.NODE_ENV !== 'production' && sql.trim().toUpperCase().startsWith('SELECT')) {
                        try {
                            const db = this.pool.acquire();
                            const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(params);
                            logger.warn('[ConnectionPool] EXPLAIN: ' + JSON.stringify(plan, null, 2));
                            this.pool.release(db);
                        } catch (e) {
                            // Ignore explain errors
                        }
                    }
                }
            }

            // Track per-query statistics
            const queryHash = this._hashQuery(sql);
            if (!queryStats.queryTimes.has(queryHash)) {
                // Cap the map at 500 distinct query patterns; evict oldest on overflow
                if (queryStats.queryTimes.size >= 500) {
                    queryStats.queryTimes.delete(queryStats.queryTimes.keys().next().value);
                }
                queryStats.queryTimes.set(queryHash, { sql: sql.substring(0, 120), times: [] });
            }
            const stats = queryStats.queryTimes.get(queryHash);
            stats.times.push(duration);

            // Keep only last 100 samples per query
            if (stats.times.length > 100) {
                stats.times.shift();
            }
        }

        if (error) throw error;
        return result;
    }

    _hashQuery(sql) {
        // Normalize parameter values so 'WHERE id = uuid-A' and 'WHERE id = uuid-B'
        // map to the same key. Without this, the queryTimes Map grows with every
        // distinct UUID/value, causing an unbounded memory leak.
        return sql
            .replace(/'[^']*'/g, '?')        // string literals → ?
            .replace(/\b0x[0-9a-fA-F]+\b/g, '?') // hex literals → ?
            .replace(/\b\d+(\.\d+)?\b/g, '?') // numeric literals → ?
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 120);
    }

    get(sql, params = []) {
        return this._profile('get', sql, params, () => {
            const db = this.pool.acquire();
            try {
                const stmt = db.prepare(sql);
                return params.length > 0 ? stmt.get(...params) : stmt.get();
            } finally {
                this.pool.release(db);
            }
        });
    }

    all(sql, params = []) {
        return this._profile('all', sql, params, () => {
            const db = this.pool.acquire();
            try {
                const stmt = db.prepare(sql);
                return params.length > 0 ? stmt.all(...params) : stmt.all();
            } finally {
                this.pool.release(db);
            }
        });
    }

    run(sql, params = []) {
        return this._profile('run', sql, params, () => {
            const db = this.pool.acquire();
            try {
                const stmt = db.prepare(sql);
                return params.length > 0 ? stmt.run(...params) : stmt.run();
            } finally {
                this.pool.release(db);
            }
        });
    }

    exec(sql) {
        return this._profile('exec', sql, [], () => {
            const db = this.pool.acquire();
            try {
                return db.exec(sql);
            } finally {
                this.pool.release(db);
            }
        });
    }

    transaction(fn) {
        const db = this.pool.acquire();
        try {
            const transaction = db.transaction(fn);
            return transaction();
        } finally {
            this.pool.release(db);
        }
    }

    // Get profiling statistics
    getProfilingStats() {
        const topSlowQueries = Array.from(queryStats.queryTimes.entries())
            .map(([hash, data]) => ({
                query: data.sql,
                avgMs: (data.times.reduce((a, b) => a + b, 0) / data.times.length).toFixed(2),
                maxMs: Math.max(...data.times).toFixed(2),
                count: data.times.length
            }))
            .sort((a, b) => parseFloat(b.avgMs) - parseFloat(a.avgMs))
            .slice(0, 10);

        return {
            totalQueries: queryStats.totalQueries,
            slowQueries: queryStats.slowQueries,
            slowQueryPercentage: ((queryStats.slowQueries / queryStats.totalQueries) * 100 || 0).toFixed(2) + '%',
            errors: queryStats.errors,
            avgQueryTimeMs: (queryStats.totalTime / queryStats.totalQueries || 0).toFixed(2),
            totalTimeMs: queryStats.totalTime.toFixed(2),
            topSlowQueries,
            pool: this.pool.getStats()
        };
    }

    // Reset profiling statistics
    resetProfilingStats() {
        queryStats.totalQueries = 0;
        queryStats.slowQueries = 0;
        queryStats.errors = 0;
        queryStats.totalTime = 0;
        queryStats.queryTimes.clear();
    }
}

// Create singleton instances
const pool = new ConnectionPool(DB_PATH, POOL_SIZE);
const profiledDb = new ProfiledDatabase(pool);

export { pool, profiledDb, queryStats };
export default profiledDb;
