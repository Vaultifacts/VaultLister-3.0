// AI-powered prediction engine — Claude Haiku with statistical fallback
// Used by pricingEngine.js for price, sell-time, and demand forecasts.
// Cache TTL: 30 days via PostgreSQL ai_cache table.

import Anthropic from '@anthropic-ai/sdk';
import Sentry from '../../backend/instrument.js';
import { logger } from '../../backend/shared/logger.js';
import { sanitizeForAI } from './sanitize-input.js';
import { withTimeout } from '../../backend/shared/fetchWithTimeout.js';
import { circuitBreaker } from '../../backend/shared/circuitBreaker.js';
import { query } from '../../backend/db/database.js';
import { getCachedResponse, setCachedResponse } from './embedding-service.js';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

export function invalidatePredictionCache(itemId, userId) {
    query.run('DELETE FROM ai_cache WHERE hash = ?', [`price:${itemId}:${userId}`]).catch(() => {});
}

function getClient() {
    const key = process.env.VAULTLISTER_PREDICTIONS || process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    return new Anthropic({ apiKey: key });
}

/**
 * Ask Claude Haiku for a price prediction for a single inventory item.
 * salesHistory: array of { sale_price, category, platform, created_at }
 * item: { title, brand, category, condition, list_price, cost_price, created_at }
 *
 * Returns { predicted_price, confidence, recommendation, recommendation_reason,
 *           avg_days_to_sell, demand_score, source }
 */
export async function claudePricePrediction(item, salesHistory) {
    const cacheKey = `price:${item.id}:${item.user_id}`;
    const cached = await getCachedResponse(cacheKey);
    if (cached) return { ...cached, source: 'cache' };

    const client = getClient();
    if (client) {
        try {
            const safeName = sanitizeForAI(item.title || 'Unknown item', 100);
            const safeBrand = sanitizeForAI(item.brand || 'Unknown', 80);
            const safeCategory = sanitizeForAI(item.category || 'Clothing', 80);
            const safeCondition = sanitizeForAI(item.condition || 'good', 30);
            const currentPrice = Number(item.list_price) || 0;
            const costPrice = Number(item.cost_price) || 0;

            const recentSales = salesHistory.slice(0, 20).map((s) => ({
                price: Number(s.sale_price).toFixed(2),
                platform: s.platform || 'unknown',
                daysAgo: Math.round((Date.now() - new Date(s.created_at).getTime()) / 86400000),
            }));

            const salesText =
                recentSales.length > 0
                    ? recentSales.map((s) => `$${s.price} on ${s.platform} (${s.daysAgo}d ago)`).join(', ')
                    : 'No recent sales data';

            const userContent = [
                `Item: ${safeName}`,
                `Brand: ${safeBrand}`,
                `Category: ${safeCategory}`,
                `Condition: ${safeCondition}`,
                `Current list price: $${currentPrice.toFixed(2)}`,
                `Cost price: $${costPrice.toFixed(2)}`,
                `Recent comparable sales: ${salesText}`,
            ].join('\n');

            const response = await Sentry.startSpan(
                { name: 'claude.price-prediction', op: 'ai.run', attributes: { model: HAIKU_MODEL } },
                () =>
                    circuitBreaker(
                        'anthropic-price-prediction',
                        () =>
                            withTimeout(
                                client.messages.create({
                                    model: HAIKU_MODEL,
                                    max_tokens: 512,
                                    system: [
                                        'You are an expert resale pricing analyst. Given item details and recent comparable sales,',
                                        'predict the optimal resale price and days to sell. Be concise and data-driven.',
                                        'Respond ONLY with valid JSON in this exact format (no markdown):',
                                        '{"predicted_price":number,"confidence":number_0_to_100,"recommendation":"price_up"|"price_down"|"hold"|"relist",',
                                        '"recommendation_reason":"one sentence","avg_days_to_sell":integer,"demand_score":integer_0_to_100}',
                                    ].join(' '),
                                    messages: [{ role: 'user', content: userContent }],
                                }),
                                20000,
                                'Claude price prediction',
                            ),
                        { failureThreshold: 3, cooldownMs: 60000 },
                    ),
            );

            const raw = response.content[0].text.trim();
            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                const result = {
                    predicted_price: Number(parsed.predicted_price) || currentPrice,
                    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 60)),
                    recommendation: ['price_up', 'price_down', 'hold', 'relist'].includes(parsed.recommendation)
                        ? parsed.recommendation
                        : 'hold',
                    recommendation_reason: String(parsed.recommendation_reason || '').slice(0, 300),
                    avg_days_to_sell: Math.max(1, parseInt(parsed.avg_days_to_sell) || 14),
                    demand_score: Math.min(100, Math.max(0, Number(parsed.demand_score) || 50)),
                };
                await setCachedResponse(cacheKey, result);
                logger.info('[PredictionsAI] Claude price prediction succeeded', null, {
                    item_id: item.id,
                    source: 'claude',
                });
                return { ...result, source: 'claude' };
            }
        } catch (err) {
            logger.warn('[PredictionsAI] Claude price prediction failed, using statistical fallback', {
                error: err.message,
                item_id: item.id,
            });
        }
    }

    return statisticalPriceFallback(item, salesHistory);
}

