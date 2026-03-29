// Auto-Sync Scheduler for VaultLister
// Queues sync tasks for shops that are due based on their auto_sync_interval_minutes setting

import { query } from '../db/database.js';
import { queueTask } from '../workers/taskWorker.js';
import { logger } from '../shared/logger.js';

const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

let schedulerInterval = null;

/**
 * Start the auto-sync scheduler
 */
export function startSyncScheduler() {
    if (schedulerInterval) {
        logger.info('[SyncScheduler] Already running');
        return;
    }

    logger.info('[SyncScheduler] Starting auto-sync scheduler (check interval: 60s)');

    // Run immediately on start
    checkAndQueueDueShops();

    schedulerInterval = setInterval(checkAndQueueDueShops, CHECK_INTERVAL_MS);

    logger.info('[SyncScheduler] Started');
}

/**
 * Stop the auto-sync scheduler
 */
export function stopSyncScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        logger.info('[SyncScheduler] Stopped');
    }
}

/**
 * Find shops due for auto-sync and queue a sync task for each
 */
async function checkAndQueueDueShops() {
    try {
        let dueShops;
        try {
            dueShops = await query.all(`
                SELECT id, user_id, platform, sync_status, auto_sync_interval_minutes
                FROM shops
                WHERE auto_sync_enabled = 1
                  AND is_connected = TRUE
                  AND connection_type = 'oauth'
                  AND sync_status != 'syncing'
                  AND (
                      last_sync_at IS NULL
                      OR last_sync_at + (auto_sync_interval_minutes * INTERVAL '1 minute') < NOW()
                  )
            `);
        } catch (err) {
            if (err.message.includes('no such column')) {
                // Migration not yet applied — skip silently
                return;
            }
            throw err;
        }

        if (dueShops.length === 0) {
            return;
        }

        logger.info(`[SyncScheduler] ${dueShops.length} shop(s) due for auto-sync`);

        for (const shop of dueShops) {
            try {
                queueTask('sync_shop', { platform: shop.platform, shopId: shop.id, userId: shop.user_id });
                logger.info(`[SyncScheduler] Queued auto-sync for ${shop.platform} (shop: ${shop.id}, user: ${shop.user_id})`);
            } catch (err) {
                logger.error(`[SyncScheduler] Failed to queue sync for shop ${shop.id}:`, err.message);
            }
        }
    } catch (error) {
        logger.error('[SyncScheduler] Error in checkAndQueueDueShops:', error);
    }
}
