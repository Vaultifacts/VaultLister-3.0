'use strict';
// initApp, renderApp, resize handler, window globals, stubs, RUM
// Extracted from app.js lines 68638-70302


// ============================================
// App Initialization
// ============================================
async function initApp() {
  try {
    // Hydrate state from localStorage
    store.hydrate();

    // Auto-login with demo account if not authenticated (for development/testing)
    // Skip auto-login if explicitly on login/register page
    const currentHash = window.location.hash.slice(1) || 'dashboard';
    const skipAutoLogin = currentHash === 'login' || currentHash === 'register';

    if (!auth.isAuthenticated() && !skipAutoLogin) {
        // Attempt token refresh if we have a stored refresh token
        if (store.state.refreshToken) {
            try {
                await api.refreshAccessToken();
            } catch (refreshErr) {
                console.warn('Token refresh failed:', refreshErr.message);
            }
        }

        // If still not authenticated, set hash to login so router.init()
        // picks it up after routes are registered (calling router.navigate
        // here would trigger handleRoute before routes exist, causing a
        // routing loop in Firefox that exhausts the History API limit).
        if (!auth.isAuthenticated()) {
            window.location.hash = '#login';
        }
    }

    // Initialize dark mode from localStorage
    const darkMode = localStorage.getItem('vaultlister_dark_mode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
        store.setState({ darkMode: true });
    }

    // Initialize UI helpers
    themeManager.init();
    offlineManager.init();
    backToTopManager.init();
    onboarding.init();
    commandPalette.init();
    keyboardShortcuts.init();
    contextMenu.init();
    sessionMonitor.init();
    notificationCenter.init();
    // Wire WebSocket offer + notification events to badge and toast
    setTimeout(() => {
        if (window.wsSubscribe) {
            wsSubscribe.onOfferReceived((data) => {
                const offer = data.offer || data;
                const title = offer.listing_title || 'your listing';
                const amt = offer.offer_amount != null ? '$' + Number(offer.offer_amount).toFixed(2) : '';
                notificationCenter.add({ title: 'New offer received', message: `${amt} offer on ${title}`, type: 'offer', icon: 'offers' });
                if (typeof toast !== 'undefined') toast.info(`New offer received: ${amt} on ${title}`);
            });
            wsSubscribe.onNotification((data) => {
                const n = data.notification || data;
                if (n && n.title) notificationCenter.add({ title: n.title, message: n.message || '', type: n.type || 'info', icon: 'bell' });
            });
            wsSubscribe.onMonitoringUpdated((data) => {
                if (data.platform === 'poshmark' && data.data) {
                    if (window.store) store.setState({ poshmarkMonitoring: data.data });
                    if (window.handlers && typeof handlers.loadPoshmarkMonitoring === 'function') {
                        handlers.loadPoshmarkMonitoring();
                    }
                }
            });
        }
    }, 2000);
    savedViews.init();

    // Add global UI elements
    const globalUI = document.createElement('div');
    globalUI.id = 'global-ui';
    // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    globalUI.innerHTML =sanitizeHTML( sanitizeHTML(`
        ${components.backToTop()}
        ${components.offlineIndicator()}
        ${components.pullToRefresh()}
        ${notificationCenter.render()}
        ${mobileUI.renderBottomNav()}
        ${mobileUI.renderFAB()}
    `));
    document.body.appendChild(globalUI);

    // Initialize mobile pull-to-refresh
    if (mobileUI.isMobile()) {
        mobileUI.initPullToRefresh(() => {
            location.reload();
        });
    }

    // Register routes
    router.register('login', () => render(window.pages.login()));
    router.register('register', () => render(window.pages.register()));
    router.register('forgot-password', () => render(window.pages.forgotPassword()));
    router.register('reset-password', () => render(window.pages.resetPassword({ mode: 'form' })));
    router.register('email-verification', () => render(window.pages.emailVerification()));
    router.register('verify-email', async () => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const token = params.get('token');
        if (!token) {
            render(window.pages.verifyEmail(false, 'No verification token found in the link.'));
            return;
        }
        render(window.pages.verifyEmail(null, 'Verifying your email\u2026'));
        try {
            const data = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
            render(window.pages.verifyEmail(true, data.message || 'Email verified successfully! You can now log in.'));
        } catch (err) {
            render(window.pages.verifyEmail(false, err.message || 'Verification failed. Please try again.'));
        }
    });
    router.register('dashboard', () => {
        renderApp(window.pages.dashboard());
        // Initialize resize handles and animations after DOM update
        setTimeout(() => {
            widgetManager.initResize();
            widgetManager.initDragDrop();
            handlers.animateCountUp();
            // On mobile, override FAB for dashboard quick actions
            if (mobileUI.isMobile()) {
                const fab = document.querySelector('.fab');
                if (fab) fab.setAttribute('onclick', 'handlers.showDashboardQuickActions()');
            }
        }, 100);
    });
    router.register('inventory', async () => {
        renderApp(window.pages.inventory());
        await handlers.loadInventory();
        renderApp(window.pages.inventory());
    });
    router.register('listings', async () => {
        renderApp(window.pages.listings());
        store.setState({ listingsTab: 'listings' });
        await Promise.all([
            handlers.loadListings(),
            handlers.loadListingFolders()
        ]);
        renderApp(window.pages.listings());
    });
    router.register('crosslist', () => router.navigate('listings'));
    router.register('templates', () => {
        store.setState({ listingsTab: 'templates' });
        renderApp(window.pages.listings());
    });
    router.register('automations', () => renderApp(window.pages.automations()));
    router.register('offers', async () => {
        renderApp(window.pages.offers());
        await handlers.loadOffers();
        renderApp(window.pages.offers());
    });
    router.register('sales', () => renderApp(window.pages.sales()));
    router.register('analytics', () => renderApp(window.pages.analytics()));
    router.register('financials', () => renderApp(window.pages.financials()));
    router.register('shops', () => renderApp(window.pages.shops()));
    router.register('platform-health', async () => {
        renderApp(window.pages.platformHealth());
        await handlers.loadPlatformHealth();
        renderApp(window.pages.platformHealth());
    });
    router.register('recently-deleted', async () => {
        renderApp(window.pages.recentlyDeleted());
        await handlers.loadDeletedItems();
        renderApp(window.pages.recentlyDeleted());
    });
    router.register('report-builder', async () => {
        renderApp(window.pages.reportBuilder());
        await handlers.loadReports();
        renderApp(window.pages.reportBuilder());
    });
    router.register('settings', () => renderApp(window.pages.settings()));
    router.register('account', () => renderApp(window.pages.account()));
    router.register('admin-metrics', async () => {
        renderApp(window.pages.adminMetrics());
        await handlers.refreshAdminMetrics?.();
        renderApp(window.pages.adminMetrics());
    });
    router.register('community', () => renderApp(window.pages.community()));
    router.register('help', () => renderApp(window.pages.help()));

    // Main section pages
    router.register('orders', async () => {
        renderApp(window.pages.orders());
        await handlers.loadOrders();
        renderApp(window.pages.orders());
    });
    // Consolidated: Orders & Sales page
    router.register('orders-sales', async () => {
        renderApp(window.pages.orders());
        await Promise.all([handlers.loadOrders(), handlers.loadSales()]);
        renderApp(window.pages.orders());
    });
    router.register('checklist', () => renderApp(window.pages.checklist()));
    router.register('calendar', () => renderApp(window.pages.calendar()));
    // Consolidated: Planner page
    router.register('planner', async () => {
        renderApp(window.pages.checklist());
        await handlers.loadChecklistItems();
        renderApp(window.pages.checklist());
    });
    router.register('size-charts', () => renderApp(window.pages.sizeCharts()));
    router.register('image-bank', async () => {
        renderApp(window.pages.imageBank());
        await handlers.loadImageStorageStats();
        renderApp(window.pages.imageBank());
    });

    // Tools section pages
    router.register('sku-rules', async () => {
        renderApp(window.pages.skuRules());
        await handlers.loadSkuRules();
        renderApp(window.pages.skuRules());
    });

    // Business section pages
    router.register('receipt-parser', async () => {
        renderApp(window.pages.receiptParser());
        await handlers.loadReceiptQueue();
        await handlers.loadReceiptVendors();
        await handlers.loadEmailAccounts();
        renderApp(window.pages.receiptParser());
    });

    // Intelligence section pages
    router.register('heatmaps', async () => {
        renderApp(window.pages.heatmaps());
        await handlers.loadHeatmapData();
        renderApp(window.pages.heatmaps());
    });
    router.register('predictions', async () => {
        renderApp(window.pages.predictions());
        await handlers.loadPredictions();
        renderApp(window.pages.predictions());
    });
    router.register('suppliers', async () => {
        renderApp(window.pages.suppliers());
        await handlers.loadSuppliers();
        renderApp(window.pages.suppliers());
    });
    router.register('market-intel', async () => {
        renderApp(window.pages.marketIntel());
        await handlers.loadMarketIntel();
        renderApp(window.pages.marketIntel());
    });

    // Integrations section pages
    router.register('webhooks', async () => {
        renderApp(window.pages.webhooks());
        await handlers.loadWebhooks();
        renderApp(window.pages.webhooks());
    });
    router.register('push-notifications', async () => {
        renderApp(window.pages.pushNotifications());
        await handlers.loadPushStatus();
        renderApp(window.pages.pushNotifications());
    });

    // Settings section pages
    router.register('shipping-profiles', async () => {
        renderApp(window.pages.shippingProfiles());
        await handlers.loadShippingProfiles();
        renderApp(window.pages.shippingProfiles());
    });
    router.register('teams', async () => {
        renderApp(window.pages.teams());
        await handlers.loadTeamsPage();
        renderApp(window.pages.teams());
    });
    router.register('plans-billing', () => renderApp(window.pages.plansBilling()));
    router.register('affiliate', () => renderApp(window.pages.affiliate()));
    router.register('notifications', () => renderApp(window.pages.notifications()));
    router.register('connections', () => renderApp(window.pages.connections()));
    router.register('terms-of-service', () => renderApp(window.pages.termsOfService()));
    router.register('privacy-policy', () => renderApp(window.pages.privacyPolicy()));
    router.register('refer-friend', () => renderApp(window.pages.referFriend()));

    // Help section pages
    router.register('support-articles', async () => {
        renderApp(window.pages.supportArticles());
        await Promise.all([handlers.loadFAQs(), handlers.loadArticles()]);
        renderApp(window.pages.supportArticles());
    });
    router.register('report-bug', () => renderApp(window.pages.reportBug()));
    router.register('tutorials', () => renderApp(window.pages.tutorials()));

    // Other section pages
    router.register('roadmap', async () => {
        renderApp(window.pages.roadmap());
        await handlers.loadRoadmapFeatures();
        renderApp(window.pages.roadmap());
    });
    router.register('suggest-features', () => renderApp(window.pages.suggestFeatures()));
    router.register('submit-feedback', async () => {
        renderApp(window.pages.submitFeedback());
        await handlers.loadUserFeedback();
        renderApp(window.pages.submitFeedback());
    });
    router.register('changelog', () => renderApp(window.pages.changelog()));

    // Help & Support, Feedback, and Transactions pages
    router.register('help-support', () => renderApp(window.pages.helpSupport()));
    router.register('feedback-suggestions', async () => {
        renderApp(window.pages.feedbackSuggestions());
        await handlers.loadTrendingFeedback();
        renderApp(window.pages.feedbackSuggestions());
    });
    router.register('feedback-analytics', async () => {
        renderApp(window.pages.feedbackAnalytics());
        await handlers.loadFeedbackAnalytics();
        renderApp(window.pages.feedbackAnalytics());
    });
    router.register('transactions', () => renderApp(window.pages.transactions()));

    // Phase 5 feature pages
    router.register('smart-relisting', async () => {
        renderApp(window.pages.smartRelisting());
        await handlers.loadRelistingData();
        renderApp(window.pages.smartRelisting());
    });
    router.register('shipping-labels', async () => {
        renderApp(window.pages.shippingLabelsPage());
        await handlers.loadShippingLabelsData();
        renderApp(window.pages.shippingLabelsPage());
    });
    router.register('inventory-import', async () => {
        renderApp(window.pages.inventoryImport());
        await handlers.loadImportData();
        renderApp(window.pages.inventoryImport());
    });

    // Phase 6 feature pages
    router.register('whatnot-live', async () => {
        renderApp(window.pages.whatnotLive());
        await handlers.loadWhatnotData();
        renderApp(window.pages.whatnotLive());
    });
    router.register('reports', async () => {
        renderApp(window.pages.reports());
        await handlers.loadReportsData();
        renderApp(window.pages.reports());
    });

    // AR Preview
    router.register('ar-preview', async () => {
        if (!store.state.inventory || store.state.inventory.length === 0) {
            await handlers.loadInventory().catch(() => {});
        }
        renderApp(window.pages.arPreview());
    });

    // Company section pages
    router.register('about', () => renderApp(window.pages.about()));
    router.register('terms', () => renderApp(window.pages.terms()));
    router.register('privacy', () => renderApp(window.pages.privacy()));

    router.register('404', () => renderApp(window.pages.notFound()));

    // Initialize voice commands - disabled
    // voiceCommands.init();

    // Online/offline handlers are in offlineManager.init()

    // OAuth callback handler via postMessage (handles both same-origin and cross-origin via ngrok)
    window.addEventListener('message', (event) => { // nosemgrep: javascript.browser.security.insufficient-postmessage-origin-validation.insufficient-postmessage-origin-validation
        // Verify message origin — accept same-origin and configured API base
        const allowedOrigins = [window.location.origin];
        const apiBase = store.state?.apiBase || window.location.origin;
        if (apiBase && apiBase !== window.location.origin) allowedOrigins.push(apiBase);
        if (!allowedOrigins.includes(event.origin)) return;

        if (event.data && event.data.type === 'email-oauth-success') {
            // Handled in connectGmail function
        } else if (event.data && event.data.type === 'email-oauth-error') {
            // Handled in connectGmail function
        } else if (event.data && event.data.type === 'oauthComplete') {
            // Marketplace OAuth complete — dispatch as CustomEvent so shop handler picks it up
            window.dispatchEvent(new CustomEvent('oauthComplete', { detail: event.data }));
        }
    });

    // Load initial data if authenticated
    if (auth.isAuthenticated()) {
        try {
            // Add 5 second timeout to prevent hanging on server issues
            const dataPromise = Promise.all([
                api.get('/inventory?limit=200'),
                api.get('/analytics/dashboard')
            ]);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Data load timeout')), 5000)
            );

            const [inventoryData, analyticsData] = await Promise.race([
                dataPromise,
                timeoutPromise
            ]);

            store.setState({
                inventory: inventoryData.items || []
            });
        } catch (e) {
            // Silently handle - app will still load with empty state
            // Set empty data so app can still load
            store.setState({ inventory: [] });
        }
    }

    // Load to-do lists from localStorage
    handlers.loadTodoListsFromStorage();

    // Load automation schedule and category filter from localStorage
    handlers.loadAutomationScheduleFromStorage();
    handlers.loadAutomationCategoryFilterFromStorage();

    // Webhook modal function
    window.showAddWebhookModal = function() {
        const eventTypes = store.state.webhookEventTypes || [];
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'webhook-modal';
        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        modal.innerHTML =sanitizeHTML( sanitizeHTML(`
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Add Webhook Endpoint</h3>
                    <button class="btn btn-ghost" onclick="document.getElementById('webhook-modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Name</label>
                        <input type="text" id="wh-name" class="form-input" placeholder="My Webhook">
                    </div>
                    <div class="form-group">
                        <label class="form-label">URL</label>
                        <input type="url" id="wh-url" class="form-input" placeholder="https://example.com/webhook">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Events</label>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                            ${eventTypes.map(et => `
                                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem;">
                                    <input type="checkbox" class="wh-event-cb" value="${escapeHtml(et.type)}">
                                    ${escapeHtml(et.type)}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="document.getElementById('webhook-modal').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.submitWebhookEndpoint()">Create Endpoint</button>
                </div>
            </div>
        `));
        document.body.appendChild(modal);
    };

    window.submitWebhookEndpoint = async function() {
        const name = document.getElementById('wh-name').value.trim();
        const url = document.getElementById('wh-url').value.trim();
        const events = [...document.querySelectorAll('.wh-event-cb:checked')].map(cb => cb.value);
        if (!name || !url) { toast.error('Name and URL required'); return; }
        await handlers.createWebhookEndpoint({ name, url, events });
        document.getElementById('webhook-modal')?.remove();
    };

    // Initialize router
    try {
        router.init();
    } catch (error) {
        console.error('Router init error:', error);
    }

  } catch (error) {
    console.error('App initialization error:', error);
    // On fatal init error, force-show login page so user isn't stuck
    hideLoadingScreen();
    try { render(window.pages.login()); } catch (_) {}
  } finally {
    hideLoadingScreen();
  }
}

