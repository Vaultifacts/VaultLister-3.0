# Competitor Anti-Detection + Rate-Limit Intelligence — 2026-04-19

Extracted directly from 10 Chrome extension JS bundles via regex analysis. All quotes are from decompiled/minified source.

---

## Comparison Matrix

| Category | PrimeLister | Crosslist | Crosslist Magic | SellerAider | Flyp Crosslister | Flyp Bot Sharer | Nifty | OneShop | Closo | Vendoo |
|---|---|---|---|---|---|---|---|---|---|---|
| Randomized delays | No | Yes | No | No | No | Yes | No | No | Yes | No |
| Exponential backoff | Yes | No | No | No | No | No | No | No | No | No |
| CAPTCHA solving | No | Partial | No | No | No | Yes (2captcha+AntiCaptcha) | No | No | No | No |
| UA/sec-ch-ua spoofing | No | Yes | No | Yes | No | No | No | No | No | No |
| Header rewriting (DNR) | No | Yes | Yes | No | Yes | No | No | No | No | Yes |
| Origin/Referer injection | No | Yes | Yes | No | Yes | No | No | No | No | Yes |
| MouseEvent dispatching | No | No | No | No | No | No | No | No | Yes | No |
| Headless detection | No | No | No | No | No | No | No | No | No | Yes |
| Daily cap tracking | No | No | No | No | No | Yes | No | No | No | No |
| Chrome Alarms keep-alive | No | No | No | No | No | No | No | No | Yes | Yes |

---

## Per-Extension Findings

### PrimeLister (eepbhjeldlodgnndnjofcnnoampciipg — 2.0.125)
Main files: `panel.6bd34c46.js` (2829KB), `router.8c53223e.js` (2498KB)

#### Timing / Randomization
Fixed sequential sleeps. Sleep values observed: 100ms, 300ms, 500ms, 1000ms, 2500ms.
```js
static sleep(e){return new Promise(t=>setTimeout(t,e))}
```
Step-between-actions pattern with `waitForSelector` loops (6 retries, 1000ms each). Storage operations retry 4× with 2000ms between attempts.

#### Rate Limits
No hardcoded per-platform caps found. Exponential backoff on network errors:
```js
delay: e => .3*2**(e-1)*1e3   // 300ms, 600ms, 1200ms...
```
`backoffLimit: Number.POSITIVE_INFINITY` — no cap on backoff.

#### CAPTCHA Handling
Zero CAPTCHA references in either main bundle. PrimeLister does not implement CAPTCHA solving.

#### Fingerprint Spoofing
None detected. Panel bundle contains `navigator.scheduling.isInputPending` checks (internal React scheduling, not anti-detection).

#### Header / Request Crafting
No header manipulation rules file found. Requests go through normal fetch without header override.

#### Click / Mouse Patterns
jQuery `.trigger("click")` used for UI interaction. No MouseEvent coordinate spoofing.

#### Session / Cookie Rotation
`waitForSelector` loops (6 attempts × 1000ms) serve as implicit auth-check. Log rotation with random TTL: `Math.floor(5e3*Math.random())+1e3` for log expiry (not for request timing).

#### Error Codes
Exponential backoff triggers on any fetch error. `afterStatusCodes` array not explicitly enumerated in extracted context.

#### Stealth Markers
No playwright/webdriver/headless references found.

#### DOM Selectors
jQuery-based selectors using `:contains()`, class names, and `data-et` attributes. No fallback selector chains observed.

#### Timing Distribution
- Action steps: 300ms fixed → 500ms fixed → 1000ms fixed
- Storage retries: 2000ms fixed × 4 attempts
- No jitter on action delays

---

### Crosslist (knfhdmkccnbhbgpahakkcmoddgikegjl — 3.9.13)
Main file: `background.js` (1641KB)

#### Timing / Randomization
Randomized delays on pagination and listing loops:
```js
await new Promise(_=>setTimeout(_,1e3+Math.random()*500))   // 1000–1500ms
await new Promise(b=>setTimeout(b,1500+Math.random()*1e3))  // 1500–2500ms
await Ae(M+Math.random()*k)  // where M=1000–3000, k=500–2000 depending on context
```
A loop guard exits after 25 iterations or 500 items, then delays 2000ms + random.

