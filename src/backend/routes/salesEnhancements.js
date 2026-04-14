import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

export async function salesEnhancementsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;
    if (!user) return { status: 401, data: { error: 'Authentication required' } };

    // GET /api/sales-tools/tax-nexus - Get nexus status for all states for current year
    if (method === 'GET' && path === '/tax-nexus') {
        try {
            const currentYear = new Date().getFullYear();
            const nexusData = await query.all(`
                SELECT state, total_sales, transaction_count, nexus_threshold_amount,
                       nexus_threshold_transactions, has_nexus, registered, period_year, updated_at
                FROM sales_tax_nexus
                WHERE user_id = ? AND period_year = ?
                ORDER BY total_sales DESC
            `, [user.id, currentYear]);

            return { status: 200, data: { nexus: nexusData, year: currentYear } };
        } catch (error) {
            logger.error('[SalesEnhancements] Error fetching tax nexus data', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/sales-tools/tax-nexus/calculate - Recalculate nexus from sales data
    if (method === 'POST' && path === '/tax-nexus/calculate') {
        try {
            const currentYear = new Date().getFullYear();

            // Query sales table grouped by state (assuming buyer_state column exists)
            // If using orders table, adjust accordingly
            const salesByState = await query.all(`
                SELECT
                    COALESCE(buyer_state, 'Unknown') as state,
                    COUNT(*) as transaction_count,
                    COALESCE(SUM(sale_price), 0) as total_sales
                FROM orders
                WHERE user_id = ?
                AND TO_CHAR(created_at, 'YYYY') = ?
                AND buyer_state IS NOT NULL
                GROUP BY buyer_state
            `, [user.id, currentYear.toString()]);

            // Standard nexus thresholds (these vary by state in reality)
            const thresholdAmount = 100000;
            const thresholdTransactions = 200;

            // Upsert nexus data for each state
            for (const stateData of salesByState) {
                const hasNexus = stateData.total_sales >= thresholdAmount ||
                                 stateData.transaction_count >= thresholdTransactions;

                await query.run(`
                    INSERT INTO sales_tax_nexus (
                        id, user_id, state, total_sales, transaction_count,
                        nexus_threshold_amount, nexus_threshold_transactions,
                        has_nexus, registered, period_year, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW())
                    ON CONFLICT(user_id, state, period_year) DO UPDATE SET
                        total_sales = ?,
                        transaction_count = ?,
                        has_nexus = ?,
                        updated_at = NOW()
                `, [
                    nanoid(),
                    user.id,
                    stateData.state,
                    stateData.total_sales,
                    stateData.transaction_count,
                    thresholdAmount,
                    thresholdTransactions,
                    hasNexus ? 1 : 0,
                    currentYear,
                    stateData.total_sales,
                    stateData.transaction_count,
                    hasNexus ? 1 : 0
                ]);
            }

            return {
                status: 200,
                data: {
                    message: 'Nexus calculation completed',
                    states_analyzed: salesByState.length,
                    nexus_triggered: salesByState.filter(s =>
                        s.total_sales >= thresholdAmount || s.transaction_count >= thresholdTransactions
                    ).length
                }
            };
        } catch (error) {
            logger.error('[SalesEnhancements] Error calculating tax nexus', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/sales-tools/tax-nexus/alerts - Get states approaching nexus thresholds (>70%)
    if (method === 'GET' && path === '/tax-nexus/alerts') {
        try {
            const currentYear = new Date().getFullYear();
            const nexusData = await query.all(`
                SELECT state, total_sales, transaction_count, nexus_threshold_amount,
                       nexus_threshold_transactions, has_nexus, registered
                FROM sales_tax_nexus
                WHERE user_id = ? AND period_year = ?
                ORDER BY total_sales DESC
            `, [user.id, currentYear]);

            const alerts = nexusData
                .filter(n => {
                    const salesPercent = (n.total_sales / n.nexus_threshold_amount) * 100;
                    const txPercent = (n.transaction_count / n.nexus_threshold_transactions) * 100;
                    return !n.has_nexus && (salesPercent > 70 || txPercent > 70);
                })
                .map(n => ({
                    state: n.state,
                    total_sales: n.total_sales,
                    transaction_count: n.transaction_count,
                    sales_threshold_percent: Math.round((n.total_sales / n.nexus_threshold_amount) * 100),
                    transaction_threshold_percent: Math.round((n.transaction_count / n.nexus_threshold_transactions) * 100),
                    registered: n.registered === 1
                }));

            return { status: 200, data: { alerts } };
        } catch (error) {
            logger.error('[SalesEnhancements] Error fetching tax nexus alerts', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/sales-tools/tax-nexus/:state/registered - Mark a state as registered for tax collection
    if (method === 'PUT' && path.match(/^\/tax-nexus\/([A-Z]{2})\/registered$/)) {
        try {
            const state = path.match(/^\/tax-nexus\/([A-Z]{2})\/registered$/)[1];
            const currentYear = new Date().getFullYear();

            await query.run(`
                UPDATE sales_tax_nexus
                SET registered = TRUE, updated_at = NOW()
                WHERE user_id = ? AND state = ? AND period_year = ?
            `, [user.id, state, currentYear]);

            return { status: 200, data: { message: `${state} marked as registered for tax collection` } };
        } catch (error) {
            logger.error('[SalesEnhancements] Error marking state as registered', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/sales-tools/buyers - List buyer profiles with filters
    if (method === 'GET' && path === '/buyers') {
        try {
            const { platform, blocked, min_purchases } = queryParams || {};

            let sql = `
                SELECT id, buyer_name, buyer_username, platform, total_purchases, total_returns,
                       total_spent, avg_payment_days, communication_rating, is_blocked, notes,
                       last_purchase_at, created_at, updated_at
                FROM buyer_profiles
                WHERE user_id = ?
            `;
            const params = [user.id];

            if (platform) {
                sql += ` AND platform = ?`;
                params.push(platform);
            }

            if (blocked === 'true') {
                sql += ` AND is_blocked = TRUE`;
            } else if (blocked === 'false') {
                sql += ` AND is_blocked = FALSE`;
            }

            if (min_purchases) {
                sql += ` AND total_purchases >= ?`;
                params.push(parseInt(min_purchases));
            }

            sql += ` ORDER BY total_spent DESC LIMIT 500`;

            const buyers = await query.all(sql, params);
            return { status: 200, data: { buyers } };
        } catch (error) {
            logger.error('[SalesEnhancements] Error listing buyer profiles', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/sales-tools/buyers/:id - Get single buyer profile with purchase history
    if (method === 'GET' && path.match(/^\/buyers\/[a-zA-Z0-9_-]+$/) && path !== '/buyers/flagged') {
        try {
            const buyerId = path.split('/').pop();

            const buyer = await query.get(`
                SELECT id, buyer_name, buyer_username, platform, total_purchases, total_returns,
                       total_spent, avg_payment_days, communication_rating, is_blocked, notes,
                       last_purchase_at, created_at, updated_at
                FROM buyer_profiles
                WHERE id = ? AND user_id = ?
            `, [buyerId, user.id]);

            if (!buyer) {
                return { status: 404, data: { error: 'Buyer profile not found' } };
            }

            // Get purchase history (assuming orders table has buyer_username column)
            const purchases = await query.all(`
                SELECT id, created_at, sale_price, platform, status, tracking_number
                FROM orders
                WHERE user_id = ? AND buyer_username = ?
                ORDER BY created_at DESC
                LIMIT 50
            `, [user.id, buyer.buyer_username]);

            return {
                status: 200,
                data: {
                    buyer: buyer,
                    purchase_history: purchases
                }
            };
        } catch (error) {
            logger.error('[SalesEnhancements] Error fetching buyer profile', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/sales-tools/buyers - Create/update buyer profile
    if (method === 'POST' && path === '/buyers') {
        try {
            const { buyer_name, buyer_username, platform, notes } = body || {};

            if (!buyer_username || !platform) {
                return { status: 400, data: { error: 'buyer_username and platform are required' } };
            }

            // Check if buyer exists
            const existing = await query.get(`
                SELECT id FROM buyer_profiles
                WHERE user_id = ? AND buyer_username = ? AND platform = ?
            `, [user.id, buyer_username, platform]);

            if (existing) {
                // Update existing
                await query.run(`
                    UPDATE buyer_profiles
                    SET buyer_name = COALESCE(?, buyer_name),
                        notes = COALESCE(?, notes),
                        updated_at = NOW()
                    WHERE id = ?
                `, [buyer_name, notes, existing.id]);

                return { status: 200, data: { message: 'Buyer profile updated', id: existing.id } };
            } else {
                // Create new
                const id = nanoid();
                await query.run(`
                    INSERT INTO buyer_profiles (
                        id, user_id, buyer_name, buyer_username, platform, total_purchases,
                        total_returns, total_spent, avg_payment_days, communication_rating,
                        is_blocked, notes, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 3, 0, ?, NOW(), NOW())
                `, [id, user.id, buyer_name || buyer_username, buyer_username, platform, notes || null]);

                return { status: 201, data: { message: 'Buyer profile created', id } };
            }
        } catch (error) {
            logger.error('[SalesEnhancements] Error creating/updating buyer profile', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/sales-tools/buyers/:id - Update buyer profile
    if (method === 'PUT' && path.match(/^\/buyers\/[a-zA-Z0-9_-]+$/)) {
        try {
            const buyerId = path.split('/').pop();
            const { communication_rating, notes, is_blocked } = body || {};

            const updates = [];
            const params = [];

            if (communication_rating !== undefined) {
                updates.push('communication_rating = ?');
                params.push(parseInt(communication_rating));
            }

            if (notes !== undefined) {
                updates.push('notes = ?');
                params.push(notes);
            }

            if (is_blocked !== undefined) {
                updates.push('is_blocked = ?');
                params.push(is_blocked ? 1 : 0);
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No fields to update' } };
            }

            updates.push('updated_at = NOW()');
            params.push(buyerId, user.id);

            await query.run(`
                UPDATE buyer_profiles
                SET ${updates.join(', ')}
                WHERE id = ? AND user_id = ?
            `, params);

            return { status: 200, data: { message: 'Buyer profile updated' } };
        } catch (error) {
            logger.error('[SalesEnhancements] Error updating buyer profile', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/sales-tools/buyers/:id/block - Toggle block status
    if (method === 'POST' && path.match(/^\/buyers\/[a-zA-Z0-9_-]+\/block$/)) {
        try {
            const buyerId = path.replace('/block', '').split('/').pop();

            const buyer = await query.get(`
                SELECT is_blocked FROM buyer_profiles
                WHERE id = ? AND user_id = ?
            `, [buyerId, user.id]);

            if (!buyer) {
                return { status: 404, data: { error: 'Buyer profile not found' } };
            }

            const newStatus = buyer.is_blocked === 1 ? 0 : 1;

            await query.run(`
                UPDATE buyer_profiles
                SET is_blocked = ?, updated_at = NOW()
                WHERE id = ? AND user_id = ?
            `, [newStatus, buyerId, user.id]);

            return {
                status: 200,
                data: {
                    message: newStatus === 1 ? 'Buyer blocked' : 'Buyer unblocked',
                    is_blocked: newStatus === 1
                }
            };
        } catch (error) {
            logger.error('[SalesEnhancements] Error toggling buyer block status', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/sales-tools/buyers/flagged - Get buyers with return rate > 30% or marked for review
    if (method === 'GET' && path === '/buyers/flagged') {
        try {
            const flaggedBuyers = await query.all(`
                SELECT id, buyer_name, buyer_username, platform, total_purchases, total_returns,
                       total_spent, communication_rating, is_blocked, last_purchase_at,
                       ROUND((CAST(total_returns AS FLOAT) / NULLIF(total_purchases, 0)) * 100, 1) as return_rate
                FROM buyer_profiles
                WHERE user_id = ?
                AND (
                    (CAST(total_returns AS FLOAT) / NULLIF(total_purchases, 0)) > 0.3
                    OR communication_rating <= 2
                    OR is_blocked = TRUE
                )
                ORDER BY return_rate DESC
                LIMIT 500
            `, [user.id]);

            return { status: 200, data: { flagged_buyers: flaggedBuyers } };
        } catch (error) {
            logger.error('[SalesEnhancements] Error fetching flagged buyers', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/sales-tools/buyers/sync - Auto-generate buyer profiles from existing sales/orders data
    if (method === 'POST' && path === '/buyers/sync') {
        try {
            // Aggregate buyer data from orders
            const buyerStats = await query.all(`
                SELECT
                    buyer_username,
                    buyer_name,
                    platform,
                    COUNT(*) as total_purchases,
                    SUM(CASE WHEN status = 'returned' OR status = 'refunded' THEN 1 ELSE 0 END) as total_returns,
                    SUM(sale_price) as total_spent,
                    MAX(created_at) as last_purchase_at
                FROM orders
                WHERE user_id = ?
                AND buyer_username IS NOT NULL
                GROUP BY buyer_username, platform
                LIMIT 5000
            `, [user.id]);

            let created = 0;
            let updated = 0;

            for (const stats of buyerStats) {
                // Check if profile exists
                const existing = await query.get(`
                    SELECT id FROM buyer_profiles
                    WHERE user_id = ? AND buyer_username = ? AND platform = ?
                `, [user.id, stats.buyer_username, stats.platform]);

                if (existing) {
                    // Update existing profile
                    await query.run(`
                        UPDATE buyer_profiles
                        SET total_purchases = ?,
                            total_returns = ?,
                            total_spent = ?,
                            last_purchase_at = ?,
                            updated_at = NOW()
                        WHERE id = ?
                    `, [
                        stats.total_purchases,
                        stats.total_returns,
                        stats.total_spent,
                        stats.last_purchase_at,
                        existing.id
                    ]);
                    updated++;
                } else {
                    // Create new profile
                    await query.run(`
                        INSERT INTO buyer_profiles (
                            id, user_id, buyer_name, buyer_username, platform,
                            total_purchases, total_returns, total_spent, avg_payment_days,
                            communication_rating, is_blocked, last_purchase_at,
                            created_at, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 3, 0, ?, NOW(), NOW())
                    `, [
                        nanoid(),
                        user.id,
                        stats.buyer_name || stats.buyer_username,
                        stats.buyer_username,
                        stats.platform,
                        stats.total_purchases,
                        stats.total_returns,
                        stats.total_spent,
                        stats.last_purchase_at
                    ]);
                    created++;
                }
            }

            return {
                status: 200,
                data: {
                    message: 'Buyer profiles synced successfully',
                    created,
                    updated,
                    total: created + updated
                }
            };
        } catch (error) {
            logger.error('[SalesEnhancements] Error syncing buyer profiles', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Endpoint not found' } };
}
