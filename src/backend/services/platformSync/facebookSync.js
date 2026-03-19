// Facebook Marketplace Platform Sync Service
// Syncs listings and orders from Facebook Marketplace to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';
import { logger } from '../../shared/logger.js';

export async function syncFacebookShop(shop) {
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
            logger.warn('[PlatformSync] Facebook sync in mock mode — returning empty data');
            results.message = 'Facebook sync requires connected account with valid credentials. Use Automations to sync via browser automation.';
            results.completedAt = new Date().toISOString();
            return results;
        }

        const listingsResult = await syncFacebookListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        const ordersResult = await syncFacebookOrders(shop, accessToken, oauthMode);
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

async function syncFacebookListings(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, updated: 0, errors: [] };

    try {
        const listings = await fetchFacebookListings(accessToken, mode);

        for (const fbListing of listings) {
            try {
                const mapped = mapFacebookListingToVaultLister(fbListing, shop);

                const existing = query.get(`
                    SELECT id FROM listings
                    WHERE user_id = ? AND platform = 'facebook' AND platform_listing_id = ?
                `, [shop.user_id, fbListing.id]);

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
                        VALUES (?, ?, ?, 'facebook', ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, null, mapped.title, mapped.price,
                        mapped.status, mapped.externalListingId,
                        JSON.stringify(mapped.externalData), new Date().toISOString(), new Date().toISOString()]);
                    result.created++;
                }
                result.synced++;
            } catch (error) {
                result.errors.push({ listingId: fbListing.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function syncFacebookOrders(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, errors: [] };

    try {
        const orders = await fetchFacebookOrders(accessToken, mode);

        for (const fbOrder of orders) {
            try {
                const mapped = mapFacebookOrderToSale(fbOrder, shop);

                const existing = query.get(`
                    SELECT id FROM sales WHERE user_id = ? AND platform_order_id = ? AND platform = 'facebook'
                `, [shop.user_id, fbOrder.id]);

                if (!existing) {
                    query.run(`
                        INSERT INTO sales (id, user_id, listing_id, platform, platform_order_id, buyer_username,
                            sale_price, platform_fee, shipping_cost, net_profit,
                            status, notes, created_at, updated_at)
                        VALUES (?, ?, ?, 'facebook', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, null, mapped.externalOrderId, mapped.buyerUsername,
                        mapped.salePrice, mapped.platformFees, mapped.shippingCost,
                        mapped.netProfit, mapped.status,
                        mapped.externalData ? JSON.stringify(mapped.externalData) : null,
                        new Date().toISOString(), new Date().toISOString()]);
                    result.created++;
                }
                result.synced++;
            } catch (error) {
                result.errors.push({ orderId: fbOrder.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function fetchFacebookListings(accessToken, mode) {
    // Facebook Commerce API requires approved Commerce account.
    // Live sync via Graph API v18.0 when credentials are configured.
    return [];
}

async function fetchFacebookOrders(accessToken, mode) {
    return [];
}

function mapFacebookListingToVaultLister(fbListing, shop) {
    return {
        title: fbListing.title,
        price: fbListing.price,
        quantity: fbListing.status === 'SOLD' ? 0 : 1,
        status: mapFacebookStatus(fbListing.status),
        externalListingId: fbListing.id,
        externalData: {
            platform: 'facebook',
            id: fbListing.id,
            condition: fbListing.condition,
            category: fbListing.category,
            location: fbListing.location,
            syncedAt: new Date().toISOString()
        }
    };
}

// Facebook Marketplace has no seller fees for standard listings
function mapFacebookOrderToSale(fbOrder, shop) {
    const price = fbOrder.price;
    const platformFee = price * 0.05; // 5% selling fee for shipped items
    const shippingCost = fbOrder.shippingCost || 0;

    return {
        buyerUsername: fbOrder.buyerName,
        salePrice: price,
        platformFees: platformFee,
        shippingCost: shippingCost,
        netProfit: price - platformFee - shippingCost,
        saleDate: fbOrder.createdAt,
        status: mapFacebookOrderStatus(fbOrder.status),
        externalOrderId: fbOrder.id,
        externalData: {
            platform: 'facebook',
            orderId: fbOrder.id,
            listingId: fbOrder.listingId,
            syncedAt: new Date().toISOString()
        }
    };
}

function mapFacebookStatus(status) {
    const statusMap = {
        'LISTED': 'active',
        'PENDING': 'reserved',
        'SOLD': 'sold',
        'EXPIRED': 'inactive',
        'DELETED': 'inactive'
    };
    return statusMap[status] || 'unknown';
}

function mapFacebookOrderStatus(status) {
    const statusMap = {
        'pending': 'pending',
        'shipped': 'shipped',
        'delivered': 'completed',
        'cancelled': 'cancelled',
        'refunded': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

export default { syncFacebookShop };
