# Chrome Extension Security & Governance Audit -- VaultLister 3.0

**Date:** 2026-03-19
**Auditor:** Security & Governance QA (Claude Sonnet 4.6)
**Scope:** chrome-extension/manifest.json, background/service-worker.js, popup/popup.js, popup/popup.html, options/options.js, options/options.html, content/autofill.js, content/scraper.js, lib/api.js, lib/logger.js; cross-referenced with src/backend/routes/extension.js and src/backend/server.js.

---

## Methodology

Every file was read in full. Findings are based on verified source code only. No claims are made about runtime behaviour that could not be confirmed from static source. "Not found" means the pattern was searched for and explicitly absent.

---

## Findings Table

| ID | File | Line(s) | Severity | Category | Description |
|---|---|---|---|---|---|
| EXT-01 | manifest.json | -- | **High** | CSP Missing | No content_security_policy key exists in the manifest. MV3 extensions receive the Chrome default extension CSP. Its absence means no one has audited the effective policy, and a future sandbox page would inherit a permissive policy silently. Neither popup.html nor options.html carry a CSP meta tag. Verified by grep -- no match. |
| EXT-02 | manifest.json | 13-21 | **High** | Permission Scope -- HTTP host in production build | host_permissions includes http://localhost:3000/*. Shipping this alongside https://vaultlister.com/* in the same release artifact grants the extension access to any plaintext HTTP server on localhost:3000. api.request() adds the Authorization header unconditionally without checking the URL scheme. No build step strips the localhost entry for production releases. |
| EXT-03 | manifest.json | 6-11 | **Medium** | Permission Scope -- notifications over-grant | The notifications permission is declared unconditionally. An XSS in any future innerHTML sink would gain the ability to fire native OS notifications from the injected context. |
| EXT-04 | lib/api.js | 22-23 | **High** | Token Storage -- no refresh token, no expiry handling | Only auth_token is stored in chrome.storage.local. There is no refresh token, no expiry timestamp, and no proactive token renewal. When the 15-minute access token expires, api.request() receives a 401, calls clearToken() (line 60), and throws -- silently logging the user out of the extension. No audit event is fired on token invalidation. |
| EXT-05 | lib/api.js | 5-11, 40-56 | **High** | Network -- no HTTPS enforcement on baseUrl | resolveBaseUrl() returns whatever string is in chrome.storage.local under api_base_url. If the stored value is the default http://localhost:3000/api, all requests including Bearer tokens go over unencrypted HTTP. request() adds the Authorization header with no URL scheme check. |
| EXT-06 | lib/api.js | 52-74 | **Medium** | Error Handling -- network failure indistinguishable from server error | fetch() exceptions (connection refused, timeout) fall into the same catch block as HTTP error responses. loadStats() in popup.js swallows all errors with .catch(() => ({ count: 0 })). Users see stale zero counts with no offline indication. No retry or degraded-mode UI exists. |
| EXT-07 | background/service-worker.js | 4-5, 73, 123 | **High** | MV3 Compliance -- token race on service worker wake | api.js is imported for its side effects; the VaultListerAPI constructor fires _init() (async storage read) on every module evaluation. Service workers are re-evaluated on every wake from dormancy. Neither the onMessage handler (line 73) nor the onAlarm handler (line 123) awaits api.loadToken() before calling api.* methods. Any handler that fires before _init() resolves uses a null token and the hardcoded localhost baseUrl. |
| EXT-08 | background/service-worker.js | 73-85 | **High** | Message Passing -- no sender validation | chrome.runtime.onMessage.addListener at line 73 accepts messages from any sender without checking sender.id, sender.tab, or sender.origin. A web page on any of the host_permissions origins that obtains a reference to the extension runtime can send { action: productScraped, data: {...} } and write arbitrary data to the backend as the authenticated user, or trigger getInventoryItems to exfiltrate inventory data. |
| EXT-09 | content/autofill.js | 317-321 | **Medium** | Message Passing -- content script onMessage no sender validation | The content-script listener at line 317 accepts fillForm messages from any sender without checking sender.id. A page-world script could send a crafted fillForm payload to populate marketplace listing forms with attacker-controlled field values. |
| EXT-10 | content/autofill.js | 224-227 | **Medium** | XSS -- displayError interpolates raw message into innerHTML | displayError(message) sets container.innerHTML with the message parameter unescaped. Both current callers pass hardcoded strings so this is safe today. If any future code path passes response.error from the server, stored-XSS executes inside the host page DOM. Must use textContent or escapeHtml(). |
| EXT-11 | content/autofill.js | 196-220 | **Low** | XSS surface -- inline event handlers expose global callable | displayItems() builds HTML with inline onmouseover, onmouseout, and onclick attribute handlers. This exposes window.fillFormWithItem as a globally callable function on the host page. Any page-world script can call window.fillFormWithItem(arbitraryString) directly without the message channel. |
| EXT-12 | content/autofill.js | 190 | **Low** | Data flow -- double-escape corruption in data-item attribute | Item objects are JSON-serialised then HTML-escaped into a data-item attribute. escapeHtml converts & to &amp; inside JSON string values. When the attribute is read back via dataset.item, the browser returns the HTML-unescaped value, so JSON.parse receives &amp; in place of &. Any item field containing &, <, >, or double-quotes is silently corrupted on round-trip. |
| EXT-13 | background/service-worker.js | 167-190 | **High** | Privacy -- service worker fetches arbitrary external URLs | scrapePrice(url) performs fetch(url) where url comes from product.listing_url or product.source_url -- values stored in the backend without host or scheme validation. If an attacker writes a crafted URL to the price-tracking table (via EXT-08 injection), the service worker fetches that URL from the user browser context. No credentials: omit is set. No Content-Type check is performed. |
| EXT-14 | background/service-worker.js | 62-65 | **Medium** | Open Redirect -- cross-list image opens storage-controlled URL | The cross-list-image handler constructs a tab URL as ${appUrl}?action=crosslist&image=... where appUrl derives from api.baseUrl which is read from user-controlled extension storage. If api_base_url is set to an attacker-controlled origin, chrome.tabs.create opens that page in a new tab. |
| EXT-15 | popup/popup.js | 129 | **Medium** | Information Disclosure -- raw server error in login toast | showToast("Login failed: " + error.message) exposes the raw server error string. If the backend distinguishes user-not-found from wrong-password, the popup leaks account enumeration information. The toast uses textContent (no XSS) but the disclosure stands. |
| EXT-16 | popup/popup.js | 151-153, 180-182 | **Low** | URL check bypass -- substring match on tab URL | tab.url.includes("amazon.com") passes for https://evil.com/?amazon.com=1. Should use new URL(tab.url).hostname.endsWith(".amazon.com"). Repeated for the price-track button. |
| EXT-17 | lib/api.js | 87-89 | **Medium** | Token Lifecycle -- logout does not revoke server-side session | logout() only clears local storage. It does not call POST /api/auth/logout. The JWT remains valid on the server for the remainder of its 15-minute window after the user logs out of the extension. |
| EXT-18 | background/service-worker.js | 14-39 | **Medium** | Memory -- context menus re-created on every extension update | chrome.contextMenus.create is called inside onInstalled which fires on both first install and every extension update. In MV3, calling contextMenus.create with an existing ID on update throws Unchecked runtime.lastError. There is no removeAll guard before the create calls. |
| EXT-19 | background/service-worker.js | 52-57, 94-99, 144-149 | **Low** | Notification -- no deduplication possible | chrome.notifications.create is called without a notification ID at all three call sites. Chrome auto-generates IDs, making it impossible to coalesce notifications. Multiple price-drop events fire independent unbounded notifications. |
| EXT-20 | background/service-worker.js | 147-149 | **Low** | Trust/Safety -- raw server-supplied product title in notification | message: product.title puts an unsanitised server-supplied string into a native OS notification. A title containing RTL override characters can make the notification appear to be from a different app. |
| EXT-21 | lib/api.js | 154-157 | **Medium** | Global scope -- api.token readable and writable by any module | api is attached to self/globalThis. The token property is a plain public field, not read-only. Any imported module can read or overwrite self.api.token directly, bypassing class methods and their logging. |
| EXT-22 | options/options.js | 34-41 | **Low** | Options -- no URL validation on stored value | saveSettings() stores the selected radio value without validation. The current UI only offers two hardcoded values so the risk is low today. resolveBaseUrl() in api.js performs no validation; a developer setting an arbitrary URL via DevTools causes all auth-bearing requests to go to that host. |
| EXT-23 | src/backend/routes/extension.js | 91, 261, 365 | **High** | Backend -- missing explicit auth guard on three handlers | POST /price-tracking (line 91), POST /quick-add (line 261), and POST /scraped (line 365) have no explicit if (!user) return 401 check. They proceed directly to body destructuring and then reference user.id, which throws TypeError if user is null. The outer middleware provides protection but the missing in-handler guard eliminates defence-in-depth. Compare: POST /scrape (line 31) includes the explicit guard. |
| EXT-24 | src/backend/routes/extension.js | 665-704 | **High** | Backend -- action_type stored without whitelist or length limit | POST /extension/sync stores the caller-supplied action_type string directly into extension_sync_queue.action (line 681) with no allowed-values enum check and no max-length constraint. An authenticated user can store arbitrary strings of any length, polluting the sync queue and causing unexpected behaviour in any downstream processor that switches on action_type. |
| EXT-25 | src/backend/routes/extension.js | 748 | **Critical** | Backend -- sync process regex never matches real IDs (functional bug) | The route match regex is /^\/sync\/[a-f0-9-]+\/process$/. Sync IDs are generated as sync_${Date.now()}_${UUID fragment} (line 676), which contains underscores and decimal digits outside a-f. Every processSyncItem call from the popup returns 404. Sync items are permanently stuck in pending status. This is a critical functional regression catchable by a single integration test. |
| EXT-26 | src/backend/routes/extension.js | all handlers | **Medium** | Backend -- no rate limiting on extension API endpoints | No handler in extension.js invokes rateLimiter() middleware. Authenticated users can call POST /extension/scraped, POST /extension/sync, and price-tracking endpoints at unlimited frequency, enabling storage exhaustion. |
| EXT-27 | background/service-worker.js | 167-190 | **Medium** | Privacy -- price-tracking fetch carries ambient browser state | scrapePrice() calls fetch(url) without credentials: omit. The request is visible to the retail site as a browser-origin poll, enabling user fingerprinting. |
| EXT-28 | background/service-worker.js | 169-175 | **Medium** | Robustness -- no timeout or response size limit on scrapePrice | fetch(url) has no AbortController timeout signal. A slow or hung server stalls the service worker. response.text() has no size limit; a large retail page is fully buffered in service worker memory. |
| EXT-29 | content/scraper.js | 77 | **Low** | Privacy -- sourceUrl includes session tracking parameters | window.location.href is returned as sourceUrl and stored in the backend. Amazon and Nordstrom URLs commonly contain affiliate tags and session identifiers stored verbatim in scraped_products.source_url. |
| EXT-30 | popup/popup.html | 117-119 | **Low** | MV3 Compliance -- classic script loading creates implicit global dependency | api.js and popup.js are loaded as classic scripts. The popup depends on the global api being defined before popup.js executes. If Chrome defers one script, popup.js throws ReferenceError: api is not defined. |

