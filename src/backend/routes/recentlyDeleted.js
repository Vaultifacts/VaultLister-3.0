import { query, escapeLike } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

export async function recentlyDeletedRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    try {
        // GET / - List deleted items with pagination and filters
        if (method === 'GET' && path === '/') {
            const { type, reason, search, startDate, endDate, page = '1', limit = '50' } = queryParams;

            const pageNum = parseInt(page, 10);
            const limitNum = Math.min(parseInt(limit, 10), 200);
            const offset = (pageNum - 1) * limitNum;

            let sql = `
                SELECT * FROM deleted_items
                WHERE user_id = ?
            `;
            const params = [user.id];

            // Apply filters
            if (type) {
                sql += ` AND item_type = ?`;
                params.push(type);
            }

            if (reason) {
                sql += ` AND deletion_reason = ?`;
                params.push(reason);
            }

            if (search) {
                sql += ` AND original_data ILIKE ? ESCAPE '\\'`;
                params.push(`%${escapeLike(search)}%`);
            }

            if (startDate) {
                sql += ` AND deleted_at >= ?`;
                params.push(startDate);
            }

            if (endDate) {
                sql += ` AND deleted_at <= ?`;
                params.push(endDate);
            }

            // Get total count
            const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
            const countResult = await query.get(countSql, params);
            const total = countResult?.total || 0;

            // Add pagination and sorting
            sql += ` ORDER BY deleted_at DESC LIMIT ? OFFSET ?`;
            params.push(limitNum, offset);

            const items = await query.all(sql, params);

            // Parse original_data JSON for each item
            const parsedItems = items.map((item) => ({
                ...item,
                original_data: (() => {
                    try {
                        return JSON.parse(item.original_data);
                    } catch {
                        return {};
                    }
                })(),
            }));

            return {
                status: 200,
                data: {
                    items: parsedItems,
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total,
                        totalPages: Math.ceil(total / limitNum),
                    },
                },
            };
        }

        // GET /stats - Return counts by type and reason
        if (method === 'GET' && path === '/stats') {
            const byType = await query.all(
                `
                SELECT item_type, COUNT(*) as count
                FROM deleted_items
                WHERE user_id = ?
                GROUP BY item_type
            `,
                [user.id],
            );

            const byReason = await query.all(
                `
                SELECT deletion_reason, COUNT(*) as count
                FROM deleted_items
                WHERE user_id = ?
                GROUP BY deletion_reason
            `,
                [user.id],
            );

            const total = await query.get(
                `
                SELECT COUNT(*) as count
                FROM deleted_items
                WHERE user_id = ?
            `,
                [user.id],
            );

            return {
                status: 200,
                data: {
                    total: total?.count || 0,
                    byType: byType.reduce((acc, row) => {
                        acc[row.item_type] = row.count;
                        return acc;
                    }, {}),
                    byReason: byReason.reduce((acc, row) => {
                        acc[row.deletion_reason] = row.count;
                        return acc;
                    }, {}),
                },
            };
        }

        // POST /:id/restore - Restore a single item
        if (method === 'POST' && path.match(/^\/[^/]+\/restore$/)) {
            const id = path.split('/')[1];

            const deletedItem = await query.get('SELECT * FROM deleted_items WHERE id = ? AND user_id = ?', [
                id,
                user.id,
            ]);

            if (!deletedItem) {
                return { status: 404, data: { error: 'Deleted item not found' } };
            }

            let originalData;
            try {
                originalData = JSON.parse(deletedItem.original_data);
            } catch {
                return { status: 400, data: { error: 'Corrupted item data — cannot restore' } };
            }
            const tableName = getTableName(deletedItem.item_type);

            if (!tableName) {
                return { status: 400, data: { error: 'Invalid item type' } };
            }

            // Build insert query — validate column names to prevent injection
            const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
            const columns = Object.keys(originalData).filter((col) => VALID_IDENTIFIER.test(col));
            if (columns.length === 0) {
                return { status: 400, data: { error: 'No valid columns to restore' } };
            }
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map((col) => originalData[col]);

            const insertSql = `
                INSERT INTO ${tableName} (${columns.join(', ')})
                VALUES (${placeholders})
            `;

            try {
                await query.run(insertSql, values);

                // Remove from deleted_items
                await query.run('DELETE FROM deleted_items WHERE id = ? AND user_id = ?', [id, user.id]);

                return {
                    status: 200,
                    data: {
                        message: 'Item restored successfully',
                        item: originalData,
                    },
                };
            } catch (error) {
                logger.error('[RecentlyDeleted] Error restoring item', user?.id, { detail: error?.message });
                return {
                    status: 500,
                    data: { error: 'Failed to restore item' },
                };
            }
        }

        // POST /bulk-restore - Restore multiple items
        if (method === 'POST' && path === '/bulk-restore') {
            if (!body?.ids || !Array.isArray(body.ids)) {
                return { status: 400, data: { error: 'ids array is required' } };
            }

            if (body.ids.length > 100) {
                return { status: 400, data: { error: 'Maximum 100 items per batch' } };
            }

            let restored = 0;
            let failed = 0;
            const errors = [];

            for (const id of body.ids) {
                try {
                    const deletedItem = await query.get('SELECT * FROM deleted_items WHERE id = ? AND user_id = ?', [
                        id,
                        user.id,
                    ]);

                    if (!deletedItem) {
                        failed++;
                        errors.push({ id, error: 'Item not found' });
                        continue;
                    }

                    let originalData;
                    try {
                        originalData = JSON.parse(deletedItem.original_data);
                    } catch {
                        failed++;
                        errors.push({ id, error: 'Corrupted item data' });
                        continue;
                    }
                    const tableName = getTableName(deletedItem.item_type);

                    if (!tableName) {
                        failed++;
                        errors.push({ id, error: 'Invalid item type' });
                        continue;
                    }

                    // Validate column names to prevent injection
                    const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
                    const columns = Object.keys(originalData).filter((col) => VALID_IDENTIFIER.test(col));
                    if (columns.length === 0) {
                        failed++;
                        errors.push({ id, error: 'No valid columns to restore' });
                        continue;
                    }
                    const placeholders = columns.map(() => '?').join(', ');
                    const values = columns.map((col) => originalData[col]);

                    const insertSql = `
                        INSERT INTO ${tableName} (${columns.join(', ')})
                        VALUES (${placeholders})
                    `;

                    await query.run(insertSql, values);
                    await query.run('DELETE FROM deleted_items WHERE id = ? AND user_id = ?', [id, user.id]);
                    restored++;
                } catch (error) {
                    logger.error('[RecentlyDeleted] Error restoring item in bulk restore', user?.id, {
                        detail: error?.message,
                    });
                    failed++;
                    errors.push({ id, error: 'Failed to restore item' });
                }
            }

            return {
                status: 200,
                data: {
                    restored,
                    failed,
                    errors,
                },
            };
        }

        // DELETE /:id - Permanently delete a single item
        if (method === 'DELETE' && path.match(/^\/[^/]+$/)) {
            const id = path.split('/')[1];

            const result = await query.run('DELETE FROM deleted_items WHERE id = ? AND user_id = ?', [id, user.id]);

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Deleted item not found' } };
            }

            return {
                status: 200,
                data: { message: 'Item permanently deleted' },
            };
        }

        // DELETE /bulk-delete - Permanently delete multiple items
        if (method === 'DELETE' && path === '/bulk-delete') {
            if (!body?.ids || !Array.isArray(body.ids)) {
                return { status: 400, data: { error: 'ids array is required' } };
            }

            if (body.ids.length > 100) {
                return { status: 400, data: { error: 'Maximum 100 items per batch' } };
            }

            const placeholders = body.ids.map(() => '?').join(', ');
            const result = await query.run(`DELETE FROM deleted_items WHERE id IN (${placeholders}) AND user_id = ?`, [
                ...body.ids,
                user.id,
            ]);

            return {
                status: 200,
                data: {
                    message: 'Items permanently deleted',
                    count: result.changes,
                },
            };
        }

        // POST /cleanup - Remove items older than 30 days
        if (method === 'POST' && path === '/cleanup') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const result = await query.run('DELETE FROM deleted_items WHERE user_id = ? AND deleted_at < ?', [
                user.id,
                thirtyDaysAgo.toISOString(),
            ]);

            return {
                status: 200,
                data: {
                    message: 'Cleanup completed',
                    deleted: result.changes,
                },
            };
        }

        return { status: 404, data: { error: 'Not found' } };
    } catch (error) {
        logger.error('[RecentlyDeleted] Recently Deleted Router Error', user?.id, { detail: error?.message });
        return {
            status: 500,
            data: { error: 'Internal server error' },
        };
    }
}

// Helper function to map item_type to table name
function getTableName(itemType) {
    const typeToTable = {
        inventory: 'inventory',
        listing: 'listings',
        order: 'orders',
        offer: 'offers',
        checklist: 'checklists',
    };
    return typeToTable[itemType] || null;
}
