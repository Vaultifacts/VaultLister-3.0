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
        [userId]
      );

      return { status: 200, data: { categories } };
    }

    // POST /categories - Create custom expense category
    if (method === 'POST' && path === '/categories') {
      const userId = user.id;
      const { name, type = 'expense', tax_deductible = 0 } = body;

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
        [userId, name.trim()]
      );

      if (existing) {
        return { status: 400, data: { error: 'Category already exists' } };
      }

      const id = nanoid();
      await query.run(
        `INSERT INTO expense_categories
         (id, user_id, name, type, tax_deductible)
         VALUES (?, ?, ?, ?, ?)`,
        [id, userId, name.trim(), type, tax_deductible ? 1 : 0]
      );

      const category = await query.get(
        `SELECT * FROM expense_categories WHERE id = ?`,
        [id]
      );

      return { status: 200, data: { success: true, category } };
    }

    // GET /tax-report - Generate quarterly tax report
    if (method === 'GET' && path === '/tax-report') {
      const userId = user.id;
      const { year, quarter, startDate, endDate } = queryParams;

      let dateFilter = '';
      const params = [userId];

      if (year && quarter) {
        // Calculate quarter dates
        const quarterNum = parseInt(quarter);
        if (quarterNum < 1 || quarterNum > 4) {
          return { status: 400, data: { error: 'Quarter must be between 1 and 4' } };
        }

        const startMonth = (quarterNum - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        const quarterStart = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const quarterEnd = `${year}-${String(endMonth).padStart(2, '0')}-31`;

        dateFilter = `AND date(ft.transaction_date) BETWEEN ? AND ?`;
        params.push(quarterStart, quarterEnd);
      } else if (startDate && endDate) {
        dateFilter = `AND date(ft.transaction_date) BETWEEN ? AND ?`;
        params.push(startDate, endDate);
      }

      // Get all transactions with categories
      const transactions = await query.all(
        `SELECT
           ft.id,
           ft.amount,
           ft.description,
           ft.category,
           ft.transaction_date,
           ec.name as category_name,
           ec.type as category_type,
           ec.tax_deductible
         FROM financial_transactions ft
         LEFT JOIN expense_categories ec ON ft.category = ec.id
         WHERE ft.user_id = ? ${dateFilter}
         AND ft.reference_type IN ('expense', 'purchase', 'refund')
         ORDER BY ft.transaction_date DESC`,
        params
      );

      // Calculate totals
      let totalDeductible = 0;
      let totalNonDeductible = 0;
      const byCategory = {};

      transactions.forEach(tx => {
        const amount = Math.abs(tx.amount);
        const isDeductible = tx.tax_deductible === 1;

        if (isDeductible) {
          totalDeductible += amount;
        } else {
          totalNonDeductible += amount;
        }

        // Group by category
        const catKey = tx.category || 'uncategorized';
        if (!byCategory[catKey]) {
          byCategory[catKey] = {
            name: tx.category_name || 'Uncategorized',
            type: tx.category_type || 'expense',
            total: 0,
            count: 0,
            tax_deductible: isDeductible
          };
        }
        byCategory[catKey].total += amount;
        byCategory[catKey].count++;
      });

      // Estimated tax savings (at 25% rate)
      const estimatedTaxSavings = totalDeductible * 0.25;

      return {
        status: 200,
        data: {
          period: year && quarter
            ? `Q${quarter} ${year}`
            : `${startDate} to ${endDate}`,
          total_deductible: Math.round(totalDeductible * 100) / 100,
          total_non_deductible: Math.round(totalNonDeductible * 100) / 100,
          estimated_tax_savings: Math.round(estimatedTaxSavings * 100) / 100,
          by_category: Object.entries(byCategory).map(([id, data]) => ({
            category_id: id,
            category_name: data.name,
            type: data.type,
            total: Math.round(data.total * 100) / 100,
            count: data.count,
            tax_deductible: data.tax_deductible
          })).sort((a, b) => b.total - a.total),
          transaction_count: transactions.length
        }
      };
    }

    // POST /categorize - Auto-categorize transactions
    if (method === 'POST' && path === '/categorize') {
      const userId = user.id;

      // Get all categories
      const categories = await query.all(
        `SELECT * FROM expense_categories
         WHERE user_id = 'system' OR user_id = ?`,
        [userId]
      );

      // Get uncategorized transactions
      const uncategorized = await query.all(
        `SELECT id, description, amount
         FROM financial_transactions
         WHERE user_id = ? AND (category IS NULL OR category = '')
         AND type IN ('expense', 'purchase')`,
        [userId]
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
        'exp-returns': ['return', 'refund', 'chargeback']
      };

      let categorizedCount = 0;

      for (const transaction of uncategorized) {
        const desc = (transaction.description || '').toLowerCase();

        // Try to match keywords
        for (const [categoryId, keywords] of Object.entries(keywordMap)) {
          if (keywords.some(keyword => desc.includes(keyword))) {
            await query.run(
              `UPDATE financial_transactions
               SET category = ?
               WHERE id = ?`,
              [categoryId, transaction.id]
            );

            // Update category totals
            await query.run(
              `UPDATE expense_categories
               SET total_amount = total_amount + ?,
                   transaction_count = transaction_count + 1
               WHERE id = ?`,
              [Math.abs(transaction.amount), categoryId]
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
          message: `Categorized ${categorizedCount} of ${uncategorized.length} transactions`
        }
      };
    }

    return { status: 404, data: { error: 'Endpoint not found' } };
  } catch (error) {
    logger.error('[ExpenseTracker] Expense tracker router error', user?.id || null, { detail: error.message });
    return { status: 500, data: { error: 'Internal server error' } };
  }
}
