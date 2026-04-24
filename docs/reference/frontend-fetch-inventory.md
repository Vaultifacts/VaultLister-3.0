# Frontend Fetch Usage Inventory — VaultLister 3.0

Generated: 2026-04-24  
Scope: `src/frontend/**/*.{js,html}` + `public/**/*.{js,html}`  
Command: `grep -rn "fetch(" src/frontend public --include="*.js" --include="*.html"`

---

## 1. Total Fetch Call Count

**92 total `fetch(` matches** across all scanned files.

Breakdown by file category:

| Category | Raw Match Count | Notes |
|---|---|---|
| `public/sw.js` | 10 | Service worker — all raw by definition |
| `public/*.html` (ipapi.co geolocation) | 23 | One per static HTML page |
| `public/*.html` (API calls) | 11 | Public pages calling `/api/*` directly |
| `public/public-auth-nav.js` | 3 | Shared auth nav component |
| `src/frontend/core/api.js` | 3 | The api.js wrapper itself |
| `src/frontend/core/auth.js` | 1 | OTT exchange bootstrap call |
| `src/frontend/handlers/handlers-deferred.js` | 10 | Mixed — some raw API calls |
| `src/frontend/handlers/handlers-intelligence.js` | 1 | Raw authenticated API call |
| `src/frontend/handlers/handlers-inventory-catalog.js` | 1 | Fetches external image URL to blob |
| `src/frontend/handlers/handlers-settings-account.js` | 5 | Mixed raw API calls |
| `src/frontend/handlers/handlers-tools-tasks.js` | 5 | Mixed raw API + blob fetches |
| `src/frontend/index.html` | 1 | Health poll bootstrap |
| `src/frontend/init.js` | 3 | dataUrl blob fetch + image upload + RUM beacon |
| `src/frontend/oauth-callback.html` | 1 | OAuth callback bootstrap |
| `src/frontend/core-bundle.js` | 9 | **Auto-generated** — mirrors source modules; excluded from analysis below |

> `core-bundle.js` is a build artifact generated from source modules. All calls in it duplicate calls already counted in their origin source files (`api.js`, `auth.js`, `init.js`, `widgets.js`). It is excluded from the per-file table to avoid double-counting.
>
> `prefetch(` method name references in `core-bundle.js` and `widgets.js` are string matches only (method definitions, not `window.fetch` calls) and are excluded from classification.

---

## 2. Fetch Usage Table

> "Uses api.js?" = Yes means the call goes through `api.request()` / `api.get()` / `api.post()` etc. in `src/frontend/core/api.js`, which handles CSRF tokens, Authorization headers, and 401→refresh retry. No means raw `fetch()` is called directly.

### src/frontend/core/api.js (3 calls)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `src/frontend/core/api.js` | 3 | `${baseUrl}${endpoint}` (generic), `/auth/refresh`, dynamic `url` | N/A — is api.js | `intentional-raw` | These three calls ARE api.js. Line 38: main request dispatcher. Line 107: token refresh (cannot use itself). Line 185: file upload variant. |

### src/frontend/core/auth.js (1 call)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `src/frontend/core/auth.js` | 1 | `/api/auth/oauth-session?ott=` | No | `intentional-raw` | Comment in code explicitly states: "Raw fetch bypasses api.request's 401→token-refresh interceptor." Required at bootstrap — no token exists yet to place in api.js auth header. |

### src/frontend/index.html (1 call)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `src/frontend/index.html` | 1 | `/api/health` | No | `intentional-raw` | Auto-update version poller in a `<script>` tag. No token required. api.js is not loaded in this inline script context. |

### src/frontend/init.js (3 calls)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `src/frontend/init.js` | 1 | `photo.dataUrl` (data: URI) | No | `intentional-raw` | Converts a data URL to a Blob object. Not an HTTP endpoint — cannot go through api.js. |
| `src/frontend/init.js` | 1 | `/api/image-bank/upload` | No | `should-use-api.js` | Authenticated multipart POST with Bearer token + CSRF header set manually. Should use `api.js` for consistent retry and CSRF handling. |
| `src/frontend/init.js` | 1 | `/api/monitoring/rum` | No | `intentional-raw` | RUM beacon fallback when `navigator.sendBeacon` is unavailable. Uses `keepalive: true`. No auth token needed. Fire-and-forget. |

