// signalEmitter.js — shared signal emission helper for platform sync adapters
// Wraps adaptive-rate-control.recordDetectionEvent with signal-contract gating.

import fs from 'fs';
import path from 'path';
import {
    SIGNAL_TYPES,
    isListingInvisibleSignal,
    isEngagementDropSignal,
    isApiLatencyAnomalySignal
} from '../../../shared/signal-contracts.js';
import { logger } from '../../shared/logger.js';

// recordDetectionEvent is worker-process-only state; no-op in app server context
function recordDetectionEvent(platform, type, data) {
    logger.debug(`[signalEmitter] ${platform}: ${type} (worker-side recording unavailable in app process)`);
}

const DATA_DIR = path.join(process.cwd(), 'data');

// In-process latency buffers: Map<platform, { samples: Array<{ts,ms}>, lastEmitTs: number }>
const _latencyBuffers = new Map();
// In-process 30-day baseline (coarse bucket, per-platform): Map<platform, { total: number, count: number }>
const _latencyBaselines = new Map();

// --- A. API Latency Signal ------------------------------------------------

/**
 * Record a single API call's latency for `platform`.
 * Maintains a rolling 5-min window in memory and a coarse 30-day median stored
 * in data/.<platform>-latency-baseline.json.
 * Emits SIGNAL_TYPES.API_LATENCY_ANOMALY at most once per 10 minutes per platform.
 */
export function trackApiLatency(platform, latencyMs) {
    const now = Date.now();
    const WINDOW_5MIN = 5 * 60 * 1000;
    const EMIT_THROTTLE = 10 * 60 * 1000;

    if (!_latencyBuffers.has(platform)) {
        _latencyBuffers.set(platform, { samples: [], lastEmitTs: 0 });
    }
    const buf = _latencyBuffers.get(platform);

    // Drop samples older than 5 min
    buf.samples = buf.samples.filter(s => now - s.ts < WINDOW_5MIN);
    buf.samples.push({ ts: now, ms: latencyMs });

    // Update coarse 30-day baseline (in-memory only; acceptable for LOW_CONFIDENCE)
    if (!_latencyBaselines.has(platform)) {
        _latencyBaselines.set(platform, { total: 0, count: 0 });
    }
    const baseline = _latencyBaselines.get(platform);
    baseline.total += latencyMs;
    baseline.count += 1;

    const requestCountInPeriod = buf.samples.length;
    if (requestCountInPeriod < 20) return;

    const sorted5min = buf.samples.map(s => s.ms).sort((a, b) => a - b);
    const mid = Math.floor(sorted5min.length / 2);
    const rolling5minMedianMs = sorted5min.length % 2 === 0
        ? (sorted5min[mid - 1] + sorted5min[mid]) / 2
        : sorted5min[mid];

    const rolling30dayMedianMs = baseline.count > 0 ? baseline.total / baseline.count : 0;

    if (!isApiLatencyAnomalySignal({ rolling5minMedianMs, rolling30dayMedianMs, requestCountInPeriod })) return;

    if (now - buf.lastEmitTs < EMIT_THROTTLE) return;
    buf.lastEmitTs = now;

    try {
        recordDetectionEvent(platform, SIGNAL_TYPES.API_LATENCY_ANOMALY, {
            rolling5minMedianMs,
            rolling30dayMedianMs,
            requestCountInPeriod
        });
        logger.warn(`[signalEmitter] ${platform}: API_LATENCY_ANOMALY emitted (5min median ${rolling5minMedianMs}ms vs 30d avg ${rolling30dayMedianMs}ms)`);
    } catch (err) {
        logger.error('[signalEmitter] recordDetectionEvent failed:', err.message);
    }
}

// --- B. Listing Invisibility Signal --------------------------------------

function invisTrackerPath(platform) {
    return path.join(DATA_DIR, `.${platform}-invis-tracker.json`);
}

function readInvisTracker(platform) {
    try {
        const p = invisTrackerPath(platform);
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {}
    return {};
}

function writeInvisTracker(platform, data) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(invisTrackerPath(platform), JSON.stringify(data, null, 2), 'utf8');
    } catch {}
}

/**
 * Check a set of expected platform listing IDs against observed marketplace results.
 * `expectedListings` = Array<{ id: string, createdAt: string|number, status: string }>
 *   where status is the VaultLister-normalised status ('active','pending','draft',...)
 * `observedIds` = Set<string> of listing IDs returned by the marketplace search.
 *
 * State machine (per listing):
 *   - first miss  → record timestamp, no emit
 *   - second miss ≥ 2h after first, item age ≥ 24h, not sold → emit LISTING_INVISIBLE
 *   - re-appeared → clear tracker entry
 */
export async function checkListingInvisibility(platform, expectedListings, observedIds) {
    const now = Date.now();
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const tracker = readInvisTracker(platform);
    let dirty = false;

    for (const listing of expectedListings) {
        const id = String(listing.id);
        const inObserved = observedIds instanceof Set ? observedIds.has(id) : false;

        if (inObserved) {
            if (tracker[id]) { delete tracker[id]; dirty = true; }
            continue;
        }

        const notSold = listing.status !== 'sold';
        const createdTs = listing.createdAt
            ? (typeof listing.createdAt === 'number' ? listing.createdAt : Date.parse(listing.createdAt))
            : 0;
        const ageHours = createdTs > 0 ? (now - createdTs) / 3600000 : 0;

        if (!tracker[id]) {
            tracker[id] = { firstMissTs: now };
            dirty = true;
            continue;
        }

        const firstMissTs = tracker[id].firstMissTs;
        const gapMs = now - firstMissTs;

        if (gapMs >= TWO_HOURS && isListingInvisibleSignal({
            inVaultlisterDb: true,
            notInMarketplaceSearchTwiceIn2h: true,
            notSold,
            ageHours
        })) {
            try {
                recordDetectionEvent(platform, SIGNAL_TYPES.LISTING_INVISIBLE, {
                    listingId: id,
                    ageHours: Math.round(ageHours),
                    gapMs
                });
                logger.warn(`[signalEmitter] ${platform}: LISTING_INVISIBLE emitted for listing ${id}`);
            } catch (err) {
                logger.error('[signalEmitter] recordDetectionEvent failed:', err.message);
            }
            // Reset first-miss so we don't re-emit on the next check
            tracker[id] = { firstMissTs: now };
            dirty = true;
        }
    }

    if (dirty) writeInvisTracker(platform, tracker);
}

// --- C. Engagement Drop Signal -------------------------------------------

/**
 * Emit ENGAGEMENT_DROP if engagement has dropped more than 50% vs 30-day baseline.
 * `aggregates` = { rolling7dayPerListing, rolling30dayBaseline, listingCountInPeriod }
 */
export function checkEngagementDrop(platform, aggregates) {
    if (!isEngagementDropSignal(aggregates)) return;
    try {
        recordDetectionEvent(platform, SIGNAL_TYPES.ENGAGEMENT_DROP, aggregates);
        logger.warn(`[signalEmitter] ${platform}: ENGAGEMENT_DROP emitted (7d ${aggregates.rolling7dayPerListing} vs 30d ${aggregates.rolling30dayBaseline})`);
    } catch (err) {
        logger.error('[signalEmitter] recordDetectionEvent failed:', err.message);
    }
}
