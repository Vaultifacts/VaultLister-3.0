// eBay Publish Service
// Pushes a local VaultLister listing to eBay via the Sell API
// Flow: inventory_item → merchant policies → offer → publish

import { decryptToken } from '../../utils/encryption.js';
import { logger } from '../../shared/logger.js';
import { fetchWithTimeout } from '../../shared/fetchWithTimeout.js';
import { auditLog } from './platformAuditLog.js';

// Ordered preference lists per VaultLister condition — resolveCondition() walks
// this list and picks the first entry that the category's condition policy allows.
const CONDITION_PREFERENCE = {
    new: ['NEW', 'NEW_OTHER', 'NEW_WITH_DEFECTS'],
    like_new: ['LIKE_NEW', 'USED_EXCELLENT', 'VERY_GOOD_REFURBISHED', 'USED_VERY_GOOD'],
    good: ['USED_EXCELLENT', 'USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE'],
    fair: ['USED_ACCEPTABLE', 'USED_GOOD', 'USED_VERY_GOOD', 'USED_EXCELLENT'],
    poor: ['FOR_PARTS_OR_NOT_WORKING', 'USED_ACCEPTABLE'],
    parts_only: ['FOR_PARTS_OR_NOT_WORKING', 'USED_ACCEPTABLE'],
};

// Fallback leaf category (Men's Clothing > Coats, Jackets & Vests)
const DEFAULT_CATEGORY_ID = '57988';

function getApiBase() {
    const env = process.env.EBAY_ENVIRONMENT || 'production';
    return env === 'production' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
}

// Resolve eBay leaf category ID from a plain-text category string.
// Uses the taxonomy suggestion API; falls back to DEFAULT_CATEGORY_ID on any failure.
async function resolveCategoryId(token, categoryText) {
    if (!categoryText || String(categoryText).match(/^\d+$/)) {
        // Already a numeric ID — use it directly
        return String(categoryText) || DEFAULT_CATEGORY_ID;
    }
    try {
        const result = await ebayRequest(
            'GET',
            `/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(categoryText)}`,
            token,
        );
        const id = result.data?.categorySuggestions?.[0]?.category?.categoryId;
        if (id) {
            logger.info('[eBay Publish] Resolved category', { categoryText, categoryId: id });
            return String(id);
        }
    } catch (e) {
        logger.warn('[eBay Publish] Category suggestion failed, using default', { categoryText, err: e.message });
    }
    return DEFAULT_CATEGORY_ID;
}

// Fetch the set of valid condition enums for a category from the metadata API.
// Returns null on failure so callers can fall back gracefully.
async function getValidConditions(token, categoryId) {
    try {
        const result = await ebayRequest(
            'GET',
            `/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?category_id=${categoryId}`,
            token,
        );
        const conditions = result.data?.itemConditionPolicies?.[0]?.itemConditions;
        if (conditions?.length) {
            return new Set(conditions.map((c) => c.conditionEnum));
        }
    } catch (e) {
        logger.warn('[eBay Publish] Could not fetch condition policies', { categoryId, err: e.message });
    }
    return null;
}

// Pick the best valid eBay condition enum for a VaultLister condition string.
function resolveCondition(vlCondition, validConditions) {
    const candidates = CONDITION_PREFERENCE[vlCondition?.toLowerCase()] || CONDITION_PREFERENCE['good'];
    if (!validConditions) return candidates[0];
    for (const c of candidates) {
        if (validConditions.has(c)) return c;
    }
    // Last resort: first condition the category actually allows
    const first = validConditions.values().next().value;
    return first || 'USED_EXCELLENT';
}

async function ebayRequest(method, path, token, body = null) {
    const url = `${getApiBase()}${path}`;
    const opts = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Content-Language': 'en-US',
            'Accept-Language': 'en-US',
        },
    };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetchWithTimeout(url, { ...opts, timeoutMs: 30000 });
    const text = await resp.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    return { ok: resp.ok, status: resp.status, data };
}

const DEFAULT_LOCATION_KEY = 'vaultlister-default';

