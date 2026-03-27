# Product Requirements Document (PRD) for VaultLister

---

## Current State (Existing Features/Codebase)

**Tech Stack:**
- **Runtime**: Bun.js v1.3.6+ (ultra-fast JS runtime with built-in PostgreSQL)
- **Database**: PostgreSQL with WAL mode, TSVECTOR full-text search
- **Auth**: JWT + bcryptjs (10 rounds), refresh tokens
- **Frontend**: Vanilla JS SPA, PWA with service worker, IndexedDB, styled confirm modals
- **Automation**: Playwright for browser automation
- **AI**: @anthropic-ai/sdk for Claude Vision API integration
- **Testing**: Bun:test (API/security) + @playwright/test (E2E)

**Existing Features (218+ implementations across 24 sessions):**
- **User Auth** - JWT + refresh tokens, auto-login demo
- **Account Page** - Profile, subscription, security (change password), connected platforms, danger zone
- **Inventory CRUD** - TSVECTOR search, bulk operations, quantity tracking, FIFO costing
- **Multi-select & Bulk Edit** - Context menu, bulk status/price updates
- **Cross-listing** - 6 platforms (Poshmark, eBay, Mercari, Depop, Grailed, Facebook), Advanced Cross-List modal
- **Listing Templates** - Reusable listing configurations with CRUD
- **AI Listing Generator** - Claude Vision for automated listing creation
- **Financials Page** - 5 tabs (Purchases, Sales Transactions, Chart of Accounts, Financial Statements, P&L), FIFO costing
- **Analytics** - Dashboard with line/bar/pie charts, revenue tracking, COGS, gross margin, inventory turnover, CSV export
- **OAuth 2.0** - Platform connections with mock provider, token refresh scheduler
- **Chrome Extension** - Browser extension support
- **Image Bank** - Centralized image storage with folders, grid/list view, batch photo processing
- **Help & Chatbot** - AI-powered "Vault Buddy" with floating UI, Home/My Chats tabs
- **Community Features** - User engagement features
- **Calendar** - Event tracking
- **Checklists** - Daily task tracking with To-Do Lists
- **Orders** - Order tracking with status, shipping, bulk label generation
- **Notifications** - Full page with search, filters, mark read/unread/important
- **Delist/Relist** - Stale listing management with timestamps, Facebook "Mark as Sold"
- **Dark Mode** - Persistent theme with instant load
- **PWA/Offline** - Service worker, IndexedDB sync queue
- **Security** - CSRF, rate limiting, XSS protection, security headers
- **Shipping Profiles** - Reusable shipping configurations with platform-specific settings
- **Cloudinary Photo Editor** - AI-powered image editing (background removal, enhance, upscale, smart crop)
- **SKU Rules Builder** - Custom patterns, auto-generation, batch updates
- **Receipt Parser** - AI-powered receipt parsing with Gmail integration
- **Automations** - Poshmark offers/bundles/unfollow, scheduling (cron), repricing, bulk offers
- **Informational Pages** - Terms of Service, Privacy Policy, About Us, Roadmap, Feedback, Support Articles

**Database Schema (44 migrations):**
- `users`, `sessions`, `inventory`, `listings`, `shops`, `sales`
- `automation_rules`, `listing_templates`, `accounts`, `purchases`, `purchase_items`
- `transactions`, `inventory_cost_layers`, `chatbot_conversations`, `chatbot_messages`
- `image_bank`, `calendar_events`, `checklists`, `checklist_items`
- `listing_refresh_history`, `shipping_profiles`, `sku_rules`
- `batch_photo_jobs`, `batch_photo_items`, `batch_photo_presets`
- `task_queue`, `notifications`, `email_accounts`, `email_oauth_states`
- `webhook_endpoints`, `webhook_events`, `push_subscriptions`, `listing_engagement`
- `price_predictions`, `demand_forecasts`, `suppliers`, `supplier_items`, `supplier_price_history`
- `competitors`, `competitor_listings`, `market_insights`
- `whatnot_live_events`, `whatnot_event_items`, `custom_reports`
- `shipping_labels` (enhanced with printed_at, format), `import_jobs`, `import_mappings`

