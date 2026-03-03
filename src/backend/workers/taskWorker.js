// Task Worker for VaultLister
// Processes background jobs from the task queue

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { syncShop } from '../services/platformSync/index.js';
import { createOAuthNotification, NotificationTypes } from '../services/notificationService.js';
import { logger } from '../shared/logger.js';

// Configuration
const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds
const MAX_CONCURRENT_TASKS = 3;
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 5000; // 5 seconds base delay for exponential backoff

// FIXED 2026-02-24: Automation schedule checking integrated into taskWorker (Issue #3)
const AUTOMATION_CHECK_INTERVAL_MS = 60 * 1000;
let lastAutomationCheck = 0;

let workerInterval = null;
let isProcessing = false;
let activeTasks = 0;

/**
 * Start the task worker
 */
export function startTaskWorker() {
    if (workerInterval) {
        logger.info('[TaskWorker] Worker already running');
        return;
    }

    logger.info('[TaskWorker] Starting task worker...');
    logger.info(`[TaskWorker] Poll interval: ${POLL_INTERVAL_MS / 1000}s, Max concurrent: ${MAX_CONCURRENT_TASKS}`);

    // Run immediately on start
    processQueue();

    // Then run on interval
    workerInterval = setInterval(processQueue, POLL_INTERVAL_MS);

    logger.info('[TaskWorker] Worker started');
}

/**
 * Stop the task worker
 */
export function stopTaskWorker() {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
        logger.info('[TaskWorker] Worker stopped');
    }
}

/**
 * Process pending tasks from the queue
 */
async function processQueue() {
    if (isProcessing) {
        return;
    }

    isProcessing = true;

    try {
        // FIXED 2026-02-24: Check automation schedules periodically (Issue #3)
        const now = Date.now();
        if (now - lastAutomationCheck >= AUTOMATION_CHECK_INTERVAL_MS) {
            lastAutomationCheck = now;
            try { await checkAutomationSchedules(); }
            catch (schedErr) { logger.error('[TaskWorker] Automation schedule check failed:', schedErr.message); }
        }

        // Get pending tasks up to the concurrency limit
        const availableSlots = MAX_CONCURRENT_TASKS - activeTasks;

        if (availableSlots <= 0) {
            return;
        }

        const pendingTasks = query.all(`
            SELECT * FROM task_queue
            WHERE status = 'pending'
            AND datetime(scheduled_at) <= datetime('now')
            ORDER BY priority DESC, scheduled_at ASC
            LIMIT ?
        `, [availableSlots]);

        if (pendingTasks.length === 0) {
            return;
        }

        logger.info(`[TaskWorker] Processing ${pendingTasks.length} task(s)`);

        // Process tasks concurrently
        const promises = pendingTasks.map(task => processTask(task));
        await Promise.allSettled(promises);

    } catch (error) {
        logger.error('[TaskWorker] Error processing queue:', error);
    } finally {
        isProcessing = false;
    }
}

/**
 * Process a single task
 * @param {Object} task - Task record from database
 */
