# VaultLister 3.0 Launch Audit — Complete Findings
**Date:** 2026-04-05 | **Scope:** Source files only (not legacy app.js or core-bundle.js)

---

## Findings Table

| Severity | File:Line | Issue | Code Snippet |
|----------|-----------|-------|--------------|
| CRITICAL | rateLimiter.js:27-28 | Rate limiting DISABLED for production — always returns `true` | `function isRateLimitBypassed() { return true; }` |
| CRITICAL | imageUploadHelper.js:48,138 | Math.random() in production image filenames (insecure) | `'c-${Date.now()}-${Math.random().toString(36)}'` |
| CRITICAL | ai.js:73,75 | Mercari/Grailed in AI templates (post-launch platforms) | `mercari: 'Stylish Fashion Item', grailed: 'Designer Streetwear'` |
| CRITICAL | demoData.js:383-471 | Math.random() in demo order/tracking numbers (7 instances) | `order_number: 'PSH-' + Math.random().toString(36).substr(2,8)` |
| CRITICAL | app.js:29521 | "Cross-list to all 6 platforms" (legacy file, stale copy) | `Cross-list to all 6 platforms` |
| HIGH | analytics.js:28 | analyticsRouter() no try/catch wrapper | `export async function analyticsRouter(ctx) {` |
| HIGH | automations.js:25 | automationsRouter() no try/catch | `export async function automationsRouter(ctx) {` |
| HIGH | barcode.js:7 | barcodeRouter() no error boundary | `export async function barcodeRouter(ctx) {` |
| HIGH | checklists.js:6 | checklistsRouter() no try/catch | `export async function checklistsRouter(ctx) {` |
| HIGH | community.js:22 | communityRouter() no error handler | `export async function communityRouter(ctx) {` |
| HIGH | currency.js:3 | currencyRouter() no error boundary | `export async function currencyRouter(ctx) {` |
| HIGH | emailOAuth.js:32 | emailOAuthRouter() no try/catch (OAuth-critical) | `export async function emailOAuthRouter(ctx) {` |
| HIGH | extension.js:14 | extensionRouter() no error handler | `export async function extensionRouter(ctx) {` |
| HIGH | ai.js:173,178,183,298,457,820,823,1145,1148 | Bare JSON.parse() in AI responses (9 instances, unprotected) | `analysisData = JSON.parse(responseText);` |
| HIGH | automations.js:62,68,255,261,355,361,456,462 | Bare JSON.parse() on rule objects (8 instances, no wrapper) | `rule.conditions = JSON.parse(rule.conditions or '{}');` |
| MEDIUM | taskWorker.js:1160,1162 | Mercari/Grailed case statements active (should be feature-gated) | `case 'mercari': return await executeMercariBot(...)` |
| MEDIUM | widgets.js:6132,6138,6139,6140 | Supplier metrics use Math.random() fallback (fake data on prod) | `Math.floor(Math.random() * 30) + 70` |
| MEDIUM | handlers-tools-tasks.js:344 | Tag randomization with Math.random() | `sort(() => 0.5 - Math.random())` |
| MEDIUM | core/utils.js:11-20 | SUPPORTED_PLATFORMS lists 9 platforms (Canada launch = 5) | All 9: poshmark, ebay, mercari, depop, grailed, etsy, shopify, facebook, whatnot |
| MEDIUM | handlers-tools-tasks.js:3803 | Comment: "6 platform presets" (stale) | `// 6 platform-specific presets` |
| MEDIUM | handlers-deferred.js:21168 | Comment: "6 platform presets" (stale) | `// 6 platform-specific presets` |
| MEDIUM | pages-intelligence.js:1826,1914 | "Coming soon" UI messages in production pages | `toast.info('...coming soon.')` |
| MEDIUM | listing-generator.js:167,180,185,189 | Math.random() in template selection (4 instances) | `templates.intro[Math.floor(Math.random() * length)]` |
| LOW | database.js:328 | TODO: tsvector full-text search (Phase 3) | `// TODO Phase 3: implement tsvector` |
| LOW | rateLimiter.js:27 | TODO: re-enable rate limiting post-launch | `// TODO: Re-enable for production release` |

---

## Summary

**Total Issues: 25**
- **CRITICAL: 5** — Rate limiter disabled, insecure filenames, post-launch platforms hardcoded, Math.random in seeds, stale marketing copy
- **HIGH: 8** — 7 routes missing error boundaries, 17 bare JSON.parse() calls
- **MEDIUM: 10** — Fake data fallbacks, platform constant mismatch, stale comments
- **LOW: 2** — TODO comments

---

## Launch Blockers (MUST FIX BEFORE GO-LIVE)

