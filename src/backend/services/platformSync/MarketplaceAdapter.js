/**
 * MarketplaceAdapter — JSDoc interface contract for all platform publish/sync modules.
 *
 * Every platformSync/*Publish.js and *Sync.js module should conform to this shape.
 * JavaScript has no enforced interfaces; this file is the canonical documentation.
 *
 * @typedef {Object} Shop
 * @property {string} id
 * @property {string} user_id
 * @property {string} platform
 * @property {string} oauth_token  - AES-256-GCM encrypted
 * @property {string} [oauth_refresh_token]
 * @property {string} [shop_name]
 *
 * @typedef {Object} Listing
 * @property {string} id
 * @property {string} inventory_id
 * @property {string} platform
 * @property {string} title
 * @property {string} [description]
 * @property {number} price
 * @property {string} [status]  - 'pending' | 'active' | 'error' | 'sold'
 * @property {string} [external_id]
 *
 * @typedef {Object} InventoryItem
 * @property {string} id
 * @property {string} [sku]
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [condition]  - 'new' | 'like_new' | 'good' | 'fair' | 'poor' | 'parts_only'
 * @property {string} [category]
 * @property {string[]} [images]
 *
 * @typedef {Object} PublishResult
 * @property {boolean} success
 * @property {string} [externalId]  - platform-assigned listing ID on success
 * @property {string} [error]       - human-readable error message on failure
 *
 * @typedef {Object} SyncResult
 * @property {boolean} success
 * @property {number} [synced]   - count of listings synced
 * @property {string} [error]
 */

/**
 * Publish a VaultLister listing to a marketplace.
 *
 * @param {Shop} shop - authenticated shop record (oauth_token is encrypted)
 * @param {Listing} listing - listing row to publish
 * @param {InventoryItem} inventory - parent inventory item
 * @returns {Promise<PublishResult>}
 */
export async function publishListing(shop, listing, inventory) { // eslint-disable-line no-unused-vars
    throw new Error('publishListing() not implemented');
}

/**
 * Sync all active listings for a shop back from the marketplace into VaultLister.
 *
 * @param {Shop} shop
 * @returns {Promise<SyncResult>}
 */
export async function syncShop(shop) { // eslint-disable-line no-unused-vars
    throw new Error('syncShop() not implemented');
}

/**
 * Health-check the platform connection (verify credentials are still valid).
 *
 * @param {Shop} shop
 * @returns {Promise<{ healthy: boolean, error?: string }>}
 */
export async function healthCheck(shop) { // eslint-disable-line no-unused-vars
    throw new Error('healthCheck() not implemented');
}
