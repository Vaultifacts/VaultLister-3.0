// VaultLister Chrome Extension — Background Service Worker
// Handles messages from content script FAB and coordinates scraping + import

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'import_listing') {
        handleImportListing(sender.tab)
            .then(sendResponse)
            .catch((err) => {
                sendResponse({ success: false, error: err.message });
            });
        return true; // Keep message channel open for async response
    }
});

async function handleImportListing(tab) {
    // Get stored credentials
    const { vl_server_url, vl_api_token } = await chrome.storage.local.get(['vl_server_url', 'vl_api_token']);

    if (!vl_server_url || !vl_api_token) {
        return { success: false, error: 'Not connected. Open the extension popup to configure.' };
    }

    // Execute scraping function in the tab
    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeListing,
    });

    const listing = results[0]?.result;
    if (!listing || !listing.title) {
        return { success: false, error: 'Could not extract listing data from this page.' };
    }

    // Send to VaultLister API
    const serverUrl = vl_server_url.replace(/\/+$/, '');
    const response = await fetch(`${serverUrl}/api/inventory`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${vl_api_token}`,
        },
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
        // Show badge on extension icon
        chrome.action.setBadgeText({ text: '1', tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#059669' });
        setTimeout(() => {
            chrome.action.setBadgeText({ text: '', tabId: tab.id });
        }, 3000);
        return { success: true, id: data.id || data.item?.id, title: listing.title };
    } else {
        const err = await response.text();
        return { success: false, error: `Import failed (${response.status}): ${err}` };
    }
}

// Same scraping function as popup.js — duplicated here because service workers
// can't share function references with popup scripts
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
        result.description = '';
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
