# VaultLister 3.0 — Feature Inventory

**Generated:** 2026-04-15 (verified pass)  
**Sources:** Backend exhaustive inventory (70 route files, 49 service files, 11 middleware, 12 bot files) + Frontend exhaustive inventory (9 page files / 125 renderer methods, 9 handler files / 72 handler methods, 104 widget objects, 2 components, service worker)

### Verified Structural Counts

| Item | Count |
|------|------:|
| Backend route files | 70 |
| API endpoint branches (`method ===`) | 782 (325 GET, 310 POST, 78 DELETE, 50 PUT, 19 PATCH) |
| Frontend page files | 9 |
| Page renderer methods | 125 |
| Handler files | 9 |
| Handler methods | 72 |
| Widget objects (`const xxx = {}`) | 104 |
| Widget window exports | 47 |
| Widget internal methods | 323 |
| Worker bots | 6 (+6 support files) |
| AI modules | 7 |
| Middleware | 11 |
| Service files (incl. subdirs) | 49 |
| Public HTML pages | 26 |
| SPA routes (pageChunkMap) | 67 |
| i18n locales | 12 |
| Frontend components | 2 |
| Utility scripts | 38 |

---

## Summary Table

| # | Category | API Endpoints | Frontend Pages/Screens | Notable |
|---|----------|:---:|:---:|---------|
| 1 | Core Inventory Management | 31 inventory + 5 barcode + 16 import + 6 duplicate + 7 recently-deleted + 10 SKU-rules + 6 SKU-sync | inventory, templates, skuRules, smartRelisting, inventoryImport, recentlyDeleted | Implemented |
| 2 | Cross-Listing & Marketplace Integration | 37 listings + 10 shops + 8 OAuth | listings, shops, connections | Implemented (eBay/Etsy REST; others bot) |
| 3 | AI-Powered Features | 18 AI routes + 18 prediction routes + 7 chatbot | AI generation modals, predictions, marketIntel | Implemented |
| 4 | Automations & Bots | 36 automation + 14 relisting | automations, calendar (schedule), smartRelisting | Implemented (6 platforms) |
| 5 | Sales & Financial Tracking | 7 sales + 33 financials + 14 orders + 4 expense-tracker + 11 sales-enhancements | sales, financials, transactions, orders | Implemented |
| 6 | Analytics & Reporting | 20 analytics + 15 reports + 4 search-analytics | analytics, reports, reportBuilder, heatmaps, predictions | Implemented |
| 7 | Offer & Negotiation Management | 11 offers | offers | Implemented |
| 8 | Image Management | 22 image-bank + 6 watermark + 11 batch-photo | imageBank, batchPhotoEdit | Implemented |
| 9 | User & Account Management | 18 auth + 11 security + 3 account + 9 GDPR + 6 social-auth + 9 email-oauth + 12 teams | login, register, account, settings, teams | Implemented |
| 10 | Plans & Billing | 11 billing + 10 affiliate | plansBilling, affiliate | Implemented (Stripe) |
| 11 | Notifications & Communication | 6 notifications + 8 push-notifications + 9 push-subscriptions + 15 webhooks | notifications, webhooks, pushNotifications | Implemented |
| 12 | Shipping | 20 shipping-labels + 6 shipping-profiles + 13 size-charts | shippingLabels, shippingProfiles, sizeCharts, orders | Partial (EasyPost pending) |
| 13 | Security & Infrastructure | 7 rate-limit-dashboard + 2 settings | adminMetrics, security events | Implemented (security.js counted in cat 9, monitoring.js in cat 17) |
| 14 | Offline & PWA | 6 offline-sync routes | SW v5.6, offline fallback | Implemented |
| 15 | Internationalization | — | i18n module | 2 full locales, 10 defined |
| 16 | Public/Marketing Pages | — | 26 public HTML files | Implemented |
| 17 | Developer & Admin Tools | 1 contact + 13 monitoring + 9 tasks + 13 calendar + 6 templates + 12 receipts + 12 checklists + 13 suppliers + 9 community + 1 currency + 9 QR-analytics + 8 whatnot + 10 whatnot-enhanced + 13 market-intel + 5 competitor-tracking + 12 feedback + 6 roadmap + 22 extension + 15 help + 6 onboarding + 8 legal + 6 integrations + 4 mock-oauth + 1 syncAuditLog | adminFeatureFlags, adminBusinessMetrics, adminMetrics, help, community, roadmap | Implemented |

---

## 1. Core Inventory Management

CRUD, search, filtering, tags, categories, custom fields, bulk operations, SKU generation, soft-delete/restore.

### API Endpoints

#### `/src/backend/routes/inventory.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/inventory` | List all inventory with filters, search, pagination | Implemented |
| GET | `/api/inventory/stats` | Aggregate inventory statistics (count, value, by status) | Implemented |
| GET | `/api/inventory/deleted` | List soft-deleted items (within 30-day window) | Implemented |
| GET | `/api/inventory/categories` | List user-defined categories | Implemented |
| POST | `/api/inventory/categories` | Create new category | Implemented |
| PUT | `/api/inventory/categories/:id` | Update a category | Implemented |
| DELETE | `/api/inventory/categories/:id` | Delete a category | Implemented |
| GET | `/api/inventory/suppliers` | List suppliers | Implemented |
| POST | `/api/inventory/suppliers` | Create supplier | Implemented |
| PUT | `/api/inventory/suppliers/:id` | Update supplier | Implemented |
| DELETE | `/api/inventory/suppliers/:id` | Delete supplier | Implemented |
| GET | `/api/inventory/suppliers/:id/performance` | Supplier performance analytics | Implemented |
| GET | `/api/inventory/export/csv` | Export inventory as CSV download | Implemented |
| POST | `/api/inventory/import/platform` | Import items from a connected marketplace | Implemented |
| POST | `/api/inventory/import/csv` | Import items from uploaded CSV file | Implemented |
| POST | `/api/inventory/import/url` | Import item from marketplace URL (scraping) | Implemented |
| POST | `/api/inventory/bulk` | Bulk operations (generic) | Implemented |
| PUT | `/api/inventory/bulk/update` | Bulk update status/category/price for multiple items | Implemented |
| DELETE | `/api/inventory/bulk/delete` | Soft-delete multiple items at once | Implemented |
| POST | `/api/inventory/bulk/cross-list` | Queue cross-listing draft listings for multiple items | Implemented |
| POST | `/api/inventory/cleanup-deleted` | Remove soft-deleted items older than 30 days | Implemented |
| POST | `/api/inventory/purge-deleted` | Permanently purge items soft-deleted 30+ days ago | Implemented |
| GET | `/api/inventory/:id` | Get single inventory item | Implemented |
| GET | `/api/inventory/:id/history` | Get item purchase and sales history | Implemented |
| POST | `/api/inventory` | Create new inventory item | Implemented |
| PUT | `/api/inventory/:id` | Update inventory item | Implemented |
| DELETE | `/api/inventory/:id` | Soft-delete item (moves to Recently Deleted) | Implemented |
| POST | `/api/inventory/:id/duplicate` | Duplicate an inventory item | Implemented |
| POST | `/api/inventory/:id/restore` | Restore a soft-deleted item | Implemented |
| DELETE | `/api/inventory/:id/permanent` | Permanently delete an item | Implemented |

#### `/src/backend/routes/barcode.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/barcode/lookup/:code` | Look up barcode (UPC, EAN, ISBN) | Implemented |
| GET | `/api/barcode/recent` | Get recently scanned barcodes | Implemented |
| POST | `/api/barcode/batch` | Batch barcode lookup with caching | Implemented |
| POST | `/api/barcode/save` | Save a barcode lookup manually | Implemented |
| POST | `/api/barcode/validate` | Validate barcode format | Implemented |

#### `/src/backend/routes/skuRules.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/sku-rules` | List all rules | Implemented |
| GET | `/api/sku-rules/default` | Get default rule | Implemented |
| POST | `/api/sku-rules/preview` | Preview SKU pattern with sample data | Implemented |
| POST | `/api/sku-rules/generate` | Generate SKU for an item | Implemented |
| POST | `/api/sku-rules/batch-update` | Batch update inventory SKUs | Implemented |
| GET | `/api/sku-rules/:id` | Get single rule | Implemented |
| POST | `/api/sku-rules` | Create new rule | Implemented |
| PUT | `/api/sku-rules/:id` | Update rule | Implemented |
| DELETE | `/api/sku-rules/:id` | Delete rule | Implemented |
| POST | `/api/sku-rules/:id/set-default` | Set rule as default | Implemented |

#### `/src/backend/routes/skuSync.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/sku-sync` | List all SKU platform links with sync status | Implemented |
| GET | `/api/sku-sync/conflicts` | List SKU conflicts | Implemented |
| GET | `/api/sku-sync/barcode/:barcode` | Find all inventory items linked to a barcode/SKU | Implemented |
| POST | `/api/sku-sync/link` | Link a master SKU to a platform | Implemented |
| POST | `/api/sku-sync/sync` | Sync all pending SKU links | Implemented |
| DELETE | `/api/sku-sync/:id` | Remove a SKU link | Implemented |

#### `/src/backend/routes/recentlyDeleted.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/recently-deleted` | List deleted items with pagination and filters | Implemented |
| GET | `/api/recently-deleted/stats` | Return counts by type and deletion reason | Implemented |
| POST | `/api/recently-deleted/:id/restore` | Restore a single deleted item | Implemented |
| POST | `/api/recently-deleted/bulk-restore` | Restore multiple items | Implemented |
| POST | `/api/recently-deleted/cleanup` | Remove items older than 30 days | Implemented |
| DELETE | `/api/recently-deleted/:id` | Permanently delete a single item | Implemented |
| DELETE | `/api/recently-deleted/bulk-delete` | Permanently delete multiple items | Implemented |

#### `/src/backend/routes/duplicates.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/duplicates` | List detected duplicates | Implemented |
| GET | `/api/duplicates/stats` | Get duplicate statistics | Implemented |
| POST | `/api/duplicates/scan` | Trigger duplicate scan | Implemented |
| POST | `/api/duplicates/check` | Check single item for duplicates | Implemented |
| PATCH | `/api/duplicates/:id` | Update user action (confirm/ignore duplicate) | Implemented |
| DELETE | `/api/duplicates/:id` | Delete duplicate record | Implemented |

#### `/src/backend/routes/inventoryImport.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/inventory-import/jobs` | List import jobs | Implemented |
| GET | `/api/inventory-import/jobs/:id` | Get single job | Implemented |
| GET | `/api/inventory-import/jobs/:id/rows` | Get rows for an import job | Implemented |
| GET | `/api/inventory-import/mappings` | List saved column mappings | Implemented |
| GET | `/api/inventory-import/templates/download` | Download import template CSV | Implemented |
| GET | `/api/inventory-import/field-options` | Get available import field options | Implemented |
| POST | `/api/inventory-import/upload` | Upload file to start import | Implemented |
| POST | `/api/inventory-import/jobs/:id/set-mapping` | Set column mapping for a job | Implemented |
| POST | `/api/inventory-import/jobs/:id/validate` | Validate import data | Implemented |
| POST | `/api/inventory-import/jobs/:id/execute` | Execute the import | Implemented |
| POST | `/api/inventory-import/jobs/:id/cancel` | Cancel an import job | Implemented |
| POST | `/api/inventory-import/mappings` | Save a column mapping | Implemented |
| POST | `/api/inventory-import/validate-row` | Validate a single row | Implemented |
| PATCH | `/api/inventory-import/mappings/:id` | Update a column mapping | Implemented |
| DELETE | `/api/inventory-import/jobs/:id` | Delete an import job | Implemented |
| DELETE | `/api/inventory-import/mappings/:id` | Delete a column mapping | Implemented |

### Frontend Pages

| Page | Key UI Elements |
|------|----------------|
| `inventory()` | Inventory list (table/grid/compact toggle); search bar; filter bar (status, platform, category, date range); sort dropdown; bulk action toolbar (select all, delete, archive, export, crosslist, update status, update price); item cards with image/title/SKU/price/status/platform badges; Add Item FAB; filter chips; stat cards (total items, active, drafts, low stock); column visibility picker; import dropdown (CSV, marketplace, paste, URL) |
| `skuRules()` | SKU rules table (pattern, priority, default flag); add/edit/delete forms; live SKU preview; batch SKU update modal; pattern token inserter |
| `smartRelisting()` | Stale listings table (days since active, platform, title, price); days threshold selector; queue/process relist buttons; relisting rules list; create/edit/delete rule modals; preview relist price |
| `inventoryImport()` | Import method tabs (Paste/CSV/Excel); column mapping interface; swap column dropdowns; validate/cancel import; mapping template save/load/delete; import progress |
| `recentlyDeleted()` | Deleted items table (title, type, delete reason, deleted date, days remaining); type/reason/search filters; individual and bulk restore/delete buttons; cleanup button; stat cards |
| `templates()` | Templates grid; search; favorite star; apply/edit/delete/create template buttons |

