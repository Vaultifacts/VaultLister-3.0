# Plan: Camoufox Migration for Facebook Bot
**Created:** 2026-04-15
**Status:** Ready to execute

---

## Goal
Replace the Chromium-based stealth stack (`playwright-extra` + `puppeteer-extra-plugin-stealth`) used by the Facebook bot and the Facebook publish service with Camoufox — a Firefox-based anti-detect browser that scores 11/12 on fingerprint tests without any JS stubs. Add persistent browser-profile rotation so each bot run shares cookies/storage across sessions.

## Architecture
```
worker/bots/browser-profiles.js   ← NEW: profile pool manager
worker/bots/stealth.js            ← ADD: launchCamoufox() export (keep all existing exports)
worker/bots/rate-limits.js        ← ADD: facebook.profileCooldown
worker/bots/facebook-bot.js       ← SWITCH: stealthChromium → launchCamoufox + profiles
src/backend/services/platformSync/facebookPublish.js
                                  ← SWITCH: stealthChromium → launchCamoufox + profiles
.env.example                      ← ADD: FACEBOOK_PROXY_URL comment
```

## Tech Stack
- `camoufox-js@0.10.0` — already installed in root `node_modules`
- Camoufox API: `import { Camoufox } from 'camoufox-js'`, returns standard Playwright `Browser`
- Persistent context: `persistent_context: true, user_data_dir: '/abs/path'`
- No JS stubs needed — stubs caused firefoxResist detection and emoji DomRect mismatch

## Critical Rules (from testing)
- **NEVER call `injectChromeRuntimeStub()` or `injectBrowserApiStubs()` with Camoufox** — they degrade its fingerprint score
- `headless` must be a boolean (`true`/`false`), not `'new'` — camoufox-js does not accept the string form
- `page.route()` for analytics abort — wrap in `try/catch`; Camoufox may not support it in persistent context
- `Camoufox(opts)` returns a `Browser` directly, not a `BrowserType` — no `.launch()` call needed
- All existing `page.goto()`, `humanClick()`, `mouseWiggle()` calls work unchanged

---

## Task 1: Create `worker/bots/browser-profiles.js`

**Files:** `worker/bots/browser-profiles.js` (new file)

- [ ] Verify `data/` directory exists at project root

```bash
ls /c/Users/Matt1/OneDrive/Desktop/vaultlister-3/data/
```

- [ ] Create `worker/bots/browser-profiles.js` with the following content:

