// Automation Runner - Orchestrates all automation tasks
// Bot-based tasks (share, follow) are delegated to the Playwright worker via BullMQ.
import { query } from '../../backend/db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { Queue } from 'bullmq';
import { logger } from '../../backend/shared/logger.js';
import { auditLog } from '../../backend/services/platformSync/platformAuditLog.js';

// BullMQ queue for Playwright worker tasks (lazy-initialized)
let _automationQueue = null;
function getAutomationQueue() {
    if (_automationQueue) return _automationQueue;
    _automationQueue = new Queue('automation-jobs', {
        connection: { url: process.env.REDIS_URL },
    });
    return _automationQueue;
}

// Platform-level mutex: prevents two automations running against the same platform simultaneously.
// Maps platformName -> boolean (true = running).
const platformLocks = new Map();

/**
 * AutomationRunner class
 * Manages and executes automation rules
 */
export class AutomationRunner {
    constructor() {
        this.isRunning = false;
        this.currentTask = null;
    }

    /**
     * Start the automation runner
     */
    async start() {
        if (this.isRunning) {
            logger.automation('[Runner] Already running');
            return;
        }

        this.isRunning = true;
        logger.automation('[Runner] Starting automation runner...');

        // Process pending tasks
        await this.processTasks();

        // Check scheduled rules
        await this.checkScheduledRules();

        logger.automation('[Runner] Automation runner started');
    }

    /**
     * Stop the automation runner
     */
    async stop() {
        this.isRunning = false;
        logger.automation('[Runner] Stopping automation runner...');
        if (_automationQueue) await _automationQueue.close();
        logger.automation('[Runner] Automation runner stopped');
    }

    /**
     * Process pending tasks from the queue
     */
    async processTasks() {
        const pendingTasks = await query.all(`
            SELECT * FROM tasks
            WHERE status = 'pending' AND scheduled_at <= NOW()
            ORDER BY priority ASC, scheduled_at ASC
            LIMIT 10
        `);

        logger.info(`[Runner] Found ${pendingTasks.length} pending tasks`);

        for (const task of pendingTasks) {
            if (!this.isRunning) break;

            try {
                await this.executeTask(task);
            } catch (error) {
                logger.error('[Runner] Task execution error:', error);
                this.logTaskError(task.id, error.message);
            }
        }
    }