// Hide the loading screen, clear fail-safe timer, and signal success to index.html
function hideLoadingScreen() {
    // Tell the index.html fail-safe that the app rendered successfully
    if (typeof window.__markAppRendered === 'function') window.__markAppRendered();
    if (window.__loadingTimeout) {
        clearTimeout(window.__loadingTimeout);
        window.__loadingTimeout = null;
    }
    const ls = document.getElementById('loading-screen');
    if (ls) {
        ls.classList.add('hidden');
        // Remove from DOM after transition
        setTimeout(() => ls.remove(), 500);
    }
}

// Render helpers
function render(content) {
    // Wrap in <main> so public pages (login, register, etc.) have a landmark
    // that screen readers can jump to, matching the skip-link target used in renderApp.
    document.getElementById('app').innerHTML =  // nosemgrep: javascript.browser.security.insecure-document-method  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
       sanitizeHTML( sanitizeHTML(`<main id="main-content" tabindex="-1" aria-label="Page content">${content}</main>`));
    hideLoadingScreen();
}

function renderApp(pageContent) {
    // Clear live analytics timer when navigating away
    if (window._liveAnalyticsTimer) {
        clearInterval(window._liveAnalyticsTimer);
        window._liveAnalyticsTimer = null;
        store.setState({ liveAnalyticsEnabled: false });
    }

    if (!auth.isAuthenticated()) {
        router.navigate('login');
        return;
    }

    try {
        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        document.getElementById('app').innerHTML =sanitizeHTML( sanitizeHTML(`
            <a class="skip-link" href="#main-content">Skip to main content</a>
            <div class="app-layout">
                ${components.sidebar()}
                <div class="sidebar-backdrop ${store.state.sidebarOpen ? 'active' : ''}"
                     onclick="store.setState({ sidebarOpen: false }); renderApp(pages[store.state.currentPage]())"></div>
                <div class="sidebar-overlay" onclick="store.setState({sidebarOpen:false});document.querySelector('.sidebar')?.classList.remove('open');this.classList.remove('visible');"></div>
                <div class="mobile-header">
                    <button class="mobile-menu-btn" onclick="const _open=!store.state.sidebarOpen;store.setState({sidebarOpen:_open});document.querySelector('.sidebar')?.classList.toggle('open',_open);document.querySelector('.sidebar-overlay')?.classList.toggle('visible',_open);" aria-label="Open menu">
                        ${components.icon('menu')}
                    </button>
                    <span class="mobile-header-title">VaultLister</span>
                    <button class="mobile-menu-btn" onclick="document.getElementById('global-search')?.focus()" aria-label="Search">
                        ${components.icon('search')}
                    </button>
                </div>
                <div class="main-wrapper">
                    ${components.header()}
                    <main class="main-content" role="main" id="main-content" tabindex="-1" aria-label="Page content">
                        <div class="page-content">
                            ${store.state.currentPage !== 'dashboard' && store.state.currentPage !== 'login' && store.state.currentPage !== 'register' ? components.breadcrumb(store.state.currentPage) : ''}
                            ${pageContent}
                        </div>
                    </main>
                </div>
            </div>
            ${components.vaultBuddy()}
            ${components.photoEditorModal()}
        `));

        // Move focus to main content on route change for screen readers
        const mainEl = document.getElementById('main-content');
        if (mainEl) mainEl.focus({ preventScroll: true });

        hideLoadingScreen();

        // Update browser tab badge with unread notification count
        if (typeof handlers !== 'undefined' && handlers.updateTabBadge) {
            handlers.updateTabBadge();
        }
    } catch (err) {
        console.error('renderApp error:', err);
        hideLoadingScreen();
        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        document.getElementById('app').innerHTML =sanitizeHTML( sanitizeHTML(`
            <div style="padding: 40px; text-align: center; font-family: system-ui;">
                <h2>Something went wrong</h2>
                <p style="color: #666;">An error occurred while rendering the page.</p>
                <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 24px; cursor: pointer; border-radius: 6px; border: 1px solid #ccc;">
                    Reload Page
                </button>
            </div>
        `));
    }
}

