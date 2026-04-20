// Mercari Cancellation Rate Tracker
// Per spec Layer 6 / Gap #14: Mercari monitors seller cancellation rates
// and suspends accounts that cancel too frequently. VaultLister's multi-platform
// inventory sync can cause offer cancellations when items sell elsewhere.
//
// This module tracks cancellation rates per platform and blocks offer acceptance
// when the rate approaches dangerous thresholds.

import fs from 'fs';
import path from 'path';
import { logger } from '../../shared/logger.js';

const TRACKER_PATH = path.join(process.cwd(), 'data', '.cancellation-tracker.json');
const WARNING_RATE = 0.08;  // 8% — start warning
const BLOCK_RATE = 0.15;    // 15% — block offer acceptance
const ROLLING_WINDOW_DAYS = 30;

function readTracker() {
    try {
        if (fs.existsSync(TRACKER_PATH)) {
            return JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf8'));
        }
    } catch {}
    return {};
}

function writeTracker(data) {
    try { fs.writeFileSync(TRACKER_PATH, JSON.stringify(data, null, 2), 'utf8'); } catch {}
}

function getAccountData(tracker, platform, accountId) {
    const key = `${platform}:${accountId}`;
    if (!tracker[key]) {
        tracker[key] = { transactions: [], cancellations: [] };
    }
    // Prune old entries outside rolling window
    const cutoff = new Date(Date.now() - ROLLING_WINDOW_DAYS * 86400000).toISOString();
    tracker[key].transactions = tracker[key].transactions.filter(t => t >= cutoff);
    tracker[key].cancellations = tracker[key].cancellations.filter(t => t >= cutoff);
    return tracker[key];
}

/**
 * Record a completed transaction (offer accepted + fulfilled).
 */
export function recordTransaction(platform, accountId) {
    const tracker = readTracker();
    const data = getAccountData(tracker, platform, accountId);
    data.transactions.push(new Date().toISOString());
    writeTracker(tracker);
}

/**
 * Record a cancellation.
 */
export function recordCancellation(platform, accountId, reason = '') {
    const tracker = readTracker();
    const data = getAccountData(tracker, platform, accountId);
    data.cancellations.push(new Date().toISOString());
    writeTracker(tracker);
    logger.warn(`[CancellationTracker] Cancellation recorded: ${platform}/${accountId}`, { reason });
}

/**
 * Get the current cancellation rate for an account.
 * @returns {{ rate: number, transactions: number, cancellations: number, status: 'OK'|'WARNING'|'BLOCKED' }}
 */
export function getCancellationRate(platform, accountId) {
    const tracker = readTracker();
    const data = getAccountData(tracker, platform, accountId);
    const total = data.transactions.length + data.cancellations.length;
    if (total === 0) return { rate: 0, transactions: 0, cancellations: 0, status: 'OK' };

    const rate = data.cancellations.length / total;
    let status = 'OK';
    if (rate >= BLOCK_RATE) status = 'BLOCKED';
    else if (rate >= WARNING_RATE) status = 'WARNING';

    return {
        rate: parseFloat(rate.toFixed(3)),
        transactions: data.transactions.length,
        cancellations: data.cancellations.length,
        status,
    };
}

/**
 * Check if it's safe to accept an offer on a platform.
 * Returns false if cancellation rate is too high.
 */
export function canAcceptOffer(platform, accountId) {
    const { rate, status, cancellations } = getCancellationRate(platform, accountId);
    if (status === 'BLOCKED') {
        logger.error(`[CancellationTracker] Offer acceptance BLOCKED for ${platform}/${accountId} — cancellation rate ${(rate * 100).toFixed(1)}% (${cancellations} cancellations in ${ROLLING_WINDOW_DAYS} days)`);
        return false;
    }
    if (status === 'WARNING') {
        logger.warn(`[CancellationTracker] High cancellation rate for ${platform}/${accountId} — ${(rate * 100).toFixed(1)}%. Approaching block threshold.`);
    }
    return true;
}

export default { recordTransaction, recordCancellation, getCancellationRate, canAcceptOffer };
