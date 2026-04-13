// Facebook Marketplace Automation Bot using Playwright
// Handles refreshing and relisting on Facebook Marketplace

import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from './stealth.js';
import fs from 'fs';
import path from 'path';
import { RATE_LIMITS, jitteredDelay } from './rate-limits.js';
import { logger } from '../../src/backend/shared/logger.js';

const FB_URL = 'https://www.facebook.com';
const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');

function writeAuditLog(event, metadata = {}) {
    try {
        const entry = JSON.stringify({ ts: new Date().toISOString(), platform: 'facebook', event, ...metadata });
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
        this.options = { headless: true, slowMo: 50, ...options };
        this.stats = { refreshes: 0, relists: 0, errors: 0 };
    }

    async init() {
        logger.info('[FacebookBot] Initializing browser...');
        try {
            this.browser = await stealthChromium.launch({
                headless: this.options.headless,
                args: STEALTH_ARGS,
                ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
            });
            const context = await this.browser.newContext({
                userAgent: randomChromeUA(),
                viewport: randomViewport(),
                locale: 'en-US',
                timezoneId: 'America/New_York',
            });
            this.page = await context.newPage();
            await this.page.route('**/analytics/**', route => route.abort());
            await this.page.route('**/tracking/**', route => route.abort());
            logger.info('[FacebookBot] Browser initialized');
        } catch (err) {
            if (this.browser) await this.browser.close().catch(() => {});
            this.browser = null;
            this.page = null;
            throw err;
        }
    }

    async login() {
        const email = process.env.FACEBOOK_EMAIL;
        const password = process.env.FACEBOOK_PASSWORD;
        if (!email || !password) throw new Error('FACEBOOK_EMAIL and FACEBOOK_PASSWORD must be set in .env');
        logger.info('[FacebookBot] Logging in...');
        writeAuditLog('login_attempt');
        try {
            await this.page.goto(`${FB_URL}/login`, { waitUntil: 'networkidle' });
            await checkForCaptcha(this.page);
            await this.page.waitForSelector('#email, input[name="email"]', { timeout: 10000 });

            await humanType(this.page, '#email, input[name="email"]', email);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, '#pass, input[name="pass"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await this.page.click('button[name="login"], button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });
            await checkForCaptcha(this.page);

            const loggedIn = await this.page.$('[aria-label="Your profile"], [data-testid="royal_profile_link"]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                writeAuditLog('login_success');
                logger.info('[FacebookBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            writeAuditLog('login_error', { error: error.message });
            logger.error('[FacebookBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Refresh a Marketplace listing by editing and re-saving
     */
    async refreshListing(listingUrl) {
        logger.info('[FacebookBot] Refreshing listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await mouseWiggle(this.page);
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
                this.stats.refreshes++;
                writeAuditLog('refresh_listing', { listingUrl });
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
            await this.page.goto(`${FB_URL}/marketplace/you/selling`, { waitUntil: 'networkidle' });
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
        logger.info('[FacebookBot] Relisting item:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await mouseWiggle(this.page);
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
                    this.stats.relists++;
                    writeAuditLog('relist_item', { listingUrl });
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

    getStats() {
        return { ...this.stats };
    }

    async close() {
        logger.info('[FacebookBot] Closing browser...');
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
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
