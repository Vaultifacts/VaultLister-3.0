# Anti-Detection Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 26 anti-detection gaps across VaultLister's Facebook Marketplace automation to minimize ban risk.

**Architecture:** Centralize stealth improvements in `stealth.js` so all bots benefit. Fix `facebookPublish.js` to use shared stealth infrastructure. Add behavioral simulation to Chrome extension. Add daily caps and session persistence to rate limits.

**Tech Stack:** Playwright, playwright-extra, puppeteer-extra-plugin-stealth, Chrome Extension Manifest V3

---

## File Map

| File | Change Type | What Changes |
|------|-------------|--------------|
| `src/backend/services/platformSync/facebookPublish.js` | Modify | Replace bare `playwright` import + hardcoded UA/viewport/headless with shared stealth infrastructure |
| `worker/bots/facebook-bot.js` | Modify | Add `injectChromeRuntimeStub`, headless `'new'`, CAPTCHA checks in refresh/relist flows, session cookie persistence, daily action cap, lockout detection |
| `worker/bots/stealth.js` | Modify | Randomize timezone/locale pools, add `--disable-infobars` to STEALTH_ARGS, add `randomSlowMo()`, add `injectBrowserApiStubs()` |
| `worker/bots/rate-limits.js` | Modify | Add `maxListingsPerDay`, `maxLoginsPerDay`, `listingDelay`, `sessionCooldown` to facebook config |
| `worker/bots/poshmark-bot.js` | Modify | Replace hardcoded `locale`/`timezoneId` in `newContext()` with `stealthContextOptions()` spread |
| `worker/bots/depop-bot.js` | Modify | Same as poshmark-bot.js |
| `worker/bots/mercari-bot.js` | Modify | Same as poshmark-bot.js |
| `worker/bots/grailed-bot.js` | Modify | Same as poshmark-bot.js |
| `worker/bots/whatnot-bot.js` | Modify | Same as poshmark-bot.js |
| `chrome-extension/content/poster.js` | Modify | Add `randomDelay()` between field fills in `fillFacebook()`, add jitter to `clickDropdownOption()` |

---

## Task 1: Fix facebookPublish.js — use stealthChromium instead of bare playwright

**Gaps fixed:** #1 (bare playwright, no stealth plugin), #5 (hardcoded UA), #8 (hardcoded viewport), #10 (no chrome.runtime stub)

**Files:**
- Modify: `src/backend/services/platformSync/facebookPublish.js`

**Current state (lines 12, 92-107):**
```javascript
import { chromium } from 'playwright';
// ...
browser = await chromium.launch({ headless: true, slowMo: 80 });
// ...
const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US'
});
```

- [ ] **Step 1: Replace the playwright import with stealth infrastructure imports**

In `src/backend/services/platformSync/facebookPublish.js`, replace line 12:
```javascript
import { chromium } from 'playwright';
```
with:
```javascript
import { stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs, humanClick, mouseWiggle, stealthContextOptions, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, randomSlowMo } from '../../../worker/bots/stealth.js';
```

- [ ] **Step 2: Replace chromium.launch() with stealthChromium.launch()**

Replace the launch block (lines ~92-95):
```javascript
browser = await chromium.launch({ headless: true, slowMo: 80 });
```
with:
```javascript
browser = await stealthChromium.launch({
    headless: 'new',
    slowMo: randomSlowMo(),
    args: STEALTH_ARGS,
    ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
});
```

- [ ] **Step 3: Replace hardcoded newContext() with stealthContextOptions()**

Replace the context creation block (lines ~103-108):
```javascript
const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US'
});
```
with:
```javascript
const context = await browser.newContext(stealthContextOptions('chrome'));
```

- [ ] **Step 4: Inject chrome.runtime stub and browser API stubs after creating the page**

After the line `const page = await context.newPage();` (line ~111), add:
```javascript
await injectChromeRuntimeStub(page);
await injectBrowserApiStubs(page);
await page.route('**/analytics/**', route => route.abort());
await page.route('**/tracking/**', route => route.abort());
```

Note: The analytics/tracking route blocks were not present in facebookPublish.js previously — this adds them for the first time alongside the stubs.

- [ ] **Step 5: Replace direct .click() calls with humanClick() for major actions**

Find the category trigger click (~line 197):
```javascript
await categoryTrigger.click();
```
Replace with:
```javascript
await humanClick(page, categoryTrigger);
```

Find the condition trigger click (~line 214):
```javascript
await conditionTrigger.click();
```
Replace with:
```javascript
await humanClick(page, conditionTrigger);
```

Find the Next/Publish button click (~line 253):
```javascript
await nextBtn.click();
```
Replace with:
```javascript
await humanClick(page, nextBtn);
```

Find the second publish button click (~line 259):
```javascript
await publishBtn.click();
```
Replace with:
```javascript
await humanClick(page, publishBtn);
```

- [ ] **Step 6: Add mouseWiggle() calls between major form steps**

