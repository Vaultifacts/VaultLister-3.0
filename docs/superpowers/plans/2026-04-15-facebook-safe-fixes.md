# Facebook Bot Safe Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden both Facebook automation paths (Playwright bot + Chrome extension) against detection, fix known failure modes, and clean up three stale uncommitted edits — all in a single commit.

**Files touched:**
- `worker/bots/facebook-bot.js`
- `src/backend/services/platformSync/facebookPublish.js`
- `chrome-extension/content/poster.js`
- `worker/bots/rate-limits.js`
- `worker/Dockerfile`
- `.env.example`
- `src/backend/services/platformSync/index.js` (stale — already edited, needs commit)
- `scripts/bot-keepalive.js` (stale — already edited, needs commit)
- `src/backend/server.js` (stale — already edited, needs commit)

---

### Task 1: Replace route.abort() with route.fulfill() in facebook-bot.js and facebookPublish.js

**Why:** `route.abort()` causes a visible "failed" network entry in DevTools. `route.fulfill()` with a 200 returns a fake success response, preventing the "aborted request" anomaly while still suppressing tracking payload delivery.

**Files:**
- Modify: `worker/bots/facebook-bot.js` lines 95–97
- Modify: `src/backend/services/platformSync/facebookPublish.js` lines 140–141

- [ ] **Step 1: Update facebook-bot.js route handlers**

In `worker/bots/facebook-bot.js`, replace lines 94–97:

```javascript
            try {
                await this.page.route('**/analytics/**', route => route.abort());
                await this.page.route('**/tracking/**', route => route.abort());
            } catch {}
```

with:

```javascript
            try {
                await this.page.route('**/analytics/**', route => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
                await this.page.route('**/tracking/**', route => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
            } catch {}
```

- [ ] **Step 2: Update facebookPublish.js route handlers**

In `src/backend/services/platformSync/facebookPublish.js`, replace lines 139–142:

```javascript
        try {
            await page.route('**/analytics/**', route => route.abort());
            await page.route('**/tracking/**', route => route.abort());
        } catch {}
```

with:

```javascript
        try {
            await page.route('**/analytics/**', route => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
            await page.route('**/tracking/**', route => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
        } catch {}
```

---

### Task 2: Fix setContentEditable fallback in poster.js

**Why:** The current fallback `el.textContent = value` at line 77–79 silently fails on Facebook's Lexical editor. `execCommand('insertText')` fires `beforeinput` events that Lexical listens to. If that also fails, a clipboard paste simulation is more reliable than direct DOM mutation.

**File:** `chrome-extension/content/poster.js` lines 72–80

- [ ] **Step 3: Replace setContentEditable function**

Replace lines 72–80 in `chrome-extension/content/poster.js`:

```javascript
// Set value on a contenteditable div (Facebook uses these for description)
function setContentEditable(el, value) {
    el.focus();
    el.textContent = '';
    document.execCommand('insertText', false, value);
    if (!el.textContent) {
        el.textContent = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
}
```

with:

```javascript
// Set value on a contenteditable div (Facebook Lexical editor)
function setContentEditable(el, value) {
    el.focus();
    // Clear existing content
    document.execCommand('selectAll');
    document.execCommand('delete');
    // Primary: execCommand insertText (fires isTrusted beforeinput that Lexical observes)
    document.execCommand('insertText', false, value);
    // Verify insertion worked
    if (!el.textContent || el.textContent.trim() !== value.trim()) {
        // Fallback: clipboard paste simulation
        const dt = new DataTransfer();
        dt.setData('text/plain', value);
        el.dispatchEvent(new ClipboardEvent('paste', {
            bubbles: true, cancelable: true, clipboardData: dt
        }));
    }
    // Last resort: direct DOM mutation
    if (!el.textContent || el.textContent.trim() !== value.trim()) {
        el.textContent = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
}
```

---

### Task 3: Switch networkidle to domcontentloaded in facebook-bot.js

