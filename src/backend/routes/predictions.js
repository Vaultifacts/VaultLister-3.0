// Predictions Router for VaultLister
// Handles predictive analytics API

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import {
    generatePricePrediction,
    generateBatchPredictions,
    calculateDemandScore,
    getRecommendation,
    getDemandForecast
} from '../services/pricingEngine.js';
import { logger } from '../shared/logger.js';

/**
 * Safe JSON parse helper — returns fallback on malformed data instead of throwing
 */
function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

const ALLOWED_MODEL_FIELDS = new Set(['name', 'model_type', 'parameters', 'is_active']);

export async function predictionsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // Helper: require authentication
    const requireAuth = () => {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        return null;
    };

    // GET /predictions - List all predictions for user
    if (method === 'GET' && (path === '' || path === '/')) {
        const authError = requireAuth();
        if (authError) return authError;

        const limit = Math.min(Math.max(1, parseInt(queryParams.limit) || 50), 200);
        const offset = Math.max(0, parseInt(queryParams.offset) || 0);
        const recommendation = queryParams.recommendation;
        const expired = queryParams.include_expired === 'true';

        let sql = `
            SELECT p.*, i.title, i.brand, i.category, i.list_price as current_price
            FROM price_predictions p
            LEFT JOIN inventory i ON p.inventory_id = i.id
            WHERE p.user_id = ?
        `;
        const params = [user.id];

        if (!expired) {
            sql += ` AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))`;
        }

        if (recommendation) {
            sql += ' AND p.recommendation = ?';
            params.push(recommendation);
        }

        sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        try {
            const predictions = query.all(sql, params);
            return { status: 200, data: predictions };
        } catch (error) {
            logger.error('[Predictions] error fetching predictions', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to fetch predictions' } };
        }
    }

    // POST /predictions/item/:inventoryId - Generate prediction for item
    const itemMatch = path.match(/^\/item\/([^/]+)$/);
    if (method === 'POST' && itemMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const inventoryId = itemMatch[1];
        const { platform } = body;

        try {
            const prediction = await generatePricePrediction(inventoryId, user.id, { platform });
            return { status: 200, data: prediction };
        } catch (error) {
            logger.error('[Predictions] error generating prediction', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    // GET /predictions/item/:inventoryId - Get latest prediction for item
    if (method === 'GET' && itemMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const inventoryId = itemMatch[1];

        try {
            const prediction = query.get(`
                SELECT p.*, i.title, i.brand, i.category, i.list_price as current_price
                FROM price_predictions p
                LEFT JOIN inventory i ON p.inventory_id = i.id
                WHERE p.inventory_id = ? AND p.user_id = ?
                AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))
                ORDER BY p.created_at DESC
                LIMIT 1
            `, [inventoryId, user.id]);

            if (!prediction) {
                return { status: 404, data: { error: 'No prediction found. Generate one first.' } };
            }

            return { status: 200, data: prediction };
        } catch (error) {
            logger.error('[Predictions] error fetching prediction', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    // POST /predictions/batch - Generate predictions for multiple items
    if (method === 'POST' && path === '/batch') {
        const authError = requireAuth();
        if (authError) return authError;

        const { inventory_ids, platform } = body;

        if (!inventory_ids || !Array.isArray(inventory_ids)) {
            return { status: 400, data: { error: 'inventory_ids array required' } };
        }

        if (inventory_ids.length > 50) {
            return { status: 400, data: { error: 'Maximum 50 items per batch' } };
        }

        try {
            const predictions = await generateBatchPredictions(inventory_ids, user.id, { platform });

            return {
                status: 200,
                data: {
                    generated: predictions.filter(p => !p.error).length,
                    failed: predictions.filter(p => p.error).length,
                    predictions
                }
            };
        } catch (error) {
            logger.error('[Predictions] error generating batch predictions', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    // GET /predictions/recommendations - Get items needing action
    if (method === 'GET' && path === '/recommendations') {
        const authError = requireAuth();
        if (authError) return authError;

        const action = queryParams.action; // price_up, price_down, relist, hold

        let sql = `
            SELECT p.*, i.title, i.brand, i.category, i.list_price as current_price,
                   i.images, i.sku
            FROM price_predictions p
            INNER JOIN inventory i ON p.inventory_id = i.id
            WHERE p.user_id = ?
            AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))
            AND p.recommendation != 'hold'
        `;
        const params = [user.id];

        if (action) {
            sql += ' AND p.recommendation = ?';
            params.push(action);
        }

        sql += ' ORDER BY p.demand_score DESC, p.confidence DESC LIMIT 20';

        try {
            const recommendations = query.all(sql, params);

            // Group by recommendation type
            const grouped = {
                price_up: recommendations.filter(r => r.recommendation === 'price_up'),
                price_down: recommendations.filter(r => r.recommendation === 'price_down'),
                relist: recommendations.filter(r => r.recommendation === 'relist')
            };

            return {
                status: 200,
                data: {
                    summary: {
                        price_up: grouped.price_up.length,
                        price_down: grouped.price_down.length,
                        relist: grouped.relist.length
                    },
                    recommendations: action ? recommendations : grouped
                }
            };
        } catch (error) {
            logger.error('[Predictions] error fetching recommendations', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to fetch recommendations' } };
        }
    }

    // GET /predictions/demand - Get demand forecasts
    if (method === 'GET' && path === '/demand') {
        const authError = requireAuth();
        if (authError) return authError;

        const category = queryParams.category;
        const platform = queryParams.platform;

        try {
            // Get stored forecasts
            let sql = `
                SELECT * FROM demand_forecasts
                WHERE (user_id = ? OR user_id IS NULL)
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

            sql += ' ORDER BY forecast_date DESC LIMIT 20';

            const forecasts = query.all(sql, params);

            if (forecasts.length === 0 && category) {
                const forecast = await getDemandForecast(category, platform, user.id);
                return { status: 200, data: [forecast] };
            }

            return { status: 200, data: forecasts };
        } catch (error) {
            const categories = ['Clothing', 'Shoes', 'Bags', 'Accessories', 'Electronics', 'Vintage'];
            const forecasts = await Promise.all(
                categories.map(cat => getDemandForecast(cat, platform, user.id))
            );
            return { status: 200, data: forecasts };
        }
    }

    // POST /predictions/demand/:category - Generate demand forecast
    const demandCatMatch = path.match(/^\/demand\/([^/]+)$/);
    if (method === 'POST' && demandCatMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const category = decodeURIComponent(demandCatMatch[1]);
        const { platform } = body;

        const forecast = await getDemandForecast(category, platform, user.id);

        // Store forecast
        try {
            query.run(`
                INSERT INTO demand_forecasts (id, user_id, category, platform, forecast_date,
                    demand_level, price_trend, seasonality_index, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                uuidv4(), user.id, forecast.category, forecast.platform,
                forecast.forecast_date, forecast.demand_level, forecast.price_trend,
                forecast.seasonality_index, forecast.notes
            ]);
        } catch (err) {
            // Table might not exist
        }

        return { status: 200, data: forecast };
    }

    // GET /predictions/seasonal-calendar - Get seasonality calendar
    if (method === 'GET' && path === '/seasonal-calendar') {
        const authError = requireAuth();
        if (authError) return authError;

        const category = queryParams.category || 'Clothing';

        // Generate 12-month seasonality view
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const SEASONALITY = {
            clothing: [0.85, 0.80, 0.90, 0.95, 1.00, 0.95, 0.85, 0.90, 1.05, 1.10, 1.20, 1.25],
            shoes: [0.90, 0.85, 0.95, 1.00, 1.05, 1.00, 0.90, 1.05, 1.10, 1.05, 1.15, 1.20],
            default: [0.95, 0.90, 0.95, 1.00, 1.00, 1.00, 0.95, 1.00, 1.05, 1.05, 1.15, 1.15]
        };

        const factors = SEASONALITY[category.toLowerCase()] || SEASONALITY.default;

        const calendar = months.map((month, idx) => ({
            month,
            month_index: idx,
            factor: factors[idx],
            demand: factors[idx] >= 1.1 ? 'high' : factors[idx] >= 0.95 ? 'medium' : 'low',
            recommendation: factors[idx] >= 1.1 ? 'Prime selling time' :
                           factors[idx] <= 0.85 ? 'Consider holding inventory' : 'Normal activity'
        }));

        return { status: 200, data: { category, calendar } };
    }

    // GET /predictions/stats - Get prediction accuracy stats
    if (method === 'GET' && path === '/stats') {
        const authError = requireAuth();
        if (authError) return authError;

        try {
            const stats = query.get(`
                SELECT
                    COUNT(*) as total_predictions,
                    AVG(confidence) as avg_confidence,
                    COUNT(CASE WHEN recommendation = 'price_up' THEN 1 END) as price_up_count,
                    COUNT(CASE WHEN recommendation = 'price_down' THEN 1 END) as price_down_count,
                    COUNT(CASE WHEN recommendation = 'relist' THEN 1 END) as relist_count,
                    COUNT(CASE WHEN recommendation = 'hold' THEN 1 END) as hold_count,
                    AVG(demand_score) as avg_demand_score
                FROM price_predictions
                WHERE user_id = ?
                AND created_at > datetime('now', '-30 days')
            `, [user.id]);

            return {
                status: 200,
                data: {
                    total_predictions: stats.total_predictions || 0,
                    avg_confidence: Math.round((stats.avg_confidence || 0) * 100) / 100,
                    avg_demand_score: Math.round((stats.avg_demand_score || 0) * 10) / 10,
                    recommendations: {
                        price_up: stats.price_up_count || 0,
                        price_down: stats.price_down_count || 0,
                        relist: stats.relist_count || 0,
                        hold: stats.hold_count || 0
                    }
                }
            };
        } catch (error) {
            return {
                status: 200,
                data: {
                    total_predictions: 0,
                    avg_confidence: 0,
                    avg_demand_score: 0,
                    recommendations: { price_up: 0, price_down: 0, relist: 0, hold: 0 }
                }
            };
        }
    }

    // ===== FEATURE 1: Custom Prediction Model Configuration =====

    // GET /predictions/models - List all prediction models for user
    if (method === 'GET' && path === '/models') {
        const authError = requireAuth();
        if (authError) return authError;

        try {
            const models = query.all(`
                SELECT id, name, model_type, parameters, is_active,
                       accuracy_score, last_trained_at, created_at, updated_at
                FROM prediction_models
                WHERE user_id = ?
                ORDER BY is_active DESC, created_at DESC
                LIMIT 200
            `, [user.id]);

            // Parse JSON parameters
            const parsedModels = models.map(m => ({
                ...m,
                parameters: safeJsonParse(m.parameters, {}),
                is_active: Boolean(m.is_active)
            }));

            return { status: 200, data: parsedModels };
        } catch (error) {
            logger.error('[Predictions] error fetching models', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    // POST /predictions/models - Create new prediction model
    if (method === 'POST' && path === '/models') {
        const authError = requireAuth();
        if (authError) return authError;

        const { name, model_type, parameters } = body;

        // Validation
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return { status: 400, data: { error: 'Model name is required' } };
        }

        const validTypes = ['linear', 'exponential', 'seasonal', 'moving_average', 'weighted'];
        if (!model_type || !validTypes.includes(model_type)) {
            return { status: 400, data: {
                error: `Invalid model_type. Must be one of: ${validTypes.join(', ')}`
            } };
        }

        if (parameters && typeof parameters !== 'object') {
            return { status: 400, data: { error: 'Parameters must be an object' } };
        }

        const modelId = uuidv4();
        const now = new Date().toISOString();

        try {
            query.run(`
                INSERT INTO prediction_models
                (id, user_id, name, model_type, parameters, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            `, [
                modelId,
                user.id,
                name.trim(),
                model_type,
                JSON.stringify(parameters || {}),
                now,
                now
            ]);

            const newModel = query.get(`
                SELECT id, name, model_type, parameters, is_active,
                       accuracy_score, last_trained_at, created_at, updated_at
                FROM prediction_models
                WHERE id = ?
            `, [modelId]);

            return {
                status: 201,
                data: {
                    ...newModel,
                    parameters: safeJsonParse(newModel.parameters, {}),
                    is_active: Boolean(newModel.is_active)
                }
            };
        } catch (error) {
            logger.error('[Predictions] error creating model', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    // PUT /predictions/models/:id - Update prediction model
    const modelUpdateMatch = path.match(/^\/models\/([^/]+)$/);
    if (method === 'PUT' && modelUpdateMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const modelId = modelUpdateMatch[1];
        const { name, model_type, parameters, is_active } = body;

        try {
            // Check model exists and belongs to user
            const existing = query.get(`
                SELECT id FROM prediction_models
                WHERE id = ? AND user_id = ?
            `, [modelId, user.id]);

            if (!existing) {
                return { status: 404, data: { error: 'Model not found' } };
            }

            // Build update query
            const updates = [];
            const params = [];

            if (name !== undefined) {
                if (typeof name !== 'string' || name.trim().length === 0) {
                    return { status: 400, data: { error: 'Model name cannot be empty' } };
                }
                updates.push('name = ?');
                params.push(name.trim());
            }

            if (model_type !== undefined) {
                const validTypes = ['linear', 'exponential', 'seasonal', 'moving_average', 'weighted'];
                if (!validTypes.includes(model_type)) {
                    return { status: 400, data: {
                        error: `Invalid model_type. Must be one of: ${validTypes.join(', ')}`
                    } };
                }
                updates.push('model_type = ?');
                params.push(model_type);
            }

            if (parameters !== undefined) {
                if (typeof parameters !== 'object') {
                    return { status: 400, data: { error: 'Parameters must be an object' } };
                }
                updates.push('parameters = ?');
                params.push(JSON.stringify(parameters));
            }

            if (is_active !== undefined) {
                updates.push('is_active = ?');
                params.push(is_active ? 1 : 0);
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No fields to update' } };
            }

            updates.push('updated_at = ?');
            params.push(new Date().toISOString());

            params.push(modelId, user.id);

            query.run(`
                UPDATE prediction_models
                SET ${updates.join(', ')}
                WHERE id = ? AND user_id = ?
            `, params);

            const updated = query.get(`
                SELECT id, name, model_type, parameters, is_active,
                       accuracy_score, last_trained_at, created_at, updated_at
                FROM prediction_models
                WHERE id = ?
            `, [modelId]);

            return {
                status: 200,
                data: {
                    ...updated,
                    parameters: safeJsonParse(updated.parameters, {}),
                    is_active: Boolean(updated.is_active)
                }
            };
        } catch (error) {
            logger.error('[Predictions] error updating model', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    // DELETE /predictions/models/:id - Delete prediction model
    const modelDeleteMatch = path.match(/^\/models\/([^/]+)$/);
    if (method === 'DELETE' && modelDeleteMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const modelId = modelDeleteMatch[1];

        try {
            const result = query.run(`
                DELETE FROM prediction_models
                WHERE id = ? AND user_id = ?
            `, [modelId, user.id]);

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Model not found' } };
            }

            return { status: 200, data: { message: 'Model deleted successfully' } };
        } catch (error) {
            logger.error('[Predictions] error deleting model', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    // ===== FEATURE 2: What-If Scenario Modeling =====

    // GET /predictions/scenarios - List all scenarios for user
    if (method === 'GET' && path === '/scenarios') {
        const authError = requireAuth();
        if (authError) return authError;

        try {
            const scenarios = query.all(`
                SELECT id, name, base_data, adjustments, results, created_at
                FROM prediction_scenarios
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 200
            `, [user.id]);

            // Parse JSON fields
            const parsedScenarios = scenarios.map(s => ({
                ...s,
                base_data: safeJsonParse(s.base_data, {}),
                adjustments: safeJsonParse(s.adjustments, {}),
                results: safeJsonParse(s.results, {})
            }));

            return { status: 200, data: parsedScenarios };
        } catch (error) {
            logger.error('[Predictions] error fetching scenarios', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    // POST /predictions/scenarios - Create new what-if scenario
    if (method === 'POST' && path === '/scenarios') {
        const authError = requireAuth();
        if (authError) return authError;

        const { name, base_data, adjustments } = body;

        // Validation
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return { status: 400, data: { error: 'Scenario name is required' } };
        }

        if (!base_data || typeof base_data !== 'object') {
            return { status: 400, data: { error: 'base_data object is required' } };
        }

        if (!adjustments || typeof adjustments !== 'object') {
            return { status: 400, data: { error: 'adjustments object is required' } };
        }

        // Calculate results based on adjustments applied to base_data
        const results = calculateScenarioResults(base_data, adjustments);

        const scenarioId = uuidv4();
        const now = new Date().toISOString();

        try {
            query.run(`
                INSERT INTO prediction_scenarios
                (id, user_id, name, base_data, adjustments, results, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                scenarioId,
                user.id,
                name.trim(),
                JSON.stringify(base_data),
                JSON.stringify(adjustments),
                JSON.stringify(results),
                now
            ]);

            const newScenario = query.get(`
                SELECT id, name, base_data, adjustments, results, created_at
                FROM prediction_scenarios
                WHERE id = ?
            `, [scenarioId]);

            return {
                status: 201,
                data: {
                    ...newScenario,
                    base_data: safeJsonParse(newScenario.base_data, {}),
                    adjustments: safeJsonParse(newScenario.adjustments, {}),
                    results: safeJsonParse(newScenario.results, {})
                }
            };
        } catch (error) {
            logger.error('[Predictions] error creating scenario', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    // GET /predictions/scenarios/:id - Get single scenario
    const scenarioGetMatch = path.match(/^\/scenarios\/([^/]+)$/);
    if (method === 'GET' && scenarioGetMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const scenarioId = scenarioGetMatch[1];

        try {
            const scenario = query.get(`
                SELECT id, name, base_data, adjustments, results, created_at
                FROM prediction_scenarios
                WHERE id = ? AND user_id = ?
            `, [scenarioId, user.id]);

            if (!scenario) {
                return { status: 404, data: { error: 'Scenario not found' } };
            }

            return {
                status: 200,
                data: {
                    ...scenario,
                    base_data: safeJsonParse(scenario.base_data, {}),
                    adjustments: safeJsonParse(scenario.adjustments, {}),
                    results: safeJsonParse(scenario.results, {})
                }
            };
        } catch (error) {
            logger.error('[Predictions] error fetching scenario', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    // DELETE /predictions/scenarios/:id - Delete scenario
    const scenarioDeleteMatch = path.match(/^\/scenarios\/([^/]+)$/);
    if (method === 'DELETE' && scenarioDeleteMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const scenarioId = scenarioDeleteMatch[1];

        try {
            const result = query.run(`
                DELETE FROM prediction_scenarios
                WHERE id = ? AND user_id = ?
            `, [scenarioId, user.id]);

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Scenario not found' } };
            }

            return { status: 200, data: { message: 'Scenario deleted successfully' } };
        } catch (error) {
            logger.error('[Predictions] error deleting scenario', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Prediction service unavailable' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}

// Helper: Calculate scenario results based on adjustments
function calculateScenarioResults(baseData, adjustments) {
    const results = { ...baseData };

    // Apply price change adjustment
    if (adjustments.price_change !== undefined && baseData.price !== undefined) {
        const priceChange = parseFloat(adjustments.price_change) || 0;
        results.adjusted_price = baseData.price * (1 + priceChange / 100);
        results.price_impact = priceChange;
    }

    // Apply volume change adjustment
    if (adjustments.volume_change !== undefined && baseData.volume !== undefined) {
        const volumeChange = parseFloat(adjustments.volume_change) || 0;
        results.adjusted_volume = Math.round(baseData.volume * (1 + volumeChange / 100));
        results.volume_impact = volumeChange;
    }

    // Apply seasonal adjustment
    if (adjustments.season) {
        const seasonalFactors = {
            holiday: 1.25,
            peak: 1.15,
            normal: 1.0,
            off_season: 0.85,
            clearance: 0.70
        };
        const factor = seasonalFactors[adjustments.season] || 1.0;
        results.seasonal_factor = factor;

        if (results.adjusted_volume !== undefined) {
            results.adjusted_volume = Math.round(results.adjusted_volume * factor);
        }
    }

    // Calculate projected revenue
    if (results.adjusted_price !== undefined && results.adjusted_volume !== undefined) {
        results.projected_revenue = results.adjusted_price * results.adjusted_volume;

        if (baseData.price !== undefined && baseData.volume !== undefined) {
            const baseRevenue = baseData.price * baseData.volume;
            results.revenue_change_percent = ((results.projected_revenue - baseRevenue) / baseRevenue) * 100;
        }
    }

    // Add confidence score based on adjustments
    const adjustmentCount = Object.keys(adjustments).length;
    results.confidence = Math.max(0.5, 1 - (adjustmentCount * 0.1));

    // Add recommendation
    if (results.revenue_change_percent !== undefined) {
        if (results.revenue_change_percent > 10) {
            results.recommendation = 'Highly favorable scenario';
        } else if (results.revenue_change_percent > 0) {
            results.recommendation = 'Favorable scenario';
        } else if (results.revenue_change_percent > -10) {
            results.recommendation = 'Neutral scenario';
        } else {
            results.recommendation = 'Unfavorable scenario';
        }
    }

    return results;
}
