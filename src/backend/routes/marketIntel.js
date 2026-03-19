// Market Intelligence Router for VaultLister
// Competitor tracking and market insights

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import {
    getCompetitorsForPlatform,
    generateCompetitorListings,
    getMarketInsight,
    findOpportunities,
    comparePricesWithCompetitors,
    getTrendingCategories
} from '../services/marketDataService.js';
import { logger } from '../shared/logger.js';

export async function marketIntelRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // Helper: require authentication
    const requireAuth = () => {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        return null;
    };

    // GET /market-intel/competitors - List tracked competitors
    if (method === 'GET' && path === '/competitors') {
        const authError = requireAuth();
        if (authError) return authError;

        const platform = queryParams.platform;

        let sql = `
            SELECT * FROM competitors
            WHERE user_id = ? AND is_active = 1
        `;
        const params = [user.id];

        if (platform) {
            sql += ' AND platform = ?';
            params.push(platform);
        }

        sql += ' ORDER BY listing_count DESC LIMIT 500';

        try {
            const competitors = query.all(sql, params);
            return { status: 200, data: competitors };
        } catch (error) {
            logger.error('[MarketIntel] Error fetching competitors', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch competitors' } };
        }
    }

    // POST /market-intel/competitors - Add competitor to track
    if (method === 'POST' && path === '/competitors') {
        const authError = requireAuth();
        if (authError) return authError;

        const { platform, username, profile_url, category_focus, notes } = body;

        if (!platform || !username) {
            return { status: 400, data: { error: 'Platform and username are required' } };
        }

        const competitorId = uuidv4();

        try {
            query.run(`
                INSERT INTO competitors (id, user_id, platform, username, profile_url,
                    category_focus, notes, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            `, [competitorId, user.id, platform, username, profile_url || null,
                category_focus || null, notes || null]);

            const competitor = query.get('SELECT * FROM competitors WHERE id = ?', [competitorId]);
            return { status: 201, data: competitor };
        } catch (error) {
            if (error.message.includes('UNIQUE')) {
                return { status: 400, data: { error: 'Competitor already tracked' } };
            }
            throw error;
        }
    }

    // GET /market-intel/competitors/:id - Get competitor details
    const competitorIdMatch = path.match(/^\/competitors\/([^/]+)$/);
    if (method === 'GET' && competitorIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const competitorId = competitorIdMatch[1];

        try {
            const competitor = query.get(`
                SELECT * FROM competitors WHERE id = ? AND user_id = ?
            `, [competitorId, user.id]);

            if (!competitor) {
                return { status: 404, data: { error: 'Competitor not found' } };
            }

            // Get their listings
            const listings = query.all(`
                SELECT * FROM competitor_listings
                WHERE competitor_id = ?
                ORDER BY listed_at DESC
                LIMIT 50
            `, [competitorId]);

            competitor.listings = listings;

            return { status: 200, data: competitor };
        } catch (error) {
            return { status: 404, data: { error: 'Competitor not found' } };
        }
    }

    // DELETE /market-intel/competitors/:id - Stop tracking competitor
    if (method === 'DELETE' && competitorIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const competitorId = competitorIdMatch[1];

        const competitor = query.get('SELECT id FROM competitors WHERE id = ? AND user_id = ?', [competitorId, user.id]);
        if (!competitor) return { status: 404, data: { error: 'Competitor not found' } };

        query.transaction(() => {
            query.run('DELETE FROM competitor_listings WHERE competitor_id = ?', [competitorId]);
            query.run('DELETE FROM competitors WHERE id = ? AND user_id = ?', [competitorId, user.id]);
        });

        return { status: 200, data: { deleted: true } };
    }

    // GET /market-intel/competitors/:id/listings - Get competitor's listings
    const competitorListingsMatch = path.match(/^\/competitors\/([^/]+)\/listings$/);
    if (method === 'GET' && competitorListingsMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const competitorId = competitorListingsMatch[1];
        const sold = queryParams.sold === 'true';

        // Verify ownership of competitor before listing their data
        const ownerCheck = query.get(
            'SELECT id FROM competitors WHERE id = ? AND user_id = ?',
            [competitorId, user.id]
        );
        if (!ownerCheck) {
            return { status: 404, data: { error: 'Competitor not found' } };
        }

        try {
            let sql = `
                SELECT * FROM competitor_listings
                WHERE competitor_id = ?
            `;
            const params = [competitorId];

            if (sold) {
                sql += ' AND sold_at IS NOT NULL';
            } else if (queryParams.sold === 'false') {
                sql += ' AND sold_at IS NULL';
            }

            sql += ' ORDER BY listed_at DESC LIMIT 100';

            const listings = query.all(sql, params);
            return { status: 200, data: listings };
        } catch (error) {
            logger.error('[MarketIntel] Error fetching competitor listings', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch competitor listings' } };
        }
    }

    // POST /market-intel/competitors/:id/refresh - Refresh competitor data
    const refreshMatch = path.match(/^\/competitors\/([^/]+)\/refresh$/);
    if (method === 'POST' && refreshMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const competitorId = refreshMatch[1];

        // Verify ownership
        const ownerCheck = query.get(
            'SELECT id FROM competitors WHERE id = ? AND user_id = ?',
            [competitorId, user.id]
        );
        if (!ownerCheck) {
            return { status: 404, data: { error: 'Competitor not found' } };
        }

        // Update last_checked_at
        query.run(`
            UPDATE competitors SET last_checked_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ? AND user_id = ?
        `, [competitorId, user.id]);

        // Generate new mock listings
        const listings = generateCompetitorListings(competitorId, 5);

        // Insert new listings in a single transaction
        try {
            query.transaction(() => {
                for (const listing of listings) {
                    query.run(`
                        INSERT OR REPLACE INTO competitor_listings (id, competitor_id, external_id, title,
                            price, original_price, category, brand, condition, listed_at, sold_at, url, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    `, [listing.id, competitorId, listing.external_id, listing.title, listing.price,
                        listing.original_price, listing.category, listing.brand, listing.condition,
                        listing.listed_at, listing.sold_at, listing.url]);
                }
            });
        } catch (error) {
            logger.error('[MarketIntel] Competitor listing insert failed', user?.id, { competitorId, detail: error?.message });
        }

        return {
            status: 200,
            data: {
                refreshed: true,
                new_listings: listings.length
            }
        };
    }

    // GET /market-intel/insights - Get market insights
    if (method === 'GET' && path === '/insights') {
        const authError = requireAuth();
        if (authError) return authError;

        const category = queryParams.category;
        const platform = queryParams.platform;

        try {
            let sql = `
                SELECT * FROM market_insights
                WHERE (user_id = ? OR user_id IS NULL)
                AND (valid_until IS NULL OR valid_until > datetime('now'))
            `;
            const params = [user.id];

            if (category) {
                sql += ' AND category = ?';
                params.push(category);
            }

            if (platform) {
                sql += ' AND platform = ?';
                params.push(platform);
            }

            sql += ' ORDER BY opportunity_score DESC LIMIT 20';

            const insights = query.all(sql, params);

            if (insights.length > 0) {
                // Parse JSON fields
                return {
                    status: 200,
                    data: insights.map(i => ({
                        ...i,
                        insights_json: i.insights_json ? JSON.parse(i.insights_json) : null
                    }))
                };
            }
        } catch (error) {
            // Table doesn't exist, fall through to generate
        }

        // Generate insights on the fly
        const categories = category ? [category] : ['Clothing', 'Shoes', 'Bags', 'Accessories', 'Vintage'];
        const generatedInsights = categories.map(cat => getMarketInsight(cat, { platform }));

        return { status: 200, data: generatedInsights };
    }

    // POST /market-intel/insights/:category - Generate insight for category
    const insightCatMatch = path.match(/^\/insights\/([^/]+)$/);
    if (method === 'POST' && insightCatMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const category = decodeURIComponent(insightCatMatch[1]);
        const { platform, brand, subcategory } = body;

        const insight = getMarketInsight(category, { platform, brand, subcategory });

        // Store insight
        try {
            query.run(`
                INSERT INTO market_insights (id, user_id, category, subcategory, brand, platform,
                    saturation_score, opportunity_score, avg_price, price_range_low, price_range_high,
                    avg_days_to_sell, listing_count, demand_trend, competition_level,
                    recommended_price_range, insights_json, valid_until, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                insight.id, user.id, insight.category, insight.subcategory, insight.brand,
                insight.platform, insight.saturation_score, insight.opportunity_score,
                insight.avg_price, insight.price_range_low, insight.price_range_high,
                insight.avg_days_to_sell, insight.listing_count, insight.demand_trend,
                insight.competition_level, insight.recommended_price_range,
                insight.insights_json, insight.valid_until
            ]);
        } catch (error) {
            logger.error('[MarketIntel] Market insight insert failed', user?.id, { category: insight?.category, detail: error?.message });
        }

        return { status: 200, data: insight };
    }

    // GET /market-intel/opportunities - Find sourcing opportunities
    if (method === 'GET' && path === '/opportunities') {
        const authError = requireAuth();
        if (authError) return authError;

        const limit = Math.min(parseInt(queryParams.limit) || 5, 100);
        const opportunities = findOpportunities(user.id, { limit });

        return { status: 200, data: opportunities };
    }

    // POST /market-intel/compare-price - Compare item price with market
    if (method === 'POST' && path === '/compare-price') {
        const authError = requireAuth();
        if (authError) return authError;

        const { inventory_id, platform } = body;

        if (!inventory_id) {
            return { status: 400, data: { error: 'inventory_id required' } };
        }

        const item = query.get(
            'SELECT * FROM inventory WHERE id = ? AND user_id = ?',
            [inventory_id, user.id]
        );

        if (!item) {
            return { status: 404, data: { error: 'Item not found' } };
        }

        const comparison = comparePricesWithCompetitors(item, platform || 'ebay');

        return { status: 200, data: comparison };
    }

    // GET /market-intel/trending - Get trending categories
    if (method === 'GET' && path === '/trending') {
        const authError = requireAuth();
        if (authError) return authError;

        const platform = queryParams.platform;
        const trending = getTrendingCategories(platform);

        return { status: 200, data: trending };
    }

    // GET /market-intel/platforms - Get supported platforms
    if (method === 'GET' && path === '/platforms') {
        return {
            status: 200,
            data: [
                { id: 'poshmark', name: 'Poshmark', color: '#7f0353' },
                { id: 'ebay', name: 'eBay', color: '#e53238' },
                { id: 'mercari', name: 'Mercari', color: '#4dc7ec' },
                { id: 'depop', name: 'Depop', color: '#ff2300' },
                { id: 'grailed', name: 'Grailed', color: '#000000' },
                { id: 'facebook', name: 'Facebook Marketplace', color: '#1877f2' }
            ]
        };
    }

    // GET /market-intel/stats - Get market intel statistics
    if (method === 'GET' && path === '/stats') {
        const authError = requireAuth();
        if (authError) return authError;

        try {
            const competitorStats = query.get(`
                SELECT COUNT(*) as count FROM competitors WHERE user_id = ? AND is_active = 1
            `, [user.id]);

            const listingStats = query.get(`
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN sold_at IS NOT NULL THEN 1 END) as sold
                FROM competitor_listings cl
                JOIN competitors c ON cl.competitor_id = c.id
                WHERE c.user_id = ?
            `, [user.id]);

            const insightStats = query.get(`
                SELECT
                    AVG(opportunity_score) as avg_opportunity,
                    AVG(saturation_score) as avg_saturation
                FROM market_insights
                WHERE user_id = ?
                AND (valid_until IS NULL OR valid_until > datetime('now'))
            `, [user.id]);

            return {
                status: 200,
                data: {
                    competitors_tracked: competitorStats?.count || 0,
                    listings_tracked: listingStats?.total || 0,
                    listings_sold: listingStats?.sold || 0,
                    avg_opportunity_score: Math.round((insightStats?.avg_opportunity || 55) * 10) / 10,
                    avg_saturation_score: Math.round((insightStats?.avg_saturation || 60) * 10) / 10
                }
            };
        } catch (error) {
            logger.error('[MarketIntel] Error fetching market intel stats', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch market intel stats' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