// Apply dark mode immediately before app initialization
// This prevents flash of light mode on page load
(function() {
    const darkMode = localStorage.getItem('vaultlister_dark_mode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
    }
})();

// Responsive resize handler — zoom + desktop-lock to prevent layout jumps
(function() {
    // Lock threshold: above the highest CSS breakpoint (1024px sidebar).
    // When viewport < LOCK_WIDTH, zoom the page AND lock desktop layout
    // so CSS media queries don't cause jarring layout shifts.
    var LOCK_WIDTH = 1100;
    var resizeTimer = null;

    function getPhysicalWidth() {
        var ow = window.outerWidth;
        return ow > 0 ? Math.max(ow - 17, 300) : window.innerWidth;
    }

    function applyLayout() {
        var vw = getPhysicalWidth();
        var html = document.documentElement;

        // On real small-screen devices (phones/tablets), screen.width is small.
        // Don't apply desktop-lock — let CSS breakpoints handle mobile layout.
        if (screen.width < LOCK_WIDTH) {
            html.style.zoom = '';
            html.classList.remove('desktop-lock');
            return;
        }

        if (vw < LOCK_WIDTH) {
            // Zoom to fit + lock desktop layout (prevent breakpoint CSS)
            var z = vw / LOCK_WIDTH;
            html.style.zoom = z;
            html.classList.add('desktop-lock');
        } else {
            // Full size — let normal CSS breakpoints work
            html.style.zoom = '';
            html.classList.remove('desktop-lock');
        }
    }

    // Set initial state on page load
    applyLayout();

    window.addEventListener('resize', function() {
        // Disable ALL CSS transitions during resize to prevent rubber-banding
        document.documentElement.classList.add('is-resizing');

        // Apply zoom + desktop-lock instantly
        applyLayout();

        // After resize stops, re-enable transitions
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            document.documentElement.classList.remove('is-resizing');
        }, 300);
    });
})();

// Start the app
initApp();

// Preload the current route's chunk after first render
(function preloadCurrentChunk() {
    requestAnimationFrame(function() {
        setTimeout(function() {
            var path = window.location.hash.slice(1) || 'dashboard';
            if (path.startsWith('settings/')) path = 'settings';
            var chunk = typeof pageChunkMap !== 'undefined' && pageChunkMap[path];
            if (chunk && typeof loadChunk === 'function') {
                loadChunk(chunk).catch(function(err) {
                    console.warn('[Preload] Failed to preload chunk:', chunk, err);
                });
            }
        }, 0);
    });
})();

// Service Worker message listener
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event) { // nosemgrep: javascript.browser.security.postmessage-origin-validation
        if (!event.data) return;
        // Respond to GET_AUTH_TOKEN requests from the SW (used by background sync)
        if (event.data.type === 'GET_AUTH_TOKEN') {
            var token = (typeof store !== 'undefined' && store.state && store.state.token) || null;
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ token: token });
            }
        }
        // SW requests client to flush the offline queue after background sync fires
        if (event.data.type === 'SW_FLUSH_OFFLINE_QUEUE') {
            if (typeof offlineManager !== 'undefined' && navigator.onLine) {
                offlineManager.syncQueue();
            }
        }
    });
}

// Export for global access
window.router = router;
window.store = store;
window.api = api;
window.toast = toast;
window.auth = auth;
window.modals = modals;
window.handlers = handlers;
window.voiceCommands = voiceCommands;
window.onboarding = onboarding;
window.widgetManager = widgetManager;
window.tablePrefs = tablePrefs;
window.renderApp = renderApp;
window.pages = pages;
window.components = components;
window.pomodoroTimer = pomodoroTimer;
window.kanbanBoard = kanbanBoard;
window.taskTemplates = taskTemplates;
window.measurementTool = measurementTool;
window.sizeConverter = sizeConverter;
// Expose utility functions and widgets needed by lazy-loaded chunks
window.escapeHtml = escapeHtml;
window.toLocalDate = toLocalDate;
window.viewModeToggle = viewModeToggle;
window.runningBalance = runningBalance;
window.financialDashboardHeader = financialDashboardHeader;
window.runHistoryTimeline = runHistoryTimeline;
window.businessFAB = businessFAB;
window.aiConfidenceGauge = aiConfidenceGauge;
window.priceDropBanner = priceDropBanner;
window.marketTrendsRadar = marketTrendsRadar;
window.streakCounter = streakCounter;
window.storageGauge = storageGauge;