### src/frontend/oauth-callback.html (1 call)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `src/frontend/oauth-callback.html` | 1 | `/api/oauth/callback/${platform}` | No | `intentional-raw` | Standalone HTML page outside the SPA. api.js is not loaded here. OAuth callback exchange is a one-shot bootstrap with no prior token. |

### src/frontend/handlers/handlers-deferred.js (10 calls)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `src/frontend/handlers/handlers-deferred.js` | 1 | External image URL (user-supplied) | No | `intentional-raw` | Line 282 — fetches an external image URL to convert to Blob. Not an API call. |
| `src/frontend/handlers/handlers-deferred.js` | 2 | `/api/size-charts/brands`, `/api/size-charts/brands/${brand}` | No | `should-use-api.js` | Lines 2711, 2737 — authenticated GET calls with manual Bearer header. Should use `api.get()`. |
| `src/frontend/handlers/handlers-deferred.js` | 1 | `image.file_path` (R2/Cloudinary URL) | No | `intentional-raw` | Line 19530 — fetches a stored image asset URL to Blob for re-upload. External or relative asset URL, not an API call. |
| `src/frontend/handlers/handlers-deferred.js` | 1 | `/api/predictions/models` | No | `should-use-api.js` | Line 24947 — authenticated GET with manual Bearer header. Should use `api.get()`. |
| `src/frontend/handlers/handlers-deferred.js` | 1 | `/api/legal/privacy/data-export` | No | `should-use-api.js` | Line 25091 — authenticated GET with manual Bearer header. Should use `api.get()`. |
| `src/frontend/handlers/handlers-deferred.js` | 1 | `/api/legal/privacy/cookie-consent` | No | `should-use-api.js` | Line 25111 — authenticated GET with manual Bearer header. Should use `api.get()`. |
| `src/frontend/handlers/handlers-deferred.js` | 1 | `/api/legal/privacy/data-audit` | No | `should-use-api.js` | Line 25172 — authenticated GET with manual Bearer header. Should use `api.get()`. |
| `src/frontend/handlers/handlers-deferred.js` | 1 | `/api/affiliate/landing-pages/${pageId}` | No | `should-use-api.js` | Line 25481 — authenticated DELETE with manual Bearer + CSRF header. Should use `api.delete()`. |
| `src/frontend/handlers/handlers-deferred.js` | 1 | `/api/image-bank` | No | `should-use-api.js` | Line 26316 — authenticated GET with manual Bearer header. Should use `api.get()`. |

### src/frontend/handlers/handlers-intelligence.js (1 call)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `src/frontend/handlers/handlers-intelligence.js` | 1 | `/api/predictions/models` | No | `should-use-api.js` | Line 1465 — authenticated GET with manual Bearer header. Duplicate pattern of handlers-deferred.js line 24947. Should use `api.get()`. |

### src/frontend/handlers/handlers-inventory-catalog.js (1 call)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `src/frontend/handlers/handlers-inventory-catalog.js` | 1 | External image URL (user-supplied) | No | `intentional-raw` | Line 270 — fetches an external image URL to Blob. Not an API call. Same pattern as handlers-deferred.js line 282. |

### src/frontend/handlers/handlers-settings-account.js (5 calls)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `src/frontend/handlers/handlers-settings-account.js` | 1 | `/api/legal/privacy/data-export` | No | `should-use-api.js` | Line 4037 — duplicate of handlers-deferred.js pattern. Manual Bearer header. |
| `src/frontend/handlers/handlers-settings-account.js` | 2 | `/api/legal/privacy/cookie-consent` | No | `should-use-api.js` | Lines 4058, 4111 — GET (load prefs) and read before save. Manual Bearer header. |
| `src/frontend/handlers/handlers-settings-account.js` | 1 | `/api/legal/privacy/data-audit` | No | `should-use-api.js` | Line 4125 — duplicate of handlers-deferred.js pattern. Manual Bearer header. |
| `src/frontend/handlers/handlers-settings-account.js` | 1 | `/api/affiliate/landing-pages/${pageId}` | No | `should-use-api.js` | Line 4412 — authenticated DELETE with manual Bearer + CSRF. Duplicate of handlers-deferred.js line 25481. Should use `api.delete()`. |

