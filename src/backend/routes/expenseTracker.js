import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

export async function expenseTrackerRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;
    if (!user) return { status: 401, data: { error: 'Authentication required' } };

    try {
        // GET /categories - List expense categories (system defaults + user-created)
        if (method === 'GET' && path === '/categories') {
            const userId = user.id;

            // Get both system defaults and user-created categories
            const categories = await query.all(
                `SELECT * FROM expense_categories
         WHERE user_id = 'system' OR user_id = ?
         ORDER BY type, name`,
                [userId],
            );

            return { status: 200, data: { categories } };
        }

        // POST /categories - Create custom expense category
        if (method === 'POST' && path === '/categories') {
            const userId = user.id;
            const { name, type = 'expense' } = body;

            if (!name || name.trim().length === 0) {
                return { status: 400, data: { error: 'Category name is required' } };
            }
            if (name.trim().length > 100) {
                return { status: 400, data: { error: 'Category name must be 100 characters or fewer' } };
            }

            if (!['expense', 'deduction', 'cogs'].includes(type)) {
                return { status: 400, data: { error: 'Invalid category type' } };
            }

            // Check for duplicate
            const existing = await query.get(
                `SELECT id FROM expense_categories
         WHERE user_id = ? AND LOWER(name) = LOWER(?)`,
                [userId, name.trim()],
            );

            if (existing) {
                return { status: 400, data: { error: 'Category already exists' } };
            }

            const id = nanoid();
            await query.run(
                `INSERT INTO expense_categories
         (id, user_id, name, type)
         VALUES (?, ?, ?, ?)`,
                [id, userId, name.trim(), type],
            );

            const category = await query.get(`SELECT * FROM expense_categories WHERE id = ?`, [id]);

            return { status: 200, data: { success: true, category } };
        }

        // POST /categorize - Auto-categorize transactions
        if (method === 'POST' && path === '/categorize') {
            const userId = user.id;

            // Get all categories
            const categories = await query.all(
                `SELECT * FROM expense_categories
         WHERE user_id = 'system' OR user_id = ?`,
                [userId],
            );

            // Get uncategorized transactions
            const uncategorized = await query.all(
                `SELECT id, description, amount
         FROM financial_transactions
         WHERE user_id = ? AND (category IS NULL OR category = '')
         AND type IN ('expense', 'purchase')`,
                [userId],
            );

            // Keyword matching rules
            const keywordMap = {
                'exp-shipping': ['usps', 'fedex', 'ups', 'shipping', 'postage', 'stamp'],
                'exp-packaging': ['bubble', 'box', 'tape', 'mailer', 'packing', 'label'],
                'exp-platform': ['ebay', 'paypal', 'stripe', 'etsy', 'mercari', 'poshmark', 'fee'],
                'exp-inventory': ['purchase', 'wholesale', 'supplier', 'buy', 'thrift'],
                'exp-storage': ['storage', 'warehouse', 'rent', 'unit'],
                'exp-software': ['software', 'subscription', 'saas', 'app', 'tool'],
                'exp-travel': ['gas', 'fuel', 'mileage', 'travel', 'hotel', 'flight'],
                'exp-returns': ['return', 'refund', 'chargeback'],
            };

            let categorizedCount = 0;

            for (const transaction of uncategorized) {
                const desc = (transaction.description || '').toLowerCase();

                // Try to match keywords
                for (const [categoryId, keywords] of Object.entries(keywordMap)) {
                    if (keywords.some((keyword) => desc.includes(keyword))) {
                        await query.run(
                            `UPDATE financial_transactions
               SET category = ?
               WHERE id = ?`,
                            [categoryId, transaction.id],
                        );

                        // Update category totals — skip system categories (user_id = 'system') to avoid cross-user pollution
                        await query.run(
                            `UPDATE expense_categories
               SET total_amount = total_amount + ?,
                   transaction_count = transaction_count + 1
               WHERE id = ? AND user_id = ?`,
                            [Math.abs(transaction.amount), categoryId, userId],
                        );

                        categorizedCount++;
                        break;
                    }
                }
            }

            return {
                status: 200,
                data: {
                    success: true,
                    categorized: categorizedCount,
                    total_uncategorized: uncategorized.length,
                    message: `Categorized ${categorizedCount} of ${uncategorized.length} transactions`,
                },
            };
        }

        return { status: 404, data: { error: 'Endpoint not found' } };
    } catch (error) {
        logger.error('[ExpenseTracker] Expense tracker router error', user?.id || null, { detail: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}