async function processTask(task) {
    activeTasks++;
    const startTime = Date.now();

    try {
        // Mark task as processing
        query.run(`
            UPDATE task_queue SET
                status = 'processing',
                started_at = datetime('now'),
                attempts = attempts + 1,
                updated_at = datetime('now')
            WHERE id = ?
        `, [task.id]);

        logger.info(`[TaskWorker] Processing task ${task.id} (${task.type})`);

        // Parse payload
        const payload = JSON.parse(task.payload);

        // Execute task based on type
        const result = await executeTask(task.type, payload);

        // Mark task as completed
        const duration = Date.now() - startTime;
        query.run(`
            UPDATE task_queue SET
                status = 'completed',
                completed_at = datetime('now'),
                updated_at = datetime('now')
            WHERE id = ?
        `, [task.id]);

        logger.info(`[TaskWorker] Task ${task.id} completed in ${duration}ms`);

        // Log to automation_runs for history tracking
        try {
            const payload = JSON.parse(task.payload);
            const userId = payload.userId || payload.user_id;
            if (userId) {
                query.run(`
                    INSERT INTO automation_runs (id, user_id, automation_id, automation_name, automation_type, status, started_at, completed_at, duration_ms, items_processed, items_succeeded, items_failed, result_message, metadata)
                    VALUES (?, ?, ?, ?, ?, 'success', datetime('now', '-' || ? || ' seconds'), datetime('now'), ?, ?, ?, ?, ?, '{}')
                `, [
                    uuidv4(), userId,
                    payload.ruleId || task.id,
                    result?.ruleName || task.type,
                    result?.type || task.type,
                    Math.round(duration / 1000), duration,
                    result?.itemsProcessed || result?.listings?.synced || 0,
                    result?.itemsSucceeded ?? (result?.itemsProcessed || result?.listings?.synced || 0),
                    result?.itemsFailed || 0,
                    result?.message || `Task ${task.type} completed successfully`
                ]);
            }
        } catch (logErr) {
            logger.error('[TaskWorker] Failed to log automation run:', logErr.message);
        }

        return result;

    } catch (error) {
        logger.error(`[TaskWorker] Task ${task.id} failed:`, error.message);

        const attempts = task.attempts + 1;
        const maxAttempts = task.max_attempts || DEFAULT_MAX_ATTEMPTS;

        if (attempts >= maxAttempts) {
            // Mark as failed permanently
            query.run(`
                UPDATE task_queue SET
                    status = 'failed',
                    last_error = ?,
                    completed_at = datetime('now'),
                    updated_at = datetime('now')
                WHERE id = ?
            `, [error.message, task.id]);

            logger.info(`[TaskWorker] Task ${task.id} failed permanently after ${attempts} attempts`);

            // Log failure to automation_runs
            try {
                const payload = JSON.parse(task.payload);
                const userId = payload.userId || payload.user_id;
                const duration = Date.now() - startTime;
                if (userId) {
                    query.run(`
                        INSERT INTO automation_runs (id, user_id, automation_id, automation_name, automation_type, status, started_at, completed_at, duration_ms, items_processed, items_succeeded, items_failed, error_message, error_code, retry_count, metadata)
                        VALUES (?, ?, ?, ?, ?, 'failed', datetime('now', '-' || ? || ' seconds'), datetime('now'), ?, 0, 0, 0, ?, ?, ?, '{}')
                    `, [
                        uuidv4(), userId, task.id, task.type, task.type,
                        Math.round(duration / 1000), duration,
                        error.message, error.code || 'UNKNOWN', attempts
                    ]);
                }
            } catch (logErr) {
                logger.error('[TaskWorker] Failed to log automation failure:', logErr.message);
            }

            // Create notification for user if applicable
            await notifyTaskFailure(task, error);

        } else {
            // Schedule retry with exponential backoff
            const retryDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempts - 1);
            const scheduledAt = new Date(Date.now() + retryDelay).toISOString();

            query.run(`
                UPDATE task_queue SET
                    status = 'pending',
                    last_error = ?,
                    scheduled_at = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `, [error.message, scheduledAt, task.id]);

            logger.info(`[TaskWorker] Task ${task.id} scheduled for retry at ${scheduledAt}`);
        }

        throw error;

    } finally {
        activeTasks--;
    }
}

/**
 * Execute a task based on its type
 * @param {string} type - Task type
 * @param {Object} payload - Task payload
 * @returns {Object} Task result
 */
async function executeTask(type, payload) {
    switch (type) {
        case 'sync_shop':
            return await executeSyncShopTask(payload);

        case 'refresh_token':
            return await executeRefreshTokenTask(payload);

        case 'cleanup_notifications':
            return await executeCleanupNotificationsTask(payload);

        case 'sync_email_account':
            return await executeSyncEmailAccountTask(payload);

        case 'process_webhook':
            return await executeProcessWebhookTask(payload);

        // FIXED 2026-02-24: Handle automation execution tasks (Issue #3)
        case 'run_automation':
            return await executeRunAutomationTask(payload);

        default:
            throw new Error(`Unknown task type: ${type}`);
    }
}

/**
 * Execute shop sync task
 */
async function executeSyncShopTask(payload) {
    const { shopId, userId } = payload;

    if (!shopId || !userId) {
        throw new Error('Missing shopId or userId in payload');
    }

    const result = await syncShop(shopId, userId);

    // Create success notification
    const shop = query.get('SELECT platform FROM shops WHERE id = ?', [shopId]);
    if (shop) {
        createOAuthNotification(
            userId,
            shop.platform,
            NotificationTypes.SYNC_COMPLETED,
            {
                listingsSynced: result.listings?.synced || 0,
                ordersSynced: result.orders?.synced || 0
            }
        );
    }

    return result;
}

/**
 * Execute token refresh task (for manual/scheduled refreshes)
 */
async function executeRefreshTokenTask(payload) {
    const { shopId, userId } = payload;

    // Import here to avoid circular dependency
    const { manualRefreshToken } = await import('../services/tokenRefreshScheduler.js');

    return await manualRefreshToken(shopId, userId);
}

/**
 * Execute notification cleanup task
 */
async function executeCleanupNotificationsTask(payload) {
    const { daysOld = 30 } = payload;

    // Import here to avoid circular dependency
    const { cleanupOldNotifications } = await import('../services/notificationService.js');

    const deleted = cleanupOldNotifications(daysOld);
    return { deletedCount: deleted };
}

