// Pricing Engine Service for VaultLister
// Generates price predictions and recommendations using Claude Haiku + statistical fallback

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { claudePricePrediction, claudeDemandForecast } from '../../shared/ai/predictions-ai.js';

// Cryptographically secure random helpers (replaces Math.random())
function secureRandomFloat() {
    return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967295;
}
function secureRandomInt(max) {
    return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

// Seasonality factors by month (index 0 = January)
const SEASONALITY_FACTORS = {
    clothing: [0.85, 0.80, 0.90, 0.95, 1.00, 0.95, 0.85, 0.90, 1.05, 1.10, 1.20, 1.25],
    shoes: [0.90, 0.85, 0.95, 1.00, 1.05, 1.00, 0.90, 1.05, 1.10, 1.05, 1.15, 1.20],
    electronics: [0.95, 0.90, 0.95, 0.95, 1.00, 1.00, 0.95, 1.00, 1.05, 1.10, 1.25, 1.30],
    home: [0.85, 0.85, 0.95, 1.00, 1.05, 1.00, 0.95, 0.95, 1.00, 1.05, 1.15, 1.10],
    accessories: [0.90, 0.95, 0.95, 1.00, 1.05, 1.00, 0.95, 1.00, 1.05, 1.05, 1.15, 1.20],
    default: [0.95, 0.90, 0.95, 1.00, 1.00, 1.00, 0.95, 1.00, 1.05, 1.05, 1.15, 1.15]
};

// Condition multipliers
const CONDITION_MULTIPLIERS = {
    'new': 1.0,
    'new_with_tags': 1.0,
    'like_new': 0.92,
    'excellent': 0.85,
    'good': 0.75,
    'fair': 0.60,
    'poor': 0.40
};

/**
 * Generate price prediction for an inventory item
 * @param {string} inventoryId - Inventory item ID
 * @param {string} userId - User ID
 * @param {Object} options - Prediction options
 * @returns {Object} Price prediction
 */
export async function generatePricePrediction(inventoryId, userId, options = {}) {
    const item = query.get(`
        SELECT * FROM inventory WHERE id = ? AND user_id = ?
    `, [inventoryId, userId]);

    if (!item) {
        throw new Error('Inventory item not found');
    }

    // Fetch real comparable sales from DB
    const comparables = await findComparableSales(item, options);

    // Get AI-powered prediction (falls back to statistical if API unavailable)
    const aiResult = await claudePricePrediction(item, comparables);

    const predictedPrice = aiResult.predicted_price;
    const demandScore = aiResult.demand_score;
    const seasonalityFactor = getSeasonalityFactor(item.category);

    // Calculate price range from variance in comparables
    const variance = calculateVariance(comparables);
    const priceRangeLow = Math.max(predictedPrice - variance, item.cost_price || 0);
    const priceRangeHigh = predictedPrice + variance;

    const prediction = {
        id: uuidv4(),
        user_id: userId,
        inventory_id: inventoryId,
        predicted_price: predictedPrice,
        confidence: aiResult.confidence / 100,
        price_range_low: priceRangeLow,
        price_range_high: priceRangeHigh,
        demand_score: demandScore,
        recommendation: aiResult.recommendation,
        recommendation_reason: aiResult.recommendation_reason,
        comparable_count: comparables.length,
        avg_days_to_sell: aiResult.avg_days_to_sell,
        seasonality_factor: seasonalityFactor,
        platform: options.platform || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    logger.info('[PricingEngine] Prediction generated', userId, {
        inventory_id: inventoryId,
        source: aiResult.source,
        comparable_count: comparables.length
    });

    // Store prediction
    try {
        query.run(`
            INSERT INTO price_predictions (
                id, user_id, inventory_id, predicted_price, confidence,
                price_range_low, price_range_high, demand_score, recommendation,
                recommendation_reason, comparable_count, avg_days_to_sell,
                seasonality_factor, platform, expires_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            prediction.id, prediction.user_id, prediction.inventory_id,
            prediction.predicted_price, prediction.confidence,
            prediction.price_range_low, prediction.price_range_high,
            prediction.demand_score, prediction.recommendation,
            prediction.recommendation_reason, prediction.comparable_count,
            prediction.avg_days_to_sell, prediction.seasonality_factor,
            prediction.platform, prediction.expires_at,
            prediction.created_at, prediction.updated_at
        ]);
    } catch (err) {
        // Table might not exist
        logger.info('[PricingEngine] Could not store prediction', null, { detail: err.message });
    }

    return prediction;
}

/**
 * Find comparable sales for an item from the user's own sales history (last 90 days).
 * Matches on category first, then falls back to all user sales.
 */
async function findComparableSales(item, options = {}) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    try {
        // Try category-matched sales first
        let sales = query.all(`
            SELECT s.sale_price, s.platform, s.created_at,
                   i.category, i.condition,
                   CAST((julianday(s.created_at) - julianday(s.created_at)) AS INTEGER) AS daysToSell
            FROM sales s
            LEFT JOIN inventory i ON s.inventory_id = i.id
            WHERE s.user_id = ?
              AND s.status IN ('confirmed', 'delivered')
              AND s.created_at >= ?
              AND (i.category = ? OR i.category IS NULL)
            ORDER BY s.created_at DESC
            LIMIT 25
        `, [item.user_id, ninetyDaysAgo, item.category || '']);

        if (sales.length < 3) {
            sales = query.all(`
                SELECT s.sale_price, s.platform, s.created_at,
                       i.category, i.condition
                FROM sales s
                LEFT JOIN inventory i ON s.inventory_id = i.id
                WHERE s.user_id = ?
                  AND s.status IN ('confirmed', 'delivered')
                  AND s.created_at >= ?
                ORDER BY s.created_at DESC
                LIMIT 25
            `, [item.user_id, ninetyDaysAgo]);
        }

        return sales.map(s => ({
            price: Number(s.sale_price) || 0,
            soldDate: new Date(s.created_at || Date.now()),
            daysToSell: 14,
            platform: s.platform || 'unknown',
            condition: s.condition || item.condition || 'good',
            sale_price: Number(s.sale_price) || 0,
            category: s.category || item.category,
            created_at: s.created_at
        }));
    } catch (err) {
        logger.warn('[PricingEngine] Could not fetch comparable sales', null, { detail: err.message });
        return [];
    }
}

/**
 * Calculate base price from comparables
 */
function calculateBasePrice(comparables, item) {
    if (comparables.length === 0) {
        return item.list_price || 50;
    }

    // Use weighted average - more recent sales have higher weight
    const now = Date.now();
    let totalWeight = 0;
    let weightedSum = 0;

    for (const comp of comparables) {
        const daysSinceSale = (now - comp.soldDate.getTime()) / (24 * 60 * 60 * 1000);
        const weight = Math.max(1, 60 - daysSinceSale) / 60; // Higher weight for recent sales
        weightedSum += comp.price * weight;
        totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : (item.list_price || 50);
}

/**
 * Get condition multiplier
 */
function getConditionMultiplier(condition) {
    if (!condition) return 0.85;
    const normalized = condition.toLowerCase().replace(/[^a-z]/g, '_');
    return CONDITION_MULTIPLIERS[normalized] || 0.85;
}

/**
 * Get seasonality factor for current month
 */
function getSeasonalityFactor(category) {
    const month = new Date().getMonth();
    const normalizedCategory = (category || 'default').toLowerCase();

    let factors = SEASONALITY_FACTORS.default;
    if (normalizedCategory.includes('cloth') || normalizedCategory.includes('shirt') ||
        normalizedCategory.includes('dress') || normalizedCategory.includes('pant')) {
        factors = SEASONALITY_FACTORS.clothing;
    } else if (normalizedCategory.includes('shoe') || normalizedCategory.includes('sneaker') ||
               normalizedCategory.includes('boot')) {
        factors = SEASONALITY_FACTORS.shoes;
    } else if (normalizedCategory.includes('electron') || normalizedCategory.includes('tech') ||
               normalizedCategory.includes('phone')) {
        factors = SEASONALITY_FACTORS.electronics;
    } else if (normalizedCategory.includes('home') || normalizedCategory.includes('furniture')) {
        factors = SEASONALITY_FACTORS.home;
    } else if (normalizedCategory.includes('accessor') || normalizedCategory.includes('bag') ||
               normalizedCategory.includes('jewelry')) {
        factors = SEASONALITY_FACTORS.accessories;
    }

    return factors[month];
}

/**
 * Calculate demand score (0-100)
 */
export function calculateDemandScore(item, comparables = []) {
    let score = 50; // Base score

    // Factor 1: Sales velocity (how quickly items sell)
    if (comparables.length > 0) {
        const avgDaysToSell = comparables.reduce((sum, c) => sum + (c.daysToSell || 14), 0) / comparables.length;
        if (avgDaysToSell < 7) score += 20;
        else if (avgDaysToSell < 14) score += 10;
        else if (avgDaysToSell > 30) score -= 10;
    }

    // Factor 2: Number of comparables (more = more demand)
    if (comparables.length >= 10) score += 15;
    else if (comparables.length >= 5) score += 10;
    else if (comparables.length < 3) score -= 10;

    // Factor 3: Seasonality
    const seasonFactor = getSeasonalityFactor(item.category);
    if (seasonFactor > 1.1) score += 15;
    else if (seasonFactor > 1.0) score += 5;
    else if (seasonFactor < 0.9) score -= 10;

    // Factor 4: Price point attractiveness
    const price = item.list_price || 50;
    if (price >= 25 && price <= 100) score += 10; // Sweet spot
    else if (price > 200) score -= 5;

    return Math.max(0, Math.min(100, score));
}

/**
 * Get pricing recommendation
 */
export function getRecommendation(item, predictedPrice, demandScore) {
    const currentPrice = item.list_price || 0;
    const priceDiff = ((predictedPrice - currentPrice) / currentPrice) * 100;
    const daysSinceListed = item.created_at
        ? Math.floor((Date.now() - new Date(item.created_at).getTime()) / (24 * 60 * 60 * 1000))
        : 0;

    // High demand, priced low
    if (demandScore >= 70 && priceDiff > 15) {
        return {
            action: 'price_up',
            reason: `High demand (${demandScore}/100) suggests you could increase price by ${Math.round(priceDiff)}%`
        };
    }

    // Low demand, priced high
    if (demandScore < 40 && priceDiff < -15) {
        return {
            action: 'price_down',
            reason: `Lower demand (${demandScore}/100) - consider reducing price by ${Math.abs(Math.round(priceDiff))}%`
        };
    }

    // Stale listing
    if (daysSinceListed > 30 && demandScore < 60) {
        return {
            action: 'relist',
            reason: `Listed ${daysSinceListed} days ago with moderate demand - try relisting with fresh photos`
        };
    }

    // Price is close to optimal
    if (Math.abs(priceDiff) <= 10 && demandScore >= 50) {
        return {
            action: 'hold',
            reason: `Price is well-optimized (within 10% of market). Demand score: ${demandScore}/100`
        };
    }

    return {
        action: 'hold',
        reason: `Current pricing appears reasonable. Monitor performance.`
    };
}

/**
 * Calculate confidence score (0-1)
 */
function calculateConfidence(comparables, item) {
    if (comparables.length === 0) return 0.3;

    let confidence = 0.5;

    // More comparables = higher confidence
    if (comparables.length >= 10) confidence += 0.25;
    else if (comparables.length >= 5) confidence += 0.15;
    else confidence += comparables.length * 0.03;

    // Lower variance = higher confidence
    const variance = calculateVariance(comparables);
    const avgPrice = comparables.reduce((sum, c) => sum + c.price, 0) / comparables.length;
    const cvPercent = (variance / avgPrice) * 100;

    if (cvPercent < 10) confidence += 0.15;
    else if (cvPercent < 20) confidence += 0.05;
    else if (cvPercent > 40) confidence -= 0.15;

    return Math.max(0.2, Math.min(0.95, confidence));
}

/**
 * Calculate price variance
 */
function calculateVariance(comparables) {
    if (comparables.length < 2) return 10;

    const prices = comparables.map(c => c.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const variance = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / prices.length);

    return Math.round(variance * 100) / 100;
}

/**
 * Calculate average days to sell
 */
function calculateAvgDaysToSell(comparables) {
    if (comparables.length === 0) return 14;

    const total = comparables.reduce((sum, c) => sum + (c.daysToSell || 14), 0);
    return Math.round(total / comparables.length);
}

/**
 * Generate batch predictions for multiple items
 */
export async function generateBatchPredictions(inventoryIds, userId, options = {}) {
    const predictions = [];

    for (const inventoryId of inventoryIds) {
        try {
            const prediction = await generatePricePrediction(inventoryId, userId, options);
            predictions.push(prediction);
        } catch (error) {
            predictions.push({
                inventory_id: inventoryId,
                error: error.message
            });
        }
    }

    return predictions;
}

/**
 * Get demand forecast for a category.
 * When userId is provided, queries the user's 90-day sales and calls Claude Haiku.
 * Falls back to seasonality-based calculation when userId is absent or API is unavailable.
 */
export async function getDemandForecast(category, platform = null, userId = null) {
    const now = new Date();
    const month = now.getMonth();
    const seasonFactor = getSeasonalityFactor(category);

    if (userId) {
        try {
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
            const salesData = query.all(`
                SELECT s.sale_price, s.platform, s.created_at, i.category
                FROM sales s
                LEFT JOIN inventory i ON s.inventory_id = i.id
                WHERE s.user_id = ?
                  AND s.status IN ('confirmed', 'delivered')
                  AND s.created_at >= ?
                ORDER BY s.created_at DESC
                LIMIT 200
            `, [userId, ninetyDaysAgo]);

            if (salesData.length > 0) {
                const forecasts = await claudeDemandForecast(userId, salesData);
                const match = forecasts.find(f =>
                    f.category.toLowerCase() === (category || '').toLowerCase()
                ) || forecasts[0];

                if (match) {
                    return {
                        category: match.category,
                        platform,
                        forecast_date: now.toISOString().split('T')[0],
                        demand_level: match.demand_level,
                        price_trend: match.price_trend,
                        seasonality_index: match.seasonality_index,
                        notes: match.notes,
                        source: match.source
                    };
                }
            }
        } catch (err) {
            logger.warn('[PricingEngine] getDemandForecast AI call failed, using seasonal fallback', null, {
                detail: err.message
            });
        }
    }

    // Seasonal fallback
    let demandLevel = 'medium';
    let priceTrend = 'stable';

    if (seasonFactor >= 1.15) { demandLevel = 'high'; priceTrend = 'rising'; }
    else if (seasonFactor >= 1.05) { demandLevel = 'high'; }
    else if (seasonFactor <= 0.85) { demandLevel = 'low'; priceTrend = 'falling'; }

    return {
        category,
        platform,
        forecast_date: now.toISOString().split('T')[0],
        demand_level: demandLevel,
        price_trend: priceTrend,
        seasonality_index: seasonFactor,
        notes: generateForecastNotes(category, seasonFactor, month),
        source: 'statistical'
    };
}

function generateForecastNotes(category, seasonFactor, month) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    if (seasonFactor >= 1.15) {
        return `${monthNames[month]} is a peak season for ${category}. Consider listing more inventory now.`;
    } else if (seasonFactor <= 0.85) {
        return `${monthNames[month]} typically sees lower demand for ${category}. Consider holding premium items.`;
    }
    return `Market conditions for ${category} are stable in ${monthNames[month]}.`;
}

export default {
    generatePricePrediction,
    generateBatchPredictions,
    calculateDemandScore,
    getRecommendation,
    getDemandForecast
};
