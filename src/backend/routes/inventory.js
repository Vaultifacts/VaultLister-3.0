// Inventory Routes
import { v4 as uuidv4 } from 'uuid';
import { query, escapeLike } from '../db/database.js';
import { checkTierPermission } from '../middleware/auth.js';
import { generateBlockchainHash } from '../../shared/utils/blockchain.js';
import { calculateSustainability } from '../../shared/utils/sustainability.js';
import { validateInventoryData, validatePrice } from '../../shared/utils/sanitize.js';
import { logger } from '../shared/logger.js';

/**
 * Safe JSON parse helper — returns fallback on malformed data instead of throwing
 */
function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

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
        sku = sku.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g'), value);
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
                return { status: 400, data: { error: 'Search query too long (max 500 characters)' } };
            }

            // Sanitize search term for FTS5 (strip quotes, operators, special chars)
            const sanitizedSearch = search.replace(/['"*(){}[\]^~\\]/g, '').replace(/\b(AND|OR|NOT|NEAR)\b/gi, '');

            // Try full-text search (may fail with invalid syntax)
            if (sanitizedSearch.length > 0) {
                try {
                    // FIXED 2026-02-24: Quote as FTS5 phrase to prevent hyphens as NOT (Issue #4)
                    const ftsResults = query.all(`
                        SELECT id FROM inventory_fts WHERE inventory_fts MATCH ?
                    `, ['"' + sanitizedSearch + '"']);
                    ftsIds = ftsResults.map(r => r.id);
                    useFullTextSearch = true;
                } catch (e) {
                    // FTS5 syntax error - fall back to LIKE search
                    useFullTextSearch = false;
                }
            }

            if (useFullTextSearch && ftsIds.length > 0) {
                sql += ` AND id IN (${ftsIds.map(() => '?').join(',')})`;
                params.push(...ftsIds);
            } else {
                // Fallback to LIKE search
                sql += ` AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\')`;
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
                sql += ' ORDER BY title COLLATE NOCASE ASC';
                break;
            case 'title_desc':
                sql += ' ORDER BY title COLLATE NOCASE DESC';
                break;
            case 'sku_asc':
                sql += ' ORDER BY sku COLLATE NOCASE ASC';
                break;
            case 'sku_desc':
                sql += ' ORDER BY sku COLLATE NOCASE DESC';
                break;
            case 'status_asc':
                sql += ' ORDER BY status ASC';
                break;
            case 'status_desc':
                sql += ' ORDER BY status DESC';
                break;
            case 'marketplace_asc':
                sql += ' ORDER BY marketplace COLLATE NOCASE ASC';
                break;
            case 'marketplace_desc':
                sql += ' ORDER BY marketplace COLLATE NOCASE DESC';
                break;
            case 'tags_asc':
                sql += ' ORDER BY tags COLLATE NOCASE ASC';
                break;
            case 'tags_desc':
                sql += ' ORDER BY tags COLLATE NOCASE DESC';
                break;
            default:
                sql += ' ORDER BY created_at DESC';
        }

        sql += ' LIMIT ? OFFSET ?';
        const cappedLimit = Math.min(parseInt(limit) || 50, 200);
        params.push(cappedLimit, parseInt(offset) || 0);

        const items = query.all(sql, params);

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
                countSql += ` AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\')`;
                const searchTerm = `%${escapeLike(search)}%`;
                countParams.push(searchTerm, searchTerm, searchTerm);
            }
        }
        const total = query.get(countSql, countParams)?.total || 0;

        // Parse JSON fields
        items.forEach(item => {
            try { item.tags = JSON.parse(item.tags || '[]'); } catch { item.tags = []; }
            try { item.images = JSON.parse(item.images || '[]'); } catch { item.images = []; }
            try { item.ai_generated_data = JSON.parse(item.ai_generated_data || '{}'); } catch { item.ai_generated_data = {}; }
            try { item.custom_fields = JSON.parse(item.custom_fields || '{}'); } catch { item.custom_fields = {}; }
        });

        return {
            status: 200,
            data: { items, total, limit: cappedLimit, offset: parseInt(offset) }
        };
    }

    // GET /api/inventory/:id/history - Get item purchase and sales history
    if (method === 'GET' && path.match(/^\/[\w-]+\/history$/)) {
        const id = path.split('/')[1];

        // Verify item exists and belongs to user
        const item = query.get('SELECT id FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!item) {
            return { status: 404, data: { error: 'Item not found' } };
        }

        // Get purchases associated with this item
        const purchases = query.all(`
            SELECT pi.*, p.vendor_name, p.purchase_date, p.payment_method
            FROM purchase_items pi
            JOIN purchases p ON pi.purchase_id = p.id
            WHERE pi.inventory_id = ? AND p.user_id = ?
            ORDER BY p.purchase_date DESC
        `, [id, user.id]);

        // Get sales associated with this item
        const sales = query.all(`
            SELECT * FROM sales
            WHERE inventory_id = ? AND user_id = ?
            ORDER BY created_at DESC
        `, [id, user.id]);

        // Get price history if table exists (check first to avoid prepared statement cache errors)
        let priceHistory = [];
        const priceHistoryTableExists = query.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='price_history'`
        );
        if (priceHistoryTableExists) {
            priceHistory = query.all(`
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
        const item = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);

        if (!item) {
            return { status: 404, data: { error: 'Item not found' } };
        }

        item.tags = safeJsonParse(item.tags, []);
        item.images = safeJsonParse(item.images, []);
        item.ai_generated_data = safeJsonParse(item.ai_generated_data, {});
        item.custom_fields = safeJsonParse(item.custom_fields, {});

        // Get associated listings
        const listings = query.all(
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
        const permission = checkTierPermission(user, 'listings');
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
            customFields
        } = validation.sanitized;

        // Validate condition enum
        const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
        if (condition && !validConditions.includes(condition)) {
            return { status: 400, data: { error: `Invalid condition. Must be one of: ${validConditions.join(', ')}` } };
        }

        // Validate customFields
        if (customFields !== undefined && customFields !== null) {
            if (typeof customFields !== 'object' || Array.isArray(customFields)) {
                return { status: 400, data: { error: 'Custom fields must be an object' } };
            }
            const cfKeys = Object.keys(customFields);
            if (cfKeys.length > 50) {
                return { status: 400, data: { error: 'Custom fields limited to 50 keys' } };
            }
            if (JSON.stringify(customFields).length > 10240) {
                return { status: 400, data: { error: 'Custom fields too large (max 10KB)' } };
            }
        }

        // Additional required field check
        if (!listPrice) {
            return { status: 400, data: { error: 'List price is required' } };
        }

        // Validate prices
        const listPriceValidation = validatePrice(listPrice, 'List price');
        if (!listPriceValidation.valid) {
            return { status: 400, data: { error: listPriceValidation.error } };
        }

        const costPriceValidation = validatePrice(costPrice, 'Cost price');
        if (!costPriceValidation.valid) {
            return { status: 400, data: { error: costPriceValidation.error } };
        }

        // Validate quantity (default to 1 if not provided)
        const qty = parseInt(quantity ?? 1);
        if (isNaN(qty) || qty < 0 || qty > 999999 || !Number.isInteger(Number(quantity ?? 1))) {
            return { status: 400, data: { error: 'Quantity must be a positive integer (max 999999)' } };
        }

        const id = uuidv4();
        const blockchainHash = generateBlockchainHash({ title, description, images });
        const sustainabilityScore = calculateSustainability(category, condition);

        // Auto-generate SKU using default rule if no SKU provided
        let finalSku = sku;
        if (!finalSku) {
            // Check for default SKU rule
            const defaultRule = query.get(
                'SELECT * FROM sku_rules WHERE user_id = ? AND is_default = 1 AND is_active = 1',
                [user.id]
            );

            if (defaultRule) {
                // Atomically increment counter using UPDATE...RETURNING to prevent TOCTOU race condition
                const updatedRule = query.get(
                    'UPDATE sku_rules SET counter_current = counter_current + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
                    [defaultRule.id]
                );
                finalSku = generateSkuFromRule(updatedRule || defaultRule, { brand, category, color, size });
            } else {
                // Fallback to timestamp-based SKU
                finalSku = `VL-${Date.now()}`;
            }
        }

        query.run(`
            INSERT INTO inventory (
                id, user_id, sku, title, description, brand, category, subcategory,
                size, color, condition, cost_price, list_price, quantity, low_stock_threshold,
                weight, dimensions, material, tags, images, location, bin_location, notes,
                blockchain_hash, sustainability_score, custom_fields
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, user.id, finalSku, title, description || null, brand || null, category || null, subcategory || null,
            size || null, color || null, condition || 'good', costPrice || 0, listPrice, qty, lowStockThreshold || 5,
            weight || null, dimensions || null, material || null, JSON.stringify(tags || []), JSON.stringify(images || []),
            location || null, binLocation || null, notes || null, blockchainHash, JSON.stringify(sustainabilityScore || {}), JSON.stringify(customFields || {})
        ]);

        // Log sustainability impact
        if (sustainabilityScore) {
            query.run(`
                INSERT INTO sustainability_log (id, user_id, inventory_id, category, water_saved_liters, co2_saved_kg, waste_prevented_kg)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(), user.id, id, category,
                sustainabilityScore.waterSaved,
                sustainabilityScore.co2Saved,
                sustainabilityScore.wastePrevented
            ]);
        }

        const item = query.get('SELECT * FROM inventory WHERE id = ?', [id]);
        item.tags = safeJsonParse(item.tags, []);
        item.images = safeJsonParse(item.images, []);

        return { status: 201, data: { item } };
    }

    // PUT /api/inventory/:id - Update item
    if (method === 'PUT' && path.match(/^\/[\w-]+$/)) {
        const id = path.slice(1);

        const existing = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Item not found' } };
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
                return { status: 400, data: { error: listPriceValidation.error } };
            }
        }

        if (body.costPrice !== undefined) {
            const costPriceValidation = validatePrice(body.costPrice, 'Cost price');
            if (!costPriceValidation.valid) {
                return { status: 400, data: { error: costPriceValidation.error } };
            }
        }

        const {
            sku, title, description, brand, category, subcategory,
            size, color, condition, costPrice, listPrice, quantity,
            lowStockThreshold, weight, dimensions, material, tags, images, thumbnailUrl,
            status, location, binLocation, notes, customFields
        } = validation.sanitized;

        // Validate condition enum
        const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
        if (condition && !validConditions.includes(condition)) {
            return { status: 400, data: { error: `Invalid condition. Must be one of: ${validConditions.join(', ')}` } };
        }

        // Validate status enum
        const validStatuses = ['draft', 'active', 'sold', 'archived', 'deleted'];
        if (status && !validStatuses.includes(status)) {
            return { status: 400, data: { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } };
        }

        // Validate customFields
        if (customFields !== undefined && customFields !== null) {
            if (typeof customFields !== 'object' || Array.isArray(customFields)) {
                return { status: 400, data: { error: 'Custom fields must be an object' } };
            }
            if (Object.keys(customFields).length > 50) {
                return { status: 400, data: { error: 'Custom fields limited to 50 keys' } };
            }
            if (JSON.stringify(customFields).length > 10240) {
                return { status: 400, data: { error: 'Custom fields too large (max 10KB)' } };
            }
        }

        const updates = [];
        const values = [];

        const fields = {
            sku, title, description, brand, category, subcategory,
            size, color, condition, cost_price: costPrice, list_price: listPrice,
            quantity, low_stock_threshold: lowStockThreshold, weight, dimensions, material, thumbnail_url: thumbnailUrl,
            status, location, bin_location: binLocation, notes
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
            values.push(id);
            query.run(
                `UPDATE inventory SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                values
            );
        }

        const item = query.get('SELECT * FROM inventory WHERE id = ?', [id]);
        item.tags = safeJsonParse(item.tags, []);
        item.images = safeJsonParse(item.images, []);
        item.custom_fields = safeJsonParse(item.custom_fields, {});

        return { status: 200, data: { item } };
    }

    // DELETE /api/inventory/:id - Soft delete item (moves to Recently Deleted)
    if (method === 'DELETE' && path.match(/^\/[\w-]+$/)) {
        const id = path.slice(1);

        const existing = query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Item not found' } };
        }

        // Soft delete by setting status and deleted_at timestamp
        query.run(
            'UPDATE inventory SET status = ?, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            ['deleted', id, user.id]
        );

        return { status: 200, data: { message: 'Item moved to Recently Deleted' } };
    }

    // POST /api/inventory/bulk - Bulk operations
    if (method === 'POST' && path === '/bulk') {
        const permission = checkTierPermission(user, 'bulkActions');
        if (!permission.allowed) {
            return { status: 403, data: { error: 'Bulk actions not available on your plan' } };
        }

        const { action, ids, data } = body;

        if (!action || !ids || !Array.isArray(ids)) {
            return { status: 400, data: { error: 'Action and ids required' } };
        }

        if (ids.length > 500) {
            return { status: 400, data: { error: 'Too many items (max 500 per bulk operation)' } };
        }

        let affected = 0;

        switch (action) {
            case 'delete':
                query.run(
                    `UPDATE inventory SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                     WHERE id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
                    [...ids, user.id]
                );
                affected = ids.length;
                break;

            case 'updateStatus':
                if (!data?.status) {
                    return { status: 400, data: { error: 'Status required' } };
                }
                if (!['draft', 'active', 'sold', 'archived', 'deleted'].includes(data.status)) {
                    return { status: 400, data: { error: 'Invalid status' } };
                }
                query.run(
                    `UPDATE inventory SET status = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
                    [data.status, ...ids, user.id]
                );
                affected = ids.length;
                break;

            case 'updatePrice':
                if (!data?.adjustment) {
                    return { status: 400, data: { error: 'Price adjustment required' } };
                }
                const { type, value } = data.adjustment;
                if (type === 'percentage') {
                    query.run(
                        `UPDATE inventory SET list_price = ROUND(list_price * (1 + ? / 100), 2), updated_at = CURRENT_TIMESTAMP
                         WHERE id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
                        [value, ...ids, user.id]
                    );
                } else {
                    query.run(
                        `UPDATE inventory SET list_price = ROUND(list_price + ?, 2), updated_at = CURRENT_TIMESTAMP
                         WHERE id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
                        [value, ...ids, user.id]
                    );
                }
                affected = ids.length;
                break;

            default:
                return { status: 400, data: { error: 'Unknown action' } };
        }

        return { status: 200, data: { affected } };
    }

    // GET /api/inventory/stats - Get inventory statistics
    if (method === 'GET' && path === '/stats') {
        const stats = {
            total: query.get('SELECT COUNT(*) as count FROM inventory WHERE user_id = ?', [user.id])?.count || 0,
            active: query.get('SELECT COUNT(*) as count FROM inventory WHERE user_id = ? AND status = ?', [user.id, 'active'])?.count || 0,
            draft: query.get('SELECT COUNT(*) as count FROM inventory WHERE user_id = ? AND status = ?', [user.id, 'draft'])?.count || 0,
            sold: query.get('SELECT COUNT(*) as count FROM inventory WHERE user_id = ? AND status = ?', [user.id, 'sold'])?.count || 0,
            totalValue: query.get('SELECT SUM(list_price * quantity) as value FROM inventory WHERE user_id = ? AND status = ?', [user.id, 'active'])?.value || 0,
            avgPrice: query.get('SELECT AVG(list_price) as avg FROM inventory WHERE user_id = ? AND status = ?', [user.id, 'active'])?.avg || 0,
            topCategories: query.all(`
                SELECT category, COUNT(*) as count
                FROM inventory WHERE user_id = ? AND status != 'deleted'
                GROUP BY category ORDER BY count DESC LIMIT 5
            `, [user.id]),
            topBrands: query.all(`
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

        let items = query.all(
            `SELECT * FROM inventory
             WHERE user_id = ?
             AND status = 'deleted'
             AND deleted_at IS NOT NULL
             AND deleted_at >= ?
             ORDER BY deleted_at DESC`,
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

    // POST /api/inventory/:id/restore - Restore deleted item
    if (method === 'POST' && path.match(/^\/[\w-]+\/restore$/)) {
        const id = path.split('/')[1];

        const existing = query.get(
            'SELECT * FROM inventory WHERE id = ? AND user_id = ? AND status = ?',
            [id, user.id, 'deleted']
        );

        if (!existing) {
            return { status: 404, data: { error: 'Deleted item not found' } };
        }

        // Restore item by setting status back to draft and clearing deleted_at
        query.run(
            'UPDATE inventory SET status = ?, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['draft', id]
        );

        const item = query.get('SELECT * FROM inventory WHERE id = ?', [id]);
        item.tags = safeJsonParse(item.tags, []);
        item.images = safeJsonParse(item.images, []);
        item.custom_fields = safeJsonParse(item.custom_fields, {});

        return { status: 200, data: { message: 'Item restored successfully', item } };
    }

    // DELETE /api/inventory/:id/permanent - Permanently delete item
    if (method === 'DELETE' && path.match(/^\/[\w-]+\/permanent$/)) {
        const id = path.split('/')[1];

        const existing = query.get(
            'SELECT * FROM inventory WHERE id = ? AND user_id = ? AND status = ?',
            [id, user.id, 'deleted']
        );

        if (!existing) {
            return { status: 404, data: { error: 'Deleted item not found' } };
        }

        // Permanently delete the item
        query.run('DELETE FROM inventory WHERE id = ? AND user_id = ?', [id, user.id]);

        return { status: 200, data: { message: 'Item permanently deleted' } };
    }

    // POST /api/inventory/cleanup-deleted - Remove deleted items older than 30 days (automated cleanup)
    if (method === 'POST' && path === '/cleanup-deleted') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const result = query.run(
            `DELETE FROM inventory
             WHERE user_id = ?
             AND status = 'deleted'
             AND deleted_at IS NOT NULL
             AND deleted_at < ?`,
            [user.id, thirtyDaysAgo]
        );

        return { status: 200, data: { message: `Cleaned up ${result.changes || 0} expired items`, count: result.changes || 0 } };
    }

    // POST /api/inventory/import/csv - Import items from CSV
    if (method === 'POST' && path === '/import/csv') {
        const { items } = body;

        if (!items || !Array.isArray(items)) {
            return { status: 400, data: { error: 'Items array required' } };
        }

        if (items.length > 1000) {
            return { status: 400, data: { error: 'Maximum 1000 items per import' } };
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
                query.run(`
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
            return { status: 400, data: { error: 'URL required' } };
        }

        // For now, return a mock response
        // In production, this would scrape the marketplace listing
        return {
            status: 200,
            data: {
                item: {
                    title: 'Imported Item',
                    description: 'Item imported from ' + marketplace,
                    listPrice: 0,
                    category: '',
                    brand: '',
                    size: '',
                    color: '',
                    condition: 'good',
                    images: [],
                    marketplace: marketplace,
                    sourceUrl: url
                },
                message: 'Item data fetched successfully. Note: This is a placeholder implementation.'
            }
        };
    }

    return { status: 404, data: { error: 'Route not found' } };
}
