import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

export async function affiliateRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // Landing Pages Routes
    if (path === '/landing-pages' && method === 'GET') {
        try {
            const landingPages = await query.all(`
                SELECT
                    id,
                    slug,
                    title,
                    description,
                    utm_source,
                    utm_medium,
                    utm_campaign,
                    visits,
                    conversions,
                    created_at,
                    updated_at
                FROM affiliate_landing_pages
                WHERE user_id = ?
                ORDER BY created_at DESC
            `, [user.id]);

            return { status: 200, data: landingPages };
        } catch (error) {
            logger.error('[Affiliate] Error fetching landing pages', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch landing pages' } };
        }
    }

    if (path === '/landing-pages' && method === 'POST') {
        try {
            const { slug, title, description, utm_source, utm_medium, utm_campaign } = body;

            if (!slug || !title) {
                return { status: 400, data: { error: 'Slug and title are required' } };
            }

            // Validate input lengths
            if (slug.length > 100) {
                return { status: 400, data: { error: 'Slug must be 100 characters or less' } };
            }
            if (title.length > 200) {
                return { status: 400, data: { error: 'Title must be 200 characters or less' } };
            }
            if (description && description.length > 2000) {
                return { status: 400, data: { error: 'Description must be 2000 characters or less' } };
            }

            // Validate slug format (alphanumeric, hyphens, underscores only)
            if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
                return { status: 400, data: { error: 'Slug may only contain letters, numbers, hyphens, and underscores' } };
            }

            // Check if slug already exists for this user
            const existing = await query.all(`
                SELECT id FROM affiliate_landing_pages
                WHERE user_id = ? AND slug = ?
            `, [user.id, slug]);

            if (existing.length > 0) {
                return { status: 400, data: { error: 'Landing page with this slug already exists' } };
            }

            const id = nanoid();
            const now = new Date().toISOString();

            await query.run(`
                INSERT INTO affiliate_landing_pages (
                    id, user_id, slug, title, description,
                    utm_source, utm_medium, utm_campaign,
                    visits, conversions, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
            `, [
                id, user.id, slug, title, description || null,
                utm_source || null, utm_medium || null, utm_campaign || null,
                now, now
            ]);

            const newPage = await query.get(`
                SELECT * FROM affiliate_landing_pages WHERE id = ?
            `, [id]);

            return { status: 201, data: newPage };
        } catch (error) {
            logger.error('[Affiliate] Error creating landing page', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to create landing page' } };
        }
    }

    if (path.match(/^\/landing-pages\/[^/]+$/) && method === 'PUT') {
        try {
            const id = path.split('/').pop();
            const { slug, title, description, utm_source, utm_medium, utm_campaign } = body;

            // Verify ownership
            const existing = await query.all(`
                SELECT id FROM affiliate_landing_pages
                WHERE id = ? AND user_id = ?
            `, [id, user.id]);

            if (existing.length === 0) {
                return { status: 404, data: { error: 'Landing page not found' } };
            }

            // Check if new slug conflicts with another page
            if (slug) {
                const slugConflict = await query.all(`
                    SELECT id FROM affiliate_landing_pages
                    WHERE user_id = ? AND slug = ? AND id != ?
                `, [user.id, slug, id]);

                if (slugConflict.length > 0) {
                    return { status: 400, data: { error: 'Landing page with this slug already exists' } };
                }
            }

            const now = new Date().toISOString();

            await query.run(`
                UPDATE affiliate_landing_pages
                SET slug = COALESCE(?, slug),
                    title = COALESCE(?, title),
                    description = ?,
                    utm_source = ?,
                    utm_medium = ?,
                    utm_campaign = ?,
                    updated_at = ?
                WHERE id = ?
            `, [
                slug || null, title || null, description || null,
                utm_source || null, utm_medium || null, utm_campaign || null,
                now, id
            ]);

            const updated = await query.get(`
                SELECT * FROM affiliate_landing_pages WHERE id = ?
            `, [id]);

            return { status: 200, data: updated };
        } catch (error) {
            logger.error('[Affiliate] Error updating landing page', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to update landing page' } };
        }
    }

    if (path.match(/^\/landing-pages\/[^/]+$/) && method === 'DELETE') {
        try {
            const id = path.split('/').pop();

            // Verify ownership
            const existing = await query.all(`
                SELECT id FROM affiliate_landing_pages
                WHERE id = ? AND user_id = ?
            `, [id, user.id]);

            if (existing.length === 0) {
                return { status: 404, data: { error: 'Landing page not found' } };
            }

            const result = await query.run(`
                DELETE FROM affiliate_landing_pages WHERE id = ? AND user_id = ?
            `, [id, user.id]);

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Landing page not found' } };
            }

            return { status: 200, data: { message: 'Landing page deleted successfully' } };
        } catch (error) {
            logger.error('[Affiliate] Error deleting landing page', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to delete landing page' } };
        }
    }

    // Tiers Routes
    if (path === '/tiers' && method === 'GET') {
        try {
            const tiers = await query.all(`
                SELECT id, name, min_referrals, commission_rate
                FROM affiliate_tiers
                ORDER BY min_referrals ASC
            `);

            return { status: 200, data: tiers };
        } catch (error) {
            logger.error('[Affiliate] Error fetching tiers', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch tiers' } };
        }
    }

    if (path === '/my-tier' && method === 'GET') {
        try {
            // Count unique referrals for this user
            const referralCount = await query.get(`
                SELECT COUNT(DISTINCT referred_user_id) as count
                FROM affiliate_commissions
                WHERE affiliate_user_id = ?
            `, [user.id]);

            const count = referralCount?.count || 0;

            // Get all tiers ordered by min_referrals descending
            const tiers = await query.all(`
                SELECT id, name, min_referrals, commission_rate
                FROM affiliate_tiers
                ORDER BY min_referrals DESC
            `);

            // Find the highest tier the user qualifies for
            let currentTier = null;
            for (const tier of tiers) {
                if (count >= tier.min_referrals) {
                    currentTier = tier;
                    break;
                }
            }

            // If no tier found, get the lowest tier
            if (!currentTier && tiers.length > 0) {
                currentTier = tiers[tiers.length - 1];
            }

            return {
                status: 200,
                data: {
                    tier: currentTier,
                    referralCount: count
                }
            };
        } catch (error) {
            logger.error('[Affiliate] Error fetching user tier', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch tier information' } };
        }
    }

    // Earnings/Commissions Routes
    if (path === '/earnings' && method === 'GET') {
        try {
            // Get total earnings by status
            const summary = await query.all(`
                SELECT
                    status,
                    SUM(amount) as total,
                    COUNT(*) as count
                FROM affiliate_commissions
                WHERE affiliate_user_id = ?
                GROUP BY status
            `, [user.id]);

            // Get earnings by month
            const byMonth = await query.all(`
                SELECT
                    strftime('%Y-%m', created_at) as month,
                    SUM(amount) as total,
                    COUNT(*) as count,
                    status
                FROM affiliate_commissions
                WHERE affiliate_user_id = ?
                GROUP BY month, status
                ORDER BY month DESC
            `, [user.id]);

            // Calculate totals
            const totals = {
                pending: 0,
                approved: 0,
                paid: 0,
                total: 0
            };

            summary.forEach(item => {
                totals[item.status] = parseFloat(item.total || 0);
                totals.total += parseFloat(item.total || 0);
            });

            // Format monthly data
            const monthlyEarnings = {};
            byMonth.forEach(item => {
                if (!monthlyEarnings[item.month]) {
                    monthlyEarnings[item.month] = {
                        pending: 0,
                        approved: 0,
                        paid: 0,
                        total: 0
                    };
                }
                monthlyEarnings[item.month][item.status] = parseFloat(item.total || 0);
                monthlyEarnings[item.month].total += parseFloat(item.total || 0);
            });

            return {
                status: 200,
                data: {
                    summary: totals,
                    byMonth: monthlyEarnings
                }
            };
        } catch (error) {
            logger.error('[Affiliate] Error fetching earnings', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch earnings' } };
        }
    }

    if (path === '/commissions' && method === 'GET') {
        try {
            const { status, startDate, endDate, limit = 100, offset = 0 } = queryParams;

            let sql = `
                SELECT
                    c.id,
                    c.affiliate_user_id,
                    c.referred_user_id,
                    c.tier_id,
                    c.amount,
                    c.status,
                    c.landing_page_id,
                    c.created_at,
                    c.paid_at,
                    t.name as tier_name,
                    t.commission_rate,
                    lp.title as landing_page_title,
                    lp.slug as landing_page_slug
                FROM affiliate_commissions c
                LEFT JOIN affiliate_tiers t ON c.tier_id = t.id
                LEFT JOIN affiliate_landing_pages lp ON c.landing_page_id = lp.id
                WHERE c.affiliate_user_id = ?
            `;

            const params = [user.id];

            if (status) {
                sql += ` AND c.status = ?`;
                params.push(status);
            }

            if (startDate) {
                sql += ` AND c.created_at >= ?`;
                params.push(startDate);
            }

            if (endDate) {
                sql += ` AND c.created_at <= ?`;
                params.push(endDate);
            }

            sql += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));

            const commissions = await query.all(sql, params);

            // Get total count for pagination
            let countSql = `
                SELECT COUNT(*) as total
                FROM affiliate_commissions
                WHERE affiliate_user_id = ?
            `;
            const countParams = [user.id];

            if (status) {
                countSql += ` AND status = ?`;
                countParams.push(status);
            }

            if (startDate) {
                countSql += ` AND created_at >= ?`;
                countParams.push(startDate);
            }

            if (endDate) {
                countSql += ` AND created_at <= ?`;
                countParams.push(endDate);
            }

            const totalResult = await query.get(countSql, countParams);
            const total = totalResult?.total || 0;

            return {
                status: 200,
                data: {
                    commissions,
                    pagination: {
                        total,
                        limit: parseInt(limit),
                        offset: parseInt(offset)
                    }
                }
            };
        } catch (error) {
            logger.error('[Affiliate] Error fetching commissions', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch commissions' } };
        }
    }

    if (path === '/stats' && method === 'GET') {
        try {
            // Total visits across all landing pages
            const visitsResult = await query.get(`
                SELECT COALESCE(SUM(visits), 0) as total_visits
                FROM affiliate_landing_pages
                WHERE user_id = ?
            `, [user.id]);

            // Total conversions across all landing pages
            const conversionsResult = await query.get(`
                SELECT COALESCE(SUM(conversions), 0) as total_conversions
                FROM affiliate_landing_pages
                WHERE user_id = ?
            `, [user.id]);

            // Total unique referred users (signups)
            const signupsResult = await query.get(`
                SELECT COUNT(DISTINCT referred_user_id) as total_signups
                FROM affiliate_commissions
                WHERE affiliate_user_id = ?
            `, [user.id]);

            // Active users (users who have generated commissions)
            const activeUsersResult = await query.get(`
                SELECT COUNT(DISTINCT referred_user_id) as active_users
                FROM affiliate_commissions
                WHERE affiliate_user_id = ?
                AND status IN ('approved', 'paid')
            `, [user.id]);

            // Total revenue generated
            const revenueResult = await query.get(`
                SELECT COALESCE(SUM(amount), 0) as total_revenue
                FROM affiliate_commissions
                WHERE affiliate_user_id = ?
            `, [user.id]);

            const stats = {
                totalVisits: visitsResult?.total_visits || 0,
                totalConversions: conversionsResult?.total_conversions || 0,
                totalSignups: signupsResult?.total_signups || 0,
                activeUsers: activeUsersResult?.active_users || 0,
                totalRevenue: parseFloat(revenueResult?.total_revenue || 0),
                conversionRate: visitsResult?.total_visits > 0
                    ? parseFloat(((conversionsResult?.total_conversions || 0) / visitsResult.total_visits * 100).toFixed(2))
                    : 0
            };

            return { status: 200, data: stats };
        } catch (error) {
            logger.error('[Affiliate] Error fetching affiliate stats', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch affiliate statistics' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
