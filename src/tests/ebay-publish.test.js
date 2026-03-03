// Tests for dynamic category + condition resolution in ebayPublish.js
// Verifies non-clothing categories (electronics, bags, shoes) resolve correctly
// and that condition preference lists walk correctly against valid condition sets.

import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';

mock.module('../backend/utils/encryption.js', () => ({
    decryptToken: (token) => token,
    encryptToken: (token) => token
}));

mock.module('../backend/shared/logger.js', () => ({
    logger: { info: mock(), warn: mock(), error: mock() }
}));

const { publishListingToEbay } = await import('../backend/services/platformSync/ebayPublish.js');

// ---- helpers ----------------------------------------------------------------

function jsonResp(data, status = 200) {
    return { ok: status < 400, status, text: async () => JSON.stringify(data) };
}

// Build a fetch mock that matches URL substrings in order.
// If nothing matches, returns 200 {}
function buildFetch(routes) {
    return mock(async (url, opts = {}) => {
        for (const [pattern, handler] of routes) {
            if (url.includes(pattern)) {
                return typeof handler === 'function' ? handler(url, opts) : handler;
            }
        }
        return jsonResp({});
    });
}

// Minimal happy-path eBay sandbox stubs (all required sub-flows)
function happyPathRoutes(overrides = {}) {
    const defaults = [
        ['get_category_suggestions',        jsonResp({ categorySuggestions: [{ category: { categoryId: '171485' } }] })],
        ['get_item_condition_policies',      jsonResp({ itemConditionPolicies: [{ itemConditions: [
            { conditionEnum: 'USED_EXCELLENT' }, { conditionEnum: 'USED_VERY_GOOD' },
            { conditionEnum: 'USED_GOOD' },      { conditionEnum: 'USED_ACCEPTABLE' }
        ]}]})],
        ['get_item_aspects_for_category',    jsonResp({ aspects: [] })],
        ['inventory_item',                   { ok: true, status: 204, text: async () => '' }],
        ['/location/vaultlister-default',    { ok: true, status: 200, text: async () => '{"location_key":"vaultlister-default"}' }],
        ['opt_in',                           jsonResp({})],
        ['payment_policy',                   jsonResp({ paymentPolicies:     [{ paymentPolicyId:     'pay-1' }] })],
        ['fulfillment_policy',               jsonResp({ fulfillmentPolicies: [{ fulfillmentPolicyId: 'ful-1' }] })],
        ['return_policy',                    jsonResp({ returnPolicies:      [{ returnPolicyId:      'ret-1' }] })],
        // /publish must come before /offer — the publish URL contains /offer/ as a prefix
        ['/publish',                         jsonResp({ listingId: 'listing-456' })],
        ['/offer',                           (url, opts) => opts?.method === 'POST'
            ? jsonResp({ offerId: 'offer-123' })
            : jsonResp({})],
    ];
    const map = new Map(defaults);
    for (const [k, v] of Object.entries(overrides)) map.set(k, v);
    return [...map.entries()];
}

function makeShop()   { return { oauth_token: 'sandbox-token' }; }
function makeListing(overrides = {}) {
    return { id: 'listing-1', title: 'Test Item', price: '49.99', description: 'Test description', ...overrides };
}
function makeInventory(overrides = {}) {
    return { title: 'Test Item', condition: 'good', quantity: 1, brand: 'TestBrand', category: 'Test Category', sku: 'VL-test-001', ...overrides };
}

// ---- tests ------------------------------------------------------------------