async function ensureInventoryLocation(token) {
    // Check if default location already exists
    const checkResult = await ebayRequest('GET', `/sell/inventory/v1/location/${DEFAULT_LOCATION_KEY}`, token);
    if (checkResult.ok) return DEFAULT_LOCATION_KEY;

    // Create default location (only if 404 — any other error let it bubble)
    if (checkResult.status !== 404) {
        logger.warn('[eBay Publish] Unexpected status checking inventory location', { status: checkResult.status });
    }

    logger.info('[eBay Publish] Creating default inventory location');
    const createResult = await ebayRequest('POST', `/sell/inventory/v1/location/${DEFAULT_LOCATION_KEY}`, token, {
        location: {
            address: {
                addressLine1: '123 Main Street',
                city: 'San Jose',
                stateOrProvince: 'CA',
                postalCode: '95101',
                country: 'US',
            },
        },
        name: 'VaultLister Default Location',
        merchantLocationStatus: 'ENABLED',
        locationTypes: ['WAREHOUSE'],
    });

    if (!createResult.ok && createResult.status !== 204) {
        throw new Error(`Could not create inventory location: ${JSON.stringify(createResult.data)}`);
    }

    return DEFAULT_LOCATION_KEY;
}

async function ensureMerchantPolicies(token, marketplaceId = 'EBAY_US') {
    // Opt into Selling Policy Management if not already (required for Business Policies API)
    const optInResult = await ebayRequest('POST', '/sell/account/v1/program/opt_in', token, {
        programType: 'SELLING_POLICY_MANAGEMENT',
    });
    // 200 = success (empty body), 409 = already opted in — both are fine
    if (!optInResult.ok && optInResult.status !== 409) {
        const errMsg = optInResult.data?.errors?.[0]?.longMessage || JSON.stringify(optInResult.data);
        logger.warn('[eBay Publish] Could not opt into Selling Policy Management', {
            status: optInResult.status,
            msg: errMsg,
        });
    }

    const [payment, fulfillment, ret] = await Promise.all([
        ebayRequest('GET', `/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`, token),
        ebayRequest('GET', `/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`, token),
        ebayRequest('GET', `/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`, token),
    ]);

    let paymentPolicyId = payment.data?.paymentPolicies?.[0]?.paymentPolicyId;
    let fulfillmentPolicyId = fulfillment.data?.fulfillmentPolicies?.[0]?.fulfillmentPolicyId;
    let returnPolicyId = ret.data?.returnPolicies?.[0]?.returnPolicyId;

    // Auto-create missing policies (common in fresh sandbox accounts)
    if (!paymentPolicyId) {
        logger.info('[eBay Publish] Creating default payment policy');
        const r = await ebayRequest('POST', '/sell/account/v1/payment_policy', token, {
            name: 'VaultLister Default Payment',
            marketplaceId,
            categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }],
            immediatePay: false,
        });
        if (r.ok && r.data?.paymentPolicyId) {
            paymentPolicyId = r.data.paymentPolicyId;
        } else {
            throw new Error(`Could not create payment policy: ${JSON.stringify(r.data)}`);
        }
    }

    if (!fulfillmentPolicyId) {
        logger.info('[eBay Publish] Creating default fulfillment policy');
        const r = await ebayRequest('POST', '/sell/account/v1/fulfillment_policy', token, {
            name: 'VaultLister Standard Shipping',
            marketplaceId,
            categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }],
            handlingTime: { unit: 'DAY', value: 3 },
            shippingOptions: [
                {
                    optionType: 'DOMESTIC',
                    costType: 'FLAT_RATE',
                    shippingServices: [
                        {
                            shippingCarrierCode: 'USPS',
                            shippingServiceCode: 'USPSFirstClass',
                            buyerResponsibleForShipping: false,
                            shippingCost: { value: '5.99', currency: 'USD' },
                        },
                    ],
                },
            ],
        });
        if (r.ok && r.data?.fulfillmentPolicyId) {
            fulfillmentPolicyId = r.data.fulfillmentPolicyId;
        } else {
            throw new Error(`Could not create fulfillment policy: ${JSON.stringify(r.data)}`);
        }
    }

    if (!returnPolicyId) {
        logger.info('[eBay Publish] Creating default return policy');
        const r = await ebayRequest('POST', '/sell/account/v1/return_policy', token, {
            name: 'VaultLister 30-Day Returns',
            marketplaceId,
            categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }],
            returnsAccepted: true,
            returnPeriod: { unit: 'DAY', value: 30 },
            returnShippingCostPayer: 'SELLER',
            refundMethod: 'MONEY_BACK',
        });
        if (r.ok && r.data?.returnPolicyId) {
            returnPolicyId = r.data.returnPolicyId;
        } else {
            throw new Error(`Could not create return policy: ${JSON.stringify(r.data)}`);
        }
    }

    return { paymentPolicyId, fulfillmentPolicyId, returnPolicyId };
}