### Key Handlers

`addItem`, `updateItem`, `deleteItem`, `duplicateItem`, `bulkUpdateStatus`, `bulkUpdatePrice`, `exportSelected`, `searchInventory`, `addFilter`, `applyFilters`, `showImportFromMarketplace`, `importCSV`, `scanForDuplicates`, `addSkuRule`, `updateSkuRule`, `batchUpdateSkus`, `autoGenerateSkuInModal`, `restoreDeletedItem`, `permanentlyDeleteItem`, `createRelistingRule`, `queueForRelisting`, `processRelistQueue`

---

## 2. Cross-Listing & Marketplace Integration

Cross-lister UI, platform sync, per-platform publish (REST APIs and browser automation bots), shop management, OAuth.

### API Endpoints

#### `/src/backend/routes/listings.js` (cross-listing endpoints)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/listings` | List all listings with filters and pagination | Implemented |
| GET | `/api/listings/stats` | Get listing statistics | Implemented |
| GET | `/api/listings/stale` | Get stale listings needing refresh | Implemented |
| GET | `/api/listings/cross-list-history` | Cross-listing history grouped by inventory item | Implemented |
| POST | `/api/listings` | Create new listing | Implemented |
| POST | `/api/listings/crosslist` | Create listings for multiple platforms | Implemented |
| POST | `/api/listings/batch` | Create multiple listings at once | Implemented |
| POST | `/api/listings/refresh-bulk` | Refresh multiple stale listings at once | Implemented |
| POST | `/api/listings/sync-status` | Sync listing status from marketplace platforms back to local DB | Implemented |
| GET | `/api/listings/:id` | Get single listing | Implemented |
| PUT | `/api/listings/:id` | Update listing | Implemented |
| DELETE | `/api/listings/:id` | Delete listing | Implemented |
| POST | `/api/listings/:id/share` | Share listing on Poshmark | Implemented |
| POST | `/api/listings/:id/delist` | Delist a listing from its platform | Implemented |
| POST | `/api/listings/:id/relist` | Relist a delisted listing | Implemented |
| POST | `/api/listings/:id/refresh` | Delist and immediately relist | Implemented |
| GET | `/api/listings/:id/refresh-history` | Get refresh history for a listing | Implemented |
| PUT | `/api/listings/:id/staleness-settings` | Update staleness detection settings | Implemented |
| POST | `/api/listings/:id/archive` | Archive a listing | Implemented |
| POST | `/api/listings/:id/unarchive` | Unarchive a listing | Implemented |
| POST | `/api/listings/:id/schedule-price-drop` | Schedule a future price drop | Implemented |
| GET | `/api/listings/:id/competitor-pricing` | Get competitor pricing data | Implemented |
| GET | `/api/listings/:id/time-to-sell` | Estimate time-to-sell | Implemented |
| POST | `/api/listings/:id/publish` | Generic publish to listing's configured platform | Implemented |
| POST | `/api/listings/:id/publish-ebay` | Push listing live to eBay via Sell API | Implemented |
| POST | `/api/listings/:id/publish-etsy` | Push listing live to Etsy via Listings API v3 | Implemented |
| POST | `/api/listings/:id/publish-poshmark` | Push listing live to Poshmark via browser automation | Implemented |
| POST | `/api/listings/:id/publish-mercari` | Push listing live to Mercari via browser automation | Implemented |
| POST | `/api/listings/:id/publish-depop` | Push listing live to Depop via REST API | Implemented |
| POST | `/api/listings/:id/publish-grailed` | Push listing live to Grailed via browser automation | Implemented |
| POST | `/api/listings/:id/publish-facebook` | Push listing live to Facebook Marketplace via Camoufox bot | Implemented |
| POST | `/api/listings/:id/publish-whatnot` | Push listing live to Whatnot via browser automation | Implemented |
| POST | `/api/listings/:id/publish-shopify` | Push listing live to Shopify via Admin REST API | Implemented |

#### `/src/backend/routes/shops.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/shops` | List all connected shops | Implemented |
| GET | `/api/shops/health` | Platform connection health dashboard | Implemented |
| GET | `/api/shops/sync-status` | Get sync status for all shops | Implemented |
| GET | `/api/shops/:platform` | Get specific shop by platform | Implemented |
| POST | `/api/shops` | Connect new shop | Implemented |
| PUT | `/api/shops/:platform` | Update shop settings | Implemented |
| DELETE | `/api/shops/:platform` | Disconnect a shop | Implemented |
| POST | `/api/shops/:platform/sync` | Sync a specific shop's data | Implemented |
| GET | `/api/shops/:platform/stats` | Get statistics for a specific shop | Implemented |
| POST | `/api/shops/sync-all` | Sync all connected shops | Implemented |

#### `/src/backend/routes/oauth.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/oauth/authorize/:platform` | Start OAuth authorization for a platform | Implemented |
| GET | `/api/oauth/callback/:platform` | Handle OAuth callback | Implemented |
| GET | `/api/oauth/status/:platform` | Get OAuth connection status for a platform | Implemented |
| POST | `/api/oauth/refresh/:platform` | Refresh OAuth token for a platform | Implemented |
| POST | `/api/oauth/reconnect/:platform` | Force reconnect for a platform | Implemented |
| POST | `/api/oauth/sync/:platform` | Trigger sync for a platform after OAuth | Implemented |
| DELETE | `/api/oauth/revoke/:platform` | Revoke OAuth for a platform | Implemented |

#### `/src/backend/routes/syncAuditLog.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/sync-audit-log/audit-log` | Get platform sync audit log | Implemented |

### Platform Sync Services (`src/backend/services/platformSync/`)

| Service | Function | Description |
|---------|----------|-------------|
| `index.js` | `syncShop(shopId, userId)` | Dispatch sync to correct platform handler |
| `ebaySync.js` | `syncEbayShop(shop)` | Full eBay sync (listings + orders) |
| `etsySync.js` | `syncEtsyShop(shop)` | Full Etsy sync (listings + orders) |
| `poshmarkSync.js` | `syncPoshmarkShop(shop)` | Full Poshmark sync |
| `mercariSync.js` | `syncMercariShop(shop)` | Full Mercari sync |
| `grailedSync.js` | `syncGrailedShop(shop)` | Full Grailed sync |
| `depopSync.js` | `syncDepopShop(shop)` | Full Depop sync |
| `facebookSync.js` | `syncFacebookShop(shop)` | Full Facebook Marketplace sync |
| `shopifySync.js` | `syncShopifyShop(shop)` | Full Shopify sync |
| `whatnotSync.js` | `syncWhatnotShop(shop)` | Full Whatnot sync |
| `ebayPublish.js` | `publishListingToEbay(shop, listing, inventory)` | Publish via eBay Sell API (REST) |
| `etsyPublish.js` | `publishListingToEtsy(shop, listing, inventory)` | Publish via Etsy Listings API v3 (REST) |
| `poshmarkPublish.js` | `publishListingToPoshmark(shop, listing, inventory)` | Publish via browser automation |
| `mercariPublish.js` | `publishListingToMercari(shop, listing, inventory)` | Publish via browser automation |
| `grailedPublish.js` | `publishListingToGrailed(shop, listing, inventory)` | Publish via browser automation |
| `depopPublish.js` | `publishListingToDepop(shop, listing, inventory)` | Publish via Depop REST API |
| `facebookPublish.js` | `publishListingToFacebook(shop, listing, inventory)` | Publish via Camoufox Firefox bot |
| `shopifyPublish.js` | `publishListingToShopify(shop, listing, inventory)` | Publish via Shopify Admin REST API |
| `whatnotPublish.js` | `publishListingToWhatnot(shop, listing, inventory)` | Publish via browser automation |

### Frontend Pages

| Page | Key UI Elements |
|------|----------------|
| `listings()` | Listings table/grid; tabs (Active, Sold, Archived, Drafts); platform filter chips; bulk actions (archive, delete, delist, relist, refresh); price drop scheduler; competitor pricing; time-to-sell; profit calculator; listing folder management |
| `shops()` | Connected shops list per platform; sync all; per-shop: refresh health, settings, branding, multi-shop sync, sync conflicts, marketplace requirements; connect/disconnect buttons; platform health grid |

### Key Handlers

`submitCrosslist`, `submitCrosslistWithMethod`, `updateCrosslistSelection`, `startAdvancedCrosslist`, `submitAdvancedCrosslist`, `refreshListing`, `refreshAllStaleListings`, `delistListing`, `relistListing`, `syncAllShops`, `connectShop`, `disconnectShop`, `connectOAuth`, `showSyncConflicts`

---

## 3. AI-Powered Features

Listing generation, price suggestions, image analysis, Vault Buddy chat, background removal, SEO optimization.

### API Endpoints

#### `/src/backend/routes/ai.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/ai/analyze-listing-image` | Advanced AI image analysis with Claude Vision (brand, category, condition, defects) | Implemented |
| POST | `/api/ai/generate-listing` | Generate full listing from image/details or inventory item | Implemented |
| POST | `/api/ai/generate-title` | Generate optimized title only | Implemented |
| POST | `/api/ai/generate-description` | Generate listing description only | Implemented |
| POST | `/api/ai/generate-tags` | Generate tags/keywords for a listing | Implemented |
| POST | `/api/ai/suggest-price` | Suggest price based on item details and market data | Implemented |
| POST | `/api/ai/analyze-image` | Analyze product image (lighter version) | Implemented |
| POST | `/api/ai/optimize-listing` | Optimize an existing listing for SEO and conversion | Implemented |
| POST | `/api/ai/bulk-generate` | Bulk AI generation for multiple inventory items | Implemented |
| POST | `/api/ai/detect-duplicates` | Find potential duplicate listings | Implemented |
| GET | `/api/ai/sourcing-suggestions` | Get AI-powered sourcing recommendations | Implemented |
| POST | `/api/ai/translate` | Translate listing content for international markets | Implemented |
| POST | `/api/ai/category-mapping` | Map categories across different marketplaces | Implemented |
| POST | `/api/ai/generate-hashtags` | Generate optimized hashtags with trending analysis | Implemented |
| POST | `/api/ai/image-enhancement` | Get AI suggestions for image improvement | Implemented |
| POST | `/api/ai/profit-prediction` | Comprehensive profit prediction with fees and shipping | Implemented |
| POST | `/api/ai/seo-optimize` | Full SEO optimization for listings | Implemented |
| POST | `/api/ai/auto-categorize` | Auto-categorize item from title/description | Implemented |

#### `/src/backend/routes/predictions.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/predictions` | List all AI predictions for user | Implemented |
| POST | `/predictions/item/:inventoryId` | Generate price/demand prediction for an item | Implemented |
| GET | `/predictions/item/:inventoryId` | Get latest prediction for an item | Implemented |
| POST | `/predictions/batch` | Generate predictions for multiple items | Implemented |
| GET | `/predictions/recommendations` | Get items needing action based on predictions | Implemented |
| GET | `/predictions/demand` | Get demand forecasts by category | Implemented |
| POST | `/predictions/demand/:category` | Generate demand forecast for specific category | Implemented |
| GET | `/predictions/seasonal-calendar` | Get seasonality calendar | Implemented |
| GET | `/predictions/stats` | Get prediction accuracy statistics | Implemented |
| GET | `/predictions/history` | Paginated history with actual vs predicted accuracy | Implemented |
| GET | `/predictions/models` | List custom prediction models | Implemented |
| POST | `/predictions/models` | Create new prediction model | Implemented |
| PUT | `/predictions/models/:id` | Update prediction model | Implemented |
| DELETE | `/predictions/models/:id` | Delete prediction model | Implemented |
| GET | `/predictions/scenarios` | List what-if scenarios | Implemented |
| POST | `/predictions/scenarios` | Create new what-if scenario | Implemented |
| GET | `/predictions/scenarios/:id` | Get single scenario | Implemented |
| DELETE | `/predictions/scenarios/:id` | Delete scenario | Implemented |

