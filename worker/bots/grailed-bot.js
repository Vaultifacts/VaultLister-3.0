// Grailed Automation Bot using Playwright
// Handles bumping/refreshing listings on Grailed

import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from './stealth.js';
import fs from 'fs';
import path from 'path';
import { RATE_LIMITS, jitteredDelay } from './rate-limits.js';
import { logger } from '../../src/backend/shared/logger.js';

const GRAILED_URL = 'https://www.grailed.com';
const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');

function writeAuditLog(event, metadata = {}) {
    try {
        const entry = JSON.stringify({ ts: new Date().toISOString(), platform: 'grailed', event, ...metadata });
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

export class GrailedBot {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.options = { headless: true, slowMo: 50, ...options };
        this.stats = { bumps: 0, errors: 0 };
    }

    async init() {
        logger.info('[GrailedBot] Initializing browser...');
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
            logger.info('[GrailedBot] Browser initialized');
        } catch (err) {
            if (this.browser) await this.browser.close().catch(() => {});
            this.browser = null;
            this.page = null;
            throw err;
        }
    }

    async login() {
        const email = process.env.GRAILED_USERNAME;
        const password = process.env.GRAILED_PASSWORD;
        if (!email || !password) throw new Error('GRAILED_USERNAME and GRAILED_PASSWORD must be set in .env');
        logger.info('[GrailedBot] Logging in...');
        writeAuditLog('login_attempt');
        try {
            await this.page.goto(`${GRAILED_URL}/users/sign_in`, { waitUntil: 'networkidle' });
            await checkForCaptcha(this.page);
            await this.page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });

            await humanType(this.page, 'input[name="email"], input[type="email"]', email);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, 'input[name="password"], input[type="password"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await this.page.click('button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });
            await checkForCaptcha(this.page);

            const loggedIn = await this.page.$('[data-testid*="avatar"], [class*="avatar"], a[href*="/users/"]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                writeAuditLog('login_success');
                logger.info('[GrailedBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            writeAuditLog('login_error', { error: error.message });
            logger.error('[GrailedBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Bump a listing by editing and re-saving (increases visibility on Grailed)
     */
    async bumpListing(listingUrl) {
        logger.info('[GrailedBot] Bumping listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.grailed.actionDelay));

            // Grailed has a "Bump" button on seller's own listings
            const bumpBtn = await this.page.$('button:has-text("Bump"), [data-testid*="bump"], button[aria-label*="bump" i]');
            if (bumpBtn) {
                await humanClick(this.page, bumpBtn);
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.grailed.actionDelay));
                this.stats.bumps++;
                writeAuditLog('bump_listing', { listingUrl });
                logger.info('[GrailedBot] Listing bumped');
                return true;
            }

            // Fallback: edit + save
            const editBtn = await this.page.$('a:has-text("Edit"), button:has-text("Edit"), [data-testid*="edit"]');
            if (editBtn) {
                await humanClick(this.page, editBtn);
                await this.page.waitForTimeout(randomDelay(2000, 3000));
                const saveBtn = await this.page.$('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
                if (saveBtn) {
                    await humanClick(this.page, saveBtn);
                    await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.grailed.actionDelay));
                    this.stats.bumps++;
                    writeAuditLog('bump_listing_via_edit', { listingUrl });
                    logger.info('[GrailedBot] Listing bumped via edit');
                    return true;
                }
            }

            logger.info('[GrailedBot] Bump/Edit button not found');
            return false;
        } catch (error) {
            logger.error('[GrailedBot] Bump error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Bump all listings in the seller's wardrobe
     */
    async bumpAllListings(options = {}) {
        const { maxBumps = 50, delayBetween = RATE_LIMITS.grailed.actionDelay } = options;
        logger.info(`[GrailedBot] Bumping up to ${maxBumps} listings`);

        try {
            await this.page.goto(`${GRAILED_URL}/users/myitems`, { waitUntil: 'networkidle' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/listings/"], [data-testid*="listing"] a',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxBumps);
            logger.info(`[GrailedBot] Found ${uniqueLinks.length} listings`);

            let bumped = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.bumpListing(link);
                if (success) bumped++;
                else skipped++;
                await this.page.waitForTimeout(jitteredDelay(delayBetween));
            }

            writeAuditLog('bump_all_complete', { bumped, skipped, total: uniqueLinks.length });
            logger.info(`[GrailedBot] Bump complete: ${bumped} bumped, ${skipped} skipped`);
            return { bumped, skipped, total: uniqueLinks.length };
        } catch (error) {
            logger.error('[GrailedBot] Bump all error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    getStats() {
        return { ...this.stats };
    }

    async close() {
        logger.info('[GrailedBot] Closing browser...');
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        logger.info('[GrailedBot] Browser closed');
    }
}

let botInstance = null;

export async function getGrailedBot(options = {}) {
    if (!botInstance) {
        botInstance = new GrailedBot(options);
        await botInstance.init();
    }
    return botInstance;
}

export async function closeGrailedBot() {
    if (botInstance) {
        await botInstance.close();
        botInstance = null;
    }
}
