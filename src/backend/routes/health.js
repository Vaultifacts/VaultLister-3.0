// src/backend/routes/health.js
// Health, readiness, liveness, geo, status, and worker-health endpoints.
// Extracted from server.js — owns _platformHealthCache and _APP_VERSION.

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getStatementCacheStats } from '../db/database.js';
import { SUPPORTED_PLATFORM_IDS as _STATUS_PLATFORM_IDS, publicPlatformList } from '../../shared/supportedPlatforms.js';
import { deriveRecentHealthState } from '../utils/platformHealthState.js';
import { isOpenPlatformIncident, shouldShowAutoProbeIssue } from '../utils/platformHealthIssues.js';
import { websocketService } from '../services/websocket.js';
import redisService, { get as redisGet } from '../services/redis.js';
import { monitoring } from '../services/monitoring.js';
import { TIMEOUTS } from '../shared/constants.js';
import { getCountryCodeFromHeaders } from '../utils/geo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..', '..');
const IS_PROD = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

let _APP_VERSION = '1.0.0';
try {
    const pkg = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf8'));
    _APP_VERSION = pkg.version || _APP_VERSION;
} catch {}

// In-process cache for /api/health/platforms — absorbs polling from many concurrent tabs
let _platformHealthCache = null;

/**
 * Handles /api/health, /api/health/live, /api/health/ready, /api/health/detailed
 * ctx.path is the suffix after "/api/health"
 */
export async function healthRouter(ctx) {
    const { path } = ctx;

    // GET /api/health/live — liveness probe
    if (path === '/live') {
        return { status: 200, data: { status: 'ok' } };
    }

    // GET /api/health/ready — readiness probe
    if (path === '/ready') {
        const checks = {};
        let ready = true;

        try {
            const { query } = await import('../db/database.js');
            await query.get('SELECT 1');
            checks.database = 'ok';
        } catch (e) {
            checks.database = 'error';
            ready = false;
        }

        try {
            const redisClient = redisService.getClient();
            if (redisClient) {
                const pong = await Promise.race([
                    redisClient.ping(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), TIMEOUTS.DB_HEALTH_CHECK_MS),
                    ),
                ]);
                checks.redis = pong === 'PONG' ? 'ok' : 'degraded';
            } else {
                checks.redis = 'degraded';
            }
        } catch (e) {
            checks.redis = 'unavailable';
        }

        return {
            status: ready ? 200 : 503,
            data: {
                status: ready ? 'ok' : 'degraded',
                checks,
                timestamp: new Date().toISOString(),
            },
        };
    }

    // GET /api/health/detailed — detailed health check, safe for external uptime monitors
    if (path === '/detailed') {
        const { query: dbQuery } = await import('../db/database.js');
        let dbConnected = false;
        try {
            await dbQuery.get('SELECT 1');
            dbConnected = true;
        } catch (_) {}

        const mem = process.memoryUsage();
        return {
            status: dbConnected ? 200 : 503,
            data: {
                status: dbConnected ? 'healthy' : 'unhealthy',
                uptime: Math.floor(process.uptime()),
                memory: {
                    rss: Math.round(mem.rss / (1024 * 1024)),
                    heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
                    heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
                },
                db: { connected: dbConnected },
                timestamp: new Date().toISOString(),
            },
        };
    }

    // GET /api/health — basic health check (path '' or '/')
    let dbStatus = 'ok';
    try {
        const { query } = await import('../db/database.js');
        await query.get('SELECT 1');
    } catch (e) {
        dbStatus = 'error';
    }

    return {
        status: 200,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: _APP_VERSION,
            uptime: Math.floor(process.uptime()),
            database: { status: dbStatus },
        },
    };
}

/**
 * Handles /api/health/platforms
 * Per-platform marketplace + VaultLister service uptime for status.html.
 * Cached in-process for 30s to absorb polling from many concurrent tabs.
 */
