// VaultLister Extension Popup Logic

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

let state = {
    isAuthenticated: false,
    scrapedCount: 0,
    trackedCount: 0,
    syncQueue: []
};

// Check cache storage quota before caching large payloads
async function checkStorageQuota() {
    try {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            const percentUsed = (estimate.usage / estimate.quota) * 100;
            if (percentUsed > 90) {
                console.warn(`Storage quota ${percentUsed.toFixed(1)}% full`);
                return false;
            }
            return true;
        }
        return true;
    } catch (error) {
        console.warn('Could not estimate storage:', error);
        return true;
    }
}

// DOM Elements
const loading = document.getElementById('loading');
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const scrapeBtn = document.getElementById('scrape-btn');
const priceTrackBtn = document.getElementById('price-track-btn');
const openAppBtn = document.getElementById('open-app-btn');
const syncBtn = document.getElementById('sync-btn');
const scrapedCountEl = document.getElementById('scraped-count');
const trackedCountEl = document.getElementById('tracked-count');
const syncQueueEl = document.getElementById('sync-queue');

// Initialize
async function init() {
    showLoading();

    try {
        await api.loadToken();

        if (api.isAuthenticated()) {
            await loadStats();
            showMainView();
        } else {
            showLoginView();
        }
    } catch (error) {
        console.error('Init error:', error);
        showLoginView();
    }
}

// Views
function showLoading() {
    loading.classList.remove('hidden');
    loginView.classList.add('hidden');
    mainView.classList.add('hidden');
}

function showLoginView() {
    loading.classList.add('hidden');
    loginView.classList.remove('hidden');
    mainView.classList.add('hidden');
}

function showMainView() {
    loading.classList.add('hidden');
    loginView.classList.add('hidden');
    mainView.classList.remove('hidden');
}

// Load Stats
async function loadStats() {
    try {
        const [scrapedResult, trackedResult, syncResult] = await Promise.all([
            api.getScrapedProducts({ limit: 1 }).catch(() => ({ count: 0 })),
            api.getPriceTracking({ limit: 1 }).catch(() => ({ count: 0 })),
            api.getSyncQueue().catch(() => ({ items: [] }))
        ]);

        state.scrapedCount = scrapedResult.count || 0;
        state.trackedCount = trackedResult.count || 0;
        state.syncQueue = syncResult.items || [];

        updateUI();
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Update UI
function updateUI() {
    scrapedCountEl.textContent = state.scrapedCount;
    trackedCountEl.textContent = state.trackedCount;

    // Update sync queue
    if (state.syncQueue.length === 0) {
        syncQueueEl.innerHTML = '<p class="empty-state">No pending actions</p>';  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    } else {
        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        syncQueueEl.innerHTML = state.syncQueue.map(item => `
            <div class="sync-item">
                <div class="sync-item-info">
                    <div class="sync-item-title">${escapeHtml(item.action_type)}</div>
                    <div class="sync-item-meta">${escapeHtml(new Date(item.created_at).toLocaleDateString())}</div>
                </div>
                <button class="sync-item-action" data-id="${escapeHtml(item.id)}" onclick="processSyncItem(this.dataset.id)">
                    Process
                </button>
            </div>
        `).join('');
    }
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        showLoading();
        await api.login(email, password);
        await loadStats();
        showMainView();
        showToast('Logged in successfully!', 'success');
    } catch (error) {
        showLoginView();
        showToast('Login failed. Please check your credentials.', 'error');
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await api.logout();
        state.isAuthenticated = false;
        showLoginView();
        showToast('Logged out successfully', 'success');
    } catch (error) {
        showToast('Logout failed', 'error');
    }
});

// Scrape Product
scrapeBtn.addEventListener('click', async () => {
    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const supported = ['amazon.com','nordstrom.com','ebay.com','poshmark.com','mercari.com','depop.com'];
        if (!supported.some(s => tab.url.includes(s))) {
            showToast('Visit Amazon, eBay, Poshmark, Mercari, Depop, or Nordstrom first', 'error');
            return;
        }

        // Send message to content script
        chrome.tabs.sendMessage(tab.id, { action: 'scrapeProduct' }, (response) => {
            if (chrome.runtime.lastError) {
                showToast('Scraping failed. Reload the page and try again.', 'error');
                return;
            }

            if (response.success) {
                showToast('Product captured successfully!', 'success');
                loadStats();
            } else {
                showToast('Scraping failed: ' + response.error, 'error');
            }
        });
    } catch (error) {
        showToast('Failed to scrape product', 'error');
    }
});

// Track Price
priceTrackBtn.addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const supported = ['amazon.com','nordstrom.com','ebay.com','poshmark.com','mercari.com','depop.com'];
        if (!supported.some(s => tab.url.includes(s))) {
            showToast('Visit Amazon, eBay, Poshmark, Mercari, Depop, or Nordstrom first', 'error');
            return;
        }

        // Scrape first, then add to price tracking
        chrome.tabs.sendMessage(tab.id, { action: 'scrapeProduct' }, async (response) => {
            if (chrome.runtime.lastError || !response.success) {
                showToast('Failed to track price', 'error');
                return;
            }

            showToast('Price tracking enabled!', 'success');
            loadStats();
        });
    } catch (error) {
        showToast('Failed to track price', 'error');
    }
});

// Open App
openAppBtn.addEventListener('click', async () => {
    await api.loadToken();
    const url = api.baseUrl.replace('/api', '');
    chrome.tabs.create({ url });
});

// Sync Now
syncBtn.addEventListener('click', async () => {
    try {
        showToast('Syncing...', 'success');

        // Process all items in sync queue
        for (const item of state.syncQueue) {
            await api.processSyncItem(item.id);
        }

        await loadStats();
        showToast('Sync completed!', 'success');
    } catch (error) {
        showToast('Sync failed', 'error');
    }
});

// Process Sync Item
window.processSyncItem = async function(itemId) {
    try {
        await api.processSyncItem(itemId);
        await loadStats();
        showToast('Item processed!', 'success');
    } catch (error) {
        showToast('Failed to process item', 'error');
    }
};

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'productScraped') {
        loadStats();
    } else if (request.action === 'priceAlert') {
        showToast(`Price drop: ${request.data.productName}`, 'success');
    }
});

// Wire sign-up link to resolved base URL
(async () => {
    await api.loadToken();
    const signupLink = document.getElementById('signup-link');
    if (signupLink) {
        signupLink.href = api.baseUrl.replace('/api', '');
    }
})();

// Initialize on load
init();
