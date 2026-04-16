// Facebook Marketplace Automation Bot using Playwright
// Handles refreshing and relisting on Facebook Marketplace

import { humanClick, humanScroll, mouseWiggle } from './stealth.js';
import { launchCamoufox } from './stealth.js';
import { initProfiles, getNextProfile, saveProfileUsage, flagProfile, getProfileDir, getProfileBehavior, getProfileProxy, cleanProfileServiceWorkers } from './browser-profiles.js';
import fs from 'fs';
import path from 'path';
import { RATE_LIMITS, jitteredDelay, randomDelay } from './rate-limits.js';
import { logger } from '../../src/backend/shared/logger.js';
import { closeBrowserWithTimeout, captureErrorScreenshot, purgeOldErrorScreenshots } from './bot-utils.js';

const FB_URL = 'https://www.facebook.com';
const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');
const DAILY_STATS_PATH = path.join(process.cwd(), 'data', '.fb-daily-stats.json');
const RESTART_EVERY_N_LISTINGS = 10;
const WEEKLY_STATS_PATH = path.join(process.cwd(), 'data', '.fb-weekly-stats.json');
const RELIST_TRACKER_PATH = path.join(process.cwd(), 'data', '.fb-relist-tracker.json');
const COOLDOWN_PATH = path.join(process.cwd(), 'data', '.fb-cooldown.json');
const SESSION_LOCK_PATH = path.join(process.cwd(), 'data', '.fb-session.lock');

function writeAuditLog(event, metadata = {}) {
    try {
        const entry = JSON.stringify({ ts: new Date().toISOString(), platform: 'facebook', event, ...metadata });
        fs.appendFileSync(AUDIT_LOG, entry + '\n');
    } catch {}
}

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
    return { date: getTodayKey(), logins: 0, listings: 0, relists: 0 };
}

function writeDailyStats(stats) {
    try {
        fs.writeFileSync(DAILY_STATS_PATH, JSON.stringify(stats), 'utf8');
    } catch {}
}

// Weekly stats — tracks which days had listing activity for rest day enforcement
function readWeeklyStats() {
    try {
        if (fs.existsSync(WEEKLY_STATS_PATH)) {
            const data = JSON.parse(fs.readFileSync(WEEKLY_STATS_PATH, 'utf8'));
            // Keep only last 7 days
            const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
            data.activeDays = (data.activeDays || []).filter(d => d >= cutoff);
            return data;
        }
    } catch {}
    return { activeDays: [] };
}

function writeWeeklyStats(stats) {
    try { fs.writeFileSync(WEEKLY_STATS_PATH, JSON.stringify(stats), 'utf8'); } catch {}
}

function recordActiveDay() {
    const stats = readWeeklyStats();
    const today = getTodayKey();
    if (!stats.activeDays.includes(today)) stats.activeDays.push(today);
    writeWeeklyStats(stats);
}

function isRestDayNeeded() {
    const stats = readWeeklyStats();
    // If active 6+ of last 7 days, force a rest day
    return stats.activeDays.length >= 6;
}

// Velocity ramp based on account age (minAccountAgeDays from rate-limits)
function getVelocityCap() {
    const accountAgeDays = RATE_LIMITS.facebook.minAccountAgeDays || 3;
    // Day 1-7: 2/day, Day 8-14: 4/day, Day 15-30: 6/day, Day 31+: 10/day
    // Since we can't know exact account age here, use the configured minimum
    // as a proxy. Users with minAccountAgeDays=3 (default) get full cap.
    // Users who set it higher get ramped velocity.
    if (accountAgeDays <= 7) return 2;
    if (accountAgeDays <= 14) return 4;
    if (accountAgeDays <= 30) return 6;
    return RATE_LIMITS.facebook.maxListingsPerDay;
}

// Relist tracker — enforces per-item relist frequency (max once per 14 days)
function readRelistTracker() {
    try {
        if (fs.existsSync(RELIST_TRACKER_PATH)) {
            return JSON.parse(fs.readFileSync(RELIST_TRACKER_PATH, 'utf8'));
        }
    } catch {}
    return {};
}

