// Price Check Worker for VaultLister
// Polls supplier item prices and triggers alerts for price drops

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { createNotification } from '../services/notificationService.js';
import { logger } from '../shared/logger.js';

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ITEMS_PER_CYCLE = 50;
const CHECK_DELAY_MS = 500; // Delay between checks to avoid rate limiting

let pollInterval = null;
let isRunning = false;
let lastRun = 0;

/**
 * Start the price check worker
 */
export function startPriceCheckWorker() {
    if (pollInterval) {
        logger.info('[PriceCheckWorker] Already running');
        return;
    }

    logger.info('[PriceCheckWorker] Starting price check worker...');

    // Run immediately on start
    runPriceChecks().catch(err => {
        logger.error('[PriceCheckWorker] Initial check failed:', err);
    });

    // Schedule regular checks
    pollInterval = setInterval(() => {
        runPriceChecks().catch(err => {
            logger.error('[PriceCheckWorker] Scheduled check failed:', err);
        });
    }, POLL_INTERVAL_MS);

    logger.info(`[PriceCheckWorker] Scheduled to run every ${POLL_INTERVAL_MS / 60000} minutes`);
}

/**
 * Stop the price check worker
 */
export function stopPriceCheckWorker() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        logger.info('[PriceCheckWorker] Stopped');
    }
}

/**
 * Run price checks for all monitored items
 */
async function runPriceChecks() {
    if (isRunning) {
        logger.info('[PriceCheckWorker] Check already in progress, skipping');
        return;
    }
    lastRun = Date.now();

    isRunning = true;
    logger.info('[PriceCheckWorker] Starting price check cycle...');

    try {
        // Get items due for checking (ordered by last_checked_at)
        const items = query.all(`
            SELECT si.*, s.name as supplier_name, s.user_id
            FROM supplier_items si
            JOIN suppliers s ON si.supplier_id = s.id
            WHERE si.alert_enabled = 1
            AND s.is_active = 1
            ORDER BY si.last_checked_at ASC NULLS FIRST
            LIMIT ?
        `, [MAX_ITEMS_PER_CYCLE]);

        logger.info(`[PriceCheckWorker] Checking ${items.length} items`);

        let priceDrops = 0;
        let targetsHit = 0;

        for (const item of items) {
            try {
                const result = await checkItemPrice(item);

                if (result.priceDrop) {
                    priceDrops++;
                }
                if (result.targetHit) {
                    targetsHit++;
                }

                // Small delay between checks
                await sleep(CHECK_DELAY_MS);

            } catch (error) {
                logger.error(`[PriceCheckWorker] Error checking item ${item.id}:`, error.message);
            }
        }

        logger.info(`[PriceCheckWorker] Completed. Price drops: ${priceDrops}, Targets hit: ${targetsHit}`);

    } catch (error) {
        logger.error('[PriceCheckWorker] Cycle failed:', error);
    } finally {
        isRunning = false;
    }
}

/**
 * Check price for a single item
 * @param {Object} item - Supplier item record
 * @returns {Object} Check result
 */
