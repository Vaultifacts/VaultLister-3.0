// Daily soak snapshot — append-only JSONL log of adaptive-rate-control state.
// Runs every 24h from server boot. Minimal, best-effort, never crashes the server.

import fs from 'fs';
import path from 'path';
import { logger } from '../shared/logger.js';

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PATH = path.join(process.cwd(), 'data', '.soak-snapshots.jsonl');

let _interval = null;
let _snapshotPath = DEFAULT_PATH;

async function writeSnapshot() {
    try {
        const arc = await import('../../../worker/bots/adaptive-rate-control.js');
        const enforcer = await import('../../../worker/bots/behavior-enforcer.js');
        const snapshot = arc.getAllPlatformsMetrics();
        const counters = enforcer.getErrorCounters();

        const entry = {
            ts: new Date().toISOString(),
            platforms: snapshot.platforms,
            totals: snapshot.totals,
            error_counters: {
                AccountBusyError: counters.AccountBusyError,
                BurstPreventedError: counters.BurstPreventedError,
                RateLimitExceededError: counters.RateLimitExceededError,
                QuarantineError: counters.QuarantineError,
                SessionExpiredError: counters.SessionExpiredError,
            },
            uptime_ms: Date.now() - counters.startedAt,
        };

        const dir = path.dirname(_snapshotPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(_snapshotPath, JSON.stringify(entry) + '\n');
        logger.info(
            `[SoakSnapshot] wrote daily snapshot (${snapshot.platforms.length} platforms, ${snapshot.totals.quarantine_count} quarantined)`,
        );
    } catch (err) {
        logger.warn('[SoakSnapshot] snapshot failed:', err.message);
    }
}

export function init({ intervalMs = DEFAULT_INTERVAL_MS, snapshotPath = DEFAULT_PATH } = {}) {
    if (_interval) return;
    _snapshotPath = snapshotPath;

    // One snapshot on boot so we have a day-0 baseline even if the process restarts early
    writeSnapshot();

    _interval = setInterval(writeSnapshot, intervalMs);
    if (_interval.unref) _interval.unref();
    logger.info(`[SoakSnapshot] scheduled every ${intervalMs}ms → ${_snapshotPath}`);
}

export function stop() {
    if (_interval) {
        clearInterval(_interval);
        _interval = null;
    }
}

export function _triggerSnapshotForTests() {
    return writeSnapshot();
}
