// Notion Bidirectional Sync Service
// Handles syncing inventory, sales, and notes between VaultLister and Notion

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import * as notionService from '../notionService.js';
import { logger } from '../../shared/logger.js';

/**
 * Perform sync operation
 * @param {string} userId
 * @param {Object} options - { direction, entity_types, manual }
 * @returns {Object} Sync results
 */
export async function performSync(userId, options = {}) {
    const {
        direction = 'bidirectional',
        entity_types = ['inventory', 'sales', 'notes'],
        manual = false
    } = options;

    const settings = notionService.getSettings(userId);
    if (!settings) {
        throw new Error('Notion not configured for this user');
    }

    const startTime = Date.now();
    const syncId = uuidv4();

    // Check if a sync is already running (prevent concurrent syncs)
    if (settings.last_sync_status === 'in_progress') {
        // Allow override if stuck for more than 5 minutes
        const lastSync = settings.last_sync_at ? new Date(settings.last_sync_at).getTime() : 0;
        if (Date.now() - lastSync < 5 * 60 * 1000) {
            throw new Error('A sync is already in progress. Please wait for it to complete.');
        }
    }

    // Mark sync as in progress
    query.run(`
        UPDATE notion_settings SET
            last_sync_status = 'in_progress',
            last_sync_at = ?,
            updated_at = ?
        WHERE user_id = ?
    `, [new Date().toISOString(), new Date().toISOString(), userId]);

    const results = {
        sync_id: syncId,
        direction,
        entity_types,
        manual,
        started_at: new Date().toISOString(),
        inventory: { pushed: 0, pulled: 0, conflicts: 0, errors: [] },
        sales: { pushed: 0, pulled: 0, conflicts: 0, errors: [] },
        notes: { pushed: 0, pulled: 0, conflicts: 0, errors: [] }
    };

    try {
        // Sync each entity type
        for (const entityType of entity_types) {
            try {
                if (entityType === 'inventory' && settings.inventory_database_id) {
                    const invResults = await syncInventory(userId, settings, direction);
                    results.inventory = invResults;
                }
                if (entityType === 'sales' && settings.sales_database_id) {
                    const salesResults = await syncSales(userId, settings, direction);
                    results.sales = salesResults;
                }
                if (entityType === 'notes' && settings.notes_database_id) {
                    const notesResults = await syncNotes(userId, settings, direction);
                    results.notes = notesResults;
                }
            } catch (error) {
                results[entityType].errors.push({ error: error.message });
            }
        }

        // Calculate totals
        const totalPushed = results.inventory.pushed + results.sales.pushed + results.notes.pushed;
        const totalPulled = results.inventory.pulled + results.sales.pulled + results.notes.pulled;
        const totalConflicts = results.inventory.conflicts + results.sales.conflicts + results.notes.conflicts;
        const totalErrors = results.inventory.errors.length + results.sales.errors.length + results.notes.errors.length;

        const status = totalErrors > 0 ? (totalPushed + totalPulled > 0 ? 'partial' : 'failed') : 'success';

        // Update settings with sync result
        query.run(`
            UPDATE notion_settings SET
                last_sync_status = ?,
                last_sync_error = ?,
                updated_at = ?
            WHERE user_id = ?
        `, [
            status,
            totalErrors > 0 ? `${totalErrors} errors occurred` : null,
            new Date().toISOString(),
            userId
        ]);

        // Log sync history
        const endTime = Date.now();
        notionService.logSyncHistory(userId, {
            sync_type: manual ? 'manual' : 'incremental',
            direction,
            items_processed: totalPushed + totalPulled,
            items_created: totalPushed,
            items_updated: totalPulled,
            conflicts_detected: totalConflicts,
            errors_count: totalErrors,
            status,
            started_at: results.started_at,
            completed_at: new Date().toISOString(),
            duration_ms: endTime - startTime
        });

        results.completed_at = new Date().toISOString();
        results.status = status;
        results.duration_ms = endTime - startTime;

        return results;

    } catch (error) {
        // Mark sync as failed
        query.run(`
            UPDATE notion_settings SET
                last_sync_status = 'failed',
                last_sync_error = ?,
                updated_at = ?
            WHERE user_id = ?
        `, [error.message, new Date().toISOString(), userId]);

        throw error;
    }
}

/**
 * Sync inventory items
 */
