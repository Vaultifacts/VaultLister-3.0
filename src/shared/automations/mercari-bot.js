// Mercari Automation Bot using Playwright
// Handles sharing/refreshing and relisting on Mercari

import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from './stealth.js';
import fs from 'fs';
import path from 'path';
import { RATE_LIMITS, jitteredDelay } from './rate-limits.js';

const MERCARI_URL = 'https://www.mercari.com';
const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');

function writeAuditLog(event, metadata = {}) {
    try {
        const entry = JSON.stringify({ ts: new Date().toISOString(), platform: 'mercari', event, ...metadata });
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

export class MercariBot {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.options = { headless: true, slowMo: 50, ...options };
        this.stats = { shares: 0, relists: 0, errors: 0 };
    }

    async init() {
        console.log('[MercariBot] Initializing browser...');
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
            console.log('[MercariBot] Browser initialized');
        } catch (err) {
            if (this.browser) await this.browser.close().catch(() => {});
            this.browser = null;
            this.page = null;
            throw err;
        }
    }

    async login() {
        const email = process.env.MERCARI_USERNAME;
        const password = process.env.MERCARI_PASSWORD;
        if (!email || !password) throw new Error('MERCARI_USERNAME and MERCARI_PASSWORD must be set in .env');
        console.log('[MercariBot] Logging in...');
        writeAuditLog('login_attempt');
        try {
            await this.page.goto(`${MERCARI_URL}/login`, { waitUntil: 'networkidle' });
            await checkForCaptcha(this.page);
            await this.page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });

            await humanType(this.page, 'input[name="email"], input[type="email"]', email);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, 'input[name="password"], input[type="password"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await this.page.click('button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });
            await checkForCaptcha(this.page);

            const loggedIn = await this.page.$('[data-testid="user-icon"], [class*="avatar"], [aria-label*="profile" i]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                writeAuditLog('login_success');
                console.log('[MercariBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            writeAuditLog('login_error', { error: error.message });
            console.error('[MercariBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Refresh a listing by editing and re-saving (bumps visibility on Mercari)
     */
    async refreshListing(listingUrl) {
        console.log('[MercariBot] Refreshing listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.mercari.actionDelay));

            const editBtn = await this.page.$('button:has-text("Edit"), a:has-text("Edit"), [data-testid*="edit"]');
            if (!editBtn) {
                console.log('[MercariBot] Edit button not found');
                return false;
            }

            await humanClick(this.page, editBtn);
            await this.page.waitForTimeout(randomDelay(2000, 3000));

            // Find and click save/update without changing anything
            const saveBtn = await this.page.$('button:has-text("Update"), button:has-text("Save"), button[type="submit"]');
            if (saveBtn) {
                await humanClick(this.page, saveBtn);
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.mercari.actionDelay));
                this.stats.shares++;
                writeAuditLog('refresh_listing', { listingUrl });
                console.log('[MercariBot] Listing refreshed');
                return true;
            }

            return false;
        } catch (error) {
            console.error('[MercariBot] Refresh error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Refresh all listings in the seller's shop
     */
    async refreshAllListings(options = {}) {
        const { maxRefresh = 50, delayBetween = RATE_LIMITS.mercari.actionDelay } = options;
        console.log(`[MercariBot] Refreshing up to ${maxRefresh} listings`);

        try {
            await this.page.goto(`${MERCARI_URL}/mypage/listings`, { waitUntil: 'networkidle' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/item/"], [data-testid*="item"] a',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxRefresh);
            console.log(`[MercariBot] Found ${uniqueLinks.length} listings`);

            let refreshed = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.refreshListing(link);
                if (success) refreshed++;
                else skipped++;
                await this.page.waitForTimeout(jitteredDelay(delayBetween));
            }

            writeAuditLog('refresh_all_complete', { refreshed, skipped, total: uniqueLinks.length });
            console.log(`[MercariBot] Refresh complete: ${refreshed} refreshed, ${skipped} skipped`);
            return { refreshed, skipped, total: uniqueLinks.length };
        } catch (error) {
            console.error('[MercariBot] Refresh all error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Relist an item (delete + re-create)
     */
    async relistItem(listingUrl) {
        console.log('[MercariBot] Relisting item:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.mercari.actionDelay));

            // Look for relist/re-list button (Mercari sometimes has this)
            const relistBtn = await this.page.$('button:has-text("Relist"), button:has-text("Re-list"), [data-testid*="relist"]');
            if (relistBtn) {
                await humanClick(this.page, relistBtn);
                await this.page.waitForTimeout(randomDelay(2000, 3500));

                const confirmBtn = await this.page.$('button:has-text("Confirm"), button:has-text("List"), button[type="submit"]');
                if (confirmBtn) {
                    await humanClick(this.page, confirmBtn);
                    await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.mercari.actionDelay));
                    this.stats.relists++;
                    writeAuditLog('relist_item', { listingUrl });
                    console.log('[MercariBot] Item relisted');
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('[MercariBot] Relist error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    getStats() {
        return { ...this.stats };
    }

    async close() {
        console.log('[MercariBot] Closing browser...');
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        console.log('[MercariBot] Browser closed');
    }
}

let botInstance = null;

export async function getMercariBot(options = {}) {
    if (!botInstance) {
        botInstance = new MercariBot(options);
        await botInstance.init();
    }
    return botInstance;
}

export async function closeMercariBot() {
    if (botInstance) {
        await botInstance.close();
        botInstance = null;
    }
}