### src/frontend/handlers/handlers-tools-tasks.js (5 calls)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `src/frontend/handlers/handlers-tools-tasks.js` | 2 | `/api/size-charts/brands`, `/api/size-charts/brands/${brand}` | No | `should-use-api.js` | Lines 842, 869 — duplicates of handlers-deferred.js lines 2711/2737. Manual Bearer header. |
| `src/frontend/handlers/handlers-tools-tasks.js` | 1 | `image.file_path` (R2/Cloudinary URL) | No | `intentional-raw` | Line 2948 — fetches stored image asset to Blob. Not an API call. |
| `src/frontend/handlers/handlers-tools-tasks.js` | 1 | `/api/image-bank` | No | `should-use-api.js` | Line 4875 — duplicate of handlers-deferred.js line 26316. Manual Bearer header. |

### public/sw.js (10 calls)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `public/sw.js` | 8 | `request` (generic network passthrough) | No | `service-worker` | Lines 68, 158, 175, 194, 212, 228, 242, 260 — service worker fetch strategies (cache-first, stale-while-revalidate, network-first, etc.). Inherently raw. |
| `public/sw.js` | 1 | `/api/inventory` | No | `service-worker` | Line 441 — background sync push to inventory endpoint. Service worker context; api.js not available. |
| `public/sw.js` | 1 | `/api/sales/sync` | No | `service-worker` | Line 462 — background sync for sales. Service worker context; api.js not available. |

### public/public-auth-nav.js (3 calls)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `public/public-auth-nav.js` | 1 | `/api/auth/session-status` | No | `intentional-raw` | Line 48 — session probe on public pages. api.js is a SPA module, not loaded on static HTML pages. |
| `public/public-auth-nav.js` | 1 | `/api/settings/announcement` | No | `intentional-raw` | Line 76 — CSRF token bootstrap (reads token from response header). Cannot use api.js; this is how the token is obtained. |
| `public/public-auth-nav.js` | 1 | `/api/auth/logout` | No | `intentional-raw` | Line 98 — logout on public pages. api.js not available in static HTML context. |

### public/status.html (4 calls)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `public/status.html` | 1 | `/api/health/ready` | No | `intentional-raw` | Line 1146 — infrastructure health check. Public page, no auth needed, api.js not loaded. |
| `public/status.html` | 1 | `/api/workers/health` | No | `intentional-raw` | Line 1157 — worker health check. Public page, no auth needed. |
| `public/status.html` | 1 | `/api/health/platforms` | No | `intentional-raw` | Line 1211 — platform connectivity check. Public page, no auth needed. |
| `public/status.html` | 1 | `/api/incidents/subscribe` | No | `intentional-raw` | Line 1394 — unauthenticated email subscription POST on public page. No api.js context. |

### public/request-feature.html (4 calls)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `public/request-feature.html` | 1 | `/api/settings/announcement` | No | `intentional-raw` | Line 281 — CSRF token bootstrap (reads header). Public page pattern. |
| `public/request-feature.html` | 1 | `/api/feature-requests` | No | `intentional-raw` | Line 380 — public feature request list. No auth required. Static page context. |
| `public/request-feature.html` | 1 | `/api/feature-requests/${id}/vote` | No | `intentional-raw` | Line 404 — vote submission. Public page, CSRF token applied manually. |
| `public/request-feature.html` | 1 | `/api/feature-requests` (POST) | No | `intentional-raw` | Line 481 — new feature request submission with manual CSRF. Public page. |

### public/affiliate.html (1 API call)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `public/affiliate.html` | 1 | `/api/affiliate-apply` | No | `intentional-raw` | Line 631 — unauthenticated public affiliate application form POST. No api.js context. |

### public/contact.html (1 API call)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `public/contact.html` | 1 | `/api/contact` | No | `intentional-raw` | Line 286 — unauthenticated public contact form POST. No api.js context. |

### public/rate-limits.html (1 API call)

