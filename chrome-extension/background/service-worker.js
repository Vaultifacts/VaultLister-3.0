// Background Service Worker for VaultLister Extension
// Handles price tracking, alarms, notifications, and sync

importScripts('../lib/api.js');
importScripts('../lib/logger.js');

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    logger.infoSync('VaultLister Extension installed');

    // Create context menus
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

    // Set up price tracking alarm (check every 6 hours)
    chrome.alarms.create('price-tracking', {
        periodInMinutes: 360
    });
});

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
            // Open VaultLister with image URL
            const url = `http://localhost:3000?action=crosslist&image=${encodeURIComponent(info.srcUrl)}`;
            chrome.tabs.create({ url });
        } catch (error) {
            logger.error('Failed to cross-list:', error);
        }
    }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
        updateBadge();

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

// Price tracking alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'price-tracking') {
        await checkPriceUpdates();
    }
});

// Check for price updates
async function checkPriceUpdates() {
    try {
        // Get all tracked products
        const result = await api.getPriceTracking({ status: 'active' });
        const trackedProducts = result.items || [];

        for (const product of trackedProducts) {
            // Check current price (would need to scrape again)
            const currentPrice = await scrapePrice(product.source_url);

            if (currentPrice && currentPrice < product.target_price) {
                // Price dropped!
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: '../icons/icon48.png',
                    title: 'Price Drop Alert!',
                    message: `${product.product_name} is now $${currentPrice.toFixed(2)}`
                });

                // Notify popup
                chrome.runtime.sendMessage({
                    action: 'priceAlert',
                    data: { productName: product.product_name, newPrice: currentPrice }
                });
            }
        }
    } catch (error) {
        logger.error('Price tracking error:', error);
    }
}

// Scrape price from URL
async function scrapePrice(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Try Amazon price
        const amazonPrice = doc.querySelector('.a-price-whole');
        if (amazonPrice) {
            return parseFloat(amazonPrice.textContent.replace(',', ''));
        }

        // Try Nordstrom price
        const nordstromPrice = doc.querySelector('[data-testid="product-price"]');
        if (nordstromPrice) {
            return parseFloat(nordstromPrice.textContent.replace(/[$,]/g, ''));
        }

        return null;
    } catch (error) {
        logger.error('Failed to scrape price:', error);
        return null;
    }
}

// Update extension badge
async function updateBadge() {
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
    }
}

// Periodic badge update
setInterval(updateBadge, 60000); // Every minute

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
    // Open VaultLister
    chrome.tabs.create({ url: 'http://localhost:3000' });
});