function writeRelistTracker(tracker) {
    try { fs.writeFileSync(RELIST_TRACKER_PATH, JSON.stringify(tracker), 'utf8'); } catch {}
}

function canRelistItem(listingUrl) {
    const tracker = readRelistTracker();
    const lastRelist = tracker[listingUrl];
    if (!lastRelist) return true;
    const daysSince = (Date.now() - new Date(lastRelist).getTime()) / 86400000;
    return daysSince >= 14;
}

function recordRelist(listingUrl) {
    const tracker = readRelistTracker();
    tracker[listingUrl] = new Date().toISOString();
    // Prune entries older than 30 days
    const cutoff = Date.now() - 30 * 86400000;
    for (const url of Object.keys(tracker)) {
        if (new Date(tracker[url]).getTime() < cutoff) delete tracker[url];
    }
    writeRelistTracker(tracker);
}

// Session lock — per spec Layer 6: never run two automation sessions simultaneously
function acquireSessionLock() {
    if (fs.existsSync(SESSION_LOCK_PATH)) {
        try {
            const lock = JSON.parse(fs.readFileSync(SESSION_LOCK_PATH, 'utf8'));
            // Stale lock: if older than 30 minutes, force release
            if (Date.now() - new Date(lock.ts).getTime() > 30 * 60 * 1000) {
                releaseSessionLock();
            } else {
                return false;
            }
        } catch { releaseSessionLock(); }
    }
    fs.writeFileSync(SESSION_LOCK_PATH, JSON.stringify({ ts: new Date().toISOString(), pid: process.pid }), 'utf8');
    return true;
}

function releaseSessionLock() {
    try { fs.unlinkSync(SESSION_LOCK_PATH); } catch {}
}

// Nighttime enforcement — per spec Layer 6: no listings between 11pm and 7am local time
function isNighttime() {
    const hour = new Date().getHours();
    return hour >= 23 || hour < 7;
}

// Escalating cooldown — per spec Layer 7
// 1 detection in 7 days → 24h cooldown
// 2 detections → 48h, 3 → 72h, 4+ → quarantined (manual review)
function readCooldown() {
    try {
        if (fs.existsSync(COOLDOWN_PATH)) {
            return JSON.parse(fs.readFileSync(COOLDOWN_PATH, 'utf8'));
        }
    } catch {}
    return { events: [], cooldownUntil: null, quarantined: false };
}

function writeCooldown(data) {
    try { fs.writeFileSync(COOLDOWN_PATH, JSON.stringify(data, null, 2), 'utf8'); } catch {}
}

function recordDetectionEvent(type, details = {}) {
    const data = readCooldown();
    const now = new Date().toISOString();
    data.events.push({ ts: now, type, ...details });
    // Keep only events from last 7 days
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    data.events = data.events.filter(e => e.ts >= cutoff);
    const count = data.events.length;
    if (count >= 4) {
        data.quarantined = true;
        data.cooldownUntil = null;
        logger.error('[FacebookBot] QUARANTINED — 4+ detection events in 7 days. Manual review required.');
    } else {
        const hours = count * 24; // 24h, 48h, 72h
        data.cooldownUntil = new Date(Date.now() + hours * 3600000).toISOString();
        logger.warn(`[FacebookBot] Cooldown activated: ${hours}h (${count} events in 7 days)`);
    }
    writeCooldown(data);
    writeAuditLog('detection_cooldown', { type, count, cooldownUntil: data.cooldownUntil, quarantined: data.quarantined });
}

function isCoolingDown() {
    const data = readCooldown();
    if (data.quarantined) {
        logger.error('[FacebookBot] Account quarantined — manual review required before resuming automation.');
        return true;
    }
    if (data.cooldownUntil && new Date(data.cooldownUntil) > new Date()) {
        const remaining = Math.round((new Date(data.cooldownUntil) - new Date()) / 3600000);
        logger.warn(`[FacebookBot] Cooling down — ${remaining}h remaining.`);
        return true;
    }
    return false;
}

