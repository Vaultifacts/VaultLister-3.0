// VaultLister API Client for Chrome Extension

const API_BASE_URL = 'http://localhost:3000/api';

class VaultListerAPI {
    constructor() {
        this.token = null;
        this.loadToken();
    }

    async loadToken() {
        const result = await chrome.storage.local.get(['auth_token']);
        this.token = result.auth_token || null;
    }

    async saveToken(token) {
        this.token = token;
        await chrome.storage.local.set({ auth_token: token });
    }

    async clearToken() {
        this.token = null;
        await chrome.storage.local.remove('auth_token');
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
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
                // Token expired or invalid
                await this.clearToken();
                throw new Error('Authentication required');
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
        await this.saveToken(data.token);
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
        return await this.request('/extension/price-track', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getPriceTracking(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/extension/price-track?${query}`);
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

// Export singleton instance
const api = new VaultListerAPI();