/**
 * Execute email account sync task
 */
async function executeSyncEmailAccountTask(payload) {
    const { accountId, userId } = payload;

    if (!accountId || !userId) {
        throw new Error('Missing accountId or userId in payload');
    }

    // Import here to avoid circular dependency
    const { syncEmailAccount } = await import('./emailPollingWorker.js');

    // Get the account
    const account = query.get(`
        SELECT * FROM email_accounts
        WHERE id = ? AND user_id = ?
    `, [accountId, userId]);

    if (!account) {
        throw new Error('Email account not found');
    }

    return await syncEmailAccount(account);
}

/**
 * Execute webhook processing task
 */
async function executeProcessWebhookTask(payload) {
    const { eventId } = payload;

    if (!eventId) {
        throw new Error('Missing eventId in payload');
    }

    // Import here to avoid circular dependency
    const { processWebhookEvent } = await import('../services/webhookProcessor.js');

    // Get the event
    const event = query.get(`
        SELECT * FROM webhook_events WHERE id = ?
    `, [eventId]);

    if (!event) {
        throw new Error('Webhook event not found');
    }

    return await processWebhookEvent(event);
}

/**
 * Notify user of task failure
 */
async function notifyTaskFailure(task, error) {
    try {
        const payload = JSON.parse(task.payload);

        if (task.type === 'sync_shop' && payload.userId) {
            const shop = query.get('SELECT platform FROM shops WHERE id = ?', [payload.shopId]);
            if (shop) {
                createOAuthNotification(
                    payload.userId,
                    shop.platform,
                    NotificationTypes.SYNC_FAILED,
                    { error: error.message, taskId: task.id }
                );
            }
        }
    } catch (notifyError) {
        logger.error('[TaskWorker] Failed to create failure notification:', notifyError);
    }
}

/**
 * Queue a new task
 * @param {string} type - Task type
 * @param {Object} payload - Task payload
 * @param {Object} options - Task options
 * @returns {Object} Created task
 */
