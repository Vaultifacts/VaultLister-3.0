// Background Service Worker for VaultLister Extension
// Handles price tracking, alarms, notifications, and sync

import '../lib/api.js';
import '../lib/logger.js';

// Mutex flag to prevent concurrent badge updates
let badgeUpdateInProgress = false;

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

// Check and request notification permission on startup
async function ensureNotificationPermission() {
    const permission = Notification.permission;
    if (permission === 'default') {
        try {
            const result = await Notification.requestPermission();
            if (result === 'granted') {
                logger.infoSync('Notification permission granted');
            }
        } catch (error) {
            logger.error('Failed to request notification permission:', error);
        }
    }
}

// Request notification permission when service worker starts
ensureNotificationPermission();

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
    } else if (request.action === 'getInventoryItems') {
        getInventoryItems()
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
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
        const result = await api.getSyncQueue();
        const count = result.items?.length || 0;

        if (count > 0) {
            chrome.action.setBadgeText({ text: count.toString() });
            chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
        } else {
            chrome.action.setBadgeText({ text: '' });
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
