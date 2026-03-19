// VaultLister API Client for Chrome Extension

// Resolve base URL: prefer stored preference, fall back to localhost
async function resolveBaseUrl() {
    try {
        const result = await chrome.storage.local.get(['api_base_url']);
        return result.api_base_url || 'http://localhost:3000/api';
    } catch {
        return 'http://localhost:3000/api';
    }
}

class VaultListerAPI {
    constructor() {
        this.token = null;
        this.refreshToken = null;
        this.baseUrl = 'http://localhost:3000/api';
        this._ready = this._init();
    }

    async _init() {
        this.baseUrl = await resolveBaseUrl();
        const result = await chrome.storage.local.get(['auth_token', 'refresh_token']);
        this.token = result.auth_token || null;
        this.refreshToken = result.refresh_token || null;
    }

    async loadToken() {
        await this._ready;
    }

    async saveToken(token, refreshToken = null) {
        this.token = token;
        if (refreshToken) {
            this.refreshToken = refreshToken;
        }
        const store = { auth_token: token };
        if (this.refreshToken) {
            store.refresh_token = this.refreshToken;
        }
        await chrome.storage.local.set(store);
    }

    async clearToken() {
        this.token = null;
        this.refreshToken = null;
        await chrome.storage.local.remove('auth_token');
        await chrome.storage.local.remove('refresh_token');
    }

    async refreshAccessToken() {
        if (!this.refreshToken) {
            await this.clearToken();
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });

            if (!response.ok) {
                await this.clearToken();
                throw new Error('Refresh failed');
            }

            const data = await response.json();
            if (data.data && data.data.token) {
                await this.saveToken(data.data.token, data.data.refreshToken || this.refreshToken);
                return true;
            }

            await this.clearToken();
            throw new Error('No token in refresh response');
        } catch (error) {
            await this.clearToken();
            throw error;
        }
    }

    async request(endpoint, options = {}) {
        await this._ready;
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-API-Version': '1',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (response.status === 401) {
                // Token expired — attempt refresh
                try {
                    await this.refreshAccessToken();
                    // Retry request with new token
                    const retryHeaders = {
                        'Content-Type': 'application/json',
                        ...options.headers
                    };
                    if (this.token) {
                        retryHeaders['Authorization'] = `Bearer ${this.token}`;
                    }
                    const retryResponse = await fetch(url, {
                        ...options,
                        headers: retryHeaders
                    });

                    if (!retryResponse.ok) {
                        const data = await retryResponse.json();
                        throw new Error(data.error || 'API request failed');
                    }

                    return await retryResponse.json();
                } catch (refreshError) {
                    // Refresh failed, clear auth and throw
                    throw new Error('Authentication required');
                }
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // Auth
    async login(email, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        await this.saveToken(data.data.token, data.data.refreshToken);
        return data;
    }

    async logout() {
        await this.clearToken();
    }

    // Inventory
    async addInventoryItem(item) {
        return await this.request('/inventory', {
            method: 'POST',
            body: JSON.stringify(item)
        });
    }

    async getInventoryItems(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/inventory?${query}`);
    }

    // Price Tracking
    async addPriceTracking(data) {
        return await this.request('/extension/price-tracking', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getPriceTracking(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/extension/price-tracking?${query}`);
    }

    // Scraped Products
    async saveScrapedProduct(product) {
        return await this.request('/extension/scraped', {
            method: 'POST',
            body: JSON.stringify(product)
        });
    }

    async getScrapedProducts(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/extension/scraped?${query}`);
    }

    // Sync Queue
    async addToSyncQueue(action) {
        return await this.request('/extension/sync', {
            method: 'POST',
            body: JSON.stringify(action)
        });
    }

    async getSyncQueue() {
        return await this.request('/extension/sync');
    }

    async processSyncItem(itemId) {
        return await this.request(`/extension/sync/${itemId}/process`, {
            method: 'POST'
        });
    }

    // Check if logged in
    isAuthenticated() {
        return !!this.token;
    }
}

// Singleton instance — available as global `api` in both popup (script tag) and service worker (module import)
const api = new VaultListerAPI();
// eslint-disable-next-line no-undef
(typeof self !== 'undefined' ? self : globalThis).api = api;
