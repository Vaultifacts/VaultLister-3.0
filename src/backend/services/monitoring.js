// Monitoring and Alerting Service
// Error tracking, uptime monitoring, and performance alerts

import v8 from 'v8';
import crypto from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { fetchWithTimeout } from '../shared/fetchWithTimeout.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_WARN_BYTES  = 500 * 1024 * 1024; // 500 MB
const DB_CRIT_BYTES  =   1 * 1024 * 1024 * 1024; // 1 GB

// Configuration
const SENTRY_DSN = process.env.SENTRY_DSN;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;

// Metrics storage (in-memory for demo, use Redis in production)
const metrics = {
    requests: { total: 0, errors: 0, latencies: [] },
    errors: [],
    uptime: { startTime: Date.now(), checks: [] },
    performance: { cpu: [], memory: [], responseTime: [] },
    database: { sizeBytes: 0, lastChecked: null }
};

// Thresholds for alerts
const THRESHOLDS = {
    errorRate: 0.05, // 5% error rate
    responseTime: 2000, // 2 seconds
    memoryUsage: 0.95, // 95% memory usage (increased from 0.85 to reduce noise with dynamic heap sizing)
    cpuUsage: 0.80 // 80% CPU usage
};

const monitoring = {
    // Initialize monitoring
    init() {
        logger.info('[Monitoring] Service initialized');

        // Start performance collection
        this.startMetricsCollection();

        // Initialize Sentry if configured
        if (SENTRY_DSN) {
            this.initSentry();
        }
    },

    _sentryModule: null,

    // Initialize Sentry error tracking
    async initSentry() {
        try {
            const Sentry = await import('@sentry/node');
            Sentry.init({
                dsn: SENTRY_DSN,
                environment: process.env.NODE_ENV || 'development',
                tracesSampleRate: 0.1,
                integrations: []
            });
            this._sentryModule = Sentry;
            logger.info('[Monitoring] Sentry initialized');
        } catch (e) {
            logger.info('[Monitoring] Sentry not available, using local error tracking');
        }
    },

    // Track request
    trackRequest(req, res, duration) {
        metrics.requests.total++;
        metrics.requests.latencies.push(duration);

        // Keep only last 1000 latencies
        if (metrics.requests.latencies.length > 1000) {
            metrics.requests.latencies = metrics.requests.latencies.slice(-1000);
        }

        // Check for slow response
        if (duration > THRESHOLDS.responseTime) {
            this.alert('slow_response', {
                path: req.url,
                method: req.method,
                duration
            });
        }
    },

    // Track error
    trackError(error, context = {}) {
        metrics.requests.errors++;

        const errorRecord = {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        };

        metrics.errors.push(errorRecord);

        // Keep only last 100 errors
        if (metrics.errors.length > 100) {
            metrics.errors = metrics.errors.slice(-100);
        }

        // Log to database
        try {
            query.run(`
                INSERT INTO error_logs (id, message, stack, context, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            `, [
                crypto.randomUUID(),
                error.message,
                error.stack,
                JSON.stringify(context)
            ]);
        } catch (e) {
            // Silently fail if table doesn't exist
        }

        // Report to Sentry if available
        if (SENTRY_DSN && this._sentryModule) {
            try {
                this._sentryModule.captureException(error, { extra: context });
            } catch (e) {}
        }

        // Check error rate
        const errorRate = metrics.requests.errors / metrics.requests.total;
        if (errorRate > THRESHOLDS.errorRate && metrics.requests.total > 100) {
            this.alert('high_error_rate', { errorRate, total: metrics.requests.total });
        }
    },

    // Stop metrics collection (for graceful shutdown)
    stopMetricsCollection() {
        if (this._metricsInterval) {
            clearInterval(this._metricsInterval);
            this._metricsInterval = null;
        }
        if (this._dbSizeInterval) {
            clearInterval(this._dbSizeInterval);
            this._dbSizeInterval = null;
        }
    },

    // Check database size via pg_database_size() and alert if thresholds are exceeded
    async checkDatabaseSize() {
        try {
            const row = await query.get('SELECT pg_database_size(current_database()) AS size_bytes');
            const sizeBytes = Number(row?.size_bytes || 0);
            metrics.database.sizeBytes = sizeBytes;
            metrics.database.lastChecked = new Date().toISOString();

            if (sizeBytes >= DB_CRIT_BYTES) {
                logger.error(`[Monitoring] CRITICAL: database is ${(sizeBytes / (1024 ** 3)).toFixed(2)} GB (>= 1 GB threshold)`);
                this.alert('db_size_critical', { sizeBytes, sizeMB: Math.round(sizeBytes / (1024 ** 2)) });
            } else if (sizeBytes >= DB_WARN_BYTES) {
                logger.warn(`[Monitoring] WARNING: database is ${Math.round(sizeBytes / (1024 ** 2))} MB (>= 500 MB threshold)`);
                this.alert('db_size_warning', { sizeBytes, sizeMB: Math.round(sizeBytes / (1024 ** 2)) });
            }
        } catch (e) {
            logger.warn('[Monitoring] Could not query database size:', e.message);
        }
    },

    // Start metrics collection
    startMetricsCollection() {
        // Check DB size immediately on init, then every hour
        this.checkDatabaseSize().catch(err => logger.error('DB size check failed:', err.message));
        this._dbSizeInterval = setInterval(() => this.checkDatabaseSize().catch(err => logger.error('DB size check failed:', err.message)), 60 * 60 * 1000);

        // Collect metrics every 30 seconds
        this._metricsInterval = setInterval(() => {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            metrics.performance.memory.push({
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                rss: memUsage.rss,
                timestamp: Date.now()
            });

            // Keep only last 100 data points
            if (metrics.performance.memory.length > 100) {
                metrics.performance.memory = metrics.performance.memory.slice(-100);
            }

            // Check memory threshold against heapSizeLimit (the true V8 max),
            // not heapTotal (which starts tiny and grows dynamically, causing false positives)
            const heapSizeLimit = v8.getHeapStatistics().heap_size_limit;
            const memoryRatio = memUsage.heapUsed / heapSizeLimit;
            if (memoryRatio > THRESHOLDS.memoryUsage) {
                this.alert('high_memory', {
                    memoryRatio: memoryRatio.toFixed(3),
                    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                    heapSizeLimitMB: Math.round(heapSizeLimit / 1024 / 1024)
                });
            }
        }, 30000);
    },

    // Send alert
    async alert(type, data) {
        const alert = {
            type,
            data,
            timestamp: new Date().toISOString()
        };

        logger.warn('[ALERT]', type, data);

        // Store alert
        try {
            query.run(`
                INSERT INTO alerts (id, type, data, created_at)
                VALUES (?, ?, ?, datetime('now'))
            `, [
                crypto.randomUUID(),
                type,
                JSON.stringify(data)
            ]);
        } catch (e) {}

        // Send to Slack if configured
        const slackWebhook = process.env.SLACK_WEBHOOK;
        if (slackWebhook) {
            try {
                await fetchWithTimeout(slackWebhook, {
                    method: 'POST',
                    timeoutMs: 10000,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: `🚨 *VaultLister Alert*: ${type}`,
                        attachments: [{
                            color: 'danger',
                            fields: Object.entries(data).map(([k, v]) => ({
                                title: k,
                                value: String(v),
                                short: true
                            }))
                        }]
                    })
                });
            } catch (e) {
                logger.error('[Monitoring] Slack alert failed:', e.message);
            }
        }

        // Send email if configured
        if (ALERT_EMAIL) {
            // Email implementation would go here
        }
    },

    // Health check
    async healthCheck() {
        const checks = {
            database: false,
            redis: false,
            memory: false,
            uptime: 0
        };

        // Database check
        try {
            query.get('SELECT 1');
            checks.database = true;
        } catch (e) {}

        // Memory check
        const memUsage = process.memoryUsage();
        checks.memory = (memUsage.heapUsed / memUsage.heapTotal) < THRESHOLDS.memoryUsage;

        // Uptime
        checks.uptime = Date.now() - metrics.uptime.startTime;

        // Store check result
        metrics.uptime.checks.push({
            ...checks,
            timestamp: Date.now()
        });

        // Keep only last 100 checks
        if (metrics.uptime.checks.length > 100) {
            metrics.uptime.checks = metrics.uptime.checks.slice(-100);
        }

        return checks;
    },

    // Get stats — shape expected by monitoring route and route tests
    getStats() {
        const m = this.getMetrics();
        const mem = process.memoryUsage();
        return {
            summary: {
                totalRequests: m.requests.total,
                totalErrors: m.requests.errors,
                avgResponseTime: m.latency.avg
            },
            endpoints: [],
            system: {
                memoryUsed: mem.heapUsed,
                memoryTotal: mem.heapTotal,
                memoryRss: mem.rss,
                uptime: m.uptime.seconds,
                startedAt: new Date(Date.now() - m.uptime.seconds * 1000).toISOString()
            }
        };
    },

    // Get metrics summary
    getMetrics() {
        const latencies = metrics.requests.latencies;
        const sortedLatencies = [...latencies].sort((a, b) => a - b);

        return {
            requests: {
                total: metrics.requests.total,
                errors: metrics.requests.errors,
                errorRate: metrics.requests.total > 0
                    ? (metrics.requests.errors / metrics.requests.total * 100).toFixed(2) + '%'
                    : '0%'
            },
            latency: {
                avg: latencies.length > 0
                    ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)
                    : 0,
                p50: latencies.length > 0
                    ? sortedLatencies[Math.floor(latencies.length * 0.5)]?.toFixed(2)
                    : 0,
                p95: latencies.length > 0
                    ? sortedLatencies[Math.floor(latencies.length * 0.95)]?.toFixed(2)
                    : 0,
                p99: latencies.length > 0
                    ? sortedLatencies[Math.floor(latencies.length * 0.99)]?.toFixed(2)
                    : 0
            },
            memory: process.memoryUsage(),
            uptime: {
                seconds: Math.floor((Date.now() - metrics.uptime.startTime) / 1000),
                formatted: this.formatUptime(Date.now() - metrics.uptime.startTime)
            },
            recentErrors: metrics.errors.slice(-10),
            database: {
                sizeBytes: metrics.database.sizeBytes,
                sizeMB: Math.round(metrics.database.sizeBytes / (1024 ** 2)),
                lastChecked: metrics.database.lastChecked
            }
        };
    },

    // Format uptime
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    },

    // Get alerts
    getAlerts(hours = 24) {
        try {
            const h = Math.max(1, Math.min(Number(hours) || 24, 8760));
            return query.all(`
                SELECT * FROM alerts
                WHERE created_at > datetime('now', '-' || ? || ' hours')
                ORDER BY created_at DESC
                LIMIT 100
            `, [h]) || [];
        } catch (e) {
            return [];
        }
    }
};

