// Shopify Platform Sync Service
// Syncs products and orders from Shopify Admin API to VaultLister

import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { decryptToken } from '../../utils/encryption.js';

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

        const listingsResult = await syncShopifyListings(shop, accessToken, oauthMode);
        results.listings = listingsResult;

        const ordersResult = await syncShopifyOrders(shop, accessToken, oauthMode);
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

async function syncShopifyListings(shop, accessToken, mode) {
    const result = { synced: 0, created: 0, updated: 0, errors: [] };

    try {
        const products = await fetchShopifyProducts(shop, accessToken, mode);

        for (const product of products) {
            try {
                const mapped = mapShopifyProductToVaultLister(product, shop);

                const existing = query.get(`
                    SELECT id FROM listings
                    WHERE user_id = ? AND platform = 'shopify' AND platform_listing_id = ?
                `, [shop.user_id, String(product.id)]);

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

                const existing = query.get(`
                    SELECT id FROM sales WHERE user_id = ? AND platform_order_id = ? AND platform = 'shopify'
                `, [shop.user_id, String(order.id)]);

                if (!existing) {
                    query.run(`
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
    if (mode === 'mock') {
        return [
            {
                id: 'shopify-prod-001',
                title: 'Custom Embroidered Hoodie',
                status: 'active',
                variants: [{ price: '65.00', inventory_quantity: 5 }],
                product_type: 'Hoodie',
                vendor: 'VaultLister Store',
                tags: 'custom, embroidered, streetwear',
                handle: 'custom-embroidered-hoodie',
                created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'shopify-prod-002',
                title: 'Vintage Band Tee Collection',
                status: 'active',
                variants: [{ price: '35.00', inventory_quantity: 12 }],
                product_type: 'T-Shirt',
                vendor: 'VaultLister Store',
                tags: 'vintage, band, music',
                handle: 'vintage-band-tee-collection',
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'shopify-prod-003',
                title: 'Designer Sneaker Bundle',
                status: 'draft',
                variants: [{ price: '150.00', inventory_quantity: 0 }],
                product_type: 'Sneakers',
                vendor: 'VaultLister Store',
                tags: 'designer, sneakers, bundle',
                handle: 'designer-sneaker-bundle',
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // Shopify Admin REST API: GET /admin/api/2024-01/products.json
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    if (!storeUrl) return [];

    try {
        const resp = await fetch(`${storeUrl}/admin/api/2024-01/products.json?limit=250`, {
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
    if (mode === 'mock') {
        return [
            {
                id: 'shopify-order-001',
                name: '#1001',
                email: 'buyer@example.com',
                total_price: '65.00',
                total_shipping_price_set: { shop_money: { amount: '7.99' } },
                financial_status: 'paid',
                fulfillment_status: 'fulfilled',
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    const storeUrl = process.env.SHOPIFY_STORE_URL;
    if (!storeUrl) return [];

    try {
        const resp = await fetch(`${storeUrl}/admin/api/2024-01/orders.json?status=any&limit=250`, {
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
        'archived': 'inactive',
        'draft': 'draft'
    };
    return statusMap[status] || 'unknown';
}

function mapShopifyOrderStatus(status) {
    const statusMap = {
        'fulfilled': 'completed',
        'partial': 'shipped',
        null: 'pending',
        'restocked': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

export default { syncShopifyShop };
