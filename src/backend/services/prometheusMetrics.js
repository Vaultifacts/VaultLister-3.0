import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

const register = new Registry();

register.setDefaultLabels({
    app: 'vaultlister',
    env: process.env.NODE_ENV || 'development'
});

collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [register]
});

export const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register]
});

export const logEntriesTotal = new Counter({
    name: 'log_entries_total',
    help: 'Total log entries by level',
    labelNames: ['level'],
    registers: [register]
});

export const activeWebsockets = new Gauge({
    name: 'websocket_connections_active',
    help: 'Active WebSocket connections',
    registers: [register]
});

export const dbQueryDuration = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration in seconds',
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register]
});

export const backgroundJobsTotal = new Counter({
    name: 'background_jobs_total',
    help: 'Total background jobs processed',
    labelNames: ['type', 'status'],
    registers: [register]
});

/**
 * Record an HTTP request completion. Call from logRequestComplete.
 * route is the API prefix (e.g. /api/inventory), not the full path, to avoid label cardinality explosion.
 */
export function recordHttpRequest(method, route, status, durationSeconds) {
    const labels = { method, route, status: String(status) };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
}

export { register };
