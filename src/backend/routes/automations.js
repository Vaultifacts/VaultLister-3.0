// Automations Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { checkTierPermission } from '../middleware/auth.js';
import { logger } from '../shared/logger.js';

// Validate cron schedule format (5 or 6 fields, valid characters only)
function validateCronSchedule(schedule) {
    if (!schedule) return;
    const parts = schedule.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
        throw new Error('Invalid cron schedule format. Expected 5-6 space-separated fields');
    }
    const fieldPattern = /^[\d,\-\*/]+$/;
    for (const part of parts) {
        if (!fieldPattern.test(part)) {
            throw new Error(`Invalid cron schedule field: "${part}"`);
        }
    }
}

export async function automationsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // Check automation permission
    const permission = checkTierPermission(user, 'automations');
    if (!permission.allowed && method !== 'GET') {
        return { status: 403, data: { error: 'Automations not available on your plan' } };
    }

    // GET /api/automations - List all automation rules
    if (method === 'GET' && (path === '/' || path === '')) {
        const { type, platform, enabled } = queryParams;

        let sql = 'SELECT * FROM automation_rules WHERE user_id = ?';
        const params = [user.id];

        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }

        if (platform) {
            sql += ' AND platform = ?';
            params.push(platform);
        }

        if (enabled !== undefined) {
            sql += ' AND is_enabled = ?';
            params.push(enabled === 'true' ? 1 : 0);
        }

        sql += ' ORDER BY created_at DESC';

        const rules = query.all(sql, params);

        rules.forEach(rule => {
            try {
                rule.conditions = JSON.parse(rule.conditions || '{}');
            } catch (error) {
                logger.warn('[Automations] failed to parse automation conditions', { detail: error?.message || 'Unknown error' });
                rule.conditions = [];
            }
            try {
                rule.actions = JSON.parse(rule.actions || '{}');
            } catch (error) {
                logger.warn('[Automations] failed to parse automation actions', { detail: error?.message || 'Unknown error' });
                rule.actions = {};
            }
        });

        return { status: 200, data: { rules } };
    }

    // GET /api/automations/logs - Get automation logs
    if (method === 'GET' && path === '/logs') {
        const { type, status, limit = 100, offset = 0 } = queryParams;

        let sql = 'SELECT * FROM automation_logs WHERE user_id = ?';
        const params = [user.id];

        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        const parsedLimit = Number(limit);
        const parsedOffset = Number(offset);
        if (!Number.isFinite(parsedLimit) || !Number.isFinite(parsedOffset) || parsedLimit < 0 || parsedOffset < 0) {
            return { status: 400, data: { error: 'limit and offset must be valid non-negative numbers' } };
        }
        const safeParsedLimit = Math.min(parsedLimit, 200);
        params.push(Math.floor(safeParsedLimit), Math.floor(parsedOffset));

        const logs = query.all(sql, params);

        const total = query.get('SELECT COUNT(*) as count FROM automation_logs WHERE user_id = ?', [user.id])?.count || 0;

        return { status: 200, data: { logs, total } };
    }

    // GET /api/automations/history - Get detailed automation run history
    if (method === 'GET' && path === '/history') {
        const { status, type, limit = 50, offset = 0 } = queryParams;

        let sql = 'SELECT * FROM automation_runs WHERE user_id = ?';
        const params = [user.id];

        if (status && status !== 'all') {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (type && type !== 'all') {
            sql += ' AND automation_type = ?';
            params.push(type);
        }

        sql += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
        const parsedHistLimit = Number(limit);
        const parsedHistOffset = Number(offset);
        if (!Number.isFinite(parsedHistLimit) || !Number.isFinite(parsedHistOffset) || parsedHistLimit < 0 || parsedHistOffset < 0) {
            return { status: 400, data: { error: 'limit and offset must be valid non-negative numbers' } };
        }
        const safeHistLimit = Math.min(parsedHistLimit, 200);
        params.push(Math.floor(safeHistLimit), Math.floor(parsedHistOffset));

        try {
            const runs = query.all(sql, params);

            // Parse metadata JSON for each run
            runs.forEach(run => {
                try {
                    run.metadata = JSON.parse(run.metadata || '{}');
                } catch (e) {
                    run.metadata = {};
                }
            });

            const total = query.get('SELECT COUNT(*) as count FROM automation_runs WHERE user_id = ?', [user.id])?.count || 0;

            // Get summary stats
            const stats = query.get(`
                SELECT
                    COUNT(*) as total_runs,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_runs,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
                    SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_runs,
                    AVG(duration_ms) as avg_duration,
                    SUM(items_processed) as total_items_processed
                FROM automation_runs WHERE user_id = ?
            `, [user.id]);

            return { status: 200, data: { runs, total, stats } };
        } catch (error) {
            logger.error('[Automations] failed to fetch automation history', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to fetch automation history' } };
        }
    }

    // DELETE /api/automations/history - Clear automation run history
    if (method === 'DELETE' && path === '/history') {
        try {
            query.run('DELETE FROM automation_runs WHERE user_id = ?', [user.id]);
            return { status: 200, data: { message: 'History cleared' } };
        } catch (error) {
            logger.error('[Automations] failed to clear history', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to delete automation history' } };
        }
    }

    // GET /api/automations/:id - Get single rule
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);
        const rule = query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);

        if (!rule) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        try {
            rule.conditions = JSON.parse(rule.conditions || '{}');
        } catch (error) {
            logger.warn('[Automations] failed to parse automation conditions', { detail: error?.message || 'Unknown error' });
            rule.conditions = [];
        }
        try {
            rule.actions = JSON.parse(rule.actions || '{}');
        } catch (error) {
            logger.warn('[Automations] failed to parse automation actions', { detail: error?.message || 'Unknown error' });
            rule.actions = {};
        }

        // Get recent logs for this rule
        const logs = query.all(
            'SELECT * FROM automation_logs WHERE rule_id = ? ORDER BY created_at DESC LIMIT 20',
            [id]
        );

        return { status: 200, data: { rule, logs } };
    }

    // POST /api/automations - Create new rule
    if (method === 'POST' && (path === '/' || path === '')) {
        const { name, type, platform, schedule, conditions, actions, isEnabled } = body;

        if (!name || !type) {
            return { status: 400, data: { error: 'Name and type required' } };
        }

        const validTypes = ['share', 'follow', 'offer', 'relist', 'price_drop', 'otl', 'custom'];
        if (!validTypes.includes(type)) {
            return { status: 400, data: { error: 'Invalid automation type' } };
        }

        // Validate platform if provided
        const validPlatforms = ['poshmark', 'ebay', 'mercari', 'depop', 'grailed', 'facebook', 'etsy', 'shopify', 'whatnot', null];
        if (platform && !validPlatforms.includes(platform)) {
            return { status: 400, data: { error: 'Invalid platform' } };
        }

        // Validate name length
        if (name.length > 100) {
            return { status: 400, data: { error: 'Name must be 100 characters or less' } };
        }

        // Validate cron schedule if provided
        if (schedule) {
            try {
                validateCronSchedule(schedule);
            } catch (e) {
                return { status: 400, data: { error: e.message } };
            }
        }

        // Validate conditions/actions JSON size
        const conditionsStr = JSON.stringify(conditions || {});
        const actionsStr = JSON.stringify(actions || {});
        if (conditionsStr.length > 50000) return { status: 400, data: { error: 'Conditions JSON exceeds maximum size (50 KB)' } };
        if (actionsStr.length > 50000) return { status: 400, data: { error: 'Actions JSON exceeds maximum size (50 KB)' } };

        // Enforce max automation rules per tier
        const AUTOMATION_LIMITS = {
            free: 5,
            starter: 20,
            pro: 100,
            enterprise: -1  // unlimited
        };
        const maxRules = AUTOMATION_LIMITS[user.subscription_tier] || AUTOMATION_LIMITS.free;
        if (maxRules !== -1) {
            const currentCount = query.get(
                'SELECT COUNT(*) as count FROM automation_rules WHERE user_id = ?',
                [user.id]
            );
            if (currentCount && currentCount.count >= maxRules) {
                return { status: 403, data: {
                    error: `Maximum ${maxRules} automation rules allowed on your plan`,
                    limit: maxRules,
                    current: currentCount.count
                }};
            }
        }

        const id = uuidv4();

        query.run(`
            INSERT INTO automation_rules (
                id, user_id, name, type, platform, schedule, conditions, actions, is_enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, user.id, name, type, platform, schedule,
            conditionsStr,
            actionsStr,
            isEnabled !== false ? 1 : 0
        ]);

        const rule = query.get('SELECT * FROM automation_rules WHERE id = ?', [id]);
        try {
            rule.conditions = JSON.parse(rule.conditions || '{}');
        } catch (e) {
            logger.error('[Automations] error parsing rule conditions', user?.id, { detail: e?.message || 'Unknown error' });
            rule.conditions = {};
        }
        try {
            rule.actions = JSON.parse(rule.actions || '{}');
        } catch (e) {
            logger.error('[Automations] error parsing rule actions', user?.id, { detail: e?.message || 'Unknown error' });
            rule.actions = {};
        }

        return { status: 201, data: { rule } };
    }

    // PUT /api/automations/:id - Update rule
    if (method === 'PUT' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);

        const existing = query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        const { name, platform, schedule, conditions, actions, isEnabled } = body;

        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }

        if (platform !== undefined) {
            updates.push('platform = ?');
            values.push(platform);
        }

        if (schedule !== undefined) {
            if (schedule !== null) {
                try {
                    validateCronSchedule(schedule);
                } catch (e) {
                    return { status: 400, data: { error: e.message } };
                }
            }
            updates.push('schedule = ?');
            values.push(schedule);
        }

        if (conditions !== undefined) {
            updates.push('conditions = ?');
            values.push(JSON.stringify(conditions));
        }

        if (actions !== undefined) {
            updates.push('actions = ?');
            values.push(JSON.stringify(actions));
        }

        if (isEnabled !== undefined) {
            updates.push('is_enabled = ?');
            values.push(isEnabled ? 1 : 0);
        }

        if (updates.length > 0) {
            values.push(id, user.id);
            query.run(
                `UPDATE automation_rules SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                values
            );
        }

        const rule = query.get('SELECT * FROM automation_rules WHERE id = ?', [id]);
        try {
            rule.conditions = JSON.parse(rule.conditions);
        } catch (error) {
            logger.warn('[Automations] failed to parse automation conditions', { detail: error?.message || 'Unknown error' });
            rule.conditions = [];
        }
        try {
            rule.actions = JSON.parse(rule.actions);
        } catch (error) {
            logger.warn('[Automations] failed to parse automation actions', { detail: error?.message || 'Unknown error' });
            rule.actions = {};
        }

        return { status: 200, data: { rule } };
    }

    // DELETE /api/automations/:id - Delete rule
    if (method === 'DELETE' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);

        const existing = query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        const result = query.run('DELETE FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);

        if (result.changes === 0) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        return { status: 200, data: { message: 'Rule deleted' } };
    }

    // POST /api/automations/:id/run - Run rule manually
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/run$/)) {
        const id = path.split('/')[1];

        const rule = query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!rule) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        // FIXED 2026-02-24: Use task_queue table instead of tasks (Issue #3)
        const recentRun = query.get(`
            SELECT id FROM task_queue
            WHERE type = 'run_automation'
              AND json_extract(payload, '$.ruleId') = ?
              AND json_extract(payload, '$.userId') = ?
              AND created_at > datetime('now', '-60 seconds')
            LIMIT 1
        `, [id, user.id]);
        if (recentRun) {
            return { status: 429, data: { error: 'Please wait at least 60 seconds between manual runs of the same rule' } };
        }

        // FIXED 2026-02-24: Use task_queue table with correct schema (Issue #3)
        const taskId = uuidv4();
        query.run(`
            INSERT INTO task_queue (id, type, payload, priority, max_attempts, scheduled_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [taskId, 'run_automation', JSON.stringify({ ruleId: id, userId: user.id }), 1, 3]);

        return { status: 200, data: { message: 'Automation queued', taskId } };
    }

    // POST /api/automations/:id/toggle - Toggle rule enabled/disabled
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/toggle$/)) {
        const id = path.split('/')[1];

        const rule = query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!rule) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        const newStatus = rule.is_enabled ? 0 : 1;
        query.run('UPDATE automation_rules SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [newStatus, id, user.id]);

        return { status: 200, data: { isEnabled: newStatus === 1 } };
    }

    // GET /api/automations/presets - Get automation presets
    if (method === 'GET' && path === '/presets') {
        const presets = [
            {
                id: 'closet-share',
                name: 'Daily Closet Share',
                description: 'Share your entire closet multiple times per day',
                type: 'share',
                platform: 'poshmark',
                schedule: '0 9,14,19 * * *',
                conditions: { minPrice: 0 },
                actions: { shareAll: true, randomDelay: true }
            },
            {
                id: 'party-share',
                name: 'Posh Party Auto-Share',
                description: 'Automatically share to Posh Parties',
                type: 'share',
                platform: 'poshmark',
                conditions: { partyOnly: true },
                actions: { shareToParty: true }
            },
            {
                id: 'follow-back',
                name: 'Follow Back',
                description: 'Automatically follow users who follow you',
                type: 'follow',
                platform: 'poshmark',
                conditions: {},
                actions: { followBack: true }
            },
            {
                id: 'auto-accept-90',
                name: 'Accept Offers 90%+',
                description: 'Automatically accept offers at 90% or more of asking price',
                type: 'offer',
                conditions: { minPercentage: 90 },
                actions: { autoAccept: true }
            },
            {
                id: 'auto-decline-50',
                name: 'Decline Lowball Offers',
                description: 'Automatically decline offers below 50% of asking price',
                type: 'offer',
                conditions: { maxPercentage: 50 },
                actions: { autoDecline: true }
            },
            {
                id: 'price-drop-weekly',
                name: 'Weekly Price Drop',
                description: 'Drop prices by 10% every week for items not sold',
                type: 'price_drop',
                schedule: '0 9 * * 0',
                conditions: { minDaysListed: 7 },
                actions: { dropPercentage: 10, minPrice: 10 }
            },
            {
                id: 'relist-stale',
                name: 'Relist Stale Items',
                description: 'Automatically relist items after 60 days',
                type: 'relist',
                schedule: '0 10 * * *',
                conditions: { minDaysListed: 60 },
                actions: { relist: true }
            }
        ];

        return { status: 200, data: { presets } };
    }

    // POST /api/automations/from-preset - Create from preset
    if (method === 'POST' && path === '/from-preset') {
        const { presetId, customizations } = body;

        const presets = {
            // Legacy IDs (from GET /presets endpoint)
            'closet-share': {
                name: 'Daily Closet Share',
                type: 'share',
                platform: 'poshmark',
                schedule: '0 9,14,19 * * *',
                conditions: { minPrice: 0 },
                actions: { shareAll: true, randomDelay: true }
            },
            'auto-accept-90': {
                name: 'Accept Offers 90%+',
                type: 'offer',
                conditions: { minPercentage: 90 },
                actions: { autoAccept: true }
            },
            // Frontend preset card IDs — Sharing
            'daily_share': {
                name: 'Daily Closet Share',
                type: 'share',
                platform: 'poshmark',
                schedule: '0 9,14,19 * * *',
                conditions: { minPrice: 0 },
                actions: { shareAll: true, randomDelay: true }
            },
            'party_share': {
                name: 'Posh Party Auto-Share',
                type: 'share',
                platform: 'poshmark',
                conditions: { partyOnly: true },
                actions: { shareToParty: true, randomDelay: true }
            },
            'community_share': {
                name: 'Community Share',
                type: 'share',
                platform: 'poshmark',
                conditions: {},
                actions: { communityShare: true, randomDelay: true }
            },
            // Engagement
            'follow_back': {
                name: 'Follow Back',
                type: 'follow',
                platform: 'poshmark',
                schedule: '0 10,18 * * *',
                conditions: { maxFollows: 50 },
                actions: { followBack: true }
            },
            'unfollow_inactive': {
                name: 'Unfollow Inactive Users',
                type: 'follow',
                platform: 'poshmark',
                schedule: '0 12 * * 0',
                conditions: { inactiveDays: 7 },
                actions: { unfollowInactive: true }
            },
            'follow_targeted': {
                name: 'Follow Targeted Users',
                type: 'follow',
                platform: 'poshmark',
                conditions: {},
                actions: { followTargeted: true, maxFollows: 30 }
            },
            // Offers
            'send_offers': {
                name: 'Send Offers to Likers',
                type: 'otl',
                platform: 'poshmark',
                schedule: '0 11,17 * * *',
                conditions: { discountPercent: 20, shippingDiscount: 0, maxOffers: 50 },
                actions: { sendOtl: true }
            },
            'auto_accept': {
                name: 'Auto Accept Offers > 80%',
                type: 'offer',
                conditions: { minPercentage: 80 },
                actions: { autoAccept: true }
            },
            'decline_lowball': {
                name: 'Decline Lowball Offers',
                type: 'offer',
                conditions: { maxPercentage: 50 },
                actions: { autoDecline: true }
            },
            'counter_offers': {
                name: 'Auto Counter Offers',
                type: 'offer',
                conditions: { counterPercentage: 75 },
                actions: { autoCounter: true }
            },
            // Bundles
            'bundle_discount': {
                name: 'Bundle Discount Offers',
                type: 'offer',
                platform: 'poshmark',
                conditions: { minBundleItems: 2 },
                actions: { bundleDiscount: true, discountPercent: 15 }
            },
            'bundle_reminder': {
                name: 'Bundle Reminder',
                type: 'custom',
                platform: 'poshmark',
                conditions: {},
                actions: { bundleReminder: true }
            },
            'bundle_for_likers': {
                name: 'Create Bundle for Likers',
                type: 'custom',
                platform: 'poshmark',
                conditions: { minLikes: 3 },
                actions: { createBundle: true }
            },
            // Pricing
            'weekly_drop': {
                name: 'Weekly Price Drop',
                type: 'price_drop',
                schedule: '0 9 * * 0',
                conditions: { minDaysListed: 7 },
                actions: { dropPercentage: 10, minPrice: 10 }
            },
            'ccl_rotation': {
                name: 'CCL Price Rotation',
                type: 'price_drop',
                platform: 'poshmark',
                schedule: '0 8 * * 1,4',
                conditions: { minDaysListed: 3 },
                actions: { dropPercentage: 5, minPrice: 5, cclRotation: true }
            },
            'auto_reprice': {
                name: 'Repricing Automation',
                type: 'price_drop',
                conditions: { minDaysListed: 14 },
                actions: { dropPercentage: 5, minPrice: 10, autoReprice: true }
            },
            // Maintenance
            'relist_stale': {
                name: 'Relist Stale Items',
                type: 'relist',
                schedule: '0 10 * * *',
                conditions: { minDaysListed: 60 },
                actions: { relist: true }
            },
            'delist_stale': {
                name: 'Delist Stale Items',
                type: 'relist',
                schedule: '0 10 * * 1',
                conditions: { minDaysListed: 90 },
                actions: { delistOnly: true }
            },
            'smart_relisting': {
                name: 'Smart Relisting',
                type: 'relist',
                conditions: { minDaysListed: 30 },
                actions: { relist: true, optimizeTitle: true }
            },
            'description_refresh': {
                name: 'Description Refresh',
                type: 'custom',
                platform: 'poshmark',
                conditions: { minDaysListed: 14 },
                actions: { refreshDescription: true }
            },
            'error_retry': {
                name: 'Auto Error Recovery',
                type: 'custom',
                conditions: {},
                actions: { retryFailed: true, maxRetries: 3 }
            }
        };

        const preset = presets[presetId];
        if (!preset) {
            return { status: 404, data: { error: 'Preset not found' } };
        }

        // Enforce max automation rules per tier
        const AUTOMATION_LIMITS_PRESET = {
            free: 5,
            starter: 20,
            pro: 100,
            enterprise: -1  // unlimited
        };
        const maxRulesPreset = AUTOMATION_LIMITS_PRESET[user.subscription_tier] || AUTOMATION_LIMITS_PRESET.free;
        if (maxRulesPreset !== -1) {
            const currentCountPreset = query.get(
                'SELECT COUNT(*) as count FROM automation_rules WHERE user_id = ?',
                [user.id]
            );
            if (currentCountPreset && currentCountPreset.count >= maxRulesPreset) {
                return { status: 403, data: {
                    error: `Maximum ${maxRulesPreset} automation rules allowed on your plan`,
                    limit: maxRulesPreset,
                    current: currentCountPreset.count
                }};
            }
        }

        const id = uuidv4();
        const finalRule = { ...preset, ...customizations };

        query.run(`
            INSERT INTO automation_rules (
                id, user_id, name, type, platform, schedule, conditions, actions, is_enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, user.id,
            finalRule.name,
            finalRule.type,
            finalRule.platform || null,
            finalRule.schedule || null,
            JSON.stringify(finalRule.conditions || {}),
            JSON.stringify(finalRule.actions || {}),
            1
        ]);

        const rule = query.get('SELECT * FROM automation_rules WHERE id = ?', [id]);
        try {
            rule.conditions = JSON.parse(rule.conditions || '{}');
        } catch (e) {
            logger.error('[Automations] error parsing rule conditions from preset', user?.id, { detail: e?.message || 'Unknown error' });
            rule.conditions = {};
        }
        try {
            rule.actions = JSON.parse(rule.actions || '{}');
        } catch (e) {
            logger.error('[Automations] error parsing rule actions from preset', user?.id, { detail: e?.message || 'Unknown error' });
            rule.actions = {};
        }

        return { status: 201, data: { rule } };
    }

    // GET /api/automations/stats - Get automation statistics
    if (method === 'GET' && path === '/stats') {
        const stats = {
            totalRules: query.get('SELECT COUNT(*) as count FROM automation_rules WHERE user_id = ?', [user.id])?.count || 0,
            activeRules: query.get('SELECT COUNT(*) as count FROM automation_rules WHERE user_id = ? AND is_enabled = 1', [user.id])?.count || 0,
            totalRuns: query.get('SELECT COUNT(*) as count FROM automation_logs WHERE user_id = ?', [user.id])?.count || 0,
            successfulRuns: query.get('SELECT COUNT(*) as count FROM automation_logs WHERE user_id = ? AND status = ?', [user.id, 'success'])?.count || 0,
            failedRuns: query.get('SELECT COUNT(*) as count FROM automation_logs WHERE user_id = ? AND status = ?', [user.id, 'failure'])?.count || 0,
            byType: query.all(`
                SELECT type, COUNT(*) as count
                FROM automation_rules WHERE user_id = ?
                GROUP BY type
            `, [user.id]),
            recentActivity: query.all(`
                SELECT * FROM automation_logs
                WHERE user_id = ?
                ORDER BY created_at DESC LIMIT 10
            `, [user.id])
        };

        return { status: 200, data: { stats } };
    }

    // GET /api/automations/schedule-settings - Get schedule settings
    if (method === 'GET' && path === '/schedule-settings') {
        const row = query.get(
            'SELECT settings FROM user_preferences WHERE user_id = ? AND key = ?',
            [user.id, 'automation_schedule']
        );

        const defaults = {
            frequency: 'daily',
            startTime: '09:00',
            endTime: '21:00',
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            timezone: 'America/New_York'
        };

        let settings = defaults;
        if (row) {
            try { settings = { ...defaults, ...JSON.parse(row.settings) }; } catch (_) {}
        }

        return { status: 200, data: { settings } };
    }

    // POST /api/automations/schedule-settings - Save schedule settings
    if (method === 'POST' && path === '/schedule-settings') {
        const { frequency, startTime, endTime, daysOfWeek, timezone } = body;

        const validFrequencies = ['hourly', 'every_4h', 'daily', 'twice_daily', 'weekly'];
        if (frequency && !validFrequencies.includes(frequency)) {
            return { status: 400, data: { error: 'Invalid frequency' } };
        }

        if (daysOfWeek && (!Array.isArray(daysOfWeek) || daysOfWeek.some(d => d < 0 || d > 6))) {
            return { status: 400, data: { error: 'Invalid daysOfWeek (must be array of 0-6)' } };
        }

        const settings = JSON.stringify({ frequency, startTime, endTime, daysOfWeek, timezone });

        // Upsert into user_preferences
        const existing = query.get(
            'SELECT id FROM user_preferences WHERE user_id = ? AND key = ?',
            [user.id, 'automation_schedule']
        );

        if (existing) {
            query.run(
                'UPDATE user_preferences SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND key = ?',
                [settings, user.id, 'automation_schedule']
            );
        } else {
            query.run(
                'INSERT INTO user_preferences (id, user_id, key, settings) VALUES (?, ?, ?, ?)',
                [uuidv4(), user.id, 'automation_schedule', settings]
            );
        }

        return { status: 200, data: { settings: body, message: 'Schedule settings saved' } };
    }

    return { status: 404, data: { error: 'Route not found' } };
}
