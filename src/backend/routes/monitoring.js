// Monitoring Routes
// Provides health checks, metrics, and observability endpoints
// Anti-detection diagnostic: GET /api/monitoring/anti-detection (admin only)
// Deploy trigger: 2026-04-17T22 — Wait-for-CI disabled

import { monitor, healthChecker, securityMonitor } from '../services/monitoring.js';
import { query, getQueryMetrics } from '../db/database.js';
import { logger } from '../shared/logger.js';
import websocketService from '../services/websocket.js';
import { applyRateLimit } from '../middleware/rateLimiter.js';
import { safeJsonParse } from '../shared/utils.js';

const pkg = { version: process.env.npm_package_version || '1.6.0' };

export async function monitoringRouter(ctx) {
    const { method, path, user } = ctx;

    // GET /api/health - Basic health check (public)
    if (method === 'GET' && path === '/health') {
        try {
            // Quick DB check
            const dbCheck = await query.get('SELECT 1 as ok');

            return {
                status: 200,
                data: {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    version: pkg.version
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

    // NOTE: GET /api/health/detailed is handled as a static route in server.js
    // (unauthenticated, for external uptime monitors). Do not add an auth-guarded
    // version here — the server.js entry will always match first.

    // GET /api/metrics - Performance metrics (admin only)
    if (method === 'GET' && path === '/metrics') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (!user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        const stats = monitor.getStats();
        return { status: 200, data: { ...stats, websocket: websocketService.getStats() } };
    }

    // GET /api/metrics/prometheus - Prometheus format metrics (admin only)
    if (method === 'GET' && path === '/metrics/prometheus') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (!user.is_admin) {
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

    // GET /api/metrics/queries - Database query performance metrics (admin only)
    if (method === 'GET' && path === '/metrics/queries') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (!user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        return { status: 200, data: getQueryMetrics() };
    }

    // GET /api/monitoring/anti-detection - Anti-detection system diagnostic (admin only)
    if (method === 'GET' && path === '/anti-detection') {
        if (!user) return { status: 401, data: { error: 'Authentication required' } };
        if (!user.is_admin) return { status: 403, data: { error: 'Admin access required' } };

        const checks = [];
        const check = (name, status, detail) => checks.push({ name, status, detail });

        try {
            const fs = await import('fs');
            const pathMod = await import('path');
            const dataDir = pathMod.default.join(process.cwd(), 'data');

            // Profile system
            const profilesPath = pathMod.default.join(dataDir, '.browser-profiles', 'profiles.json');
            if (fs.default.existsSync(profilesPath)) {
                const profiles = JSON.parse(fs.default.readFileSync(profilesPath, 'utf8'));
                check('profiles', 'pass', `${profiles.length} profiles`);
                const withBehavior = profiles.filter(p => p.behavior).length;
                check('behavioral_params', withBehavior === profiles.length ? 'pass' : 'warn', `${withBehavior}/${profiles.length} have params`);
                const withProxy = profiles.filter(p => p.proxyUrl).length;
                check('per_profile_proxy', withProxy > 0 ? 'pass' : 'warn', `${withProxy}/${profiles.length} have dedicated proxy`);
            } else {
                check('profiles', 'warn', 'Not initialized yet');
            }

            // Cooldown status
            const cooldownPath = pathMod.default.join(dataDir, '.fb-cooldown.json');
            if (fs.default.existsSync(cooldownPath)) {
                const cd = JSON.parse(fs.default.readFileSync(cooldownPath, 'utf8'));
                if (cd.quarantined) check('cooldown', 'fail', 'QUARANTINED');
                else if (cd.cooldownUntil && new Date(cd.cooldownUntil) > new Date()) check('cooldown', 'warn', `Active until ${cd.cooldownUntil}`);
                else check('cooldown', 'pass', `${cd.events?.length || 0} events in window`);
            } else {
                check('cooldown', 'pass', 'Clean — no cooldown file');
            }

            // Rate limits
            const { RATE_LIMITS } = await import('../../../worker/bots/rate-limits.js');
            check('rate_limits', 'pass', `FB: ${RATE_LIMITS.facebook.maxListingsPerDay}/day, ${RATE_LIMITS.facebook.maxLoginsPerDay} logins`);

            // Platform
            check('platform', process.platform === 'linux' ? 'pass' : 'warn', `${process.platform} (Camoufox needs Linux)`);

        } catch (err) {
            check('diagnostic_error', 'fail', err.message);
        }

        const passes = checks.filter(c => c.status === 'pass').length;
        const warns = checks.filter(c => c.status === 'warn').length;
        const fails = checks.filter(c => c.status === 'fail').length;

        return { status: 200, data: { checks, summary: { passes, warns, fails } } };
    }

    // GET /api/security/events - Security event summary (admin only)
    if (method === 'GET' && path === '/security/events') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (!user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        const summary = securityMonitor.getSummary();

        // Get recent security logs
        const recentLogs = await query.all(`
            SELECT event_type, ip_or_user, details, created_at
            FROM security_logs
            WHERE created_at > NOW() - INTERVAL '24 hours'
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

    // GET /api/alerts - Get recent alerts (admin only)
    if (method === 'GET' && path === '/alerts') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (!user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        try {
            const alerts = await query.all(`
                SELECT id, type AS alert_type, data, created_at, acknowledged, acknowledged_at, acknowledged_by
                FROM alerts
                WHERE created_at > NOW() - INTERVAL '7 days'
                ORDER BY created_at DESC
                LIMIT 50
            `);

            return {
                status: 200,
                data: {
                    alerts: alerts.map(a => ({
                        ...a,
                        data: safeJsonParse(a.data, {})
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

    // POST /api/alerts/:id/acknowledge - Acknowledge an alert (admin only)
    if (method === 'POST' && path.match(/^\/alerts\/[^/]+\/acknowledge$/)) {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (!user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        const alertId = path.split('/')[2];

        try {
            await query.run(`
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

    // GET /api/errors - Get recent errors (admin only)
    if (method === 'GET' && path === '/errors') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (!user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        try {
            const errors = await query.all(`
                SELECT id, error_type, message, context, created_at
                FROM error_logs
                WHERE created_at > NOW() - INTERVAL '24 hours'
                ORDER BY created_at DESC
                LIMIT 100
            `);

            return {
                status: 200,
                data: {
                    errors: errors.map(e => ({
                        ...e,
                        context: safeJsonParse(e.context, {})
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
        const rateLimitError = await applyRateLimit(ctx, 'default');
        if (rateLimitError) return rateLimitError;

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
                    await query.run(
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
        if (!user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        try {
            const period = ctx.query?.period || '24h';
            const hoursMap = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 };
            const hours = hoursMap[period] || 24;

            const metrics = await query.all(`
                SELECT
                    metric_name,
                    COUNT(*) as sample_count,
                    ROUND(AVG(metric_value), 2) as avg_value,
                    ROUND(MIN(metric_value), 2) as min_value,
                    ROUND(MAX(metric_value), 2) as max_value
                FROM rum_metrics
                WHERE timestamp > NOW() + (?::text || ' hours')::interval
                GROUP BY metric_name
                ORDER BY metric_name
            `, [-hours]);

            // Get percentiles per metric
            const summary = {};
            for (const m of metrics) {
                const values = await query.all(`
                    SELECT metric_value FROM rum_metrics
                    WHERE metric_name = ? AND timestamp > NOW() + (?::text || ' hours')::interval
                    ORDER BY metric_value
                `, [m.metric_name, -hours]).map(r => r.metric_value);

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

            const uniqueSessions = await query.get(`
                SELECT COUNT(DISTINCT session_id) as count FROM rum_metrics
                WHERE timestamp > NOW() + (?::text || ' hours')::interval
            `, [-hours]);

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

    // GET /api/monitoring/poshmark - Latest Poshmark closet activity snapshot
    if (method === 'GET' && path === '/poshmark') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        try {
            const latest = await query.get(
                `SELECT * FROM poshmark_monitoring_log
                 WHERE user_id = ?
                 ORDER BY checked_at DESC
                 LIMIT 1`,
                [user.id]
            );

            const history = await query.all(
                `SELECT id, total_listings, total_shares, total_likes, active_offers, recent_sales, closet_value, checked_at
                 FROM poshmark_monitoring_log
                 WHERE user_id = ?
                 ORDER BY checked_at DESC
                 LIMIT 48`,
                [user.id]
            );

            return {
                status: 200,
                data: {
                    latest: latest || null,
                    history,
                    hasData: !!latest
                }
            };
        } catch (error) {
            if (error.message?.includes('no such table')) {
                return { status: 200, data: { latest: null, history: [], hasData: false } };
            }
            logger.error('[Monitoring] GET /poshmark error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch Poshmark monitoring data' } };
        }
    }

    // POST /api/monitoring/poshmark/check - Queue an on-demand monitoring check
    if (method === 'POST' && path === '/poshmark/check') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        try {
            const { queueTask } = await import('../workers/taskWorker.js');

            // Throttle: one manual check per 5 minutes
            const recent = await query.get(
                `SELECT id FROM task_queue
                 WHERE type = 'poshmark_monitoring'
                   AND payload::jsonb->>'userId' = ?
                   AND created_at > NOW() - INTERVAL '5 minutes'
                 LIMIT 1`,
                [user.id]
            );
            if (recent) {
                return { status: 429, data: { error: 'Please wait 5 minutes between manual checks' } };
            }

            const task = queueTask('poshmark_monitoring', { userId: user.id }, { priority: 1 });
            return { status: 202, data: { taskId: task.id, status: 'queued', message: 'Monitoring check queued' } };
        } catch (error) {
            logger.error('[Monitoring] POST /poshmark/check error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to queue monitoring check' } };
        }
    }

    // GET /api/monitoring/business-metrics - Business health KPIs (admin only)
    if (method === 'GET' && path === '/business-metrics') {
        if (!user?.is_admin) return { status: 403, data: { error: 'Admin access required' } };

        try {
            const now = new Date();
            const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
            const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000);
            const d1  = new Date(now - 24 * 60 * 60 * 1000);

            const [
                totalUsersRow,
                newUsers30dRow,
                newUsersPrev30dRow,
                paidUsersRow,
                dauRow,
                mauRow,
                activatedRow,
                unverifiedRow,
                connectedRow,
            ] = await Promise.all([
                query.get('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE'),
                query.get('SELECT COUNT(*) as count FROM users WHERE created_at >= $1 AND is_active = TRUE', [d30.toISOString()]),
                query.get('SELECT COUNT(*) as count FROM users WHERE created_at >= $1 AND created_at < $2 AND is_active = TRUE', [d60.toISOString(), d30.toISOString()]),
                query.get("SELECT COUNT(*) as count FROM users WHERE subscription_tier != 'free' AND is_active = TRUE"),
                query.get('SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE timestamp >= $1 AND user_id IS NOT NULL', [d1.toISOString()]),
                query.get('SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE timestamp >= $1 AND user_id IS NOT NULL', [d30.toISOString()]),
                // Activation: new users who created ≥1 listing within 7 days of signup
                query.get(`SELECT COUNT(DISTINCT u.id) as count FROM users u
                    JOIN listings l ON l.user_id = u.id AND l.created_at <= u.created_at + INTERVAL '7 days'
                    WHERE u.created_at >= $1 AND u.is_active = TRUE`, [d30.toISOString()]),
                // Abuse proxy: signups in last 30d with email not yet verified
                query.get('SELECT COUNT(*) as count FROM users WHERE created_at >= $1 AND email_verified = FALSE AND is_active = TRUE', [d30.toISOString()]),
                // Activation: new users who connected ≥1 marketplace in first 7 days
                query.get(`SELECT COUNT(DISTINCT u.id) as count FROM users u
                    JOIN shops s ON s.user_id = u.id AND s.created_at <= u.created_at + INTERVAL '7 days'
                    WHERE u.created_at >= $1 AND u.is_active = TRUE`, [d30.toISOString()]),
            ]);

            const totalUsers    = parseInt(totalUsersRow?.count    || 0);
            const newUsers30d   = parseInt(newUsers30dRow?.count   || 0);
            const newUsersPrev  = parseInt(newUsersPrev30dRow?.count || 0);
            const paidUsers     = parseInt(paidUsersRow?.count     || 0);
            const dau           = parseInt(dauRow?.count           || 0);
            const mau           = parseInt(mauRow?.count           || 0);
            const activated     = parseInt(activatedRow?.count     || 0);
            const unverified    = parseInt(unverifiedRow?.count    || 0);
            const connected     = parseInt(connectedRow?.count     || 0);

            const growthRate      = newUsersPrev > 0 ? parseFloat(((newUsers30d - newUsersPrev) / newUsersPrev * 100).toFixed(1)) : null;
            const paidConvRate    = totalUsers  > 0 ? parseFloat((paidUsers  / totalUsers  * 100).toFixed(1)) : 0;
            const dauMauRatio     = mau         > 0 ? parseFloat((dau        / mau         * 100).toFixed(1)) : 0;
            const activationRate  = newUsers30d > 0 ? parseFloat((activated  / newUsers30d * 100).toFixed(1)) : 0;
            const connectionRate  = newUsers30d > 0 ? parseFloat((connected  / newUsers30d * 100).toFixed(1)) : 0;

            return {
                status: 200,
                data: {
                    lastUpdated: now.toISOString(),
                    acquisition:  { totalUsers, newUsers30d, newUsersPrev, growthRate },
                    activation:   { activated, activationRate, connected, connectionRate },
                    conversion:   { paidUsers, totalUsers, paidConvRate },
                    retention:    { dau, mau, dauMauRatio },
                    abuse:        { unverifiedSignups30d: unverified },
                }
            };
        } catch (error) {
            logger.error('[Monitoring] GET /business-metrics error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to load business metrics' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