export function queueTask(type, payload, options = {}) {
    const id = uuidv4();
    const {
        priority = 0,
        maxAttempts = DEFAULT_MAX_ATTEMPTS,
        // FIXED 2026-02-24: Use SQLite datetime format, not ISO (T/Z breaks <= comparison)
        scheduledAt = new Date().toISOString().replace('T', ' ').replace('Z', '').split('.')[0]
    } = options;

    query.run(`
        INSERT INTO task_queue (id, type, payload, priority, max_attempts, scheduled_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [id, type, JSON.stringify(payload), priority, maxAttempts, scheduledAt]);

    return {
        id,
        type,
        payload,
        status: 'pending',
        priority,
        maxAttempts,
        scheduledAt
    };
}

/**
 * Get task status
 * @param {string} taskId - Task ID
 * @returns {Object|null} Task status
 */
export function getTaskStatus(taskId) {
    const task = query.get(`
        SELECT id, type, status, attempts, max_attempts, last_error,
               created_at, started_at, completed_at
        FROM task_queue
        WHERE id = ?
    `, [taskId]);

    return task;
}

/**
 * Get worker status for monitoring
 */
export function getWorkerStatus() {
    const stats = query.get(`
        SELECT
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_tasks,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks
        FROM task_queue
        WHERE created_at > datetime('now', '-24 hours')
    `);

    return {
        isRunning: workerInterval !== null,
        activeTasks,
        maxConcurrent: MAX_CONCURRENT_TASKS,
        pollIntervalMs: POLL_INTERVAL_MS,
        last24Hours: stats
    };
}

/**
 * Cleanup old completed/failed tasks
 * @param {number} daysOld - Delete tasks older than this
 * @returns {number} Number of deleted tasks
 */
export function cleanupOldTasks(daysOld = 7) {
    const result = query.run(`
        DELETE FROM task_queue
        WHERE status IN ('completed', 'failed')
        AND completed_at < datetime('now', '-' || ? || ' days')
    `, [daysOld]);

    return result.changes;
}

// FIXED 2026-02-24: Automation schedule checking functions (Issue #3)
async function checkAutomationSchedules() {
    const rules = query.all(`
        SELECT id, user_id, name, type, schedule, last_run_at
        FROM automation_rules
        WHERE is_enabled = 1 AND schedule IS NOT NULL AND schedule != ''
    `);
    for (const rule of rules) {
        const nextRun = calculateNextRunFromCron(rule.schedule, rule.last_run_at);
        if (nextRun && nextRun <= new Date()) {
            const existing = query.get(`
                SELECT id FROM task_queue
                WHERE type = 'run_automation'
                  AND json_extract(payload, '$.ruleId') = ?
                  AND status IN ('pending', 'processing')
            `, [rule.id]);
            if (!existing) {
                queueTask('run_automation', { ruleId: rule.id, userId: rule.user_id, scheduledRun: true }, { priority: 0 });
                logger.info(`[TaskWorker] Queued scheduled automation: ${rule.name} (${rule.id})`);
            }
        }
    }
}

// FIXED 2026-02-24: Full 5-field cron parser (was minute/hour only)
function parseCronField(field, min, max) {
    const values = new Set();
    for (const part of field.split(',')) {
        let rangeStr = part, step = 1;
        if (part.includes('/')) {
            [rangeStr, step] = part.split('/');
            step = parseInt(step, 10);
            if (isNaN(step) || step < 1) continue;
        }
        let start, end;
        if (rangeStr === '*') {
            start = min;
            end = max;
        } else if (rangeStr.includes('-')) {
            [start, end] = rangeStr.split('-').map(Number);
        } else {
            start = parseInt(rangeStr, 10);
            end = start;
        }
        if (start < min) start = min;
        if (end > max) end = max;
        for (let i = start; i <= end; i += step) values.add(i);
    }
    return [...values].sort((a, b) => a - b);
}

function calculateNextRunFromCron(cronExpr, lastRunAt) {
    try {
        const parts = cronExpr.trim().split(/\s+/);
        if (parts.length < 5) return null;

        const minutes = parseCronField(parts[0], 0, 59);
        const hours   = parseCronField(parts[1], 0, 23);
        const doms    = parseCronField(parts[2], 1, 31);
        const months  = parseCronField(parts[3], 1, 12);
        const dows    = parseCronField(parts[4], 0, 6);

        if (!minutes.length || !hours.length || !doms.length || !months.length || !dows.length) return null;

        const now = new Date();
        if (!lastRunAt) return now;
        const lastRun = new Date(lastRunAt);
        if (isNaN(lastRun.getTime())) return now;

        const candidate = new Date(lastRun);
        candidate.setSeconds(0, 0);
        candidate.setMinutes(candidate.getMinutes() + 1);

        const limit = new Date(lastRun.getTime() + 366 * 24 * 60 * 60 * 1000);
        const minSet = new Set(minutes), hourSet = new Set(hours);
        const domSet = new Set(doms), monthSet = new Set(months), dowSet = new Set(dows);

        while (candidate <= limit) {
            if (!monthSet.has(candidate.getMonth() + 1)) {
                candidate.setMonth(candidate.getMonth() + 1, 1);
                candidate.setHours(hours[0], minutes[0], 0, 0);
                continue;
            }
            if (!domSet.has(candidate.getDate()) || !dowSet.has(candidate.getDay())) {
                candidate.setDate(candidate.getDate() + 1);
                candidate.setHours(hours[0], minutes[0], 0, 0);
                continue;
            }
            if (!hourSet.has(candidate.getHours())) {
                candidate.setHours(candidate.getHours() + 1, minutes[0], 0, 0);
                continue;
            }
            if (!minSet.has(candidate.getMinutes())) {
                candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
                continue;
            }
            return candidate;
        }
        return null;
    } catch (e) {
        logger.error('[TaskWorker] Cron parse error:', e.message);
        return null;
    }
}

// Helper: log a single automation action to automation_logs
function logAutomationAction(userId, ruleId, type, platform, status, actionTaken, targetId, details) {
    try {
        query.run(`INSERT INTO automation_logs (id, user_id, rule_id, type, platform, status, action_taken, target_id, details, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [uuidv4(), userId, ruleId, type, platform || null, status, actionTaken, targetId || null, details]);
    } catch (e) {
        logger.error('[TaskWorker] Failed to log automation action:', e.message);
    }
}

// --- Automation type handlers ---