#### `/src/backend/routes/chatbot.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/chatbot/conversations` | List user's conversations | Implemented |
| GET | `/api/chatbot/conversations/:id` | Get single conversation with messages | Implemented |
| POST | `/api/chatbot/conversations` | Create new conversation | Implemented |
| POST | `/api/chatbot/message` | Send message to AI chatbot (VaultBuddy), get response | Implemented |
| POST | `/api/chatbot/rate` | Rate a chatbot response | Implemented |
| PATCH | `/api/chatbot/conversations/:id` | Update conversation (title, etc.) | Implemented |
| DELETE | `/api/chatbot/conversations/:id` | Delete conversation | Implemented |

### AI Service Modules (`src/shared/ai/`)

| Module | Key Exports | Description |
|--------|-------------|-------------|
| `claude-client.js` | `callVisionAPI()`, `callTextAPI()` | Claude Sonnet API with retry, timeout, token budget tracking |
| `tokenBudget.js` | `trackUsage()`, `checkBudget()`, `TIER_TOKEN_LIMITS` | Per-user token budget enforcement by plan tier |
| `image-analyzer.js` | `analyzeImage()`, `detectBrand()`, `detectCategory()`, `estimateImageQuality()` | Claude Vision image analysis |
| `listing-generator.js` | `generateListing()`, `generateTitle()`, `generateDescription()`, `generateTags()`, `scoreListingQuality()` | Full listing generation pipeline |
| `price-predictor.js` | `predictPrice()`, `getPriceRange()`, `calculateProfit()`, `getPriceRecommendations()` | Statistical + seasonal price prediction (no API) |
| `predictions-ai.js` | `claudePricePrediction()`, `claudeDemandForecast()` | Claude-powered price/demand prediction with statistical fallbacks |
| `sanitize-input.js` | `sanitizeForAI()` | Input sanitization before AI API calls |

### Additional AI Backend Services

| Service | Key Functions |
|---------|---------------|
| `grokService.js` | `getGrokResponse()`, `streamResponse()` — Claude (with Grok fallback) for chatbot |
| `cloudinaryService.js` | `removeBackground()`, `autoEnhance()`, `smartCrop()`, `aiUpscale()` |
| `marketDataService.js` | `getMarketInsight()`, `findOpportunities()` |
| `pricingEngine.js` | `generatePricePrediction()`, `calculateDemandScore()`, `generateBatchPredictions()` |

### Frontend Pages

| Page | Key UI Elements |
|------|----------------|
| `helpSupport()` / VaultBuddy panel | VaultBuddy AI chat panel; toggle; conversation history; SSE streaming messages; delete/start new conversation |
| `predictions()` | Predictions list; filter by category/time range; run prediction model; prediction details modal (chart, factors, confidence); custom model config; what-if scenario builder |
| `marketIntel()` | Market intelligence dashboard; AI price suggestion; SWOT analysis; opportunity explorer |
| Add/Edit Item modal | AI analysis trigger; display AI-generated title/description/tags; apply AI results |

### Key AI Handlers

`startAIAnalysis`, `displayAIResults`, `applyAIResults`, `runBulkOptimize`, `runPriceSuggestion`, `sendVaultBuddyMessage`, `toggleVaultBuddy`, `loadVaultBuddyConversations`, `startNewVaultBuddyChat`, `filterPredictions`, `runPredictionModel`, `showPredictionDetails`, `createPredictionModel`, `runWhatIfScenario`

---

## 4. Automations & Bots

Closet sharing, follow-back, offer rules, relist, price drops, scheduling, multi-platform bots.

### API Endpoints

#### `/src/backend/routes/automations.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/automations` | List all automation rules | Implemented |
| GET | `/api/automations/logs` | Get automation execution logs | Implemented |
| GET | `/api/automations/run/:runId/logs` | Get action logs for a specific run | Implemented |
| GET | `/api/automations/history` | Detailed automation run history | Implemented |
| GET | `/api/automations/history/export` | Export run history as CSV | Implemented |
| DELETE | `/api/automations/history` | Clear automation run history | Implemented |
| GET | `/api/automations/stats` | Automation statistics (success rate, total runs) | Implemented |
| GET | `/api/automations/presets` | Get built-in automation presets | Implemented |
| POST | `/api/automations/from-preset` | Create automation rule from a preset | Implemented |
| GET | `/api/automations/schedule-settings` | Get automation schedule settings | Implemented |
| POST | `/api/automations/schedule-settings` | Save schedule settings | Implemented |
| GET | `/api/automations/notification-prefs` | Get automation notification preferences | Implemented |
| POST | `/api/automations/notification-prefs` | Save notification preferences | Implemented |
| GET | `/api/automations/experiments` | List A/B test experiments | Implemented |
| POST | `/api/automations/experiments` | Create experiment (clone rule as variant) | Implemented |
| PUT | `/api/automations/experiments/:id` | Update experiment (complete/pick winner) | Implemented |
| GET | `/api/automations/export` | Export all rules as JSON | Implemented |
| POST | `/api/automations/import` | Import rules from JSON | Implemented |
| GET | `/api/automations/templates/shared` | Browse community-shared templates | Implemented |
| POST | `/api/automations/templates/share` | Publish a rule as a shared template | Implemented |
| POST | `/api/automations/templates/install` | Install a shared template as a rule | Implemented |
| POST | `/api/automations/templates/import-url` | Import rule from a JSON URL | Implemented |
| GET | `/api/automations/duration-trends` | Run duration trends by day | Implemented |
| POST | `/api/automations/reorder` | Update sort order for rules | Implemented |
| GET | `/api/automations/scheduler-status` | Live scheduler health check | Implemented |
| POST | `/api/automations/poshmark/sync` | Queue a Poshmark inventory sync task | Implemented |
| GET | `/api/automations/:id` | Get single automation rule | Implemented |
| POST | `/api/automations` | Create new automation rule | Implemented |
| PUT | `/api/automations/:id` | Update rule | Implemented |
| DELETE | `/api/automations/:id` | Delete rule | Implemented |
| POST | `/api/automations/:id/clone` | Clone/duplicate a rule | Implemented |
| POST | `/api/automations/:id/run` | Run rule manually immediately | Implemented |
| POST | `/api/automations/:id/cancel` | Cancel a queued or running automation task | Implemented |
| POST | `/api/automations/:id/toggle` | Toggle rule enabled/disabled | Implemented |
| GET | `/api/automations/:id/versions` | Get version history for a rule | Implemented |
| POST | `/api/automations/:id/rollback` | Rollback rule to a specific version | Implemented |

#### `/src/backend/routes/relisting.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/relisting/rules` | List all relisting rules | Implemented |
| GET | `/api/relisting/rules/:id` | Get single rule | Implemented |
| POST | `/api/relisting/rules` | Create rule | Implemented |
| PATCH | `/api/relisting/rules/:id` | Update rule | Implemented |
| DELETE | `/api/relisting/rules/:id` | Delete rule | Implemented |
| GET | `/api/relisting/stale` | Get stale listings eligible for relisting | Implemented |
| POST | `/api/relisting/queue` | Add listings to relist queue | Implemented |
| GET | `/api/relisting/queue` | Get relist queue | Implemented |
| DELETE | `/api/relisting/queue/:id` | Remove item from queue | Implemented |
| POST | `/api/relisting/process` | Process relist queue (execute pending relists) | Implemented |
| GET | `/api/relisting/performance` | Get relisting performance statistics | Implemented |
| POST | `/api/relisting/preview-price` | Preview price adjustment from rule | Implemented |
| POST | `/api/relisting/auto-schedule` | Auto-schedule relisting with price adjustments | Implemented |
| GET | `/api/relisting/schedule-preview` | Preview what auto-schedule would do | Implemented |

### Worker Bots

| Bot | Platform | Key Methods |
|-----|----------|-------------|
| `poshmark-bot.js` (`PoshmarkBot`) | Poshmark | `shareCloset()` (200/run), `followBackFollowers()` (75/run), `sendOffersToAllListings()`, `getOffers()`, `acceptOffer()`, `counterOffer()`, `declineOffer()`, `createListing()` |
| `depop-bot.js` (`DepopBot`) | Depop | `refreshAllListings()` (50/run), `shareListing()` |
| `mercari-bot.js` (`MercariBot`) | Mercari | `refreshAllListings()` (50/run), `relistItem()` |
| `grailed-bot.js` (`GrailedBot`) | Grailed | `bumpAllListings()` (30/run, 4s delay) |
| `facebook-bot.js` (`FacebookBot`) | Facebook Marketplace | `refreshAllListings()` (20/day), profile rotation via Camoufox Firefox, 1hr profile cooldown |
| `whatnot-bot.js` (`WhatnotBot`) | Whatnot | `refreshAllListings()` (30/run) |

### Automation Presets (from `worker/bots/presets.js`)

| Preset | Platform | Category |
|--------|----------|----------|
| `daily_share`, `party_share`, `community_share` | Poshmark | Sharing |
| `follow_back`, `unfollow_inactive`, `follow_targeted` | Poshmark | Engagement |
| `send_offers`, `auto_accept`, `decline_lowball`, `counter_offers` | Poshmark | Offers |
| `bundle_discount`, `bundle_reminder`, `bundle_for_likers` | Poshmark | Bundles |
| `weekly_drop`, `ccl_rotation`, `relist_stale`, `smart_relisting`, `description_refresh`, `error_retry` | Poshmark | Pricing/Maintenance |
| `auto_reprice`, `delist_stale` | All platforms | Pricing/Maintenance |
| `mercari_refresh`, `mercari_relist`, `mercari_price_drop` | Mercari | All categories |
| `depop_refresh`, `depop_share`, `depop_price_drop` | Depop | All categories |
| `grailed_bump`, `grailed_relist`, `grailed_price_drop` | Grailed | All categories |
| `facebook_refresh`, `facebook_relist`, `facebook_price_drop` | Facebook | All categories |
| `whatnot_refresh`, `whatnot_relist`, `whatnot_price_drop` | Whatnot | All categories |

### Stealth/Anti-detect (`worker/bots/stealth.js`)

`stealthChromium` (puppeteer-extra-plugin-stealth), `injectChromeRuntimeStub()`, `injectBrowserApiStubs()` (WebRTC, hardwareConcurrency, deviceMemory, plugins, Battery API, NetworkInformation), `humanClick()`, `humanScroll()`, `mouseWiggle()`, `launchCamoufox()` (Firefox with native fingerprint spoofing)

### Frontend Page

| Page | Key UI Elements |
|------|----------------|
| `automations()` | Automation rules list; platform/category/tag filters; enable/disable toggle; run now; schedule editor; condition builder modal; bulk toggle/schedule; add automation wizard; run history; activity log; drag-and-drop reordering; template marketplace; import/export JSON; rule version history; A/B experiments; performance chart |
| `smartRelisting()` | See Section 1 |

---

## 5. Sales & Financial Tracking

Sales recording, profit calculation, tax nexus tracking, payouts, FIFO cost accounting, purchase records, recurring transactions.

### API Endpoints

#### `/src/backend/routes/sales.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/sales` | List all sales with filters and pagination | Implemented |
| GET | `/api/sales/stats` | Sales statistics (revenue, volume, by platform) | Implemented |
| GET | `/api/sales/export/csv` | Export sales as CSV | Implemented |
| GET | `/api/sales/:id` | Get single sale | Implemented |
| POST | `/api/sales` | Record new sale | Implemented |
| PUT | `/api/sales/:id` | Update sale | Implemented |
| DELETE | `/api/sales/:id` | Delete sale | Implemented |

