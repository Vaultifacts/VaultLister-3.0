// Analytics Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { checkTierPermission } from '../middleware/auth.js';
import { logger } from '../shared/logger.js';
import { cacheForUser } from '../middleware/cache.js';
import { requireFeature } from '../middleware/featureFlags.js';
import redis from '../services/redis.js';

function _cacheKey(userId, path, params = {}) {
    return `${userId}:${path}:${JSON.stringify(params)}`;
}

async function _getCached(key) {
    return await redis.getJson('cache:analytics:' + key);
}

async function _setCached(key, data) {
    await redis.setJson('cache:analytics:' + key, data, 300);
}

/** Invalidate all cached analytics for a user (call on sales/inventory writes) */
export async function invalidateAnalyticsCache(_userId) {
    // Redis doesn't support pattern-delete without SCAN.
    // With 5-minute TTL, stale entries expire naturally.
}

export async function analyticsRouter(ctx) {
    const { method, path, query: queryParams, user } = ctx;

    // Feature flag gate (REM-17)
    if (requireFeature('FEATURE_ADVANCED_ANALYTICS', ctx)) return ctx.res;

    const analyticsLevel = (await checkTierPermission(user, 'analytics')).level;

    // Tier-restricted endpoints
    const advancedEndpoints = ['/performance', '/platforms', '/inventory', '/trends', '/custom-metrics'];
    if (analyticsLevel === 'basic' && advancedEndpoints.some(e => path === e || path.startsWith(e + '/'))) {
        return { status: 403, data: { error: 'Upgrade your plan to access advanced analytics' } };
    }

    // GET /api/analytics/dashboard - Get dashboard overview
    // GET /api/analytics/stats - Alias for dashboard
    if (method === 'GET' && (path === '/dashboard' || path === '/stats')) {
        const { period = '30d' } = queryParams;
        const _ck = _cacheKey(user.id, '/dashboard', { period });
        const _cached = await _getCached(_ck);
        if (_cached) return { status: 200, data: _cached, cacheControl: cacheForUser(300) };
        try {

            const PERIOD_OFFSETS = {
                '7d':  '-7 days',
                '30d': '-30 days',
                '90d': '-90 days',
                '6m':  '-6 months',
                '1y':  '-1 year',
                'all': null
            };
            const periodOffset = PERIOD_OFFSETS[period] ?? PERIOD_OFFSETS['30d'];

            // Batch queries: 5 queries instead of 16
            const invRow = await query.get(`
                SELECT
                    COUNT(CASE WHEN status != 'deleted' THEN 1 END) as total,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                    COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
                    COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold,
                    COALESCE(SUM(CASE WHEN status = 'active' THEN list_price * quantity ELSE 0 END), 0) as totalValue
                FROM inventory WHERE user_id = ?
            `, [user.id]) || {};

            const listRow = await query.get(`
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                    COALESCE(SUM(views), 0) as views,
                    COALESCE(SUM(likes), 0) as likes
                FROM listings WHERE user_id = ?
            `, [user.id]) || {};

            const salesRow = periodOffset ? await query.get(`
                SELECT
                    COUNT(CASE WHEN created_at >= NOW() + ?::interval THEN 1 END) as total,
                    COALESCE(SUM(CASE WHEN created_at >= NOW() + ?::interval THEN sale_price ELSE 0 END), 0) as revenue,
                    COALESCE(SUM(CASE WHEN created_at >= NOW() + ?::interval THEN net_profit ELSE 0 END), 0) as profit,
                    COUNT(CASE WHEN status IN ('pending', 'confirmed') THEN 1 END) as pendingShipments
                FROM sales WHERE user_id = ?
            `, [periodOffset, periodOffset, periodOffset, user.id]) || {} : await query.get(`
                SELECT
                    COUNT(*) as total,
                    COALESCE(SUM(sale_price), 0) as revenue,
                    COALESCE(SUM(net_profit), 0) as profit,
                    COUNT(CASE WHEN status IN ('pending', 'confirmed') THEN 1 END) as pendingShipments
                FROM sales WHERE user_id = ?
            `, [user.id]) || {};

            const offersRow = await query.get(`
                SELECT
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted
                FROM offers WHERE user_id = ?
            `, [user.id]) || {};

            const autoRow = await query.get(`
                SELECT
                    (SELECT COUNT(*) FROM automation_rules WHERE user_id = ? AND is_enabled = TRUE) as active,
                    (SELECT COUNT(*) FROM automation_logs WHERE user_id = ? AND created_at >= date('now')) as runsToday
            `, [user.id, user.id]) || {};

            const stats = {
                inventory: {
                    total: invRow.total || 0,
                    active: invRow.active || 0,
                    draft: invRow.draft || 0,
                    sold: invRow.sold || 0,
                    totalValue: invRow.totalValue || 0
                },
                listings: {
                    total: listRow.total || 0,
                    active: listRow.active || 0,
                    views: listRow.views || 0,
                    likes: listRow.likes || 0
                },
                sales: {
                    total: salesRow.total || 0,
                    revenue: salesRow.revenue || 0,
                    profit: salesRow.profit || 0,
                    pendingShipments: salesRow.pendingShipments || 0
                },
                offers: {
                    pending: offersRow.pending || 0,
                    accepted: offersRow.accepted || 0
                },
                automations: {
                    active: autoRow.active || 0,
                    runsToday: autoRow.runsToday || 0
                }
            };

            await _setCached(_ck, { stats });
            return { status: 200, data: { stats }, cacheControl: cacheForUser(300) };
        } catch (error) {
            logger.error('[Analytics] Analytics stats error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch analytics stats' } };
        }
    }

    // GET /api/analytics/sales - Sales analytics
    if (method === 'GET' && path === '/sales') {
        const { period = '30d', groupBy = 'day' } = queryParams;

        // Whitelist allowed groupBy values
        const ALLOWED_GROUPBY = ['day', 'week', 'month'];
        if (!ALLOWED_GROUPBY.includes(groupBy)) {
            return { status: 400, data: { error: 'Invalid groupBy value. Allowed: day, week, month' } };
        }

        const _ck2 = _cacheKey(user.id, '/sales', { period, groupBy });
        const _cached2 = await _getCached(_ck2);
        if (_cached2) return { status: 200, data: _cached2, cacheControl: cacheForUser(300) };

        try {
            const SALES_DATE_OFFSETS = {
                '7d':  '-7 days',
                '30d': '-30 days',
                '90d': '-90 days',
                '1y':  '-1 year',
                'all': null
            };
            const salesPeriodOffset = SALES_DATE_OFFSETS[period] ?? SALES_DATE_OFFSETS['30d'];

            const GROUP_CLAUSES = {
                'day':   "s.created_at::date",
                'week':  "TO_CHAR(s.created_at, 'YYYY-IW')",
                'month': "TO_CHAR(s.created_at, 'YYYY-MM')"
            };
            const groupClause = GROUP_CLAUSES[groupBy];

            const salesData = await query.all(`
                SELECT
                    ${groupClause} as period,
                    COUNT(*) as sales,
                    SUM(s.sale_price) as revenue,
                    SUM(s.net_profit) as profit,
                    AVG(s.sale_price) as avg_price,
                    COALESCE(SUM(i.cost_price), 0) as cogs
                FROM sales s
                LEFT JOIN inventory i ON s.inventory_id = i.id
                WHERE s.user_id = ? AND (salesPeriodOffset IS NULL OR s.created_at >= NOW() + ?::interval)
                GROUP BY ${groupClause}
                ORDER BY period DESC
            `, [user.id, salesPeriodOffset]);

            const byPlatform = await query.all(`
                SELECT
                    s.platform,
                    COUNT(*) as sales,
                    SUM(s.sale_price) as revenue,
                    SUM(s.net_profit) as profit
                FROM sales s
                WHERE s.user_id = ? AND (salesPeriodOffset IS NULL OR s.created_at >= NOW() + ?::interval)
                GROUP BY s.platform
                ORDER BY revenue DESC
            `, [user.id, salesPeriodOffset]);

            const topItems = await query.all(`
                SELECT
                    i.title, i.brand, i.category,
                    s.sale_price, s.net_profit, s.platform, s.created_at
                FROM sales s
                JOIN inventory i ON s.inventory_id = i.id
                WHERE s.user_id = ? AND (salesPeriodOffset IS NULL OR s.created_at >= NOW() + ?::interval)
                ORDER BY s.sale_price DESC
                LIMIT 10
            `, [user.id, salesPeriodOffset]);

            await _setCached(_ck2, { salesData, byPlatform, topItems });
            return { status: 200, data: { salesData, byPlatform, topItems }, cacheControl: cacheForUser(300) };
        } catch (error) {
            logger.error('[Analytics] Analytics sales error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch sales analytics' } };
        }
    }

    // GET /api/analytics/inventory - Inventory analytics
    if (method === 'GET' && path === '/inventory') {
        try {
            const byCategory = await query.all(`
                SELECT
                    category,
                    COUNT(*) as count,
                    SUM(list_price * quantity) as value,
                    AVG(list_price) as avg_price
                FROM inventory
                WHERE user_id = ? AND status != 'deleted'
                GROUP BY category
                ORDER BY count DESC
            `, [user.id]);

            const byBrand = await query.all(`
                SELECT
                    brand,
                    COUNT(*) as count,
                    SUM(list_price * quantity) as value
                FROM inventory
                WHERE user_id = ? AND status != 'deleted' AND brand IS NOT NULL
                GROUP BY brand
                ORDER BY count DESC
                LIMIT 20
            `, [user.id]);

            const byStatus = await query.all(`
                SELECT status, COUNT(*) as count
                FROM inventory WHERE user_id = ?
                GROUP BY status
            `, [user.id]);

            const priceDistribution = await query.all(`
                SELECT
                    CASE
                        WHEN list_price < 25 THEN '$0-$25'
                        WHEN list_price < 50 THEN '$25-$50'
                        WHEN list_price < 100 THEN '$50-$100'
                        WHEN list_price < 200 THEN '$100-$200'
                        ELSE '$200+'
                    END as range,
                    COUNT(*) as count
                FROM inventory
                WHERE user_id = ? AND status = 'active'
                GROUP BY range
                ORDER BY MIN(list_price)
            `, [user.id]);

            const ageAnalysis = await query.all(`
                SELECT
                    CASE
                        WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 < 7 THEN '< 1 week'
                        WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 < 30 THEN '1-4 weeks'
                        WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 < 60 THEN '1-2 months'
                        WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 < 90 THEN '2-3 months'
                        ELSE '3+ months'
                    END as age,
                    COUNT(*) as count,
                    SUM(list_price) as value
                FROM inventory
                WHERE user_id = ? AND status = 'active'
                GROUP BY age
            `, [user.id]);

            return { status: 200, data: { byCategory, byBrand, byStatus, priceDistribution, ageAnalysis } };
        } catch (error) {
            logger.error('[Analytics] Analytics inventory error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch inventory analytics' } };
        }
    }

    // GET /api/analytics/platforms - Platform analytics
    if (method === 'GET' && path === '/platforms') {
        try {
            const platforms = await query.all(`
                SELECT
                    l.platform,
                    COUNT(DISTINCT l.id) as listings,
                    SUM(CASE WHEN l.status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(l.views) as views,
                    SUM(l.likes) as likes,
                    COUNT(DISTINCT s.id) as sales,
                    SUM(s.sale_price) as revenue
                FROM listings l
                LEFT JOIN sales s ON s.platform = l.platform AND s.user_id = l.user_id
                WHERE l.user_id = ?
                GROUP BY l.platform
            `, [user.id]);

            return { status: 200, data: { platforms } };
        } catch (error) {
            logger.error('[Analytics] Analytics platforms error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch platform analytics' } };
        }
    }

    // GET /api/analytics/inventory-deep - Aging, sell-through, margins
    if (method === 'GET' && path === '/inventory-deep') {
        try {
            // Aging report: items by days since created
            const aging = await query.all(`
                SELECT
                    i.id, i.title, i.sku, i.category, i.brand,
                    i.cost_price, i.list_price, i.status,
                    CAST(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400 AS INTEGER) as days_old,
                    (SELECT COUNT(*) FROM listings l WHERE l.inventory_id = i.id AND l.status = 'active') as active_listings,
                    (SELECT SUM(l.views) FROM listings l WHERE l.inventory_id = i.id) as total_views
                FROM inventory i
                WHERE i.user_id = ? AND i.status IN ('active', 'draft')
                ORDER BY days_old DESC
            `, [user.id]);

            // Aging buckets
            const agingBuckets = [
                { label: '0-7 days', min: 0, max: 7, count: 0, value: 0 },
                { label: '8-30 days', min: 8, max: 30, count: 0, value: 0 },
                { label: '31-60 days', min: 31, max: 60, count: 0, value: 0 },
                { label: '61-90 days', min: 61, max: 90, count: 0, value: 0 },
                { label: '90+ days', min: 91, max: 99999, count: 0, value: 0 }
            ];
            aging.forEach(item => {
                const bucket = agingBuckets.find(b => item.days_old >= b.min && item.days_old <= b.max);
                if (bucket) {
                    bucket.count++;
                    bucket.value += (item.list_price || 0);
                }
            });

            // Sell-through rate by category
            const sellThrough = await query.all(`
                SELECT
                    category,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold,
                    ROUND(SUM(CASE WHEN status = 'sold' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) as sell_rate,
                    AVG(CASE WHEN status = 'sold' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400 END) as avg_days_to_sell
                FROM inventory
                WHERE user_id = ? AND status != 'deleted'
                GROUP BY category
                HAVING total >= 2
                ORDER BY sell_rate DESC
            `, [user.id]);

            // Margin analysis by category
            const margins = await query.all(`
                SELECT
                    i.category,
                    COUNT(*) as sold_count,
                    ROUND(AVG(s.sale_price), 2) as avg_sale_price,
                    ROUND(AVG(i.cost_price), 2) as avg_cost,
                    ROUND(AVG(s.sale_price - i.cost_price - COALESCE(s.platform_fee, 0) - COALESCE(s.shipping_cost, 0)), 2) as avg_net_profit,
                    ROUND(AVG((s.sale_price - i.cost_price - COALESCE(s.platform_fee, 0) - COALESCE(s.shipping_cost, 0)) / NULLIF(s.sale_price, 0) * 100), 1) as margin_pct,
                    ROUND(SUM(s.sale_price - i.cost_price - COALESCE(s.platform_fee, 0) - COALESCE(s.shipping_cost, 0)), 2) as total_profit
                FROM sales s
                JOIN inventory i ON s.inventory_id = i.id
                WHERE s.user_id = ?
                GROUP BY i.category
                HAVING sold_count >= 1
                ORDER BY total_profit DESC
            `, [user.id]);

            // Dead stock: active items > 60 days with 0 views
            const deadStock = aging.filter(i => i.days_old >= 60 && (!i.total_views || i.total_views === 0));

            // Overall stats
            const overallSellThrough = await query.get(`
                SELECT
                    ROUND(SUM(CASE WHEN status = 'sold' THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100, 1) as rate,
                    ROUND(AVG(CASE WHEN status = 'sold' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400 END), 1) as avg_days
                FROM inventory WHERE user_id = ? AND status != 'deleted'
            `, [user.id]) || { rate: 0, avg_days: 0 };

            const overallMargin = await query.get(`
                SELECT
                    ROUND(AVG((s.sale_price - i.cost_price - COALESCE(s.platform_fee, 0) - COALESCE(s.shipping_cost, 0)) / NULLIF(s.sale_price, 0) * 100), 1) as margin_pct,
                    ROUND(SUM(s.sale_price - i.cost_price - COALESCE(s.platform_fee, 0) - COALESCE(s.shipping_cost, 0)), 2) as total_profit
                FROM sales s JOIN inventory i ON s.inventory_id = i.id WHERE s.user_id = ?
            `, [user.id]) || { margin_pct: 0, total_profit: 0 };

            return {
                status: 200,
                data: {
                    aging: aging.slice(0, 50),
                    agingBuckets,
                    sellThrough,
                    margins,
                    deadStock: deadStock.slice(0, 20),
                    overall: {
                        sell_through_rate: overallSellThrough.rate || 0,
                        avg_days_to_sell: overallSellThrough.avg_days || 0,
                        margin_pct: overallMargin.margin_pct || 0,
                        total_profit: overallMargin.total_profit || 0
                    }
                }
            };
        } catch (error) {
            logger.error('[Analytics] Inventory deep analytics error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch inventory analytics' } };
        }
    }

    // GET /api/analytics/performance - Performance metrics (advanced tier)
    if (method === 'GET' && path === '/performance') {
        if (analyticsLevel === 'basic') {
            return { status: 403, data: { error: 'Upgrade to access performance analytics' } };
        }

        try {
            const sellThroughRate = Number((await query.get(`
                SELECT
                    COUNT(CASE WHEN status = 'sold' THEN 1 END) * 100.0 / COUNT(*) as rate
                FROM inventory WHERE user_id = ? AND status != 'deleted'
            `, [user.id]))?.rate) || 0;

            const avgDaysToSell = Number((await query.get(`
                SELECT AVG(EXTRACT(EPOCH FROM (s.created_at - i.created_at)) / 86400) as days
                FROM sales s
                JOIN inventory i ON s.inventory_id = i.id
                WHERE s.user_id = ?
            `, [user.id]))?.days) || 0;

            const roiAnalysis = await query.get(`
                SELECT
                    SUM(s.net_profit) as total_profit,
                    SUM(i.cost_price) as total_cost,
                    CASE WHEN SUM(i.cost_price) > 0 THEN SUM(s.net_profit) * 100.0 / SUM(i.cost_price) ELSE 0 END as roi
                FROM sales s
                JOIN inventory i ON s.inventory_id = i.id
                WHERE s.user_id = ?
            `, [user.id]);

            const topPerformers = await query.all(`
                SELECT
                    category,
                    COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold,
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'sold' THEN 1 END) * 100.0 / COUNT(*) as sell_rate
                FROM inventory
                WHERE user_id = ? AND status != 'deleted'
                GROUP BY category
                HAVING total >= 3
                ORDER BY sell_rate DESC
                LIMIT 5
            `, [user.id]);

            return {
                status: 200,
                data: {
                    sellThroughRate,
                    avgDaysToSell,
                    roi: roiAnalysis,
                    topPerformers
                }
            };
        } catch (error) {
            logger.error('[Analytics] Analytics performance error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch performance analytics' } };
        }
    }

    // GET /api/analytics/sustainability - Sustainability impact
    if (method === 'GET' && path === '/sustainability') {
        try {
            const impact = await query.get(`
                SELECT
                    SUM(water_saved_liters) as water_saved,
                    SUM(co2_saved_kg) as co2_saved,
                    SUM(waste_prevented_kg) as waste_prevented
                FROM sustainability_log
                WHERE user_id = ?
            `, [user.id]);

            const byCategory = await query.all(`
                SELECT
                    category,
                    SUM(water_saved_liters) as water,
                    SUM(co2_saved_kg) as co2,
                    SUM(waste_prevented_kg) as waste
                FROM sustainability_log
                WHERE user_id = ?
                GROUP BY category
            `, [user.id]);

            const salesCount = Number((await query.get('SELECT COUNT(*) as count FROM sales WHERE user_id = ?', [user.id]))?.count) || 0;

            return {
                status: 200,
                data: {
                    totalImpact: {
                        waterSaved: impact?.water_saved || 0,
                        co2Saved: impact?.co2_saved || 0,
                        wastePrevented: impact?.waste_prevented || 0,
                        itemsResold: salesCount
                    },
                    byCategory,
                    equivalents: {
                        showers: Math.round((impact?.water_saved || 0) / 65),
                        carMiles: Math.round((impact?.co2_saved || 0) / 0.404),
                        trashBags: Math.round((impact?.waste_prevented || 0) / 4.5)
                    },
                    // Source citations and accuracy ranges for displayed sustainability metrics
                    methodology: {
                        waterSaved: {
                            description: 'Estimated liters of water saved by reselling vs. manufacturing new items',
                            source: 'WRAP (Waste and Resources Action Programme) — Extending the Life of Clothes report (2017)',
                            sourceUrl: 'https://www.wrap.org.uk/resources/report/valuing-our-clothes-true-cost-how-we-design-use-and-dispose-our-clothes',
                            accuracyRange: '±30%',
                            confidenceNote: 'Estimates vary by garment type, material, and manufacturing region'
                        },
                        co2Saved: {
                            description: 'Estimated kg of CO₂-equivalent emissions avoided by reselling vs. new production',
                            source: 'thredUP 2023 Resale Report, citing Quantis lifecycle assessment data',
                            sourceUrl: 'https://www.thredup.com/resale/',
                            accuracyRange: '±25%',
                            confidenceNote: 'CO₂ savings depend on item category, transport distance, and end-of-life of displaced new item'
                        },
                        wastePrevented: {
                            description: 'Estimated kg of textile waste diverted from landfill',
                            source: 'EPA (US Environmental Protection Agency) — Advancing Sustainable Materials Management: Facts and Figures (2018)',
                            sourceUrl: 'https://www.epa.gov/facts-and-figures-about-materials-waste-and-recycling/advancing-sustainable-materials-management',
                            accuracyRange: '±20%',
                            confidenceNote: 'Based on average garment weight per category; actual weight may differ'
                        },
                        equivalents: {
                            showers: {
                                conversionFactor: '65 liters per average shower',
                                source: 'US EPA WaterSense Program — average shower water use estimate'
                            },
                            carMiles: {
                                conversionFactor: '0.404 kg CO₂ per mile (average US passenger vehicle)',
                                source: 'US EPA — Greenhouse Gas Equivalencies Calculator (2023)'
                            },
                            trashBags: {
                                conversionFactor: '4.5 kg per standard 30-gallon trash bag',
                                source: 'EPA solid waste characterization average'
                            }
                        }
                    }
                }
            };
        } catch (error) {
            logger.error('[Analytics] Analytics sustainability error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch sustainability data' } };
        }
    }

    // GET /api/analytics/trends - Trend analysis
    if (method === 'GET' && path === '/trends') {
        try {
            const { days = 30 } = queryParams;
            const parsedDays = parseInt(days);
            const safeDays = Number.isFinite(parsedDays) ? Math.max(1, Math.min(365, parsedDays)) : 30;
            const daysModifier = `-${safeDays} days`;

            const trends = await query.all(`
                SELECT
                    created_at::date as date,
                    COUNT(*) as new_listings,
                    (SELECT COUNT(*) FROM sales WHERE user_id = ? AND created_at::date = i.created_at::date) as sales,
                    (SELECT SUM(sale_price) FROM sales WHERE user_id = ? AND created_at::date = i.created_at::date) as revenue
                FROM inventory i
                WHERE user_id = ? AND created_at >= NOW() + ?::interval
                GROUP BY created_at::date
                ORDER BY date DESC
            `, [user.id, user.id, user.id, daysModifier]);

            return { status: 200, data: { trends } };
        } catch (error) {
            logger.error('[Analytics] Analytics trends error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch trend data' } };
        }
    }

    // GET /api/analytics/heatmap - Engagement heatmap (24x7 grid)
    if (method === 'GET' && path === '/heatmap') {
        const { days = 30, platform } = queryParams;
        const parsedDaysHeatmap = parseInt(days);
        const safeDays = Number.isFinite(parsedDaysHeatmap) ? Math.max(1, Math.min(365, parsedDaysHeatmap)) : 30;
        const daysModifier = `-${safeDays} days`;

        let platformFilter = '';
        const params = [user.id, daysModifier];
        if (platform) {
            platformFilter = 'AND platform = ?';
            params.push(platform);
        }

        // Build 24x7 engagement grid from listing_engagement table
        let heatmapData;
        let engagementError = false;
        try {
            heatmapData = await query.all(`
                SELECT
                    CAST(EXTRACT(DOW FROM event_time) AS INTEGER) as day_of_week,
                    CAST(EXTRACT(HOUR FROM event_time) AS INTEGER) as hour_of_day,
                    COUNT(*) as event_count,
                    SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views,
                    SUM(CASE WHEN event_type = 'like' THEN 1 ELSE 0 END) as likes,
                    SUM(CASE WHEN event_type = 'share' THEN 1 ELSE 0 END) as shares,
                    SUM(CASE WHEN event_type = 'offer' THEN 1 ELSE 0 END) as offers,
                    SUM(CASE WHEN event_type = 'sale' THEN 1 ELSE 0 END) as sales
                FROM listing_engagement
                WHERE user_id = ?
                AND event_time >= NOW() + ?::interval
                ${platformFilter}
                GROUP BY day_of_week, hour_of_day
                ORDER BY day_of_week, hour_of_day
            `, params);
        } catch (err) {
            // Table might not exist yet, return empty grid
            heatmapData = [];
            engagementError = true;
        }

        // Build full 24x7 grid with defaults
        const grid = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                const existing = heatmapData.find(d => d.day_of_week === day && d.hour_of_day === hour);
                grid.push({
                    day: day,
                    dayName: dayNames[day],
                    hour: hour,
                    events: existing?.event_count || 0,
                    views: existing?.views || 0,
                    likes: existing?.likes || 0,
                    shares: existing?.shares || 0,
                    offers: existing?.offers || 0,
                    sales: existing?.sales || 0
                });
            }
        }

        // Find peak times
        const sorted = [...grid].sort((a, b) => b.events - a.events);
        const peakTimes = sorted.slice(0, 5).map(g => ({
            day: g.dayName,
            hour: `${g.hour}:00`,
            events: g.events
        }));

        return { status: 200, data: { grid, peakTimes, days: safeDays, ...(engagementError && { partial: true, warning: 'Engagement data unavailable' }) } };
    }

    // GET /api/analytics/heatmap/listings - Per-listing engagement breakdown
    if (method === 'GET' && path === '/heatmap/listings') {
        const { days = 30, limit = 20 } = queryParams;
        const parsedDaysListings = parseInt(days);
        const safeDays = Number.isFinite(parsedDaysListings) ? Math.max(1, Math.min(365, parsedDaysListings)) : 30;
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const daysModifier = `-${safeDays} days`;

        let listingEngagement;
        let listingEngagementError = false;
        try {
            listingEngagement = await query.all(`
                SELECT
                    le.listing_id,
                    l.title,
                    l.platform,
                    COUNT(*) as total_events,
                    SUM(CASE WHEN le.event_type = 'view' THEN 1 ELSE 0 END) as views,
                    SUM(CASE WHEN le.event_type = 'like' THEN 1 ELSE 0 END) as likes,
                    SUM(CASE WHEN le.event_type = 'share' THEN 1 ELSE 0 END) as shares,
                    SUM(CASE WHEN le.event_type = 'offer' THEN 1 ELSE 0 END) as offers,
                    SUM(CASE WHEN le.event_type = 'sale' THEN 1 ELSE 0 END) as sales
                FROM listing_engagement le
                LEFT JOIN listings l ON le.listing_id = l.id
                WHERE le.user_id = ?
                AND le.event_time >= NOW() + ?::interval
                GROUP BY le.listing_id
                ORDER BY total_events DESC
                LIMIT ?
            `, [user.id, daysModifier, safeLimit]);
        } catch (err) {
            listingEngagement = [];
            listingEngagementError = true;
        }

        return { status: 200, data: { listings: listingEngagement, ...(listingEngagementError && { partial: true, warning: 'Engagement data unavailable' }) } };
    }

    // GET /api/analytics/heatmap/geography - Geographic sales data
    if (method === 'GET' && path === '/heatmap/geography') {
        // The sales table stores buyer_address as unstructured text and has no dedicated
        // state column. We attempt a best-effort US state extraction from buyer_address
        // (pattern: ", XX 12345" at the end of the address string). Rows that do not match
        // are grouped under their platform name so all real data is still surfaced.
        const STATE_NAMES = {
            AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
            CO:'Colorado', CT:'Connecticut', DE:'Delaware', FL:'Florida', GA:'Georgia',
            HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
            KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland',
            MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi',
            MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire',
            NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina',
            ND:'North Dakota', OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania',
            RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota', TN:'Tennessee',
            TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington',
            WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming', DC:'District of Columbia'
        };

        // Matches ", XX " or ", XX\n" before a zip code anywhere in the address string
        const STATE_RE = /,\s+([A-Z]{2})\s+\d{5}/;

        let rows;
        try {
            rows = await query.all(
                `SELECT buyer_address, platform, sale_price, net_profit
                 FROM sales
                 WHERE user_id = ? AND status != 'cancelled'`,
                [user.id]
            );
        } catch (err) {
            return { status: 500, data: { error: 'Failed to load geography data' } };
        }

        // Aggregate into a map keyed by state code or platform fallback key
        const buckets = new Map();

        for (const row of rows) {
            const match = row.buyer_address ? STATE_RE.exec(row.buyer_address) : null;
            let key, region, state;

            if (match && STATE_NAMES[match[1]]) {
                state = match[1];
                region = STATE_NAMES[state];
                key = state;
            } else {
                // No parseable state — group under platform label
                const platform = row.platform || 'Unknown';
                key = `platform:${platform}`;
                state = null;
                region = platform;
            }

            if (!buckets.has(key)) {
                buckets.set(key, { region, state, views: 0, sales: 0, revenue: 0 });
            }
            const b = buckets.get(key);
            b.sales += 1;
            b.revenue = Math.round((b.revenue + (row.net_profit ?? row.sale_price ?? 0)) * 100) / 100;
        }

        const geoData = Array.from(buckets.values())
            .sort((a, b) => b.revenue - a.revenue);

        return {
            status: 200,
            data: {
                geography: geoData,
                note: 'State data parsed from buyer_address where available; remaining sales grouped by platform'
            }
        };
    }

    // GET /api/analytics/custom-metrics - List custom metrics
    if (method === 'GET' && path === '/custom-metrics') {
        try {
            const metrics = await query.all('SELECT id, name, metric_a, operation, metric_b, display_format, created_at FROM custom_metrics WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [user.id]);
            return { status: 200, data: { metrics } };
        } catch (err) {
            return { status: 500, data: { error: 'Failed to load custom metrics' } };
        }
    }

    // POST /api/analytics/custom-metrics - Create custom metric
    if (method === 'POST' && path === '/custom-metrics') {
        const { name, metric_a, operation, metric_b, display_format } = ctx.body;
        if (!name || !metric_a || !metric_b) {
            return { status: 400, data: { error: 'Name, metric_a, and metric_b are required' } };
        }
        const id = uuidv4();
        try {
            await query.run(
                'INSERT INTO custom_metrics (id, user_id, name, metric_a, operation, metric_b, display_format) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [id, user.id, name, metric_a, operation || 'divide', metric_b, display_format || 'number']
            );
            return { status: 201, data: { metric: { id, name, metric_a, operation, metric_b, display_format } } };
        } catch (err) {
            return { status: 500, data: { error: 'Failed to create metric' } };
        }
    }

    // DELETE /api/analytics/custom-metrics/:id - Delete custom metric
    if (method === 'DELETE' && path.match(/^\/custom-metrics\/[a-f0-9-]+$/)) {
        try {
            const metricId = path.split('/')[2];
            const result = await query.run('DELETE FROM custom_metrics WHERE id = ? AND user_id = ?', [metricId, user.id]);
            if (result.changes === 0) {
                return { status: 404, data: { error: 'Metric not found' } };
            }
            return { status: 200, data: { message: 'Metric deleted' } };
        } catch (error) {
            logger.error('[Analytics] Analytics delete metric error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to delete metric' } };
        }
    }

    // GET /api/analytics/digest-settings - Get digest settings
    if (method === 'GET' && path === '/digest-settings') {
        try {
            const settings = await query.get('SELECT * FROM analytics_digests WHERE user_id = ?', [user.id]);
            return { status: 200, data: { settings: settings || { frequency: 'weekly', email: '', is_active: false } } };
        } catch (err) {
            return { status: 500, data: { error: 'Failed to load digest settings' } };
        }
    }

    // POST /api/analytics/digest-settings - Save digest settings
    if (method === 'POST' && path === '/digest-settings') {
        const { email, frequency, is_active } = ctx.body;
        const id = uuidv4();
        const now = new Date().toISOString();
        try {
            const existing = await query.get('SELECT id FROM analytics_digests WHERE user_id = ?', [user.id]);
            if (existing) {
                await query.run(
                    'UPDATE analytics_digests SET email = ?, frequency = ?, is_active = ?, updated_at = ? WHERE user_id = ?',
                    [email || '', frequency || 'weekly', is_active ? 1 : 0, now, user.id]
                );
            } else {
                await query.run(
                    'INSERT INTO analytics_digests (id, user_id, email, frequency, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [id, user.id, email || '', frequency || 'weekly', is_active ? 1 : 0, now, now]
                );
            }
            return { status: 200, data: { message: 'Digest settings saved' } };
        } catch (err) {
            return { status: 500, data: { error: 'Failed to save digest settings' } };
        }
    }

    // POST /api/analytics/export - Export analytics data
    if (method === 'POST' && path === '/export') {
        const { type, format = 'json', period } = ctx.body;

        let data;
        switch (type) {
            case 'inventory':
                data = await query.all('SELECT * FROM inventory WHERE user_id = ? AND status != ? LIMIT 10000', [user.id, 'deleted']);
                break;
            case 'sales':
                data = await query.all('SELECT * FROM sales WHERE user_id = ? LIMIT 10000', [user.id]);
                break;
            case 'listings':
                data = await query.all('SELECT * FROM listings WHERE user_id = ? LIMIT 10000', [user.id]);
                break;
            default:
                return { status: 400, data: { error: 'Invalid export type' } };
        }

        // Parse JSON fields
        data.forEach(item => {
            for (const key of ['tags', 'images', 'custom_fields', 'ai_generated_data', 'platform_specific_data', 'settings', 'stats']) {
                if (item[key] && typeof item[key] === 'string') {
                    try {
                        item[key] = JSON.parse(item[key]);
                    } catch (e) {
                        logger.warn(`[Analytics] Failed to parse ${key} for item ${item.id}`);
                        item[key] = ['tags', 'images'].includes(key) ? [] : {};
                    }
                }
            }
        });

        return { status: 200, data: { export: data, count: data.length, type, format } };
    }

    // GET /api/analytics/forecast - Inventory forecasting
    if (method === 'GET' && path === '/forecast') {
        try {
            // Sell-through velocity by category (last 90 days)
            const velocity = await query.all(`
                SELECT i.category,
                    COUNT(DISTINCT i.id) as total_items,
                    COUNT(DISTINCT s.id) as sold_items,
                    ROUND(COUNT(DISTINCT s.id) * 1.0 / NULLIF(COUNT(DISTINCT i.id), 0) * 100, 1) as sell_rate,
                    ROUND(AVG(CASE WHEN s.id IS NOT NULL THEN EXTRACT(EPOCH FROM (s.created_at - i.created_at)) / 86400 END), 1) as avg_days_to_sell,
                    ROUND(COUNT(DISTINCT s.id) * 1.0 / 3, 1) as monthly_velocity,
                    COUNT(DISTINCT CASE WHEN i.status = 'active' THEN i.id END) as active_count,
                    ROUND(SUM(CASE WHEN i.status = 'active' THEN i.cost_price ELSE 0 END), 2) as active_cost_value
                FROM inventory i
                LEFT JOIN sales s ON s.inventory_id = i.id AND s.created_at >= NOW() - INTERVAL '90 days'
                WHERE i.user_id = ?
                GROUP BY i.category
                HAVING total_items > 0
                ORDER BY sell_rate DESC
            `, [user.id]);

            // Compute forecasts
            const forecasts = velocity.map(v => {
                const monthlyVelocity = v.monthly_velocity || 0;
                const activeCount = v.active_count || 0;
                const daysOfSupply = monthlyVelocity > 0 ? Math.round(activeCount / monthlyVelocity * 30) : null;
                const needsRestock = daysOfSupply !== null && daysOfSupply < 30;
                const projectedMonthlySales = Math.round(monthlyVelocity);
                const projectedQuarterlySales = Math.round(monthlyVelocity * 3);

                return {
                    category: v.category || 'Uncategorized',
                    active_count: activeCount,
                    active_value: v.active_cost_value || 0,
                    sell_rate: v.sell_rate || 0,
                    avg_days_to_sell: v.avg_days_to_sell,
                    monthly_velocity: monthlyVelocity,
                    days_of_supply: daysOfSupply,
                    needs_restock: needsRestock,
                    projected_monthly_sales: projectedMonthlySales,
                    projected_quarterly_sales: projectedQuarterlySales,
                    health: daysOfSupply === null ? 'no-data' : daysOfSupply < 14 ? 'critical' : daysOfSupply < 30 ? 'low' : daysOfSupply < 90 ? 'healthy' : 'overstocked'
                };
            });

            // Overall stats
            const totalActive = forecasts.reduce((s, f) => s + f.active_count, 0);
            const totalValue = forecasts.reduce((s, f) => s + f.active_value, 0);
            const restockAlerts = forecasts.filter(f => f.needs_restock).length;
            const overstocked = forecasts.filter(f => f.health === 'overstocked').length;

            return { status: 200, data: { forecasts, overall: { totalActive, totalValue, restockAlerts, overstocked } } };
        } catch (error) {
            logger.error('[Analytics] forecast error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to generate forecast' } };
        }
    }

    // GET /api/analytics/price-suggestions - Age-based price recommendations
    if (method === 'GET' && path === '/price-suggestions') {
        try {
            const items = await query.all(`
                SELECT i.id, i.title, i.sku, i.category, i.brand, i.cost_price, i.list_price, i.status,
                    CAST(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400 AS INTEGER) as days_old,
                    (SELECT COUNT(*) FROM listings WHERE inventory_id = i.id) as listing_count
                FROM inventory i
                WHERE i.user_id = ? AND i.status = 'active'
                    AND CAST(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400 AS INTEGER) >= 30
                ORDER BY CAST(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400 AS INTEGER) DESC
                LIMIT 50
            `, [user.id]);

            const sellThrough = await query.all(`
                SELECT category, COUNT(DISTINCT s.id) * 1.0 / NULLIF(COUNT(DISTINCT i.id), 0) as sell_rate,
                    AVG(CASE WHEN s.id IS NOT NULL THEN EXTRACT(EPOCH FROM (s.created_at - i.created_at)) / 86400 END) as avg_days
                FROM inventory i LEFT JOIN sales s ON s.inventory_id = i.id
                WHERE i.user_id = ? GROUP BY category
            `, [user.id]);
            const rateMap = {};
            for (const s of sellThrough) rateMap[s.category] = { sell_rate: s.sell_rate || 0, avg_days: s.avg_days || 0 };

            const suggestions = items.map(item => {
                const catData = rateMap[item.category] || {};
                const daysOld = item.days_old || 0;
                const costPrice = item.cost_price || 0;
                const listPrice = item.list_price || 0;
                const margin = listPrice > 0 ? (listPrice - costPrice) / listPrice : 0;

                let action = 'hold';
                let suggestedPrice = listPrice;
                let reason = '';

                if (daysOld >= 90 && margin > 0.3) {
                    action = 'price_down';
                    suggestedPrice = Math.round((costPrice + (listPrice - costPrice) * 0.5) * 100) / 100;
                    reason = '90+ days old with good margin — reduce 50% of profit margin';
                } else if (daysOld >= 60 && margin > 0.2) {
                    action = 'price_down';
                    suggestedPrice = Math.round((costPrice + (listPrice - costPrice) * 0.7) * 100) / 100;
                    reason = '60+ days old — reduce 30% of profit margin';
                } else if (daysOld >= 30 && (catData.sell_rate || 0) < 0.2) {
                    action = 'price_down';
                    suggestedPrice = Math.round(listPrice * 0.9 * 100) / 100;
                    reason = 'Low category sell-through (<20%) — suggest 10% reduction';
                } else if (daysOld >= 30 && (catData.sell_rate || 0) > 0.6 && margin < 0.4) {
                    action = 'price_up';
                    suggestedPrice = Math.round(listPrice * 1.1 * 100) / 100;
                    reason = 'High demand category (>60% sell-through) — room to increase 10%';
                }

                if (action === 'hold') reason = 'Pricing appears reasonable for current age and market';

                return {
                    ...item,
                    action,
                    suggested_price: suggestedPrice,
                    price_change: suggestedPrice - listPrice,
                    reason,
                    category_sell_rate: Math.round((catData.sell_rate || 0) * 100)
                };
            }).filter(s => s.action !== 'hold');

            return { status: 200, data: { suggestions, total: suggestions.length } };
        } catch (error) {
            logger.error('[Analytics] price suggestions error', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to generate price suggestions' } };
        }
    }

    // POST /api/analytics/apply-price-suggestions - Batch update prices from suggestions
    if (method === 'POST' && path === '/apply-price-suggestions') {
        const { items } = ctx.body;
        if (!Array.isArray(items) || items.length === 0) {
            return { status: 400, data: { error: 'items array required (each with id and suggested_price)' } };
        }
        try {
            let updated = 0;
            const validItems = items.filter(item => item.id && item.suggested_price != null);
            await query.transaction(async () => {
                if (validItems.length === 0) return;

                // Batch-fetch all inventory items in one query instead of N+1
                const placeholders = validItems.map(() => '?').join(',');
                const existingRows = await query.all(
                    `SELECT id FROM inventory WHERE id IN (${placeholders}) AND user_id = ?`,
                    [...validItems.map(i => i.id), user.id]
                );
                const existingIds = new Set(existingRows.map(r => r.id));

                for (const item of validItems) {
                    if (!existingIds.has(item.id)) continue;
                    await query.run('UPDATE inventory SET list_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                        [item.suggested_price, item.id, user.id]);

                    try {
                        await query.run(`INSERT INTO price_history (id, inventory_id, user_id, old_price, new_price, change_reason)
                            VALUES (?, ?, ?, ?, ?, ?)`,
                            [uuidv4(), item.id, user.id, item.current_price || 0, item.suggested_price, 'auto_suggestion']);
                    } catch (_) { /* price_history table may not exist */ }

                    updated++;
                }
            });
            return { status: 200, data: { updated, message: `Updated ${updated} item prices` } };
        } catch (error) {
            logger.error('[Analytics] apply price suggestions failed', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to apply price suggestions' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
