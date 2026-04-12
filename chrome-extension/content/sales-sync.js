// sales-sync.js — Poshmark sold-order detection content script for VaultLister Extension
// Runs on poshmark.com/sold-orders* and poshmark.com/order/* pages.
// Scrapes sold order data and reports to the backend via the service worker.
// Backend deduplicates by platform_order_id so this is safe to run on every page load.
//
// Selector notes: verify against live Poshmark if scraping breaks:
//   - Sold orders list:  [data-et-name="sold_order_tile"], .order-listing-card
//   - Order title:       .order-listing-card__title, [data-et-name="item_title"]
//   - Order price:       .order-listing-card__price, [data-et-name="sale_price"]
//   - Buyer username:    [data-et-name="buyer_username"], .order__buyer .username
//   - Order ID:          [data-order-id], .order-id, in the page URL /order/{id}
//   - Single order URL:  /order/{orderId}

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────────

function parsePrice(text) {
    if (!text) return null;
    var n = parseFloat(text.replace(/[^0-9.]/g, ''));
    return isFinite(n) && n > 0 ? n : null;
}

function extractText(el) {
    return el ? el.textContent.trim() : null;
}

function findIn(root, selectors) {
    for (var i = 0; i < selectors.length; i++) {
        var el = root.querySelector(selectors[i]);
        if (el) return el;
    }
    return null;
}

// ── Order extraction ─────────────────────────────────────────────────────────────────────────────

// Extract order ID from a URL like /order/abc123 or a data attribute
function extractOrderId(url, tileEl) {
    // From URL
    var match = url && url.match(/\/order\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    // From data attribute
    if (tileEl) {
        var id = tileEl.dataset.orderId || tileEl.dataset.id ||
            tileEl.getAttribute('data-order-id');
        if (id) return id;
    }
    return null;
}

// Parse a single order tile element (sold orders list page)
function parseTile(tile) {
    var titleEl = findIn(tile, [
        '[data-et-name="item_title"]',
        '.order-listing-card__title',
        '.item-title',
        '.order-title',
        'h4'
    ]);
    var priceEl = findIn(tile, [
        '[data-et-name="sale_price"]',
        '.order-listing-card__price',
        '.order-price',
        '.price'
    ]);
    var buyerEl = findIn(tile, [
        '[data-et-name="buyer_username"]',
        '.order__buyer .username',
        '.buyer-username',
        '[class*="buyer"] .username'
    ]);
    var orderLinkEl = findIn(tile, ['a[href*="/order/"]', 'a']);
    var listingLinkEl = findIn(tile, ['a[href*="/listing/"]']);

    var title = extractText(titleEl);
    var priceText = extractText(priceEl);
    var sale_price = parsePrice(priceText);
    var buyer_username = extractText(buyerEl);
    var href = orderLinkEl ? orderLinkEl.getAttribute('href') : null;
    // Populate listing_url so the backend can match to a cross-listed item
    // and mark its inventory sold. Without this, bulk-page sales stay unmatched.
    var listing_url = listingLinkEl ? (listingLinkEl.href || listingLinkEl.getAttribute('href')) : null;

    // Order URL (used as platform_order_id source)
    var orderUrl = href && href.includes('/order/') ? href : window.location.href;
    var platform_order_id = extractOrderId(orderUrl, tile);

    if (!platform_order_id || !sale_price) return null;

    return {
        platform: 'poshmark',
        platform_order_id: platform_order_id,
        title: title,
        sale_price: sale_price,
        buyer_username: buyer_username,
        listing_url: listing_url
    };
}

// Parse the single-order detail page
function parseSingleOrderPage() {
    var platform_order_id = extractOrderId(window.location.href, null);
    if (!platform_order_id) return null;

    var titleEl = findIn(document, [
        '[data-et-name="item_title"]',
        '.order-listing-card__title',
        '.listing__title',
        'h2[class*="title"]',
        'h1'
    ]);
    var priceEl = findIn(document, [
        '[data-et-name="sale_price"]',
        '[data-et-name="order_total"]',
        '.order-summary__earnings',
        '.order-price',
        '.price--sale'
    ]);
    var buyerEl = findIn(document, [
        '[data-et-name="buyer_username"]',
        '.order__buyer .username',
        '[class*="buyer"] .username'
    ]);
    var listingLinkEl = findIn(document, ['a[href*="/listing/"]']);

    var title = extractText(titleEl);
    var sale_price = parsePrice(extractText(priceEl));
    var buyer_username = extractText(buyerEl);
    var listing_url = listingLinkEl
        ? (listingLinkEl.href || listingLinkEl.getAttribute('href'))
        : null;

    if (!platform_order_id || !sale_price) return null;

    return {
        platform: 'poshmark',
        platform_order_id: platform_order_id,
        title: title,
        sale_price: sale_price,
        buyer_username: buyer_username,
        listing_url: listing_url
    };
}

// ── Report to service worker ──────────────────────────────────────────────────────────────────────

// Promise-wrapped so callers can await each report and avoid bursting the extension endpoint.
function reportSale(saleData) {
    return new Promise(function(resolve) {
        try {
            chrome.runtime.sendMessage({ action: 'saleDetected', data: saleData }, function(response) {
                if (chrome.runtime.lastError) { resolve(null); return; }
                if (response && response.success && !response.result?.duplicate) {
                    console.info('[VaultLister] Sale synced:', saleData.platform_order_id,
                        'price:', saleData.sale_price, 'linked inventory:', !!response.result?.inventoryId);
                }
                resolve(response);
            });
        } catch (e) {
            resolve(null);
        }
    });
}

// ── Page handlers ─────────────────────────────────────────────────────────────────────────────────

async function handleSoldOrdersPage() {
    var tileSels = [
        '[data-et-name="sold_order_tile"]',
        '.order-listing-card',
        '.sold-item',
        '.order-tile'
    ];
    var tiles = [];
    for (var i = 0; i < tileSels.length; i++) {
        tiles = Array.from(document.querySelectorAll(tileSels[i]));
        if (tiles.length > 0) break;
    }

    // Sequential: avoid bursting 20+ concurrent fetches through the service worker
    // (which would trip the backend /api/extension rate limit).
    for (var j = 0; j < tiles.length; j++) {
        var order = parseTile(tiles[j]);
        if (order) {
            await reportSale(order);
        }
    }
}

async function handleSingleOrderPage() {
    var order = parseSingleOrderPage();
    if (order) await reportSale(order);
}

// ── Entry point ───────────────────────────────────────────────────────────────────────────────────

function init() {
    var path = window.location.pathname;
    if (path.startsWith('/sold-orders')) {
        handleSoldOrdersPage();
    } else if (/^\/order\//.test(path)) {
        handleSingleOrderPage();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
