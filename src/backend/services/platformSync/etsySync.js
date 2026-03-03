// Etsy Platform Sync Service
// Handles syncing listings, orders, and inventory with Etsy

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';

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
        completedAt: null
    };

    try {
        const accessToken = decryptToken(shop.oauth_token);
        const oauthMode = process.env.OAUTH_MODE || 'mock';

        // Sync listings
        const listingsResult = await syncEtsyListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        // Sync orders/receipts
        const ordersResult = await syncEtsyOrders(shop, accessToken, oauthMode);
        results.orders = ordersResult;

        results.completedAt = new Date().toISOString();

        // Update shop's last sync time (handle missing columns gracefully)
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

        // Record sync error (handle missing columns gracefully)
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
                const existing = query.get(`
                    SELECT id FROM listings
                    WHERE shop_id = ? AND external_listing_id = ?
                `, [shop.id, String(etsyListing.listing_id)]);

                if (existing) {
                    // Update existing listing
                    query.run(`
                        UPDATE listings SET
                            title = ?,
                            price = ?,
                            quantity = ?,
                            status = ?,
                            external_data = ?,
                            updated_at = ?
                        WHERE id = ?
                    `, [
                        mapped.title,
                        mapped.price,
                        mapped.quantity,
                        mapped.status,
                        JSON.stringify(mapped.externalData),
                        new Date().toISOString(),
                        existing.id
                    ]);
                    result.updated++;
                } else {
                    // Create new listing
                    const listingId = uuidv4();
                    query.run(`
                        INSERT INTO listings (
                            id, user_id, shop_id, inventory_id, title, price,
                            quantity, status, external_listing_id, external_data,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        listingId,
                        shop.user_id,
                        shop.id,
                        null, // No linked inventory item yet
                        mapped.title,
                        mapped.price,
                        mapped.quantity,
                        mapped.status,
                        mapped.externalListingId,
                        JSON.stringify(mapped.externalData),
                        new Date().toISOString(),
                        new Date().toISOString()
                    ]);
                    result.created++;
                }

                result.synced++;
            } catch (error) {
                result.errors.push({
                    listingId: etsyListing.listing_id,
                    error: error.message
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
                const existing = query.get(`
                    SELECT id FROM sales
                    WHERE shop_id = ? AND external_order_id = ?
                `, [shop.id, String(etsyOrder.receipt_id)]);

                if (!existing) {
                    // Create new sale
                    const saleId = uuidv4();
                    query.run(`
                        INSERT INTO sales (
                            id, user_id, shop_id, listing_id, buyer_username,
                            sale_price, platform_fees, shipping_cost, net_profit,
                            sale_date, status, external_order_id, external_data,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        saleId,
                        shop.user_id,
                        shop.id,
                        null, // Try to link listing later
                        mapped.buyerUsername,
                        mapped.salePrice,
                        mapped.platformFees,
                        mapped.shippingCost,
                        mapped.netProfit,
                        mapped.saleDate,
                        mapped.status,
                        mapped.externalOrderId,
                        JSON.stringify(mapped.externalData),
                        new Date().toISOString(),
                        new Date().toISOString()
                    ]);
                    result.created++;
                }

                result.synced++;
            } catch (error) {
                result.errors.push({
                    orderId: etsyOrder.receipt_id,
                    error: error.message
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
    if (mode === 'mock') {
        // Return mock listings for testing
        return [
            {
                listing_id: 'etsy-' + Date.now(),
                title: 'Vintage Handmade Item',
                price: { amount: 2500, divisor: 100 },
                quantity: 1,
                state: 'active',
                url: 'https://www.etsy.com/listing/mock'
            },
            {
                listing_id: 'etsy-' + (Date.now() + 1),
                title: 'Custom Craft Piece',
                price: { amount: 4500, divisor: 100 },
                quantity: 2,
                state: 'active',
                url: 'https://www.etsy.com/listing/mock2'
            }
        ];
    }

    // Real Etsy API call
    // Extract shop_id from platform_user_id or use a separate field
    const shopId = shop.platform_user_id || 'shop_id';

    const response = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/active?limit=100`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'x-api-key': process.env.ETSY_CLIENT_ID
            }
        }
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
    if (mode === 'mock') {
        // Return mock orders for testing
        return [
            {
                receipt_id: 'etsy-ord-' + Date.now(),
                buyer_email: 'buyer@example.com',
                grandtotal: { amount: 2500, divisor: 100 },
                status: 'paid',
                create_timestamp: Math.floor(Date.now() / 1000)
            }
        ];
    }

    // Real Etsy API call
    const shopId = shop.platform_user_id || 'shop_id';

    // Get orders from last 90 days
    const minCreated = Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60);

    const response = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/receipts?min_created=${minCreated}&limit=100`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'x-api-key': process.env.ETSY_CLIENT_ID
            }
        }
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
    const price = etsyListing.price
        ? (etsyListing.price.amount / etsyListing.price.divisor)
        : 0;

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
            syncedAt: new Date().toISOString()
        }
    };
}