### 1. Rate Limiter Disabled ⚠️ CRITICAL
**File:** `src/backend/middleware/rateLimiter.js:26-28`

```javascript
function isRateLimitBypassed() {
    // TODO: Re-enable for production release — rate limiting disabled during development/testing
    return true;
}
```

**Problem:** Function always returns `true`, disabling ALL rate limiting protection on every route.

**Impact:** Production server has zero protection against brute-force attacks, API abuse, DoS.

**Fix:** Change line 28 to `return false;` or implement environment-based gate:
```javascript
return process.env.DISABLE_RATE_LIMIT === 'true';
```

---

### 2. Insecure Image Filenames ⚠️ CRITICAL
**File:** `src/backend/services/platformSync/imageUploadHelper.js:48, 138`

```javascript
// Line 48
const compressedPath = join(TEMP_DIR, `c-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);

// Line 138
const filename = `img-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
```

**Problem:** Uses cryptographically insecure `Math.random()` in production filenames.

**Impact:** Temp files are predictable; attackers can guess and access other users' temp images.

**Fix:** Use crypto-secure RNG:
```javascript
const randomBytes = crypto.getRandomValues(new Uint8Array(6));
const hexString = Array.from(randomBytes).map(b => b.toString(16).padStart(2,'0')).join('');
const filename = `img-${Date.now()}-${hexString}.${fileExt}`;
```

---

### 3. Post-Launch Platforms in Active Code ⚠️ CRITICAL
**File 1:** `src/backend/routes/ai.js:73,75`

```javascript
mercari: 'Stylish Fashion Item - Great Deal',
grailed: 'Designer Streetwear Piece - Gently Used',
```

**File 2:** `src/backend/workers/taskWorker.js:1160,1162`

```javascript
case 'mercari':  return await executeMercariBot(rule, conditions, actions);
case 'grailed':  return await executeGrailedBot(rule, conditions, actions);
```

**Problem:** Mercari/Grailed are NOT in Canada launch scope (launch = eBay, Poshmark, Facebook, Depop, Whatnot). Code is active and will execute if triggered.

**Impact:** Users can accidentally create automations for post-launch platforms; Mercari/Grailed bots will fire unexpectedly.

**Fix:**
- Remove Mercari/Grailed from `taskWorker.js` case statements OR wrap with feature flag:
```javascript
if (process.env.ENABLE_MERCARI === 'true' && rule.platform === 'mercari') { ... }
```
- Remove hardcoded AI templates for Mercari/Grailed in `ai.js`

---

### 4. Seven Routes Missing Error Boundaries ⚠️ HIGH
**Files without top-level try/catch:**

1. `src/backend/routes/analytics.js:28` — analyticsRouter()
2. `src/backend/routes/automations.js:25` — automationsRouter()
3. `src/backend/routes/barcode.js:7` — barcodeRouter()
4. `src/backend/routes/checklists.js:6` — checklistsRouter()
5. `src/backend/routes/community.js:22` — communityRouter()
6. `src/backend/routes/currency.js:3` — currencyRouter()
7. `src/backend/routes/emailOAuth.js:32` — emailOAuthRouter() **← OAuth-critical**
8. `src/backend/routes/extension.js:14` — extensionRouter()

**Problem:** Unhandled errors crash route handlers and leave server in unknown state.

**Impact:** Single malformed request → route crashes → error not logged → user gets 500 with no context.

**Fix:** Wrap main router function:
```javascript
export async function routerName(ctx) {
    try {
        const { method, path } = ctx;
        // ... route logic ...
    } catch (err) {
        logger.error('Route error', { path: ctx.path, error: err.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}
```

---

### 5. Seventeen Bare JSON.parse() Calls ⚠️ HIGH
**Without try/catch protection:**

**ai.js (9 instances):** Lines 173, 178, 183, 298, 457, 820, 823, 1145, 1148
```javascript
analysisData = JSON.parse(responseText);  // Can throw if malformed
```

**automations.js (8 instances):** Lines 62, 68, 255, 261, 355, 361, 456, 462
```javascript
rule.conditions = JSON.parse(rule.conditions || '{}');  // Unprotected
```

**Problem:** Malformed JSON crashes route handler.

**Impact:** API returns 500 instead of 400 Bad Request; no validation feedback.

**Fix:** Create `safeJsonParse()` helper and wrap all calls:
```javascript
function safeJsonParse(str, fallback = {}) {
    try {
        return JSON.parse(str);
    } catch (err) {
        logger.warn('JSON parse failed', { str, error: err.message });
        return fallback;
    }
}

// Usage
rule.conditions = safeJsonParse(rule.conditions, {});
```

---

## High-Priority Fixes (Strongly Recommended Before Launch)