---

## Summary by Severity

| Severity | Count | IDs |
|---|---|---|
| Critical | 1 | EXT-25 |
| High | 9 | EXT-01, EXT-02, EXT-04, EXT-05, EXT-07, EXT-08, EXT-13, EXT-23, EXT-24 |
| Medium | 12 | EXT-03, EXT-06, EXT-09, EXT-10, EXT-14, EXT-15, EXT-17, EXT-18, EXT-21, EXT-26, EXT-27, EXT-28 |
| Low | 8 | EXT-11, EXT-12, EXT-16, EXT-19, EXT-20, EXT-22, EXT-29, EXT-30 |

---

## Automated Coverage Assessment

**Zero automated test coverage exists for the Chrome extension layer.**

- src/backend/routes/extension.js has no dedicated test file and is not referenced in any test file in this codebase.
- No E2E or Playwright tests exercise the popup, content scripts, or service worker.
- EXT-25 (sync process regex) is a blocking functional bug catchable by a single integration test. It has been present since the route was written.

**Manual-only verification required for:**
- EXT-07 (token race on wake) -- requires browser DevTools Extension inspector.
- EXT-08, EXT-09 (message injection) -- requires a crafted attacker page.
- EXT-13 (arbitrary URL fetch) -- requires a poisoned price-tracking DB entry.
- EXT-27 (credential-carrying fetch) -- requires network traffic inspection.