#### Rate Limits
Vinted: per-category and per-all rate limits read from `Retry-After` response header; 60-second default if header absent.
```js
var delay = (!isNaN(headerDelay) ? headerDelay : 60) * 1000;
updatedRateLimits.all = now + delay;
```
No per-platform numeric daily caps found in extracted code.

#### CAPTCHA Handling
4 references — Vinted only. User-in-the-loop: detects `captcha` in response URL, surfaces a link for user to solve manually:
```
"Vinted requires you to complete a captcha before listing further. Click here to complete the captcha."
```

#### Fingerprint Spoofing
Full `sec-ch-ua` header stack dynamically spoofed using `navigator.userAgentData`:
```js
navigator.userAgentData  // reads real UA data
chrome.declarativeNetRequest.updateDynamicRules(...)  // then replays it via DNR
// Sets: sec-ch-ua, sec-ch-ua-platform, sec-ch-ua-platform-version,
//       sec-ch-ua-full-version, sec-ch-ua-full-version-list, sec-ch-ua-mobile
```
This makes extension-originated requests look identical to browser-native requests.

#### Header / Request Crafting
Full `declarativeNetRequest` header stack for XHR requests:
```
cache-control, sec-fetch-site=same-origin, sec-fetch-mode=navigate,
sec-fetch-dest=document, sec-fetch-user=?1, upgrade-insecure-requests=1,
sec-ch-ua (dynamic from userAgentData)
```
`marketplaceRules.json`: per-platform origin/referer injection rules for Depop, Facebook, Mercari, etc. Hardcoded referer: `https://www.depop.com/products/create/`, `https://www.facebook.com/marketplace/create/item`.

#### Click / Mouse Patterns
Not present — Crosslist uses background service worker for API calls, not DOM interaction.

#### Session / Cookie Rotation
CSRF token read from cookie store: `chrome.cookies.get({url, name:"csrf_token"})`.

#### Error Codes
`Error code=${e.statusCode||"NA"}: ${e.errorType||"GENERIC"}` — generic error envelope. Sentry integrated.

#### Stealth Markers
No webdriver/headless references.

#### DOM Selectors
Minimal DOM interaction (API-first architecture).

#### Timing Distribution
- Pagination between pages: 1000–1500ms
- Between sales scan pages: 1500–2500ms
- On Vinted (US): `Math.floor(Math.random()*5001)+20000` = 20000–25001ms (likely Vinted-specific aggressive throttle)

---

### Crosslist Magic (lkjldebnppchfbcgbeelhpjplklnjfbk — 0.0.337)
Main files: `src/background.js` (1299KB), `rules/modify-origin.json`

#### Timing / Randomization
No setTimeout values found in background.js. Async orchestration only with `await Promise.all(...)`.

#### Rate Limits
None found.

#### CAPTCHA Handling
Zero references.

#### Header / Request Crafting
`modify-origin.json` handles Origin header injection for Whatnot and Whatnot S3 image uploads:
```json
{ "header": "Origin", "operation": "set", "value": "https://www.whatnot.com" }
{ "header": "referer", "operation": "set", "value": "https://www.whatnot.com/" }
```
Also strips CSP from Facebook frames (same pattern as Flyp Crosslister).
CSP-clearing for Whatnot, Facebook, and other platforms to allow cross-origin injection.

#### Stealth Markers
None.

#### DOM Selectors
39 content scripts (CSS files) targeting platform-specific CSS selectors for each marketplace.

---

### SellerAider (hoadkegncldcimofoogeljainpjpblpk — 1.0.8.53)
Main files: `background.bundle.js` (257KB), `poshmark.bundle.js` (784KB), `depop.bundle.js` (783KB), `crosslister.bundle.js` (786KB)

#### Timing / Randomization
Minimal timer usage (0ms, 10ms — React scheduler internals). No deliberate action delays found.

#### Rate Limits
None hardcoded. Auth errors on 401 clear the connected state:
```js
return 401===n.status?(chrome.storage.sync.set({connected:false}),null)
```

#### CAPTCHA Handling
Zero CAPTCHA references.

#### Fingerprint Spoofing
Device identity headers sent on every Poshmark API request:
```js
"x-uw-session-id": t,
"x-device-id": n,
"x-device": navigator.userAgent,
"user-agent": navigator.userAgent,
"x-locale": "en_CA",
"x-version": "3.116.2"
```
Depop bundle spoofs a mobile UA:
```js
"User-Agent": "Depop Android (SAMSUNG SM-G977N - 8.1.0;*en_US)"
```

