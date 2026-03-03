// Depop Automation Bot using Playwright
// Handles refreshing and sharing on Depop

import { chromium } from 'playwright';

const DEPOP_URL = 'https://www.depop.com';

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

export class DepopBot {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.options = { headless: true, slowMo: 50, ...options };
        this.stats = { refreshes: 0, shares: 0, errors: 0 };
    }

    async init() {
        console.log('[DepopBot] Initializing browser...');
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
        console.log('[DepopBot] Browser initialized');
    }

    async login(username, password) {
        console.log('[DepopBot] Logging in...');
        try {
            await this.page.goto(`${DEPOP_URL}/login`, { waitUntil: 'networkidle' });
            await this.page.waitForSelector('input[name="username"], input[name="email"], input[type="email"]', { timeout: 10000 });

            await humanType(this.page, 'input[name="username"], input[name="email"], input[type="email"]', username);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, 'input[name="password"], input[type="password"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await this.page.click('button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });

            const loggedIn = await this.page.$('[data-testid*="avatar"], [class*="avatar"], a[href*="/selling"]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                console.log('[DepopBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            console.error('[DepopBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Refresh a listing by editing and re-saving (bumps visibility on Depop)
     */
    async refreshListing(listingUrl) {
        console.log('[DepopBot] Refreshing listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(1500, 2500));

            // Depop has an "Edit" button on listings
            const editBtn = await this.page.$('a:has-text("Edit"), button:has-text("Edit"), [data-testid*="edit"]');
            if (!editBtn) {
                console.log('[DepopBot] Edit button not found');
                return false;
            }

            await editBtn.click();
            await this.page.waitForTimeout(randomDelay(2000, 3000));

            // Save without changes to bump
            const saveBtn = await this.page.$('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
            if (saveBtn) {
                await saveBtn.click();
                await this.page.waitForTimeout(randomDelay(2000, 3500));
                this.stats.refreshes++;
                console.log('[DepopBot] Listing refreshed');
                return true;
            }

            return false;
        } catch (error) {
            console.error('[DepopBot] Refresh error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Refresh all listings in the seller's shop
     */
    async refreshAllListings(username, options = {}) {
        const { maxRefresh = 50, delayBetween = 3500 } = options;
        console.log(`[DepopBot] Refreshing up to ${maxRefresh} listings for @${username}`);

        try {
            await this.page.goto(`${DEPOP_URL}/${username}`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/products/"], [data-testid*="product"] a',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxRefresh);
            console.log(`[DepopBot] Found ${uniqueLinks.length} listings`);

            let refreshed = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.refreshListing(link);
                if (success) refreshed++;
                else skipped++;
                await this.page.waitForTimeout(delayBetween + randomDelay(500, 1500));
            }

            console.log(`[DepopBot] Refresh complete: ${refreshed} refreshed, ${skipped} skipped`);
            return { refreshed, skipped, total: uniqueLinks.length };
        } catch (error) {
            console.error('[DepopBot] Refresh all error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Share a listing (Depop uses Instagram-style sharing)
     */
    async shareListing(listingUrl) {
        console.log('[DepopBot] Sharing listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(1500, 2500));

            const shareBtn = await this.page.$('button[aria-label*="share" i], [data-testid*="share"], button:has-text("Share")');
            if (shareBtn) {
                await shareBtn.click();
                await this.page.waitForTimeout(randomDelay(1000, 2000));
                this.stats.shares++;
                console.log('[DepopBot] Listing shared');
                return true;
            }

            console.log('[DepopBot] Share button not found');
            return false;
        } catch (error) {
            console.error('[DepopBot] Share error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    getStats() {
        return { ...this.stats };
    }

    async close() {
        console.log('[DepopBot] Closing browser...');
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        console.log('[DepopBot] Browser closed');
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
