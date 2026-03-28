// Market Data Service for VaultLister
// Generates competitor data and market intelligence

import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'node:crypto';
import { query } from '../db/database.js';

// Cryptographically secure random helpers (replaces Math.random())
function secureRandomFloat() {
    return crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000; // lgtm[js/biased-cryptographic-random] -- used for simulation jitter, not security
}
function secureRandomInt(max) {
    return randomInt(max);
}


// Category market data
const CATEGORY_DATA = {
    'Clothing': { saturation: 75, opportunity: 45, avgPrice: 42, avgDaysToSell: 12 },
    'Shoes': { saturation: 65, opportunity: 55, avgPrice: 85, avgDaysToSell: 15 },
    'Bags': { saturation: 55, opportunity: 65, avgPrice: 95, avgDaysToSell: 18 },
    'Accessories': { saturation: 60, opportunity: 55, avgPrice: 35, avgDaysToSell: 10 },
    'Electronics': { saturation: 70, opportunity: 50, avgPrice: 125, avgDaysToSell: 8 },
    'Home': { saturation: 50, opportunity: 60, avgPrice: 65, avgDaysToSell: 20 },
    'Collectibles': { saturation: 45, opportunity: 70, avgPrice: 150, avgDaysToSell: 25 },
    'Vintage': { saturation: 40, opportunity: 75, avgPrice: 55, avgDaysToSell: 14 }
};

/**
 * Get competitors for a platform from the database
 * @param {string} platform - Platform name
 * @param {string} userId - User ID
 * @returns {Array} Competitor rows
 */
export async function getCompetitorsForPlatform(platform, userId) {
    if (!userId) return [];
    try {
        return await query.all(
            'SELECT * FROM competitors WHERE user_id = ? AND platform = ? AND is_active = TRUE ORDER BY listing_count DESC',
            [userId, platform.toLowerCase()]
        );
    } catch {
        return [];
    }
}

/**
 * Convert scraped Poshmark closet listings into competitor_listings DB rows.
 * Returns normalized listing objects ready to INSERT — does not write to DB itself.
 * @param {string} competitorId
 * @param {Array} scrapedListings - Raw results from PoshmarkBot.getClosetListings()
 * @returns {Array}
 */
