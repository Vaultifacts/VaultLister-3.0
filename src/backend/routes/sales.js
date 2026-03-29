// Sales Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { safeJsonParse } from '../shared/utils.js';
import websocketService from '../services/websocket.js';


export async function salesRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/sales - List all sales
    if (method === 'GET' && (path === '/' || path === '')) {
        const { platform, status, startDate, endDate, limit = 50, offset = 0 } = queryParams;

        let sql = `
            SELECT s.*, s.item_cost, s.customer_shipping_cost, s.seller_shipping_cost,
                   l.title as listing_title, i.title as inventory_title, i.images as item_images
            FROM sales s
            LEFT JOIN listings l ON s.listing_id = l.id
            LEFT JOIN inventory i ON s.inventory_id = i.id
            WHERE s.user_id = ?
        `;
        const params = [user.id];

        if (platform) {
            sql += ' AND s.platform = ?';
            params.push(platform);
        }

        if (status) {
            sql += ' AND s.status = ?';
            params.push(status);
        }

        if (startDate) {
            sql += ' AND s.created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND s.created_at <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
        const parsedLimit = parseInt(limit);
        const parsedOffset = parseInt(offset);
        const cappedLimit = Math.min(!isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50, 100);
        const cappedOffset = !isNaN(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
        params.push(cappedLimit, cappedOffset);

        const sales = await query.all(sql, params);

        sales.forEach(sale => {
            sale.item_images = safeJsonParse(sale.item_images, []);
            // Map created_at to sold_at for frontend compatibility
            sale.sold_at = sale.created_at;
        });

        // Build COUNT query with same filters as main query
        let countSql = 'SELECT COUNT(*) as count FROM sales WHERE user_id = ?';
        const countParams = [user.id];

        if (platform) {
            countSql += ' AND platform = ?';
            countParams.push(platform);
        }

        if (status) {
            countSql += ' AND status = ?';
            countParams.push(status);
        }

        if (startDate) {
            countSql += ' AND created_at >= ?';
            countParams.push(startDate);
        }

        if (endDate) {
            countSql += ' AND created_at <= ?';
            countParams.push(endDate);
        }

        const total = Number((await query.get(countSql, countParams))?.count) || 0;

        return { status: 200, data: { sales, total } };
    }

    // GET /api/sales/:id - Get single sale
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);
        const sale = await query.get(`
            SELECT s.*, s.item_cost, s.customer_shipping_cost, s.seller_shipping_cost,
                   l.*, i.title as inventory_title, i.images as item_images
            FROM sales s
            LEFT JOIN listings l ON s.listing_id = l.id
            LEFT JOIN inventory i ON s.inventory_id = i.id
            WHERE s.id = ? AND s.user_id = ?
        `, [id, user.id]);

        if (!sale) {
            return { status: 404, data: { error: { message: 'Sale not found', code: 'NOT_FOUND' } } };
        }

        sale.item_images = safeJsonParse(sale.item_images, []);

        return { status: 200, data: { sale } };
    }

    // POST /api/sales - Record new sale
    if (method === 'POST' && (path === '/' || path === '')) {
        const {
            listingId, inventoryId, platform, platformOrderId,
            buyerUsername, buyerAddress, salePrice, platformFee,
            shippingCost, customerShippingCost, sellerShippingCost,
            taxAmount, notes, quantity = 1
        } = body;

        if (!platform || !salePrice) {
            return { status: 400, data: { error: { message: 'Platform and sale price required', code: 'BAD_REQUEST' } } };
        }

        const parsedSalePrice = parseFloat(salePrice);
        if (isNaN(parsedSalePrice) || parsedSalePrice <= 0 || parsedSalePrice > 999999.99) {
            return { status: 400, data: { error: 'Sale price must be a valid positive number' } };
        }

        // Validate platform enum
        const VALID_PLATFORMS = ['poshmark', 'ebay', 'whatnot', 'depop', 'facebook', 'mercari', 'grailed', 'etsy', 'shopify', 'amazon', 'other'];
        if (!VALID_PLATFORMS.includes(platform.toLowerCase())) {
            return { status: 400, data: { error: { message: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`, code: 'BAD_REQUEST' } } };
        }

        const id = uuidv4();

        // Wrap multi-step sale creation in a transaction to ensure data integrity
        let itemCost = 0;
        let sale;

        try {
            await query.transaction(async () => {
                // Use FIFO costing if inventory item exists
                if (inventoryId) {
                    // Get cost layers in FIFO order (oldest first)
                    const layers = await query.all(`
                        SELECT * FROM inventory_cost_layers
                        WHERE inventory_id = ? AND quantity_remaining > 0
                        ORDER BY purchase_date ASC, created_at ASC
                    `, [inventoryId]);

                    let remainingQty = quantity;
                    for (const layer of layers) {
                        if (remainingQty <= 0) break;

                        const qtyToConsume = Math.min(remainingQty, layer.quantity_remaining);
                        const layerCOGS = qtyToConsume * layer.unit_cost;

                        // Prevent integer overflow in cost calculations
                        if (!isFinite(layerCOGS) || layerCOGS > 999999999) {
                            throw new Error('Cost calculation exceeds maximum allowed value');
                        }

                        itemCost += layerCOGS;
                        remainingQty -= qtyToConsume;

                        // Update layer
                        await query.run(`
                            UPDATE inventory_cost_layers
                            SET quantity_remaining = quantity_remaining - ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [qtyToConsume, layer.id]);
                    }

                    // If no cost layers, fall back to inventory cost_price
                    if (itemCost === 0) {
                        const item = await query.get('SELECT cost_price FROM inventory WHERE id = ?', [inventoryId]);
                        itemCost = (item?.cost_price || 0) * quantity;
                    }
                }

                // Calculate net profit with new formula
                const actualSellerShipping = sellerShippingCost !== undefined ? sellerShippingCost : (shippingCost || 0);
                const netProfit = salePrice - (platformFee || 0) - itemCost - actualSellerShipping - (taxAmount || 0);

                await query.run(`
                    INSERT INTO sales (
                        id, user_id, listing_id, inventory_id, platform, platform_order_id,
                        buyer_username, buyer_address, sale_price, platform_fee,
                        shipping_cost, customer_shipping_cost, seller_shipping_cost,
                        item_cost, tax_amount, net_profit, notes, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    id, user.id, listingId || null, inventoryId || null, platform, platformOrderId || null,
                    buyerUsername || null, buyerAddress || null, salePrice, platformFee || 0,
                    shippingCost || 0, customerShippingCost || 0, actualSellerShipping,
                    itemCost, taxAmount || 0, netProfit, notes || null, 'pending'
                ]);

                // Update inventory status atomically - check current status to prevent race condition
                if (inventoryId) {
                    const result = await query.run(
                        'UPDATE inventory SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status != ?',
                        ['sold', inventoryId, user.id, 'sold']
                    );

                    // If changes === 0, the item was already sold by another concurrent request
                    if (result.changes === 0) {
                        const currentItem = await query.get('SELECT status FROM inventory WHERE id = ? AND user_id = ?', [inventoryId, user.id]);
                        if (currentItem?.status === 'sold') {
                            throw new Error('INVENTORY_ALREADY_SOLD');
                        }
                    }
                }

                // Update listing status with race condition protection
                if (listingId) {
                    await query.run('UPDATE listings SET status = ?, sold_at = CURRENT_TIMESTAMP WHERE id = ? AND status != ?', ['sold', listingId, 'sold']);
                }

                // Log sustainability impact
                if (inventoryId) {
                    const item = await query.get('SELECT category FROM inventory WHERE id = ?', [inventoryId]);
                    if (item) {
                        await query.run(`
                            INSERT INTO sustainability_log (id, user_id, inventory_id, sale_id, category, water_saved_liters, co2_saved_kg, waste_prevented_kg)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `, [uuidv4(), user.id, inventoryId, id, item.category, 2700, 10, 0.5]);
                    }
                }
            });

            // Fetch the created sale after successful transaction
            sale = await query.get('SELECT * FROM sales WHERE id = ?', [id]);
        } catch (error) {
            // Handle specific transaction errors
            if (error.message === 'INVENTORY_ALREADY_SOLD') {
                return { status: 409, data: { error: { message: 'Inventory item already sold', code: 'CONFLICT' } } };
            }
            logger.error('[Sales] Sale creation transaction failed', user?.id, { detail: error?.message });
            throw error;
        }

        websocketService.notifySaleCreated(user.id, sale);

        return { status: 201, data: { sale } };
    }

    // PUT /api/sales/:id - Update sale
    if (method === 'PUT' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);

        const existing = await query.get('SELECT * FROM sales WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: { message: 'Sale not found', code: 'NOT_FOUND' } } };
        }

        const {
            status, trackingNumber, carrier, notes,
            shippedAt, deliveredAt
        } = body;

        const updates = [];
        const values = [];

        if (status !== undefined) {
            updates.push('status = ?');
            values.push(status);
        }

        if (trackingNumber !== undefined) {
            updates.push('tracking_number = ?');
            values.push(trackingNumber);
        }

        if (carrier !== undefined) {
            updates.push('carrier = ?');
            values.push(carrier);
        }

        if (notes !== undefined) {
            updates.push('notes = ?');
            values.push(notes);
        }

        if (shippedAt !== undefined) {
            updates.push('shipped_at = ?');
            values.push(shippedAt);
        } else if (status === 'shipped' && !existing.shipped_at) {
            updates.push('shipped_at = CURRENT_TIMESTAMP');
        }

        if (deliveredAt !== undefined) {
            updates.push('delivered_at = ?');
            values.push(deliveredAt);
        } else if (status === 'delivered' && !existing.delivered_at) {
            updates.push('delivered_at = CURRENT_TIMESTAMP');
        }

        if (updates.length > 0) {
            values.push(id, user.id);
            await query.run(
                `UPDATE sales SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                values
            );
        }

        const sale = await query.get('SELECT * FROM sales WHERE id = ? AND user_id = ?', [id, user.id]);

        if (status === 'shipped') {
            websocketService.notifySaleShipped(user.id, sale);
        } else if (status === 'delivered') {
            websocketService.notifySaleDelivered(user.id, sale);
        }

        return { status: 200, data: { sale } };
    }

    // DELETE /api/sales/:id - Delete sale
    if (method === 'DELETE' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);

        const existing = await query.get('SELECT * FROM sales WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: { message: 'Sale not found', code: 'NOT_FOUND' } } };
        }

        // Restore inventory status if linked
        if (existing.inventory_id) {
            await query.run('UPDATE inventory SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', ['active', existing.inventory_id, user.id]);
        }

        // Restore listing status if linked
        if (existing.listing_id) {
            await query.run('UPDATE listings SET status = ?, sold_at = NULL WHERE id = ? AND user_id = ?', ['active', existing.listing_id, user.id]);
        }

        const result = await query.run('DELETE FROM sales WHERE id = ? AND user_id = ?', [id, user.id]);

        if (result.changes === 0) {
            return { status: 404, data: { error: { message: 'Sale not found', code: 'NOT_FOUND' } } };
        }

        return { status: 200, data: { message: 'Sale deleted successfully' } };
    }

    // GET /api/sales/stats - Get sales statistics
    if (method === 'GET' && path === '/stats') {
        const { period = '30d' } = queryParams;

        let dateFilter = '';
        if (period === '7d') {
            dateFilter = "AND created_at >= NOW() - INTERVAL '7 days'";
        } else if (period === '30d') {
            dateFilter = "AND created_at >= NOW() - INTERVAL '30 days'";
        } else if (period === '90d') {
            dateFilter = "AND created_at >= NOW() - INTERVAL '90 days'";
        } else if (period === '1y') {
            dateFilter = "AND created_at >= NOW() - INTERVAL '1 year'";
        }

        const stats = {
            totalSales: Number((await query.get(`SELECT COUNT(*) as count FROM sales WHERE user_id = ? ${dateFilter}`, [user.id]))?.count) || 0,
            totalRevenue: Number((await query.get(`SELECT SUM(sale_price) as total FROM sales WHERE user_id = ? ${dateFilter}`, [user.id]))?.total) || 0,
            totalProfit: Number((await query.get(`SELECT SUM(net_profit) as total FROM sales WHERE user_id = ? ${dateFilter}`, [user.id]))?.total) || 0,
            avgSalePrice: Number((await query.get(`SELECT AVG(sale_price) as avg FROM sales WHERE user_id = ? ${dateFilter}`, [user.id]))?.avg) || 0,
            byPlatform: await query.all(`
                SELECT platform, COUNT(*) as sales, SUM(sale_price) as revenue, SUM(net_profit) as profit
                FROM sales WHERE user_id = ? ${dateFilter}
                GROUP BY platform ORDER BY revenue DESC
            `, [user.id]),
            byStatus: await query.all(`
                SELECT status, COUNT(*) as count
                FROM sales WHERE user_id = ? ${dateFilter}
                GROUP BY status
            `, [user.id]),
            recentSales: await query.all(`
                SELECT created_at::date as date, COUNT(*) as sales, SUM(sale_price) as revenue
                FROM sales WHERE user_id = ? ${dateFilter}
                GROUP BY created_at::date
                ORDER BY date DESC LIMIT 30
            `, [user.id]),
            pendingShipments: Number((await query.get(
                'SELECT COUNT(*) as count FROM sales WHERE user_id = ? AND status IN (?, ?)',
                [user.id, 'pending', 'confirmed']
            ))?.count) || 0
        };

        return { status: 200, data: { stats } };
    }

    // GET /api/sales/export/csv - Export sales as CSV (Issue #92)
    if (method === 'GET' && path === '/export/csv') {
        const sales = await query.all(
            `SELECT s.created_at,
                    COALESCE(l.title, i.title, '') as item_title,
                    s.platform, s.sale_price, s.shipping_cost,
                    s.platform_fee, s.net_profit, s.buyer_username
             FROM sales s
             LEFT JOIN listings l ON s.listing_id = l.id
             LEFT JOIN inventory i ON s.inventory_id = i.id
             WHERE s.user_id = ?
             ORDER BY s.created_at DESC`,
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

        const headers = ['date', 'item_title', 'platform', 'sale_price', 'shipping_cost', 'fees', 'net_profit', 'buyer'];
        const rows = sales.map(sale => [
            escapeCsvField(sale.created_at ? new Date(sale.created_at).toISOString().split('T')[0] : ''),
            escapeCsvField(sale.item_title),
            escapeCsvField(sale.platform),
            escapeCsvField(sale.sale_price),
            escapeCsvField(sale.shipping_cost),
            escapeCsvField(sale.platform_fee),
            escapeCsvField(sale.net_profit),
            escapeCsvField(sale.buyer_username)
        ].join(','));

        const csv = [headers.join(','), ...rows].join('\r\n');
        const filename = `sales-export-${new Date().toISOString().split('T')[0]}.csv`;

        return {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`
            },
            data: csv
        };
    }

    return { status: 404, data: { error: { message: 'Route not found', code: 'NOT_FOUND' } } };


}