```javascript
// Persistent browser profile pool for Camoufox-based bots.
// Profiles are stored as directories in data/.browser-profiles/.
// Each profile is a Camoufox user_data_dir that persists cookies, localStorage,
// and session storage across bot runs — replaces the manual storageState pattern.

import fs from 'fs';
import path from 'path';

const PROFILES_DIR = path.join(process.cwd(), 'data', '.browser-profiles');
const PROFILES_JSON = path.join(PROFILES_DIR, 'profiles.json');
const DEFAULT_PROFILE_COUNT = 3;

function readProfiles() {
    try {
        if (fs.existsSync(PROFILES_JSON)) {
            return JSON.parse(fs.readFileSync(PROFILES_JSON, 'utf8'));
        }
    } catch {}
    return [];
}

function writeProfiles(profiles) {
    fs.writeFileSync(PROFILES_JSON, JSON.stringify(profiles, null, 2), 'utf8');
}

/**
 * Create profile directories and metadata file if they don't exist.
 * Safe to call on every bot startup — no-ops if already initialised.
 * @param {number} count - Number of profiles to create (default: 3)
 */
export function initProfiles(count = DEFAULT_PROFILE_COUNT) {
    if (!fs.existsSync(PROFILES_DIR)) {
        fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }

    let profiles = readProfiles();

    if (profiles.length < count) {
        const now = new Date().toISOString();
        for (let i = profiles.length + 1; i <= count; i++) {
            const id = `profile-${i}`;
            const dir = path.join(PROFILES_DIR, id);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            profiles.push({ id, createdAt: now, lastUsedAt: null, usageCount: 0, flagged: false });
        }
        writeProfiles(profiles);
    }

    // Ensure directories exist for any profile in metadata that lost its dir
    for (const p of profiles) {
        const dir = path.join(PROFILES_DIR, p.id);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Return the least-recently-used non-flagged profile and update its lastUsedAt.
 * @returns {{ id, createdAt, lastUsedAt, usageCount, flagged }}
 * @throws if no usable profiles are available
 */
export function getNextProfile() {
    const profiles = readProfiles();
    const usable = profiles.filter(p => !p.flagged);
    if (usable.length === 0) {
        throw new Error('No usable browser profiles available — all profiles are flagged. Manually unflag profiles in data/.browser-profiles/profiles.json to continue.');
    }

    // Sort: never-used first (lastUsedAt === null), then by oldest lastUsedAt
    usable.sort((a, b) => {
        if (a.lastUsedAt === null) return -1;
        if (b.lastUsedAt === null) return 1;
        return new Date(a.lastUsedAt) - new Date(b.lastUsedAt);
    });

    const chosen = usable[0];
    const idx = profiles.findIndex(p => p.id === chosen.id);
    profiles[idx].lastUsedAt = new Date().toISOString();
    writeProfiles(profiles);
    return { ...profiles[idx] };
}

/**
 * Increment usageCount and refresh lastUsedAt for a profile after a successful run.
 * @param {string} id - Profile ID
 */
export function saveProfileUsage(id) {
    const profiles = readProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return;
    profiles[idx].usageCount = (profiles[idx].usageCount || 0) + 1;
    profiles[idx].lastUsedAt = new Date().toISOString();
    writeProfiles(profiles);
}

/**
 * Flag a profile as unsafe after a CAPTCHA or account lockout.
 * Flagged profiles will not be selected by getNextProfile() until manually unflagged.
 * @param {string} id - Profile ID
 */
export function flagProfile(id) {
    const profiles = readProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return;
    profiles[idx].flagged = true;
    writeProfiles(profiles);
}

/**
 * Return the absolute path to a profile's user_data_dir.
 * @param {string} id - Profile ID
 * @returns {string} Absolute path
 */
export function getProfileDir(id) {
    return path.join(PROFILES_DIR, id);
}
```

- [ ] Syntax-check the new file:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && node --input-type=module < worker/bots/browser-profiles.js 2>&1 | head -20
```

Expected: no output (no errors). If any `SyntaxError` appears, fix before continuing.

- [ ] Commit:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && git add worker/bots/browser-profiles.js && git commit -m "$(cat <<'EOF'
feat(bot): add browser-profiles.js — persistent Camoufox profile pool

Creates data/.browser-profiles/ with N profile directories. getNextProfile()
selects LRU non-flagged profile; flagProfile() quarantines on CAPTCHA/lockout.
Replaces manual storageState loading in facebook-bot.js.

Verified: node --input-type=module syntax check passes
EOF
)"
```

---

## Task 2: Update `worker/bots/stealth.js` — add `launchCamoufox()`

**Files:** `worker/bots/stealth.js`

- [ ] Add `launchCamoufox` import and export to `stealth.js`. All existing exports (`stealthChromium`, `humanClick`, `mouseWiggle`, `humanScroll`, `injectChromeRuntimeStub`, `injectBrowserApiStubs`, `randomChromeUA`, `randomFirefoxUA`, `randomViewport`, `randomSlowMo`, `STEALTH_ARGS`, `STEALTH_IGNORE_DEFAULTS`, `stealthContextOptions`) must remain untouched.

Append to the end of `worker/bots/stealth.js`:

