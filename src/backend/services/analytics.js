// Advanced Analytics Service
// Privacy-compliant user behavior tracking and funnel analysis

import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

// Analytics configuration
const ANALYTICS_CONFIG = {
    // Enable/disable tracking
    enabled: process.env.ANALYTICS_ENABLED !== 'false',

    // Session timeout (30 minutes)
    sessionTimeout: 30 * 60 * 1000,

    // Batch size for writing events
    batchSize: 50,

    // Flush interval (5 seconds)
    flushInterval: 5000,

    // Privacy settings
    anonymizeIp: true,
    respectDNT: true,
    dataRetentionDays: 90,
};

// Event queue for batching — hard cap enforced in track()
const EVENT_QUEUE_MAX = 10000;
const EVENT_QUEUE_EVICT_TO = 5000; // evict down to this size when cap is hit
let eventQueue = [];
let flushTimer = null;
let cleanupTimer = null;

// Analytics service
const analyticsService = {
    // Initialize analytics
    init() {
        if (!ANALYTICS_CONFIG.enabled) {
            logger.info('[Analytics] Disabled');
            return;
        }

        // Start flush timer
        flushTimer = setInterval(() => this.flush(), ANALYTICS_CONFIG.flushInterval);

        // Periodic data retention cleanup (every 24 hours)
        cleanupTimer = setInterval(() => this.cleanupOldData(), 24 * 60 * 60 * 1000);

        logger.info('[Analytics] Initialized');
    },

    // Track an event
    track(eventName, properties = {}, user = null, request = null) {
        if (!ANALYTICS_CONFIG.enabled) return;

        // Respect Do Not Track
        if (ANALYTICS_CONFIG.respectDNT && request?.headers?.['dnt'] === '1') {
            return;
        }

        const event = {
            name: eventName,
            properties,
            userId: user?.id || null,
            sessionId: properties.sessionId || null,
            timestamp: new Date().toISOString(),
            ip: ANALYTICS_CONFIG.anonymizeIp
                ? this.anonymizeIp(request?.ip)
                : request?.ip,
            userAgent: request?.headers?.['user-agent'] || null,
        };

        // Cap queue size to prevent unbounded memory growth — evict oldest events
        if (eventQueue.length >= EVENT_QUEUE_MAX) {
            const excess = eventQueue.length - EVENT_QUEUE_EVICT_TO;
            eventQueue.splice(0, excess);
            logger.warn(`[Analytics] Event queue exceeded ${EVENT_QUEUE_MAX}, evicted ${excess} oldest events`);
        }

        eventQueue.push(event);

        // Flush if batch is full
        if (eventQueue.length >= ANALYTICS_CONFIG.batchSize) {
            this.flush();
        }
    },

    // Track page view
    trackPageView(page, user = null, request = null) {
        this.track('page_view', { page }, user, request);
    },

    // Track user action
    trackAction(action, target, user = null, request = null) {
        this.track('user_action', { action, target }, user, request);
    },

    // Track error
    trackError(error, context = {}, user = null) {
        this.track('error', {
            message: error.message,
            stack: error.stack?.substring(0, 500),
            ...context
        }, user);
    },

    // Track conversion (purchase, signup, etc.)
    trackConversion(type, value, properties = {}, user = null) {
        this.track('conversion', {
            type,
            value,
            ...properties
        }, user);
    },

    // Anonymize IP address
    anonymizeIp(ip) {
        if (!ip) return null;

        // IPv4: Zero out last octet
        if (ip.includes('.')) {
            return ip.split('.').slice(0, 3).join('.') + '.0';
        }

        // IPv6: Zero out last 80 bits
        if (ip.includes(':')) {
            return ip.split(':').slice(0, 3).join(':') + ':0:0:0:0:0';
        }

        return null;
    },

    // Flush events to database
    async flush() {
        if (eventQueue.length === 0) return;

        const events = eventQueue.splice(0, eventQueue.length);

        try {
            await query.transaction(async (tx) => {
                for (const event of events) {
                    await tx.run(
                        `INSERT INTO analytics_events (name, properties, user_id, session_id, timestamp, ip, user_agent)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            event.name,
                            JSON.stringify(event.properties),
                            event.userId,
                            event.sessionId,
                            event.timestamp,
                            event.ip,
                            event.userAgent
                        ]
                    );
                }
            });
        } catch (error) {
            logger.error('[Analytics] Flush failed:', error.message);
            // Re-queue failed events (only if queue hasn't grown too large)
            if (eventQueue.length < 5000) {
                eventQueue.unshift(...events);
            }
        }
    },

    // Shutdown gracefully
    async shutdown() {
        if (flushTimer) {
            clearInterval(flushTimer);
            flushTimer = null;
        }
        if (cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }
        await this.flush();
    },

    // ==========================================
    // Reporting & Insights
    // ==========================================

    // Get event counts by name
    async getEventCounts(startDate, endDate = new Date()) {
        return await query.all(`
            SELECT
                name,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT session_id) as unique_sessions
            FROM analytics_events
            WHERE timestamp BETWEEN ? AND ?
            GROUP BY name
            ORDER BY count DESC
        `, [startDate.toISOString(), endDate.toISOString()]);
    },

    // Get page views
    async getPageViews(startDate, endDate = new Date(), groupBy = 'day') {
        const groupFormat = groupBy === 'hour' ? 'YYYY-MM-DD HH24:00' : 'YYYY-MM-DD';

        return await query.all(`
            SELECT
                TO_CHAR(timestamp, ?) as period,
                properties::jsonb->>'page' as page,
                COUNT(*) as views,
                COUNT(DISTINCT user_id) as unique_users
            FROM analytics_events
            WHERE name = 'page_view'
            AND timestamp BETWEEN ? AND ?
            GROUP BY period, page
            ORDER BY period DESC, views DESC
        `, [groupFormat, startDate.toISOString(), endDate.toISOString()]);
    },

    // Get user sessions
    async getUserSessions(userId, limit = 10) {
        return await query.all(`
            SELECT
                session_id,
                MIN(timestamp) as start_time,
                MAX(timestamp) as end_time,
                COUNT(*) as event_count,
                STRING_AGG(DISTINCT name, ',') as events
            FROM analytics_events
            WHERE user_id = ?
            GROUP BY session_id
            ORDER BY start_time DESC
            LIMIT ?
        `, [userId, limit]);
    },

    // Funnel analysis
    async analyzeFunnel(steps, startDate, endDate = new Date()) {
        // steps: ['page_view:signup', 'user_action:form_start', 'conversion:signup']
        const results = [];

        for (let i = 0; i < steps.length; i++) {
            const [event, target] = steps[i].split(':');

            let sql = `
                SELECT COUNT(DISTINCT user_id) as users
                FROM analytics_events
                WHERE name = ?
                AND timestamp BETWEEN ? AND ?
            `;
            const params = [event, startDate.toISOString(), endDate.toISOString()];

            if (target) {
                sql += ` AND (properties::jsonb->>'page' = ? OR properties::jsonb->>'type' = ? OR properties::jsonb->>'target' = ?)`;
                params.push(target, target, target);
            }

            // For steps after the first, filter to users who completed previous step
            if (i > 0) {
                const prevUsers = results[i - 1].userIds;
                if (prevUsers.length === 0) {
                    results.push({ step: steps[i], users: 0, dropoff: 100, userIds: [] });
                    continue;
                }
                sql += ` AND user_id IN (${prevUsers.map(() => '?').join(',')})`;
                params.push(...prevUsers);
            }

            // Get user IDs for next iteration
            const userIdsSql = sql.replace('COUNT(DISTINCT user_id) as users', 'DISTINCT user_id');
            const userRows = await query.all(userIdsSql, params);
            const userIds = userRows.map(r => r.user_id).filter(Boolean);

            const result = await query.get(sql, params);
            const prevCount = i > 0 ? results[i - 1].users : result.users;
            const dropoff = prevCount > 0 ? ((prevCount - result.users) / prevCount * 100).toFixed(1) : 0;

            results.push({
                step: steps[i],
                users: result.users,
                dropoff: parseFloat(dropoff),
                conversionRate: prevCount > 0 ? parseFloat(((result.users / prevCount) * 100).toFixed(1)) : 0,
                userIds
            });
        }

        // Clean up userIds from response
        return results.map(({ userIds, ...rest }) => rest);
    },

    // Get conversion metrics
    async getConversionMetrics(type, startDate, endDate = new Date()) {
        return await query.get(`
            SELECT
                COUNT(*) as total_conversions,
                COUNT(DISTINCT user_id) as unique_users,
                SUM(CAST(properties::jsonb->>'value' AS REAL)) as total_value,
                AVG(CAST(properties::jsonb->>'value' AS REAL)) as avg_value
            FROM analytics_events
            WHERE name = 'conversion'
            AND properties::jsonb->>'type' = ?
            AND timestamp BETWEEN ? AND ?
        `, [type, startDate.toISOString(), endDate.toISOString()]);
    },

    // Get user retention cohorts
    async getRetentionCohorts(startDate, endDate = new Date()) {
        // Get weekly cohorts
        return await query.all(`
            WITH cohorts AS (
                SELECT
                    user_id,
                    TO_CHAR(MIN(timestamp, 'YYYY-IW')) as cohort_week,
                    MIN(timestamp::date) as first_seen
                FROM analytics_events
                WHERE user_id IS NOT NULL
                AND timestamp BETWEEN ? AND ?
                GROUP BY user_id
            ),
            weekly_activity AS (
                SELECT
                    c.cohort_week,
                    c.user_id,
                    (EXTRACT(EPOCH FROM (e.timestamp::date - c.first_seen)) / 86400) / 7 as weeks_since_first
                FROM cohorts c
                JOIN analytics_events e ON c.user_id = e.user_id
                WHERE e.timestamp BETWEEN ? AND ?
            )
            SELECT
                cohort_week,
                weeks_since_first,
                COUNT(DISTINCT user_id) as users
            FROM weekly_activity
            WHERE weeks_since_first >= 0 AND weeks_since_first <= 8
            GROUP BY cohort_week, weeks_since_first
            ORDER BY cohort_week, weeks_since_first
        `, [startDate.toISOString(), endDate.toISOString(), startDate.toISOString(), endDate.toISOString()]);
    },

    // Clean up old data (privacy compliance)
    async cleanupOldData() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - ANALYTICS_CONFIG.dataRetentionDays);

        const result = await query.run(`
            DELETE FROM analytics_events
            WHERE timestamp < ?
        `, [cutoffDate.toISOString()]);

        logger.info(`[Analytics] Cleaned up ${result.changes} old events`);
        return result.changes;
    }
};

// Table created by pg-schema.sql (managed by migration system)
const migration = '';

export { analyticsService, migration };
export default analyticsService;