async function checkForCaptcha(page) {
    const captcha = await page.$('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], [data-testid*="captcha"]');
    if (captcha) {
        writeAuditLog('captcha_detected');
        recordDetectionEvent('captcha', { url: page.url() });
        throw new Error('CAPTCHA detected — stopping automation. Please solve manually.');
    }
}

async function humanType(page, selector, text, behavior = null) {
    await page.click(selector);
    const mean = behavior?.typingSpeed?.mean || 100;
    const stddev = behavior?.typingSpeed?.stddev || 40;
    const typoFreq = behavior?.typoFrequency || 0;
    const typoDelay = behavior?.typoCorrectionDelay || 300;
    for (let i = 0; i < text.length; i++) {
        // Occasional typo: wrong char, pause, backspace, correct char
        if (typoFreq > 0 && Math.random() < typoFreq) {
            const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
            await page.keyboard.type(wrongChar);
            await page.waitForTimeout(randomDelay(typoDelay - 100, typoDelay + 200));
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(randomDelay(50, 150));
        }
        await page.keyboard.type(text[i]);
        // Gaussian-ish delay: mean ± stddev
        const delay = Math.max(30, Math.round(mean + (Math.random() - 0.5) * 2 * stddev));
        await page.waitForTimeout(delay);
        // Mid-typing pause every 15-25 chars (composition hesitation)
        if (i > 0 && i % (15 + Math.floor(Math.random() * 10)) === 0) {
            await page.waitForTimeout(randomDelay(400, 900));
        }
    }
}