    /**
     * Execute a single task
     */
    async executeTask(task) {
        logger.info(`[Runner] Executing task: ${task.type} (${task.id})`);

        // Mark as processing
        await query.run('UPDATE tasks SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?', ['processing', task.id]);
        this.currentTask = task;

        const payload = JSON.parse(task.payload || '{}');
        let result = null;
        const taskPlatform = payload.platform || null;

        // Acquire platform mutex for bot-based tasks before any execution
        if (taskPlatform) {
            if (!this.acquirePlatformLock(taskPlatform)) {
                // Release processing state — let the task retry later
                await query.run('UPDATE tasks SET status = ? WHERE id = ?', ['pending', task.id]);
                this.currentTask = null;
                throw new Error(`Automation already running for this platform: ${taskPlatform}`);
            }
        }

        try {
            switch (task.type) {
                // Bot tasks — delegate to Playwright worker via BullMQ
                case 'share_listing':
                case 'share_closet':
                case 'follow_user': {
                    const queue = getAutomationQueue();
                    await queue.add(
                        task.type,
                        { taskId: task.id, userId: task.user_id, type: task.type, payload },
                        {
                            attempts: 3,
                            backoff: { type: 'exponential', delay: 5000 },
                            timeout: 300000 // 5 min — bot jobs can be slow
                        }
                    );
                    // Task remains 'processing'; worker updates status on completion
                    this.currentTask = null;
                    if (taskPlatform) this.releasePlatformLock(taskPlatform);
                    return null;
                }

                case 'accept_offer':
                    result = await this.executeAcceptOffer(task.user_id, payload);
                    break;

                case 'decline_offer':
                    result = await this.executeDeclineOffer(task.user_id, payload);
                    break;

                case 'counter_offer':
                    result = await this.executeCounterOffer(task.user_id, payload);
                    break;

                case 'run_automation':
                    result = await this.executeAutomationRule(task.user_id, payload);
                    break;

                case 'sync_shop':
                    result = await this.executeSyncShop(task.user_id, payload);
                    break;

                default:
                    throw new Error(`Unknown task type: ${task.type}`);
            }

            // Mark as completed
            await query.run(`
                UPDATE tasks SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, ['completed', JSON.stringify(result), task.id]);

            // Log success
            this.logAutomationAction(task.user_id, task.type, 'success', result);
            auditLog('poshmark', `automation_${task.type}_success`, { taskId: task.id, result });

            logger.info(`[Runner] Task completed: ${task.id}`);
        } catch (error) {
            // Mark as failed
            const attempts = (task.attempts || 0) + 1;
            const newStatus = attempts >= (task.max_attempts || 3) ? 'failed' : 'pending';

            await query.run(`
                UPDATE tasks SET status = ?, attempts = ?, error_message = ?
                WHERE id = ?
            `, [newStatus, attempts, error.message, task.id]);

            // Log failure
            this.logAutomationAction(task.user_id, task.type, 'failure', null, error.message);
            auditLog('poshmark', `automation_${task.type}_failure`, { taskId: task.id, error: error.message });

            throw error;
        } finally {
            this.currentTask = null;
            if (taskPlatform) this.releasePlatformLock(taskPlatform);
        }

        return result;
    }

    /**
     * Check and execute scheduled automation rules
     */
    async checkScheduledRules() {
        const now = new Date();
        const rules = await query.all(`
            SELECT * FROM automation_rules
            WHERE is_enabled = 1
            AND (next_run_at IS NULL OR next_run_at <= NOW())
        `);

        logger.info(`[Runner] Found ${rules.length} rules to check`);

        for (const rule of rules) {
            if (this.shouldRunRule(rule, now)) {
                // Queue task for this rule
                const taskId = uuidv4();
                await query.run(`
                    INSERT INTO tasks (id, user_id, type, payload, priority, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    taskId,
                    rule.user_id,
                    'run_automation',
                    JSON.stringify({ ruleId: rule.id }),
                    1,
                    'pending'
                ]);

                // Update next run time
                const nextRun = this.calculateNextRun(rule.schedule);
                await query.run('UPDATE automation_rules SET next_run_at = ? WHERE id = ?', [nextRun, rule.id]);

                logger.info(`[Runner] Queued rule: ${rule.name} (${rule.id}), next run: ${nextRun}`);
            }
        }
    }

    /**
     * Check if a rule should run based on schedule
     */
    shouldRunRule(rule, now) {
        if (!rule.schedule) return false;

        // Simple schedule check (cron-like)
        // Format: "minute hour day month weekday" or interval like "*/5" for every 5 units
        const parts = rule.schedule.split(' ');
        if (parts.length !== 5) return false;

        const [minute, hour, day, month, weekday] = parts;

        const matches = (pattern, value) => {
            if (pattern === '*') return true;
            if (pattern.startsWith('*/')) {
                const interval = parseInt(pattern.slice(2));
                return value % interval === 0;
            }
            if (pattern.includes(',')) {
                return pattern.split(',').map(Number).includes(value);
            }
            return parseInt(pattern) === value;
        };

        return matches(minute, now.getMinutes()) &&
               matches(hour, now.getHours()) &&
               matches(day, now.getDate()) &&
               matches(month, now.getMonth() + 1) &&
               matches(weekday, now.getDay());
    }

    /**
     * Calculate next run time based on schedule
     */
    calculateNextRun(schedule) {
        // Simplified: add 1 hour for now
        const next = new Date();
        next.setHours(next.getHours() + 1);
        return next.toISOString();
    }

    /**
     * Acquire the platform mutex. Returns true if acquired, false if already locked.
     */
    acquirePlatformLock(platform) {
        if (platformLocks.get(platform)) return false;
        platformLocks.set(platform, true);
        return true;
    }

    /**
     * Release the platform mutex.
     */
    releasePlatformLock(platform) {
        platformLocks.delete(platform);
    }

    // Task execution methods

    async executeAcceptOffer(userId, payload) {
        const { offerId, platform } = payload;

        const offer = await query.get(
            'SELECT * FROM offers WHERE id = ? AND user_id = ?',
            [offerId, userId]
        );

        if (!offer) {
            throw new Error('Offer not found');
        }

        // In production, would use bot to accept on platform
        await query.run(
            'UPDATE offers SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['accepted', offerId]
        );

        return { success: true, offerId };
    }

    async executeDeclineOffer(userId, payload) {
        const { offerId } = payload;

        await query.run(
            'UPDATE offers SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['declined', offerId]
        );

        return { success: true, offerId };
    }

    async executeCounterOffer(userId, payload) {
        const { offerId, amount } = payload;

        await query.run(
            'UPDATE offers SET status = ?, counter_amount = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['countered', amount, offerId]
        );

        return { success: true, offerId, amount };
    }

    async executeAutomationRule(userId, payload) {
        const { ruleId } = payload;

        const rule = await query.get(
            'SELECT * FROM automation_rules WHERE id = ? AND user_id = ?',
            [ruleId, userId]
        );

        if (!rule) {
            throw new Error('Rule not found');
        }

        const conditions = JSON.parse(rule.conditions || '{}');
        const actions = JSON.parse(rule.actions || '{}');

        let result = { ruleId, type: rule.type, actions: [] };

        switch (rule.type) {
            case 'share':
                if (actions.shareAll) {
                    const listings = await query.all(
                        'SELECT * FROM listings WHERE user_id = ? AND platform = ? AND status = ?',
                        [userId, rule.platform, 'active']
                    );

                    for (const listing of listings) {
                        if (conditions.minPrice && listing.price < conditions.minPrice) continue;

                        // Queue share task
                        await query.run(`
                            INSERT INTO tasks (id, user_id, type, payload, priority, status)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, [
                            uuidv4(), userId, 'share_listing',
                            JSON.stringify({ listingId: listing.id, platform: rule.platform }),
                            5, 'pending'
                        ]);

                        result.actions.push({ action: 'share', listingId: listing.id });
                    }
                }
                break;

            case 'offer':
                // Process pending offers according to rules
                const offers = await query.all(
                    'SELECT o.*, l.price as listing_price FROM offers o JOIN listings l ON o.listing_id = l.id WHERE o.user_id = ? AND o.status = ?',
                    [userId, 'pending']
                );

                for (const offer of offers) {
                    const percentage = (offer.offer_amount / offer.listing_price) * 100;

                    if (actions.autoAccept && conditions.minPercentage && percentage >= conditions.minPercentage) {
                        await query.run(`
                            INSERT INTO tasks (id, user_id, type, payload, priority, status)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, [uuidv4(), userId, 'accept_offer', JSON.stringify({ offerId: offer.id }), 1, 'pending']);
                        result.actions.push({ action: 'accept', offerId: offer.id, percentage });
                    }

                    if (actions.autoDecline && conditions.maxPercentage && percentage <= conditions.maxPercentage) {
                        await query.run(`
                            INSERT INTO tasks (id, user_id, type, payload, priority, status)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, [uuidv4(), userId, 'decline_offer', JSON.stringify({ offerId: offer.id }), 1, 'pending']);
                        result.actions.push({ action: 'decline', offerId: offer.id, percentage });
                    }
                }
                break;

            case 'follow':
                // Follow back followers — delegate to Playwright worker
                if (actions.followBack) {
                    const queue = getAutomationQueue();
                    await queue.add('follow_back', {
                        userId, ruleId, platform: rule.platform,
                        maxFollows: conditions.maxFollows || 50,
                    });
                    result.actions.push({ action: 'follow_back', queued: true });
                }
                break;
        }

        // Update rule stats
        await query.run(
            'UPDATE automation_rules SET last_run_at = CURRENT_TIMESTAMP, run_count = run_count + 1 WHERE id = ?',
            [ruleId]
        );

        return result;
    }

    async executeSyncShop(userId, payload) {
        const { platform, shopId } = payload;

        // Update sync status
        await query.run('UPDATE shops SET sync_status = ?, last_sync_at = CURRENT_TIMESTAMP WHERE id = ?', ['synced', shopId]);

        return { success: true, shopId, platform };
    }

    /**
     * Log automation action
     */
    async logAutomationAction(userId, type, status, details, errorMessage = null) {
        await query.run(`
            INSERT INTO automation_logs (id, user_id, type, status, details, error_message)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [uuidv4(), userId, type, status, JSON.stringify(details), errorMessage]);
    }

    /**
     * Log task error
     */
    async logTaskError(taskId, errorMessage) {
        await query.run('UPDATE tasks SET error_message = ? WHERE id = ?', [errorMessage, taskId]);
    }
}

// Export singleton
let runnerInstance = null;

export function getAutomationRunner() {
    if (!runnerInstance) {
        runnerInstance = new AutomationRunner();
    }
    return runnerInstance;
}
