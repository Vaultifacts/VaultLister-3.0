// Task Worker for VaultLister
// Processes background jobs from the task queue

import { Queue, QueueEvents } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'node:crypto';
import { query } from '../db/database.js';
import { syncShop } from '../services/platformSync/index.js';
import { createOAuthNotification, NotificationTypes } from '../services/notificationService.js';
import { set as setRedisValue } from '../services/redis.js';
import { withRedisLock } from '../services/redisLock.js';
import { logger } from '../shared/logger.js';
import { auditLog } from '../services/platformSync/platformAuditLog.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Configuration
const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds
const MAX_CONCURRENT_TASKS = 3;
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 5000; // 5 seconds base delay for exponential backoff
const HEARTBEAT_KEY = 'worker:health:taskWorker';
const HEARTBEAT_TTL_SECONDS = 120;
const AUTOMATION_QUEUE_NAME = 'automation-jobs';

// FIXED 2026-02-24: Automation schedule checking integrated into taskWorker (Issue #3)
const AUTOMATION_CHECK_INTERVAL_MS = 60 * 1000;
const AUTOMATION_CHECK_LOCK_KEY = 'worker:lock:automationScheduleCheck';
const AUTOMATION_CHECK_LOCK_TTL_MS = 2 * 60 * 1000;
let lastAutomationCheck = 0;
const DAILY_SUMMARY_CHECK_MS = 60 * 60 * 1000; // Check every hour
const DAILY_SUMMARY_LOCK_KEY = 'worker:lock:dailySummaryCheck';
const DAILY_SUMMARY_LOCK_TTL_MS = 10 * 60 * 1000;
let lastDailySummaryCheck = 0;
// Issue #182: auto-purge deleted inventory items past 30-day retention, checked every 24 hours
const PURGE_DELETED_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PURGE_DELETED_LOCK_KEY = 'worker:lock:purgeDeletedInventory';
const PURGE_DELETED_LOCK_TTL_MS = 30 * 60 * 1000;
let lastPurgeDeletedCheck = 0;

let workerInterval = null;
let isProcessing = false;
let activeTasks = 0;
let lastQueuePoll = 0;
let automationQueue = null;
let automationQueueEvents = null;

async function writeHeartbeat() {
    await setRedisValue(
        HEARTBEAT_KEY,
        JSON.stringify({ lastRun: new Date(lastQueuePoll).toISOString(), status: 'running' }),
        HEARTBEAT_TTL_SECONDS,
    );
}

function getAutomationQueue() {
    if (automationQueue) {
        return automationQueue;
    }

    if (!process.env.REDIS_URL) {
        throw new Error('REDIS_URL is required for automation worker jobs');
    }

    automationQueue = new Queue(AUTOMATION_QUEUE_NAME, {
        connection: { url: process.env.REDIS_URL },
    });
    return automationQueue;
}

async function getAutomationQueueEvents() {
    if (automationQueueEvents) {
        return automationQueueEvents;
    }

    if (!process.env.REDIS_URL) {
        throw new Error('REDIS_URL is required for automation worker jobs');
    }

    automationQueueEvents = new QueueEvents(AUTOMATION_QUEUE_NAME, {
        connection: { url: process.env.REDIS_URL },
    });
    await automationQueueEvents.waitUntilReady();
    return automationQueueEvents;
}

async function runAutomationWorkerJob(type, userId, payload) {
    const queue = getAutomationQueue();
    const queueEvents = await getAutomationQueueEvents();
    const job = await queue.add(
        type,
        { userId, type, payload },
        {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            timeout: 300000,
        },
    );

    return await job.waitUntilFinished(queueEvents, 300000);
}

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

    // Write lock file to prevent standalone poshmark-scheduler.js from colliding
    try {
        const lockPath = join(process.cwd(), 'data', 'poshmark-scheduler.lock');
        mkdirSync(join(process.cwd(), 'data'), { recursive: true });
        writeFileSync(
            lockPath,
            JSON.stringify({ pid: process.pid, ts: new Date().toISOString(), source: 'taskWorker' }),
        );
    } catch (lockErr) {
        logger.warn('[TaskWorker] Could not write scheduler lock file', null, { detail: lockErr.message });
    }

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

export function getTaskWorkerStatus() {
    return {
        running: workerInterval !== null,
        intervalMs: POLL_INTERVAL_MS,
        lastRun: lastQueuePoll ? new Date(lastQueuePoll).toISOString() : null,
        lastAutomationCheck: lastAutomationCheck ? new Date(lastAutomationCheck).toISOString() : null,
        lastDailySummaryCheck: lastDailySummaryCheck ? new Date(lastDailySummaryCheck).toISOString() : null,
    };
}

/**
 * Process pending tasks from the queue
 */
async function processQueue() {
    if (isProcessing) {
        return;
    }

    isProcessing = true;
    lastQueuePoll = Date.now();

    try {
        // FIXED 2026-02-24: Check automation schedules periodically (Issue #3)
        const now = Date.now();
        if (now - lastAutomationCheck >= AUTOMATION_CHECK_INTERVAL_MS) {
            lastAutomationCheck = now;
            try {
                await withRedisLock(AUTOMATION_CHECK_LOCK_KEY, AUTOMATION_CHECK_LOCK_TTL_MS, checkAutomationSchedules, {
                    name: 'automation schedule check',
                });
            } catch (schedErr) {
                logger.error('[TaskWorker] Automation schedule check failed:', schedErr.message);
            }
        }
        if (now - lastDailySummaryCheck >= DAILY_SUMMARY_CHECK_MS) {
            lastDailySummaryCheck = now;
            try {
                await withRedisLock(DAILY_SUMMARY_LOCK_KEY, DAILY_SUMMARY_LOCK_TTL_MS, checkDailySummaries, {
                    name: 'daily summary check',
                });
            } catch (err) {
                logger.error('[TaskWorker] Daily summary check failed:', err.message);
            }
        }
        if (now - lastPurgeDeletedCheck >= PURGE_DELETED_INTERVAL_MS) {
            lastPurgeDeletedCheck = now;
            try {
                await withRedisLock(
                    PURGE_DELETED_LOCK_KEY,
                    PURGE_DELETED_LOCK_TTL_MS,
                    () => executePurgeDeletedInventoryTask({}),
                    { name: 'purge deleted inventory' },
                );
            } catch (err) {
                logger.error('[TaskWorker] Purge deleted inventory failed:', err.message);
            }
        }

        // Get pending tasks up to the concurrency limit
        const availableSlots = MAX_CONCURRENT_TASKS - activeTasks;

        if (availableSlots <= 0) {
            return;
        }

        const promises = Array.from({ length: availableSlots }, () => processTask());
        await Promise.allSettled(promises);
    } catch (error) {
        logger.error('[TaskWorker] Error processing queue:', error);
    } finally {
        try {
            await writeHeartbeat();
        } catch (heartbeatError) {
            logger.warn('[TaskWorker] Failed to write heartbeat', null, { detail: heartbeatError.message });
        }
        isProcessing = false;
    }
}

/**
 * Process a single task
 */