**Backend Routes (35 routers):**
- auth, inventory, listings, sales, shops, offers, automations
- analytics, ai, tasks, templates, oauth, mock-oauth, chatbot
- community, extension, help, roadmap, feedback, calendar, imageBank, checklists, financials
- shippingProfiles, skuRules, receiptParser, batchPhoto, notifications, emailOAuth, orders
- webhooks, pushSubscriptions, predictions, suppliers, marketIntel
- whatnot, reports (Phase 6)

---

## Target Users

- **Resellers** - Individuals selling clothing, accessories, and collectibles on multiple marketplaces
- **Small Business Owners** - People running reselling businesses from home
- **Busy Professionals** - Tracking inventory, sales, and profits across platforms
- **Side Hustlers** - Managing part-time reselling alongside other work

---

## Mission Statement

**VaultLister is a zero-cost, offline-capable multi-channel reselling platform** for managing inventory, cross-listing items to marketplaces, automating repetitive tasks, and tracking analytics—with all data staying local for privacy.

---

## Recently Completed (Session 24)

### Bug Fixes & Polish (9 fixes)
- **Cross-list crash fix** - `pages.crossList()` → `pages.crosslist()` case mismatch causing crash after cross-listing
- **Invalid status fix** - New items used `'published'` status not in DB CHECK constraint; changed to `'active'`
- **Edit modal status fix** - Removed invalid `'inactive'` option, replaced with `'archived'` (matches DB schema)
- **Low stock badge off-by-one** - Items at threshold now correctly show "Stock Low" instead of "In Stock"
- **Financial statements auto-load** - Period dropdown now auto-triggers data load instead of requiring manual "Generate" click
- **Chatbot timestamp fix** - Normalized dates to midnight before day diff to fix "Today"/"Yesterday" near midnight
- **Image Bank folder deletion** - Added trash icon on folders with confirm dialog, calls existing backend DELETE endpoint
- **Cross-list template platforms** - `saveListingAsTemplate()` now captures selected platform checkboxes
- **Reports tab dynamic data** - Replaced hardcoded mock data with computed values from sales/inventory, respects analytics period filter
- **Dark mode CSS fixes** - Calendar, Receipt Parser, Size Charts, buttons, badges, chatbot styling
- **Orders page** - Status capitalization + delivered tracking
- **Archived Listings** - New tab + unarchiveListing handler
- **Photo editor** - Fixed `render()` → `renderApp()` reference
- **Transactions page** - Added Status and Buyer filters
- **Size Charts** - Added Swap Axis button

---

## Previously Completed (Session 23)

### Phase 6: Advanced Features
- **Whatnot Live Selling** - Full live event management with CRUD, item assignment, event stats, frontend UI with upcoming/past tabs
- **Custom Reports Builder** - Configurable report widgets (15 types), drag-and-drop builder, date range selection, report CRUD
- **Report Widget Types** - revenue_chart, profit_chart, sales_by_platform, top_sellers, inventory_value, inventory_age, sell_through_rate, avg_days_to_sell, platform_comparison, category_breakdown, monthly_summary, cost_analysis, roi_tracker, shipping_costs, listing_performance
- **Shipping Labels Print Enhancement** - POST /print-batch, GET /download-batch, GET /stats endpoints, batch PDF generation with printable layout
- **Inventory Import Enhancement** - GET /templates/download (CSV/TSV/JSON), POST /validate-row with field mapping, GET /field-options with suggestions
- **Accessibility Improvements** - ARIA labels on icon buttons, focus-visible styles, prefers-reduced-motion, removed duplicate sr-only class
- **PWA Mobile Enhancement** - display_override in manifest, message handler in SW (SKIP_WAITING, CACHE_URLS, CLEAR_CACHE, GET_CACHE_SIZE, PREFETCH), offline fallback page
- **Offline Action Queuing** - Enhanced offlineQueue with SW communication, prefetchForOffline(), getCacheSize(), clearCache(), getPendingCount()
- **Remaining confirm() Calls** - Replaced final 2 native confirm() calls with styled modals
- **Database**: Migrations 042-044 (Whatnot Live Events, Custom Reports, Shipping Labels Print)
- **Backend**: 2 new routes (whatnot, reports), enhanced shippingLabels and inventoryImport routes
- **Frontend**: 2 new pages (Whatnot Live, Reports), 4 new modals, print button on shipping labels
- **Tests**: 4 new test files (whatnot.test.js, reports.test.js, shippingLabelsEnhanced.test.js, inventoryImportEnhanced.test.js)