async function syncInventory(userId, settings, direction) {
    const results = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };
    const databaseId = settings.inventory_database_id;
    const conflictStrategy = settings.conflict_strategy || 'manual';

    try {
        // PUSH: VaultLister -> Notion
        if (direction === 'push' || direction === 'bidirectional') {
            const localItems = query.all(
                `SELECT * FROM inventory WHERE user_id = ? AND deleted_at IS NULL`,
                [userId]
            );

            for (const item of localItems) {
                try {
                    const syncMap = notionService.getSyncMap(userId, 'inventory', item.id);

                    if (syncMap) {
                        // Check for conflicts in bidirectional mode
                        if (direction === 'bidirectional') {
                            const conflict = await checkForConflict(
                                userId,
                                'inventory',
                                item,
                                syncMap,
                                conflictStrategy
                            );

                            if (conflict) {
                                results.conflicts++;
                                continue;
                            }
                        }

                        // Update existing page
                        const props = notionService.mapInventoryToNotion(item);
                        await notionService.updatePage(userId, syncMap.notion_page_id, props);

                        notionService.upsertSyncMap(userId, 'inventory', item.id, syncMap.notion_page_id, {
                            local_updated_at: item.updated_at,
                            sync_status: 'synced'
                        });
                    } else {
                        // Create new page
                        const props = notionService.mapInventoryToNotion(item);
                        const page = await notionService.createPage(userId, databaseId, props);

                        notionService.upsertSyncMap(userId, 'inventory', item.id, page.id, {
                            local_updated_at: item.updated_at,
                            notion_updated_at: page.last_edited_time,
                            sync_status: 'synced'
                        });
                    }

                    results.pushed++;
                } catch (error) {
                    results.errors.push({ item_id: item.id, error: error.message });
                }
            }
        }

        // PULL: Notion -> VaultLister
        if (direction === 'pull' || direction === 'bidirectional') {
            let cursor = undefined;

            do {
                const response = await notionService.queryDatabase(userId, databaseId, {
                    start_cursor: cursor,
                    page_size: 100
                });

                for (const notionPage of response.results) {
                    try {
                        const notionData = notionService.mapNotionToInventory(notionPage);
                        const syncMap = notionService.getSyncMapByNotionId(userId, 'inventory', notionPage.id);

                        if (syncMap) {
                            // Check if this was pushed by us (has VaultLister ID)
                            if (notionData.vaultlister_id) {
                                // Skip if we just pushed this item
                                if (direction === 'bidirectional') {
                                    const existingMap = notionService.getSyncMap(userId, 'inventory', notionData.vaultlister_id);
                                    if (existingMap && existingMap.sync_status === 'synced') {
                                        continue;
                                    }
                                }
                            }

                            // Check for conflicts
                            if (direction === 'bidirectional') {
                                const localItem = query.get(
                                    'SELECT * FROM inventory WHERE id = ?',
                                    [syncMap.local_id]
                                );

                                if (localItem) {
                                    const conflict = await checkForConflict(
                                        userId,
                                        'inventory',
                                        localItem,
                                        syncMap,
                                        conflictStrategy,
                                        notionPage
                                    );

                                    if (conflict) {
                                        results.conflicts++;
                                        continue;
                                    }
                                }
                            }

                            // Update local item
                            await updateLocalInventory(syncMap.local_id, notionData);

                            notionService.upsertSyncMap(userId, 'inventory', syncMap.local_id, notionPage.id, {
                                notion_updated_at: notionPage.last_edited_time,
                                sync_status: 'synced'
                            });

                            results.pulled++;
                        } else if (!notionData.vaultlister_id) {
                            // New item from Notion (not originally from VaultLister)
                            const newItem = await createLocalInventory(userId, notionData);

                            notionService.upsertSyncMap(userId, 'inventory', newItem.id, notionPage.id, {
                                local_updated_at: newItem.updated_at,
                                notion_updated_at: notionPage.last_edited_time,
                                sync_status: 'synced'
                            });

                            // Update Notion page with VaultLister ID
                            await notionService.updatePage(userId, notionPage.id, {
                                'VaultLister ID': { rich_text: [{ text: { content: newItem.id } }] }
                            });

                            results.pulled++;
                        }
                    } catch (error) {
                        results.errors.push({ notion_page_id: notionPage.id, error: error.message });
                    }
                }

                cursor = response.has_more ? response.next_cursor : undefined;
            } while (cursor);
        }

    } catch (error) {
        results.errors.push({ error: error.message });
    }

    return results;
}

/**
 * Sync sales
 */