/**
 * Map Etsy receipt (order) to VaultLister sale schema
 */
function mapEtsyOrderToSale(etsyOrder, shop) {
    // Etsy grandtotal format: { amount: 2500, divisor: 100 } = $25.00
    const total = etsyOrder.grandtotal
        ? (etsyOrder.grandtotal.amount / etsyOrder.grandtotal.divisor)
        : 0;

    const shipping = etsyOrder.total_shipping_cost
        ? (etsyOrder.total_shipping_cost.amount / etsyOrder.total_shipping_cost.divisor)
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
            syncedAt: new Date().toISOString()
        }
    };
}

/**
 * Map Etsy listing state to VaultLister status
 */
function mapEtsyStatus(etsyState) {
    const statusMap = {
        'active': 'active',
        'inactive': 'inactive',
        'sold_out': 'out_of_stock',
        'draft': 'draft',
        'expired': 'ended',
        'removed': 'ended'
    };
    return statusMap[etsyState] || 'unknown';
}

/**
 * Map Etsy receipt status to VaultLister status
 */
function mapEtsyOrderStatus(etsyStatus) {
    const statusMap = {
        'paid': 'completed',
        'shipped': 'completed',
        'completed': 'completed',
        'processing': 'processing',
        'canceled': 'cancelled',
        'refunded': 'refunded'
    };
    return statusMap[etsyStatus] || 'pending';
}

/**
 * Create a new listing on Etsy
 * In production: POST /v3/application/shops/{shop_id}/listings
 */
export async function createEtsyListing(accessToken, listingData) {
    // In mock mode, return success immediately
    if (process.env.OAUTH_MODE === 'mock') {
        return {
            success: true,
            listing_id: 'etsy-new-' + Date.now(),
            url: 'https://www.etsy.com/listing/new-mock',
            title: listingData.title
        };
    }

    // Real Etsy API call would go here
    const shopId = listingData.shopId || 'shop_id';

    const response = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': process.env.ETSY_CLIENT_ID
            },
            body: JSON.stringify({
                quantity: listingData.quantity || 1,
                title: listingData.title,
                description: listingData.description,
                price: listingData.price,
                who_made: listingData.who_made || 'i_did',
                when_made: listingData.when_made || '2020_2023',
                taxonomy_id: listingData.taxonomy_id
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Etsy API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
        success: true,
        listing_id: data.listing_id,
        url: data.url,
        title: data.title
    };
}

/**
 * Update an existing listing on Etsy
 * In production: PUT /v3/application/shops/{shop_id}/listings/{listing_id}
 */
export async function updateEtsyListing(accessToken, listingId, updates) {
    // In mock mode, return success immediately
    if (process.env.OAUTH_MODE === 'mock') {
        return { success: true, listing_id: listingId };
    }

    // Real Etsy API call would go here
    const shopId = updates.shopId || 'shop_id';

    const response = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': process.env.ETSY_CLIENT_ID
            },
            body: JSON.stringify(updates)
        }
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
    // In mock mode, return success immediately
    if (process.env.OAUTH_MODE === 'mock') {
        return { success: true };
    }

    // Real Etsy API call would go here
    const shopId = 'shop_id'; // Would need to be passed in or retrieved

    const response = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'x-api-key': process.env.ETSY_CLIENT_ID
            }
        }
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
    deleteEtsyListing
};