async function checkItemPrice(item) {
    const result = { priceDrop: false, targetHit: false };

    // Simulate fetching new price (in production, would scrape or use API)
    const newPrice = await simulatePriceFetch(item);

    if (newPrice === null) {
        // Couldn't get price, update last checked time only
        query.run(`
            UPDATE supplier_items SET last_checked_at = datetime('now')
            WHERE id = ?
        `, [item.id]);
        return result;
    }

    const oldPrice = item.current_price || newPrice;
    const priceChange = newPrice - oldPrice;
    const changePercent = oldPrice > 0 ? (priceChange / oldPrice) : 0;

    // Update item with new price
    query.run(`
        UPDATE supplier_items SET
            last_price = current_price,
            current_price = ?,
            price_change = ?,
            last_checked_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
    `, [newPrice, priceChange, item.id]);

    // Record price history
    try {
        query.run(`
            INSERT INTO supplier_price_history (id, supplier_item_id, price, recorded_at)
            VALUES (?, ?, ?, datetime('now'))
        `, [uuidv4(), item.id, newPrice]);
    } catch (err) {
        // Table might not exist
    }

    // Check for alerts
    const dropThreshold = item.alert_threshold || 0.10;

    // Check if price dropped by threshold percentage
    if (priceChange < 0 && Math.abs(changePercent) >= dropThreshold) {
        result.priceDrop = true;

        await createNotification(item.user_id, {
            type: 'price_drop',
            title: 'Price Drop Alert',
            message: `"${item.name}" dropped ${Math.abs(Math.round(changePercent * 100))}% to $${newPrice.toFixed(2)} at ${item.supplier_name}`,
            data: {
                supplier_item_id: item.id,
                supplier_id: item.supplier_id,
                old_price: oldPrice,
                new_price: newPrice,
                change_percent: changePercent
            },
            important: true
        });

        logger.info(`[PriceCheckWorker] Price drop: ${item.name} - $${oldPrice} -> $${newPrice}`);
    }

    // Check if price hit target
    if (item.target_price && newPrice <= item.target_price && (oldPrice > item.target_price || !item.last_price)) {
        result.targetHit = true;

        await createNotification(item.user_id, {
            type: 'target_price_hit',
            title: 'Target Price Reached!',
            message: `"${item.name}" is now $${newPrice.toFixed(2)} (your target: $${item.target_price.toFixed(2)}) at ${item.supplier_name}`,
            data: {
                supplier_item_id: item.id,
                supplier_id: item.supplier_id,
                current_price: newPrice,
                target_price: item.target_price
            },
            important: true
        });

        logger.info(`[PriceCheckWorker] Target hit: ${item.name} at $${newPrice}`);
    }

    return result;
}

/**
 * Simulate fetching price from supplier
 * In production, this would scrape the URL or use an API
 * @param {Object} item - Supplier item
 * @returns {number|null} New price or null
 */
async function simulatePriceFetch(item) {
    // Simulate network delay
    const secureFloat = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967295;
    await sleep(100 + secureFloat() * 200);

    // 5% chance of failing to get price
    if (secureFloat() < 0.05) {
        return null;
    }

    const currentPrice = item.current_price || 50;

    // Simulate price fluctuation
    // 70% - no change
    // 15% - small drop (1-5%)
    // 10% - small increase (1-5%)
    // 4% - significant drop (5-15%)
    // 1% - significant drop (15-30%)
    const random = secureFloat();

    let multiplier = 1.0;
    if (random < 0.01) {
        // Significant drop
        multiplier = 0.70 + secureFloat() * 0.15; // 15-30% off
    } else if (random < 0.05) {
        // Medium drop
        multiplier = 0.85 + secureFloat() * 0.10; // 5-15% off
    } else if (random < 0.20) {
        // Small drop
        multiplier = 0.95 + secureFloat() * 0.04; // 1-5% off
    } else if (random < 0.30) {
        // Small increase
        multiplier = 1.01 + secureFloat() * 0.04; // 1-5% up
    }
    // else: no change (multiplier stays 1.0)

    const newPrice = currentPrice * multiplier;
    return Math.round(newPrice * 100) / 100;
}

/**
 * Manually trigger a price check for specific items
 * @param {Array} itemIds - Item IDs to check
 * @returns {Object} Results
 */
export async function triggerPriceCheck(itemIds) {
    const results = { checked: 0, drops: 0, targets: 0, errors: [] };

    for (const itemId of itemIds) {
        try {
            const item = query.get(`
                SELECT si.*, s.name as supplier_name, s.user_id
                FROM supplier_items si
                JOIN suppliers s ON si.supplier_id = s.id
                WHERE si.id = ?
            `, [itemId]);

            if (!item) {
                results.errors.push({ itemId, error: 'Item not found' });
                continue;
            }

            const result = await checkItemPrice(item);
            results.checked++;

            if (result.priceDrop) results.drops++;
            if (result.targetHit) results.targets++;

        } catch (error) {
            results.errors.push({ itemId, error: error.message });
        }
    }

    return results;
}

/**
 * Get worker status
 */
export function getPriceCheckWorkerStatus() {
    return {
        running: pollInterval !== null,
        checking: isRunning,
        intervalMs: POLL_INTERVAL_MS,
        lastRun: lastRun ? new Date(lastRun).toISOString() : null
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
    startPriceCheckWorker,
    stopPriceCheckWorker,
    triggerPriceCheck,
    getPriceCheckWorkerStatus
};
