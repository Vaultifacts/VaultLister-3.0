// Depop Platform Sync Service
// Syncs listings and orders from Depop API to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';
import { logger } from '../../shared/logger.js';

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

        if (oauthMode === 'mock') {
            logger.warn('[PlatformSync] Depop sync in mock mode — returning empty data');
            results.message = 'Depop sync requires connected account with valid credentials. Use Automations to sync via browser automation.';
            results.completedAt = new Date().toISOString();
            return results;
        }

        const listingsResult = await syncDepopListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        const ordersResult = await syncDepopOrders(shop, accessToken, oauthMode);
        results.orders = ordersResult;

        results.completedAt = new Date().toISOString();

        try {
            await query.run(`
                UPDATE shops SET last_sync_at = ?, sync_error = NULL, updated_at = ?
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

        try {
            await query.run(`UPDATE shops SET sync_error = ?, updated_at = ? WHERE id = ?`,
                [error.message, new Date().toISOString(), shop.id]);
        } catch (err) {
            await query.run(`UPDATE shops SET updated_at = ? WHERE id = ?`,
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

                const existing = await query.get(`
                    SELECT id FROM listings
                    WHERE user_id = ? AND platform = 'depop' AND platform_listing_id = ?
                `, [shop.user_id, depopListing.id]);

                if (existing) {
                    await query.run(`
                        UPDATE listings SET title = ?, price = ?, status = ?,
                            platform_specific_data = ?, updated_at = ?
                        WHERE id = ?
                    `, [mapped.title, mapped.price, mapped.status,
                        JSON.stringify(mapped.externalData), new Date().toISOString(), existing.id]);
                    result.updated++;
                } else {
                    await query.run(`
                        INSERT INTO listings (id, user_id, inventory_id, platform, title, price,
                            status, platform_listing_id, platform_specific_data, created_at, updated_at)
                        VALUES (?, ?, ?, 'depop', ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, null, mapped.title, mapped.price,
                        mapped.status, mapped.externalListingId,
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

                const existing = await query.get(`
                    SELECT id FROM sales WHERE user_id = ? AND platform_order_id = ? AND platform = 'depop'
                `, [shop.user_id, depopOrder.id]);

                if (!existing) {
                    await query.run(`
                        INSERT INTO sales (id, user_id, listing_id, platform, platform_order_id, buyer_username,
                            sale_price, platform_fee, shipping_cost, net_profit,
                            status, notes, created_at, updated_at)
                        VALUES (?, ?, ?, 'depop', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, null, mapped.externalOrderId, mapped.buyerUsername,
                        mapped.salePrice, mapped.platformFees, mapped.shippingCost,
                        mapped.netProfit, mapped.status,
                        mapped.externalData ? JSON.stringify(mapped.externalData) : null,
                        new Date().toISOString(), new Date().toISOString()]);
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
    const listings = [];
    let offset = 0;
    const limit = 100;
    while (true) {
        const resp = await fetch(`https://partnerapi.depop.com/api/v1/products/?limit=${limit}&offset=${offset}`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(30000)
        });
        if (!resp.ok) throw new Error(`Depop listings fetch failed: ${resp.status}`);
        const data = await resp.json();
        const items = data.products || data.listings || data.items || [];
        listings.push(...items);
        if (items.length < limit) break;
        offset += limit;
    }
    return listings;
}

async function fetchDepopOrders(accessToken, mode) {
    const resp = await fetch('https://partnerapi.depop.com/api/v1/orders/', {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000)
    });
    if (!resp.ok) throw new Error(`Depop orders fetch failed: ${resp.status}`);
    const data = await resp.json();
    return data.orders || data.items || [];
}

function mapDepopListingToVaultLister(depopListing, shop) {
    return {
        title: depopListing.description,
        price: (depopListing.price_amount || depopListing.price || 0) / 100,
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
        'reserved': 'pending',
        'sold': 'sold',
        'inactive': 'ended'
    };
    return statusMap[status] || 'draft';
}

function mapDepopOrderStatus(status) {
    const statusMap = {
        'pending': 'pending',
        'shipped': 'shipped',
        'delivered': 'delivered',
        'cancelled': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

export default { syncDepopShop };