After the image upload block (after `logger.info('[Facebook Publish] Uploaded images', ...)`), add:
```javascript
await mouseWiggle(page);
```

After the title fill block (after the `humanType(page, titleSelector, title)` waitForTimeout), add:
```javascript
await mouseWiggle(page);
```

After the price fill block (after the `humanType(page, priceSelector, ...)` waitForTimeout), add:
```javascript
await mouseWiggle(page);
```

- [ ] **Step 7: Add CAPTCHA check after navigating to create page and after clicking Publish**

After the marketplace create navigation and its `waitForTimeout` (~line 151), add:
```javascript
const captchaOnCreate = await page.$('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]');
if (captchaOnCreate) {
    throw new Error('Facebook CAPTCHA detected on Marketplace create page — automated publishing blocked. Try again later.');
}
```

After the final `waitForTimeout` following the second publish button click, add:
```javascript
const captchaAfterPublish = await page.$('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]');
if (captchaAfterPublish) {
    throw new Error('Facebook CAPTCHA detected after Publish click — listing may not have been created. Please check manually.');
}
```

- [ ] **Step 8: Syntax check**

```bash
node -c src/backend/services/platformSync/facebookPublish.js
```
Expected output: `src/backend/services/platformSync/facebookPublish.js is a valid JavaScript file`

- [ ] **Step 9: Commit**

```bash
git add src/backend/services/platformSync/facebookPublish.js
git commit -m "fix(facebook): replace bare playwright with stealthChromium in facebookPublish.js

- Switch from bare playwright to stealthChromium (playwright-extra + stealth plugin)
- Replace hardcoded UA/viewport with stealthContextOptions() random pool
- Add injectChromeRuntimeStub + injectBrowserApiStubs after page creation
- Add analytics/tracking route blocks
- Replace direct .click() with humanClick() for major form actions
- Add mouseWiggle() between form steps
- Add CAPTCHA detection on create page and post-publish

Verified: node -c syntax check passes"
```

---

## Task 2: Fix facebook-bot.js — add injectChromeRuntimeStub, headless 'new', CAPTCHA in refresh/relist

**Gaps fixed:** #2 (missing chrome.runtime stub in bot), #4 (CAPTCHA only checked at login, not mid-flow), #12 (headless: true flagged by some detection)

**Files:**
- Modify: `worker/bots/facebook-bot.js`

**Current state:**
- Line 4 import: has `humanClick, humanScroll, mouseWiggle` but NOT `injectChromeRuntimeStub`
- Line 46: `headless: true` in options default
- Line 53: `headless: this.options.headless` (inherits `true` from default)
- Line 64: page created but no stub injection
- `refreshListing()` and `relistItem()`: CAPTCHA check only happens indirectly via thrown error, no proactive check

- [ ] **Step 1: Add injectChromeRuntimeStub and injectBrowserApiStubs to the import line**

In `worker/bots/facebook-bot.js`, change line 4 from:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from './stealth.js';
```
to:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, injectChromeRuntimeStub, injectBrowserApiStubs } from './stealth.js';
```

- [ ] **Step 2: Change headless default from true to 'new'**

On line 46, change:
```javascript
this.options = { headless: true, slowMo: 50, ...options };
```
to:
```javascript
this.options = { headless: 'new', slowMo: 50, ...options };
```

- [ ] **Step 3: Inject stubs after page creation in init()**

After `this.page = await context.newPage();` (line 64), add:
```javascript
await injectChromeRuntimeStub(this.page);
await injectBrowserApiStubs(this.page);
```

- [ ] **Step 4: Add CAPTCHA check in refreshListing() after navigation**

In `refreshListing()`, after the `goto` and `mouseWiggle` calls (~line 121-122), add:
```javascript
await checkForCaptcha(this.page);
```

- [ ] **Step 5: Add CAPTCHA check in refreshListing() after clicking the save button**

After the `humanClick(this.page, saveBtn)` and its `waitForTimeout` (~line 138), add:
```javascript
await checkForCaptcha(this.page);
```

- [ ] **Step 6: Add CAPTCHA check in relistItem() after navigation**

In `relistItem()`, after the `goto` and `mouseWiggle` calls (~line 197-199), add:
```javascript
await checkForCaptcha(this.page);
```

- [ ] **Step 7: Add CAPTCHA check in relistItem() after clicking confirm**

After the `humanClick(this.page, confirmBtn)` and its `waitForTimeout` (~line 210), add:
```javascript
await checkForCaptcha(this.page);
```

- [ ] **Step 8: Syntax check**

```bash
node -c worker/bots/facebook-bot.js
```
Expected output: `worker/bots/facebook-bot.js is a valid JavaScript file`

- [ ] **Step 9: Commit**

```bash
git add worker/bots/facebook-bot.js
git commit -m "fix(facebook-bot): add chrome.runtime stub, headless 'new', mid-flow CAPTCHA checks

- Add injectChromeRuntimeStub + injectBrowserApiStubs after page creation
- Change headless default from true to 'new' (less detectable)
- Add checkForCaptcha() calls in refreshListing() and relistItem() mid-flow

Verified: node -c syntax check passes"
```