**Why:** `networkidle` blocks until ALL network activity settles — on Facebook this can take 30+ seconds due to analytics beacons, and the extended wait itself is a behavioral signal. `domcontentloaded` + a jittered human-reading pause is safer.

**File:** `worker/bots/facebook-bot.js` — 5 occurrences at lines 119, 130, 180, 224, 266

- [ ] **Step 4: Replace networkidle at line 119 (login goto)**

Replace:
```javascript
            await this.page.goto(`${FB_URL}/login`, { waitUntil: 'networkidle' });
```
with:
```javascript
            await this.page.goto(`${FB_URL}/login`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
```

- [ ] **Step 5: Replace networkidle at line 130 (post-login navigation)**

Replace:
```javascript
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });
```
with:
```javascript
            await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
```

- [ ] **Step 6: Replace networkidle at line 180 (refreshListing goto)**

Replace:
```javascript
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
```
with:
```javascript
            await this.page.goto(listingUrl, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
```

- [ ] **Step 7: Replace networkidle at line 224 (refreshAllListings goto)**

Replace:
```javascript
            await this.page.goto(`${FB_URL}/marketplace/you/selling`, { waitUntil: 'networkidle' });
```
with:
```javascript
            await this.page.goto(`${FB_URL}/marketplace/you/selling`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
```

- [ ] **Step 8: Replace networkidle at line 266 (relistItem goto)**

Replace:
```javascript
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
```
with:
```javascript
            await this.page.goto(listingUrl, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
```

---

### Task 4: Fix location field in poster.js fillFacebook() to trigger typeahead

**Why:** `setReactInputValue` sets the value property directly but does not type character-by-character. Facebook's location field uses a GraphQL typeahead that only fires on incremental `input` events. Without the typeahead triggering, no suggestion appears and no location value is saved.

**File:** `chrome-extension/content/poster.js` lines 319–333

- [ ] **Step 9: Replace the Location block in fillFacebook()**

Replace lines 319–333:

```javascript
    // Location
    try {
        const location = data.location || data.zip_code;
        if (location) {
            const locEl = await findElement([
                'input[aria-label*="location" i]',
                'input[placeholder*="location" i]',
                'input[aria-label*="city" i]'
            ], 4000);
            if (locEl) {
                setReactInputValue(locEl, String(location));
            } else {
                skipped.push('Location');
            }
        }
    } catch { skipped.push('Location'); }
```

with:

```javascript
    // Location — uses GraphQL typeahead; must type char-by-char and click first suggestion
    try {
        const location = data.location || data.zip_code;
        if (location) {
            const locEl = await findElement([
                'input[aria-label*="location" i]',
                'input[placeholder*="location" i]',
                'input[aria-label*="city" i]'
            ], 4000);
            if (locEl) {
                locEl.focus();
                locEl.value = '';
                locEl.dispatchEvent(new Event('input', { bubbles: true }));
                for (const char of String(location)) {
                    locEl.value += char;
                    locEl.dispatchEvent(new Event('input', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 150 + Math.floor(Math.random() * 150)));
                }
                // Wait for typeahead suggestions dropdown
                await new Promise(r => setTimeout(r, 2000));
                const suggestion = document.querySelector(
                    'ul[role="listbox"] li:first-child > div, ul[role="listbox"] li[role="option"]:first-child'
                );
                if (suggestion) {
                    suggestion.click();
                    await new Promise(r => setTimeout(r, 500));
                } else {
                    skipped.push('Location');
                }
            } else {
                skipped.push('Location');
            }
        }
    } catch { skipped.push('Location'); }
```

---

### Task 5: Add browser restart mechanism to facebook-bot.js

**Why:** Long `refreshAllListings()` runs accumulate memory in Firefox (Camoufox). Restarting every 10 listings clears leaked memory and resets the browser's behavioral fingerprint.

**File:** `worker/bots/facebook-bot.js`

- [ ] **Step 10: Add RESTART_EVERY_N_LISTINGS constant**

Add after the existing constants at the top of the file (after line 15, before `function writeAuditLog`):

