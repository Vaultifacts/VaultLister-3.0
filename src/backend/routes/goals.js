// Goals Routes - Financial goals (revenueGoal, salesGoal, marginGoal)
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { safeJsonParse } from '../shared/utils.js';

export async function goalsRouter(ctx) {
    const { method, path, body, user } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // GET /api/goals - Return saved financial goals
    if (method === 'GET' && (path === '/' || path === '')) {
        try {
            const row = await query.get('SELECT goals_json FROM users WHERE id = ?', [user.id]);
            const goals = safeJsonParse(row?.goals_json, {});
            return { status: 200, data: { goals } };
        } catch (error) {
            logger.error('[Goals] Error fetching goals', user.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/goals - Save financial goals
    if (method === 'POST' && (path === '/' || path === '')) {
        if (!body) {
            return { status: 400, data: { error: 'Request body is required' } };
        }

        const { revenueGoal, salesGoal, marginGoal } = body;

        if (revenueGoal !== undefined) {
            if (!Number.isFinite(revenueGoal) || revenueGoal < 0) {
                return { status: 400, data: { error: 'revenueGoal must be a non-negative finite number' } };
            }
        }
        if (salesGoal !== undefined) {
            if (!Number.isFinite(salesGoal) || salesGoal < 0) {
                return { status: 400, data: { error: 'salesGoal must be a non-negative finite number' } };
            }
        }
        if (marginGoal !== undefined) {
            if (!Number.isFinite(marginGoal) || marginGoal < 0) {
                return { status: 400, data: { error: 'marginGoal must be a non-negative finite number' } };
            }
        }

        try {
            const row = await query.get('SELECT goals_json FROM users WHERE id = ?', [user.id]);
            const existing = safeJsonParse(row?.goals_json, {});

            const updated = { ...existing };
            if (revenueGoal !== undefined) updated.revenueGoal = revenueGoal;
            if (salesGoal !== undefined) updated.salesGoal = salesGoal;
            if (marginGoal !== undefined) updated.marginGoal = marginGoal;

            await query.run(
                'UPDATE users SET goals_json = ?, updated_at = NOW() WHERE id = ?',
                [JSON.stringify(updated), user.id],
            );

            return { status: 200, data: { goals: updated } };
        } catch (error) {
            logger.error('[Goals] Error saving goals', user.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
