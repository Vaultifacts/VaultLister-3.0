# VaultLister 3.0 — API Overview

All route files live in `src/backend/routes/`. Each file maps to one or more `/api/[resource]` paths.
Routes follow kebab-case naming: `/api/inventory`, `/api/cross-list`, `/api/image-bank`, etc.

Total: 67 route files.

---

## Domain Groups

### Auth and Identity (4)
| File | Domain |
|------|--------|
| `auth.js` | Login, logout, register, token refresh, password reset, account lockout |
| `oauth.js` | OAuth 2.0 callback handling and token exchange for marketplace platforms |
| `socialAuth.js` | Social login providers |
| `emailOAuth.js` | Gmail and Outlook OAuth for email-based automation |

### Inventory (3)
| File | Domain |
|------|--------|
| `inventory.js` | CRUD for InventoryItems, full-text search (TSVECTOR), status transitions |
| `inventoryImport.js` | Bulk CSV/spreadsheet import |
| `duplicates.js` | Duplicate detection and merge |

### Listings and Cross-listing (4)
| File | Domain |
|------|--------|
| `listings.js` | Platform Listing CRUD, status management |
| `shops.js` | Connected shop/platform account management |
| `relisting.js` | Re-list ended or archived listings |
| `skuSync.js` | SKU synchronization across platforms |

### Sales and Orders (3)
| File | Domain |
|------|--------|
| `sales.js` | Sale records, status updates, profit calculations |
| `salesEnhancements.js` | Extended sale attributes and reporting hooks |
| `orders.js` | Order management and fulfillment workflow |

### Offers (1)
| File | Domain |
|------|--------|
| `offers.js` | Incoming offer inbox, accept/decline/counter, auto-offer rules |

### Automations (2)
| File | Domain |
|------|--------|
| `automations.js` | Automation rule CRUD, enable/disable, manual trigger |
| `whatnot.js` | Whatnot-specific automation endpoints |
| `whatnotEnhanced.js` | Extended Whatnot auction and show management |

### AI Features (2)
| File | Domain |
|------|--------|
| `ai.js` | Listing generation, image analysis, price suggestions |
| `chatbot.js` | Vault Buddy conversational assistant |

### Analytics and Reporting (5)
| File | Domain |
|------|--------|
| `analytics.js` | Dashboard metrics, snapshot queries |
| `reports.js` | Report generation and export |
| `financials.js` | Profit/loss, expense summary |
| `searchAnalytics.js` | Search term and click-through analytics |
| `qrAnalytics.js` | QR code scan tracking |

### Images and Media (3)
| File | Domain |
|------|--------|
| `imageBank.js` | Image asset library, upload, tag, organize |
| `batchPhoto.js` | Bulk photo processing and AI tagging |
| `watermark.js` | Watermark application to listing images |

### Shipping (3)
| File | Domain |
|------|--------|
| `shippingLabels.js` | Label generation and carrier integration |
| `shippingProfiles.js` | Reusable shipping configuration profiles |
| `sizeCharts.js` | Size chart reference data |

### Pricing and Market Intelligence (3)
| File | Domain |
|------|--------|
| `predictions.js` | AI-powered price prediction endpoints |
| `marketIntel.js` | Comparable sold item research |
| `competitorTracking.js` | Competitor price and listing monitoring |

### Templates and Rules (3)
| File | Domain |
|------|--------|
| `templates.js` | Listing template CRUD |
| `skuRules.js` | SKU generation rules and auto-assignment |
| `checklists.js` | Pre-listing and pre-ship checklists |

### Notifications and Webhooks (4)
| File | Domain |
|------|--------|
| `notifications.js` | In-app notification inbox |
| `pushNotifications.js` | Web Push subscription management |
| `pushSubscriptions.js` | Push subscription CRUD |
| `webhooks.js` | Incoming webhook processing from platforms |

### Platform-Specific (2)
| File | Domain |
|------|--------|
| `barcode.js` | Barcode scan and product lookup |
| `receiptParser.js` | Purchase receipt parsing for cost tracking |

### Offline and Sync (1)
| File | Domain |
|------|--------|
| `offlineSync.js` | Sync queue flush, conflict resolution |

### Team and Collaboration (3)
| File | Domain |
|------|--------|
| `teams.js` | Team member management, roles, permissions |
| `community.js` | Community collaboration marketplace |
| `affiliate.js` | Referral and affiliate program |

### User Settings and Admin (7)
| File | Domain |
|------|--------|
| `onboarding.js` | First-run setup flow |
| `feedback.js` | In-app feedback and bug reports |
| `help.js` | Help articles and contextual guidance |
| `roadmap.js` | Public product roadmap |
| `billing.js` | Subscription management |
| `gdpr.js` | Data export, right-to-erasure |
| `legal.js` | Terms of service and privacy policy endpoints |

### Observability and Dev (6)
| File | Domain |
|------|--------|
| `security.js` | Security log queries, active session management |
| `monitoring.js` | Health checks, server metrics |
| `rateLimitDashboard.js` | Rate limit status and reset |
| `notion.js` | Notion integration sync (bug tracker, roadmap) |
| `calendar.js` | Calendar event integration |
| `mock-oauth.js` | Dev-only mock OAuth flow for testing without live credentials |

### Chrome Extension (1)
| File | Domain |
|------|--------|
| `extension.js` | Chrome extension API endpoints (inventory lookup, quick-add) |

### Suppliers (1)
| File | Domain |
|------|--------|
| `suppliers.js` | Supplier and sourcing record management |

### Tasks (1)
| File | Domain |
|------|--------|
| `tasks.js` | Background task queue status and manual trigger |

### Expense Tracking (1)
| File | Domain |
|------|--------|
| `expenseTracker.js` | Reselling expense categorization and totals |

---

## Middleware Stack (applied globally)

All routes pass through, in order:
1. `securityHeaders.js` — CSP, HSTS, X-Frame-Options; never remove `'unsafe-inline'` from script-src/style-src
2. `rateLimiter.js` — per-IP and per-user rate limits; required on all auth and public routes
3. `auth.js` middleware — JWT verification; populates `req.user`
4. CSRF validation (`validateCsrf()`) — required on all POST/PUT/PATCH/DELETE routes
