// Uptime Probe Worker for VaultLister
// Hourly probes each supported marketplace + its VaultLister service module,
// persisting samples to platform_uptime_samples. Consumed by /api/health/platforms.

import { query } from '../db/database.js';
import { set as setRedisValue } from '../services/redis.js';
import { acquireRedisLock } from '../services/redisLock.js';
import { logger } from '../shared/logger.js';
import { SUPPORTED_PLATFORMS } from '../../shared/supportedPlatforms.js';

const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const PROBE_TIMEOUT_MS = 10 * 1000;
const HEARTBEAT_KEY = 'worker:health:uptimeProbeWorker';
const HEARTBEAT_TTL_SECONDS = 7200;
const LOCK_KEY = 'worker:lock:uptimeProbeWorker';
const LOCK_TTL_MS = 10 * 60 * 1000;
const RETENTION_DAYS = 90;
const PROBE_RETRY_COUNT = 3; // tolerate 2 network flakes before declaring down
const PROBE_RETRY_BACKOFF_MS = 2000;
// Bot walls (403 Forbidden, 429 Too Many Requests) mean the marketplace is up but blocking bots
const BOT_WALL_STATUSES = new Set([403, 429]);

// vlModule paths are relative to THIS file — they must stay here even though the rest of the
// platform metadata (name, logo, marketUrl) is sourced from src/shared/supportedPlatforms.js
const VL_MODULES = {
    ebay: '../services/platformSync/ebaySync.js',
    shopify: '../services/platformSync/shopifySync.js',
    poshmark: '../services/platformSync/poshmarkSync.js',
    depop: '../services/platformSync/depopSync.js',
    facebook: '../services/platformSync/facebookSync.js',
    whatnot: '../services/platformSync/whatnotSync.js',
};

const PLATFORMS = SUPPORTED_PLATFORMS.map((p) => ({
    id: p.id,
    name: p.name,
    marketUrl: p.marketUrl,
    vlModule: VL_MODULES[p.id],
}));

let pollInterval = null;
let isRunning = false;
let lastRun = 0;

async function writeHeartbeat() {
    try {
        await setRedisValue(
            HEARTBEAT_KEY,
            JSON.stringify({ lastRun: new Date(lastRun).toISOString(), status: 'running' }),
            HEARTBEAT_TTL_SECONDS,
        );
    } catch (err) {
        logger.warn(
            `[UptimeProbeWorker] Heartbeat write failed (Redis may be unavailable): ${err?.message || 'unknown'}`,
        );
    }
}

// Count consecutive failed probe cycles — surfaces as a meta-incident after N failures
let consecutiveCycleFailures = 0;
const META_INCIDENT_THRESHOLD = 3;

async function probeMarketOnce(platform) {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const resp = await fetch(platform.marketUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: { 'User-Agent': 'VaultLister-Uptime-Probe/1.0 (+https://vaultlister.com/bot-info)' },
        });
        const latency = Date.now() - start;
        // "Up" means a healthy response OR a bot wall (marketplace is alive, just blocking us)
        const isHealthy = resp.status >= 200 && resp.status < 400;
        const isBotWall = BOT_WALL_STATUSES.has(resp.status);
        const up = isHealthy || isBotWall;
        return { up, latencyMs: latency, error: up ? null : `HTTP ${resp.status}` };
    } catch (err) {
        return {
            up: false,
            latencyMs: Date.now() - start,
            error: err && err.name === 'AbortError' ? 'timeout' : (err?.message || 'unknown').slice(0, 500),
        };
    } finally {
        clearTimeout(timer);
    }
}

async function probeMarket(platform) {
    // Retry up to PROBE_RETRY_COUNT times before declaring down — absorbs transient flakes
    let lastResult = null;
    for (let attempt = 0; attempt < PROBE_RETRY_COUNT; attempt++) {
        lastResult = await probeMarketOnce(platform);
        if (lastResult.up) return lastResult;
        if (attempt < PROBE_RETRY_COUNT - 1) {
            await new Promise((r) => setTimeout(r, PROBE_RETRY_BACKOFF_MS));
        }
    }
    return lastResult;
}

async function probeVL(platform) {
    const start = Date.now();
    let mod;
    try {
        mod = await import(platform.vlModule);
    } catch (err) {
        return {
            up: false,
            latencyMs: Date.now() - start,
            error: ('import failed: ' + (err?.message || 'unknown')).slice(0, 500),
        };
    }

    // If the adapter exports a healthCheck() function, use it as the authoritative probe.
    // Contract: healthCheck({signal}) -> Promise<{ok: boolean, reason?: string}> or a bare boolean.
    // Adapters SHOULD honor the AbortSignal; Promise.race timeout is a safety net.
    if (typeof mod.healthCheck === 'function') {
        const controller = new AbortController();
        let timeoutHit = false;
        const timer = setTimeout(() => {
            timeoutHit = true;
            controller.abort();
        }, PROBE_TIMEOUT_MS);
        try {
            const res = await Promise.race([
                Promise.resolve(mod.healthCheck({ signal: controller.signal })),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS)),
            ]);
            const up = typeof res === 'boolean' ? res : !!(res && res.ok);
            const reason = res && res.reason ? String(res.reason).slice(0, 500) : null;
            return { up, latencyMs: Date.now() - start, error: up ? null : reason || 'healthCheck returned not-ok' };
        } catch (err) {
            // Ensure a runaway healthCheck is aborted even if Promise.race lost on timeout
            if (!timeoutHit) controller.abort();
            return {
                up: false,
                latencyMs: Date.now() - start,
                error: ('healthCheck threw: ' + (err?.message || 'unknown')).slice(0, 500),
            };
        } finally {
            clearTimeout(timer);
        }
    }

    // Fallback: module import success is the probe.
    return { up: true, latencyMs: Date.now() - start, error: null };
}

