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

function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

export async function automationsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // Check automation permission
    const permission = await checkTierPermission(user, 'automations');
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

        sql += ' ORDER BY created_at DESC LIMIT 500';

        const rules = await query.all(sql, params);

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

        const logs = await query.all(sql, params);

        const total = await query.get('SELECT COUNT(*) as count FROM automation_logs WHERE user_id = ?', [user.id])?.count || 0;

        return { status: 200, data: { logs, total } };
    }

    // GET /api/automations/run/:runId/logs - Get action logs for a specific run
    if (method === 'GET' && path.match(/^\/run\/[a-f0-9-]+\/logs$/)) {
        const runId = path.split('/')[2];
        try {
            const run = await query.get('SELECT * FROM automation_runs WHERE id = ? AND user_id = ?', [runId, user.id]);
            if (!run) return { status: 404, data: { error: 'Run not found' } };

            // Match logs by rule_id + time window of the run
            const logs = await query.all(`
                SELECT * FROM automation_logs
                WHERE user_id = ? AND rule_id = ?
                    AND created_at >= ? AND created_at <= COALESCE(?, NOW())
                ORDER BY created_at ASC
            `, [user.id, run.automation_id, run.started_at, run.completed_at]);

            return { status: 200, data: { run, logs } };
        } catch (error) {
            logger.error('[Automations] failed to fetch run logs', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to fetch run logs' } };
        }
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
            const runs = await query.all(sql, params);

            // Parse metadata JSON for each run
            runs.forEach(run => {
                run.metadata = safeJsonParse(run.metadata, {});
            });

            const total = await query.get('SELECT COUNT(*) as count FROM automation_runs WHERE user_id = ?', [user.id])?.count || 0;

            // Get summary stats
            const stats = await query.get(`
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

    // GET /api/automations/history/export - Export run history as CSV
    if (method === 'GET' && path === '/history/export') {
        try {
            const runs = await query.all(
                'SELECT * FROM automation_runs WHERE user_id = ? ORDER BY started_at DESC LIMIT 10000',
                [user.id]
            );

            const headers = ['Date', 'Automation', 'Type', 'Status', 'Duration (ms)', 'Items Processed', 'Items Succeeded', 'Items Failed', 'Result', 'Error'];
            const escCSV = (v) => {
                const s = String(v ?? '');
                if (/[,"\n\r]/.test(s) || s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            };
            const csvRows = [headers.join(',')];
            runs.forEach(r => {
                csvRows.push([
                    escCSV(r.started_at),
                    escCSV(r.automation_name),
                    escCSV(r.automation_type),
                    escCSV(r.status),
                    escCSV(r.duration_ms),
                    escCSV(r.items_processed),
                    escCSV(r.items_succeeded),
                    escCSV(r.items_failed),
                    escCSV(r.result_message),
                    escCSV(r.error_message)
                ].join(','));
            });

            return {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="automation-history-${new Date().toISOString().split('T')[0]}.csv"`
                },
                data: csvRows.join('\n')
            };
        } catch (error) {
            logger.error('[Automations] failed to export history', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to export automation history' } };
        }
    }

    // DELETE /api/automations/history - Clear automation run history
    if (method === 'DELETE' && path === '/history') {
        try {
            await query.run('DELETE FROM automation_runs WHERE user_id = ?', [user.id]);
            return { status: 200, data: { message: 'History cleared' } };
        } catch (error) {
            logger.error('[Automations] failed to clear history', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to delete automation history' } };
        }
    }

    // GET /api/automations/:id - Get single rule
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);
        const rule = await query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);

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

        // Get recent logs for this rule (scoped to user's rule via JOIN)
        const logs = await query.all(
            `SELECT al.* FROM automation_logs al
             JOIN automations a ON al.rule_id = a.id
             WHERE al.rule_id = ? AND a.user_id = ?
             ORDER BY al.created_at DESC LIMIT 20`,
            [id, user.id]
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
            const currentCount = await query.get(
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

        await query.run(`
            INSERT INTO automation_rules (
                id, user_id, name, type, platform, schedule, conditions, actions, is_enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, user.id, name, type, platform, schedule,
            conditionsStr,
            actionsStr,
            isEnabled !== false ? 1 : 0
        ]);

        const rule = await query.get('SELECT * FROM automation_rules WHERE id = ?', [id]);
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

        const existing = await query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        const { name, platform, schedule, conditions, actions, isEnabled } = body;

        // Save version snapshot before update
        try {
            const maxVer = await query.get('SELECT MAX(version) as v FROM automation_rule_versions WHERE rule_id = ?', [id]);
            const nextVersion = (maxVer?.v || 0) + 1;
            const changes = [];
            if (name !== undefined && name !== existing.name) changes.push('name');
            if (platform !== undefined && platform !== existing.platform) changes.push('platform');
            if (schedule !== undefined && schedule !== existing.schedule) changes.push('schedule');
            if (conditions !== undefined) changes.push('conditions');
            if (actions !== undefined) changes.push('actions');
            if (changes.length > 0) {
                await query.run(`INSERT INTO automation_rule_versions (id, rule_id, user_id, version, name, type, platform, schedule, conditions, actions, change_summary)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), id, user.id, nextVersion, existing.name, existing.type, existing.platform, existing.schedule,
                     existing.conditions, existing.actions, 'Changed: ' + changes.join(', ')]);
            }
        } catch (vErr) {
            logger.warn('[Automations] version snapshot failed', { detail: vErr?.message });
        }

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

        if (body.tags !== undefined) {
            updates.push('tags = ?');
            values.push(JSON.stringify(body.tags));
        }

        if (updates.length > 0) {
            values.push(id, user.id);
            await query.run(
                `UPDATE automation_rules SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                values
            );
        }

        const rule = await query.get('SELECT * FROM automation_rules WHERE id = ?', [id]);
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

        const existing = await query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        const result = await query.run('DELETE FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);

        if (result.changes === 0) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        return { status: 200, data: { message: 'Rule deleted' } };
    }

    // POST /api/automations/:id/clone - Clone/duplicate a rule
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/clone$/)) {
        const ruleId = path.split('/')[1];
        const rule = await query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [ruleId, user.id]);
        if (!rule) return { status: 404, data: { error: 'Rule not found' } };

        const newId = uuidv4();
        await query.run(`INSERT INTO automation_rules (id, user_id, name, type, platform, schedule, conditions, actions, is_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [newId, user.id, rule.name + ' (Copy)', rule.type, rule.platform, rule.schedule, rule.conditions, rule.actions]);

        const cloned = await query.get('SELECT * FROM automation_rules WHERE id = ?', [newId]);
        cloned.conditions = safeJsonParse(cloned.conditions, {});
        cloned.actions = safeJsonParse(cloned.actions, {});
        return { status: 201, data: { rule: cloned } };
    }

    // POST /api/automations/:id/run - Run rule manually
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/run$/)) {
        const id = path.split('/')[1];

        const rule = await query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!rule) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        // FIXED 2026-02-24: Use task_queue table instead of tasks (Issue #3)
        const recentRun = await query.get(`
            SELECT id FROM task_queue
            WHERE type = 'run_automation'
              AND payload::jsonb->>'ruleId' = ?
              AND payload::jsonb->>'userId' = ?
              AND created_at > NOW() - INTERVAL '60 seconds'
            LIMIT 1
        `, [id, user.id]);
        if (recentRun) {
            return { status: 429, data: { error: 'Please wait at least 60 seconds between manual runs of the same rule' } };
        }

        // FIXED 2026-02-24: Use task_queue table with correct schema (Issue #3)
        const taskId = uuidv4();
        await query.run(`
            INSERT INTO task_queue (id, type, payload, priority, max_attempts, scheduled_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [taskId, 'run_automation', JSON.stringify({ ruleId: id, userId: user.id }), 1, 3]);

        return { status: 200, data: { message: 'Automation queued', taskId } };
    }

    // POST /api/automations/:id/toggle - Toggle rule enabled/disabled
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/toggle$/)) {
        const id = path.split('/')[1];

        const rule = await query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!rule) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        const newStatus = rule.is_enabled ? 0 : 1;
        await query.run('UPDATE automation_rules SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [newStatus, id, user.id]);

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
            },
            // Mercari presets
            'mercari_refresh': {
                name: 'Mercari Daily Refresh',
                type: 'share',
                platform: 'mercari',
                schedule: '0 9,15,20 * * *',
                conditions: { maxItems: 50 },
                actions: { shareAll: true }
            },
            'mercari_relist': {
                name: 'Mercari Relist Stale',
                type: 'relist',
                platform: 'mercari',
                schedule: '0 10 * * 1',
                conditions: { minDaysListed: 60 },
                actions: { relist: true }
            },
            'mercari_price_drop': {
                name: 'Mercari Price Drop',
                type: 'price_drop',
                platform: 'mercari',
                schedule: '0 9 * * 0',
                conditions: { minDaysListed: 7 },
                actions: { dropPercentage: 10, minPrice: 10 }
            },
            // Depop presets
            'depop_refresh': {
                name: 'Depop Daily Refresh',
                type: 'share',
                platform: 'depop',
                schedule: '0 10,16,21 * * *',
                conditions: { maxItems: 50 },
                actions: { shareAll: true }
            },
            'depop_share': {
                name: 'Depop Share Listings',
                type: 'share',
                platform: 'depop',
                schedule: '0 12,18 * * *',
                conditions: { maxItems: 30 },
                actions: { shareAll: true }
            },
            'depop_price_drop': {
                name: 'Depop Price Drop',
                type: 'price_drop',
                platform: 'depop',
                schedule: '0 9 * * 0',
                conditions: { minDaysListed: 7 },
                actions: { dropPercentage: 10, minPrice: 8 }
            },
            // Grailed presets
            'grailed_bump': {
                name: 'Grailed Daily Bump',
                type: 'share',
                platform: 'grailed',
                schedule: '0 9,14,19 * * *',
                conditions: { maxItems: 50 },
                actions: { shareAll: true }
            },
            'grailed_relist': {
                name: 'Grailed Relist Stale',
                type: 'relist',
                platform: 'grailed',
                schedule: '0 10 * * 1',
                conditions: { minDaysListed: 60 },
                actions: { relist: true }
            },
            'grailed_price_drop': {
                name: 'Grailed Price Drop',
                type: 'price_drop',
                platform: 'grailed',
                schedule: '0 9 * * 0',
                conditions: { minDaysListed: 7 },
                actions: { dropPercentage: 10, minPrice: 15 }
            },
            // Facebook Marketplace presets
            'facebook_refresh': {
                name: 'Facebook Daily Refresh',
                type: 'share',
                platform: 'facebook',
                schedule: '0 10,16 * * *',
                conditions: { maxItems: 20 },
                actions: { shareAll: true }
            },
            'facebook_relist': {
                name: 'Facebook Relist Stale',
                type: 'relist',
                platform: 'facebook',
                schedule: '0 10 * * 1',
                conditions: { minDaysListed: 60 },
                actions: { relist: true }
            },
            'facebook_price_drop': {
                name: 'Facebook Price Drop',
                type: 'price_drop',
                platform: 'facebook',
                schedule: '0 9 * * 0',
                conditions: { minDaysListed: 7 },
                actions: { dropPercentage: 10, minPrice: 10 }
            },
            // Whatnot presets
            'whatnot_refresh': {
                name: 'Whatnot Daily Refresh',
                type: 'share',
                platform: 'whatnot',
                schedule: '0 11,17 * * *',
                conditions: { maxItems: 30 },
                actions: { shareAll: true }
            },
            'whatnot_relist': {
                name: 'Whatnot Relist Stale',
                type: 'relist',
                platform: 'whatnot',
                schedule: '0 10 * * 1',
                conditions: { minDaysListed: 60 },
                actions: { relist: true }
            },
            'whatnot_price_drop': {
                name: 'Whatnot Price Drop',
                type: 'price_drop',
                platform: 'whatnot',
                schedule: '0 9 * * 0',
                conditions: { minDaysListed: 7 },
                actions: { dropPercentage: 10, minPrice: 10 }
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
            const currentCountPreset = await query.get(
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

        // Validate type from merged result (prevent override via customizations)
        const validTypes = ['share_closet', 'follow_users', 'offer_to_likers', 'relist_stale', 'price_drop', 'community_share', 'cross_list'];
        if (finalRule.type && !validTypes.includes(finalRule.type)) {
            finalRule.type = preset.type; // Fall back to preset type
        }

        await query.run(`
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

        const rule = await query.get('SELECT * FROM automation_rules WHERE id = ?', [id]);
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
            totalRules: await query.get('SELECT COUNT(*) as count FROM automation_rules WHERE user_id = ?', [user.id])?.count || 0,
            activeRules: await query.get('SELECT COUNT(*) as count FROM automation_rules WHERE user_id = ? AND is_enabled = 1', [user.id])?.count || 0,
            totalRuns: await query.get('SELECT COUNT(*) as count FROM automation_logs WHERE user_id = ?', [user.id])?.count || 0,
            successfulRuns: await query.get('SELECT COUNT(*) as count FROM automation_logs WHERE user_id = ? AND status = ?', [user.id, 'success'])?.count || 0,
            failedRuns: await query.get('SELECT COUNT(*) as count FROM automation_logs WHERE user_id = ? AND status = ?', [user.id, 'failure'])?.count || 0,
            byType: await query.all(`
                SELECT type, COUNT(*) as count
                FROM automation_rules WHERE user_id = ?
                GROUP BY type
            `, [user.id]),
            recentActivity: await query.all(`
                SELECT * FROM automation_logs
                WHERE user_id = ?
                ORDER BY created_at DESC LIMIT 10
            `, [user.id])
        };

        return { status: 200, data: { stats } };
    }

    // GET /api/automations/schedule-settings - Get schedule settings
    if (method === 'GET' && path === '/schedule-settings') {
        const row = await query.get(
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
            settings = { ...defaults, ...safeJsonParse(row.settings, {}) };
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
        const existing = await query.get(
            'SELECT id FROM user_preferences WHERE user_id = ? AND key = ?',
            [user.id, 'automation_schedule']
        );

        if (existing) {
            await query.run(
                'UPDATE user_preferences SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND key = ?',
                [settings, user.id, 'automation_schedule']
            );
        } else {
            await query.run(
                'INSERT INTO user_preferences (id, user_id, key, settings) VALUES (?, ?, ?, ?)',
                [uuidv4(), user.id, 'automation_schedule', settings]
            );
        }

        return { status: 200, data: { settings: body, message: 'Schedule settings saved' } };
    }

    // GET /api/automations/notification-prefs - Get notification preferences
    if (method === 'GET' && path === '/notification-prefs') {
        const row = await query.get(
            'SELECT settings FROM user_preferences WHERE user_id = ? AND key = ?',
            [user.id, 'automation_notifications']
        );

        const defaults = {
            on_success: true, on_failure: true, on_partial: true,
            daily_summary: false, desktop_enabled: true, email_enabled: false
        };

        let prefs = defaults;
        if (row) {
            prefs = { ...defaults, ...safeJsonParse(row.settings, {}) };
        }

        return { status: 200, data: { prefs } };
    }

    // POST /api/automations/notification-prefs - Save notification preferences
    if (method === 'POST' && path === '/notification-prefs') {
        const { on_success, on_failure, on_partial, daily_summary, desktop_enabled, email_enabled } = body;

        const prefs = JSON.stringify({ on_success, on_failure, on_partial, daily_summary, desktop_enabled, email_enabled });

        const existing = await query.get(
            'SELECT id FROM user_preferences WHERE user_id = ? AND key = ?',
            [user.id, 'automation_notifications']
        );

        if (existing) {
            await query.run(
                'UPDATE user_preferences SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND key = ?',
                [prefs, user.id, 'automation_notifications']
            );
        } else {
            await query.run(
                'INSERT INTO user_preferences (id, user_id, key, settings) VALUES (?, ?, ?, ?)',
                [uuidv4(), user.id, 'automation_notifications', prefs]
            );
        }

        return { status: 200, data: { prefs: body, message: 'Notification preferences saved' } };
    }

    // ============================================
    // A/B Testing (Experiments)
    // ============================================

    // GET /api/automations/experiments - List experiments
    if (method === 'GET' && path === '/experiments') {
        try {
            const experiments = await query.all(`
                SELECT e.*,
                    br.name as base_name, br.schedule as base_schedule, br.run_count as base_runs,
                    vr.name as variant_name, vr.schedule as variant_schedule, vr.run_count as variant_runs
                FROM automation_experiments e
                JOIN automation_rules br ON e.base_rule_id = br.id
                JOIN automation_rules vr ON e.variant_rule_id = vr.id
                WHERE e.user_id = ?
                ORDER BY e.created_at DESC
            `, [user.id]);

            // Enrich with run stats
            for (const exp of experiments) {
                exp.base_stats = await query.get(`
                    SELECT COUNT(*) as runs,
                        SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successes,
                        AVG(items_processed) as avg_items,
                        AVG(duration_ms) as avg_duration
                    FROM automation_runs WHERE automation_id = ? AND started_at >= ?
                `, [exp.base_rule_id, exp.started_at]) || {};
                exp.variant_stats = await query.get(`
                    SELECT COUNT(*) as runs,
                        SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successes,
                        AVG(items_processed) as avg_items,
                        AVG(duration_ms) as avg_duration
                    FROM automation_runs WHERE automation_id = ? AND started_at >= ?
                `, [exp.variant_rule_id, exp.started_at]) || {};
            }

            return { status: 200, data: { experiments } };
        } catch (error) {
            logger.error('[Automations] failed to fetch experiments', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch experiments' } };
        }
    }

    // POST /api/automations/experiments - Create experiment (clone rule as variant)
    if (method === 'POST' && path === '/experiments') {
        const { baseRuleId, variantName, variantSchedule, variantConditions, variantActions } = body;
        if (!baseRuleId) return { status: 400, data: { error: 'baseRuleId required' } };

        try {
            const baseRule = await query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [baseRuleId, user.id]);
            if (!baseRule) return { status: 404, data: { error: 'Base rule not found' } };

            // Clone the base rule as the variant
            const variantId = uuidv4();
            await query.run(`
                INSERT INTO automation_rules (id, user_id, name, type, platform, schedule, conditions, actions, is_enabled)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [
                variantId, user.id,
                variantName || baseRule.name + ' (Variant B)',
                baseRule.type, baseRule.platform,
                variantSchedule || baseRule.schedule,
                variantConditions || baseRule.conditions,
                variantActions || baseRule.actions
            ]);

            // Create experiment record
            const experimentId = uuidv4();
            await query.run(`
                INSERT INTO automation_experiments (id, user_id, name, base_rule_id, variant_rule_id, status)
                VALUES (?, ?, ?, ?, ?, 'running')
            `, [experimentId, user.id, `${baseRule.name}: A vs B`, baseRuleId, variantId]);

            return { status: 201, data: { experiment: { id: experimentId, base_rule_id: baseRuleId, variant_rule_id: variantId } } };
        } catch (error) {
            logger.error('[Automations] failed to create experiment', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to create experiment' } };
        }
    }

    // PUT /api/automations/experiments/:id - Update experiment (complete, pick winner)
    if (method === 'PUT' && path.match(/^\/experiments\/[a-f0-9-]+$/)) {
        const experimentId = path.split('/')[2];
        const { status: newStatus, winner } = body;
        try {
            const exp = await query.get('SELECT * FROM automation_experiments WHERE id = ? AND user_id = ?', [experimentId, user.id]);
            if (!exp) return { status: 404, data: { error: 'Experiment not found' } };

            if (newStatus === 'completed' && winner) {
                await query.run(`
                    UPDATE automation_experiments SET status = 'completed', winner = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [winner, experimentId]);

                // Disable the loser
                const loserId = winner === 'base' ? exp.variant_rule_id : exp.base_rule_id;
                await query.run('UPDATE automation_rules SET is_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [loserId]);
            } else if (newStatus) {
                await query.run('UPDATE automation_experiments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, experimentId]);
            }

            return { status: 200, data: { message: 'Experiment updated' } };
        } catch (error) {
            logger.error('[Automations] failed to update experiment', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to update experiment' } };
        }
    }

    // GET /api/automations/export - Export all rules as JSON
    if (method === 'GET' && path === '/export') {
        try {
            const rules = await query.all('SELECT name, type, platform, schedule, conditions, actions FROM automation_rules WHERE user_id = ? ORDER BY name', [user.id]);
            const parsed = rules.map(r => ({
                ...r,
                conditions: safeJsonParse(r.conditions, r.conditions),
                actions: safeJsonParse(r.actions, r.actions)
            }));
            return { status: 200, data: { rules: parsed, count: parsed.length, exported_at: new Date().toISOString() } };
        } catch (error) {
            logger.error('[Automations] export failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to export rules' } };
        }
    }

    // POST /api/automations/import - Import rules from JSON
    if (method === 'POST' && path === '/import') {
        const { rules } = body;
        if (!Array.isArray(rules) || rules.length === 0) return { status: 400, data: { error: 'rules array required' } };
        if (rules.length > 100) return { status: 400, data: { error: 'Maximum 100 rules per import' } };

        try {
            let imported = 0, skipped = 0;
            for (const r of rules) {
                if (!r.name || !r.type) { skipped++; continue; }
                const existing = await query.get('SELECT id FROM automation_rules WHERE user_id = ? AND name = ? AND platform = ?', [user.id, r.name, r.platform || 'all']);
                if (existing) { skipped++; continue; }
                await query.run(`INSERT INTO automation_rules (id, user_id, name, type, platform, schedule, conditions, actions, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                    [uuidv4(), user.id, r.name, r.type, r.platform || 'all', r.schedule || null,
                     typeof r.conditions === 'string' ? r.conditions : JSON.stringify(r.conditions || {}),
                     typeof r.actions === 'string' ? r.actions : JSON.stringify(r.actions || {})]);
                imported++;
            }
            return { status: 200, data: { imported, skipped, total: rules.length } };
        } catch (error) {
            logger.error('[Automations] import failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to import rules' } };
        }
    }

    // GET /api/automations/templates/shared - Browse shared templates
    if (method === 'GET' && path === '/templates/shared') {
        try {
            const templates = await query.all(`
                SELECT t.*, u.username as author_name,
                    (SELECT COUNT(*) FROM automation_template_installs WHERE template_id = t.id) as install_count
                FROM automation_templates t
                LEFT JOIN users u ON t.author_id = u.id
                WHERE t.is_public = 1
                ORDER BY t.created_at DESC
                LIMIT 50
            `);
            const parsed = templates.map(t => ({
                ...t,
                conditions: safeJsonParse(t.conditions, t.conditions),
                actions: safeJsonParse(t.actions, t.actions)
            }));
            return { status: 200, data: { templates: parsed } };
        } catch (error) {
            logger.error('[Automations] browse templates failed', user?.id, { detail: error?.message });
            return { status: 200, data: { templates: [] } };
        }
    }

    // POST /api/automations/templates/share - Publish a rule as template
    if (method === 'POST' && path === '/templates/share') {
        const { ruleId, description, tags } = body;
        if (!ruleId) return { status: 400, data: { error: 'ruleId required' } };
        try {
            const rule = await query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [ruleId, user.id]);
            if (!rule) return { status: 404, data: { error: 'Rule not found' } };
            const templateId = uuidv4();
            await query.run(`INSERT INTO automation_templates (id, author_id, name, type, platform, schedule, conditions, actions, description, tags, is_public)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [templateId, user.id, rule.name, rule.type, rule.platform, rule.schedule, rule.conditions, rule.actions,
                 description || rule.name, typeof tags === 'string' ? tags : JSON.stringify(tags || [])]);
            return { status: 201, data: { template: { id: templateId } } };
        } catch (error) {
            logger.error('[Automations] share template failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to share template' } };
        }
    }

    // POST /api/automations/templates/install - Install a shared template as a rule
    if (method === 'POST' && path === '/templates/install') {
        const { templateId } = body;
        if (!templateId) return { status: 400, data: { error: 'templateId required' } };
        try {
            const tpl = await query.get('SELECT * FROM automation_templates WHERE id = ? AND is_public = 1', [templateId]);
            if (!tpl) return { status: 404, data: { error: 'Template not found' } };
            const ruleId = uuidv4();
            await query.run(`INSERT INTO automation_rules (id, user_id, name, type, platform, schedule, conditions, actions, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                [ruleId, user.id, tpl.name, tpl.type, tpl.platform, tpl.schedule, tpl.conditions, tpl.actions]);
            await query.run('INSERT INTO automation_template_installs (template_id, user_id) VALUES (?, ?)', [templateId, user.id]);
            return { status: 201, data: { rule: { id: ruleId, name: tpl.name } } };
        } catch (error) {
            logger.error('[Automations] install template failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to install template' } };
        }
    }

    // GET /api/automations/duration-trends - Run duration trends by day
    if (method === 'GET' && path === '/duration-trends') {
        try {
            const trends = await query.all(`
                SELECT date(started_at) as day,
                    automation_name as name,
                    AVG(duration_ms) as avg_duration,
                    COUNT(*) as run_count,
                    SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successes
                FROM automation_runs
                WHERE user_id = ? AND started_at >= NOW() - INTERVAL '30 days' AND duration_ms IS NOT NULL
                GROUP BY day, automation_name
                ORDER BY day DESC
            `, [user.id]);
            return { status: 200, data: { trends } };
        } catch (error) {
            logger.error('[Automations] duration trends failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch trends' } };
        }
    }

    // POST /api/automations/reorder - Update sort order for rules
    if (method === 'POST' && path === '/reorder') {
        const { order } = body;
        if (!Array.isArray(order)) return { status: 400, data: { error: 'order array required' } };
        try {
            for (let i = 0; i < order.length; i++) {
                await query.run('UPDATE automation_rules SET sort_order = ? WHERE id = ? AND user_id = ?', [i, order[i], user.id]);
            }
            return { status: 200, data: { message: 'Order updated', count: order.length } };
        } catch (error) {
            logger.error('[Automations] reorder failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to reorder' } };
        }
    }

    // GET /api/automations/:id/versions - Get version history for a rule
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+\/versions$/)) {
        const ruleId = path.split('/')[1];
        try {
            const rule = await query.get('SELECT id FROM automation_rules WHERE id = ? AND user_id = ?', [ruleId, user.id]);
            if (!rule) return { status: 404, data: { error: 'Rule not found' } };
            const versions = await query.all('SELECT * FROM automation_rule_versions WHERE rule_id = ? ORDER BY version DESC LIMIT 50', [ruleId]);
            for (const v of versions) {
                v.conditions = safeJsonParse(v.conditions, v.conditions);
                v.actions = safeJsonParse(v.actions, v.actions);
            }
            return { status: 200, data: { versions } };
        } catch (error) {
            logger.error('[Automations] fetch versions failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch versions' } };
        }
    }

    // POST /api/automations/:id/rollback - Rollback to a specific version
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/rollback$/)) {
        const ruleId = path.split('/')[1];
        const { versionId } = body;
        if (!versionId) return { status: 400, data: { error: 'versionId required' } };
        try {
            const rule = await query.get('SELECT * FROM automation_rules WHERE id = ? AND user_id = ?', [ruleId, user.id]);
            if (!rule) return { status: 404, data: { error: 'Rule not found' } };
            const ver = await query.get('SELECT * FROM automation_rule_versions WHERE id = ? AND rule_id = ?', [versionId, ruleId]);
            if (!ver) return { status: 404, data: { error: 'Version not found' } };

            // Save current state as a new version before rollback
            const maxVer = await query.get('SELECT MAX(version) as v FROM automation_rule_versions WHERE rule_id = ?', [ruleId]);
            await query.run(`INSERT INTO automation_rule_versions (id, rule_id, user_id, version, name, type, platform, schedule, conditions, actions, change_summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), ruleId, user.id, (maxVer?.v || 0) + 1, rule.name, rule.type, rule.platform, rule.schedule, rule.conditions, rule.actions, 'Pre-rollback snapshot']);

            // Apply the old version
            await query.run(`UPDATE automation_rules SET name = ?, platform = ?, schedule = ?, conditions = ?, actions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [ver.name, ver.platform, ver.schedule, ver.conditions, ver.actions, ruleId]);

            return { status: 200, data: { message: 'Rolled back to version ' + ver.version } };
        } catch (error) {
            logger.error('[Automations] rollback failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to rollback' } };
        }
    }

    // POST /api/automations/templates/import-url - Import rule from a JSON URL
    if (method === 'POST' && path === '/templates/import-url') {
        const { url } = body;
        if (!url || typeof url !== 'string') return { status: 400, data: { error: 'url is required' } };
        // SSRF protection: block internal/private network URLs
        try {
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname.toLowerCase();
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0' ||
                /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname) ||
                hostname.startsWith('fe80:') || hostname.startsWith('fc00:') || hostname.startsWith('fd00:')) {
                return { status: 400, data: { error: 'URL must be a public address' } };
            }
        } catch {
            return { status: 400, data: { error: 'Invalid URL format' } };
        }
        try {
            const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
            if (!response.ok) return { status: 400, data: { error: 'Failed to fetch URL: ' + response.status } };
            const json = await response.json();

            // Support both single rule and array of rules
            const rules = Array.isArray(json) ? json : (json.rules || [json]);
            const imported = [];

            for (const tpl of rules) {
                if (!tpl.name || !tpl.type) continue;
                const ruleId = uuidv4();
                await query.run(`INSERT INTO automation_rules (id, user_id, name, type, platform, schedule, conditions, actions, is_enabled, tags)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
                    [ruleId, user.id, tpl.name, tpl.type, tpl.platform || 'all', tpl.schedule || null,
                     typeof tpl.conditions === 'string' ? tpl.conditions : JSON.stringify(tpl.conditions || {}),
                     typeof tpl.actions === 'string' ? tpl.actions : JSON.stringify(tpl.actions || {}),
                     typeof tpl.tags === 'string' ? tpl.tags : JSON.stringify(tpl.tags || [])]);
                imported.push({ id: ruleId, name: tpl.name });
            }

            return { status: 201, data: { imported, count: imported.length } };
        } catch (error) {
            logger.error('[Automations] import from URL failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to import from URL' } };
        }
    }

    // POST /api/automations/poshmark/sync - Queue a Poshmark inventory sync task
    if (method === 'POST' && path === '/poshmark/sync') {
        const poshmarkUsername = process.env.POSHMARK_USERNAME;
        if (!poshmarkUsername) {
            return { status: 400, data: { error: 'POSHMARK_USERNAME not configured in .env' } };
        }
        const maxItems = Math.min(parseInt(body?.maxItems) || 100, 500);

        try {
            const taskId = uuidv4();
            await query.run(
                `INSERT INTO task_queue (id, type, payload, priority, max_attempts)
                 VALUES (?, 'poshmark_inventory_sync', ?, 1, 3)`,
                [taskId, JSON.stringify({ userId: user.id, username: poshmarkUsername, maxItems })]
            );
            logger.info('[Automations] Poshmark sync queued', user?.id, { taskId, maxItems });
            return { status: 202, data: { taskId, status: 'queued', message: 'Inventory sync task queued' } };
        } catch (error) {
            logger.error('[Automations] Poshmark sync queue failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to queue sync task: ' + (error?.message || 'Unknown error') } };
        }
    }

    // GET /api/automations/scheduler-status - Live scheduler health check
    if (method === 'GET' && path === '/scheduler-status') {
        try {
            const { getTaskWorkerStatus } = await import('../workers/taskWorker.js');
            const workerStatus = getTaskWorkerStatus();

            const pending = await query.get('SELECT COUNT(*) as count FROM task_queue WHERE status = ?', ['pending']);
            const processing = await query.get('SELECT COUNT(*) as count FROM task_queue WHERE status = ?', ['processing']);
            const failed = await query.get("SELECT COUNT(*) as count FROM task_queue WHERE status = 'failed' AND datetime(created_at) > NOW() - INTERVAL '24 hours'");

            const recentRuns = await query.get(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as succeeded,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial
                FROM automation_runs
                WHERE user_id = ? AND datetime(started_at) > NOW() - INTERVAL '24 hours'
            `, [user.id]);

            const enabledRules = await query.get('SELECT COUNT(*) as count FROM automation_rules WHERE user_id = ? AND is_enabled = 1', [user.id]);

            const nextScheduled = await query.get(`
                SELECT name, schedule, last_run_at FROM automation_rules
                WHERE user_id = ? AND is_enabled = 1 AND schedule IS NOT NULL
                ORDER BY last_run_at ASC LIMIT 1
            `, [user.id]);

            const isHealthy = workerStatus.running &&
                (Date.now() - new Date(workerStatus.lastRun).getTime() < 30000);

            return { status: 200, data: {
                healthy: isHealthy,
                worker: workerStatus,
                queue: {
                    pending: pending?.count || 0,
                    processing: processing?.count || 0,
                    failedLast24h: failed?.count || 0
                },
                runs24h: {
                    total: recentRuns?.total || 0,
                    succeeded: recentRuns?.succeeded || 0,
                    failed: recentRuns?.failed || 0,
                    partial: recentRuns?.partial || 0,
                    successRate: recentRuns?.total > 0
                        ? Math.round((recentRuns.succeeded / recentRuns.total) * 100)
                        : 100
                },
                enabledRules: enabledRules?.count || 0,
                nextScheduled: nextScheduled || null
            }};
        } catch (error) {
            logger.error('[Automations] scheduler status failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to get scheduler status' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