---

## Task 3: Add session cookie persistence to facebook-bot.js

**Gap fixed:** #3 (bot re-logs in every run, creating suspicious login frequency signal)

**Files:**
- Modify: `worker/bots/facebook-bot.js`

**Approach:** After successful login, save `storageState` to `data/.fb-session.json`. On next `init()`, if the file exists and is < 24 hours old, load it instead of logging in fresh. If session turns out invalid (CAPTCHA or checkpoint), clear the file and fall back to fresh login.

- [ ] **Step 1: Add path import (already imported — verify)**

The file already has `import path from 'path';` on line 6. Verify `import fs from 'fs';` is also present (line 5). Both are already there — no change needed.

- [ ] **Step 2: Add SESSION_PATH constant after AUDIT_LOG constant**

After line 12 (`const AUDIT_LOG = ...`), add:
```javascript
const SESSION_PATH = path.join(process.cwd(), 'data', '.fb-session.json');
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
```

- [ ] **Step 3: Add clearSession() method to FacebookBot class**

Add this method to the `FacebookBot` class (before `getStats()`):
```javascript
clearSession() {
    try {
        if (fs.existsSync(SESSION_PATH)) {
            fs.unlinkSync(SESSION_PATH);
            writeAuditLog('session_cleared');
            logger.info('[FacebookBot] Session file cleared');
        }
    } catch {}
}
```

- [ ] **Step 4: Update init() to load session if fresh**

In `init()`, replace the `this.browser.newContext(...)` block:
```javascript
const context = await this.browser.newContext({
    userAgent: randomChromeUA(),
    viewport: randomViewport(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
});
```
with:
```javascript
let sessionOpts = {};
try {
    if (fs.existsSync(SESSION_PATH)) {
        const stat = fs.statSync(SESSION_PATH);
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs < SESSION_MAX_AGE_MS) {
            sessionOpts.storageState = SESSION_PATH;
            logger.info('[FacebookBot] Loading existing session (age: ' + Math.floor(ageMs / 60000) + 'min)');
        } else {
            logger.info('[FacebookBot] Session file too old, starting fresh');
        }
    }
} catch {}

const context = await this.browser.newContext({
    userAgent: randomChromeUA(),
    viewport: randomViewport(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
    ...sessionOpts,
});
this._sessionLoaded = !!sessionOpts.storageState;
```

- [ ] **Step 5: Update login() to skip login if session is loaded and still valid**

At the start of `login()`, after the credential check, add:
```javascript
if (this._sessionLoaded) {
    logger.info('[FacebookBot] Session loaded — verifying still active');
    try {
        await this.page.goto(`${FB_URL}/marketplace`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await checkForCaptcha(this.page);
        const stillLoggedIn = await this.page.$('[aria-label="Your profile"], [data-testid="royal_profile_link"], [aria-label*="profile" i]');
        if (stillLoggedIn) {
            this.isLoggedIn = true;
            writeAuditLog('session_reuse');
            logger.info('[FacebookBot] Session still valid — skipping login');
            return true;
        }
        logger.info('[FacebookBot] Session expired — proceeding with fresh login');
        this.clearSession();
    } catch (sessionErr) {
        logger.info('[FacebookBot] Session check failed — proceeding with fresh login:', sessionErr.message);
        this.clearSession();
    }
}
```

- [ ] **Step 6: Save session after successful login**

After the `writeAuditLog('login_success')` line in `login()`, add:
```javascript
try {
    await this.page.context().storageState({ path: SESSION_PATH });
    logger.info('[FacebookBot] Session saved to', SESSION_PATH);
} catch (saveErr) {
    logger.warn('[FacebookBot] Could not save session:', saveErr.message);
}
```

- [ ] **Step 7: Clear session on CAPTCHA detection**

`checkForCaptcha()` currently only throws. The bot instance isn't accessible in that function. Instead, call `this.clearSession()` in the catch block of `login()` when the error contains 'CAPTCHA'. Add after `this.stats.errors++` in the `login()` catch block:
```javascript
if (error.message.includes('CAPTCHA')) {
    this.clearSession();
}
```

- [ ] **Step 8: Syntax check**

```bash
node -c worker/bots/facebook-bot.js
```
Expected output: `worker/bots/facebook-bot.js is a valid JavaScript file`

- [ ] **Step 9: Commit**

```bash
git add worker/bots/facebook-bot.js
git commit -m "feat(facebook-bot): add session cookie persistence to reduce login frequency

- Save storageState to data/.fb-session.json after successful login
- On init(), load session if file exists and is < 24 hours old
- On login(), verify session still active before attempting fresh login
- Add clearSession() method — called on CAPTCHA detection or session expiry

Verified: node -c syntax check passes"
```

---

## Task 4: Update stealth.js — randomize timezone/locale, add missing args, randomSlowMo, injectBrowserApiStubs