async function persistSample(platformId, kind, result) {
    try {
        await query.run(
            `INSERT INTO platform_uptime_samples (platform_id, kind, is_up, latency_ms, error_text)
             VALUES (?, ?, ?, ?, ?)`,
            [platformId, kind, result.up, result.latencyMs, result.error],
        );
    } catch (err) {
        logger.error(`[UptimeProbeWorker] Failed to persist ${platformId}/${kind}: ${err.message}`);
    }
}

async function syncIncident(platformId, kind, isUp, platformName) {
    const kindLabel = kind === 'market' ? 'marketplace' : 'integration';
    try {
        if (!isUp) {
            await query.run(
                `INSERT INTO platform_incidents (platform_id, kind, title, status, severity)
                 SELECT ?, ?, ?, 'investigating', 'major'
                 WHERE NOT EXISTS (
                     SELECT 1 FROM platform_incidents
                     WHERE platform_id = ? AND kind = ? AND resolved_at IS NULL
                 )`,
                [platformId, kind, `${platformName} ${kindLabel} unavailable`, platformId, kind],
            );
        } else {
            await query.run(
                `UPDATE platform_incidents
                 SET status = 'resolved', resolved_at = NOW()
                 WHERE platform_id = ? AND kind = ? AND resolved_at IS NULL`,
                [platformId, kind],
            );
        }
    } catch (err) {
        logger.error(`[UptimeProbeWorker] syncIncident failed for ${platformId}/${kind}: ${err.message}`);
    }
}

async function pruneOldSamples() {
    try {
        const res = await query.run(
            `DELETE FROM platform_uptime_samples WHERE sampled_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`,
            [],
        );
        if (res && res.changes) {
            logger.info(`[UptimeProbeWorker] Pruned ${res.changes} samples older than ${RETENTION_DAYS} days`);
        }
    } catch (err) {
        logger.error(`[UptimeProbeWorker] Prune failed: ${err.message}`);
    }
}

async function runProbes() {
    if (isRunning) {
        logger.info('[UptimeProbeWorker] Probe cycle already running, skipping');
        return;
    }
    lastRun = Date.now();
    isRunning = true;

    const lock = await acquireRedisLock(LOCK_KEY, LOCK_TTL_MS, { name: 'uptime probe worker' });
    if (!lock.acquired) {
        isRunning = false;
        return;
    }

    try {
        const work = [];
        for (const p of PLATFORMS) {
            work.push(
                probeMarket(p).then((r) =>
                    persistSample(p.id, 'market', r).then(() => syncIncident(p.id, 'market', r.up, p.name)),
                ),
            );
            work.push(
                probeVL(p).then((r) => persistSample(p.id, 'vl', r).then(() => syncIncident(p.id, 'vl', r.up, p.name))),
            );
        }
        await Promise.all(work);
        await pruneOldSamples();
        await writeHeartbeat();
        logger.info(
            `[UptimeProbeWorker] Probed ${PLATFORMS.length} platforms (${PLATFORMS.length * 2} samples) in ${Date.now() - lastRun}ms`,
        );
        consecutiveCycleFailures = 0;
    } catch (err) {
        consecutiveCycleFailures++;
        logger.error(`[UptimeProbeWorker] Cycle error (${consecutiveCycleFailures} consecutive): ${err.message}`);
        if (consecutiveCycleFailures >= META_INCIDENT_THRESHOLD) {
            try {
                await query.run(
                    `INSERT INTO platform_incidents (platform_id, kind, title, status, severity)
                     SELECT '_self', 'vl',
                            'Uptime probe worker failing for ' || ? || ' consecutive cycles',
                            'investigating', 'major'
                     WHERE NOT EXISTS (
                        SELECT 1 FROM platform_incidents
                        WHERE platform_id = '_self' AND kind = 'vl' AND resolved_at IS NULL
                     )`,
                    [consecutiveCycleFailures],
                );
            } catch (_) {}
        }
    } finally {
        if (lock.release) {
            try {
                await lock.release();
            } catch (_) {}
        }
        isRunning = false;
    }
}

export { runProbes as runUptimeProbesCycle };

export function startUptimeProbeWorker() {
    if (pollInterval) {
        logger.info('[UptimeProbeWorker] Already running');
        return;
    }
    logger.info('[UptimeProbeWorker] Starting...');
    runProbes().catch((err) => logger.error('[UptimeProbeWorker] Initial probe failed:', err));
    pollInterval = setInterval(() => {
        runProbes().catch((err) => logger.error('[UptimeProbeWorker] Scheduled probe failed:', err));
    }, POLL_INTERVAL_MS);
    logger.info(`[UptimeProbeWorker] Scheduled every ${POLL_INTERVAL_MS / 60000} minutes`);
}

export function stopUptimeProbeWorker() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        logger.info('[UptimeProbeWorker] Stopped');
    }
}

export { PLATFORMS as UPTIME_PROBE_PLATFORMS };