export async function healthPlatformsRouter() {
    const now = Date.now();
    if (_platformHealthCache && now - _platformHealthCache.t < 30_000) {
        return { status: 200, data: _platformHealthCache.body };
    }

    const { query: dbQuery } = await import('../db/database.js');
    const { UPTIME_PROBE_PLATFORMS } = await import('../workers/uptimeProbeWorker.js');

    const platformIds = _STATUS_PLATFORM_IDS;
    const out = {};

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    function emptyBuckets() {
        const arr = new Array(90);
        for (let i = 0; i < 90; i++) {
            const d = new Date(today);
            d.setUTCDate(d.getUTCDate() - (89 - i));
            arr[i] = { state: 'up', date: d.toISOString().slice(0, 10), total: 0, downCount: 0 };
        }
        return arr;
    }

    for (const p of UPTIME_PROBE_PLATFORMS) {
        out[p.id] = {
            market: { state: 'operational', uptime90d: 100, buckets: emptyBuckets() },
            vl: { state: 'operational', uptime90d: 100, buckets: emptyBuckets() },
            issues: [],
        };
    }

    let dailyRows = [];
    let recentRows = [];
    let issueRows = [];
    let incidentRows = [];
    try {
        const dailyP = dbQuery.all(`
            SELECT platform_id,
                   kind,
                   (sampled_at AT TIME ZONE 'UTC')::date AS day,
                   COUNT(*)                              AS total,
                   SUM(CASE WHEN is_up THEN 0 ELSE 1 END) AS down_count
            FROM platform_uptime_samples
            WHERE sampled_at > NOW() - INTERVAL '90 days'
            GROUP BY platform_id, kind, (sampled_at AT TIME ZONE 'UTC')::date
        `);

        const recentP = dbQuery.all(`
            SELECT platform_id, kind, is_up, sampled_at
            FROM (
                SELECT platform_id, kind, is_up, sampled_at,
                       ROW_NUMBER() OVER (PARTITION BY platform_id, kind ORDER BY sampled_at DESC) AS rn
                FROM platform_uptime_samples
                WHERE sampled_at > NOW() - INTERVAL '3 hours'
            ) t
            WHERE rn <= 5
        `);

        const issueP = dbQuery.all(`
            SELECT platform_id, kind, MAX(sampled_at) AS last_seen, COUNT(*) AS failures
            FROM platform_uptime_samples
            WHERE sampled_at > NOW() - INTERVAL '48 hours' AND NOT is_up
            GROUP BY platform_id, kind
            HAVING COUNT(*) >= 2
        `);

        const incidentP = dbQuery.all(`
            SELECT id, platform_id, kind, title, status, severity, postmortem_url,
                   started_at, resolved_at
            FROM platform_incidents
            WHERE resolved_at IS NULL
            ORDER BY started_at DESC
            LIMIT 50
        `);

        const pastP = dbQuery.all(`
            SELECT id, platform_id, kind, title, severity, postmortem_url,
                   started_at, resolved_at
            FROM platform_incidents
            WHERE resolved_at IS NOT NULL
              AND resolved_at > NOW() - INTERVAL '90 days'
            ORDER BY resolved_at DESC
            LIMIT 20
        `);

        var pastIncidentRows;
        [dailyRows, recentRows, issueRows, incidentRows, pastIncidentRows] = await Promise.all([
            dailyP,
            recentP,
            issueP,
            incidentP,
            pastP,
        ]);
        out._pastIncidents = pastIncidentRows;
    } catch (_) {
        // Table may not exist yet on first deploy before migration — fall through to defaults
    }

    const OUTAGE_DOWN_RATIO = 0.5;
    const DEGRADED_DOWN_RATIO = 0.1;
    const RECENT_OUTAGE_MIN = 3;
    const RECENT_DEGRADED_MIN = 1;
    const MAX_ISSUES_PER_KIND = 5;

    const todayUtcMs = today.getTime();
    for (const row of dailyRows) {
        if (!out[row.platform_id]) continue;
        const kindObj = out[row.platform_id][row.kind];
        if (!kindObj) continue;
        const rowDay = row.day instanceof Date ? row.day : new Date(row.day);
        const offset = Math.round((todayUtcMs - rowDay.getTime()) / 86_400_000);
        if (offset < 0 || offset >= 90) continue;
        const idx = 89 - offset;
        const total = Number(row.total);
        const downCount = Number(row.down_count);
        const downRatio = downCount / Math.max(1, total);
        const bucket = kindObj.buckets[idx];
        bucket.state = downRatio >= OUTAGE_DOWN_RATIO ? 'outage' : downRatio > DEGRADED_DOWN_RATIO ? 'degraded' : 'up';
        bucket.total = total;
        bucket.downCount = downCount;
    }

    for (const id of platformIds) {
        for (const kind of ['market', 'vl']) {
            const buckets = out[id][kind].buckets;
            const upCount = buckets.filter((b) => b.state === 'up').length;
            out[id][kind].uptime90d = Math.round((upCount / 90) * 10000) / 100;
        }
    }

    const recentByKey = {};
    for (const r of recentRows) {
        const key = r.platform_id + '|' + r.kind;
        if (!recentByKey[key]) recentByKey[key] = [];
        recentByKey[key].push({ isUp: r.is_up, sampledAt: r.sampled_at });
    }
    for (const id of platformIds) {
        for (const kind of ['market', 'vl']) {
            const arr = recentByKey[id + '|' + kind];
            if (!arr || arr.length === 0) continue;
            out[id][kind].state = deriveRecentHealthState(arr, {
                outageMin: RECENT_OUTAGE_MIN,
                degradedMin: RECENT_DEGRADED_MIN,
            });
        }
    }

    const ISSUE_LABEL = {
        ebay: 'eBay',
        shopify: 'Shopify',
        poshmark: 'Poshmark',
        depop: 'Depop',
        facebook: 'Facebook Marketplace',
        whatnot: 'Whatnot',
    };
    const coveredByIncident = new Set();
    for (const inc of incidentRows) {
        if (!out[inc.platform_id]) continue;
        if (!isOpenPlatformIncident(inc)) continue;
        coveredByIncident.add(inc.platform_id + '|' + inc.kind);
        out[inc.platform_id].issues.push({
            title: inc.title,
            status: inc.status,
            severity: inc.severity,
            startedAt: inc.started_at,
            resolvedAt: inc.resolved_at,
            postmortemUrl: inc.postmortem_url,
            source: 'manual',
        });
    }
    for (const r of issueRows) {
        if (!out[r.platform_id]) continue;
        if (coveredByIncident.has(r.platform_id + '|' + r.kind)) continue;
        if (!shouldShowAutoProbeIssue(out[r.platform_id][r.kind])) continue;
        const label = ISSUE_LABEL[r.platform_id] || r.platform_id;
        const title =
            r.kind === 'market' ? `${label} marketplace reachability degraded` : `VaultLister ${label} sync delayed`;
        out[r.platform_id].issues.push({
            title,
            status: 'investigating',
            severity: 'minor',
            startedAt: r.last_seen,
            resolvedAt: null,
            postmortemUrl: null,
            source: 'auto',
        });
    }

    for (const id of platformIds) {
        if (out[id].issues.length > MAX_ISSUES_PER_KIND * 2) {
            out[id].issues = out[id].issues.slice(0, MAX_ISSUES_PER_KIND * 2);
        }
    }

    const pastIncidents = (out._pastIncidents || []).map(function (r) {
        return {
            platformId: r.platform_id,
            kind: r.kind,
            title: r.title,
            severity: r.severity,
            startedAt: r.started_at,
            resolvedAt: r.resolved_at,
            postmortemUrl: r.postmortem_url,
        };
    });
    delete out._pastIncidents;

    const body = {
        platforms: out,
        platformList: publicPlatformList(),
        pastIncidents,
        generatedAt: new Date().toISOString(),
    };
    _platformHealthCache = { t: now, body };
    return { status: 200, data: body };
}