```javascript

/**
 * Launch a Camoufox Firefox browser with anti-detect defaults.
 * Camoufox handles fingerprint spoofing natively — do NOT call
 * injectChromeRuntimeStub() or injectBrowserApiStubs() with pages from this browser.
 *
 * @param {object} options
 * @param {string} [options.profileDir]  - Absolute path to persistent user_data_dir
 * @param {object} [options.proxy]       - { server, username, password } proxy config
 * @param {boolean} [options.headless=true]
 * @returns {Promise<import('playwright').Browser>}
 */
export async function launchCamoufox(options = {}) {
    const { Camoufox } = await import('camoufox-js');
    const { profileDir, proxy, headless = true } = options;

    const camoufoxOpts = {
        headless,
        humanize: true,
        block_webrtc: true,
    };

    if (profileDir) {
        camoufoxOpts.persistent_context = true;
        camoufoxOpts.user_data_dir = profileDir;
    }

    if (proxy) {
        camoufoxOpts.proxy = proxy;
    }

    const browser = await Camoufox(camoufoxOpts);
    return browser;
}
```

- [ ] Syntax-check `stealth.js`:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && node --input-type=module --experimental-vm-modules < /dev/null; node -e "import('./worker/bots/stealth.js').then(() => console.log('OK')).catch(e => console.error(e.message))" 2>&1 | tail -5
```

Expected: `OK` (or a harmless `playwright-extra` warning — not a crash).

- [ ] Commit:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && git add worker/bots/stealth.js && git commit -m "$(cat <<'EOF'
feat(bot): add launchCamoufox() export to stealth.js

New export wraps camoufox-js with headless/humanize/block_webrtc defaults,
optional persistent_context + user_data_dir for profile rotation, optional
proxy config. All existing stealth.js exports are untouched.

Verified: node dynamic import syntax check passes
EOF
)"
```

---

## Task 3: Update `worker/bots/rate-limits.js` — add `profileCooldown`

**Files:** `worker/bots/rate-limits.js`

- [ ] Add `profileCooldown: 3600000` to the `facebook` config block. The current block ends with `sessionCooldown: 300000`. Insert after `sessionCooldown`:

```javascript
        profileCooldown:  3600000, // 1hr minimum between uses of the same profile
```

The full `facebook` block should read:

```javascript
    facebook: {
        actionDelay:      5000,    // FB is aggressive on detection
        loginCooldown:    120000,
        maxActionsPerRun: 20,
        maxListingsPerDay: 10,     // FB flags bulk listing sessions
        maxLoginsPerDay:   3,      // Repeated logins signal bot activity
        listingDelay:     8000,    // Extra gap between listing creates
        sessionCooldown:  300000,  // 5min minimum between bot runs
        profileCooldown:  3600000, // 1hr minimum between uses of the same profile
    },
```

- [ ] Syntax-check `rate-limits.js`:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && node -e "import('./worker/bots/rate-limits.js').then(m => console.log('OK, keys:', Object.keys(m.RATE_LIMITS.facebook).join(', '))).catch(e => console.error(e.message))" 2>&1
```

Expected: `OK, keys: actionDelay, loginCooldown, maxActionsPerRun, maxListingsPerDay, maxLoginsPerDay, listingDelay, sessionCooldown, profileCooldown`

- [ ] Commit:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && git add worker/bots/rate-limits.js && git commit -m "$(cat <<'EOF'
feat(bot): add facebook.profileCooldown to rate-limits.js

1 hour minimum between uses of the same persistent browser profile to
reduce per-profile activity signals that Facebook uses to detect bots.

Verified: node import resolves RATE_LIMITS.facebook.profileCooldown
EOF
)"
```

---

## Task 4: Update `worker/bots/facebook-bot.js` — switch to Camoufox + profiles

**Files:** `worker/bots/facebook-bot.js`

### 4a — Replace the import line

Current line 4:
```javascript
import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, injectChromeRuntimeStub, injectBrowserApiStubs, stealthContextOptions } from './stealth.js';
```

