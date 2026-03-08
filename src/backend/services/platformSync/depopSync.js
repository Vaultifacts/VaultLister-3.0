// Depop Platform Sync Service
// Syncs listings and orders from Depop API to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';

/**
 * Sync all data from Depop for a shop
 * @param {Object} shop - Shop record with OAuth tokens
 * @returns {Object} Sync results
 */
export async function syncDepopShop(shop) {
    const results = {
        listings: { synced: 0, created: 0, updated: 0, errors: [] },
        orders: { synced: 0, created: 0, errors: [] },
        startedAt: new Date().toISOString(),
        completedAt: null
    };

    try {
        const accessToken = decryptToken(shop.oauth_token);
        const oauthMode = process.env.OAUTH_MODE || 'mock';

        const listingsResult = await syncDepopListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        const ordersResult = await syncDepopOrders(shop, accessToken, oauthMode);
        results.orders = ordersResult;

        results.completedAt = new Date().toISOString();

        try {
            query.run(`
                UPDATE shops SET last_sync_at = ?, sync_error = NULL, updated_at = ?
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

async function syncDepopListings(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, updated: 0, errors: [] };

    try {
        const listings = await fetchDepopListings(accessToken, mode);

        for (const depopListing of listings) {
            try {
                const mapped = mapDepopListingToVaultLister(depopListing, shop);

                const existing = query.get(`
                    SELECT id FROM listings
                    WHERE shop_id = ? AND external_listing_id = ?
                `, [shop.id, depopListing.id]);

                if (existing) {
                    query.run(`
                        UPDATE listings SET title = ?, price = ?, quantity = ?, status = ?,
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
                result.errors.push({ listingId: depopListing.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function syncDepopOrders(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, errors: [] };

    try {
        const orders = await fetchDepopOrders(accessToken, mode);

        for (const depopOrder of orders) {
            try {
                const mapped = mapDepopOrderToSale(depopOrder, shop);

                const existing = query.get(`
                    SELECT id FROM sales WHERE shop_id = ? AND external_order_id = ?
                `, [shop.id, depopOrder.id]);

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
                result.errors.push({ orderId: depopOrder.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function fetchDepopListings(accessToken, mode) {
    if (mode === 'mock') {
        return [
            {
                id: 'depop-listing-001',
                description: 'Y2K Baby Tee Pink',
                price: 28.00,
                size: 'S',
                brand: 'Vintage',
                category: 'Tops',
                status: 'available',
                likes: 67,
                createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'depop-listing-002',
                description: 'Low Rise Flare Jeans 90s',
                price: 45.00,
                size: '26',
                brand: 'Vintage',
                category: 'Bottoms',
                status: 'available',
                likes: 89,
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'depop-listing-003',
                description: 'Butterfly Crop Top',
                price: 22.00,
                size: 'M',
                brand: 'Handmade',
                category: 'Tops',
                status: 'sold',
                likes: 134,
                createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // Depop does not provide a public API. Live sync requires Playwright scraping
    // (available via the Automations tab). Return empty so sync completes gracefully.
    return [];
}

async function fetchDepopOrders(accessToken, mode) {
    if (mode === 'mock') {
        return [
            {
                id: 'depop-order-001',
                buyerUsername: 'y2k_vibes',
                listingId: 'depop-listing-003',
                price: 22.00,
                shippingCost: 4.50,
                status: 'shipped',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // Depop does not provide a public API. Return empty so sync completes gracefully.
    return [];
}

function mapDepopListingToVaultLister(depopListing, shop) {
    return {
        title: depopListing.description,
        price: depopListing.price,
        quantity: depopListing.status === 'sold' ? 0 : 1,
        status: mapDepopStatus(depopListing.status),
        externalListingId: depopListing.id,
        externalData: {
            platform: 'depop',
            id: depopListing.id,
            size: depopListing.size,
            brand: depopListing.brand,
            category: depopListing.category,
            likes: depopListing.likes,
            syncedAt: new Date().toISOString()
        }
    };
}

/**
 * Map Depop order to VaultLister sale schema
 * Depop fees: 10%
 */
function mapDepopOrderToSale(depopOrder, shop) {
    const price = depopOrder.price;
    const platformFee = price * 0.10; // 10% Depop fee
    const shippingCost = depopOrder.shippingCost || 0;

    return {
        buyerUsername: depopOrder.buyerUsername,
        salePrice: price,
        platformFees: platformFee,
        shippingCost: shippingCost,
        netProfit: price - platformFee - shippingCost,
        saleDate: depopOrder.createdAt,
        status: mapDepopOrderStatus(depopOrder.status),
        externalOrderId: depopOrder.id,
        externalData: {
            platform: 'depop',
            orderId: depopOrder.id,
            listingId: depopOrder.listingId,
            syncedAt: new Date().toISOString()
        }
    };
}

function mapDepopStatus(status) {
    const statusMap = {
        'available': 'active',
        'reserved': 'reserved',
        'sold': 'sold',
        'inactive': 'inactive'
    };
    return statusMap[status] || 'unknown';
}

function mapDepopOrderStatus(status) {
    const statusMap = {
        'pending': 'pending',
        'shipped': 'shipped',
        'delivered': 'completed',
        'cancelled': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

export default { syncDepopShop };
