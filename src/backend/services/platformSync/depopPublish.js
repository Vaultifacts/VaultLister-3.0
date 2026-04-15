// Depop Publish Service (REST API)
// Creates/manages Depop listings via the Selling Partner API
// Requires OAuth token (obtained via Settings > Integrations)
//
// Replaces the previous Playwright browser automation approach.
// Depop Selling API: https://partnerapi.depop.com

import { decryptToken } from '../../utils/encryption.js';
import { logger } from '../../shared/logger.js';
import { fetchWithTimeout } from '../../shared/fetchWithTimeout.js';
import { auditLog } from './platformAuditLog.js';

const DEPOP_API = 'https://partnerapi.depop.com';

// VaultLister condition → Depop API condition enum
// Values from live taxonomy: https://api.depop.com/api/v3/attributes/
// Valid: brand_new, used_like_new, used_excellent, used_good, used_fair
const CONDITION_MAP = {
    'new':        'brand_new',
    'like_new':   'used_like_new',
    'good':       'used_excellent',
    'fair':       'used_good',
    'poor':       'used_fair',
    'parts_only': 'used_fair'
};

// Rate limiter: Depop enforces 20 req/s for create/update, 100 req/s cumulative.
// We use a simple token bucket that ensures minimum 55ms between mutating calls (≈18 req/s with margin).
let _lastMutatingCall = 0;
const MUTATING_INTERVAL_MS = 55; // 1000ms / 18 ≈ 55ms (stays under 20 req/s)

async function rateLimitMutating() {
    const now = Date.now();
    const elapsed = now - _lastMutatingCall;
    if (elapsed < MUTATING_INTERVAL_MS) {
        await new Promise(r => setTimeout(r, MUTATING_INTERVAL_MS - elapsed));
    }
    _lastMutatingCall = Date.now();
}

/**
 * Make an authenticated request to the Depop Selling API.
 * Mutating methods (POST/PUT/PATCH/DELETE) are rate-limited to stay under 20 req/s.
 */
async function depopRequest(method, path, token, body = null) {
    if (method !== 'GET') await rateLimitMutating();

    const url = `${DEPOP_API}${path}`;
    const opts = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        timeoutMs: 30000
    };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetchWithTimeout(url, opts);

    // Handle 429 Too Many Requests with retry-after
    if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers?.get?.('retry-after') || '2', 10);
        logger.warn('[Depop] Rate limited, retrying after', { retryAfter, path });
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return depopRequest(method, path, token, body);
    }

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: resp.ok, status: resp.status, data };
}

/**
 * Resolve inventory images to public URLs for the Depop REST API.
 * Depop requires publicly accessible image URLs (JPG/WebP/PNG), no binary upload.
 * inventory.images can be a JSON array of HTTP URLs or absolute local file paths.
 */
function resolvePublicImageUrls(images, max = 8) {
    let arr = [];
    if (typeof images === 'string') {
        try { arr = JSON.parse(images); } catch { arr = images.split(',').map(s => s.trim()); }
    } else if (Array.isArray(images)) {
        arr = images;
    }

    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');

    return arr
        .filter(Boolean)
        .map(u => {
            if (typeof u !== 'string') return null;
            if (u.startsWith('http')) return u;
            // Absolute local path — extract the /uploads/... portion if served statically
            const uploadsIdx = u.replace(/\\/g, '/').indexOf('/uploads/');
            if (uploadsIdx !== -1) return `${appUrl}${u.slice(uploadsIdx)}`;
            return null;
        })
        .filter(u => u && /\.(jpe?g|webp|png)(\?.*)?$/i.test(u))
        .slice(0, max);
}

