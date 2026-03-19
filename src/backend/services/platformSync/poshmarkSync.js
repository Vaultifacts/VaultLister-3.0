// Poshmark Platform Sync Service
// Syncs listings and orders from Poshmark API to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';
import { logger } from '../../shared/logger.js';

/**
 * Sync all data from Poshmark for a shop
 * @param {Object} shop - Shop record with OAuth tokens
 * @returns {Object} Sync results
 */
export async function syncPoshmarkShop(shop) {
    const results = {
        listings: { synced: 0, created: 0, updated: 0, errors: [] },
        orders: { synced: 0, created: 0, errors: [] },
        startedAt: new Date().toISOString(),
        completedAt: null
    };

    try {
        const accessToken = decryptToken(shop.oauth_token);
        const oauthMode = process.env.OAUTH_MODE || 'mock';

        if (oauthMode === 'mock') {
            logger.warn('[PlatformSync] Poshmark sync in mock mode — returning empty data');
            results.message = 'Poshmark sync requires connected account with valid credentials. Use Automations to sync via browser automation.';
            results.completedAt = new Date().toISOString();
            return results;
        }

        // Sync listings
        const listingsResult = await syncPoshmarkListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        // Sync orders/sales
        const ordersResult = await syncPoshmarkOrders(shop, accessToken, oauthMode);
        results.orders = ordersResult;

        results.completedAt = new Date().toISOString();

        // Update shop's last sync time
        try {
            query.run(`
                UPDATE shops SET
                    last_sync_at = ?,
                    sync_error = NULL,
                    updated_at = ?
                WHERE id = ?
            `, [results.completedAt, results.completedAt, shop.id]);
        } catch (err) {
            if (err.message.includes('no such column')) {
                query.run(`UPDATE shops SET updated_at = ? WHERE id = ?`,
                    [results.completedAt, shop.id]);
            }
        }

        return results;

    } catch (error) {
        results.error = error.message;
        results.completedAt = new Date().toISOString();

        try {
            query.run(`
                UPDATE shops SET
                    sync_error = ?,
                    updated_at = ?
                WHERE id = ?
            `, [error.message, new Date().toISOString(), shop.id]);
        } catch (err) {
            if (err.message.includes('no such column')) {
                query.run(`UPDATE shops SET updated_at = ? WHERE id = ?`,
                    [new Date().toISOString(), shop.id]);
            }
        }

        throw error;
    }
}

/**
 * Sync listings from Poshmark
 */
