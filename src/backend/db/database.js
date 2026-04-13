// Database connection and utilities for VaultLister — PostgreSQL adapter (Phase 1)
import postgres from 'postgres';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { seedHelpContent } from './seeds/helpContent.js';
import { seedDemoData } from './seeds/demoData.js';
import { seedBrandSizeGuides } from '../routes/sizeCharts.js';
import { logger } from '../shared/logger.js';

// ─── Query performance metrics ───────────────────────────────────────────────

const SLOW_QUERY_THRESHOLD_MS = 1000;
const METRICS_RETENTION_MS = 60 * 60 * 1000; // 1 hour

// In-memory circular log of recent query executions (pruned on each write)
const queryLog = [];

// Extract the SQL operation (SELECT/INSERT/…) and primary table name from a SQL string
function extractQueryInfo(sqlStr) {
    const trimmed = sqlStr.trim();
    const operation = (trimmed.split(/\s+/)[0] || 'UNKNOWN').toUpperCase();
    let table = 'unknown';
    const tableMatch = trimmed.match(/\b(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (tableMatch) table = tableMatch[1].toLowerCase();
    return { operation, table };
}

function recordQueryMetric(sqlStr, duration, requestId) {
    const { operation, table } = extractQueryInfo(sqlStr);
    queryLog.push({ sql: sqlStr.substring(0, 200), duration, table, operation, requestId: requestId || null, timestamp: Date.now() });
    // Prune entries older than the retention window
    const cutoff = Date.now() - METRICS_RETENTION_MS;
    while (queryLog.length > 0 && queryLog[0].timestamp < cutoff) queryLog.shift();
}

/**
 * Returns aggregated query performance data for the last hour.
 * Exported for use by the /api/metrics/queries admin endpoint and tests.
 */
export function getQueryMetrics() {
    const cutoff = Date.now() - METRICS_RETENTION_MS;
    const recent = queryLog.filter(r => r.timestamp >= cutoff);

    const slowest = [...recent]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map(({ sql, duration, table, operation, requestId }) => ({ sql, duration, table, operation, requestId }));

    const byPattern = new Map();
    for (const r of recent) {
        if (!byPattern.has(r.sql)) {
            byPattern.set(r.sql, { operation: r.operation, table: r.table, count: 0, totalDuration: 0 });
        }
        const entry = byPattern.get(r.sql);
        entry.count++;
        entry.totalDuration += r.duration;
    }
    const avgByPattern = [...byPattern.entries()]
        .map(([sql, s]) => ({ sql, operation: s.operation, table: s.table, count: s.count, avgDuration: Math.round(s.totalDuration / s.count * 100) / 100 }))
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, 10);

    const byTable = {};
    for (const r of recent) {
        byTable[r.table] = (byTable[r.table] || 0) + 1;
    }

    return { slowest, avgByPattern, byTable, totalQueries: recent.length, period: '1h' };
}

/** Clears the in-memory query log — intended for test isolation only. */
export function _resetQueryMetrics() {
    queryLog.length = 0;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const POOL_MAX = 25;
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

function _startPoolMonitor() {
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
                utilizationPct: Math.round(utilizationRatio * 100)
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

// Convert ? positional params to $1, $2, ... for postgres.js
// Skips ? inside single-quoted string literals
function convertPlaceholders(sqlStr) {
    let index = 0;
    let result = '';
    let inString = false;
    for (let i = 0; i < sqlStr.length; i++) {
        const ch = sqlStr[i];
        if (ch === "'" && !inString) { inString = true; result += ch; }
        else if (ch === "'" && inString) { inString = false; result += ch; }
        else if (ch === '?' && !inString) { result += '$' + (++index); }
        else { result += ch; }
    }
    return result;
}

// Normalize SQL boolean literals (TRUE/FALSE) to integers (1/0) for INTEGER columns.
// PostgreSQL rejects `= TRUE` on INTEGER columns ("operator does not exist: integer = boolean").
// Skips replacements inside single-quoted string literals.
function normalizeSqlBooleans(sqlStr) {
    let result = '';
    let inString = false;
    let i = 0;
    while (i < sqlStr.length) {
        if (!inString && sqlStr[i] === "'") {
            inString = true;
            result += sqlStr[i++];
        } else if (inString && sqlStr[i] === "'") {
            inString = false;
            result += sqlStr[i++];
        } else if (!inString) {
            const sub = sqlStr.slice(i);
            const m = sub.match(/^((?:!=|<>|=)\s*)(TRUE|FALSE)\b/i);
            if (m) {
                result += m[1] + (m[2].toUpperCase() === 'TRUE' ? '1' : '0');
                i += m[0].length;
            } else {
                result += sqlStr[i++];
            }
        } else {
            result += sqlStr[i++];
        }
    }
    return result;
}

// Chain placeholder conversion and boolean normalization
function prepareSQL(sqlStr) {
    return normalizeSqlBooleans(convertPlaceholders(sqlStr));
}

// SQL identifier validation — prevents injection via dynamic column/table names
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function validateIdentifier(name) {
    if (!VALID_IDENTIFIER.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
    return name;
}

// Escape ILIKE wildcards for safe use in ILIKE clauses (use with ESCAPE '\\')
export function escapeLike(str) {
    return String(str).replace(/[%_\\]/g, '\\$&');
}

export function getStatementCacheStats() {
    return { poolSize: sql.options.max, idleConnections: sql.options.idle_timeout };
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
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                throw err;
            }
        }
    },

    // Full-text search on inventory — ILIKE fallback. tsvector indexes are defined in pg-schema.sql; query wiring deferred to post-launch.
    async searchInventory(searchTerm, userId, limit = 50) {
        const term = `%${searchTerm}%`;
        const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
        const rows = await sql`SELECT * FROM inventory WHERE user_id = ${userId} AND (title ILIKE ${term} OR description ILIKE ${term}) LIMIT ${safeLimit}`;
        return rows;
    }
};

// Model helpers for common operations
export const models = {
    async create(table, data) {
        validateIdentifier(table);
        const keys = Object.keys(data);
        keys.forEach(validateIdentifier);
        const values = Object.values(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sqlStr = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        return await query.run(sqlStr, values);
    },

    async findById(table, id) {
        validateIdentifier(table);
        return await query.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    },

    async findOne(table, conditions) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
        return await query.get(`SELECT * FROM ${table} WHERE ${where}`, values);
    },

    async findMany(table, conditions = {}, options = {}) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        let sqlStr = `SELECT * FROM ${table}`;

        if (keys.length > 0) {
            const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
            sqlStr += ` WHERE ${where}`;
        }

        if (options.orderBy) {
            const orderParts = options.orderBy.split(',').map(s => s.trim());
            for (const part of orderParts) {
                const [col, dir] = part.split(/\s+/);
                validateIdentifier(col);
                if (dir && !['ASC', 'DESC', 'asc', 'desc'].includes(dir)) {
                    throw new Error(`Invalid ORDER BY direction: ${dir}`);
                }
            }
            sqlStr += ` ORDER BY ${options.orderBy}`;
        }

        if (options.limit) {
            sqlStr += ` LIMIT ${parseInt(options.limit, 10)}`;
        }

        if (options.offset) {
            sqlStr += ` OFFSET ${parseInt(options.offset, 10)}`;
        }

        return await query.all(sqlStr, values);
    },

    async update(table, id, data) {
        validateIdentifier(table);
        const keys = Object.keys(data);
        keys.forEach(validateIdentifier);
        const values = Object.values(data);
        const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const sqlStr = `UPDATE ${table} SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1}`;
        return await query.run(sqlStr, [...values, id]);
    },

    async delete(table, id) {
        validateIdentifier(table);
        return await query.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    },

    async count(table, conditions = {}) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        let sqlStr = `SELECT COUNT(*) as count FROM ${table}`;

        if (keys.length > 0) {
            const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
            sqlStr += ` WHERE ${where}`;
        }

        const row = await query.get(sqlStr, values);
        return row?.count || 0;
    }
};