/**
 * Ask Claude Haiku for demand forecasts across categories based on the user's
 * 90-day sales velocity.
 * salesData: array of { category, sale_price, created_at }
 *
 * Returns array of { category, demand_level, price_trend, seasonality_index,
 *                    notes, source }
 */
export async function claudeDemandForecast(userId, salesData) {
    const cacheKey = `demand:${userId}`;
    const cached = await getCachedResponse(cacheKey);
    if (cached) return cached.map((f) => ({ ...f, source: 'cache' }));

    const client = getClient();

    // Aggregate sales by category
    const byCategory = {};
    for (const sale of salesData) {
        const cat = sale.category || 'Other';
        if (!byCategory[cat]) byCategory[cat] = { count: 0, totalRevenue: 0 };
        byCategory[cat].count++;
        byCategory[cat].totalRevenue += Number(sale.sale_price) || 0;
    }

    const categorySummary = Object.entries(byCategory)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
        .map(([cat, data]) => `${cat}: ${data.count} sales, $${data.totalRevenue.toFixed(0)} revenue`);

    if (client && categorySummary.length > 0) {
        try {
            const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
            const userContent = [
                `Month: ${currentMonth}`,
                'Sales velocity by category (last 90 days):',
                categorySummary.join('\n'),
            ].join('\n');

            const response = await Sentry.startSpan(
                { name: 'claude.demand-forecast', op: 'ai.run', attributes: { model: HAIKU_MODEL } },
                () =>
                    circuitBreaker(
                        'anthropic-demand-forecast',
                        () =>
                            withTimeout(
                                client.messages.create({
                                    model: HAIKU_MODEL,
                                    max_tokens: 1024,
                                    system: [
                                        "You are a resale market analyst. Given a seller's 90-day sales data by category,",
                                        'provide demand forecasts for the coming weeks. Consider seasonality for the given month.',
                                        'Respond ONLY with valid JSON array (no markdown):',
                                        '[{"category":"string","demand_level":"high"|"medium"|"low","price_trend":"rising"|"stable"|"falling",',
                                        '"seasonality_index":number_0.5_to_1.5,"notes":"one sentence actionable insight"}]',
                                    ].join(' '),
                                    messages: [{ role: 'user', content: userContent }],
                                }),
                                20000,
                                'Claude demand forecast',
                            ),
                        { failureThreshold: 3, cooldownMs: 60000 },
                    ),
            );

            const raw = response.content[0].text.trim();
            const match = raw.match(/\[[\s\S]*\]/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const results = parsed.map((f) => ({
                        category: String(f.category || 'Other').slice(0, 100),
                        demand_level: ['high', 'medium', 'low'].includes(f.demand_level) ? f.demand_level : 'medium',
                        price_trend: ['rising', 'stable', 'falling'].includes(f.price_trend) ? f.price_trend : 'stable',
                        seasonality_index: Math.min(1.5, Math.max(0.5, Number(f.seasonality_index) || 1.0)),
                        notes: String(f.notes || '').slice(0, 300),
                    }));
                    await setCachedResponse(cacheKey, results);
                    logger.info('[PredictionsAI] Claude demand forecast succeeded', null, {
                        user_id: userId,
                        categories: results.length,
                        source: 'claude',
                    });
                    return results.map((f) => ({ ...f, source: 'claude' }));
                }
            }
        } catch (err) {
            logger.warn('[PredictionsAI] Claude demand forecast failed, using statistical fallback', {
                error: err.message,
                user_id: userId,
            });
        }
    }

    return statisticalDemandFallback(byCategory);
}