async function processTask() {
    const task = await query.transaction(async (tx) => {
        const rows = await tx.all(
            `
            UPDATE task_queue
            SET status = 'processing',
                started_at = NOW(),
                attempts = attempts + 1,
                updated_at = NOW()
            WHERE id = (
                SELECT id FROM task_queue
                WHERE status = 'pending'
                    AND scheduled_at <= NOW()
                ORDER BY priority DESC, scheduled_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *
        `,
            [],
        );

        return rows[0] || null;
    });

    if (!task) {
        return null;
    }

    activeTasks++;
    const startTime = Date.now();

    try {
        logger.info(`[TaskWorker] Processing task ${task.id} (${task.type})`);

        // Parse payload
        const payload = JSON.parse(task.payload);

        // Execute task based on type
        const result = await executeTask(task.type, payload);

        // Mark task as completed
        const duration = Date.now() - startTime;
        await query.run(
            `
            UPDATE task_queue SET
                status = 'completed',
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
        `,
            [task.id],
        );

        logger.info(`[TaskWorker] Task ${task.id} completed in ${duration}ms`);

        // Log to automation_runs for history tracking
        try {
            const payload = JSON.parse(task.payload);
            const userId = payload.userId || payload.user_id;
            if (userId) {
                await query.run(
                    `
                    INSERT INTO automation_runs (id, user_id, automation_id, automation_name, automation_type, status, started_at, completed_at, duration_ms, items_processed, items_succeeded, items_failed, result_message, metadata)
                    VALUES (?, ?, ?, ?, ?, 'success', NOW() - (?::text || ' seconds')::interval, NOW(), ?, ?, ?, ?, ?, '{}')
                `,
                    [
                        uuidv4(),
                        userId,
                        payload.ruleId || task.id,
                        result?.ruleName || task.type,
                        result?.type || task.type,
                        Math.round(duration / 1000),
                        duration,
                        result?.itemsProcessed || result?.listings?.synced || 0,
                        result?.itemsSucceeded ?? (result?.itemsProcessed || result?.listings?.synced || 0),
                        result?.itemsFailed || 0,
                        result?.message || `Task ${task.type} completed successfully`,
                    ],
                );
            }
        } catch (logErr) {
            logger.error('[TaskWorker] Failed to log automation run:', logErr.message);
        }

        return result;
    } catch (error) {
        logger.error(`[TaskWorker] Task ${task.id} failed:`, error.message);

        const attempts = task.attempts;
        const maxAttempts = task.max_attempts || DEFAULT_MAX_ATTEMPTS;

        if (attempts >= maxAttempts) {
            // Mark as failed permanently
            await query.run(
                `
                UPDATE task_queue SET
                    status = 'failed',
                    last_error = ?,
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE id = ?
            `,
                [error.message, task.id],
            );

            logger.info(`[TaskWorker] Task ${task.id} failed permanently after ${attempts} attempts`);

            // Log failure to automation_runs
            try {
                const payload = JSON.parse(task.payload);
                const userId = payload.userId || payload.user_id;
                const duration = Date.now() - startTime;
                if (userId) {
                    await query.run(
                        `
                        INSERT INTO automation_runs (id, user_id, automation_id, automation_name, automation_type, status, started_at, completed_at, duration_ms, items_processed, items_succeeded, items_failed, error_message, error_code, retry_count, metadata)
                        VALUES (?, ?, ?, ?, ?, 'failed', NOW() - (?::text || ' seconds')::interval, NOW(), ?, 0, 0, 0, ?, ?, ?, '{}')
                    `,
                        [
                            uuidv4(),
                            userId,
                            task.id,
                            task.type,
                            task.type,
                            Math.round(duration / 1000),
                            duration,
                            error.message,
                            error.code || 'UNKNOWN',
                            attempts,
                        ],
                    );
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

            await query.run(
                `
                UPDATE task_queue SET
                    status = 'pending',
                    last_error = ?,
                    scheduled_at = ?,
                    updated_at = NOW()
                WHERE id = ?
            `,
                [error.message, scheduledAt, task.id],
            );

            logger.info(`[TaskWorker] Task ${task.id} scheduled for retry at ${scheduledAt}`);
        }

        throw error;
    } finally {
        activeTasks--;
    }
}

/**
 * Check and send daily automation summary emails
 */
async function checkDailySummaries() {
    const currentHour = new Date().getUTCHours();
    if (currentHour !== 14) return; // Send at 2 PM UTC (~8 AM MST)

    const users = await query.all(`
        SELECT up.user_id, up.settings, u.email, u.username
        FROM user_preferences up
        JOIN users u ON u.id = up.user_id
        WHERE up.key = 'automation_notifications'
    `);

    const today = new Date().toISOString().split('T')[0];

    for (const row of users) {
        try {
            const prefs = JSON.parse(row.settings);
            if (!prefs.daily_summary || !prefs.email_enabled) continue;
            if (!row.email) continue;

            const sentKey = 'daily_summary_sent';
            const lastSent = await query.get('SELECT settings FROM user_preferences WHERE user_id = ? AND key = ?', [
                row.user_id,
                sentKey,
            ]);
            if (lastSent && lastSent.settings === today) continue;

            const runs = await query.all(
                `
                SELECT status, COUNT(*) as count, SUM(items_processed) as total_items
                FROM automation_runs
                WHERE user_id = ? AND started_at >= NOW() - INTERVAL '24 hours'
                GROUP BY status
            `,
                [row.user_id],
            );

            if (runs.length === 0) continue;

            let totalRuns = 0,
                successRuns = 0,
                failedRuns = 0,
                totalItems = 0;
            runs.forEach((r) => {
                totalRuns += r.count;
                totalItems += r.total_items || 0;
                if (r.status === 'success') successRuns = r.count;
                if (r.status === 'failed') failedRuns = r.count;
            });

            const topRules = await query.all(
                `
                SELECT automation_name, COUNT(*) as runs,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes
                FROM automation_runs
                WHERE user_id = ? AND started_at >= NOW() - INTERVAL '24 hours'
                GROUP BY automation_name ORDER BY runs DESC LIMIT 5
            `,
                [row.user_id],
            );

            const { sendDailySummaryEmail } = await import('../services/email.js');
            await sendDailySummaryEmail(
                { email: row.email, username: row.username },
                { totalRuns, successRuns, failedRuns, totalItems, topRules },
            );

            const existing = await query.get('SELECT id FROM user_preferences WHERE user_id = ? AND key = ?', [
                row.user_id,
                sentKey,
            ]);
            if (existing) {
                await query.run('UPDATE user_preferences SET settings = ? WHERE user_id = ? AND key = ?', [
                    today,
                    row.user_id,
                    sentKey,
                ]);
            } else {
                await query.run('INSERT INTO user_preferences (id, user_id, key, settings) VALUES (?, ?, ?, ?)', [
                    uuidv4(),
                    row.user_id,
                    sentKey,
                    today,
                ]);
            }

            logger.info(`[TaskWorker] Daily summary sent to ${row.email.replace(/(.{2}).*(@.*)/, '$1***$2')}`);
        } catch (e) {
            logger.error(`[TaskWorker] Daily summary failed for user ${row.user_id}:`, e.message);
        }
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

        case 'publish_listing':
            return await executePoshmarkPublishTask(payload);

        case 'poshmark_inventory_sync':
            return await executePoshmarkInventorySyncTask(payload);

        case 'scrape_competitor_closet':
            return await executeScrapeCompetitorClosetTask(payload);

        case 'poshmark_monitoring':
            return await executePoshmarkMonitoringTask(payload);

        case 'purge_deleted_inventory':
            return await executePurgeDeletedInventoryTask(payload);

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
    const shop = await query.get('SELECT platform FROM shops WHERE id = ?', [shopId]);
    if (shop) {
        createOAuthNotification(userId, shop.platform, NotificationTypes.SYNC_COMPLETED, {
            listingsSynced: result.listings?.synced || 0,
            ordersSynced: result.orders?.synced || 0,
        });
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
    const account = await query.get(
        `
        SELECT * FROM email_accounts
        WHERE id = ? AND user_id = ?
    `,
        [accountId, userId],
    );

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
    const event = await query.get(
        `
        SELECT * FROM webhook_events WHERE id = ?
    `,
        [eventId],
    );

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
            const shop = await query.get('SELECT platform FROM shops WHERE id = ?', [payload.shopId]);
            if (shop) {
                createOAuthNotification(payload.userId, shop.platform, NotificationTypes.SYNC_FAILED, {
                    error: error.message,
                    taskId: task.id,
                });
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
export async function queueTask(type, payload, options = {}) {
    const id = uuidv4();
    const {
        priority = 0,
        maxAttempts = DEFAULT_MAX_ATTEMPTS,
        // Use PostgreSQL-compatible datetime format (without T/Z; breaks <= comparison)
        scheduledAt = new Date().toISOString().replace('T', ' ').replace('Z', '').split('.')[0],
    } = options;

    await query.run(
        `
        INSERT INTO task_queue (id, type, payload, priority, max_attempts, scheduled_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `,
        [id, type, JSON.stringify(payload), priority, maxAttempts, scheduledAt],
    );

    return {
        id,
        type,
        payload,
        status: 'pending',
        priority,
        maxAttempts,
        scheduledAt,
    };
}

/**
 * Get task status
 * @param {string} taskId - Task ID
 * @returns {Object|null} Task status
 */
export async function getTaskStatus(taskId) {
    const task = await query.get(
        `
        SELECT id, type, status, attempts, max_attempts, last_error,
               created_at, started_at, completed_at
        FROM task_queue
        WHERE id = ?
    `,
        [taskId],
    );

    return task;
}

/**
 * Get worker status for monitoring
 */
export async function getWorkerStatus() {
    const stats = await query.get(`
        SELECT
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_tasks,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks
        FROM task_queue
        WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    return {
        isRunning: workerInterval !== null,
        activeTasks,
        maxConcurrent: MAX_CONCURRENT_TASKS,
        pollIntervalMs: POLL_INTERVAL_MS,
        last24Hours: stats,
    };
}

/**
 * Cleanup old completed/failed tasks
 * @param {number} daysOld - Delete tasks older than this
 * @returns {number} Number of deleted tasks
 */
export async function cleanupOldTasks(daysOld = 7) {
    const result = await query.run(
        `
        DELETE FROM task_queue
        WHERE status IN ('completed', 'failed')
        AND completed_at < NOW() - (?::text || ' days')::interval
    `,
        [daysOld],
    );

    return result.changes;
}

// FIXED 2026-02-24: Automation schedule checking functions (Issue #3)
async function checkAutomationSchedules() {
    const rules = await query.all(`
        SELECT id, user_id, name, type, schedule, last_run_at
        FROM automation_rules
        WHERE is_enabled = TRUE AND schedule IS NOT NULL AND schedule != ''
    `);
    for (const rule of rules) {
        const cronValidation = validateCronExpression(rule.schedule);
        if (!cronValidation.valid) {
            logger.warn(
                `[TaskWorker] Skipping automation ${rule.id} — invalid cron expression: ${cronValidation.reason}`,
                { schedule: rule.schedule },
            );
            continue;
        }
        const nextRun = calculateNextRunFromCron(rule.schedule, rule.last_run_at);
        if (nextRun && nextRun <= new Date()) {
            const existing = await query.get(
                `
                SELECT id FROM task_queue
                WHERE type = 'run_automation'
                  AND payload::jsonb->>'ruleId' = ?
                  AND status IN ('pending', 'processing')
            `,
                [rule.id],
            );
            if (!existing) {
                queueTask(
                    'run_automation',
                    { ruleId: rule.id, userId: rule.user_id, scheduledRun: true },
                    { priority: 0 },
                );
                logger.info(`[TaskWorker] Queued scheduled automation: ${rule.name} (${rule.id})`);
            }
        }
    }
}

// Cron field valid ranges: [min, max]
const CRON_FIELD_RANGES = [
    { name: 'minute', min: 0, max: 59 },
    { name: 'hour', min: 0, max: 23 },
    { name: 'dayOfMonth', min: 1, max: 31 },
    { name: 'month', min: 1, max: 12 },
    { name: 'dayOfWeek', min: 0, max: 6 },
];

/**
 * Validate a 5-field cron expression.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateCronExpression(cronExpr) {
    if (!cronExpr || typeof cronExpr !== 'string') {
        return { valid: false, reason: 'Cron expression must be a non-empty string' };
    }
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) {
        return { valid: false, reason: `Cron expression must have exactly 5 fields, got ${parts.length}` };
    }
    for (let i = 0; i < 5; i++) {
        const field = parts[i];
        const { name, min, max } = CRON_FIELD_RANGES[i];
        if (field === '*') continue;
        for (const part of field.split(',')) {
            let rangeStr = part;
            if (part.includes('/')) {
                const segments = part.split('/');
                if (segments.length !== 2) {
                    return { valid: false, reason: `Invalid step in ${name} field: "${part}"` };
                }
                const step = parseInt(segments[1], 10);
                if (isNaN(step) || step < 1 || step > max - min) {
                    return { valid: false, reason: `Invalid step value in ${name} field: "${segments[1]}"` };
                }
                rangeStr = segments[0];
            }
            if (rangeStr === '*') continue;
            if (rangeStr.includes('-')) {
                const bounds = rangeStr.split('-');
                if (bounds.length !== 2) {
                    return { valid: false, reason: `Invalid range in ${name} field: "${rangeStr}"` };
                }
                const lo = parseInt(bounds[0], 10);
                const hi = parseInt(bounds[1], 10);
                if (isNaN(lo) || isNaN(hi)) {
                    return { valid: false, reason: `Non-numeric range in ${name} field: "${rangeStr}"` };
                }
                if (lo < min || hi > max || lo > hi) {
                    return { valid: false, reason: `${name} range ${lo}-${hi} out of valid bounds ${min}-${max}` };
                }
            } else {
                const val = parseInt(rangeStr, 10);
                if (isNaN(val)) {
                    return { valid: false, reason: `Non-numeric value in ${name} field: "${rangeStr}"` };
                }
                if (val < min || val > max) {
                    return { valid: false, reason: `${name} value ${val} out of valid range ${min}-${max}` };
                }
            }
        }
    }
    return { valid: true };
}

// FIXED 2026-02-24: Full 5-field cron parser (was minute/hour only)
function parseCronField(field, min, max) {
    // Set size is bounded by (max - min + 1) which is at most 60 for minutes
    const values = new Set();
    for (const part of field.split(',')) {
        let rangeStr = part,
            step = 1;
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
        const hours = parseCronField(parts[1], 0, 23);
        const doms = parseCronField(parts[2], 1, 31);
        const months = parseCronField(parts[3], 1, 12);
        const dows = parseCronField(parts[4], 0, 6);

        if (!minutes.length || !hours.length || !doms.length || !months.length || !dows.length) return null;

        const now = new Date();
        if (!lastRunAt) return now;
        const lastRun = new Date(lastRunAt);
        if (isNaN(lastRun.getTime())) return now;

        const candidate = new Date(lastRun);
        candidate.setSeconds(0, 0);
        candidate.setMinutes(candidate.getMinutes() + 1);

        const limit = new Date(lastRun.getTime() + 366 * 24 * 60 * 60 * 1000);
        const minSet = new Set(minutes),
            hourSet = new Set(hours);
        const domSet = new Set(doms),
            monthSet = new Set(months),
            dowSet = new Set(dows);

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
async function logAutomationAction(userId, ruleId, type, platform, status, actionTaken, targetId, details) {
    try {
        await query.run(
            `INSERT INTO automation_logs (id, user_id, rule_id, type, platform, status, action_taken, target_id, details, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [uuidv4(), userId, ruleId, type, platform || null, status, actionTaken, targetId || null, details],
        );
    } catch (e) {
        logger.error('[TaskWorker] Failed to log automation action:', e.message);
    }
}

// --- Automation type handlers ---

async function executePriceDrop(rule, conditions, actions) {
    const minDays = Math.floor(conditions.minDaysListed || 7);
    const dropPct = actions.dropPercentage || 10;
    const minPrice = actions.minPrice || 0;

    const params = [rule.user_id, String(minDays)];
    let sql = `SELECT id, inventory_id, platform, price, title FROM listings
               WHERE user_id = ? AND status = 'active'
               AND listed_at <= NOW() - (?::text || ' days')::interval`;
    if (rule.platform) {
        sql += ' AND platform = ?';
        params.push(rule.platform);
    }

    const listings = await query.all(sql, params);
    let processed = 0,
        succeeded = 0,
        failed = 0;

    for (const listing of listings) {
        try {
            const oldPrice = listing.price;
            let newPrice = Math.round(oldPrice * (1 - dropPct / 100) * 100) / 100;
            if (newPrice < minPrice) newPrice = minPrice;
            if (newPrice >= oldPrice) {
                logAutomationAction(
                    rule.user_id,
                    rule.id,
                    'price_drop',
                    listing.platform,
                    'skipped',
                    'price_at_minimum',
                    listing.id,
                    `Price $${oldPrice.toFixed(2)} already at/below minimum $${minPrice}`,
                );
                processed++;
                continue;
            }
            await query.run(
                `UPDATE listings SET price = ?, original_price = COALESCE(original_price, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [newPrice, oldPrice, listing.id],
            );
            if (listing.inventory_id) {
                await query.run(`UPDATE inventory SET list_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
                    newPrice,
                    listing.inventory_id,
                ]);
                try {
                    await query.run(
                        `INSERT INTO price_history (id, inventory_id, user_id, list_price, previous_list_price, change_reason, changed_at)
                               VALUES (?, ?, ?, ?, ?, 'automation_price_drop', NOW())`,
                        [uuidv4(), listing.inventory_id, rule.user_id, newPrice, oldPrice],
                    );
                } catch (_) {
                    /* price_history table may not exist */
                }
            }
            logAutomationAction(
                rule.user_id,
                rule.id,
                'price_drop',
                listing.platform,
                'success',
                'price_drop',
                listing.id,
                `Dropped "${listing.title}" from $${oldPrice.toFixed(2)} to $${newPrice.toFixed(2)} (-${dropPct}%)`,
            );
            processed++;
            succeeded++;
        } catch (err) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                'price_drop',
                listing.platform,
                'failure',
                'price_drop',
                listing.id,
                err.message,
            );
            processed++;
            failed++;
        }
    }
    return {
        message: `Price drop: ${succeeded}/${processed} listings updated (-${dropPct}%, min $${minPrice})`,
        itemsProcessed: processed,
        itemsSucceeded: succeeded,
        itemsFailed: failed,
    };
}

async function executeRelist(rule, conditions, actions) {
    const minDays = Math.floor(conditions.minDaysListed || 60);
    const params = [rule.user_id, String(minDays)];
    let sql = `SELECT * FROM listings WHERE user_id = ? AND status = 'active' AND listed_at <= NOW() - (?::text || ' days')::interval`;
    if (rule.platform) {
        sql += ' AND platform = ?';
        params.push(rule.platform);
    }

    const listings = await query.all(sql, params);
    let processed = 0,
        succeeded = 0,
        failed = 0;
    const delistOnly = actions.delistOnly;

    for (const listing of listings) {
        try {
            if (delistOnly) {
                await query.run(`UPDATE listings SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
                    listing.id,
                ]);
                logAutomationAction(
                    rule.user_id,
                    rule.id,
                    'relist',
                    listing.platform,
                    'success',
                    'delist',
                    listing.id,
                    `Delisted "${listing.title}" (stale >${minDays} days)`,
                );
            } else {
                const newId = uuidv4();
                await query.run(
                    `UPDATE listings SET status = 'ended', inventory_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [listing.id],
                );
                await query.run(
                    `INSERT INTO listings (id, inventory_id, user_id, platform, title, description, price, original_price, shipping_price, category_path, condition_tag, status, images, platform_specific_data, views, likes, shares, listed_at, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, 0, 0, NOW(), NOW(), NOW())`,
                    [
                        newId,
                        listing.inventory_id,
                        listing.user_id,
                        listing.platform,
                        listing.title,
                        listing.description,
                        listing.price,
                        listing.original_price,
                        listing.shipping_price || 0,
                        listing.category_path,
                        listing.condition_tag,
                        listing.images || '[]',
                        listing.platform_specific_data || '{}',
                    ],
                );
                logAutomationAction(
                    rule.user_id,
                    rule.id,
                    'relist',
                    listing.platform,
                    'success',
                    'relist',
                    listing.id,
                    `Relisted "${listing.title}" (old: ${listing.id}, new: ${newId})`,
                );
            }
            processed++;
            succeeded++;
        } catch (err) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                'relist',
                listing.platform,
                'failure',
                delistOnly ? 'delist' : 'relist',
                listing.id,
                err.message,
            );
            processed++;
            failed++;
        }
    }
    const action = delistOnly ? 'delisted' : 'relisted';
    return {
        message: `${delistOnly ? 'Delist' : 'Relist'}: ${succeeded}/${processed} stale listings ${action} (>${minDays} days old)`,
        itemsProcessed: processed,
        itemsSucceeded: succeeded,
        itemsFailed: failed,
    };
}

