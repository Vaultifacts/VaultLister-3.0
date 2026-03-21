// Tasks/Jobs Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

export async function tasksRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/tasks - List tasks
    if (method === 'GET' && (path === '/' || path === '')) {
        try {
            const { status, type, limit = 50, offset = 0 } = queryParams;

            let sql = 'SELECT * FROM tasks WHERE user_id = ?';
            const params = [user.id];

            if (status) {
                sql += ' AND status = ?';
                params.push(status);
            }

            if (type) {
                sql += ' AND type = ?';
                params.push(type);
            }

            sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const tasks = query.all(sql, params);

            tasks.forEach(task => {
                task.payload = safeJsonParse(task.payload, {});
                task.result = safeJsonParse(task.result, null);
            });

            const total = query.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?', [user.id])?.count || 0;
            const pending = query.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = ?', [user.id, 'pending'])?.count || 0;
            const processing = query.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = ?', [user.id, 'processing'])?.count || 0;

            return { status: 200, data: { tasks, total, pending, processing } };
        } catch (error) {
            logger.error('[Tasks] Error listing tasks', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/tasks/:id - Get task details
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
        try {
            const id = path.slice(1);
            const task = query.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, user.id]);

            if (!task) {
                return { status: 404, data: { error: 'Task not found' } };
            }

            task.payload = safeJsonParse(task.payload, {});
            task.result = safeJsonParse(task.result, null);

            return { status: 200, data: { task } };
        } catch (error) {
            logger.error('[Tasks] Error fetching task details', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/tasks - Create new task
    if (method === 'POST' && (path === '/' || path === '')) {
        try {
            const { type, payload, priority = 5, scheduledAt } = body;

            if (!type || !payload) {
                return { status: 400, data: { error: 'Type and payload required' } };
            }

            const validTypes = [
                'share_listing', 'share_closet', 'follow_user', 'unfollow_user',
                'accept_offer', 'decline_offer', 'counter_offer',
                'create_listing', 'update_listing', 'delete_listing',
                'sync_shop', 'import_listings', 'export_data',
                'run_automation', 'bulk_action',
                'generate_ai_content', 'analyze_image'
            ];

            if (!validTypes.includes(type)) {
                return { status: 400, data: { error: 'Invalid task type' } };
            }

            const id = uuidv4();

            query.run(`
                INSERT INTO tasks (id, user_id, type, payload, priority, status, scheduled_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                id, user.id, type, JSON.stringify(payload), priority, 'pending',
                scheduledAt || new Date().toISOString()
            ]);

            const task = query.get('SELECT * FROM tasks WHERE id = ?', [id]);
            task.payload = safeJsonParse(task.payload, {});

            return { status: 201, data: { task } };
        } catch (error) {
            logger.error('[Tasks] Error creating task', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/tasks/:id/cancel - Cancel task
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/cancel$/)) {
        try {
            const id = path.split('/')[1];

            const task = query.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, user.id]);

            if (!task) {
                return { status: 404, data: { error: 'Task not found' } };
            }

            if (task.status !== 'pending') {
                return { status: 400, data: { error: 'Can only cancel pending tasks' } };
            }

            query.run('UPDATE tasks SET status = ? WHERE id = ?', ['cancelled', id]);

            return { status: 200, data: { message: 'Task cancelled' } };
        } catch (error) {
            logger.error('[Tasks] Error cancelling task', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/tasks/:id/retry - Retry failed task
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/retry$/)) {
        try {
            const id = path.split('/')[1];

            const task = query.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, user.id]);

            if (!task) {
                return { status: 404, data: { error: 'Task not found' } };
            }

            if (task.status !== 'failed') {
                return { status: 400, data: { error: 'Can only retry failed tasks' } };
            }

            query.run(`
                UPDATE tasks SET status = ?, attempts = 0, error_message = NULL, scheduled_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, ['pending', id]);

            return { status: 200, data: { message: 'Task queued for retry' } };
        } catch (error) {
            logger.error('[Tasks] Error retrying task', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/tasks/:id - Delete task
    if (method === 'DELETE' && path.match(/^\/[a-f0-9-]+$/)) {
        try {
            const id = path.slice(1);

            const task = query.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, user.id]);

            if (!task) {
                return { status: 404, data: { error: 'Task not found' } };
            }

            query.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, user.id]);

            return { status: 200, data: { message: 'Task deleted' } };
        } catch (error) {
            logger.error('[Tasks] Error deleting task', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/tasks/bulk - Create multiple tasks
    if (method === 'POST' && path === '/bulk') {
        try {
            const { tasks: taskList } = body;

            if (!taskList || !Array.isArray(taskList)) {
                return { status: 400, data: { error: 'Tasks array required' } };
            }

            if (taskList.length > 100) {
                return { status: 400, data: { error: 'Maximum 100 tasks per batch' } };
            }

            const validTypes = [
                'share_listing', 'share_closet', 'follow_user', 'unfollow_user',
                'accept_offer', 'decline_offer', 'counter_offer',
                'create_listing', 'update_listing', 'delete_listing',
                'sync_shop', 'import_listings', 'export_data',
                'run_automation', 'bulk_action',
                'generate_ai_content', 'analyze_image'
            ];

            const created = [];
            const errors = [];

            for (const taskData of taskList) {
                try {
                    if (!validTypes.includes(taskData.type)) {
                        errors.push({ task: taskData, error: 'Invalid task type' });
                        continue;
                    }
                    const id = uuidv4();
                    query.run(`
                        INSERT INTO tasks (id, user_id, type, payload, priority, status)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        id, user.id, taskData.type,
                        JSON.stringify(taskData.payload || {}),
                        taskData.priority || 5, 'pending'
                    ]);
                    created.push(id);
                } catch (error) {
                    errors.push({ task: taskData, error: error.message });
                }
            }

            return { status: 201, data: { created, errors } };
        } catch (error) {
            logger.error('[Tasks] Error creating bulk tasks', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/tasks/clear - Clear completed/failed tasks
    if (method === 'POST' && path === '/clear') {
        try {
            const { status: clearStatus = 'completed', olderThan } = body;

            const validClearStatuses = ['completed', 'failed', 'cancelled'];
            if (!validClearStatuses.includes(clearStatus)) {
                return { status: 400, data: { error: 'Invalid status. Must be: completed, failed, or cancelled' } };
            }

            let sql = 'DELETE FROM tasks WHERE user_id = ? AND status = ?';
            const params = [user.id, clearStatus];

            if (olderThan) {
                sql += ' AND created_at < ?';
                params.push(olderThan);
            }

            const result = query.run(sql, params);

            return { status: 200, data: { deleted: result.changes } };
        } catch (error) {
            logger.error('[Tasks] Error clearing tasks', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/tasks/queue - Get queue status
    if (method === 'GET' && path === '/queue') {
        try {
            const stats = {
                pending: query.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = ?', [user.id, 'pending'])?.count || 0,
                processing: query.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = ?', [user.id, 'processing'])?.count || 0,
                completed: query.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = ?', [user.id, 'completed'])?.count || 0,
                failed: query.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = ?', [user.id, 'failed'])?.count || 0,
                byType: query.all(`
                    SELECT type, status, COUNT(*) as count
                    FROM tasks WHERE user_id = ?
                    GROUP BY type, status
                `, [user.id]),
                nextUp: query.all(`
                    SELECT * FROM tasks
                    WHERE user_id = ? AND status = 'pending'
                    ORDER BY priority ASC, scheduled_at ASC
                    LIMIT 5
                `, [user.id])
            };

            stats.nextUp.forEach(task => {
                task.payload = safeJsonParse(task.payload || '{}', {});
            });

            return { status: 200, data: { stats } };
        } catch (error) {
            logger.error('[Tasks] Error fetching queue status', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