// Tables created by pg-schema.sql (managed by migration system)
export const migration = '';

// Alias used by monitoring route
export const monitor = monitoring;

// Health checker used by monitoring route
export const healthChecker = {
    async runAll() {
        const health = await monitoring.healthCheck();
        return {
            status: health.database && health.memory ? 'healthy' : 'unhealthy',
            checks: {
                database: { status: health.database ? 'healthy' : 'unhealthy' },
                memory: { status: health.memory ? 'healthy' : 'unhealthy' }
            },
            timestamp: new Date().toISOString()
        };
    }
};

// Security monitor used by monitoring route
export const securityMonitor = {
    getSummary() {
        try {
            const failedLogins = query.get("SELECT COUNT(*) as count FROM security_logs WHERE event_type = 'LOGIN_FAILURE' AND created_at > datetime('now', '-24 hours')");
            const suspicious = query.get("SELECT COUNT(*) as count FROM security_logs WHERE event_type = 'SUSPICIOUS' AND created_at > datetime('now', '-24 hours')");
            const blocked = query.get("SELECT COUNT(DISTINCT ip_or_user) as count FROM security_logs WHERE event_type = 'RATE_LIMIT_BLOCK' AND created_at > datetime('now', '-24 hours')");
            return {
                failedLogins: failedLogins?.count || 0,
                suspiciousActivity: suspicious?.count || 0,
                blockedIPs: blocked?.count || 0
            };
        } catch (e) {
            return { failedLogins: 0, suspiciousActivity: 0, blockedIPs: 0 };
        }
    }
};

export { monitoring };
export default monitoring;