async function executeCommunityShare(rule, conditions, actions) {
    try {
        const { getPoshmarkBot } = await import('../../shared/automations/poshmark-bot.js');
        const { jitteredDelay } = await import('../../shared/automations/rate-limits.js');
        const { auditLog } = await import('../services/platformSync/platformAuditLog.js');

        const maxShares = conditions.maxShares || 50;

        const shop = await query.get('SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = TRUE', [
            rule.user_id,
            'poshmark',
        ]);
        if (!shop) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                'share',
                'poshmark',
                'failure',
                'community_share_no_shop',
                null,
                'No connected Poshmark account found',
            );
            return {
                message: 'Community share: No connected Poshmark account',
                itemsProcessed: 0,
                itemsSucceeded: 0,
                itemsFailed: 0,
            };
        }

        auditLog('poshmark', 'community_share_start', { userId: rule.user_id, maxShares });

        const bot = await getPoshmarkBot({ headless: true });
        const result = await bot.shareCommunity({
            maxShares,
            delayBetween: jitteredDelay(3000),
            feedType: conditions.feedType || 'feed',
        });

        await bot.close();

        const shared = result?.shared || 0;
        logAutomationAction(
            rule.user_id,
            rule.id,
            'share',
            'poshmark',
            'success',
            'community_share',
            null,
            `Community shared ${shared} items from feed`,
        );
        auditLog('poshmark', 'community_share_success', { userId: rule.user_id, shared });

        return {
            message: `Community share: ${shared} items shared from feed`,
            itemsProcessed: shared,
            itemsSucceeded: shared,
            itemsFailed: 0,
        };
    } catch (err) {
        logAutomationAction(
            rule.user_id,
            rule.id,
            'share',
            'poshmark',
            'failure',
            'community_share_error',
            null,
            err.message,
        );
        logger.error('[TaskWorker] Community share failed:', err.message);
        return {
            message: `Community share: Failed — ${err.message}`,
            itemsProcessed: 0,
            itemsSucceeded: 0,
            itemsFailed: 1,
        };
    }
}

