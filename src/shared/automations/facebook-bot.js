// Facebook Marketplace Automation Bot using Playwright
// Handles refreshing and relisting on Facebook Marketplace

import { chromium } from 'playwright';

const FB_URL = 'https://www.facebook.com';

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
        console.log('[FacebookBot] Initializing browser...');
        this.browser = await chromium.launch({
            headless: this.options.headless,
            slowMo: this.options.slowMo
        });
        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });
        this.page = await context.newPage();
        await this.page.route('**/analytics/**', route => route.abort());
        console.log('[FacebookBot] Browser initialized');
    }

    async login(email, password) {
        console.log('[FacebookBot] Logging in...');
        try {
            await this.page.goto(`${FB_URL}/login`, { waitUntil: 'networkidle' });
            await this.page.waitForSelector('#email, input[name="email"]', { timeout: 10000 });

            await humanType(this.page, '#email, input[name="email"]', email);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, '#pass, input[name="pass"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await this.page.click('button[name="login"], button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });

            const loggedIn = await this.page.$('[aria-label="Your profile"], [data-testid="royal_profile_link"]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                console.log('[FacebookBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            console.error('[FacebookBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Refresh a Marketplace listing by editing and re-saving
     */
    async refreshListing(listingUrl) {
        console.log('[FacebookBot] Refreshing listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(1500, 2500));

            // Facebook Marketplace listings have a "..." menu or "Edit listing" option
            const editBtn = await this.page.$('[aria-label*="Edit" i], button:has-text("Edit listing"), [data-testid*="edit"]');
            if (!editBtn) {
                console.log('[FacebookBot] Edit button not found');
                return false;
            }

            await editBtn.click();
            await this.page.waitForTimeout(randomDelay(2000, 3000));

            const saveBtn = await this.page.$('button:has-text("Update"), button:has-text("Save"), [aria-label*="Publish" i]');
            if (saveBtn) {
                await saveBtn.click();
                await this.page.waitForTimeout(randomDelay(2000, 3500));
                this.stats.refreshes++;
                console.log('[FacebookBot] Listing refreshed');
                return true;
            }

            return false;
        } catch (error) {
            console.error('[FacebookBot] Refresh error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Refresh all Marketplace listings
     */
    async refreshAllListings(options = {}) {
        const { maxRefresh = 50, delayBetween = 5000 } = options;
        console.log(`[FacebookBot] Refreshing up to ${maxRefresh} listings`);

        try {
            await this.page.goto(`${FB_URL}/marketplace/you/selling`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/marketplace/item/"]',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxRefresh);
            console.log(`[FacebookBot] Found ${uniqueLinks.length} listings`);

            let refreshed = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.refreshListing(link);
                if (success) refreshed++;
                else skipped++;
                await this.page.waitForTimeout(delayBetween + randomDelay(500, 1500));
            }

            console.log(`[FacebookBot] Refresh complete: ${refreshed} refreshed, ${skipped} skipped`);
            return { refreshed, skipped, total: uniqueLinks.length };
        } catch (error) {
            console.error('[FacebookBot] Refresh all error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Relist an item (mark as sold + re-create)
     */
    async relistItem(listingUrl) {
        console.log('[FacebookBot] Relisting item:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(1500, 2500));

            // Look for "Renew" or relist option in the listing actions menu
            const renewBtn = await this.page.$('button:has-text("Renew"), [aria-label*="Renew" i], [data-testid*="renew"]');
            if (renewBtn) {
                await renewBtn.click();
                await this.page.waitForTimeout(randomDelay(2000, 3500));

                const confirmBtn = await this.page.$('button:has-text("Confirm"), button:has-text("Publish"), button[type="submit"]');
                if (confirmBtn) {
                    await confirmBtn.click();
                    await this.page.waitForTimeout(randomDelay(2000, 3500));
                    this.stats.relists++;
                    console.log('[FacebookBot] Item relisted');
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('[FacebookBot] Relist error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    getStats() {
        return { ...this.stats };
    }

    async close() {
        console.log('[FacebookBot] Closing browser...');
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        console.log('[FacebookBot] Browser closed');
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