async function syncSales(userId, settings, direction) {
    const results = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };
    const databaseId = settings.sales_database_id;

    try {
        // PUSH: VaultLister -> Notion
        if (direction === 'push' || direction === 'bidirectional') {
            const localSales = query.all(
                `SELECT s.*, i.title as item_title, sh.platform
                 FROM sales s
                 LEFT JOIN inventory i ON s.inventory_id = i.id
                 LEFT JOIN shops sh ON s.shop_id = sh.id
                 WHERE s.user_id = ?`,
                [userId]
            );

            for (const sale of localSales) {
                try {
                    const syncMap = notionService.getSyncMap(userId, 'sale', sale.id);

                    if (syncMap) {
                        const props = notionService.mapSaleToNotion(sale);
                        await notionService.updatePage(userId, syncMap.notion_page_id, props);

                        notionService.upsertSyncMap(userId, 'sale', sale.id, syncMap.notion_page_id, {
                            local_updated_at: sale.updated_at,
                            sync_status: 'synced'
                        });
                    } else {
                        const props = notionService.mapSaleToNotion(sale);
                        const page = await notionService.createPage(userId, databaseId, props);

                        notionService.upsertSyncMap(userId, 'sale', sale.id, page.id, {
                            local_updated_at: sale.updated_at,
                            notion_updated_at: page.last_edited_time,
                            sync_status: 'synced'
                        });
                    }

                    results.pushed++;
                } catch (error) {
                    results.errors.push({ sale_id: sale.id, error: error.message });
                }
            }
        }

        // PULL: Notion -> VaultLister (sales are typically pushed only, but support pull)
        if (direction === 'pull') {
            let cursor = undefined;

            do {
                const response = await notionService.queryDatabase(userId, databaseId, {
                    start_cursor: cursor,
                    page_size: 100
                });

                for (const notionPage of response.results) {
                    try {
                        const notionData = notionService.mapNotionToSale(notionPage);
                        const syncMap = notionService.getSyncMapByNotionId(userId, 'sale', notionPage.id);

                        if (syncMap) {
                            await updateLocalSale(syncMap.local_id, notionData);

                            notionService.upsertSyncMap(userId, 'sale', syncMap.local_id, notionPage.id, {
                                notion_updated_at: notionPage.last_edited_time,
                                sync_status: 'synced'
                            });

                            results.pulled++;
                        } else if (!notionData.vaultlister_id) {
                            const newSale = await createLocalSale(userId, notionData);

                            notionService.upsertSyncMap(userId, 'sale', newSale.id, notionPage.id, {
                                local_updated_at: newSale.updated_at,
                                notion_updated_at: notionPage.last_edited_time,
                                sync_status: 'synced'
                            });

                            await notionService.updatePage(userId, notionPage.id, {
                                'VaultLister ID': { rich_text: [{ text: { content: newSale.id } }] }
                            });

                            results.pulled++;
                        }
                    } catch (error) {
                        results.errors.push({ notion_page_id: notionPage.id, error: error.message });
                    }
                }

                cursor = response.has_more ? response.next_cursor : undefined;
            } while (cursor);
        }

    } catch (error) {
        results.errors.push({ error: error.message });
    }

    return results;
}

/**
 * Sync notes (placeholder - notes table may need to be created)
 */
async function syncNotes(userId, settings, direction) {
    const results = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

    // Notes sync would follow similar pattern
    // For now, return empty results as notes table may not exist
    return results;
}

/**
 * Check for sync conflict
 */
async function checkForConflict(userId, entityType, localItem, syncMap, strategy, notionPage = null) {
    // Get Notion page if not provided
    if (!notionPage) {
        try {
            notionPage = await notionService.getPage(userId, syncMap.notion_page_id);
        } catch {
            // Page may have been deleted
            return false;
        }
    }

    const localUpdated = new Date(localItem.updated_at).getTime();
    const notionUpdated = new Date(notionPage.last_edited_time).getTime();
    const lastSynced = syncMap.last_synced_at ? new Date(syncMap.last_synced_at).getTime() : 0;

    // Both modified since last sync = conflict
    const localModified = localUpdated > lastSynced;
    const notionModified = notionUpdated > lastSynced;

    if (localModified && notionModified) {
        // Handle based on strategy
        switch (strategy) {
            case 'vaultlister_wins':
                // Local wins, no conflict
                return false;

            case 'notion_wins':
                // Notion wins, update local
                notionService.updateSyncStatus(syncMap.id, 'pending_pull');
                return false;

            case 'newest_wins':
                if (localUpdated > notionUpdated) {
                    return false; // Local wins
                } else {
                    notionService.updateSyncStatus(syncMap.id, 'pending_pull');
                    return false; // Notion wins
                }

            case 'manual':
            default:
                // Create conflict record for manual resolution
                await createConflictRecord(userId, syncMap, entityType, localItem, notionPage);
                notionService.updateSyncStatus(syncMap.id, 'conflict');
                return true;
        }
    }

    return false;
}

