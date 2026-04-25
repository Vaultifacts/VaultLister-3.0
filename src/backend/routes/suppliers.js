// Suppliers Router for VaultLister
// Manages supplier monitoring and price tracking

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

export async function suppliersRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // Helper: require authentication
    const requireAuth = () => {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        return null;
    };

    // GET /suppliers - List all suppliers
    if (method === 'GET' && (path === '' || path === '/')) {
        const authError = requireAuth();
        if (authError) return authError;

        const type = queryParams.type;
        const active = queryParams.active !== 'false';

        let sql = 'SELECT * FROM suppliers WHERE user_id = ?';
        const params = [user.id];

        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }

        if (active) {
            sql += ' AND is_active = TRUE';
        }

        sql += ' ORDER BY name ASC LIMIT 500';

        try {
            const suppliers = await query.all(sql, params);
            return { status: 200, data: suppliers };
        } catch (error) {
            logger.error('[Suppliers] Error fetching suppliers', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch suppliers' } };
        }
    }

    // POST /suppliers - Create supplier
    if (method === 'POST' && (path === '' || path === '/')) {
        const authError = requireAuth();
        if (authError) return authError;

        const { name, type, website, contact_email, contact_phone, address, notes, rating } = body;

        if (!name || !type) {
            return { status: 400, data: { error: 'Name and type are required' } };
        }
        if (name.length > 200) return { status: 400, data: { error: 'Name must be 200 characters or less' } };
        if (address && address.length > 500) return { status: 400, data: { error: 'Address must be 500 characters or less' } };
        if (notes && notes.length > 2000) return { status: 400, data: { error: 'Notes must be 2000 characters or less' } };

        const validTypes = ['wholesale', 'thrift', 'estate', 'online', 'auction', 'other'];
        if (!validTypes.includes(type)) {
            return { status: 400, data: { error: `Type must be one of: ${validTypes.join(', ')}` } };
        }

        // Validate email format if provided
        if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
            return { status: 400, data: { error: 'Invalid email format' } };
        }

        // Validate URL format if provided
        if (website && !/^https?:\/\/.+/.test(website)) {
            return { status: 400, data: { error: 'Website must start with http:// or https://' } };
        }

        // Validate phone format if provided (allow digits, spaces, dashes, parens, plus)
        if (contact_phone && !/^[+\d\s\-().]{7,20}$/.test(contact_phone)) {
            return { status: 400, data: { error: 'Invalid phone number format' } };
        }

        // Validate rating range if provided (1-5)
        if (rating != null && (rating < 1 || rating > 5)) {
            return { status: 400, data: { error: 'Rating must be between 1 and 5' } };
        }

        const supplierId = uuidv4();
        await query.run(`
            INSERT INTO suppliers (id, user_id, name, type, website, contact_email, contact_phone,
                address, notes, rating, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        `, [supplierId, user.id, name, type, website || null, contact_email || null,
            contact_phone || null, address || null, notes || null, rating || null]);

        const supplier = await query.get('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
        return { status: 201, data: supplier };
    }

    // GET /suppliers/:id - Get supplier details
    const supplierIdMatch = path.match(/^\/([^/]+)$/);
    if (method === 'GET' && supplierIdMatch && !path.startsWith('/items') && !path.startsWith('/alerts') && path !== '/stats' && path !== '/types') {
        const authError = requireAuth();
        if (authError) return authError;

        const supplierId = supplierIdMatch[1];
        const supplier = await query.get(
            'SELECT * FROM suppliers WHERE id = ? AND user_id = ?',
            [supplierId, user.id]
        );

        if (!supplier) {
            return { status: 404, data: { error: 'Supplier not found' } };
        }

        // Get item count (scoped to user)
        try {
            const itemCount = await query.get(
                'SELECT COUNT(*) as count FROM supplier_items WHERE supplier_id = ? AND user_id = ?',
                [supplierId, user.id]
            );
            supplier.item_count = itemCount?.count || 0;
        } catch (error) {
            logger.error('[Suppliers] Supplier item count error', user?.id, { detail: error?.message });
            supplier.item_count = 0;
        }

        return { status: 200, data: supplier };
    }

    // PUT /suppliers/:id - Update supplier
    if (method === 'PUT' && supplierIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const supplierId = supplierIdMatch[1];
        const existing = await query.get(
            'SELECT id FROM suppliers WHERE id = ? AND user_id = ?',
            [supplierId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Supplier not found' } };
        }

        const { name, type, website, contact_email, contact_phone, address, notes, rating, is_active } = body;

        // Validate email format if provided
        if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
            return { status: 400, data: { error: 'Invalid email format' } };
        }
        if (website && !/^https?:\/\/.+/.test(website)) {
            return { status: 400, data: { error: 'Website must start with http:// or https://' } };
        }
        if (contact_phone && !/^[+\d\s\-().]{7,20}$/.test(contact_phone)) {
            return { status: 400, data: { error: 'Invalid phone number format' } };
        }
        if (rating != null && (rating < 1 || rating > 5)) {
            return { status: 400, data: { error: 'Rating must be between 1 and 5' } };
        }

        await query.run(`
            UPDATE suppliers SET
                name = COALESCE(?, name),
                type = COALESCE(?, type),
                website = COALESCE(?, website),
                contact_email = COALESCE(?, contact_email),
                contact_phone = COALESCE(?, contact_phone),
                address = COALESCE(?, address),
                notes = COALESCE(?, notes),
                rating = COALESCE(?, rating),
                is_active = COALESCE(?, is_active),
                updated_at = NOW()
            WHERE id = ? AND user_id = ?
        `, [name, type, website, contact_email, contact_phone, address, notes, rating, is_active, supplierId, user.id]);

        const updated = await query.get('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
        return { status: 200, data: updated };
    }

    // DELETE /suppliers/:id - Delete supplier
    if (method === 'DELETE' && supplierIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const supplierId = supplierIdMatch[1];
        const result = await query.run('DELETE FROM suppliers WHERE id = ? AND user_id = ?', [supplierId, user.id]);

        if (result.changes === 0) {
            return { status: 404, data: { error: 'Supplier not found' } };
        }

        return { status: 200, data: { deleted: true } };
    }

    // GET /suppliers/:id/items - List items for supplier
    const supplierItemsMatch = path.match(/^\/([^/]+)\/items$/);
    if (method === 'GET' && supplierItemsMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const supplierId = supplierItemsMatch[1];

        try {
            const items = await query.all(`
                SELECT si.*, s.name as supplier_name
                FROM supplier_items si
                JOIN suppliers s ON si.supplier_id = s.id
                WHERE si.supplier_id = ? AND si.user_id = ?
                ORDER BY si.updated_at DESC
                LIMIT 500
            `, [supplierId, user.id]);

            return { status: 200, data: items };
        } catch (error) {
            logger.error('[Suppliers] Error fetching supplier items', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch supplier items' } };
        }
    }

    // POST /suppliers/:id/items - Add monitored item
    if (method === 'POST' && supplierItemsMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const supplierId = supplierItemsMatch[1];
        const { name, sku, url, current_price, target_price, alert_threshold, notes } = body;

        if (!name) {
            return { status: 400, data: { error: 'Name is required' } };
        }

        const ownedSupplier = await query.get('SELECT id FROM suppliers WHERE id = ? AND user_id = ?', [supplierId, user.id]);
        if (!ownedSupplier) return { status: 404, data: { error: 'Supplier not found' } };

        const itemId = uuidv4();
        await query.run(`
            INSERT INTO supplier_items (id, user_id, supplier_id, name, sku, url, current_price,
                target_price, alert_threshold, notes, alert_enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        `, [itemId, user.id, supplierId, name, sku || null, url || null,
            current_price || null, target_price || null, alert_threshold || 0.10, notes || null]);

        // Record initial price
        if (current_price) {
            await query.run(`
                INSERT INTO supplier_price_history (id, supplier_item_id, price, recorded_at)
                VALUES (?, ?, ?, NOW())
            `, [uuidv4(), itemId, current_price]);
        }

        const item = await query.get('SELECT * FROM supplier_items WHERE id = ?', [itemId]);
        return { status: 201, data: item };
    }

    // GET /suppliers/items/:itemId - Get item details with price history
    const itemIdMatch = path.match(/^\/items\/([^/]+)$/);
    if (method === 'GET' && itemIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const itemId = itemIdMatch[1];
        const item = await query.get(`
            SELECT si.*, s.name as supplier_name
            FROM supplier_items si
            JOIN suppliers s ON si.supplier_id = s.id
            WHERE si.id = ? AND si.user_id = ?
        `, [itemId, user.id]);

        if (!item) {
            return { status: 404, data: { error: 'Item not found' } };
        }

        // Get price history
        try {
            const history = await query.all(`
                SELECT price, recorded_at
                FROM supplier_price_history
                WHERE supplier_item_id = ?
                ORDER BY recorded_at DESC
                LIMIT 30
            `, [itemId]);

            item.price_history = history;
        } catch (error) {
            logger.error('[Suppliers] Price history fetch error', user?.id, { detail: error?.message });
            item.price_history = [];
        }

        return { status: 200, data: item };
    }

    // PUT /suppliers/items/:itemId - Update monitored item
    if (method === 'PUT' && itemIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const itemId = itemIdMatch[1];
        const existing = await query.get(
            'SELECT id, current_price FROM supplier_items WHERE id = ? AND user_id = ?',
            [itemId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Item not found' } };
        }

        const { name, sku, url, current_price, target_price, alert_threshold, alert_enabled, notes } = body;

        // If price changed, record history
        if (current_price !== undefined && current_price !== existing.current_price) {
            await query.run(`
                UPDATE supplier_items SET
                    last_price = current_price,
                    price_change = ? - current_price
                WHERE id = ?
            `, [current_price, itemId]);

            await query.run(`
                INSERT INTO supplier_price_history (id, supplier_item_id, price, recorded_at)
                VALUES (?, ?, ?, NOW())
            `, [uuidv4(), itemId, current_price]);
        }

        await query.run(`
            UPDATE supplier_items SET
                name = COALESCE(?, name),
                sku = COALESCE(?, sku),
                url = COALESCE(?, url),
                current_price = COALESCE(?, current_price),
                target_price = COALESCE(?, target_price),
                alert_threshold = COALESCE(?, alert_threshold),
                alert_enabled = COALESCE(?, alert_enabled),
                notes = COALESCE(?, notes),
                last_checked_at = NOW(),
                updated_at = NOW()
            WHERE id = ? AND user_id = ?
        `, [name, sku, url, current_price, target_price, alert_threshold, alert_enabled, notes, itemId, user.id]);

        const updated = await query.get('SELECT * FROM supplier_items WHERE id = ?', [itemId]);
        return { status: 200, data: updated };
    }

    // DELETE /suppliers/items/:itemId - Delete monitored item
    if (method === 'DELETE' && itemIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const itemId = itemIdMatch[1];
        const supplierItem = await query.get('SELECT id FROM supplier_items WHERE id = ? AND user_id = ?', [itemId, user.id]);
        if (!supplierItem) return { status: 404, data: { error: 'Item not found' } };
        await query.run('DELETE FROM supplier_price_history WHERE supplier_item_id = ?', [itemId]);
        await query.run('DELETE FROM supplier_items WHERE id = ? AND user_id = ?', [itemId, user.id]);
        return { status: 200, data: { deleted: true } };
    }

    // GET /suppliers/alerts - Get price drop alerts
    if (method === 'GET' && path === '/alerts') {
        const authError = requireAuth();
        if (authError) return authError;

        try {
            // Items where price dropped below target or by threshold percentage
            const alerts = await query.all(`
                SELECT si.*, s.name as supplier_name,
                       (si.last_price - si.current_price) as price_drop,
                       ROUND((si.last_price - si.current_price) / si.last_price * 100, 1) as drop_percent
                FROM supplier_items si
                JOIN suppliers s ON si.supplier_id = s.id
                WHERE si.user_id = ?
                AND si.alert_enabled = TRUE
                AND si.current_price IS NOT NULL
                AND (
                    (si.target_price IS NOT NULL AND si.current_price <= si.target_price)
                    OR
                    (si.last_price IS NOT NULL AND si.price_change < 0
                     AND ABS(si.price_change) / si.last_price >= si.alert_threshold)
                )
                ORDER BY drop_percent DESC
                LIMIT 200
            `, [user.id]);

            return { status: 200, data: alerts };
        } catch (error) {
            logger.error('[Suppliers] Error fetching price alerts', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch price alerts' } };
        }
    }

    // GET /suppliers/stats - Get supplier statistics
    if (method === 'GET' && path === '/stats') {
        const authError = requireAuth();
        if (authError) return authError;

        try {
            const stats = await query.get(`
                SELECT
                    COUNT(DISTINCT s.id) as supplier_count,
                    COUNT(si.id) as item_count,
                    SUM(CASE WHEN si.price_change < 0 THEN 1 ELSE 0 END) as price_drops,
                    SUM(CASE WHEN si.current_price <= si.target_price THEN 1 ELSE 0 END) as at_target
                FROM suppliers s
                LEFT JOIN supplier_items si ON s.id = si.supplier_id
                WHERE s.user_id = ? AND s.is_active = TRUE
            `, [user.id]);

            const byType = await query.all(`
                SELECT type, COUNT(*) as count
                FROM suppliers
                WHERE user_id = ? AND is_active = TRUE
                GROUP BY type
            `, [user.id]);

            return {
                status: 200,
                data: {
                    ...stats,
                    by_type: byType
                }
            };
        } catch (error) {
            return {
                status: 200,
                data: {
                    supplier_count: 0,
                    item_count: 0,
                    price_drops: 0,
                    at_target: 0,
                    by_type: []
                }
            };
        }
    }

    // GET /suppliers/types - List supplier types
    if (method === 'GET' && path === '/types') {
        return {
            status: 200,
            data: [
                { value: 'wholesale', label: 'Wholesale', description: 'Bulk suppliers and distributors' },
                { value: 'thrift', label: 'Thrift Store', description: 'Goodwill, Salvation Army, etc.' },
                { value: 'estate', label: 'Estate Sale', description: 'Estate sales and auctions' },
                { value: 'online', label: 'Online Marketplace', description: 'eBay, Amazon, etc.' },
                { value: 'auction', label: 'Auction House', description: 'Live and online auctions' },
                { value: 'other', label: 'Other', description: 'Other sourcing channels' }
            ]
        };
    }

    return { status: 404, data: { error: 'Route not found' } };
}