async function executeShare(rule, conditions, actions) {
    const minPrice = conditions.minPrice ?? 0;
    const isPartyShare = conditions.partyOnly || actions.shareToParty;
    const params = [rule.user_id];
    let sql = `SELECT id, platform, title, price, shares, platform_url FROM listings WHERE user_id = ? AND status = 'active'`;
    if (rule.platform) {
        sql += ' AND platform = ?';
        params.push(rule.platform);
    }
    if (minPrice > 0) {
        sql += ' AND price >= ?';
        params.push(minPrice);
    }
    sql += ' ORDER BY last_shared_at ASC NULLS FIRST';

    const listings = await query.all(sql, params);
    let processed = 0,
        succeeded = 0,
        failed = 0;

    for (const listing of listings) {
        try {
            await query.run(
                `UPDATE listings SET shares = shares + 1, last_shared_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [listing.id],
            );
            const delayNote = actions.randomDelay ? ` (delay: ${randomInt(5) + 1}s)` : '';
            logAutomationAction(
                rule.user_id,
                rule.id,
                'share',
                listing.platform,
                'success',
                isPartyShare ? 'party_share' : 'share',
                listing.id,
                `Shared "${listing.title}"${delayNote}`,
            );
            auditLog(listing.platform || rule.platform || 'poshmark', 'share_success', {
                userId: rule.user_id,
                ruleId: rule.id,
                listingId: listing.id,
                itemUrl: listing.platform_url || null,
                title: listing.title,
            });
            processed++;
            succeeded++;
        } catch (err) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                'share',
                listing.platform,
                'failure',
                'share',
                listing.id,
                err.message,
            );
            processed++;
            failed++;
        }
    }
    return {
        message: `Share: ${succeeded}/${processed} listings shared${isPartyShare ? ' to party' : ''}`,
        itemsProcessed: processed,
        itemsSucceeded: succeeded,
        itemsFailed: failed,
    };
}

async function executeOffer(rule, conditions, actions) {
    const params = [rule.user_id];
    let sql = `SELECT o.id AS offer_id, o.offer_amount, o.buyer_username, o.platform,
                      l.id AS listing_id, l.price AS listing_price, l.title
               FROM offers o JOIN listings l ON o.listing_id = l.id
               WHERE l.user_id = ? AND o.status = 'pending'`;
    if (rule.platform) {
        sql += ' AND o.platform = ?';
        params.push(rule.platform);
    }

    const pendingOffers = await query.all(sql, params);
    let processed = 0,
        succeeded = 0,
        failed = 0;

    for (const offer of pendingOffers) {
        try {
            const pct = (offer.offer_amount / offer.listing_price) * 100;
            if (actions.autoAccept && conditions.minPercentage && pct >= conditions.minPercentage) {
                await query.run(
                    `UPDATE offers SET status = 'accepted', auto_action = 'auto_accept', responded_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [offer.offer_id],
                );
                logAutomationAction(
                    rule.user_id,
                    rule.id,
                    'offer',
                    offer.platform,
                    'success',
                    'auto_accept',
                    offer.offer_id,
                    `Accepted $${offer.offer_amount.toFixed(2)} (${pct.toFixed(0)}% of $${offer.listing_price.toFixed(2)}) on "${offer.title}"`,
                );
                processed++;
                succeeded++;
            } else if (actions.autoDecline && conditions.maxPercentage && pct <= conditions.maxPercentage) {
                await query.run(
                    `UPDATE offers SET status = 'declined', auto_action = 'auto_decline', responded_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [offer.offer_id],
                );
                logAutomationAction(
                    rule.user_id,
                    rule.id,
                    'offer',
                    offer.platform,
                    'success',
                    'auto_decline',
                    offer.offer_id,
                    `Declined $${offer.offer_amount.toFixed(2)} (${pct.toFixed(0)}% of $${offer.listing_price.toFixed(2)}) on "${offer.title}"`,
                );
                processed++;
                succeeded++;
            } else if (
                actions.autoCounter &&
                conditions.counterPercentage &&
                (!conditions.minPercentage || pct >= conditions.minPercentage)
            ) {
                const counterAmount =
                    Math.round(offer.listing_price * (conditions.counterPercentage / 100) * 100) / 100;
                if (counterAmount > offer.offer_amount) {
                    await query.run(
                        `UPDATE offers SET status = 'countered', counter_amount = ?, auto_action = 'auto_counter', responded_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [counterAmount, offer.offer_id],
                    );
                    logAutomationAction(
                        rule.user_id,
                        rule.id,
                        'offer',
                        offer.platform,
                        'success',
                        'auto_counter',
                        offer.offer_id,
                        `Countered $${offer.offer_amount.toFixed(2)} with $${counterAmount.toFixed(2)} (${conditions.counterPercentage}% of $${offer.listing_price.toFixed(2)}) on "${offer.title}"`,
                    );
                    processed++;
                    succeeded++;
                } else {
                    // Counter would be less than or equal to offer — accept instead
                    await query.run(
                        `UPDATE offers SET status = 'accepted', auto_action = 'auto_accept_counter', responded_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [offer.offer_id],
                    );
                    logAutomationAction(
                        rule.user_id,
                        rule.id,
                        'offer',
                        offer.platform,
                        'success',
                        'auto_accept_counter',
                        offer.offer_id,
                        `Accepted $${offer.offer_amount.toFixed(2)} (counter $${counterAmount.toFixed(2)} <= offer) on "${offer.title}"`,
                    );
                    processed++;
                    succeeded++;
                }
            } else {
                logAutomationAction(
                    rule.user_id,
                    rule.id,
                    'offer',
                    offer.platform,
                    'skipped',
                    'offer_outside_criteria',
                    offer.offer_id,
                    `Skipped $${offer.offer_amount.toFixed(2)} (${pct.toFixed(0)}%) — outside criteria`,
                );
                processed++;
            }
        } catch (err) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                'offer',
                offer.platform,
                'failure',
                'offer_action',
                offer.offer_id,
                err.message,
            );
            processed++;
            failed++;
        }
    }
    const desc = actions.autoAccept
        ? `accept >=${conditions.minPercentage || 0}%`
        : actions.autoCounter
          ? `counter at ${conditions.counterPercentage || 0}%`
          : `decline <=${conditions.maxPercentage || 0}%`;
    return {
        message:
            pendingOffers.length === 0
                ? 'Offer automation: no pending offers found'
                : `Offer automation (${desc}): ${succeeded}/${processed} offers processed`,
        itemsProcessed: processed,
        itemsSucceeded: succeeded,
        itemsFailed: failed,
    };
}

async function executeFollow(rule, conditions, actions) {
    logAutomationAction(
        rule.user_id,
        rule.id,
        'follow',
        rule.platform,
        'skipped',
        'follow_noop',
        null,
        'Follow automation requires platform API (not available offline)',
    );
    return {
        message: 'Follow: requires platform API (not available offline)',
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
    };
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
        const shop = await query.get('SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = TRUE', [
            rule.user_id,
            'poshmark',
        ]);
        if (!shop || !shop.platform_username) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                'otl',
                'poshmark',
                'failure',
                'otl_no_shop',
                null,
                'No connected Poshmark account found',
            );
            return {
                message: 'OTL: No connected Poshmark account',
                itemsProcessed: 0,
                itemsSucceeded: 0,
                itemsFailed: 0,
            };
        }

        auditLog('poshmark', 'otl_automation_start', { userId: rule.user_id, discountPercent, maxOffers });

        const bot = await getPoshmarkBot({ headless: true });
        const result = await bot.sendOffersToAllListings(shop.platform_username, {
            discountPercent,
            shippingDiscount,
            maxOffers,
            delayBetween: jitteredDelay(5000),
        });

        await bot.close();

        const offersSent = result?.offersSent || 0;
        logAutomationAction(
            rule.user_id,
            rule.id,
            'otl',
            'poshmark',
            'success',
            'otl_send',
            null,
            `Sent ${offersSent} OTL offers (${discountPercent}% off)`,
        );
        auditLog('poshmark', 'otl_automation_success', { userId: rule.user_id, offersSent, discountPercent });

        return {
            message: `OTL: Sent ${offersSent} offers (${discountPercent}% off)`,
            itemsProcessed: offersSent,
            itemsSucceeded: offersSent,
            itemsFailed: 0,
        };
    } catch (err) {
        logAutomationAction(rule.user_id, rule.id, 'otl', 'poshmark', 'failure', 'otl_error', null, err.message);
        logger.error('[TaskWorker] OTL automation failed:', err.message);
        return { message: `OTL: Failed — ${err.message}`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 1 };
    }
}

async function executeCustom(rule, conditions, actions) {
    // Bundle discount: find users who liked multiple items, create bundle discount offers
    if (actions.bundleDiscount) {
        const minItems = conditions.minBundleItems || 2;
        const discountPct = actions.discountPercent || 15;

        // Find buyers who liked multiple active listings
        const bundleCandidates = await query.all(
            `
            SELECT buyer_username, COUNT(*) as liked_count,
                   STRING_AGG(listing_id, ',') as listing_ids,
                   SUM(l.price) as total_price
            FROM offers o
            JOIN listings l ON o.listing_id = l.id
            WHERE l.user_id = ? AND l.status = 'active' AND o.status = 'pending'
            GROUP BY buyer_username
            HAVING COUNT(*) >= ?
        `,
            [rule.user_id, minItems],
        );

        let processed = 0,
            succeeded = 0;
        for (const candidate of bundleCandidates) {
            const bundlePrice = Math.round(candidate.total_price * (1 - discountPct / 100) * 100) / 100;
            logAutomationAction(
                rule.user_id,
                rule.id,
                'custom',
                rule.platform,
                'success',
                'bundle_discount',
                null,
                `Bundle offer: @${candidate.buyer_username} (${candidate.liked_count} items, $${bundlePrice.toFixed(2)} at ${discountPct}% off)`,
            );
            processed++;
            succeeded++;
        }
        return {
            message: `Bundle discount: ${succeeded}/${processed} bundle offers created (${discountPct}% off, min ${minItems} items)`,
            itemsProcessed: processed,
            itemsSucceeded: succeeded,
            itemsFailed: 0,
        };
    }

    // Bundle reminder: find users with existing bundles, log reminder
    if (actions.bundleReminder) {
        const bundles = await query.all(
            `
            SELECT buyer_username, COUNT(*) as item_count, SUM(l.price) as total
            FROM offers o
            JOIN listings l ON o.listing_id = l.id
            WHERE l.user_id = ? AND o.status = 'bundled'
            GROUP BY buyer_username
        `,
            [rule.user_id],
        );

        let processed = 0;
        for (const bundle of bundles) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                'custom',
                rule.platform,
                'success',
                'bundle_reminder',
                null,
                `Reminder sent: @${bundle.buyer_username} (${bundle.item_count} items, $${bundle.total?.toFixed(2)})`,
            );
            processed++;
        }
        return {
            message: `Bundle reminder: ${processed} reminders sent`,
            itemsProcessed: processed,
            itemsSucceeded: processed,
            itemsFailed: 0,
        };
    }

    // Create bundle for likers: find users who liked N+ items
    if (actions.createBundle) {
        const minLikes = conditions.minLikes || 3;
        const likers = await query.all(
            `
            SELECT le.source AS liker_username, COUNT(*) as like_count,
                   STRING_AGG(l.id, ',') as listing_ids
            FROM listing_engagement le
            JOIN listings l ON le.listing_id = l.id
            WHERE l.user_id = ? AND le.event_type = 'like' AND l.status = 'active'
            GROUP BY le.source
            HAVING COUNT(*) >= ?
        `,
            [rule.user_id, minLikes],
        );

        let processed = 0;
        for (const liker of likers) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                'custom',
                rule.platform,
                'success',
                'create_bundle',
                null,
                `Auto-bundle created: @${liker.liker_username} (${liker.like_count} liked items)`,
            );
            processed++;
        }
        return {
            message: `Create bundles: ${processed} bundles created (min ${minLikes} likes)`,
            itemsProcessed: processed,
            itemsSucceeded: processed,
            itemsFailed: 0,
        };
    }

    // Error retry: find failed tasks and re-queue them
    if (actions.retryFailed) {
        const maxRetries = actions.maxRetries || 3;
        const failedTasks = await query.all(
            `
            SELECT * FROM task_queue
            WHERE status = 'failed' AND attempts < ?
            AND payload::jsonb->>'userId' = ?
            ORDER BY completed_at DESC LIMIT 20
        `,
            [maxRetries, rule.user_id],
        );

        let retried = 0;
        for (const task of failedTasks) {
            await query.run(
                `UPDATE task_queue SET status = 'pending', scheduled_at = NOW(), updated_at = NOW() WHERE id = ?`,
                [task.id],
            );
            logAutomationAction(
                rule.user_id,
                rule.id,
                'custom',
                null,
                'success',
                'error_retry',
                task.id,
                `Retried failed task: ${task.type} (attempt ${task.attempts + 1})`,
            );
            retried++;
        }
        return {
            message: `Error retry: ${retried} failed tasks re-queued`,
            itemsProcessed: retried,
            itemsSucceeded: retried,
            itemsFailed: 0,
        };
    }

    logAutomationAction(
        rule.user_id,
        rule.id,
        'custom',
        rule.platform,
        'success',
        'custom_run',
        null,
        `Custom automation "${rule.name}" executed`,
    );
    return {
        message: `Custom automation "${rule.name}" executed`,
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
    };
}

const TASK_WORKER_LAUNCH_PLATFORMS = new Set([
    'poshmark',
    'ebay',
    'mercari',
    'depop',
    'grailed',
    'facebook',
    'whatnot',
]);

async function executePlatformBot(platform, rule, conditions, actions) {
    switch (platform) {
        case 'mercari':
            if (!TASK_WORKER_LAUNCH_PLATFORMS.has('mercari')) return { skipped: true, reason: 'post-launch platform' };
            return await executeMercariBot(rule, conditions, actions);
        case 'depop':
            return await executeDepopBot(rule, conditions, actions);
        case 'grailed':
            if (!TASK_WORKER_LAUNCH_PLATFORMS.has('grailed')) return { skipped: true, reason: 'post-launch platform' };
            return await executeGrailedBot(rule, conditions, actions);
        case 'facebook':
            return await executeFacebookBot(rule, conditions, actions);
        case 'whatnot':
            return await executeWhatnotBot(rule, conditions, actions);
        default:
            logAutomationAction(
                rule.user_id,
                rule.id,
                rule.type,
                platform,
                'skipped',
                'unsupported_platform',
                null,
                `No Playwright bot available for platform: ${platform}`,
            );
            return { message: `${platform}: No bot available`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
    }
}

async function executeMercariBot(rule, conditions, actions) {
    try {
        const shop = await query.get('SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = TRUE', [
            rule.user_id,
            'mercari',
        ]);
        if (!shop) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                rule.type,
                'mercari',
                'failure',
                'mercari_no_shop',
                null,
                'No connected Mercari account found',
            );
            return { message: 'Mercari: No connected account', itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
        }

        auditLog('mercari', `${rule.type}_start`, { userId: rule.user_id });
        const result = await runAutomationWorkerJob('mercari_refresh', rule.user_id, {
            maxItems: conditions.maxItems || 50,
        });
        const refreshed = result?.refreshed || 0;

        logAutomationAction(
            rule.user_id,
            rule.id,
            rule.type,
            'mercari',
            'success',
            'mercari_refresh',
            null,
            `Refreshed ${refreshed} Mercari listings`,
        );
        auditLog('mercari', 'refresh_success', { userId: rule.user_id, refreshed });

        return {
            message: `Mercari refresh: ${refreshed} listings bumped`,
            itemsProcessed: refreshed,
            itemsSucceeded: refreshed,
            itemsFailed: result?.skipped || 0,
        };
    } catch (err) {
        logAutomationAction(rule.user_id, rule.id, rule.type, 'mercari', 'failure', 'mercari_error', null, err.message);
        logger.error('[TaskWorker] Mercari bot failed:', err.message);
        return { message: `Mercari: Failed — ${err.message}`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 1 };
    }
}

async function executeDepopBot(rule, conditions, actions) {
    try {
        const shop = await query.get('SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = TRUE', [
            rule.user_id,
            'depop',
        ]);
        if (!shop) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                rule.type,
                'depop',
                'failure',
                'depop_no_shop',
                null,
                'No connected Depop account found',
            );
            return { message: 'Depop: No connected account', itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
        }

        auditLog('depop', `${rule.type}_start`, { userId: rule.user_id });
        if (!shop.platform_username) {
            return {
                message: 'Depop: No platform username configured',
                itemsProcessed: 0,
                itemsSucceeded: 0,
                itemsFailed: 0,
            };
        }

        const jobType = rule.type === 'share' ? 'depop_share' : 'depop_refresh';
        const result = await runAutomationWorkerJob(jobType, rule.user_id, {
            maxItems: conditions.maxItems || 50,
            platformUsername: shop.platform_username,
        });
        const refreshed = result?.refreshed || 0;

        if (jobType === 'depop_share') {
            logAutomationAction(
                rule.user_id,
                rule.id,
                'share',
                'depop',
                'success',
                'depop_share',
                null,
                `Shared/refreshed ${refreshed} Depop listings`,
            );
            auditLog('depop', 'share_success', { userId: rule.user_id, refreshed });
            return {
                message: `Depop share: ${refreshed} listings refreshed`,
                itemsProcessed: refreshed,
                itemsSucceeded: refreshed,
                itemsFailed: result?.skipped || 0,
            };
        }

        logAutomationAction(
            rule.user_id,
            rule.id,
            rule.type,
            'depop',
            'success',
            'depop_refresh',
            null,
            `Refreshed ${refreshed} Depop listings`,
        );
        auditLog('depop', 'refresh_success', { userId: rule.user_id, refreshed });
        return {
            message: `Depop refresh: ${refreshed} listings bumped`,
            itemsProcessed: refreshed,
            itemsSucceeded: refreshed,
            itemsFailed: result?.skipped || 0,
        };
    } catch (err) {
        logAutomationAction(rule.user_id, rule.id, rule.type, 'depop', 'failure', 'depop_error', null, err.message);
        logger.error('[TaskWorker] Depop bot failed:', err.message);
        return { message: `Depop: Failed — ${err.message}`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 1 };
    }
}

async function executeGrailedBot(rule, conditions, actions) {
    try {
        const shop = await query.get('SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = TRUE', [
            rule.user_id,
            'grailed',
        ]);
        if (!shop) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                rule.type,
                'grailed',
                'failure',
                'grailed_no_shop',
                null,
                'No connected Grailed account found',
            );
            return { message: 'Grailed: No connected account', itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
        }

        auditLog('grailed', `${rule.type}_start`, { userId: rule.user_id });
        const result = await runAutomationWorkerJob('grailed_bump', rule.user_id, {
            maxItems: conditions.maxItems || 50,
        });
        const bumped = result?.bumped || 0;

        logAutomationAction(
            rule.user_id,
            rule.id,
            rule.type,
            'grailed',
            'success',
            'grailed_bump',
            null,
            `Bumped ${bumped} Grailed listings`,
        );
        auditLog('grailed', 'bump_success', { userId: rule.user_id, bumped });
        return {
            message: `Grailed bump: ${bumped} listings bumped`,
            itemsProcessed: bumped,
            itemsSucceeded: bumped,
            itemsFailed: result?.skipped || 0,
        };
    } catch (err) {
        logAutomationAction(rule.user_id, rule.id, rule.type, 'grailed', 'failure', 'grailed_error', null, err.message);
        logger.error('[TaskWorker] Grailed bot failed:', err.message);
        return { message: `Grailed: Failed — ${err.message}`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 1 };
    }
}

async function executeFacebookBot(rule, conditions, actions) {
    try {
        const shop = await query.get('SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = TRUE', [
            rule.user_id,
            'facebook',
        ]);
        if (!shop) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                rule.type,
                'facebook',
                'failure',
                'facebook_no_shop',
                null,
                'No connected Facebook account found',
            );
            return { message: 'Facebook: No connected account', itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
        }

        auditLog('facebook', `${rule.type}_start`, { userId: rule.user_id });
        const result = await runAutomationWorkerJob('facebook_refresh', rule.user_id, {
            maxItems: conditions.maxItems || 50,
        });
        const refreshed = result?.refreshed || 0;

        logAutomationAction(
            rule.user_id,
            rule.id,
            rule.type,
            'facebook',
            'success',
            'facebook_refresh',
            null,
            `Refreshed ${refreshed} Facebook Marketplace listings`,
        );
        auditLog('facebook', 'refresh_success', { userId: rule.user_id, refreshed });
        return {
            message: `Facebook refresh: ${refreshed} listings refreshed`,
            itemsProcessed: refreshed,
            itemsSucceeded: refreshed,
            itemsFailed: result?.skipped || 0,
        };
    } catch (err) {
        logAutomationAction(
            rule.user_id,
            rule.id,
            rule.type,
            'facebook',
            'failure',
            'facebook_error',
            null,
            err.message,
        );
        logger.error('[TaskWorker] Facebook bot failed:', err.message);
        return { message: `Facebook: Failed — ${err.message}`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 1 };
    }
}

async function executeWhatnotBot(rule, conditions, actions) {
    try {
        const shop = await query.get('SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = TRUE', [
            rule.user_id,
            'whatnot',
        ]);
        if (!shop) {
            logAutomationAction(
                rule.user_id,
                rule.id,
                rule.type,
                'whatnot',
                'failure',
                'whatnot_no_shop',
                null,
                'No connected Whatnot account found',
            );
            return { message: 'Whatnot: No connected account', itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
        }

        auditLog('whatnot', `${rule.type}_start`, { userId: rule.user_id });
        const result = await runAutomationWorkerJob('whatnot_refresh', rule.user_id, {
            maxItems: conditions.maxItems || 50,
        });
        const refreshed = result?.refreshed || 0;

        logAutomationAction(
            rule.user_id,
            rule.id,
            rule.type,
            'whatnot',
            'success',
            'whatnot_refresh',
            null,
            `Refreshed ${refreshed} Whatnot listings`,
        );
        auditLog('whatnot', 'refresh_success', { userId: rule.user_id, refreshed });
        return {
            message: `Whatnot refresh: ${refreshed} listings refreshed`,
            itemsProcessed: refreshed,
            itemsSucceeded: refreshed,
            itemsFailed: result?.skipped || 0,
        };
    } catch (err) {
        logAutomationAction(rule.user_id, rule.id, rule.type, 'whatnot', 'failure', 'whatnot_error', null, err.message);
        logger.error('[TaskWorker] Whatnot bot failed:', err.message);
        return { message: `Whatnot: Failed — ${err.message}`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 1 };
    }
}

// --- Poshmark listing publisher ---
async function executePoshmarkPublishTask(payload) {
    const { listingId, userId } = payload;
    if (!listingId) throw new Error('Missing listingId in publish_listing payload');

    const listing = await query.get(
        'SELECT l.*, i.images AS inv_images FROM listings l LEFT JOIN inventory i ON l.inventory_id = i.id WHERE l.id = ? AND l.user_id = ?',
        [listingId, userId],
    );
    if (!listing)
        return { message: `Listing ${listingId} not found`, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 1 };

    const shop = await query.get('SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = TRUE', [
        userId,
        'poshmark',
    ]);
    if (!shop) {
        await query.run('UPDATE listings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
            'publish_failed',
            listingId,
        ]);
        return { message: 'No connected Poshmark shop found', itemsProcessed: 1, itemsSucceeded: 0, itemsFailed: 1 };
    }

    let platformData = {};
    try {
        platformData = JSON.parse(listing.platform_specific_data || '{}');
    } catch (_) {}

    let images = [];
    try {
        images = JSON.parse(listing.images || listing.inv_images || '[]');
    } catch (_) {}

    const { getPoshmarkBot } = await import('../../shared/automations/poshmark-bot.js');
    const { auditLog } = await import('../services/platformSync/platformAuditLog.js');

    const bot = await getPoshmarkBot({ headless: true });
    try {
        await bot.login();

        const result = await bot.createListing({
            title: listing.title,
            description: listing.description || '',
            price: listing.price,
            originalPrice: listing.original_price || listing.price,
            images,
            categoryPath: listing.category_path || platformData.category || '',
            conditionTag: listing.condition_tag || platformData.condition || 'good',
            brand: platformData.brand || '',
            size: platformData.size || listing.size || '',
        });

        if (result.success) {
            await query.run(
                'UPDATE listings SET status = ?, platform_url = ?, listed_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['active', result.listingUrl, listingId],
            );
            auditLog('poshmark', 'publish_success', { listingId, listingUrl: result.listingUrl, userId });
            logger.info('[TaskWorker] Poshmark listing published', { listingId, url: result.listingUrl });
            return { message: `Published: ${result.listingUrl}`, itemsProcessed: 1, itemsSucceeded: 1, itemsFailed: 0 };
        } else {
            await query.run('UPDATE listings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
                'publish_failed',
                listingId,
            ]);
            auditLog('poshmark', 'publish_failure', { listingId, error: result.error, userId });
            return { message: `Publish failed: ${result.error}`, itemsProcessed: 1, itemsSucceeded: 0, itemsFailed: 1 };
        }
    } finally {
        await bot.close().catch(() => {});
    }
}

async function executePoshmarkInventorySyncTask(payload) {
    const { userId, username, maxItems = 100 } = payload;
    if (!userId || !username) {
        throw new Error('Missing userId or username in payload');
    }

    logger.info('[TaskWorker] Starting Poshmark inventory sync', userId, { username, maxItems });

    const { getPoshmarkBot, closePoshmarkBot } = await import('../../shared/automations/poshmark-bot.js');
    const bot = await getPoshmarkBot();

    try {
        const listings = await bot.getClosetListings(username, maxItems);

        let synced = 0;
        let skipped = 0;

        for (const item of listings) {
            try {
                // Deduplicate by matching title + user (Poshmark URL stored in notes)
                const existing = await query.get(
                    'SELECT id FROM inventory WHERE user_id = ? AND title = ? AND notes ILIKE ?',
                    [userId, item.title || '', '%poshmark.com%'],
                );

                if (existing) {
                    skipped++;
                    continue;
                }

                const itemId = uuidv4();
                await query.run(
                    `INSERT INTO inventory (id, user_id, title, description, list_price, brand, category, condition, images, notes, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
                    [
                        itemId,
                        userId,
                        item.title || '',
                        item.description || '',
                        item.price || 0,
                        item.brand || '',
                        item.category || '',
                        item.condition || 'good',
                        JSON.stringify(item.images || []),
                        `Synced from Poshmark: ${item.url || ''}`,
                    ],
                );
                synced++;
            } catch (itemErr) {
                logger.warn('[TaskWorker] Poshmark sync item error', userId, {
                    url: item.url,
                    detail: itemErr.message,
                });
                skipped++;
            }
        }

        logger.info('[TaskWorker] Poshmark inventory sync complete', userId, {
            synced,
            skipped,
            total: listings.length,
        });

        createOAuthNotification(userId, 'poshmark', NotificationTypes.SYNC_COMPLETED, {
            listingsSynced: synced,
            listingsSkipped: skipped,
        });

        return { synced, skipped, total: listings.length };
    } finally {
        await closePoshmarkBot();
    }
}

