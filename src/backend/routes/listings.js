// Listings Routes
import { v4 as uuidv4 } from 'uuid';
import { query, escapeLike } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { publishListingToEbay } from '../services/platformSync/ebayPublish.js';
import { publishListingToEtsy } from '../services/platformSync/etsyPublish.js';
import { publishListingToPoshmark } from '../services/platformSync/poshmarkPublish.js';
import { publishListingToMercari } from '../services/platformSync/mercariPublish.js';
import { publishListingToDepop } from '../services/platformSync/depopPublish.js';
import { publishListingToGrailed } from '../services/platformSync/grailedPublish.js';
import { publishListingToFacebook } from '../services/platformSync/facebookPublish.js';
import { publishListingToWhatnot } from '../services/platformSync/whatnotPublish.js';
import { publishListingToShopify } from '../services/platformSync/shopifyPublish.js';

/**
 * Safe JSON parse helper — returns fallback on malformed data instead of throwing
 */
function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

// Defense-in-depth: whitelist for dynamic listing update fields
const ALLOWED_LISTING_FIELDS = new Set([
    'title', 'description', 'price', 'original_price', 'shipping_price',
    'category_path', 'condition_tag', 'status', 'platform_listing_id',
    'platform_url', 'folder_id'
]);
const ALLOWED_FOLDER_FIELDS = new Set(['name', 'color', 'icon']);
const ALLOWED_STALENESS_FIELDS = new Set(['stalenessDays', 'autoRelistEnabled']);
// TECH-DEBT: Migrate error responses to AppError classes (errorHandler.js)