Replace with:
```javascript
import { humanClick, humanScroll, mouseWiggle } from './stealth.js';
import { launchCamoufox } from './stealth.js';
import { initProfiles, getNextProfile, saveProfileUsage, flagProfile, getProfileDir } from './browser-profiles.js';
```

### 4b — Remove SESSION_PATH and SESSION_MAX_AGE_MS constants

Current lines 13–14:
```javascript
const SESSION_PATH = path.join(process.cwd(), 'data', '.fb-session.json');
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
```

Delete both lines entirely.

### 4c — Update the constructor default headless option

Current line 71:
```javascript
        this.options = { headless: 'new', slowMo: 50, ...options };
```

Replace with:
```javascript
        this.options = { headless: true, ...options };
```

`slowMo` is a Chromium-only Playwright launch option and is not accepted by Camoufox — remove it.

### 4d — Replace `init()` method body

Replace the entire `async init()` method body (lines 75–113) with:

```javascript
    async init() {
        logger.info('[FacebookBot] Initializing browser...');
        try {
            initProfiles();
            this._profile = getNextProfile();
            logger.info('[FacebookBot] Using profile:', this._profile.id);

            const proxy = process.env.FACEBOOK_PROXY_URL
                ? { server: process.env.FACEBOOK_PROXY_URL }
                : undefined;

            this.browser = await launchCamoufox({
                profileDir: getProfileDir(this._profile.id),
                proxy,
                headless: this.options.headless,
            });

            const context = this.browser.contexts()[0] || await this.browser.newContext();
            this.page = await context.newPage();

            try {
                await this.page.route('**/analytics/**', route => route.abort());
                await this.page.route('**/tracking/**', route => route.abort());
            } catch {}

            logger.info('[FacebookBot] Browser initialized with Camoufox');
        } catch (err) {
            if (this.browser) await this.browser.close().catch(() => {});
            this.browser = null;
            this.page = null;
            throw err;
        }
    }
```

### 4e — Replace the `login()` session-persistence block

In `login()`, the `_sessionLoaded` check block (the `try/catch` that reads `SESSION_PATH` and the `if (this._sessionLoaded)` block that verifies it) must be removed. Replace the entire block between `logger.info('[FacebookBot] Logging in...')` and the final `try { await this.page.goto(...)` with only:

```javascript
        logger.info('[FacebookBot] Logging in...');
        writeAuditLog('login_attempt');
```

Also remove the `storageState` save block at the end of `login()` — the lines:
```javascript
                try {
                    await this.page.context().storageState({ path: SESSION_PATH });
                    logger.info('[FacebookBot] Session saved to', SESSION_PATH);
                } catch (saveErr) {
                    logger.warn('[FacebookBot] Could not save session:', saveErr.message);
                }
```

Camoufox persistent_context persists storage automatically; no manual `storageState()` call is needed.

### 4f — Call `flagProfile` on CAPTCHA/lockout, `saveProfileUsage` on success

In `checkForCaptcha` — that function currently just throws. In `login()`, after the `if (error.message.includes('CAPTCHA'))` block, add `flagProfile(this._profile?.id)`:

Replace the `catch (error)` block in `login()`:
```javascript
        } catch (error) {
            writeAuditLog('login_error', { error: error.message });
            logger.error('[FacebookBot] Login error:', error.message);
            this.stats.errors++;
            if (error.message.includes('CAPTCHA')) {
                this.clearSession();
            }
            throw error;
        }
```

With:
```javascript
        } catch (error) {
            writeAuditLog('login_error', { error: error.message });
            logger.error('[FacebookBot] Login error:', error.message);
            this.stats.errors++;
            if (error.message.includes('CAPTCHA') || error.message.includes('lockout')) {
                if (this._profile?.id) flagProfile(this._profile.id);
            }
            throw error;
        }
```

After `writeAuditLog('login_success')` in `login()`, add:
```javascript
                if (this._profile?.id) saveProfileUsage(this._profile.id);
```