// Migration system — PostgreSQL consolidated schema + incremental pg/ migrations
async function runMigrations() {
    try {
        // Create migrations table if it doesn't exist
        await query.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Step 1: Apply consolidated pg-schema.sql as migration 001
        const schemaName = '001_pg_schema.sql';
        const schemaApplied = await query.get('SELECT id FROM migrations WHERE name = ?', [schemaName]);

        if (!schemaApplied) {
            const schemaPath = join(__dirname, 'pg-schema.sql');
            if (!existsSync(schemaPath)) {
                throw new Error('pg-schema.sql not found — cannot initialize database');
            }

            logger.info('  Applying consolidated PostgreSQL schema (pg-schema.sql)...');
            const schemaSQL = readFileSync(schemaPath, 'utf-8');

            await query.exec(schemaSQL);
            await query.run('INSERT INTO migrations (name) VALUES (?)', [schemaName]);

            logger.info('  Applied consolidated PostgreSQL schema');
        }

        // Step 2: Apply incremental migrations from migrations/pg/ directory
        const pgMigrationsDir = join(__dirname, 'migrations', 'pg');
        if (existsSync(pgMigrationsDir)) {
            const pgFiles = readdirSync(pgMigrationsDir)
                .filter(f => f.endsWith('.sql'))
                .sort();

            for (const migrationFile of pgFiles) {
                const applied = await query.get('SELECT id FROM migrations WHERE name = ?', [migrationFile]);

                if (!applied) {
                    const migrationPath = join(pgMigrationsDir, migrationFile);
                    try {
                        logger.info(`  Running migration: ${migrationFile}`);
                        const migrationSQL = readFileSync(migrationPath, 'utf-8');

                        await query.transaction(async (tx) => {
                            await tx.exec(migrationSQL);
                            await tx.run('INSERT INTO migrations (name) VALUES (?)', [migrationFile]);
                        });

                        logger.info(`  Applied migration: ${migrationFile}`);
                    } catch (migrationError) {
                        const errorMsg = migrationError.message || '';
                        if (errorMsg.includes('already exists') ||
                            errorMsg.includes('duplicate column') ||
                            errorMsg.includes('unique constraint')) {
                            await query.run('INSERT INTO migrations (name) VALUES (?) ON CONFLICT (name) DO NOTHING', [migrationFile]);
                            logger.info(`  Migration ${migrationFile} skipped (schema mismatch: ${errorMsg.slice(0, 60)})`);
                        } else {
                            throw migrationError;
                        }
                    }
                }
            }
        }
    } catch (error) {
        logger.error('Migration error:', error);
        throw error;
    }
}

