// Etsy Publish Service
// Pushes a local VaultLister listing to Etsy via the Listings API v3
// Flow: resolve shop → ensure shipping profile → create listing → activate

import { decryptToken } from '../../utils/encryption.js';
import { logger } from '../../shared/logger.js';
import { auditLog } from './platformAuditLog.js';

const ETSY_API_BASE = 'https://openapi.etsy.com';

// Etsy "who_made" + "when_made" defaults — required fields with no direct inventory equivalent
const DEFAULT_WHO_MADE = 'someone_else';  // reseller default
const DEFAULT_WHEN_MADE = 'made_to_order'; // Etsy requires a value even for resale

// Maps VaultLister condition to Etsy condition string (used in description / not a formal field)
const CONDITION_LABEL = {
    'new':        'New with tags',
    'like_new':   'Like new — never worn',
    'good':       'Good used condition',
    'fair':       'Fair condition — some wear',
    'poor':       'Poor condition — see photos',
    'parts_only': 'For parts only'
};

async function etsyRequest(method, path, token, body = null) {
    const url = `${ETSY_API_BASE}${path}`;
    const opts = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-api-key': process.env.ETSY_CLIENT_ID || ''
        }
    };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(url, opts);
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return { ok: resp.ok, status: resp.status, data };
}

// Get the seller's Etsy shop_id — needed for all shop-scoped endpoints
async function resolveShopId(token) {
    const meResult = await etsyRequest('GET', '/v3/application/users/me', token);
    if (!meResult.ok) throw new Error(`Etsy user fetch failed (${meResult.status}): ${JSON.stringify(meResult.data)}`);

    const userId = meResult.data.user_id;
    if (!userId) throw new Error('Etsy user_id not found in /users/me response');

    const shopsResult = await etsyRequest('GET', `/v3/application/users/${userId}/shops`, token);
    if (!shopsResult.ok) throw new Error(`Etsy shops fetch failed (${shopsResult.status}): ${JSON.stringify(shopsResult.data)}`);

    const shopId = shopsResult.data.shop_id || shopsResult.data.results?.[0]?.shop_id;
    if (!shopId) throw new Error('No Etsy shop found for this account. Create a shop at etsy.com first.');

    return String(shopId);
}

// Get (or create a minimal default) shipping profile for the shop
async function ensureShippingProfileId(token, shopId) {
    const result = await etsyRequest('GET', `/v3/application/shops/${shopId}/shipping-profiles`, token);
    const profiles = result.data?.results || result.data?.shipping_profiles;

    if (Array.isArray(profiles) && profiles.length > 0) {
        return profiles[0].shipping_profile_id;
    }

    // Create a minimal free shipping profile as fallback
    logger.info('[Etsy Publish] No shipping profiles found, creating default');
    const createResult = await etsyRequest(
        'POST',
        `/v3/application/shops/${shopId}/shipping-profiles`,
        token,
        {
            title: 'VaultLister Default Shipping',
            origin_country_iso: 'US',
            primary_cost: { amount: 599, divisor: 100, currency_code: 'USD' }, // $5.99
            secondary_cost: { amount: 0, divisor: 100, currency_code: 'USD' },
            destination_region: 'none',
            destination_country_iso: 'US',
            processing_time: 3,
            processing_time_unit: 'business_days'
        }
    );

    const newId = createResult.data?.shipping_profile_id;
    if (!newId) throw new Error(`Could not create Etsy shipping profile: ${JSON.stringify(createResult.data)}`);
    return newId;
}

/**
 * Publish a VaultLister listing to Etsy via the Listings API v3
 * @param {Object} shop      - Shop row with oauth_token and platform_user_id
 * @param {Object} listing   - Listing row
 * @param {Object} inventory - InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function publishListingToEtsy(shop, listing, inventory) {
    const accessToken = decryptToken(shop.oauth_token);

    const title = (listing.title || inventory.title || 'Item from VaultLister').slice(0, 140);
    const price = parseFloat(listing.price || inventory.list_price || 0);
    if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

    auditLog('etsy', 'publish_attempt', { listingId: listing.id });

    try {

    const conditionLabel = CONDITION_LABEL[inventory.condition?.toLowerCase()] || '';
    const description = [
        listing.description || inventory.description || title,
        conditionLabel ? `\n\nCondition: ${conditionLabel}` : '',
        inventory.brand ? `\nBrand: ${inventory.brand}` : '',
        inventory.size  ? `\nSize: ${inventory.size}`   : ''
    ].join('').trim().slice(0, 5000);

    logger.info('[Etsy Publish] Resolving shop ID');
    const shopId = await resolveShopId(accessToken);

    logger.info('[Etsy Publish] Ensuring shipping profile', { shopId });
    const shippingProfileId = await ensureShippingProfileId(accessToken, shopId);

    const listingPayload = {
        quantity: Math.max(1, parseInt(inventory.quantity) || 1),
        title,
        description,
        price: parseFloat(price.toFixed(2)),
        who_made: DEFAULT_WHO_MADE,
        when_made: DEFAULT_WHEN_MADE,
        taxonomy_id: 0,          // 0 = uncategorized; sellers should update via Etsy UI
        is_supply: false,
        type: 'physical',
        shipping_profile_id: shippingProfileId,
        state: 'active'
    };

    logger.info('[Etsy Publish] Creating listing', { shopId, title: listingPayload.title });
    const createResult = await etsyRequest(
        'POST',
        `/v3/application/shops/${shopId}/listings`,
        accessToken,
        listingPayload
    );

    if (!createResult.ok) {
        throw new Error(`Etsy listing error (${createResult.status}): ${JSON.stringify(createResult.data)}`);
    }

    const listingId = String(createResult.data.listing_id);
    const listingUrl = createResult.data.url || `https://www.etsy.com/listing/${listingId}`;

    logger.info('[Etsy Publish] Success', { shopId, listingId, listingUrl });
    auditLog('etsy', 'publish_success', { listingId, listingUrl });

    return { listingId, listingUrl };

    } catch (err) {
        auditLog('etsy', 'publish_failure', { listingId: listing.id, error: err.message });
        throw err;
    }
}

export default { publishListingToEtsy };
