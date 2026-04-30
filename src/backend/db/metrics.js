import { logger } from '../shared/logger.js';

// ─── Query performance metrics ───────────────────────────────────────────────

export const SLOW_QUERY_THRESHOLD_MS = 1000;
const METRICS_RETENTION_MS = 60 * 60 * 1000; // 1 hour

// In-memory circular log of recent query executions (pruned on each write)
const queryLog = [];

// Extract the SQL operation (SELECT/INSERT/…) and primary table name from a SQL string
export function extractQueryInfo(sqlStr) {
    const trimmed = sqlStr.trim();
    const operation = (trimmed.split(/\s+/)[0] || 'UNKNOWN').toUpperCase();
    let table = 'unknown';
    const tableMatch = trimmed.match(/\b(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (tableMatch) table = tableMatch[1].toLowerCase();
    return { operation, table };
}

export function recordQueryMetric(sqlStr, duration, requestId) {
    const { operation, table } = extractQueryInfo(sqlStr);
    queryLog.push({
        sql: sqlStr.substring(0, 200),
        duration,
        table,
        operation,
        requestId: requestId || null,
        timestamp: Date.now(),
    });
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
    const recent = queryLog.filter((r) => r.timestamp >= cutoff);

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
        .map(([sql, s]) => ({
            sql,
            operation: s.operation,
            table: s.table,
            count: s.count,
            avgDuration: Math.round((s.totalDuration / s.count) * 100) / 100,
        }))
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