#### `/src/backend/routes/financials.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/financials/purchases` | List all purchases with filters | Implemented |
| GET | `/api/financials/purchases/:id` | Get single purchase with line items | Implemented |
| POST | `/api/financials/purchases` | Create new purchase record | Implemented |
| PUT | `/api/financials/purchases/:id` | Update purchase | Implemented |
| DELETE | `/api/financials/purchases/:id` | Delete purchase | Implemented |
| GET | `/api/financials/accounts` | List all financial accounts grouped by type | Implemented |
| GET | `/api/financials/accounts/:id` | Get single account with transactions | Implemented |
| POST | `/api/financials/accounts` | Create new financial account | Implemented |
| PUT | `/api/financials/accounts/:id` | Update account | Implemented |
| DELETE | `/api/financials/accounts/:id` | Delete account (only if no transactions) | Implemented |
| GET | `/api/financials/transactions` | List all transactions with filters | Implemented |
| POST | `/api/financials/transactions` | Create manual transaction | Implemented |
| PUT | `/api/financials/transactions/:id` | Update transaction (with audit logging) | Implemented |
| POST | `/api/financials/transactions/:id/split` | Split a transaction into multiple parts | Implemented |
| GET | `/api/financials/transactions/:id/attachments` | List receipt attachments on a transaction | Implemented |
| POST | `/api/financials/transactions/:id/attachments` | Attach a receipt to a transaction | Implemented |
| DELETE | `/api/financials/transactions/:id/attachments/:attachId` | Delete a receipt attachment | Implemented |
| GET | `/api/financials/transactions/:id/audit` | Get audit trail for a transaction | Implemented |
| GET | `/api/financials/statements` | Generate financial statements for a period | Implemented |
| GET | `/api/financials/profit-loss` | Generate Profit & Loss report | Implemented |
| POST | `/api/financials/consume-fifo` | Internal FIFO cost consumption endpoint | Implemented |
| POST | `/api/financials/email-parse` | Parse a sale notification email and extract financial data | Implemented |
| POST | `/api/financials/seed-accounts` | Create default chart-of-accounts for a new user | Implemented |
| GET | `/api/financials/categorization-rules` | List auto-categorization rules | Implemented |
| POST | `/api/financials/categorization-rules` | Create new categorization rule | Implemented |
| DELETE | `/api/financials/categorization-rules/:id` | Delete a categorization rule | Implemented |
| POST | `/api/financials/auto-categorize` | Apply categorization rules to uncategorized transactions | Implemented |
| GET | `/api/financials/recurring-templates` | List recurring transaction templates | Implemented |
| POST | `/api/financials/recurring-templates` | Create a recurring template | Implemented |
| POST | `/api/financials/recurring-templates/:id/execute` | Execute a recurring template immediately | Implemented |
| DELETE | `/api/financials/recurring-templates/:id` | Delete a recurring template | Implemented |
| GET | `/api/financials/platform-fees` | Platform fee breakdown per platform | Implemented |
| GET | `/api/financials/platform-fees/summary` | Aggregate platform fee summary | Implemented |

#### `/src/backend/routes/salesEnhancements.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/sales-tools/tax-nexus` | Get nexus status for all states for current year | Implemented |
| POST | `/api/sales-tools/tax-nexus/calculate` | Recalculate nexus thresholds from sales data | Implemented |
| GET | `/api/sales-tools/tax-nexus/alerts` | Get states approaching nexus thresholds (>70%) | Implemented |
| PUT | `/api/sales-tools/tax-nexus/:state/registered` | Mark a state as registered for tax collection | Implemented |
| GET | `/api/sales-tools/buyers` | List buyer profiles with filters | Implemented |
| GET | `/api/sales-tools/buyers/flagged` | Get buyers with return rate >30% or flagged | Implemented |
| GET | `/api/sales-tools/buyers/:id` | Get single buyer profile with purchase history | Implemented |
| POST | `/api/sales-tools/buyers` | Create or update a buyer profile | Implemented |
| PUT | `/api/sales-tools/buyers/:id` | Update buyer profile | Implemented |
| POST | `/api/sales-tools/buyers/:id/block` | Toggle block status on a buyer | Implemented |
| POST | `/api/sales-tools/buyers/sync` | Auto-generate buyer profiles from existing orders/sales | Implemented |

#### `/src/backend/routes/orders.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/orders` | List orders with filters (status, platform, search), pagination, and stats | Implemented |
| GET | `/api/orders/:id` | Get single order | Implemented |
| POST | `/api/orders` | Create new order | Implemented |
| PUT | `/api/orders/:id` | Update order (status state-machine, tracking, etc.) | Implemented |
| DELETE | `/api/orders/:id` | Delete order | Implemented |
| POST | `/api/orders/:id/ship` | Mark order as shipped | Implemented |
| POST | `/api/orders/:id/deliver` | Mark order as delivered | Implemented |
| POST | `/api/orders/:id/return` | Initiate a return | Implemented |
| PATCH | `/api/orders/:id/return` | Update return status | Implemented |
| PATCH | `/api/orders/:id/priority` | Update order priority | Implemented |
| POST | `/api/orders/:id/split` | Split order into 2–10 shipments | Implemented |
| GET | `/api/orders/:id/shipments` | Get child shipments for a split order | Implemented |
| POST | `/api/orders/sync-all` | Queue order sync for all connected platforms | Implemented |
| POST | `/api/orders/sync/:platform` | Sync orders from a specific platform (eBay implemented) | Implemented |

#### `/src/backend/routes/expenseTracker.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/expense-tracker/categories` | List expense categories | Implemented |
| GET | `/api/expense-tracker/tax-report` | Generate tax report | Implemented |
| POST | `/api/expense-tracker/categories` | Create expense category | Implemented |
| POST | `/api/expense-tracker/categorize` | Auto-categorize an expense | Implemented |

#### `/src/backend/routes/receiptParser.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/receipt-parser` | Get receipt queue | Implemented |
| GET | `/api/receipt-parser/vendors` | List vendors | Implemented |
| GET | `/api/receipt-parser/:id` | Get single receipt | Implemented |
| POST | `/api/receipt-parser/upload` | Upload receipt image/PDF for parsing | Implemented |
| POST | `/api/receipt-parser/vendors` | Create vendor | Implemented |
| POST | `/api/receipt-parser/:id/process` | Process (parse) a queued receipt | Implemented |
| POST | `/api/receipt-parser/:id/ignore` | Mark receipt as ignored | Implemented |
| POST | `/api/receipt-parser/:id/reparse` | Re-parse a receipt | Implemented |
| PUT | `/api/receipt-parser/:id` | Update receipt data | Implemented |
| PUT | `/api/receipt-parser/vendors/:id` | Update vendor | Implemented |
| DELETE | `/api/receipt-parser/:id` | Delete receipt | Implemented |
| DELETE | `/api/receipt-parser/vendors/:id` | Delete vendor | Implemented |

### Frontend Pages

