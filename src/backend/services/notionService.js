// Notion Integration Service
// Core API client for Notion operations using @notionhq/client SDK

import { Client } from '@notionhq/client';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { encryptToken, decryptToken } from '../utils/encryption.js';
import { withTimeout } from '../shared/fetchWithTimeout.js';
import { circuitBreaker } from '../shared/circuitBreaker.js';

// Rate limiting: Notion allows 3 requests per second
const RATE_LIMIT_DELAY = 350; // ms between requests
let lastRequestTime = 0;

/**
 * Rate limiter to respect Notion's 3 req/sec limit
 */
async function rateLimitedRequest(fn) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
    }

    lastRequestTime = Date.now();
    return circuitBreaker('notion', () => withTimeout(fn(), 30000, 'Notion API'),
        { failureThreshold: 5, cooldownMs: 30000 });
}

/**
 * Check if Notion integration is configured (has token)
 * @param {string} userId - User ID to check
 * @returns {boolean}
 */
export async function isConfigured(userId) {
    if (!userId) {
        // Check if global env token exists
        return !!process.env.NOTION_INTEGRATION_TOKEN;
    }

    const settings = await query.get(
        'SELECT encrypted_token FROM notion_settings WHERE user_id = ?',
        [userId]
    );

    return !!(settings?.encrypted_token || process.env.NOTION_INTEGRATION_TOKEN);
}

/**
 * Get Notion client for a user
 * @param {string} userId - User ID
 * @returns {Client} Notion client instance
 */
export async function getClient(userId) {
    let token;

    if (userId) {
        const settings = await query.get(
            'SELECT encrypted_token FROM notion_settings WHERE user_id = ?',
            [userId]
        );

        if (settings?.encrypted_token) {
            token = decryptToken(settings.encrypted_token);
        }
    }

    // Fall back to environment variable
    if (!token) {
        token = process.env.NOTION_INTEGRATION_TOKEN;
    }

    if (!token) {
        throw new Error('Notion integration not configured');
    }

    return new Client({ auth: token });
}

/**
 * Get user's Notion settings
 * @param {string} userId
 * @returns {Object|null}
 */
export async function getSettings(userId) {
    return await query.get(
        'SELECT * FROM notion_settings WHERE user_id = ?',
        [userId]
    );
}

/**
 * Save or update user's Notion settings
 * @param {string} userId
 * @param {Object} settings
 * @returns {Object}
 */