**Gaps fixed:** #5 (hardcoded timezone), #6 (hardcoded locale), #13 (missing --disable-infobars), #14 (static slowMo), #15-25 (browser API fingerprinting — WebRTC, navigator properties, plugins, permissions, battery, network)

**Files:**
- Modify: `worker/bots/stealth.js`

- [ ] **Step 1: Add timezone and locale pools after VIEWPORT_SIZES**

After the `VIEWPORT_SIZES` array (after line 127), add:
```javascript
const TIMEZONES = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
];

const LOCALES = ['en-US', 'en-CA', 'en-GB'];
```

- [ ] **Step 2: Add --disable-infobars to STEALTH_ARGS**

Change the STEALTH_ARGS export (lines 143-148) from:
```javascript
export const STEALTH_ARGS = [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=AutomationControlled',
    '--disable-dev-shm-usage',
];
```
to:
```javascript
export const STEALTH_ARGS = [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--disable-infobars',
];
```

- [ ] **Step 3: Update stealthContextOptions() to use random timezone and locale**

Change the `stealthContextOptions` function (lines 158-168) from:
```javascript
export function stealthContextOptions(browser = 'chrome', overrides = {}) {
    const ua = browser === 'firefox' ? randomFirefoxUA() : randomChromeUA();
    const viewport = randomViewport();
    return {
        userAgent: ua,
        viewport,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        ...overrides,
    };
}
```
to:
```javascript
export function stealthContextOptions(browser = 'chrome', overrides = {}) {
    const ua = browser === 'firefox' ? randomFirefoxUA() : randomChromeUA();
    const viewport = randomViewport();
    return {
        userAgent: ua,
        viewport,
        locale: pick(LOCALES),
        timezoneId: pick(TIMEZONES),
        ...overrides,
    };
}
```

- [ ] **Step 4: Add randomSlowMo() export after randomViewport()**

After the `randomViewport` export (after line 140), add:
```javascript
/** Return a random slowMo value between 30–80ms for launch(). */
export function randomSlowMo() { return 30 + Math.floor(Math.random() * 50); }
```

- [ ] **Step 5: Add injectBrowserApiStubs() export after injectChromeRuntimeStub()**

After the closing `}` of `injectChromeRuntimeStub` (after line 102), add the new function:
```javascript
/**
 * Inject browser API stubs that prevent common fingerprinting vectors:
 * WebRTC IP leak, navigator hardware properties, plugins array,
 * Permissions API, Battery API, NetworkInformation API.
 *
 * Call immediately after injectChromeRuntimeStub(page) in bot setup.
 */
export async function injectBrowserApiStubs(page) {
    await page.addInitScript(() => {
        // WebRTC leak prevention — strip STUN servers so local IP isn't exposed
        if (window.RTCPeerConnection) {
            const origRTC = window.RTCPeerConnection;
            window.RTCPeerConnection = function(...args) {
                const config = args[0] || {};
                config.iceServers = [];
                return new origRTC(config);
            };
            window.RTCPeerConnection.prototype = origRTC.prototype;
        }

        // Navigator hardware properties — randomized but plausible
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 + Math.floor(Math.random() * 5) });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => [4, 8, 16][Math.floor(Math.random() * 3)] });

        // Plugins — real Chrome reports 3 built-in plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                const arr = [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
                ];
                arr.length = 3;
                return arr;
            }
        });

        // Permissions API — return 'denied' for notifications (fresh profile default)
        if (navigator.permissions) {
            const origQuery = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = (params) => {
                if (params.name === 'notifications') {
                    return Promise.resolve({ state: 'denied', onchange: null });
                }
                return origQuery(params);
            };
        }

        // Battery API — return plausible laptop-on-charger values
        if (navigator.getBattery) {
            navigator.getBattery = () => Promise.resolve({
                charging: true,
                chargingTime: Infinity,
                dischargingTime: Infinity,
                level: 0.85 + Math.random() * 0.15,
                addEventListener: () => {},
                removeEventListener: () => {}
            });
        }

        // NetworkInformation — report a plausible 4G connection
        if (!navigator.connection) {
            Object.defineProperty(navigator, 'connection', {
                get: () => ({
                    effectiveType: '4g',
                    downlink: 8 + Math.random() * 4,
                    rtt: 50 + Math.floor(Math.random() * 50),
                    saveData: false,
                    addEventListener: () => {},
                    removeEventListener: () => {}
                })
            });
        }
    });
}
```

- [ ] **Step 6: Syntax check**

```bash
node -c worker/bots/stealth.js
```
Expected output: `worker/bots/stealth.js is a valid JavaScript file`

- [ ] **Step 7: Commit**

```bash
git add worker/bots/stealth.js
git commit -m "feat(stealth): randomize timezone/locale, add randomSlowMo, injectBrowserApiStubs

- Add TIMEZONES and LOCALES pools; stealthContextOptions() picks randomly
- Add '--disable-infobars' to STEALTH_ARGS
- Export randomSlowMo() for jittered launch slowMo
- Add injectBrowserApiStubs(): WebRTC leak prevention, navigator.hardwareConcurrency,
  deviceMemory, plugins, Permissions API, Battery API, NetworkInformation stubs

Verified: node -c syntax check passes"
```

