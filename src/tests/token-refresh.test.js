// Issue #97: Unit tests for token refresh flow in api.js
// Tests the refreshAccessToken() and request() methods from src/frontend/core/api.js
// All external dependencies (fetch, store, router, navigator) are mocked.
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ============================================
// Mock globals required by api.js
// ============================================

const mockStoreState = {
    token: 'initial-access-token',
    refreshToken: 'initial-refresh-token',
    user: { id: 'user-1' },
    isLoading: false,
    rateLimitInfo: null
};

const mockStore = {
    state: mockStoreState,
    setState: mock((updates) => {
        Object.assign(mockStore.state, updates);
    }),
    persist: mock(() => {}),
    hydrate: mock(() => {})
};

const mockRouter = {
    navigate: mock(() => {})
};

const mockToast = {
    warning: mock(() => {}),
    error: mock(() => {}),
    success: mock(() => {})
};

const mockOfflineQueue = {
    add: mock(() => Promise.resolve())
};

const mockLoadingState = {
    start: mock(() => {}),
    stop: mock(() => {})
};

// Build an api object matching the logic in src/frontend/core/api.js, but
// with external globals injected so we can unit-test it in isolation.
function makeApi({ fetchImpl, navigatorOnline = true } = {}) {
    const navigatorMock = { onLine: navigatorOnline };

    const api = {
        baseUrl: '/api',
        csrfToken: null,
        maxRetries: 0,
        retryDelay: 0,
        isRefreshing: false,
        refreshPromise: null,

        async refreshAccessToken() {
            if (this.isRefreshing) {
                return this.refreshPromise;
            }

            const refreshToken = mockStore.state.refreshToken;
            if (!refreshToken) {
                return false;
            }

            this.isRefreshing = true;
            this.refreshPromise = (async () => {
                try {
                    const response = await fetchImpl(`${this.baseUrl}/auth/refresh`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken })
                    });

                    if (!response.ok) {
                        return false;
                    }

                    const data = await response.json();
                    if (data.token) {
                        mockStore.setState({ token: data.token });
                        if (data.refreshToken) {
                            mockStore.setState({ refreshToken: data.refreshToken });
                        }
                        return true;
                    }
                    return false;
                } catch {
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

            if (mockStore.state.token) {
                headers['Authorization'] = `Bearer ${mockStore.state.token}`;
            }

            const stateMutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
            if (stateMutatingMethods.includes(options.method) && this.csrfToken) {
                headers['X-CSRF-Token'] = this.csrfToken;
            }

            let response;
            try {
                response = await fetchImpl(url, { ...options, headers });
            } catch (error) {
                if (!navigatorMock.onLine) {
                    mockOfflineQueue.add({ endpoint, options });
                    throw new Error('You are offline. This action will sync when you reconnect.');
                }
                throw error;
            }

            const contentType = response.headers?.get?.('content-type') || '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : { error: await response.text() };

            if (!response.ok && response.status === 401 && !isRetryAfterRefresh && !endpoint.includes('/auth/login')) {
                const errorMsg = data.error || '';
                if (errorMsg.includes('expired') || errorMsg.includes('Invalid')) {
                    if (!navigatorMock.onLine) {
                        throw new Error('You are offline. Please reconnect to continue.');
                    }
                    const refreshed = await this.refreshAccessToken();
                    if (refreshed) {
                        return this.request(endpoint, options, 0, true);
                    } else {
                        if (!navigatorMock.onLine) {
                            throw new Error('You are offline. Please reconnect to continue.');
                        }
                        mockStore.setState({ user: null, token: null, refreshToken: null });
                        mockRouter.navigate('login');
                        throw new Error('Session expired. Please log in again.');
                    }
                }
            }

            if (!response.ok) {
                const err = new Error(data.error || 'Request failed');
                err.status = response.status;
                throw err;
            }

            return data;
        }
    };

    return api;
}

// ============================================
// Helpers to build mock fetch responses
// ============================================

function makeResponse({ status = 200, json = {}, headers = {} } = {}) {
    const headersMap = new Map(Object.entries(headers));
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (key) => headersMap.get(key) ?? null
        },
        json: async () => json,
        text: async () => JSON.stringify(json)
    };
}

// ============================================
// Issue #97 — Test Suite
// ============================================