export function normalizeScrapedListings(competitorId, scrapedListings) {
    return scrapedListings
        .filter(l => l.title)
        .map((l, i) => {
            const rawPrice = parseFloat((l.price || '').replace(/[^0-9.]/g, '')) || 0;
            // Derive a stable external_id from the listing URL path; fall back to index
            const urlPath = l.listingUrl ? l.listingUrl.replace(/.*\/listing\//, '') : null;
            const externalId = urlPath || `closet-${competitorId}-${i}`;
            return {
                id: uuidv4(),
                competitor_id: competitorId,
                external_id: externalId,
                title: l.title,
                price: rawPrice,
                original_price: null,
                category: null,
                brand: null,
                condition: null,
                listed_at: new Date().toISOString(),
                sold_at: null,
                days_to_sell: null,
                url: l.listingUrl || null,
                image_url: l.imageUrl || null,
                created_at: new Date().toISOString()
            };
        });
}

/**
 * Get market insights for a category
 * @param {string} category - Category name
 * @param {Object} options - Options (platform, brand, etc.)
 * @returns {Object} Market insight
 */
export function getMarketInsight(category, options = {}) {
    const baseData = CATEGORY_DATA[category] || CATEGORY_DATA['Clothing'];

    // Apply platform-specific adjustments
    let platformMultiplier = 1.0;
    if (options.platform === 'grailed') platformMultiplier = 1.5;
    else if (options.platform === 'poshmark') platformMultiplier = 0.9;
    else if (options.platform === 'depop') platformMultiplier = 0.85;

    // Apply brand-specific adjustments
    let brandMultiplier = 1.0;
    if (options.brand) {
        const premiumBrands = ['gucci', 'louis vuitton', 'chanel', 'prada', 'supreme'];
        if (premiumBrands.some(b => options.brand.toLowerCase().includes(b))) {
            brandMultiplier = 2.5;
        }
    }

    const avgPrice = Math.round(baseData.avgPrice * platformMultiplier * brandMultiplier);

    return {
        id: uuidv4(),
        category,
        subcategory: options.subcategory || null,
        brand: options.brand || null,
        platform: options.platform || null,
        saturation_score: baseData.saturation + (secureRandomFloat() - 0.5) * 10,
        opportunity_score: baseData.opportunity + (secureRandomFloat() - 0.5) * 10,
        avg_price: avgPrice,
        price_range_low: Math.round(avgPrice * 0.6),
        price_range_high: Math.round(avgPrice * 1.8),
        avg_days_to_sell: baseData.avgDaysToSell,
        listing_count: Math.floor(1000 + secureRandomFloat() * 9000),
        demand_trend: determineDemandTrend(baseData.opportunity),
        competition_level: determineCompetitionLevel(baseData.saturation),
        recommended_price_range: `$${Math.round(avgPrice * 0.8)}-$${Math.round(avgPrice * 1.2)}`,
        insights_json: JSON.stringify(generateInsightsDetails(category, options)),
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
    };
}

/**
 * Find market opportunities
 * @param {string} userId - User ID
 * @param {Object} options - Filter options
 * @returns {Array} Opportunity recommendations
 */
export function findOpportunities(userId, options = {}) {
    const opportunities = [];

    // Analyze each category
    for (const [category, data] of Object.entries(CATEGORY_DATA)) {
        if (data.opportunity >= 60) {
            opportunities.push({
                category,
                opportunity_score: data.opportunity,
                reason: data.opportunity >= 70
                    ? 'High demand, lower competition'
                    : 'Growing demand trend',
                avg_price: data.avgPrice,
                avg_days_to_sell: data.avgDaysToSell,
                recommendation: `Consider sourcing more ${category.toLowerCase()} items`
            });
        }
    }

    // Sort by opportunity score
    opportunities.sort((a, b) => b.opportunity_score - a.opportunity_score);

    return opportunities.slice(0, options.limit || 5);
}

/**
 * Compare item price against the user's own sale history for the same category/brand.
 * Falls back to competitor_listings prices if personal history is thin (<3 data points).
 * @param {Object} item - Inventory row (must include user_id, category, brand, list_price)
 * @param {string} platform - Platform filter (optional)
 * @returns {Object} Price comparison data
 */
export async function comparePricesWithCompetitors(item, platform) {
    const yourPrice = item.list_price || 0;
    const category = item.category || null;
    const brand = item.brand || null;
    const userId = item.user_id;

    // Build a query against sold items in the user's own history with matching category/brand
    let historyRows = [];
    try {
        const params = [userId];
        let whereClauses = "s.user_id = ? AND s.sale_price > 0";

        if (category) {
            whereClauses += ' AND LOWER(i.category) = LOWER(?)';
            params.push(category);
        }
        if (brand) {
            whereClauses += ' AND LOWER(i.brand) = LOWER(?)';
            params.push(brand);
        }
        if (platform) {
            whereClauses += ' AND LOWER(s.platform) = LOWER(?)';
            params.push(platform);
        }

        historyRows = await query.all(`
            SELECT s.sale_price
            FROM sales s
            JOIN inventory i ON i.id = s.inventory_id
            WHERE ${whereClauses}
            ORDER BY s.created_at DESC
            LIMIT 50
        `, params);
    } catch {
        historyRows = [];
    }

    // If personal history is thin, fall back to competitor_listings for the user's tracked competitors
    if (historyRows.length < 3) {
        try {
            const params = [userId];
            let extra = '';
            if (platform) {
                extra = ' AND LOWER(c.platform) = LOWER(?)';
                params.push(platform);
            }
            const competitorRows = await query.all(`
                SELECT cl.price as sale_price
                FROM competitor_listings cl
                JOIN competitors c ON c.id = cl.competitor_id
                WHERE c.user_id = ?${extra} AND cl.price > 0
                ORDER BY cl.created_at DESC
                LIMIT 50
            `, params);
            historyRows = historyRows.concat(competitorRows);
        } catch {
            // no competitor data either
        }
    }

    if (historyRows.length === 0) {
        return {
            your_price: yourPrice,
            avg_comparable_price: null,
            min_comparable_price: null,
            max_comparable_price: null,
            price_position: 'unknown',
            percent_difference: null,
            data_points: 0,
            recommendation: 'No sale history found for this category/brand. Price based on your own judgment.'
        };
    }

    const prices = historyRows.map(r => r.sale_price).sort((a, b) => a - b);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const percentDiff = avg > 0 ? ((yourPrice - avg) / avg) * 100 : 0;

    let position = 'competitive';
    if (percentDiff > 20) position = 'above_market';
    else if (percentDiff < -20) position = 'below_market';

    return {
        your_price: yourPrice,
        avg_comparable_price: Math.round(avg * 100) / 100,
        min_comparable_price: prices[0],
        max_comparable_price: prices[prices.length - 1],
        price_position: position,
        percent_difference: Math.round(percentDiff * 10) / 10,
        data_points: prices.length,
        recommendation: position === 'above_market'
            ? 'Consider lowering price for faster sale'
            : position === 'below_market'
            ? 'You may be leaving money on the table'
            : 'Your price is competitive'
    };
}

/**
 * Get trending categories
 * @param {string} platform - Optional platform filter
 * @returns {Array} Trending categories
 */
export function getTrendingCategories(platform = null) {
    const trending = Object.entries(CATEGORY_DATA)
        .map(([category, data]) => ({
            category,
            trend_score: data.opportunity,
            avg_price: data.avgPrice,
            demand: data.opportunity >= 60 ? 'rising' : data.opportunity >= 40 ? 'stable' : 'falling'
        }))
        .sort((a, b) => b.trend_score - a.trend_score);

    return trending.slice(0, 5);
}

// Helper functions

function inferCategoryFocus(username) {
    const lower = username.toLowerCase();
    if (lower.includes('vintage')) return 'Vintage';
    if (lower.includes('sneaker') || lower.includes('shoe')) return 'Shoes';
    if (lower.includes('designer') || lower.includes('archive')) return 'Designer';
    if (lower.includes('tech')) return 'Electronics';
    if (lower.includes('home')) return 'Home';
    if (lower.includes('y2k')) return 'Y2K Fashion';
    return 'General';
}

function determineDemandTrend(opportunity) {
    if (opportunity >= 65) return 'rising';
    if (opportunity >= 45) return 'stable';
    return 'falling';
}

function determineCompetitionLevel(saturation) {
    if (saturation >= 70) return 'high';
    if (saturation >= 45) return 'medium';
    return 'low';
}

function generateInsightsDetails(category, options) {
    return {
        best_time_to_list: {
            day: ['Thursday', 'Friday', 'Sunday'][secureRandomInt(3)],
            time: ['morning', 'evening'][secureRandomInt(2)]
        },
        hot_keywords: generateHotKeywords(category),
        price_sweet_spot: '45-85',
        buyer_demographics: {
            primary_age: '25-34',
            secondary_age: '18-24'
        }
    };
}

function generateHotKeywords(category) {
    const keywords = {
        'Clothing': ['vintage', 'y2k', 'cottagecore', 'oversized', 'minimal'],
        'Shoes': ['chunky', 'platform', 'rare', 'OG', 'deadstock'],
        'Bags': ['crossbody', 'mini', 'vintage', 'leather', 'designer'],
        'Accessories': ['gold', 'layered', 'chunky', 'vintage', 'statement'],
        'Electronics': ['mint', 'bundle', 'tested', 'working', 'rare'],
        'Vintage': ['70s', '80s', '90s', 'retro', 'authentic']
    };
    return keywords[category] || ['trending', 'popular', 'rare'];
}

export default {
    getCompetitorsForPlatform,
    normalizeScrapedListings,
    getMarketInsight,
    findOpportunities,
    comparePricesWithCompetitors,
    getTrendingCategories
};