---

## Task 5: Update all 6 bots to use stealthContextOptions() instead of hardcoded timezone/locale

**Gap fixed:** #6 systemwide — all other bots still hardcode `locale: 'en-US', timezoneId: 'America/New_York'`

**Files:**
- Modify: `worker/bots/facebook-bot.js`
- Modify: `worker/bots/poshmark-bot.js`
- Modify: `worker/bots/depop-bot.js`
- Modify: `worker/bots/mercari-bot.js`
- Modify: `worker/bots/grailed-bot.js`
- Modify: `worker/bots/whatnot-bot.js`

**Note:** All 5 non-Facebook bots already import from `stealth.js` but do NOT import `stealthContextOptions`. Each uses `newContext({ userAgent: randomChromeUA(), viewport: randomViewport(), locale: 'en-US', timezoneId: 'America/New_York' })`. The fix is to add `stealthContextOptions` to the import and replace the `newContext` options object with `stealthContextOptions('chrome')`.

**Note on facebook-bot.js:** This bot was updated in Task 3 to have a session loading path. The session loading block already builds the context options manually. After this task, the `newContext` call in facebook-bot.js should also use `stealthContextOptions`. The `...sessionOpts` spread added in Task 3 will still work because `stealthContextOptions` returns a plain object and `sessionOpts` is spread after it.

- [ ] **Step 1: Update facebook-bot.js import and newContext**