// Advanced New Listing window functions
window._advNewActiveTab = null;
window.toggleAdvancedNewPlatform = function(platform, checked) {
    const tab = document.querySelector(`#adv-new-tabs [data-platform="${platform}"]`);
    const panel = document.getElementById(`adv-new-panel-${platform}`);
    const tabsBar = document.getElementById('adv-new-tabs');
    const noMsg = document.getElementById('adv-new-no-platforms');

    if (checked) {
        if (tab) tab.style.display = '';
        // Auto-switch to this tab if none active
        const anyActive = document.querySelector('.advanced-platform-tab.active');
        if (!anyActive) {
            window.switchAdvancedNewTab(platform);
        }
    } else {
        if (tab) { tab.style.display = 'none'; tab.classList.remove('active'); }
        if (panel) panel.style.display = 'none';
        // If this was the active tab, switch to first visible
        if (window._advNewActiveTab === platform) {
            const firstVisible = document.querySelector('.adv-new-platform-checkbox:checked');
            if (firstVisible) {
                window.switchAdvancedNewTab(firstVisible.value);
            } else {
                window._advNewActiveTab = null;
            }
        }
    }

    const anySelected = document.querySelectorAll('.adv-new-platform-checkbox:checked').length > 0;
    if (tabsBar) tabsBar.style.display = anySelected ? 'flex' : 'none';
    if (noMsg) noMsg.style.display = anySelected ? 'none' : '';
};

window.switchAdvancedNewTab = function(platform) {
    // Deactivate all tabs and panels
    document.querySelectorAll('.advanced-platform-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.advanced-platform-panel').forEach(p => p.style.display = 'none');

    // Activate selected
    const tab = document.querySelector(`#adv-new-tabs [data-platform="${platform}"]`);
    const panel = document.getElementById(`adv-new-panel-${platform}`);
    if (tab) tab.classList.add('active');
    if (panel) panel.style.display = '';
    window._advNewActiveTab = platform;
};

window.applyToAllNewPlatforms = function() {
    const active = window._advNewActiveTab;
    if (!active) return toast.warning('No active tab to copy from');

    const sourcePanel = document.getElementById(`adv-new-panel-${active}`);
    if (!sourcePanel) return;

    const title = sourcePanel.querySelector(`[name="${active}_title"]`)?.value || '';
    const description = sourcePanel.querySelector(`[name="${active}_description"]`)?.value || '';
    const price = sourcePanel.querySelector(`[name="${active}_price"]`)?.value || '';
    const condition = sourcePanel.querySelector(`[name="${active}_condition"]`)?.value || '';
    const category = sourcePanel.querySelector(`[name="${active}_category"]`)?.value || '';
    const tags = sourcePanel.querySelector(`[name="${active}_tags"]`)?.value || '';

    const platforms = ['poshmark', 'ebay', 'whatnot', 'depop', 'shopify', 'facebook'];
    platforms.forEach(p => {
        if (p === active) return;
        const panel = document.getElementById(`adv-new-panel-${p}`);
        if (!panel) return;
        const titleInput = panel.querySelector(`[name="${p}_title"]`);
        const descInput = panel.querySelector(`[name="${p}_description"]`);
        const priceInput = panel.querySelector(`[name="${p}_price"]`);
        const condInput = panel.querySelector(`[name="${p}_condition"]`);
        const catInput = panel.querySelector(`[name="${p}_category"]`);
        const tagsInput = panel.querySelector(`[name="${p}_tags"]`);
        if (titleInput) titleInput.value = title;
        if (descInput) descInput.value = description;
        if (priceInput) priceInput.value = price;
        if (condInput) condInput.value = condition;
        if (catInput) catInput.value = category;
        if (tagsInput) tagsInput.value = tags;
    });

    toast.success('Common fields applied to all platforms');
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }

    // Ctrl/Cmd + Shift shortcuts
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        switch (e.key.toLowerCase()) {
            case 's':
                e.preventDefault();
                router.navigate('shops');
                return;
            case 'd':
                e.preventDefault();
                router.navigate('dashboard');
                return;
        }
    }

    // Ctrl/Cmd + key shortcuts
    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'n':
                e.preventDefault();
                router.navigate('inventory');
                setTimeout(() => modals.addItem(), 100);
                break;
            case '/':
                e.preventDefault();
                const searchInput = document.getElementById('global-search') || document.getElementById('inventory-search');
                searchInput?.focus();
                break;
            case 'k':
                e.preventDefault();
                handlers.openGlobalSearch();
                break;
            case 's':
                e.preventDefault();
                // Save current form if one is active
                const activeForm = document.querySelector('form:focus-within, .modal form');
                if (activeForm) {
                    activeForm.requestSubmit();
                } else {
                    toast.info('No form to save');
                }
                break;
            case 'e':
                e.preventDefault();
                router.navigate('listings');
                break;
            case 'i':
                e.preventDefault();
                router.navigate('inventory');
                break;
            case 'd':
                e.preventDefault();
                router.navigate('dashboard');
                break;
        }
    }

    // Alt + number for quick navigation
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key) {
            case '1':
                e.preventDefault();
                router.navigate('dashboard');
                break;
            case '2':
                e.preventDefault();
                router.navigate('inventory');
                break;
            case '3':
                e.preventDefault();
                router.navigate('listings');
                break;
            case '4':
                e.preventDefault();
                router.navigate('orders');
                break;
            case '5':
                e.preventDefault();
                router.navigate('analytics');
                break;
        }
    }

    // Single key shortcuts (no modifiers)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key) {
            case '/':
                e.preventDefault();
                (document.getElementById('global-search') || document.getElementById('inventory-search'))?.focus();
                break;
            case '?':
                e.preventDefault();
                handlers.showKeyboardShortcuts?.();
                break;
            case 'Escape':
                // Close any open modal or dropdown
                modals.close();
                document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
                break;
        }
    }
});

// Keyboard shortcuts modal handler
handlers.showKeyboardShortcuts = function() {
    const kbd = (text) => `<kbd style="background: var(--gray-100); padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: nowrap;">${text}</kbd>`;
    const row = (label, key) => `<div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;"><span>${label}</span>${kbd(key)}</div>`;

    modals.show(`
        <div class="modal-header">
            <h2 class="modal-title">Keyboard Shortcuts</h2>
            <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
        </div>
        <div class="modal-body">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="font-semibold mb-3" style="color: var(--primary-600);">Navigation</h4>
                    <div class="space-y-2 text-sm">
                        ${row('Dashboard', 'Ctrl + D')}
                        ${row('Listings', 'Ctrl + E')}
                        ${row('Inventory', 'Ctrl + I')}
                        ${row('Open search', 'Ctrl + /')}
                        ${row('Open Vault Buddy', 'Ctrl + K')}
                        ${row('Show shortcuts', '?')}
                    </div>
                </div>
                <div>
                    <h4 class="font-semibold mb-3" style="color: var(--primary-600);">Actions</h4>
                    <div class="space-y-2 text-sm">
                        ${row('New item', 'Ctrl + N')}
                        ${row('Save form', 'Ctrl + S')}
                        ${row('Close modal / Cancel', 'Escape')}
                    </div>
                    <h4 class="font-semibold mb-3 mt-4" style="color: var(--primary-600);">Quick Nav</h4>
                    <div class="space-y-2 text-sm">
                        ${row('Nav slot 1', 'Alt + 1')}
                        ${row('Nav slot 2', 'Alt + 2')}
                        ${row('Nav slot 3', 'Alt + 3')}
                        ${row('Nav slot 4', 'Alt + 4')}
                        ${row('Nav slot 5', 'Alt + 5')}
                    </div>
                </div>
            </div>
            <div class="mt-4 text-xs text-gray-500 text-center">
                Tip: Press <kbd style="background: var(--gray-100); padding: 1px 4px; border-radius: 4px; font-family: monospace;">?</kbd> anytime to see this help
            </div>
        </div>
    `);
};