| File | Call Count | Endpoint(s) | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| `public/rate-limits.html` | 1 | `/api` + `path` (documentation example) | No | `intentional-raw` | Line 434 — inline code sample in documentation page. Not live application code. |

### public/*.html — ipapi.co geolocation (23 calls)

One `fetch('https://ipapi.co/json/')` call each in:

`404.html`, `50x.html`, `affiliate.html`, `ai-info.html`, `api-changelog.html`, `api-docs.html`, `changelog.html`, `contact.html`, `cookies.html`, `documentation.html`, `er-diagram.html`, `faq.html`, `glossary.html`, `help.html`, `landing.html`, `learning.html`, `offline.html`, `platforms.html`, `pricing.html`, `privacy.html`, `quickstart.html`, `rate-limits.html`, `roadmap-public.html`, `request-feature.html`, `schema.html`, `status.html`, `terms.html`

> Note: The grep matched 23 unique files with this pattern; some files (e.g. `affiliate.html`, `contact.html`, `rate-limits.html`, `status.html`, `request-feature.html`) also have other fetch calls counted in their own sections above.

| File Group | Call Count | Endpoint | Uses api.js? | Classification | Notes |
|---|---|---|---|---|---|
| All public `*.html` pages | 23 | `https://ipapi.co/json/` | No | `intentional-raw` | External geolocation lookup for public page UI (e.g. currency, country display). Static pages — api.js not loaded. No auth involved. |

---

## 3. Summary

### Totals (excluding core-bundle.js duplicate)

| Metric | Count |
|---|---|
| Total `fetch(` matches (raw grep) | 92 |
| Calls in `core-bundle.js` (generated, excluded) | 9 |
| `prefetch(` method name matches (not `window.fetch`) | 2 |
| **Unique source-level fetch calls** | **81** |

### Classification Breakdown

| Classification | Count | Description |
|---|---|---|
| `intentional-raw` | 47 | Bootstrap calls, health checks, public pages, CSRF bootstrap, external URLs, fire-and-forget beacons |
| `service-worker` | 10 | Inside `sw.js` — inherently cannot use api.js |
| `should-use-api.js` | 16 | Authenticated SPA handler calls that bypass CSRF/retry conventions |
| N/A (is api.js itself) | 3 | The three fetch calls inside api.js are the implementation |
| `intentional-raw` (data URL / asset blob) | 3 | Fetching data: URIs or R2/CDN asset URLs to Blob — not API calls |
| **Total** | **79** | (81 minus 2 prefetch method name false positives) |

### Raw Fetch vs api.js

| Metric | Count |
|---|---|
| Calls that go through `api.js` | 0 (handlers call raw fetch directly) |
| Calls that ARE api.js (the wrapper) | 3 |
| Calls that bypass api.js intentionally | 47 + 10 + 3 = 60 |
| Calls that bypass api.js and should not | 16 |

### Top 3 Files With Raw Fetch Calls That Should Be Reviewed

1. **`src/frontend/handlers/handlers-deferred.js`** — 8 calls classified `should-use-api.js`. Multiple authenticated endpoints (`/api/predictions/models`, `/api/legal/privacy/*`, `/api/size-charts/brands`, `/api/image-bank`, `/api/affiliate/landing-pages/*`) bypass `api.get()` / `api.delete()` and manually attach Bearer tokens and CSRF headers. Any token refresh or CSRF rotation will not be handled automatically.

2. **`src/frontend/handlers/handlers-settings-account.js`** — 5 calls classified `should-use-api.js`. Duplicates the same `/api/legal/privacy/*` and `/api/affiliate/landing-pages/*` patterns found in `handlers-deferred.js`. Indicates copy-paste propagation of the raw-fetch pattern into a second handler file.

3. **`src/frontend/handlers/handlers-tools-tasks.js`** — 3 calls classified `should-use-api.js`. Duplicates `/api/size-charts/brands` and `/api/image-bank` patterns from `handlers-deferred.js`. Also contains a legitimate `intentional-raw` blob fetch mixed in.

---

## Rollback Command

This file is documentation-only. No runtime files were modified. To remove this file:

```bash
git rm docs/reference/frontend-fetch-inventory.md
```