```javascript
const RESTART_EVERY_N_LISTINGS = 10;
```

- [ ] **Step 11: Add restart logic inside refreshAllListings() loop**

In `refreshAllListings()`, replace the for-loop body (lines 237–241):

```javascript
            for (const link of uniqueLinks) {
                const success = await this.refreshListing(link);
                if (success) refreshed++;
                else skipped++;
                await this.page.waitForTimeout(jitteredDelay(delayBetween));
            }
```

with:

```javascript
            for (const link of uniqueLinks) {
                const success = await this.refreshListing(link);
                if (success) refreshed++;
                else skipped++;
                await this.page.waitForTimeout(jitteredDelay(delayBetween));

                if (refreshed > 0 && refreshed % RESTART_EVERY_N_LISTINGS === 0) {
                    logger.info('[FacebookBot] Restarting browser to prevent memory accumulation');
                    const profileDir = getProfileDir(this._profile.id);
                    const lockFile = path.join(profileDir, 'SingletonLock');
                    try { fs.unlinkSync(lockFile); } catch {}
                    await this.close();
                    await this.init();
                    await this.login();
                }
            }
```

---

### Task 6: Add account-age gating to rate-limits.js and .env.example

**Why:** New Facebook accounts are detected as high-risk by Marketplace's fraud systems. Adding a configurable minimum account age lets operators self-document this constraint and the bot can log a warning if the env var is unset.

**Files:**
- Modify: `worker/bots/rate-limits.js`
- Modify: `.env.example`

- [ ] **Step 12: Add minAccountAgeDays to rate-limits.js facebook config**

In `worker/bots/rate-limits.js`, in the `facebook` object (around line 32–41), add `minAccountAgeDays` as the last property before the closing `}`:

Replace:
```javascript
    facebook: {
        actionDelay:      5000,    // FB is aggressive on detection
        loginCooldown:    120000,
        maxActionsPerRun: 20,
        maxListingsPerDay: 10,     // FB flags bulk listing sessions
        maxLoginsPerDay:   3,      // Repeated logins signal bot activity
        listingDelay:     8000,    // Extra gap between listing creates
        sessionCooldown:  300000,  // 5min minimum between bot runs
        profileCooldown:  3600000, // 1hr minimum between uses of same profile
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
        profileCooldown:  3600000, // 1hr minimum between uses of same profile
        minAccountAgeDays: parseInt(process.env.FACEBOOK_MIN_ACCOUNT_AGE_DAYS || '3'), // New accounts are high-risk
    },
```

- [ ] **Step 13: Add FACEBOOK_MIN_ACCOUNT_AGE_DAYS to .env.example**

In `.env.example`, after the existing `# FACEBOOK_PROXY_URL=...` line (line 178), add:

```
# Minimum age of Facebook account in days before automation is considered safe (default: 3)
# FACEBOOK_MIN_ACCOUNT_AGE_DAYS=3
```

---

### Tasks 7 + 11 (combined): Add seller verification URL patterns to both Facebook automation files

**Why:** Facebook's seller verification flow (`/marketplace/verify`, `/seller-verification`, `/identity`) triggers after listing a certain number of items or if anomalies are detected. Without detecting these URLs, the bot silently fails — adding them to the checkpoint detection block ensures immediate halt and audit log entry.

**Files:**
- Modify: `worker/bots/facebook-bot.js` lines 133–141 (checkpoint detection in `login()`)
- Modify: `src/backend/services/platformSync/facebookPublish.js` lines 167–175 (checkpoint detection after login)

- [ ] **Step 14: Extend checkpoint detection in facebook-bot.js**

In `worker/bots/facebook-bot.js`, replace the checkpoint detection block (lines 133–142):