describe('publishListingToEbay — dynamic category resolution', () => {
    let originalFetch;
    beforeEach(() => { originalFetch = globalThis.fetch; process.env.EBAY_ENVIRONMENT = 'sandbox'; });
    afterEach(() => { globalThis.fetch = originalFetch; });

    test('calls taxonomy suggestion API for non-clothing text category', async () => {
        const capturedUrls = [];
        globalThis.fetch = buildFetch([
            ['get_category_suggestions', (url) => {
                capturedUrls.push(url);
                return jsonResp({ categorySuggestions: [{ category: { categoryId: '171485' } }] });
            }],
            ...happyPathRoutes().slice(1)
        ]);

        await publishListingToEbay(makeShop(), makeListing(), makeInventory({ category: 'Video Game Consoles' }));

        const suggestCall = capturedUrls[0];
        expect(suggestCall).toBeTruthy();
        expect(suggestCall).toContain('get_category_suggestions');
        expect(decodeURIComponent(suggestCall)).toContain('Video Game Consoles');
    });

    test('passes numeric category IDs directly without API lookup', async () => {
        const capturedUrls = [];
        globalThis.fetch = buildFetch([
            ['get_category_suggestions', (url) => {
                capturedUrls.push(url);
                return jsonResp({ categorySuggestions: [] });
            }],
            ...happyPathRoutes().slice(1)
        ]);

        await publishListingToEbay(makeShop(), makeListing(), makeInventory({ category: '171485' }));

        // suggestion API should NOT be called for numeric categories
        expect(capturedUrls.length).toBe(0);
    });

    test('falls back to default category when taxonomy API throws', async () => {
        globalThis.fetch = buildFetch([
            ['get_category_suggestions', () => { throw new Error('network error'); }],
            ...happyPathRoutes().slice(1)
        ]);

        // Should complete successfully using DEFAULT_CATEGORY_ID fallback
        const result = await publishListingToEbay(makeShop(), makeListing(), makeInventory({ category: 'Unknown Gadget' }));
        expect(result.listingId).toBe('listing-456');
    });

    test('falls back to default category when taxonomy API returns empty', async () => {
        globalThis.fetch = buildFetch([
            ['get_category_suggestions', jsonResp({ categorySuggestions: [] })],
            ...happyPathRoutes().slice(1)
        ]);

        const result = await publishListingToEbay(makeShop(), makeListing(), makeInventory({ category: 'Mystical Items' }));
        expect(result.listingId).toBe('listing-456');
    });
});

