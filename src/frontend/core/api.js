'use strict';
// API client, loading state, notification sounds, keyboard shortcuts
// Extracted from app.js lines 8138-8551

// ============================================
// API Client
// ============================================
const api = {
    baseUrl: '/api',
    csrfToken: null,
    maxRetries: 3,
    retryDelay: 1000,
    isRefreshing: false,
    refreshPromise: null,

    async refreshAccessToken() {
        // Prevent multiple simultaneous refresh attempts
        if (this.isRefreshing) {
            return this.refreshPromise;
        }

        const refreshToken = store.state.refreshToken;
        if (!refreshToken) {
            return false;
        }

        this.isRefreshing = true;
        this.refreshPromise = (async () => {
            try {
                const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        // Clear expired tokens but do NOT navigate here — this function
                        // is called during app init (before the router is ready) and
                        // by request() which handles its own redirect after we return false.
                        store.setState({ user: null, token: null, refreshToken: null });
                    }
                    return false;
                }

                const data = await response.json();
                if (data.token) {
                    store.setState({ token: data.token });
                    if (data.refreshToken) {
                        store.setState({ refreshToken: data.refreshToken });
                    }
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Token refresh failed');
                return false;
            } finally {
                this.isRefreshing = false;
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    },

    async request(endpoint, options = {}, retryCount = 0, isRetryAfterRefresh = false) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (store.state.token) {
            headers['Authorization'] = `Bearer ${store.state.token}`;
        }

        // Add CSRF token for state-changing requests
        const stateMutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (stateMutatingMethods.includes(options.method) && this.csrfToken) {
            headers['X-CSRF-Token'] = this.csrfToken;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            // Handle rate limiting with retry
            if (response.status === 429 && retryCount < this.maxRetries) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
                const delay = Math.max(retryAfter * 1000, this.retryDelay * (retryCount + 1));
                toast.warning(`Rate limited. Retrying in ${Math.ceil(delay / 1000)}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.request(endpoint, options, retryCount + 1, isRetryAfterRefresh);
            }

            // Handle server errors with retry (except for client errors)
            if (response.status >= 500 && retryCount < this.maxRetries) {
                const delay = this.retryDelay * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.request(endpoint, options, retryCount + 1, isRetryAfterRefresh);
            }

            // All retries exhausted for a 5xx — show error toast
            if (response.status >= 500) {
                toast.error('Server error. Please try again later.');
            }

            // Store CSRF token from response
            const csrfToken = response.headers.get('X-CSRF-Token') || response.headers.get('CSRF-Token');
            if (csrfToken) {
                this.csrfToken = csrfToken;
            }

            // Capture request ID for error reporting
            const requestId = response.headers.get('X-Request-ID');

            // Capture rate limit headers
            const rlLimit = response.headers.get('X-RateLimit-Limit');
            const rlRemaining = response.headers.get('X-RateLimit-Remaining');
            const rlReset = response.headers.get('X-RateLimit-Reset');
            if (rlLimit !== null || rlRemaining !== null || rlReset !== null) {
                store.state.rateLimitInfo = {
                    limit: rlLimit ? parseInt(rlLimit, 10) : store.state.rateLimitInfo?.limit ?? null,
                    remaining: rlRemaining ? parseInt(rlRemaining, 10) : store.state.rateLimitInfo?.remaining ?? null,
                    reset: rlReset ? parseInt(rlReset, 10) : store.state.rateLimitInfo?.reset ?? null
                };
            }

            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json') ? await response.json() : { error: await response.text() };

            // Handle token expiration - try to refresh and retry
            if (!response.ok && response.status === 401 && !isRetryAfterRefresh && !endpoint.includes('/auth/login')) {
                if (!navigator.onLine) {
                    throw new Error('You are offline. Please reconnect to continue.');
                }
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    // Retry the original request with new token
                    return this.request(endpoint, options, 0, true);
                } else {
                    // Refresh failed — only redirect if we are actually online.
                    // An offline 401 is a network artifact, not a real auth failure.
                    if (!navigator.onLine) {
                        throw new Error('You are offline. Please reconnect to continue.');
                    }
                    store.setState({ user: null, token: null, refreshToken: null });
                    router.navigate('login');
                    throw new Error('Session expired. Please log in again.');
                }
            }

            if (!response.ok) {
                const baseMsg = data.error || 'Request failed';
                // Include field-level validation errors from 422 responses
                let msg = baseMsg;
                if (response.status === 422 && data.errors && Array.isArray(data.errors)) {
                    const fieldErrors = data.errors.map(e => e.field ? `${e.field}: ${e.message}` : e.message || e).join(', ');
                    if (fieldErrors) msg = `${baseMsg} — ${fieldErrors}`;
                }
                if (requestId) msg = `${msg} (ref: ${requestId})`;
                const err = new Error(msg);
                err.data = data;
                err.status = response.status;
                err.requestId = requestId;
                throw err;
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') throw new Error('Request timed out');
            if (!navigator.onLine) {
                // Queue for offline sync
                offlineQueue.add({ endpoint, options });
                throw new Error('You are offline. This action will sync when you reconnect.');
            }
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },

    patch(endpoint, body) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    async ensureCSRFToken(force = false) {
        if (force) {
            this.csrfToken = null; // Force refresh
        }

        if (!this.csrfToken) {
            // Make a simple GET request to obtain CSRF token
            try {
                await this.get('/inventory?limit=1');
            } catch (e) {
                // Token should be in response headers even if request fails
                console.warn('CSRF token fetch warning:', e.message);
            }

            // Give a small delay to ensure token is captured
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    },

    // VAPID public key cache — fetched once, reused for all push subscriptions
    _vapidPublicKey: null,
    async getVapidPublicKey() {
        if (this._vapidPublicKey) return this._vapidPublicKey;
        const data = await this.get('/push-subscriptions/vapid-public-key');
        this._vapidPublicKey = data.publicKey;
        return this._vapidPublicKey;
    },

    // Helper to wrap API calls with loading state
    async withLoading(key, apiCall) {
        loadingState.start(key);
        try {
            const result = await apiCall();
            loadingState.stop(key);
            return result;
        } catch (error) {
            loadingState.stop(key);
            throw error;
        }
    }
};

// ============================================
// Loading State Manager
// ============================================
const loadingState = {
    activeLoaders: new Set(),

    start(key) {
        this.activeLoaders.add(key);
        store.setState({ isLoading: true });
        this.updateUI(key, true);
    },

    stop(key) {
        this.activeLoaders.delete(key);
        if (this.activeLoaders.size === 0) {
            store.setState({ isLoading: false });
        }
        this.updateUI(key, false);
    },

    isLoading(key) {
        return key ? this.activeLoaders.has(key) : this.activeLoaders.size > 0;
    },

    updateUI(key, loading) {
        // Update button states
        const buttons = document.querySelectorAll(`[data-loading-key="${key}"]`);
        buttons.forEach(btn => {
            if (loading) {
                btn.disabled = true;
                btn.dataset.originalText = btn.textContent;
                btn.innerHTML = sanitizeHTML('<span class="loading-spinner"></span> Loading...');  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            } else {
                btn.disabled = false;
                if (btn.dataset.originalText) {
                    btn.textContent = btn.dataset.originalText;
                }
            }
        });

        // Update skeleton loaders
        const skeletons = document.querySelectorAll(`[data-skeleton-key="${key}"]`);
        skeletons.forEach(el => {
            el.classList.toggle('skeleton-loading', loading);
        });
    },

    setButton(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.textContent;
            btn.innerHTML = sanitizeHTML('<span class="loading-spinner"></span> Loading...');  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        } else {
            btn.disabled = false;
            if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
            }
        }
    },

    // Create inline loading spinner
    spinner(size = 16) {
        return `<span class="loading-spinner" style="width:${size}px;height:${size}px"></span>`;
    }
};

// ============================================
// Screen Reader Announcements
// ============================================
const announce = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.setAttribute('aria-live', 'polite');
            this.container.setAttribute('aria-atomic', 'true');
            this.container.className = 'sr-only';
            this.container.id = 'aria-announcements';
            document.body.appendChild(this.container);
        }
    },

    // Announce message to screen readers
    polite(message) {
        this.init();
        this.container.setAttribute('aria-live', 'polite');
        this.container.textContent = message;
    },

    // Announce urgent message to screen readers
    assertive(message) {
        this.init();
        this.container.setAttribute('aria-live', 'assertive');
        this.container.textContent = message;
    }
};

// ============================================
// Offline Queue (IndexedDB)
// ============================================
const offlineQueue = {
    dbName: 'vaultlister_offline',
    storeName: 'queue',

    async getDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    },

    async add(action) {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, 'readwrite');
            tx.objectStore(this.storeName).add({ ...action, timestamp: Date.now() });
            this.notifyServiceWorker('QUEUE_ACTION', action);
            toast.warning('Action queued for when you\'re back online');
        } catch (e) {
            console.error('Failed to queue offline action:', e.message);
            toast.error('Failed to save action for offline sync');
        }
    },

    async getAll() {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const request = tx.objectStore(this.storeName).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async clear() {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, 'readwrite');
            tx.objectStore(this.storeName).clear();
        } catch (e) {
            console.error('Failed to clear offline queue:', e.message);
        }
    },

    async sync() {
        const items = await this.getAll();
        if (items.length === 0) return;

        let synced = 0;
        let failed = 0;

        for (const item of items) {
            try {
                await api.request(item.endpoint, item.options);
                synced++;
            } catch (e) {
                console.error('Sync failed for item:', item, e);
                failed++;
            }
        }
        await this.clear();
        if (synced > 0) {
            toast.success(`${synced} offline action(s) synced!${failed > 0 ? ` (${failed} failed)` : ''}`);
        }
    },

    // Service Worker communication
    notifyServiceWorker(type, payload) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type, payload });
        }
    },

    // Prefetch important data for offline use
    async prefetchForOffline() {
        const urls = [
            '/api/inventory',
            '/api/listings',
            '/api/analytics/dashboard'
        ];
        this.notifyServiceWorker('PREFETCH', { urls });
    },

    // Get cache size from service worker
    async getCacheSize() {
        return new Promise((resolve) => {
            if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
                resolve(0);
                return;
            }
            const channel = new MessageChannel();
            channel.port1.onmessage = (e) => resolve(e.data.size || 0);
            navigator.serviceWorker.controller.postMessage({ type: 'GET_CACHE_SIZE' }, [channel.port2]);
            setTimeout(() => resolve(0), 1000); // Timeout fallback
        });
    },

    // Clear all caches
    async clearCache() {
        return new Promise((resolve) => {
            if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
                resolve({ success: false });
                return;
            }
            const channel = new MessageChannel();
            channel.port1.onmessage = (e) => resolve(e.data);
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' }, [channel.port2]);
            setTimeout(() => resolve({ success: false }), 1000);
        });
    },

    // Get pending actions count
    async getPendingCount() {
        const items = await this.getAll();
        return items.length;
    }
};
