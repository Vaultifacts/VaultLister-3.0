// API Client Wrapper for Tests
const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`;

export class TestApiClient {
    constructor(token = null) {
        this.token = token;
    }

    setToken(token) {
        this.token = token;
    }

    async getCsrfToken() {
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const res = await fetch(`${BASE_URL}/csrf-token`, { headers });
        const data = await res.json();
        return data.csrfToken;
    }

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Fetch a fresh CSRF token for state-changing requests
        const stateMutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (stateMutatingMethods.includes(options.method)) {
            headers['X-CSRF-Token'] = await this.getCsrfToken();
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        let data;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        return {
            status: response.status,
            ok: response.ok,
            data,
            headers: response.headers
        };
    }

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    async put(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    async patch(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(body)
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // Convenience methods for inventory
    async createInventoryItem(itemData) {
        return this.post('/inventory', itemData);
    }

    async getInventory(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/inventory${query ? '?' + query : ''}`);
    }

    async getInventoryItem(id) {
        return this.get(`/inventory/${id}`);
    }

    async updateInventoryItem(id, itemData) {
        return this.put(`/inventory/${id}`, itemData);
    }

    async deleteInventoryItem(id) {
        return this.delete(`/inventory/${id}`);
    }

    // Convenience methods for automations
    async getAutomations() {
        return this.get('/automations');
    }

    async createAutomation(ruleData) {
        return this.post('/automations', ruleData);
    }

    async getAutomationPresets() {
        return this.get('/automations/presets');
    }

    // Convenience methods for listings
    async getListings() {
        return this.get('/listings');
    }

    async createListing(listingData) {
        return this.post('/listings', listingData);
    }

    // Convenience methods for analytics
    async getDashboard() {
        return this.get('/analytics/dashboard');
    }

    async getSustainability() {
        return this.get('/analytics/sustainability');
    }
}

export function createClient(token = null) {
    return new TestApiClient(token);
}