#### Click / Mouse Patterns
React event system only — no custom `dispatchEvent` for automation.
Crosslister bundle uses `dispatchEvent(new Event('input', {bubbles:true}))` and `dispatchEvent(new Event('change', {bubbles:true}))` for React-managed inputs. Upload triggered with:
```js
b.dispatchEvent(new Event("input")); // trigger file input
```

#### Session / Cookie Rotation
Custom `x-uw-session-id` and `x-device-id` sent with requests, suggesting server-side session tracking per device.

#### Error Codes
`retryDelay` passed in options object — configurable retry timing. Generic catch→retry pattern.

#### Stealth Markers
PostHog analytics integrated. No webdriver references.

#### DOM Selectors
Crosslister uses chained `waitForDocumentNode({query: "..."})` with fallback polling.

---

### Flyp Crosslister (kbflhgfmfbghhjafnjbgpiopcdjeajio — 1.0.4)
Main files: `background.js` (479KB), `poshmark.js` (379KB), `rules.json`

#### Timing / Randomization
Only 0ms timers (Promise scheduling). No action delays found.

#### Rate Limits
None hardcoded.

#### CAPTCHA Handling
Zero references.

#### Header / Request Crafting
`rules.json` — declarativeNetRequest rules:
- Poshmark: sets `origin: https://poshmark.com`
- Mercari: sets `origin: https://www.mercari.com`, `referer: https://www.mercari.com/sell/`, `User-Agent: mercari_b/flyp`
- Facebook: sets `origin: https://www.facebook.com`
- Depop: sets `origin: https://www.depop.com`, `referer: https://www.depop.com/products/create/`
- Facebook: strips `content-security-policy` from response headers (blank value)

The Mercari `User-Agent: mercari_b/flyp` is notable — it spoofs a Mercari internal bot identifier.

#### Click / Mouse Patterns
`MouseEvent` definitions present in test utility bundle (bubbles: true, cancelable: true, button: 0). Not used for automation — appears to be testing framework artifacts.

#### Stealth Markers
None.

---

### Flyp Bot Sharer (ehicjmkogfjifombjmdinmhpaghfggcd — 1.7.6)
Main file: `background.js` (1111KB) — 156 CAPTCHA references

#### Timing / Randomization
Core sharing timing is fully randomized within a user-selected speed band:
```js
const generateRandomTime = sharingSpeed => {
  return Math.floor(Math.random() * (sharingSpeed.max - sharingSpeed.min) + sharingSpeed.min);
};
```
Speed modes: `SLOW` and `FAST` (string enums). The numeric min/max values are passed at runtime from user settings storage — not hardcoded in the bundle. Each listing gets an independent random delay drawn from `[min, max)`.

Tasks are pre-scheduled: a timer accumulates (`timer += randomSpeed`) from `30s` initial offset, so actions are spaced as a Poisson-like process.

#### Rate Limits
Rate limits parsed from response headers. Default retry-after: 60 seconds:
```js
var DEFAULT_RETRY_AFTER = 60 * 1000;
function parseRetryAfterHeader(header, now = Date.now()) {...}
```
Poshmark `Retry-After` header consumed and respected.

#### CAPTCHA Handling
Full dual-provider CAPTCHA solving integration:
- **2captcha**: `https://2captcha.com/in.php?key=${providerKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=...`
- **AntiCaptcha**: clientKey + websiteKey task creation

Poshmark reCAPTCHA siteKey hardcoded: `6Lc6GRkTAAAAAK0RWM_CD7tUAGopvrq_JHRrwDbD`

User provides their own API key (stored as `POSHMARK_USER_DETAILS.ak2c` for 2captcha, `akac` for AntiCaptcha). Solve result (token) submitted back to Poshmark action. Daily captcha counter tracked in localStorage (`shareLimit.captcha`).

#### Fingerprint Spoofing
None specific to automation. Sentry telemetry uses `navigator.sendBeacon`.

#### Session / Cookie Rotation
Daily stats reset: tracks `{dateString, sharer: N, captcha: N}` keyed by date. Chrome storage ↔ localStorage sync via `chrome.storage.onChanged`.

#### Stealth Markers
No webdriver deletion. No `navigator.webdriver` tampering.