### 4g — Replace `clearSession()` method

Current `clearSession()` tries to delete `SESSION_PATH`. Replace it with a no-op that logs a deprecation note, since Camoufox persistent_context owns the session:

```javascript
    clearSession() {
        // Session is managed by Camoufox persistent_context in the profile directory.
        // To fully reset: flagProfile(this._profile.id) and let the operator delete
        // the profile directory manually.
        writeAuditLog('session_clear_noop', { profileId: this._profile?.id });
    }
```

### 4h — Remove unused `fs` import if SESSION_PATH was its only use

Check: `fs` is still used by `writeAuditLog` (appendFileSync), `readDailyStats` (readFileSync/existsSync), `writeDailyStats` (writeFileSync). Keep the `import fs from 'fs'` line — it is still needed.

### 4i — Syntax-check facebook-bot.js

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && node -e "import('./worker/bots/facebook-bot.js').then(() => console.log('OK')).catch(e => console.error(e.message))" 2>&1
```

Expected: `OK`. If there's a Camoufox binary not found error at runtime that's acceptable — syntax is valid.

- [ ] Commit:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && git add worker/bots/facebook-bot.js && git commit -m "$(cat <<'EOF'
feat(bot): migrate FacebookBot to Camoufox + persistent profile rotation

Replaces stealthChromium.launch() with launchCamoufox() using profile pool
from browser-profiles.js. Removes manual SESSION_PATH storageState — Camoufox
persistent_context handles session persistence natively. Flags profile on
CAPTCHA/lockout; saves usage on login success.

Verified: node dynamic import syntax check passes
EOF
)"
```

---

## Task 5: Update `src/backend/services/platformSync/facebookPublish.js` — switch to Camoufox + profiles

**Files:** `src/backend/services/platformSync/facebookPublish.js`

### 5a — Update `getStealth()` lazy loader and add profile imports

The file currently has a `getStealth()` lazy-loader that imports from `worker/bots/stealth.js`. Keep the lazy-loader pattern (CI may not have worker deps), but change what is destructured from it.

Add a `getProfiles()` lazy-loader for `browser-profiles.js` below `getStealth()`:

```javascript
let _profiles = null;
async function getProfiles() {
    if (!_profiles) _profiles = await import('../../../worker/bots/browser-profiles.js');
    return _profiles;
}
```

### 5b — Replace browser launch block

Current lines 98–113:
```javascript
    const { stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs, humanClick, mouseWiggle, stealthContextOptions, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, randomSlowMo } = await getStealth();

    let browser;
    try {
        browser = await stealthChromium.launch({
            headless: 'new',
            slowMo: randomSlowMo(),
            args: STEALTH_ARGS,
            ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
        });
    } catch (launchErr) {
        throw new Error(`[Facebook Publish] Browser launch failed: ${launchErr.message}`);
    }
    if (!browser) {
        throw new Error('[Facebook Publish] Browser launch returned null — Playwright may not be installed');
    }
```

Replace with:
```javascript
    const { launchCamoufox, humanClick, mouseWiggle } = await getStealth();
    const { initProfiles, getNextProfile, saveProfileUsage, flagProfile, getProfileDir } = await getProfiles();

    initProfiles();
    const profile = getNextProfile();

    const proxy = process.env.FACEBOOK_PROXY_URL
        ? { server: process.env.FACEBOOK_PROXY_URL }
        : undefined;

    let browser;
    try {
        browser = await launchCamoufox({
            profileDir: getProfileDir(profile.id),
            proxy,
            headless: true,
        });
    } catch (launchErr) {
        throw new Error(`[Facebook Publish] Browser launch failed: ${launchErr.message}`);
    }
    if (!browser) {
        throw new Error('[Facebook Publish] Browser launch returned null — camoufox-js may not be installed');
    }
```

### 5c — Replace context/page setup block

