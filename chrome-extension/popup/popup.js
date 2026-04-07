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
    const pendingCrossLists = state.syncQueue.filter(i => i.action === 'cross_list' && i.status === 'pending');
    const otherItems = state.syncQueue.filter(i => i.action !== 'cross_list');
    const ACTION_LABELS = {
        cross_list: 'Cross-List', add_inventory: 'Add Inventory',
        update_price: 'Update Price', delete_listing: 'Delete Listing',
        sync_sale: 'Sync Sale', add_image: 'Add Image'
    };

    if (state.syncQueue.length === 0) {
        syncQueueEl.textContent = '';
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No pending actions';
        syncQueueEl.appendChild(empty);
    } else {
        syncQueueEl.textContent = '';
        if (pendingCrossLists.length) {
            const jobEl = document.createElement('div');
            jobEl.className = 'sync-item';
            jobEl.style.cssText = 'background:#eef2ff;border-left:3px solid #6366f1;border-radius:6px;margin-bottom:4px;padding:8px 10px;';
            const info = document.createElement('div');
            info.className = 'sync-item-info';
            const title = document.createElement('div');
            title.className = 'sync-item-title';
            title.style.fontWeight = '600';
            const jobCount = pendingCrossLists.length;
            title.textContent = jobCount + ' cross-list job' + (jobCount > 1 ? 's' : '') + ' queued';
            const meta = document.createElement('div');
            meta.className = 'sync-item-meta';
            meta.style.cssText = 'font-size:11px;color:#6b7280;';
            meta.textContent = 'Extension will open tabs automatically';
            info.appendChild(title);
            info.appendChild(meta);
            jobEl.appendChild(info);
            syncQueueEl.appendChild(jobEl);
        }
        otherItems.forEach(item => {
            const el = document.createElement('div');
            el.className = 'sync-item';
            const info = document.createElement('div');
            info.className = 'sync-item-info';
            const t = document.createElement('div');
            t.className = 'sync-item-title';
            t.textContent = ACTION_LABELS[item.action] || item.action || 'Unknown';
            const m = document.createElement('div');
            m.className = 'sync-item-meta';
            m.textContent = new Date(item.created_at).toLocaleDateString();
            info.appendChild(t);
            info.appendChild(m);
            const btn = document.createElement('button');
            btn.className = 'sync-item-action';
            btn.textContent = 'Process';
            btn.addEventListener('click', () => processSyncItem(item.id));
            el.appendChild(info);
            el.appendChild(btn);
            syncQueueEl.appendChild(el);
        });
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
