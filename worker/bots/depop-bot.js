// Depop Automation Bot using Playwright
// Handles refreshing and sharing on Depop

import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, stealthContextOptions } from './stealth.js';
import fs from 'fs';
import path from 'path';
import { RATE_LIMITS, jitteredDelay } from './rate-limits.js';
import { logger } from '../../src/backend/shared/logger.js';
import { preBotSafetyCheck, releasePlatformLock, enhancedHumanType } from './bot-safety.js';
import { getProfileBehavior } from './browser-profiles.js';

const DEPOP_URL = 'https://www.depop.com';
const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');

function writeAuditLog(event, metadata = {}) {
    try {
        const entry = JSON.stringify({ ts: new Date().toISOString(), platform: 'depop', event, ...metadata });
        fs.appendFileSync(AUDIT_LOG, entry + '\n');
    } catch {}
}

async function checkForCaptcha(page) {
    const captcha = await page.$('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], [data-testid*="captcha"]');
    if (captcha) {
        writeAuditLog('captcha_detected');
        throw new Error('CAPTCHA detected — stopping automation. Please solve manually.');
    }
}

function randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

let _activeBehavior = null;

async function humanType(page, selector, text) {
    await enhancedHumanType(page, selector, text, _activeBehavior);
}

export class DepopBot {
    constructor(options = {}) {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isLoggedIn = false;
        this.options = { headless: true, slowMo: 50, ...options };
        this.stats = { refreshes: 0, shares: 0, errors: 0 };
        this._behavior = getProfileBehavior('profile-1');
    }

    async init() {
        logger.info('[DepopBot] Initializing browser...');
        const safetyCheck = preBotSafetyCheck('depop', { sessionCooldownMs: RATE_LIMITS.depop.loginCooldown });
        if (!safetyCheck.safe) {
            throw new Error(safetyCheck.reason);
        }
        _activeBehavior = this._behavior;
        try {
            this.browser = await stealthChromium.launch({
                headless: this.options.headless,
                args: STEALTH_ARGS,
                ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
            });
            this.context = await this.browser.newContext(stealthContextOptions('chrome'));
            this.page = await this.context.newPage();
            // page.route() removed — platforms detect dropped telemetry requests.
            logger.info('[DepopBot] Browser initialized');
        } catch (err) {
            if (this.browser) await this.browser.close().catch(() => {});
            this.browser = null;
            this.page = null;
            throw err;
        }
    }

    async login() {
        const username = process.env.DEPOP_USERNAME;
        const password = process.env.DEPOP_PASSWORD;
        if (!username || !password) throw new Error('DEPOP_USERNAME and DEPOP_PASSWORD must be set in .env');
        logger.info('[DepopBot] Logging in...');
        writeAuditLog('login_attempt');
        try {
            await this.page.goto(`${DEPOP_URL}/login`, { waitUntil: 'domcontentloaded' });
            await checkForCaptcha(this.page);
            await this.page.waitForSelector('input[name="username"], input[name="email"], input[type="email"]', { timeout: 10000 });

            await humanType(this.page, 'input[name="username"], input[name="email"], input[type="email"]', username);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, 'input[name="password"], input[type="password"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await this.page.click('button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
            await checkForCaptcha(this.page);

            const loggedIn = await this.page.$('[data-testid*="avatar"], [class*="avatar"], a[href*="/selling"]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                writeAuditLog('login_success');
                logger.info('[DepopBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            writeAuditLog('login_error', { error: error.message });
            logger.error('[DepopBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Refresh a listing by editing and re-saving (bumps visibility on Depop)
     */
    async refreshListing(listingUrl) {
        logger.info('[DepopBot] Refreshing listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.depop.actionDelay));

            // Depop has an "Edit" button on listings
            const editBtn = await this.page.$('a:has-text("Edit"), button:has-text("Edit"), [data-testid*="edit"]');
            if (!editBtn) {
                logger.info('[DepopBot] Edit button not found');
                return false;
            }

            await humanClick(this.page, editBtn);
            await this.page.waitForTimeout(randomDelay(2000, 3000));

            // Save without changes to bump
            const saveBtn = await this.page.$('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
            if (saveBtn) {
                await humanClick(this.page, saveBtn);
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.depop.actionDelay));
                this.stats.refreshes++;
                writeAuditLog('refresh_listing', { listingUrl });
                logger.info('[DepopBot] Listing refreshed');
                return true;
            }

            return false;
        } catch (error) {
            logger.error('[DepopBot] Refresh error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Refresh all listings in the seller's shop
     */
    async refreshAllListings(username, options = {}) {
        const { maxRefresh = 50, delayBetween = RATE_LIMITS.depop.actionDelay } = options;
        logger.info(`[DepopBot] Refreshing up to ${maxRefresh} listings for @${username}`);

        try {
            await this.page.goto(`${DEPOP_URL}/${username}`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/products/"], [data-testid*="product"] a',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxRefresh);
            logger.info(`[DepopBot] Found ${uniqueLinks.length} listings`);

            let refreshed = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.refreshListing(link);
                if (success) refreshed++;
                else skipped++;
                await this.page.waitForTimeout(jitteredDelay(delayBetween));
            }

            writeAuditLog('refresh_all_complete', { username, refreshed, skipped, total: uniqueLinks.length });
            logger.info(`[DepopBot] Refresh complete: ${refreshed} refreshed, ${skipped} skipped`);
            return { refreshed, skipped, total: uniqueLinks.length };
        } catch (error) {
            logger.error('[DepopBot] Refresh all error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Share a listing (Depop uses Instagram-style sharing)
     */
    async shareListing(listingUrl) {
        logger.info('[DepopBot] Sharing listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.depop.actionDelay));

            const shareBtn = await this.page.$('button[aria-label*="share" i], [data-testid*="share"], button:has-text("Share")');
            if (shareBtn) {
                await humanClick(this.page, shareBtn);
                await this.page.waitForTimeout(randomDelay(1000, 2000));
                this.stats.shares++;
                writeAuditLog('share_listing', { listingUrl });
                logger.info('[DepopBot] Listing shared');
                return true;
            }

            logger.info('[DepopBot] Share button not found');
            return false;
        } catch (error) {
            logger.error('[DepopBot] Share error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    getStats() {
        return { ...this.stats };
    }

    async close() {
        logger.info('[DepopBot] Closing browser...');
        if (this.page) {
            await this.page.close().catch(() => {});
            this.page = null;
        }
        if (this.context) {
            await this.context.close().catch(() => {});
            this.context = null;
        }
        if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
        }
        writeAuditLog('session_closed');
        releasePlatformLock('depop');
        logger.info('[DepopBot] Browser closed');
    }
}

let botInstance = null;

export async function getDepopBot(options = {}) {
    if (!botInstance) {
        botInstance = new DepopBot(options);
        await botInstance.init();
    }
    return botInstance;
}

export async function closeDepopBot() {
    if (botInstance) {
        await botInstance.close();
        botInstance = null;
    }
}