describe('publishListingToEbay — dynamic condition resolution', () => {
    let originalFetch;
    beforeEach(() => { originalFetch = globalThis.fetch; process.env.EBAY_ENVIRONMENT = 'sandbox'; });
    afterEach(() => { globalThis.fetch = originalFetch; });

    async function runWithConditionSet(vlCondition, validConditionEnums) {
        let sentCondition;
        globalThis.fetch = buildFetch([
            ...happyPathRoutes({
                'get_item_condition_policies': jsonResp({ itemConditionPolicies: [{
                    itemConditions: validConditionEnums.map(e => ({ conditionEnum: e }))
                }]}),
                'inventory_item': (url, opts) => {
                    if (opts?.body) sentCondition = JSON.parse(opts.body).condition;
                    return { ok: true, status: 204, text: async () => '' };
                }
            })
        ]);

        await publishListingToEbay(makeShop(), makeListing(), makeInventory({ condition: vlCondition }));
        return sentCondition;
    }

    test('"good" condition picks USED_EXCELLENT when available', async () => {
        const sent = await runWithConditionSet('good', ['USED_EXCELLENT', 'USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE']);
        expect(sent).toBe('USED_EXCELLENT');
    });

    test('"good" condition skips unavailable conditions and picks first valid', async () => {
        // Category only allows USED_GOOD and USED_ACCEPTABLE — USED_EXCELLENT not in set
        const sent = await runWithConditionSet('good', ['USED_GOOD', 'USED_ACCEPTABLE']);
        expect(sent).toBe('USED_GOOD');
    });

    test('"like_new" condition prefers LIKE_NEW over USED_EXCELLENT', async () => {
        const sent = await runWithConditionSet('like_new', ['LIKE_NEW', 'USED_EXCELLENT', 'USED_VERY_GOOD']);
        expect(sent).toBe('LIKE_NEW');
    });

    test('"poor" condition picks FOR_PARTS_OR_NOT_WORKING when available', async () => {
        const sent = await runWithConditionSet('poor', ['FOR_PARTS_OR_NOT_WORKING', 'USED_ACCEPTABLE']);
        expect(sent).toBe('FOR_PARTS_OR_NOT_WORKING');
    });

    test('"poor" condition falls back to USED_ACCEPTABLE when FOR_PARTS not in valid set', async () => {
        const sent = await runWithConditionSet('poor', ['USED_ACCEPTABLE', 'USED_GOOD']);
        expect(sent).toBe('USED_ACCEPTABLE');
    });

    test('"new" condition picks NEW when available', async () => {
        const sent = await runWithConditionSet('new', ['NEW', 'NEW_OTHER', 'NEW_WITH_DEFECTS']);
        expect(sent).toBe('NEW');
    });

    test('unknown condition string defaults to good preference list', async () => {
        const sent = await runWithConditionSet('mint', ['USED_EXCELLENT', 'USED_GOOD']);
        expect(sent).toBe('USED_EXCELLENT');
    });

    test('uses first valid condition as last resort when nothing in preference list matches', async () => {
        // 'fair' preference: USED_ACCEPTABLE, USED_GOOD, USED_VERY_GOOD, USED_EXCELLENT
        // but valid set is completely different
        const sent = await runWithConditionSet('fair', ['NEW', 'NEW_OTHER']);
        // Should pick the first condition the category allows as last resort
        expect(sent).toBe('NEW');
    });

    test('uses first preference entry when valid conditions returns null (API failed)', async () => {
        let sentCondition;
        globalThis.fetch = buildFetch([
            ...happyPathRoutes({
                'get_item_condition_policies': () => { throw new Error('API error'); },
                'inventory_item': (url, opts) => {
                    if (opts?.body) sentCondition = JSON.parse(opts.body).condition;
                    return { ok: true, status: 204, text: async () => '' };
                }
            })
        ]);
        await publishListingToEbay(makeShop(), makeListing(), makeInventory({ condition: 'like_new' }));
        // No valid conditions filter → picks first entry from CONDITION_PREFERENCE['like_new']
        expect(sentCondition).toBe('LIKE_NEW');
    });
});

describe('publishListingToEbay — happy path', () => {
    let originalFetch;
    beforeEach(() => { originalFetch = globalThis.fetch; process.env.EBAY_ENVIRONMENT = 'sandbox'; });
    afterEach(() => { globalThis.fetch = originalFetch; });

    test('returns offerId, listingId, sku, listingUrl on success', async () => {
        globalThis.fetch = buildFetch(happyPathRoutes());
        const result = await publishListingToEbay(makeShop(), makeListing(), makeInventory());
        expect(result).toHaveProperty('offerId', 'offer-123');
        expect(result).toHaveProperty('listingId', 'listing-456');
        expect(result).toHaveProperty('sku');
        expect(result).toHaveProperty('listingUrl');
        expect(result.listingUrl).toContain('listing-456');
    });

    test('throws when price is zero', async () => {
        globalThis.fetch = buildFetch(happyPathRoutes());
        await expect(
            publishListingToEbay(makeShop(), makeListing({ price: '0' }), makeInventory())
        ).rejects.toThrow('price must be greater than zero');
    });

    test('sandbox URL contains sandbox.ebay.com', async () => {
        globalThis.fetch = buildFetch(happyPathRoutes());
        const result = await publishListingToEbay(makeShop(), makeListing(), makeInventory());
        expect(result.listingUrl).toContain('sandbox.ebay.com');
    });

    test('production URL contains www.ebay.com', async () => {
        process.env.EBAY_ENVIRONMENT = 'production';
        globalThis.fetch = buildFetch(happyPathRoutes());
        const result = await publishListingToEbay(makeShop(), makeListing(), makeInventory());
        expect(result.listingUrl).toContain('www.ebay.com');
        process.env.EBAY_ENVIRONMENT = 'sandbox';
    });
});
