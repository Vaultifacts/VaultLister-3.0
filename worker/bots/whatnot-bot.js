// Whatnot Automation Bot using Playwright
// Handles listing refresh and price updates on Whatnot

import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, stealthContextOptions } from './stealth.js';
import fs from 'fs';
import path from 'path';
import { RATE_LIMITS, jitteredDelay } from './rate-limits.js';
import { logger } from '../../src/backend/shared/logger.js';
import { closeBrowserWithTimeout, captureErrorScreenshot, purgeOldErrorScreenshots } from './bot-utils.js';

const WHATNOT_URL = 'https://www.whatnot.com';
const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');

function writeAuditLog(event, metadata = {}) {
    try {
        const entry = JSON.stringify({ ts: new Date().toISOString(), platform: 'whatnot', event, ...metadata });
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

export class WhatnotBot {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.options = { headless: true, slowMo: 50, ...options };
        this.stats = { refreshes: 0, errors: 0 };
    }

    async init() {
        logger.info('[WhatnotBot] Initializing browser...');
        try {
            this.browser = await stealthChromium.launch({
                headless: this.options.headless,
                args: STEALTH_ARGS,
                ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
            });
            const context = await this.browser.newContext(stealthContextOptions('chrome'));
            this.page = await context.newPage();
            await this.page.route('**/analytics/**', route => route.abort());
            await this.page.route('**/tracking/**', route => route.abort());
            logger.info('[WhatnotBot] Browser initialized');
        } catch (err) {
            if (this.browser) await this.browser.close().catch(() => {});
            this.browser = null;
            this.page = null;
            throw err;
        }
    }

    async login() {
        const email = process.env.WHATNOT_USERNAME;
        const password = process.env.WHATNOT_PASSWORD;
        if (!email || !password) throw new Error('WHATNOT_USERNAME and WHATNOT_PASSWORD must be set in .env');
        logger.info('[WhatnotBot] Logging in...');
        writeAuditLog('login_attempt');
        try {
            await this.page.goto(`${WHATNOT_URL}/login`, { waitUntil: 'networkidle' });
            await checkForCaptcha(this.page);
            await this.page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });

            await humanType(this.page, 'input[name="email"], input[type="email"]', email);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, 'input[name="password"], input[type="password"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await this.page.click('button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });
            await checkForCaptcha(this.page);

            const loggedIn = await this.page.$('[data-testid*="avatar"], [class*="avatar"], [aria-label*="profile" i]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                writeAuditLog('login_success');
                logger.info('[WhatnotBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            writeAuditLog('login_error', { error: error.message });
            logger.error('[WhatnotBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Refresh a listing by editing and re-saving
     */
    async refreshListing(listingUrl) {
        logger.info('[WhatnotBot] Refreshing listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.whatnot.actionDelay));

            const editBtn = await this.page.$('button:has-text("Edit"), a:has-text("Edit"), [data-testid*="edit"]');
            if (!editBtn) {
                logger.info('[WhatnotBot] Edit button not found');
                return false;
            }

            await humanClick(this.page, editBtn);
            await this.page.waitForTimeout(randomDelay(2000, 3000));

            const saveBtn = await this.page.$('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
            if (saveBtn) {
                await humanClick(this.page, saveBtn);
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.whatnot.actionDelay));
                this.stats.refreshes++;
                writeAuditLog('refresh_listing', { listingUrl });
                logger.info('[WhatnotBot] Listing refreshed');
                return true;
            }

            return false;
        } catch (error) {
            logger.error('[WhatnotBot] Refresh error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Refresh all listings in the seller's shop
     */
    async refreshAllListings(options = {}) {
        const { maxRefresh = 50, delayBetween = RATE_LIMITS.whatnot.actionDelay } = options;
        logger.info(`[WhatnotBot] Refreshing up to ${maxRefresh} listings`);

        try {
            await this.page.goto(`${WHATNOT_URL}/seller/listings`, { waitUntil: 'networkidle' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/product/"], a[href*="/listing/"], [data-testid*="listing"] a',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxRefresh);
            logger.info(`[WhatnotBot] Found ${uniqueLinks.length} listings`);

            let refreshed = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.refreshListing(link);
                if (success) refreshed++;
                else skipped++;
                await this.page.waitForTimeout(jitteredDelay(delayBetween));
            }

            writeAuditLog('refresh_all_complete', { refreshed, skipped, total: uniqueLinks.length });
            logger.info(`[WhatnotBot] Refresh complete: ${refreshed} refreshed, ${skipped} skipped`);
            return { refreshed, skipped, total: uniqueLinks.length };
        } catch (error) {
            logger.error('[WhatnotBot] Refresh all error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    getStats() {
        return { ...this.stats };
    }

    async close() {
        logger.info('[WhatnotBot] Closing browser...');
        await closeBrowserWithTimeout(this.browser);
        this.browser = null;
        this.page = null;
        logger.info('[WhatnotBot] Browser closed');
    }
}

let botInstance = null;

export async function getWhatnotBot(options = {}) {
    if (!botInstance) {
        botInstance = new WhatnotBot(options);
        await botInstance.init();
    }
    return botInstance;
}

export async function closeWhatnotBot() {
    if (botInstance) {
        await botInstance.close();
        botInstance = null;
    }
}