export class FacebookBot {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.options = { headless: true, ...options };
        this.stats = { refreshes: 0, relists: 0, errors: 0 };
        this._baseUrl = options._baseUrl || FB_URL;
    }

    async init() {
        logger.info('[FacebookBot] Initializing browser...');
        // Session lock — prevent concurrent Facebook automation
        if (!acquireSessionLock()) {
            throw new Error('Another Facebook automation session is already running. Wait for it to complete.');
        }
        try {
            initProfiles();
            this._profile = getNextProfile();
            this._behavior = getProfileBehavior(this._profile.id);

            // Clean Service Worker registrations and favicon cache to prevent
            // supercookie tracking across sessions (Gap #18)
            cleanProfileServiceWorkers(this._profile.id);

            logger.info('[FacebookBot] Using profile:', this._profile.id, 'behavior:', { typingMean: this._behavior.typingSpeed.mean, overshoot: this._behavior.mouseOvershoot });

            // Per-profile proxy (Gap #2) — each profile gets its own proxy
            // to prevent cross-account IP correlation. Falls back to shared env var.
            const proxyUrl = getProfileProxy(this._profile.id);
            const proxy = proxyUrl ? { server: proxyUrl } : undefined;

            const { browser, context, page } = await launchCamoufox({
                profileDir: getProfileDir(this._profile.id),
                proxy,
                headless: this.options.headless,
            });
            this.browser = browser;
            this.page = page;

            // page.route() removed — Camoufox ships with uBlock Origin which handles
            // analytics/tracking blocking. page.route() is a confirmed detection vector
            // (Camoufox Issues #271, #428) because Facebook detects dropped telemetry requests.

            logger.info('[FacebookBot] Browser initialized with Camoufox');
        } catch (err) {
            if (this.browser) await this.browser.close().catch(() => {});
            this.browser = null;
            this.page = null;
            throw err;
        }
    }

    async login() {
        // Nighttime enforcement — no automation between 11pm and 7am
        if (isNighttime()) {
            throw new Error('Nighttime enforcement: no automation between 11pm and 7am local time.');
        }
        // Escalating cooldown check — halt if in cooldown or quarantined
        if (isCoolingDown()) {
            throw new Error('Account is in cooldown or quarantined after detection events. Wait for cooldown to expire or manually review.');
        }
        const dailyStats = readDailyStats();
        if (dailyStats.logins >= RATE_LIMITS.facebook.maxLoginsPerDay) {
            throw new Error(`Daily login cap reached (${RATE_LIMITS.facebook.maxLoginsPerDay} logins/day). Try again tomorrow.`);
        }
        const email = process.env.FACEBOOK_EMAIL;
        const password = process.env.FACEBOOK_PASSWORD;
        if (!email || !password) throw new Error('FACEBOOK_EMAIL and FACEBOOK_PASSWORD must be set in .env');
        logger.info('[FacebookBot] Logging in...');
        writeAuditLog('login_attempt');
        try {
            await this.page.goto(`${this._baseUrl}/login`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
            await checkForCaptcha(this.page);
            await this.page.waitForSelector('#email, input[name="email"]', { timeout: 10000 });

            await humanType(this.page, '#email, input[name="email"]', email, this._behavior);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, '#pass, input[name="pass"]', password, this._behavior);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await this.page.click('button[name="login"], button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
            await checkForCaptcha(this.page);
            const currentUrl = this.page.url();
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
                recordDetectionEvent('lockout', { url: currentUrl });
                throw new Error(`Facebook account restriction detected (URL: ${currentUrl}). Manual intervention required.`);
            }

            const loggedIn = await this.page.$('[aria-label="Your profile"], [data-testid="royal_profile_link"]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                writeAuditLog('login_success');
                dailyStats.logins++;
                writeDailyStats(dailyStats);
                if (this._profile?.id) saveProfileUsage(this._profile.id);
                logger.info('[FacebookBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            writeAuditLog('login_error', { error: error.message });
            logger.error('[FacebookBot] Login error:', error.message);
            this.stats.errors++;
            if (error.message.includes('CAPTCHA') || error.message.includes('lockout')) {
                if (this._profile?.id) flagProfile(this._profile.id);
            }
            throw error;
        }
    }

    /**
     * Session warmup — browse homepage and marketplace before any listing operations.
     * Makes the session look like a real user who happened to be on Facebook.
     * Per spec Layer 5: minimum 60s warmup before any automation action.
     */
    async warmup() {
        logger.info('[FacebookBot] Starting session warmup...');
        writeAuditLog('warmup_start');
        try {
            // Step 1: Browse homepage feed
            await this.page.goto(`${this._baseUrl}`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(3000));
            await mouseWiggle(this.page);

            // Scroll through 4-6 feed items at variable speed
            const scrollPasses = 4 + Math.floor(Math.random() * 3);
            for (let i = 0; i < scrollPasses; i++) {
                await humanScroll(this.page);
                await this.page.waitForTimeout(randomDelay(2000, 5000));
                await mouseWiggle(this.page);
            }

            // Hover over 1-2 post elements briefly (reading dwell)
            const feedPosts = await this.page.$$('[data-testid="Keycommand_wrapper"] > div, [role="article"]');
            const postsToHover = feedPosts.slice(0, Math.min(2, feedPosts.length));
            for (const post of postsToHover) {
                try {
                    await post.hover();
                    await this.page.waitForTimeout(randomDelay(3000, 8000));
                } catch {}
            }

            // Step 2: Navigate to Marketplace via sidebar link (not direct URL)
            const marketplaceLink = await this.page.$('a[href*="/marketplace"][role="link"], a[href*="/marketplace"]');
            if (marketplaceLink) {
                await humanClick(this.page, marketplaceLink);
            } else {
                await this.page.goto(`${this._baseUrl}/marketplace`, { waitUntil: 'domcontentloaded' });
            }
            await this.page.waitForTimeout(jitteredDelay(3000));
            await mouseWiggle(this.page);

            // Step 3: Browse 2-3 existing marketplace listings
            const mpListings = await this.page.$$('a[href*="/marketplace/item/"]');
            const listingsToVisit = mpListings.slice(0, Math.min(3, mpListings.length));
            for (const listing of listingsToVisit) {
                try {
                    const href = await listing.getAttribute('href');
                    if (!href) continue;
                    await humanClick(this.page, listing);
                    await this.page.waitForTimeout(randomDelay(5000, 12000));
                    await humanScroll(this.page);
                    await this.page.waitForTimeout(randomDelay(2000, 4000));
                    await mouseWiggle(this.page);
                    await this.page.goBack({ waitUntil: 'domcontentloaded' });
                    await this.page.waitForTimeout(randomDelay(2000, 4000));
                } catch {}
            }

            logger.info('[FacebookBot] Session warmup complete');
            writeAuditLog('warmup_complete', { scrollPasses, listingsVisited: listingsToVisit.length });
        } catch (error) {
            logger.warn('[FacebookBot] Warmup error (non-fatal):', error.message);
            writeAuditLog('warmup_error', { error: error.message });
        }
    }

    /**
     * Refresh a Marketplace listing by editing and re-saving
     */
    async refreshListing(listingUrl) {
        const stats = readDailyStats();
        if (stats.listings >= RATE_LIMITS.facebook.maxListingsPerDay) {
            logger.warn('[FacebookBot] Daily listing cap reached — skipping');
            writeAuditLog('daily_cap_reached', { cap: 'listings', listingUrl });
            return false;
        }
        logger.info('[FacebookBot] Refreshing listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
            await mouseWiggle(this.page);
            await checkForCaptcha(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.facebook.actionDelay));

            // Facebook Marketplace listings have a "..." menu or "Edit listing" option
            const editBtn = await this.page.$('[aria-label*="Edit" i], button:has-text("Edit listing"), [data-testid*="edit"]');
            if (!editBtn) {
                logger.info('[FacebookBot] Edit button not found');
                return false;
            }

            await humanClick(this.page, editBtn);
            await this.page.waitForTimeout(randomDelay(2000, 3000));

            const saveBtn = await this.page.$('button:has-text("Update"), button:has-text("Save"), [aria-label*="Publish" i]');
            if (saveBtn) {
                await humanClick(this.page, saveBtn);
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.facebook.actionDelay));
                await checkForCaptcha(this.page);
                this.stats.refreshes++;
                writeAuditLog('refresh_listing', { listingUrl });
                stats.listings++;
                writeDailyStats(stats);
                logger.info('[FacebookBot] Listing refreshed');
                return true;
            }

            return false;
        } catch (error) {
            logger.error('[FacebookBot] Refresh error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Refresh all Marketplace listings
     */
    async refreshAllListings(options = {}) {
        const { maxRefresh = 50, delayBetween = RATE_LIMITS.facebook.actionDelay } = options;

        // Rest day enforcement — at least 1 rest day per week
        if (isRestDayNeeded()) {
            logger.info('[FacebookBot] Rest day enforced — 6+ active days in last 7. Skipping all listings.');
            writeAuditLog('rest_day_enforced');
            return { refreshed: 0, skipped: 0, total: 0, reason: 'rest_day' };
        }

        // Velocity ramp — cap based on account age config
        const velocityCap = getVelocityCap();
        const effectiveMax = Math.min(maxRefresh, velocityCap);
        logger.info(`[FacebookBot] Refreshing up to ${effectiveMax} listings (velocity cap: ${velocityCap})`);

        try {
            await this.page.goto(`${this._baseUrl}/marketplace/you/selling`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/marketplace/item/"]',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, effectiveMax);
            logger.info(`[FacebookBot] Found ${uniqueLinks.length} listings`);

            let refreshed = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.refreshListing(link);
                if (success) refreshed++;
                else skipped++;

                // Inter-listing idle: browse a non-marketplace page between listings
                // Per spec Layer 5: never start a new listing immediately after the previous
                if (success && refreshed < uniqueLinks.length) {
                    await this.page.waitForTimeout(jitteredDelay(delayBetween));
                    try {
                        await this.page.goto(`${this._baseUrl}`, { waitUntil: 'domcontentloaded' });
                        await this.page.waitForTimeout(randomDelay(15000, 30000));
                        await humanScroll(this.page);
                        await mouseWiggle(this.page);
                        await this.page.waitForTimeout(randomDelay(5000, 15000));
                    } catch {}
                } else {
                    await this.page.waitForTimeout(jitteredDelay(delayBetween));
                }

                if (refreshed > 0 && refreshed % RESTART_EVERY_N_LISTINGS === 0) {
                    logger.info('[FacebookBot] Restarting browser to prevent memory accumulation');
                    const currentProfileId = this._profile.id;
                    const profileDir = getProfileDir(currentProfileId);
                    const lockFile = path.join(profileDir, 'SingletonLock');
                    try { fs.unlinkSync(lockFile); } catch {}
                    await this.close();
                    // Re-launch with SAME profile instead of calling init() which picks new one
                    const restartProxyUrl = getProfileProxy(currentProfileId);
                    const proxy = restartProxyUrl ? { server: restartProxyUrl } : undefined;
                    const { browser, context, page } = await launchCamoufox({
                        profileDir,
                        proxy,
                        headless: this.options.headless,
                    });
                    this.browser = browser;
                    this.page = page;
                    // Re-login with same profile — only count against daily cap if session expired
                    await this.page.goto(this._baseUrl, { waitUntil: 'domcontentloaded' });
                    await this.page.waitForTimeout(3000);
                    const stillLoggedIn = await this.page.$('[aria-label="Your profile"], [data-testid="royal_profile_link"]');
                    if (!stillLoggedIn) {
                        await this.login();
                    }
                }
            }

            if (refreshed > 0) recordActiveDay();
            writeAuditLog('refresh_all_complete', { refreshed, skipped, total: uniqueLinks.length });
            logger.info(`[FacebookBot] Refresh complete: ${refreshed} refreshed, ${skipped} skipped`);
            return { refreshed, skipped, total: uniqueLinks.length };
        } catch (error) {
            logger.error('[FacebookBot] Refresh all error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Relist an item (mark as sold + re-create)
     */
    async relistItem(listingUrl) {
        const stats = readDailyStats();
        if (stats.listings >= RATE_LIMITS.facebook.maxListingsPerDay) {
            logger.warn('[FacebookBot] Daily listing cap reached — skipping relist');
            writeAuditLog('daily_cap_reached', { cap: 'listings', listingUrl });
            return false;
        }
        // Relist frequency check — max once per 14 days per item
        if (!canRelistItem(listingUrl)) {
            logger.warn('[FacebookBot] Item relisted within last 14 days — skipping', { listingUrl });
            writeAuditLog('relist_too_soon', { listingUrl });
            return false;
        }
        logger.info('[FacebookBot] Relisting item:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
            await mouseWiggle(this.page);
            await checkForCaptcha(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.facebook.actionDelay));

            // Look for "Renew" or relist option in the listing actions menu
            const renewBtn = await this.page.$('button:has-text("Renew"), [aria-label*="Renew" i], [data-testid*="renew"]');
            if (renewBtn) {
                await humanClick(this.page, renewBtn);
                await this.page.waitForTimeout(randomDelay(2000, 3500));

                const confirmBtn = await this.page.$('button:has-text("Confirm"), button:has-text("Publish"), button[type="submit"]');
                if (confirmBtn) {
                    await humanClick(this.page, confirmBtn);
                    await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.facebook.actionDelay));
                    await checkForCaptcha(this.page);
                    this.stats.relists++;
                    writeAuditLog('relist_item', { listingUrl });
                    recordRelist(listingUrl);
                    recordActiveDay();
                    stats.listings++;
                    writeDailyStats(stats);
                    logger.info('[FacebookBot] Item relisted');
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error('[FacebookBot] Relist error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    // Facebook Marketplace does not have a share action — use refreshListing or relistItem instead.
    async shareListing(listingUrl) {
        throw new Error('Facebook Marketplace does not support share actions — use relist instead');
    }

    clearSession() {
        // Session is managed by Camoufox persistent_context in the profile directory.
        // To fully reset: flagProfile(this._profile.id) and let the operator delete
        // the profile directory manually.
        writeAuditLog('session_clear_noop', { profileId: this._profile?.id });
    }

    getStats() {
        return { ...this.stats };
    }

    async close() {
        logger.info('[FacebookBot] Closing browser...');
        await closeBrowserWithTimeout(this.browser);
        this.browser = null;
        this.page = null;
        releaseSessionLock();
        logger.info('[FacebookBot] Browser closed');
    }
}

let botInstance = null;

export async function getFacebookBot(options = {}) {
    if (!botInstance) {
        botInstance = new FacebookBot(options);
        await botInstance.init();
    }
    return botInstance;
}

export async function closeFacebookBot() {
    if (botInstance) {
        await botInstance.close();
        botInstance = null;
    }
}
