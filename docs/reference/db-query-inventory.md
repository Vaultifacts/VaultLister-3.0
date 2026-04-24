# DB Query Usage Inventory — VaultLister 3.0

> **READ-ONLY REFERENCE.** This document is a static snapshot. Do not move any SQL until a safe extraction plan with tests is in place. See the Do-Not-Touch note at the bottom.

Generated: 2026-04-24  
Search command: `grep -rn "query\.(get|all|run|transaction|exec)" src/backend worker --include="*.js"` (excluding `src/backend/db/database.js`)

---

## 1. Total Query Call Count

**2178 total query calls** across 108 files.

Helper breakdown:
| Helper | Count |
|---|---|
| `query.run` | 876 |
| `query.get` | 863 |
| `query.all` | 410 |
| `query.transaction` | 29 |
| `query.exec` | 0 |

Layer breakdown:
| Layer | Call Count |
|---|---|
| Route | 1748 |
| Service | 284 |
| Worker (`src/backend/workers/` + `worker/`) | 105 |
| Middleware | 14 |
| DB seeds (`src/backend/db/seeds/`) | 25 |
| Server (`server.js`) | 2 |

---

## 2. Query Usage Table

> Grouped by file. Call counts from `uniq -c` on the grep output.

| File | Call Count | Query Helpers Used | Apparent Domain | Layer | Repository Extraction Needed | Notes |
|---|---|---|---|---|---|---|
| `src/backend/routes/listings.js` | 120 | get, all, run, transaction | Listings / Cross-listing | route | Yes | Highest call count in any route; complex multi-platform logic with inline SQL throughout |
| `src/backend/routes/financials.js` | 93 | get, all, run | Financials / P&L | route | Yes | Heavy aggregation queries; good candidate for a FinancialsRepository |
| `src/backend/routes/automations.js` | 86 | get, all, run | Automations | route | Yes | Mixes business logic with DB reads/writes inline |
| `src/backend/routes/inventory.js` | 80 | get, all, run, transaction | Inventory | route | Yes | Core entity; extraction would unblock all platform sync services |
| `src/backend/workers/taskWorker.js` | 67 | get, all, run | Task queue / Background jobs | worker | Yes | Worker directly touches DB; extraction needed before scaling workers |
| `src/backend/routes/auth.js` | 54 | get, run | Auth / Sessions | route | Maybe | Auth SQL is security-sensitive; extract only with full test coverage |
| `src/backend/routes/analytics.js` | 48 | get, all, run | Analytics | route | Maybe | Read-heavy aggregation; acceptable inline for now |
| `src/backend/routes/batchPhoto.js` | 45 | get, all, run | Image / Batch processing | route | Maybe | Mixed image pipeline + DB; moderate priority |
| `src/backend/routes/feedback.js` | 43 | get, all, run | Feedback / Admin | route | No | Simple CRUD; low risk, low priority |
| `src/backend/routes/teams.js` | 41 | get, all, run | Teams / Collaboration | route | Maybe | Multi-tenant logic; extract after inventory |
| `src/backend/routes/reports.js` | 38 | get, all, run | Reports | route | Maybe | Heavy read aggregations; can stay inline |
| `src/backend/routes/imageBank.js` | 38 | get, all, run | Image Bank | route | No | Simple CRUD on ImageAsset |
| `src/backend/routes/extension.js` | 38 | get, all, run | Chrome Extension API | route | No | Thin read layer; low priority |
| `src/backend/routes/webhooks.js` | 37 | get, all, run, transaction | Webhooks / Incoming | route | Maybe | Transactional writes; worth isolating eventually |
| `src/backend/routes/shippingLabels.js` | 37 | get, all, run | Shipping / EasyPost | route | Maybe | Post-launch addition; moderate complexity |
| `src/backend/routes/inventoryImport.js` | 36 | get, all, run, transaction | Inventory import | route | Yes | Bulk upsert logic mixed with route; extract with inventory |
| `src/backend/routes/orders.js` | 35 | get, all, run | Orders | route | Maybe | Moderate CRUD; extract after core entities |
| `src/backend/services/enhancedMFA.js` | 34 | get, run | MFA / Security | service | No | Auth-adjacent; security-sensitive, leave in service layer |
| `src/backend/routes/sales.js` | 32 | get, all, run | Sales | route | Maybe | Core entity; extract alongside inventory |
| `src/backend/routes/help.js` | 32 | get, all, run | Help / Support content | route | No | Mostly read-only against help content tables |
| `src/backend/routes/receiptParser.js` | 30 | get, all, run | Receipt / Expense AI | route | No | Low complexity; AI + DB calls acceptable inline |
| `src/backend/routes/relisting.js` | 29 | get, all, run | Relisting automation | route | Maybe | Business logic-heavy; worth review |
| `src/backend/routes/offers.js` | 28 | get, all, run | Offers | route | Maybe | Core entity; pairs with listings extraction |
| `src/backend/routes/suppliers.js` | 26 | get, all, run | Suppliers | route | No | Simple CRUD; acceptable inline |
| `src/backend/routes/security.js` | 25 | get, all, run | Security / Audit | route | No | Audit log reads; leave inline |
| `src/backend/routes/qrAnalytics.js` | 25 | get, all, run | QR / Analytics | route | No | Read-heavy analytics; low priority |
| `src/backend/routes/legal.js` | 25 | get, all, run | Legal / GDPR consent | route | No | Consent records; low complexity |
| `src/backend/routes/skuRules.js` | 24 | get, all, run | SKU rules | route | No | Config-like data; acceptable inline |
| `src/backend/routes/affiliate.js` | 24 | get, all, run | Affiliate program | route | No | Moderate CRUD; low priority |
| `src/backend/routes/whatnotEnhanced.js` | 23 | get, all, run | Whatnot (enhanced) | route | No | Platform-specific; owned by Marketplace-Integration agent |
| `src/backend/routes/whatnot.js` | 23 | get, all, run | Whatnot | route | No | Platform-specific; owned by Marketplace-Integration agent |
| `src/backend/routes/shops.js` | 23 | get, all, run | Shops / Storefront | route | Maybe | Multi-platform shop config |
| `src/backend/routes/offlineSync.js` | 23 | get, all, run | Offline sync / Queue | route | Maybe | Complex queue logic; pairs with syncOrchestrator |
| `src/backend/routes/community.js` | 22 | get, all, run | Community / Social | route | No | Simple CRUD; low priority |
| `src/backend/db/seeds/demoData.js` | 22 | get, run | Demo seed data | service | No | Seed script; direct DB calls are appropriate here |
| `src/backend/services/auditLog.js` | 21 | get, run | Audit log | service | No | Service layer is correct; leave as-is |
| `src/backend/routes/tasks.js` | 21 | get, all, run | Tasks / Calendar tasks | route | No | Simple CRUD |
| `src/backend/routes/sizeCharts.js` | 21 | get, all, run | Size charts / Reference data | route | No | Reference data; low priority |
| `src/backend/routes/monitoring.js` | 21 | get, all, run | System monitoring | route | No | Admin read-only; acceptable inline |
| `src/backend/routes/chatbot.js` | 21 | get, all, run | Vault Buddy / AI chat | route | No | AI + context retrieval; acceptable inline |
| `src/backend/services/tokenRefreshScheduler.js` | 20 | get, run | OAuth token refresh | service | No | Scheduler service; correct layer |
| `src/backend/routes/predictions.js` | 20 | get, all, run | Price predictions / AI | route | No | Read-heavy; acceptable inline |
| `src/backend/routes/marketIntel.js` | 19 | get, all, run | Market intelligence | route | No | Analytics reads; low priority |
| `src/backend/routes/calendar.js` | 19 | get, all, run | Calendar events | route | No | Simple CRUD |
| `src/backend/services/emailMarketing.js` | 18 | get, all, run | Email marketing | service | No | Service layer; acceptable |
| `src/backend/routes/skuSync.js` | 18 | get, all, run | SKU sync | route | Maybe | Pairs with inventory extraction |
| `src/backend/routes/oauth.js` | 18 | get, run | OAuth (Marketplace-Integration owned) | route | No | Owned by Marketplace-Integration agent — do not modify |
| `src/backend/routes/emailOAuth.js` | 18 | get, run | Email OAuth | route | No | Auth-adjacent; leave in route |
| `src/backend/routes/pushNotifications.js` | 17 | get, all, run | Push notifications | route | No | Simple CRUD on subscriptions |
| `src/backend/routes/gdpr.js` | 17 | get, all, run | GDPR / Data privacy | route | No | Compliance; leave isolated |
| `src/backend/routes/socialAuth.js` | 16 | get, run | Social OAuth login | route | No | Auth flow; security-sensitive |
| `src/backend/services/outgoingWebhooks.js` | 15 | get, all, run | Outgoing webhooks | service | No | Service layer; correct |
| `src/backend/routes/pushSubscriptions.js` | 15 | get, all, run | Push subscription management | route | No | Simple CRUD |
| `src/backend/routes/duplicates.js` | 15 | get, all, run | Duplicate detection | route | No | Read-heavy scan; acceptable inline |
| `src/backend/services/mfa.js` | 14 | get, run | MFA (basic) | service | No | Security-sensitive; leave in service |
| `src/backend/routes/watermark.js` | 14 | get, all, run | Image watermarking | route | No | Low priority |
| `src/backend/routes/salesEnhancements.js` | 14 | get, all, run | Sales (enhancements) | route | Maybe | Extract alongside sales.js |
| `src/backend/routes/recentlyDeleted.js` | 14 | get, all, run | Trash / Soft delete | route | No | Simple soft-delete CRUD |
| `src/backend/routes/checklists.js` | 13 | get, all, run | Checklists | route | No | Simple CRUD |
| `src/backend/routes/billing.js` | 13 | get, all, run | Billing / Stripe | route | No | Stripe-adjacent; leave inline |
| `src/backend/routes/shippingProfiles.js` | 12 | get, all, run | Shipping profiles | route | No | Simple CRUD |
| `src/backend/workers/gdprWorker.js` | 11 | get, run | GDPR erasure worker | worker | No | Worker with DB calls is appropriate here |
| `src/backend/services/platformSync/ebaySync.js` | 11 | get, run | eBay sync | service | No | Marketplace-Integration owned |
| `src/backend/services/googleOAuth.js` | 11 | get, run | Google OAuth | service | No | Auth service; leave in service layer |
| `src/backend/routes/onboarding.js` | 11 | get, all, run | Onboarding | route | No | Simple flow; low priority |
| `src/backend/services/webhookProcessor.js` | 10 | get, all, run | Webhook event processing | service | No | Service layer; acceptable |
| `src/backend/services/platformSync/shopifySync.js` | 10 | get, run | Shopify sync | service | No | Marketplace-Integration owned |
| `src/backend/routes/roadmap.js` | 10 | get, all, run | Public roadmap | route | No | Simple CRUD |
| `src/backend/routes/competitorTracking.js` | 10 | get, all, run | Competitor tracking | route | No | Admin feature; low priority |
| `src/backend/services/platformSync/whatnotSync.js` | 9 | get, run | Whatnot sync | service | No | Marketplace-Integration owned |
| `src/backend/services/platformSync/poshmarkSync.js` | 9 | get, run | Poshmark sync | service | No | Marketplace-Integration owned |
| `src/backend/services/platformSync/mercariSync.js` | 9 | get, run | Mercari sync | service | No | Marketplace-Integration owned |
| `src/backend/services/platformSync/grailedSync.js` | 9 | get, run | Grailed sync | service | No | Marketplace-Integration owned |
| `src/backend/services/platformSync/facebookSync.js` | 9 | get, run | Facebook sync | service | No | Marketplace-Integration owned |
| `src/backend/services/platformSync/etsySync.js` | 9 | get, run | Etsy sync | service | No | Marketplace-Integration owned |
| `src/backend/services/platformSync/depopSync.js` | 9 | get, run | Depop sync | service | No | Marketplace-Integration owned |
| `src/backend/services/notificationService.js` | 9 | get, all, run | Notifications | service | No | Service layer; acceptable |
| `src/backend/services/analytics.js` | 9 | get, all | Analytics aggregation | service | No | Service layer; read-only queries |
| `src/backend/routes/templates.js` | 9 | get, all, run | Listing templates | route | No | Simple CRUD |
| `src/backend/workers/emailPollingWorker.js` | 8 | get, run | Email polling | worker | No | Worker; DB calls appropriate |
| `src/backend/services/monitoring.js` | 8 | get, all | System health monitoring | service | No | Read-only service; acceptable |
| `src/backend/routes/searchAnalytics.js` | 8 | get, all, run | Search analytics | route | No | Analytics reads; low priority |
| `src/backend/routes/expenseTracker.js` | 8 | get, all, run | Expense tracking | route | No | Simple CRUD |
| `src/backend/routes/ai.js` | 8 | get, all, run | AI features / Claude | route | No | AI + DB; acceptable inline |
| `src/backend/routes/account.js` | 8 | get, run | Account management | route | No | User account CRUD |
| `worker/index.js` | 8 | get, run | BullMQ worker entry | worker | No | Top-level worker; DB calls appropriate |
| `src/backend/middleware/csrf.js` | 7 | get, run | CSRF token management | middleware | No | Middleware DB calls are correct here |
| `src/backend/workers/priceCheckWorker.js` | 6 | get, run | Price check background job | worker | No | Worker; DB calls appropriate |
| `src/backend/services/imageStorage.js` | 6 | get, run | Image storage / R2 | service | No | Service layer; acceptable |
| `src/backend/services/featureFlags.js` | 6 | get, all | Feature flags | service | No | Service layer; read-only |
| `src/backend/routes/feature-requests-routes.js` | 6 | get, all, run | Feature requests | route | No | Simple CRUD |
| `src/backend/routes/adminIncidents.js` | 6 | get, all, run | Incident management | route | No | Admin feature; low priority |
| `src/backend/workers/uptimeProbeWorker.js` | 5 | get, run | Uptime probe | worker | No | Worker; DB calls appropriate |
| `src/backend/services/pricingEngine.js` | 5 | get, all | Pricing engine | service | No | Service layer; acceptable |
| `src/backend/routes/incidentSubscriptions.js` | 5 | get, all, run | Incident subscriptions | route | No | Simple CRUD |
| `src/backend/routes/barcode.js` | 5 | get, all, run | Barcode lookup | route | No | Simple CRUD |
| `src/backend/services/platformSync/index.js` | 4 | get, run | Platform sync orchestration (Marketplace-Integration owned) | service | No | Marketplace-Integration owned |
| `src/backend/services/grokService.js` | 4 | get, run | Grok AI integration | service | No | Service layer; acceptable |
| `src/backend/routes/rateLimitDashboard.js` | 4 | get, all | Rate limit dashboard | route | No | Admin read-only |
| `src/backend/services/marketDataService.js` | 3 | get, all | Market data | service | No | Service layer; read-only |
| `src/backend/routes/settings.js` | 3 | get, run | User settings | route | No | Simple CRUD; user preferences |
| `src/backend/routes/affiliate-apply.js` | 3 | get, run | Affiliate applications | route | No | Simple CRUD |
| `src/backend/middleware/auth.js` | 3 | get | JWT authentication | middleware | No | Auth middleware DB lookup; correct layer |
| `src/backend/db/seeds/helpContent.js` | 3 | run | Help content seed | service | No | Seed script; direct DB calls appropriate |
| `src/backend/services/stripeService.js` | 2 | get, run | Stripe / Billing | service | No | Service layer; acceptable |
| `src/backend/server.js` | 2 | get | Server startup / health | service | No | Health check query; acceptable |
| `src/backend/routes/syncAuditLog.js` | 2 | get, all | Sync audit log reads | route | No | Read-only; acceptable inline |
| `src/backend/routes/contact.js` | 2 | get, run | Contact form | route | No | Simple CRUD |
| `src/backend/middleware/requestLogger.js` | 2 | run | Request logging | middleware | No | Middleware DB write; acceptable |
| `src/backend/services/syncScheduler.js` | 1 | get | Sync scheduling | service | No | Service layer; single lookup |
| `src/backend/routes/integrations.js` | 1 | get | Integrations / third-party | route | No | Minimal DB use |
| `src/backend/middleware/rateLimiter.js` | 1 | run | Rate limit state | middleware | No | Middleware DB write; acceptable |
| `src/backend/middleware/errorHandler.js` | 1 | run | Error audit log | middleware | No | Middleware DB write; acceptable |

