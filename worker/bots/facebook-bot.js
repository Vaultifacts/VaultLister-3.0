// Facebook Marketplace Automation Bot using Playwright
// Handles refreshing and relisting on Facebook Marketplace

import { humanClick, humanScroll, mouseWiggle } from './stealth.js';
import { launchCamoufox } from './stealth.js';
import { initProfiles, getNextProfile, saveProfileUsage, flagProfile, getProfileDir } from './browser-profiles.js';
import fs from 'fs';
import path from 'path';
import { RATE_LIMITS, jitteredDelay, randomDelay } from './rate-limits.js';
import { logger } from '../../src/backend/shared/logger.js';
import { closeBrowserWithTimeout, captureErrorScreenshot, purgeOldErrorScreenshots } from './bot-utils.js';

const FB_URL = 'https://www.facebook.com';
const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');
const DAILY_STATS_PATH = path.join(process.cwd(), 'data', '.fb-daily-stats.json');
const RESTART_EVERY_N_LISTINGS = 10;

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
    return { date: getTodayKey(), logins: 0, listings: 0 };
}

function writeDailyStats(stats) {
    try {
        fs.writeFileSync(DAILY_STATS_PATH, JSON.stringify(stats), 'utf8');
    } catch {}
}

async function checkForCaptcha(page) {
    const captcha = await page.$('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], [data-testid*="captcha"]');
    if (captcha) {
        writeAuditLog('captcha_detected');
        throw new Error('CAPTCHA detected — stopping automation. Please solve manually.');
    }
}

async function humanType(page, selector, text) {
    await page.click(selector);
    for (const char of text) {
        await page.keyboard.type(char);
        await page.waitForTimeout(randomDelay(50, 150));
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
        try {
            initProfiles();
            this._profile = getNextProfile();
            logger.info('[FacebookBot] Using profile:', this._profile.id);

            const proxy = process.env.FACEBOOK_PROXY_URL
                ? { server: process.env.FACEBOOK_PROXY_URL }
                : undefined;

            const { browser, context, page } = await launchCamoufox({
                profileDir: getProfileDir(this._profile.id),
                proxy,
                headless: this.options.headless,
            });
            this.browser = browser;
            this.page = page;

            try {
                await this.page.route('**/analytics/**', route => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
                await this.page.route('**/tracking/**', route => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
            } catch {}

            logger.info('[FacebookBot] Browser initialized with Camoufox');
        } catch (err) {
            if (this.browser) await this.browser.close().catch(() => {});
            this.browser = null;
            this.page = null;
            throw err;
        }
    }

    async login() {
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

            await humanType(this.page, '#email, input[name="email"]', email);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, '#pass, input[name="pass"]', password);
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
        logger.info(`[FacebookBot] Refreshing up to ${maxRefresh} listings`);

        try {
            await this.page.goto(`${this._baseUrl}/marketplace/you/selling`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(2000));
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/marketplace/item/"]',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxRefresh);
            logger.info(`[FacebookBot] Found ${uniqueLinks.length} listings`);

            let refreshed = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.refreshListing(link);
                if (success) refreshed++;
                else skipped++;
                await this.page.waitForTimeout(jitteredDelay(delayBetween));

                if (refreshed > 0 && refreshed % RESTART_EVERY_N_LISTINGS === 0) {
                    logger.info('[FacebookBot] Restarting browser to prevent memory accumulation');
                    const currentProfileId = this._profile.id;
                    const profileDir = getProfileDir(currentProfileId);
                    const lockFile = path.join(profileDir, 'SingletonLock');
                    try { fs.unlinkSync(lockFile); } catch {}
                    await this.close();
                    // Re-launch with SAME profile instead of calling init() which picks new one
                    const proxy = process.env.FACEBOOK_PROXY_URL
                        ? { server: process.env.FACEBOOK_PROXY_URL }
                        : undefined;
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