In `worker/bots/facebook-bot.js`, the import already has `injectChromeRuntimeStub, injectBrowserApiStubs` from Task 2. Add `stealthContextOptions` to that same import line:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, injectChromeRuntimeStub, injectBrowserApiStubs, stealthContextOptions } from './stealth.js';
```

Then in `init()`, replace the `newContext` options block (from Task 3, which reads):
```javascript
const context = await this.browser.newContext({
    userAgent: randomChromeUA(),
    viewport: randomViewport(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
    ...sessionOpts,
});
```
with:
```javascript
const context = await this.browser.newContext({
    ...stealthContextOptions('chrome'),
    ...sessionOpts,
});
```

- [ ] **Step 2: Update poshmark-bot.js import and newContext**

In `worker/bots/poshmark-bot.js`, change the import on line 4 from:
```javascript
import { stealthChromium as chromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from './stealth.js';
```
to:
```javascript
import { stealthChromium as chromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, stealthContextOptions } from './stealth.js';
```

Then replace the `newContext` block (lines ~107-112):
```javascript
const context = await this.browser.newContext({
    userAgent: randomChromeUA(),
    viewport: randomViewport(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
});
```
with:
```javascript
const context = await this.browser.newContext(stealthContextOptions('chrome'));
```

- [ ] **Step 3: Update depop-bot.js import and newContext**

In `worker/bots/depop-bot.js`, change the import on line 4 from:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from './stealth.js';
```
to:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, stealthContextOptions } from './stealth.js';
```

Then replace the `newContext` block (lines ~58-63):
```javascript
this.context = await this.browser.newContext({
    userAgent: randomChromeUA(),
    viewport: randomViewport(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
});
```
with:
```javascript
this.context = await this.browser.newContext(stealthContextOptions('chrome'));
```

- [ ] **Step 4: Update mercari-bot.js import and newContext**

In `worker/bots/mercari-bot.js`, change the import on line 4 from:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from './stealth.js';
```
to:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, stealthContextOptions } from './stealth.js';
```

Then replace the `newContext` block (lines ~58-63):
```javascript
const context = await this.browser.newContext({
    userAgent: randomChromeUA(),
    viewport: randomViewport(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
});
```
with:
```javascript
const context = await this.browser.newContext(stealthContextOptions('chrome'));
```

- [ ] **Step 5: Update grailed-bot.js import and newContext**

In `worker/bots/grailed-bot.js`, change the import on line 4 from:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from './stealth.js';
```
to:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, stealthContextOptions } from './stealth.js';
```

Then replace the `newContext` block (lines ~58-63):
```javascript
const context = await this.browser.newContext({
    userAgent: randomChromeUA(),
    viewport: randomViewport(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
});
```
with:
```javascript
const context = await this.browser.newContext(stealthContextOptions('chrome'));
```

- [ ] **Step 6: Update whatnot-bot.js import and newContext**

In `worker/bots/whatnot-bot.js`, change the import on line 4 from:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from './stealth.js';
```
to:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, stealthContextOptions } from './stealth.js';
```

Then replace the `newContext` block (lines ~58-63):
```javascript
const context = await this.browser.newContext({
    userAgent: randomChromeUA(),
    viewport: randomViewport(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
});
```
with:
```javascript
const context = await this.browser.newContext(stealthContextOptions('chrome'));
```

- [ ] **Step 7: Syntax check all 6 bot files**

```bash
node -c worker/bots/facebook-bot.js && \
node -c worker/bots/poshmark-bot.js && \
node -c worker/bots/depop-bot.js && \
node -c worker/bots/mercari-bot.js && \
node -c worker/bots/grailed-bot.js && \
node -c worker/bots/whatnot-bot.js
```
Expected output: each file reports `is a valid JavaScript file` (6 lines total)

- [ ] **Step 8: Commit**

```bash
git add worker/bots/facebook-bot.js worker/bots/poshmark-bot.js worker/bots/depop-bot.js worker/bots/mercari-bot.js worker/bots/grailed-bot.js worker/bots/whatnot-bot.js
git commit -m "fix(bots): replace hardcoded locale/timezoneId with stealthContextOptions() in all 6 bots

All bots now use randomized timezone and locale from stealth.js pools instead
of hardcoded 'en-US' / 'America/New_York' — reduces cross-session fingerprint correlation.

Verified: node -c syntax check passes for all 6 files"
```

---

## Task 6: Add daily caps and account lockout detection

**Gaps fixed:** #7 (no daily action cap — FB flags bulk listing sessions), #8 (rate limits missing per-day fields), #11 (no lockout/checkpoint detection in login flow)

**Files:**
- Modify: `worker/bots/rate-limits.js`
- Modify: `worker/bots/facebook-bot.js`

- [ ] **Step 1: Add daily cap fields to facebook config in rate-limits.js**

In `worker/bots/rate-limits.js`, replace the existing facebook config:
```javascript
facebook: {
    actionDelay:    5000,   // FB is aggressive on detection
    loginCooldown:  120000,
    maxActionsPerRun: 20,
},
```
with:
```javascript
facebook: {
    actionDelay:      5000,    // FB is aggressive on detection
    loginCooldown:    120000,
    maxActionsPerRun: 20,
    maxListingsPerDay: 10,     // FB flags bulk listing sessions
    maxLoginsPerDay:   3,      // Repeated logins signal bot activity
    listingDelay:     8000,    // Extra gap between listing creates
    sessionCooldown:  300000,  // 5min minimum between bot runs
},
```

- [ ] **Step 2: Add DAILY_STATS_PATH constant to facebook-bot.js**

After `SESSION_MAX_AGE_MS` (added in Task 3), add:
```javascript
const DAILY_STATS_PATH = path.join(process.cwd(), 'data', '.fb-daily-stats.json');
```

- [ ] **Step 3: Add readDailyStats() and writeDailyStats() helpers**

After `writeAuditLog()` (after line ~19), add:
```javascript
function getTodayKey() {
    return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function readDailyStats() {
    try {
        if (fs.existsSync(DAILY_STATS_PATH)) {
            const raw = fs.readFileSync(DAILY_STATS_PATH, 'utf8');
            const data = JSON.parse(raw);
            if (data.date === getTodayKey()) return data;
        }
    } catch {}
    return { date: getTodayKey(), logins: 0, listings: 0 };
}

function writeDailyStats(stats) {
    try {
        fs.writeFileSync(DAILY_STATS_PATH, JSON.stringify(stats), 'utf8');
    } catch {}
}
```

- [ ] **Step 4: Increment login counter in login() and enforce maxLoginsPerDay**

At the start of `login()` (before the credential check), add:
```javascript
const dailyStats = readDailyStats();
if (dailyStats.logins >= RATE_LIMITS.facebook.maxLoginsPerDay) {
    throw new Error(`Daily login cap reached (${RATE_LIMITS.facebook.maxLoginsPerDay} logins/day). Try again tomorrow.`);
}
```

After `writeAuditLog('login_success')`, add:
```javascript
dailyStats.logins++;
writeDailyStats(dailyStats);
```

Note: `dailyStats` was declared at the start of the login function scope, so it is accessible here.

- [ ] **Step 5: Enforce maxListingsPerDay in refreshListing() and relistItem()**

At the start of `refreshListing()`, add:
```javascript
const stats = readDailyStats();
if (stats.listings >= RATE_LIMITS.facebook.maxListingsPerDay) {
    logger.warn('[FacebookBot] Daily listing cap reached — skipping');
    writeAuditLog('daily_cap_reached', { cap: 'listings', listingUrl });
    return false;
}
```

At the start of `relistItem()`, add the same check:
```javascript
const stats = readDailyStats();
if (stats.listings >= RATE_LIMITS.facebook.maxListingsPerDay) {
    logger.warn('[FacebookBot] Daily listing cap reached — skipping relist');
    writeAuditLog('daily_cap_reached', { cap: 'listings', listingUrl });
    return false;
}
```

After `writeAuditLog('refresh_listing', ...)` in `refreshListing()`, add:
```javascript
stats.listings++;
writeDailyStats(stats);
```

After `writeAuditLog('relist_item', ...)` in `relistItem()`, add:
```javascript
stats.listings++;
writeDailyStats(stats);
```

- [ ] **Step 6: Add lockout/checkpoint detection in login()**

In `login()`, after `await this.page.waitForNavigation(...)` and the first `checkForCaptcha` call (~line 94-95), add:
```javascript
const currentUrl = this.page.url();
if (
    currentUrl.includes('/checkpoint') ||
    currentUrl.includes('/account_locked') ||
    currentUrl.includes('/help/contact') ||
    currentUrl.includes('/disabled')
) {
    this.clearSession();
    writeAuditLog('account_lockout_detected', { url: currentUrl });
    throw new Error(`Facebook account restriction detected (URL: ${currentUrl}). Manual intervention required.`);
}
```

- [ ] **Step 7: Syntax check both files**

```bash
node -c worker/bots/rate-limits.js && node -c worker/bots/facebook-bot.js
```
Expected output:
```
worker/bots/rate-limits.js is a valid JavaScript file
worker/bots/facebook-bot.js is a valid JavaScript file
```

- [ ] **Step 8: Commit**

```bash
git add worker/bots/rate-limits.js worker/bots/facebook-bot.js
git commit -m "feat(facebook): add daily caps, lockout detection, and per-day rate limit fields

rate-limits.js: add maxListingsPerDay(10), maxLoginsPerDay(3), listingDelay(8s),
sessionCooldown(5min) to facebook config.
facebook-bot.js: enforce daily caps via data/.fb-daily-stats.json, detect
/checkpoint and /account_locked URLs after login and throw with clear error.

Verified: node -c syntax check passes for both files"
```

---

## Task 7: Add inter-field delays and jitter to Chrome extension poster.js

**Gaps fixed:** #7 (Chrome extension fills all fields instantly — detectable), #26 (hardcoded wait values in clickDropdownOption)

**Files:**
- Modify: `chrome-extension/content/poster.js`

**Current state:** `fillFacebook()` calls field setters back-to-back with no delays. `clickDropdownOption()` has hardcoded `800` ms and `400` ms waits.

- [ ] **Step 1: Add randomDelay() helper before fillFacebook()**

In `chrome-extension/content/poster.js`, add this helper directly before the `async function fillFacebook(data)` declaration (line ~250):
```javascript
function randomFillDelay(min = 300, max = 800) {
    return new Promise(r => setTimeout(r, min + Math.floor(Math.random() * (max - min))));
}
```

- [ ] **Step 2: Add inter-field delays throughout fillFacebook()**

In `fillFacebook()`, add `await randomFillDelay(400, 900)` between each field fill section. The `try` blocks for Title, Price, Category, Condition, Location, Description, and Images should each be followed by a delay before the next field starts.

After the closing `} catch { skipped.push('Title'); }` block, add:
```javascript
await randomFillDelay(400, 900);
```

After the closing `} catch { skipped.push('Price'); }` block, add:
```javascript
await randomFillDelay(400, 900);
```

After the closing `} catch { skipped.push('Category'); }` block, add:
```javascript
await randomFillDelay(400, 900);
```

After the closing `} catch { skipped.push('Condition'); }` block, add:
```javascript
await randomFillDelay(400, 900);
```

After the closing `} catch { skipped.push('Location'); }` block, add:
```javascript
await randomFillDelay(500, 1100);
```

After the closing `} catch { skipped.push('Description'); }` block, add:
```javascript
await randomFillDelay(300, 700);
```

- [ ] **Step 3: Replace hardcoded waits in clickDropdownOption() with jittered values**

In `clickDropdownOption()`, replace:
```javascript
await new Promise(r => setTimeout(r, 800));
```
with:
```javascript
await new Promise(r => setTimeout(r, 600 + Math.floor(Math.random() * 400)));
```

Replace:
```javascript
await new Promise(r => setTimeout(r, 400));
```
with:
```javascript
await new Promise(r => setTimeout(r, 300 + Math.floor(Math.random() * 200)));
```

- [ ] **Step 4: Syntax check**

```bash
node -c chrome-extension/content/poster.js
```
Expected output: `chrome-extension/content/poster.js is a valid JavaScript file`

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/content/poster.js
git commit -m "fix(extension): add inter-field delays and jitter to fillFacebook() in poster.js

- Add randomFillDelay() helper (300-800ms default range)
- Add delay after each field fill in fillFacebook() (title, price, category,
  condition, location, description) to avoid instant form-fill detection
- Replace hardcoded 800ms/400ms in clickDropdownOption() with jittered ranges

Verified: node -c syntax check passes"
```