/**
 * Create conflict record for manual resolution
 */
async function createConflictRecord(userId, syncMap, entityType, localItem, notionPage) {
    const conflictId = uuidv4();
    const now = new Date().toISOString();

    // Determine conflicting fields
    const conflictingFields = findConflictingFields(entityType, localItem, notionPage);

    query.run(`
        INSERT INTO notion_sync_conflicts (
            id, user_id, sync_map_id, entity_type, local_id, notion_page_id,
            local_data, notion_data, conflicting_fields, detected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        conflictId,
        userId,
        syncMap.id,
        entityType,
        syncMap.local_id,
        syncMap.notion_page_id,
        JSON.stringify(localItem),
        JSON.stringify(notionPage),
        JSON.stringify(conflictingFields),
        now
    ]);

    return conflictId;
}

/**
 * Find which fields are different between local and Notion
 */
function findConflictingFields(entityType, localItem, notionPage) {
    const conflicts = [];

    if (entityType === 'inventory') {
        const notionData = notionService.mapNotionToInventory(notionPage);

        if (localItem.title !== notionData.title) conflicts.push('title');
        if (localItem.description !== notionData.description) conflicts.push('description');
        if (localItem.sku !== notionData.sku) conflicts.push('sku');
        if (parseFloat(localItem.list_price) !== parseFloat(notionData.list_price)) conflicts.push('list_price');
        if (parseFloat(localItem.cost_price) !== parseFloat(notionData.cost_price)) conflicts.push('cost_price');
        if (parseInt(localItem.quantity) !== parseInt(notionData.quantity)) conflicts.push('quantity');
        if (localItem.status !== notionData.status) conflicts.push('status');
    }

    return conflicts;
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(userId, conflictId, resolution, mergedData = null) {
    const conflict = query.get(
        'SELECT * FROM notion_sync_conflicts WHERE id = ? AND user_id = ?',
        [conflictId, userId]
    );

    if (!conflict) {
        throw new Error('Conflict not found');
    }

    const syncMap = query.get('SELECT * FROM notion_sync_map WHERE id = ?', [conflict.sync_map_id]);
    const now = new Date().toISOString();

    switch (resolution) {
        case 'keep_local':
            // Push local to Notion
            if (conflict.entity_type === 'inventory') {
                const localItem = query.get('SELECT * FROM inventory WHERE id = ?', [conflict.local_id]);
                if (localItem) {
                    const props = notionService.mapInventoryToNotion(localItem);
                    await notionService.updatePage(userId, conflict.notion_page_id, props);
                }
            }
            break;

        case 'keep_notion':
            // Pull Notion to local
            const notionPage = await notionService.getPage(userId, conflict.notion_page_id);
            if (conflict.entity_type === 'inventory') {
                const notionData = notionService.mapNotionToInventory(notionPage);
                await updateLocalInventory(conflict.local_id, notionData);
            }
            break;

        case 'merge':
            // Use provided merged data
            if (!mergedData) {
                throw new Error('merged_data required for merge resolution');
            }
            if (conflict.entity_type === 'inventory') {
                await updateLocalInventory(conflict.local_id, mergedData);
                const props = notionService.mapInventoryToNotion({
                    id: conflict.local_id,
                    ...mergedData
                });
                await notionService.updatePage(userId, conflict.notion_page_id, props);
            }
            break;

        case 'ignore':
            // Just mark as resolved, keep both as-is
            break;
    }

    // Mark conflict as resolved
    query.run(`
        UPDATE notion_sync_conflicts SET
            resolved = 1,
            resolution = ?,
            resolved_at = ?,
            resolved_by = ?
        WHERE id = ?
    `, [resolution, now, userId, conflictId]);

    // Update sync map status
    if (syncMap) {
        notionService.updateSyncStatus(syncMap.id, 'synced');
    }

    return { success: true };
}

// ============================================
// LOCAL DATA OPERATIONS
// ============================================

/**
 * Create local inventory item from Notion data
 */
async function createLocalInventory(userId, notionData) {
    const id = uuidv4();
    const now = new Date().toISOString();

    // Parse tags if array
    const tags = Array.isArray(notionData.tags)
        ? JSON.stringify(notionData.tags)
        : notionData.tags;

    query.run(`
        INSERT INTO inventory (
            id, user_id, title, sku, description, brand, category,
            condition, cost_price, list_price, quantity, status,
            tags, location, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id,
        userId,
        notionData.title || 'Untitled',
        notionData.sku,
        notionData.description,
        notionData.brand,
        notionData.category,
        notionData.condition,
        notionData.cost_price,
        notionData.list_price,
        notionData.quantity || 0,
        notionData.status || 'draft',
        tags,
        notionData.location,
        now,
        now
    ]);

    return { id, updated_at: now };
}