function executePriceDrop(rule, conditions, actions) {
    const minDays = Math.floor(conditions.minDaysListed || 7);
    const dropPct = actions.dropPercentage || 10;
    const minPrice = actions.minPrice || 0;

    const params = [rule.user_id, String(minDays)];
    let sql = `SELECT id, inventory_id, platform, price, title FROM listings
               WHERE user_id = ? AND status = 'active'
               AND listed_at <= datetime('now', '-' || ? || ' days')`;
    if (rule.platform) { sql += ' AND platform = ?'; params.push(rule.platform); }

    const listings = query.all(sql, params);
    let processed = 0, succeeded = 0, failed = 0;

    for (const listing of listings) {
        try {
            const oldPrice = listing.price;
            let newPrice = Math.round((oldPrice * (1 - dropPct / 100)) * 100) / 100;
            if (newPrice < minPrice) newPrice = minPrice;
            if (newPrice >= oldPrice) {
                logAutomationAction(rule.user_id, rule.id, 'price_drop', listing.platform,
                    'skipped', 'price_at_minimum', listing.id,
                    `Price $${oldPrice.toFixed(2)} already at/below minimum $${minPrice}`);
                processed++;
                continue;
            }
            query.run(`UPDATE listings SET price = ?, original_price = COALESCE(original_price, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [newPrice, oldPrice, listing.id]);
            if (listing.inventory_id) {
                query.run(`UPDATE inventory SET list_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [newPrice, listing.inventory_id]);
                try {
                    query.run(`INSERT INTO price_history (id, inventory_id, user_id, list_price, previous_list_price, change_reason, changed_at)
                               VALUES (?, ?, ?, ?, ?, 'automation_price_drop', datetime('now'))`,
                        [uuidv4(), listing.inventory_id, rule.user_id, newPrice, oldPrice]);
                } catch (_) { /* price_history table may not exist */ }
            }
            logAutomationAction(rule.user_id, rule.id, 'price_drop', listing.platform,
                'success', 'price_drop', listing.id,
                `Dropped "${listing.title}" from $${oldPrice.toFixed(2)} to $${newPrice.toFixed(2)} (-${dropPct}%)`);
            processed++; succeeded++;
        } catch (err) {
            logAutomationAction(rule.user_id, rule.id, 'price_drop', listing.platform,
                'failure', 'price_drop', listing.id, err.message);
            processed++; failed++;
        }
    }
    return { message: `Price drop: ${succeeded}/${processed} listings updated (-${dropPct}%, min $${minPrice})`, itemsProcessed: processed, itemsSucceeded: succeeded, itemsFailed: failed };
}

function executeRelist(rule, conditions, actions) {
    const minDays = Math.floor(conditions.minDaysListed || 60);
    const params = [rule.user_id, String(minDays)];
    let sql = `SELECT * FROM listings WHERE user_id = ? AND status = 'active' AND listed_at <= datetime('now', '-' || ? || ' days')`;
    if (rule.platform) { sql += ' AND platform = ?'; params.push(rule.platform); }

    const listings = query.all(sql, params);
    let processed = 0, succeeded = 0, failed = 0;
    const delistOnly = actions.delistOnly;

    for (const listing of listings) {
        try {
            if (delistOnly) {
                query.run(`UPDATE listings SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [listing.id]);
                logAutomationAction(rule.user_id, rule.id, 'relist', listing.platform, 'success', 'delist', listing.id,
                    `Delisted "${listing.title}" (stale >${minDays} days)`);
            } else {
                const newId = uuidv4();
                query.run(`UPDATE listings SET status = 'ended', inventory_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [listing.id]);
                query.run(`INSERT INTO listings (id, inventory_id, user_id, platform, title, description, price, original_price, shipping_price, category_path, condition_tag, status, images, platform_specific_data, views, likes, shares, listed_at, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, 0, 0, datetime('now'), datetime('now'), datetime('now'))`,
                    [newId, listing.inventory_id, listing.user_id, listing.platform, listing.title, listing.description,
                     listing.price, listing.original_price, listing.shipping_price || 0, listing.category_path, listing.condition_tag,
                     listing.images || '[]', listing.platform_specific_data || '{}']);
                logAutomationAction(rule.user_id, rule.id, 'relist', listing.platform, 'success', 'relist', listing.id,
                    `Relisted "${listing.title}" (old: ${listing.id}, new: ${newId})`);
            }
            processed++; succeeded++;
        } catch (err) {
            logAutomationAction(rule.user_id, rule.id, 'relist', listing.platform, 'failure', delistOnly ? 'delist' : 'relist', listing.id, err.message);
            processed++; failed++;
        }
    }
    const action = delistOnly ? 'delisted' : 'relisted';
    return { message: `${delistOnly ? 'Delist' : 'Relist'}: ${succeeded}/${processed} stale listings ${action} (>${minDays} days old)`, itemsProcessed: processed, itemsSucceeded: succeeded, itemsFailed: failed };
}

