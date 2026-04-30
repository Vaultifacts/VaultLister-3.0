// VaultLister Service Worker v5.6
// Pre-caching, fetch strategies, offline fallback, auth via MessageChannel

const CACHE_VERSION = 'v5.25';
const STATIC_CACHE = `vaultlister-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `vaultlister-runtime-${CACHE_VERSION}`;

// TTL map for API routes (milliseconds). Routes not listed fall back to MAX_AGE_MS.
const API_TTL_MAP = {
    '/api/inventory':      5 * 60 * 1000,       // 5 min
    '/api/listings':       5 * 60 * 1000,        // 5 min
    '/api/analytics':      5 * 60 * 1000,        // 5 min
    '/api/notifications':  1 * 60 * 1000,        // 1 min
    '/api/sales':          5 * 60 * 1000,        // 5 min
    '/api/offers':         2 * 60 * 1000,        // 2 min
    '/api/health':         30 * 1000,            // 30 s
    '/api/size-charts':    60 * 60 * 1000,       // 1 hour (stable)
    '/api/shipping-profiles': 60 * 60 * 1000,   // 1 hour (stable)
    '/api/templates':      15 * 60 * 1000,       // 15 min
    '/api/checklist':      10 * 60 * 1000,       // 10 min
};

// Critical pre-cache (app shell + most-used chunk — installed synchronously)
const PRECACHE_URLS = [
    '/',
    '/core-bundle.js?v=846190a0',
    '/styles/main.css?v=846190a0',
    '/manifest.webmanifest',
    '/offline.html',
    '/assets/logo/Favicon/favicon-64.png',
    '/chunk-inventory.js?v=846190a0',
];

// Secondary chunks — fetched in the background during activate
const BACKGROUND_CACHE_URLS = [
    '/chunk-sales.js?v=846190a0',
    '/chunk-tools.js?v=846190a0',
    '/chunk-intelligence.js?v=846190a0',
    '/chunk-settings.js?v=846190a0',
    '/chunk-community.js?v=846190a0',
];

// â”€â”€â”€ Install: pre-cache app shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// â”€â”€â”€ Activate: clean old caches, claim clients â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

self.addEventListener('activate', (event) => {
    const currentCaches = [STATIC_CACHE, RUNTIME_CACHE];
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => !currentCaches.includes(key))
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
            .then(() => {
                // Background-fetch secondary chunks — non-blocking; failures are silent
                caches.open(STATIC_CACHE).then((cache) => {
                    for (const url of BACKGROUND_CACHE_URLS) {
                        fetch(url).then((r) => { if (r.ok) cache.put(url, r); }).catch(() => null);
                    }
                });
            })
    );
});

// â”€â”€â”€ Message handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    // On logout: wipe the user-specific SWR API cache so the next user cannot
    // receive another user's templates or checklist data on shared devices.
    if (event.data && event.data.type === 'CLEAR_USER_CACHE') {
        event.waitUntil(caches.delete('vaultlister-swr-api'));
    }
});

// â”€â”€â”€ Fetch strategies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Non-GET requests: pass through directly to the network.
    // The previous background-sync clone here fired TWO requests (the clone +
    // the browser's default fallback), causing the CSRF token to be consumed
    // by the first and rejected for the second. Mutations are handled by the
    // page's own offline queue (api.js) when navigator.onLine is false.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.protocol === 'chrome-extension:') return;

    // Stable GET-only API endpoints: stale-while-revalidate (SWR)
    // These routes return the same data for all users and change infrequently.
    // SWR serves the cached response instantly while fetching a fresh copy in the
    // background â€” eliminating perceived latency on repeat visits without risking
    // stale user-specific or real-time data.
    // Max age: 60 s in cache; SWR window: 5 min; entries evicted after 10 min.
    const SWR_API_ROUTES = [
        '/api/health',
        '/api/health/live',
        '/api/health/ready',
    ];
    const SWR_API_PREFIXES = [
        '/api/size-charts',
        '/api/shipping-profiles',
        '/api/templates',
        '/api/checklist',
        '/api/inventory',
        '/api/analytics',
        '/api/notifications',
    ];
    const isSWRRoute = SWR_API_ROUTES.includes(url.pathname) ||
        SWR_API_PREFIXES.some(p => url.pathname.startsWith(p));

    if (url.pathname.startsWith('/api/') && isSWRRoute) {
        const SWR_CACHE = 'vaultlister-swr-api';
        const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 min fallback eviction TTL

        // Resolve per-route TTL from the map; use the longest prefix match
        function resolveApiTtl(pathname) {
            for (const [prefix, ttl] of Object.entries(API_TTL_MAP)) {
                if (pathname.startsWith(prefix)) return ttl;
            }
            return DEFAULT_TTL_MS;
        }

        const ttlMs = resolveApiTtl(url.pathname);
        // Serve from cache without re-fetching if entry is less than half the TTL old
        const SWR_WINDOW_MS = Math.min(ttlMs / 2, 30 * 1000);

        event.respondWith((async () => {
            const cache = await caches.open(SWR_CACHE);
            const cached = await cache.match(request);

            // Evict if beyond TTL (Cache-Control max-age isn't enforced by the Cache API)
            if (cached) {
                const dateHeader = cached.headers.get('date');
                const age = dateHeader ? Date.now() - new Date(dateHeader).getTime() : Infinity;
                if (age > ttlMs) {
                    await cache.delete(request);
                }
            }

            const fresh = cached && (Date.now() - new Date(cached.headers.get('date') || 0).getTime()) <= SWR_WINDOW_MS;

            // Background revalidation (always, even on cache hit)
            const revalidate = fetch(request).then(response => {
                if (response.ok) cache.put(request, response.clone());
                return response;
            }).catch(() => null);

            // Return cached immediately if available; otherwise wait for network
            return fresh ? cached : (revalidate || new Response(JSON.stringify({ error: 'Offline' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            }));
        })());
        return;
    }

    // All other API requests: network-first, no caching
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).catch(() => {
                // For HTML-accepting API requests, serve offline page
                if (request.headers.get('Accept')?.includes('text/html')) {
                    return caches.match('/offline.html');
                }
                return new Response(JSON.stringify({ error: 'Offline' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Images and fonts: cache-first with size-bounded eviction (#301)
    if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(request, clone);
                            evictOldestEntries(cache, RUNTIME_CACHE, 60);
                        });
                    }
                    return response;
                }).catch(() => new Response('', { status: 503 }));
            })
        );
        return;
    }

    // JS and CSS: network-first with cache fallback
    if (/\.(js|css)(\?.*)?$/.test(url.pathname)) {
        event.respondWith(
            fetch(request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
                }
                return response;
            }).catch(() => caches.match(request))
        );
        return;
    }

    // Blog articles: stale-while-revalidate
    if (url.pathname.startsWith('/blog/') && url.pathname.endsWith('.html')) {
        event.respondWith(
            caches.open(RUNTIME_CACHE).then(cache =>
                cache.match(request).then(cached => {
                    const networkFetch = fetch(request).then(response => {
                        if (response.ok) cache.put(request, response.clone());
                        return response;
                    });
                    return cached || networkFetch;
                })
            )
        );
        return;
    }

    // HTML navigation: network-first with offline fallback
    if (request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
                }
                return response;
            }).catch(() => {
                return caches.match(request).then((cached) => {
                    return cached || caches.match('/offline.html');
                });
            })
        );
        return;
    }

    // Everything else: stale-while-revalidate
    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
                }
                return response;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});

// â”€â”€â”€ Cache eviction helper (#301) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Remove oldest cache entries when count exceeds maxEntries.
// Uses the Response date header as a proxy for insertion time.
async function evictOldestEntries(cache, cacheName, maxEntries) {
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    const entries = await Promise.all(
        keys.map(async (req) => {
            const res = await cache.match(req);
            const date = res ? new Date(res.headers.get('date') || 0).getTime() : 0;
            return { req, date };
        })
    );
    entries.sort((a, b) => a.date - b.date);
    const toDelete = entries.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map(({ req }) => cache.delete(req)));
}

// â”€â”€â”€ Auth helper: request token from active client via MessageChannel â”€â”€â”€â”€â”€â”€â”€â”€

async function getAuthToken() {
    const allClients = await self.clients.matchAll({ type: 'window' });
    if (allClients.length === 0) return null;

    return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => resolve(null), 3000);

        channel.port1.onmessage = (event) => {
            clearTimeout(timeout);
            resolve(event.data?.token || null);
        };

        allClients[0].postMessage({ type: 'GET_AUTH_TOKEN' }, [channel.port2]);
    });
}

// â”€â”€â”€ Push notification event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Deduplication: track (tag + body) hashes within a 5-second window (#301)
const _recentPushKeys = new Map();
const PUSH_DEDUP_WINDOW_MS = 5000;

self.addEventListener('push', (event) => {
    // console.log('[SW] Push notification received');

    let data = {
        title: 'VaultLister',
        body: 'You have a new notification',
        icon: '/assets/logo/icon/icon-192.png',
        badge: '/assets/badge-96.png',
        tag: 'vaultlister-notification',
        data: {}
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    // Skip duplicate pushes received within PUSH_DEDUP_WINDOW_MS (#301)
    const dedupKey = `${data.tag}::${data.body}`;
    const lastSeen = _recentPushKeys.get(dedupKey);
    if (lastSeen && Date.now() - lastSeen < PUSH_DEDUP_WINDOW_MS) return;
    _recentPushKeys.set(dedupKey, Date.now());
    // Prune entries older than the window to avoid unbounded growth
    for (const [k, ts] of _recentPushKeys) {
        if (Date.now() - ts > PUSH_DEDUP_WINDOW_MS) _recentPushKeys.delete(k);
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        data: data.data,
        vibrate: [100, 50, 100],
        actions: data.actions || [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ],
        requireInteraction: data.requireInteraction || false
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// â”€â”€â”€ Notification click event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

self.addEventListener('notificationclick', (event) => {
    // console.log('[SW] Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    // Validate URL is same-origin
    const rawUrl = event.notification.data?.url || '/';
    let urlToOpen = '/';
    try {
        const parsed = new URL(rawUrl, self.registration.scope);
        const scopeOrigin = new URL(self.registration.scope).origin;
        if (parsed.origin === scopeOrigin) {
            urlToOpen = parsed.href;
        }
    } catch {
        // Invalid URL, use default
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(self.registration.scope) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                return clients.openWindow(urlToOpen);
            })
    );
});

// â”€â”€â”€ Background sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Lock map to prevent concurrent syncs of the same tag (#301)
const _syncLocks = {};

self.addEventListener('sync', (event) => {
    // console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-inventory') {
        event.waitUntil(syncWithLock('sync-inventory', syncInventory));
    } else if (event.tag === 'sync-sales') {
        event.waitUntil(syncWithLock('sync-sales', syncSales));
    } else if (event.tag === 'sync-failed-mutations') {
        // Notify all clients to flush their offline queue now that connectivity is restored
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then((clients) => {
                clients.forEach(client => client.postMessage({ type: 'SW_FLUSH_OFFLINE_QUEUE' }));
            })
        );    }
});

function syncWithLock(tag, fn) {
    if (_syncLocks[tag]) return _syncLocks[tag];
    _syncLocks[tag] = fn().finally(() => { delete _syncLocks[tag]; });
    return _syncLocks[tag];
}

async function syncInventory() {
    try {
        const token = await getAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const db = await openIndexedDB();
        const pendingChanges = await db.getAll('pendingInventoryChanges');

        for (const change of pendingChanges) {
            await fetch('/api/inventory', {
                method: change.method,
                headers,
                body: JSON.stringify(change.data)
            });
            await db.delete('pendingInventoryChanges', change.id);
        }

        // console.log('[SW] Inventory synced successfully');
    } catch (error) {
        console.error('[SW] Inventory sync failed:', error);
        throw error;
    }
}

async function syncSales() {
    try {
        const token = await getAuthToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch('/api/sales/sync', { method: 'POST', headers });
        if (!response.ok) throw new Error('Sync failed');
        // console.log('[SW] Sales synced successfully');
    } catch (error) {
        console.error('[SW] Sales sync failed:', error);
        throw error;
    }
}

// â”€â”€â”€ IndexedDB helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('VaultListerOffline', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            resolve({
                getAll: (store) => new Promise((res, rej) => {
                    const tx = db.transaction(store, 'readonly');
                    const req = tx.objectStore(store).getAll();
                    req.onsuccess = () => res(req.result);
                    req.onerror = () => rej(req.error);
                }),
                delete: (store, key) => new Promise((res, rej) => {
                    const tx = db.transaction(store, 'readwrite');
                    const req = tx.objectStore(store).delete(key);
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                })
            });
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pendingInventoryChanges')) {
                db.createObjectStore('pendingInventoryChanges', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// â”€â”€â”€ Periodic sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncAllData());
    }
});

async function syncAllData() {
    await syncInventory();
    await syncSales();
}

// console.log(`[SW] Service worker ${CACHE_VERSION} loaded`);
