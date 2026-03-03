'use strict';
// Hash-based SPA router
// Extracted from app.js lines 15010-15283

// ============================================
// Router — with route-based chunk loading
// ============================================

// Map route paths to chunk names for on-demand loading
const pageChunkMap = {
    // inventory-catalog
    'inventory': 'inventory-catalog',
    'listings': 'inventory-catalog',
    'crosslist': 'inventory-catalog',
    'templates': 'inventory-catalog',
    'automations': 'inventory-catalog',
    'sku-rules': 'inventory-catalog',
    'smart-relisting': 'inventory-catalog',
    'inventory-import': 'inventory-catalog',
    'recently-deleted': 'inventory-catalog',

    // sales-orders
    'sales': 'sales-orders',
    'orders': 'sales-orders',
    'offers': 'sales-orders',
    'financials': 'sales-orders',
    'transactions': 'sales-orders',
    'reports': 'sales-orders',
    'report-builder': 'sales-orders',
    'shipping-labels': 'sales-orders',

    // tools-tasks
    'checklist': 'tools-tasks',
    'calendar': 'tools-tasks',
    'size-charts': 'tools-tasks',
    'image-bank': 'tools-tasks',
    'receipt-parser': 'tools-tasks',
    'whatnot-live': 'tools-tasks',

    // intelligence
    'heatmaps': 'intelligence',
    'predictions': 'intelligence',
    'suppliers': 'intelligence',
    'market-intel': 'intelligence',

    // settings-account
    'settings': 'settings-account',
    'account': 'settings-account',
    'teams': 'settings-account',
    'plans-billing': 'settings-account',
    'affiliate': 'settings-account',
    'notifications': 'settings-account',
    'connections': 'settings-account',
    'shipping-profiles': 'settings-account',
    'push-notifications': 'settings-account',
    'webhooks': 'settings-account',
    'shops': 'settings-account',

    // community-help
    'community': 'community-help',
    'help': 'community-help',
    'support-articles': 'community-help',
    'report-bug': 'community-help',
    'tutorials': 'community-help',
    'roadmap': 'community-help',
    'suggest-features': 'community-help',
    'submit-feedback': 'community-help',
    'feedback-suggestions': 'community-help',
    'feedback-analytics': 'community-help',
    'changelog': 'community-help',
    'help-support': 'community-help',
    'refer-friend': 'community-help',
    'terms-of-service': 'community-help',
    'privacy-policy': 'community-help',
    'about': 'community-help',
    'terms': 'community-help',
    'privacy': 'community-help',
};

// Track which chunks are loaded
const _loadedChunks = new Set();
const _loadingChunks = {};

/**
 * Dynamically load a route-group chunk (pages + handlers JS files).
 * Returns a promise that resolves when both files have loaded.
 */
function loadChunk(chunkName) {
    if (_loadedChunks.has(chunkName)) return Promise.resolve();
    if (_loadingChunks[chunkName]) return _loadingChunks[chunkName];

    const v = '19';
    const files = [
        '/pages/pages-' + chunkName + '.js?v=' + v,
        '/handlers/handlers-' + chunkName + '.js?v=' + v
    ];

    let loaded = 0;
    _loadingChunks[chunkName] = new Promise(function(resolve, reject) {
        var timeout = setTimeout(function() {
            reject(new Error('Chunk load timeout: ' + chunkName));
        }, 15000);

        files.forEach(function(src) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = function() {
                loaded++;
                if (loaded >= files.length) {
                    clearTimeout(timeout);
                    _loadedChunks.add(chunkName);
                    delete _loadingChunks[chunkName];
                    resolve();
                }
            };
            s.onerror = function() {
                clearTimeout(timeout);
                delete _loadingChunks[chunkName];
                reject(new Error('Failed to load chunk: ' + src));
            };
            document.head.appendChild(s);
        });
    });

    return _loadingChunks[chunkName];
}

