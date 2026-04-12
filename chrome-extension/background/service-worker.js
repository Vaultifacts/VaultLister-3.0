// Background Service Worker for VaultLister Extension
// Handles price tracking, alarms, notifications, and sync

import '../lib/api.js';
import '../lib/logger.js';

// Mutex flag to prevent concurrent badge updates
let badgeUpdateInProgress = false;

// Platform create-listing URLs for extension-based cross-listing
const PLATFORM_LISTING_URLS = {
    poshmark: 'https://poshmark.com/create-listing',
    depop: 'https://www.depop.com/sell/',
    facebook: 'https://www.facebook.com/marketplace/create/item',
    whatnot: 'https://www.whatnot.com/sell'
};

// Process pending cross-list jobs from the sync queue
async function processCrossListJobs() {
    try {
        const result = await api.getSyncQueue();
        const pendingJobs = (result.items || []).filter(
            item => (item.action === 'cross_list' || item.action === 'share_closet') && item.status === 'pending'
        );

        if (!pendingJobs.length) return;

        const storage = await chrome.storage.local.get(['crossListJobs', 'shareClosetJobs']);
        const activeJobs = storage.crossListJobs || {};
        const activeShareJobs = storage.shareClosetJobs || {};

        for (const job of pendingJobs) {
            const payload = (() => { try { return JSON.parse(job.payload || '{}'); } catch { return {}; } })();

            if (job.action === 'share_closet') {
                // Skip if already running
                const alreadyOpen = Object.values(activeShareJobs).some(j => j.syncId === job.id);
                if (alreadyOpen) continue;

                const closetUrl = payload.closet_url;
                if (!closetUrl) continue;

                const tab = await chrome.tabs.create({ url: closetUrl, active: false });
                activeShareJobs[tab.id] = {
                    syncId: job.id,
                    maxListings: payload.max_listings || 50,
                    delayMs: payload.delay_ms || 3000
                };
            } else {
                // cross_list job
                const alreadyOpen = Object.values(activeJobs).some(j => j.syncId === job.id);
                if (alreadyOpen) continue;

                const platform = payload.platform || job.data?.platform;
                const listingUrl = PLATFORM_LISTING_URLS[platform];
                if (!listingUrl) continue;

                const tab = await chrome.tabs.create({ url: listingUrl, active: false });
                activeJobs[tab.id] = {
                    syncId: job.id,
                    platform,
                    listingData: payload.listing_data || job.data || {}
                };
            }
        }

        await chrome.storage.local.set({ crossListJobs: activeJobs, shareClosetJobs: activeShareJobs });
    } catch (error) {
        logger.error('Failed to process cross-list jobs:', error);
    }
}

// Resolve app URL from the same base the API client uses
async function getAppUrl() {
    await api.loadToken();
    const base = api.baseUrl;
    if (!base || (!base.startsWith('http://localhost') && !base.startsWith('https://'))) {
        throw new Error('Invalid base URL');
    }
    return base.replace('/api', '');
}

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    logger.infoSync('VaultLister Extension installed');

    // Create context menus (removeAll first to avoid duplicate ID errors on reinstall/update)
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'add-to-vaultlister',
            title: 'Add to VaultLister',
            contexts: ['image']
        });

        chrome.contextMenus.create({
            id: 'cross-list-image',
            title: 'Cross-list this image',
            contexts: ['image']
        });
    });

    // Set up price tracking alarm (check every 6 hours)
    chrome.alarms.create('price-tracking', {
        periodInMinutes: 360
    });

    // Set up badge update alarm (every minute)
    chrome.alarms.create('badge-update', {
        periodInMinutes: 1
    });
});

// Notification permission cannot be requested from a service worker in MV3.
// chrome.notifications is used directly (no permission prompt needed — covered by "notifications" in manifest).

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'add-to-vaultlister') {
        try {
            // Save image URL to sync queue
            await api.addToSyncQueue({
                action_type: 'add_image',
                data: { imageUrl: info.srcUrl, pageUrl: tab.url }
            });

            // Show notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: '../icons/icon48.png',
                title: 'VaultLister',
                message: 'Image added to sync queue'
            });
        } catch (error) {
            logger.error('Failed to add image:', error);
        }
    } else if (info.menuItemId === 'cross-list-image') {
        try {
            const appUrl = await getAppUrl();
            const url = `${appUrl}?action=crosslist&image=${encodeURIComponent(info.srcUrl)}`;
            chrome.tabs.create({ url });
        } catch (error) {
            logger.error('Failed to cross-list:', error);
        }
    }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Security: only accept messages from our own extension
    if (sender.id !== chrome.runtime.id) {
        sendResponse({ success: false, error: 'Unauthorized sender' });
        return;
    }

    if (request.action === 'productScraped') {
        handleProductScraped(request.data)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    } else if (request.action === 'saleDetected') {
        api.reportSale(request.data)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === 'getInventoryItems') {
        getInventoryItems()
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    } else if (request.action === 'getCrossListJob') {
        // Called by poster.js when it loads — look up job for this tab
        const tabId = sender.tab?.id;
        chrome.storage.local.get(['crossListJobs'], (storage) => {
            const jobs = storage.crossListJobs || {};
            const job = jobs[tabId] || null;
            sendResponse({ job });
        });
        return true;
    } else if (request.action === 'getShareClosetJob') {
        // Called by sharing.js when it loads on a Poshmark closet page
        const tabId = sender.tab?.id;
        chrome.storage.local.get(['shareClosetJobs'], (storage) => {
            const jobs = storage.shareClosetJobs || {};
            const job = jobs[tabId] || null;
            sendResponse({ job });
        });
        return true;
    } else if (request.action === 'shareClosetJobComplete') {
        const { syncId, success, sharedCount, error } = request;
        const tabId = sender.tab?.id;
        api.reportCrossListResult(syncId, { success, sharedCount, error, action: 'share_closet' })
            .catch(err => logger.error('Failed to report share result:', err))
            .finally(() => {
                chrome.storage.local.get(['shareClosetJobs'], (storage) => {
                    const jobs = storage.shareClosetJobs || {};
                    delete jobs[tabId];
                    chrome.storage.local.set({ shareClosetJobs: jobs }, () => {
                        sendResponse({ success: true });
                    });
                });
            });
        return true;
    } else if (request.action === 'crossListJobComplete') {
        // Called by poster.js after form is filled (or error)
        // Keep service worker alive (return true) until fetch + storage write complete
        const { syncId, success, platform, listingUrl, error } = request;
        const tabId = sender.tab?.id;

        api.reportCrossListResult(syncId, { success, platform, listingUrl, error })
            .catch(err => logger.error('Failed to report cross-list result:', err))
            .finally(() => {
                chrome.storage.local.get(['crossListJobs'], (storage) => {
                    const jobs = storage.crossListJobs || {};
                    delete jobs[tabId];
                    chrome.storage.local.set({ crossListJobs: jobs }, () => {
                        sendResponse({ success: true });
                    });
                });
            });
        return true;
    }
});

