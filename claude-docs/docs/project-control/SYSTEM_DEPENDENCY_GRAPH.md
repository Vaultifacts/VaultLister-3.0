# SYSTEM DEPENDENCY GRAPH

Generated: 2026-03-04

---

## Layer Architecture

```
[Browser / PWA]
      |
[Vanilla JS SPA]  ←→  [Service Worker (offline queue)]
      |
[Bun HTTP Server + WebSocket]
      |
 ┌────┼────────────────────────┐
 |    |                        |
[Middleware Stack]    [Background Workers]
 |    |                        |
 ├─ auth.js (JWT)         taskWorker.js
 ├─ csrf.js               priceCheckWorker.js
 ├─ rateLimiter.js        emailPollingWorker.js
 ├─ securityHeaders.js    tokenRefreshScheduler.js
 ├─ requestLogger.js
 ├─ errorHandler.js
 └─ cdn.js
      |
[Route Layer — 65 modules]
      |
 ┌────┼──────────────┐
 |    |              |
[Service Layer]  [Shared Utils]
 |    |              |
 ├─ websocket.js     ├─ ai/ (Claude SDK)
 ├─ notificationService.js  ├─ automations/ (Playwright)
 ├─ pricingEngine.js  └─ utils/ (sanitize, escapeHtml)
 ├─ platformSync/*
 └─ ...43 modules
      |
[PostgreSQL (WAL + TSVECTOR)]
      |
[112 migrations → pg-schema.sql]
```

---

## Critical Dependency Chains

### 1. Auth Chain (breaks all authenticated features)
```
store.persist() → store.hydrate() → store.setState()
       ↓                ↓                   ↓
   localStorage    token restore       api.request()
                                            ↓
                                    Authorization header
                                            ↓
                                    middleware/auth.js
                                            ↓
                                    JWT verify → user context
```
**Risk:** Removing any piece breaks "Remember Me" and all API calls.

### 2. Frontend Render Chain (breaks all page loads)
```
router.navigate(path)
       ↓
route match → chunk loader
       ↓
pages-[chunk].js loaded
       ↓
pages.[pageName]() called → returns HTML string
       ↓
renderApp(html) → DOM update
       ↓
handlers-[chunk].js provides event handlers
```
**Risk:** Mismatch between page HTML `onclick=` references and handler names causes silent failures.

### 3. Three-File Sync Chain (breaks if any file drifts)
```
handlers-inventory-catalog.js  ←MUST MATCH→  handlers-deferred.js  ←MUST MATCH→  app.js
pages-inventory-catalog.js     ←MUST MATCH→  pages-deferred.js     ←MUST MATCH→  app.js
```
**Risk:** Features appear to work in one load path but silently break in another.

### 4. Database Migration Chain (breaks on fresh deploy)
```
pg-schema.sql (base) → 001_*.sql → 002_*.sql → ... → 112_*.sql
       ↓
database.js: runMigrations() applies in filename order
       ↓
All route modules assume final schema
```
**Risk:** Migration ordering errors or missing files cause schema drift. No rollback mechanism.

### 5. Marketplace Publish Chain
```
User clicks "Publish to eBay"
       ↓
POST /api/listings/:id/publish-ebay
       ↓
ebayPublish.js → shops table (decryptToken) → eBay API
       ↓
Update listings.platform_listing_id + platform_url
```
**Risk:** Token expiry between UI action and API call. Rate limits on marketplace APIs.

---

## External Dependencies

| System | Used By | Failure Mode |
|--------|---------|--------------|
| eBay API | ebayPublish.js, ebaySync.js | Listing publish fails; graceful degradation |
| Etsy API | etsyPublish.js, etsySync.js | Listing publish fails; graceful degradation |
| Claude API | ai.js, listing generator | AI features unavailable; manual fallback |
| Cloudinary | cloudinaryService.js, batchPhoto | Image editing unavailable; local fallback |
| Gmail API | gmailService.js, emailPollingWorker | Receipt auto-import unavailable |
| Notion API | notionService.js, notionSync.js | Sync unavailable; local data unaffected |
| Redis | redis.js (optional) | Falls back to in-memory; no data loss |

---

## Module Coupling (high-risk pairs)

| Module A | Module B | Coupling | Why |
|----------|----------|----------|-----|
| app.js | All handler/page chunks | TIGHT | app.js duplicates all handler/page code |
| middleware/auth.js | Every route | TIGHT | All routes depend on user context |
| database.js | Every route + service | TIGHT | Single DB connection, shared query interface |
| tokenRefreshScheduler.js | notificationService.js + websocket.js | MEDIUM | Scheduler triggers notifications |
| store.setState() | renderApp() | TIGHT | State changes require manual re-render |
