// Extension API Routes
// Handles scraped products, price tracking, and sync queue for Chrome Extension

import crypto from 'crypto';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { applyRateLimit } from '../middleware/rateLimiter.js';
import { safeJsonParse } from '../shared/utils.js';

function isPrivateExtUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        if (!['https:', 'http:'].includes(parsed.protocol)) return true;
        const h = parsed.hostname.toLowerCase();
        return h === 'localhost' || h === '::1' || h === '0.0.0.0' ||
            /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|127\.)/.test(h) ||
            h.startsWith('fe80:') || h.startsWith('fc00:') || h.startsWith('fd00:') ||
            h.startsWith('::ffff:') || h.endsWith('.internal') || h.endsWith('.local');
    } catch {
        return true;
    }
}


/**
 * Extension router
 */
export async function extensionRouter(ctx) {
    try {
    const { method, path, body, query: queryParams, user } = ctx;

    // Rate limit all extension endpoints (EXT-26)
    const rateLimitError = await applyRateLimit(ctx, 'api');
    if (rateLimitError) return rateLimitError;

    // POST /api/extension/auth/verify - Verify extension token
    if (method === 'POST' && path === '/auth/verify') {
        // Token already validated by auth middleware if we reach here
        if (user) {
            return {
                status: 200,
                data: { valid: true, user: { id: user.id, email: user.email } }
            };
        }
        return {
            status: 401,
            data: { valid: false, error: 'Invalid token' }
        };
    }

    // POST /api/extension/scrape - Save scraped product (alias for /scraped)
    if (method === 'POST' && path === '/scrape') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        const { url, site, productData } = body;

        if (!productData) {
            return {
                status: 400,
                data: { error: 'productData is required' }
            };
        }

        if (url && isPrivateExtUrl(url)) {
            return { status: 400, data: { error: 'url must be a public HTTP/HTTPS address' } };
        }

        try {
            const productId = `scraped_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            await query.run(
                `INSERT INTO scraped_products (id, user_id, title, price, images, brand, description, category, source_site, source_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    productId,
                    user.id,
                    productData.title || 'Untitled',
                    productData.price || null,
                    productData.images ? JSON.stringify(productData.images) : '[]',
                    productData.brand || null,
                    productData.description || null,
                    productData.category || null,
                    site || 'unknown',
                    url || null
                ]
            );

            const product = await query.get(
                `SELECT * FROM scraped_products WHERE id = ?`,
                [productId]
            );

            product.images = safeJsonParse(product.images, []);

            return {
                status: 201,
                data: { product }
            };
        } catch (error) {
            logger.error('[Extension] error saving scraped product', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to save product' }
            };
        }
    }

    // POST /api/extension/price-tracking - Add price tracking (alias for /price-track)
    if (method === 'POST' && path === '/price-tracking') {
        if (!user) return { status: 401, data: { error: 'Authentication required' } };

        const { url, site, productTitle, currentPrice, targetPrice } = body;

        if (!productTitle || !url || !currentPrice) {
            return {
                status: 400,
                data: { error: 'productTitle, url, and currentPrice are required' }
            };
        }

        // Validate price is a positive number
        const priceNum = parseFloat(currentPrice);
        if (isNaN(priceNum) || priceNum <= 0) {
            return {
                status: 400,
                data: { error: 'currentPrice must be a positive number' }
            };
        }

        // Validate target price if provided
        if (targetPrice !== undefined && targetPrice !== null) {
            const targetNum = parseFloat(targetPrice);
            if (isNaN(targetNum) || targetNum <= 0) {
                return {
                    status: 400,
                    data: { error: 'targetPrice must be a positive number' }
                };
            }
        }

        try {
            const trackingId = `track_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            await query.run(
                `INSERT INTO price_tracking (id, user_id, title, listing_url, current_price, alert_threshold, platform, alert_on_price_drop)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                    trackingId,
                    user.id,
                    productTitle,
                    url,
                    currentPrice,
                    targetPrice || currentPrice * 0.9,
                    site || 'unknown'
                ]
            );

            const tracking = await query.get(
                `SELECT * FROM price_tracking WHERE id = ? AND user_id = ?`,
                [trackingId, user.id]
            );

            return {
                status: 201,
                data: { tracking }
            };
        } catch (error) {
            logger.error('[Extension] error adding price tracking', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to add price tracking' }
            };
        }
    }

    // GET /api/extension/price-tracking - List price tracking
    if (method === 'GET' && path === '/price-tracking') {
        const { status, limit = 50, offset = 0 } = queryParams;

        try {
            let sql = `SELECT * FROM price_tracking WHERE user_id = ?`;
            const params = [user.id];

            if (status) {
                sql += ` AND status = ?`;
                params.push(status);
            }

            sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(Math.min(parseInt(limit) || 50, 200), parseInt(offset) || 0);

            const items = await query.all(sql, params);

            return {
                status: 200,
                data: { tracking: items }
            };
        } catch (error) {
            logger.error('[Extension] error fetching price tracking', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch tracking' }
            };
        }
    }

    // PATCH /api/extension/price-tracking/:id - Update price tracking
    if (method === 'PATCH' && path.startsWith('/price-tracking/') && path.split('/').length === 3) {
        const trackingId = path.split('/')[2];
        const { currentPrice, targetPrice } = body;

        try {
            const updates = [];
            const params = [];

            if (currentPrice !== undefined) {
                updates.push('current_price = ?');
                params.push(currentPrice);
            }

            if (targetPrice !== undefined) {
                updates.push('alert_threshold = ?');
                params.push(targetPrice);
            }

            updates.push('updated_at = NOW()');
            params.push(trackingId, user.id);

            await query.run(
                `UPDATE price_tracking SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
                params
            );

            const tracking = await query.get(
                `SELECT * FROM price_tracking WHERE id = ? AND user_id = ?`,
                [trackingId, user.id]
            );

            // Map schema fields to expected response fields
            if (tracking) {
                tracking.target_price = tracking.alert_threshold;
            }

            return {
                status: 200,
                data: { tracking }
            };
        } catch (error) {
            logger.error('[Extension] error updating price tracking', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to update tracking' }
            };
        }
    }

    // DELETE /api/extension/price-tracking/:id - Delete price tracking
    if (method === 'DELETE' && path.startsWith('/price-tracking/') && path.split('/').length === 3) {
        const trackingId = path.split('/')[2];

        try {
            await query.run(
                `DELETE FROM price_tracking WHERE id = ? AND user_id = ?`,
                [trackingId, user.id]
            );

            return {
                status: 200,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Extension] error deleting price tracking', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to delete tracking' }
            };
        }
    }

    // POST /api/extension/quick-add - Quick add item to inventory
    if (method === 'POST' && path === '/quick-add') {
        if (!user) return { status: 401, data: { error: 'Authentication required' } };

        const { title, price, brand, images, description, category } = body;

        if (!title) {
            return {
                status: 400,
                data: { error: 'title is required' }
            };
        }

        try {
            const itemId = `inv_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
            const sku = `QA-${Date.now().toString(36).toUpperCase()}`;

            await query.run(
                `INSERT INTO inventory (id, user_id, title, sku, brand, description, category, cost_price, list_price, quantity, status, images)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?)`,
                [
                    itemId,
                    user.id,
                    title,
                    sku,
                    brand || null,
                    description || null,
                    category || 'Other',
                    price || 0,
                    price || 0,
                    images ? JSON.stringify(images) : '[]'
                ]
            );

            const item = await query.get(`SELECT * FROM inventory WHERE id = ?`, [itemId]);

            item.images = safeJsonParse(item.images, []);

            return {
                status: 201,
                data: { item }
            };
        } catch (error) {
            logger.error('[Extension] error quick adding item', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to add item' }
            };
        }
    }

    // GET /api/extension/autofill/:itemId - Get autofill data for item
    if (method === 'GET' && path.startsWith('/autofill/') && path.split('/').length === 3) {
        const itemId = path.split('/')[2];

        try {
            const item = await query.get(
                `SELECT * FROM inventory WHERE id = ? AND user_id = ?`,
                [itemId, user.id]
            );

            if (!item) {
                return {
                    status: 404,
                    data: { error: 'Item not found' }
                };
            }

            // Parse JSON fields
            item.images = safeJsonParse(item.images, []);

            return {
                status: 200,
                data: {
                    title: item.title,
                    brand: item.brand,
                    description: item.description,
                    price: item.list_price,
                    category: item.category,
                    images: item.images,
                    size: item.size,
                    color: item.color,
                    condition: item.condition
                }
            };
        } catch (error) {
            logger.error('[Extension] error getting autofill data', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to get autofill data' }
            };
        }
    }

    // POST /api/extension/scraped - Save scraped product
    if (method === 'POST' && path === '/scraped') {
        if (!user) return { status: 401, data: { error: 'Authentication required' } };

        const { title, price, images, brand, description, category, source, sourceUrl } = body;

        if (!title || !source) {
            return {
                status: 400,
                data: { error: 'title and source are required' }
            };
        }

        try {
            const productId = `scraped_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            await query.run(
                `INSERT INTO scraped_products (id, user_id, title, price, images, brand, description, category, source_site, source_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    productId,
                    user.id,
                    title,
                    price || null,
                    images ? JSON.stringify(images) : '[]',
                    brand || null,
                    description || null,
                    category || null,
                    source,
                    sourceUrl || null
                ]
            );

            const product = await query.get(
                `SELECT * FROM scraped_products WHERE id = ?`,
                [productId]
            );

            // Parse JSON field
            product.images = safeJsonParse(product.images, []);

            return {
                status: 201,
                data: { success: true, product }
            };
        } catch (error) {
            logger.error('[Extension] error saving scraped product', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to save product' }
            };
        }
    }

    // GET /api/extension/scraped - List scraped products
    if (method === 'GET' && path === '/scraped') {
        const { source, limit = 50, offset = 0 } = queryParams;

        try {
            let sql = `
                SELECT * FROM scraped_products
                WHERE user_id = ?
            `;
            const params = [user.id];

            if (source) {
                sql += ` AND source_site = ?`;
                params.push(source);
            }

            sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(Math.min(parseInt(limit) || 50, 200), parseInt(offset) || 0);

            const items = await query.all(sql, params);

            // Parse JSON fields
            items.forEach(item => {
                item.images = safeJsonParse(item.images, []);
            });

            // Get total count
            const countSql = source
                ? `SELECT COUNT(*) as count FROM scraped_products WHERE user_id = ? AND source_site = ?`
                : `SELECT COUNT(*) as count FROM scraped_products WHERE user_id = ?`;
            const countParams = source ? [user.id, source] : [user.id];
            const countResult = await query.get(countSql, countParams);

            return {
                status: 200,
                data: {
                    items,
                    count: countResult.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            };
        } catch (error) {
            logger.error('[Extension] error fetching scraped products', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch products' }
            };
        }
    }

    // DELETE /api/extension/scraped/:id - Delete scraped product
    if (method === 'DELETE' && path.startsWith('/scraped/') && path.split('/').length === 3) {
        const productId = path.split('/')[2];

        try {
            await query.run(
                `DELETE FROM scraped_products WHERE id = ? AND user_id = ?`,
                [productId, user.id]
            );

            return {
                status: 200,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Extension] error deleting scraped product', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to delete product' }
            };
        }
    }

    // POST /api/extension/price-track - Add price tracking
    if (method === 'POST' && path === '/price-track') {
        const { productName, sourceUrl, currentPrice, targetPrice, source } = body;

        if (!productName || !sourceUrl || !currentPrice) {
            return {
                status: 400,
                data: { error: 'productName, sourceUrl, and currentPrice are required' }
            };
        }

        if (isPrivateExtUrl(sourceUrl)) {
            return { status: 400, data: { error: 'sourceUrl must be a public HTTP/HTTPS address' } };
        }

        try {
            const trackingId = `track_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            await query.run(
                `INSERT INTO price_tracking (id, user_id, product_name, source_url, current_price, target_price, source, status, last_checked_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
                [
                    trackingId,
                    user.id,
                    productName,
                    sourceUrl,
                    currentPrice,
                    targetPrice || currentPrice * 0.9, // Default 10% discount
                    source || 'Unknown'
                ]
            );

            const tracking = await query.get(
                `SELECT * FROM price_tracking WHERE id = ? AND user_id = ?`,
                [trackingId, user.id]
            );

            return {
                status: 201,
                data: { success: true, tracking }
            };
        } catch (error) {
            logger.error('[Extension] error adding price tracking', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to add price tracking' }
            };
        }
    }

    // GET /api/extension/price-track - List price tracking
    if (method === 'GET' && path === '/price-track') {
        const { status, limit = 50, offset = 0 } = queryParams;

        try {
            let sql = `
                SELECT * FROM price_tracking
                WHERE user_id = ?
            `;
            const params = [user.id];

            if (status) {
                sql += ` AND status = ?`;
                params.push(status);
            }

            sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(Math.min(parseInt(limit) || 50, 200), parseInt(offset) || 0);

            const items = await query.all(sql, params);

            // Get total count
            const countSql = status
                ? `SELECT COUNT(*) as count FROM price_tracking WHERE user_id = ? AND status = ?`
                : `SELECT COUNT(*) as count FROM price_tracking WHERE user_id = ?`;
            const countParams = status ? [user.id, status] : [user.id];
            const countResult = await query.get(countSql, countParams);

            return {
                status: 200,
                data: {
                    items,
                    count: countResult.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            };
        } catch (error) {
            logger.error('[Extension] error fetching price tracking', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch tracking' }
            };
        }
    }

    // PATCH /api/extension/price-track/:id - Update price tracking
    if (method === 'PATCH' && path.startsWith('/price-track/') && path.split('/').length === 3) {
        const trackingId = path.split('/')[2];
        const { currentPrice, status, targetPrice } = body;

        try {
            const updates = [];
            const params = [];

            if (currentPrice !== undefined) {
                updates.push('current_price = ?');
                params.push(currentPrice);
            }

            if (status) {
                updates.push('status = ?');
                params.push(status);
            }

            if (targetPrice !== undefined) {
                updates.push('target_price = ?');
                params.push(targetPrice);
            }

            updates.push('last_checked_at = NOW()');

            params.push(trackingId, user.id);

            await query.run(
                `UPDATE price_tracking SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
                params
            );

            const tracking = await query.get(
                `SELECT * FROM price_tracking WHERE id = ? AND user_id = ?`,
                [trackingId, user.id]
            );

            return {
                status: 200,
                data: { success: true, tracking }
            };
        } catch (error) {
            logger.error('[Extension] error updating price tracking', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to update tracking' }
            };
        }
    }

    // DELETE /api/extension/price-track/:id - Delete price tracking
    if (method === 'DELETE' && path.startsWith('/price-track/') && path.split('/').length === 3) {
        const trackingId = path.split('/')[2];

        try {
            await query.run(
                `DELETE FROM price_tracking WHERE id = ? AND user_id = ?`,
                [trackingId, user.id]
            );

            return {
                status: 200,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Extension] error deleting price tracking', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to delete tracking' }
            };
        }
    }

    // POST /api/extension/sync - Add to sync queue
    if (method === 'POST' && path === '/sync') {

        const { action_type, data } = body;

        const ALLOWED_ACTION_TYPES = ['add_inventory', 'update_price', 'cross_list', 'delete_listing', 'sync_sale'];
        if (!action_type || !ALLOWED_ACTION_TYPES.includes(action_type)) {
            return {
                status: 400,
                data: { error: `action_type must be one of: ${ALLOWED_ACTION_TYPES.join(', ')}` }
            };
        }

        try {
            const syncId = `sync_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            await query.run(
                `INSERT INTO extension_sync_queue (id, user_id, action, payload, status)
                 VALUES (?, ?, ?, ?, 'pending')`,
                [syncId, user.id, action_type, data ? JSON.stringify(data) : '{}']
            );

            const item = await query.get(
                `SELECT * FROM extension_sync_queue WHERE id = ?`,
                [syncId]
            );

            if (item.payload) {
                item.data = safeJsonParse(item.payload, {});
            }

            return {
                status: 201,
                data: { success: true, item }
            };
        } catch (error) {
            logger.error('[Extension] error adding to sync queue', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to add to sync queue' }
            };
        }
    }

    // GET /api/extension/sync - Get sync queue
    if (method === 'GET' && path === '/sync') {
        const { status, limit = 50 } = queryParams;

        try {
            let sql = `
                SELECT * FROM extension_sync_queue
                WHERE user_id = ?
            `;
            const params = [user.id];

            if (status) {
                sql += ` AND status = ?`;
                params.push(status);
            }

            sql += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(Math.min(parseInt(limit) || 50, 200));

            const items = await query.all(sql, params);

            // Parse JSON fields
            items.forEach(item => {
                if (item.payload) {
                    item.data = safeJsonParse(item.payload, {});
                }
            });

            return {
                status: 200,
                data: { items }
            };
        } catch (error) {
            logger.error('[Extension] error fetching sync queue', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch sync queue' }
            };
        }
    }

    // POST /api/extension/sync/:id/process - Process sync item
    if (method === 'POST' && path.match(/^\/sync\/[a-zA-Z0-9_-]+\/process$/)) {
        const syncId = path.split('/')[2];

        try {
            await query.run(
                `UPDATE extension_sync_queue SET status = 'completed', processed_at = NOW()
                 WHERE id = ? AND user_id = ?`,
                [syncId, user.id]
            );

            return {
                status: 200,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Extension] error processing sync item', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to process item' }
            };
        }
    }

    // POST /api/extension/sync/:id/result - Report cross-list result from extension
    if (method === 'POST' && path.match(/^\/sync\/[a-zA-Z0-9_-]+\/result$/)) {
        if (!user) return { status: 401, data: { error: 'Authentication required' } };

        const syncId = path.split('/')[2];
        const { success, platform, listingUrl, error: resultError } = body;

        if (typeof success !== 'boolean') {
            return { status: 400, data: { error: 'success (boolean) is required' } };
        }

        try {
            // Verify ownership
            const syncItem = await query.get(
                `SELECT * FROM extension_sync_queue WHERE id = $1 AND user_id = $2`,
                [syncId, user.id]
            );

            if (!syncItem) {
                return { status: 404, data: { error: 'Sync item not found' } };
            }

            const newStatus = success ? 'completed' : 'failed';
            await query.run(
                `UPDATE extension_sync_queue
                 SET status = $1, processed_at = NOW(), result = $2
                 WHERE id = $3 AND user_id = $4`,
                [newStatus, JSON.stringify({ listingUrl, error: resultError }), syncId, user.id]
            );

            // If successful and we have a listing URL, create a listing record
            if (success && listingUrl && platform) {
                const payload = safeJsonParse(syncItem.payload, {});
                const inventoryItemId = payload.inventory_item_id || null;

                if (inventoryItemId) {
                    const listingId = `lst_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
                    const title = safeJsonParse(syncItem.payload, {})?.listing_data?.title || 'Cross-listed item';
                    await query.run(
                        `INSERT INTO listings (id, user_id, inventory_id, platform, title, status, platform_url, listed_at)
                         VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW())
                         ON CONFLICT DO NOTHING`,
                        [listingId, user.id, inventoryItemId, platform, title, listingUrl]
                    );
                }
            }

            return {
                status: 200,
                data: { success: true, status: newStatus }
            };
        } catch (error) {
            logger.error('[Extension] error reporting sync result', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to update sync result' }
            };
        }
    }

    // POST /api/extension/share-closet - Queue a Poshmark closet share job for the extension
    if (method === 'POST' && path === '/share-closet') {
        const { max_listings = 50, delay_ms = 3000 } = body;

        try {
            const shop = await query.get(
                `SELECT platform_username FROM shops
                 WHERE user_id = ? AND platform = 'poshmark' AND is_connected = TRUE
                 LIMIT 1`,
                [user.id]
            );

            if (!shop || !shop.platform_username) {
                return { status: 422, data: { error: 'No connected Poshmark account found. Connect your Poshmark account in My Shops first.' } };
            }

            // Poshmark usernames are [a-zA-Z0-9_-]; no percent-encoding needed.
            // encodeURIComponent would mangle hyphens (%2D) which Poshmark rejects.
            // Support both poshmark.com and poshmark.ca (Canadian users)
            const poshDomain = process.env.POSHMARK_DOMAIN || 'poshmark.com';
            const closetUrl = `https://${poshDomain}/closet/${shop.platform_username}`;
            const syncId = `share_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            await query.run(
                `INSERT INTO extension_sync_queue (id, user_id, action, payload, status)
                 VALUES (?, ?, 'share_closet', ?, 'pending')`,
                [syncId, user.id, JSON.stringify({ closet_url: closetUrl, max_listings, delay_ms })]
            );

            return { status: 201, data: { success: true, syncId, closetUrl, max_listings, delay_ms } };
        } catch (error) {
            logger.error('[Extension] error queuing share-closet job', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to queue closet share job' } };
        }
    }

    // POST /api/extension/report-sale - Record a detected sale from the extension
    // Deduplicates by platform_order_id so the extension can safely call this on every page load.
    if (method === 'POST' && path === '/report-sale') {
        const {
            platform_order_id,
            platform = 'poshmark',
            title,
            sale_price,
            buyer_username,
            listing_url
        } = body;

        if (!platform_order_id || !sale_price) {
            return { status: 400, data: { error: 'platform_order_id and sale_price are required' } };
        }

        const parsedPrice = parseFloat(sale_price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            return { status: 400, data: { error: 'sale_price must be a positive number' } };
        }

        try {
            // Check for duplicate
            const existing = await query.get(
                `SELECT id FROM sales WHERE user_id = ? AND platform_order_id = ? LIMIT 1`,
                [user.id, platform_order_id]
            );
            if (existing) {
                return { status: 200, data: { success: true, duplicate: true, saleId: existing.id } };
            }

            // Try to match a listing by platform URL so we can link inventory
            let listingId = null;
            let inventoryId = null;
            if (listing_url) {
                const listing = await query.get(
                    `SELECT id, inventory_id FROM listings WHERE user_id = ? AND platform_url = ? LIMIT 1`,
                    [user.id, listing_url]
                );
                if (listing) {
                    listingId = listing.id;
                    inventoryId = listing.inventory_id || null;
                }
            }

            const saleId = `sale_ext_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
            await query.run(
                `INSERT INTO sales (id, user_id, listing_id, inventory_id, platform, platform_order_id,
                    buyer_username, sale_price, platform_fee, shipping_cost, customer_shipping_cost,
                    seller_shipping_cost, item_cost, net_profit, notes, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?, 'pending')`,
                [saleId, user.id, listingId, inventoryId, platform, platform_order_id,
                    buyer_username || null, parsedPrice, parsedPrice,
                    title ? `Auto-detected via extension: ${title}` : 'Auto-detected via extension']
            );

            // Mark matched inventory as sold
            if (inventoryId) {
                await query.run(
                    `UPDATE inventory SET status = 'sold', updated_at = CURRENT_TIMESTAMP
                     WHERE id = ? AND user_id = ? AND status != 'sold'`,
                    [inventoryId, user.id]
                );
            }

            return { status: 201, data: { success: true, duplicate: false, saleId, listingId, inventoryId } };
        } catch (error) {
            logger.error('[Extension] error recording sale', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to record sale' } };
        }
    }

    // POST /api/extension/offer-to-likers - Queue an OTL job for a Poshmark listing
    if (method === 'POST' && path === '/offer-to-likers') {
        const { listing_url, offer_price, shipping_discount = 'standard' } = body;

        if (!listing_url || !offer_price) {
            return { status: 400, data: { error: 'listing_url and offer_price are required' } };
        }
        const parsedOffer = parseFloat(offer_price);
        if (isNaN(parsedOffer) || parsedOffer <= 0) {
            return { status: 400, data: { error: 'offer_price must be a positive number' } };
        }
        if (!/^https:\/\/poshmark\.(com|ca)\/listing\//.test(listing_url)) {
            return { status: 400, data: { error: 'listing_url must be a Poshmark listing URL' } };
        }

        try {
            // Ownership check: must be a listing the user has cross-listed through VaultLister
            const owned = await query.get(
                `SELECT id FROM listings WHERE user_id = ? AND platform_url = ? LIMIT 1`,
                [user.id, listing_url]
            );
            if (!owned) {
                return { status: 422, data: { error: 'No matching listing found for this URL in your account. Only listings cross-listed through VaultLister can use OTL.' } };
            }

            const syncId = `otl_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
            await query.run(
                `INSERT INTO extension_sync_queue (id, user_id, action, payload, status)
                 VALUES (?, ?, 'offer_to_likers', ?, 'pending')`,
                [syncId, user.id, JSON.stringify({ listing_url, offer_price: parsedOffer, shipping_discount })]
            );
            return { status: 201, data: { success: true, syncId, listing_url, offer_price: parsedOffer, shipping_discount } };
        } catch (error) {
            logger.error('[Extension] error queuing OTL job', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to queue OTL job' } };
        }
    }

    return {
        status: 404,
        data: { error: 'Not found' }
    };
    } catch (error) {
        logger.error('[Extension] Unhandled route error', { path: ctx.path, method: ctx.method, error: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}