| Page | Key UI Elements |
|------|----------------|
| `sales()` | Sales table (date, platform, item, buyer, price, fees, profit, status); search; platform/status/period filters; export CSV/Excel |
| `financials()` | 5 tabs: Overview (P&L summary), Transactions (purchases + sales ledger), Accounts (chart of accounts), Statements (balance sheet, income statement), Goals (financial goals tracker); add purchase/account forms; bank CSV import; categorization rules; recurring templates; transaction split; receipt upload; audit log; reconciliation modal |
| `orders()` | Orders table (order #, platform, buyer, items, total, status, priority, ship-by); order detail panel (tracking, notes, followup scheduling, return submission, split shipment); map view; customer repeat analysis; platform fee breakdown; generate labels |
| `transactions()` | Combined purchases + sales ledger; tabs (All, Purchases, Sales); advanced filters (platform, status, buyer, date, amount, category); split/auto-categorize/bulk-tag; export CSV/Excel |
| `receiptParser()` | Receipt upload queue; vendor list; upload/process/reparse/ignore actions |
| `shippingLabelsPage()` | See Section 12 |

---

## 6. Analytics & Reporting

Dashboards, charts, custom reports, exports, business metrics, heatmaps, revenue forecasting.

### API Endpoints

#### `/src/backend/routes/analytics.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/analytics/dashboard` | Dashboard overview | Implemented |
| GET | `/api/analytics/sales` | Sales analytics with date range filters | Implemented |
| GET | `/api/analytics/inventory` | Inventory analytics | Implemented |
| GET | `/api/analytics/platforms` | Platform-by-platform analytics | Implemented |
| GET | `/api/analytics/inventory-deep` | Deep inventory analysis: aging, sell-through rate, margins | Implemented |
| GET | `/api/analytics/performance` | Advanced performance metrics (Pro+ tier) | Implemented |
| GET | `/api/analytics/sustainability` | Sustainability impact metrics | Implemented |
| GET | `/api/analytics/trends` | Trend analysis over time | Implemented |
| GET | `/api/analytics/heatmap` | 24x7 engagement heatmap grid | Implemented |
| GET | `/api/analytics/heatmap/listings` | Per-listing engagement breakdown | Implemented |
| GET | `/api/analytics/heatmap/geography` | Geographic sales distribution | Implemented |
| GET | `/api/analytics/custom-metrics` | List user's saved custom metrics | Implemented |
| POST | `/api/analytics/custom-metrics` | Create a custom metric | Implemented |
| DELETE | `/api/analytics/custom-metrics/:id` | Delete a custom metric | Implemented |
| GET | `/api/analytics/digest-settings` | Get digest/report email settings | Implemented |
| POST | `/api/analytics/digest-settings` | Save digest settings | Implemented |
| POST | `/api/analytics/export` | Export analytics data (CSV/JSON) | Implemented |
| GET | `/api/analytics/forecast` | Inventory forecasting | Implemented |
| GET | `/api/analytics/price-suggestions` | Age-based price reduction recommendations | Implemented |
| POST | `/api/analytics/apply-price-suggestions` | Batch apply price suggestion recommendations | Implemented |

#### `/src/backend/routes/reports.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/reports` | List user's saved reports | Implemented |
| GET | `/api/reports/widgets` | Return widget type catalog | Implemented |
| GET | `/api/reports/templates` | Return list of pre-built report configs | Implemented |
| GET | `/api/reports/pnl` | Generate Profit & Loss statement | Implemented |
| POST | `/api/reports/generate` | Generate widget data on demand (no save) | Implemented |
| POST | `/api/reports` | Create a new saved report | Implemented |
| POST | `/api/reports/from-template` | Create a saved report from a template | Implemented |
| POST | `/api/reports/query` | Execute a restricted custom SELECT query (enterprise only) | Implemented |
| GET | `/api/reports/:id` | Get single report with widget data | Implemented |
| PUT | `/api/reports/:id` | Update report | Implemented |
| DELETE | `/api/reports/:id` | Delete report and its schedules | Implemented |
| POST | `/api/reports/:id/run` | Execute a saved report | Implemented |
| GET | `/api/reports/:id/schedule` | Get schedule for a report | Implemented |
| POST | `/api/reports/:id/schedule` | Create or update report schedule | Implemented |
| DELETE | `/api/reports/:id/schedule` | Remove report schedule | Implemented |

#### `/src/backend/routes/searchAnalytics.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/search-analytics/popular` | Get popular search terms | Implemented |
| GET | `/api/search-analytics/no-results` | Get searches with no results | Implemented |
| GET | `/api/search-analytics/dashboard` | Search analytics dashboard | Implemented |
| POST | `/api/search-analytics/track` | Track a search event | Implemented |

### Frontend Pages

| Page | Key UI Elements |
|------|----------------|
| `analytics()` | 8 tabs: Graphs (line/bar/pie), Sales (filterable table), Financials (P&L chart, expense breakdown), Inventory (turn rate, age analysis), Purchases, Performance (KPI cards), Reports (saved reports list), Predictions; period selector; compare period toggle; export CSV |
| `dashboard()` | 24 named widgets via `widgetManager`; 4 today-stat cards; 9 quick-action buttons; stale data banner; period selector (7d/30d/90d/custom); customizable widget layout |
| `reports()` | Saved reports list; create/edit/delete/run report; P&L modal; custom query modal; template picker |
| `reportBuilder()` | Report name/description; widget type/size selector; add/remove widget; save; run preview |
| `heatmaps()` | Heatmap data visualization (sales by day/hour grid); platform selector; date range picker |
| `adminBusinessMetrics()` | 5 metric categories (Acquisition, Activation, Conversion, Retention, Abuse); summary scorecard; per-metric table with targets and trend indicators |

### Key Analytics Handlers

`changeAnalyticsPeriod`, `loadCustomAnalytics`, `filterAnalyticsSales`, `exportAnalyticsCSV`, `switchAnalyticsTab`, `toggleAnalyticsCompare`, `switchChartType`, `customizeDashboard`, `refreshDashboard`, `showSalesVelocity`, `showCustomMetricBuilder`, `showAnalyticsDigestSettings`, `viewReport`, `saveReport`, `runReport`, `createReportFromTemplate`, `generatePnL`, `loadHeatmapData`

### Dashboard Widgets (24 total)

`revenue_chart`, `sales_velocity`, `inventory_summary`, `recent_sales`, `pending_orders`, `active_listings`, `top_performers`, `platform_breakdown`, `profit_margin`, `expenses_summary`, `low_stock_alerts`, `upcoming_renewals`, `automation_status`, `shipping_queue`, `offers_pending`, `draft_items`, `goals_tracker`, `activity_feed`, `price_drops_due`, `listings_health`, `stale_listings_count`, `storage_usage`, `calendar_preview`, `checklist_summary`

---

## 7. Offer & Negotiation Management

Offer inbox, counter offers, auto-accept/decline rules, bulk actions.

### API Endpoints

#### `/src/backend/routes/offers.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/offers` | List all offers | Implemented |
| GET | `/api/offers/rules` | List offer automation rules | Implemented |
| GET | `/api/offers/stats` | Get offer statistics | Implemented |
| POST | `/api/offers/rules` | Create offer rule | Implemented |
| PUT | `/api/offers/rules/:id` | Update offer rule | Implemented |
| DELETE | `/api/offers/rules/:id` | Delete offer rule | Implemented |
| POST | `/api/offers/:id/accept` | Accept an offer | Implemented |
| POST | `/api/offers/:id/decline` | Decline an offer | Implemented |
| POST | `/api/offers/:id/counter` | Counter an offer | Implemented |
| POST | `/api/offers/seed` | Seed demo offer data | Implemented |

### Related Bot Actions

Poshmark bot: `getOffers()`, `acceptOffer()`, `counterOffer()`, `declineOffer()`, `sendOfferToLikers()`, `sendOffersToAllListings()`

### Frontend Page

| Page | Key UI Elements |
|------|----------------|
| `offersContent()` / `offers()` | Offers table (platform, item, buyer, offer amount, listing price, status, date); Accept/Decline/Counter buttons per row; bulk Accept/Decline; counter offer modal (amount input + validation); confirm decline modal; platform type filter tabs |

### Key Handlers

`acceptOffer`, `declineOffer`, `confirmDeclineOffer`, `counterOffer`, `confirmCounterOffer`, `bulkAcceptOffers`, `bulkDeclineOffers`, `loadOffers`

### Automation Presets for Offers

`send_offers` (auto-send to likers), `auto_accept` (above 80% of list price), `decline_lowball` (below threshold), `counter_offers` (minimum price counter)

---

## 8. Image Management

Upload, HTML5 canvas editor, background removal, image bank with folders/tags, R2/Cloudinary storage, batch processing, watermarking.

### API Endpoints

#### `/src/backend/routes/imageBank.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/image-bank` | List images with filters and pagination | Implemented |
| GET | `/api/image-bank/search` | Full-text search images | Implemented |
| GET | `/api/image-bank/storage-stats` | Real storage usage statistics | Implemented |
| GET | `/api/image-bank/cloudinary-status` | Check if Cloudinary is configured | Implemented |
| GET | `/api/image-bank/folders` | List folders (tree structure) | Implemented |
| GET | `/api/image-bank/:id` | Get single image details | Implemented |
| GET | `/api/image-bank/usage/:imageId` | Get inventory items using an image | Implemented |
| GET | `/api/image-bank/edit-history/:id` | Get edit history for an image | Implemented |
| POST | `/api/image-bank/upload` | Upload new images | Implemented |
| POST | `/api/image-bank/bulk-delete` | Delete multiple images | Implemented |
| POST | `/api/image-bank/bulk-move` | Move images to a folder | Implemented |
| POST | `/api/image-bank/bulk-tag` | Add tags to multiple images | Implemented |
| POST | `/api/image-bank/analyze` | AI-analyze image with Claude Vision | Implemented |
| POST | `/api/image-bank/folders` | Create folder | Implemented |
| POST | `/api/image-bank/import-from-inventory` | Import existing inventory images into bank | Implemented |
| POST | `/api/image-bank/edit` | Apply canvas edits to an image | Implemented |
| POST | `/api/image-bank/cloudinary-edit` | Advanced edits via Cloudinary transformations | Implemented |
| POST | `/api/image-bank/scan-usage` | Scan inventory for image references | Implemented |
| PATCH | `/api/image-bank/:id` | Update image metadata | Implemented |
| PATCH | `/api/image-bank/folders/:id` | Update folder | Implemented |
| DELETE | `/api/image-bank/:id` | Delete image | Implemented |
| DELETE | `/api/image-bank/folders/:id` | Delete folder | Implemented |

#### `/src/backend/routes/watermark.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/watermark/presets` | List user's watermark presets | Implemented |
| POST | `/api/watermark/presets` | Create watermark preset | Implemented |
| PUT | `/api/watermark/presets/:id` | Update preset | Implemented |
| DELETE | `/api/watermark/presets/:id` | Delete preset | Implemented |
| POST | `/api/watermark/presets/:id/set-default` | Set as default watermark | Implemented |
| POST | `/api/watermark/apply-batch` | Apply watermark to a batch of images | Implemented |

#### `/src/backend/routes/batchPhoto.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/batch-photo/jobs` | List user's batch photo jobs | Implemented |
| GET | `/api/batch-photo/jobs/:id` | Get job details with items | Implemented |
| POST | `/api/batch-photo/jobs` | Create new batch job | Implemented |
| POST | `/api/batch-photo/jobs/:id/start` | Start processing a job | Implemented |
| POST | `/api/batch-photo/jobs/:id/cancel` | Cancel a running job | Implemented |
| DELETE | `/api/batch-photo/jobs/:id` | Delete a job | Implemented |
| GET | `/api/batch-photo/presets` | List saved photo editing presets | Implemented |
| POST | `/api/batch-photo/presets` | Create preset | Implemented |
| PUT | `/api/batch-photo/presets/:id` | Update preset | Implemented |
| DELETE | `/api/batch-photo/presets/:id` | Delete preset | Implemented |
| POST | `/api/batch-photo/presets/:id/set-default` | Set default preset | Implemented |

### Service Functions

| Service | Key Functions |
|---------|---------------|
| `imageStorage.js` | `saveImage()`, `generateThumbnail()`, `deleteImage()`, `importFromInventory()`, `generateOptimizedVariants()`, `validateImage()` |
| `cloudinaryService.js` | `uploadToCloudinary()`, `removeBackground()`, `autoEnhance()`, `smartCrop()`, `aiUpscale()`, `generateResponsiveUrls()` |

### Frontend Pages & Components

| Page/Component | Key UI Elements |
|------|----------------|
| `imageBank()` | Image grid/list/compact views; folder tree; select all; bulk move/delete/tag; AI tagging modal; image upload; storage stats; storage upgrade prompt |
| `batchPhotoEditModal()` | Crop dimensions; brightness/contrast/saturation sliders; filter selector; rotate/flip; preset load/save; batch job progress polling; cancel/delete job |
| `PhotoEditor` component | HTML5 Canvas editor; brightness/contrast/saturation controls; named filter presets (vivid, warm, cool, B&W, etc.); rotate; flip; reset |

### Key Handlers

`handleImageBankUpload`, `selectAllImages`, `bulkMoveImages`, `bulkDeleteImages`, `showAITagging`, `runAITagging`, `addImageTag`, `setBatchPhotoCropDimensions`, `saveBatchPhotoPreset`, `startBatchPhotoJob`, `pollBatchPhotoProgress`, `switchImageUploadTab`, `loadImageBankInline`, `toggleImageBankSelection`, `scanImageUsage`

---

## 9. User & Account Management

Auth, MFA (TOTP + backup codes + WebAuthn), OAuth (Google, Apple), profile, settings, API keys, session management, GDPR.

### API Endpoints

#### `/src/backend/routes/auth.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/auth/register` | Create new user account | Implemented |
| POST | `/api/auth/login` | Login, returns access + refresh tokens | Implemented |
| POST | `/api/auth/demo-login` | Dev/staging demo login | Implemented |
| POST | `/api/auth/mfa-verify` | Verify TOTP/backup code during MFA challenge | Implemented |
| POST | `/api/auth/refresh` | Exchange refresh token for new access token | Implemented |
| POST | `/api/auth/logout` | Revoke session/refresh token | Implemented |
| GET | `/api/auth/me` | Get current authenticated user profile | Implemented |
| GET | `/api/auth/oauth-session` | Exchange OTT for SPA JWT tokens after OAuth | Implemented |
| GET | `/api/auth/session-status` | Return session inactivity and MFA expiry metadata | Implemented |
| PUT | `/api/auth/profile` | Update user profile fields | Implemented |
| PUT | `/api/auth/password` | Change password (requires current password) | Implemented |
| GET | `/api/auth/sessions` | List all active sessions for current user | Implemented |
| DELETE | `/api/auth/sessions/:id` | Revoke a specific session | Implemented |
| POST | `/api/auth/sessions/revoke-all` | Revoke all sessions except current | Implemented |
| POST | `/api/auth/password-reset` | Request password reset email | Implemented |
| POST | `/api/auth/password-reset/confirm` | Consume reset token and set new password | Implemented |
| GET | `/api/auth/verify-email` | Verify email address with token | Implemented |
| POST | `/api/auth/resend-verification` | Resend email verification link | Implemented |

#### `/src/backend/routes/security.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/security/send-verification` | Send email verification email | Implemented |
| POST | `/api/security/verify-email` | Verify email address with token | Implemented |
| POST | `/api/security/forgot-password` | Request password reset | Implemented |
| POST | `/api/security/reset-password` | Reset password with token | Implemented |
| POST | `/api/security/mfa/setup` | Initialize MFA setup (returns QR code + secret) | Implemented |
| POST | `/api/security/mfa/verify-setup` | Verify TOTP code and enable MFA | Implemented |
| POST | `/api/security/mfa/disable` | Disable MFA (requires password) | Implemented |
| POST | `/api/security/mfa/regenerate-codes` | Regenerate MFA backup codes | Implemented |
| GET | `/api/security/mfa/status` | Get MFA enabled/disabled status | Implemented |
| GET | `/api/security/events` | Get security event log | Implemented |
| GET | `/api/security/activity` | Recent account activity from audit log | Implemented |

#### `/src/backend/routes/gdpr.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/gdpr/export` | Request GDPR data export | Implemented |
| GET | `/api/gdpr/export/:requestId/download` | Download a completed data export | Implemented |
| GET | `/api/gdpr/export/status` | List all of user's data export requests | Implemented |
| POST | `/api/gdpr/delete-account` | Request account deletion | Implemented |
| POST | `/api/gdpr/cancel-deletion` | Cancel pending account deletion request | Implemented |
| GET | `/api/gdpr/deletion-status` | Check account deletion status | Implemented |
| GET | `/api/gdpr/consents` | Get user's consent records | Implemented |
| PUT | `/api/gdpr/consents` | Update consent choices | Implemented |
| PUT | `/api/gdpr/rectify` | Request data correction | Implemented |

#### `/src/backend/routes/account.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/account/data-export` | Initiate async data export job | Implemented |
| GET | `/api/account/data-export/status` | Check export job progress | Implemented |
| GET | `/api/account/data-export/download` | Download completed export | Implemented |

#### `/src/backend/routes/socialAuth.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/social-auth/providers` | List available social auth providers | Implemented |
| GET | `/api/social-auth/google` | Start Google social login OAuth | Implemented |
| GET | `/api/social-auth/google/callback` | Handle Google social login callback | Implemented |
| GET | `/api/social-auth/apple` | Start Apple social login OAuth | Implemented |
| POST | `/api/social-auth/apple/callback` | Handle Apple social login callback | Implemented |
| DELETE | `/api/social-auth/:provider` | Unlink a social auth provider | Implemented |

#### `/src/backend/routes/emailOAuth.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/email-oauth/providers` | List available email OAuth providers | Implemented |
| GET | `/api/email-oauth/accounts` | List connected email accounts | Implemented |
| GET | `/api/email-oauth/authorize/gmail` | Start Gmail OAuth authorization | Implemented |
| GET | `/api/email-oauth/callback/gmail` | Handle Gmail OAuth callback | Implemented |
| GET | `/api/email-oauth/authorize/outlook` | Start Outlook OAuth authorization | Implemented |
| GET | `/api/email-oauth/callback/outlook` | Handle Outlook OAuth callback | Implemented |
| PUT | `/api/email-oauth/accounts/:id` | Update email account settings | Implemented |
| DELETE | `/api/email-oauth/accounts/:id` | Disconnect email account | Implemented |
| POST | `/api/email-oauth/accounts/:id/sync` | Sync emails from connected account | Implemented |

#### `/src/backend/routes/teams.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/teams` | List user's teams | Implemented |
| GET | `/api/teams/permissions` | Get all permission definitions | Implemented |
| GET | `/api/teams/:id` | Get team details | Implemented |
| GET | `/api/teams/:id/activity` | Get team activity log | Implemented |
| POST | `/api/teams` | Create new team | Implemented |
| POST | `/api/teams/join` | Join a team via invite token | Implemented |
| POST | `/api/teams/:id/invite` | Invite member to team | Implemented |
| POST | `/api/teams/:id/leave` | Leave a team | Implemented |
| PATCH | `/api/teams/:id` | Update team details | Implemented |
| PATCH | `/api/teams/:id/members/:memberId` | Update member role/permissions | Implemented |
| DELETE | `/api/teams/:id` | Delete team | Implemented |
| DELETE | `/api/teams/:id/members/:memberId` | Remove member from team | Implemented |

### Service Functions

| Service | Key Functions |
|---------|---------------|
| `mfa.js` | `setupMFA()`, `enableMFA()`, `verifyMFA()`, `disableMFA()`, `generateBackupCodes()`, `verifyBackupCode()`, `regenerateBackupCodes()` |
| `enhancedMFA.js` | `enhancedMFA` — WebAuthn/passkey support |
| `googleOAuth.js` | `buildGoogleAuthUrl()`, `exchangeGoogleCode()`, `getAccessToken()`, `revokeGoogleToken()` |
| `gmailService.js` | `fetchRecentEmails()`, `getEmailContent()`, `getAttachment()` |
| `outlookService.js` | `fetchRecentEmails()`, `getEmailContent()` |

### Middleware

| Middleware | Key Behavior |
|-----------|--------------|
| `auth.js` | JWT HS256 with dual-key rotation; 15-min access / 7-day refresh; tier embedding; `checkTierPermission()` |
| `csrf.js` | PostgreSQL-backed CSRF tokens; single-use; 4hr expiry; `CSRFManager` singleton |

### Frontend Pages

| Page | Key UI Elements |
|------|----------------|
| `login()` | Email/password inputs; remember me; Google/Apple OAuth buttons; MFA challenge detection; rate-limit countdown |
| `register()` | Full name/username/email/password (5-requirement strength meter); confirm password; T&C; Google/Apple OAuth |
| `forgotPassword()` / `resetPassword()` | Reset request and confirm forms with strength meter |
| `verifyEmail()` / `emailVerification()` | Pending verification state; resend button |
| `account()` | Avatar upload; password change; 2FA setup (TOTP QR code flow, SMS); session list with revoke; export/import user data; delete account; keyboard shortcuts |
| `settings()` | Tab navigation (Appearance, Account, Notifications, Integrations, Automations, Data, Privacy, Billing, Advanced); settings search; save/cancel/reset |
| `teams()` | Teams list; create/delete team; member list; update member role; invite member |
| `connections()` | Integrations list; connect/disconnect; check status; dark mode toggle |

### Auth Core Module (`src/frontend/core/auth.js`)

`auth.login()`, `auth.logout()`, `auth.register()`, `auth.handleOAuthCallback()`, `voiceCommands.init()` (Web Speech API — "go to [page]", "add item", "search")

---

## 10. Plans & Billing

Subscription tiers, billing period pricing, Stripe Checkout/Portal, usage limits, affiliate program.

### API Endpoints

#### `/src/backend/routes/billing.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/billing/plans` | Return all plans with features and limits | Implemented |
| GET | `/api/billing/usage` | Get current usage metrics vs plan limits | Implemented |
| GET | `/api/billing/usage/history` | Usage history over past 6 months by metric | Implemented |
| POST | `/api/billing/usage/refresh` | Recalculate usage from actual database counts | Implemented |
| POST | `/api/billing/prorate` | Calculate proration amount for plan change | Implemented |
| POST | `/api/billing/change-plan` | Change user subscription plan | Implemented |
| POST | `/api/billing/select-plan` | Select a plan (alias for change-plan) | Implemented |
| POST | `/api/billing/checkout` | Create Stripe Checkout session for paid plan | Implemented |
| POST | `/api/billing/portal` | Create Stripe Customer Portal session | Implemented |
| POST | `/api/billing/cancel` | Cancel active Stripe subscription | Implemented |
| GET | `/api/billing/subscription` | Get current Stripe subscription details | Implemented |

#### `/src/backend/routes/affiliate.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/affiliate/landing-pages` | List affiliate landing pages | Implemented |
| GET | `/api/affiliate/tiers` | List affiliate tiers | Implemented |
| GET | `/api/affiliate/my-tier` | Get current user's affiliate tier | Implemented |
| GET | `/api/affiliate/earnings` | Get affiliate earnings | Implemented |
| GET | `/api/affiliate/commissions` | Get commission records | Implemented |
| GET | `/api/affiliate/stats` | Get affiliate statistics | Implemented |
| POST | `/api/affiliate/apply` | Apply to affiliate program | Implemented |
| POST | `/api/affiliate/landing-pages` | Create landing page | Implemented |
| PUT | `/api/affiliate/landing-pages/:id` | Update landing page | Implemented |
| DELETE | `/api/affiliate/landing-pages/:id` | Delete landing page | Implemented |

### Service Functions

| Service | Key Functions |
|---------|---------------|
| `stripeService.js` | `createCustomer()`, `createCheckoutSession()`, `createPortalSession()`, `cancelSubscription()`, `getSubscription()`, `constructWebhookEvent()`, `STRIPE_PRICE_IDS` |

### Plans & Pricing

| Tier | Monthly | Quarterly (−10%) | Yearly (−20%) |
|------|---------|-----------------|---------------|
| Starter | C$9 | C$8.10/mo | C$7.20/mo |
| Pro | C$19 | C$17.10/mo | C$15.20/mo |
| Business | C$49 | C$44.10/mo | C$39.20/mo |

`getPrice(tier)` reads `store.state.billingPeriod` dynamically.

### Frontend Pages

| Page | Key UI Elements |
|------|----------------|
| `plansBilling()` / `plansBillingBody()` | Current plan display; plan comparison modal; upgrade/select plan button; usage dashboard; copy API key; affiliate dashboard; A/B experiments |
| `affiliate()` / `affiliateBody()` | Referral link; copy link; commission stats; apply as affiliate; landing pages CRUD |

---

## 11. Notifications & Communication

In-app notifications, browser push (VAPID), email (Resend), WebSocket real-time, notification preferences, outgoing webhooks.

### API Endpoints

#### `/src/backend/routes/notifications.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/notifications` | Get all notifications (paginated) | Implemented |
| GET | `/api/notifications/unread` | Get only unread notifications | Implemented |
| GET | `/api/notifications/count` | Get unread notification count | Implemented |
| PUT | `/api/notifications/:id/read` | Mark a single notification as read | Implemented |
| PUT | `/api/notifications/read-all` | Mark all notifications as read | Implemented |
| DELETE | `/api/notifications/:id` | Delete a notification | Implemented |

#### `/src/backend/routes/pushNotifications.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/push-notifications/devices` | List registered devices | Implemented |
| GET | `/api/push-notifications/preferences` | Get notification preferences | Implemented |
| POST | `/api/push-notifications/register-device` | Register a device for push notifications | Implemented |
| POST | `/api/push-notifications/unregister-device` | Unregister a device | Implemented |
| POST | `/api/push-notifications/send` | Send push notification to device(s) | Implemented |
| POST | `/api/push-notifications/send-batch` | Send push notification to batch of devices | Implemented |
| PUT | `/api/push-notifications/preferences` | Update notification preferences | Implemented |
| DELETE | `/api/push-notifications/devices/:id` | Delete a registered device | Implemented |

#### `/src/backend/routes/pushSubscriptions.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/push-subscriptions/vapid-public-key` | Get VAPID public key for browser push | Implemented |
| GET | `/api/push-subscriptions/status` | Get subscription status | Implemented |
| GET | `/api/push-subscriptions/settings` | Get push subscription settings | Implemented |
| POST | `/api/push-subscriptions/subscribe` | Subscribe browser to push notifications | Implemented |
| POST | `/api/push-subscriptions/test` | Send test push notification | Implemented |
| POST | `/api/push-subscriptions/send` | Send push notification via Web Push | Implemented |
| PUT | `/api/push-subscriptions/settings` | Update push subscription settings | Implemented |
| DELETE | `/api/push-subscriptions/subscribe` | Unsubscribe from push notifications | Implemented |
| DELETE | `/api/push-subscriptions/:id` | Delete a specific subscription | Implemented |

#### `/src/backend/routes/webhooks.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/webhooks/stripe` | Handle Stripe billing webhook events | Implemented |
| GET | `/webhooks/ebay/account-deletion` | eBay account deletion challenge verification | Implemented |
| POST | `/webhooks/ebay/account-deletion` | Receive eBay account deletion notification | Implemented |
| POST | `/webhooks/incoming/:source` | Generic incoming webhook from external sources | Implemented |
| POST | `/webhooks/depop` | Handle Depop v1:order.new events | Implemented |
| GET | `/webhooks/endpoints` | List user's outgoing webhook endpoints | Implemented |
| POST | `/webhooks/endpoints` | Create outgoing webhook endpoint | Implemented |
| GET | `/webhooks/endpoints/:id` | Get endpoint details | Implemented |
| PUT | `/webhooks/endpoints/:id` | Update endpoint | Implemented |
| DELETE | `/webhooks/endpoints/:id` | Delete endpoint | Implemented |
| POST | `/webhooks/endpoints/:id/test` | Send test webhook to endpoint | Implemented |
| GET | `/webhooks/events` | List recent webhook events | Implemented |
| GET | `/webhooks/events/:id` | Get event details | Implemented |
| POST | `/webhooks/events/:id/retry` | Retry processing a webhook event | Implemented |
| GET | `/webhooks/event-types` | List all supported webhook event types | Implemented |

### Service Functions

| Service | Key Functions |
|---------|---------------|
| `notificationService.js` | `createNotification()`, `getUnreadNotifications()`, `markAsRead()`, `markAllAsRead()`, `cleanupOldNotifications()`, `createOAuthNotification()`, `NotificationTypes` |
| `email.js` | `sendEmail()`, `sendVerificationEmail()`, `sendPasswordResetEmail()`, `sendSecurityAlertEmail()`, `sendAutomationNotificationEmail()`, `sendDailySummaryEmail()` |
| `websocket.js` | `websocketService` singleton (connections, rooms, broadcasts); `MESSAGE_TYPES` |
| `webhookProcessor.js` | `processWebhookEvent()`, `dispatchToUserEndpoints()`, `verifySignature()` |
| `outgoingWebhooks.js` | `outgoingWebhooks` (delivery queue, retries, HMAC signing) |

### Frontend Pages

| Page | Key UI Elements |
|------|----------------|
| `notifications()` | Notification list; mark all read; filter (all/unread/important); search; toggle read/important; view (navigate to source); delete |
| `webhooks()` | Webhook endpoints table; add/delete/toggle/test endpoint; retry webhook event; events log |
| `pushNotifications()` | Subscribe/unsubscribe push; test push; update settings; subscriptions list |

### `ChatWidget` Component

Floating chat widget with SSE streaming; quick actions (navigate to route); thumbs-up/down rating; persists conversation ID in localStorage.

---

## 12. Shipping

Shipping calculators, label generation, carrier rate shopping, EasyPost integration, shipping profiles, saved addresses, batch labels, size charts.

### API Endpoints

#### `/src/backend/routes/shippingLabels.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/shipping-labels` | List shipping labels | Implemented |
| GET | `/api/shipping-labels/addresses` | List saved addresses | Implemented |
| GET | `/api/shipping-labels/batches` | List label batches | Implemented |
| GET | `/api/shipping-labels/stats` | Get shipping statistics | Implemented |
| GET | `/api/shipping-labels/download-batch` | Download a batch of labels | Implemented |
| GET | `/api/shipping-labels/:id` | Get single label | Implemented |
| GET | `/api/shipping-labels/easypost/track/:trackingCode` | Track shipment via EasyPost | Implemented |
| POST | `/api/shipping-labels` | Create shipping label | Implemented |
| POST | `/api/shipping-labels/addresses` | Create saved address | Implemented |
| POST | `/api/shipping-labels/batches` | Create label batch | Implemented |
| POST | `/api/shipping-labels/batches/:id/process` | Process batch (generate all labels) | Implemented |
| POST | `/api/shipping-labels/rates` | Get shipping rates for a package | Implemented |
| POST | `/api/shipping-labels/print-batch` | Print a batch of labels | Implemented |
| POST | `/api/shipping-labels/generate-pdf` | Generate PDF from label data | Implemented |
| POST | `/api/shipping-labels/easypost/rates` | Get rates via EasyPost API | Stub (API key pending) |
| POST | `/api/shipping-labels/easypost/buy` | Buy a label via EasyPost | Stub (API key pending) |
| PATCH | `/api/shipping-labels/:id` | Update a label | Implemented |
| PATCH | `/api/shipping-labels/addresses/:id` | Update a saved address | Implemented |
| DELETE | `/api/shipping-labels/:id` | Delete a label | Implemented |
| DELETE | `/api/shipping-labels/addresses/:id` | Delete a saved address | Implemented |

#### `/src/backend/routes/shippingProfiles.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/shipping-profiles` | List all shipping profiles | Implemented |
| GET | `/api/shipping-profiles/:id` | Get single profile | Implemented |
| POST | `/api/shipping-profiles` | Create profile | Implemented |
| PUT | `/api/shipping-profiles/:id` | Update profile | Implemented |
| PUT | `/api/shipping-profiles/:id/set-default` | Set profile as default | Implemented |
| DELETE | `/api/shipping-profiles/:id` | Delete profile | Implemented |

#### `/src/backend/routes/sizeCharts.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/size-charts` | List all size charts | Implemented |
| GET | `/api/size-charts/convert` | Convert size between systems | Implemented |
| GET | `/api/size-charts/brands` | List all brands with size charts | Implemented |
| GET | `/api/size-charts/availability` | Get available chart types | Implemented |
| GET | `/api/size-charts/brands/:brand` | Get all size charts for a brand | Implemented |
| GET | `/api/size-charts/brands/:brand/:type` | Get specific chart for a brand and type | Implemented |
| GET | `/api/size-charts/:id` | Get single size chart | Implemented |
| GET | `/api/size-charts/:id/linked-listings` | Get listings linked to a size chart | Implemented |
| POST | `/api/size-charts` | Create size chart | Implemented |
| POST | `/api/size-charts/recommend` | AI-recommend size for item | Implemented |
| POST | `/api/size-charts/:id/link-listings` | Link listings to a size chart | Implemented |
| PUT | `/api/size-charts/:id` | Update size chart | Implemented |
| DELETE | `/api/size-charts/:id` | Delete size chart | Implemented |

### Frontend Pages

| Page | Key UI Elements |
|------|----------------|
| `shippingLabelsPage()` | Labels table (carrier, tracking, status); create label modal (carrier, service, weight, dimensions, from/to address); rate shopping modal (multi-carrier compare); address book; batch print/download (thermal 4x6 or standard); create/process label batch |
| `shippingProfiles()` | Profiles table (name, carrier, service, dimensions, default flag); add/edit/delete; set default; service type options updater |
| `sizeCharts()` | Size chart tabs by category; copy size info/chart; measurement tool; size comparison; size converter; generate QR code; size recommendation calculator; brand guides; fit predictor; custom measurement fields; print |

**Note:** EasyPost `rates` and `buy` endpoints are stubs — the account is under anti-fraud review. The code is built; API keys are not yet activated.

---

## 13. Security & Infrastructure

JWT/session management, CSRF, rate limiting, CSP, encryption, audit logs, admin monitoring, Prometheus metrics.

### API Endpoints

#### `/src/backend/routes/monitoring.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/monitoring/health` | System health check | Implemented |
| GET | `/api/monitoring/metrics` | Application performance metrics | Implemented |
| GET | `/api/monitoring/metrics/prometheus` | Prometheus-format metrics scrape endpoint | Implemented |
| GET | `/api/monitoring/metrics/queries` | Slow query log | Implemented |
| GET | `/api/monitoring/security/events` | Security event log | Implemented |
| GET | `/api/monitoring/alerts` | List active alerts | Implemented |
| GET | `/api/monitoring/errors` | Application error log | Implemented |
| GET | `/api/monitoring/rum/summary` | Real User Monitoring summary | Implemented |
| GET | `/api/monitoring/poshmark` | Poshmark bot/API health status | Implemented |
| GET | `/api/monitoring/business-metrics` | Business KPI metrics | Implemented |
| POST | `/api/monitoring/alerts/:id/acknowledge` | Acknowledge an alert | Implemented |
| POST | `/api/monitoring/rum` | Submit RUM telemetry data | Implemented |
| POST | `/api/monitoring/poshmark/check` | Trigger Poshmark connectivity check | Implemented |

#### `/src/backend/routes/rateLimitDashboard.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/rate-limit/stats` | Get rate limit statistics | Implemented |
| GET | `/api/rate-limit/blocked-ips` | List blocked IPs | Implemented |
| GET | `/api/rate-limit/blocked-users` | List blocked users | Implemented |
| GET | `/api/rate-limit/history` | Rate limit event history | Implemented |
| GET | `/api/rate-limit/alerts` | Get rate limit alerts | Implemented |
| POST | `/api/rate-limit/unblock` | Unblock an IP or user | Implemented |
| POST | `/api/rate-limit/reset` | Reset rate limit counters | Implemented |

#### `/src/backend/routes/settings.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/settings/announcement` | Public: fetch active announcement banner | Implemented |
| PUT | `/api/settings/announcement` | Admin only: set or clear the announcement banner | Implemented |

### Middleware

| Middleware | Key Behavior | Status |
|-----------|--------------|--------|
| `rateLimiter.js` | Redis-backed sliding window; 5 limit types (default 100/min, auth 10/15min, mutation 30/min, expensive 10/min, api 60/min); 3-violations → 1hr IP/user block | Implemented |
| `securityHeaders.js` | CSP (with nonce + strict-dynamic), HSTS (1yr + preload), X-Frame-Options DENY, CORS, Permissions-Policy, COEP/COOP/CORP | Implemented |
| `csrf.js` | PostgreSQL-backed single-use tokens; 4hr expiry; session-bound; 10min cleanup interval | Implemented |
| `auth.js` | JWT HS256; dual-key rotation; algorithm pinning; tier-embedded | Implemented |
| `validate.js` | Zod schema validation; field-level error messages; 422/400 responses | Implemented |
| `cache.js` | ETag generation (SHA-256); Cache-Control helpers; `cacheFor()`, `immutable()`, `NO_CACHE` | Implemented |
| `compression.js` | Brotli (preferred) / Gzip; skips <1KB; skips pre-compressed types | Implemented |
| `errorHandler.js` | `AppError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `RateLimitError` classes | Implemented |
| `requestLogger.js` | IP anonymization; sensitive field sanitization; structured audit events; `logAuditEvent()` | Implemented |
| `featureFlags.js` | `FEATURE_*` env var gating; cached after first read | Implemented |
| `cdn.js` | CDN URL generation; immutable headers for hashed assets; stale-while-revalidate | Implemented |

### Prometheus Metrics (`src/backend/services/prometheusMetrics.js`)

`httpRequestsTotal`, `httpRequestDuration`, `logEntriesTotal`, `activeWebsockets`, `dbQueryDuration`, `backgroundJobsTotal`

### Audit Log Service (`src/backend/services/auditLog.js`)

`auditLog` singleton — logs all user/system actions; `CATEGORIES` and `SEVERITY` enums; PostgreSQL-backed.

### Frontend Admin Pages

| Page | Key UI Elements |
|------|----------------|
| `adminMetrics()` | System health grid (CPU, Memory, Uptime, WebSockets); top 15 endpoints table; recent alerts with acknowledge button; recent errors; security events; auto-refresh (30s) |
| `adminFeatureFlags()` | Feature flags table (name, category, rollout %, enabled toggle) |
| `adminBusinessMetrics()` | 5 metric categories with targets and trend indicators |

---

## 14. Offline & PWA

Service worker (v5.6), multi-strategy caching, offline sync queue (IndexedDB), installable PWA, background sync.

### API Endpoints

#### `/src/backend/routes/offlineSync.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/offline-sync/queue` | Get pending offline sync queue | Implemented |
| GET | `/api/offline-sync/status` | Get sync status | Implemented |
| POST | `/api/offline-sync/queue` | Add item to offline sync queue | Implemented |
| POST | `/api/offline-sync/sync` | Process offline sync queue | Implemented |
| POST | `/api/offline-sync/manifest` | Get offline manifest (PWA cache list) | Implemented |
| DELETE | `/api/offline-sync/queue/:id` | Remove item from queue | Implemented |

### Service Worker (`public/sw.js` — v5.6)

**Cache Names:** `vaultlister-static-v5.6`, `vaultlister-runtime-v5.6`, `vaultlister-swr-api`

**Precached URLs:** `/`, `/index.html`, `/css/app.css`, `/js/app.js`, `/js/chunk-inventory.js`, `/offline.html`, `/manifest.json`

**Fetch Strategies:**

| Request Pattern | Strategy |
|----------------|----------|
| POST/PUT/PATCH/DELETE mutations | Background Sync (IndexedDB queue; replay on reconnect) |
| Selected `/api/*` routes | Stale-While-Revalidate |
| Other `/api/*` routes | Network-First (5s timeout) |
| Images | Cache-First + eviction (max 200 entries) |
| Fonts | Cache-First + eviction (max 50 entries) |
| JS/CSS assets | Network-First + cache fallback |
| HTML navigation | Network-First + offline fallback (`/offline.html`) |
| Default | Stale-While-Revalidate |

**Message Handlers:** `SKIP_WAITING`, `CLEAR_USER_CACHE` (clears SWR cache on logout), `SYNC_OFFLINE_QUEUE`

### Frontend Offline Queue (`src/frontend/core/api.js`)

`offlineQueue.add()`, `offlineQueue.sync()`, `offlineQueue.notifyServiceWorker()`, `offlineQueue.prefetchForOffline()`, `offlineQueue.clearCache()`, `offlineQueue.getCacheSize()`, `offlineQueue.getPendingCount()`

---

## 15. Internationalization

Locale detection, translation keys, Intl-based formatters, RTL support defined.

### Supported Locales

| Locale | Language | Status |
|--------|----------|--------|
| `en-US` | English (United States) | Full |
| `en-GB` | English (United Kingdom) | Full |
| `es-ES` | Spanish (Spain) | Partial |
| `es-MX` | Spanish (Mexico) | Partial |
| `fr-FR` | French (France) | Minimal |
| `de-DE` | German | Defined, no translations |
| `it-IT` | Italian | Defined, no translations |
| `pt-BR` | Portuguese (Brazil) | Defined, no translations |
| `pt-PT` | Portuguese (Portugal) | Defined, no translations |
| `ja-JP` | Japanese | Defined, no translations |
| `zh-CN` | Chinese (Simplified) | Defined, no translations |
| `ko-KR` | Korean | Defined, no translations |

### Translation Namespaces

`common.*`, `auth.*`, `nav.*`, `dashboard.*`, `inventory.*`, `listings.*`, `sales.*`, `analytics.*`, `settings.*`, `error.*`, `time.*`

### i18n Module Methods (`src/frontend/i18n/index.js`)

| Method | Description |
|--------|-------------|
| `i18n.init()` | Detect browser locale, load best match, initialize formatters |
| `i18n.t(key, params)` | Translate key with `{{param}}` interpolation |
| `i18n.setLocale(locale)` | Change active locale |
| `i18n.formatCurrency(value, currency)` | Locale-aware currency formatting |
| `i18n.formatDate(date, opts)` | Locale-aware date formatting |
| `i18n.formatRelativeTime(date)` | Locale-aware relative time ("2 days ago") |
| `i18n.getLocaleInfo()` | Returns code, name, dir (RTL support) |

---

## 16. Public/Marketing Pages

Landing page, pricing, legal, API docs, status, public HTML files served statically.

### API Endpoints

#### `/src/backend/routes/contact.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/contact` | Submit contact form | Implemented |

### Public HTML Files (`public/`)

| File | Purpose |
|------|---------|
| `index.html` | App shell (SPA entry, core JS bundles, `<div id="app">`, chat widget container, ARIA live regions) |
| `landing.html` | Marketing landing page: hero (headline, CTA "Start Free Trial"), platform logos, 11 feature highlight rows, automation section, cookie consent banner |
| `pricing.html` | Pricing plans (Free/Starter/Pro cards + feature comparison table + FAQ) |
| `404.html` | 404 Not Found page |
| `50x.html` | Server error fallback |
| `offline.html` | Service worker offline fallback with retry button |
| `api-docs.html` | REST endpoints reference documentation |
| `api-changelog.html` | API breaking changes and version history |
| `quickstart.html` | Developer quickstart guide |
| `rate-limits.html` | API rate limits documentation |
| `changelog.html` | User-facing feature/fix history |
| `contact.html` | Contact form (name, email, subject, message) |
| `er-diagram.html` | Database entity-relationship diagram |
| `schema.html` | Database schema documentation |
| `glossary.html` | Reseller industry terminology glossary |
| `platforms.html` | Supported marketplace integrations |
| `privacy.html` | Privacy policy (static) |
| `terms.html` | Terms of service (static) |
| `status.html` | Live system status page (API/platform health, incident history) |
| `google00d8bfcd604b6ef6.html` | Google Search Console verification |

### In-App Public Pages

| Page | Key UI Elements |
|------|----------------|
| `termsOfService()` | TOS HTML content; accept TOS button; TOS history button |
| `privacyPolicy()` | Privacy policy HTML content |
| `changelog()` | Changelog entries; search; filter by type/version; vote items; RSS; subscribe |
| `roadmap()` | Roadmap items (planned/in-progress/done); filter/search; vote; subscribe |
| `about()` | Company description, team, tech stack |
| `referFriend()` | Referral link; copy link; referral stats |
| `contact.html` | Contact form |

---

## 17. Developer & Admin Tools

Scripts, monitoring, health checks, database management, tasks queue, community, help/support, calendar, QR analytics, Whatnot.

### API Endpoints

#### `/src/backend/routes/tasks.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/tasks` | List tasks with filters | Implemented |
| GET | `/api/tasks/queue` | Get task queue status | Implemented |
| GET | `/api/tasks/:id` | Get task details | Implemented |
| POST | `/api/tasks` | Create new task | Implemented |
| POST | `/api/tasks/bulk` | Create multiple tasks at once | Implemented |
| POST | `/api/tasks/clear` | Clear completed/failed tasks | Implemented |
| POST | `/api/tasks/:id/cancel` | Cancel a task | Implemented |
| POST | `/api/tasks/:id/retry` | Retry a failed task | Implemented |
| DELETE | `/api/tasks/:id` | Delete a task | Implemented |

#### `/src/backend/routes/calendar.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/calendar` | List calendar events with optional date range filter | Implemented |
| GET | `/api/calendar/:year/:month` | Get events for a specific month | Implemented |
| GET | `/api/calendar/events/:id` | Get single event | Implemented |
| POST | `/api/calendar/events` | Create new event | Implemented |
| PUT | `/api/calendar/events/:id` | Update event | Implemented |
| DELETE | `/api/calendar/events/:id` | Delete event | Implemented |
| GET | `/api/calendar/sync-settings` | List user's sync configurations | Implemented |
| POST | `/api/calendar/sync-settings` | Create or update sync config | Implemented |
| DELETE | `/api/calendar/sync-settings/:id` | Remove sync config | Implemented |
| GET | `/api/calendar/google/authorize` | Start Google Calendar OAuth flow | Implemented |
| GET | `/api/calendar/google/status` | Get Google Calendar connection status | Implemented |
| POST | `/api/calendar/google/sync` | Push local events to Google Calendar | Implemented |
| DELETE | `/api/calendar/google/revoke` | Disconnect Google Calendar | Implemented |

#### `/src/backend/routes/community.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/community/posts` | List community posts | Implemented |
| GET | `/api/community/posts/:id` | Get single post | Implemented |
| GET | `/api/community/leaderboard` | Get community leaderboard | Implemented |
| POST | `/api/community/posts` | Create a post | Implemented |
| POST | `/api/community/posts/:id/replies` | Reply to a post | Implemented |
| POST | `/api/community/posts/:id/react` | React to a post (emoji) | Implemented |
| POST | `/api/community/posts/:id/flag` | Flag a post for review | Implemented |
| PATCH | `/api/community/replies/:id` | Edit a reply | Implemented |
| DELETE | `/api/community/posts/:id` | Delete a post | Implemented |

#### `/src/backend/routes/help.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/help/videos` | List help videos | Implemented |
| GET | `/api/help/videos/:id` | Get single help video | Implemented |
| GET | `/api/help/faq` | List FAQ entries | Implemented |
| GET | `/api/help/faq/:id` | Get single FAQ | Implemented |
| GET | `/api/help/articles` | List help articles | Implemented |
| GET | `/api/help/articles/:id` | Get single article | Implemented |
| GET | `/api/help/tickets` | List user's support tickets | Implemented |
| GET | `/api/help/tickets/:id` | Get single ticket | Implemented |
| GET | `/api/help/search` | Search help content | Implemented |
| POST | `/api/help/faq/:id/helpful` | Mark FAQ as helpful/not helpful | Implemented |
| POST | `/api/help/articles/:id/helpful` | Mark article as helpful/not helpful | Implemented |
| POST | `/api/help/videos/:id/view` | Track video view | Implemented |
| POST | `/api/help/tickets` | Create support ticket | Implemented |
| POST | `/api/help/tickets/:id/replies` | Reply to a ticket | Implemented |
| PATCH | `/api/help/tickets/:id` | Update ticket status | Implemented |

#### `/src/backend/routes/qrAnalytics.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/qr-analytics/dashboard` | QR code scan analytics dashboard | Implemented |
| GET | `/api/qr-analytics/warehouse-bins` | List warehouse bins | Implemented |
| GET | `/api/qr-analytics/warehouse-bins/:id/items` | Get items in a warehouse bin | Implemented |
| GET | `/api/qr-analytics/item/:id` | Get QR scan analytics for an item | Implemented |
| POST | `/api/qr-analytics/track` | Track a QR code scan event | Implemented |
| POST | `/api/qr-analytics/warehouse-bins` | Create warehouse bin | Implemented |
| POST | `/api/qr-analytics/warehouse-bins/:id/print-label` | Print warehouse bin label | Implemented |
| PUT | `/api/qr-analytics/warehouse-bins/:id` | Update warehouse bin | Implemented |
| DELETE | `/api/qr-analytics/warehouse-bins/:id` | Delete warehouse bin | Implemented |

#### `/src/backend/routes/whatnot.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/whatnot` | List Whatnot shows | Implemented |
| GET | `/api/whatnot/stats` | Get Whatnot show statistics | Implemented |
| GET | `/api/whatnot/:id` | Get single show | Implemented |
| POST | `/api/whatnot` | Create show | Implemented |
| POST | `/api/whatnot/:id/items` | Add items to a show | Implemented |
| PUT | `/api/whatnot/:id` | Update show | Implemented |
| DELETE | `/api/whatnot/:id` | Delete show | Implemented |
| DELETE | `/api/whatnot/:id/items/:itemId` | Remove item from show | Implemented |

#### `/src/backend/routes/whatnotEnhanced.js`

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/whatnot-enhanced/cohosts` | List Whatnot cohosts | Implemented |
| GET | `/api/whatnot-enhanced/staging` | List staging area items | Implemented |
| GET | `/api/whatnot-enhanced/staging/bundles` | Get staging bundles | Implemented |
| POST | `/api/whatnot-enhanced/cohosts` | Add cohost | Implemented |
| POST | `/api/whatnot-enhanced/staging` | Add item to staging | Implemented |
| POST | `/api/whatnot-enhanced/staging/auto-suggest` | AI-suggest staging items | Implemented |
| PUT | `/api/whatnot-enhanced/cohosts/:id` | Update cohost | Implemented |
| PUT | `/api/whatnot-enhanced/staging/:id` | Update staging item | Implemented |
| DELETE | `/api/whatnot-enhanced/cohosts/:id` | Remove cohost | Implemented |
| DELETE | `/api/whatnot-enhanced/staging/:id` | Remove from staging | Implemented |

#### Other Infrastructure Routes

| Route File | Endpoints | Description |
|-----------|-----------|-------------|
| `extension.js` | 22 endpoints | Chrome extension: scrape, quick-add, price tracking, closet share, offer-to-likers, sync queue |
| `integrations.js` | 6 endpoints | Google Drive OAuth + backup |
| `onboarding.js` | 6 endpoints | Onboarding progress, badges, feature tours |
| `mock-oauth.js` | 4 endpoints | Dev/test mock OAuth for all platforms |
| `feedback.js` | 12 endpoints | User feedback: submit, vote, respond, analytics |
| `roadmap.js` | 6 endpoints | Roadmap items CRUD, voting, RSS |
| `marketIntel.js` | 13 endpoints | Competitor tracking, market insights, opportunities, trending |
| `competitorTracking.js` | 5 endpoints | Keyword tracking, price intelligence |
| `currency.js` | 1 endpoint | `GET /api/currency/rates` — current exchange rates |
| `checklists.js` | 12 endpoints | Checklist CRUD, templates, sharing |
| `legal.js` | 8 endpoints | Privacy data export, cookie consent, ToS acceptance |
| `suppliers.js` | 13 endpoints | Suppliers CRUD with items list |
| `tokenRefreshScheduler.js` | service | Background token refresh; platform health alerts |
| `syncScheduler.js` | service | Background shop sync scheduler |

### Frontend Dev/Admin Pages

| Page | Key UI Elements |
|------|----------------|
| `adminMetrics()` | System health, request metrics, top endpoints, alerts, errors, security events, auto-refresh |
| `adminFeatureFlags()` | Feature flags table with enable/disable toggles |
| `adminBusinessMetrics()` | Business KPI metrics (Acquisition, Activation, Conversion, Retention, Abuse) |
| `community()` | Community tabs (Feed, Groups, Events, Leaderboard); post list with reactions/replies; create post; flag/delete |
| `help()` | FAQ/Articles/Tickets/Live Chat tabs; vote helpful; submit support ticket; view/reply to tickets; open live chat |
| `calendar()` | Month/week/day view; add/edit/delete events; calendar sync settings; Google Calendar integration |
| `checklist()` | List/board/calendar views; tasks/todo-lists/analytics tabs; subtasks; bulk complete; export; templates; keyboard navigation; celebration animation |
| `whatnotLive()` | Whatnot live events list; event detail modal; save/delete events; add/remove items; schedule from calendar |
| `roadmap()` | Roadmap items by status; filter/search/vote; subscribe; detail modal |
| `helpSupport()` | Combined help hub + VaultBuddy AI chat panel (SSE streaming) |

---

## Core Frontend Infrastructure

### `src/frontend/core/` Modules

| Module | Key Exports & Description |
|--------|--------------------------|
| `api.js` | `api` — JWT bearer, CSRF, retry (3x), 401→refresh, request deduplication, offline queue; `loadingState` — button/spinner management; `announce` — ARIA live regions; `offlineQueue` — IndexedDB-backed queue with SW sync |
| `auth.js` | `auth.login()`, `auth.logout()`, `auth.register()`, `auth.handleOAuthCallback()`; `voiceCommands` (Web Speech API — "go to [page]", "add item", "search") |
| `router.js` | 37-route chunk map (7 chunks: inventory, sales, tools, intelligence, settings, community, admin); `pageChunkMap`; dynamic `import()`; cleanup registry; 15 route aliases; `router.navigate()` |
| `store.js` | 60+ state keys; `store.setState()`, `store.subscribe()`, `store.persist()`, `store.hydrate()`, `store.getPlanTier()` |
| `toast.js` | `toast.success/error/warning/info/withUndo()` — auto-dismiss after 4s; stackable; undo callback |
| `utils.js` | 80+ utilities: `escapeHtml`, `sanitizeHTML`, `formatCurrency`, `formatRelativeTime`, `debounce`, `throttle`, `calcFees`, `calcProfit`, `widgetManager`, `modals`, `confetti`, `chartRenderer`, `platformIcons`, `platformColors`, `statusBadge`, `focusTrap`, `isMobile`, `supportsWebXR` |

### `src/frontend/components/`

| Component | Description |
|-----------|-------------|
| `chatWidget.js` | Floating VaultBuddy chat widget; SSE streaming; quick action buttons; thumbs-up/down rating; conversation persistence |
| `photoEditor.js` | HTML5 Canvas photo editor; brightness/contrast/saturation; named filter presets; rotate/flip/reset |

---

*End of VaultLister 3.0 Feature Inventory — 2026-04-15*