#### DOM Selectors
Via `shareListing` service — DOM interaction abstracted behind service layer. Selectors not directly visible in background script.

---

### Nifty (ggcfdkgmekpddencdddinlmpekbcohoa — 3.1.1)
Main files: `background.js` (1KB pure bridge), `index-G6cBpr4F.js` (510KB React app)

#### Timing / Randomization
No action delays. Background is a pure message bridge (1737 bytes).

#### Rate Limits / CAPTCHA / Fingerprint
None found. Nifty is a server-side orchestrated tool — the extension is minimal glue only.

#### Stealth Markers
React DevTools check: `navigator.userAgent.indexOf("Chrome")` and `indexOf("Firefox")` — React internal, not anti-detection.

---

### OneShop (pcapaniacmdmabfopeeimmpjkkjpeiok — 2)
Main file: `dist/js/background.js` (18KB — auth-only)

#### Timing / Randomization
One randomized polling interval:
```js
n = Math.floor(2e3 * Math.random()); setInterval(...)
```
0–2000ms randomized start offset for polling.

#### Auth / Session
GraphQL-based auth. Reads cookies for `x-sp-bm-token` (Shopify Bot Management token). On 401:
```js
chrome.storage.sync.set({OneShopConnected: false})
```
Re-auth strategy: `reauthStrategy: BROWSER_EXTENSION` passed in GraphQL variable.

#### Stealth Markers / CAPTCHA
None.

---

### Closo (aipjhdapgmimfdfcjmlpeoopbdldcfke — 3.1.42)
Main files: `background.js` (124KB), `poshmark_script.js` (70KB)

#### Timing / Randomization
Best-in-class jitter implementation among the 10:
```js
const DELAY_BETWEEN_SAVES_MS = 350
const DELAY_JITTER_MS = 150
const DELAY_BETWEEN_PAGES_MS = 1000
```
Effective range: 350–500ms between saves (uniform random jitter). Page transitions: 1000ms fixed. Action waits: 100ms (poll), 1500ms (finish), 15000ms (tick between full cycles).

#### Rate Limits
Chrome Alarms for long-running tasks (SW keep-alive):
```js
const KEEPALIVE_INTERVAL_MIN = 0.1     // every 6 seconds
const EXT_CONFIG_REFRESH_MIN = 360     // every 6 hours
SOLD_CHECK_INTERVAL_MIN = 15           // every 15 minutes
REST_POLL_INTERVAL_MIN = 1             // every 1 minute
chrome.alarms.create(OUTBOX_DRAIN_ALARM, { periodInMinutes: 0.5 })   // every 30s
chrome.alarms.create('processingIds_sweep', { periodInMinutes: 1 })  // every 60s
```
Retry cap: `RETRY_CAP = 120000` (120 seconds max backoff).
Outbox: max 5 attempts, 10ms initial retry, exponential to 120s cap.

#### CAPTCHA Handling
Zero references.

#### Click / Mouse Patterns
Real DOM automation with bubbling events:
```js
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
el.dispatchEvent(new Event('blur', { bubbles: true }));
```
Native `.click()` on buttons. No MouseEvent coordinate spoofing.
`data-test` attribute selectors used extensively:
```js
document.querySelector('[data-test="modal-container"]')
document.querySelector('[data-test="modal-close-btn"]')
```

#### Stealth Markers
None.

---

### Vendoo (mnampbajndaipakjhcbbaihllmghlcdf — 3.1.10)
Main files: `service_worker.js` (263KB), `vendooWeb.js` (60KB), `corsRules.json` (9KB)

#### Timing / Randomization
No action delays. Server-side orchestration model.

#### Rate Limits
User-facing rate limit message: "Facebook temporarily blocked this sync process. Please wait 5 minutes."
Throttle detection: `e.status===429`. Ban detection: "userBanned: We had troubles accessing your account, it might be banned or inactive."

#### CAPTCHA Handling
One reference: "Please try listing an item directly on [platform]" — user-in-the-loop only.

#### Fingerprint Spoofing
Headless Chrome self-check:
```js
function _c(){return !!window.chrome || /HeadlessChrome/.test(window.navigator.userAgent)}
```
This detects if running headless — used for internal routing, not to hide from platforms.