// Plans & Billing handlers
handlers.showUsageDashboard = async function() {
    try {
        const response = await api.get('/billing/usage');
        const usageArray = response?.usage || [];

        // Transform API array into keyed lookup
        const getMetric = (name) => usageArray.find(m => m.metric === name) || { current_value: 0, plan_limit: 0 };
        const usage = {
            listings: getMetric('listings_count'),
            orders: getMetric('orders_count'),
            automations: getMetric('automation_runs'),
            storage: getMetric('storage_mb')
        };

        const getColorStatus = (percent) => {
            if (percent > 95) return { color: '#ef4444', status: 'danger' };
            if (percent > 80) return { color: '#f59e0b', status: 'warning' };
            return { color: '#10b981', status: 'success' };
        };

        const renderMeter = (label, current, limit, unit = '') => {
            const isUnlimited = limit === -1;
            const percent = isUnlimited ? 0 : (limit > 0 ? Math.min(100, (current / limit) * 100) : 0);
            const colorInfo = isUnlimited ? { color: '#10b981', status: 'success' } : getColorStatus(percent);
            return `
                <div class="usage-meter-item">
                    <div class="usage-meter-header">
                        <span class="usage-meter-label">${escapeHtml(label)}</span>
                        <span class="usage-meter-value">${current} / ${isUnlimited ? 'Unlimited' : limit} ${unit}</span>
                    </div>
                    <div class="usage-meter-bar-container">
                        <div class="usage-meter-bar-fill" style="width: ${isUnlimited ? 0 : percent}%; background-color: ${colorInfo.color};"></div>
                    </div>
                    <span class="usage-meter-percent" style="color: ${colorInfo.color};">${isUnlimited ? 'No limit' : Math.round(percent) + '%'}</span>
                </div>
            `;
        };

        modals.show(`
            <div class="modal-header">
                <h2 class="modal-title">Usage Dashboard</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div class="usage-dashboard-container" style="display: grid; gap: 24px;">
                    ${renderMeter('Active Listings', usage.listings.current_value, usage.listings.plan_limit)}
                    ${renderMeter('Total Orders', usage.orders.current_value, usage.orders.plan_limit)}
                    ${renderMeter('Automations', usage.automations.current_value, usage.automations.plan_limit)}
                    ${renderMeter('Storage', usage.storage.current_value, usage.storage.plan_limit, 'MB')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="router.navigate('plans-billing'); modals.close();">View Billing Details</button>
                <button class="btn btn-secondary" onclick="modals.close();">Close</button>
            </div>
        `);
    } catch (error) {
        toast.error('Failed to load usage data');
    }
};