/**
 * Publish a VaultLister listing to eBay via the Sell API
 * @param {Object} shop        - Shop row with oauth_token
 * @param {Object} listing     - Listing row
 * @param {Object} inventory   - InventoryItem row
 * @returns {{ offerId, listingId, sku, listingUrl }}
 */
export async function publishListingToEbay(shop, listing, inventory) {
    const accessToken = decryptToken(shop.oauth_token);
    const sku = (inventory.sku || `VL-${listing.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9_-]/g, '-');

    auditLog('ebay', 'publish_attempt', { listingId: listing.id, sku });

    try {
        // Step 1: Create/update eBay inventory item
        const title = (listing.title || inventory.title || 'Item from VaultLister').slice(0, 80);
        const description = listing.description || inventory.description || title;

        // Resolve category — numeric IDs pass through, text labels get looked up via suggestion API
        const categoryId = await resolveCategoryId(
            accessToken,
            listing.category_path || inventory.category || DEFAULT_CATEGORY_ID,
        );

        // Resolve condition — pick best valid option for the resolved category
        const validConditions = await getValidConditions(accessToken, categoryId);
        const condition = resolveCondition(inventory.condition, validConditions);
        logger.info('[eBay Publish] Resolved condition', {
            input: inventory.condition,
            resolved: condition,
            categoryId,
        });

        // Build item aspects — required fields vary by eBay category.
        // We start with brand (universally required) then fetch required aspects for the
        // resolved category and populate from inventory fields where possible.
        const aspects = {
            Brand: [inventory.brand || 'Unbranded'],
        };

        // Inventory field → eBay aspect name mapping (lowercase keys for matching)
        const INVENTORY_ASPECT_MAP = {
            color: inventory.color,
            size: inventory.size,
            'outer shell material': inventory.material,
            material: inventory.material,
            department: inventory.gender || 'Men',
            'size type': 'Regular',
            style: inventory.style || 'Casual',
            type: inventory.item_type || 'Jacket',
            pattern: inventory.pattern || 'Solid',
            fit: inventory.fit || 'Regular',
            length: inventory.length || 'Regular',
            neckline: 'Collar',
            'sleeve length': inventory.sleeve_length || 'Long Sleeve',
            closure: 'Button',
            theme: 'Classic',
        };

        // Fetch required aspects for the resolved category and fill in what we can
        try {
            const aspectsResult = await ebayRequest(
                'GET',
                `/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`,
                accessToken,
            );
            const aspectMeta = aspectsResult.data?.aspects || [];
            for (const aspect of aspectMeta) {
                if (aspect.aspectConstraint?.aspectRequired !== true) continue;
                const name = aspect.localizedAspectName;
                if (aspects[name]) continue; // already set
                const key = name.toLowerCase();
                const value = INVENTORY_ASPECT_MAP[key];
                if (value) {
                    aspects[name] = [value];
                } else if (aspect.aspectValues?.length) {
                    // Pick the first allowed value as a fallback
                    aspects[name] = [aspect.aspectValues[0].localizedValue];
                }
            }
        } catch (e) {
            logger.warn('[eBay Publish] Could not fetch required aspects, using available fields only', {
                categoryId,
                err: e.message,
            });
        }

        const inventoryPayload = {
            availability: {
                shipToLocationAvailability: {
                    quantity: Math.max(1, parseInt(inventory.quantity) || 1),
                },
            },
            condition,
            product: {
                title,
                description,
                aspects,
            },
        };

        logger.info('[eBay Publish] Creating inventory item', { sku });
        const invResult = await ebayRequest(
            'PUT',
            `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
            accessToken,
            inventoryPayload,
        );
        // eBay returns 204 No Content on success for PUT inventory_item
        if (!invResult.ok && invResult.status !== 204) {
            throw new Error(`eBay inventory item error (${invResult.status}): ${JSON.stringify(invResult.data)}`);
        }

        // Step 2: Ensure inventory location and merchant account policies exist
        logger.info('[eBay Publish] Ensuring inventory location');
        const locationKey = await ensureInventoryLocation(accessToken);

        logger.info('[eBay Publish] Getting merchant policies');
        const policies = await ensureMerchantPolicies(accessToken);

        // Step 3: Create offer
        const price = parseFloat(listing.price || inventory.list_price || 0);
        if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

        const offerPayload = {
            sku,
            marketplaceId: 'EBAY_US',
            format: 'FIXED_PRICE',
            availableQuantity: Math.max(1, parseInt(inventory.quantity) || 1),
            categoryId,
            listingDescription: description,
            listingPolicies: {
                paymentPolicyId: policies.paymentPolicyId,
                returnPolicyId: policies.returnPolicyId,
                fulfillmentPolicyId: policies.fulfillmentPolicyId,
            },
            pricingSummary: {
                price: { value: price.toFixed(2), currency: 'USD' },
            },
            merchantLocationKey: locationKey,
        };

        logger.info('[eBay Publish] Creating offer', { sku, price });
        let offerResult = await ebayRequest('POST', '/sell/inventory/v1/offer', accessToken, offerPayload);

        let offerId;
        if (offerResult.ok) {
            offerId = offerResult.data.offerId;
            if (!offerId) throw new Error('eBay offer created but no offerId returned');
        } else if (offerResult.status === 400 && offerResult.data?.errors?.[0]?.parameters?.[0]?.name === 'offerId') {
            // Offer already exists — fetch it by SKU
            offerId = offerResult.data.errors[0].parameters[0].value;
            logger.info('[eBay Publish] Offer already exists, reusing', { offerId });

            // Update the existing offer with latest details (PUT /offer/:id)
            const updateResult = await ebayRequest(
                'PUT',
                `/sell/inventory/v1/offer/${offerId}`,
                accessToken,
                offerPayload,
            );
            if (!updateResult.ok && updateResult.status !== 204) {
                logger.warn('[eBay Publish] Could not update existing offer', { status: updateResult.status });
            }
        } else {
            throw new Error(`eBay offer error (${offerResult.status}): ${JSON.stringify(offerResult.data)}`);
        }

        // Step 4: Publish the offer (goes live)
        // Pre-check: fetch offer state to surface any eBay validation warnings
        const offerCheck = await ebayRequest('GET', `/sell/inventory/v1/offer/${offerId}`, accessToken);
        if (offerCheck.ok) {
            const warnings = offerCheck.data?.warnings;
            if (warnings?.length) logger.warn('[eBay Publish] Offer warnings', { warnings });
            logger.info('[eBay Publish] Offer state', {
                status: offerCheck.data?.status,
                categoryId: offerCheck.data?.categoryId,
                marketplaceId: offerCheck.data?.marketplaceId,
                locationKey: offerCheck.data?.merchantLocationKey,
                paymentPolicyId: offerCheck.data?.listingPolicies?.paymentPolicyId,
                fulfillmentPolicyId: offerCheck.data?.listingPolicies?.fulfillmentPolicyId,
                returnPolicyId: offerCheck.data?.listingPolicies?.returnPolicyId,
            });
        }

        logger.info('[eBay Publish] Publishing offer', { offerId });
        const publishResult = await ebayRequest('POST', `/sell/inventory/v1/offer/${offerId}/publish`, accessToken, {
            marketplaceId: 'EBAY_US',
        });
        if (!publishResult.ok) {
            logger.error('[eBay Publish] Full publish error response', { body: JSON.stringify(publishResult.data) });
            throw new Error(`eBay publish error (${publishResult.status}): ${JSON.stringify(publishResult.data)}`);
        }

        const listingId = publishResult.data.listingId;
        const env = process.env.EBAY_ENVIRONMENT || 'production';
        const listingUrl =
            env === 'production'
                ? `https://www.ebay.com/itm/${listingId}`
                : `https://www.sandbox.ebay.com/itm/${listingId}`;

        logger.info('[eBay Publish] Success', { sku, offerId, listingId, listingUrl });
        auditLog('ebay', 'publish_success', { listingId, listingUrl, offerId, sku });

        return { offerId, listingId, sku, listingUrl };
    } catch (err) {
        auditLog('ebay', 'publish_failure', { listingId: listing.id, sku, error: err.message });
        throw err;
    }
}

export default { publishListingToEbay };
