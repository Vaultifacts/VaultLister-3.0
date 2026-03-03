// Smart Relisting Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { predictPrice } from '../../shared/ai/price-predictor.js';
import { logger } from '../shared/logger.js';

/**
 * Safe JSON parse helper — returns fallback on malformed data instead of throwing
 */
function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

export async function relistingRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // ============================================
    // Relisting Rules CRUD
    // ============================================

    // GET /api/relisting/rules - List all rules
    if (method === 'GET' && path === '/rules') {
        try {
            const rules = query.all(`
                SELECT * FROM relisting_rules
                WHERE user_id = ?
                ORDER BY is_default DESC, created_at DESC
            `, [user.id]);

            return {
                status: 200,
                data: {
                    rules: rules.map(r => ({
                        ...r,
                        tiered_reductions: safeJsonParse(r.tiered_reductions, null),
                        categories: safeJsonParse(r.categories, null),
                        exclude_categories: safeJsonParse(r.exclude_categories, null),
                        brands: safeJsonParse(r.brands, null),
                        platforms: safeJsonParse(r.platforms, null),
                        relist_days: safeJsonParse(r.relist_days, null)
                    }))
                }
            };
        } catch (error) {
            logger.error('[Relisting] Error listing relisting rules', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/relisting/rules/:id - Get single rule
    const getRuleMatch = path.match(/^\/rules\/([a-f0-9-]+)$/i);
    if (method === 'GET' && getRuleMatch) {
        try {
            const rule = query.get(`
                SELECT * FROM relisting_rules WHERE id = ? AND user_id = ?
            `, [getRuleMatch[1], user.id]);

            if (!rule) {
                return { status: 404, data: { error: 'Rule not found' } };
            }

            return {
                status: 200,
                data: {
                    rule: {
                        ...rule,
                        tiered_reductions: safeJsonParse(rule.tiered_reductions, null),
                        categories: safeJsonParse(rule.categories, null),
                        platforms: safeJsonParse(rule.platforms, null)
                    }
                }
            };
        } catch (error) {
            logger.error('[Relisting] Error fetching relisting rule', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/relisting/rules - Create rule
    if (method === 'POST' && path === '/rules') {
        try {
            const {
                name, description, stale_days = 30, min_views = 0, max_views,
                min_likes = 0, price_strategy = 'fixed', price_reduction_amount = 0,
                price_floor_percentage = 50, use_ai_pricing = false, tiered_reductions,
                refresh_photos = false, refresh_title = false, refresh_description = false,
                add_sale_tag = false, auto_relist = false, relist_time, relist_days,
                max_relists_per_day = 10, categories, exclude_categories, brands,
                min_price, max_price, platforms, is_default = false
            } = body;

            if (!name) {
                return { status: 400, data: { error: 'Rule name is required' } };
            }

            const id = uuidv4();

            // If setting as default, unset other defaults
            if (is_default) {
                query.run('UPDATE relisting_rules SET is_default = 0 WHERE user_id = ?', [user.id]);
            }

            query.run(`
                INSERT INTO relisting_rules (
                    id, user_id, name, description, stale_days, min_views, max_views,
                    min_likes, price_strategy, price_reduction_amount, price_floor_percentage,
                    use_ai_pricing, tiered_reductions, refresh_photos, refresh_title,
                    refresh_description, add_sale_tag, auto_relist, relist_time, relist_days,
                    max_relists_per_day, categories, exclude_categories, brands, min_price,
                    max_price, platforms, is_default
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, user.id, name, description, stale_days, min_views, max_views,
                min_likes, price_strategy, price_reduction_amount, price_floor_percentage,
                use_ai_pricing ? 1 : 0,
                tiered_reductions ? JSON.stringify(tiered_reductions) : null,
                refresh_photos ? 1 : 0, refresh_title ? 1 : 0, refresh_description ? 1 : 0,
                add_sale_tag ? 1 : 0, auto_relist ? 1 : 0, relist_time,
                relist_days ? JSON.stringify(relist_days) : null,
                max_relists_per_day,
                categories ? JSON.stringify(categories) : null,
                exclude_categories ? JSON.stringify(exclude_categories) : null,
                brands ? JSON.stringify(brands) : null,
                min_price, max_price,
                platforms ? JSON.stringify(platforms) : null,
                is_default ? 1 : 0
            ]);

            return {
                status: 201,
                data: { message: 'Rule created', id }
            };
        } catch (error) {
            logger.error('[Relisting] Error creating relisting rule', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PATCH /api/relisting/rules/:id - Update rule
    const patchRuleMatch = path.match(/^\/rules\/([a-f0-9-]+)$/i);
    if (method === 'PATCH' && patchRuleMatch) {
        try {
            const id = patchRuleMatch[1];

            // Verify ownership
            const existing = query.get('SELECT id FROM relisting_rules WHERE id = ? AND user_id = ?', [id, user.id]);
            if (!existing) {
                return { status: 404, data: { error: 'Rule not found' } };
            }

            const updates = [];
            const params = [];

            const fields = [
                'name', 'description', 'stale_days', 'min_views', 'max_views', 'min_likes',
                'price_strategy', 'price_reduction_amount', 'price_floor_percentage',
                'refresh_photos', 'refresh_title', 'refresh_description', 'add_sale_tag',
                'auto_relist', 'relist_time', 'max_relists_per_day', 'min_price', 'max_price', 'is_active'
            ];

            fields.forEach(field => {
                if (body[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(typeof body[field] === 'boolean' ? (body[field] ? 1 : 0) : body[field]);
                }
            });

            // Handle JSON fields
            ['tiered_reductions', 'categories', 'exclude_categories', 'brands', 'platforms', 'relist_days'].forEach(field => {
                if (body[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(body[field] ? JSON.stringify(body[field]) : null);
                }
            });

            if (body.use_ai_pricing !== undefined) {
                updates.push('use_ai_pricing = ?');
                params.push(body.use_ai_pricing ? 1 : 0);
            }

            if (body.is_default) {
                query.run('UPDATE relisting_rules SET is_default = 0 WHERE user_id = ?', [user.id]);
                updates.push('is_default = 1');
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No updates provided' } };
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            query.run(`UPDATE relisting_rules SET ${updates.join(', ')} WHERE id = ?`, params);

            return { status: 200, data: { message: 'Rule updated' } };
        } catch (error) {
            logger.error('[Relisting] Error updating relisting rule', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/relisting/rules/:id - Delete rule
    const deleteRuleMatch = path.match(/^\/rules\/([a-f0-9-]+)$/i);
    if (method === 'DELETE' && deleteRuleMatch) {
        try {
            const result = query.run(
                'DELETE FROM relisting_rules WHERE id = ? AND user_id = ?',
                [deleteRuleMatch[1], user.id]
            );

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Rule not found' } };
            }

            return { status: 200, data: { message: 'Rule deleted' } };
        } catch (error) {
            logger.error('[Relisting] Error deleting relisting rule', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ============================================
    // Stale Listings & Queue Management
    // ============================================

    // GET /api/relisting/stale - Get stale listings
    if (method === 'GET' && path === '/stale') {
        try {
            const { days = 30, limit = 50, offset = 0 } = queryParams;

            const staleListings = query.all(`
                SELECT l.*, i.title, i.brand, i.category, i.list_price, i.images,
                       julianday('now') - julianday(COALESCE(l.last_refreshed_at, l.created_at)) as days_stale,
                       (SELECT COUNT(*) FROM listing_engagement WHERE listing_id = l.id) as total_views
                FROM listings l
                JOIN inventory i ON l.inventory_id = i.id
                WHERE l.user_id = ? AND l.status = 'active'
                AND julianday('now') - julianday(COALESCE(l.last_refreshed_at, l.created_at)) >= ?
                ORDER BY days_stale DESC
                LIMIT ? OFFSET ?
            `, [user.id, parseInt(days), parseInt(limit), parseInt(offset)]);

            const { count } = query.get(`
                SELECT COUNT(*) as count FROM listings l
                WHERE l.user_id = ? AND l.status = 'active'
                AND julianday('now') - julianday(COALESCE(l.last_refreshed_at, l.created_at)) >= ?
            `, [user.id, parseInt(days)]);

            return {
                status: 200,
                data: {
                    listings: staleListings.map(l => ({
                        ...l,
                        images: safeJsonParse(l.images, []),
                        days_stale: Math.floor(l.days_stale)
                    })),
                    total: count,
                    threshold_days: parseInt(days)
                }
            };
        } catch (error) {
            logger.error('[Relisting] Error fetching stale listings', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/relisting/queue - Add listings to relist queue
    if (method === 'POST' && path === '/queue') {
        try {
            const { listing_ids, rule_id, scheduled_at } = body;

            if (!listing_ids || !Array.isArray(listing_ids) || listing_ids.length === 0) {
                return { status: 400, data: { error: 'Listing IDs required' } };
            }

            // Get rule if specified
            let rule = null;
            if (rule_id) {
                rule = query.get('SELECT * FROM relisting_rules WHERE id = ? AND user_id = ?', [rule_id, user.id]);
            }

            const queued = [];
            for (const listingId of listing_ids) {
                const listing = query.get(`
                    SELECT l.*, i.title, i.brand, i.category, i.list_price, i.cost
                    FROM listings l
                    JOIN inventory i ON l.inventory_id = i.id
                    WHERE l.id = ? AND l.user_id = ?
                `, [listingId, user.id]);

                if (!listing) continue;

                // Calculate new price if rule specifies
                let newPrice = listing.list_price;
                let priceChangeReason = null;

                if (rule) {
                    const priceResult = calculateNewPrice(listing, rule);
                    newPrice = priceResult.price;
                    priceChangeReason = priceResult.reason;
                }

                const id = uuidv4();
                query.run(`
                    INSERT INTO relisting_queue (
                        id, user_id, listing_id, inventory_id, rule_id, platform,
                        scheduled_at, original_price, new_price, price_change_reason,
                        views_before, likes_before, days_listed
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    id, user.id, listingId, listing.inventory_id, rule_id, listing.platform,
                    scheduled_at || new Date().toISOString(),
                    listing.list_price, newPrice, priceChangeReason,
                    listing.views || 0, listing.likes || 0,
                    Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24))
                ]);

                queued.push({ id, listing_id: listingId, new_price: newPrice });
            }

            return {
                status: 201,
                data: {
                    message: `${queued.length} listing(s) queued for relisting`,
                    queued
                }
            };
        } catch (error) {
            logger.error('[Relisting] Error adding listings to relist queue', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/relisting/queue - Get relist queue
    if (method === 'GET' && path === '/queue') {
        try {
            const { status = 'pending', limit = 50, offset = 0 } = queryParams;

            let sql = `
                SELECT rq.*, i.title, i.brand, i.images
                FROM relisting_queue rq
                JOIN inventory i ON rq.inventory_id = i.id
                WHERE rq.user_id = ?
            `;
            const params = [user.id];

            if (status && status !== 'all') {
                sql += ' AND rq.status = ?';
                params.push(status);
            }

            sql += ' ORDER BY rq.scheduled_at ASC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const queue = query.all(sql, params);

            return {
                status: 200,
                data: {
                    queue: queue.map(q => ({
                        ...q,
                        images: safeJsonParse(q.images, []),
                        changes_made: safeJsonParse(q.changes_made, null)
                    }))
                }
            };
        } catch (error) {
            logger.error('[Relisting] Error fetching relist queue', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/relisting/process - Process relist queue
    if (method === 'POST' && path === '/process') {
        try {
            const { queue_ids, process_all = false } = body;

            let itemsToProcess;
            if (process_all) {
                itemsToProcess = query.all(`
                    SELECT * FROM relisting_queue
                    WHERE user_id = ? AND status = 'pending'
                    AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
                    LIMIT 50
                `, [user.id]);
            } else if (queue_ids && queue_ids.length > 0) {
                const placeholders = queue_ids.map(() => '?').join(',');
                itemsToProcess = query.all(`
                    SELECT * FROM relisting_queue
                    WHERE id IN (${placeholders}) AND user_id = ? AND status = 'pending'
                `, [...queue_ids, user.id]);
            } else {
                return { status: 400, data: { error: 'Specify queue_ids or set process_all to true' } };
            }

            const results = [];
            for (const item of itemsToProcess) {
                try {
                    // Update listing price if changed
                    const changes = [];
                    if (item.new_price && item.new_price !== item.original_price) {
                        query.run('UPDATE inventory SET list_price = ? WHERE id = ?', [item.new_price, item.inventory_id]);
                        changes.push({ field: 'price', from: item.original_price, to: item.new_price });
                    }

                    // Update listing refresh timestamp
                    query.run(`
                        UPDATE listings SET last_refreshed_at = datetime('now')
                        WHERE id = ?
                    `, [item.listing_id]);

                    // Mark as completed
                    query.run(`
                        UPDATE relisting_queue
                        SET status = 'completed', processed_at = datetime('now'), changes_made = ?
                        WHERE id = ?
                    `, [JSON.stringify(changes), item.id]);

                    // Track performance
                    const perfId = uuidv4();
                    query.run(`
                        INSERT INTO relisting_performance (
                            id, user_id, listing_id, relist_queue_id,
                            price_before, views_before, likes_before, days_without_sale, price_after
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [perfId, user.id, item.listing_id, item.id,
                        item.original_price, item.views_before, item.likes_before,
                        item.days_listed, item.new_price]);

                    results.push({ id: item.id, status: 'completed', changes });
                } catch (error) {
                    query.run(`
                        UPDATE relisting_queue SET status = 'failed', error_message = ?
                        WHERE id = ?
                    `, [error.message, item.id]);
                    results.push({ id: item.id, status: 'failed', error: error.message });
                }
            }

            return {
                status: 200,
                data: {
                    message: `Processed ${results.length} item(s)`,
                    results
                }
            };
        } catch (error) {
            logger.error('[Relisting] Error processing relist queue', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/relisting/queue/:id - Remove from queue
    const deleteQueueMatch = path.match(/^\/queue\/([a-f0-9-]+)$/i);
    if (method === 'DELETE' && deleteQueueMatch) {
        try {
            const result = query.run(
                'DELETE FROM relisting_queue WHERE id = ? AND user_id = ? AND status = ?',
                [deleteQueueMatch[1], user.id, 'pending']
            );

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Queue item not found or already processed' } };
            }

            return { status: 200, data: { message: 'Removed from queue' } };
        } catch (error) {
            logger.error('[Relisting] Error removing item from relist queue', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ============================================
    // Performance Analytics
    // ============================================

    // GET /api/relisting/performance - Get relisting performance stats
    if (method === 'GET' && path === '/performance') {
        try {
            const { days = 30 } = queryParams;

            const stats = query.get(`
                SELECT
                    COUNT(*) as total_relisted,
                    SUM(CASE WHEN sold = 1 THEN 1 ELSE 0 END) as sold_after_relist,
                    AVG(CASE WHEN sold = 1 THEN days_to_sale END) as avg_days_to_sale,
                    AVG(price_after - price_before) as avg_price_change,
                    SUM(CASE WHEN price_after < price_before THEN 1 ELSE 0 END) as price_reductions,
                    AVG(views_after - views_before) as avg_view_increase
                FROM relisting_performance
                WHERE user_id = ? AND relisted_at >= datetime('now', '-' || ? || ' days')
            `, [user.id, days]);

            const recentPerformance = query.all(`
                SELECT rp.*, i.title, i.brand
                FROM relisting_performance rp
                JOIN listings l ON rp.listing_id = l.id
                JOIN inventory i ON l.inventory_id = i.id
                WHERE rp.user_id = ?
                ORDER BY rp.relisted_at DESC
                LIMIT 20
            `, [user.id]);

            return {
                status: 200,
                data: {
                    stats: {
                        total_relisted: stats.total_relisted || 0,
                        sold_after_relist: stats.sold_after_relist || 0,
                        conversion_rate: stats.total_relisted > 0
                            ? Math.round((stats.sold_after_relist / stats.total_relisted) * 100)
                            : 0,
                        avg_days_to_sale: Math.round(stats.avg_days_to_sale) || null,
                        avg_price_change: Math.round(stats.avg_price_change * 100) / 100 || 0,
                        price_reductions: stats.price_reductions || 0,
                        avg_view_increase: Math.round(stats.avg_view_increase) || 0
                    },
                    recent: recentPerformance
                }
            };
        } catch (error) {
            logger.error('[Relisting] Error fetching relisting performance stats', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/relisting/preview-price - Preview price adjustment
    if (method === 'POST' && path === '/preview-price') {
        try {
            const { listing_id, rule_id } = body;

            const listing = query.get(`
                SELECT l.*, i.title, i.brand, i.category, i.list_price, i.cost
                FROM listings l
                JOIN inventory i ON l.inventory_id = i.id
                WHERE l.id = ? AND l.user_id = ?
            `, [listing_id, user.id]);

            if (!listing) {
                return { status: 404, data: { error: 'Listing not found' } };
            }

            let rule = null;
            if (rule_id) {
                rule = query.get('SELECT * FROM relisting_rules WHERE id = ? AND user_id = ?', [rule_id, user.id]);
            }

            const result = calculateNewPrice(listing, rule);

            // Also get AI prediction
            const aiPrice = predictPrice({
                brand: listing.brand,
                category: listing.category,
                condition: listing.condition
            });

            return {
                status: 200,
                data: {
                    current_price: listing.list_price,
                    new_price: result.price,
                    change: result.price - listing.list_price,
                    change_percent: Math.round(((result.price - listing.list_price) / listing.list_price) * 100),
                    reason: result.reason,
                    ai_suggested_price: aiPrice,
                    price_floor: listing.cost ? listing.cost * 1.2 : listing.list_price * 0.5
                }
            };
        } catch (error) {
            logger.error('[Relisting] Error previewing price adjustment', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/relisting/auto-schedule - Auto-schedule relisting with price adjustments
    if (method === 'POST' && path === '/auto-schedule') {
        try {
            const { rule_id, dry_run } = body;

            // Get rule (or default)
            let rule;
            if (rule_id) {
                rule = query.get('SELECT * FROM relisting_rules WHERE id = ? AND user_id = ?', [rule_id, user.id]);
            } else {
                rule = query.get('SELECT * FROM relisting_rules WHERE user_id = ? AND is_default = 1', [user.id]);
            }

            if (!rule) {
                return { status: 400, data: { error: 'No relisting rule found. Create a rule first.' } };
            }

            // Parse rule JSON fields
            if (rule.tiered_reductions) rule.tiered_reductions = safeJsonParse(rule.tiered_reductions, null);
            if (rule.categories) rule.categories = safeJsonParse(rule.categories, null);
            if (rule.platforms) rule.platforms = safeJsonParse(rule.platforms, null);

            // Find eligible stale listings
            const threshold = rule.stale_days || 30;
            let staleSQL = `
                SELECT l.*, i.title, i.brand, i.category, i.list_price, i.cost, i.condition
                FROM listings l
                JOIN inventory i ON l.inventory_id = i.id
                WHERE l.user_id = ? AND l.status = 'active'
                AND julianday('now') - julianday(COALESCE(l.last_refreshed_at, l.listed_at, l.created_at)) >= ?
            `;
            const staleParams = [user.id, threshold];

            if (rule.categories && rule.categories.length > 0) {
                staleSQL += ` AND i.category IN (${rule.categories.map(() => '?').join(',')})`;
                staleParams.push(...rule.categories);
            }
            if (rule.platforms && rule.platforms.length > 0) {
                staleSQL += ` AND l.platform IN (${rule.platforms.map(() => '?').join(',')})`;
                staleParams.push(...rule.platforms);
            }

            staleSQL += ' ORDER BY julianday(COALESCE(l.last_refreshed_at, l.listed_at, l.created_at)) ASC LIMIT 100';
            const staleListings = query.all(staleSQL, staleParams);

            const results = [];
            let applied = 0;
            let skipped = 0;

            for (const listing of staleListings) {
                const priceResult = calculateNewPrice(listing, rule);
                const entry = {
                    listing_id: listing.id,
                    title: listing.title,
                    platform: listing.platform,
                    current_price: listing.list_price,
                    new_price: priceResult.price,
                    change: priceResult.price - listing.list_price,
                    reason: priceResult.reason
                };

                if (!dry_run && priceResult.price !== listing.list_price) {
                    // Apply the price change
                    query.run('UPDATE listings SET price = ?, updated_at = datetime(\'now\'), last_refreshed_at = datetime(\'now\') WHERE id = ?',
                        [priceResult.price, listing.id]);
                    // Update inventory price too
                    query.run('UPDATE inventory SET list_price = ?, updated_at = datetime(\'now\') WHERE id = ?',
                        [priceResult.price, listing.inventory_id]);
                    entry.status = 'applied';
                    applied++;
                } else if (!dry_run) {
                    entry.status = 'no_change';
                    skipped++;
                } else {
                    entry.status = 'preview';
                }

                results.push(entry);
            }

            return {
                status: 200,
                data: {
                    rule_name: rule.name,
                    dry_run: !!dry_run,
                    total_eligible: staleListings.length,
                    applied,
                    skipped,
                    results
                }
            };
        } catch (error) {
            logger.error('[Relisting] Error running auto-schedule', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/relisting/schedule-preview - Preview what auto-schedule would do
    if (method === 'GET' && path === '/schedule-preview') {
        try {
            const defaultRule = query.get('SELECT * FROM relisting_rules WHERE user_id = ? AND is_default = 1', [user.id]);
            const threshold = defaultRule ? (defaultRule.stale_days || 30) : 30;

            const eligible = query.all(`
                SELECT l.id, l.platform, l.price, i.title, i.list_price,
                       julianday('now') - julianday(COALESCE(l.last_refreshed_at, l.listed_at, l.created_at)) as days_stale
                FROM listings l
                JOIN inventory i ON l.inventory_id = i.id
                WHERE l.user_id = ? AND l.status = 'active'
                AND julianday('now') - julianday(COALESCE(l.last_refreshed_at, l.listed_at, l.created_at)) >= ?
                ORDER BY days_stale DESC LIMIT 20
            `, [user.id, threshold]);

            return {
                status: 200,
                data: {
                    rule: defaultRule ? { id: defaultRule.id, name: defaultRule.name, strategy: defaultRule.price_strategy } : null,
                    eligible_count: eligible.length,
                    threshold_days: threshold,
                    preview: eligible.map(l => ({
                        ...l,
                        days_stale: Math.round(l.days_stale)
                    }))
                }
            };
        } catch (error) {
            logger.error('[Relisting] Error fetching schedule preview', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}

// Helper function to calculate new price based on rule
function calculateNewPrice(listing, rule) {
    if (!rule) {
        return { price: listing.list_price, reason: 'No rule applied' };
    }

    const currentPrice = listing.list_price;
    const cost = listing.cost || 0;
    const floor = currentPrice * (rule.price_floor_percentage / 100);

    let newPrice = currentPrice;
    let reason = '';

    switch (rule.price_strategy) {
        case 'fixed':
            newPrice = currentPrice - rule.price_reduction_amount;
            reason = `Fixed reduction of $${rule.price_reduction_amount}`;
            break;

        case 'percentage':
            const reduction = currentPrice * (rule.price_reduction_amount / 100);
            newPrice = currentPrice - reduction;
            reason = `${rule.price_reduction_amount}% reduction`;
            break;

        case 'tiered':
            if (rule.tiered_reductions) {
                const tiers = typeof rule.tiered_reductions === 'string'
                    ? safeJsonParse(rule.tiered_reductions, [])
                    : rule.tiered_reductions;

                const daysListed = Math.floor(
                    (Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24)
                );

                let totalReduction = 0;
                for (const tier of tiers.sort((a, b) => a.days - b.days)) {
                    if (daysListed >= tier.days) {
                        totalReduction = tier.reduction;
                    }
                }

                newPrice = currentPrice * (1 - totalReduction / 100);
                reason = `Tiered reduction: ${totalReduction}% after ${daysListed} days`;
            }
            break;

        case 'prediction':
            newPrice = predictPrice({
                brand: listing.brand,
                category: listing.category,
                condition: listing.condition
            });
            reason = 'AI-predicted optimal price';
            break;
    }

    // Apply floor
    if (newPrice < floor) {
        newPrice = floor;
        reason += ` (limited by ${rule.price_floor_percentage}% floor)`;
    }

    // Ensure profit if cost known
    if (cost > 0 && newPrice < cost * 1.1) {
        newPrice = cost * 1.1;
        reason += ' (minimum 10% profit margin)';
    }

    return {
        price: Math.round(newPrice * 100) / 100,
        reason
    };
}
