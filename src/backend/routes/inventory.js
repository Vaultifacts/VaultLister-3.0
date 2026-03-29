// Inventory Routes
import { v4 as uuidv4 } from 'uuid';
import { query, escapeLike } from '../db/database.js';
import { checkTierPermission } from '../middleware/auth.js';
import { generateBlockchainHash } from '../../shared/utils/blockchain.js';
import { calculateSustainability } from '../../shared/utils/sustainability.js';
import { validateInventoryData, validatePrice } from '../../shared/utils/sanitize.js';
import { logger } from '../shared/logger.js';
import { safeJsonParse } from '../shared/utils.js';

function detectMarketplace(url) {
    const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
    if (host.includes('ebay.')) return 'ebay';
    if (host.includes('poshmark.')) return 'poshmark';
    if (host.includes('mercari.')) return 'mercari';
    if (host === 'depop.com' || host.endsWith('.depop.com')) return 'depop';
    if (host === 'grailed.com' || host.endsWith('.grailed.com')) return 'grailed';
    if (host === 'etsy.com' || host.endsWith('.etsy.com')) return 'etsy';
    if (host.endsWith('.shopify.com') || host.endsWith('.myshopify.com') || host === 'myshopify.com') return 'shopify';
    if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com' || host.endsWith('.fb.com')) return 'facebook';
    if (host === 'whatnot.com' || host.endsWith('.whatnot.com')) return 'whatnot';
    return 'other';
}

/**
 * Safe JSON parse helper — returns fallback on malformed data instead of throwing
 */

// Helper function to generate SKU from a rule
function generateSkuFromRule(rule, itemData) {
    let sku = rule.pattern;
    const now = new Date();

    // Category abbreviations
    const categoryAbbreviations = {
        'Tops': 'TOP', 'Bottoms': 'BTM', 'Dresses': 'DRS', 'Outerwear': 'OTW',
        'Footwear': 'FTW', 'Shoes': 'SHO', 'Bags': 'BAG', 'Accessories': 'ACC',
        'Jewelry': 'JWL', 'Electronics': 'ELC', 'Home': 'HOM', 'Vintage': 'VTG'
    };

    const getCategoryCode = (category) => {
        if (!category) return 'GEN';
        return categoryAbbreviations[category] || category.toUpperCase().slice(0, 3);
    };

    const generateRandomCode = (length) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        const randomValues = new Uint32Array(length);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            result += chars.charAt(randomValues[i] % chars.length);
        }
        return result;
    };

    const replacements = {
        '{brand}': (itemData.brand || 'UNK').toUpperCase().slice(0, 3),
        '{category}': getCategoryCode(itemData.category),
        '{color}': (itemData.color || 'XXX').toUpperCase().slice(0, 3),
        '{size}': (itemData.size || 'OS').toUpperCase().replace(/\s+/g, ''),
        '{year}': now.getFullYear().toString().slice(-2),
        '{month}': String(now.getMonth() + 1).padStart(2, '0'),
        '{day}': String(now.getDate()).padStart(2, '0'),
        '{counter}': String((rule.counter_current || 0) + 1).padStart(rule.counter_padding || 4, '0'),
        '{random}': generateRandomCode(4)
    };

    for (const [token, value] of Object.entries(replacements)) {
        sku = sku.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g'), value); // nosemgrep: javascript.lang.security.detect-non-literal-regexp
    }

    // Add prefix and suffix
    const prefix = rule.prefix || '';
    const suffix = rule.suffix || '';

    return prefix + sku + suffix;
}

