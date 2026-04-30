// Etsy Platform Sync Service
// Handles syncing listings, orders, and inventory with Etsy

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';
import { fetchWithTimeout } from '../../shared/fetchWithTimeout.js';
import { logger } from '../../shared/logger.js';
import { trackApiLatency } from './signalEmitter.js';

async function _fetchWithLatency(url, opts) {
    const t0 = Date.now();
    const resp = await fetchWithTimeout(url, opts);
    trackApiLatency('etsy', Date.now() - t0);
    return resp;
}

/**
 * Sync all data from Etsy for a shop
 * @param {Object} shop - Shop record with OAuth tokens
 * @returns {Object} Sync results
 */
export async function syncEtsyShop(shop) {
    const results = {
        listings: { synced: 0, created: 0, updated: 0, errors: [] },
        orders: { synced: 0, created: 0, errors: [] },
        startedAt: new Date().toISOString(),
        completedAt: null,
    };

    try {
        const accessToken = decryptToken(shop.oauth_token);
        const oauthMode = process.env.OAUTH_MODE || 'mock';

        if (oauthMode === 'mock') {
            logger.warn('[PlatformSync] Etsy sync in mock mode — returning empty data');
            results.message =
                'Etsy sync requires connected account with valid credentials. Use Automations to sync via browser automation.';
            results.completedAt = new Date().toISOString();
            return results;
        }

        // Sync listings
        const listingsResult = await syncEtsyListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        // Sync orders/receipts
        const ordersResult = await syncEtsyOrders(shop, accessToken, oauthMode);
        results.orders = ordersResult;

        results.completedAt = new Date().toISOString();

        // Update shop's last sync time (handle missing columns gracefully)
        try {
            await query.run(
                `
                UPDATE shops SET
                    last_sync_at = ?,
                    sync_error = NULL,
                    updated_at = ?
                WHERE id = ?
            `,
                [results.completedAt, results.completedAt, shop.id],
            );
        } catch (err) {
            if (err.message.includes('no such column')) {
                await query.run(`UPDATE shops SET updated_at = ? WHERE id = ?`, [results.completedAt, shop.id]);
            }
        }

        return results;
    } catch (error) {
        results.error = error.message;
        results.completedAt = new Date().toISOString();

        // Record sync error (handle missing columns gracefully)
        try {
            await query.run(
                `
                UPDATE shops SET
                    sync_error = ?,
                    updated_at = ?
                WHERE id = ?
            `,
                [error.message, new Date().toISOString(), shop.id],
            );
        } catch (err) {
            if (err.message.includes('no such column')) {
                await query.run(`UPDATE shops SET updated_at = ? WHERE id = ?`, [new Date().toISOString(), shop.id]);
            }
        }

        throw error;
    }
}

/**
 * Sync listings from Etsy API
 */
