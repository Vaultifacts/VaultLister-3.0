// Whatnot Automation Bot using Playwright
// Handles listing refresh and price updates on Whatnot

import { chromium } from 'playwright';

const WHATNOT_URL = 'https://www.whatnot.com';

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
        console.log('[WhatnotBot] Initializing browser...');
        this.browser = await chromium.launch({
            headless: this.options.headless,
            slowMo: this.options.slowMo
        });
        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });
        this.page = await context.newPage();
        await this.page.route('**/*.{png,jpg,jpeg,gif,webp}', route => route.abort());
        await this.page.route('**/analytics/**', route => route.abort());
        console.log('[WhatnotBot] Browser initialized');
    }

    async login(email, password) {
        console.log('[WhatnotBot] Logging in...');
        try {
            await this.page.goto(`${WHATNOT_URL}/login`, { waitUntil: 'networkidle' });
            await this.page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });

            await humanType(this.page, 'input[name="email"], input[type="email"]', email);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, 'input[name="password"], input[type="password"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await this.page.click('button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });

            const loggedIn = await this.page.$('[data-testid*="avatar"], [class*="avatar"], [aria-label*="profile" i]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                console.log('[WhatnotBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            console.error('[WhatnotBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Refresh a listing by editing and re-saving
     */
    async refreshListing(listingUrl) {
        console.log('[WhatnotBot] Refreshing listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(1500, 2500));

            const editBtn = await this.page.$('button:has-text("Edit"), a:has-text("Edit"), [data-testid*="edit"]');
            if (!editBtn) {
                console.log('[WhatnotBot] Edit button not found');
                return false;
            }

            await editBtn.click();
            await this.page.waitForTimeout(randomDelay(2000, 3000));

            const saveBtn = await this.page.$('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
            if (saveBtn) {
                await saveBtn.click();
                await this.page.waitForTimeout(randomDelay(2000, 3500));
                this.stats.refreshes++;
                console.log('[WhatnotBot] Listing refreshed');
                return true;
            }

            return false;
        } catch (error) {
            console.error('[WhatnotBot] Refresh error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Refresh all listings in the seller's shop
     */
    async refreshAllListings(options = {}) {
        const { maxRefresh = 50, delayBetween = 4000 } = options;
        console.log(`[WhatnotBot] Refreshing up to ${maxRefresh} listings`);

        try {
            await this.page.goto(`${WHATNOT_URL}/seller/listings`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/product/"], a[href*="/listing/"], [data-testid*="listing"] a',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxRefresh);
            console.log(`[WhatnotBot] Found ${uniqueLinks.length} listings`);

            let refreshed = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.refreshListing(link);
                if (success) refreshed++;
                else skipped++;
                await this.page.waitForTimeout(delayBetween + randomDelay(500, 1500));
            }

            console.log(`[WhatnotBot] Refresh complete: ${refreshed} refreshed, ${skipped} skipped`);
            return { refreshed, skipped, total: uniqueLinks.length };
        } catch (error) {
            console.error('[WhatnotBot] Refresh all error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    getStats() {
        return { ...this.stats };
    }

    async close() {
        console.log('[WhatnotBot] Closing browser...');
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        console.log('[WhatnotBot] Browser closed');
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