export async function inventoryRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/inventory - List all inventory
    if (method === 'GET' && (path === '/' || path === '')) {
        const { status, search, category, brand, sort, limit = 50, offset = 0 } = queryParams;

        let sql = 'SELECT * FROM inventory WHERE user_id = ? AND status != ?';
        const params = [user.id, 'deleted'];
        let useFullTextSearch = false;
        let ftsIds = [];

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (brand) {
            sql += ' AND brand = ?';
            params.push(brand);
        }

        if (search) {
            // Limit search length to prevent CPU exhaustion
            if (search.length > 500) {
                return { status: 400, data: { error: { message: 'Search query too long (max 500 characters)', code: 'BAD_REQUEST' } } };
            }

            // Sanitize search term for FTS5 (strip quotes, operators, special chars)
            const sanitizedSearch = search.replace(/['"*(){}[\]^~\\]/g, '').replace(/\b(AND|OR|NOT|NEAR)\b/gi, '');

            // Try full-text search (may fail with invalid syntax)
            if (sanitizedSearch.length > 0) {
                try {
                    // FIXED 2026-02-24: Quote as FTS5 phrase to prevent hyphens as NOT (Issue #4)
                    const ftsResults = await query.all(`
                        SELECT id FROM inventory WHERE search_vector @@ plainto_tsquery('english', ?)
                    `, [sanitizedSearch]);
                    ftsIds = ftsResults.map(r => r.id);
                    useFullTextSearch = true;
                } catch (e) {
                    // FTS5 syntax error - fall back to ILIKE search
                    useFullTextSearch = false;
                }
            }

            if (useFullTextSearch && ftsIds.length > 0) {
                sql += ` AND id IN (${ftsIds.map(() => '?').join(',')})`;
                params.push(...ftsIds);
            } else {
                // Fallback to ILIKE search
                sql += ` AND (title ILIKE ? ESCAPE '\\' OR description ILIKE ? ESCAPE '\\' OR brand ILIKE ? ESCAPE '\\')`;
                const searchTerm = `%${escapeLike(search)}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }
        }

        // Sorting
        switch (sort) {
            case 'price_asc':
            case 'list_price_asc':
                sql += ' ORDER BY list_price ASC';
                break;
            case 'price_desc':
            case 'list_price_desc':
                sql += ' ORDER BY list_price DESC';
                break;
            case 'created_asc':
            case 'created_at_asc':
                sql += ' ORDER BY created_at ASC';
                break;
            case 'created_desc':
            case 'created_at_desc':
                sql += ' ORDER BY created_at DESC';
                break;
            case 'title':
            case 'title_asc':
                sql += ' ORDER BY LOWER(title) ASC';
                break;
            case 'title_desc':
                sql += ' ORDER BY LOWER(title) DESC';
                break;
            case 'sku_asc':
                sql += ' ORDER BY LOWER(sku) ASC';
                break;
            case 'sku_desc':
                sql += ' ORDER BY LOWER(sku) DESC';
                break;
            case 'status_asc':
                sql += ' ORDER BY status ASC';
                break;
            case 'status_desc':
                sql += ' ORDER BY status DESC';
                break;
            case 'marketplace_asc':
                sql += ' ORDER BY LOWER(marketplace) ASC';
                break;
            case 'marketplace_desc':
                sql += ' ORDER BY LOWER(marketplace) DESC';
                break;
            case 'tags_asc':
                sql += ' ORDER BY LOWER(tags::text) ASC';
                break;
            case 'tags_desc':
                sql += ' ORDER BY LOWER(tags::text) DESC';
                break;
            default:
                sql += ' ORDER BY created_at DESC';
        }

        sql += ' LIMIT ? OFFSET ?';
        const parsedLimit = parseInt(limit);
        const parsedOffset = parseInt(offset);
        const cappedLimit = Math.min(!isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50, 200);
        params.push(cappedLimit, !isNaN(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0);

        const items = await query.all(sql, params);

        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM inventory WHERE user_id = ? AND status != ?';
        const countParams = [user.id, 'deleted'];
        if (status) {
            countSql += ' AND status = ?';
            countParams.push(status);
        }
        if (category) {
            countSql += ' AND category = ?';
            countParams.push(category);
        }
        if (brand) {
            countSql += ' AND brand = ?';
            countParams.push(brand);
        }
        if (search) {
            if (useFullTextSearch && ftsIds.length > 0) {
                countSql += ` AND id IN (${ftsIds.map(() => '?').join(',')})`;
                countParams.push(...ftsIds);
            } else {
                countSql += ` AND (title ILIKE ? ESCAPE '\\' OR description ILIKE ? ESCAPE '\\' OR brand ILIKE ? ESCAPE '\\')`;
                const searchTerm = `%${escapeLike(search)}%`;
                countParams.push(searchTerm, searchTerm, searchTerm);
            }
        }
        const total = Number((await query.get(countSql, countParams))?.total) || 0;

        // Parse JSON fields
        items.forEach(item => {
            item.tags = safeJsonParse(item.tags, []);
            item.images = safeJsonParse(item.images, []);
            item.ai_generated_data = safeJsonParse(item.ai_generated_data, {});
            item.custom_fields = safeJsonParse(item.custom_fields, {});
        });

        return {
            status: 200,
            data: { items, total, limit: cappedLimit, offset: !isNaN(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0 }
        };
    }

    // GET /api/inventory/:id/history - Get item purchase and sales history
    if (method === 'GET' && path.match(/^\/[\w-]+\/history$/)) {
        const id = path.split('/')[1];

        // Verify item exists and belongs to user
        const item = await query.get('SELECT id FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!item) {
            return { status: 404, data: { error: { message: 'Item not found', code: 'NOT_FOUND' } } };
        }

        // Get purchases associated with this item
        const purchases = await query.all(`
            SELECT pi.*, p.vendor_name, p.purchase_date, p.payment_method
            FROM purchase_items pi
            JOIN purchases p ON pi.purchase_id = p.id
            WHERE pi.inventory_id = ? AND p.user_id = ?
            ORDER BY p.purchase_date DESC
        `, [id, user.id]);

        // Get sales associated with this item
        const sales = await query.all(`
            SELECT * FROM sales
            WHERE inventory_id = ? AND user_id = ?
            ORDER BY created_at DESC
        `, [id, user.id]);

        // Get price history if table exists (check first to avoid prepared statement cache errors)
        let priceHistory = [];
        const priceHistoryTableExists = await query.get(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'price_history'`
        );
        if (priceHistoryTableExists) {
            priceHistory = await query.all(`
                SELECT * FROM price_history
                WHERE inventory_id = ? AND user_id = ?
                ORDER BY changed_at DESC
                LIMIT 20
            `, [id, user.id]);
        }

        return {
            status: 200,
            data: {
                purchases,
                sales,
                priceHistory
            }
        };
    }

    // GET /api/inventory/:id - Get single item
    if (method === 'GET' && path.match(/^\/[\w-]+$/) && path !== '/stats' && path !== '/deleted') {
        const id = path.slice(1);
        const item = await query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);

        if (!item) {
            return { status: 404, data: { error: { message: 'Item not found', code: 'NOT_FOUND' } } };
        }

        item.tags = safeJsonParse(item.tags, []);
        item.images = safeJsonParse(item.images, []);
        item.ai_generated_data = safeJsonParse(item.ai_generated_data, {});
        item.custom_fields = safeJsonParse(item.custom_fields, {});

        // Get associated listings
        const listings = await query.all(
            'SELECT * FROM listings WHERE inventory_id = ? AND user_id = ?',
            [id, user.id]
        );

        listings.forEach(listing => {
            listing.images = safeJsonParse(listing.images, []);
            listing.platform_specific_data = safeJsonParse(listing.platform_specific_data, {});
        });

        return { status: 200, data: { item, listings } };
    }

    // POST /api/inventory - Create new item
    if (method === 'POST' && (path === '/' || path === '')) {
        // Check tier limits
        const permission = await checkTierPermission(user, 'listings');
        if (!permission.allowed) {
            return {
                status: 403,
                data: {
                    error: 'Listing limit reached',
                    limit: permission.limit,
                    current: permission.current
                }
            };
        }

        // Validate and sanitize input data
        const validation = validateInventoryData(body, false);
        if (!validation.valid) {
            return {
                status: 400,
                data: {
                    error: 'Validation failed',
                    errors: validation.errors
                }
            };
        }

        const {
            sku, title, description, brand, category, subcategory,
            size, color, condition, costPrice, listPrice, quantity,
            lowStockThreshold, weight, dimensions, material, tags, images, location, binLocation, notes,
            customFields, purchaseDate, supplier
        } = validation.sanitized;

        // Validate condition enum
        const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
        if (condition && !validConditions.includes(condition)) {
            return { status: 400, data: { error: { message: `Invalid condition. Must be one of: ${validConditions.join(', ')}`, code: 'BAD_REQUEST' } } };
        }

        // Validate customFields
        if (customFields !== undefined && customFields !== null) {
            if (typeof customFields !== 'object' || Array.isArray(customFields)) {
                return { status: 400, data: { error: { message: 'Custom fields must be an object', code: 'BAD_REQUEST' } } };
            }
            const cfKeys = Object.keys(customFields);
            if (cfKeys.length > 20) {
                return { status: 400, data: { error: { message: 'Custom fields limited to 20 keys', code: 'BAD_REQUEST' } } };
            }
            const validKeyPattern = /^[a-zA-Z0-9_]+$/;
            for (const key of cfKeys) {
                if (key.length > 50 || !validKeyPattern.test(key)) {
                    return { status: 400, data: { error: { message: 'Custom field keys must be alphanumeric with underscores only, max 50 characters', code: 'BAD_REQUEST' } } };
                }
                const value = customFields[key];
                if (typeof value !== 'string' || value.length > 500) {
                    return { status: 400, data: { error: { message: 'Custom field values must be strings, max 500 characters', code: 'BAD_REQUEST' } } };
                }
            }
        }

        // Additional required field check
        if (!listPrice) {
            return { status: 400, data: { error: { message: 'List price is required', code: 'BAD_REQUEST' } } };
        }

        // Validate prices
        const listPriceValidation = validatePrice(listPrice, 'List price');
        if (!listPriceValidation.valid) {
            return { status: 400, data: { error: { message: listPriceValidation.error, code: 'BAD_REQUEST' } } };
        }

        const costPriceValidation = validatePrice(costPrice, 'Cost price');
        if (!costPriceValidation.valid) {
            return { status: 400, data: { error: { message: costPriceValidation.error, code: 'BAD_REQUEST' } } };
        }

        // Validate quantity (default to 1 if not provided)
        const qty = parseInt(quantity ?? 1);
        if (isNaN(qty) || qty < 0 || qty > 999999 || !Number.isInteger(Number(quantity ?? 1))) {
            return { status: 400, data: { error: { message: 'Quantity must be a positive integer (max 999999)', code: 'BAD_REQUEST' } } };
        }

        const id = uuidv4();
        const blockchainHash = await generateBlockchainHash({ title, description, images });
        const sustainabilityScore = calculateSustainability(category, condition);

        // Auto-generate SKU using default rule if no SKU provided
        let finalSku = sku;
        if (!finalSku) {
            // Check for default SKU rule
            const defaultRule = await query.get(
                'SELECT * FROM sku_rules WHERE user_id = ? AND is_default = TRUE AND is_active = TRUE',
                [user.id]
            );

            if (defaultRule) {
                // Atomically increment counter using UPDATE...RETURNING to prevent TOCTOU race condition
                const updatedRule = await query.get(
                    'UPDATE sku_rules SET counter_current = counter_current + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
                    [defaultRule.id]
                );
                finalSku = generateSkuFromRule(updatedRule || defaultRule, { brand, category, color, size });
            } else {
                // Fallback to timestamp-based SKU
                finalSku = `VL-${Date.now()}`;
            }
        }

        await query.run(`
            INSERT INTO inventory (
                id, user_id, sku, title, description, brand, category, subcategory,
                size, color, condition, cost_price, list_price, quantity, low_stock_threshold,
                weight, dimensions, material, tags, images, location, bin_location, notes,
                blockchain_hash, sustainability_score, custom_fields, purchase_date, supplier
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, user.id, finalSku, title, description || null, brand || null, category || null, subcategory || null,
            size || null, color || null, condition || 'good', costPrice || 0, listPrice, qty, lowStockThreshold || 5,
            weight || null, dimensions || null, material || null, JSON.stringify(tags || []), JSON.stringify(images || []),
            location || null, binLocation || null, notes || null, blockchainHash, JSON.stringify(sustainabilityScore || {}), JSON.stringify(customFields || {}),
            purchaseDate || null, supplier || null
        ]);

        // Log sustainability impact
        if (sustainabilityScore) {
            await query.run(`
                INSERT INTO sustainability_log (id, user_id, inventory_id, category, water_saved_liters, co2_saved_kg, waste_prevented_kg)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(), user.id, id, category || null,
                sustainabilityScore.waterSaved || 0,
                sustainabilityScore.co2Saved || 0,
                sustainabilityScore.wastePrevented || 0
            ]);
        }

        const item = await query.get('SELECT * FROM inventory WHERE id = ?', [id]);
        item.tags = safeJsonParse(item.tags, []);
        item.images = safeJsonParse(item.images, []);

        return { status: 201, data: { item } };
    }

    // PUT /api/inventory/:id - Update item
    if (method === 'PUT' && path.match(/^\/[\w-]+$/)) {
        const id = path.slice(1);

        const existing = await query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: { message: 'Item not found', code: 'NOT_FOUND' } } };
        }

        // Validate and sanitize input data (isUpdate = true allows partial data)
        const validation = validateInventoryData(body, true);
        if (!validation.valid) {
            return {
                status: 400,
                data: {
                    error: 'Validation failed',
                    errors: validation.errors
                }
            };
        }

        // Validate prices if provided
        if (body.listPrice !== undefined) {
            const listPriceValidation = validatePrice(body.listPrice, 'List price');
            if (!listPriceValidation.valid) {
                return { status: 400, data: { error: { message: listPriceValidation.error, code: 'BAD_REQUEST' } } };
            }
        }

        if (body.costPrice !== undefined) {
            const costPriceValidation = validatePrice(body.costPrice, 'Cost price');
            if (!costPriceValidation.valid) {
                return { status: 400, data: { error: { message: costPriceValidation.error, code: 'BAD_REQUEST' } } };
            }
        }

        const {
            sku, title, description, brand, category, subcategory,
            size, color, condition, costPrice, listPrice, quantity,
            lowStockThreshold, weight, dimensions, material, tags, images, thumbnailUrl,
            status, location, binLocation, notes, customFields, purchaseDate, supplier
        } = validation.sanitized;

        // Validate condition enum
        const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
        if (condition && !validConditions.includes(condition)) {
            return { status: 400, data: { error: { message: `Invalid condition. Must be one of: ${validConditions.join(', ')}`, code: 'BAD_REQUEST' } } };
        }

        // Validate status enum
        const validStatuses = ['draft', 'active', 'sold', 'archived', 'deleted'];
        if (status && !validStatuses.includes(status)) {
            return { status: 400, data: { error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, code: 'BAD_REQUEST' } } };
        }

        // Validate customFields
        if (customFields !== undefined && customFields !== null) {
            if (typeof customFields !== 'object' || Array.isArray(customFields)) {
                return { status: 400, data: { error: { message: 'Custom fields must be an object', code: 'BAD_REQUEST' } } };
            }
            const cfKeysUpdate = Object.keys(customFields);
            if (cfKeysUpdate.length > 20) {
                return { status: 400, data: { error: { message: 'Custom fields limited to 20 keys', code: 'BAD_REQUEST' } } };
            }
            const validKeyPatternUpdate = /^[a-zA-Z0-9_]+$/;
            for (const key of cfKeysUpdate) {
                if (key.length > 50 || !validKeyPatternUpdate.test(key)) {
                    return { status: 400, data: { error: { message: 'Custom field keys must be alphanumeric with underscores only, max 50 characters', code: 'BAD_REQUEST' } } };
                }
                const value = customFields[key];
                if (typeof value !== 'string' || value.length > 500) {
                    return { status: 400, data: { error: { message: 'Custom field values must be strings, max 500 characters', code: 'BAD_REQUEST' } } };
                }
            }
        }

        const updates = [];
        const values = [];

        const fields = {
            sku, title, description, brand, category, subcategory,
            size, color, condition, cost_price: costPrice, list_price: listPrice,
            quantity, low_stock_threshold: lowStockThreshold, weight, dimensions, material, thumbnail_url: thumbnailUrl,
            status, location, bin_location: binLocation, notes,
            purchase_date: purchaseDate, supplier
        };

        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (tags !== undefined) {
            updates.push('tags = ?');
            values.push(JSON.stringify(tags));
        }

        if (images !== undefined) {
            updates.push('images = ?');
            values.push(JSON.stringify(images));
        }

        if (customFields !== undefined) {
            updates.push('custom_fields = ?');
            values.push(JSON.stringify(customFields));
        }

        if (updates.length > 0) {
            values.push(id, user.id);
            await query.run(
                `UPDATE inventory SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                values
            );
        }

        const item = await query.get('SELECT * FROM inventory WHERE id = ?', [id]);
        item.tags = safeJsonParse(item.tags, []);
        item.images = safeJsonParse(item.images, []);
        item.custom_fields = safeJsonParse(item.custom_fields, {});

        return { status: 200, data: { item } };
    }

    // DELETE /api/inventory/:id - Soft delete item (moves to Recently Deleted)
    if (method === 'DELETE' && path.match(/^\/[\w-]+$/)) {
        const id = path.slice(1);

        const existing = await query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: { message: 'Item not found', code: 'NOT_FOUND' } } };
        }

        // Soft delete by setting status and deleted_at timestamp
        await query.run(
            'UPDATE inventory SET status = ?, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            ['deleted', id, user.id]
        );

        return { status: 200, data: { message: 'Item moved to Recently Deleted' } };
    }

    // POST /api/inventory/bulk - Bulk operations
    if (method === 'POST' && path === '/bulk') {
        const permission = await checkTierPermission(user, 'bulkActions');
        if (!permission.allowed) {
            return { status: 403, data: { error: { message: 'Bulk actions not available on your plan', code: 'FORBIDDEN' } } };
        }

        const { action, ids, data } = body;

        if (!action || !ids || !Array.isArray(ids)) {
            return { status: 400, data: { error: { message: 'Action and ids required', code: 'BAD_REQUEST' } } };
        }

        if (ids.length > 500) {
            return { status: 400, data: { error: { message: 'Too many items (max 500 per bulk operation)', code: 'BAD_REQUEST' } } };
        }

        let affected = 0;

        switch (action) {
            case 'delete':
                await query.run(
                    `UPDATE inventory SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                     WHERE id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
                    [...ids, user.id]
                );
                affected = ids.length;
                break;

            case 'updateStatus':
                if (!data?.status) {
                    return { status: 400, data: { error: { message: 'Status required', code: 'BAD_REQUEST' } } };
                }
                if (!['draft', 'active', 'sold', 'archived', 'deleted'].includes(data.status)) {
                    return { status: 400, data: { error: { message: 'Invalid status', code: 'BAD_REQUEST' } } };
                }
                await query.run(
                    `UPDATE inventory SET status = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
                    [data.status, ...ids, user.id]
                );
                affected = ids.length;
                break;

            case 'updatePrice':
                if (!data?.adjustment) {
                    return { status: 400, data: { error: { message: 'Price adjustment required', code: 'BAD_REQUEST' } } };
                }
                const { type, value } = data.adjustment;
                if (type === 'percentage') {
                    await query.run(
                        `UPDATE inventory SET list_price = ROUND(list_price * (1 + ? / 100), 2), updated_at = CURRENT_TIMESTAMP
                         WHERE id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
                        [value, ...ids, user.id]
                    );
                } else {
                    await query.run(
                        `UPDATE inventory SET list_price = ROUND(list_price + ?, 2), updated_at = CURRENT_TIMESTAMP
                         WHERE id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
                        [value, ...ids, user.id]
                    );
                }
                affected = ids.length;
                break;

            default:
                return { status: 400, data: { error: { message: 'Unknown action', code: 'BAD_REQUEST' } } };
        }

        return { status: 200, data: { affected } };
    }

    // GET /api/inventory/export/csv - Export inventory as CSV (Issue #91)
    if (method === 'GET' && path === '/export/csv') {
        const items = await query.all(
            `SELECT title, sku, category, brand, size, color, condition,
                    cost_price, list_price, status, quantity
             FROM inventory WHERE user_id = ? AND status != 'deleted'
             ORDER BY created_at DESC`,
            [user.id]
        );

        const escapeCsvField = (value) => {
            if (value == null) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const headers = ['title', 'sku', 'category', 'brand', 'size', 'color', 'condition', 'cost', 'price', 'status', 'quantity'];
        const rows = items.map(item => [
            escapeCsvField(item.title),
            escapeCsvField(item.sku),
            escapeCsvField(item.category),
            escapeCsvField(item.brand),
            escapeCsvField(item.size),
            escapeCsvField(item.color),
            escapeCsvField(item.condition),
            escapeCsvField(item.cost_price),
            escapeCsvField(item.list_price),
            escapeCsvField(item.status),
            escapeCsvField(item.quantity)
        ].join(','));

        const csv = [headers.join(','), ...rows].join('\r\n');
        const filename = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`;

        return {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`
            },
            data: csv
        };
    }

    // GET /api/inventory/stats - Get inventory statistics
    if (method === 'GET' && path === '/stats') {
        const stats = {
            total: Number((await query.get('SELECT COUNT(*) as count FROM inventory WHERE user_id = ?', [user.id]))?.count) || 0,
            active: Number((await query.get('SELECT COUNT(*) as count FROM inventory WHERE user_id = ? AND status = ?', [user.id, 'active']))?.count) || 0,
            draft: Number((await query.get('SELECT COUNT(*) as count FROM inventory WHERE user_id = ? AND status = ?', [user.id, 'draft']))?.count) || 0,
            sold: Number((await query.get('SELECT COUNT(*) as count FROM inventory WHERE user_id = ? AND status = ?', [user.id, 'sold']))?.count) || 0,
            totalValue: Number((await query.get('SELECT SUM(list_price * quantity) as value FROM inventory WHERE user_id = ? AND status = ?', [user.id, 'active']))?.value) || 0,
            avgPrice: Number((await query.get('SELECT AVG(list_price) as avg FROM inventory WHERE user_id = ? AND status = ?', [user.id, 'active']))?.avg) || 0,
            topCategories: await query.all(`
                SELECT category, COUNT(*) as count
                FROM inventory WHERE user_id = ? AND status != 'deleted'
                GROUP BY category ORDER BY count DESC LIMIT 5
            `, [user.id]),
            topBrands: await query.all(`
                SELECT brand, COUNT(*) as count
                FROM inventory WHERE user_id = ? AND status != 'deleted' AND brand IS NOT NULL
                GROUP BY brand ORDER BY count DESC LIMIT 5
            `, [user.id])
        };

        return { status: 200, data: { stats } };
    }

    // GET /api/inventory/deleted - Get recently deleted items (within 30 days)
    if (method === 'GET' && path === '/deleted') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        let items = await query.all(
            `SELECT * FROM inventory
             WHERE user_id = ?
             AND status = 'deleted'
             AND deleted_at IS NOT NULL
             AND deleted_at >= ?
             ORDER BY deleted_at DESC
             LIMIT 500`,
            [user.id, thirtyDaysAgo]
        );

        items = items.map(item => ({
            ...item,
            tags: safeJsonParse(item.tags, []),
            images: safeJsonParse(item.images, []),
            custom_fields: safeJsonParse(item.custom_fields, {}),
            ai_generated_data: safeJsonParse(item.ai_generated_data, {})
        }));

        return { status: 200, data: { items } };
    }

    // POST /api/inventory/:id/duplicate - Duplicate an inventory item (Issue #93)
    if (method === 'POST' && path.match(/^\/[\w-]+\/duplicate$/)) {
        const sourceId = path.split('/')[1];

        const source = await query.get(
            'SELECT * FROM inventory WHERE id = ? AND user_id = ? AND status != ?',
            [sourceId, user.id, 'deleted']
        );

        if (!source) {
            return { status: 404, data: { error: 'Item not found' } };
        }

        const newId = uuidv4();
        const newSku = `VL-${Date.now()}`;
        const now = new Date().toISOString();

        await query.run(`
            INSERT INTO inventory (
                id, user_id, sku, title, description, brand, category, subcategory,
                size, color, condition, cost_price, list_price, quantity, low_stock_threshold,
                weight, dimensions, material, tags, images, location, bin_location, notes,
                blockchain_hash, sustainability_score, custom_fields, purchase_date, supplier,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            newId, user.id, newSku,
            'Copy of ' + (source.title || ''),
            source.description, source.brand, source.category, source.subcategory,
            source.size, source.color, source.condition, source.cost_price, source.list_price,
            source.quantity, source.low_stock_threshold, source.weight, source.dimensions,
            source.material, source.tags, source.images, source.location, source.bin_location,
            source.notes, source.blockchain_hash, source.sustainability_score, source.custom_fields,
            source.purchase_date, source.supplier,
            'draft', now, now
        ]);

        const newItem = await query.get('SELECT * FROM inventory WHERE id = ?', [newId]);
        newItem.tags = safeJsonParse(newItem.tags, []);
        newItem.images = safeJsonParse(newItem.images, []);
        newItem.ai_generated_data = safeJsonParse(newItem.ai_generated_data, {});
        newItem.custom_fields = safeJsonParse(newItem.custom_fields, {});

        return { status: 201, data: { item: newItem } };
    }

    // POST /api/inventory/:id/restore - Restore deleted item
    if (method === 'POST' && path.match(/^\/[\w-]+\/restore$/)) {
        const id = path.split('/')[1];

        const existing = await query.get(
            'SELECT * FROM inventory WHERE id = ? AND user_id = ? AND status = ?',
            [id, user.id, 'deleted']
        );

        if (!existing) {
            return { status: 404, data: { error: { message: 'Deleted item not found', code: 'NOT_FOUND' } } };
        }

        // Restore item by setting status back to draft and clearing deleted_at
        await query.run(
            'UPDATE inventory SET status = ?, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            ['draft', id, user.id]
        );

        const item = await query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);
        item.tags = safeJsonParse(item.tags, []);
        item.images = safeJsonParse(item.images, []);
        item.custom_fields = safeJsonParse(item.custom_fields, {});

        return { status: 200, data: { message: 'Item restored successfully', item } };
    }

    // DELETE /api/inventory/:id/permanent - Permanently delete item
    if (method === 'DELETE' && path.match(/^\/[\w-]+\/permanent$/)) {
        const id = path.split('/')[1];

        const existing = await query.get(
            'SELECT * FROM inventory WHERE id = ? AND user_id = ? AND status = ?',
            [id, user.id, 'deleted']
        );

        if (!existing) {
            return { status: 404, data: { error: { message: 'Deleted item not found', code: 'NOT_FOUND' } } };
        }

        // Permanently delete the item
        await query.run('DELETE FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);

        return { status: 200, data: { message: 'Item permanently deleted' } };
    }

    // POST /api/inventory/cleanup-deleted - Remove deleted items older than 30 days (automated cleanup)
    if (method === 'POST' && path === '/cleanup-deleted') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const result = await query.run(
            `DELETE FROM inventory
             WHERE user_id = ?
             AND status = 'deleted'
             AND deleted_at IS NOT NULL
             AND deleted_at < ?`,
            [user.id, thirtyDaysAgo]
        );

        return { status: 200, data: { message: `Cleaned up ${result.changes || 0} expired items`, count: result.changes || 0 } };
    }

    // POST /api/inventory/import/platform - Import items from a connected marketplace
    if (method === 'POST' && path === '/import/platform') {
        const { platform, maxItems } = body;

        const allowedPlatforms = ['poshmark', 'ebay'];
        if (!platform) {
            return { status: 400, data: { error: { message: 'platform is required', code: 'BAD_REQUEST' } } };
        }

        if (!allowedPlatforms.includes(platform)) {
            return { status: 400, data: { error: { message: `Import from ${platform} requires manual CSV export. Use Import → CSV.`, code: 'BAD_REQUEST' } } };
        }

        const cap = Math.min(parseInt(maxItems) || 100, 500);

        // ── Poshmark ──────────────────────────────────────────────────────────
        if (platform === 'poshmark') {
            const { getPoshmarkBot, closePoshmarkBot } = await import('../../shared/automations/poshmark-bot.js');
            const { auditLog } = await import('../services/platformSync/platformAuditLog.js');

            // Resolve username: connected shop first, then env fallback
            const shop = await query.get(
                'SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = TRUE',
                [user.id, 'poshmark']
            );
            const username = shop?.platform_username || process.env.POSHMARK_USERNAME;

            if (!username) {
                return { status: 400, data: { error: { message: 'No connected Poshmark account. Connect your shop under Settings → Marketplaces.', code: 'BAD_REQUEST' } } };
            }

            let bot;
            try {
                auditLog('poshmark', 'platform_import_start', { userId: user.id, username, maxItems: cap });

                bot = await getPoshmarkBot({ headless: true });
                const listings = await bot.getClosetListings(username, cap);

                let imported = 0;
                let skipped = 0;
                const now = new Date().toISOString();

                for (const item of listings) {
                    try {
                        // Deduplicate: same pattern as poshmark_inventory_sync task
                        const existing = await query.get(
                            'SELECT id FROM inventory WHERE user_id = ? AND title = ? AND notes ILIKE ?',
                            [user.id, item.title || '', '%poshmark.com%']
                        );
                        if (existing) { skipped++; continue; }

                        // Parse price string ($25.00 → 25.00)
                        const listPrice = parseFloat(String(item.price || '0').replace(/[^0-9.]/g, '')) || 0;
                        const images = item.imageUrl ? JSON.stringify([item.imageUrl]) : '[]';
                        const notes = item.listingUrl ? `Imported from Poshmark: ${item.listingUrl}` : 'Imported from Poshmark';

                        await query.run(`
                            INSERT INTO inventory (
                                id, user_id, title, list_price, images, notes,
                                status, source, condition, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'poshmark', 'good', ?, ?)
                        `, [uuidv4(), user.id, item.title || 'Imported Item', listPrice, images, notes, now, now]);

                        imported++;
                    } catch (itemErr) {
                        logger.error('[Inventory] Poshmark platform import item error', user.id, { detail: itemErr?.message });
                        skipped++;
                    }
                }

                auditLog('poshmark', 'platform_import_complete', { userId: user.id, imported, skipped, total: listings.length });
                logger.info('[Inventory] Poshmark platform import complete', user.id, { imported, skipped, total: listings.length });

                return { status: 200, data: { imported, skipped, total: listings.length } };

            } catch (err) {
                logger.error('[Inventory] Poshmark platform import failed', user.id, { detail: err?.message });
                return { status: 500, data: { error: { message: `Poshmark import failed: ${err.message}`, code: 'INTERNAL_ERROR' } } };
            } finally {
                if (bot) await closePoshmarkBot();
            }
        }

        // ── eBay ──────────────────────────────────────────────────────────────
        if (platform === 'ebay') {
            const { auditLog } = await import('../services/platformSync/platformAuditLog.js');
            const { decryptToken } = await import('../utils/encryption.js');
            const { fetchWithTimeout } = await import('../shared/fetchWithTimeout.js');

            const shop = await query.get(
                'SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = TRUE',
                [user.id, 'ebay']
            );
            if (!shop || !shop.oauth_token) {
                return { status: 400, data: { error: { message: 'No connected eBay account. Connect your shop under Settings → Marketplaces.', code: 'BAD_REQUEST' } } };
            }

            try {
                const accessToken = decryptToken(shop.oauth_token);
                const oauthMode = process.env.OAUTH_MODE || 'mock';
                const ebayEnvironment = process.env.EBAY_ENVIRONMENT || 'production';
                const apiBase = ebayEnvironment === 'production'
                    ? 'https://api.ebay.com'
                    : 'https://api.sandbox.ebay.com';

                auditLog('ebay', 'platform_import_start', { userId: user.id, shopId: shop.id });

                let ebayItems = [];
                if (oauthMode === 'mock') {
                    ebayItems = [
                        { sku: 'MOCK-SKU-001', title: 'Mock eBay Item 1', price: { value: '29.99' }, quantity: 1, condition: 'USED_EXCELLENT', product: { imageUrls: [] } },
                        { sku: 'MOCK-SKU-002', title: 'Mock eBay Item 2', price: { value: '49.99' }, quantity: 3, condition: 'NEW', product: { imageUrls: [] } }
                    ];
                } else {
                    const response = await fetchWithTimeout(
                        `${apiBase}/sell/inventory/v1/inventory_item?limit=${cap}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`eBay API error: ${response.status} - ${errorText}`);
                    }
                    const data = await response.json();
                    ebayItems = data.inventoryItems || [];
                }

                const ebayConditionMap = {
                    'NEW': 'new',
                    'LIKE_NEW': 'like_new',
                    'USED_EXCELLENT': 'like_new',
                    'USED_VERY_GOOD': 'good',
                    'USED_GOOD': 'good',
                    'USED_ACCEPTABLE': 'fair',
                    'FOR_PARTS_OR_NOT_WORKING': 'poor'
                };

                let imported = 0;
                let skipped = 0;
                const now = new Date().toISOString();

                for (const ebayItem of ebayItems) {
                    try {
                        const sku = ebayItem.sku || null;

                        // Deduplicate by SKU
                        if (sku) {
                            const existing = await query.get(
                                'SELECT id FROM inventory WHERE user_id = ? AND sku = ?',
                                [user.id, sku]
                            );
                            if (existing) { skipped++; continue; }
                        }

                        const title = ebayItem.title || ebayItem.product?.title || 'Imported eBay Item';
                        const listPrice = parseFloat(
                            ebayItem.price?.value ||
                            ebayItem.offers?.[0]?.price?.value ||
                            0
                        ) || 0;
                        const quantity = parseInt(
                            ebayItem.availability?.shipToLocationAvailability?.quantity ||
                            ebayItem.quantity ||
                            1
                        );
                        const condition = ebayConditionMap[ebayItem.condition] || 'good';
                        const imageUrls = ebayItem.product?.imageUrls || [];
                        const images = JSON.stringify(imageUrls);
                        const description = ebayItem.product?.description || null;

                        await query.run(`
                            INSERT INTO inventory (
                                id, user_id, sku, title, description, list_price, quantity,
                                condition, images, status, source, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'ebay', ?, ?)
                        `, [uuidv4(), user.id, sku, title, description, listPrice, quantity, condition, images, now, now]);

                        imported++;
                    } catch (itemErr) {
                        logger.error('[Inventory] eBay platform import item error', user.id, { detail: itemErr?.message });
                        skipped++;
                    }
                }

                auditLog('ebay', 'platform_import_complete', { userId: user.id, imported, skipped, total: ebayItems.length });
                logger.info('[Inventory] eBay platform import complete', user.id, { imported, skipped, total: ebayItems.length });

                return { status: 200, data: { imported, skipped, total: ebayItems.length } };

            } catch (err) {
                logger.error('[Inventory] eBay platform import failed', user.id, { detail: err?.message });
                return { status: 500, data: { error: { message: `eBay import failed: ${err.message}`, code: 'INTERNAL_ERROR' } } };
            }
        }
    }

    // POST /api/inventory/import/csv - Import items from CSV
    if (method === 'POST' && path === '/import/csv') {
        const { items } = body;

        if (!items || !Array.isArray(items)) {
            return { status: 400, data: { error: { message: 'Items array required', code: 'BAD_REQUEST' } } };
        }

        if (items.length > 1000) {
            return { status: 400, data: { error: { message: 'Maximum 1000 items per import', code: 'BAD_REQUEST' } } };
        }

        let imported = 0;
        const errors = [];

        for (const itemData of items) {
            // Validate required fields
            if (!itemData.title || !itemData.price) {
                errors.push({ item: itemData.title || 'Unknown', error: 'Missing title or price' });
                continue;
            }

            try {
                const id = uuidv4();
                const now = new Date().toISOString();

                // Prepare item data
                const costPrice = parseFloat(itemData.costPrice || itemData.cost_price || 0);
                const listPrice = parseFloat(itemData.price || itemData.listPrice || itemData.list_price);
                const quantity = parseInt(itemData.quantity || 1);
                const lowStockThreshold = parseInt(itemData.lowStockThreshold || itemData.low_stock_threshold || 5);

                // Validate parsed numeric fields for NaN
                if (isNaN(costPrice) || isNaN(listPrice) || isNaN(quantity) || isNaN(lowStockThreshold)) {
                    errors.push({ item: itemData.title, error: 'Invalid numeric values (NaN detected)' });
                    continue;
                }

                // Validate per-field string lengths
                if (itemData.title && itemData.title.length > 500) {
                    errors.push({ item: itemData.title.slice(0, 50), error: 'Title exceeds 500 characters' });
                    continue;
                }
                if (itemData.description && itemData.description.length > 5000) {
                    errors.push({ item: itemData.title, error: 'Description exceeds 5000 characters' });
                    continue;
                }
                if (itemData.brand && itemData.brand.length > 200) {
                    errors.push({ item: itemData.title, error: 'Brand exceeds 200 characters' });
                    continue;
                }
                if (itemData.sku && itemData.sku.length > 100) {
                    errors.push({ item: itemData.title, error: 'SKU exceeds 100 characters' });
                    continue;
                }

                const item = {
                    id,
                    user_id: user.id,
                    title: itemData.title,
                    brand: itemData.brand || null,
                    category: itemData.category || null,
                    size: itemData.size || null,
                    color: itemData.color || null,
                    condition: itemData.condition || 'good',
                    cost_price: costPrice,
                    list_price: listPrice,
                    quantity: quantity,
                    low_stock_threshold: lowStockThreshold,
                    description: itemData.description || null,
                    images: '[]',
                    status: 'active',
                    source: 'csv',
                    created_at: now,
                    updated_at: now
                };

                // Insert into database
                await query.run(`
                    INSERT INTO inventory (
                        id, user_id, title, brand, category, size, color, condition,
                        cost_price, list_price, quantity, low_stock_threshold,
                        description, images, status, source, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    item.id, item.user_id, item.title, item.brand, item.category,
                    item.size, item.color, item.condition, item.cost_price, item.list_price,
                    item.quantity, item.low_stock_threshold, item.description, item.images,
                    item.status, item.source, item.created_at, item.updated_at
                ]);

                imported++;
            } catch (error) {
                logger.error('[Inventory] Error importing item', null, { detail: error?.message || 'Unknown error' });
                errors.push({ item: itemData.title, error: 'Failed to import item' });
            }
        }

        return {
            status: 200,
            data: {
                message: `Imported ${imported} of ${items.length} items`,
                imported,
                total: items.length,
                errors: errors.length > 0 ? errors : undefined
            }
        };
    }

    // POST /api/inventory/import/url - Import item from marketplace URL
    if (method === 'POST' && path === '/import/url') {
        const { url, marketplace } = body;

        if (!url) {
            return { status: 400, data: { error: { message: 'URL required', code: 'BAD_REQUEST' } } };
        }

        // SSRF protection — block private/loopback/link-local addresses
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return { status: 400, data: { error: { message: 'URL must use http or https', code: 'BAD_REQUEST' } } };
            }
            const host = parsed.hostname.toLowerCase();
            if (
                host === 'localhost' || host === '::1' ||
                /^127\./.test(host) ||
                /^169\.254\./.test(host) ||
                /^10\./.test(host) ||
                /^192\.168\./.test(host) ||
                /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
            ) {
                return { status: 400, data: { error: { message: 'URL not allowed', code: 'BAD_REQUEST' } } };
            }
        } catch {
            return { status: 400, data: { error: { message: 'Invalid URL', code: 'BAD_REQUEST' } } };
        }

        let html = '';
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; VaultLister/3.0)',
                    'Accept': 'text/html,application/xhtml+xml'
                },
                signal: AbortSignal.timeout(10000)
            });
            // Parse whatever HTML we get (including 4xx pages) — they often contain OG tags
            html = await response.text();
        } catch (err) {
            logger.error('[Inventory] URL import fetch failed', user.id, { url, detail: err.message });
            // Return a blank item on network failure so user can fill in details manually
        }

        // Extract Open Graph metadata (present on all major marketplaces)
        const og = (prop) => {
            const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const m = html.match(new RegExp(`<meta[^>]+property=["']og:${esc}["'][^>]+content=["']([^"']+)["']`, 'i')) // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
                      || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${esc}["']`, 'i')); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
            return m ? m[1].trim() : null;
        };

        // Extract JSON-LD Product schema if present
        let jsonLd = null;
        const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
        if (jsonLdMatch) {
            try {
                const parsed = JSON.parse(jsonLdMatch[1]);
                const candidates = Array.isArray(parsed) ? parsed : [parsed];
                jsonLd = candidates.find(d => d['@type'] === 'Product') || null;
            } catch { /* ignore malformed JSON-LD */ }
        }

        // Build item from best available data (JSON-LD preferred, og fallback)
        const title = (jsonLd?.name || og('title') || '').replace(/\s*[-|].*$/, '').trim();
        const description = jsonLd?.description || og('description') || '';
        const image = jsonLd?.image?.[0] || jsonLd?.image || og('image') || null;
        const images = image ? [image] : [];

        // Price: JSON-LD offers > og:price:amount
        let listPrice = 0;
        const priceStr = jsonLd?.offers?.price
            || jsonLd?.offers?.[0]?.price
            || og('price:amount');
        if (priceStr) {
            listPrice = parseFloat(String(priceStr).replace(/[^0-9.]/g, '')) || 0;
        }

        // Brand
        const brand = jsonLd?.brand?.name || jsonLd?.brand || og('brand') || '';

        // Condition mapping from JSON-LD
        const conditionMap = {
            'NewCondition': 'new',
            'UsedCondition': 'good',
            'RefurbishedCondition': 'fair',
            'DamagedCondition': 'poor'
        };
        const rawCondition = jsonLd?.offers?.itemCondition || jsonLd?.offers?.[0]?.itemCondition || '';
        const conditionKey = rawCondition.replace(/.*\//, '');
        const condition = conditionMap[conditionKey] || 'good';

        const detectedMarketplace = marketplace || detectMarketplace(url);

        const item = {
            title: title || 'Imported Item',
            description,
            listPrice,
            category: '',
            brand,
            size: '',
            color: '',
            condition,
            images,
            marketplace: detectedMarketplace,
            sourceUrl: url
        };

        logger.info('[Inventory] URL import complete', user.id, { url, title: item.title });
        return {
            status: 200,
            data: { item, message: 'Item data fetched successfully.' }
        };
    }

    // ============================================
    // Category Management
    // ============================================

    // GET /api/inventory/categories - List user categories
    if (method === 'GET' && path === '/categories') {
        const categories = await query.all('SELECT id, name, color, sort_order, created_at, updated_at FROM inventory_categories WHERE user_id = ? ORDER BY sort_order, name LIMIT 200', [user.id]);
        // Also get counts per category from inventory
        const counts = await query.all(`SELECT category, COUNT(*) as count FROM inventory WHERE user_id = ? AND status = 'active' GROUP BY category`, [user.id]);
        const countMap = {};
        for (const c of counts) countMap[c.category || 'Uncategorized'] = c.count;
        for (const cat of categories) cat.item_count = countMap[cat.name] || 0;
        return { status: 200, data: { categories } };
    }

    // POST /api/inventory/categories - Create category
    if (method === 'POST' && path === '/categories') {
        const { name, color } = body;
        if (!name || !name.trim()) return { status: 400, data: { error: { message: 'Category name required', code: 'BAD_REQUEST' } } };
        const existing = await query.get('SELECT id FROM inventory_categories WHERE user_id = ? AND name = ?', [user.id, name.trim()]);
        if (existing) return { status: 409, data: { error: { message: 'Category already exists', code: 'CONFLICT' } } };
        const maxOrder = await query.get('SELECT MAX(sort_order) as m FROM inventory_categories WHERE user_id = ?', [user.id]);
        const id = uuidv4();
        await query.run('INSERT INTO inventory_categories (id, user_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)',
            [id, user.id, name.trim(), color || '#6366f1', (maxOrder?.m || 0) + 1]);
        return { status: 201, data: { category: { id, name: name.trim(), color: color || '#6366f1' } } };
    }

    // PUT /api/inventory/categories/:id - Update category
    if (method === 'PUT' && path.match(/^\/categories\/[a-f0-9-]+$/)) {
        const catId = path.split('/')[2];
        const cat = await query.get('SELECT * FROM inventory_categories WHERE id = ? AND user_id = ?', [catId, user.id]);
        if (!cat) return { status: 404, data: { error: { message: 'Category not found', code: 'NOT_FOUND' } } };
        const { name, color, sort_order } = body;
        const updates = [];
        const vals = [];
        if (name !== undefined) { updates.push('name = ?'); vals.push(name.trim()); }
        if (color !== undefined) { updates.push('color = ?'); vals.push(color); }
        if (sort_order !== undefined) { updates.push('sort_order = ?'); vals.push(sort_order); }
        if (updates.length > 0) {
            vals.push(catId);
            vals.push(user.id);
            await query.run(`UPDATE inventory_categories SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`, vals);
            // If name changed, update inventory items
            if (name !== undefined && name.trim() !== cat.name) {
                await query.run('UPDATE inventory SET category = ? WHERE user_id = ? AND category = ?', [name.trim(), user.id, cat.name]);
            }
        }
        return { status: 200, data: { message: 'Category updated' } };
    }

    // DELETE /api/inventory/categories/:id - Delete category
    if (method === 'DELETE' && path.match(/^\/categories\/[a-f0-9-]+$/)) {
        const catId = path.split('/')[2];
        const cat = await query.get('SELECT * FROM inventory_categories WHERE id = ? AND user_id = ?', [catId, user.id]);
        if (!cat) return { status: 404, data: { error: { message: 'Category not found', code: 'NOT_FOUND' } } };
        await query.run('DELETE FROM inventory_categories WHERE id = ? AND user_id = ?', [catId, user.id]);
        // Clear category on items (set to null)
        await query.run('UPDATE inventory SET category = NULL WHERE user_id = ? AND category = ?', [user.id, cat.name]);
        return { status: 200, data: { message: 'Category deleted' } };
    }

    // ============================================
    // Supplier Management
    // ============================================

    // GET /api/inventory/suppliers - List suppliers
    if (method === 'GET' && path === '/suppliers') {
        const suppliers = await query.all(`
            SELECT s.*,
                (SELECT COUNT(*) FROM supplier_items WHERE supplier_id = s.id) as item_count,
                (SELECT AVG(current_price) FROM supplier_items WHERE supplier_id = s.id) as avg_price
            FROM suppliers s WHERE s.user_id = ? ORDER BY s.name
        `, [user.id]);
        return { status: 200, data: { suppliers } };
    }

    // POST /api/inventory/suppliers - Create supplier
    if (method === 'POST' && path === '/suppliers') {
        const { name, type, website, contact_email, contact_phone, address, notes, rating } = body;
        if (!name?.trim()) return { status: 400, data: { error: { message: 'Supplier name required', code: 'BAD_REQUEST' } } };
        const id = uuidv4();
        await query.run(`INSERT INTO suppliers (id, user_id, name, type, website, contact_email, contact_phone, address, notes, rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, user.id, name.trim(), type || 'other', website || null, contact_email || null,
             contact_phone || null, address || null, notes || null, rating || null]);
        return { status: 201, data: { supplier: { id, name: name.trim() } } };
    }

    // PUT /api/inventory/suppliers/:id - Update supplier
    if (method === 'PUT' && path.match(/^\/suppliers\/[a-f0-9-]+$/)) {
        const supId = path.split('/')[2];
        const sup = await query.get('SELECT id FROM suppliers WHERE id = ? AND user_id = ?', [supId, user.id]);
        if (!sup) return { status: 404, data: { error: { message: 'Supplier not found', code: 'NOT_FOUND' } } };
        const fields = ['name', 'type', 'website', 'contact_email', 'contact_phone', 'address', 'notes', 'rating', 'is_active'];
        const updates = [];
        const vals = [];
        for (const f of fields) {
            if (body[f] !== undefined) { updates.push(f + ' = ?'); vals.push(body[f]); }
        }
        if (updates.length > 0) {
            vals.push(supId, user.id);
            await query.run(`UPDATE suppliers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`, vals);
        }
        return { status: 200, data: { message: 'Supplier updated' } };
    }

    // GET /api/inventory/suppliers/:id/performance - Supplier performance analytics
    if (method === 'GET' && path.match(/^\/suppliers\/[a-f0-9-]+\/performance$/)) {
        const supId = path.split('/')[2];
        const sup = await query.get('SELECT * FROM suppliers WHERE id = ? AND user_id = ?', [supId, user.id]);
        if (!sup) return { status: 404, data: { error: { message: 'Supplier not found', code: 'NOT_FOUND' } } };

        // Items from this supplier
        const items = await query.all(`
            SELECT i.id, i.title, i.cost_price, i.list_price, i.status, i.created_at,
                CAST(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400 AS INTEGER) as days_old,
                (SELECT COUNT(*) FROM sales WHERE inventory_id = i.id) as sale_count,
                (SELECT AVG(sale_price) FROM sales WHERE inventory_id = i.id) as avg_sale_price
            FROM inventory i
            WHERE i.user_id = ? AND i.supplier = ?
            ORDER BY i.created_at DESC
            LIMIT 500
        `, [user.id, sup.name]);

        const totalItems = items.length;
        const activeItems = items.filter(i => i.status === 'active').length;
        const soldItems = items.filter(i => i.sale_count > 0).length;
        const totalCost = items.reduce((s, i) => s + (i.cost_price || 0), 0);
        const totalRevenue = items.reduce((s, i) => s + ((i.avg_sale_price || 0) * (i.sale_count || 0)), 0);
        const totalProfit = totalRevenue - totalCost;
        const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        const sellThrough = totalItems > 0 ? (soldItems / totalItems) * 100 : 0;
        const avgDaysToSell = items.filter(i => i.sale_count > 0).length > 0
            ? items.filter(i => i.sale_count > 0).reduce((s, i) => s + (i.days_old || 0), 0) / items.filter(i => i.sale_count > 0).length
            : 0;

        // Monthly cost trends (last 6 months)
        const costTrends = await query.all(`
            SELECT TO_CHAR(i.created_at, 'YYYY-MM') as month,
                COUNT(*) as items_sourced,
                SUM(i.cost_price) as total_cost,
                AVG(i.cost_price) as avg_cost
            FROM inventory i
            WHERE i.user_id = ? AND i.supplier = ? AND i.created_at >= NOW() - INTERVAL '6 months'
            GROUP BY month ORDER BY month
        `, [user.id, sup.name]);

        return { status: 200, data: {
            supplier: sup,
            stats: { totalItems, activeItems, soldItems, totalCost, totalRevenue, totalProfit, avgMargin, sellThrough, avgDaysToSell },
            costTrends,
            recentItems: items.slice(0, 10)
        }};
    }

    // DELETE /api/inventory/suppliers/:id - Delete supplier
    if (method === 'DELETE' && path.match(/^\/suppliers\/[a-f0-9-]+$/)) {
        const supId = path.split('/')[2];
        const sup = await query.get('SELECT id FROM suppliers WHERE id = ? AND user_id = ?', [supId, user.id]);
        if (!sup) return { status: 404, data: { error: { message: 'Supplier not found', code: 'NOT_FOUND' } } };
        await query.run('DELETE FROM suppliers WHERE id = ? AND user_id = ?', [supId, user.id]);
        return { status: 200, data: { message: 'Supplier deleted' } };
    }

// POST /api/inventory/:id/duplicate - Duplicate an inventory item
    if (method === 'POST' && path.match(/^\/[\w-]+\/duplicate$/)) {
        const sourceId = path.split('/')[1];

        const source = await query.get(
            'SELECT * FROM inventory WHERE id = ? AND user_id = ?',
            [sourceId, user.id]
        );
        if (!source) {
            return { status: 404, data: { error: { message: 'Item not found', code: 'NOT_FOUND' } } };
        }

        const newId = uuidv4();

        // Generate a new unique SKU: append -COPY-<random4> to avoid collisions
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const randomValues = new Uint32Array(4);
        crypto.getRandomValues(randomValues);
        const suffix = Array.from(randomValues).map(v => chars[v % chars.length]).join('');
        const newSku = source.sku ? `${source.sku}-COPY-${suffix}` : `COPY-${suffix}`;

        const newTitle = `${source.title} (Copy)`;

        await query.run(`
            INSERT INTO inventory (
                id, user_id, sku, title, description, brand, category, subcategory,
                size, color, condition, cost_price, list_price, quantity,
                low_stock_threshold, weight, dimensions, material, tags, images,
                location, bin_location, notes, custom_fields, ai_generated_data,
                blockchain_hash, sustainability_score, status, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        `, [
            newId, user.id, newSku, newTitle,
            source.description, source.brand, source.category, source.subcategory,
            source.size, source.color, source.condition,
            source.cost_price, source.list_price, source.quantity,
            source.low_stock_threshold, source.weight, source.dimensions, source.material,
            source.tags, source.images, source.location, source.bin_location, source.notes,
            source.custom_fields, source.ai_generated_data,
            source.blockchain_hash, source.sustainability_score
        ]);

        const newItem = await query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [newId, user.id]);
        newItem.tags = safeJsonParse(newItem.tags, []);
        newItem.images = safeJsonParse(newItem.images, []);
        newItem.ai_generated_data = safeJsonParse(newItem.ai_generated_data, {});
        newItem.custom_fields = safeJsonParse(newItem.custom_fields, {});

        return { status: 201, data: { item: newItem } };
    }

// PUT /api/inventory/bulk/update - Bulk update status, category, or price for multiple items

    // POST /api/inventory/purge-deleted - Permanently purge items soft-deleted 30+ days ago
    if (method === 'POST' && path === '/purge-deleted') {
        try {
            const { v4: uuidv4 } = await import('uuid');
            const taskId = uuidv4();
            await query.run(
                `INSERT INTO task_queue (id, type, payload, priority, max_attempts, created_at, scheduled_at)
                 VALUES (?, 'purge_deleted_inventory', ?, 1, 1, NOW(), NOW())`,
                [taskId, JSON.stringify({ userId: user.id })]
            );
            return { status: 202, data: { taskId, status: 'queued', message: 'Purge of deleted items older than 30 days has been queued' } };
        } catch (error) {
            logger.error('[Inventory] purge-deleted queue error', user?.id, { detail: error.message });
            return { status: 500, data: { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } } };
        }
    }

    if (method === 'PUT' && path === '/bulk/update') {
        try {
            const { ids, status: newStatus, category, listPrice } = body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return { status: 400, data: { error: 'ids array required' } };
            }
            if (ids.length > 200) {
                return { status: 400, data: { error: 'Maximum 200 items per bulk operation' } };
            }
            if (!newStatus && !category && listPrice === undefined) {
                return { status: 400, data: { error: 'At least one of status, category, or listPrice required' } };
            }

            const ALLOWED_STATUSES = new Set(['active', 'draft', 'inactive', 'sold', 'deleted']);
            if (newStatus && !ALLOWED_STATUSES.has(newStatus)) {
                return { status: 400, data: { error: 'Invalid status value' } };
            }

            if (listPrice !== undefined && (typeof listPrice !== 'number' || listPrice < 0)) {
                return { status: 400, data: { error: 'listPrice must be a non-negative number' } };
            }

            // Verify ownership of all IDs in one query
            const placeholders = ids.map(() => '?').join(',');
            const owned = await query.all(
                `SELECT id FROM inventory WHERE id IN (${placeholders}) AND user_id = ?`,
                [...ids, user.id]
            );
            const ownedIds = owned.map(r => r.id);

            if (ownedIds.length === 0) {
                return { status: 404, data: { error: 'No matching items found' } };
            }

            const setParts = [];
            const params = [];
            if (newStatus) { setParts.push('status = ?'); params.push(newStatus); }
            if (category) { setParts.push('category = ?'); params.push(category); }
            if (listPrice !== undefined) { setParts.push('list_price = ?'); params.push(listPrice); }
            setParts.push('updated_at = NOW()');

            const ownedPlaceholders = ownedIds.map(() => '?').join(',');
            await query.run(
                `UPDATE inventory SET ${setParts.join(', ')} WHERE id IN (${ownedPlaceholders}) AND user_id = ?`,
                [...params, ...ownedIds, user.id]
            );

            return {
                status: 200,
                data: {
                    updated: ownedIds.length,
                    skipped: ids.length - ownedIds.length,
                    ids: ownedIds
                }
            };
        } catch (error) {
            logger.error('[Inventory] bulk/update error', user?.id, { detail: error.message });
            return { status: 500, data: { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } } };
        }
    }

    // DELETE /api/inventory/bulk/delete - Soft-delete multiple items
    if (method === 'DELETE' && path === '/bulk/delete') {
        try {
            const { ids } = body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return { status: 400, data: { error: 'ids array required' } };
            }
            if (ids.length > 200) {
                return { status: 400, data: { error: 'Maximum 200 items per bulk operation' } };
            }

            const placeholders = ids.map(() => '?').join(',');
            const owned = await query.all(
                `SELECT id FROM inventory WHERE id IN (${placeholders}) AND user_id = ? AND status != 'deleted'`,
                [...ids, user.id]
            );
            const ownedIds = owned.map(r => r.id);

            if (ownedIds.length === 0) {
                return { status: 404, data: { error: 'No matching items found' } };
            }

            const ownedPlaceholders = ownedIds.map(() => '?').join(',');
            await query.run(
                `UPDATE inventory SET status = 'deleted', updated_at = NOW() WHERE id IN (${ownedPlaceholders}) AND user_id = ?`,
                [...ownedIds, user.id]
            );

            return {
                status: 200,
                data: {
                    deleted: ownedIds.length,
                    skipped: ids.length - ownedIds.length,
                    ids: ownedIds
                }
            };
        } catch (error) {
            logger.error('[Inventory] bulk/delete error', user?.id, { detail: error.message });
            return { status: 500, data: { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } } };
        }
    }

    // POST /api/inventory/bulk/cross-list - Queue cross-listing draft listings for multiple items
    if (method === 'POST' && path === '/bulk/cross-list') {
        try {
            const { ids, platforms } = body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return { status: 400, data: { error: 'ids array required' } };
            }
            if (!Array.isArray(platforms) || platforms.length === 0) {
                return { status: 400, data: { error: 'platforms array required' } };
            }
            if (ids.length > 100) {
                return { status: 400, data: { error: 'Maximum 100 items per bulk cross-list operation' } };
            }

            const VALID_PLATFORMS = new Set(['poshmark', 'ebay', 'mercari', 'depop', 'grailed', 'etsy', 'shopify', 'facebook', 'whatnot']);
            const invalidPlatforms = platforms.filter(p => !VALID_PLATFORMS.has(p));
            if (invalidPlatforms.length > 0) {
                return { status: 400, data: { error: `Invalid platforms: ${invalidPlatforms.join(', ')}` } };
            }

            // Verify ownership and fetch active items only
            const placeholders = ids.map(() => '?').join(',');
            const items = await query.all(
                `SELECT id, title, list_price FROM inventory WHERE id IN (${placeholders}) AND user_id = ? AND status != 'deleted'`,
                [...ids, user.id]
            );

            if (items.length === 0) {
                return { status: 404, data: { error: 'No matching items found' } };
            }

            const { v4: uuidv4 } = await import('uuid');
            const results = { created: [], skipped: [], errors: [] };

            for (const item of items) {
                for (const platform of platforms) {
                    try {
                        const existing = await query.get(
                            `SELECT id FROM listings WHERE inventory_id = ? AND platform = ? AND user_id = ? AND status NOT IN ('deleted','ended')`,
                            [item.id, platform, user.id]
                        );
                        if (existing) {
                            results.skipped.push({ inventoryId: item.id, platform, reason: 'Already listed', existingId: existing.id });
                            continue;
                        }
                        const listingId = uuidv4();
                        await query.run(
                            `INSERT INTO listings (id, inventory_id, user_id, platform, title, price, status, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, 'draft', NOW(), NOW())`,
                            [listingId, item.id, user.id, platform, item.title, item.list_price]
                        );
                        results.created.push({ inventoryId: item.id, platform, listingId });
                    } catch (err) {
                        results.errors.push({ inventoryId: item.id, platform, error: err.message });
                    }
                }
            }

            return { status: 201, data: results };
        } catch (error) {
            logger.error('[Inventory] bulk/cross-list error', user?.id, { detail: error.message });
            return { status: 500, data: { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } } };
        }
    }

    return { status: 404, data: { error: { message: 'Route not found', code: 'NOT_FOUND' } } };

}
