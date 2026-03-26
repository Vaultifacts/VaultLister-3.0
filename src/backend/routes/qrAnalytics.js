// QR Analytics Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

export async function qrAnalyticsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/qr-analytics/dashboard - Overall QR engagement dashboard
    if (method === 'GET' && path === '/dashboard') {
        try {
            // Total scans (sum of scan_count across all QR entries)
            const totalScans = await query.get(
                'SELECT COALESCE(SUM(scan_count), 0) as total, COUNT(*) as items FROM qr_analytics WHERE user_id = ?',
                [user.id]
            );

            // Scans by type
            const scansByType = await query.all(
                `SELECT qr_type, SUM(scan_count) as count
                FROM qr_analytics
                WHERE user_id = ?
                GROUP BY qr_type
                ORDER BY count DESC`,
                [user.id]
            );

            // Top 10 most scanned items
            const topScanned = await query.all(
                `SELECT reference_id, qr_type, scan_count, last_scanned_at
                FROM qr_analytics
                WHERE user_id = ? AND qr_type = 'listing'
                ORDER BY scan_count DESC
                LIMIT 10`,
                [user.id]
            );

            // Get item details for top scanned
            const enrichedTopScanned = await Promise.all(topScanned.map(async item => {
                const details = await query.get(
                    'SELECT title, sku FROM inventory WHERE id = ?',
                    [item.reference_id]
                );
                return {
                    ...item,
                    title: details?.title || 'Unknown',
                    sku: details?.sku || 'N/A'
                };
            }));

            // Recently scanned (last 24 hours)
            const recentScans = await query.get(
                `SELECT COUNT(*) as count FROM qr_analytics
                WHERE user_id = ? AND last_scanned_at > NOW() - INTERVAL '24 hours'`,
                [user.id]
            );

            return {
                status: 200,
                data: {
                    totalScans: totalScans?.total || 0,
                    totalItems: totalScans?.items || 0,
                    scansByType,
                    topScanned: enrichedTopScanned,
                    recentScans: recentScans?.count || 0
                }
            };
        } catch (error) {
            logger.error('[QRAnalytics] QR dashboard error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to load QR analytics dashboard' } };
        }
    }

    // POST /api/qr-analytics/track - Record a QR scan
    if (method === 'POST' && path === '/track') {
        try {
            const { qr_type, reference_id, metadata } = body;

            if (!qr_type || !reference_id) {
                return { status: 400, data: { error: 'qr_type and reference_id required' } };
            }

            const validTypes = ['listing', 'size-chart', 'label', 'warehouse-bin'];
            if (!validTypes.includes(qr_type)) {
                return { status: 400, data: { error: `Invalid qr_type. Must be one of: ${validTypes.join(', ')}` } };
            }

            // Upsert: increment scan_count if exists, otherwise create
            const id = uuidv4();
            await query.run(
                `INSERT INTO qr_analytics (id, user_id, qr_type, reference_id, scan_count, last_scanned_at)
                VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, qr_type, reference_id) DO UPDATE SET
                    scan_count = scan_count + 1,
                    last_scanned_at = CURRENT_TIMESTAMP`,
                [id, user.id, qr_type, reference_id]
            );

            const scan = await query.get(
                'SELECT * FROM qr_analytics WHERE user_id = ? AND qr_type = ? AND reference_id = ?',
                [user.id, qr_type, reference_id]
            );
            return { status: 200, data: scan };
        } catch (error) {
            logger.error('[QRAnalytics] QR track error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to record QR scan' } };
        }
    }

    // GET /api/qr-analytics/item/:id - Get scan stats for a specific item
    if (method === 'GET' && path.match(/^\/item\/[a-f0-9-]+$/)) {
        try {
            const itemId = path.split('/')[2];

            // Verify item belongs to user
            const item = await query.get(
                'SELECT id, title, sku FROM inventory WHERE id = ? AND user_id = ?',
                [itemId, user.id]
            );

            if (!item) {
                return { status: 404, data: { error: 'Item not found' } };
            }

            // Total scans for this item
            const totalScans = await query.get(
                'SELECT COALESCE(SUM(scan_count), 0) as count FROM qr_analytics WHERE reference_id = ? AND user_id = ?',
                [itemId, user.id]
            );

            // Scans by type for this item
            const scansByType = await query.all(
                `SELECT qr_type, SUM(scan_count) as count
                FROM qr_analytics
                WHERE reference_id = ? AND user_id = ?
                GROUP BY qr_type`,
                [itemId, user.id]
            );

            // QR entries for this item
            const scanHistory = await query.all(
                `SELECT qr_type, scan_count, last_scanned_at, created_at
                FROM qr_analytics
                WHERE reference_id = ? AND user_id = ?
                ORDER BY last_scanned_at DESC`,
                [itemId, user.id]
            );

            return {
                status: 200,
                data: {
                    item,
                    totalScans: totalScans?.count || 0,
                    scansByType,
                    scanHistory
                }
            };
        } catch (error) {
            logger.error('[QRAnalytics] QR item stats error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to load item QR stats' } };
        }
    }

    // GET /api/qr-analytics/warehouse-bins - List all warehouse bins
    if (method === 'GET' && path === '/warehouse-bins') {
        try {
            const bins = await query.all(
                `SELECT wb.*,
                (SELECT COUNT(*) FROM inventory WHERE bin_location = wb.bin_code AND user_id = ?) as item_count
                FROM warehouse_bins wb
                WHERE wb.user_id = ?
                ORDER BY wb.zone, wb.bin_code`,
                [user.id, user.id]
            );

            return { status: 200, data: bins };
        } catch (error) {
            logger.error('[QRAnalytics] Warehouse bins error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to load warehouse bins' } };
        }
    }

    // POST /api/qr-analytics/warehouse-bins - Create new bin
    if (method === 'POST' && path === '/warehouse-bins') {
        try {
            const { bin_code, label, zone, capacity } = body;

            if (!bin_code || !bin_code.trim()) {
                return { status: 400, data: { error: 'bin_code required' } };
            }

            // Check for duplicate bin code
            const existing = await query.get(
                'SELECT id FROM warehouse_bins WHERE bin_code = ? AND user_id = ?',
                [bin_code.trim().toUpperCase(), user.id]
            );

            if (existing) {
                return { status: 409, data: { error: 'Bin code already exists' } };
            }

            const id = uuidv4();

            await query.run(
                `INSERT INTO warehouse_bins (id, user_id, bin_code, label, zone, capacity)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [id, user.id, bin_code.trim().toUpperCase(), label || null, zone || null, capacity || null]
            );

            const bin = await query.get('SELECT * FROM warehouse_bins WHERE id = ?', [id]);

            return { status: 201, data: bin };
        } catch (error) {
            logger.error('[QRAnalytics] Create bin error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to create warehouse bin' } };
        }
    }

    // PUT /api/qr-analytics/warehouse-bins/:id - Update bin
    if (method === 'PUT' && path.match(/^\/warehouse-bins\/[a-f0-9-]+$/)) {
        try {
            const binId = path.split('/')[2];

            const existing = await query.get(
                'SELECT * FROM warehouse_bins WHERE id = ? AND user_id = ?',
                [binId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Bin not found' } };
            }

            const { bin_code, label, zone, capacity, status: binStatus } = body;
            const updates = [];
            const values = [];

            if (bin_code !== undefined) {
                // Check for duplicate
                const duplicate = await query.get(
                    'SELECT id FROM warehouse_bins WHERE bin_code = ? AND user_id = ? AND id != ?',
                    [bin_code.trim().toUpperCase(), user.id, binId]
                );
                if (duplicate) {
                    return { status: 409, data: { error: 'Bin code already exists' } };
                }
                updates.push('bin_code = ?');
                values.push(bin_code.trim().toUpperCase());
            }

            if (label !== undefined) {
                updates.push('label = ?');
                values.push(label);
            }

            if (zone !== undefined) {
                updates.push('zone = ?');
                values.push(zone);
            }

            if (capacity !== undefined) {
                updates.push('capacity = ?');
                values.push(capacity);
            }

            if (binStatus !== undefined) {
                const validStatuses = ['active', 'inactive', 'full'];
                if (!validStatuses.includes(binStatus)) {
                    return { status: 400, data: { error: `Invalid status. Must be: ${validStatuses.join(', ')}` } };
                }
                updates.push('status = ?');
                values.push(binStatus);
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No fields to update' } };
            }

            values.push(binId);

            await query.run(
                `UPDATE warehouse_bins SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                values
            );

            const updated = await query.get('SELECT * FROM warehouse_bins WHERE id = ?', [binId]);

            return { status: 200, data: updated };
        } catch (error) {
            logger.error('[QRAnalytics] Update bin error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to update bin' } };
        }
    }

    // DELETE /api/qr-analytics/warehouse-bins/:id - Delete bin
    if (method === 'DELETE' && path.match(/^\/warehouse-bins\/[a-f0-9-]+$/)) {
        try {
            const binId = path.split('/')[2];

            const existing = await query.get(
                'SELECT * FROM warehouse_bins WHERE id = ? AND user_id = ?',
                [binId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Bin not found' } };
            }

            // Check if bin has inventory
            const itemCount = await query.get(
                'SELECT COUNT(*) as count FROM inventory WHERE bin_location = ? AND user_id = ?',
                [existing.bin_code, user.id]
            );

            if (itemCount?.count > 0) {
                return { status: 409, data: { error: 'Cannot delete bin with inventory. Move items first.' } };
            }

            await query.run('DELETE FROM warehouse_bins WHERE id = ? AND user_id = ?', [binId, user.id]);

            return { status: 200, data: { message: 'Bin deleted successfully' } };
        } catch (error) {
            logger.error('[QRAnalytics] Delete bin error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to delete bin' } };
        }
    }

    // GET /api/qr-analytics/warehouse-bins/:id/items - List items in a bin
    if (method === 'GET' && path.match(/^\/warehouse-bins\/[a-f0-9-]+\/items$/)) {
        try {
            const binId = path.split('/')[2];

            const bin = await query.get(
                'SELECT * FROM warehouse_bins WHERE id = ? AND user_id = ?',
                [binId, user.id]
            );

            if (!bin) {
                return { status: 404, data: { error: 'Bin not found' } };
            }

            const items = await query.all(
                `SELECT id, title, sku, quantity, cost, status, bin_location
                FROM inventory
                WHERE bin_location = ? AND user_id = ?
                ORDER BY title`,
                [bin.bin_code, user.id]
            );

            return { status: 200, data: { bin, items } };
        } catch (error) {
            logger.error('[QRAnalytics] Bin items error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to load bin items' } };
        }
    }

    // POST /api/qr-analytics/warehouse-bins/:id/print-label - Generate barcode data
    if (method === 'POST' && path.match(/^\/warehouse-bins\/[a-f0-9-]+\/print-label$/)) {
        try {
            const binId = path.split('/')[2];

            const bin = await query.get(
                'SELECT * FROM warehouse_bins WHERE id = ? AND user_id = ?',
                [binId, user.id]
            );

            if (!bin) {
                return { status: 404, data: { error: 'Bin not found' } };
            }

            // Return structured data for barcode generation
            return {
                status: 200,
                data: {
                    bin_code: bin.bin_code,
                    label: bin.label,
                    zone: bin.zone,
                    qr_data: JSON.stringify({
                        type: 'warehouse-bin',
                        bin_id: bin.id,
                        bin_code: bin.bin_code
                    })
                }
            };
        } catch (error) {
            logger.error('[QRAnalytics] Print label error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to generate label data' } };
        }
    }

    return { status: 404, data: { error: 'QR Analytics endpoint not found' } };
}