export async function listingsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/listings/folders - List all folders with pagination
    if (method === 'GET' && path === '/folders') {
        try {
            const { limit = 50, offset = 0, search } = queryParams;
            const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
            const offsetNum = Math.max(parseInt(offset) || 0, 0);

            let sql = 'SELECT * FROM listings_folders WHERE user_id = ?';
            const params = [user.id];

            if (search) {
                sql += ` AND name LIKE ? ESCAPE '\\'`;
                params.push(`%${escapeLike(search)}%`);
            }

            // Get total count
            const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
            const countResult = query.get(countSql, params);
            const total = countResult?.count || 0;

            sql += ' ORDER BY name LIMIT ? OFFSET ?';
            params.push(limitNum, offsetNum);

            const folders = query.all(sql, params);

            return {
                status: 200,
                data: {
                    folders,
                    total,
                    limit: limitNum,
                    offset: offsetNum,
                    hasMore: offsetNum + folders.length < total
                }
            };
        } catch (error) {
            logger.error('[Listings] Error fetching folders', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/listings/folders - Create folder
    if (method === 'POST' && path === '/folders') {
        const { name, color, icon } = body;

        if (!name || !name.trim()) {
            return { status: 400, data: { error: 'Folder name required' } };
        }

        // Validate name length
        if (name.length > 100) {
            return { status: 400, data: { error: 'Folder name must be 100 characters or less' } };
        }

        // Validate color format if provided
        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return { status: 400, data: { error: 'Invalid color format. Use hex format (e.g., #FF5733)' } };
        }

        // Validate icon if provided
        const validIcons = ['folder', 'archive', 'bookmark', 'star', 'heart', 'tag', 'box', 'package', 'shopping-bag', 'gift'];
        if (icon && !validIcons.includes(icon)) {
            return { status: 400, data: { error: `Invalid icon. Choose from: ${validIcons.join(', ')}` } };
        }

        try {
            const id = uuidv4();

            query.run(
                `INSERT INTO listings_folders (id, user_id, name, color, icon) VALUES (?, ?, ?, ?, ?)`,
                [id, user.id, name.trim(), color || '#6366f1', icon || 'folder']
            );

            const folder = query.get('SELECT * FROM listings_folders WHERE id = ?', [id]);

            return { status: 201, data: folder };
        } catch (error) {
            logger.error('[Listings] Error creating folder', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PATCH /api/listings/folders/:id - Update folder
    if (method === 'PATCH' && path.match(/^\/folders\/[a-f0-9-]+$/)) {
        const folderId = path.split('/')[2];

        const existing = query.get(
            'SELECT * FROM listings_folders WHERE id = ? AND user_id = ?',
            [folderId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Folder not found' } };
        }

        const { name, color, icon } = body;
        const updates = [];
        const values = [];

        if (name !== undefined) {
            if (!name.trim() || name.length > 100) {
                return { status: 400, data: { error: 'Folder name must be 1-100 characters' } };
            }
            updates.push('name = ?');
            values.push(name.trim());
        }
        if (color !== undefined) {
            // Validate hex color format
            if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
                return { status: 400, data: { error: 'Invalid color format. Use hex format (e.g., #FF5733)' } };
            }
            updates.push('color = ?');
            values.push(color);
        }
        if (icon !== undefined) {
            // Validate icon against allowed list
            const validIcons = ['folder', 'archive', 'bookmark', 'star', 'heart', 'tag', 'box', 'package', 'shopping-bag', 'gift', null];
            if (icon && !validIcons.includes(icon)) {
                return { status: 400, data: { error: 'Invalid icon. Choose from: folder, archive, bookmark, star, heart, tag, box, package, shopping-bag, gift' } };
            }
            updates.push('icon = ?');
            values.push(icon);
        }

        if (updates.length > 0) {
            values.push(folderId, user.id);
            query.run(
                `UPDATE listings_folders SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                values
            );
        }

        const folder = query.get('SELECT * FROM listings_folders WHERE id = ?', [folderId]);

        return { status: 200, data: folder };
    }

    // DELETE /api/listings/folders/:id - Delete folder
    if (method === 'DELETE' && path.match(/^\/folders\/[a-f0-9-]+$/)) {
        const folderId = path.split('/')[2];

        const existing = query.get(
            'SELECT * FROM listings_folders WHERE id = ? AND user_id = ?',
            [folderId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Folder not found' } };
        }

        // Delete folder (listings will have folder_id set to NULL due to ON DELETE SET NULL)
        // SECURITY: Include user_id in DELETE to prevent TOCTOU race
        query.run('DELETE FROM listings_folders WHERE id = ? AND user_id = ?', [folderId, user.id]);

        return { status: 200, data: { message: 'Folder deleted' } };
    }

    // GET /api/listings - List all listings
    if (method === 'GET' && (path === '/' || path === '')) {
        const { platform, status, inventoryId, folderId, limit = 50, offset = 0 } = queryParams;

        let sql = 'SELECT l.*, i.title as inventory_title, i.images as inventory_images FROM listings l LEFT JOIN inventory i ON l.inventory_id = i.id WHERE l.user_id = ?';
        const params = [user.id];

        if (platform) {
            sql += ' AND l.platform = ?';
            params.push(platform);
        }

        if (status) {
            sql += ' AND l.status = ?';
            params.push(status);
        }

        if (inventoryId) {
            sql += ' AND l.inventory_id = ?';
            params.push(inventoryId);
        }

        if (folderId) {
            if (folderId === 'null' || folderId === 'none') {
                sql += ' AND l.folder_id IS NULL';
            } else {
                sql += ' AND l.folder_id = ?';
                params.push(folderId);
            }
        }

        sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
        const cappedLimit = Math.min(parseInt(limit) || 50, 100);
        const cappedOffset = Math.max(parseInt(offset) || 0, 0);
        params.push(cappedLimit, cappedOffset);

        const listings = query.all(sql, params);

        // SECURITY: JSON.parse with try-catch to handle malformed data
        listings.forEach(listing => {
            try { listing.images = JSON.parse(listing.images || '[]'); } catch { listing.images = []; }
            try { listing.inventory_images = JSON.parse(listing.inventory_images || '[]'); } catch { listing.inventory_images = []; }
            try { listing.platform_specific_data = JSON.parse(listing.platform_specific_data || '{}'); } catch { listing.platform_specific_data = {}; }
        });

        // Build COUNT query with same filters as main query
        let countSql = 'SELECT COUNT(*) as count FROM listings WHERE user_id = ?';
        const countParams = [user.id];

        if (platform) {
            countSql += ' AND platform = ?';
            countParams.push(platform);
        }

        if (status) {
            countSql += ' AND status = ?';
            countParams.push(status);
        }

        if (inventoryId) {
            countSql += ' AND inventory_id = ?';
            countParams.push(inventoryId);
        }

        if (folderId) {
            if (folderId === 'null' || folderId === 'none') {
                countSql += ' AND folder_id IS NULL';
            } else {
                countSql += ' AND folder_id = ?';
                countParams.push(folderId);
            }
        }

        const total = query.get(countSql, countParams)?.count || 0;

        return { status: 200, data: { listings, total } };
    }

    // GET /api/listings/:id - Get single listing
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);
        const listing = query.get(`
            SELECT l.*, i.* FROM listings l
            LEFT JOIN inventory i ON l.inventory_id = i.id
            WHERE l.id = ? AND l.user_id = ?
        `, [id, user.id]);

        if (!listing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        listing.images = safeJsonParse(listing.images, []);
        listing.platform_specific_data = safeJsonParse(listing.platform_specific_data, {});

        return { status: 200, data: { listing } };
    }

    // POST /api/listings - Create new listing
    if (method === 'POST' && (path === '/' || path === '')) {
        const { inventoryId, platform, title, description, price, originalPrice, shippingPrice, categoryPath, images, platformSpecificData, folderId } = body;

        if (!inventoryId || !platform || !title || !price) {
            return { status: 400, data: { error: 'Inventory ID, platform, title, and price required' } };
        }
        if (title.length > 500) return { status: 400, data: { error: 'Title must be 500 characters or less' } };
        if (description && description.length > 5000) return { status: 400, data: { error: 'Description must be 5000 characters or less' } };
        if (categoryPath && categoryPath.length > 300) return { status: 400, data: { error: 'Category path must be 300 characters or less' } };
        if (platformSpecificData !== undefined) {
            const psdJson = JSON.stringify(platformSpecificData);
            if (psdJson.length > 50000) return { status: 400, data: { error: 'Platform specific data exceeds maximum size' } };
        }

        // Check inventory item exists
        const item = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [inventoryId, user.id]);
        if (!item) {
            return { status: 404, data: { error: 'Inventory item not found' } };
        }

        const id = uuidv4();

        // Use atomic insert to prevent race condition - rely on unique constraint
        try {
            query.run(`
                INSERT INTO listings (
                    id, inventory_id, user_id, platform, title, description,
                    price, original_price, shipping_price, category_path, images,
                    platform_specific_data, status, folder_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, inventoryId, user.id, platform, title, description || item.description,
                price, originalPrice, shippingPrice || 0, categoryPath,
                JSON.stringify(images || safeJsonParse(item.images, [])),
                JSON.stringify(platformSpecificData || {}), 'draft', folderId || null
            ]);
        } catch (error) {
            // If unique constraint violation, listing already exists
            if (error.message && error.message.includes('UNIQUE constraint')) {
                const existingListing = query.get(
                    'SELECT id FROM listings WHERE inventory_id = ? AND platform = ? AND user_id = ?',
                    [inventoryId, platform, user.id]
                );
                return { status: 409, data: { error: 'Listing already exists for this platform', existingId: existingListing?.id } };
            }
            throw error;
        }

        const listing = query.get('SELECT * FROM listings WHERE id = ?', [id]);
        listing.images = safeJsonParse(listing.images, []);
        listing.platform_specific_data = safeJsonParse(listing.platform_specific_data, {});

        return { status: 201, data: { listing } };
    }

    // POST /api/listings/crosslist - Create listings for multiple platforms
    // Accepts both single inventoryId and bulk itemIds array
    if (method === 'POST' && path === '/crosslist') {
        const { inventoryId, itemIds, platforms, priceAdjustments, priceAdjustment } = body;

        // Support both single inventoryId and array of itemIds
        const inventoryIds = itemIds
            ? (Array.isArray(itemIds) ? itemIds : [itemIds])
            : (inventoryId ? [inventoryId] : []);

        if (inventoryIds.length === 0 || !platforms || !Array.isArray(platforms)) {
            return { status: 400, data: { error: 'Inventory ID(s) and platforms array required' } };
        }

        const results = { created: [], skipped: [], errors: [] };

        for (const invId of inventoryIds) {
            const item = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [invId, user.id]);
            if (!item) {
                results.errors.push({ inventoryId: invId, error: 'Inventory item not found' });
                continue;
            }

            for (const platform of platforms) {
                try {
                    const id = uuidv4();
                    let price = item.list_price;

                    // Validate that we have a valid price from inventory
                    if (!price || price <= 0) {
                        results.errors.push({
                            inventoryId: invId, platform,
                            error: 'Inventory item must have a valid list price'
                        });
                        continue;
                    }

                    // Apply platform-specific price adjustments
                    // priceAdjustments is an object { platform: adj }, priceAdjustment is a single % for all platforms
                    const platformAdj = priceAdjustments?.[platform] ?? (typeof priceAdjustment === 'number' ? priceAdjustment : null);
                    if (platformAdj !== null && platformAdj !== undefined) {
                        const adj = platformAdj;
                        if (typeof adj === 'number') {
                            price = price * (1 + adj / 100);
                        } else if (typeof adj === 'object' && adj.type && adj.value !== undefined) {
                            if (adj.type === 'percentage') {
                                price = price * (1 + adj.value / 100);
                            } else if (adj.type === 'fixed') {
                                price = price + adj.value;
                            } else {
                                results.errors.push({ inventoryId: invId, platform, error: `Invalid adjustment type '${adj.type}'. Use 'percentage' or 'fixed'` });
                                continue;
                            }
                        }
                    }

                    // SECURITY: Enforce minimum price — a large negative fixed adjustment
                    // could otherwise produce a zero or negative price, allowing inventory
                    // to be cross-listed for free or at an invalid price.
                    if (price < 0) price = 0.01;

                    // Round price to 2 decimal places
                    price = Math.round(price * 100) / 100;

                    // Ensure price is valid after adjustments (check after rounding)
                    if (!price || price <= 0) {
                        results.errors.push({ inventoryId: invId, platform, error: 'Calculated price must be greater than zero' });
                        continue;
                    }

                    // Use atomic insert to prevent race condition - rely on unique constraint
                    query.run(`
                        INSERT INTO listings (
                            id, inventory_id, user_id, platform, title, description,
                            price, images, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        id, invId, user.id, platform, item.title, item.description,
                        price, item.images, 'draft'
                    ]);

                    results.created.push({ inventoryId: invId, platform, id });
                } catch (error) {
                    // If unique constraint violation, listing already exists - skip instead of error
                    if (error.message && error.message.includes('UNIQUE constraint')) {
                        const existing = query.get(
                            'SELECT id FROM listings WHERE inventory_id = ? AND platform = ? AND user_id = ?',
                            [invId, platform, user.id]
                        );
                        results.skipped.push({ inventoryId: invId, platform, reason: 'Already listed', existingId: existing?.id });
                    } else {
                        logger.error('[Listings] Error crossposting to platform', user?.id, { detail: error.message });
                        results.errors.push({ inventoryId: invId, platform, error: 'Failed to crosspost to platform' });
                    }
                }
            }
        }

        return { status: 201, data: results };
    }

    // PUT /api/listings/:id - Update listing
    if (method === 'PUT' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);

        const existing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        const {
            title, description, price, originalPrice, shippingPrice,
            categoryPath, conditionTag, status, images, platformSpecificData,
            platformListingId, platformUrl, folderId
        } = body;

        if (title && title.length > 500) return { status: 400, data: { error: 'Title must be 500 characters or less' } };
        if (description && description.length > 5000) return { status: 400, data: { error: 'Description must be 5000 characters or less' } };
        if (categoryPath && categoryPath.length > 300) return { status: 400, data: { error: 'Category path must be 300 characters or less' } };

        // Prevent sold listings from being changed back to active
        if (existing.status === 'sold' && status && status !== 'sold') {
            return { status: 400, data: { error: 'Cannot change status of a sold listing' } };
        }

        const updates = [];
        const values = [];

        const fields = {
            title, description, price, original_price: originalPrice,
            shipping_price: shippingPrice, category_path: categoryPath,
            condition_tag: conditionTag, status,
            platform_listing_id: platformListingId, platform_url: platformUrl,
            folder_id: folderId
        };

        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) {
                if (!ALLOWED_LISTING_FIELDS.has(key)) {
                    logger.warn('Unexpected field in listing update', { field: key });
                    continue;
                }
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (images !== undefined) {
            updates.push('images = ?');
            values.push(JSON.stringify(images));
        }

        if (platformSpecificData !== undefined) {
            const psdJson = JSON.stringify(platformSpecificData);
            if (psdJson.length > 50000) {
                return { status: 400, data: { error: 'Platform specific data exceeds maximum size' } };
            }
            updates.push('platform_specific_data = ?');
            values.push(psdJson);
        }

        if (status === 'active' && existing.status !== 'active') {
            updates.push('listed_at = CURRENT_TIMESTAMP');
        }

        if (updates.length > 0) {
            values.push(id);
            query.run(
                `UPDATE listings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                [...values, user.id]
            );
        }

        const listing = query.get('SELECT * FROM listings WHERE id = ?', [id]);
        listing.images = safeJsonParse(listing.images, []);
        listing.platform_specific_data = safeJsonParse(listing.platform_specific_data, {});

        return { status: 200, data: { listing } };
    }

    // DELETE /api/listings/:id - Delete listing
    if (method === 'DELETE' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);

        const existing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        // Check for affected offers before deleting
        const affectedOffers = query.get(
            'SELECT COUNT(*) as count FROM offers WHERE listing_id = ? AND status = ?',
            [id, 'pending']
        )?.count || 0;

        // SECURITY: Include user_id in DELETE to prevent TOCTOU race
        query.run('DELETE FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);

        const message = affectedOffers > 0
            ? `Listing deleted. ${affectedOffers} pending offer${affectedOffers > 1 ? 's were' : ' was'} also removed.`
            : 'Listing deleted';
        return { status: 200, data: { message, affectedOffers } };
    }

    // POST /api/listings/:id/share - Share listing (Poshmark)
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/share$/)) {
        const id = path.split('/')[1];

        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        // Queue share task
        const taskId = uuidv4();
        query.run(`
            INSERT INTO tasks (id, user_id, type, payload, status)
            VALUES (?, ?, ?, ?, ?)
        `, [taskId, user.id, 'share_listing', JSON.stringify({ listingId: id, platform: listing.platform }), 'pending']);

        // Update last shared
        query.run('UPDATE listings SET last_shared_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [id, user.id]);

        return { status: 200, data: { message: 'Share queued', taskId } };
    }

    // GET /api/listings/stats - Get listing statistics
    if (method === 'GET' && path === '/stats') {
        const stats = {
            total: query.get('SELECT COUNT(*) as count FROM listings WHERE user_id = ?', [user.id])?.count || 0,
            byPlatform: query.all(`
                SELECT platform, COUNT(*) as count, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
                FROM listings WHERE user_id = ?
                GROUP BY platform
            `, [user.id]),
            byStatus: query.all(`
                SELECT status, COUNT(*) as count
                FROM listings WHERE user_id = ?
                GROUP BY status
            `, [user.id]),
            totalViews: query.get('SELECT SUM(views) as total FROM listings WHERE user_id = ?', [user.id])?.total || 0,
            totalLikes: query.get('SELECT SUM(likes) as total FROM listings WHERE user_id = ?', [user.id])?.total || 0
        };

        return { status: 200, data: { stats } };
    }

    // POST /api/listings/batch - Create multiple listings at once
    if (method === 'POST' && path === '/batch') {
        const { listings } = body;

        if (!Array.isArray(listings) || listings.length === 0) {
            return { status: 400, data: { error: 'Listings array required' } };
        }

        const created = [];
        const errors = [];

        for (const listing of listings) {
            const { inventory_id, platform, title, description, price, tags, shipping } = listing;

            if (!inventory_id || !platform || !title || !price) {
                errors.push({ listing, error: 'Missing required fields' });
                continue;
            }

            // Check inventory item exists
            const item = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [inventory_id, user.id]);
            if (!item) {
                errors.push({ listing, error: 'Inventory item not found' });
                continue;
            }

            // Check if listing already exists for this platform
            const existingListing = query.get(
                'SELECT id FROM listings WHERE inventory_id = ? AND platform = ? AND user_id = ?',
                [inventory_id, platform, user.id]
            );

            if (existingListing) {
                // Update existing listing
                try {
                    query.run(`
                        UPDATE listings
                        SET title = ?, description = ?, price = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND user_id = ?
                    `, [title, description || null, price, existingListing.id, user.id]);

                    created.push({ id: existingListing.id, updated: true });
                } catch (error) {
                    logger.error('[Listings] Error updating listing', user?.id, { detail: error.message });
                    errors.push({ listing, error: 'Failed to update listing' });
                }
            } else {
                // Create new listing
                const id = uuidv4();
                const now = new Date().toISOString();

                // Get images from inventory item
                const images = safeJsonParse(item.images, []);

                try {
                    query.run(`
                        INSERT INTO listings (
                            id, inventory_id, user_id, platform, title, description, price,
                            images, status, listed_at, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        id, inventory_id, user.id, platform, title, description || null, price,
                        JSON.stringify(images), 'active', now, now, now
                    ]);

                    created.push({ id, created: true });
                } catch (error) {
                    logger.error('[Listings] Error creating listing', user?.id, { detail: error.message });
                    errors.push({ listing, error: 'Failed to create listing' });
                }
            }
        }

        return {
            status: 200,
            data: {
                success: true,
                created: created.length,
                errors: errors.length,
                results: created,
                errorDetails: errors
            }
        };
    }

    // ========================================
    // DELIST/RELIST FEATURE
    // ========================================

    // GET /api/listings/stale - Get stale listings that need refreshing
    if (method === 'GET' && path === '/stale') {
        const { platform, daysThreshold = 30 } = queryParams;

        let sql = `
            SELECT l.*, i.title as inventory_title, i.images as inventory_images
            FROM listings l
            LEFT JOIN inventory i ON l.inventory_id = i.id
            WHERE l.user_id = ?
              AND l.status = 'active'
              AND (
                  l.last_relisted_at IS NULL AND julianday('now') - julianday(COALESCE(l.listed_at, l.created_at)) >= ?
                  OR
                  l.last_relisted_at IS NOT NULL AND julianday('now') - julianday(l.last_relisted_at) >= ?
              )
        `;
        const params = [user.id, parseInt(daysThreshold), parseInt(daysThreshold)];

        if (platform) {
            sql += ' AND l.platform = ?';
            params.push(platform);
        }

        sql += ' ORDER BY COALESCE(l.last_relisted_at, l.listed_at, l.created_at) ASC LIMIT 200';

        const staleListings = query.all(sql, params);

        staleListings.forEach(listing => {
            listing.images = safeJsonParse(listing.images, []);
            listing.inventory_images = safeJsonParse(listing.inventory_images, []);
            listing.platform_specific_data = safeJsonParse(listing.platform_specific_data, {});
            // Calculate days since last refresh
            const lastRefresh = listing.last_relisted_at || listing.listed_at || listing.created_at;
            listing.days_stale = Math.floor((Date.now() - new Date(lastRefresh).getTime()) / (1000 * 60 * 60 * 24));
        });

        return { status: 200, data: { listings: staleListings, threshold: parseInt(daysThreshold) } };
    }

    // POST /api/listings/:id/delist - Delist a listing
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/delist$/)) {
        const id = path.split('/')[1];

        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        const previousStatus = listing.status;
        const reason = body.reason || 'manual';

        // For Facebook Marketplace, use "mark as sold" instead
        if (listing.platform === 'facebook') {
            query.run(`
                UPDATE listings
                SET status = 'ended', marked_as_sold = 1, last_delisted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            `, [id, user.id]);

            // Log the action as "mark_sold"
            const historyId = uuidv4();
            query.run(`
                INSERT INTO listing_refresh_history (id, listing_id, user_id, platform, action, reason, previous_status, new_status)
                VALUES (?, ?, ?, ?, 'mark_sold', ?, ?, 'ended')
            `, [historyId, id, user.id, listing.platform, reason, previousStatus]);

            const updated = query.get('SELECT * FROM listings WHERE id = ?', [id]);
            updated.images = safeJsonParse(updated.images, []);

            return { status: 200, data: { listing: updated, action: 'mark_sold', message: 'Listing marked as sold on Facebook Marketplace' } };
        }

        // For other platforms, delist normally
        query.run(`
            UPDATE listings
            SET status = 'ended', last_delisted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [id, user.id]);

        // Log the action
        const historyId = uuidv4();
        query.run(`
            INSERT INTO listing_refresh_history (id, listing_id, user_id, platform, action, reason, previous_status, new_status)
            VALUES (?, ?, ?, ?, 'delist', ?, ?, 'ended')
        `, [historyId, id, user.id, listing.platform, reason, previousStatus]);

        const updated = query.get('SELECT * FROM listings WHERE id = ?', [id]);
        updated.images = safeJsonParse(updated.images, []);

        return { status: 200, data: { listing: updated, action: 'delist', message: 'Listing delisted successfully' } };
    }

    // POST /api/listings/:id/relist - Relist a listing
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/relist$/)) {
        const id = path.split('/')[1];

        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        // Facebook listings that were marked as sold cannot be relisted
        if (listing.platform === 'facebook' && listing.marked_as_sold) {
            return { status: 400, data: { error: 'Facebook Marketplace listings marked as sold cannot be relisted. Please create a new listing.' } };
        }

        const previousStatus = listing.status;
        const reason = body.reason || 'manual';

        // Relist the item
        query.run(`
            UPDATE listings
            SET status = 'active', last_relisted_at = CURRENT_TIMESTAMP, listed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [id, user.id]);

        // Log the action
        const historyId = uuidv4();
        query.run(`
            INSERT INTO listing_refresh_history (id, listing_id, user_id, platform, action, reason, previous_status, new_status)
            VALUES (?, ?, ?, ?, 'relist', ?, ?, 'active')
        `, [historyId, id, user.id, listing.platform, reason, previousStatus]);

        const updated = query.get('SELECT * FROM listings WHERE id = ?', [id]);
        updated.images = safeJsonParse(updated.images, []);

        return { status: 200, data: { listing: updated, action: 'relist', message: 'Listing relisted successfully' } };
    }

    // POST /api/listings/:id/refresh - Delist and immediately relist (for all platforms except Facebook)
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/refresh$/)) {
        const id = path.split('/')[1];

        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        // Facebook Marketplace doesn't support refresh - use mark as sold instead
        if (listing.platform === 'facebook') {
            return { status: 400, data: { error: 'Facebook Marketplace does not support refresh. Use "Mark as Sold" instead.' } };
        }

        const previousStatus = listing.status;
        const reason = body.reason || 'refresh';

        // Refresh = delist + relist
        query.run(`
            UPDATE listings
            SET status = 'active',
                last_delisted_at = CURRENT_TIMESTAMP,
                last_relisted_at = CURRENT_TIMESTAMP,
                listed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [id, user.id]);

        // Log both actions
        const delistHistoryId = uuidv4();
        query.run(`
            INSERT INTO listing_refresh_history (id, listing_id, user_id, platform, action, reason, previous_status, new_status)
            VALUES (?, ?, ?, ?, 'delist', ?, ?, 'ended')
        `, [delistHistoryId, id, user.id, listing.platform, reason, previousStatus]);

        const relistHistoryId = uuidv4();
        query.run(`
            INSERT INTO listing_refresh_history (id, listing_id, user_id, platform, action, reason, previous_status, new_status)
            VALUES (?, ?, ?, ?, 'relist', ?, 'ended', 'active')
        `, [relistHistoryId, id, user.id, listing.platform, reason]);

        const updated = query.get('SELECT * FROM listings WHERE id = ?', [id]);
        updated.images = safeJsonParse(updated.images, []);

        return { status: 200, data: { listing: updated, action: 'refresh', message: 'Listing refreshed (delisted and relisted)' } };
    }

    // POST /api/listings/refresh-bulk - Refresh multiple stale listings at once
    if (method === 'POST' && path === '/refresh-bulk') {
        const { listingIds, reason = 'bulk_refresh' } = body;

        if (!Array.isArray(listingIds) || listingIds.length === 0) {
            return { status: 400, data: { error: 'listingIds array required' } };
        }

        if (listingIds.length > 100) {
            return { status: 400, data: { error: 'Too many listings (max 100 per bulk refresh)' } };
        }

        const results = { refreshed: [], skipped: [], errors: [] };

        for (const listingId of listingIds) {
            const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [listingId, user.id]);

            if (!listing) {
                results.errors.push({ id: listingId, error: 'Listing not found' });
                continue;
            }

            // Skip Facebook listings
            if (listing.platform === 'facebook') {
                results.skipped.push({ id: listingId, reason: 'Facebook Marketplace does not support refresh' });
                continue;
            }

            const previousStatus = listing.status;

            try {
                // Refresh the listing
                query.run(`
                    UPDATE listings
                    SET status = 'active',
                        last_delisted_at = CURRENT_TIMESTAMP,
                        last_relisted_at = CURRENT_TIMESTAMP,
                        listed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND user_id = ?
                `, [listingId, user.id]);

                // Log delist
                const delistHistoryId = uuidv4();
                query.run(`
                    INSERT INTO listing_refresh_history (id, listing_id, user_id, platform, action, reason, previous_status, new_status)
                    VALUES (?, ?, ?, ?, 'delist', ?, ?, 'ended')
                `, [delistHistoryId, listingId, user.id, listing.platform, reason, previousStatus]);

                // Log relist
                const relistHistoryId = uuidv4();
                query.run(`
                    INSERT INTO listing_refresh_history (id, listing_id, user_id, platform, action, reason, previous_status, new_status)
                    VALUES (?, ?, ?, ?, 'relist', ?, 'ended', 'active')
                `, [relistHistoryId, listingId, user.id, listing.platform, reason]);

                results.refreshed.push({ id: listingId, platform: listing.platform });
            } catch (error) {
                logger.error('[Listings] Error refreshing listing', user?.id, { detail: error.message });
                results.errors.push({ id: listingId, error: 'Failed to refresh listing' });
            }
        }

        return {
            status: 200,
            data: {
                success: true,
                refreshed: results.refreshed.length,
                skipped: results.skipped.length,
                errors: results.errors.length,
                results
            }
        };
    }

    // GET /api/listings/:id/refresh-history - Get refresh history for a listing
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+\/refresh-history$/)) {
        const id = path.split('/')[1];

        const listing = query.get('SELECT id FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        const history = query.all(`
            SELECT * FROM listing_refresh_history
            WHERE listing_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `, [id]);

        return { status: 200, data: { history } };
    }

    // PUT /api/listings/:id/staleness-settings - Update staleness settings for a listing
    if (method === 'PUT' && path.match(/^\/[a-f0-9-]+\/staleness-settings$/)) {
        const id = path.split('/')[1];

        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        const { stalenessDays, autoRelistEnabled } = body;

        const updates = [];
        const values = [];

        if (stalenessDays !== undefined) {
            updates.push('staleness_days = ?');
            values.push(parseInt(stalenessDays));
        }

        if (autoRelistEnabled !== undefined) {
            updates.push('auto_relist_enabled = ?');
            values.push(autoRelistEnabled ? 1 : 0);
        }

        if (updates.length > 0) {
            values.push(id);
            values.push(user.id);
            query.run(`UPDATE listings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`, values);
        }

        const updated = query.get('SELECT * FROM listings WHERE id = ?', [id]);
        updated.images = safeJsonParse(updated.images, []);

        return { status: 200, data: { listing: updated } };
    }

    // POST /api/listings/:id/archive - Archive a listing
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/archive$/)) {
        const id = path.split('/')[1];

        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        // Try to archive with 'archived' status first
        try {
            query.run(`
                UPDATE listings
                SET status = 'archived', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            `, [id, user.id]);

            const updated = query.get('SELECT * FROM listings WHERE id = ?', [id]);
            updated.images = safeJsonParse(updated.images, []);
            updated.platform_specific_data = safeJsonParse(updated.platform_specific_data, {});

            return { status: 200, data: { listing: updated, message: 'Listing archived successfully' } };
        } catch (error) {
            // If constraint error (migration not applied), fallback to 'ended' status
            if (error.message && error.message.includes('CHECK constraint')) {
                logger.warn(`[Listings] Archive failed for listing ${id}, using 'ended' status fallback. Migration 035 may not be applied.`);

                try {
                    query.run(`
                        UPDATE listings
                        SET status = 'ended', deleted_at = CURRENT_TIMESTAMP, notes = COALESCE(notes || ' | ', '') || '[ARCHIVED] User archived this listing',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND user_id = ?
                    `, [id, user.id]);

                    const updated = query.get('SELECT * FROM listings WHERE id = ?', [id]);
                    updated.images = safeJsonParse(updated.images, []);
                    updated.platform_specific_data = safeJsonParse(updated.platform_specific_data, {});

                    return {
                        status: 200,
                        data: {
                            listing: updated,
                            message: 'Listing archived (using ended status)',
                            warning: 'Database migration needed. Status set to "ended" instead of "archived". Contact support to update your database.'
                        }
                    };
                } catch (fallbackError) {
                    logger.error('[Listings] Archive fallback failed', user?.id, { detail: fallbackError.message });
                    return { status: 500, data: { error: 'Failed to archive listing' } };
                }
            } else {
                logger.error('[Listings] Archive failed', user?.id, { detail: error.message });
                return { status: 500, data: { error: 'Failed to archive listing' } };
            }
        }
    }

    // POST /api/listings/:id/unarchive - Unarchive a listing
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/unarchive$/)) {
        const id = path.split('/')[1];

        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) {
            return { status: 404, data: { error: 'Listing not found' } };
        }

        // Only allow unarchiving if status is 'archived' or 'ended' with archive note
        if (listing.status !== 'archived' && !(listing.status === 'ended' && listing.notes && listing.notes.includes('[ARCHIVED]'))) {
            return { status: 400, data: { error: 'Only archived listings can be unarchived' } };
        }

        try {
            // Remove archive note if present
            let cleanedNotes = listing.notes;
            if (cleanedNotes) {
                cleanedNotes = cleanedNotes.replace(/\s*\|\s*\[ARCHIVED\] User archived this listing/, '').trim();
                if (cleanedNotes.endsWith('|')) {
                    cleanedNotes = cleanedNotes.slice(0, -1).trim();
                }
            }

            query.run(`
                UPDATE listings
                SET status = 'draft', deleted_at = NULL, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            `, [cleanedNotes || null, id, user.id]);

            const updated = query.get('SELECT * FROM listings WHERE id = ?', [id]);
            updated.images = safeJsonParse(updated.images, []);
            updated.platform_specific_data = safeJsonParse(updated.platform_specific_data, {});

            return { status: 200, data: { listing: updated, message: 'Listing unarchived successfully' } };
        } catch (error) {
            logger.error('[Listings] Unarchive failed', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to unarchive listing' } };
        }
    }

    // ============================================
    // PRICE DROP SCHEDULING
    // ============================================

    // POST /api/listings/:id/schedule-price-drop - Schedule a price drop
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/schedule-price-drop$/)) {
        const id = path.split('/')[1];
        const { drop_amount, new_price, scheduled_date, recurring, max_drops, floor_price } = body;

        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) return { status: 404, data: { error: 'Listing not found' } };

        if (!drop_amount || drop_amount <= 0) {
            return { status: 400, data: { error: 'Invalid drop amount' } };
        }

        if (scheduled_date && isNaN(new Date(scheduled_date).getTime())) {
            return { status: 400, data: { error: 'Invalid scheduled date' } };
        }

        try {
            // Store schedule in listing's platform_specific_data for persistence
            const platformData = safeJsonParse(listing.platform_specific_data, {});
            platformData.price_drop_schedule = {
                original_price: listing.price,
                drop_amount,
                new_price,
                scheduled_date,
                recurring: recurring || false,
                max_drops: max_drops || 3,
                drops_completed: 0,
                floor_price: floor_price || 0,
                status: 'active',
                created_at: new Date().toISOString()
            };

            query.run(
                'UPDATE listings SET platform_specific_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                [JSON.stringify(platformData), id, user.id]
            );

            // If scheduled for now, apply immediately
            if (scheduled_date && new Date(scheduled_date) <= new Date()) {
                query.run(
                    'UPDATE listings SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                    [new_price, id, user.id]
                );
            }

            return { status: 200, data: { message: 'Price drop scheduled', schedule: platformData.price_drop_schedule } };
        } catch (error) {
            logger.error('[Listings] Error scheduling price drop', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to schedule price drop' } };
        }
    }

    // ============================================
    // COMPETITOR PRICING (per listing)
    // ============================================

    // GET /api/listings/:id/competitor-pricing - Get competitor pricing for a listing
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+\/competitor-pricing$/)) {
        const id = path.split('/')[1];

        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) return { status: 404, data: { error: 'Listing not found' } };

        try {
            // Get similar sold items from sales history for price comparison
            const category = listing.category || '';
            const brand = listing.brand || '';

            const similarSales = query.all(`
                SELECT s.sale_price, s.created_at, i.title, i.brand, i.category, i.condition
                FROM sales s
                JOIN inventory i ON s.inventory_id = i.id
                WHERE s.user_id = ?
                AND (i.category = ? OR i.brand = ?)
                ORDER BY s.created_at DESC
                LIMIT 10
            `, [user.id, category, brand]);

            // Calculate pricing stats
            const prices = similarSales.map(s => parseFloat(s.sale_price)).filter(p => p > 0);
            const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
            const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
            const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
            const currentPrice = parseFloat(listing.price) || 0;
            const pricePosition = avgPrice > 0 ? ((currentPrice / avgPrice) * 100).toFixed(0) : 100;

            return {
                status: 200,
                data: {
                    listing_price: currentPrice,
                    similar_sales: similarSales.length,
                    avg_price: parseFloat(avgPrice.toFixed(2)),
                    min_price: parseFloat(minPrice.toFixed(2)),
                    max_price: parseFloat(maxPrice.toFixed(2)),
                    price_position: parseInt(pricePosition),
                    recommendation: currentPrice > avgPrice * 1.2 ? 'overpriced' :
                                   currentPrice < avgPrice * 0.8 ? 'underpriced' : 'competitive',
                    recent_sales: similarSales.slice(0, 5)
                }
            };
        } catch (error) {
            logger.error('[Listings] Error fetching competitor pricing', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch competitor pricing' } };
        }
    }

    // ============================================
    // TIME-TO-SELL ESTIMATE (per listing)
    // ============================================

    // GET /api/listings/:id/time-to-sell - Estimate time to sell based on historical data
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+\/time-to-sell$/)) {
        const id = path.split('/')[1];

        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) return { status: 404, data: { error: 'Listing not found' } };

        try {
            const category = listing.category || '';
            const brand = listing.brand || '';
            const price = parseFloat(listing.price) || 0;

            // Get historical time-to-sell for similar items
            const historicalData = query.all(`
                SELECT
                    julianday(s.created_at) - julianday(i.listed_at) as days_to_sell,
                    s.sale_price, i.category, i.brand, i.condition
                FROM sales s
                JOIN inventory i ON s.inventory_id = i.id
                WHERE s.user_id = ?
                AND i.listed_at IS NOT NULL
                AND (i.category = ? OR i.brand = ?)
                AND julianday(s.created_at) - julianday(i.listed_at) > 0
                ORDER BY s.created_at DESC
                LIMIT 20
            `, [user.id, category, brand]);

            const days = historicalData.map(h => h.days_to_sell).filter(d => d > 0);
            const avgDays = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
            const minDays = days.length > 0 ? Math.round(Math.min(...days)) : null;
            const maxDays = days.length > 0 ? Math.round(Math.max(...days)) : null;

            // Price factor adjustment
            const avgSalePrice = historicalData.length > 0
                ? historicalData.reduce((sum, h) => sum + (h.sale_price || 0), 0) / historicalData.length
                : 0;
            const priceFactor = avgSalePrice > 0 ? price / avgSalePrice : 1;
            const adjustedEstimate = avgDays ? Math.round(avgDays * Math.max(0.5, Math.min(2, priceFactor))) : null;

            return {
                status: 200,
                data: {
                    estimated_days: adjustedEstimate,
                    avg_days: avgDays,
                    min_days: minDays,
                    max_days: maxDays,
                    data_points: days.length,
                    confidence: days.length >= 10 ? 'high' : days.length >= 5 ? 'medium' : 'low',
                    price_factor: priceFactor.toFixed(2)
                }
            };
        } catch (error) {
            logger.error('[Listings] Error calculating time-to-sell', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to calculate time-to-sell' } };
        }
    }

    // POST /api/listings/:id/publish-ebay - Push a listing live to eBay via the Sell API
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/publish-ebay$/)) {
        const listingId = path.slice(1).replace('/publish-ebay', '');

        try {
            const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [listingId, user.id]);
            if (!listing) return { status: 404, data: { error: 'Listing not found' } };

            const inventory = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [listing.inventory_id, user.id]);
            if (!inventory) return { status: 404, data: { error: 'Inventory item not found' } };

            const shop = query.get(
                "SELECT * FROM shops WHERE user_id = ? AND platform = 'ebay' AND is_connected = 1",
                [user.id]
            );
            if (!shop) return { status: 400, data: { error: 'No connected eBay shop found. Connect eBay in My Shops first.' } };
            if (!shop.oauth_token) return { status: 400, data: { error: 'eBay shop has no OAuth token. Reconnect eBay in My Shops.' } };

            const result = await publishListingToEbay(shop, listing, inventory);

            // Update listing record with eBay listing ID and URL
            query.run(
                'UPDATE listings SET platform_listing_id = ?, platform_url = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [result.listingId, result.listingUrl, 'active', new Date().toISOString(), listingId, user.id]
            );

            return {
                status: 200,
                data: {
                    success: true,
                    offerId: result.offerId,
                    listingId: result.listingId,
                    sku: result.sku,
                    listingUrl: result.listingUrl
                }
            };
        } catch (error) {
            logger.error('[Listings] eBay publish error', user?.id, { detail: error.message });
            return { status: 500, data: { error: error.message } };
        }
    }

    // POST /api/listings/:id/publish-etsy - Push a listing live to Etsy via the Listings API v3
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/publish-etsy$/)) {
        const listingId = path.slice(1).replace('/publish-etsy', '');

        try {
            const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [listingId, user.id]);
            if (!listing) return { status: 404, data: { error: 'Listing not found' } };

            const inventory = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [listing.inventory_id, user.id]);
            if (!inventory) return { status: 404, data: { error: 'Inventory item not found' } };

            const shop = query.get(
                "SELECT * FROM shops WHERE user_id = ? AND platform = 'etsy' AND is_connected = 1",
                [user.id]
            );
            if (!shop) return { status: 400, data: { error: 'No connected Etsy shop found. Connect Etsy in My Shops first.' } };
            if (!shop.oauth_token) return { status: 400, data: { error: 'Etsy shop has no OAuth token. Reconnect Etsy in My Shops.' } };

            const result = await publishListingToEtsy(shop, listing, inventory);

            query.run(
                'UPDATE listings SET platform_listing_id = ?, platform_url = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [result.listingId, result.listingUrl, 'active', new Date().toISOString(), listingId, user.id]
            );

            return {
                status: 200,
                data: {
                    success: true,
                    listingId: result.listingId,
                    listingUrl: result.listingUrl
                }
            };
        } catch (error) {
            logger.error('[Listings] Etsy publish error', user?.id, { detail: error.message });
            return { status: 500, data: { error: error.message } };
        }
    }

    // POST /api/listings/:id/publish-poshmark - Push a listing live to Poshmark via browser automation
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/publish-poshmark$/)) {
        const listingId = path.slice(1).replace('/publish-poshmark', '');

        try {
            const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [listingId, user.id]);
            if (!listing) return { status: 404, data: { error: 'Listing not found' } };

            const inventory = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [listing.inventory_id, user.id]);
            if (!inventory) return { status: 404, data: { error: 'Inventory item not found' } };

            const result = await publishListingToPoshmark(null, listing, inventory);

            query.run(
                'UPDATE listings SET platform_listing_id = ?, platform_url = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [result.listingId, result.listingUrl, 'active', new Date().toISOString(), listingId, user.id]
            );

            return {
                status: 200,
                data: {
                    success: true,
                    listingId: result.listingId,
                    listingUrl: result.listingUrl
                }
            };
        } catch (error) {
            logger.error('[Listings] Poshmark publish error: ' + error.message);
            return { status: 500, data: { error: error.message } };
        }
    }

    // POST /api/listings/:id/publish — publish a listing to its platform
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/publish$/)) {
        const id = path.split('/')[1];
        const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!listing) return { status: 404, data: { error: 'Listing not found' } };
        if (listing.status === 'active') return { status: 400, data: { error: 'Listing is already active' } };

        const inventory = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [listing.inventory_id, user.id]);
        if (!inventory) return { status: 404, data: { error: 'Inventory item not found' } };

        const publishers = {
            poshmark: publishListingToPoshmark,
            ebay: publishListingToEbay,
            etsy: publishListingToEtsy,
            mercari: publishListingToMercari,
            depop: publishListingToDepop,
            grailed: publishListingToGrailed,
            facebook: publishListingToFacebook,
            whatnot: publishListingToWhatnot,
            shopify: publishListingToShopify,
        };

        const publisher = publishers[listing.platform];
        if (!publisher) return { status: 400, data: { error: `Platform '${listing.platform}' does not support publish` } };

        const shop = query.get('SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = 1', [user.id, listing.platform]) || null;

        try {
            const result = await publisher(shop, listing, inventory);
            query.run(
                'UPDATE listings SET platform_listing_id = ?, platform_url = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [result.listingId, result.listingUrl, 'active', new Date().toISOString(), id, user.id]
            );
            try {
                const { websocketService } = await import('../services/websocket.js');
                websocketService.sendToUser(user.id, {
                    type: 'listing.published',
                    listingId: id,
                    platform: listing.platform,
                    platformListingId: result.listingId,
                    platformUrl: result.listingUrl
                });
            } catch (wsErr) {
                logger.warn('[Listings] WebSocket notify failed', user?.id, { detail: wsErr.message });
            }
            return { status: 200, data: { success: true, listingId: result.listingId, listingUrl: result.listingUrl } };
        } catch (error) {
            logger.error('[Listings] Publish error', user?.id, { platform: listing.platform, detail: error.message });
            try {
                const { websocketService } = await import('../services/websocket.js');
                websocketService.sendToUser(user.id, {
                    type: 'listing.publish_failed',
                    listingId: id,
                    platform: listing.platform,
                    error: error.message
                });
            } catch (wsErr) {
                // Silent — WS failure shouldn't block error response
            }
            return { status: 500, data: { error: error.message } };
        }
    }

    // POST /api/listings/:id/publish-mercari - Push a listing live to Mercari via browser automation
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/publish-mercari$/)) {
        const listingId = path.slice(1).replace('/publish-mercari', '');

        try {
            const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [listingId, user.id]);
            if (!listing) return { status: 404, data: { error: 'Listing not found' } };

            const inventory = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [listing.inventory_id, user.id]);
            if (!inventory) return { status: 404, data: { error: 'Inventory item not found' } };

            const result = await publishListingToMercari(null, listing, inventory);

            query.run(
                'UPDATE listings SET platform_listing_id = ?, platform_url = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [result.listingId, result.listingUrl, 'active', new Date().toISOString(), listingId, user.id]
            );

            return {
                status: 200,
                data: {
                    success: true,
                    listingId: result.listingId,
                    listingUrl: result.listingUrl
                }
            };
        } catch (error) {
            logger.error('[Listings] Mercari publish error', user?.id, { detail: error.message });
            return { status: 500, data: { error: error.message } };
        }
    }

    // POST /api/listings/:id/publish-depop - Push a listing live to Depop via browser automation
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/publish-depop$/)) {
        const listingId = path.slice(1).replace('/publish-depop', '');

        try {
            const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [listingId, user.id]);
            if (!listing) return { status: 404, data: { error: 'Listing not found' } };

            const inventory = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [listing.inventory_id, user.id]);
            if (!inventory) return { status: 404, data: { error: 'Inventory item not found' } };

            const result = await publishListingToDepop(null, listing, inventory);

            query.run(
                'UPDATE listings SET platform_listing_id = ?, platform_url = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [result.listingId, result.listingUrl, 'active', new Date().toISOString(), listingId, user.id]
            );

            return {
                status: 200,
                data: {
                    success: true,
                    listingId: result.listingId,
                    listingUrl: result.listingUrl
                }
            };
        } catch (error) {
            logger.error('[Listings] Depop publish error', user?.id, { detail: error.message });
            return { status: 500, data: { error: error.message } };
        }
    }

    // POST /api/listings/:id/publish-grailed - Push a listing live to Grailed via browser automation
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/publish-grailed$/)) {
        const listingId = path.slice(1).replace('/publish-grailed', '');

        try {
            const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [listingId, user.id]);
            if (!listing) return { status: 404, data: { error: 'Listing not found' } };

            const inventory = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [listing.inventory_id, user.id]);
            if (!inventory) return { status: 404, data: { error: 'Inventory item not found' } };

            const result = await publishListingToGrailed(null, listing, inventory);

            query.run(
                'UPDATE listings SET platform_listing_id = ?, platform_url = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [result.listingId, result.listingUrl, 'active', new Date().toISOString(), listingId, user.id]
            );

            return {
                status: 200,
                data: {
                    success: true,
                    listingId: result.listingId,
                    listingUrl: result.listingUrl
                }
            };
        } catch (error) {
            logger.error('[Listings] Grailed publish error', user?.id, { detail: error.message });
            return { status: 500, data: { error: error.message } };
        }
    }

    // POST /api/listings/:id/publish-facebook - Push a listing live to Facebook Marketplace via browser automation
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/publish-facebook$/)) {
        const listingId = path.slice(1).replace('/publish-facebook', '');

        try {
            const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [listingId, user.id]);
            if (!listing) return { status: 404, data: { error: 'Listing not found' } };

            const inventory = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [listing.inventory_id, user.id]);
            if (!inventory) return { status: 404, data: { error: 'Inventory item not found' } };

            const result = await publishListingToFacebook(null, listing, inventory);

            query.run(
                'UPDATE listings SET platform_listing_id = ?, platform_url = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [result.listingId, result.listingUrl, 'active', new Date().toISOString(), listingId, user.id]
            );

            return {
                status: 200,
                data: { success: true, listingId: result.listingId, listingUrl: result.listingUrl }
            };
        } catch (error) {
            logger.error('[Listings] Facebook publish error', user?.id, { detail: error.message });
            return { status: 500, data: { error: error.message } };
        }
    }

    // POST /api/listings/:id/publish-whatnot - Push a listing live to Whatnot via browser automation
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/publish-whatnot$/)) {
        const listingId = path.slice(1).replace('/publish-whatnot', '');

        try {
            const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [listingId, user.id]);
            if (!listing) return { status: 404, data: { error: 'Listing not found' } };

            const inventory = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [listing.inventory_id, user.id]);
            if (!inventory) return { status: 404, data: { error: 'Inventory item not found' } };

            const result = await publishListingToWhatnot(null, listing, inventory);

            query.run(
                'UPDATE listings SET platform_listing_id = ?, platform_url = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [result.listingId, result.listingUrl, 'active', new Date().toISOString(), listingId, user.id]
            );

            return {
                status: 200,
                data: { success: true, listingId: result.listingId, listingUrl: result.listingUrl }
            };
        } catch (error) {
            logger.error('[Listings] Whatnot publish error', user?.id, { detail: error.message });
            return { status: 500, data: { error: error.message } };
        }
    }

    // POST /api/listings/:id/publish-shopify - Push a listing live to Shopify via Admin REST API
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/publish-shopify$/)) {
        const listingId = path.slice(1).replace('/publish-shopify', '');

        try {
            const listing = query.get('SELECT * FROM listings WHERE id = ? AND user_id = ?', [listingId, user.id]);
            if (!listing) return { status: 404, data: { error: 'Listing not found' } };

            const inventory = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [listing.inventory_id, user.id]);
            if (!inventory) return { status: 404, data: { error: 'Inventory item not found' } };

            const result = await publishListingToShopify(null, listing, inventory);

            query.run(
                'UPDATE listings SET platform_listing_id = ?, platform_url = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [result.listingId, result.listingUrl, 'active', new Date().toISOString(), listingId, user.id]
            );

            return {
                status: 200,
                data: { success: true, listingId: result.listingId, listingUrl: result.listingUrl }
            };
        } catch (error) {
            logger.error('[Listings] Shopify publish error', user?.id, { detail: error.message });
            return { status: 500, data: { error: error.message } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
