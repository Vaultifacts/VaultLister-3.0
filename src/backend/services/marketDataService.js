// Market Data Service for VaultLister
// Generates competitor data and market intelligence

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';

// Cryptographically secure random helpers (replaces Math.random())
function secureRandomFloat() {
    return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967295;
}
function secureRandomInt(max) {
    return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

// Mock competitor data for demo purposes
const MOCK_COMPETITORS = {
    poshmark: [
        { username: 'vintage_queen_shop', displayName: 'Vintage Queen', avgPrice: 48, listingCount: 234, sellThrough: 0.42 },
        { username: 'designer_deals_daily', displayName: 'Designer Deals', avgPrice: 125, listingCount: 156, sellThrough: 0.38 },
        { username: 'thrift_flip_pro', displayName: 'Thrift Flip Pro', avgPrice: 35, listingCount: 412, sellThrough: 0.55 }
    ],
    ebay: [
        { username: 'sneaker_vault_usa', displayName: 'Sneaker Vault', avgPrice: 145, listingCount: 89, sellThrough: 0.48 },
        { username: 'collectibles_corner', displayName: 'Collectibles Corner', avgPrice: 67, listingCount: 523, sellThrough: 0.35 },
        { username: 'tech_resale_hub', displayName: 'Tech Resale Hub', avgPrice: 189, listingCount: 178, sellThrough: 0.41 }
    ],
    mercari: [
        { username: 'everyday_deals', displayName: 'Everyday Deals', avgPrice: 28, listingCount: 345, sellThrough: 0.52 },
        { username: 'home_finds_shop', displayName: 'Home Finds', avgPrice: 42, listingCount: 267, sellThrough: 0.44 }
    ],
    depop: [
        { username: 'y2k_aesthetic', displayName: 'Y2K Aesthetic', avgPrice: 32, listingCount: 189, sellThrough: 0.58 },
        { username: 'vintage_streetwear', displayName: 'Vintage Streetwear', avgPrice: 55, listingCount: 134, sellThrough: 0.51 }
    ],
    grailed: [
        { username: 'archive_menswear', displayName: 'Archive Menswear', avgPrice: 285, listingCount: 67, sellThrough: 0.35 },
        { username: 'designer_archive', displayName: 'Designer Archive', avgPrice: 445, listingCount: 45, sellThrough: 0.28 }
    ]
};

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
 * Get competitors for a platform
 * @param {string} platform - Platform name
 * @param {string} userId - User ID for personalization
 * @returns {Array} Competitor data
 */
export function getCompetitorsForPlatform(platform, userId = null) {
    const mockData = MOCK_COMPETITORS[platform.toLowerCase()] || [];

    return mockData.map(comp => ({
        id: uuidv4(),
        platform,
        username: comp.username,
        displayName: comp.displayName,
        profile_url: `https://${platform.toLowerCase()}.com/closet/${comp.username}`,
        avg_price: comp.avgPrice,
        listing_count: comp.listingCount,
        sell_through_rate: comp.sellThrough,
        category_focus: inferCategoryFocus(comp.username),
        last_checked_at: new Date().toISOString()
    }));
}

/**
 * Generate competitor listings (mock data)
 * @param {string} competitorId - Competitor ID
 * @param {number} count - Number of listings to generate
 * @returns {Array} Competitor listings
 */
export function generateCompetitorListings(competitorId, count = 10) {
    const listings = [];
    const categories = ['Clothing', 'Shoes', 'Bags', 'Accessories', 'Vintage'];
    const brands = ['Nike', 'Coach', 'Free People', 'Levi\'s', 'Supreme', 'Vintage', 'Anthropologie'];
    const conditions = ['New', 'Like New', 'Good', 'Fair'];

    for (let i = 0; i < count; i++) {
        const basePrice = 20 + secureRandomFloat() * 180;
        const isSold = secureRandomFloat() > 0.6;
        const daysAgo = secureRandomInt(60) + 1;
        const category = categories[secureRandomInt(categories.length)];
        const brand = brands[secureRandomInt(brands.length)];

        listings.push({
            id: uuidv4(),
            competitor_id: competitorId,
            external_id: `listing-${Date.now()}-${i}`,
            title: `${brand} ${category} Item`,
            price: Math.round(basePrice * 100) / 100,
            original_price: Math.round(basePrice * 1.2 * 100) / 100,
            category,
            brand,
            condition: conditions[secureRandomInt(conditions.length)],
            listed_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
            sold_at: isSold ? new Date(Date.now() - Math.floor(daysAgo / 2) * 24 * 60 * 60 * 1000).toISOString() : null,
            days_to_sell: isSold ? Math.floor(daysAgo / 2) : null,
            created_at: new Date().toISOString()
        });
    }

    return listings;
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
 * Compare prices with competitors
 * @param {Object} item - Inventory item
 * @param {string} platform - Platform to compare on
 * @returns {Object} Price comparison data
 */
export function comparePricesWithCompetitors(item, platform) {
    const category = item.category || 'Clothing';
    const baseData = CATEGORY_DATA[category] || CATEGORY_DATA['Clothing'];

    // Generate mock competitor prices
    const competitorPrices = [];
    const count = 5 + secureRandomInt(10);

    for (let i = 0; i < count; i++) {
        const variance = (secureRandomFloat() - 0.5) * 0.5;
        competitorPrices.push(Math.round(baseData.avgPrice * (1 + variance) * 100) / 100);
    }

    competitorPrices.sort((a, b) => a - b);
    const yourPrice = item.list_price || baseData.avgPrice;
    const avgCompetitorPrice = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;

    let position = 'competitive';
    let percentDiff = ((yourPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;

    if (percentDiff > 20) position = 'above_market';
    else if (percentDiff < -20) position = 'below_market';

    return {
        your_price: yourPrice,
        avg_competitor_price: Math.round(avgCompetitorPrice * 100) / 100,
        min_competitor_price: Math.min(...competitorPrices),
        max_competitor_price: Math.max(...competitorPrices),
        price_position: position,
        percent_difference: Math.round(percentDiff * 10) / 10,
        competitor_count: competitorPrices.length,
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
    generateCompetitorListings,
    getMarketInsight,
    findOpportunities,
    comparePricesWithCompetitors,
    getTrendingCategories
};
