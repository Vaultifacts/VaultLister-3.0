'use strict';
// Store (state management, localStorage persistence)
// Extracted from app.js lines 7718-8137

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
        offers: [
            { id: 'demo-offer-1', status: 'pending', amount: 45.00, offer_amount: 45.00, listing_price: 60.00, listing_id: 'demo-item-1', listing_title: 'Vintage Levi 501 Jeans', buyer_name: 'sarah_styles', buyer_username: 'sarah_styles', platform: 'poshmark', expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
            { id: 'demo-offer-2', status: 'pending', amount: 120.00, offer_amount: 120.00, listing_price: 175.00, listing_id: 'demo-item-2', listing_title: 'Nike Air Jordan 1 Retro High', buyer_name: 'sneaker_king', buyer_username: 'sneaker_king', platform: 'ebay', expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
            { id: 'demo-offer-3', status: 'countered', amount: 30.00, offer_amount: 30.00, listing_price: 55.00, listing_id: 'demo-item-3', listing_title: 'Coach Signature Crossbody Bag', buyer_name: 'bag_collector', buyer_username: 'bag_collector', platform: 'mercari', expires_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        ],
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
        communityPosts: [
            { id: 'post-1', type: 'discussion', author: 'ResellerPro', avatar: 'R', title: 'Best time to share on Poshmark?', content: 'I\'ve been experimenting with different sharing times. Has anyone found the optimal time to share for maximum visibility?', likes: 24, comments: 12, created_at: '2026-01-27T14:00:00Z' },
            { id: 'post-2', type: 'success', author: 'VintageQueen', avatar: 'V', title: 'Hit $10K in January!', content: 'So excited to share that I just crossed $10K in sales this month! My best month ever. Consistency is key!', likes: 156, comments: 34, created_at: '2026-01-26T10:30:00Z' },
            { id: 'post-3', type: 'tip', author: 'ThriftMaster', avatar: 'T', title: 'Photography tip for beginners', content: 'Use natural light and a clean white background. I use a $20 poster board and it makes a huge difference in my photos!', likes: 89, comments: 15, created_at: '2026-01-25T16:00:00Z' },
            { id: 'post-4', type: 'discussion', author: 'NewSeller2026', avatar: 'N', title: 'Cross-listing strategy question', content: 'Do you list on all platforms at once, or stagger your listings? What works best for you?', likes: 18, comments: 22, created_at: '2026-01-24T11:00:00Z' },
            { id: 'post-5', type: 'success', author: 'SneakerFlip', avatar: 'S', title: 'Sold my first $500+ item!', content: 'Finally sold a pair of rare Jordans for $520! The patience paid off. Never drop your prices too quickly!', likes: 203, comments: 45, created_at: '2026-01-23T09:15:00Z' },
            { id: 'post-6', type: 'tip', author: 'BundleQueen', avatar: 'B', title: 'How I increased my bundle rate', content: 'I started messaging buyers who like 2+ items with a personalized bundle offer. My bundle conversion went up 40%!', likes: 112, comments: 28, created_at: '2026-01-22T14:30:00Z' }
        ],
        leaderboard: [
            { rank: 1, username: 'VintageQueen', avatar: 'V', sales: 156, revenue: 12450, badge: 'gold' },
            { rank: 2, username: 'SneakerFlip', avatar: 'S', sales: 98, revenue: 9870, badge: 'gold' },
            { rank: 3, username: 'ThriftMaster', avatar: 'T', sales: 87, revenue: 6540, badge: 'silver' },
            { rank: 4, username: 'ResellerPro', avatar: 'R', sales: 76, revenue: 5890, badge: 'silver' },
            { rank: 5, username: 'BundleQueen', avatar: 'B', sales: 65, revenue: 4320, badge: 'bronze' },
            { rank: 6, username: 'DesignerDeals', avatar: 'D', sales: 54, revenue: 8900, badge: 'bronze' },
            { rank: 7, username: 'Y2KCollector', avatar: 'Y', sales: 48, revenue: 2890, badge: 'bronze' },
            { rank: 8, username: 'NewSeller2026', avatar: 'N', sales: 12, revenue: 890, badge: null }
        ],

        // Help & Support state
        helpFAQs: [
            { id: 'faq-1', question: 'How do I add items to my inventory?', answer: 'Navigate to the Inventory page and click "Add Item". Fill out the item details including title, description, price, and photos. You can also use the AI Listing Generator to automatically generate descriptions from your photos.', category: 'inventory', helpful_count: 45 },
            { id: 'faq-2', question: 'How does cross-listing work?', answer: 'Cross-listing allows you to list the same item on multiple marketplaces at once. Go to the Cross-List page, select the item you want to list, choose your target platforms, and click "Cross-List". VaultLister will create listings on each selected platform.', category: 'listings', helpful_count: 38 },
            { id: 'faq-3', question: 'Can I use VaultLister offline?', answer: 'Yes! VaultLister is a Progressive Web App (PWA) that works offline. Your data is stored locally on your device. Any changes made offline will sync when you reconnect to the internet.', category: 'general', helpful_count: 52 },
            { id: 'faq-4', question: 'How do I connect my marketplace accounts?', answer: 'Go to My Shops page and click "Connect" next to the marketplace you want to add. Follow the OAuth flow to authorize VaultLister to access your account. Your credentials are encrypted and stored securely.', category: 'platforms', helpful_count: 31 },
            { id: 'faq-5', question: 'What is the AI Listing Generator?', answer: 'The AI Listing Generator uses Claude AI to analyze your product photos and automatically generate titles, descriptions, and suggested prices. Simply upload photos and click "Generate" to get AI-powered listing content.', category: 'ai', helpful_count: 67 },
            { id: 'faq-6', question: 'How do automations work?', answer: 'Automations run scheduled tasks on your connected marketplace accounts. You can enable pre-built automations like "Daily Closet Share" for Poshmark or create custom rules. Configure scheduling in the Automations page.', category: 'automation', helpful_count: 29 },
            { id: 'faq-7', question: 'Is my data secure?', answer: 'Yes, your data is stored locally on your device by default and never leaves without your consent. Passwords are encrypted with bcrypt, API tokens use AES-256 encryption, and all connections use HTTPS.', category: 'security', helpful_count: 41 },
            { id: 'faq-8', question: 'How do I track my sales and profits?', answer: 'Use the Analytics page to view your sales performance, revenue trends, and profit margins. The Financials page provides detailed purchase tracking, COGS calculation, and P&L reports.', category: 'analytics', helpful_count: 36 }
        ],
        helpArticles: [
            { id: 'art-1', slug: 'getting-started', title: 'Getting Started with VaultLister', excerpt: 'A complete guide to setting up your account and making your first listing.', category: 'Getting Started', view_count: 1234, helpful_count: 89, tags: ['beginner', 'setup', 'tutorial'] },
            { id: 'art-2', slug: 'inventory-management', title: 'Mastering Inventory Management', excerpt: 'Learn how to efficiently organize, track, and manage your inventory.', category: 'Inventory', view_count: 892, helpful_count: 67, tags: ['inventory', 'organization', 'bulk-edit'] },
            { id: 'art-3', slug: 'cross-listing-guide', title: 'Cross-Listing Best Practices', excerpt: 'Tips and strategies for successfully cross-listing across multiple platforms.', category: 'Listings', view_count: 1567, helpful_count: 112, tags: ['cross-listing', 'platforms', 'strategy'] },
            { id: 'art-4', slug: 'ai-features', title: 'Using AI Features Effectively', excerpt: 'Maximize the power of AI for listing generation, pricing, and photo editing.', category: 'AI & Automation', view_count: 743, helpful_count: 54, tags: ['ai', 'listing-generator', 'automation'] },
            { id: 'art-5', slug: 'poshmark-automation', title: 'Poshmark Automation Guide', excerpt: 'Set up and optimize automations for sharing, following, and sending offers.', category: 'Automation', view_count: 2103, helpful_count: 156, tags: ['poshmark', 'automation', 'sharing'] },
            { id: 'art-6', slug: 'analytics-reporting', title: 'Understanding Your Analytics', excerpt: 'How to read and interpret your sales data, trends, and performance metrics.', category: 'Analytics', view_count: 621, helpful_count: 43, tags: ['analytics', 'reports', 'metrics'] },
            { id: 'art-7', slug: 'photo-editing', title: 'Photo Editing with Cloudinary', excerpt: 'Use AI-powered tools to remove backgrounds, enhance images, and optimize for platforms.', category: 'Images', view_count: 534, helpful_count: 38, tags: ['photos', 'cloudinary', 'editing'] },
            { id: 'art-8', slug: 'shipping-profiles', title: 'Setting Up Shipping Profiles', excerpt: 'Create reusable shipping configurations for different carriers and platforms.', category: 'Shipping', view_count: 412, helpful_count: 29, tags: ['shipping', 'profiles', 'carriers'] }
        ],
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
        templates: [
            { id: 'tpl-1', name: 'Vintage Clothing', category: 'Clothing', description: 'Template for vintage apparel listings', title_pattern: 'Vintage {brand} {item} - {size} - {era}', pricing_strategy: 'Markup', markup_percentage: 200, tags: ['vintage', 'retro', 'clothing', 'thrift'], is_favorite: true, use_count: 34, created_at: '2025-11-15T10:00:00Z' },
            { id: 'tpl-2', name: 'Sneaker Resale', category: 'Sneakers', description: 'Optimized for sneaker flips with key details', title_pattern: '{brand} {model} - Size {size} - {colorway}', pricing_strategy: 'Market Comp', markup_percentage: 80, tags: ['sneakers', 'kicks', 'shoes', 'athletic', 'nike', 'jordan'], is_favorite: true, use_count: 52, created_at: '2025-11-20T14:30:00Z' },
            { id: 'tpl-3', name: 'Designer Handbags', category: 'Designer', description: 'Luxury bag listings with authentication details', title_pattern: 'Authentic {brand} {model} - {color} - {condition}', pricing_strategy: 'Comp Analysis', markup_percentage: 150, tags: ['designer', 'luxury', 'handbag', 'authentic', 'purse'], is_favorite: false, use_count: 18, created_at: '2025-12-01T09:00:00Z' },
            { id: 'tpl-4', name: 'Electronics & Gadgets', category: 'Electronics', description: 'Consumer electronics with specs and condition', title_pattern: '{brand} {model} {storage} - {condition} - {accessories}', pricing_strategy: 'Markup', markup_percentage: 60, tags: ['electronics', 'tech', 'gadgets', 'phones', 'tablets'], is_favorite: false, use_count: 11, created_at: '2025-12-10T16:00:00Z' },
            { id: 'tpl-5', name: 'Home & Decor', category: 'Home', description: 'Furniture and home goods with dimensions', title_pattern: '{brand} {item} - {material} - {dimensions}', pricing_strategy: 'Markup', markup_percentage: 120, tags: ['home', 'decor', 'furniture', 'vintage-home', 'farmhouse'], is_favorite: false, use_count: 7, created_at: '2025-12-20T11:30:00Z' },
            { id: 'tpl-6', name: 'Streetwear Bundle', category: 'Clothing', description: 'Hype streetwear items with brand focus', title_pattern: '{brand} {item} - {size} - {season} {year}', pricing_strategy: 'Market Comp', markup_percentage: 100, tags: ['streetwear', 'hype', 'supreme', 'bape', 'palace'], is_favorite: true, use_count: 28, created_at: '2026-01-05T13:00:00Z' }
        ],

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
        roadmapFeatures: [
            { id: 'rf-1', title: 'Mobile App (iOS & Android)', description: 'Native mobile apps for managing inventory on the go with camera integration for quick photo uploads.', status: 'planned', category: 'Mobile', votes: 156, eta: 'Q3 2026', comments: 24, user_voted: false },
            { id: 'rf-2', title: 'Multi-user Team Support', description: 'Invite team members, assign roles, and collaborate on inventory management.', status: 'planned', category: 'Collaboration', votes: 89, eta: 'Q4 2026', comments: 12, user_voted: false },
            { id: 'rf-3', title: 'Etsy Integration', description: 'Cross-list to Etsy marketplace with full sync support.', status: 'in_progress', category: 'Platforms', votes: 234, eta: 'Q2 2026', comments: 45, user_voted: false },
            { id: 'rf-4', title: 'Whatnot Live Selling', description: 'Integration with Whatnot for live selling events and inventory sync.', status: 'planned', category: 'Platforms', votes: 178, eta: 'Q3 2026', comments: 31, user_voted: false },
            { id: 'rf-5', title: 'Bulk Label Printing', description: 'Generate and print shipping labels in bulk for multiple orders.', status: 'in_progress', category: 'Shipping', votes: 145, eta: 'Q1 2026', comments: 19, user_voted: false },
            { id: 'rf-6', title: 'Advanced Analytics Dashboard', description: 'More detailed analytics with customizable widgets, export options, and trend predictions.', status: 'completed', category: 'Analytics', votes: 267, eta: 'Completed', comments: 52, user_voted: true },
            { id: 'rf-7', title: 'AI-Powered Pricing Suggestions', description: 'Get AI recommendations for optimal pricing based on market data and sold comparables.', status: 'in_progress', category: 'AI Features', votes: 198, eta: 'Q1 2026', comments: 28, user_voted: false },
            { id: 'rf-8', title: 'Automated Relisting', description: 'Automatically relist stale items on a schedule with price adjustments.', status: 'completed', category: 'Automation', votes: 312, eta: 'Completed', comments: 67, user_voted: true },
            { id: 'rf-9', title: 'Inventory Import from Spreadsheets', description: 'Bulk import inventory from CSV/Excel files with field mapping.', status: 'completed', category: 'Import/Export', votes: 189, eta: 'Completed', comments: 23, user_voted: false },
            { id: 'rf-10', title: 'Real-time Webhook Notifications', description: 'Instant notifications when items sell or receive offers via webhooks.', status: 'planned', category: 'Integrations', votes: 112, eta: 'Q2 2026', comments: 15, user_voted: false },
            { id: 'rf-11', title: 'Custom Reporting Builder', description: 'Build custom reports with drag-and-drop widgets and scheduled email delivery.', status: 'planned', category: 'Analytics', votes: 76, eta: 'Q4 2026', comments: 8, user_voted: false },
            { id: 'rf-12', title: 'Supplier Management', description: 'Track suppliers, manage purchase orders, and monitor sourcing costs.', status: 'planned', category: 'Inventory', votes: 134, eta: 'Q3 2026', comments: 21, user_voted: false }
        ],

        // User Feedback state
        userFeedback: [
            { id: 'uf-1', type: 'feature', title: 'Add Whatnot integration', category: 'integration', description: 'Would love to be able to cross-list directly to Whatnot for live selling events.', status: 'planned', admin_response: 'Great suggestion! Whatnot integration is on our roadmap for Q2 2026.', created_at: '2026-01-15T10:30:00Z' },
            { id: 'uf-2', type: 'improvement', title: 'Faster bulk editing', category: 'ui', description: 'The bulk edit feature is great but could be faster. Would love to see lazy loading for large inventories.', status: 'reviewing', admin_response: null, created_at: '2026-01-20T14:45:00Z' },
            { id: 'uf-3', type: 'bug', title: 'Image upload sometimes fails', category: 'inventory', description: 'When uploading multiple images at once, sometimes one or two fail to upload. Have to retry manually.', status: 'completed', admin_response: 'Fixed in v1.5.2! We improved the upload queue to handle concurrent uploads more reliably.', created_at: '2026-01-10T09:15:00Z' },
            { id: 'uf-4', type: 'general', title: 'Love the dark mode!', category: 'ui', description: 'Just wanted to say the dark mode looks amazing. Very easy on the eyes for late night listing sessions.', status: 'completed', admin_response: 'Thank you so much! We worked hard on the dark mode design. Glad you enjoy it!', created_at: '2026-01-05T22:00:00Z' },
            { id: 'uf-5', type: 'feature', title: 'Barcode/UPC scanner for quick listing', category: 'inventory', description: 'Would be amazing if we could scan barcodes with our phone camera to auto-fill product details from a database. Would save so much time when listing items!', status: 'pending', admin_response: null, created_at: '2026-01-22T11:20:00Z' },
            { id: 'uf-6', type: 'improvement', title: 'eBay promoted listings management', category: 'integration', description: 'It would be great to manage eBay promoted listing rates directly from VaultLister instead of going to eBay Seller Hub.', status: 'planned', admin_response: 'This is coming in our next major update! Thanks for the suggestion.', created_at: '2026-01-12T13:30:00Z' },
            { id: 'uf-7', type: 'bug', title: 'Analytics graphs not updating with timeline filter', category: 'analytics', description: 'When I change the timeline filter on the analytics page from "Last 30 Days" to "Last 7 Days", the graphs do not update and the dropdown still shows the old value.', status: 'reviewing', admin_response: 'We are investigating this issue. Thanks for the detailed report!', created_at: '2026-01-25T16:00:00Z' },
            { id: 'uf-8', type: 'feature', title: 'Auto-share to multiple platforms', category: 'automation', description: 'Would love a feature to share all my active listings across Poshmark, Mercari, and eBay with one click. Currently have to do each platform manually.', status: 'planned', admin_response: 'Multi-platform auto-share is on our roadmap for Q2 2026!', created_at: '2026-01-18T14:30:00Z' },
            { id: 'uf-9', type: 'improvement', title: 'Add profit margin percentage to analytics', category: 'analytics', description: 'The analytics page shows total profit, but it would be helpful to see profit margin as a percentage alongside the dollar amount.', status: 'completed', admin_response: 'Added in version 1.4.0! Check your analytics dashboard.', created_at: '2026-01-08T09:15:00Z' },
            { id: 'uf-10', type: 'general', title: 'Excellent customer support experience', category: 'other', description: 'Had an issue with my account and reached out to support. Got a response within an hour and the problem was fixed immediately. Great team!', status: 'completed', admin_response: 'We really appreciate you taking the time to share this! Our support team works hard to provide fast resolutions.', created_at: '2026-01-03T18:45:00Z' }
        ],
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
        pushSubscribed: false
    },
    subscribers: [],

    setState(updates) {
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
                user: this.state.user,
                useSessionStorage: false
            }));
        } else {
            localStorage.removeItem('vaultlister_state');
        }
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
                const parsed = JSON.parse(saved);
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
            if (savedVotes) this.state.changelogVotes = JSON.parse(savedVotes);
        } catch (e) {
            console.error('Failed to hydrate state:', e);
        }
    }
};