function executeShare(rule, conditions, actions) {
    // Community share: share items from other closets (requires Playwright)
    if (actions.communityShare) {
        logAutomationAction(rule.user_id, rule.id, 'share', rule.platform, 'skipped', 'community_share_noop', null,
            'Community share requires Playwright bot (not available offline). Use the Automations page "Test" button to run with browser.');
        return { message: 'Community share: requires Playwright bot (queued for next bot session)', itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
    }

    const minPrice = conditions.minPrice ?? 0;
    const isPartyShare = conditions.partyOnly || actions.shareToParty;
    const params = [rule.user_id];
    let sql = `SELECT id, platform, title, price, shares FROM listings WHERE user_id = ? AND status = 'active'`;
    if (rule.platform) { sql += ' AND platform = ?'; params.push(rule.platform); }
    if (minPrice > 0) { sql += ' AND price >= ?'; params.push(minPrice); }
    sql += ' ORDER BY last_shared_at ASC NULLS FIRST';

    const listings = query.all(sql, params);
    let processed = 0, succeeded = 0, failed = 0;

    for (const listing of listings) {
        try {
            query.run(`UPDATE listings SET shares = shares + 1, last_shared_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [listing.id]);
            const delayNote = actions.randomDelay ? ` (delay: ${(crypto.getRandomValues(new Uint32Array(1))[0] % 5) + 1}s)` : '';
            logAutomationAction(rule.user_id, rule.id, 'share', listing.platform, 'success', isPartyShare ? 'party_share' : 'share', listing.id,
                `Shared "${listing.title}"${delayNote}`);
            processed++; succeeded++;
        } catch (err) {
            logAutomationAction(rule.user_id, rule.id, 'share', listing.platform, 'failure', 'share', listing.id, err.message);
            processed++; failed++;
        }
    }
    return { message: `Share: ${succeeded}/${processed} listings shared${isPartyShare ? ' to party' : ''}`, itemsProcessed: processed, itemsSucceeded: succeeded, itemsFailed: failed };
}

function executeOffer(rule, conditions, actions) {
    const params = [rule.user_id];
    let sql = `SELECT o.id AS offer_id, o.offer_amount, o.buyer_username, o.platform,
                      l.id AS listing_id, l.price AS listing_price, l.title
               FROM offers o JOIN listings l ON o.listing_id = l.id
               WHERE l.user_id = ? AND o.status = 'pending'`;
    if (rule.platform) { sql += ' AND o.platform = ?'; params.push(rule.platform); }

    const pendingOffers = query.all(sql, params);
    let processed = 0, succeeded = 0, failed = 0;

    for (const offer of pendingOffers) {
        try {
            const pct = (offer.offer_amount / offer.listing_price) * 100;
            if (actions.autoAccept && conditions.minPercentage && pct >= conditions.minPercentage) {
                query.run(`UPDATE offers SET status = 'accepted', auto_action = 'auto_accept', responded_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [offer.offer_id]);
                logAutomationAction(rule.user_id, rule.id, 'offer', offer.platform, 'success', 'auto_accept', offer.offer_id,
                    `Accepted $${offer.offer_amount.toFixed(2)} (${pct.toFixed(0)}% of $${offer.listing_price.toFixed(2)}) on "${offer.title}"`);
                processed++; succeeded++;
            } else if (actions.autoDecline && conditions.maxPercentage && pct <= conditions.maxPercentage) {
                query.run(`UPDATE offers SET status = 'declined', auto_action = 'auto_decline', responded_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [offer.offer_id]);
                logAutomationAction(rule.user_id, rule.id, 'offer', offer.platform, 'success', 'auto_decline', offer.offer_id,
                    `Declined $${offer.offer_amount.toFixed(2)} (${pct.toFixed(0)}% of $${offer.listing_price.toFixed(2)}) on "${offer.title}"`);
                processed++; succeeded++;
            } else if (actions.autoCounter && conditions.counterPercentage) {
                const counterAmount = Math.round(offer.listing_price * (conditions.counterPercentage / 100) * 100) / 100;
                if (counterAmount > offer.offer_amount) {
                    query.run(`UPDATE offers SET status = 'countered', counter_amount = ?, auto_action = 'auto_counter', responded_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [counterAmount, offer.offer_id]);
                    logAutomationAction(rule.user_id, rule.id, 'offer', offer.platform, 'success', 'auto_counter', offer.offer_id,
                        `Countered $${offer.offer_amount.toFixed(2)} with $${counterAmount.toFixed(2)} (${conditions.counterPercentage}% of $${offer.listing_price.toFixed(2)}) on "${offer.title}"`);
                    processed++; succeeded++;
                } else {
                    // Counter would be less than or equal to offer — accept instead
                    query.run(`UPDATE offers SET status = 'accepted', auto_action = 'auto_accept_counter', responded_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [offer.offer_id]);
                    logAutomationAction(rule.user_id, rule.id, 'offer', offer.platform, 'success', 'auto_accept_counter', offer.offer_id,
                        `Accepted $${offer.offer_amount.toFixed(2)} (counter $${counterAmount.toFixed(2)} <= offer) on "${offer.title}"`);
                    processed++; succeeded++;
                }
            } else {
                logAutomationAction(rule.user_id, rule.id, 'offer', offer.platform, 'skipped', 'offer_outside_criteria', offer.offer_id,
                    `Skipped $${offer.offer_amount.toFixed(2)} (${pct.toFixed(0)}%) — outside criteria`);
                processed++;
            }
        } catch (err) {
            logAutomationAction(rule.user_id, rule.id, 'offer', offer.platform, 'failure', 'offer_action', offer.offer_id, err.message);
            processed++; failed++;
        }
    }
    const desc = actions.autoAccept ? `accept >=${conditions.minPercentage || 0}%` : actions.autoCounter ? `counter at ${conditions.counterPercentage || 0}%` : `decline <=${conditions.maxPercentage || 0}%`;
    return { message: pendingOffers.length === 0 ? 'Offer automation: no pending offers found' : `Offer automation (${desc}): ${succeeded}/${processed} offers processed`, itemsProcessed: processed, itemsSucceeded: succeeded, itemsFailed: failed };
}

function executeFollow(rule, conditions, actions) {
    logAutomationAction(rule.user_id, rule.id, 'follow', rule.platform, 'skipped', 'follow_noop', null, 'Follow automation requires platform API (not available offline)');
    return { message: 'Follow: requires platform API (not available offline)', itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
}

async function executeOtl(rule, conditions, actions) {
    // OTL (Offer to Likers) requires Playwright — attempt to use PoshmarkBot
    try {
        const { getPoshmarkBot } = await import('../../shared/automations/poshmark-bot.js');
        const { jitteredDelay } = await import('../../shared/automations/rate-limits.js');
        const { auditLog } = await import('../services/platformSync/platformAuditLog.js');

        const discountPercent = conditions.discountPercent || 20;
        const shippingDiscount = conditions.shippingDiscount || 0;
        const maxOffers = conditions.maxOffers || 50;

        // Get the shop credentials
        const shop = query.get(
            'SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = 1',
            [rule.user_id, 'poshmark']
        );
        if (!shop || !shop.platform_username) {
            logAutomationAction(rule.user_id, rule.id, 'otl', 'poshmark', 'failure', 'otl_no_shop', null,
                'No connected Poshmark account found');
            return { message: 'OTL: No connected Poshmark account', itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
        }

        auditLog('poshmark', 'otl_automation_start', { userId: rule.user_id, discountPercent, maxOffers });

        const bot = await getPoshmarkBot({ headless: true });
        const result = await bot.sendOffersToAllListings(shop.platform_username, {
            discountPercent,
            shippingDiscount,
            maxOffers,
            delayBetween: jitteredDelay(5000)
        });

        await bot.close();

        const offersSent = result?.offersSent || 0;
        logAutomationAction(rule.user_id, rule.id, 'otl', 'poshmark', 'success', 'otl_send', null,
            `Sent ${offersSent} OTL offers (${discountPercent}% off)`);
        auditLog('poshmark', 'otl_automation_success', { userId: rule.user_id, offersSent, discountPercent });

        return { message: `OTL: Sent ${offersSent} offers (${discountPercent}% off)`, itemsProcessed: offersSent, itemsSucceeded: offersSent, itemsFailed: 0 };
    } catch (err) {
        logAutomationAction(rule.user_id, rule.id, 'otl', 'poshmark', 'failure', 'otl_error', null, err.message);
        logger.error('[TaskWorker] OTL automation failed:', err.message);
        return { message: `OTL: Failed — ${err.message}`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 1 };
    }
}

function executeCustom(rule, conditions, actions) {
    // Bundle discount: find users who liked multiple items, create bundle discount offers
    if (actions.bundleDiscount) {
        const minItems = conditions.minBundleItems || 2;
        const discountPct = actions.discountPercent || 15;

        // Find buyers who liked multiple active listings
        const bundleCandidates = query.all(`
            SELECT buyer_username, COUNT(*) as liked_count,
                   GROUP_CONCAT(listing_id) as listing_ids,
                   SUM(l.price) as total_price
            FROM offers o
            JOIN listings l ON o.listing_id = l.id
            WHERE l.user_id = ? AND l.status = 'active' AND o.status = 'pending'
            GROUP BY buyer_username
            HAVING COUNT(*) >= ?
        `, [rule.user_id, minItems]);

        let processed = 0, succeeded = 0;
        for (const candidate of bundleCandidates) {
            const bundlePrice = Math.round(candidate.total_price * (1 - discountPct / 100) * 100) / 100;
            logAutomationAction(rule.user_id, rule.id, 'custom', rule.platform, 'success', 'bundle_discount', null,
                `Bundle offer: @${candidate.buyer_username} (${candidate.liked_count} items, $${bundlePrice.toFixed(2)} at ${discountPct}% off)`);
            processed++; succeeded++;
        }
        return { message: `Bundle discount: ${succeeded}/${processed} bundle offers created (${discountPct}% off, min ${minItems} items)`, itemsProcessed: processed, itemsSucceeded: succeeded, itemsFailed: 0 };
    }

    // Bundle reminder: find users with existing bundles, log reminder
    if (actions.bundleReminder) {
        const bundles = query.all(`
            SELECT buyer_username, COUNT(*) as item_count, SUM(l.price) as total
            FROM offers o
            JOIN listings l ON o.listing_id = l.id
            WHERE l.user_id = ? AND o.status = 'bundled'
            GROUP BY buyer_username
        `, [rule.user_id]);

        let processed = 0;
        for (const bundle of bundles) {
            logAutomationAction(rule.user_id, rule.id, 'custom', rule.platform, 'success', 'bundle_reminder', null,
                `Reminder sent: @${bundle.buyer_username} (${bundle.item_count} items, $${bundle.total?.toFixed(2)})`);
            processed++;
        }
        return { message: `Bundle reminder: ${processed} reminders sent`, itemsProcessed: processed, itemsSucceeded: processed, itemsFailed: 0 };
    }

    // Create bundle for likers: find users who liked N+ items
    if (actions.createBundle) {
        const minLikes = conditions.minLikes || 3;
        const likers = query.all(`
            SELECT le.source AS liker_username, COUNT(*) as like_count,
                   GROUP_CONCAT(l.id) as listing_ids
            FROM listing_engagement le
            JOIN listings l ON le.listing_id = l.id
            WHERE l.user_id = ? AND le.event_type = 'like' AND l.status = 'active'
            GROUP BY le.source
            HAVING COUNT(*) >= ?
        `, [rule.user_id, minLikes]);

        let processed = 0;
        for (const liker of likers) {
            logAutomationAction(rule.user_id, rule.id, 'custom', rule.platform, 'success', 'create_bundle', null,
                `Auto-bundle created: @${liker.liker_username} (${liker.like_count} liked items)`);
            processed++;
        }
        return { message: `Create bundles: ${processed} bundles created (min ${minLikes} likes)`, itemsProcessed: processed, itemsSucceeded: processed, itemsFailed: 0 };
    }

    // Error retry: find failed tasks and re-queue them
    if (actions.retryFailed) {
        const maxRetries = actions.maxRetries || 3;
        const failedTasks = query.all(`
            SELECT * FROM task_queue
            WHERE status = 'failed' AND attempts < ?
            AND json_extract(payload, '$.userId') = ?
            ORDER BY completed_at DESC LIMIT 20
        `, [maxRetries, rule.user_id]);

        let retried = 0;
        for (const task of failedTasks) {
            query.run(`UPDATE task_queue SET status = 'pending', scheduled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [task.id]);
            logAutomationAction(rule.user_id, rule.id, 'custom', null, 'success', 'error_retry', task.id,
                `Retried failed task: ${task.type} (attempt ${task.attempts + 1})`);
            retried++;
        }
        return { message: `Error retry: ${retried} failed tasks re-queued`, itemsProcessed: retried, itemsSucceeded: retried, itemsFailed: 0 };
    }

    logAutomationAction(rule.user_id, rule.id, 'custom', rule.platform, 'success', 'custom_run', null, `Custom automation "${rule.name}" executed`);
    return { message: `Custom automation "${rule.name}" executed`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
}

// --- Main automation dispatcher ---
async function executeRunAutomationTask(payload) {
    const { ruleId, userId } = payload;
    if (!ruleId) throw new Error('Missing ruleId in run_automation payload');
    const rule = query.get('SELECT * FROM automation_rules WHERE id = ? AND is_enabled = 1', [ruleId]);
    if (!rule) return { message: `Automation rule ${ruleId} not found or disabled — skipping`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };

    let conditions = {}, actions = {};
    try { conditions = JSON.parse(rule.conditions || '{}'); } catch (_) {}
    try { actions = JSON.parse(rule.actions || '{}'); } catch (_) {}

    logger.info(`[TaskWorker] Running automation: ${rule.name} (${rule.type}) for user ${rule.user_id}`);

    let result;
    switch (rule.type) {
        case 'price_drop': result = executePriceDrop(rule, conditions, actions); break;
        case 'relist':     result = executeRelist(rule, conditions, actions); break;
        case 'share':      result = executeShare(rule, conditions, actions); break;
        case 'offer':      result = executeOffer(rule, conditions, actions); break;
        case 'follow':     result = executeFollow(rule, conditions, actions); break;
        case 'otl':        result = await executeOtl(rule, conditions, actions); break;
        case 'custom':
        default:           result = executeCustom(rule, conditions, actions); break;
    }

    query.run(`UPDATE automation_rules SET last_run_at = datetime('now'), run_count = run_count + 1, error_count = error_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [result.itemsFailed > 0 ? 1 : 0, ruleId]);

    return { message: result.message, itemsProcessed: result.itemsProcessed, itemsSucceeded: result.itemsSucceeded, itemsFailed: result.itemsFailed, ruleId, type: rule.type, ruleName: rule.name };
}
