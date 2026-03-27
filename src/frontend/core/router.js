'use strict';
// Hash-based SPA router
// Extracted from app.js lines 15010-15283

// ============================================
// Router — with route-based chunk loading
// ============================================

// Map route paths to chunk names for on-demand loading.
// Chunk names must match the keys in chunkDefs in scripts/build-frontend.js
// and the built files at dist/chunk-{name}.js.
const pageChunkMap = {
    // dashboard — no chunk (core bundle)
    'dashboard': null,

    // inventory chunk
    'inventory': 'inventory',
    'listings': 'inventory',
    'my-listings': 'inventory',
    'crosslist': 'inventory',
    'templates': 'inventory',
    'automations': 'inventory',
    'sku-rules': 'inventory',
    'smart-relisting': 'inventory',
    'inventory-import': 'inventory',
    'recently-deleted': 'inventory',
    'platform-health': 'inventory',

    // analytics → sales chunk (13/16 analytics handlers live in sales chunk)
    'analytics': 'sales',

    // sales chunk
    'sales': 'sales',
    'orders': 'sales',
    'orders-sales': 'sales',
    'offers': 'sales',
    'financials': 'sales',
    'transactions': 'sales',
    'reports': 'sales',
    'report-builder': 'sales',
    'shipping-labels': 'sales',

    // tools chunk
    'checklist': 'tools',
    'calendar': 'tools',
    'planner': 'tools',
    'size-charts': 'tools',
    'image-bank': 'tools',
    'receipt-parser': 'tools',
    'whatnot-live': 'tools',

    // intelligence chunk
    'heatmaps': 'intelligence',
    'predictions': 'intelligence',
    'suppliers': 'intelligence',
    'market-intel': 'intelligence',

    // settings chunk
    'settings': 'settings',
    'account': 'settings',
    'teams': 'settings',
    'plans-billing': 'settings',
    'affiliate': 'settings',
    'notifications': 'settings',
    'connections': 'settings',
    'shipping-profiles': 'settings',
    'push-notifications': 'settings',
    'webhooks': 'settings',
    'shops': 'settings',

    // community chunk
    'community': 'community',
    'help': 'community',
    'support-articles': 'community',
    'report-bug': 'community',
    'tutorials': 'community',
    'roadmap': 'community',
    'suggest-features': 'community',
    'submit-feedback': 'community',
    'feedback-suggestions': 'community',
    'feedback-analytics': 'community',
    'changelog': 'community',
    'help-support': 'community',
    'refer-friend': 'community',
    'terms-of-service': 'community',
    'privacy-policy': 'community',
    'about': 'community',
    'terms': 'community',
    'privacy': 'community',

    // admin
    'admin-metrics': 'admin',

    // AR Preview — no separate chunk (lives in core deferred scripts)
    'ar-preview': null,
};

// Track which chunks are loaded
const _loadedChunks = new Set();
const _loadingChunks = {};

/**
 * Dynamically load a built route-group chunk (dist/chunk-{name}.js).
 * Returns a promise that resolves when the script has loaded.
 */
