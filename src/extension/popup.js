// VaultLister Chrome Extension — Popup Controller

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let serverUrl = 'http://localhost:3000';
let apiToken = '';
let lastImportedId = null;

// Load saved settings
chrome.storage.local.get(['vl_server_url', 'vl_api_token'], (data) => {
    if (data.vl_server_url) {
        serverUrl = data.vl_server_url;
        $('#server-url').value = serverUrl;
    }
    if (data.vl_api_token) {
        apiToken = data.vl_api_token;
        $('#api-token').value = apiToken;
        testConnection();
    }
});

// Connect button
$('#connect-btn').addEventListener('click', async () => {
    serverUrl = $('#server-url').value.replace(/\/+$/, '');
    apiToken = $('#api-token').value.trim();

    chrome.storage.local.set({
        vl_server_url: serverUrl,
        vl_api_token: apiToken,
    });

    await testConnection();
});

// Import listing from current page
$('#scrape-btn').addEventListener('click', async () => {
    const btn = $('#scrape-btn');
    btn.textContent = 'Scraping...';
    btn.disabled = true;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeListing,
        });

        const listing = results[0]?.result;
        if (!listing || !listing.title) {
            showResult('#scrape-result', 'Could not extract listing data from this page.', false);
            return;
        }

        // Send to VaultLister API
        const response = await apiFetch('/api/inventory', {
            method: 'POST',
            body: JSON.stringify({
                title: listing.title,
                description: listing.description,
                price: listing.price,
                images: listing.images,
                source_platform: listing.platform,
                source_url: listing.url,
                brand: listing.brand,
                size: listing.size,
                condition: listing.condition,
                category: listing.category,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            lastImportedId = data.id || data.item?.id;
            showResult(
                '#scrape-result',
                `Imported: ${listing.title}\nPlatform: ${listing.platform}\nPrice: $${listing.price || '—'}`,
                true,
            );
            $('#crosslist-btn').disabled = false;
        } else {
            const err = await response.text();
            showResult('#scrape-result', `Import failed: ${err}`, false);
        }
    } catch (e) {
        showResult('#scrape-result', `Error: ${e.message}`, false);
    } finally {
        btn.textContent = 'Import Current Listing';
        btn.disabled = false;
    }
});

// Platform checkbox changes
$$('#platforms input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
        const anyChecked = [...$$('#platforms input[type="checkbox"]')].some((c) => c.checked);
        $('#crosslist-btn').disabled = !anyChecked || !lastImportedId;
    });
});

// Cross-list button
$('#crosslist-btn').addEventListener('click', async () => {
    if (!lastImportedId) return;

    const platforms = [...$$('#platforms input[type="checkbox"]:checked')].map((c) => c.value);
    if (!platforms.length) return;

    const btn = $('#crosslist-btn');
    btn.textContent = 'Cross-listing...';
    btn.disabled = true;

    const results = [];
    for (const platform of platforms) {
        try {
            const res = await apiFetch(`/api/listings/${lastImportedId}/publish-${platform}`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            results.push(`${platform}: ${res.ok ? 'OK' : res.status}`);
        } catch (e) {
            results.push(`${platform}: ${e.message}`);
        }
    }

    showResult('#crosslist-result', results.join('\n'), true);
    btn.textContent = 'Cross-List to Selected';
    btn.disabled = false;
});

// Open app link
$('#open-app-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: serverUrl });
});

// --- Helpers ---

async function testConnection() {
    try {
        const res = await apiFetch('/api/auth/me');
        if (res.ok) {
            setConnected(true);
            $('#settings-section').classList.add('hidden');
            $('#import-section').classList.remove('hidden');
        } else {
            setConnected(false);
        }
    } catch {
        setConnected(false);
    }
}

function setConnected(connected) {
    const bar = $('#connection-status');
    const text = $('#status-text');
    if (connected) {
        bar.className = 'status-bar status-connected';
        text.textContent = 'Connected to VaultLister';
    } else {
        bar.className = 'status-bar status-disconnected';
        text.textContent = 'Not connected';
        $('#settings-section').classList.remove('hidden');
        $('#import-section').classList.add('hidden');
    }
}