async function syncPoshmarkListings(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, updated: 0, errors: [] };

    try {
        const listings = await fetchPoshmarkListings(accessToken, mode);

        for (const poshListing of listings) {
            try {
                const mapped = mapPoshmarkListingToVaultLister(poshListing, shop);

                const existing = query.get(`
                    SELECT id FROM listings
                    WHERE user_id = ? AND platform = 'poshmark' AND platform_listing_id = ?
                `, [shop.user_id, poshListing.id]);

                if (existing) {
                    query.run(`
                        UPDATE listings SET
                            title = ?,
                            price = ?,
                            status = ?,
                            platform_specific_data = ?,
                            updated_at = ?
                        WHERE id = ?
                    `, [
                        mapped.title,
                        mapped.price,
                        mapped.status,
                        JSON.stringify(mapped.externalData),
                        new Date().toISOString(),
                        existing.id
                    ]);
                    result.updated++;
                } else {
                    const listingId = uuidv4();
                    query.run(`
                        INSERT INTO listings (
                            id, user_id, inventory_id, platform, title, price,
                            status, platform_listing_id, platform_specific_data,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, 'poshmark', ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        listingId, shop.user_id, null,
                        mapped.title, mapped.price, mapped.status,
                        mapped.externalListingId, JSON.stringify(mapped.externalData),
                        new Date().toISOString(), new Date().toISOString()
                    ]);
                    result.created++;
                }

                result.synced++;
            } catch (error) {
                result.errors.push({ listingId: poshListing.id, error: error.message });
            }
        }

        return result;

    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

/**
 * Sync orders from Poshmark
 */
async function syncPoshmarkOrders(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, errors: [] };

    try {
        const orders = await fetchPoshmarkOrders(accessToken, mode);

        for (const poshOrder of orders) {
            try {
                const mapped = mapPoshmarkOrderToSale(poshOrder, shop);

                const existing = query.get(`
                    SELECT id FROM sales
                    WHERE user_id = ? AND platform_order_id = ? AND platform = 'poshmark'
                `, [shop.user_id, poshOrder.id]);

                if (!existing) {
                    const saleId = uuidv4();
                    query.run(`
                        INSERT INTO sales (
                            id, user_id, listing_id, platform, platform_order_id, buyer_username,
                            sale_price, platform_fee, shipping_cost, net_profit,
                            status, notes,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, 'poshmark', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        saleId, shop.user_id, null,
                        mapped.externalOrderId,
                        mapped.buyerUsername, mapped.salePrice, mapped.platformFees,
                        mapped.shippingCost, mapped.netProfit,
                        mapped.status,
                        mapped.externalData ? JSON.stringify(mapped.externalData) : null,
                        new Date().toISOString(), new Date().toISOString()
                    ]);
                    result.created++;
                }

                result.synced++;
            } catch (error) {
                result.errors.push({ orderId: poshOrder.id, error: error.message });
            }
        }

        return result;

    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

/**
 * Fetch listings from Poshmark API (mock)
 */
async function fetchPoshmarkListings(accessToken, mode) {
    // Poshmark does not provide a public API. Live sync requires Playwright scraping
    // (available via the Automations tab).
    return [];
}

/**
 * Fetch orders from Poshmark API (mock)
 */
async function fetchPoshmarkOrders(accessToken, mode) {
    // Poshmark does not provide a public API. Return empty so sync completes gracefully.
    return [];
}

/**
 * Map Poshmark listing to VaultLister schema
 */
function mapPoshmarkListingToVaultLister(poshListing, shop) {
    return {
        title: poshListing.title,
        price: poshListing.price,
        quantity: poshListing.status === 'sold' ? 0 : 1,
        status: mapPoshmarkStatus(poshListing.status),
        externalListingId: poshListing.id,
        externalData: {
            platform: 'poshmark',
            id: poshListing.id,
            originalPrice: poshListing.originalPrice,
            size: poshListing.size,
            brand: poshListing.brand,
            category: poshListing.category,
            shares: poshListing.shares,
            likes: poshListing.likes,
            syncedAt: new Date().toISOString()
        }
    };
}

/**
 * Map Poshmark order to VaultLister sale schema
 * Poshmark fees: 20% for sales > $15, flat $2.95 for sales <= $15
 */
function mapPoshmarkOrderToSale(poshOrder, shop) {
    const price = poshOrder.price;
    const platformFee = price > 15 ? price * 0.20 : 2.95;
    const shippingCost = poshOrder.shippingCost || 7.97;

    return {
        buyerUsername: poshOrder.buyerUsername,
        salePrice: price,
        platformFees: platformFee,
        shippingCost: shippingCost,
        netProfit: price - platformFee - shippingCost,
        saleDate: poshOrder.createdAt,
        status: mapPoshmarkOrderStatus(poshOrder.status),
        externalOrderId: poshOrder.id,
        externalData: {
            platform: 'poshmark',
            orderId: poshOrder.id,
            listingId: poshOrder.listingId,
            syncedAt: new Date().toISOString()
        }
    };
}

function mapPoshmarkStatus(status) {
    const statusMap = {
        'available': 'active',
        'reserved': 'pending',
        'sold': 'sold',
        'not_for_sale': 'ended'
    };
    return statusMap[status] || 'draft';
}

function mapPoshmarkOrderStatus(status) {
    const statusMap = {
        'pending': 'pending',
        'shipped': 'shipped',
        'delivered': 'delivered',
        'cancelled': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

export default { syncPoshmarkShop };
