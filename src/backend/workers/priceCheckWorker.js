// Price Check Worker for VaultLister
// Polls supplier item prices and triggers alerts for price drops

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { createNotification } from '../services/notificationService.js';
import { set as setRedisValue } from '../services/redis.js';
import { acquireRedisLock } from '../services/redisLock.js';
import { logger } from '../shared/logger.js';
import { TIMEOUTS } from '../shared/constants.js';

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function isPrivatePriceUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        if (!['https:', 'http:'].includes(parsed.protocol)) return true;
        const h = parsed.hostname.toLowerCase();
        return h === 'localhost' || h === '::1' || h === '0.0.0.0' ||
            /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|127\.)/.test(h) ||
            h.startsWith('fe80:') || h.startsWith('fc00:') || h.startsWith('fd00:') ||
            h.startsWith('::ffff:') || h.endsWith('.internal') || h.endsWith('.local');
    } catch {
        return true;
    }
}
const MAX_ITEMS_PER_CYCLE = 50;
const CHECK_DELAY_MS = 500; // Delay between checks to avoid rate limiting
const HEARTBEAT_KEY = 'worker:health:priceCheckWorker';
const HEARTBEAT_TTL_SECONDS = 7200;
const PRICE_CHECK_LOCK_KEY = 'worker:lock:priceCheckWorker';
const PRICE_CHECK_LOCK_TTL_MS = 45 * 60 * 1000;

let pollInterval = null;
let isRunning = false;
let lastRun = 0;

async function writeHeartbeat() {
    await setRedisValue(
        HEARTBEAT_KEY,
        JSON.stringify({ lastRun: new Date(lastRun).toISOString(), status: 'running' }),
        HEARTBEAT_TTL_SECONDS
    );
}

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
    const lock = await acquireRedisLock(
        PRICE_CHECK_LOCK_KEY,
        PRICE_CHECK_LOCK_TTL_MS,
        { name: 'price check worker' }
    );

    if (!lock.acquired) {
        isRunning = false;
        return;
    }

    logger.info('[PriceCheckWorker] Starting price check cycle...');

    try {
        // Get items due for checking (ordered by last_checked_at)
        const items = await query.all(`
            SELECT si.*, s.name as supplier_name, s.user_id
            FROM supplier_items si
            JOIN suppliers s ON si.supplier_id = s.id
            WHERE si.alert_enabled = 1
            AND s.is_active = TRUE
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
        try {
            await writeHeartbeat();
        } catch (heartbeatError) {
            logger.warn('[PriceCheckWorker] Failed to write heartbeat', null, { detail: heartbeatError.message });
        }
        await lock.release();
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

    // Fetch current price from the item's source URL via JSON-LD / OG meta scraping
    const { price: newPrice, source: priceSource } = await fetchPriceFromUrl(item);

    if (newPrice === null) {
        // Couldn't get price, update last checked time only
        await query.run(`
            UPDATE supplier_items SET last_checked_at = NOW()
            WHERE id = ?
        `, [item.id]);
        return result;
    }

    const oldPrice = item.current_price || newPrice;
    const priceChange = newPrice - oldPrice;
    const changePercent = oldPrice > 0 ? (priceChange / oldPrice) : 0;

    // Update item with new price
    await query.run(`
        UPDATE supplier_items SET
            last_price = current_price,
            current_price = ?,
            price_change = ?,
            last_checked_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
    `, [newPrice, priceChange, item.id]);

    // Record price history — include _source so callers can distinguish live
    // scrapes from mock/unavailable results
    try {
        await query.run(`
            INSERT INTO supplier_price_history (id, supplier_item_id, price, source, recorded_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [uuidv4(), item.id, newPrice, priceSource]);
    } catch (err) {
        // Fallback: table may not have source column yet
        try {
            await query.run(`
                INSERT INTO supplier_price_history (id, supplier_item_id, price, recorded_at)
                VALUES (?, ?, ?, NOW())
            `, [uuidv4(), item.id, newPrice]);
        } catch (_) { /* Table might not exist */ }
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
 * Fetch current price from supplier URL via JSON-LD Product schema or OG meta tags.
 * Returns { price, source } where source is 'live' when a price was successfully
 * scraped, or 'mock' when no URL is available or the fetch/parse failed.
 * @param {Object} item - Supplier item with source_url or url
 * @returns {{ price: number|null, source: 'live'|'mock' }}
 */
async function fetchPriceFromUrl(item) {
    const url = item.source_url || item.url;
    if (!url) return { price: null, source: 'mock' };
    if (isPrivatePriceUrl(url)) {
        logger.warn('[PriceCheckWorker] Blocked private/internal URL', { url });
        return { price: null, source: 'mock' };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUTS.FETCH_ABORT_MS);

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VaultLister/3.0; +https://vaultlister.com)' },
            signal: controller.signal,
            redirect: 'follow'
        });
        clearTimeout(timeout);

        if (!response.ok) return { price: null, source: 'mock' };

        const html = await response.text();

        // Try JSON-LD Product schema first
        const jsonLdMatch = html.match(/<script[^>]*type\s*=\s*"application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatch) {
            for (const match of jsonLdMatch) {
                try {
                    const jsonStr = match.replace(/<\/?script[^>]*(>|$)/gi, '');
                    const data = JSON.parse(jsonStr);
                    const product = data['@type'] === 'Product' ? data : (Array.isArray(data['@graph']) ? data['@graph'].find(i => i['@type'] === 'Product') : null);
                    if (product?.offers) {
                        const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                        const price = parseFloat(offer.price || offer.lowPrice);
                        if (!isNaN(price) && price > 0) return { price: Math.round(price * 100) / 100, source: 'live' };
                    }
                } catch {}
            }
        }

        // Fall back to OG meta tags
        const ogPriceMatch = html.match(/<meta[^>]*property\s*=\s*"product:price:amount"[^>]*content\s*=\s*"([^"]+)"/i);
        if (ogPriceMatch) {
            const price = parseFloat(ogPriceMatch[1]);
            if (!isNaN(price) && price > 0) return { price: Math.round(price * 100) / 100, source: 'live' };
        }

        // Fall back to generic price pattern in meta
        const priceMetaMatch = html.match(/<meta[^>]*(?:name|property)\s*=\s*"(?:og:)?price"[^>]*content\s*=\s*"([^"]+)"/i);
        if (priceMetaMatch) {
            const price = parseFloat(priceMetaMatch[1].replace(/[^0-9.]/g, ''));
            if (!isNaN(price) && price > 0) return { price: Math.round(price * 100) / 100, source: 'live' };
        }

        return { price: null, source: 'mock' };
    } catch (err) {
        logger.warn('[PriceCheckWorker] Price fetch failed for ' + url + ': ' + err.message);
        return { price: null, source: 'mock' };
    }
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
            const item = await query.get(`
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
        interval_ms: POLL_INTERVAL_MS,
        interval_minutes: POLL_INTERVAL_MS / 60000,
        max_items_per_cycle: MAX_ITEMS_PER_CYCLE,
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
