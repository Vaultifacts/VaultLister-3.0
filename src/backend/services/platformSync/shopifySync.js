// Shopify Platform Sync Service
// Syncs products and orders from Shopify Admin API to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';
import { logger } from '../../shared/logger.js';

export async function syncShopifyShop(shop) {
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
            logger.warn('[PlatformSync] Shopify sync in mock mode — returning empty data');
            results.message = 'Shopify sync requires connected account with valid credentials. Use Automations to sync via browser automation.';
            results.completedAt = new Date().toISOString();
            return results;
        }

        const listingsResult = await syncShopifyListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        const ordersResult = await syncShopifyOrders(shop, accessToken, oauthMode);
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

async function syncShopifyListings(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, updated: 0, errors: [] };

    try {
        const products = await fetchShopifyProducts(shop, accessToken, mode);

        for (const product of products) {
            try {
                const mapped = mapShopifyProductToVaultLister(product, shop);

                const existing = await query.get(`
                    SELECT id FROM listings
                    WHERE user_id = ? AND platform = 'shopify' AND platform_listing_id = ?
                `, [shop.user_id, String(product.id)]);

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
                        VALUES (?, ?, ?, 'shopify', ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, null, mapped.title, mapped.price,
                        mapped.status, mapped.externalListingId,
                        JSON.stringify(mapped.externalData), new Date().toISOString(), new Date().toISOString()]);
                    result.created++;
                }
                result.synced++;
            } catch (error) {
                result.errors.push({ productId: product.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function syncShopifyOrders(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, errors: [] };

    try {
        const orders = await fetchShopifyOrders(shop, accessToken, mode);

        for (const order of orders) {
            try {
                const mapped = mapShopifyOrderToSale(order, shop);

                const existing = await query.get(`
                    SELECT id FROM sales WHERE user_id = ? AND platform_order_id = ? AND platform = 'shopify'
                `, [shop.user_id, String(order.id)]);

                if (!existing) {
                    await query.run(`
                        INSERT INTO sales (id, user_id, listing_id, platform, platform_order_id, buyer_username,
                            sale_price, platform_fee, shipping_cost, net_profit,
                            status, notes, created_at, updated_at)
                        VALUES (?, ?, ?, 'shopify', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [uuidv4(), shop.user_id, null, mapped.externalOrderId, mapped.buyerUsername,
                        mapped.salePrice, mapped.platformFees, mapped.shippingCost,
                        mapped.netProfit, mapped.status,
                        mapped.externalData ? JSON.stringify(mapped.externalData) : null,
                        new Date().toISOString(), new Date().toISOString()]);
                    result.created++;
                }
                result.synced++;
            } catch (error) {
                result.errors.push({ orderId: order.id, error: error.message });
            }
        }

        return result;
    } catch (error) {
        result.errors.push({ error: error.message });
        throw error;
    }
}

async function fetchShopifyProducts(shop, accessToken, mode) {
    // Shopify Admin REST API: GET /admin/api/2024-01/products.json
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    if (!storeUrl) return [];

    try {
        const resp = await fetch(`${storeUrl}/admin/api/2024-01/products.json?limit=250`, {
            signal: AbortSignal.timeout(30000),
            headers: { 'X-Shopify-Access-Token': accessToken }
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.products || [];
    } catch {
        return [];
    }
}

async function fetchShopifyOrders(shop, accessToken, mode) {
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    if (!storeUrl) return [];

    try {
        const resp = await fetch(`${storeUrl}/admin/api/2024-01/orders.json?status=any&limit=250`, {
            signal: AbortSignal.timeout(30000),
            headers: { 'X-Shopify-Access-Token': accessToken }
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.orders || [];
    } catch {
        return [];
    }
}

function mapShopifyProductToVaultLister(product, shop) {
    const firstVariant = product.variants?.[0] || {};
    const price = parseFloat(firstVariant.price || '0');

    return {
        title: product.title,
        price: price,
        quantity: firstVariant.inventory_quantity || 0,
        status: mapShopifyStatus(product.status),
        externalListingId: String(product.id),
        externalData: {
            platform: 'shopify',
            id: product.id,
            handle: product.handle,
            product_type: product.product_type,
            vendor: product.vendor,
            tags: product.tags,
            variantCount: product.variants?.length || 1,
            syncedAt: new Date().toISOString()
        }
    };
}

// Shopify fees: 2.9% + $0.30 per transaction (Shopify Payments)
function mapShopifyOrderToSale(order, shop) {
    const price = parseFloat(order.total_price || '0');
    const platformFee = (price * 0.029) + 0.30;
    const shippingCost = parseFloat(order.total_shipping_price_set?.shop_money?.amount || '0');

    return {
        buyerUsername: order.email || order.name,
        salePrice: price,
        platformFees: Math.round(platformFee * 100) / 100,
        shippingCost: shippingCost,
        netProfit: Math.round((price - platformFee - shippingCost) * 100) / 100,
        saleDate: order.created_at,
        status: mapShopifyOrderStatus(order.fulfillment_status),
        externalOrderId: String(order.id),
        externalData: {
            platform: 'shopify',
            orderId: order.id,
            orderName: order.name,
            financialStatus: order.financial_status,
            syncedAt: new Date().toISOString()
        }
    };
}

function mapShopifyStatus(status) {
    const statusMap = {
        'active': 'active',
        'archived': 'archived',
        'draft': 'draft'
    };
    return statusMap[status] || 'draft';
}

function mapShopifyOrderStatus(status) {
    const statusMap = {
        'fulfilled': 'delivered',
        'partial': 'shipped',
        null: 'pending',
        'restocked': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

/**
 * Health probe for the uptime worker. Returns {ok, reason?}.
 * Verifies encryption key + DB reachability — Shopify OAuth config is per-shop.
 */
export async function healthCheck() {
    if (!process.env.ENCRYPTION_KEY) {
        return { ok: false, reason: 'ENCRYPTION_KEY not set' };
    }
    const oauthMode = process.env.OAUTH_MODE || 'mock';
    if (oauthMode !== 'mock' && !process.env.SHOPIFY_CLIENT_ID) {
        return { ok: false, reason: 'SHOPIFY_CLIENT_ID required when OAUTH_MODE=' + oauthMode };
    }
    try {
        await query.get('SELECT 1', []);
    } catch (err) {
        return { ok: false, reason: 'Database unreachable: ' + (err?.message || 'unknown') };
    }
    return { ok: true };
}

export default { syncShopifyShop, healthCheck };