/**
 * Update local inventory item from Notion data
 */
async function updateLocalInventory(localId, notionData) {
    const now = new Date().toISOString();

    // Parse tags if array
    const tags = Array.isArray(notionData.tags)
        ? JSON.stringify(notionData.tags)
        : notionData.tags;

    query.run(`
        UPDATE inventory SET
            title = COALESCE(?, title),
            sku = COALESCE(?, sku),
            description = COALESCE(?, description),
            brand = COALESCE(?, brand),
            category = COALESCE(?, category),
            condition = COALESCE(?, condition),
            cost_price = COALESCE(?, cost_price),
            list_price = COALESCE(?, list_price),
            quantity = COALESCE(?, quantity),
            status = COALESCE(?, status),
            tags = COALESCE(?, tags),
            location = COALESCE(?, location),
            updated_at = ?
        WHERE id = ?
    `, [
        notionData.title,
        notionData.sku,
        notionData.description,
        notionData.brand,
        notionData.category,
        notionData.condition,
        notionData.cost_price,
        notionData.list_price,
        notionData.quantity,
        notionData.status,
        tags,
        notionData.location,
        now,
        localId
    ]);
}

/**
 * Create local sale from Notion data
 */
async function createLocalSale(userId, notionData) {
    const id = uuidv4();
    const now = new Date().toISOString();

    query.run(`
        INSERT INTO sales (
            id, user_id, sale_price, platform_fees, shipping_cost,
            net_profit, sale_date, buyer_username, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id,
        userId,
        notionData.sale_price || 0,
        notionData.platform_fees || 0,
        notionData.shipping_cost || 0,
        notionData.net_profit || 0,
        notionData.sale_date,
        notionData.buyer_username,
        notionData.status || 'completed',
        now,
        now
    ]);

    return { id, updated_at: now };
}

/**
 * Update local sale from Notion data
 */
async function updateLocalSale(localId, notionData) {
    const now = new Date().toISOString();

    query.run(`
        UPDATE sales SET
            sale_price = COALESCE(?, sale_price),
            platform_fees = COALESCE(?, platform_fees),
            shipping_cost = COALESCE(?, shipping_cost),
            net_profit = COALESCE(?, net_profit),
            sale_date = COALESCE(?, sale_date),
            buyer_username = COALESCE(?, buyer_username),
            status = COALESCE(?, status),
            updated_at = ?
        WHERE id = ?
    `, [
        notionData.sale_price,
        notionData.platform_fees,
        notionData.shipping_cost,
        notionData.net_profit,
        notionData.sale_date,
        notionData.buyer_username,
        notionData.status,
        now,
        localId
    ]);
}

// ============================================
// SYNC SCHEDULER
// ============================================

let syncIntervalId = null;

/**
 * Start background sync scheduler
 */
export function startSyncScheduler() {
    if (syncIntervalId) return;

    const checkInterval = 5 * 60 * 1000; // Check every 5 minutes

    syncIntervalId = setInterval(async () => {
        try {
            // Find users due for sync
            const dueUsers = query.all(`
                SELECT user_id, sync_interval_minutes, last_sync_at
                FROM notion_settings
                WHERE sync_enabled = 1
                AND (
                    last_sync_at IS NULL
                    OR datetime(last_sync_at, '+' || sync_interval_minutes || ' minutes') < datetime('now')
                )
            `);

            for (const user of dueUsers) {
                try {
                    logger.info(`Running scheduled Notion sync for user ${user.user_id}`);
                    await performSync(user.user_id, {
                        direction: 'bidirectional',
                        entity_types: ['inventory', 'sales'],
                        manual: false
                    });
                } catch (error) {
                    logger.error(`Notion sync error for user ${user.user_id}:`, error.message);
                }
            }
        } catch (error) {
            logger.error('Notion sync scheduler error:', error);
        }
    }, checkInterval);

    logger.info('Notion sync scheduler started');
}

/**
 * Stop background sync scheduler
 */
export function stopSyncScheduler() {
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
        logger.info('Notion sync scheduler stopped');
    }
}

export default {
    performSync,
    resolveConflict,
    startSyncScheduler,
    stopSyncScheduler
};