---

## Previously Completed (Session 22)

### Phase 5: Production Polish (Complete)
- **Console.log Cleanup** - Removed 11 console.log statements from frontend (including security fix for OAuth data logging)
- **Styled Confirm Modals** - Created `modals.confirm()` helper returning Promises; replaced 10 critical native `confirm()` calls with styled modals (delete item, bulk delete, archive, permanent delete, delete account, etc.)
- **Keyboard Shortcuts Modal** - Updated to show all implemented shortcuts: Ctrl+D/E/I (navigation), Ctrl+S (save), Escape (close), Alt+1-5 (quick nav)
- **Dark Mode Contrast Fix** - Active nav item now uses distinct blue (#3b82f6) instead of same grey as hover state
- **DELETE Sales Route** - Added `DELETE /api/sales/:id` with inventory/listing status restoration
- **Backend Route Audit** - Verified PUT orders, PUT suppliers already existed; no gaps remaining

---

## Previously Completed (Session 21)

### Phase 4 Features (Complete)
- **Outlook Integration** - Email receipt parsing extended to Outlook/Microsoft accounts with OAuth flow, email polling worker branching
- **Additional Platform OAuth** - Complete OAuth configs for Mercari, Depop, Grailed, Facebook with auth/token URLs, client credentials, scopes
- **Real-time Webhooks** - Webhook endpoint CRUD, incoming webhook handler, event processing, HMAC signing, test/retry, frontend management UI
- **Push Notifications** - Web Push API subscriptions, VAPID key handling, notification preferences, test notifications, device management UI
- **Heatmaps** - 24x7 engagement grid from listing_engagement table, per-listing breakdown, geographic data, frontend heatmap visualization
- **Predictive Analytics** - Price predictions with confidence scoring, demand forecasts by category, pricing engine service, recommendation badges
- **Supplier Price Monitoring** - Supplier CRUD, monitored items with price alerts, price history tracking, priceCheckWorker (30min intervals), sparkline charts
- **Market Intelligence** - Competitor tracking across platforms, competitor listings, market insights, opportunity finder, trending categories
- **Database**: Migrations 028-034 (Outlook, Webhooks, Push, Engagement, Predictions, Suppliers, Competitors)
- **Backend**: 5 new routes (webhooks, pushSubscriptions, predictions, suppliers, marketIntel), 3 new services (pricingEngine, marketDataService, webhookProcessor), 1 new worker (priceCheckWorker)
- **Frontend**: 6 new pages (Heatmaps, Predictions, Suppliers, Market Intel, Webhooks, Push Notifications), 2 new nav sections (Intelligence, Integrations), CSS for all components with dark mode
- **PWA**: Manifest shortcuts, share_target, enhanced push handler with type-specific actions/badges/tags
- **Seed Data**: Outlook account, webhook endpoints/events, push subscriptions, engagement data, price predictions, demand forecasts, suppliers with items/price history, competitors with listings/insights

---

## Previously Completed (Session 20)

### Phase 3 Audit & Completion
- **Account Page** - Full account management (profile, subscription, security, connected platforms, danger zone)
- **Phase 3 Audit** - Comprehensive verification of all Phase 3 checklist items against actual codebase

---

## Previously Completed (Session 19)

### Full OAuth Integration
- **Database**: Migration `025_oauth_enhancements.sql` - task_queue table, notifications table
- **Backend Services**:
  - `tokenRefreshScheduler.js` - Automatic token refresh every 5 minutes for tokens expiring within 15 minutes
  - `notificationService.js` - User notification system with OAuth-specific notification types
  - `platformSync/index.js` - Platform sync routing to provider-specific handlers
  - `platformSync/ebaySync.js` - eBay listings/orders sync proof-of-concept
  - `workers/taskWorker.js` - Background job processing with exponential backoff retry
- **Features**:
  - Token encryption with AES-256-CBC
  - Graceful degradation for missing database columns
  - Real-time sync status tracking
  - Notification system for sync success/failure

### Gmail Integration for Receipt Parsing
- **Database**: Migration `027_add_email_accounts.sql` - email_accounts, email_oauth_states tables
- **Backend Services**:
  - `gmailService.js` - Gmail API client (fetch emails, parse MIME, refresh tokens)
  - `receiptDetector.js` - 30+ default sender patterns for receipt detection
  - `emailPollingWorker.js` - Polls Gmail every 5 minutes for receipt emails
- **Routes**: `emailOAuth.js` - Gmail OAuth flow with popup-based authentication
- **Features**:
  - OAuth 2.0 popup flow with state token CSRF protection
  - Automatic receipt detection via sender/subject patterns
  - Email attachment handling (images, PDFs)
  - Queue receipts for AI parsing
  - Configurable sender filters
  - Manual sync trigger
  - Account enable/disable

### Batch Photo Processing (Frontend UI)
- **Frontend**: Full UI implementation for existing backend
- **Features**:
  - Image multi-select with checkboxes on Image Bank
  - "Select All" / "Clear Selection" controls
  - Batch Edit modal with transformation options:
    - Remove Background
    - Auto Enhance
    - AI Upscale
    - Smart Crop (Square, Portrait, Landscape, eBay, Poshmark, Mercari, Custom)
  - Preset management (save, load, delete presets)
  - Job progress tracking with real-time polling
  - Job history section with status badges
  - Full dark mode support

---

## Previously Completed (Session 18)

### Receipt Parser (AI-Powered)
- **Database**: Migration `023_add_receipt_parsing.sql` - extends `email_parse_queue` table, adds `receipt_vendors` table
- **Backend**: `receiptParser.js` with 12 endpoints (upload, queue, get, update, process, ignore, delete, reparse, vendors CRUD)
- **AI Integration**: Claude Vision API for intelligent receipt parsing and data extraction
- **Frontend**: Dedicated page with dropzone upload, receipt queue cards, review/edit modal
- **Features**:
  - Upload receipts via drag-drop or file picker (JPG, PNG, WebP, PDF)
  - AI extracts vendor, date, items, totals, payment method
  - Supports purchase, sale, shipping, and expense receipts
  - Confidence scoring (high/medium/low)
  - Manual correction of parsed data
  - Line item editing with inventory linking
  - Process receipts to create purchases/transactions
  - Re-parse functionality for improved accuracy
  - Vendor presets for smart matching
  - Full dark mode support

---

## Previously Completed (Session 17)

### SKU Rules Builder
- **Database**: Migration `022_add_sku_rules.sql` with full schema
- **Backend**: CRUD API with 10 endpoints (list, get, create, update, delete, set-default, preview, generate, batch-update, get-default)
- **Frontend**: Dedicated page with rule cards, variable reference panel, add/edit/batch modals
- **Features**:
  - Pattern variables: `{brand}`, `{category}`, `{color}`, `{size}`, `{year}`, `{month}`, `{day}`, `{counter}`, `{random}`
  - Auto-increment counter with configurable padding
  - Prefix/suffix support
  - Default rule designation
  - Live pattern preview with sample data
  - SKU field in inventory add/edit modals with auto-generate button
  - Auto-generation on item creation using default rule
  - Batch SKU update for existing inventory
  - Full dark mode support

---

## Previously Completed (Session 16)

### Cloudinary Photo Editor Integration
- **Backend**:
  - `GET /api/image-bank/cloudinary-status` - Check Cloudinary configuration
  - `POST /api/image-bank/cloudinary-edit` - Apply AI transformations (upload, remove-background, enhance, smart-crop, upscale, apply-all)
  - Integration with existing `cloudinaryService.js`
  - Edit history logging with `cloudinary_public_id` tracking
- **Frontend**:
  - Photo Editor modal with side-by-side original/preview comparison
  - AI transformation checkboxes (Remove Background, Auto Enhance, AI Upscale)
  - Smart Crop with platform presets (Square, Portrait, Landscape, eBay, Poshmark, Mercari)
  - Custom dimension inputs for cropping
  - Live preview URL building from Cloudinary transformations
- **UI Features**:
  - Sparkle AI Edit button on Image Bank cards
  - Graceful degradation when Cloudinary not configured (setup instructions)
  - Loading states during transformation
  - Full dark mode support
  - Mobile responsive layout

---

## Previously Completed (Session 15)

### Shipping Profiles Feature
- **Database**: Migration `021_add_shipping_profiles.sql` with full schema
- **Backend**: CRUD API with 6 endpoints (list, get, create, update, set-default, delete)
- **Frontend**: Dedicated page with card grid, add/edit modals, platform checkboxes
- **Features**:
  - Carrier selection (USPS, UPS, FedEx, DHL, Other) with service types
  - Package type and dimensions
  - Domestic/international shipping costs
  - Free shipping threshold
  - Platform-specific profiles
  - Default profile management

---

## Previously Completed (Session 14)

### 1. Command System (20 Commands)
- Created reusable command workflows in `claude-docs/docs/commands/`
- Commands for: commit, pr, feature, migration, route, page, handler, modal, style, test, debug, fix, api, explore, refactor, review, deploy, seed, evolve, rate-limit-options
- `COMMAND_CHEATSHEET.md` for quick reference
- `/feature` command references PRD "Next Steps" section

### 2. Evolution System
- `/evolve` command to turn bugs into permanent improvements
- `evolution-rules.md` - Quick-reference rules (check before coding)
- `evolution-log.md` - Chronological record of all improvements
- Integrated into CLAUDE.md critical rules

### 3. Project Cleanup
- Removed redundant files: `docs/`, `PLAN.md`, `tools/`, `package-lock.json`
- Removed generated folders: `test-results/`, `playwright-report/`
- Consolidated scripts folder
- Clean project structure (~1.5MB recovered)

### 4. Rate Limiting Documentation
- `/rate-limit-options` command for configuring rate limits
- Documents 4 tiers: default, auth, mutation, expensive
- Troubleshooting guide for 429 errors

---

## Previously Completed (Session 13)

### Help Chat Bot "Vault Buddy"
- Floating circular button in bottom right corner (persistent across all pages)
- Chat interface with "Home" and "My Chats" tabs
- Persistent chat history with timestamps

### Delist/Relist Feature (Stale Listings Management)
- Auto-detect stale listings (configurable threshold, default 30 days)
- Refresh history tracking for audit trail
- **Facebook Marketplace exception**: Mark as Sold instead of delisting

---

## In Scope (Phase 2 - Completed)

### ✅ Full OAuth Integration (Session 19)
- Token refresh scheduler with automatic renewal
- Real-time sync with platform data (eBay proof-of-concept)
- Background task worker with retry logic
- Notification system for sync events

### ✅ Email Receipt Parsing - Gmail Integration (Session 19)
- ~~Manual upload and AI parsing~~ **(COMPLETED - Session 18)**
- ~~Gmail integration for automatic receipt fetching~~ **(COMPLETED - Session 19)**
- Background worker for email polling every 5 minutes

### ✅ Batch Photo Processing (Session 19)
- Apply Cloudinary transformations to multiple images
- Queue-based processing with progress tracking
- Preset configurations for bulk edits
- Full frontend UI with job history

---

## ✅ Bug Fixes & Enhancements (Phase 3 - Completed)

### CRITICAL - Authentication/Authorization Issues
- [x] Auth flow implemented with JWT + refresh tokens, auto-login demo mode

### Navigation Menu
- [x] Collapsed menu sidebar with proper icon visibility and hover states
- [x] Username/Pro Plan text no longer sticks out when collapsed

### Notifications System
- [x] Removed Notifications button from navigation menu
- [x] Bell icon dropdown shows recent notifications
- [x] "All Notifications" button at bottom of dropdown
- [x] Full Notifications page with search, filters, mark read/unread/important, delete

### Submit Feedback Page
- [x] Test feedback entries (11 entries in seed data covering feature requests, bugs, improvements)

### Support Articles Page
- [x] 5 comprehensive help articles with full-text search and category filtering

### Roadmap Page
- [x] Roadmap display with feature voting system, status tracking (planned/in_progress/completed)

### Company Section
- [x] About Us page with company information and VaultLister stats

### Terms of Service Page
- [x] Full Terms of Service page with route aliases (terms-of-service, terms)

### Privacy Policy Page
- [x] Full Privacy Policy page with route aliases (privacy-policy, privacy)

### Account Page
- [x] Profile card (avatar, username, full name, email, member-since)
- [x] Subscription card with plan badge
- [x] Security card with change password form
- [x] Connected Platforms card with shop count
- [x] Danger Zone card with delete account confirmation

### Inventory Page
- [x] Listing Templates with seed data (5 templates with platform-specific configurations)
- [x] Variations and Sizes as distinct fields with add/remove UI
- [x] eBay promotion rate field with simple/advanced toggle
- [x] Save as Draft options (VaultLister, Platform, or Both)
- [x] Custom pricing rules per platform (toggle in add/edit modal)
- [x] Quantity on Hand tracking

### My Listings Page
- [x] Listing details with per-platform data
- [x] Archive listing feature (single + bulk archive with status filter)
- [x] Columns dropdown with SKU, Labels, Condition (configurable visibleColumns)

### Orders Page
- [x] Test orders in seed data (6 orders with varied statuses)
- [x] Track unfulfilled orders (pending/shipped/delivered status)
- [x] Columns: Date, Buyer, Status, Item, Tracking ID, Shipping Provider, Expected Arrival
- [x] Bulk shipping labels generation modal
- [x] Shipping tracking and routing
- [x] CSV export

### Checklist Page
- [x] To-Do Lists tab with quick add and checkboxes
- [x] Default checklist with 10 items in seed data

### Image Bank Page
- [x] Folder creation (POST /api/image-bank/folders)
- [x] Grid/list view toggle (imageBankViewMode state)

### Cross-List Page
- [x] Advanced Cross-List button with full modal (platform selection, scheduling, settings)

### Automations
- [x] Poshmark offers automation (send offers to likers, auto-accept, decline lowball, counter)
- [x] Poshmark bundles creation and management (bundle discount, bundle reminder)
- [x] Poshmark unfollow automation (unfollow inactive users)
- [x] Scheduling for automations (cron-based)
- [x] Repricing automation based on rules
- [x] Bulk offers sending across platforms

### Help Chat Bot (Vault Buddy)
- [x] Full chatbot with conversation management, message history, response generation

### Delist/Relist Feature
- [x] Stale listing detection (30+ day threshold)
- [x] Visible stale listings card on dashboard with refresh button
- [x] Refresh All Stale Listings bulk action
- [x] Facebook Marketplace: Mark as Sold instead of delisting

### Analytics Page
- [x] Multiple graph display options (line, bar, pie chart components)
- [x] Sales tab with analytic cards and period filtering
- [x] Performance metrics tab (inventory turnover, best sellers, avg days to sell)
- [x] Error reports section for failed listings/syncs
- [x] Inventory turnover reports
- [x] CSV export (inventory, analytics, sales, orders)

### My Shops Page
- [x] Platform logos (platformLogoLarge component for all 6 platforms)

### Settings Page
- [x] Shipping Profiles button in Tools & Configuration
- [x] SKU Rules button in Tools & Configuration

### Financials Page
- [x] Purchases tab with FIFO inventory pricing (cost layer system)
- [x] Auto-detect purchases from platforms (receipt parser + Gmail integration)
- [x] Sales filtering by platform, status, period

---

## Out of Scope

- Mobile native apps (iOS/Android)
- Multi-user/team features
- Payment processing
- Third-party marketplace fees API integration
- Real-time inventory sync (webhook-based)

---

## Architecture Overview

**Current:**
```
VaultLister/
├── src/
│   ├── backend/
│   │   ├── db/           # database.js, migrations/ (27), seed.js
│   │   ├── middleware/   # auth.js, csrf.js, rateLimiter.js, securityHeaders.js
│   │   ├── routes/       # 28 route files
│   │   ├── services/     # cloudinaryService.js, imageStorage.js, grokService.js, gmailService.js, outlookService.js, pricingEngine.js, marketDataService.js, webhookProcessor.js, notificationService.js
│   │   ├── workers/      # taskWorker.js, emailPollingWorker.js, priceCheckWorker.js
│   │   └── server.js     # Bun.serve() entry point (port 3000)
│   ├── frontend/
│   │   ├── app.js        # SPA with custom state management (~25,000+ lines)
│   │   └── styles/       # main.css (~4,500+ lines)
│   ├── shared/
│   │   ├── ai/           # listing-generator, price-predictor
│   │   ├── automations/  # poshmark-bot.js, automation-runner.js
│   │   └── utils/        # sanitize.js, blockchain.js
│   └── tests/            # api.test.js, security.test.js, chatbot.test.js, financials.test.js
├── e2e/                  # Playwright E2E tests
├── claude-docs/          # AI-assisted development docs
│   ├── CLAUDE.md         # Global rules for Claude Code
│   ├── COMMAND_CHEATSHEET.md  # Quick command reference
│   └── docs/
│       ├── commands/     # 20 reusable command workflows
│       ├── reference/    # API, backend, frontend, database, security, testing docs
│       ├── PRD.md        # This file
│       ├── evolution-rules.md   # Rules learned from bugs
│       └── evolution-log.md     # Improvement history
├── chrome-extension/     # Browser extension
├── scripts/              # Utility scripts
└── public/               # Static assets, uploads
```

---

## Next Steps (Prioritized)

**Phase 4 Complete!** All 8 Phase 4 features have been implemented.

**Phase 4 Features (Completed):**
1. ~~**Outlook Integration** - Extend email receipt parsing to Outlook/Microsoft accounts~~ **(COMPLETED - Session 21)**
2. ~~**Additional Platform OAuth** - Complete OAuth for Poshmark, Mercari, Depop, Grailed~~ **(COMPLETED - Session 21)**
3. ~~**Real-time Webhooks** - Platform webhook handlers for instant sync~~ **(COMPLETED - Session 21)**
4. ~~**Mobile PWA Enhancements** - Improved offline support, push notifications~~ **(COMPLETED - Session 21)**
5. ~~**Heatmaps** - Listing engagement heatmaps for visual analytics~~ **(COMPLETED - Session 21)**
6. ~~**Predictive Analytics** - ML-based pricing suggestions and demand forecasting~~ **(COMPLETED - Session 21)**
7. ~~**Supplier Price Monitoring** - Track supplier prices for sourcing optimization~~ **(COMPLETED - Session 21)**
8. ~~**Ad Spy Tools** - Competitor monitoring and market intelligence~~ **(COMPLETED - Session 21)**

**Phase 5 Features (Future):**
1. **Etsy Integration** - Cross-list to Etsy marketplace with full sync support
2. **Whatnot Live Selling** - Integration with Whatnot for live selling events
3. **Mobile App (iOS & Android)** - Native mobile apps with camera integration
4. **Multi-user Team Support** - Team roles, collaboration, shared inventory
5. **Custom Reporting Builder** - Drag-and-drop report widgets with scheduled delivery
6. **Automated Relisting Improvements** - Smart relisting with price adjustments based on predictions
7. **Bulk Label Printing** - Generate and print shipping labels in bulk
8. **Inventory Import from Spreadsheets** - CSV/Excel import with field mapping

---

## Development Guidelines

### Running the Application
```bash
# Start server
bun run dev

# Run all tests
bun run test:all

# Reset database
bun run db:reset

# Check database health
bun run scripts/checkDatabase.js
```

### Key Patterns
- **ES Modules** with `import`/`export`
- **async/await** for all async operations
- **camelCase** for variables/functions, **PascalCase** for classes
- Context object pattern for API routes
- State management via `store.setState()`

### Testing
- Disable CSRF/rate limiting for tests: `DISABLE_CSRF=true DISABLE_RATE_LIMIT=true`
- Use `bun test src/tests/[file].test.js` for specific tests
- E2E tests with Playwright: `bun run test:e2e`

---

*Last Updated: 2026-01-31 (Session 24)*
*Total Implementations: 218+ across 24 sessions*