---

## Targeted Tests to Write

| Test ID | Description | Suggested File |
|---|---|---|
| T-EXT-01 | POST /api/extension/sync/:id/process with a real ID (e.g., sync_1710000000000_abc12345) returns 200 not 404 | src/tests/extension-api.test.js |
| T-EXT-02 | POST /api/extension/sync with action_type of 5000 chars returns 400 after adding length limit | src/tests/extension-api.test.js |
| T-EXT-03 | POST /api/extension/scraped called 100 times rapidly is rate-limited after threshold | src/tests/extension-api.test.js |
| T-EXT-04 | POST /api/extension/scraped without Authorization returns 401 | src/tests/extension-api.test.js |
| T-EXT-05 | POST /api/extension/price-tracking without Authorization returns 401 | src/tests/extension-api.test.js |
| T-EXT-06 | POST /api/extension/quick-add without Authorization returns 401 | src/tests/extension-api.test.js |
| T-EXT-07 | PATCH /api/extension/price-tracking/:id from a different user returns 404 not 200 (IDOR check) | src/tests/extension-api.test.js |
| T-EXT-08 | displayError() with HTML payload does not inject markup into DOM after fix to textContent | unit test |

---

## Recommended Fix Priority

1. **EXT-25 (Critical -- blocking functional bug):** Fix the process route regex from `[a-f0-9-]` to `[\w-]` or use a string prefix match against the actual ID format. The entire sync-process workflow is silently broken for all users.
2. **EXT-08 (High -- message injection):** Add `if (sender.id !== chrome.runtime.id) return` to all onMessage handlers in the service worker and content scripts.
3. **EXT-07 (High -- token race):** Add `await api.loadToken()` at the top of the onMessage and onAlarm handlers before any api.* call.
4. **EXT-05 + EXT-02 (High -- token over HTTP):** Add URL scheme check in api.request() -- refuse to attach the Authorization header if baseUrl uses http: and the host is not localhost. Add a production build step to remove the localhost host_permission entry.
5. **EXT-04 (High -- no token refresh):** Store and use the refresh token, or display a clear session-expired state rather than silently resetting credentials.
6. **EXT-23 + EXT-24 (High -- missing guards and action_type whitelist):** Add explicit `if (!user) return { status: 401, ... }` to the three handlers that lack it. Add an allowed-values enum and max-length constraint for action_type.
7. **EXT-13 (High -- arbitrary URL fetch):** Validate listing_url and source_url against a scheme and hostname allowlist before fetching. Add `credentials: omit` and an AbortController timeout of 10 seconds.
8. **EXT-01 (High -- no explicit CSP):** Add content_security_policy.extension_pages to manifest.json to make the policy explicit and auditable.