Current lines 118–127:
```javascript
        const context = await browser.newContext(stealthContextOptions('chrome'));
        if (!context) throw new Error('[Facebook Publish] Browser context creation returned null');

        const page = await context.newPage();
        if (!page) throw new Error('[Facebook Publish] Page creation returned null');
        await injectChromeRuntimeStub(page);
        await injectBrowserApiStubs(page);
        await page.route('**/analytics/**', route => route.abort());
        await page.route('**/tracking/**', route => route.abort());
```

Replace with:
```javascript
        const context = browser.contexts()[0] || await browser.newContext();
        if (!context) throw new Error('[Facebook Publish] Browser context creation returned null');

        const page = await context.newPage();
        if (!page) throw new Error('[Facebook Publish] Page creation returned null');

        // Do NOT call injectChromeRuntimeStub or injectBrowserApiStubs — they hurt
        // Camoufox's fingerprint score (firefoxResist detection, emoji DomRect mismatch).
        try {
            await page.route('**/analytics/**', route => route.abort());
            await page.route('**/tracking/**', route => route.abort());
        } catch {}
```

### 5d — Add `saveProfileUsage` on success, `flagProfile` on CAPTCHA errors

Before `return { listingId, listingUrl }` at line 305, add:
```javascript
        saveProfileUsage(profile.id);
```

In the `catch (err)` block (line 308), before `throw err`, add:
```javascript
        if (err.message && (err.message.includes('CAPTCHA') || err.message.includes('captcha'))) {
            flagProfile(profile.id);
        }
```

### 5e — Syntax-check facebookPublish.js

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && node -e "import('./src/backend/services/platformSync/facebookPublish.js').then(() => console.log('OK')).catch(e => console.error(e.message))" 2>&1
```

Expected: `OK`. A `Cannot find module 'resend'` or similar infrastructure error is acceptable — what matters is no syntax errors in this file.

- [ ] Commit:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && git add src/backend/services/platformSync/facebookPublish.js && git commit -m "$(cat <<'EOF'
feat(publish): migrate facebookPublish.js to Camoufox + profile rotation

Replaces stealthChromium.launch() with lazy-loaded launchCamoufox(). Removes
injectChromeRuntimeStub/injectBrowserApiStubs calls (harmful to Camoufox).
Wraps page.route() calls in try/catch for persistent context compatibility.
Profile flagged on CAPTCHA; usage saved on success.

Verified: node dynamic import syntax check passes
EOF
)"
```

---

## Task 6: Update `.env.example` — add `FACEBOOK_PROXY_URL`

**Files:** `.env.example`

- [ ] Locate the Facebook section in `.env.example`:

```bash
grep -n "FACEBOOK" /c/Users/Matt1/OneDrive/Desktop/vaultlister-3/.env.example
```

- [ ] Add the `FACEBOOK_PROXY_URL` comment line directly after the last `FACEBOOK_*` line found. The exact insertion depends on what grep shows — add:

```
# FACEBOOK_PROXY_URL=http://user:pass@gate.smartproxy.com:7777
```

- [ ] Verify the line was added:

```bash
grep -n "FACEBOOK_PROXY_URL" /c/Users/Matt1/OneDrive/Desktop/vaultlister-3/.env.example
```

Expected: one line with the comment.

- [ ] Commit:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && git add .env.example && git commit -m "$(cat <<'EOF'
chore(env): add FACEBOOK_PROXY_URL to .env.example

Optional residential proxy for Facebook bot. Passed directly to Camoufox
proxy config. Leave unset to run without proxy.

