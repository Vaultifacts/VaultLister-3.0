// Duplicate Detection Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

// Detection type confidence scores
const CONFIDENCE_SCORES = {
    sku_match: 0.95,
    hash_match: 0.95,
    title_brand_size: 0.85,
    exact_title: 0.75
};

export async function duplicatesRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/duplicates - List detected duplicates
    if (method === 'GET' && (path === '/' || path === '')) {
        try {
            const { status = 'pending', limit = 50, offset = 0 } = queryParams;

            let sql = `
                SELECT
                    d.*,
                    p.title as primary_title,
                    p.sku as primary_sku,
                    p.brand as primary_brand,
                    p.images as primary_images,
                    dup.title as duplicate_title,
                    dup.sku as duplicate_sku,
                    dup.brand as duplicate_brand,
                    dup.images as duplicate_images
                FROM duplicate_detections d
                LEFT JOIN inventory p ON d.primary_item_id = p.id
                LEFT JOIN inventory dup ON d.duplicate_item_id = dup.id
                WHERE d.user_id = ?
            `;
            const params = [user.id];

            if (status && status !== 'all') {
                sql += ' AND d.user_action = ?';
                params.push(status);
            }

            sql += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const duplicates = query.all(sql, params);

            // Get total count
            let countSql = 'SELECT COUNT(*) as count FROM duplicate_detections WHERE user_id = ?';
            const countParams = [user.id];
            if (status && status !== 'all') {
                countSql += ' AND user_action = ?';
                countParams.push(status);
            }
            const { count } = query.get(countSql, countParams);

            return {
                status: 200,
                data: {
                    duplicates: duplicates.map(d => ({
                        ...d,
                        primary_images: d.primary_images ? JSON.parse(d.primary_images) : [],
                        duplicate_images: d.duplicate_images ? JSON.parse(d.duplicate_images) : []
                    })),
                    pagination: {
                        total: count,
                        limit: parseInt(limit),
                        offset: parseInt(offset)
                    }
                }
            };
        } catch (error) {
            logger.error('[Duplicates] Error listing duplicates', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/duplicates/scan - Trigger duplicate scan
    if (method === 'POST' && path === '/scan') {
        try {
            // Get all active inventory items
            const items = query.all(`
                SELECT id, title, sku, brand, size, blockchain_hash
                FROM inventory
                WHERE user_id = ? AND status NOT IN ('deleted', 'sold')
            `, [user.id]);

            // Build matches in memory first (no DB writes during O(n^2) loop)
            const matches = [];
            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const item1 = items[i];
                    const item2 = items[j];
                    let detectionType = null;
                    let confidence = 0;

                    // Check SKU exact match
                    if (item1.sku && item2.sku && item1.sku === item2.sku) {
                        detectionType = 'sku_match';
                        confidence = CONFIDENCE_SCORES.sku_match;
                    }
                    // Check blockchain hash match
                    else if (item1.blockchain_hash && item2.blockchain_hash &&
                             item1.blockchain_hash === item2.blockchain_hash) {
                        detectionType = 'hash_match';
                        confidence = CONFIDENCE_SCORES.hash_match;
                    }
                    // Check title + brand + size match
                    else if (item1.title && item2.title &&
                             item1.brand && item2.brand &&
                             item1.size && item2.size &&
                             normalizeString(item1.title) === normalizeString(item2.title) &&
                             normalizeString(item1.brand) === normalizeString(item2.brand) &&
                             normalizeString(item1.size) === normalizeString(item2.size)) {
                        detectionType = 'title_brand_size';
                        confidence = CONFIDENCE_SCORES.title_brand_size;
                    }
                    // Check exact title match
                    else if (item1.title && item2.title &&
                             normalizeString(item1.title) === normalizeString(item2.title)) {
                        detectionType = 'exact_title';
                        confidence = CONFIDENCE_SCORES.exact_title;
                    }

                    if (detectionType) {
                        matches.push({ id: uuidv4(), item1: item1.id, item2: item2.id, detectionType, confidence });
                    }
                }
            }

            // Batch all DB writes in a single transaction (DELETE + INSERTs)
            const detectedDuplicates = [];
            query.transaction(() => {
                // Clear existing pending duplicates
                query.run(`
                    DELETE FROM duplicate_detections
                    WHERE user_id = ? AND user_action = 'pending'
                `, [user.id]);

                // Insert all matches
                for (const m of matches) {
                    try {
                        query.run(`
                            INSERT INTO duplicate_detections
                            (id, user_id, primary_item_id, duplicate_item_id, detection_type, confidence_score)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, [m.id, user.id, m.item1, m.item2, m.detectionType, m.confidence]);

                        detectedDuplicates.push({
                            id: m.id,
                            primary_item_id: m.item1,
                            duplicate_item_id: m.item2,
                            detection_type: m.detectionType,
                            confidence_score: m.confidence
                        });
                    } catch (err) {
                        // Ignore duplicate constraint violations
                        if (!err.message.includes('UNIQUE constraint')) {
                            throw err;
                        }
                    }
                }
            });

            return {
                status: 200,
                data: {
                    message: 'Scan complete',
                    items_scanned: items.length,
                    duplicates_found: detectedDuplicates.length,
                    duplicates: detectedDuplicates
                }
            };
        } catch (error) {
            logger.error('[Duplicates] Error scanning for duplicates', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/duplicates/check - Check single item for duplicates
    if (method === 'POST' && path === '/check') {
        try {
            const { title, sku, brand, size, blockchain_hash, exclude_id } = body;

            const potentialDuplicates = [];

            // Check SKU match
            if (sku) {
                let sql = 'SELECT id, title, sku, brand FROM inventory WHERE user_id = ? AND sku = ? AND status != ?';
                const params = [user.id, sku, 'deleted'];
                if (exclude_id) {
                    sql += ' AND id != ?';
                    params.push(exclude_id);
                }
                const skuMatches = query.all(sql, params);
                skuMatches.forEach(item => {
                    potentialDuplicates.push({
                        item,
                        detection_type: 'sku_match',
                        confidence: CONFIDENCE_SCORES.sku_match
                    });
                });
            }

            // Check blockchain hash match
            if (blockchain_hash) {
                let sql = 'SELECT id, title, sku, brand FROM inventory WHERE user_id = ? AND blockchain_hash = ? AND status != ?';
                const params = [user.id, blockchain_hash, 'deleted'];
                if (exclude_id) {
                    sql += ' AND id != ?';
                    params.push(exclude_id);
                }
                const hashMatches = query.all(sql, params);
                hashMatches.forEach(item => {
                    if (!potentialDuplicates.find(d => d.item.id === item.id)) {
                        potentialDuplicates.push({
                            item,
                            detection_type: 'hash_match',
                            confidence: CONFIDENCE_SCORES.hash_match
                        });
                    }
                });
            }

            // Check title + brand + size match
            if (title && brand && size) {
                let sql = `
                    SELECT id, title, sku, brand, size FROM inventory
                    WHERE user_id = ? AND status != ?
                    AND LOWER(TRIM(title)) = LOWER(TRIM(?))
                    AND LOWER(TRIM(brand)) = LOWER(TRIM(?))
                    AND LOWER(TRIM(size)) = LOWER(TRIM(?))
                `;
                const params = [user.id, 'deleted', title, brand, size];
                if (exclude_id) {
                    sql += ' AND id != ?';
                    params.push(exclude_id);
                }
                const titleBrandSizeMatches = query.all(sql, params);
                titleBrandSizeMatches.forEach(item => {
                    if (!potentialDuplicates.find(d => d.item.id === item.id)) {
                        potentialDuplicates.push({
                            item,
                            detection_type: 'title_brand_size',
                            confidence: CONFIDENCE_SCORES.title_brand_size
                        });
                    }
                });
            }

            // Check exact title match
            if (title) {
                let sql = `
                    SELECT id, title, sku, brand FROM inventory
                    WHERE user_id = ? AND status != ?
                    AND LOWER(TRIM(title)) = LOWER(TRIM(?))
                `;
                const params = [user.id, 'deleted', title];
                if (exclude_id) {
                    sql += ' AND id != ?';
                    params.push(exclude_id);
                }
                const titleMatches = query.all(sql, params);
                titleMatches.forEach(item => {
                    if (!potentialDuplicates.find(d => d.item.id === item.id)) {
                        potentialDuplicates.push({
                            item,
                            detection_type: 'exact_title',
                            confidence: CONFIDENCE_SCORES.exact_title
                        });
                    }
                });
            }

            return {
                status: 200,
                data: {
                    has_duplicates: potentialDuplicates.length > 0,
                    duplicates: potentialDuplicates
                }
            };
        } catch (error) {
            logger.error('[Duplicates] Error checking for duplicates', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PATCH /api/duplicates/:id - Update user action (confirm/ignore)
    const patchMatch = path.match(/^\/([a-f0-9-]+)$/i);
    if (method === 'PATCH' && patchMatch) {
        try {
            const id = patchMatch[1];
            const { user_action } = body;

            if (!['confirmed', 'ignored', 'pending'].includes(user_action)) {
                return {
                    status: 400,
                    data: { error: 'Invalid user_action. Must be: confirmed, ignored, or pending' }
                };
            }

            // Verify ownership
            const existing = query.get(
                'SELECT id FROM duplicate_detections WHERE id = ? AND user_id = ?',
                [id, user.id]
            );

            if (!existing) {
                return {
                    status: 404,
                    data: { error: 'Duplicate detection not found' }
                };
            }

            const resolved_at = user_action !== 'pending' ? new Date().toISOString() : null;

            query.run(`
                UPDATE duplicate_detections
                SET user_action = ?, resolved_at = ?
                WHERE id = ?
            `, [user_action, resolved_at, id]);

            return {
                status: 200,
                data: {
                    message: 'Duplicate detection updated',
                    id,
                    user_action,
                    resolved_at
                }
            };
        } catch (error) {
            logger.error('[Duplicates] Error updating duplicate detection', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/duplicates/:id - Delete duplicate record
    const deleteMatch = path.match(/^\/([a-f0-9-]+)$/i);
    if (method === 'DELETE' && deleteMatch) {
        const id = deleteMatch[1];

        // Verify ownership
        const existing = query.get(
            'SELECT id FROM duplicate_detections WHERE id = ? AND user_id = ?',
            [id, user.id]
        );

        if (!existing) {
            return {
                status: 404,
                data: { error: 'Duplicate detection not found' }
            };
        }

        query.run('DELETE FROM duplicate_detections WHERE id = ? AND user_id = ?', [id, user.id]);

        return {
            status: 200,
            data: { message: 'Duplicate detection deleted' }
        };
    }

    // GET /api/duplicates/stats - Get duplicate statistics
    if (method === 'GET' && path === '/stats') {
        const stats = query.get(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN user_action = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN user_action = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN user_action = 'ignored' THEN 1 ELSE 0 END) as ignored,
                SUM(CASE WHEN detection_type = 'sku_match' THEN 1 ELSE 0 END) as sku_matches,
                SUM(CASE WHEN detection_type = 'hash_match' THEN 1 ELSE 0 END) as hash_matches,
                SUM(CASE WHEN detection_type = 'title_brand_size' THEN 1 ELSE 0 END) as title_brand_size_matches,
                SUM(CASE WHEN detection_type = 'exact_title' THEN 1 ELSE 0 END) as exact_title_matches
            FROM duplicate_detections
            WHERE user_id = ?
        `, [user.id]);

        return {
            status: 200,
            data: { stats }
        };
    }

    return {
        status: 404,
        data: { error: 'Not found' }
    };
}

// Helper function to normalize strings for comparison
function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
}