async function executeScrapeCompetitorClosetTask(payload) {
    const { competitorId, userId, username } = payload;
    if (!competitorId || !userId || !username) {
        throw new Error('Missing competitorId, userId, or username in scrape_competitor_closet payload');
    }

    logger.info('[TaskWorker] Scraping competitor closet', userId, { username, competitorId });

    const { getPoshmarkBot, closePoshmarkBot } = await import('../../shared/automations/poshmark-bot.js');
    const { normalizeScrapedListings } = await import('../services/marketDataService.js');
    const bot = await getPoshmarkBot();

    try {
        const scraped = await bot.getClosetListings(username, 100);
        const listings = normalizeScrapedListings(competitorId, scraped);

        let inserted = 0;
        try {
            await query.transaction(async () => {
                for (const listing of listings) {
                    await query.run(
                        `
                        INSERT INTO competitor_listings
                            (id, competitor_id, external_id, title, price, original_price,
                             category, brand, condition, listed_at, sold_at, url, image_url, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                        ON CONFLICT (id) DO UPDATE SET
                            title = EXCLUDED.title, price = EXCLUDED.price,
                            original_price = EXCLUDED.original_price, sold_at = EXCLUDED.sold_at,
                            url = EXCLUDED.url, image_url = EXCLUDED.image_url, updated_at = NOW()
                    `,
                        [
                            listing.id,
                            competitorId,
                            listing.external_id,
                            listing.title,
                            listing.price,
                            listing.original_price,
                            listing.category,
                            listing.brand,
                            listing.condition,
                            listing.listed_at,
                            listing.sold_at,
                            listing.url,
                            listing.image_url,
                        ],
                    );
                    inserted++;
                }
            });
        } catch (dbErr) {
            logger.error('[TaskWorker] Competitor listing insert failed', userId, {
                competitorId,
                detail: dbErr.message,
            });
        }

        // Update aggregate stats on the competitor record
        if (listings.length > 0) {
            const prices = listings.map((l) => l.price).filter((p) => p > 0);
            const avgPrice =
                prices.length > 0 ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : null;
            await query.run(
                `
                UPDATE competitors
                SET listing_count = ?, avg_price = COALESCE(?, avg_price), last_checked_at = NOW(), updated_at = NOW()
                WHERE id = ?
            `,
                [listings.length, avgPrice, competitorId],
            );
        }

        logger.info('[TaskWorker] Competitor closet scrape complete', userId, {
            username,
            inserted,
            total: scraped.length,
        });
        return { inserted, total: scraped.length };
    } finally {
        await closePoshmarkBot();
    }
}