// Handle scraped product
async function handleProductScraped(productData) {
    try {
        // Save to backend
        await api.saveScrapedProduct(productData);

        // Show notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '../icons/icon48.png',
            title: 'Product Captured',
            message: `${productData.title} added to VaultLister`
        });

        // Update badge
        await updateBadge();

        // Notify popup
        chrome.runtime.sendMessage({ action: 'productScraped' });
    } catch (error) {
        logger.error('Failed to handle scraped product:', error);
        throw error;
    }
}

// Get inventory items for autofill
async function getInventoryItems() {
    try {
        return await api.getInventoryItems({ limit: 50, status: 'in_stock' });
    } catch (error) {
        logger.error('Failed to get inventory items:', error);
        throw error;
    }
}

// Price tracking alarm + badge update alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'price-tracking') {
        await checkPriceUpdates();
    } else if (alarm.name === 'badge-update') {
        await updateBadge();
        await processCrossListJobs();
    }
});

// Check for price updates
async function checkPriceUpdates() {
    try {
        // Get all tracked products
        const result = await api.getPriceTracking({ status: 'active' });
        const trackedProducts = result.tracking || result.items || [];

        for (const product of trackedProducts) {
            // Scrape current price via a background fetch
            const currentPrice = await scrapePrice(product.listing_url || product.source_url);

            if (currentPrice && currentPrice < (product.alert_threshold || product.target_price)) {
                // Price dropped
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: '../icons/icon48.png',
                    title: 'Price Drop Alert!',
                    message: `${product.title || product.product_name} is now $${currentPrice.toFixed(2)}`
                });

                // Notify popup
                chrome.runtime.sendMessage({
                    action: 'priceAlert',
                    data: {
                        productName: product.title || product.product_name,
                        newPrice: currentPrice
                    }
                });
            }
        }
    } catch (error) {
        logger.error('Price tracking error:', error);
    }
}

// Scrape price from URL using fetch + regex (DOMParser not available in SW)
async function scrapePrice(url) {
    if (!url) return null;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
        clearTimeout(timeoutId);
        const html = await response.text();

        // Amazon: price whole part
        const amazonMatch = html.match(/<span class="a-price-whole[^"]*">([0-9,]+)</);
        if (amazonMatch) {
            return parseFloat(amazonMatch[1].replace(',', ''));
        }

        // Nordstrom: data-testid="product-price" content
        const nordstromMatch = html.match(/data-testid="product-price"[^>]*>\$?([0-9,.]+)/);
        if (nordstromMatch) {
            return parseFloat(nordstromMatch[1].replace(/[$,]/g, ''));
        }

        return null;
    } catch (error) {
        logger.error('Failed to scrape price:', error);
        return null;
    }
}

// Update extension badge
async function updateBadge() {
    // Prevent concurrent updates via simple mutex flag
    if (badgeUpdateInProgress) return;

    badgeUpdateInProgress = true;
    try {
        // Check auth state
        const isAuthenticated = api.isAuthenticated();
        const badgeColor = isAuthenticated ? '#6366f1' : '#9ca3af';

        const result = await api.getSyncQueue();
        const count = result.items?.length || 0;

        if (count > 0) {
            chrome.action.setBadgeText({ text: count.toString() });
            chrome.action.setBadgeBackgroundColor({ color: badgeColor });
        } else {
            chrome.action.setBadgeText({ text: '' });
            // Set badge background color based on auth state even when no count
            chrome.action.setBadgeBackgroundColor({ color: badgeColor });
        }
    } catch (error) {
        logger.error('Failed to update badge:', error);
    } finally {
        badgeUpdateInProgress = false;
    }
}

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
    const appUrl = await getAppUrl();
    chrome.tabs.create({ url: appUrl });
});