---

## 3. Summary

### Top 5 Files by Query Volume

| Rank | File | Call Count |
|---|---|---|
| 1 | `src/backend/routes/listings.js` | 120 |
| 2 | `src/backend/routes/financials.js` | 93 |
| 3 | `src/backend/routes/automations.js` | 86 |
| 4 | `src/backend/routes/inventory.js` | 80 |
| 5 | `src/backend/workers/taskWorker.js` | 67 |

### Domains with the Most Scattered SQL (Highest Extraction Priority)

These domains have the most inline SQL spread across multiple files, making them the best candidates for repository extraction in Phase 3:

1. **Listings / Cross-listing** — `listings.js` (120) + `relisting.js` (29) + `skuSync.js` (18) = 167 calls across 3 files. The largest domain by volume and complexity. A `ListingRepository` would immediately benefit sync services and the task worker.
2. **Inventory** — `inventory.js` (80) + `inventoryImport.js` (36) = 116 calls across 2 files. Core entity referenced by nearly every other domain; extraction unlocks safe reuse by platform sync services and the task worker.
3. **Financials / Sales** — `financials.js` (93) + `sales.js` (32) + `salesEnhancements.js` (14) = 139 calls across 3 files. Heavy aggregation queries repeated in multiple route files.
4. **Automations** — `automations.js` (86) alone. Dense inline SQL; a dedicated repository would isolate automation state management from route logic.
5. **Task Worker** — `taskWorker.js` (67). The worker reaching directly into the DB is the most structurally unsound pattern; it should consume a repository layer rather than inline queries.