```javascript
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

with:

```javascript
            if (
                currentUrl.includes('/checkpoint') ||
                currentUrl.includes('/account_locked') ||
                currentUrl.includes('/help/contact') ||
                currentUrl.includes('/disabled') ||
                currentUrl.includes('/marketplace/verify') ||
                currentUrl.includes('/seller-verification') ||
                currentUrl.includes('/identity')
            ) {
                this.clearSession();
                writeAuditLog('account_lockout_detected', { url: currentUrl });
                throw new Error(`Facebook account restriction detected (URL: ${currentUrl}). Manual intervention required.`);
            }
```

- [ ] **Step 15: Extend checkpoint detection in facebookPublish.js**

In `src/backend/services/platformSync/facebookPublish.js`, replace the afterLogin checkpoint block (lines 170–175):

```javascript
        if (afterLogin.includes('/checkpoint') || afterLogin.includes('/two_step_verification') || afterLogin.includes('/login/two-factor')) {
            throw new Error('Facebook security check detected after login (2FA or checkpoint). Complete the verification manually, then retry.');
        }
```

with:

```javascript
        if (
            afterLogin.includes('/checkpoint') ||
            afterLogin.includes('/two_step_verification') ||
            afterLogin.includes('/login/two-factor') ||
            afterLogin.includes('/marketplace/verify') ||
            afterLogin.includes('/seller-verification') ||
            afterLogin.includes('/identity')
        ) {
            throw new Error('Facebook security check detected after login (2FA, checkpoint, or seller verification). Complete the verification manually, then retry.');
        }
```

---

### Task 8: Add AI button detection to facebookPublish.js

**Why:** Meta's Marketplace create page now sometimes pre-populates fields via an AI assistant or shows an "AI listing" button. If the bot clicks it by accident, the form is submitted with AI-generated content instead of the actual listing data.

**File:** `src/backend/services/platformSync/facebookPublish.js`

- [ ] **Step 16: Add AI pre-population guard after navigating to create page**

In `facebookPublish.js`, after the `captchaOnCreate` check (after line 187, before the comment `// Step 3: Upload photos`), insert:

```javascript
        // Guard: Meta AI sometimes pre-populates the title field — clear it if present.
        // Also skip any "Create listing details" AI button — fill fields manually.
        const aiButton = await page.$('button:has-text("Create listing details"), [aria-label*="AI" i]:has-text("Create")');
        if (aiButton) {
            logger.info('[Facebook Publish] AI listing button detected — skipping, proceeding with manual fill');
        }
        const titleFieldEarly = await page.$('input[placeholder*="title" i], input[aria-label*="title" i]');
        if (titleFieldEarly) {
            const existingTitle = await titleFieldEarly.inputValue().catch(() => '');
            if (existingTitle.length > 0) {
                logger.info('[Facebook Publish] Detected AI pre-populated title field, clearing');
                await page.click('input[placeholder*="title" i], input[aria-label*="title" i]', { clickCount: 3 });
                await page.keyboard.press('Backspace');
            }
        }
```

---

### Task 9: Docker shm-size and GTK3 dependencies for worker

**Why:** Camoufox launches Firefox, which requires `/dev/shm` for shared memory between processes. The default Railway container allocates only 64 MB of shm, causing Firefox to crash on form-heavy pages. GTK3, xvfb, and related X11 libs are required for headless Firefox outside the Playwright base image context.

**File:** `worker/Dockerfile`

- [ ] **Step 17: Add shm-size env and GTK3/xvfb dependencies**

In `worker/Dockerfile`, replace the entire file with the following (the only additions are the `RUN apt-get` block for GTK3/xvfb after the bun install lines, and the `ENV RAILWAY_SHM_SIZE_BYTES` before `CMD`):

