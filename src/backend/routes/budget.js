// Budget Routes - Monthly budget settings
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { safeJsonParse } from '../shared/utils.js';

export async function budgetRouter(ctx) {
    const { method, path, body, user } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // GET /api/budget - Return saved budget settings
    if (method === 'GET' && (path === '/' || path === '')) {
        try {
            const row = await query.get('SELECT budget_json FROM users WHERE id = ?', [user.id]);
            const budget = safeJsonParse(row?.budget_json, {});
            return { status: 200, data: { budget } };
        } catch (error) {
            logger.error('[Budget] Error fetching budget', user.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/budget - Save budget settings
    if (method === 'PUT' && (path === '/' || path === '')) {
        if (!body) {
            return { status: 400, data: { error: 'Request body is required' } };
        }

        const { monthlyBudget } = body;

        if (monthlyBudget === undefined) {
            return { status: 400, data: { error: 'monthlyBudget is required' } };
        }
        if (!Number.isFinite(monthlyBudget) || monthlyBudget < 0) {
            return { status: 400, data: { error: 'monthlyBudget must be a non-negative finite number' } };
        }

        try {
            const row = await query.get('SELECT budget_json FROM users WHERE id = ?', [user.id]);
            const existing = safeJsonParse(row?.budget_json, {});

            const updated = { ...existing, monthlyBudget };

            await query.run(
                'UPDATE users SET budget_json = ?, updated_at = NOW() WHERE id = ?',
                [JSON.stringify(updated), user.id],
            );

            return { status: 200, data: { budget: updated } };
        } catch (error) {
            logger.error('[Budget] Error saving budget', user.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
