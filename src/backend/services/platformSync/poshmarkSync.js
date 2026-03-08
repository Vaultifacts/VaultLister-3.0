// Poshmark Platform Sync Service
// Syncs listings and orders from Poshmark API to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';

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
                    WHERE shop_id = ? AND external_listing_id = ?
                `, [shop.id, poshListing.id]);

                if (existing) {
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
                    const listingId = uuidv4();
                    query.run(`
                        INSERT INTO listings (
                            id, user_id, shop_id, inventory_id, title, price,
                            quantity, status, external_listing_id, external_data,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        listingId, shop.user_id, shop.id, null,
                        mapped.title, mapped.price, mapped.quantity, mapped.status,
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
                    WHERE shop_id = ? AND external_order_id = ?
                `, [shop.id, poshOrder.id]);

                if (!existing) {
                    const saleId = uuidv4();
                    query.run(`
                        INSERT INTO sales (
                            id, user_id, shop_id, listing_id, buyer_username,
                            sale_price, platform_fee, shipping_cost, net_profit,
                            sale_date, status, external_order_id, external_data,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        saleId, shop.user_id, shop.id, null,
                        mapped.buyerUsername, mapped.salePrice, mapped.platformFees,
                        mapped.shippingCost, mapped.netProfit, mapped.saleDate,
                        mapped.status, mapped.externalOrderId,
                        JSON.stringify(mapped.externalData),
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
    if (mode === 'mock') {
        return [
            {
                id: 'posh-listing-001',
                title: 'Vintage Coach Handbag',
                price: 125.00,
                originalPrice: 150.00,
                size: 'Medium',
                brand: 'Coach',
                category: 'Bags',
                status: 'available',
                shares: 45,
                likes: 12,
                createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'posh-listing-002',
                title: 'Lululemon Align Leggings',
                price: 68.00,
                originalPrice: 98.00,
                size: '6',
                brand: 'Lululemon',
                category: 'Activewear',
                status: 'available',
                shares: 120,
                likes: 34,
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'posh-listing-003',
                title: 'Free People Dress',
                price: 55.00,
                originalPrice: 85.00,
                size: 'S',
                brand: 'Free People',
                category: 'Dresses',
                status: 'sold',
                shares: 89,
                likes: 28,
                createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // Poshmark does not provide a public API. Live sync requires Playwright scraping
    // (available via the Automations tab). Return empty so sync completes gracefully.
    return [];
}

/**
 * Fetch orders from Poshmark API (mock)
 */
async function fetchPoshmarkOrders(accessToken, mode) {
    if (mode === 'mock') {
        return [
            {
                id: 'posh-order-001',
                buyerUsername: 'fashionista_sarah',
                listingId: 'posh-listing-003',
                price: 55.00,
                shippingCost: 7.97,
                status: 'shipped',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

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
        'reserved': 'reserved',
        'sold': 'sold',
        'not_for_sale': 'inactive'
    };
    return statusMap[status] || 'unknown';
}

function mapPoshmarkOrderStatus(status) {
    const statusMap = {
        'pending': 'pending',
        'shipped': 'shipped',
        'delivered': 'completed',
        'cancelled': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

export default { syncPoshmarkShop };
