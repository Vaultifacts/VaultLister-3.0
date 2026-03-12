// Grailed Platform Sync Service
// Syncs listings and orders from Grailed API to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';

/**
 * Sync all data from Grailed for a shop
 * @param {Object} shop - Shop record with OAuth tokens
 * @returns {Object} Sync results
 */
export async function syncGrailedShop(shop) {
    const results = {
        listings: { synced: 0, created: 0, updated: 0, errors: [] },
        orders: { synced: 0, created: 0, errors: [] },
        startedAt: new Date().toISOString(),
        completedAt: null
    };

    try {
        const accessToken = decryptToken(shop.oauth_token);
        const oauthMode = process.env.OAUTH_MODE || 'mock';

        const listingsResult = await syncGrailedListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        const ordersResult = await syncGrailedOrders(shop, accessToken, oauthMode);
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

async function syncGrailedListings(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, updated: 0, errors: [] };

    try {
        const listings = await fetchGrailedListings(accessToken, mode);

        for (const grailedListing of listings) {
            try {
                const mapped = mapGrailedListingToVaultLister(grailedListing, shop);

                const existing = query.get(`
                    SELECT id FROM listings
                    WHERE user_id = ? AND platform = 'grailed' AND platform_listing_id = ?
                `, [shop.user_id, grailedListing.id]);

                if (existing) {
                    query.run(`
                        UPDATE listings SET title = ?, price = ?, status = ?,
                            platform_specific_data = ?, updated_at = ?
                        WHERE id = ?
                    `, [mapped.title, mapped.price, mapped.status,
                        JSON.stringify(mapped.externalData), new Date().toISOString(), existing.id]);
                    result.updated++;
                } else {
                    query.run(`
                        INSERT INTO listings (id, user_id, inventory_id, platform, title, price,
                            status, platform_listing_id, platform_specific_data, created_at, updated_at)
                        VALUES (?, ?, ?, 'grailed', ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, null, mapped.title, mapped.price,
                        mapped.status, mapped.externalListingId,
                        JSON.stringify(mapped.externalData), new Date().toISOString(), new Date().toISOString()]);
                    result.created++;
                }
                result.synced++;
            } catch (error) {
                result.errors.push({ listingId: grailedListing.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function syncGrailedOrders(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, errors: [] };

    try {
        const orders = await fetchGrailedOrders(accessToken, mode);

        for (const grailedOrder of orders) {
            try {
                const mapped = mapGrailedOrderToSale(grailedOrder, shop);

                const existing = query.get(`
                    SELECT id FROM sales WHERE user_id = ? AND platform_order_id = ? AND platform = 'grailed'
                `, [shop.user_id, grailedOrder.id]);

                if (!existing) {
                    query.run(`
                        INSERT INTO sales (id, user_id, listing_id, platform, platform_order_id, buyer_username,
                            sale_price, platform_fee, shipping_cost, net_profit,
                            status, notes, created_at, updated_at)
                        VALUES (?, ?, ?, 'grailed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, null, mapped.externalOrderId, mapped.buyerUsername,
                        mapped.salePrice, mapped.platformFees, mapped.shippingCost,
                        mapped.netProfit, mapped.status,
                        mapped.externalData ? JSON.stringify(mapped.externalData) : null,
                        new Date().toISOString(), new Date().toISOString()]);
                    result.created++;
                }
                result.synced++;
            } catch (error) {
                result.errors.push({ orderId: grailedOrder.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function fetchGrailedListings(accessToken, mode) {
    if (mode === 'mock') {
        return [
            {
                id: 'grailed-listing-001',
                title: 'Rick Owens Geobasket Sneakers',
                price: 485.00,
                size: '43',
                designer: 'Rick Owens',
                category: 'Footwear',
                condition: 'Gently Used',
                status: 'for_sale',
                followers: 156,
                createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'grailed-listing-002',
                title: 'Raf Simons Redux Bomber Jacket',
                price: 890.00,
                size: '48',
                designer: 'Raf Simons',
                category: 'Outerwear',
                condition: 'New with Tags',
                status: 'for_sale',
                followers: 234,
                createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'grailed-listing-003',
                title: 'Helmut Lang Vintage Bondage Pants',
                price: 350.00,
                size: '32',
                designer: 'Helmut Lang',
                category: 'Bottoms',
                condition: 'Good',
                status: 'sold',
                followers: 89,
                createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // Grailed does not provide a public API. Live sync requires Playwright scraping
    // (available via the Automations tab). Return empty so sync completes gracefully.
    return [];
}

async function fetchGrailedOrders(accessToken, mode) {
    if (mode === 'mock') {
        return [
            {
                id: 'grailed-order-001',
                buyerUsername: 'archive_collector',
                listingId: 'grailed-listing-003',
                price: 350.00,
                shippingCost: 15.00,
                status: 'delivered',
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // Grailed does not provide a public API. Return empty so sync completes gracefully.
    return [];
}

function mapGrailedListingToVaultLister(grailedListing, shop) {
    return {
        title: grailedListing.title,
        price: grailedListing.price,
        quantity: grailedListing.status === 'sold' ? 0 : 1,
        status: mapGrailedStatus(grailedListing.status),
        externalListingId: grailedListing.id,
        externalData: {
            platform: 'grailed',
            id: grailedListing.id,
            size: grailedListing.size,
            designer: grailedListing.designer,
            category: grailedListing.category,
            condition: grailedListing.condition,
            followers: grailedListing.followers,
            syncedAt: new Date().toISOString()
        }
    };
}

/**
 * Map Grailed order to VaultLister sale schema
 * Grailed fees: 9% + $0.30
 */
function mapGrailedOrderToSale(grailedOrder, shop) {
    const price = grailedOrder.price;
    const platformFee = (price * 0.09) + 0.30; // 9% + $0.30 Grailed fee
    const shippingCost = grailedOrder.shippingCost || 0;

    return {
        buyerUsername: grailedOrder.buyerUsername,
        salePrice: price,
        platformFees: platformFee,
        shippingCost: shippingCost,
        netProfit: price - platformFee - shippingCost,
        saleDate: grailedOrder.createdAt,
        status: mapGrailedOrderStatus(grailedOrder.status),
        externalOrderId: grailedOrder.id,
        externalData: {
            platform: 'grailed',
            orderId: grailedOrder.id,
            listingId: grailedOrder.listingId,
            syncedAt: new Date().toISOString()
        }
    };
}

function mapGrailedStatus(status) {
    const statusMap = {
        'for_sale': 'active',
        'reserved': 'reserved',
        'sold': 'sold',
        'deleted': 'deleted'
    };
    return statusMap[status] || 'unknown';
}

function mapGrailedOrderStatus(status) {
    const statusMap = {
        'pending': 'pending',
        'shipped': 'shipped',
        'delivered': 'completed',
        'cancelled': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

export default { syncGrailedShop };
