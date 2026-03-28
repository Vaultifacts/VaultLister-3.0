// eBay Platform Sync Service
// Syncs listings and orders from eBay API to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';
import { getOAuthConfig } from '../tokenRefreshScheduler.js';
import { fetchWithTimeout } from '../../shared/fetchWithTimeout.js';
import { logger } from '../../shared/logger.js';

/**
 * Sync all data from eBay for a shop
 * @param {Object} shop - Shop record with OAuth tokens
 * @returns {Object} Sync results
 */
export async function syncEbayShop(shop) {
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
        const listingsResult = await syncEbayListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        // Sync orders/sales
        const ordersResult = await syncEbayOrders(shop, accessToken, oauthMode);
        results.orders = ordersResult;

        results.completedAt = new Date().toISOString();

        // Update shop's last sync time (handle missing columns gracefully)
        try {
            await query.run(`
                UPDATE shops SET
                    last_sync_at = ?,
                    sync_error = NULL,
                    updated_at = ?
                WHERE id = ?
            `, [results.completedAt, results.completedAt, shop.id]);
        } catch (err) {
            if (err.message.includes('no such column')) {
                await query.run(`UPDATE shops SET updated_at = ? WHERE id = ?`,
                    [results.completedAt, shop.id]);
            }
        }

        return results;

    } catch (error) {
        results.error = error.message;
        results.completedAt = new Date().toISOString();

        // Record sync error (handle missing columns gracefully)
        try {
            await query.run(`
                UPDATE shops SET
                    sync_error = ?,
                    updated_at = ?
                WHERE id = ?
            `, [error.message, new Date().toISOString(), shop.id]);
        } catch (err) {
            if (err.message.includes('no such column')) {
                await query.run(`UPDATE shops SET updated_at = ? WHERE id = ?`,
                    [new Date().toISOString(), shop.id]);
            }
        }

        throw error;
    }
}

/**
 * Sync listings from eBay Inventory API
 */