async function syncEtsyListings(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, updated: 0, errors: [] };

    try {
        const listings = await fetchEtsyListings(accessToken, mode, shop);

        for (const etsyListing of listings) {
            try {
                const mapped = mapEtsyListingToVaultLister(etsyListing, shop);

                // Check if listing already exists
                const existing = await query.get(
                    `
                    SELECT id FROM listings
                    WHERE user_id = ? AND platform = 'etsy' AND platform_listing_id = ?
                `,
                    [shop.user_id, String(etsyListing.listing_id)],
                );

                if (existing) {
                    // Update existing listing
                    await query.run(
                        `
                        UPDATE listings SET
                            title = ?,
                            price = ?,
                            status = ?,
                            platform_specific_data = ?,
                            updated_at = ?
                        WHERE id = ?
                    `,
                        [
                            mapped.title,
                            mapped.price,
                            mapped.status,
                            JSON.stringify(mapped.externalData),
                            new Date().toISOString(),
                            existing.id,
                        ],
                    );
                    result.updated++;
                } else {
                    // Create new listing
                    const listingId = uuidv4();
                    await query.run(
                        `
                        INSERT INTO listings (
                            id, user_id, inventory_id, platform, title, price,
                            status, platform_listing_id, platform_specific_data,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, 'etsy', ?, ?, ?, ?, ?, ?, ?)
                    `,
                        [
                            listingId,
                            shop.user_id,
                            null, // No linked inventory item yet
                            mapped.title,
                            mapped.price,
                            mapped.status,
                            mapped.externalListingId,
                            JSON.stringify(mapped.externalData),
                            new Date().toISOString(),
                            new Date().toISOString(),
                        ],
                    );
                    result.created++;
                }

                result.synced++;
            } catch (error) {
                result.errors.push({
                    listingId: etsyListing.listing_id,
                    error: error.message,
                });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

/**
 * Sync orders from Etsy Receipts API
 */
async function syncEtsyOrders(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, errors: [] };

    try {
        const orders = await fetchEtsyOrders(accessToken, mode, shop);

        for (const etsyOrder of orders) {
            try {
                const mapped = mapEtsyOrderToSale(etsyOrder, shop);

                // Check if sale already exists
                const existing = await query.get(
                    `
                    SELECT id FROM sales
                    WHERE user_id = ? AND platform_order_id = ? AND platform = 'etsy'
                `,
                    [shop.user_id, String(etsyOrder.receipt_id)],
                );

                if (!existing) {
                    // Create new sale
                    const saleId = uuidv4();
                    await query.run(
                        `
                        INSERT INTO sales (
                            id, user_id, listing_id, platform, platform_order_id, buyer_username,
                            sale_price, platform_fee, shipping_cost, net_profit,
                            status, notes,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, 'etsy', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                        [
                            saleId,
                            shop.user_id,
                            null, // Try to link listing later
                            mapped.externalOrderId,
                            mapped.buyerUsername,
                            mapped.salePrice,
                            mapped.platformFees,
                            mapped.shippingCost,
                            mapped.netProfit,
                            mapped.status,
                            mapped.externalData ? JSON.stringify(mapped.externalData) : null,
                            new Date().toISOString(),
                            new Date().toISOString(),
                        ],
                    );
                    result.created++;
                }

                result.synced++;
            } catch (error) {
                result.errors.push({
                    orderId: etsyOrder.receipt_id,
                    error: error.message,
                });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

/**
 * Fetch listings from Etsy API
 * In production: GET /v3/application/shops/{shop_id}/listings
 */
async function fetchEtsyListings(accessToken, mode, shop) {
    // Real Etsy API call
    // Extract shop_id from platform_user_id or use a separate field
    const shopId = shop.platform_user_id || 'shop_id';

    const response = await _fetchWithLatency(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/active?limit=100`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                'x-api-key': process.env.ETSY_CLIENT_ID,
            },
        },
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Etsy API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.results || [];
}

/**
 * Fetch orders from Etsy API
 * In production: GET /v3/application/shops/{shop_id}/receipts
 */
async function fetchEtsyOrders(accessToken, mode, shop) {
    // Real Etsy API call
    const shopId = shop.platform_user_id || 'shop_id';

    // Get orders from last 90 days
    const minCreated = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;

    const response = await _fetchWithLatency(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/receipts?min_created=${minCreated}&limit=100`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                'x-api-key': process.env.ETSY_CLIENT_ID,
            },
        },
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Etsy API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.results || [];
}

/**
 * Map Etsy listing to VaultLister schema
 */
function mapEtsyListingToVaultLister(etsyListing, shop) {
    // Etsy price format: { amount: 2500, divisor: 100 } = $25.00
    const price = etsyListing.price ? etsyListing.price.amount / etsyListing.price.divisor : 0;

    return {
        title: etsyListing.title || 'Untitled',
        price: price,
        quantity: etsyListing.quantity || 1,
        status: mapEtsyStatus(etsyListing.state),
        externalListingId: String(etsyListing.listing_id),
        externalData: {
            platform: 'etsy',
            listing_id: etsyListing.listing_id,
            url: etsyListing.url,
            state: etsyListing.state,
            views: etsyListing.views,
            num_favorers: etsyListing.num_favorers,
            tags: etsyListing.tags || [],
            images: etsyListing.images || [],
            syncedAt: new Date().toISOString(),
        },
    };
}

/**
 * Map Etsy receipt (order) to VaultLister sale schema
 */
function mapEtsyOrderToSale(etsyOrder, shop) {
    // Etsy grandtotal format: { amount: 2500, divisor: 100 } = $25.00
    const total = etsyOrder.grandtotal ? etsyOrder.grandtotal.amount / etsyOrder.grandtotal.divisor : 0;

    const shipping = etsyOrder.total_shipping_cost
        ? etsyOrder.total_shipping_cost.amount / etsyOrder.total_shipping_cost.divisor
        : 0;

    // Etsy transaction fee is 6.5% + processing fee 3% + $0.25 (approximate)
    const estimatedFees = total * 0.095 + 0.25;

    return {
        buyerUsername: etsyOrder.buyer_email || 'Unknown',
        salePrice: total,
        platformFees: estimatedFees,
        shippingCost: shipping,
        netProfit: total - estimatedFees - shipping,
        saleDate: etsyOrder.create_timestamp
            ? new Date(etsyOrder.create_timestamp * 1000).toISOString()
            : new Date().toISOString(),
        status: mapEtsyOrderStatus(etsyOrder.status),
        externalOrderId: String(etsyOrder.receipt_id),
        externalData: {
            platform: 'etsy',
            receipt_id: etsyOrder.receipt_id,
            buyer_email: etsyOrder.buyer_email,
            status: etsyOrder.status,
            transactions: etsyOrder.transactions || [],
            syncedAt: new Date().toISOString(),
        },
    };
}

/**
 * Map Etsy listing state to VaultLister status
 */
function mapEtsyStatus(etsyState) {
    const statusMap = {
        active: 'active',
        inactive: 'ended',
        sold_out: 'ended',
        draft: 'draft',
        expired: 'ended',
        removed: 'ended',
    };
    return statusMap[etsyState] || 'draft';
}

/**
 * Map Etsy receipt status to VaultLister status
 */
function mapEtsyOrderStatus(etsyStatus) {
    const statusMap = {
        paid: 'confirmed',
        shipped: 'shipped',
        completed: 'delivered',
        processing: 'pending',
        canceled: 'cancelled',
        refunded: 'returned',
    };
    return statusMap[etsyStatus] || 'pending';
}

/**
 * Create a new listing on Etsy
 * In production: POST /v3/application/shops/{shop_id}/listings
 */
export async function createEtsyListing(accessToken, listingData) {
    if (process.env.OAUTH_MODE === 'mock') {
        logger.warn('[PlatformSync] createEtsyListing called in mock mode — no-op');
        return {
            success: false,
            message:
                'Etsy sync requires connected account with valid credentials. Use Automations to sync via browser automation.',
        };
    }

    // Real Etsy API call
    const shopId = listingData.shopId || 'shop_id';

    const response = await _fetchWithLatency(`https://openapi.etsy.com/v3/application/shops/${shopId}/listings`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-api-key': process.env.ETSY_CLIENT_ID,
        },
        body: JSON.stringify({
            quantity: listingData.quantity || 1,
            title: listingData.title,
            description: listingData.description,
            price: listingData.price,
            who_made: listingData.who_made || 'i_did',
            when_made: listingData.when_made || '2020_2023',
            taxonomy_id: listingData.taxonomy_id,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Etsy API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
        success: true,
        listing_id: data.listing_id,
        url: data.url,
        title: data.title,
    };
}

/**
 * Update an existing listing on Etsy
 * In production: PUT /v3/application/shops/{shop_id}/listings/{listing_id}
 */
export async function updateEtsyListing(accessToken, listingId, updates) {
    if (process.env.OAUTH_MODE === 'mock') {
        logger.warn('[PlatformSync] updateEtsyListing called in mock mode — no-op');
        return {
            success: false,
            message:
                'Etsy sync requires connected account with valid credentials. Use Automations to sync via browser automation.',
        };
    }

    // Real Etsy API call
    const shopId = updates.shopId || 'shop_id';

    const response = await _fetchWithLatency(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': process.env.ETSY_CLIENT_ID,
            },
            body: JSON.stringify(updates),
        },
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Etsy API error: ${response.status} - ${errorText}`);
    }

    return { success: true, listing_id: listingId };
}

/**
 * Delete a listing on Etsy
 * In production: DELETE /v3/application/shops/{shop_id}/listings/{listing_id}
 */
export async function deleteEtsyListing(accessToken, listingId) {
    if (process.env.OAUTH_MODE === 'mock') {
        logger.warn('[PlatformSync] deleteEtsyListing called in mock mode — no-op');
        return {
            success: false,
            message:
                'Etsy sync requires connected account with valid credentials. Use Automations to sync via browser automation.',
        };
    }

    // Real Etsy API call
    const shopId = 'shop_id'; // Would need to be passed in or retrieved

    const response = await _fetchWithLatency(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`,
        {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                'x-api-key': process.env.ETSY_CLIENT_ID,
            },
        },
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Etsy API error: ${response.status} - ${errorText}`);
    }

    return { success: true };
}

export default {
    syncEtsyShop,
    syncEtsyListings,
    syncEtsyOrders,
    createEtsyListing,
    updateEtsyListing,
    deleteEtsyListing,
};
