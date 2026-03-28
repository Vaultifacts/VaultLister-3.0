// Notion Integration Routes
// REST API endpoints for Notion connection, sync, and database operations

import * as notionService from '../services/notionService.js';
import { logger } from '../shared/logger.js';

function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

/**
 * Notion API Router
 * Handles all /api/notion/* endpoints
 */
export async function notionRouter(ctx) {
    const { method, path, user, body, query: queryParams } = ctx;

    // All notion routes require authentication
    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // Route: POST /api/notion/connect
    // Connect Notion integration with token
    if (method === 'POST' && (path === '/connect' || path === '/')) {
        return await handleConnect(user, body);
    }

    // Route: DELETE /api/notion/disconnect
    // Disconnect Notion integration
    if (method === 'DELETE' && path === '/disconnect') {
        return await handleDisconnect(user);
    }

    // Route: GET /api/notion/status
    // Get current connection status
    if (method === 'GET' && (path === '/status' || path === '/')) {
        return await handleStatus(user);
    }

    // Route: GET /api/notion/databases
    // List accessible databases
    if (method === 'GET' && path === '/databases') {
        return await handleListDatabases(user);
    }

    // Route: GET /api/notion/databases/:id
    // Get database schema
    if (method === 'GET' && path.match(/^\/databases\/[^/]+$/)) {
        const databaseId = path.split('/')[2];
        return await handleGetDatabase(user, databaseId);
    }

    // Route: POST /api/notion/databases/:id/query
    // Query a database
    if (method === 'POST' && path.match(/^\/databases\/[^/]+\/query$/)) {
        const databaseId = path.split('/')[2];
        return await handleQueryDatabase(user, databaseId, body);
    }

    // Route: POST /api/notion/setup/inventory
    // Auto-create inventory database in Notion
    if (method === 'POST' && path === '/setup/inventory') {
        return await handleSetupInventory(user, body);
    }

    // Route: POST /api/notion/setup/sales
    // Auto-create sales database in Notion
    if (method === 'POST' && path === '/setup/sales') {
        return await handleSetupSales(user, body);
    }

    // Route: POST /api/notion/setup/notes
    // Auto-create notes database in Notion
    if (method === 'POST' && path === '/setup/notes') {
        return await handleSetupNotes(user, body);
    }

    // Route: PUT /api/notion/settings
    // Update sync settings
    if (method === 'PUT' && path === '/settings') {
        return await handleUpdateSettings(user, body);
    }

    // Route: POST /api/notion/sync
    // Trigger manual sync
    if (method === 'POST' && path === '/sync') {
        return await handleTriggerSync(user, body);
    }

    // Route: GET /api/notion/sync/status
    // Get sync status
    if (method === 'GET' && path === '/sync/status') {
        return await handleSyncStatus(user);
    }

    // Route: GET /api/notion/sync/history
    // Get sync history
    if (method === 'GET' && path === '/sync/history') {
        const limit = Math.min(parseInt(queryParams.limit) || 20, 100);
        return await handleSyncHistory(user, limit);
    }

    // Route: GET /api/notion/sync/pending
    // Get items pending sync
    if (method === 'GET' && path === '/sync/pending') {
        return await handlePendingSync(user, queryParams.type);
    }

    // Route: GET /api/notion/sync/conflicts
    // Get unresolved conflicts
    if (method === 'GET' && path === '/sync/conflicts') {
        return await handleGetConflicts(user);
    }

    // Route: POST /api/notion/sync/conflicts/:id/resolve
    // Resolve a conflict
    if (method === 'POST' && path.match(/^\/sync\/conflicts\/[^/]+\/resolve$/)) {
        const conflictId = path.split('/')[3];
        return await handleResolveConflict(user, conflictId, body);
    }

    // Route: POST /api/notion/pages
    // Create a page in specified database
    if (method === 'POST' && path === '/pages') {
        return await handleCreatePage(user, body);
    }

    // Route: GET /api/notion/pages/:id
    // Get a page
    if (method === 'GET' && path.match(/^\/pages\/[^/]+$/)) {
        const pageId = path.split('/')[2];
        return await handleGetPage(user, pageId);
    }

    // Route: PUT /api/notion/pages/:id
    // Update a page
    if (method === 'PUT' && path.match(/^\/pages\/[^/]+$/)) {
        const pageId = path.split('/')[2];
        return await handleUpdatePage(user, pageId, body);
    }

    // Route: DELETE /api/notion/pages/:id
    // Archive a page
    if (method === 'DELETE' && path.match(/^\/pages\/[^/]+$/)) {
        const pageId = path.split('/')[2];
        return await handleArchivePage(user, pageId);
    }

    return { status: 404, data: { error: 'Not found' } };
}

// ============================================
// HANDLER IMPLEMENTATIONS
// ============================================

/**
 * Connect Notion integration
 */
