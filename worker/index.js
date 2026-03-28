#!/usr/bin/env bun
// VaultLister Playwright Worker
// Processes browser automation jobs from BullMQ 'automation-jobs' queue.
//
// Required env vars: REDIS_URL, DATABASE_URL

import { Worker, QueueEvents } from 'bullmq';
import { query, initializeDatabase, closeDatabase } from '../src/backend/db/database.js';
import { logger } from '../src/backend/shared/logger.js';

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
    logger.error('[Worker] REDIS_URL is required', { missingVar: 'REDIS_URL' });
    process.exit(1);
}
if (!process.env.DATABASE_URL) {
    logger.error('[Worker] DATABASE_URL is required', { missingVar: 'DATABASE_URL' });
    process.exit(1);
}

await initializeDatabase();
logger.info('[Worker] Database connected');

const connection = { url: REDIS_URL };

// Stale job detection: mark tasks stuck in 'active' state for > 10 minutes as failed
const STALE_JOB_THRESHOLD_MS = 10 * 60 * 1000;
async function cleanStaleJobs() {
    try {
        const staleRows = await query.all(
            `SELECT id FROM tasks WHERE status = 'processing'
             AND started_at < NOW() - INTERVAL '10 minutes'`,
            []
        );
        if (staleRows.length > 0) {
            const ids = staleRows.map(r => r.id);
            const placeholders = ids.map(() => '?').join(',');
            await query.run(
                `UPDATE tasks SET status = 'failed', error_message = 'Job timed out (stale active state)'
                 WHERE id IN (${placeholders})`,
                ids
            );
            logger.warn(`[Worker] Cleaned ${staleRows.length} stale active job(s)`);
        }
    } catch (err) {
        logger.error('[Worker] Stale job cleanup error:', err.message);
    }
}

// Run stale job cleanup every 5 minutes
const staleCleanupInterval = setInterval(cleanStaleJobs, 5 * 60 * 1000);

const worker = new Worker('automation-jobs', async (job) => {
    const { taskId, userId, type, payload } = job.data;

    logger.info(`[Worker] Job ${job.id}: type=${type} taskId=${taskId}`);

    if (taskId) {
        await query.run('UPDATE tasks SET status = ?, started_at = NOW() WHERE id = ?', ['processing', taskId]);
    }

    let result;

    try {
        switch (type) {
            case 'share_listing': {
                const { getPoshmarkBot } = await import('./bots/poshmark-bot.js');
                const listing = await query.get(
                    'SELECT * FROM listings WHERE id = ? AND user_id = ?',
                    [payload.listingId, userId]
                );
                if (!listing) throw new Error('Listing not found');
                const bot = await getPoshmarkBot({ headless: true });
                try {
                    const success = await bot.shareItem(listing.platform_url);
                    if (success) {
                        await query.run(
                            'UPDATE listings SET last_shared_at = NOW(), shares = shares + 1 WHERE id = ?',
                            [listing.id]
                        );
                    }
                    result = { success, listingId: listing.id };
                } finally {
                    await bot.close().catch(() => {});
                }
                break;
            }

            case 'share_closet': {
                const { getPoshmarkBot } = await import('./bots/poshmark-bot.js');
                const { platform = 'poshmark', maxShares = 100 } = payload;
                const shop = await query.get(
                    'SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = 1',
                    [userId, platform]
                );
                if (!shop) throw new Error('Shop not connected');
                const bot = await getPoshmarkBot({ headless: true });
                try {
                    const shared = await bot.shareCloset(shop.platform_username, { maxShares });
                    result = { success: true, shared };
                } finally {
                    await bot.close().catch(() => {});
                }
                break;
            }

            case 'follow_user': {
                const { getPoshmarkBot } = await import('./bots/poshmark-bot.js');
                const { platform = 'poshmark', username } = payload;
                const bot = await getPoshmarkBot({ headless: true });
                try {
                    const success = await bot.followUser(username);
                    result = { success, username };
                } finally {
                    await bot.close().catch(() => {});
                }
                break;
            }

            case 'follow_back': {
                const { getPoshmarkBot } = await import('./bots/poshmark-bot.js');
                const { platform = 'poshmark', maxFollows = 50 } = payload;
                const bot = await getPoshmarkBot({ headless: true });
                try {
                    const followed = await bot.followBackFollowers(maxFollows);
                    result = { success: true, followed };
                } finally {
                    await bot.close().catch(() => {});
                }
                break;
            }

            default:
                throw new Error(`Unknown job type: ${type}`);
        }

        if (taskId) {
            await query.run(
                'UPDATE tasks SET status = ?, result = ?, completed_at = NOW() WHERE id = ?',
                ['completed', JSON.stringify(result), taskId]
            );
        }

        logger.info(`[Worker] Job ${job.id} completed`, result);
        return result;

    } catch (error) {
        if (taskId) {
            await query.run(
                'UPDATE tasks SET status = ?, error_message = ? WHERE id = ?',
                ['failed', error.message, taskId]
            );
        }
        logger.error(`[Worker] Job ${job.id} failed: ${error.message}`);
        throw error;
    }
}, {
    connection,
    concurrency: 1,
    // Default job options applied when not overridden per-job
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        timeout: 300000 // 5 min for bot jobs
    }
});

worker.on('completed', (job) => logger.info(`[Worker] Job ${job.id} done`));
worker.on('failed', (job, err) => logger.error(`[Worker] Job ${job?.id} error: ${err.message}`));

logger.info('[Worker] Listening on queue: automation-jobs');

// Graceful shutdown
async function shutdown() {
    logger.info('[Worker] Shutting down...');
    clearInterval(staleCleanupInterval);
    await worker.close();
    await closeDatabase();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
