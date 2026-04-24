'use strict';
// Store (state management, localStorage persistence)
// Extracted from app.js lines 7718-8137

// Increment this when the shape of persisted state changes in a breaking way.
// On mismatch the stored state is discarded and the user must re-authenticate.
const STATE_SCHEMA_VERSION = 1;

// State Management
// ============================================
const store = {
    state: {
        user: null,
        token: null,
        currentPage: 'dashboard',
        inventory: [],
        listings: [],
        sales: [],
        offers: [],
        orders: [],
        comparisonPeriod: 'week',
        shops: [],
        automations: [],
        deletedItems: [],
        analyticsData: {
            stats: {
                totalRevenue: 0,
                totalProfit: 0,
                totalSales: 0,
                avgSalePrice: 0,
                itemsSold: 0,
                activeListings: 0,
                conversionRate: 0,
                avgDaysToSell: 0
            }
        },
        salesAnalytics: {
            salesData: [],
            byPlatform: []
        },
        notifications: [],
        selectedItems: [],
        searchTerm: '',
        activeFilters: {},
        darkMode: false,
        isLoading: false,
        isOffline: !navigator.onLine,
        sidebarOpen: false,
        sidebarCollapsed: false,  // NEW - for collapsible navigation
        sidebarScrollPos: 0,  // Track sidebar scroll position during navigation
        analyticsPeriod: '30d',  // Default analytics timeline
        sizeChartSwapped: true,  // Default to swapped axis for better readability

        // Image Bank state
        imageBankImages: [],
        imageBankFolders: [],
        selectedFolder: null,
        selectedImages: [],
        imageBankFilters: {},
        imageBankViewMode: 'grid',  // 'grid' or 'list'

        // Community state
        communityTab: 'discussion',  // 'discussion', 'success', 'tips', 'leaderboard'
        communityPosts: [],
        leaderboard: [],

        // Help & Support state
        helpFAQs: [],
        helpArticles: [],
        supportTickets: [],
        selectedTicket: null,
        helpSearchQuery: '',
        helpCategory: null,

        // Financials state
        financialsTab: 'accounts',
        financialStatementsSubTab: 'income',
        listingsTab: 'listings',
        purchases: [],
        accounts: [],
        financialTransactions: [],
        financialStatements: null,
        profitLossReport: null,

        // Analytics enhancement
        analyticsTab: 'graphs',
        analyticsReportsSubTab: 'errors',  // Sub-tab for Reports: 'errors', 'supplier', 'turnover', 'custom'
        salesDateStart: null,
        salesDateEnd: null,
        chartDisplayModes: {}, // Stores chart type preference per chartId (e.g., { 'platformRevenue': 'bar' })

        // Settings enhancement
        originalSettings: null,

        // Shipping Profiles state
        shippingProfiles: [],

        // Listing Templates
        templates: [],

        // Photo Editor (Cloudinary) state
        photoEditorOpen: false,
        photoEditorImageId: null,
        photoEditorImage: null,
        photoEditorTransformations: {
            removeBackground: false,
            enhance: false,
            upscale: false,
            cropWidth: null,
            cropHeight: null,
            cropPreset: null
        },
        photoEditorPreviewUrl: null,
        photoEditorCloudinaryRequired: false,
        photoEditorLoading: false,
        cloudinaryConfigured: null,
        cloudinaryCloudName: null,

        // SKU Rules state
        skuRules: [],
        selectedSkuRule: null,
        skuRulePreview: null,
        skuBatchProgress: null,
        defaultSkuRule: null,

        // Receipt Parser state
        receiptQueue: [],
        receiptVendors: [],
        selectedReceipt: null,
        receiptParsing: false,
        receiptUploadProgress: null,
        emailProviders: [],
        emailAccounts: [],
        emailConnecting: false,

        // Batch Photo Processing state
        batchPhotoJobs: [],
        batchPhotoPresets: [],
        batchPhotoModalOpen: false,
        batchPhotoSelectedImages: [],  // Selected image IDs for batch processing
        batchPhotoTransformations: {
            removeBackground: false,
            enhance: false,
            upscale: false,
            cropWidth: null,
            cropHeight: null,
            cropPreset: null
        },
        batchPhotoProgress: null,  // { jobId, total, processed, failed, status }
        batchPhotoActivePollInterval: null,  // For polling progress

        // Vault Buddy (Chatbot) state
        vaultBuddyOpen: false,
        vaultBuddyTab: 'home',
        vaultBuddyConversations: [],
        vaultBuddyConversationsLoaded: false,
        vaultBuddyCurrentConversation: null,
        vaultBuddyMessages: [],
        vaultBuddyLoading: false,

        // Roadmap state
        roadmapFilter: 'all',
        roadmapFeatures: [],

        // User Feedback state
        userFeedback: [],
        feedbackFormType: 'feature',
        feedbackFormCategory: '',

        // Phase 4 Intelligence state
        heatmapData: { grid: [], peakTimes: [] },
        predictions: [],
        demandForecasts: [],
        suppliers: [],
        supplierItems: [],
        competitors: [],
        competitorListings: [],
        marketInsights: [],
        heatmapDays: 30,
        heatmapPlatform: '',

        // Webhooks state
        webhookEndpoints: [],
        webhookEvents: [],
        webhookEventTypes: [],

        // Push notification state
        pushSubscriptions: [],
        pushSettings: { enabled: true, categories: { sales: true, offers: true, orders: true, sync: false, marketing: false } },
        pushSubscribed: false,

        // Currency state
        currencyRates: null
    },
    subscribers: [],

    setState(updates) {
        // Validate critical fields to catch silent data corruption
        if ('token' in updates && updates.token !== null && typeof updates.token !== 'string') {
            console.warn('[Store] setState: token must be a string or null — got', typeof updates.token);
        }
        if ('user' in updates && updates.user !== null && typeof updates.user !== 'object') {
            console.warn('[Store] setState: user must be an object or null — got', typeof updates.user);
        }
        Object.assign(this.state, updates);
        this.notify();
        this.persist();
    },

    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    },

    notify() {
        this.subscribers.forEach(cb => cb(this.state));
    },

    persist() {
        // When logged out (no user), clear all storage
        if (!this.state.user) {
            localStorage.removeItem('vaultlister_state');
            sessionStorage.removeItem('vaultlister_state');
            return;
        }

        // Tokens are stored in sessionStorage only (tab-scoped, cleared on browser close).
        // They are NEVER written to localStorage — XSS attacks cannot read sessionStorage
        // across tabs or browser restarts. "Remember Me" persistence is handled by the
        // HttpOnly vl_refresh cookie expiry set at login, not by localStorage.
        sessionStorage.setItem('vaultlister_state', JSON.stringify({
            _v: STATE_SCHEMA_VERSION,
            user: this.state.user,
            token: this.state.token,
            refreshToken: this.state.refreshToken,
            useSessionStorage: this.state.useSessionStorage
        }));

        // For "Remember Me" sessions (useSessionStorage=false), persist non-sensitive
        // user identity to localStorage so the UI can show the user's name/avatar on
        // browser restart while silent re-auth completes via the HttpOnly cookie.
        if (!this.state.useSessionStorage) {
            localStorage.setItem('vaultlister_state', JSON.stringify({
                _v: STATE_SCHEMA_VERSION,
                user: this.state.user,
                useSessionStorage: false
            }));
        } else {
            localStorage.removeItem('vaultlister_state');
        }
    },

    getPlanTier() {
        return this.state.user?.subscription_tier || 'free';
    },

    hydrate() {
        try {
            // Try sessionStorage first (current tab session with valid tokens)
            let saved = sessionStorage.getItem('vaultlister_state');
            const fromSession = !!saved;
            if (saved) {
                this.state.useSessionStorage = true;
            } else {
                // Fallback: localStorage (browser restart — user identity only, no tokens)
                saved = localStorage.getItem('vaultlister_state');
            }
            if (saved) {
                let parsed;
                try {
                    parsed = JSON.parse(saved);
                } catch (_) {
                    // Malformed JSON — discard persisted state
                    sessionStorage.removeItem('vaultlister_state');
                    localStorage.removeItem('vaultlister_state');
                    return;
                }

                // Schema version check — stale state from a different schema is discarded.
                if (typeof parsed !== 'object' || parsed === null || parsed._v !== STATE_SCHEMA_VERSION) {
                    sessionStorage.removeItem('vaultlister_state');
                    localStorage.removeItem('vaultlister_state');
                    return;
                }

                // Basic shape validation: user must be null or an object with an id string.
                if (parsed.user !== null && parsed.user !== undefined) {
                    if (typeof parsed.user !== 'object' || typeof parsed.user.id !== 'string') {
                        sessionStorage.removeItem('vaultlister_state');
                        localStorage.removeItem('vaultlister_state');
                        return;
                    }
                }

                // When reading from localStorage (browser restart scenario), tokens are
                // intentionally excluded — they are only trusted from sessionStorage.
                const allowed = fromSession
                    ? ['user', 'token', 'refreshToken', 'useSessionStorage']
                    : ['user', 'useSessionStorage'];
                for (const key of allowed) {
                    if (key in parsed) this.state[key] = parsed[key];
                }
            }
            const savedVotes = localStorage.getItem('vaultlister_changelog_votes');
            if (savedVotes) {
                try {
                    this.state.changelogVotes = JSON.parse(savedVotes);
                } catch (_) {
                    localStorage.removeItem('vaultlister_changelog_votes');
                }
            }
        } catch (e) {
            console.error('Failed to hydrate state:', e);
        }
    }
};