async function handleConnect(user, body) {
    const { token } = body;

    if (!token) {
        return { status: 400, data: { error: 'Token is required' } };
    }

    try {
        // Test the token
        const testResult = await notionService.testConnection(token);

        if (!testResult.success) {
            return {
                status: 400,
                data: {
                    error: 'Invalid token or connection failed',
                    details: testResult.error
                }
            };
        }

        // Save settings with workspace info
        const settings = notionService.saveSettings(user.id, {
            token,
            bot_id: testResult.bot?.id,
            workspace_name: testResult.workspace?.name || testResult.bot?.name
        });

        return {
            status: 200,
            data: {
                success: true,
                connected: true,
                workspace: {
                    name: settings.workspace_name,
                    bot_id: settings.bot_id
                }
            }
        };

    } catch (error) {
        logger.error('[Notion] connect error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Disconnect Notion integration
 */
async function handleDisconnect(user) {
    try {
        notionService.deleteSettings(user.id);

        return {
            status: 200,
            data: { success: true, message: 'Notion integration disconnected' }
        };

    } catch (error) {
        logger.error('[Notion] disconnect error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Get connection status
 */
async function handleStatus(user) {
    try {
        const settings = notionService.getSettings(user.id);
        const isConfigured = notionService.isConfigured(user.id);

        if (!settings && !isConfigured) {
            return {
                status: 200,
                data: {
                    connected: false,
                    configured: false
                }
            };
        }

        // Test connection if token exists
        let connectionValid = false;
        if (settings?.encrypted_token || process.env.NOTION_INTEGRATION_TOKEN) {
            try {
                const client = notionService.getClient(user.id);
                await client.users.me({});
                connectionValid = true;
            } catch {
                connectionValid = false;
            }
        }

        return {
            status: 200,
            data: {
                connected: connectionValid,
                configured: isConfigured,
                workspace: settings ? {
                    name: settings.workspace_name,
                    bot_id: settings.bot_id
                } : null,
                databases: settings ? {
                    inventory: settings.inventory_database_id,
                    sales: settings.sales_database_id,
                    notes: settings.notes_database_id
                } : null,
                sync: settings ? {
                    enabled: !!settings.sync_enabled,
                    interval_minutes: settings.sync_interval_minutes,
                    conflict_strategy: settings.conflict_strategy,
                    last_sync: settings.last_sync_at,
                    last_status: settings.last_sync_status
                } : null
            }
        };

    } catch (error) {
        logger.error('[Notion] status error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * List accessible databases
 */
async function handleListDatabases(user) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const databases = await notionService.listDatabases(user.id);

        return {
            status: 200,
            data: { databases }
        };

    } catch (error) {
        logger.error('[Notion] list databases error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Get database schema
 */
async function handleGetDatabase(user, databaseId) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const database = await notionService.getDatabase(user.id, databaseId);

        return {
            status: 200,
            data: { database }
        };

    } catch (error) {
        logger.error('[Notion] get database error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Query a database
 */
async function handleQueryDatabase(user, databaseId, body) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const result = await notionService.queryDatabase(user.id, databaseId, {
            filter: body.filter,
            sorts: body.sorts,
            start_cursor: body.start_cursor,
            page_size: body.page_size
        });

        return {
            status: 200,
            data: result
        };

    } catch (error) {
        logger.error('[Notion] query database error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Set up inventory database in Notion
 */
async function handleSetupInventory(user, body) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const { parent_page_id, database_id } = body;

        // If database_id provided, just link it
        if (database_id) {
            notionService.saveSettings(user.id, {
                inventory_database_id: database_id
            });

            return {
                status: 200,
                data: {
                    success: true,
                    database_id,
                    message: 'Existing database linked'
                }
            };
        }

        // Create new database
        if (!parent_page_id) {
            return {
                status: 400,
                data: { error: 'parent_page_id is required to create a new database' }
            };
        }

        const newDb = await notionService.createDatabase(
            user.id,
            parent_page_id,
            notionService.INVENTORY_SCHEMA
        );

        // Save the database ID
        notionService.saveSettings(user.id, {
            inventory_database_id: newDb.id
        });

        return {
            status: 200,
            data: {
                success: true,
                database_id: newDb.id,
                url: newDb.url,
                message: 'Inventory database created'
            }
        };

    } catch (error) {
        logger.error('[Notion] setup inventory error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Set up sales database in Notion
 */
async function handleSetupSales(user, body) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const { parent_page_id, database_id } = body;

        if (database_id) {
            notionService.saveSettings(user.id, {
                sales_database_id: database_id
            });

            return {
                status: 200,
                data: {
                    success: true,
                    database_id,
                    message: 'Existing database linked'
                }
            };
        }

        if (!parent_page_id) {
            return {
                status: 400,
                data: { error: 'parent_page_id is required to create a new database' }
            };
        }

        const newDb = await notionService.createDatabase(
            user.id,
            parent_page_id,
            notionService.SALES_SCHEMA
        );

        notionService.saveSettings(user.id, {
            sales_database_id: newDb.id
        });

        return {
            status: 200,
            data: {
                success: true,
                database_id: newDb.id,
                url: newDb.url,
                message: 'Sales database created'
            }
        };

    } catch (error) {
        logger.error('[Notion] setup sales error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Set up notes database in Notion
 */
async function handleSetupNotes(user, body) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const { parent_page_id, database_id } = body;

        if (database_id) {
            notionService.saveSettings(user.id, {
                notes_database_id: database_id
            });

            return {
                status: 200,
                data: {
                    success: true,
                    database_id,
                    message: 'Existing database linked'
                }
            };
        }

        if (!parent_page_id) {
            return {
                status: 400,
                data: { error: 'parent_page_id is required to create a new database' }
            };
        }

        const newDb = await notionService.createDatabase(
            user.id,
            parent_page_id,
            notionService.NOTES_SCHEMA
        );

        notionService.saveSettings(user.id, {
            notes_database_id: newDb.id
        });

        return {
            status: 200,
            data: {
                success: true,
                database_id: newDb.id,
                url: newDb.url,
                message: 'Notes database created'
            }
        };

    } catch (error) {
        logger.error('[Notion] setup notes error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Update sync settings
 */
async function handleUpdateSettings(user, body) {
    try {
        const allowedFields = [
            'inventory_database_id',
            'sales_database_id',
            'notes_database_id',
            'sync_enabled',
            'sync_interval_minutes',
            'conflict_strategy'
        ];

        const updates = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return { status: 400, data: { error: 'No valid fields to update' } };
        }

        // Validate conflict_strategy
        if (updates.conflict_strategy) {
            const valid = ['manual', 'vaultlister_wins', 'notion_wins', 'newest_wins'];
            if (!valid.includes(updates.conflict_strategy)) {
                return { status: 400, data: { error: 'Invalid conflict_strategy' } };
            }
        }

        // Validate sync_interval_minutes (minimum 15)
        if (updates.sync_interval_minutes !== undefined) {
            const interval = parseInt(updates.sync_interval_minutes);
            if (isNaN(interval) || interval < 15) {
                return { status: 400, data: { error: 'sync_interval_minutes must be at least 15' } };
            }
            updates.sync_interval_minutes = interval;
        }

        const settings = notionService.saveSettings(user.id, updates);

        return {
            status: 200,
            data: {
                success: true,
                settings: {
                    inventory_database_id: settings.inventory_database_id,
                    sales_database_id: settings.sales_database_id,
                    notes_database_id: settings.notes_database_id,
                    sync_enabled: !!settings.sync_enabled,
                    sync_interval_minutes: settings.sync_interval_minutes,
                    conflict_strategy: settings.conflict_strategy
                }
            }
        };

    } catch (error) {
        logger.error('[Notion] update settings error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Trigger manual sync
 */
async function handleTriggerSync(user, body) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const settings = notionService.getSettings(user.id);

        // Check if a sync is already in progress
        if (settings?.last_sync_status === 'in_progress') {
            return {
                status: 409,
                data: { error: 'Sync already in progress' }
            };
        }

        const { direction = 'bidirectional', entity_types = ['inventory', 'sales', 'notes'] } = body;

        // Import sync service dynamically to avoid circular deps
        const { performSync } = await import('../services/platformSync/notionSync.js');

        // Run sync (this returns immediately with a sync ID, actual sync runs async)
        const syncResult = await performSync(user.id, {
            direction,
            entity_types,
            manual: true
        });

        return {
            status: 200,
            data: {
                success: true,
                sync_id: syncResult.sync_id,
                message: 'Sync started',
                ...syncResult
            }
        };

    } catch (error) {
        logger.error('[Notion] trigger sync error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Get sync status
 */
async function handleSyncStatus(user) {
    try {
        const settings = notionService.getSettings(user.id);

        if (!settings) {
            return {
                status: 200,
                data: {
                    configured: false,
                    last_sync: null
                }
            };
        }

        // Get counts of items in each sync state
        const { query: dbQuery } = await import('../db/database.js');

        const pendingPush = Number((await dbQuery.get(
            `SELECT COUNT(*) as count FROM notion_sync_map WHERE user_id = ? AND sync_status = 'pending_push'`,
            [user.id]
        ))?.count) || 0;

        const pendingPull = Number((await dbQuery.get(
            `SELECT COUNT(*) as count FROM notion_sync_map WHERE user_id = ? AND sync_status = 'pending_pull'`,
            [user.id]
        ))?.count) || 0;

        const conflicts = Number((await dbQuery.get(
            `SELECT COUNT(*) as count FROM notion_sync_conflicts WHERE user_id = ? AND resolved = 0`,
            [user.id]
        ))?.count) || 0;

        const synced = Number((await dbQuery.get(
            `SELECT COUNT(*) as count FROM notion_sync_map WHERE user_id = ? AND sync_status = 'synced'`,
            [user.id]
        ))?.count) || 0;

        return {
            status: 200,
            data: {
                configured: true,
                sync_enabled: !!settings.sync_enabled,
                last_sync: settings.last_sync_at,
                last_status: settings.last_sync_status,
                last_error: settings.last_sync_error,
                counts: {
                    synced,
                    pending_push: pendingPush,
                    pending_pull: pendingPull,
                    conflicts
                }
            }
        };

    } catch (error) {
        logger.error('[Notion] sync status error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Get sync history
 */
async function handleSyncHistory(user, limit) {
    try {
        const history = notionService.getSyncHistory(user.id, limit);

        return {
            status: 200,
            data: { history }
        };

    } catch (error) {
        logger.error('[Notion] sync history error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Get items pending sync
 */
async function handlePendingSync(user, entityType) {
    try {
        const pending = notionService.getPendingSyncItems(user.id, entityType);

        return {
            status: 200,
            data: { items: pending }
        };

    } catch (error) {
        logger.error('[Notion] pending sync error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Get unresolved conflicts
 */
async function handleGetConflicts(user) {
    try {
        const { query: dbQuery } = await import('../db/database.js');

        const conflicts = dbQuery.all(
            `SELECT * FROM notion_sync_conflicts WHERE user_id = ? AND resolved = 0 ORDER BY detected_at DESC`,
            [user.id]
        );

        // Parse JSON fields
        const parsed = conflicts.map(c => ({
            ...c,
            local_data: safeJsonParse(c.local_data, {}),
            notion_data: safeJsonParse(c.notion_data, {}),
            conflicting_fields: safeJsonParse(c.conflicting_fields, [])
        }));

        return {
            status: 200,
            data: { conflicts: parsed }
        };

    } catch (error) {
        logger.error('[Notion] get conflicts error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Resolve a conflict
 */
async function handleResolveConflict(user, conflictId, body) {
    try {
        const { resolution } = body;

        if (!resolution || !['keep_local', 'keep_notion', 'merge', 'ignore'].includes(resolution)) {
            return {
                status: 400,
                data: { error: 'Invalid resolution. Must be: keep_local, keep_notion, merge, or ignore' }
            };
        }

        const { query: dbQuery } = await import('../db/database.js');

        // Get the conflict
        const conflict = dbQuery.get(
            `SELECT * FROM notion_sync_conflicts WHERE id = ? AND user_id = ?`,
            [conflictId, user.id]
        );

        if (!conflict) {
            return { status: 404, data: { error: 'Conflict not found' } };
        }

        if (conflict.resolved) {
            return { status: 400, data: { error: 'Conflict already resolved' } };
        }

        // Import sync service to apply resolution
        const { resolveConflict } = await import('../services/platformSync/notionSync.js');

        await resolveConflict(user.id, conflictId, resolution, body.merged_data);

        return {
            status: 200,
            data: {
                success: true,
                message: `Conflict resolved with: ${resolution}`
            }
        };

    } catch (error) {
        logger.error('[Notion] resolve conflict error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Create a page
 */
async function handleCreatePage(user, body) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const { database_id, properties } = body;

        if (!database_id) {
            return { status: 400, data: { error: 'database_id is required' } };
        }

        if (!properties) {
            return { status: 400, data: { error: 'properties are required' } };
        }

        const page = await notionService.createPage(user.id, database_id, properties);

        return {
            status: 200,
            data: { page }
        };

    } catch (error) {
        logger.error('[Notion] create page error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Get a page
 */
async function handleGetPage(user, pageId) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const page = await notionService.getPage(user.id, pageId);

        return {
            status: 200,
            data: { page }
        };

    } catch (error) {
        logger.error('[Notion] get page error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Update a page
 */
async function handleUpdatePage(user, pageId, body) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const { properties } = body;

        if (!properties) {
            return { status: 400, data: { error: 'properties are required' } };
        }

        const page = await notionService.updatePage(user.id, pageId, properties);

        return {
            status: 200,
            data: { page }
        };

    } catch (error) {
        logger.error('[Notion] update page error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

/**
 * Archive a page
 */
async function handleArchivePage(user, pageId) {
    try {
        if (!notionService.isConfigured(user.id)) {
            return { status: 400, data: { error: 'Notion not configured' } };
        }

        const result = await notionService.archivePage(user.id, pageId);

        return {
            status: 200,
            data: result
        };

    } catch (error) {
        logger.error('[Notion] archive page error', user?.id, { detail: error?.message || 'Unknown error' });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

export default notionRouter;
