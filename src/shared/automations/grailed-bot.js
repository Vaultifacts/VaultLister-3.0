// Grailed Automation Bot using Playwright
// Handles bumping/refreshing listings on Grailed

import { chromium } from 'playwright';

const GRAILED_URL = 'https://www.grailed.com';

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
        console.log('[GrailedBot] Initializing browser...');
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
        console.log('[GrailedBot] Browser initialized');
    }

    async login(email, password) {
        console.log('[GrailedBot] Logging in...');
        try {
            await this.page.goto(`${GRAILED_URL}/users/sign_in`, { waitUntil: 'networkidle' });
            await this.page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });

            await humanType(this.page, 'input[name="email"], input[type="email"]', email);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, 'input[name="password"], input[type="password"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await this.page.click('button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });

            const loggedIn = await this.page.$('[data-testid*="avatar"], [class*="avatar"], a[href*="/users/"]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                console.log('[GrailedBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            console.error('[GrailedBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Bump a listing by editing and re-saving (increases visibility on Grailed)
     */
    async bumpListing(listingUrl) {
        console.log('[GrailedBot] Bumping listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(1500, 2500));

            // Grailed has a "Bump" button on seller's own listings
            const bumpBtn = await this.page.$('button:has-text("Bump"), [data-testid*="bump"], button[aria-label*="bump" i]');
            if (bumpBtn) {
                await bumpBtn.click();
                await this.page.waitForTimeout(randomDelay(2000, 3500));
                this.stats.bumps++;
                console.log('[GrailedBot] Listing bumped');
                return true;
            }

            // Fallback: edit + save
            const editBtn = await this.page.$('a:has-text("Edit"), button:has-text("Edit"), [data-testid*="edit"]');
            if (editBtn) {
                await editBtn.click();
                await this.page.waitForTimeout(randomDelay(2000, 3000));
                const saveBtn = await this.page.$('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
                if (saveBtn) {
                    await saveBtn.click();
                    await this.page.waitForTimeout(randomDelay(2000, 3500));
                    this.stats.bumps++;
                    console.log('[GrailedBot] Listing bumped via edit');
                    return true;
                }
            }

            console.log('[GrailedBot] Bump/Edit button not found');
            return false;
        } catch (error) {
            console.error('[GrailedBot] Bump error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Bump all listings in the seller's wardrobe
     */
    async bumpAllListings(options = {}) {
        const { maxBumps = 50, delayBetween = 4000 } = options;
        console.log(`[GrailedBot] Bumping up to ${maxBumps} listings`);

        try {
            await this.page.goto(`${GRAILED_URL}/users/myitems`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/listings/"], [data-testid*="listing"] a',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxBumps);
            console.log(`[GrailedBot] Found ${uniqueLinks.length} listings`);

            let bumped = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.bumpListing(link);
                if (success) bumped++;
                else skipped++;
                await this.page.waitForTimeout(delayBetween + randomDelay(500, 1500));
            }

            console.log(`[GrailedBot] Bump complete: ${bumped} bumped, ${skipped} skipped`);
            return { bumped, skipped, total: uniqueLinks.length };
        } catch (error) {
            console.error('[GrailedBot] Bump all error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    getStats() {
        return { ...this.stats };
    }

    async close() {
        console.log('[GrailedBot] Closing browser...');
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        console.log('[GrailedBot] Browser closed');
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