async function apiFetch(path, options = {}) {
    return fetch(`${serverUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
            ...(options.headers || {}),
        },
    });
}

function showResult(selector, message, success) {
    const el = $(selector);
    el.textContent = message;
    el.className = `result-box ${success ? 'result-success' : 'result-error'}`;
    el.classList.remove('hidden');
}

// Content script function — injected into the active tab
function scrapeListing() {
    const url = window.location.href;
    const host = window.location.hostname;
    const result = {
        url,
        platform: 'unknown',
        title: '',
        description: '',
        price: null,
        images: [],
        brand: '',
        size: '',
        condition: '',
        category: '',
    };

    // Detect platform
    if (host === 'poshmark.com' || host.endsWith('.poshmark.com') || host.includes('poshmark')) {
        result.platform = 'poshmark';
        result.title =
            document.querySelector('[data-test="listing-title"], .listing__title')?.textContent?.trim() || '';
        result.description =
            document.querySelector('[data-test="listing-description"], .listing__description')?.textContent?.trim() ||
            '';
        const priceEl = document.querySelector('[data-test="listing-price"], .listing__price');
        result.price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) : null;
        result.brand = document.querySelector('[data-test="listing-brand"]')?.textContent?.trim() || '';
        result.size = document.querySelector('[data-test="listing-size"]')?.textContent?.trim() || '';
        result.images = [...document.querySelectorAll('.listing__carousel img, .listing__image img')]
            .map((i) => i.src)
            .filter(Boolean);
    } else if (host === 'mercari.com' || host.endsWith('.mercari.com')) {
        result.platform = 'mercari';
        result.title = document.querySelector('[data-testid="ItemName"], h1')?.textContent?.trim() || '';
        result.description = document.querySelector('[data-testid="ItemDescription"]')?.textContent?.trim() || '';
        const priceEl = document.querySelector('[data-testid="ItemPrice"], [class*="Price"]');
        result.price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) : null;
        result.images = [...document.querySelectorAll('[data-testid="ItemImage"] img, picture img')]
            .map((i) => i.src)
            .filter(Boolean);
    } else if (host === 'depop.com' || host.endsWith('.depop.com')) {
        result.platform = 'depop';
        result.title = document.querySelector('h1, [class*="ProductTitle"]')?.textContent?.trim() || '';
        result.description =
            document
                .querySelector('[class*="ProductDescription"], [data-testid="product__description"]')
                ?.textContent?.trim() || '';
        const priceEl = document.querySelector('[class*="Price"], [data-testid="product__price"]');
        result.price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) : null;
        result.images = [...document.querySelectorAll('[class*="ProductImage"] img, picture img')]
            .map((i) => i.src)
            .filter(Boolean);
    } else if (host === 'grailed.com' || host.endsWith('.grailed.com')) {
        result.platform = 'grailed';
        result.title = document.querySelector('h1, [class*="listing-title"]')?.textContent?.trim() || '';
        result.description =
            document.querySelector('[class*="listing-description"], [class*="Description"]')?.textContent?.trim() || '';
        const priceEl = document.querySelector('[class*="Price"], [class*="listing-price"]');
        result.price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) : null;
        result.brand = document.querySelector('[class*="designer"], [class*="Designer"]')?.textContent?.trim() || '';
        result.images = [...document.querySelectorAll('[class*="listing-image"] img, [class*="carousel"] img')]
            .map((i) => i.src)
            .filter(Boolean);
    } else if (host === 'facebook.com' || host.endsWith('.facebook.com')) {
        result.platform = 'facebook';
        result.title = document.querySelector('h1, [class*="title"]')?.textContent?.trim() || '';
        result.description = document.querySelector('[class*="description"]')?.textContent?.trim() || '';
        const priceEl = document.querySelector('[class*="price"], [class*="Price"]');
        result.price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) : null;
        result.images = [...document.querySelectorAll('[class*="listing"] img, [data-imgperflogname] img')]
            .map((i) => i.src)
            .filter(Boolean)
            .slice(0, 10);
    } else if (host === 'whatnot.com' || host.endsWith('.whatnot.com')) {
        result.platform = 'whatnot';
        result.title = document.querySelector('h1, [class*="ProductTitle"]')?.textContent?.trim() || '';
        result.description = document.querySelector('[class*="ProductDescription"]')?.textContent?.trim() || '';
        const priceEl = document.querySelector('[class*="Price"]');
        result.price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) : null;
        result.images = [...document.querySelectorAll('[class*="product"] img')].map((i) => i.src).filter(Boolean);
    } else if (host === 'ebay.com' || host.endsWith('.ebay.com')) {
        result.platform = 'ebay';
        result.title = document.querySelector('h1.x-item-title__mainTitle span, h1')?.textContent?.trim() || '';
        result.description = ''; // eBay descriptions are in iframes
        const priceEl = document.querySelector('[itemprop="price"], .x-price-primary span');
        result.price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) : null;
        result.condition =
            document
                .querySelector('[data-testid="x-item-condition"] span, .x-item-condition span')
                ?.textContent?.trim() || '';
        result.images = [...document.querySelectorAll('.ux-image-carousel img, [data-testid="ux-image-magnify"] img')]
            .map((i) => i.src)
            .filter(Boolean);
    } else if (host === 'etsy.com' || host.endsWith('.etsy.com')) {
        result.platform = 'etsy';
        result.title = document.querySelector('h1, [data-buy-box-listing-title]')?.textContent?.trim() || '';
        result.description =
            document
                .querySelector('[data-product-details-description], #product-details-content-toggle')
                ?.textContent?.trim() || '';
        const priceEl = document.querySelector('[data-buy-box-region] p[class*="price"], .wt-text-title-03');
        result.price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) : null;
        result.images = [...document.querySelectorAll('.listing-page-image-carousel img, [data-carousel] img')]
            .map((i) => i.src)
            .filter(Boolean);
    }

    // Fallback: try generic meta tags
    if (!result.title) {
        result.title = document.querySelector('meta[property="og:title"]')?.content || document.title || '';
    }
    if (!result.description) {
        result.description =
            document.querySelector('meta[property="og:description"], meta[name="description"]')?.content || '';
    }
    if (!result.images.length) {
        const ogImage = document.querySelector('meta[property="og:image"]')?.content;
        if (ogImage) result.images = [ogImage];
    }

    return result;
}
