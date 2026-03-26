// Rate Limit Dashboard API
// Provides visibility into rate limiting metrics and abuse patterns

import { query } from '../db/database.js';

// In-memory rate limit statistics
const rateLimitStats = {
    hits: new Map(),      // endpoint -> { total, blocked }
    ipBlocks: new Map(),  // ip -> { count, lastBlocked }
    userBlocks: new Map() // userId -> { count, lastBlocked }
};

// Periodically clean up stale entries from Maps
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
const MAX_MAP_SIZE = 10000;
const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

const rateLimitDashboardCleanupInterval = setInterval(() => {
    const now = Date.now();
    const cutoff = now - STALE_THRESHOLD;

    // Prune stale endpoint timestamps and remove empty entries
    for (const [endpoint, stats] of rateLimitStats.hits.entries()) {
        stats.timestamps = stats.timestamps.filter(t => t > now - 3600000);
        if (stats.timestamps.length === 0 && stats.total === 0) {
            rateLimitStats.hits.delete(endpoint);
        }
    }

    // Prune old IP blocks
    for (const [ip, stats] of rateLimitStats.ipBlocks.entries()) {
        if (stats.lastBlocked < cutoff) {
            rateLimitStats.ipBlocks.delete(ip);
        }
    }

    // Prune old user blocks
    for (const [userId, stats] of rateLimitStats.userBlocks.entries()) {
        if (stats.lastBlocked < cutoff) {
            rateLimitStats.userBlocks.delete(userId);
        }
    }

    // Safety cap: clear all if Maps grow too large
    if (rateLimitStats.hits.size > MAX_MAP_SIZE) rateLimitStats.hits.clear();
    if (rateLimitStats.ipBlocks.size > MAX_MAP_SIZE) rateLimitStats.ipBlocks.clear();
    if (rateLimitStats.userBlocks.size > MAX_MAP_SIZE) rateLimitStats.userBlocks.clear();
}, CLEANUP_INTERVAL);

export function stopRateLimitDashboard() {
    clearInterval(rateLimitDashboardCleanupInterval);
}

// Track rate limit hit
export function trackRateLimitHit(endpoint, ip, userId, blocked) {
    const now = Date.now();

    // Track by endpoint
    if (!rateLimitStats.hits.has(endpoint)) {
        rateLimitStats.hits.set(endpoint, { total: 0, blocked: 0, timestamps: [] });
    }
    const endpointStats = rateLimitStats.hits.get(endpoint);
    endpointStats.total++;
    if (blocked) endpointStats.blocked++;
    endpointStats.timestamps.push(now);

    // Keep only last hour of timestamps
    const oneHourAgo = now - 3600000;
    endpointStats.timestamps = endpointStats.timestamps.filter(t => t > oneHourAgo);

    // Track by IP
    if (blocked && ip) {
        if (!rateLimitStats.ipBlocks.has(ip)) {
            rateLimitStats.ipBlocks.set(ip, { count: 0, firstBlocked: now, lastBlocked: now, endpoints: new Set() });
        }
        const ipStats = rateLimitStats.ipBlocks.get(ip);
        ipStats.count++;
        ipStats.lastBlocked = now;
        ipStats.endpoints.add(endpoint);
    }

    // Track by user
    if (blocked && userId) {
        if (!rateLimitStats.userBlocks.has(userId)) {
            rateLimitStats.userBlocks.set(userId, { count: 0, firstBlocked: now, lastBlocked: now, endpoints: new Set() });
        }
        const userStats = rateLimitStats.userBlocks.get(userId);
        userStats.count++;
        userStats.lastBlocked = now;
        userStats.endpoints.add(endpoint);
    }

    // Persist blocked requests to database for audit
    if (blocked) {
        try {
            await query.run(`
                INSERT INTO rate_limit_logs (endpoint, ip, user_id, timestamp)
                VALUES (?, ?, ?, NOW())
            `, [endpoint, ip, userId]);
        } catch (e) {
            // Table might not exist
        }
    }
}

