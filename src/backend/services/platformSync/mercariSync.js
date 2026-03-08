// Mercari Platform Sync Service
// Syncs listings and orders from Mercari API to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';

/**
 * Sync all data from Mercari for a shop
 * @param {Object} shop - Shop record with OAuth tokens
 * @returns {Object} Sync results
 */
export async function syncMercariShop(shop) {
    const results = {
        listings: { synced: 0, created: 0, updated: 0, errors: [] },
        orders: { synced: 0, created: 0, errors: [] },
        startedAt: new Date().toISOString(),
        completedAt: null
    };

    try {
        const accessToken = decryptToken(shop.oauth_token);
        const oauthMode = process.env.OAUTH_MODE || 'mock';

        const listingsResult = await syncMercariListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        const ordersResult = await syncMercariOrders(shop, accessToken, oauthMode);
        results.orders = ordersResult;

        results.completedAt = new Date().toISOString();

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
            query.run(`UPDATE shops SET sync_error = ?, updated_at = ? WHERE id = ?`,
                [error.message, new Date().toISOString(), shop.id]);
        } catch (err) {
            query.run(`UPDATE shops SET updated_at = ? WHERE id = ?`,
                [new Date().toISOString(), shop.id]);
        }

        throw error;
    }
}

async function syncMercariListings(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, updated: 0, errors: [] };

    try {
        const listings = await fetchMercariListings(accessToken, mode);

        for (const mercariListing of listings) {
            try {
                const mapped = mapMercariListingToVaultLister(mercariListing, shop);

                const existing = query.get(`
                    SELECT id FROM listings
                    WHERE shop_id = ? AND external_listing_id = ?
                `, [shop.id, mercariListing.id]);

                if (existing) {
                    query.run(`
                        UPDATE listings SET
                            title = ?, price = ?, quantity = ?, status = ?,
                            external_data = ?, updated_at = ?
                        WHERE id = ?
                    `, [mapped.title, mapped.price, mapped.quantity, mapped.status,
                        JSON.stringify(mapped.externalData), new Date().toISOString(), existing.id]);
                    result.updated++;
                } else {
                    query.run(`
                        INSERT INTO listings (id, user_id, shop_id, inventory_id, title, price,
                            quantity, status, external_listing_id, external_data, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, shop.id, null, mapped.title, mapped.price,
                        mapped.quantity, mapped.status, mapped.externalListingId,
                        JSON.stringify(mapped.externalData), new Date().toISOString(), new Date().toISOString()]);
                    result.created++;
                }
                result.synced++;
            } catch (error) {
                result.errors.push({ listingId: mercariListing.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function syncMercariOrders(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, errors: [] };

    try {
        const orders = await fetchMercariOrders(accessToken, mode);

        for (const mercariOrder of orders) {
            try {
                const mapped = mapMercariOrderToSale(mercariOrder, shop);

                const existing = query.get(`
                    SELECT id FROM sales WHERE shop_id = ? AND external_order_id = ?
                `, [shop.id, mercariOrder.id]);

                if (!existing) {
                    query.run(`
                        INSERT INTO sales (id, user_id, shop_id, listing_id, buyer_username,
                            sale_price, platform_fee, shipping_cost, net_profit, sale_date,
                            status, external_order_id, external_data, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, shop.id, null, mapped.buyerUsername,
                        mapped.salePrice, mapped.platformFees, mapped.shippingCost,
                        mapped.netProfit, mapped.saleDate, mapped.status, mapped.externalOrderId,
                        JSON.stringify(mapped.externalData), new Date().toISOString(), new Date().toISOString()]);
                    result.created++;
                }
                result.synced++;
            } catch (error) {
                result.errors.push({ orderId: mercariOrder.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function fetchMercariListings(accessToken, mode) {
    if (mode === 'mock') {
        return [
            {
                id: 'merc-listing-001',
                title: 'Nintendo Switch Console',
                price: 245.00,
                condition: 'Like New',
                category: 'Electronics',
                status: 'on_sale',
                likes: 23,
                views: 156,
                createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'merc-listing-002',
                title: 'Kate Spade Wallet',
                price: 42.00,
                condition: 'Good',
                category: 'Accessories',
                status: 'on_sale',
                likes: 8,
                views: 67,
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // Mercari does not provide a public API. Live sync requires Playwright scraping
    // (available via the Automations tab). Return empty so sync completes gracefully.
    return [];
}

async function fetchMercariOrders(accessToken, mode) {
    if (mode === 'mock') {
        return [
            {
                id: 'merc-order-001',
                buyerUsername: 'deal_finder',
                listingId: 'merc-listing-002',
                price: 42.00,
                shippingCost: 5.99,
                status: 'completed',
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // Mercari does not provide a public API. Return empty so sync completes gracefully.
    return [];
}

function mapMercariListingToVaultLister(mercariListing, shop) {
    return {
        title: mercariListing.title,
        price: mercariListing.price,
        quantity: mercariListing.status === 'sold' ? 0 : 1,
        status: mapMercariStatus(mercariListing.status),
        externalListingId: mercariListing.id,
        externalData: {
            platform: 'mercari',
            id: mercariListing.id,
            condition: mercariListing.condition,
            category: mercariListing.category,
            likes: mercariListing.likes,
            views: mercariListing.views,
            syncedAt: new Date().toISOString()
        }
    };
}

/**
 * Map Mercari order to VaultLister sale schema
 * Mercari fees: 10%
 */
function mapMercariOrderToSale(mercariOrder, shop) {
    const price = mercariOrder.price;
    const platformFee = price * 0.10; // 10% Mercari fee
    const shippingCost = mercariOrder.shippingCost || 0;

    return {
        buyerUsername: mercariOrder.buyerUsername,
        salePrice: price,
        platformFees: platformFee,
        shippingCost: shippingCost,
        netProfit: price - platformFee - shippingCost,
        saleDate: mercariOrder.createdAt,
        status: mapMercariOrderStatus(mercariOrder.status),
        externalOrderId: mercariOrder.id,
        externalData: {
            platform: 'mercari',
            orderId: mercariOrder.id,
            listingId: mercariOrder.listingId,
            syncedAt: new Date().toISOString()
        }
    };
}

function mapMercariStatus(status) {
    const statusMap = {
        'on_sale': 'active',
        'trading': 'reserved',
        'sold': 'sold',
        'inactive': 'inactive'
    };
    return statusMap[status] || 'unknown';
}

function mapMercariOrderStatus(status) {
    const statusMap = {
        'pending': 'pending',
        'shipped': 'shipped',
        'completed': 'completed',
        'cancelled': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

export default { syncMercariShop };