/**
 * Publish a VaultLister listing to Depop via the Selling Partner API.
 * Uses PUT upsert by SKU — creates the product if it doesn't exist, updates if it does.
 * @param {Object} shop      - Shop row with encrypted oauth_token
 * @param {Object} listing   - Listing row
 * @param {Object} inventory - InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function publishListingToDepop(shop, listing, inventory) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token — reconnect via Settings > Integrations');

    const price = parseFloat(listing.price || inventory.list_price || 0);
    if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

    auditLog('depop', 'publish_attempt', { listingId: listing.id });

    const condition = CONDITION_MAP[inventory.condition?.toLowerCase()] || 'used_good';
    const description = (listing.description || inventory.description || listing.title || inventory.title || 'Item').slice(0, 1000);
    const photos = resolvePublicImageUrls(inventory.images).map(url => ({ url }));
    if (photos.length === 0) throw new Error('Depop requires at least one public image URL');

    // SKU: max 50 chars, alphanumeric + hyphens/underscores only, cannot be reused after deletion
    const sku = (inventory.sku || `VL-${listing.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50);

    const payload = {
        description,
        price_amount: price.toFixed(2),
        price_currency: listing.currency || 'USD',
        condition,
        pictures: photos,
        quantity: Math.max(1, parseInt(inventory.quantity) || 1),
        department: inventory.department || inventory.gender?.toLowerCase() || 'menswear',
        product_type: inventory.product_type || inventory.category?.toLowerCase()?.replace(/\s+/g, '-') || 'tshirts',
        address: {
            country_code: shop.country_code || process.env.DEPOP_COUNTRY_CODE || 'US',
            state: shop.state || process.env.DEPOP_STATE || ''
        },
        size_set_id: inventory.size_set_id || null,
        size_id: inventory.size_id || null
    };

    logger.info('[Depop Publish] Creating listing', { sku, price: payload.price_amount });
    const result = await depopRequest('PUT', `/api/v1/products/by-sku/${encodeURIComponent(sku)}/`, accessToken, payload);

    if (!result.ok) {
        logger.error('[Depop Publish] Create failed', { status: result.status, body: JSON.stringify(result.data) });
        auditLog('depop', 'publish_failure', { listingId: listing.id, error: JSON.stringify(result.data) });
        throw new Error(`Depop listing creation failed (${result.status}): ${JSON.stringify(result.data)}`);
    }

    const depopSlug = result.data.slug || sku;
    const listingUrl = `https://www.depop.com/products/${depopSlug}/`;

    logger.info('[Depop Publish] Success', { sku, listingUrl });
    auditLog('depop', 'publish_success', { listingId: listing.id, sku, listingUrl });
    return { listingId: sku, listingUrl };
}

/**
 * Partial-update an existing Depop product by SKU.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} sku - The Depop product SKU to update
 * @param {Object} listing - Updated listing row
 * @param {Object} inventory - Updated InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function updateDepopListing(shop, sku, listing, inventory) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token — reconnect via Settings > Integrations');

    auditLog('depop', 'update_attempt', { sku });

    const payload = {};
    if (listing.description || inventory.description) {
        payload.description = (listing.description || inventory.description).slice(0, 1000);
    }
    if (listing.price || inventory.list_price) {
        const price = parseFloat(listing.price || inventory.list_price);
        if (price > 0) payload.price_amount = price.toFixed(2);
    }
    if (inventory.condition) {
        payload.condition = CONDITION_MAP[inventory.condition.toLowerCase()] || 'used_good';
    }
    const photos = resolvePublicImageUrls(inventory.images);
    if (photos.length > 0) payload.pictures = photos.map(url => ({ url }));

    logger.info('[Depop Publish] Updating listing', { sku });
    const result = await depopRequest('PATCH', `/api/v1/products/by-sku/${encodeURIComponent(sku)}/`, accessToken, payload);

    if (!result.ok) {
        logger.error('[Depop Publish] Update failed', { status: result.status, body: JSON.stringify(result.data) });
        auditLog('depop', 'update_failure', { sku, error: JSON.stringify(result.data) });
        throw new Error(`Depop listing update failed (${result.status}): ${JSON.stringify(result.data)}`);
    }

    auditLog('depop', 'update_success', { sku });
    const depopSlug = result.data.slug || sku;
    return { listingId: sku, listingUrl: `https://www.depop.com/products/${depopSlug}/` };
}

/**
 * Delete a Depop product by SKU.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} sku - The Depop product SKU to delete
 * @returns {boolean} Whether the deletion succeeded
 */
export async function deleteDepopListing(shop, sku) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token — reconnect via Settings > Integrations');

    auditLog('depop', 'delete_attempt', { sku });
    const result = await depopRequest('DELETE', `/api/v1/products/by-sku/${encodeURIComponent(sku)}/`, accessToken);

    if (!result.ok) {
        logger.warn('[Depop] Delete failed', { sku, status: result.status });
        auditLog('depop', 'delete_failure', { sku, error: JSON.stringify(result.data) });
        return false;
    }

    auditLog('depop', 'delete_success', { sku });
    return true;
}

/**
 * Mark a Depop product as sold by SKU (cross-platform inventory sync).
 * Call when an item sells on another platform to keep Depop in sync.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} sku - The Depop product SKU to mark as sold
 * @returns {boolean} Whether the mark-as-sold succeeded
 */
export async function markDepopListingAsSold(shop, sku) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');

    auditLog('depop', 'mark_as_sold_attempt', { sku });
    const result = await depopRequest('POST', `/api/v1/products/by-sku/${encodeURIComponent(sku)}/mark-as-sold/`, accessToken);
    if (!result.ok) {
        logger.warn('[Depop] mark-as-sold failed', { sku, status: result.status });
    }
    auditLog('depop', 'mark_as_sold', { sku, ok: result.ok });
    return result.ok;
}

/**
 * Submit an offer price on a Depop product by SKU.
 * Sets both auto-send and auto-negotiate offer prices.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} sku - The Depop product SKU
 * @param {number} offerPrice - The offer price in the listing's currency (e.g. 25.00)
 * @returns {boolean} Whether the offer submission succeeded
 */