// Initialize schema if needed
export async function initializeDatabase() {
    try {
        // Test connection
        await sql.unsafe('SELECT 1');
        logger.info('✓ PostgreSQL connection established');

        // Start pool utilization monitor
        _startPoolMonitor();

        // Run migrations
        await runMigrations();

        // Seed help content
        await seedHelpContent();

        // Seed demo data (inventory, orders, listings) — skip in production
        if (process.env.NODE_ENV !== 'production') {
            await seedDemoData();
        }

        // Seed brand size guides
        await seedBrandSizeGuides();

        logger.info('✓ Database initialized successfully');
        return true;
    } catch (error) {
        logger.error('Database initialization error:', error);
        throw error;
    }
}

// Cleanup expired data (tokens, sessions, etc.)
export async function cleanupExpiredData() {
    const tables = [
        { name: 'verification_tokens', condition: "expires_at < NOW() OR used_at IS NOT NULL" },
        { name: 'oauth_states', condition: "expires_at < NOW()" },
        { name: 'email_oauth_states', condition: "expires_at < NOW()" },
        { name: 'sms_codes', condition: "expires_at < NOW()" },
        { name: 'sessions', condition: "expires_at < NOW()" },
        { name: 'webhook_events', condition: "created_at < NOW() - INTERVAL '30 days'" },
        { name: 'automation_logs', condition: "created_at < NOW() - INTERVAL '30 days'" },
        { name: 'security_logs', condition: "created_at < NOW() - INTERVAL '90 days'" },
        { name: 'email_queue', condition: "(status = 'sent' AND created_at < NOW() - INTERVAL '30 days') OR (status = 'failed' AND created_at < NOW() - INTERVAL '7 days')" },
        { name: 'team_invitations', condition: "status = 'expired' OR expires_at < NOW() - INTERVAL '30 days'" },
        { name: 'request_logs', condition: "created_at < NOW() - INTERVAL '30 days'" },
        { name: 'audit_logs', condition: "created_at < NOW() - INTERVAL '1 year'" },
        { name: 'push_notification_log', condition: "created_at < NOW() - INTERVAL '30 days'" }
    ];

    const results = {};
    let totalDeleted = 0;

    for (const table of tables) {
        try {
            // Check if table exists (PostgreSQL equivalent of information_schema.tables)
            const tableExists = await query.get(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ?",
                [table.name]
            );

            if (!tableExists) {
                results[table.name] = 0;
                continue;
            }

            const sqlStr = `DELETE FROM ${table.name} WHERE ${table.condition}`;
            const result = await query.run(sqlStr);
            const deletedCount = result.changes || 0;
            results[table.name] = deletedCount;
            totalDeleted += deletedCount;
        } catch (error) {
            logger.error(`Cleanup error for ${table.name}:`, error.message);
            results[table.name] = 0;
        }
    }

    if (totalDeleted > 0) {
        logger.info(`✓ Cleaned up ${totalDeleted} expired records:`, results);
    }

    // Refresh statistics (PostgreSQL equivalent of PRAGMA optimize)
    await query.exec('ANALYZE');

    return results;
}

// Close database connection pool with graceful drain
export async function closeDatabase() {
    _isShuttingDown = true;
    _stopPoolMonitor();

    logger.info(`[DB] Draining connection pool (${_activeQueries} active queries)...`);

    // Wait for in-flight queries to finish (up to 10 seconds)
    const drainDeadline = Date.now() + 10000;
    while (_activeQueries > 0 && Date.now() < drainDeadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
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
