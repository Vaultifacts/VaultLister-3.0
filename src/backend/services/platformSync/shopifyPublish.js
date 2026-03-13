// Shopify Publish Service
// Creates a new Shopify product listing via the Admin REST API.
// Flow: validate credentials → build product payload → POST /products.json → return product ID + URL
//
// Note: Shopify has a proper public API (unlike Poshmark/Mercari/etc.) — no browser automation needed.
// Requires SHOPIFY_STORE_URL (e.g. my-store.myshopify.com) and SHOPIFY_ACCESS_TOKEN in .env.
// The access token must have write_products scope.

import { logger } from '../../shared/logger.js';
import { auditLog } from './platformAuditLog.js';
import { fetchWithTimeout } from '../../shared/fetchWithTimeout.js';

const SHOPIFY_API_VERSION = '2024-01';

// Map VaultLister internal condition → Shopify product tag
const CONDITION_TAGS = {
    'new':        'condition:new',
    'like_new':   'condition:like-new',
    'good':       'condition:good',
    'fair':       'condition:fair',
    'poor':       'condition:poor',
    'parts_only': 'condition:parts-only',
};

/**
 * Publish a VaultLister listing to a Shopify store via the Admin REST API.
 * @param {Object} shop      - Shop row (platform = 'shopify')
 * @param {Object} listing   - Listing row
 * @param {Object} inventory - InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function publishListingToShopify(shop, listing, inventory) {
    const storeUrl     = (process.env.SHOPIFY_STORE_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const accessToken  = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!storeUrl || !accessToken) {
        throw new Error('SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN must be set in .env to publish to Shopify');
    }

    const price = parseFloat(listing.price || inventory.list_price || 0);
    if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

    auditLog('shopify', 'publish_attempt', { listingId: listing.id });

    const title       = (listing.title || inventory.title || 'Item from VaultLister').slice(0, 255);
    const description = (listing.description || inventory.description || title);
    const sku         = inventory.sku || inventory.id;
    const condition   = inventory.condition?.toLowerCase() || 'good';
    const conditionTag = CONDITION_TAGS[condition] || 'condition:good';

    // Build tags array: condition + any inventory tags
    const tags = [conditionTag];
    if (inventory.category) tags.push(`category:${inventory.category}`);
    if (inventory.brand) tags.push(`brand:${inventory.brand}`);

    // Build images array from inventory images (URLs only — Shopify accepts src URLs)
    const rawImages = (() => {
        try { return JSON.parse(inventory.images || '[]'); } catch { return []; }
    })();
    const imagesSrc = rawImages
        .slice(0, 10) // Shopify allows up to 250, but cap at 10 for sanity
        .filter(img => typeof img === 'string' && img.startsWith('http'))
        .map(src => ({ src }));

    const payload = {
        product: {
            title,
            body_html: description.replace(/\n/g, '<br>'),
            vendor: inventory.brand || 'VaultLister',
            product_type: inventory.category || '',
            tags: tags.join(', '),
            status: 'active',
            variants: [
                {
                    price: price.toFixed(2),
                    sku,
                    inventory_management: 'shopify',
                    inventory_quantity: 1,
                    fulfillment_service: 'manual',
                }
            ],
            ...(imagesSrc.length > 0 ? { images: imagesSrc } : {}),
        }
    };

    const apiUrl = `https://${storeUrl}/admin/api/${SHOPIFY_API_VERSION}/products.json`;
    logger.info('[Shopify Publish] Creating product', { title, price, sku });

    const response = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        timeoutMs: 30000,
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        const errMsg = `Shopify API error ${response.status}: ${errBody.slice(0, 300)}`;
        auditLog('shopify', 'publish_failure', { listingId: listing.id, error: errMsg });
        throw new Error(errMsg);
    }

    const data = await response.json();
    const product = data.product;

    if (!product?.id) {
        throw new Error('Shopify API returned success but no product ID in response');
    }

    const listingId  = String(product.id);
    const listingUrl = `https://${storeUrl}/products/${product.handle}`;

    logger.info('[Shopify Publish] Success', { listingId, listingUrl });
    auditLog('shopify', 'publish_success', { listingId, listingUrl });
    return { listingId, listingUrl };
}

export default { publishListingToShopify };