async function syncEbayListings(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, updated: 0, errors: [] };

    try {
        const listings = await fetchEbayListings(accessToken, mode);

        for (const ebayListing of listings) {
            try {
                const mapped = mapEbayListingToVaultLister(ebayListing, shop);

                // Check if listing already exists
                const existing = await query.get(`
                    SELECT id FROM listings
                    WHERE user_id = ? AND platform = 'ebay' AND platform_listing_id = ?
                `, [shop.user_id, ebayListing.sku || ebayListing.listingId]);

                if (existing) {
                    // Update existing listing
                    await query.run(`
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
                    // Create new listing
                    const listingId = uuidv4();
                    await query.run(`
                        INSERT INTO listings (
                            id, user_id, inventory_id, platform, title, price,
                            status, platform_listing_id, platform_specific_data,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, 'ebay', ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        listingId,
                        shop.user_id,
                        null, // No linked inventory item yet
                        mapped.title,
                        mapped.price,
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
                    listingId: ebayListing.sku || ebayListing.listingId,
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
 * Sync orders from eBay Fulfillment API
 */
async function syncEbayOrders(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, errors: [] };

    try {
        const orders = await fetchEbayOrders(accessToken, mode);

        for (const ebayOrder of orders) {
            try {
                const mapped = mapEbayOrderToSale(ebayOrder, shop);

                // Check if sale already exists
                const existing = await query.get(`
                    SELECT id FROM sales
                    WHERE user_id = ? AND platform_order_id = ? AND platform = 'ebay'
                `, [shop.user_id, ebayOrder.orderId]);

                if (!existing) {
                    // Create new sale
                    const saleId = uuidv4();
                    await query.run(`
                        INSERT INTO sales (
                            id, user_id, listing_id, platform, platform_order_id, buyer_username,
                            sale_price, platform_fee, shipping_cost, net_profit,
                            status, notes,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, 'ebay', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
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
                        new Date().toISOString()
                    ]);
                    result.created++;
                }

                result.synced++;
            } catch (error) {
                result.errors.push({
                    orderId: ebayOrder.orderId,
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
 * Fetch listings from eBay API
 */
async function fetchEbayListings(accessToken, mode) {
    if (mode === 'mock') {
        logger.warn('[eBaySync] Sync in mock mode — returning empty data');
        return [];
    }

    // Real eBay API call
    const ebayEnvironment = process.env.EBAY_ENVIRONMENT || 'production';
    const apiBase = ebayEnvironment === 'production'
        ? 'https://api.ebay.com'
        : 'https://api.sandbox.ebay.com';

    const response = await fetchWithTimeout(`${apiBase}/sell/inventory/v1/inventory_item?limit=100`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`eBay API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.inventoryItems || [];
}

/**
 * Fetch orders from eBay API
 */
async function fetchEbayOrders(accessToken, mode) {
    if (mode === 'mock') {
        logger.warn('[eBaySync] Orders sync in mock mode — returning empty data');
        return [];
    }

    // Real eBay API call
    const ebayEnvironment = process.env.EBAY_ENVIRONMENT || 'production';
    const apiBase = ebayEnvironment === 'production'
        ? 'https://api.ebay.com'
        : 'https://api.sandbox.ebay.com';

    // Get orders from last 90 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const response = await fetchWithTimeout(
        `${apiBase}/sell/fulfillment/v1/order?filter=creationdate:[${startDate.toISOString()}]&limit=50`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`eBay API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.orders || [];
}

/**
 * Map eBay listing to VaultLister schema
 */
function mapEbayListingToVaultLister(ebayListing, shop) {
    return {
        title: ebayListing.title || ebayListing.product?.title || 'Untitled',
        price: parseFloat(ebayListing.price?.value || ebayListing.offers?.[0]?.price?.value || 0),
        quantity: ebayListing.availability?.shipToLocationAvailability?.quantity ||
                  ebayListing.quantity || 1,
        status: mapEbayStatus(ebayListing.status || ebayListing.availability?.status),
        externalListingId: ebayListing.sku || ebayListing.listingId,
        externalData: {
            platform: 'ebay',
            sku: ebayListing.sku,
            listingId: ebayListing.listingId,
            condition: ebayListing.condition,
            category: ebayListing.product?.category,
            images: ebayListing.product?.imageUrls || [],
            syncedAt: new Date().toISOString()
        }
    };
}

/**
 * Map eBay order to VaultLister sale schema
 */
function mapEbayOrderToSale(ebayOrder, shop) {
    const total = parseFloat(ebayOrder.pricingSummary?.total?.value || 0);
    const shipping = parseFloat(ebayOrder.pricingSummary?.deliveryCost?.value || 0);

    // Estimate eBay fees (approximately 12.9% + $0.30)
    const estimatedFees = total * 0.129 + 0.30;

    return {
        buyerUsername: ebayOrder.buyer?.username || 'Unknown',
        salePrice: total,
        platformFees: estimatedFees,
        shippingCost: shipping,
        netProfit: total - estimatedFees - shipping,
        saleDate: ebayOrder.creationDate || new Date().toISOString(),
        status: mapEbayOrderStatus(ebayOrder.orderFulfillmentStatus),
        externalOrderId: ebayOrder.orderId,
        externalData: {
            platform: 'ebay',
            orderId: ebayOrder.orderId,
            lineItems: ebayOrder.lineItems,
            paymentStatus: ebayOrder.orderPaymentStatus,
            fulfillmentStatus: ebayOrder.orderFulfillmentStatus,
            syncedAt: new Date().toISOString()
        }
    };
}

/**
 * Map eBay listing status to VaultLister status
 */
function mapEbayStatus(ebayStatus) {
    const statusMap = {
        'ACTIVE': 'active',
        'INACTIVE': 'ended',
        'OUT_OF_STOCK': 'ended',
        'ENDED': 'ended',
        'SOLD': 'sold'
    };
    return statusMap[ebayStatus] || 'draft';
}

/**
 * Map eBay order status to VaultLister status
 */
function mapEbayOrderStatus(ebayStatus) {
    const statusMap = {
        'NOT_STARTED': 'pending',
        'IN_PROGRESS': 'pending',
        'FULFILLED': 'delivered',
        'CANCELLED': 'cancelled'
    };
    return statusMap[ebayStatus] || 'pending';
}

export default {
    syncEbayShop,
    syncEbayListings,
    syncEbayOrders
};
