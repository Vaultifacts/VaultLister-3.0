// Platform Sync Service Router
// Routes sync requests to platform-specific handlers

import { syncEbayShop } from './ebaySync.js';
import { syncPoshmarkShop } from './poshmarkSync.js';
import { syncMercariShop } from './mercariSync.js';
import { syncDepopShop } from './depopSync.js';
import { syncGrailedShop } from './grailedSync.js';
import { syncEtsyShop } from './etsySync.js';
import { syncFacebookShop } from './facebookSync.js';
import { syncWhatnotShop } from './whatnotSync.js';
import { syncShopifyShop } from './shopifySync.js';
import { query } from '../../db/database.js';

/**
 * Sync a shop with its platform
 * @param {string} shopId - Shop ID to sync
 * @param {string} userId - User ID for validation
 * @returns {Object} Sync results
 */
export async function syncShop(shopId, userId) {
    // Get shop details
    const shop = await query.get(
        `
        SELECT * FROM shops
        WHERE id = ? AND user_id = ? AND connection_type = 'oauth' AND is_connected = TRUE
    `,
        [shopId, userId],
    );

    if (!shop) {
        const err = new Error('Shop not found, not connected via OAuth, or not currently connected');
        err.code = 'SHOP_NOT_FOUND';
        throw err;
    }

    if (!shop.oauth_token) {
        const err = new Error('No OAuth token available for this shop');
        err.code = 'NO_TOKEN';
        throw err;
    }

    // Route to platform-specific sync handler
    const syncHandler = getSyncHandler(shop.platform);

    if (!syncHandler) {
        const err = new Error(`Sync not implemented for platform: ${shop.platform}`);
        err.code = 'UNSUPPORTED_PLATFORM';
        throw err;
    }

    try {
        return await syncHandler(shop);
    } catch (err) {
        // Update shop sync_error so the UI can surface it
        try {
            await query.run(`UPDATE shops SET sync_error = ?, updated_at = ? WHERE id = ?`, [
                err.message,
                new Date().toISOString(),
                shop.id,
            ]);
        } catch (_) {
            /* sync_error column may not exist */
        }
        throw err;
    }
}

/**
 * Get the sync handler for a platform
 * @param {string} platform - Platform name
 * @returns {Function|null} Sync handler function
 */
function getSyncHandler(platform) {
    const handlers = {
        ebay: syncEbayShop,
        poshmark: syncPoshmarkShop,
        mercari: syncMercariShop,
        depop: syncDepopShop,
        grailed: syncGrailedShop,
        etsy: syncEtsyShop,
        facebook: syncFacebookShop,
        whatnot: syncWhatnotShop,
        shopify: syncShopifyShop,
    };

    return handlers[platform.toLowerCase()] || null;
}

/**
 * Check if sync is supported for a platform
 * @param {string} platform - Platform name
 * @returns {boolean} Whether sync is supported
 */
export function isSyncSupported(platform) {
    const supportedPlatforms = [
        'ebay',
        'poshmark',
        'mercari',
        'depop',
        'grailed',
        'etsy',
        'facebook',
        'whatnot',
        'shopify',
    ];
    return supportedPlatforms.includes(platform.toLowerCase());
}

/**
 * Get sync status for a shop
 * @param {string} shopId - Shop ID
 * @param {string} userId - User ID for validation
 * @returns {Object} Sync status
 */
export async function getSyncStatus(shopId, userId) {
    const shop = await query.get(
        `
        SELECT
            id, platform, last_sync_at, sync_error,
            is_connected, connection_type
        FROM shops
        WHERE id = ? AND user_id = ?
    `,
        [shopId, userId],
    );

    if (!shop) {
        throw new Error('Shop not found');
    }

    // Check for pending sync tasks
    const pendingTask = await query.get(
        `
        SELECT id, status, created_at, started_at
        FROM task_queue
        WHERE type = 'sync_shop'
        AND JSON_EXTRACT(payload, '$.shopId') = ?
        AND status IN ('pending', 'processing')
    `,
        [shopId],
    );

    return {
        shopId: shop.id,
        platform: shop.platform,
        lastSyncAt: shop.last_sync_at,
        syncError: shop.sync_error,
        isConnected: Boolean(shop.is_connected),
        isSyncSupported: isSyncSupported(shop.platform),
        hasPendingSync: Boolean(pendingTask),
        pendingTask: pendingTask
            ? {
                  id: pendingTask.id,
                  status: pendingTask.status,
                  createdAt: pendingTask.created_at,
                  startedAt: pendingTask.started_at,
              }
            : null,
    };
}

/**
 * Get supported platforms with their sync capabilities
 * @returns {Array} Platform capabilities
 */
export function getSupportedPlatforms() {
    return [
        {
            platform: 'ebay',
            syncSupported: true,
            capabilities: ['listings', 'orders'],
            oauthSupported: true,
        },
        {
            platform: 'poshmark',
            syncSupported: true,
            capabilities: ['listings', 'orders'],
            oauthSupported: true,
        },
        {
            platform: 'depop',
            syncSupported: true,
            capabilities: ['listings', 'orders'],
            oauthSupported: true,
        },
        {
            platform: 'grailed',
            syncSupported: true,
            capabilities: ['listings', 'orders'],
            oauthSupported: true,
        },
        {
            platform: 'facebook',
            syncSupported: true,
            capabilities: ['listings', 'orders'],
            oauthSupported: false, // Facebook OAuth removed — listing via Chrome extension/Playwright only
        },
        {
            platform: 'whatnot',
            syncSupported: true,
            capabilities: ['listings', 'orders'],
            oauthSupported: true,
        },
        {
            platform: 'shopify',
            syncSupported: true,
            capabilities: ['listings', 'orders'],
            oauthSupported: true,
        },
    ];
}

export default {
    syncShop,
    isSyncSupported,
    getSyncStatus,
    getSupportedPlatforms,
};