#### Header / Request Crafting
`corsRules.json` — per-platform declarativeNetRequest rules:
- Depop: `origin=https://www.depop.com`, `referer=https://www.depop.com/products/create/`
- Facebook: `origin=https://www.facebook.com`, `referer=https://www.facebook.com/marketplace/create/item?ref=marketplace_vendoo`
- Poshmark, Etsy, Mercari, etc.: similar origin/referer injection patterns
- Response header: `Access-Control-Allow-Origin: *` injected to allow extension fetch

Fetch options use `mode: "cors"` and `keepalive: true` for analytics beacons.

#### Session / Cookie Rotation
Chrome Alarm for periodic sync: single named alarm (`Fi`), `delayInMinutes: OF`, `periodInMinutes: db`.

#### Stealth Markers
Sentry integrated. No webdriver tampering. `_c()` only detects headless for internal logic.

---

## VaultLister Recommendations

### Patterns to Copy (Proven in Production)

1. **Randomized action delays (Crosslist, Closo, Flyp Bot Sharer pattern)**
   Use `baseMs + Math.random() * jitterMs` for every action. Closo's 350+150ms is reasonable for Poshmark. Crosslist's 1000+500ms is appropriate for listing loops.

2. **declarativeNetRequest for Origin/Referer injection (Crosslist, Vendoo, Flyp)**
   All serious tools use DNR rules files rather than injecting headers in fetch() calls. This is the correct approach — headers set via DNR survive CORS preflight and appear browser-native. Create a `rules.json` per platform.

3. **sec-ch-ua dynamic spoofing (Crosslist)**
   Read real `navigator.userAgentData`, then replay it via DNR. This makes extension requests look identical to browser-native requests on platforms that check Client Hints.

4. **Chrome Alarms for SW keep-alive (Closo)**
   Service workers get evicted. Closo's 6-second keepalive alarm is the correct pattern to prevent mid-session SW eviction.

5. **Retry-After header parsing (Flyp Bot Sharer)**
   Consume the `Retry-After` header on any 429. Default 60 seconds. Cap at `RETRY_CAP = 120000ms`.

6. **data-test attribute selectors (Closo)**
   `[data-test="modal-container"]` selectors are more stable than CSS class selectors. Platforms frequently change class names. Use `data-test` or `data-testid` when available.

7. **bubbling dispatchEvent for React inputs (Closo, SellerAider)**
   React-managed inputs require `dispatchEvent(new Event('input', {bubbles:true}))` — bare `.value =` assignment doesn't trigger React state updates.

8. **Daily share counter tracking (Flyp Bot Sharer)**
   Track `{dateString, sharer: N}` in localStorage keyed by `YYYY-M-D`. Reset on date change. Required for daily cap enforcement.

9. **Depop mobile UA spoofing (SellerAider)**
   `"Depop Android (SAMSUNG SM-G977N - 8.1.0;*en_US)"` — Depop's API appears more permissive with Android UA. Inject via DNR rules.

10. **Mercari internal identifier (Flyp Crosslister)**
    `User-Agent: mercari_b/flyp` — Flyp uses a Mercari-formatted bot identifier. Suggests Mercari has a lenient path for known partners.

### Patterns to AVOID (Known Bot Signals)

1. **Fixed delays without jitter** — PrimeLister's 300ms → 500ms → 1000ms fixed sequence is a bot fingerprint. Any platform ML model will flag the regularity. Always add ±30–50% random jitter.

2. **`element.click()` without preceding mouse events** — bare `.click()` skips `mousedown`, `mouseup`, `pointerdown` events. Pages with click fraud detection (Facebook Marketplace especially) look for the full event sequence. Use `dispatchEvent(new PointerEvent('pointerdown'))` → `pointerup` → `click` sequence.

3. **No `Retry-After` consumption** — Crosslist Magic and SellerAider ignore rate limit headers and will hammer a 429 endpoint. Platforms track this as abusive behavior even on authenticated sessions.

4. **Extension origin leakage** — requests from `chrome-extension://...` origin are trivially detectable. All serious tools use DNR to rewrite the origin header. Requests without origin rewriting are immediately identifiable as extension traffic.

5. **HeadlessChrome in User-Agent** — Vendoo's self-check shows `/HeadlessChrome/` is a known detection string. Playwright/Camoufox must mask this.