// Route handler
export async function rateLimitDashboardRouter(ctx) {
    const { method, path, user } = ctx;

    // Require admin access
    if (!user || !user.is_admin) {
        return { status: 403, data: { error: 'Admin access required' } };
    }

    // GET /api/rate-limits/stats
    if (method === 'GET' && path === '/stats') {
        const endpointStats = [];
        for (const [endpoint, stats] of rateLimitStats.hits.entries()) {
            const recentTimestamps = stats.timestamps.filter(t => t > Date.now() - 3600000);
            endpointStats.push({
                endpoint,
                totalHits: stats.total,
                blockedHits: stats.blocked,
                blockRate: ((stats.blocked / stats.total) * 100).toFixed(2) + '%',
                hitsPerMinute: (recentTimestamps.length / 60).toFixed(2)
            });
        }

        return {
            status: 200,
            data: {
                endpoints: endpointStats.sort((a, b) => b.blockedHits - a.blockedHits),
                totalRequests: Array.from(rateLimitStats.hits.values()).reduce((sum, s) => sum + s.total, 0),
                totalBlocked: Array.from(rateLimitStats.hits.values()).reduce((sum, s) => sum + s.blocked, 0)
            }
        };
    }

    // GET /api/rate-limits/blocked-ips
    if (method === 'GET' && path === '/blocked-ips') {
        const blockedIps = [];
        const oneHourAgo = Date.now() - 3600000;

        for (const [ip, stats] of rateLimitStats.ipBlocks.entries()) {
            if (stats.lastBlocked > oneHourAgo) {
                blockedIps.push({
                    ip,
                    blockCount: stats.count,
                    firstBlocked: new Date(stats.firstBlocked).toISOString(),
                    lastBlocked: new Date(stats.lastBlocked).toISOString(),
                    endpoints: Array.from(stats.endpoints)
                });
            }
        }

        return {
            status: 200,
            data: {
                blockedIps: blockedIps.sort((a, b) => b.blockCount - a.blockCount).slice(0, 100),
                total: blockedIps.length
            }
        };
    }

    // GET /api/rate-limits/blocked-users
    if (method === 'GET' && path === '/blocked-users') {
        const blockedUsers = [];
        const oneHourAgo = Date.now() - 3600000;

        for (const [userId, stats] of rateLimitStats.userBlocks.entries()) {
            if (stats.lastBlocked > oneHourAgo) {
                // Get user info
                const userInfo = await query.get('SELECT email, username FROM users WHERE id = ?', [userId]);

                blockedUsers.push({
                    userId,
                    email: userInfo?.email,
                    username: userInfo?.username,
                    blockCount: stats.count,
                    firstBlocked: new Date(stats.firstBlocked).toISOString(),
                    lastBlocked: new Date(stats.lastBlocked).toISOString(),
                    endpoints: Array.from(stats.endpoints)
                });
            }
        }

        return {
            status: 200,
            data: {
                blockedUsers: blockedUsers.sort((a, b) => b.blockCount - a.blockCount),
                total: blockedUsers.length
            }
        };
    }

    // GET /api/rate-limits/history
    if (method === 'GET' && path === '/history') {
        const hoursRaw = parseInt(ctx.query?.hours) || 24;
        const hours = Math.min(Math.max(hoursRaw, 1), 720);

        try {
            const history = await query.all(`
                SELECT
                    endpoint,
                    ip,
                    user_id,
                    timestamp
                FROM rate_limit_logs
                WHERE timestamp > NOW() - (?::text || ' hours')::interval
                ORDER BY timestamp DESC
                LIMIT 1000
            `, [hours]);

            const hourlyStats = await query.all(`
                SELECT
                    TO_CHAR(timestamp, 'YYYY-MM-DD HH24:00') as hour,
                    endpoint,
                    COUNT(*) as blocked_count
                FROM rate_limit_logs
                WHERE timestamp > NOW() - (?::text || ' hours')::interval
                GROUP BY hour, endpoint
                ORDER BY hour DESC
            `, [hours]);

            return {
                status: 200,
                data: {
                    recentBlocks: history,
                    hourlyStats
                }
            };
        } catch (e) {
            return {
                status: 200,
                data: {
                    recentBlocks: [],
                    hourlyStats: [],
                    note: 'Rate limit logging table not available'
                }
            };
        }
    }

    // GET /api/rate-limits/alerts
    if (method === 'GET' && path === '/alerts') {
        const alerts = [];
        const now = Date.now();
        const fiveMinutesAgo = now - 300000;

        // Check for high block rates
        for (const [endpoint, stats] of rateLimitStats.hits.entries()) {
            if (stats.total > 100 && stats.blocked / stats.total > 0.1) {
                alerts.push({
                    type: 'high_block_rate',
                    severity: 'warning',
                    endpoint,
                    message: `High block rate (${((stats.blocked / stats.total) * 100).toFixed(1)}%) on ${endpoint}`,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Check for potential DDoS (many blocks from single IP)
        for (const [ip, stats] of rateLimitStats.ipBlocks.entries()) {
            if (stats.count > 50 && stats.lastBlocked > fiveMinutesAgo) {
                alerts.push({
                    type: 'potential_abuse',
                    severity: 'critical',
                    ip,
                    message: `Potential abuse detected from IP ${ip} (${stats.count} blocks)`,
                    timestamp: new Date(stats.lastBlocked).toISOString()
                });
            }
        }

        return {
            status: 200,
            data: {
                alerts: alerts.sort((a, b) => {
                    const severityOrder = { critical: 0, warning: 1, info: 2 };
                    return severityOrder[a.severity] - severityOrder[b.severity];
                })
            }
        };
    }

    // POST /api/rate-limits/reset
    if (method === 'POST' && path === '/reset') {
        rateLimitStats.hits.clear();
        rateLimitStats.ipBlocks.clear();
        rateLimitStats.userBlocks.clear();

        return {
            status: 200,
            data: { message: 'Rate limit statistics reset' }
        };
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Table created by pg-schema.sql (managed by migration system)
export const migration = '';

export default rateLimitDashboardRouter;