export async function saveSettings(userId, settings) {
    const existing = await getSettings(userId);
    const now = new Date().toISOString();

    if (existing) {
        const updates = [];
        const values = [];

        if (settings.token !== undefined) {
            updates.push('encrypted_token = ?');
            values.push(settings.token ? encryptToken(settings.token) : null);
        }
        if (settings.workspace_id !== undefined) {
            updates.push('workspace_id = ?');
            values.push(settings.workspace_id);
        }
        if (settings.workspace_name !== undefined) {
            updates.push('workspace_name = ?');
            values.push(settings.workspace_name);
        }
        if (settings.workspace_icon !== undefined) {
            updates.push('workspace_icon = ?');
            values.push(settings.workspace_icon);
        }
        if (settings.bot_id !== undefined) {
            updates.push('bot_id = ?');
            values.push(settings.bot_id);
        }
        if (settings.inventory_database_id !== undefined) {
            updates.push('inventory_database_id = ?');
            values.push(settings.inventory_database_id);
        }
        if (settings.sales_database_id !== undefined) {
            updates.push('sales_database_id = ?');
            values.push(settings.sales_database_id);
        }
        if (settings.notes_database_id !== undefined) {
            updates.push('notes_database_id = ?');
            values.push(settings.notes_database_id);
        }
        if (settings.sync_enabled !== undefined) {
            updates.push('sync_enabled = ?');
            values.push(settings.sync_enabled ? 1 : 0);
        }
        if (settings.sync_interval_minutes !== undefined) {
            updates.push('sync_interval_minutes = ?');
            values.push(settings.sync_interval_minutes);
        }
        if (settings.conflict_strategy !== undefined) {
            updates.push('conflict_strategy = ?');
            values.push(settings.conflict_strategy);
        }

        updates.push('updated_at = ?');
        values.push(now);
        values.push(userId);

        await query.run(
            `UPDATE notion_settings SET ${updates.join(', ')} WHERE user_id = ?`,
            values
        );

        return await getSettings(userId);
    } else {
        const id = uuidv4();
        await query.run(`
            INSERT INTO notion_settings (
                id, user_id, encrypted_token, workspace_id, workspace_name,
                workspace_icon, bot_id, inventory_database_id, sales_database_id,
                notes_database_id, sync_enabled, sync_interval_minutes,
                conflict_strategy, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            userId,
            settings.token ? encryptToken(settings.token) : null,
            settings.workspace_id || null,
            settings.workspace_name || null,
            settings.workspace_icon || null,
            settings.bot_id || null,
            settings.inventory_database_id || null,
            settings.sales_database_id || null,
            settings.notes_database_id || null,
            settings.sync_enabled !== false ? 1 : 0,
            settings.sync_interval_minutes || 60,
            settings.conflict_strategy || 'manual',
            now,
            now
        ]);

        return await getSettings(userId);
    }
}

/**
 * Delete user's Notion settings (disconnect)
 * @param {string} userId
 */
export async function deleteSettings(userId) {
    // Delete sync maps
    await query.run('DELETE FROM notion_sync_map WHERE user_id = ?', [userId]);
    // Delete field mappings
    await query.run('DELETE FROM notion_field_mappings WHERE user_id = ?', [userId]);
    // Delete conflicts
    await query.run('DELETE FROM notion_sync_conflicts WHERE user_id = ?', [userId]);
    // Delete settings
    await query.run('DELETE FROM notion_settings WHERE user_id = ?', [userId]);
}

/**
 * Test connection and get workspace info
 * @param {string} token - Notion token to test
 * @returns {Object} Workspace info
 */
export async function testConnection(token) {
    const client = new Client({ auth: token });

    try {
        const response = await rateLimitedRequest(() => client.users.me({}));

        return {
            success: true,
            bot: {
                id: response.id,
                name: response.name,
                type: response.type,
                avatar_url: response.avatar_url
            },
            workspace: response.workspace_name ? {
                name: response.workspace_name
            } : null
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            code: error.code
        };
    }
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * List all databases accessible to the integration
 * @param {string} userId
 * @returns {Array}
 */
export async function listDatabases(userId) {
    const client = getClient(userId);
    const databases = [];
    let cursor = undefined;

    do {
        const response = await rateLimitedRequest(() =>
            client.search({
                filter: { property: 'object', value: 'database' },
                start_cursor: cursor
            })
        );

        for (const db of response.results) {
            databases.push({
                id: db.id,
                title: db.title?.[0]?.plain_text || 'Untitled',
                icon: db.icon,
                url: db.url,
                created_time: db.created_time,
                last_edited_time: db.last_edited_time,
                properties: Object.keys(db.properties || {})
            });
        }

        cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    return databases;
}

/**
 * Get database schema (properties)
 * @param {string} userId
 * @param {string} databaseId
 * @returns {Object}
 */
export async function getDatabase(userId, databaseId) {
    const client = getClient(userId);

    const db = await rateLimitedRequest(() =>
        client.databases.retrieve({ database_id: databaseId })
    );

    return {
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled',
        icon: db.icon,
        url: db.url,
        properties: db.properties,
        created_time: db.created_time,
        last_edited_time: db.last_edited_time
    };
}

/**
 * Query a database
 * @param {string} userId
 * @param {string} databaseId
 * @param {Object} options - filter, sorts, start_cursor, page_size
 * @returns {Object} { results, has_more, next_cursor }
 */
export async function queryDatabase(userId, databaseId, options = {}) {
    const client = getClient(userId);

    const response = await rateLimitedRequest(() =>
        client.databases.query({
            database_id: databaseId,
            filter: options.filter,
            sorts: options.sorts,
            start_cursor: options.start_cursor,
            page_size: options.page_size || 100
        })
    );

    return {
        results: response.results.map(page => mapNotionPageToObject(page)),
        has_more: response.has_more,
        next_cursor: response.next_cursor
    };
}

/**
 * Create a new database
 * @param {string} userId
 * @param {string} parentPageId
 * @param {Object} schema - { title, properties }
 * @returns {Object}
 */
export async function createDatabase(userId, parentPageId, schema) {
    const client = getClient(userId);

    const response = await rateLimitedRequest(() =>
        client.databases.create({
            parent: { type: 'page_id', page_id: parentPageId },
            title: [{ type: 'text', text: { content: schema.title } }],
            properties: schema.properties
        })
    );

    return {
        id: response.id,
        title: response.title?.[0]?.plain_text,
        url: response.url
    };
}

// ============================================
// PAGE OPERATIONS
// ============================================

/**
 * Get a page by ID
 * @param {string} userId
 * @param {string} pageId
 * @returns {Object}
 */
export async function getPage(userId, pageId) {
    const client = getClient(userId);

    const page = await rateLimitedRequest(() =>
        client.pages.retrieve({ page_id: pageId })
    );

    return mapNotionPageToObject(page);
}

/**
 * Create a new page in a database
 * @param {string} userId
 * @param {string} databaseId
 * @param {Object} properties
 * @returns {Object}
 */
export async function createPage(userId, databaseId, properties) {
    const client = getClient(userId);

    const response = await rateLimitedRequest(() =>
        client.pages.create({
            parent: { database_id: databaseId },
            properties: properties
        })
    );

    return mapNotionPageToObject(response);
}

/**
 * Update an existing page
 * @param {string} userId
 * @param {string} pageId
 * @param {Object} properties
 * @returns {Object}
 */
export async function updatePage(userId, pageId, properties) {
    const client = getClient(userId);

    const response = await rateLimitedRequest(() =>
        client.pages.update({
            page_id: pageId,
            properties: properties
        })
    );

    return mapNotionPageToObject(response);
}

/**
 * Archive (soft delete) a page
 * @param {string} userId
 * @param {string} pageId
 * @returns {Object}
 */
export async function archivePage(userId, pageId) {
    const client = getClient(userId);

    const response = await rateLimitedRequest(() =>
        client.pages.update({
            page_id: pageId,
            archived: true
        })
    );

    return { success: true, id: response.id };
}

// ============================================
// DATA MAPPING
// ============================================

/**
 * Map a Notion page to a simple object
 * @param {Object} page - Notion page object
 * @returns {Object}
 */
function mapNotionPageToObject(page) {
    const result = {
        id: page.id,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        archived: page.archived,
        url: page.url,
        properties: {}
    };

    for (const [key, prop] of Object.entries(page.properties || {})) {
        result.properties[key] = extractPropertyValue(prop);
    }

    return result;
}

/**
 * Extract value from a Notion property
 * @param {Object} prop
 * @returns {any}
 */
function extractPropertyValue(prop) {
    switch (prop.type) {
        case 'title':
            return prop.title?.[0]?.plain_text || '';
        case 'rich_text':
            return prop.rich_text?.map(t => t.plain_text).join('') || '';
        case 'number':
            return prop.number;
        case 'select':
            return prop.select?.name || null;
        case 'multi_select':
            return prop.multi_select?.map(s => s.name) || [];
        case 'date':
            return prop.date?.start || null;
        case 'checkbox':
            return prop.checkbox || false;
        case 'url':
            return prop.url || null;
        case 'email':
            return prop.email || null;
        case 'phone_number':
            return prop.phone_number || null;
        case 'files':
            return prop.files?.map(f => f.file?.url || f.external?.url) || [];
        case 'formula':
            return extractFormulaValue(prop.formula);
        case 'relation':
            return prop.relation?.map(r => r.id) || [];
        case 'rollup':
            return extractRollupValue(prop.rollup);
        case 'created_time':
            return prop.created_time;
        case 'last_edited_time':
            return prop.last_edited_time;
        case 'created_by':
            return prop.created_by?.id;
        case 'last_edited_by':
            return prop.last_edited_by?.id;
        case 'status':
            return prop.status?.name || null;
        default:
            return null;
    }
}

function extractFormulaValue(formula) {
    if (!formula) return null;
    switch (formula.type) {
        case 'string': return formula.string;
        case 'number': return formula.number;
        case 'boolean': return formula.boolean;
        case 'date': return formula.date?.start;
        default: return null;
    }
}

function extractRollupValue(rollup) {
    if (!rollup) return null;
    switch (rollup.type) {
        case 'number': return rollup.number;
        case 'date': return rollup.date?.start;
        case 'array': return rollup.array?.map(item => extractPropertyValue(item));
        default: return null;
    }
}

// ============================================
// VAULTLISTER <-> NOTION MAPPING
// ============================================

/**
 * Default inventory property schema for creating a Notion database
 */
export const INVENTORY_SCHEMA = {
    title: 'VaultLister Inventory',
    properties: {
        'Title': { title: {} },
        'SKU': { rich_text: {} },
        'Description': { rich_text: {} },
        'Brand': { select: { options: [] } },
        'Category': { select: { options: [] } },
        'Condition': {
            select: {
                options: [
                    { name: 'New', color: 'green' },
                    { name: 'Like New', color: 'blue' },
                    { name: 'Good', color: 'yellow' },
                    { name: 'Fair', color: 'orange' },
                    { name: 'Poor', color: 'red' }
                ]
            }
        },
        'Cost Price': { number: { format: 'dollar' } },
        'List Price': { number: { format: 'dollar' } },
        'Quantity': { number: { format: 'number' } },
        'Status': {
            select: {
                options: [
                    { name: 'active', color: 'green' },
                    { name: 'draft', color: 'gray' },
                    { name: 'sold', color: 'blue' },
                    { name: 'archived', color: 'brown' }
                ]
            }
        },
        'Tags': { multi_select: { options: [] } },
        'Location': { rich_text: {} },
        'VaultLister ID': { rich_text: {} }
    }
};

/**
 * Default sales property schema
 */
export const SALES_SCHEMA = {
    title: 'VaultLister Sales',
    properties: {
        'Item': { title: {} },
        'Sale Date': { date: {} },
        'Sale Price': { number: { format: 'dollar' } },
        'Platform': { select: { options: [] } },
        'Platform Fees': { number: { format: 'dollar' } },
        'Shipping Cost': { number: { format: 'dollar' } },
        'Net Profit': { number: { format: 'dollar' } },
        'Buyer': { rich_text: {} },
        'Status': {
            select: {
                options: [
                    { name: 'completed', color: 'green' },
                    { name: 'pending', color: 'yellow' },
                    { name: 'shipped', color: 'blue' },
                    { name: 'cancelled', color: 'red' },
                    { name: 'refunded', color: 'orange' }
                ]
            }
        },
        'VaultLister ID': { rich_text: {} }
    }
};

/**
 * Default notes property schema
 */
export const NOTES_SCHEMA = {
    title: 'VaultLister Notes',
    properties: {
        'Title': { title: {} },
        'Content': { rich_text: {} },
        'Category': { select: { options: [] } },
        'Tags': { multi_select: { options: [] } },
        'Created': { date: {} },
        'VaultLister ID': { rich_text: {} }
    }
};

/**
 * Map VaultLister inventory item to Notion properties
 * @param {Object} item - VaultLister inventory item
 * @returns {Object} Notion properties object
 */
export function mapInventoryToNotion(item) {
    const props = {
        'Title': { title: [{ text: { content: item.title || 'Untitled' } }] },
        'VaultLister ID': { rich_text: [{ text: { content: item.id } }] }
    };

    if (item.sku) {
        props['SKU'] = { rich_text: [{ text: { content: item.sku } }] };
    }
    if (item.description) {
        // Truncate to 2000 chars (Notion limit)
        const desc = item.description.substring(0, 2000);
        props['Description'] = { rich_text: [{ text: { content: desc } }] };
    }
    if (item.brand) {
        props['Brand'] = { select: { name: item.brand } };
    }
    if (item.category) {
        props['Category'] = { select: { name: item.category } };
    }
    if (item.condition) {
        props['Condition'] = { select: { name: item.condition } };
    }
    if (item.cost_price !== undefined && item.cost_price !== null) {
        props['Cost Price'] = { number: parseFloat(item.cost_price) || 0 };
    }
    if (item.list_price !== undefined && item.list_price !== null) {
        props['List Price'] = { number: parseFloat(item.list_price) || 0 };
    }
    if (item.quantity !== undefined && item.quantity !== null) {
        props['Quantity'] = { number: parseInt(item.quantity) || 0 };
    }
    if (item.status) {
        props['Status'] = { select: { name: item.status } };
    }
    if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
        props['Tags'] = { multi_select: item.tags.map(t => ({ name: t })) };
    }
    if (item.location) {
        props['Location'] = { rich_text: [{ text: { content: item.location } }] };
    }

    return props;
}

/**
 * Map Notion page to VaultLister inventory format
 * @param {Object} notionPage - Mapped Notion page object
 * @returns {Object} VaultLister inventory object
 */
export function mapNotionToInventory(notionPage) {
    const props = notionPage.properties || {};

    return {
        notion_page_id: notionPage.id,
        notion_updated_at: notionPage.last_edited_time,
        title: props['Title'] || '',
        sku: props['SKU'] || null,
        description: props['Description'] || null,
        brand: props['Brand'] || null,
        category: props['Category'] || null,
        condition: props['Condition'] || null,
        cost_price: props['Cost Price'] || null,
        list_price: props['List Price'] || null,
        quantity: props['Quantity'] || 0,
        status: props['Status'] || 'draft',
        tags: props['Tags'] || [],
        location: props['Location'] || null,
        vaultlister_id: props['VaultLister ID'] || null
    };
}

/**
 * Map VaultLister sale to Notion properties
 * @param {Object} sale
 * @returns {Object}
 */
export function mapSaleToNotion(sale) {
    const props = {
        'Item': { title: [{ text: { content: sale.item_title || 'Sale' } }] },
        'VaultLister ID': { rich_text: [{ text: { content: sale.id } }] }
    };

    if (sale.sale_date) {
        props['Sale Date'] = { date: { start: sale.sale_date.split('T')[0] } };
    }
    if (sale.sale_price !== undefined) {
        props['Sale Price'] = { number: parseFloat(sale.sale_price) || 0 };
    }
    if (sale.platform) {
        props['Platform'] = { select: { name: sale.platform } };
    }
    if ((sale.platform_fee ?? sale.platform_fees) !== undefined) {
        props['Platform Fees'] = { number: parseFloat(sale.platform_fee ?? sale.platform_fees) || 0 };
    }
    if (sale.shipping_cost !== undefined) {
        props['Shipping Cost'] = { number: parseFloat(sale.shipping_cost) || 0 };
    }
    if (sale.net_profit !== undefined) {
        props['Net Profit'] = { number: parseFloat(sale.net_profit) || 0 };
    }
    if (sale.buyer_username) {
        props['Buyer'] = { rich_text: [{ text: { content: sale.buyer_username } }] };
    }
    if (sale.status) {
        props['Status'] = { select: { name: sale.status } };
    }

    return props;
}

/**
 * Map Notion page to VaultLister sale format
 * @param {Object} notionPage
 * @returns {Object}
 */
export function mapNotionToSale(notionPage) {
    const props = notionPage.properties || {};

    return {
        notion_page_id: notionPage.id,
        notion_updated_at: notionPage.last_edited_time,
        item_title: props['Item'] || '',
        sale_date: props['Sale Date'] || null,
        sale_price: props['Sale Price'] || 0,
        platform: props['Platform'] || null,
        platform_fees: props['Platform Fees'] || 0,
        shipping_cost: props['Shipping Cost'] || 0,
        net_profit: props['Net Profit'] || 0,
        buyer_username: props['Buyer'] || null,
        status: props['Status'] || 'pending',
        vaultlister_id: props['VaultLister ID'] || null
    };
}

// ============================================
// SYNC MAP OPERATIONS
// ============================================

/**
 * Get sync map entry
 * @param {string} userId
 * @param {string} entityType
 * @param {string} localId
 * @returns {Object|null}
 */
export async function getSyncMap(userId, entityType, localId) {
    return await query.get(
        'SELECT * FROM notion_sync_map WHERE user_id = ? AND entity_type = ? AND local_id = ?',
        [userId, entityType, localId]
    );
}

/**
 * Get sync map by Notion page ID
 * @param {string} userId
 * @param {string} entityType
 * @param {string} notionPageId
 * @returns {Object|null}
 */
export async function getSyncMapByNotionId(userId, entityType, notionPageId) {
    return await query.get(
        'SELECT * FROM notion_sync_map WHERE user_id = ? AND entity_type = ? AND notion_page_id = ?',
        [userId, entityType, notionPageId]
    );
}

/**
 * Create or update sync map entry
 * @param {string} userId
 * @param {string} entityType
 * @param {string} localId
 * @param {string} notionPageId
 * @param {Object} options
 * @returns {Object}
 */
export async function upsertSyncMap(userId, entityType, localId, notionPageId, options = {}) {
    const existing = getSyncMap(userId, entityType, localId);
    const now = new Date().toISOString();

    if (existing) {
        await query.run(`
            UPDATE notion_sync_map SET
                notion_page_id = ?,
                local_updated_at = ?,
                notion_updated_at = ?,
                sync_status = ?,
                sync_error = ?,
                last_synced_at = ?,
                updated_at = ?
            WHERE id = ?
        `, [
            notionPageId,
            options.local_updated_at || existing.local_updated_at,
            options.notion_updated_at || existing.notion_updated_at,
            options.sync_status || 'synced',
            options.sync_error || null,
            now,
            now,
            existing.id
        ]);

        return getSyncMap(userId, entityType, localId);
    } else {
        const id = uuidv4();
        await query.run(`
            INSERT INTO notion_sync_map (
                id, user_id, entity_type, local_id, notion_page_id,
                local_updated_at, notion_updated_at, sync_status,
                sync_error, last_synced_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            userId,
            entityType,
            localId,
            notionPageId,
            options.local_updated_at || null,
            options.notion_updated_at || null,
            options.sync_status || 'synced',
            options.sync_error || null,
            now,
            now,
            now
        ]);

        return getSyncMap(userId, entityType, localId);
    }
}