---

## Task 8: Add browser API spoofing stubs — call injectBrowserApiStubs in both Playwright files

**Gaps fixed:** #15-25 (WebRTC, navigator properties, plugins, Permissions, Battery, NetworkInformation fingerprinting)

**Note:** `injectBrowserApiStubs()` was written in Task 4 (stealth.js) and imported in Task 1 (facebookPublish.js) and Task 2 (facebook-bot.js). This task verifies both call sites are present and working correctly together. No new code is needed — this is a verification and integration task.

**Files:**
- Verify: `src/backend/services/platformSync/facebookPublish.js`
- Verify: `worker/bots/facebook-bot.js`
- Verify: `worker/bots/stealth.js`

- [ ] **Step 1: Verify injectBrowserApiStubs is exported from stealth.js**

```bash
grep -n "export async function injectBrowserApiStubs" worker/bots/stealth.js
```
Expected output: a line number and the function declaration.

- [ ] **Step 2: Verify facebookPublish.js imports and calls injectBrowserApiStubs**

```bash
grep -n "injectBrowserApiStubs" src/backend/services/platformSync/facebookPublish.js
```
Expected output: at minimum 2 lines — one in the import, one in the `await injectBrowserApiStubs(page)` call.

- [ ] **Step 3: Verify facebook-bot.js imports and calls injectBrowserApiStubs**