6. **CAPTCHA bypass via external service on Poshmark** — Flyp Bot Sharer's 2captcha/AntiCaptcha integration works but requires user to supply API keys and incurs cost. Poshmark's reCAPTCHA trigger rate is the real signal — if sharing too fast, CAPTCHA frequency increases. Slowing down is cheaper than CAPTCHA solving.

### Unique Differentiators VaultLister Could Ship

1. **Gaussian (normal) timing distribution** — all 10 extensions use uniform random `[min, max]`. A Gaussian distribution centered on a "human mean" (e.g., μ=2s, σ=0.5s) would be more human-like and harder to detect statistically.

2. **Per-platform adaptive rate limiting** — track rolling success/failure rates per platform per session, auto-adjust delay multiplier on consecutive errors. None of the 10 tools do this dynamically.

3. **Full pointer event sequence** — only Closo and SellerAider use `bubbles: true` events; none send the full pointer event chain (`pointerdown` → `pointerup` → `click`). Implementing this for all click actions provides a meaningful detection-evasion edge.

4. **sec-ch-ua injection without reading real userAgentData** — Crosslist reads the real UA data and replays it. VaultLister could generate a synthetic but internally consistent sec-ch-ua / UA string per user session (e.g., always the same Chrome major version as their actual browser), making fingerprinting harder.

5. **Multi-provider CAPTCHA routing with fallback** — Flyp Bot Sharer hard-codes 2captcha or AntiCaptcha. VaultLister could route to CapSolver → 2captcha → user-in-the-loop as a priority chain, with cost tracking per solve.

---

# SUPPLEMENT: 21 Anti-Detection Techniques NO COMPETITOR Implements

Added 2026-04-19. Every technique below was searched across all 10 extensions and returned ZERO matches. These represent unguarded detection surface — marketplaces increasingly fingerprint on these vectors and no current competitor counters them. Each = potential VaultLister moat.

## A. Browser fingerprinting (10 techniques — ALL absent)

### A1. Canvas fingerprinting defense
- **What it is:** `canvas.toDataURL()` pixel output varies by GPU/OS → unique hash. FingerprintJS Pro, DataDome, PerimeterX all use this.
- **Competitor status:** 0/10 override canvas context methods.
- **Implementation:** MAIN-world script patches `HTMLCanvasElement.prototype.toDataURL` + `getImageData` to add sub-pixel jitter (±1 RGB value random).
- **Moat strength: HIGH** — #1 browser fingerprinting vector.

### A2. WebGL spoofing
- **What:** `getParameter(VENDOR/RENDERER)` exposes GPU. Headless Chrome returns distinct signature.
- **Status:** 0/10.
- **Implementation:** Override `WebGLRenderingContext.prototype.getParameter` to return a realistic GPU+driver combo matching UA.
- **Moat strength: HIGH.**

### A3. AudioContext fingerprinting
- **What:** `OfflineAudioContext` with oscillator+compressor → hash. Hardware-unique.
- **Status:** 0/10.
- **Implementation:** Patch `AudioBuffer.prototype.getChannelData` to add imperceptible jitter.
- **Moat strength: MEDIUM** — growing use in commercial anti-bot.

### A4. Font enumeration patching
- **What:** `document.fonts.check('12px "Arial"')` detects installed fonts. VPS bots lack common fonts.
- **Status:** 0/10.
- **Implementation:** Patch `document.fonts.check` to report a realistic US-English font set.
- **Moat strength: MEDIUM.**

### A5. Screen resolution / DPR spoofing
- **What:** Mismatched `screen.width/height` + viewport = bot signal.
- **Status:** 0/10.
- **Implementation:** Return dimensions from weighted pool of real-world distributions.
- **Moat strength: LOW-MEDIUM.**

### A6. deviceMemory / hardwareConcurrency
- **What:** VPS bots report low/uniform values (e.g., `deviceMemory=0.5`, `hardwareConcurrency=2`).
- **Status:** 0/10.
- **Implementation:** `Object.defineProperty(navigator, 'deviceMemory', ...)` at extension load.
- **Moat strength: LOW-MEDIUM.**

### A7. Plugins enumeration
- **What:** `navigator.plugins.length` inconsistency with UA = bot.
- **Status:** 0/10.
- **Implementation:** Return list consistent with spoofed UA.
- **Moat strength: LOW.**