const router = {
    routes: {},

    register(path, handler) {
        this.routes[path] = handler;
    },

    async navigate(path) {
        // Track tool usage
        if (['automations', 'checklist', 'image-bank', 'calendar', 'size-charts'].includes(path)) {
            toolUsageAnalytics.track(path);
        }

        // Check for unsaved settings changes before navigating
        const currentPage = store.state.currentPage;
        if (currentPage === 'settings' && !path.startsWith('settings') && 'darkModePreview' in store.state) {
            if (!await modals.confirm('You have unsaved changes. Discard changes and leave this page?', { title: 'Unsaved Changes', confirmText: 'Discard', danger: true })) {
                return; // Stay on settings page
            }
        }

        // Clear batch photo polling interval on navigation
        if (store.state.batchPhotoActivePollInterval) {
            clearInterval(store.state.batchPhotoActivePollInterval);
            store.setState({ batchPhotoActivePollInterval: null });
        }

        // Save sidebar scroll position before navigating
        const sidebar = document.querySelector('.sidebar-nav');
        if (sidebar) {
            store.setState({ sidebarScrollPos: sidebar.scrollTop });
        }
        window.history.pushState({}, '', `#${path}`);
        await this.handleRoute();
    },

    async handleRoute(isInitialLoad = false) {
        let path = window.location.hash.slice(1) || 'dashboard';
        const previousPage = store.state.currentPage;

        // Clear timers/intervals on navigation to prevent leaks
        if (window._lockoutCountdown) {
            clearInterval(window._lockoutCountdown);
            window._lockoutCountdown = null;
        }
        if (window._liveAnalyticsTimer) {
            clearInterval(window._liveAnalyticsTimer);
            window._liveAnalyticsTimer = null;
            store.setState({ liveAnalyticsEnabled: false });
        }
        if (handlers._batchPhotoPollInterval) {
            clearInterval(handlers._batchPhotoPollInterval);
            handlers._batchPhotoPollInterval = null;
        }

        // Clear stale filter state on page navigation
        if (previousPage && previousPage !== path) {
            store.setState({ activeFilters: {} });
        }

        // Handle settings deep-linking: #settings/appearance → set tab and use 'settings' as route
        if (path.startsWith('settings/')) {
            const tab = path.split('/')[1];
            const validTabs = ['profile','appearance','notifications','integrations','tools','billing','data'];
            if (validTabs.includes(tab)) {
                store.setState({ settingsTab: tab });
            }
            path = 'settings';
        }

        // If navigating away from settings with unsaved dark mode changes, revert them
        if (previousPage === 'settings' && path !== 'settings' && 'darkModePreview' in store.state) {
            const savedDarkMode = store.state.darkMode;
            if (savedDarkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            delete store.state.darkModePreview;
        }

        // Auth guard: redirect unauthenticated users to login for protected routes
        const publicRoutes = ['login', 'register', 'forgot-password', 'email-verification', 'about', 'terms', 'privacy', 'terms-of-service', 'privacy-policy', '404'];
        if (!publicRoutes.includes(path) && !auth.isAuthenticated()) {
            store.setState({ currentPage: 'login' });
            window.location.hash = '#login';
            const handler = this.routes['login'];
            if (handler) handler();
            return;
        }

        store.setState({ currentPage: path });

        // Load route-group chunk on demand (if not already loaded)
        const chunkName = pageChunkMap[path];
        if (chunkName && !_loadedChunks.has(chunkName)) {
            // Show loading spinner while chunk loads
            renderApp('<div style="display:flex;align-items:center;justify-content:center;min-height:60vh"><div class="loading-spinner"></div><p style="margin-left:1rem;color:#6b7280">Loading page...</p></div>');
            try {
                await loadChunk(chunkName);
            } catch (err) {
                console.error('[Router] Chunk load failed for', chunkName, err);
                toast.error('Failed to load page module. Please try again.');
                return;
            }
        }

        // Load data for specific pages BEFORE rendering (except on initial load)
        if (!isInitialLoad) {
            try {
                if (path === 'inventory') {
                    await handlers.loadInventory();
                } else if (path === 'automations') {
                    await handlers.loadAutomations();
                } else if (path === 'shops') {
                    await handlers.loadShops();
                } else if (path === 'listings') {
                    await Promise.all([
                        handlers.loadListings(),
                        handlers.loadListingFolders()
                    ]);
                } else if (path === 'sales') {
                    await handlers.loadSales();
                } else if (path === 'recently-deleted') {
                    await handlers.loadDeletedItems();
                } else if (path === 'analytics') {
                    await handlers.loadAnalytics();
                } else if (path === 'financials') {
                    await Promise.all([
                        handlers.loadPurchases(),
                        handlers.loadAccounts(),
                        handlers.loadSales(),
                        handlers.loadCategorizationRules()
                    ]);
                } else if (path === 'transactions') {
                    await Promise.all([
                        handlers.loadPurchases(),
                        handlers.loadSales()
                    ]);
                } else if (path === 'templates') {
                    await handlers.loadTemplates();
                } else if (path === 'image-bank') {
                    await handlers.loadImageBank();
                } else if (path === 'community') {
                    await handlers.loadCommunity();
                } else if (path === 'support-articles') {
                    await Promise.all([
                        handlers.loadFAQs(),
                        handlers.loadArticles()
                    ]);
                } else if (path === 'report-bug') {
                    await handlers.loadTickets();
                } else if (path === 'orders') {
                    await handlers.loadOrders();
                } else if (path === 'offers') {
                    await handlers.loadOffers();
                } else if (path === 'checklist') {
                    await handlers.loadChecklistItems();
                } else if (path === 'heatmaps') {
                    await handlers.loadHeatmapData();
                } else if (path === 'predictions') {
                    await handlers.loadPredictions();
                } else if (path === 'suppliers') {
                    await handlers.loadSuppliers();
                } else if (path === 'market-intel') {
                    await handlers.loadMarketIntel();
                } else if (path === 'webhooks') {
                    await handlers.loadWebhooks();
                } else if (path === 'push-notifications') {
                    await handlers.loadPushStatus();
                }
            } catch (err) {
                console.error(`[Router] Failed to load data for ${path}:`, err);
                toast.error('Failed to load page data. The page may show stale content.');
            }
        }

        const handler = this.routes[path] || this.routes['404'];
        if (handler) {
            try {
                // On initial load, add a 4-second timeout so async route handlers can't hang forever
                if (isInitialLoad) {
                    await Promise.race([
                        handler(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('__route_timeout__')), 4000))
                    ]);
                } else {
                    await handler();
                }
            } catch (err) {
                // On initial load timeout, render the page immediately without data
                if (isInitialLoad && err.message === '__route_timeout__') {
                    console.warn(`[Router] Timeout loading '${path}', rendering without data`);
                    try {
                        const pageRenderer = pages[path] || pages[path.replace(/-/g, '')] || pages.dashboard;
                        if (typeof pageRenderer === 'function') {
                            renderApp(pageRenderer());
                        } else {
                            renderApp(pages.dashboard());
                        }
                    } catch (renderErr) {
                        console.error('[Router] Fallback render failed:', renderErr);
                        renderApp(pages.dashboard());
                    }
                } else {
                    console.error(`[Router] Error rendering page '${path}':`, err);
                    toast.error(`Failed to load page: ${err.message}`);
                }
            }
        } else {
            console.error('[Router] No handler found for:', path);
            renderApp(`<div style="padding:40px;text-align:center"><h2>Page Not Found</h2><p>The page "${escapeHtml(path)}" could not be found.</p><button class="btn btn-primary" onclick="router.navigate('dashboard')">Go to Dashboard</button></div>`);
        }

        // Restore sidebar scroll position after rendering
        requestAnimationFrame(() => {
            const sidebar = document.querySelector('.sidebar-nav');
            if (sidebar && store.state.sidebarScrollPos !== undefined) {
                sidebar.scrollTop = store.state.sidebarScrollPos;
            }
        });

        // Load data AFTER rendering on initial load
        if (isInitialLoad) {
            // Load in background without blocking
            this.loadPageData(path).catch(err => {
                console.error('Background data load failed:', err);
                toast.error('Failed to load page data');
            });
        }
    },

    async loadPageData(path) {
        if (path === 'inventory') {
            await handlers.loadInventory();
        } else if (path === 'automations') {
            await handlers.loadAutomations();
        } else if (path === 'shops') {
            await handlers.loadShops();
        } else if (path === 'listings') {
            await Promise.all([
                handlers.loadListings(),
                handlers.loadListingFolders()
            ]);
        } else if (path === 'sales') {
            await handlers.loadSales();
        } else if (path === 'orders') {
            await handlers.loadOrders();
        } else if (path === 'offers') {
            await handlers.loadOffers();
        } else if (path === 'checklist') {
            await handlers.loadChecklistItems();
        } else if (path === 'templates') {
            await handlers.loadTemplates();
        } else if (path === 'heatmaps') {
            await handlers.loadHeatmapData();
        } else if (path === 'predictions') {
            await handlers.loadPredictions();
        } else if (path === 'suppliers') {
            await handlers.loadSuppliers();
        } else if (path === 'market-intel') {
            await handlers.loadMarketIntel();
        } else if (path === 'webhooks') {
            await handlers.loadWebhooks();
        } else if (path === 'push-notifications') {
            await handlers.loadPushStatus();
        }
        // Re-render after data loads
        const handler = this.routes[path];
        if (handler) handler();
    },

    init() {
        window.addEventListener('popstate', () => this.handleRoute());
        // Catch unhandled errors from async initial route handling
        this.handleRoute(true).catch(err => {
            console.error('[Router] Unhandled init error:', err);
            hideLoadingScreen();
            try { renderApp(pages.dashboard()); } catch (_) {
                try { render(pages.login()); } catch (__) {}
            }
        });
    }
};