/**
 * Handles /api/geo
 */
export async function geoRouter({ headers }) {
    return {
        status: 200,
        cacheControl: 'private, max-age=3600',
        data: {
            country_code: getCountryCodeFromHeaders(headers),
        },
    };
}

/**
 * Handles /api/status
 */
export async function statusRouter() {
    const monMetrics = monitoring.getMetrics();

    if (IS_PROD) {
        return {
            status: 200,
            data: {
                status: 'ok',
                timestamp: new Date().toISOString(),
            },
        };
    }

    return {
        status: 200,
        data: {
            status: 'ok',
            version: _APP_VERSION,
            runtime: process.version,
            uptime: Math.floor(process.uptime()),
            environment: process.env.NODE_ENV || 'development',
            database: monMetrics.database,
            statementCache: getStatementCacheStats(),
            websocket: websocketService.getStats(),
        },
    };
}

/**
 * Handles /api/workers/health
 * Background worker health — public, safe for external monitoring.
 */
export async function workersHealthRouter() {
    const now = Date.now();
    const workerDefs = [
        { key: 'taskWorker', intervalMs: 10 * 1000, staleThresholdMs: 30_000 },
        { key: 'gdprWorker', intervalMs: 60 * 60 * 1000, staleThresholdMs: 3 * 60 * 60 * 1000 },
        { key: 'priceCheckWorker', intervalMs: 30 * 60 * 1000, staleThresholdMs: 90 * 60 * 1000 },
        { key: 'emailPollingWorker', intervalMs: 5 * 60 * 1000, staleThresholdMs: 15 * 60 * 1000 },
        { key: 'tokenRefreshScheduler', intervalMs: 5 * 60 * 1000, staleThresholdMs: 15 * 60 * 1000 },
        { key: 'uptimeProbeWorker', intervalMs: 60 * 60 * 1000, staleThresholdMs: 3 * 60 * 60 * 1000 },
    ];

    const workers = {};
    let overallOk = true;

    for (const { key, intervalMs, staleThresholdMs } of workerDefs) {
        let heartbeat = null;
        try {
            const rawHeartbeat = await redisGet(`worker:health:${key}`);
            heartbeat = rawHeartbeat ? JSON.parse(rawHeartbeat) : null;
        } catch {
            heartbeat = null;
        }

        const lastRunMs = heartbeat?.lastRun ? new Date(heartbeat.lastRun).getTime() : 0;
        let workerStatus;
        if (!heartbeat) {
            workerStatus = 'stopped';
            overallOk = false;
        } else if (!lastRunMs) {
            workerStatus = 'starting';
        } else if (now - lastRunMs > staleThresholdMs) {
            workerStatus = 'stale';
            overallOk = false;
        } else {
            workerStatus = 'ok';
        }
        workers[key] = {
            status: workerStatus,
            lastRun: heartbeat?.lastRun || null,
            intervalMs,
            staleThresholdMs,
        };
    }

    return {
        status: overallOk ? 200 : 503,
        data: {
            version: 'v1',
            overall: overallOk ? 'ok' : 'degraded',
            workers,
            timestamp: new Date().toISOString(),
        },
    };
}
