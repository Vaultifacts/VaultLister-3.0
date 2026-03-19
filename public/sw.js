// VaultLister Service Worker v4.3
// Pre-caching, fetch strategies, offline fallback, auth via MessageChannel

const CACHE_VERSION = 'v4.3';
const STATIC_CACHE = `vaultlister-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `vaultlister-runtime-${CACHE_VERSION}`;

// Phase 1 files to pre-cache (app shell)
const PRECACHE_URLS = [
    '/',
    '/core-bundle.js?v=23beeb2b',
    '/styles/main.css?v=23beeb2b',
    '/manifest.webmanifest',
    '/offline.html',
    '/assets/favicon.svg',
    '/components/photoEditor.js',
    '/components/chatWidget.js',
    // Phase 2: route-group chunks (pre-cached for offline use)
    '/chunk-inventory.js?v=23beeb2b',
    '/chunk-sales.js?v=23beeb2b',
    '/chunk-tools.js?v=23beeb2b',
    '/chunk-intelligence.js?v=23beeb2b',
    '/chunk-settings.js?v=23beeb2b',
    '/chunk-community.js?v=23beeb2b',
];

// ─── Install: pre-cache app shell ────────────────────────────────────────────

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// ─── Activate: clean old caches, claim clients ──────────────────────────────

self.addEventListener('activate', (event) => {
    const currentCaches = [STATIC_CACHE, RUNTIME_CACHE];
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => !currentCaches.includes(key))
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// ─── Message handler ─────────────────────────────────────────────────────────

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

// ─── Fetch strategies ────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.protocol === 'chrome-extension:') return;

    // Stable GET-only API endpoints: stale-while-revalidate (SWR)
    // These routes return the same data for all users and change infrequently.
    // SWR serves the cached response instantly while fetching a fresh copy in the
    // background — eliminating perceived latency on repeat visits without risking
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
    ];
    const isSWRRoute = SWR_API_ROUTES.includes(url.pathname) ||
        SWR_API_PREFIXES.some(p => url.pathname.startsWith(p));

    if (url.pathname.startsWith('/api/') && isSWRRoute) {
        const SWR_CACHE = 'vaultlister-swr-api';
        const MAX_AGE_MS = 10 * 60 * 1000; // evict entries older than 10 minutes

        event.respondWith((async () => {
            const cache = await caches.open(SWR_CACHE);
            const cached = await cache.match(request);

            // Evict if too old (Cache-Control max-age isn't enforced by the Cache API)
            if (cached) {
                const dateHeader = cached.headers.get('date');
                const age = dateHeader ? Date.now() - new Date(dateHeader).getTime() : Infinity;
                if (age > MAX_AGE_MS) {
                    await cache.delete(request);
                }
            }

            const fresh = cached && (Date.now() - new Date(cached.headers.get('date') || 0).getTime()) <= MAX_AGE_MS;

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

    // Images and fonts: cache-first
    if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
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

// ─── Auth helper: request token from active client via MessageChannel ────────

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

// ─── Push notification event ─────────────────────────────────────────────────

self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

    let data = {
        title: 'VaultLister',
        body: 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
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

// ─── Notification click event ────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);

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

// ─── Background sync ─────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-inventory') {
        event.waitUntil(syncInventory());
    } else if (event.tag === 'sync-sales') {
        event.waitUntil(syncSales());
    }
});

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

        console.log('[SW] Inventory synced successfully');
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
        console.log('[SW] Sales synced successfully');
    } catch (error) {
        console.error('[SW] Sales sync failed:', error);
        throw error;
    }
}

// ─── IndexedDB helper ────────────────────────────────────────────────────────

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

// ─── Periodic sync ───────────────────────────────────────────────────────────

self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncAllData());
    }
});

async function syncAllData() {
    await syncInventory();
    await syncSales();
}

console.log(`[SW] Service worker ${CACHE_VERSION} loaded`);
