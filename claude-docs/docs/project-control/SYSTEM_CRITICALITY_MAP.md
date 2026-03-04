# SYSTEM CRITICALITY MAP

Generated: 2026-03-04

---

## Criticality Tiers

### Tier 1 — CRITICAL (system-down if broken)

| Component | File(s) | Impact if Broken | Recovery |
|-----------|---------|------------------|----------|
| Database engine | src/backend/db/database.js | All reads/writes fail; entire app unusable | Restart server; restore from backup |
| Migration runner | database.js: runMigrations() | Fresh deploy fails; schema drift | Fix migration ordering; re-run |
| Auth middleware | src/backend/middleware/auth.js | All authenticated API calls rejected (401) | Fix JWT verify logic; restart |
| Token store (frontend) | store.persist() / store.hydrate() | Login state lost; forced re-login on every page load | Clear localStorage; re-login |
| SPA router | app.js: router.navigate() | No page loads; blank screen | Fix route matching; hard refresh |
| Chunk loader | app.js: chunk loading logic | Pages fail to render; white screen on navigation | Fix chunk path; clear cache |
| HTTP server | src/backend/server.js | No requests served | Fix listen/bind; restart process |
| Schema (base) | src/backend/db/schema.sql | No tables exist on fresh install | Restore schema file from git |

### Tier 2 — HIGH (major feature area broken)

| Component | File(s) | Impact if Broken | Recovery |
|-----------|---------|------------------|----------|
| CSRF middleware | src/backend/middleware/csrf.js | All POST/PUT/PATCH/DELETE fail (403) | Fix token validation; restart |
| Rate limiter | src/backend/middleware/rateLimiter.js | Legitimate users throttled or attackers unblocked | Adjust limits; restart |
| WebSocket service | src/backend/services/websocket.js | No real-time updates; notifications delayed until poll | Restart WS server |
| Notification service | src/backend/services/notificationService.js | Users miss alerts; no in-app notifications | Fix; notifications queued in DB |
| Listing routes | src/backend/routes/listings.js | Cannot create/edit/view listings (core feature) | Fix route handler; restart |
| Inventory routes | src/backend/routes/inventory.js | Cannot manage inventory items | Fix route handler; restart |
| Pricing engine | src/backend/services/pricingEngine.js | No price suggestions; manual pricing only | Graceful — manual fallback |
| app.js (monolith) | src/frontend/app.js (71,808 LOC) | Fallback render path broken; affects all pages | Fix; chunk files still work |
| handlers-deferred.js | src/frontend/handlers/handlers-deferred.js | Deferred handler loading broken | Fix; chunk files cover most paths |

### Tier 3 — MEDIUM (single feature broken, workarounds exist)

| Component | File(s) | Impact if Broken | Recovery |
|-----------|---------|------------------|----------|
| eBay publish | src/backend/services/ebayPublish.js | Cannot publish to eBay; other platforms unaffected | Fix; re-publish manually |
| Etsy publish | src/backend/services/etsyPublish.js | Cannot publish to Etsy; other platforms unaffected | Fix; re-publish manually |
| Platform sync services | src/backend/services/platformSync/* | Auto-sync fails; manual re-list | Fix; data in DB unaffected |
| AI service | src/shared/ai/ai.js | AI listing gen, image analysis unavailable | Manual entry fallback |
| Cloudinary service | src/backend/services/cloudinaryService.js | Cloud image editing unavailable | Local image fallback |
| Gmail service | src/backend/services/gmailService.js | Receipt auto-import unavailable | Manual receipt entry |
| Automation workers | src/backend/workers/taskWorker.js | Scheduled automations stop running | Fix; manual trigger available |
| Price check worker | src/backend/workers/priceCheckWorker.js | Automated price checks stop | Manual price check available |
| Analytics routes | src/backend/routes/analytics.js | Dashboard analytics unavailable | Data preserved in DB |
| Batch photo processor | src/backend/services/batchPhoto* | Bulk photo ops fail | Process photos individually |

### Tier 4 — LOW (cosmetic, non-blocking)

| Component | File(s) | Impact if Broken | Recovery |
|-----------|---------|------------------|----------|
| Security headers | src/backend/middleware/securityHeaders.js | Missing headers; no functional impact | Fix; redeploy |
| Request logger | src/backend/middleware/requestLogger.js | No request logging; app works normally | Fix; restart |
| CDN middleware | src/backend/middleware/cdn.js | Static assets served from origin | Fix; restart |
| Email polling worker | src/backend/workers/emailPollingWorker.js | Email receipt polling stops | Manual import available |
| Notion sync | src/backend/services/notionService.js | Notion integration unavailable | Local data unaffected |
| Token refresh scheduler | src/backend/services/tokenRefreshScheduler.js | OAuth tokens may expire; re-auth needed | Manual re-auth in My Shops |

---

## Blast Radius Map

```
database.js failure
  └── ALL routes (65 modules)
  └── ALL services (43 modules)
  └── ALL workers (4 modules)
  └── Total impact: 100% of backend

auth.js failure
  └── ALL authenticated routes (63 of 65)
  └── WebSocket connections rejected
  └── Total impact: ~97% of backend

app.js corruption
  └── ALL frontend pages (11 modules)
  └── ALL frontend handlers (11 modules)
  └── State management
  └── Total impact: 100% of frontend

Single marketplace service failure (e.g., ebayPublish.js)
  └── That marketplace only
  └── Total impact: ~3% of functionality
```

---

## Data Loss Risk

| Scenario | Data at Risk | Mitigation |
|----------|-------------|------------|
| SQLite file corruption | All application data | WAL mode reduces risk; db:backup script exists |
| Migration applied out of order | Schema drift; queries fail | Filename-ordered sequential apply |
| No backup taken before deploy | Recovery point = last backup | Automate pre-deploy backup |
| localStorage cleared | Auth tokens, UI preferences | Re-login; preferences reset to defaults |
| .env file lost | API keys, JWT secret | All existing sessions invalidated; re-configure |

---

## Single Points of Failure

| SPOF | Why | Mitigation Path |
|------|-----|-----------------|
| SQLite (single writer) | WAL allows concurrent reads but one writer | Acceptable for single-user; queue writes |
| app.js (71K lines) | Monolith fallback; merge conflict magnet | Three-file sync pattern distributes load |
| JWT_SECRET in .env | Lost = all sessions invalid | Document in deploy checklist; backup .env |
| Bun runtime | Non-standard; fewer community fixes | Pin Bun version; test upgrades in staging |