async function executePoshmarkMonitoringTask(payload) {
    const { userId } = payload;
    if (!userId) throw new Error('Missing userId in poshmark_monitoring payload');

    logger.info('[TaskWorker] Starting Poshmark monitoring check', userId);

    const { getPoshmarkBot, closePoshmarkBot } = await import('../../shared/automations/poshmark-bot.js');
    const bot = await getPoshmarkBot();

    try {
        await bot.login();
        const stats = await bot.getClosetStats();

        const id = uuidv4();
        await query.run(
            `INSERT INTO poshmark_monitoring_log
                (id, user_id, total_listings, total_shares, total_likes, active_offers, recent_sales, closet_value, checked_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                id,
                userId,
                stats.totalListings,
                stats.totalShares,
                stats.totalLikes,
                stats.activeOffers,
                stats.recentSales,
                stats.closetValue,
            ],
        );

        logger.info('[TaskWorker] Poshmark monitoring saved', userId, { logId: id, ...stats });

        try {
            const { websocketService } = await import('../services/websocket.js');
            websocketService.sendToUser(userId, {
                type: 'monitoring.updated',
                platform: 'poshmark',
                data: stats,
            });
        } catch (_) {
            /* WS not available */
        }

        return { message: 'Poshmark monitoring snapshot saved', logId: id, ...stats };
    } finally {
        await closePoshmarkBot();
    }
}

// --- Main automation dispatcher ---
async function executeRunAutomationTask(payload) {
    const { ruleId, userId } = payload;
    if (!ruleId) throw new Error('Missing ruleId in run_automation payload');
    const rule = await query.get('SELECT * FROM automation_rules WHERE id = ? AND is_enabled = TRUE', [ruleId]);
    if (!rule)
        return {
            message: `Automation rule ${ruleId} not found or disabled — skipping`,
            itemsProcessed: 0,
            itemsSucceeded: 0,
            itemsFailed: 0,
        };

    let conditions = {},
        actions = {};
    try {
        conditions = JSON.parse(rule.conditions || '{}');
    } catch (_) {}
    try {
        actions = JSON.parse(rule.actions || '{}');
    } catch (_) {}

    logger.info(`[TaskWorker] Running automation: ${rule.name} (${rule.type}) for user ${rule.user_id}`);

    // Route to platform-specific Playwright bots when applicable
    const platform = rule.platform;
    const botPlatforms = ['mercari', 'depop', 'grailed', 'facebook', 'whatnot'];
    let result;

    if (botPlatforms.includes(platform) && (rule.type === 'share' || rule.type === 'relist')) {
        result = await executePlatformBot(platform, rule, conditions, actions);
    } else {
        switch (rule.type) {
            case 'price_drop':
                result = executePriceDrop(rule, conditions, actions);
                break;
            case 'relist':
                result = executeRelist(rule, conditions, actions);
                break;
            case 'share':
                result = actions.communityShare
                    ? await executeCommunityShare(rule, conditions, actions)
                    : executeShare(rule, conditions, actions);
                break;
            case 'offer':
                result = executeOffer(rule, conditions, actions);
                break;
            case 'follow':
                result = executeFollow(rule, conditions, actions);
                break;
            case 'otl':
                result = await executeOtl(rule, conditions, actions);
                break;
            case 'custom':
            default:
                result = executeCustom(rule, conditions, actions);
                break;
        }
    }

    await query.run(
        `UPDATE automation_rules SET last_run_at = NOW(), run_count = run_count + 1, error_count = error_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [result.itemsFailed > 0 ? 1 : 0, ruleId],
    );

    // Send in-app notification + WebSocket push for automation results
    try {
        const { createOAuthNotification, NotificationTypes } = await import('../services/notificationService.js');
        let notification;
        if (result.itemsFailed > 0 && result.itemsSucceeded === 0) {
            notification = createOAuthNotification(
                rule.user_id,
                rule.platform || 'automation',
                NotificationTypes.AUTOMATION_FAILED,
                {
                    message: result.message,
                    error: result.message,
                    ruleId,
                    ruleName: rule.name,
                },
            );
        } else if (result.itemsFailed > 0) {
            notification = createOAuthNotification(
                rule.user_id,
                rule.platform || 'automation',
                NotificationTypes.AUTOMATION_PARTIAL,
                {
                    message: `${rule.name}: ${result.itemsSucceeded} succeeded, ${result.itemsFailed} failed`,
                    ruleId,
                    ruleName: rule.name,
                },
            );
        } else if (result.itemsProcessed > 0) {
            notification = createOAuthNotification(
                rule.user_id,
                rule.platform || 'automation',
                NotificationTypes.AUTOMATION_COMPLETED,
                {
                    message: result.message,
                    ruleId,
                    ruleName: rule.name,
                },
            );
        }

        // Push notification via WebSocket for real-time display
        if (notification) {
            try {
                const { websocketService } = await import('../services/websocket.js');
                websocketService.sendToUser(rule.user_id, {
                    type: 'notification',
                    notification: {
                        id: notification.id,
                        type: notification.type,
                        title: notification.title,
                        message: notification.message,
                        data: notification.data,
                        created_at: notification.created_at,
                    },
                });
            } catch (_) {
                /* WS not available */
            }

            // Send email notification if user has email_enabled
            try {
                const prefRow = await query.get('SELECT settings FROM user_preferences WHERE user_id = ? AND key = ?', [
                    rule.user_id,
                    'automation_notifications',
                ]);
                if (prefRow) {
                    const prefs = JSON.parse(prefRow.settings);
                    if (prefs.email_enabled) {
                        const nType = notification.type;
                        const shouldEmail =
                            (nType === 'success' && prefs.on_success) ||
                            (nType === 'error' && prefs.on_failure) ||
                            (nType === 'warning' && prefs.on_partial);
                        if (shouldEmail) {
                            const userRow = await query.get('SELECT email, username FROM users WHERE id = ?', [
                                rule.user_id,
                            ]);
                            if (userRow?.email) {
                                const { sendAutomationNotificationEmail } = await import('../services/email.js');
                                await sendAutomationNotificationEmail(userRow, notification);
                            }
                        }
                    }
                }
            } catch (_) {
                /* Email not configured or failed */
            }
        }
    } catch (notifyErr) {
        logger.error('[TaskWorker] Failed to create automation notification:', notifyErr.message);
    }

    return {
        message: result.message,
        itemsProcessed: result.itemsProcessed,
        itemsSucceeded: result.itemsSucceeded,
        itemsFailed: result.itemsFailed,
        ruleId,
        type: rule.type,
        ruleName: rule.name,
    };
}

/**
 * Permanently delete inventory items that have been soft-deleted for more than 30 days.
 * Payload: { userId } — when provided, scopes purge to that user.
 *          Omit userId to purge globally (admin/cron use only).
 */
async function executePurgeDeletedInventoryTask(payload) {
    const { userId } = payload || {};

    let sql = `
        DELETE FROM inventory
        WHERE status = 'deleted'
          AND updated_at < NOW() - INTERVAL '30 days'
    `;
    const params = [];

    if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
    }

    const result = await query.run(sql, params);
    const purged = result.changes ?? result.rowCount ?? 0;
    logger.info('[TaskWorker] purge_deleted_inventory completed', userId || 'global', { purged });
    return { purged, message: `Permanently removed ${purged} deleted inventory item(s) past 30-day retention` };
}
