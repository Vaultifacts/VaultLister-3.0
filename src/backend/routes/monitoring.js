// Monitoring Routes
// Provides health checks, metrics, and observability endpoints

import { monitor, healthChecker, securityMonitor } from '../services/monitoring.js';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

export async function monitoringRouter(ctx) {
    const { method, path, user } = ctx;

    // GET /api/health - Basic health check (public)
    if (method === 'GET' && path === '/health') {
        try {
            // Quick DB check
            const dbCheck = query.get('SELECT 1 as ok');

            return {
                status: 200,
                data: {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
        } catch (error) {
            return {
                status: 503,
                data: {
                    status: 'unhealthy',
                    error: 'Database unavailable'
                }
            };
        }
    }

    // GET /api/health/detailed - Detailed health check (authenticated)
    if (method === 'GET' && path === '/health/detailed') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        const results = await healthChecker.runAll();
        const statusCode = results.status === 'healthy' ? 200 : 503;

        return { status: statusCode, data: results };
    }

    // GET /api/metrics - Performance metrics (admin only)
    if (method === 'GET' && path === '/metrics') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (user.subscription_tier !== 'enterprise') {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        const stats = monitor.getStats();
        return { status: 200, data: stats };
    }

    // GET /api/metrics/prometheus - Prometheus format metrics (admin only)
    if (method === 'GET' && path === '/metrics/prometheus') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (user.subscription_tier !== 'enterprise') {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        const stats = monitor.getStats();
        let prometheus = '';

        // Format metrics for Prometheus
        prometheus += '# HELP http_requests_total Total HTTP requests\n';
        prometheus += '# TYPE http_requests_total counter\n';
        prometheus += `http_requests_total ${stats.summary.totalRequests}\n\n`;

        prometheus += '# HELP http_errors_total Total HTTP errors\n';
        prometheus += '# TYPE http_errors_total counter\n';
        prometheus += `http_errors_total ${stats.summary.totalErrors}\n\n`;

        prometheus += '# HELP http_response_time_avg Average response time in ms\n';
        prometheus += '# TYPE http_response_time_avg gauge\n';
        prometheus += `http_response_time_avg ${parseFloat(stats.summary.avgResponseTime) || 0}\n\n`;

        // Per-endpoint metrics
        for (const endpoint of stats.endpoints) {
            const label = endpoint.endpoint.replace(/[^a-zA-Z0-9_]/g, '_');
            prometheus += `http_endpoint_requests{endpoint="${label}"} ${endpoint.requests}\n`;
            prometheus += `http_endpoint_errors{endpoint="${label}"} ${endpoint.errors}\n`;
        }

        return {
            status: 200,
            data: prometheus,
            headers: { 'Content-Type': 'text/plain' }
        };
    }

    // GET /api/security/events - Security event summary (admin only)
    if (method === 'GET' && path === '/security/events') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (user.subscription_tier !== 'enterprise') {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        const summary = securityMonitor.getSummary();

        // Get recent security logs
        const recentLogs = query.all(`
            SELECT event_type, ip_or_user, details, created_at
            FROM security_logs
            WHERE created_at > datetime('now', '-24 hours')
            ORDER BY created_at DESC
            LIMIT 100
        `);

        return {
            status: 200,
            data: {
                counters: summary,
                recentEvents: recentLogs
            }
        };
    }

    // GET /api/alerts - Get recent alerts (authenticated)
    if (method === 'GET' && path === '/alerts') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        try {
            const alerts = query.all(`
                SELECT id, alert_type, data, created_at, acknowledged, acknowledged_at, acknowledged_by
                FROM alerts
                WHERE created_at > datetime('now', '-7 days')
                ORDER BY created_at DESC
                LIMIT 50
            `);

            return {
                status: 200,
                data: {
                    alerts: alerts.map(a => ({
                        ...a,
                        data: JSON.parse(a.data || '{}')
                    }))
                }
            };
        } catch (error) {
            if (error.message && error.message.includes('no such table')) {
                return { status: 200, data: { alerts: [] } };
            }
            logger.error('[Monitoring] GET /alerts error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch alerts' } };
        }
    }

    // POST /api/alerts/:id/acknowledge - Acknowledge an alert
    if (method === 'POST' && path.match(/^\/alerts\/[^/]+\/acknowledge$/)) {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        const alertId = path.split('/')[2];

        try {
            query.run(`
                UPDATE alerts
                SET acknowledged = 1, acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = ?
                WHERE id = ?
            `, [user.id, alertId]);

            return {
                status: 200,
                data: { success: true, message: 'Alert acknowledged' }
            };
        } catch (error) {
            return { status: 500, data: { error: 'Failed to acknowledge alert' } };
        }
    }

    // GET /api/errors - Get recent errors (authenticated)
    if (method === 'GET' && path === '/errors') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        try {
            const errors = query.all(`
                SELECT id, error_type, message, context, created_at
                FROM error_logs
                WHERE created_at > datetime('now', '-24 hours')
                ORDER BY created_at DESC
                LIMIT 100
            `);

            return {
                status: 200,
                data: {
                    errors: errors.map(e => ({
                        ...e,
                        context: JSON.parse(e.context || '{}')
                    }))
                }
            };
        } catch (error) {
            if (error.message && error.message.includes('no such table')) {
                return { status: 200, data: { errors: [] } };
            }
            logger.error('[Monitoring] GET /errors error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch errors' } };
        }
    }

    // POST /api/monitoring/rum - Receive batched RUM metrics (public)
    if (method === 'POST' && path === '/rum') {
        try {
            const { metrics: clientMetrics, sessionId } = ctx.body || {};
            if (!sessionId || typeof sessionId !== 'string') {
                return { status: 400, data: { error: 'sessionId is required' } };
            }
            if (!clientMetrics || !Array.isArray(clientMetrics) || clientMetrics.length === 0) {
                return { status: 400, data: { error: 'metrics array is required and must not be empty' } };
            }

            const VALID_METRICS = ['LCP', 'FID', 'INP', 'CLS', 'FCP', 'TTFB', 'JS_ERROR', 'UNHANDLED_REJECTION', 'PAGE_NAV', 'PAGE_LOAD'];
            const batch = clientMetrics.slice(0, 50);
            let accepted = 0;

            for (const m of batch) {
                if (!m.name || typeof m.value !== 'number') continue;
                if (!VALID_METRICS.includes(m.name)) continue;

                try {
                    query.run(
                        `INSERT INTO rum_metrics (id, user_id, session_id, metric_name, metric_value, page_url, user_agent, connection_type, metadata)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            crypto.randomUUID(),
                            user?.id || null,
                            sessionId,
                            m.name,
                            m.value,
                            (m.url || '').slice(0, 500),
                            (m.userAgent || '').slice(0, 300),
                            m.connectionType || null,
                            JSON.stringify(m.metadata || {})
                        ]
                    );
                    accepted++;
                } catch (insertErr) {
                    // Skip individual metric insert failures (table may not exist yet)
                    if (insertErr.message?.includes('no such table')) {
                        return { status: 200, data: { accepted: 0, note: 'RUM table not yet created' } };
                    }
                }
            }

            return { status: 200, data: { accepted } };
        } catch (error) {
            logger.error('[Monitoring] POST /rum error', null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to store RUM metrics' } };
        }
    }

    // GET /api/monitoring/rum/summary - Aggregated RUM stats (admin only)
    if (method === 'GET' && path === '/rum/summary') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (user.subscription_tier !== 'enterprise') {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        try {
            const period = ctx.query?.period || '24h';
            const hoursMap = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 };
            const hours = hoursMap[period] || 24;

            const metrics = query.all(`
                SELECT
                    metric_name,
                    COUNT(*) as sample_count,
                    ROUND(AVG(metric_value), 2) as avg_value,
                    ROUND(MIN(metric_value), 2) as min_value,
                    ROUND(MAX(metric_value), 2) as max_value
                FROM rum_metrics
                WHERE timestamp > datetime('now', '-${hours} hours')
                GROUP BY metric_name
                ORDER BY metric_name
            `);

            // Get percentiles per metric
            const summary = {};
            for (const m of metrics) {
                const values = query.all(`
                    SELECT metric_value FROM rum_metrics
                    WHERE metric_name = ? AND timestamp > datetime('now', '-${hours} hours')
                    ORDER BY metric_value
                `, [m.metric_name]).map(r => r.metric_value);

                const p50 = values[Math.floor(values.length * 0.50)] || 0;
                const p75 = values[Math.floor(values.length * 0.75)] || 0;
                const p95 = values[Math.floor(values.length * 0.95)] || 0;
                const p99 = values[Math.floor(values.length * 0.99)] || 0;

                summary[m.metric_name] = {
                    count: m.sample_count,
                    avg: m.avg_value,
                    min: m.min_value,
                    max: m.max_value,
                    p50: Math.round(p50 * 100) / 100,
                    p75: Math.round(p75 * 100) / 100,
                    p95: Math.round(p95 * 100) / 100,
                    p99: Math.round(p99 * 100) / 100
                };
            }

            const uniqueSessions = query.get(`
                SELECT COUNT(DISTINCT session_id) as count FROM rum_metrics
                WHERE timestamp > datetime('now', '-${hours} hours')
            `);

            return {
                status: 200,
                data: {
                    period,
                    sessions: uniqueSessions?.count || 0,
                    metrics: summary
                }
            };
        } catch (error) {
            if (error.message?.includes('no such table')) {
                return { status: 200, data: { period: '24h', sessions: 0, metrics: {} } };
            }
            logger.error('[Monitoring] GET /rum/summary error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch RUM summary' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