### Files Acceptable to Leave As-Is

The following categories are low priority and should not be extracted:

- **Seed scripts** (`demoData.js`, `helpContent.js`) — direct DB calls are idiomatic in seed scripts.
- **Service layer files already at the correct abstraction** (`auditLog.js`, `mfa.js`, `enhancedMFA.js`, `notificationService.js`, `analytics.js`, `featureFlags.js`, etc.) — these are already a service, not a route. Adding a repository beneath them is unnecessary abstraction.
- **Middleware** (`auth.js`, `csrf.js`, `rateLimiter.js`, `requestLogger.js`, `errorHandler.js`) — middleware DB calls are small, purpose-specific, and correct at this layer.
- **Marketplace-Integration–owned files** (`routes/oauth.js`, `services/platformSync/*`) — these are out of scope for Backend agent extraction work.
- **Simple CRUD routes with fewer than 10 calls** — not worth the abstraction cost.

### Recommended Extraction Order for Phase 3

Execute extractions in this order to minimize risk and maximize leverage:

1. `InventoryRepository` — extracted from `inventory.js` + `inventoryImport.js`. Unblocks all downstream consumers.
2. `ListingRepository` — extracted from `listings.js` + `relisting.js` + `skuSync.js`. Highest call volume; enables consistent platform sync.
3. `SalesRepository` — extracted from `sales.js` + `salesEnhancements.js` + `financials.js` (aggregations only). Financials can share the repository for reads.
4. `AutomationRepository` — extracted from `automations.js`. Isolates automation state from route logic.
5. `TaskWorker refactor` — `taskWorker.js` should consume `InventoryRepository` + `ListingRepository` rather than calling DB directly.

Each step requires: write the repository module, update the route/worker to import it, run `bun test src/tests/auth.test.js src/tests/security.test.js`, add integration tests for the repository, then commit.

---

## Do-Not-Touch Note

**No SQL should be moved, extracted, or refactored** based on this inventory alone. This document is a planning artifact — not an execution plan. Any Phase 3 extraction must:

1. Be planned with the Architect-Planner agent first.
2. Have unit tests for the new repository module written before the SQL is moved.
3. Be executed one domain at a time with passing tests at each step.
4. Not touch `src/backend/routes/oauth.js` or `src/backend/services/platformSync/` (Marketplace-Integration agent ownership) or `src/backend/services/syncOrchestrator/` (Data-Sync-Orchestrator agent ownership).