### A8. Permissions API state
- **What:** Headless Chrome returns `denied` for notifications by default; real users have mix of `default`/`granted`/`prompt`.
- **Status:** 0/10.
- **Implementation:** Patch `Permissions.prototype.query` to return human-like states.
- **Moat strength: HIGH** — Poshmark + Mercari both check this.

### A9. navigator.keyboard layout
- **What:** Inconsistent keyboard layout vs stated locale = bot.
- **Status:** 0/10.
- **Implementation:** Return US-ANSI matching `navigator.language = "en-US"`.
- **Moat strength: LOW** — emerging technique.

### A10. Timezone + locale coherence
- **What:** `Intl.DateTimeFormat().resolvedOptions().timeZone` vs `navigator.language` vs geolocation. Inconsistency = bot.
- **Status:** 0/10.
- **Implementation:** Validate coherence; warn user of mismatches.
- **Moat strength: MEDIUM.**

## B. Protocol layer (3 techniques — ALL absent)

### B1. TLS fingerprinting (JA3/JA4)
- **What:** Server hashes ClientHello cipher suites, extensions, curves. Chrome/Firefox/Python-requests each produce distinct JA3. Akamai, Cloudflare, DataDome key on this.
- **Status:** 0/10 (can't be done from extension — TLS below extension API).
- **Implementation:** For backend workers: TLS-impersonation library (`utls` for Go, `curl_cffi` for Python).
- **Moat strength: CRITICAL** for any backend automation bypassing browser.

### B2. HTTP/2 frame ordering
- **What:** Bots using raw H2 libs send frames in non-browser order.
- **Status:** 0/10.
- **Implementation:** Backend: browser-faithful H2 client (Go net/http2 with Chrome ordering).
- **Moat strength: MEDIUM** backend-only.

### B3. WebRTC IP leak prevention
- **What:** WebRTC STUN reveals real IP even behind VPN. Marketplaces correlate with stated IP.
- **Status:** 0/10.
- **Implementation:** `chrome.privacy.network.webRTCIPHandlingPolicy = 'default_public_interface_only'` + patch `RTCPeerConnection`.
- **Moat strength: HIGH** for VPN/proxy users.

## C. Network layer (3 techniques — ALL absent)

### C1. IP rotation
- **What:** Rotate source IP per account/action to avoid correlation.
- **Status:** 0/10 (extensions can't change IP).
- **Implementation:** Backend proxy rotation for cloud automation; user-supplied residential proxies for extension-side.
- **Moat strength: HIGH at scale.**

### C2. Residential vs datacenter proxies
- **What:** Datacenter IPs (AWS/GCP/Azure) are blocklisted; residential IPs (BrightData, Oxylabs, IPRoyal, Soax) look like real consumers.
- **Status:** 0/10 have documented proxy integration.
- **Implementation:** Optional BrightData / Oxylabs / IPRoyal with user-supplied credentials.
- **Moat strength: HIGH** for power users.

### C3. Per-IP / per-account rate coordination
- **What:** Aggregate rate limiting across multiple accounts sharing an IP.
- **Status:** 0/10.
- **Implementation:** Backend orchestrator tracks per-IP budgets globally.
- **Moat strength: MEDIUM** for multi-account users.

## D. Advanced stealth (5 techniques — ALL absent)

### D1. Puppeteer / playwright-stealth markers
- **What:** `puppeteer-extra-plugin-stealth` patches ~25 automation tells (`navigator.webdriver`, plugin mismatches, permissions leaks, etc.).
- **Status:** 0/10 show stealth-library markers.
- **Implementation:** For Camoufox/Playwright workers: `playwright-extra` + stealth plugin. For extension: apply the same 25 techniques directly.
- **Moat strength: CRITICAL** for backend Camoufox workers.

### D2. CapMonster integration
- **What:** 3rd major CAPTCHA solver. Often cheaper/faster than 2Captcha + AntiCaptcha.
- **Status:** Only Flyp uses 2Captcha + AntiCaptcha. 0/10 use CapMonster.
- **Implementation:** Add as 3rd provider for failover.
- **Moat strength: MEDIUM.**

### D3. Battery / Network Information API
- **What:** `navigator.getBattery()` + `navigator.connection`. Bot patterns: always 100% battery, always "4g", never changes.
- **Status:** 0/10.
- **Implementation:** Randomize within plausible ranges, drift over time.
- **Moat strength: LOW-MEDIUM.**

### D4. WebAssembly feature consistency
- **What:** Older/minimal Chrome lacks WASM SIMD/threads. Marketplaces probe.
- **Status:** 0/10.
- **Implementation:** Ensure extension doesn't accidentally disable WASM features.
- **Moat strength: LOW.**

### D5. Performance.now() precision
- **What:** Spectre reduced precision to 100μs. Always-exact-integer returns = bot.
- **Status:** 0/10.
- **Implementation:** Rely on native browser behavior — don't monkey-patch.
- **Moat strength: LOW** (handled natively).

## E. Marketplace-side detection (3 topics — study, not implement)

### E1. Behavioral risk scoring
- **What:** Poshmark/Mercari assign per-session risk scores based on click cadence, scroll, time-on-page, hover patterns. High risk → CAPTCHA or shadow-ban.
- **Competitor response:** None spoof behavior beyond timing jitter.
- **VaultLister approach:** Emit realistic scroll/hover events on random non-action elements. Keep action-to-noise ratio <30%.
- **Moat strength: HIGH** — most common detection layer.

### E2. Account-specific risk
- **What:** New account + aggressive automation = shadow-ban within 48h.
- **Competitor response:** No documented ramp-up strategies.
- **VaultLister approach:** First-7-day ramp-up (50 shares vs 1000 cap). Warm accounts via email newsletter opt-in.
- **Moat strength: HIGH** for new user onboarding.

### E3. Marketplace ML detection models
- **What:** GBDT or neural nets on session telemetry detect bot signal combinations.
- **Competitor response:** Inferable from ban patterns only.
- **VaultLister approach:** Maintain detection-failure log per user. Correlate bans with behavior. Auto-tune jitter distributions via feedback loop.
- **Moat strength: HIGH** long-term data advantage.

---

## Consolidated moat scorecard

| Technique | Competitors | Moat | Effort |
|-----------|:-----------:|:----:|:------:|
| Canvas fingerprint defense | 0/10 | HIGH | 1-2 days |
| Permissions API patching | 0/10 | HIGH | 1 day |
| WebGL spoofing | 0/10 | HIGH | 2 days |
| WebRTC leak prevention | 0/10 | HIGH | 1 day |
| TLS JA3/JA4 spoofing (backend) | 0/10 | CRITICAL | 1 week (utls/curl_cffi) |
| Residential proxy integration | 0/10 | HIGH | 3-5 days |
| Behavioral noise emission | 0/10 | HIGH | 1 week |
| Account ramp-up system | 0/10 | HIGH | 1-2 days |
| Playwright-stealth 25 patches | 0/10 | CRITICAL | 2-3 days |
| Gaussian timing distribution | 0/10 | MEDIUM | 2 hours |
| Full pointer event chain | 0/10 | MEDIUM | 1 day |
| AudioContext patching | 0/10 | MEDIUM | 2 days |
| CapMonster failover | 0/10 | MEDIUM | 1 day |
| Font enumeration patching | 0/10 | MEDIUM | 1 day |
| Timezone + locale coherence | 0/10 | MEDIUM | 2 hours |
| IP rotation (backend) | 0/10 | HIGH | 3-5 days |
| Per-IP rate coordination | 0/10 | MEDIUM | 1 week |
| HTTP/2 frame ordering (backend) | 0/10 | MEDIUM | 2 days |
| Marketplace ML feedback loop | 0/10 | HIGH | 2-3 weeks |
| Battery / Network Info randomization | 0/10 | LOW-MEDIUM | 4 hours |
| Screen / DPR pool | 0/10 | LOW-MEDIUM | 4 hours |

**If VaultLister ships even the 5 HIGH+CRITICAL items (Canvas + Permissions + WebGL + WebRTC + TLS/JA3 spoofing), it would be the most detection-resistant reseller tool on the market.** All 10 competitors operate at request-header-spoofing level only — the entire browser-fingerprint-layer is un-defended industry-wide.

## Honest limit

This supplement adds 21 techniques × ~9 relevant fields each = ~189 Level-3 sub-gaps in anti-detection specifically. Combined with prior inventory, total competitive intelligence identified gaps = **~1745**. Diminishing returns beyond this — additional Level-4 drilling would be specific hex values, exact randomization ranges, specific TLS cipher preferences, etc. that are operationally tunable rather than strategically differentiating.