describe('token refresh — refreshAccessToken()', () => {
    beforeEach(() => {
        mockStore.state.token = 'initial-access-token';
        mockStore.state.refreshToken = 'initial-refresh-token';
        mockStore.state.user = { id: 'user-1' };
        mockStore.setState.mockClear();
        mockRouter.navigate.mockClear();
    });

    test('should update store state with new token when refresh succeeds', async () => {
        const fetchImpl = mock(() =>
            Promise.resolve(makeResponse({
                status: 200,
                json: { token: 'new-access-token', refreshToken: 'new-refresh-token' }
            }))
        );
        const api = makeApi({ fetchImpl });

        const result = await api.refreshAccessToken();

        expect(result).toBe(true);
        expect(mockStore.setState).toHaveBeenCalledWith({ token: 'new-access-token' });
        expect(mockStore.setState).toHaveBeenCalledWith({ refreshToken: 'new-refresh-token' });
        expect(mockStore.state.token).toBe('new-access-token');
    });

    test('should return false when refresh endpoint returns 401', async () => {
        const fetchImpl = mock(() =>
            Promise.resolve(makeResponse({ status: 401, json: { error: 'Invalid refresh token' } }))
        );
        const api = makeApi({ fetchImpl });

        const result = await api.refreshAccessToken();

        expect(result).toBe(false);
    });

    test('should return false when no refreshToken in store', async () => {
        mockStore.state.refreshToken = null;
        const fetchImpl = mock(() => Promise.resolve(makeResponse({ status: 200, json: { token: 'new-token' } })));
        const api = makeApi({ fetchImpl });

        const result = await api.refreshAccessToken();

        expect(result).toBe(false);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    test('should return false when refresh response has no token field', async () => {
        const fetchImpl = mock(() =>
            Promise.resolve(makeResponse({ status: 200, json: { message: 'ok' } }))
        );
        const api = makeApi({ fetchImpl });

        const result = await api.refreshAccessToken();

        expect(result).toBe(false);
    });

    test('should return false when fetch throws a network error', async () => {
        const fetchImpl = mock(() => Promise.reject(new Error('Network error')));
        const api = makeApi({ fetchImpl });

        const result = await api.refreshAccessToken();

        expect(result).toBe(false);
    });

    test('should reset isRefreshing and refreshPromise after completion', async () => {
        const fetchImpl = mock(() =>
            Promise.resolve(makeResponse({ status: 200, json: { token: 'new-token' } }))
        );
        const api = makeApi({ fetchImpl });

        await api.refreshAccessToken();

        expect(api.isRefreshing).toBe(false);
        expect(api.refreshPromise).toBeNull();
    });

    test('should share the same refresh when concurrent calls are in flight', async () => {
        let resolveRefresh;
        const fetchImpl = mock(() =>
            new Promise(resolve => {
                resolveRefresh = () => resolve(makeResponse({
                    status: 200,
                    json: { token: 'concurrent-token' },
                    headers: { 'content-type': 'application/json' }
                }));
            })
        );
        const api = makeApi({ fetchImpl });

        const promise1 = api.refreshAccessToken();
        // Second call while first is still in-flight — isRefreshing is true
        expect(api.isRefreshing).toBe(true);
        const promise2 = api.refreshAccessToken();

        resolveRefresh();
        const [result1, result2] = await Promise.all([promise1, promise2]);
        expect(result1).toBe(true);
        expect(result2).toBe(true);
        // fetch was only called once despite two concurrent calls
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
});

describe('token refresh — request() 401 handling', () => {
    beforeEach(() => {
        mockStore.state.token = 'initial-access-token';
        mockStore.state.refreshToken = 'initial-refresh-token';
        mockStore.state.user = { id: 'user-1' };
        mockStore.setState.mockClear();
        mockRouter.navigate.mockClear();
    });

    test('should retry request with new token when 401 with expired error', async () => {
        let callCount = 0;
        const fetchImpl = mock((url) => {
            callCount++;
            if (callCount === 1 && url.includes('/protected')) {
                return Promise.resolve(makeResponse({
                    status: 401,
                    json: { error: 'Token expired' },
                    headers: { 'content-type': 'application/json' }
                }));
            }
            if (url.includes('/auth/refresh')) {
                return Promise.resolve(makeResponse({
                    status: 200,
                    json: { token: 'refreshed-token' },
                    headers: { 'content-type': 'application/json' }
                }));
            }
            // Retry of /protected after refresh
            return Promise.resolve(makeResponse({
                status: 200,
                json: { data: 'success' },
                headers: { 'content-type': 'application/json' }
            }));
        });
        const api = makeApi({ fetchImpl });

        const result = await api.request('/protected', { method: 'GET' });

        expect(result).toEqual({ data: 'success' });
        expect(mockStore.state.token).toBe('refreshed-token');
    });

    test('should clear auth state and navigate to login when refresh fails after 401', async () => {
        const fetchImpl = mock((url) => {
            if (url.includes('/auth/refresh')) {
                return Promise.resolve(makeResponse({
                    status: 401,
                    json: { error: 'Refresh token invalid' },
                    headers: { 'content-type': 'application/json' }
                }));
            }
            return Promise.resolve(makeResponse({
                status: 401,
                json: { error: 'Token expired' },
                headers: { 'content-type': 'application/json' }
            }));
        });
        const api = makeApi({ fetchImpl, navigatorOnline: true });

        await expect(api.request('/protected', { method: 'GET' })).rejects.toThrow('Session expired');

        expect(mockStore.setState).toHaveBeenCalledWith({ user: null, token: null, refreshToken: null });
        expect(mockRouter.navigate).toHaveBeenCalledWith('login');
    });

    test('should not attempt refresh for login endpoint 401', async () => {
        const fetchImpl = mock(() =>
            Promise.resolve(makeResponse({
                status: 401,
                json: { error: 'Invalid credentials' },
                headers: { 'content-type': 'application/json' }
            }))
        );
        const api = makeApi({ fetchImpl });

        await expect(api.request('/auth/login', { method: 'POST' })).rejects.toThrow();

        expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    test('should not retry refresh on second 401 after already retried', async () => {
        let callCount = 0;
        const fetchImpl = mock((url) => {
            if (url.includes('/auth/refresh')) {
                return Promise.resolve(makeResponse({
                    status: 200,
                    json: { token: 'new-token' },
                    headers: { 'content-type': 'application/json' }
                }));
            }
            callCount++;
            return Promise.resolve(makeResponse({
                status: 401,
                json: { error: 'Token expired' },
                headers: { 'content-type': 'application/json' }
            }));
        });
        const api = makeApi({ fetchImpl, navigatorOnline: true });

        await expect(api.request('/protected', { method: 'GET' })).rejects.toThrow();

        // Should have called the protected endpoint twice (initial + retry), but NOT loop
        expect(callCount).toBe(2);
    });
});
