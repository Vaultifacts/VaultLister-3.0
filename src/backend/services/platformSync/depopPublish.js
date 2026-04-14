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
const CONDITION_MAP = {
    'new':        'NEW',
    'like_new':   'USED_LIKE_NEW',
    'good':       'USED_GOOD',
    'fair':       'USED_FAIR',
    'poor':       'USED_POOR',
    'parts_only': 'USED_POOR'
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
 * Mutating methods (POST/PUT/DELETE) are rate-limited to stay under 20 req/s.
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

    const condition = CONDITION_MAP[inventory.condition?.toLowerCase()] || 'USED_GOOD';
    const description = (listing.description || inventory.description || listing.title || inventory.title || 'Item').slice(0, 1000);
    const photos = resolvePublicImageUrls(inventory.images).map(url => ({ url }));
    if (photos.length === 0) throw new Error('Depop requires at least one public image URL');

    // SKU: max 50 chars, alphanumeric + hyphens/underscores only, cannot be reused after deletion
    const sku = (inventory.sku || `VL-${listing.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50);

    const payload = {
        description,
        price_amount: Math.round(price * 100),
        price_currency: 'USD',
        condition,
        photos,
        sku
    };

    logger.info('[Depop Publish] Creating listing', { sku, price: payload.price_amount });
    const result = await depopRequest('POST', '/v1/listings/', accessToken, payload);

    if (!result.ok) {
        logger.error('[Depop Publish] Create failed', { status: result.status, body: JSON.stringify(result.data) });
        auditLog('depop', 'publish_failure', { listingId: listing.id, error: JSON.stringify(result.data) });
        throw new Error(`Depop listing creation failed (${result.status}): ${JSON.stringify(result.data)}`);
    }

    const depopListingId = result.data.id || result.data.listing_id;
    const listingUrl = result.data.slug
        ? `https://www.depop.com/products/${result.data.slug}/`
        : `https://www.depop.com/products/${depopListingId}/`;

    logger.info('[Depop Publish] Success', { depopListingId, listingUrl });
    auditLog('depop', 'publish_success', { listingId: listing.id, depopListingId, listingUrl });
    return { listingId: depopListingId, listingUrl };
}

/**
 * Update an existing Depop listing.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} depopListingId - The Depop listing ID to update
 * @param {Object} listing - Updated listing row
 * @param {Object} inventory - Updated InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function updateDepopListing(shop, depopListingId, listing, inventory) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token — reconnect via Settings > Integrations');

    auditLog('depop', 'update_attempt', { depopListingId });

    const payload = {};
    if (listing.description || inventory.description) {
        payload.description = (listing.description || inventory.description).slice(0, 1000);
    }
    if (listing.price || inventory.list_price) {
        const price = parseFloat(listing.price || inventory.list_price);
        if (price > 0) payload.price_amount = Math.round(price * 100);
    }
    if (inventory.condition) {
        payload.condition = CONDITION_MAP[inventory.condition.toLowerCase()] || 'USED_GOOD';
    }
    const photos = resolvePublicImageUrls(inventory.images);
    if (photos.length > 0) payload.photos = photos.map(url => ({ url }));

    logger.info('[Depop Publish] Updating listing', { depopListingId });
    const result = await depopRequest('PUT', `/v1/listings/${depopListingId}/`, accessToken, payload);

    if (!result.ok) {
        logger.error('[Depop Publish] Update failed', { status: result.status, body: JSON.stringify(result.data) });
        auditLog('depop', 'update_failure', { depopListingId, error: JSON.stringify(result.data) });
        throw new Error(`Depop listing update failed (${result.status}): ${JSON.stringify(result.data)}`);
    }

    auditLog('depop', 'update_success', { depopListingId });
    return { listingId: depopListingId, listingUrl: `https://www.depop.com/products/${depopListingId}/` };
}

/**
 * Delete a Depop listing.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} depopListingId - The Depop listing ID to delete
 * @returns {boolean} Whether the deletion succeeded
 */
export async function deleteDepopListing(shop, depopListingId) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token — reconnect via Settings > Integrations');

    auditLog('depop', 'delete_attempt', { depopListingId });
    const result = await depopRequest('DELETE', `/v1/listings/${depopListingId}/`, accessToken);

    if (!result.ok) {
        logger.warn('[Depop] Delete failed', { depopListingId, status: result.status });
        auditLog('depop', 'delete_failure', { depopListingId, error: JSON.stringify(result.data) });
        return false;
    }

    auditLog('depop', 'delete_success', { depopListingId });
    return true;
}

/**
 * Mark a Depop listing as sold (cross-platform inventory sync).
 * Call when an item sells on another platform to keep Depop in sync.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} depopListingId - The Depop listing ID to mark as sold
 * @returns {boolean} Whether the mark-as-sold succeeded
 */
export async function markDepopListingAsSold(shop, depopListingId) {
    const accessToken = decryptToken(shop.oauth_token);
    const result = await depopRequest('POST', `/v1/listings/${depopListingId}/mark-as-sold/`, accessToken);
    if (!result.ok) {
        logger.warn('[Depop] mark-as-sold failed', { depopListingId, status: result.status });
    }
    auditLog('depop', 'mark_as_sold', { depopListingId, ok: result.ok });
    return result.ok;
}

/**
 * Fetch offers received on Depop listings.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @returns {Array} List of offers
 */
export async function fetchDepopOffers(shop) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');

    const result = await depopRequest('GET', '/v1/offers/', accessToken);
    if (!result.ok) {
        logger.error('[Depop] Fetch offers failed', { status: result.status });
        throw new Error(`Depop offers fetch failed (${result.status})`);
    }
    auditLog('depop', 'fetch_offers', { count: (result.data.offers || result.data || []).length });
    return result.data.offers || result.data || [];
}

/**
 * Accept an offer on a Depop listing.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} offerId - The Depop offer ID to accept
 * @returns {boolean} Whether the accept succeeded
 */
export async function acceptDepopOffer(shop, offerId) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');

    auditLog('depop', 'accept_offer_attempt', { offerId });
    const result = await depopRequest('POST', `/v1/offers/${offerId}/accept/`, accessToken);
    if (!result.ok) {
        logger.warn('[Depop] Accept offer failed', { offerId, status: result.status });
        auditLog('depop', 'accept_offer_failure', { offerId, error: JSON.stringify(result.data) });
        return false;
    }
    auditLog('depop', 'accept_offer_success', { offerId });
    return true;
}

/**
 * Decline an offer on a Depop listing.
 * @param {Object} shop - Shop row with encrypted oauth_token
 * @param {string} offerId - The Depop offer ID to decline
 * @returns {boolean} Whether the decline succeeded
 */
export async function declineDepopOffer(shop, offerId) {
    const accessToken = decryptToken(shop.oauth_token);
    if (!accessToken) throw new Error('Depop shop has no OAuth token');

    auditLog('depop', 'decline_offer_attempt', { offerId });
    const result = await depopRequest('POST', `/v1/offers/${offerId}/decline/`, accessToken);
    if (!result.ok) {
        logger.warn('[Depop] Decline offer failed', { offerId, status: result.status });
        auditLog('depop', 'decline_offer_failure', { offerId, error: JSON.stringify(result.data) });
        return false;
    }
    auditLog('depop', 'decline_offer_success', { offerId });
    return true;
}

export default {
    publishListingToDepop, updateDepopListing, deleteDepopListing,
    markDepopListingAsSold, fetchDepopOffers, acceptDepopOffer, declineDepopOffer
};