export async function submitDepopOffer(shop, sku, offerPrice) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');

    auditLog('depop', 'submit_offer_attempt', { sku, offerPrice });
    const result = await depopRequest('POST', `/api/v1/products/by-sku/${encodeURIComponent(sku)}/offer/`, accessToken, {
        auto_send_offer_price: offerPrice.toFixed(2),
        auto_negotiate_offer_price: (offerPrice * 0.9).toFixed(2)
    });

    if (!result.ok) {
        logger.warn('[Depop] Submit offer failed', { sku, status: result.status });
        auditLog('depop', 'submit_offer_failure', { sku, error: JSON.stringify(result.data) });
        return false;
    }

    auditLog('depop', 'submit_offer_success', { sku });
    return true;
}

/**
 * Get a single Depop product by SKU.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} sku - The Depop product SKU
 * @returns {Object} Product data from Depop API
 */
export async function getDepopProduct(shop, sku) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');
    const result = await depopRequest('GET', `/api/v1/products/by-sku/${encodeURIComponent(sku)}/`, accessToken);
    if (!result.ok) throw new Error(`Depop product fetch failed (${result.status})`);
    return result.data;
}

/**
 * Mark a Depop order parcel as shipped.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} purchaseId - The Depop purchase/order ID
 * @param {string} parcelId - The parcel ID within the order
 * @param {Object} [shippingInfo] - Shipping details (tracking number, carrier)
 * @returns {boolean} Whether the mark-as-shipped succeeded
 */
export async function markDepopOrderShipped(shop, purchaseId, parcelId, shippingInfo) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');

    auditLog('depop', 'mark_shipped_attempt', { purchaseId, parcelId });
    const result = await depopRequest('POST',
        `/api/v1/orders/${encodeURIComponent(purchaseId)}/parcels/${encodeURIComponent(parcelId)}/mark-as-shipped/`,
        accessToken, shippingInfo || {});

    if (!result.ok) {
        logger.warn('[Depop] Mark shipped failed', { purchaseId, parcelId, status: result.status });
        return false;
    }

    auditLog('depop', 'mark_shipped_success', { purchaseId, parcelId });
    return true;
}

/**
 * Get a single Depop order by purchase ID.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} purchaseId - The Depop purchase/order ID
 * @returns {Object} Order data from Depop API
 */
export async function getDepopOrder(shop, purchaseId) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');
    const result = await depopRequest('GET', `/api/v1/orders/${encodeURIComponent(purchaseId)}/`, accessToken);
    if (!result.ok) throw new Error(`Depop order fetch failed (${result.status})`);
    return result.data;
}

/**
 * Process a refund on a Depop order.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} purchaseId - The Depop purchase/order ID
 * @param {Object} refundData - Refund details
 * @returns {Object} Refund response from Depop API
 */
export async function refundDepopOrder(shop, purchaseId, refundData) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');

    auditLog('depop', 'refund_attempt', { purchaseId });
    const result = await depopRequest('POST', `/api/v1/orders/${encodeURIComponent(purchaseId)}/refund/`, accessToken, refundData);

    if (!result.ok) {
        logger.error('[Depop] Refund failed', { purchaseId, status: result.status });
        auditLog('depop', 'refund_failure', { purchaseId, error: JSON.stringify(result.data) });
        throw new Error(`Depop refund failed (${result.status}): ${JSON.stringify(result.data)}`);
    }

    auditLog('depop', 'refund_success', { purchaseId });
    return result.data;
}

/**
 * Get Depop shop details.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @returns {Object} Shop info from Depop API
 */
export async function getDepopShopInfo(shop) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');
    const result = await depopRequest('GET', '/api/v1/shop/', accessToken);
    if (!result.ok) throw new Error(`Depop shop info failed (${result.status})`);
    return result.data;
}

/**
 * Get Depop seller addresses.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @returns {Object} Seller addresses from Depop API
 */
export async function getDepopSellerAddresses(shop) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');
    const result = await depopRequest('GET', '/api/v1/shop/seller-addresses/', accessToken);
    if (!result.ok) throw new Error(`Depop seller addresses failed (${result.status})`);
    return result.data;
}

/**
 * Get available shipping providers for a seller address.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} addressId - The seller address ID
 * @returns {Object} Shipping providers from Depop API
 */
export async function getDepopShippingProviders(shop, addressId) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');
    const result = await depopRequest('GET', `/api/v1/shop/seller-addresses/${encodeURIComponent(addressId)}/shipping-providers/`, accessToken);
    if (!result.ok) throw new Error(`Depop shipping providers failed (${result.status})`);
    return result.data;
}

export default {
    publishListingToDepop, updateDepopListing, deleteDepopListing,
    markDepopListingAsSold, submitDepopOffer, getDepopProduct,
    markDepopOrderShipped, getDepopOrder, refundDepopOrder,
    getDepopShopInfo, getDepopSellerAddresses, getDepopShippingProviders
};