handlers.showProrationCalculator = async function() {
    try {
        const currentPlan = store.state.user?.subscription_tier || 'free';
        const plansData = await api.get('/billing/plans');
        const plans = plansData?.plans || plansData || [];

        const selectedPlanName = document.getElementById('proration-plan-select')?.value || (plans.find(p => p.name !== currentPlan)?.name || 'pro');
        const selectedPlan = plans.find(p => p.name === selectedPlanName) || plans[0];
        const currentPlanObj = plans.find(p => p.name === currentPlan);

        // Calculate days remaining in current billing cycle
        const now = new Date();
        const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const totalDays = Math.ceil((cycleEnd - cycleStart) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.ceil((cycleEnd - now) / (1000 * 60 * 60 * 24));
        const daysUsed = totalDays - daysRemaining;

        const currentPrice = currentPlanObj?.price || 0;
        const newPrice = selectedPlan?.price || 0;
        const prorationCredit = (currentPrice / totalDays) * daysRemaining;
        const proratedCharge = (newPrice / totalDays) * daysRemaining;
        const amountDue = proratedCharge - prorationCredit;

        const formatLimit = (val) => val === -1 ? 'Unlimited' : val;

        modals.show(`
            <div class="modal-header">
                <h2 class="modal-title">Plan Change Calculator</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div style="display: grid; gap: 20px;">
                    <div class="form-group">
                        <label class="form-label">Select New Plan</label>
                        <select id="proration-plan-select" class="form-select" onchange="handlers.showProrationCalculator()">
                            ${plans.filter(p => p.name !== currentPlan).map(plan => `
                                <option value="${plan.name}" ${plan.name === selectedPlanName ? 'selected' : ''}>
                                    ${escapeHtml(plan.display_name)} - $${plan.price}/month (${formatLimit(plan.limits?.listings)} listings)
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="proration-details-grid" style="display: grid; gap: 12px;">
                        <div class="proration-detail-row" style="display: flex; justify-content: space-between; padding: 12px; background: var(--gray-50); border-radius: 4px;">
                            <span>Current Plan:</span>
                            <strong>${escapeHtml(currentPlanObj?.display_name || currentPlan)}</strong>
                        </div>
                        <div class="proration-detail-row" style="display: flex; justify-content: space-between; padding: 12px; background: var(--gray-50); border-radius: 4px;">
                            <span>Days Remaining in Cycle:</span>
                            <strong>${daysRemaining} of ${totalDays} days</strong>
                        </div>
                        <div class="proration-detail-row" style="display: flex; justify-content: space-between; padding: 12px; background: var(--gray-50); border-radius: 4px;">
                            <span>Prorated Credit:</span>
                            <strong style="color: var(--success);">-$${prorationCredit.toFixed(2)}</strong>
                        </div>
                        <div class="proration-detail-row" style="display: flex; justify-content: space-between; padding: 12px; background: var(--gray-50); border-radius: 4px;">
                            <span>New Plan Price:</span>
                            <strong>$${newPrice.toFixed(2)}/month</strong>
                        </div>
                        <div class="proration-detail-row" style="display: flex; justify-content: space-between; padding: 12px; background: var(--primary-50); border-radius: 4px; border: 1px solid var(--primary-200);">
                            <span style="font-weight: 600;">Amount Due Today:</span>
                            <strong style="color: var(--primary-600); font-size: 18px;">$${Math.max(0, amountDue).toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="handlers.confirmPlanChange('${selectedPlanName}');">Confirm Change</button>
                <button class="btn btn-secondary" onclick="modals.close();">Cancel</button>
            </div>
        `);
    } catch (error) {
        toast.error('Failed to load billing plans');
    }
};

handlers.confirmPlanChange = async function(planId) {
    try {
        await api.post('/billing/change-plan', { planId });
        toast.success(`Plan changed to ${planId} successfully`);
        modals.close();
        // Refresh user data to reflect new plan
        const userData = await api.get('/auth/me');
        if (userData?.user) store.setState({ user: userData.user });
    } catch (error) {
        toast.error(error.message || 'Failed to change plan');
    }
};

handlers.showPlanComparison = async function() {
    try {
        const plansData = await api.get('/billing/plans');
        const plans = plansData?.plans || plansData || [];

        const currentPlan = store.state.user?.subscription_tier || 'free';
        const formatLimit = (val) => val === -1 ? 'Unlimited' : val;
        const features = [
            { label: 'Monthly Price', getValue: (p) => `$${p.price}/mo` },
            { label: 'Active Listings', getValue: (p) => formatLimit(p.limits?.listings) },
            { label: 'Order Limit', getValue: (p) => formatLimit(p.limits?.orders) },
            { label: 'Storage', getValue: (p) => p.limits?.storage_mb >= 1000 ? `${(p.limits.storage_mb / 1000).toFixed(0)} GB` : `${p.limits?.storage_mb} MB` },
            { label: 'Automations', getValue: (p) => formatLimit(p.limits?.automations) }
        ];

        modals.show(`
            <div class="modal-header">
                <h2 class="modal-title">Plan Comparison</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--gray-200);">
                                <th style="padding: 12px; text-align: left;">Feature</th>
                                ${plans.map(plan => `
                                    <th style="padding: 12px; text-align: center; ${plan.name === currentPlan ? 'background: var(--primary-50); color: var(--primary-600); font-weight: 600;' : ''}">
                                        ${escapeHtml(plan.display_name)}
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${features.map((feature, idx) => `
                                <tr style="border-bottom: 1px solid var(--gray-100); ${idx % 2 === 0 ? 'background: var(--gray-50);' : ''}">
                                    <td style="padding: 12px; font-weight: 500;">${escapeHtml(feature.label)}</td>
                                    ${plans.map(plan => `
                                        <td style="padding: 12px; text-align: center; ${plan.name === currentPlan ? 'background: var(--primary-50); font-weight: 600;' : ''}">
                                            ${feature.getValue(plan)}
                                        </td>
                                    `).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                ${plans.map(plan => `
                    <button class="btn ${plan.name === currentPlan ? 'btn-secondary' : 'btn-primary'}"
                            onclick="handlers.selectPlan('${plan.name}'); modals.close();"
                            ${plan.name === currentPlan ? 'disabled' : ''}>
                        ${plan.name === currentPlan ? 'Current Plan' : 'Select'}
                    </button>
                `).join('')}
            </div>
        `);
    } catch (error) {
        toast.error('Failed to load plan comparison');
    }
};



// Sales Tools handlers
handlers.showTaxNexus = async function() {
    try {
        const response = await api.get('/sales-tools/tax-nexus');
        const taxData = response || [
            { state: 'California', sales_total: 85000, transaction_count: 340, threshold: 100000, has_nexus: true, registered: true },
            { state: 'Texas', sales_total: 45000, transaction_count: 180, threshold: 100000, has_nexus: false, registered: false },
            { state: 'Florida', sales_total: 78000, transaction_count: 312, threshold: 100000, has_nexus: true, registered: true },
            { state: 'New York', sales_total: 92000, transaction_count: 368, threshold: 100000, has_nexus: true, registered: true }
        ];

        const alerts = await api.get('/sales-tools/tax-nexus/alerts').catch(() => [
            { state: 'Texas', type: 'warning', message: 'Approaching sales threshold (45% of limit)' }
        ]);

        modals.show(`
            <div class="modal-header">
                <h2 class="modal-title">Sales Tax Nexus Tracker</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                ${alerts && alerts.length > 0 ? `
                    <div style="margin-bottom: 20px; padding: 12px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                        <strong style="color: #92400e;">Tax Alert:</strong>
                        <p style="margin: 4px 0 0 0; font-size: 14px; color: #b45309;">
                            ${alerts[0].message}
                        </p>
                    </div>
                ` : ''}

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--gray-200); background: var(--gray-50);">
                                <th style="padding: 12px; text-align: left;">State</th>
                                <th style="padding: 12px; text-align: right;">Sales Total</th>
                                <th style="padding: 12px; text-align: right;">Transactions</th>
                                <th style="padding: 12px; text-align: center;">% of Threshold</th>
                                <th style="padding: 12px; text-align: center;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${taxData.map((row, idx) => {
                                const percent = Math.round((row.sales_total / row.threshold) * 100);
                                let bgColor = '';
                                if (percent >= 95) bgColor = '#fee2e2';
                                else if (percent >= 70) bgColor = '#fef3c7';
                                return `
                                    <tr style="border-bottom: 1px solid var(--gray-100); background: ${bgColor || ''};">
                                        <td style="padding: 12px; font-weight: 500;">${escapeHtml(row.state)}</td>
                                        <td style="padding: 12px; text-align: right;">$${row.sales_total.toLocaleString()}</td>
                                        <td style="padding: 12px; text-align: right;">${row.transaction_count}</td>
                                        <td style="padding: 12px; text-align: center;">
                                            <span style="background: ${percent >= 95 ? '#fecaca' : percent >= 70 ? '#fcd34d' : '#dcfce7'}; padding: 4px 8px; border-radius: 4px; font-weight: 500;">
                                                ${percent}%
                                            </span>
                                        </td>
                                        <td style="padding: 12px; text-align: center;">
                                            ${row.has_nexus ? '<span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">Nexus</span>' : ''}
                                            ${row.registered ? '<span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-left: 4px;">Registered</span>' : ''}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="handlers.recalculateTaxNexus();">Recalculate</button>
                <button class="btn btn-secondary" onclick="modals.close();">Close</button>
            </div>
        `);
    } catch (error) {
        toast.error('Failed to load tax nexus data');
    }
};

handlers.recalculateTaxNexus = async function() {
    try {
        await api.post('/sales-tools/tax-nexus/calculate', {});
        toast.success('Tax nexus data recalculated');
        handlers.showTaxNexus();
    } catch (error) {
        toast.error('Failed to recalculate tax nexus');
    }
};

handlers.showBuyerProfiles = async function() {
    try {
        const response = await api.get('/sales-tools/buyers');
        const buyers = response || [
            { id: 1, name: 'John Collector', platform: 'eBay', purchases: 45, returns: 2, return_rate: 4.4, rating: 4.8, blocked: false },
            { id: 2, name: 'Sarah Reseller', platform: 'Mercari', purchases: 28, returns: 1, return_rate: 3.6, rating: 4.9, blocked: false },
            { id: 3, name: 'Mike Bulk Buyer', platform: 'eBay', purchases: 156, returns: 8, return_rate: 5.1, rating: 4.5, blocked: false }
        ];

        const currentFilter = store.state.buyerFilter || 'all';
        const filteredBuyers = buyers.filter(b => {
            if (currentFilter === 'flagged') return b.return_rate > 5;
            if (currentFilter === 'blocked') return b.blocked;
            return true;
        });

        modals.show(`
            <div class="modal-header">
                <h2 class="modal-title">Buyer Profiles</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                    <button class="btn btn-sm ${currentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}"
                            onclick="store.setState({ buyerFilter: 'all' }); handlers.showBuyerProfiles();">All</button>
                    <button class="btn btn-sm ${currentFilter === 'flagged' ? 'btn-primary' : 'btn-secondary'}"
                            onclick="store.setState({ buyerFilter: 'flagged' }); handlers.showBuyerProfiles();">Flagged</button>
                    <button class="btn btn-sm ${currentFilter === 'blocked' ? 'btn-primary' : 'btn-secondary'}"
                            onclick="store.setState({ buyerFilter: 'blocked' }); handlers.showBuyerProfiles();">Blocked</button>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--gray-200); background: var(--gray-50);">
                                <th style="padding: 12px; text-align: left;">Buyer</th>
                                <th style="padding: 12px; text-align: center;">Platform</th>
                                <th style="padding: 12px; text-align: right;">Purchases</th>
                                <th style="padding: 12px; text-align: right;">Returns</th>
                                <th style="padding: 12px; text-align: center;">Rating</th>
                                <th style="padding: 12px; text-align: center;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredBuyers.map(buyer => `
                                <tr style="border-bottom: 1px solid var(--gray-100); cursor: pointer;" onclick="handlers.viewBuyerDetail(${buyer.id})">
                                    <td style="padding: 12px;">${escapeHtml(buyer.name)}</td>
                                    <td style="padding: 12px; text-align: center;">${escapeHtml(buyer.platform)}</td>
                                    <td style="padding: 12px; text-align: right;">${buyer.purchases}</td>
                                    <td style="padding: 12px; text-align: right; color: ${buyer.return_rate > 5 ? '#dc2626' : '#666'};">
                                        ${buyer.returns} (${buyer.return_rate}%)
                                    </td>
                                    <td style="padding: 12px; text-align: center;">
                                        <span style="color: #f59e0b;">${'★'.repeat(Math.floor(buyer.rating))}${'☆'.repeat(5-Math.floor(buyer.rating))}</span>
                                        <span style="font-size: 12px; color: #666;">${buyer.rating}</span>
                                    </td>
                                    <td style="padding: 12px; text-align: center;">
                                        ${buyer.blocked ? '<span style="background: #fecaca; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">BLOCKED</span>' : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="handlers.syncBuyersFromOrders();">Sync from Orders</button>
                <button class="btn btn-secondary" onclick="modals.close();">Close</button>
            </div>
        `);
    } catch (error) {
        toast.error('Failed to load buyer profiles');
    }
};

handlers.viewBuyerDetail = async function(buyerId) {
    try {
        const response = await api.get(`/sales-tools/buyers/${buyerId}`);
        const buyer = response || {
            id: buyerId,
            name: 'Buyer Name',
            platform: 'eBay',
            purchases: 45,
            returns: 2,
            return_rate: 4.4,
            rating: 4.8,
            blocked: false,
            notes: 'Reliable buyer',
            purchase_history: []
        };

        modals.show(`
            <div class="modal-header">
                <h2 class="modal-title">${escapeHtml(buyer.name)}</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                    <div style="background: var(--gray-50); padding: 12px; border-radius: 4px;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Platform</div>
                        <div style="font-weight: 600;">${escapeHtml(buyer.platform)}</div>
                    </div>
                    <div style="background: var(--gray-50); padding: 12px; border-radius: 4px;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Total Purchases</div>
                        <div style="font-weight: 600; font-size: 18px;">${buyer.purchases}</div>
                    </div>
                    <div style="background: var(--gray-50); padding: 12px; border-radius: 4px;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Rating</div>
                        <div style="color: #f59e0b; font-weight: 600;">${'★'.repeat(Math.floor(buyer.rating))} ${buyer.rating}</div>
                    </div>
                    <div style="background: var(--gray-50); padding: 12px; border-radius: 4px;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Return Rate</div>
                        <div style="font-weight: 600; color: ${buyer.return_rate > 5 ? '#dc2626' : '#10b981'};">${buyer.return_rate}%</div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label class="form-label">Notes</label>
                    <textarea class="form-input" id="buyer-notes-${buyerId}" placeholder="Add notes about this buyer..." style="min-height: 100px;">${escapeHtml(buyer.notes || '')}</textarea>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm ${buyer.blocked ? 'btn-success' : 'btn-danger'}"
                            onclick="handlers.blockBuyer(${buyerId});">
                        ${buyer.blocked ? 'Unblock' : 'Block'} Buyer
                    </button>
                    <button class="btn btn-sm btn-secondary"
                            onclick="handlers.rateBuyer(${buyerId});">
                        Rate Buyer
                    </button>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="modals.close();">Close</button>
            </div>
        `);
    } catch (error) {
        toast.error('Failed to load buyer details');
    }
};

handlers.blockBuyer = async function(buyerId) {
    try {
        await api.post(`/sales-tools/buyers/${buyerId}/block`, {});
        toast.success('Buyer blocked successfully');
        handlers.showBuyerProfiles();
    } catch (error) {
        toast.error('Failed to block buyer');
    }
};

handlers.syncBuyersFromOrders = async function() {
    try {
        await api.post('/sales-tools/buyers/sync', {});
        toast.success('Buyers synced from orders');
        handlers.showBuyerProfiles();
    } catch (error) {
        toast.error('Failed to sync buyers');
    }
};

handlers.rateBuyer = function(buyerId) {
    const ratingHtml = `
        <div style="text-align: center; padding: 20px;">
            <label class="form-label">Rate this buyer (1-5 stars)</label>
            <div style="display: flex; justify-content: center; gap: 12px; margin: 16px 0;">
                ${[1, 2, 3, 4, 5].map(star => `
                    <button style="font-size: 32px; cursor: pointer; border: none; background: none; transition: color 0.2s; padding: 4px 8px;"
                            role="radio" aria-label="${star} star${star > 1 ? 's' : ''}" aria-checked="false" tabindex="0"
                            onmouseover="this.style.color = '#f59e0b'"
                            onmouseout="this.style.color = '#ccc'"
                            onfocus="this.style.color = '#f59e0b'; this.style.outline = '2px solid var(--primary-400)'; this.style.borderRadius = '4px'"
                            onblur="this.style.color = '#ccc'; this.style.outline = 'none'"
                            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"
                            onclick="handlers.submitBuyerRating(${buyerId}, ${star})"
                            class="star-btn" data-star="${star}">★</button>
                `).join('')}
            </div>
        </div>
    `;

    modals.show(`
        <div class="modal-header">
            <h2 class="modal-title">Rate Buyer</h2>
            <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
        </div>
        <div class="modal-body">
            ${ratingHtml}
        </div>
    `);
};

handlers.submitBuyerRating = async function(buyerId, rating) {
    try {
        await api.ensureCSRFToken();
        await api.post(`/orders/buyers/${buyerId}/rating`, { rating });
        toast.success(`Buyer rated ${rating} stars`);
    } catch (err) {
        // Fallback: store locally if API not available
        let ratings; try { ratings = JSON.parse(localStorage.getItem('vl_buyer_ratings') || '{}'); } catch { ratings = {}; }
        ratings[buyerId] = { rating, date: new Date().toISOString() };
        localStorage.setItem('vl_buyer_ratings', JSON.stringify(ratings));
        toast.success(`Buyer rated ${rating} stars (saved locally)`);
    }
    modals.close();
};

// Mobile Quick Photo Capture handlers
handlers.showQuickPhotoCapture = function() {
    const photosStore = store.state._quickPhotos || [];

    modals.show(`
        <div class="modal-header">
            <h2 class="modal-title">Quick Photo Capture</h2>
            <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
        </div>
        <div class="modal-body" style="max-height: 80vh; overflow-y: auto;">
            <div style="display: grid; gap: 16px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <input type="file" id="quick-photo-input" accept="image/*"
                           multiple style="display: none;"
                           onchange="handlers.processQuickPhotos(event)">
                    <button class="btn btn-primary" onclick="document.getElementById('quick-photo-input').click();">
                        ${components.icon('camera', 16)} Choose Photos
                    </button>
                    <button class="btn btn-secondary" onclick="handlers.captureFromCamera();">
                        ${components.icon('camera', 16)} Use Camera
                    </button>
                    ${photosStore.length > 0 ? `
                        <button class="btn btn-success" onclick="handlers.addPhotosToBank();">
                            ${components.icon('upload', 16)} Add ${photosStore.length} to Bank
                        </button>
                    ` : ''}
                </div>

                <div id="quick-photo-preview" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px;">
                    ${photosStore.map((photo, idx) => `
                        <div style="position: relative; border-radius: 8px; overflow: hidden; background: #f0f0f0;">
                            <img src="${photo}" alt="Photo ${idx + 1}" style="width: 100%; height: 120px; object-fit: cover;">
                            <button type="button" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px;"
                                    onclick="handlers.removeQuickPhoto(${idx});">×</button>
                            <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px;">${idx + 1}</div>
                        </div>
                    `).join('')}
                </div>

                ${photosStore.length > 0 ? `
                    <div style="border-top: 1px solid var(--gray-200); padding-top: 16px;">
                        <h4 style="margin-bottom: 12px; font-weight: 600;">Quick Enhancement</h4>
                        <div style="display: grid; gap: 8px;">
                            ${[0, 1, 2].map(idx => {
                                if (idx < photosStore.length) {
                                    return `
                                        <div style="display: flex; gap: 8px; align-items: center;">
                                            <span style="font-size: 12px; color: #666;">Photo ${idx + 1}:</span>
                                            <button class="btn btn-sm btn-secondary" onclick="handlers.enhanceQuickPhoto(${idx});">
                                                ${components.icon('zap', 12)} Auto-Enhance
                                            </button>
                                        </div>
                                    `;
                                }
                                return '';
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="modals.close();">Close</button>
        </div>
    `);
};

handlers.processQuickPhotos = function(event) {
    const files = Array.from(event.target.files);
    const photos = store.state._quickPhotos || [];

    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                photos.push(e.target.result);
                store.setState({ _quickPhotos: photos });
                handlers.showQuickPhotoCapture();
            };
            reader.readAsDataURL(file);
        }
    });
};

handlers.captureFromCamera = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
        handlers.processQuickPhotos(e);
    };
    input.click();
};

handlers.removeQuickPhoto = function(idx) {
    const photos = store.state._quickPhotos || [];
    photos.splice(idx, 1);
    store.setState({ _quickPhotos: photos });
    handlers.showQuickPhotoCapture();
};

handlers.enhanceQuickPhoto = function(idx) {
    const photos = store.state._quickPhotos || [];
    if (idx < photos.length) {
        // Mock enhancement - in production, use canvas API to adjust brightness/contrast
        toast.success(`Photo ${idx + 1} enhanced`);
        handlers.showQuickPhotoCapture();
    }
};

handlers.addPhotosToBank = async function() {
    const photos = store.state._quickPhotos || [];
    if (photos.length === 0) {
        toast.warning('No photos to add');
        return;
    }

    try {
        // Upload each photo to image bank
        for (const photo of photos) {
            const formData = new FormData();
            if (photo.file) {
                formData.append('image', photo.file);
            } else if (photo.dataUrl) {
                const response = await fetch(photo.dataUrl);
                const blob = await response.blob();
                formData.append('image', blob, photo.name || 'photo.jpg');
            }
            const uploadRes = await fetch('/api/image-bank/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${store.state.token}`, 'X-CSRF-Token': api.csrfToken || '' },
                body: formData
            });
            if (!uploadRes.ok) {
                const errData = await uploadRes.json().catch(() => ({}));
                throw new Error(errData.error || `Upload failed (${uploadRes.status})`);
            }
        }
        toast.success(`${photos.length} photos added to Image Bank`);
        store.setState({ _quickPhotos: [] });
        modals.close();
        router.navigate('image-bank');
    } catch (error) {
        console.error('Failed to add photos to bank:', error);
        toast.error('Failed to add photos to Image Bank');
    }
};

// Legal page handlers
handlers.toggleLegalSection = function(header) {
    const section = header.closest('.legal-section');
    if (section) {
        section.classList.toggle('collapsed');
    }
};

handlers.scrollToSection = function(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        // Remove active from all TOC links
        document.querySelectorAll('.toc-link').forEach(link => link.classList.remove('active'));
        // Add active to clicked link
        const tocLink = document.querySelector(`.toc-link[href="#${sectionId}"]`);
        if (tocLink) tocLink.classList.add('active');
        // Expand the section if collapsed
        section.classList.remove('collapsed');
        // Scroll to section with offset
        const offset = 80;
        const elementPosition = section.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
};

handlers.printLegalDocument = function() {
    window.print();
};

handlers.downloadLegalPDF = function(type) {
    // Create a simple text download since we don't have PDF library
    const title = type === 'terms' ? 'Terms of Service' : 'Privacy Policy';
    const content = document.querySelector('.legal-content');
    if (!content) return;

    // Get text content
    let text = `${title}\n${'='.repeat(title.length)}\n\n`;
    text += `VaultLister - ${title}\n`;
    text += `Last updated: ${new Date().toLocaleDateString()}\n\n`;

    content.querySelectorAll('.legal-section').forEach(section => {
        const heading = section.querySelector('h2');
        const body = section.querySelector('.section-body');
        if (heading && body) {
            text += `${heading.textContent}\n${'-'.repeat(40)}\n`;
            text += `${body.textContent.trim()}\n\n`;
        }
    });

    // Download as text file
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaultlister-${type}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`${title} downloaded`);
};

// Reading progress indicator for legal pages
document.addEventListener('scroll', function() {
    const progressBar = document.querySelector('.legal-progress .progress-fill');
    if (!progressBar) return;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (window.scrollY / scrollHeight) * 100;
    progressBar.style.width = `${Math.min(scrollPercent, 100)}%`;
});

// Checklist keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (store.state.currentPage !== 'checklist') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.target.isContentEditable) return;

    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handlers.showAddChecklistItem();
    }
    if (e.key === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handlers.selectAllChecklistItems();
    }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const quickAdd = document.getElementById('todo-quick-add');
        if (quickAdd) quickAdd.focus();
    }
});

// Dropdown keyboard navigation: ArrowDown/Up to move between items, Escape to close (#232)
document.addEventListener('keydown', function(e) {
    const openDropdown = document.querySelector('.dropdown.open');
    if (!openDropdown) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        openDropdown.classList.remove('open');
        openDropdown.setAttribute('aria-expanded', 'false');
        openDropdown.focus();
        return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(openDropdown.querySelectorAll('.dropdown-menu button:not([disabled]), .dropdown-menu a:not([disabled]), .shop-switch-menu button:not([disabled])'))
            .filter(el => el.offsetParent !== null);
        if (items.length === 0) return;
        const current = document.activeElement;
        const idx = items.indexOf(current);
        if (e.key === 'ArrowDown') {
            items[idx + 1 < items.length ? idx + 1 : 0].focus();
        } else {
            items[idx - 1 >= 0 ? idx - 1 : items.length - 1].focus();
        }
    }
});

// === Real User Monitoring (RUM) ===
(function() {
    var rumSessionId = crypto.randomUUID();
    var rumBuffer = [];
    var FLUSH_INTERVAL = 30000;

    function rumRecord(name, value, metadata) {
        rumBuffer.push({
            name: name,
            value: value,
            url: location.href,
            userAgent: navigator.userAgent,
            connectionType: (navigator.connection && navigator.connection.effectiveType) || null,
            metadata: metadata || {}
        });
    }

    // Core Web Vitals via PerformanceObserver
    if (typeof PerformanceObserver !== 'undefined') {
        // Largest Contentful Paint
        try {
            new PerformanceObserver(function(list) {
                var entries = list.getEntries();
                if (entries.length > 0) {
                    rumRecord('LCP', entries[entries.length - 1].startTime);
                }
            }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) {}

        // First Input Delay
        try {
            new PerformanceObserver(function(list) {
                var entries = list.getEntries();
                for (var i = 0; i < entries.length; i++) {
                    rumRecord('FID', entries[i].processingStart - entries[i].startTime);
                }
            }).observe({ type: 'first-input', buffered: true });
        } catch (e) {}

        // Cumulative Layout Shift
        try {
            var clsValue = 0;
            new PerformanceObserver(function(list) {
                var entries = list.getEntries();
                for (var i = 0; i < entries.length; i++) {
                    if (!entries[i].hadRecentInput) clsValue += entries[i].value;
                }
                rumRecord('CLS', clsValue);
            }).observe({ type: 'layout-shift', buffered: true });
        } catch (e) {}
    }

    // Navigation Timing (FCP, TTFB)
    if (performance && performance.getEntriesByType) {
        try {
            var navEntries = performance.getEntriesByType('navigation');
            if (navEntries.length > 0) {
                rumRecord('TTFB', navEntries[0].responseStart - navEntries[0].requestStart);
            }
            var paintEntries = performance.getEntriesByType('paint');
            for (var i = 0; i < paintEntries.length; i++) {
                if (paintEntries[i].name === 'first-contentful-paint') {
                    rumRecord('FCP', paintEntries[i].startTime);
                    break;
                }
            }
        } catch (e) {}
    }

    // JS Error tracking
    // Warn before closing tab if a form with unsaved data is open
    window.addEventListener('beforeunload', function(e) {
        const activeForms = ['add-item-form', 'edit-item-form', 'add-event-form'];
        if (activeForms.some(id => document.getElementById(id))) { e.preventDefault(); }
    });

    window.addEventListener('error', function(e) {
        rumRecord('JS_ERROR', 1, { message: (e.message || '').slice(0, 200), source: (e.filename || '').slice(0, 200), line: e.lineno });
    });
    window.addEventListener('unhandledrejection', function(e) {
        rumRecord('UNHANDLED_REJECTION', 1, { message: String(e.reason || '').slice(0, 200) });
    });

    // Flush metrics to backend
    function rumFlush() {
        if (rumBuffer.length === 0) return;
        var batch = rumBuffer.splice(0, 50);
        var payload = JSON.stringify({ metrics: batch, sessionId: rumSessionId });

        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/monitoring/rum', payload);
        } else {
            fetch('/api/monitoring/rum', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            }).catch(function() {});
        }
    }

    // Flush on interval and on page hide
    setInterval(rumFlush, FLUSH_INTERVAL);
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') rumFlush();
    });
})();

// ============================================
// PWA Install Prompt
// ============================================
(function() {
    var DISMISS_KEY = 'vaultlister_pwa_dismiss_until';
    var DELAY_MS = 30000; // 30 seconds
    var SNOOZE_DAYS = 7;

    var deferredPrompt = null;
    var bannerEl = null;

    function isDismissed() {
        var until = localStorage.getItem(DISMISS_KEY);
        return until && Date.now() < parseInt(until, 10);
    }

    function createBanner() {
        var el = document.createElement('div');
        el.id = 'pwa-install-banner';
        el.setAttribute('role', 'banner');
        el.setAttribute('aria-label', 'Install VaultLister app');
        el.style.cssText = [
            'position:fixed',
            'bottom:1.25rem',
            'left:50%',
            'transform:translateX(-50%) translateY(120%)',
            'z-index:9999',
            'display:flex',
            'align-items:center',
            'gap:0.75rem',
            'background:#1f2937',
            'color:#f9fafb',
            'padding:0.75rem 1rem',
            'border-radius:0.75rem',
            'box-shadow:0 4px 24px rgba(0,0,0,0.35)',
            'font-family:Inter,system-ui,sans-serif',
            'font-size:0.9rem',
            'max-width:calc(100vw - 2rem)',
            'width:max-content',
            'transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            'will-change:transform'
        ].join(';');

        var icon = '<svg width="28" height="28" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="flex-shrink:0"><rect width="64" height="64" rx="14" fill="#6366f1"/><path d="M20 44V20h8l8 16 8-16h8v24h-6V30l-6 14h-8l-6-14v14h-6z" fill="white"/></svg>';
        var text = '<span style="flex:1;line-height:1.3"><strong style="display:block;font-size:0.9375rem">Install VaultLister</strong><span style="color:#9ca3af;font-size:0.8125rem">Add to home screen for quick access</span></span>';

        var btnInstall = document.createElement('button');
        btnInstall.textContent = 'Install';
        btnInstall.style.cssText = 'background:#6366f1;color:#fff;border:none;padding:0.4rem 0.875rem;border-radius:0.5rem;font-size:0.8125rem;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0';
        btnInstall.addEventListener('click', function() {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function() {
                deferredPrompt = null;
                hideBanner();
            });
        });

        var btnDismiss = document.createElement('button');
        btnDismiss.textContent = 'Dismiss';
        btnDismiss.setAttribute('aria-label', 'Dismiss install prompt for 7 days');
        btnDismiss.style.cssText = 'background:transparent;color:#9ca3af;border:none;padding:0.4rem 0.5rem;border-radius:0.5rem;font-size:0.8125rem;cursor:pointer;white-space:nowrap;flex-shrink:0';
        btnDismiss.addEventListener('click', function() {
            localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_DAYS * 86400000));
            hideBanner();
        });

        el.innerHTML =sanitizeHTML( sanitizeHTML(icon + text));  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        el.appendChild(btnInstall);
        el.appendChild(btnDismiss);
        return el;
    }

    function showBanner() {
        if (!deferredPrompt || isDismissed()) return;
        if (!bannerEl) {
            bannerEl = createBanner();
            document.body.appendChild(bannerEl);
        }
        // Trigger reflow then slide up
        void bannerEl.offsetWidth;
        bannerEl.style.transform = 'translateX(-50%) translateY(0)';
    }

    function hideBanner() {
        if (!bannerEl) return;
        bannerEl.style.transform = 'translateX(-50%) translateY(120%)';
        setTimeout(function() {
            if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
            bannerEl = null;
        }, 350);
    }

    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPrompt = e;
        if (!isDismissed()) {
            setTimeout(showBanner, DELAY_MS);
        }
    });

    // Clean up if the user installs via browser UI directly
    window.addEventListener('appinstalled', function() {
        deferredPrompt = null;
        hideBanner();
    });
})();