Verified: grep confirms line present in .env.example
EOF
)"
```

---

## Task 7: End-to-end fingerprint smoke test

**Goal:** Confirm Camoufox launches correctly in this project's node_modules.

- [ ] Run the fingerprint smoke test:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && node -e "
import('camoufox-js').then(async ({ Camoufox }) => {
    console.log('camoufox-js imported OK');
    const browser = await Camoufox({ headless: true, humanize: true, block_webrtc: true });
    const context = browser.contexts()[0] || await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://www.whatismybrowser.com/detect/is-javascript-enabled', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await page.title();
    console.log('Page title:', title);
    await browser.close();
    console.log('SMOKE TEST PASSED');
}).catch(e => { console.error('SMOKE TEST FAILED:', e.message); process.exit(1); });
" 2>&1
```

Expected output contains `SMOKE TEST PASSED`. If Camoufox binary is not yet downloaded, it will auto-download on first run — allow up to 2 minutes.

- [ ] If the smoke test passes, run `launchCamoufox` via stealth.js:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && node -e "
import('./worker/bots/stealth.js').then(async ({ launchCamoufox }) => {
    const browser = await launchCamoufox({ headless: true });
    const ctx = browser.contexts()[0] || await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('about:blank');
    const ua = await page.evaluate(() => navigator.userAgent);
    console.log('UA:', ua);
    await browser.close();
    console.log('launchCamoufox() OK');
}).catch(e => console.error('FAILED:', e.message));
" 2>&1
```

Expected: UA string containing `Firefox/` and `launchCamoufox() OK`.

- [ ] If both pass, run `initProfiles()` smoke test:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && node -e "
import('./worker/bots/browser-profiles.js').then(({ initProfiles, getNextProfile, getProfileDir }) => {
    initProfiles(3);
    const p = getNextProfile();
    console.log('Profile:', p.id, '| dir:', getProfileDir(p.id));
    const fs = await import('fs'); // verify dir exists
}).catch(e => console.error('FAILED:', e.message));
" 2>&1
```

Wait — `await import` inside non-async context. Use this corrected version:

```bash
cd /c/Users/Matt1/OneDrive/Desktop/vaultlister-3 && node -e "
(async () => {
    const { initProfiles, getNextProfile, getProfileDir } = await import('./worker/bots/browser-profiles.js');
    const fs = await import('fs');
    initProfiles(3);
    const p = getNextProfile();
    const dir = getProfileDir(p.id);
    const exists = fs.existsSync(dir);
    console.log('Profile:', p.id, '| dir exists:', exists);
    console.log('PROFILE TEST PASSED');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
" 2>&1
```

Expected: `PROFILE TEST PASSED` with a valid profile ID and `dir exists: true`.

---

## Rollback Plan

If Camoufox causes unexpected issues on live Facebook sessions:

1. In `facebook-bot.js` `init()`, replace `launchCamoufox(...)` with the original `stealthChromium.launch(...)` block.
2. In `facebookPublish.js`, destructure `stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs, stealthContextOptions, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, randomSlowMo` from `getStealth()` and restore the original context setup.
3. Neither `browser-profiles.js` nor the rate-limit addition need to be reverted — they are additive.
4. The profile directories in `data/.browser-profiles/` can remain — they are git-ignored.

---

## Definition of Done

- [ ] `browser-profiles.js` exists and syntax-checks clean
- [ ] `stealth.js` exports `launchCamoufox` and all existing exports remain
- [ ] `rate-limits.js` has `facebook.profileCooldown: 3600000`
- [ ] `facebook-bot.js` uses `launchCamoufox` + profiles, no references to `stealthChromium`, `SESSION_PATH`, `injectChromeRuntimeStub`, `injectBrowserApiStubs`
- [ ] `facebookPublish.js` uses `launchCamoufox` + profiles, no references to `stealthChromium`, `injectChromeRuntimeStub`, `injectBrowserApiStubs`
- [ ] `.env.example` has `FACEBOOK_PROXY_URL` comment
- [ ] Smoke test: `launchCamoufox()` returns Firefox UA
- [ ] Smoke test: `initProfiles()` + `getNextProfile()` create and return valid profile
- [ ] All 6 commits created with `[AUTO]` prefix + `Verified:` trailers
