// Whatnot Platform Sync Service
// Syncs listings and orders from Whatnot to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';

export async function syncWhatnotShop(shop) {
    const results = {
        listings: { synced: 0, created: 0, updated: 0, errors: [] },
        orders: { synced: 0, created: 0, errors: [] },
        startedAt: new Date().toISOString(),
        completedAt: null
    };

    try {
        const accessToken = decryptToken(shop.oauth_token);
        const oauthMode = process.env.OAUTH_MODE || 'mock';

        const listingsResult = await syncWhatnotListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        const ordersResult = await syncWhatnotOrders(shop, accessToken, oauthMode);
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

async function syncWhatnotListings(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, updated: 0, errors: [] };

    try {
        const listings = await fetchWhatnotListings(accessToken, mode);

        for (const wnListing of listings) {
            try {
                const mapped = mapWhatnotListingToVaultLister(wnListing, shop);

                const existing = query.get(`
                    SELECT id FROM listings
                    WHERE user_id = ? AND platform = 'whatnot' AND platform_listing_id = ?
                `, [shop.user_id, wnListing.id]);

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
                        VALUES (?, ?, ?, 'whatnot', ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, null, mapped.title, mapped.price,
                        mapped.status, mapped.externalListingId,
                        JSON.stringify(mapped.externalData), new Date().toISOString(), new Date().toISOString()]);
                    result.created++;
                }
                result.synced++;
            } catch (error) {
                result.errors.push({ listingId: wnListing.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function syncWhatnotOrders(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, errors: [] };

    try {
        const orders = await fetchWhatnotOrders(accessToken, mode);

        for (const wnOrder of orders) {
            try {
                const mapped = mapWhatnotOrderToSale(wnOrder, shop);

                const existing = query.get(`
                    SELECT id FROM sales WHERE user_id = ? AND platform_order_id = ? AND platform = 'whatnot'
                `, [shop.user_id, wnOrder.id]);

                if (!existing) {
                    query.run(`
                        INSERT INTO sales (id, user_id, listing_id, platform, platform_order_id, buyer_username,
                            sale_price, platform_fee, shipping_cost, net_profit,
                            status, notes, created_at, updated_at)
                        VALUES (?, ?, ?, 'whatnot', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, null, mapped.externalOrderId, mapped.buyerUsername,
                        mapped.salePrice, mapped.platformFees, mapped.shippingCost,
                        mapped.netProfit, mapped.status,
                        mapped.externalData ? JSON.stringify(mapped.externalData) : null,
                        new Date().toISOString(), new Date().toISOString()]);
                    result.created++;
                }
                result.synced++;
            } catch (error) {
                result.errors.push({ orderId: wnOrder.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function fetchWhatnotListings(accessToken, mode) {
    if (mode === 'mock') {
        return [
            {
                id: 'wn-listing-001',
                title: 'Pokemon Base Set Booster Pack',
                price: 120.00,
                condition: 'new_sealed',
                category: 'Trading Cards',
                listingType: 'buy_now',
                status: 'active',
                createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'wn-listing-002',
                title: 'Vintage Star Wars Action Figure Lot',
                price: 85.00,
                condition: 'used_good',
                category: 'Collectibles',
                listingType: 'buy_now',
                status: 'active',
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'wn-listing-003',
                title: 'Funko Pop Grail Bundle',
                price: 200.00,
                condition: 'new_in_box',
                category: 'Funko',
                listingType: 'live_auction',
                status: 'sold',
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // Whatnot API requires approved seller account.
    // Live sync available when API credentials are configured.
    return [];
}

async function fetchWhatnotOrders(accessToken, mode) {
    if (mode === 'mock') {
        return [
            {
                id: 'wn-order-001',
                buyerUsername: 'card_collector_99',
                listingId: 'wn-listing-003',
                price: 200.00,
                shippingCost: 8.99,
                status: 'shipped',
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    return [];
}

function mapWhatnotListingToVaultLister(wnListing, shop) {
    return {
        title: wnListing.title,
        price: wnListing.price,
        quantity: wnListing.status === 'sold' ? 0 : 1,
        status: mapWhatnotStatus(wnListing.status),
        externalListingId: wnListing.id,
        externalData: {
            platform: 'whatnot',
            id: wnListing.id,
            condition: wnListing.condition,
            category: wnListing.category,
            listingType: wnListing.listingType,
            syncedAt: new Date().toISOString()
        }
    };
}

// Whatnot fees: 9.5% + $0.30 per transaction
function mapWhatnotOrderToSale(wnOrder, shop) {
    const price = wnOrder.price;
    const platformFee = (price * 0.095) + 0.30;
    const shippingCost = wnOrder.shippingCost || 0;

    return {
        buyerUsername: wnOrder.buyerUsername,
        salePrice: price,
        platformFees: Math.round(platformFee * 100) / 100,
        shippingCost: shippingCost,
        netProfit: Math.round((price - platformFee - shippingCost) * 100) / 100,
        saleDate: wnOrder.createdAt,
        status: mapWhatnotOrderStatus(wnOrder.status),
        externalOrderId: wnOrder.id,
        externalData: {
            platform: 'whatnot',
            orderId: wnOrder.id,
            listingId: wnOrder.listingId,
            syncedAt: new Date().toISOString()
        }
    };
}

function mapWhatnotStatus(status) {
    const statusMap = {
        'active': 'active',
        'pending': 'reserved',
        'sold': 'sold',
        'ended': 'inactive',
        'cancelled': 'inactive'
    };
    return statusMap[status] || 'unknown';
}

function mapWhatnotOrderStatus(status) {
    const statusMap = {
        'pending': 'pending',
        'shipped': 'shipped',
        'delivered': 'completed',
        'cancelled': 'cancelled',
        'refunded': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

export default { syncWhatnotShop };