### 6. Math.random() in Demo Seeds ⚠️ MEDIUM (but impacts demo UX)
**File:** `src/backend/db/seeds/demoData.js:383,388,410,415,422,446,471`

7 instances of `Math.random()` generating order/tracking numbers. While these are demo-only, they should use deterministic IDs for reproducible testing:

```javascript
// Current (line 383)
order_number: 'PSH-' + Math.random().toString(36).substr(2, 8).toUpperCase(),

// Better
order_number: `PSH-${user_id}-${item_id}`.slice(0, 12),
```

---

### 7. Fake Supplier Metrics on Production ⚠️ MEDIUM
**File:** `src/frontend/ui/widgets.js:6132,6138,6139,6140`

```javascript
const healthScore = supplier.health_score || Math.floor(Math.random() * 30) + 70;
const orderAccuracy = supplier.order_accuracy || Math.floor(Math.random() * 15) + 85;
const onTimeDelivery = supplier.on_time_delivery || Math.floor(Math.random() * 20) + 80;
const qualityRating = supplier.quality_rating || Math.floor(Math.random() * 15) + 85;
```

**Problem:** If supplier data is missing, widget generates random metrics (90-95% health looks real but is fake).

**Fix:** Use realistic defaults or remove widget if data unavailable:
```javascript
const healthScore = supplier.health_score ?? 'No Data';
```

---

### 8. Platform Constant Mismatch ⚠️ MEDIUM
**File:** `src/frontend/core/utils.js:11-20`

```javascript
const SUPPORTED_PLATFORMS = [
    { id: 'poshmark', name: 'Poshmark', ... },
    { id: 'ebay', name: 'eBay', ... },
    { id: 'mercari', name: 'Mercari', ... },     // ← NOT in launch
    { id: 'depop', name: 'Depop', ... },
    { id: 'grailed', name: 'Grailed', ... },     // ← NOT in launch
    { id: 'etsy', name: 'Etsy', ... },          // ← NOT in launch
    { id: 'shopify', name: 'Shopify', ... },    // ← NOT in launch
    { id: 'facebook', name: 'Facebook', ... },
    { id: 'whatnot', name: 'Whatnot', ... }
];
```

**Canada Launch Platforms:** eBay, Poshmark, Facebook, Depop, Whatnot (5 only)

**Fix:** Either
1. Create launch-specific constant:
```javascript
const LAUNCH_PLATFORMS = SUPPORTED_PLATFORMS.filter(p => ['poshmark','ebay','facebook','depop','whatnot'].includes(p.id));
```
2. Or add feature flag to UI:
```javascript
const visiblePlatforms = process.env.SHOW_ALL_PLATFORMS === 'true' ? SUPPORTED_PLATFORMS : LAUNCH_PLATFORMS;
```

---

## Non-Blocking (Can Defer to Post-Launch)

### Minor Issues
- Remove "Cross-list to all 6 platforms" from app.js:29521 (legacy file, not served)
- Update stale "6 platform presets" comments (handlers-tools-tasks.js:3803, handlers-deferred.js:21168)
- Replace Math.random() in listing-generator.js with deterministic template selection
- Remove "coming soon" toast messages (graceful fallback in place)
- Remove TODO comments (advisory only)

---

## Bot Availability Summary

| Platform | File | Status | Launch? |
|----------|------|--------|---------|
| Poshmark | `poshmark-bot.js` | ✅ Implemented | YES |
| eBay | N/A (API-based) | ✅ Implemented | YES |
| Facebook | `facebook-bot.js` | ✅ Implemented | YES |
| Depop | `depop-bot.js` | ✅ Implemented | YES |
| Whatnot | `whatnot-bot.js` | ✅ Implemented | YES |
| Mercari | `mercari-bot.js` | ✅ Code exists | NO (post-launch) |
| Grailed | `grailed-bot.js` | ✅ Code exists | NO (post-launch) |

---

## Verification Checklist

Before marking launch-ready, verify:

- [ ] Rate limiter re-enabled (rateLimiter.js:28 returns `false`)
- [ ] Math.random() removed from imageUploadHelper.js (use crypto RNG)
- [ ] Mercari/Grailed code removed or feature-gated (ai.js, taskWorker.js)
- [ ] All 7 routes wrapped with try/catch
- [ ] All 17 JSON.parse() calls protected with safeJsonParse()
- [ ] Math.random() removed from demo seeds, AI templates, UI widgets
- [ ] SUPPORTED_PLATFORMS filtered or feature-gated to launch set
- [ ] Stale "6 platforms" comments updated or removed
- [ ] "Coming soon" messages handled gracefully or hidden

---

**Audit completed:** 2026-04-05 by Claude Code researcher
**Files scanned:** All source modules in src/, worker/bots/ (NOT legacy app.js or core-bundle.js)