// --- Statistical fallbacks ---

function statisticalPriceFallback(item, salesHistory) {
    const currentPrice = Number(item.list_price) || 50;
    let predicted = currentPrice;
    let confidence = 40;

    if (salesHistory.length >= 3) {
        const avg = salesHistory.reduce((sum, s) => sum + Number(s.sale_price), 0) / salesHistory.length;
        if (avg > 0) {
            predicted = Math.round(avg * 100) / 100;
            confidence = Math.min(75, 40 + salesHistory.length * 2);
        }
    }

    const priceDiff = ((predicted - currentPrice) / (currentPrice || 1)) * 100;
    let recommendation = 'hold';
    let recommendation_reason = 'Price is near market average based on your sales history.';

    if (priceDiff > 15) {
        recommendation = 'price_up';
        recommendation_reason = `Sales data suggests market price is ${Math.round(priceDiff)}% above your current price.`;
    } else if (priceDiff < -15) {
        recommendation = 'price_down';
        recommendation_reason = `Sales data suggests market price is ${Math.abs(Math.round(priceDiff))}% below your current price.`;
    }

    const daysSinceListed = item.created_at
        ? Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000)
        : 0;
    if (daysSinceListed > 30 && recommendation === 'hold') {
        recommendation = 'relist';
        recommendation_reason = `Listed ${daysSinceListed} days ago with no sale — consider relisting with fresh photos.`;
    }

    return {
        predicted_price: predicted,
        confidence,
        recommendation,
        recommendation_reason,
        avg_days_to_sell: salesHistory.length > 0 ? 14 : 21,
        demand_score: salesHistory.length >= 5 ? 60 : 40,
        source: 'statistical',
    };
}

const SEASONALITY_DEFAULTS = {
    clothing: [0.85, 0.8, 0.9, 0.95, 1.0, 0.95, 0.85, 0.9, 1.05, 1.1, 1.2, 1.25],
    shoes: [0.9, 0.85, 0.95, 1.0, 1.05, 1.0, 0.9, 1.05, 1.1, 1.05, 1.15, 1.2],
    default: [0.95, 0.9, 0.95, 1.0, 1.0, 1.0, 0.95, 1.0, 1.05, 1.05, 1.15, 1.15],
};

function statisticalDemandFallback(byCategory) {
    const month = new Date().getMonth();
    const monthName = new Date().toLocaleString('en-US', { month: 'long' });

    if (Object.keys(byCategory).length === 0) {
        return ['Clothing', 'Shoes', 'Bags', 'Accessories'].map((cat) => {
            const factors = SEASONALITY_DEFAULTS.default;
            const idx = factors[month];
            return {
                category: cat,
                demand_level: idx >= 1.1 ? 'high' : idx >= 0.95 ? 'medium' : 'low',
                price_trend: idx >= 1.1 ? 'rising' : idx <= 0.85 ? 'falling' : 'stable',
                seasonality_index: idx,
                notes: `Seasonal estimate for ${cat} in ${monthName}.`,
                source: 'statistical',
            };
        });
    }

    return Object.entries(byCategory).map(([category, data]) => {
        const lower = category.toLowerCase();
        const factors =
            lower.includes('shoe') || lower.includes('boot') || lower.includes('sneaker')
                ? SEASONALITY_DEFAULTS.shoes
                : SEASONALITY_DEFAULTS.clothing;
        const idx = factors[month];
        const velocity = data.count;

        let demand_level = 'medium';
        if (idx >= 1.1 || velocity >= 10) demand_level = 'high';
        else if (idx <= 0.85 || velocity <= 2) demand_level = 'low';

        return {
            category,
            demand_level,
            price_trend: idx >= 1.1 ? 'rising' : idx <= 0.85 ? 'falling' : 'stable',
            seasonality_index: idx,
            notes: `${velocity} sales in last 90 days. ${idx >= 1.1 ? 'Peak season.' : idx <= 0.85 ? 'Off-season.' : 'Normal activity.'}`,
            source: 'statistical',
        };
    });
}