function loadChunk(chunkName) {
    if (_loadedChunks.has(chunkName)) return Promise.resolve();
    if (_loadingChunks[chunkName]) return _loadingChunks[chunkName];

    const v = '19';
    const src = (window.__CDN_URL__ || '') + '/chunk-' + chunkName + '.js?v=' + v;

    _loadingChunks[chunkName] = new Promise(function(resolve, reject) {
        var timeout = setTimeout(function() {
            reject(new Error('Chunk load timeout: ' + chunkName));
        }, 15000);

        var s = document.createElement('script');
        s.src = src;
        s.onload = function() {
            clearTimeout(timeout);
            _loadedChunks.add(chunkName);
            delete _loadingChunks[chunkName];
            resolve();
        };
        s.onerror = function() {
            clearTimeout(timeout);
            delete _loadingChunks[chunkName];
            reject(new Error('Failed to load chunk: ' + src));
        };
        document.head.appendChild(s);
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
        if (['automations', 'checklist', 'image-bank', 'calendar', 'size-charts', 'planner'].includes(path)) {
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

    // Route aliases for sidebar consolidation — old routes redirect to new parent pages
    routeAliases: {
        'my-listings': { target: 'listings', tab: null },
        'orders': { target: 'orders-sales', tab: 'orders' },
        'sales': { target: 'orders-sales', tab: 'sales-summary' },
        'transactions': { target: 'financials', tab: 'transactions' },
        'report-builder': { target: 'analytics', tab: 'reports' },
        'predictions': { target: 'analytics', tab: 'predictions' },
        'market-intel': { target: 'analytics', tab: 'market-intel' },
        'suppliers': { target: 'analytics', tab: 'sourcing' },
        'platform-health': { target: 'shops', tab: 'health' },
        // checklist + calendar: standalone routes (aliases removed — pages.planner() doesn't exist)
        // roadmap: standalone route — pages.roadmap() handles it directly
        'feedback-suggestions': { target: 'help-support', tab: 'feedback' },
        'teams': { target: 'settings', tab: 'teams' },
        'size-charts': { target: 'settings', tab: 'reference-data' },
        'recently-deleted': { target: 'inventory', tab: 'trash' },
        'about': { target: 'help-support', tab: 'about' },
        'terms-of-service': { target: 'help-support', tab: 'terms' },
        'privacy-policy': { target: 'help-support', tab: 'privacy' },
        // admin-metrics: standalone page (no alias — loads admin chunk directly)
    },

    async handleRoute(isInitialLoad = false) {
        let path = (window.location.hash.slice(1) || 'dashboard').split('?')[0];
        const previousPage = store.state.currentPage;

        // Resolve route aliases (old routes → new consolidated pages)
        const alias = this.routeAliases[path];
        if (alias) {
            path = alias.target;
            store.setState({ activeTab: alias.tab });
            window.history.replaceState({}, '', `#${path}`);
        }

        // Clear timers/intervals on navigation to prevent leaks
        if (window._lockoutCountdown) {
            clearInterval(window._lockoutCountdown);
            window._lockoutCountdown = null;
        }
        if (window._loginBanCountdown) {
            clearInterval(window._loginBanCountdown);
            window._loginBanCountdown = null;
        }
        if (typeof countdownTimer !== 'undefined') countdownTimer.stopUpdates();
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
            const validTabs = ['profile','appearance','notifications','integrations','tools','billing','data','teams','reference-data','admin'];
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
        const publicRoutes = ['login', 'register', 'forgot-password', 'reset-password', 'email-verification', 'verify-email', 'about', 'terms', 'privacy', 'terms-of-service', 'privacy-policy', '404'];
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
                } else if (path === 'orders-sales') {
                    await Promise.all([
                        handlers.loadOrders(),
                        handlers.loadSales()
                    ]);
                } else if (path === 'offers') {
                    await handlers.loadOffers();
                } else if (path === 'checklist') {
                    await handlers.loadChecklistItems();
                } else if (path === 'planner') {
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

        const handler = (Object.prototype.hasOwnProperty.call(this.routes, path) ? this.routes[path] : null) || this.routes['404'];
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
                        const pageRenderer = window.pages[path] || window.pages[path.replace(/-/g, '')] || window.pages.dashboard;
                        if (typeof pageRenderer === 'function') {
                            renderApp(pageRenderer());
                        } else {
                            renderApp(window.pages.dashboard());
                        }
                    } catch (renderErr) {
                        console.error('[Router] Fallback render failed:', renderErr);
                        renderApp(window.pages.dashboard());
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
        const handler = Object.prototype.hasOwnProperty.call(this.routes, path) ? this.routes[path] : null;
        if (typeof handler === 'function') handler();
    },

    init() {
        window.addEventListener('popstate', () => this.handleRoute());
        // Catch unhandled errors from async initial route handling
        this.handleRoute(true).catch(err => {
            console.error('[Router] Unhandled init error:', err);
            hideLoadingScreen();
            try { renderApp(window.pages.dashboard()); } catch (_) {
                try { render(window.pages.login()); } catch (__) {}
            }
        });
    }
};