```dockerfile
# VaultLister Playwright Worker
# Separate Railway service — handles all browser automation (Poshmark, Mercari, etc.)

FROM mcr.microsoft.com/playwright:v1.58.2-noble AS base

# Install Bun
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# GTK3 and X11 libs required for Camoufox (headless Firefox)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 libx11-xcb1 libasound2 xvfb libdbus-1-3 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY worker/package.json ./worker/

# Install root deps (postgres.js, shared utils)
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Install worker deps
WORKDIR /app/worker
RUN bun install

WORKDIR /app

# Copy source
COPY src/ src/
COPY worker/ worker/

ENV NODE_ENV=production

# Camoufox (Firefox) requires adequate shared memory — Railway reads this env var
ENV RAILWAY_SHM_SIZE_BYTES=2147483648

# Verify the BullMQ worker process is alive by checking its PID file or process list
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD pgrep -f "bun worker/index.js" > /dev/null || exit 1

CMD ["bun", "worker/index.js"]
```

---

### Task 10: Update camoufox-js to 0.10.2

**Why:** v0.10.2 may fix the glyph rendering bug observed in prior sessions.

**File:** `worker/package.json` (via `bun update`)

- [ ] **Step 18: Update camoufox-js**

Run from the repo root:
```bash
cd worker && bun update camoufox-js
```

Verify the version in `worker/package.json` changed. If `bun update camoufox-js` installs a version other than 0.10.2, log it but do not force — accept whatever current latest is.

---

### Task 12: Commit stale uncommitted edits

**Why:** Three files have working edits that were never committed: `platformSync/index.js` (`oauthSupported: false`), `bot-keepalive.js` (`profileDir` replaces `cookieFile`), and `server.js` (comment clarifying facebook OAuth status). These are independent of the above tasks and need to be bundled into the same commit.

Diffs confirmed:
- `src/backend/services/platformSync/index.js`: `oauthSupported: true` → `oauthSupported: false // Facebook OAuth removed — listing via Chrome extension/Playwright only`
- `scripts/bot-keepalive.js`: `cookieFile: path.join(ROOT_DIR, 'data', 'facebook-cookies.json')` → `profileDir: path.join(ROOT_DIR, 'data', '.browser-profiles')`
- `src/backend/server.js`: inline comment added to VALID_PLATFORMS array clarifying facebook entry

No additional code changes needed for these — they are already in the working tree.

---

### Syntax Check + Commit

- [ ] **Step 19: Syntax check all modified JavaScript files**

```bash
node -c worker/bots/facebook-bot.js
node -c src/backend/services/platformSync/facebookPublish.js
node -c chrome-extension/content/poster.js
node -c worker/bots/rate-limits.js
node -c src/backend/services/platformSync/index.js
node -c scripts/bot-keepalive.js
node -c src/backend/server.js
```

All must exit 0. Fix any syntax errors before proceeding.

- [ ] **Step 20: Single commit covering all changes**

```bash
git add worker/bots/facebook-bot.js
git add src/backend/services/platformSync/facebookPublish.js
git add chrome-extension/content/poster.js
git add worker/bots/rate-limits.js
git add worker/Dockerfile
git add .env.example
git add src/backend/services/platformSync/index.js
git add scripts/bot-keepalive.js
git add src/backend/server.js
git add worker/package.json
git add worker/bun.lockb
git commit -m "[AUTO] fix(facebook): anti-detection hardening, Lexical fix, stale edits

- route.abort() → route.fulfill() in bot + publish service (fake 200 success,
  no visible 'aborted' network anomaly)
- setContentEditable: execCommand primary + clipboard paste fallback for Lexical
- networkidle → domcontentloaded + jitteredDelay(2000) on all 5 Facebook gotos
- Location field: char-by-char typeahead + first-suggestion click in poster.js
- refreshAllListings: browser restart every 10 listings (memory + fingerprint reset)
- rate-limits.js: minAccountAgeDays from FACEBOOK_MIN_ACCOUNT_AGE_DAYS env var
- Checkpoint detection: add /marketplace/verify, /seller-verification, /identity
- facebookPublish: guard against Meta AI pre-populated fields before manual fill
- Dockerfile: GTK3/xvfb deps + RAILWAY_SHM_SIZE_BYTES=2147483648 for Camoufox
- camoufox-js updated to latest (0.10.2)
- Stale edits committed: oauthSupported false, profileDir, server.js comment

Verified: node -c passes on all 7 modified JS files"
```