```bash
grep -n "injectBrowserApiStubs" worker/bots/facebook-bot.js
```
Expected output: at minimum 2 lines — one in the import, one in the `await injectBrowserApiStubs(this.page)` call.

- [ ] **Step 4: Final syntax check — all 4 touched files**

```bash
node -c worker/bots/stealth.js && \
node -c worker/bots/facebook-bot.js && \
node -c src/backend/services/platformSync/facebookPublish.js && \
node -c chrome-extension/content/poster.js
```
Expected output: all 4 files report `is a valid JavaScript file`

- [ ] **Step 5: Commit verification result**

```bash
git add worker/bots/stealth.js worker/bots/facebook-bot.js src/backend/services/platformSync/facebookPublish.js chrome-extension/content/poster.js
git commit -m "chore(stealth): verify browser API stub integration across all Facebook automation files

All 26 anti-detection gaps now addressed:
- Tasks 1-3: facebookPublish.js fully migrated to stealth infrastructure
- Tasks 2-3: facebook-bot.js stub injection, headless 'new', session persistence
- Task 4: stealth.js random timezone/locale, randomSlowMo, injectBrowserApiStubs
- Task 5: all 6 bots use stealthContextOptions() instead of hardcoded tz/locale
- Task 6: daily caps + lockout detection in facebook-bot.js + rate-limits.js
- Task 7: fillFacebook() inter-field delays + clickDropdownOption() jitter
- Task 8: verified injectBrowserApiStubs called in both Playwright files

Verified: node -c syntax check passes for all 4 modified files"
```

---

## Self-Review

### Spec Coverage

| Gap(s) | Task | Status |
|--------|------|--------|
| #1 bare playwright in facebookPublish.js | Task 1 | Covered |
| #5 hardcoded UA | Task 1 | Covered |
| #8 hardcoded viewport | Task 1 | Covered |
| #10 no chrome.runtime stub in facebookPublish.js | Task 1 | Covered |
| #2 no chrome.runtime stub in facebook-bot.js | Task 2 | Covered |
| #4 CAPTCHA only at login, not mid-flow | Task 2 | Covered |
| #12 headless: true | Task 2 | Covered |
| #3 no session persistence | Task 3 | Covered |
| #5 hardcoded timezone in stealthContextOptions | Task 4 | Covered |
| #6 hardcoded locale in stealthContextOptions | Task 4 | Covered |
| #13 missing --disable-infobars | Task 4 | Covered |
| #14 static slowMo | Task 4 | Covered |
| #15-25 browser API fingerprinting | Task 4 | Covered |
| #6 systemwide hardcoded tz/locale in all bots | Task 5 | Covered |
| #7 no daily cap | Task 6 | Covered |
| #8 rate-limits.js missing per-day fields | Task 6 | Covered |
| #11 no lockout detection | Task 6 | Covered |
| #7 instant form-fill in Chrome extension | Task 7 | Covered |
| #26 hardcoded waits in clickDropdownOption | Task 7 | Covered |
| injectBrowserApiStubs call sites verified | Task 8 | Covered |

All 26 gaps are addressed across the 8 tasks.

### Placeholder Scan

No TBD, TODO, "implement later", or "similar to Task N" placeholders found. All code blocks contain complete, copy-paste-ready code.

### Type Consistency

- `injectBrowserApiStubs(page)` — defined in Task 4 (stealth.js), called in Task 1 (facebookPublish.js) and Task 2 (facebook-bot.js), verified in Task 8. Consistent.
- `randomSlowMo()` — defined in Task 4, used in Task 1. Consistent.
- `stealthContextOptions('chrome')` — already existed in stealth.js, extended in Task 4, used in Tasks 1 and 5. Consistent.
- `SESSION_PATH`, `SESSION_MAX_AGE_MS` — defined in Task 3, referenced in Task 3 only. Consistent.
- `DAILY_STATS_PATH` — defined in Task 6, used in Task 6 helpers only. Consistent.
- `RATE_LIMITS.facebook.maxListingsPerDay` / `maxLoginsPerDay` — added to rate-limits.js in Task 6 Step 1, consumed in Task 6 Steps 4-5. Consistent.
- `randomFillDelay()` — defined in Task 7 Step 1, used in Task 7 Steps 2-3. Consistent.