/**
 * Update sync status
 * @param {string} syncMapId
 * @param {string} status
 * @param {string} error
 */
export async function updateSyncStatus(syncMapId, status, error = null) {
    const now = new Date().toISOString();
    await query.run(`
        UPDATE notion_sync_map SET
            sync_status = ?,
            sync_error = ?,
            last_synced_at = ?,
            updated_at = ?
        WHERE id = ?
    `, [status, error, now, now, syncMapId]);
}

/**
 * Get all items pending sync
 * @param {string} userId
 * @param {string} entityType
 * @returns {Array}
 */
export async function getPendingSyncItems(userId, entityType = null) {
    const params = [userId];
    let sql = `
        SELECT * FROM notion_sync_map
        WHERE user_id = ? AND sync_status IN ('pending_push', 'pending_pull', 'conflict')
    `;

    if (entityType) {
        sql += ' AND entity_type = ?';
        params.push(entityType);
    }

    return await query.all(sql, params);
}

// ============================================
// SYNC HISTORY
// ============================================

/**
 * Log sync operation
 * @param {string} userId
 * @param {Object} details
 * @returns {string} Sync history ID
 */
export async function logSyncHistory(userId, details) {
    const id = uuidv4();

    await query.run(`
        INSERT INTO notion_sync_history (
            id, user_id, sync_type, direction, items_processed,
            items_created, items_updated, items_deleted, items_skipped,
            conflicts_detected, errors_count, status, error_message,
            error_details, started_at, completed_at, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id,
        userId,
        details.sync_type || 'manual',
        details.direction || 'bidirectional',
        details.items_processed || 0,
        details.items_created || 0,
        details.items_updated || 0,
        details.items_deleted || 0,
        details.items_skipped || 0,
        details.conflicts_detected || 0,
        details.errors_count || 0,
        details.status || 'success',
        details.error_message || null,
        details.error_details ? JSON.stringify(details.error_details) : null,
        details.started_at || new Date().toISOString(),
        details.completed_at || new Date().toISOString(),
        details.duration_ms || 0
    ]);

    return id;
}

/**
 * Get recent sync history
 * @param {string} userId
 * @param {number} limit
 * @returns {Array}
 */
export async function getSyncHistory(userId, limit = 20) {
    return await query.all(
        'SELECT * FROM notion_sync_history WHERE user_id = ? ORDER BY started_at DESC LIMIT ?',
        [userId, limit]
    );
}

export default {
    isConfigured,
    getClient,
    getSettings,
    saveSettings,
    deleteSettings,
    testConnection,
    listDatabases,
    getDatabase,
    queryDatabase,
    createDatabase,
    getPage,
    createPage,
    updatePage,
    archivePage,
    mapInventoryToNotion,
    mapNotionToInventory,
    mapSaleToNotion,
    mapNotionToSale,
    getSyncMap,
    getSyncMapByNotionId,
    upsertSyncMap,
    updateSyncStatus,
    getPendingSyncItems,
    logSyncHistory,
    getSyncHistory,
    INVENTORY_SCHEMA,
    SALES_SCHEMA,
    NOTES_SCHEMA
};
