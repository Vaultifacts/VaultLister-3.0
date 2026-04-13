// Whatnot Publish Service
// Creates a new fixed-price Whatnot listing via Playwright browser automation
// Flow: login → seller dashboard → create listing → fill form → submit → capture URL
//
// Note: Whatnot's creator API is invite-only/partner-only. This service automates the web UI.
// Requires WHATNOT_USERNAME (email) and WHATNOT_PASSWORD in .env.
//
// Whatnot is primarily a live-selling / auction platform, but supports fixed-price
// Buy Now listings via the seller dashboard. This service creates a fixed-price listing
// that can be sold outside of a live show.

import { chromium } from 'playwright';
import { logger } from '../../shared/logger.js';
import { resolveImageFiles, cleanupTempImages } from './imageUploadHelper.js';
import { auditLog } from './platformAuditLog.js';

const WHATNOT_URL = 'https://www.whatnot.com';

// Whatnot condition values
const CONDITION_MAP = {
    'new':        'New',
    'like_new':   'Like New',
    'good':       'Good',
    'fair':       'Fair',
    'poor':       'Poor',
    'parts_only': 'Parts/Not Working'
};

function randomDelay(min = 800, max = 2000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanType(page, selector, text) {
    await page.click(selector);
    await page.fill(selector, '');
    for (const char of text) {
        await page.keyboard.type(char);
        await page.waitForTimeout(randomDelay(40, 120));
    }
}

/**
 * Publish a VaultLister listing to Whatnot (fixed-price Buy Now) via browser automation.
 * @param {Object} shop      - Shop row (platform = 'whatnot')
 * @param {Object} listing   - Listing row
 * @param {Object} inventory - InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function publishListingToWhatnot(shop, listing, inventory) {
    const username = process.env.WHATNOT_USERNAME;
    const password = process.env.WHATNOT_PASSWORD;

    if (!username || !password) {
        throw new Error('WHATNOT_USERNAME and WHATNOT_PASSWORD must be set in .env to publish to Whatnot');
    }

    const price = parseFloat(listing.price || inventory.list_price || 0);
    if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

    auditLog('whatnot', 'publish_attempt', { listingId: listing.id });

    const title       = (listing.title || inventory.title || 'Item from VaultLister').slice(0, 100);
    const description = (listing.description || inventory.description || title).slice(0, 2000);
    const condition   = CONDITION_MAP[inventory.condition?.toLowerCase()] || 'Good';

    logger.info('[Whatnot Publish] Launching browser');

    let browser;
    try {
        browser = await chromium.launch({ headless: true, slowMo: 50 });
    } catch (launchErr) {
        throw new Error(`[Whatnot Publish] Browser launch failed: ${launchErr.message}`);
    }
    if (!browser) {
        throw new Error('[Whatnot Publish] Browser launch returned null — Playwright may not be installed');
    }

    let tempFiles = [];

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 900 }
        });
        if (!context) throw new Error('[Whatnot Publish] Browser context creation returned null');

        const page = await context.newPage();
        if (!page) throw new Error('[Whatnot Publish] Page creation returned null');

        // Step 1: Login
        logger.info('[Whatnot Publish] Logging in', { username });
        await page.goto(`${WHATNOT_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(1500, 2500));

        const emailSelector = 'input[type="email"], input[name="email"], input[placeholder*="email" i]';
        await page.waitForSelector(emailSelector, { timeout: 15000 });
        await humanType(page, emailSelector, username);
        await page.waitForTimeout(randomDelay(500, 1000));

        const passSelector = 'input[type="password"], input[name="password"]';
        await page.waitForSelector(passSelector, { timeout: 10000 });
        await humanType(page, passSelector, password);
        await page.waitForTimeout(randomDelay(500, 1000));

        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(randomDelay(2000, 3500));

        const afterLogin = page.url();
        if (afterLogin.includes('/login') || afterLogin.includes('/signin')) {
            throw new Error('Whatnot login failed — check WHATNOT_USERNAME / WHATNOT_PASSWORD in .env');
        }
        logger.info('[Whatnot Publish] Login successful');

        // Step 2: Navigate to seller dashboard / create listing
        logger.info('[Whatnot Publish] Navigating to seller dashboard');
        await page.goto(`${WHATNOT_URL}/sell`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(2000, 3500));

        // Try to find "Create Listing" or "Add Item" button
        const createBtn = await page.$(
            'button:has-text("Create Listing"), button:has-text("Add Item"), button:has-text("New Listing"), a:has-text("Create Listing"), a:has-text("Add Item")'
        );
        if (createBtn) {
            await createBtn.click();
            await page.waitForTimeout(randomDelay(1500, 2500));
        } else {
            // Try direct URL if button not found
            await page.goto(`${WHATNOT_URL}/sell/listing/create`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(randomDelay(2000, 3000));
        }

        // Step 3: Upload photos
        const photoInput = await page.$('input[type="file"][accept*="image"], input[type="file"]');
        if (photoInput) {
            const { files, tempFiles: tf } = await resolveImageFiles(inventory.images, 8);
            tempFiles = tf;
            if (files.length > 0) {
                await photoInput.setInputFiles(files);
                await page.waitForTimeout(randomDelay(1500, 3000));
                logger.info('[Whatnot Publish] Uploaded images', { count: files.length });
            }
        } else {
            logger.warn('[Whatnot Publish] Photo upload input not found, skipping');
        }

        // Step 4: Title
        const titleSelector = [
            'input[placeholder*="title" i]',
            'input[placeholder*="item name" i]',
            'input[name*="title"]',
            '[data-testid*="title"] input'
        ].join(', ');
        await page.waitForSelector(titleSelector, { timeout: 15000 });
        await humanType(page, titleSelector, title);
        await page.waitForTimeout(randomDelay(500, 1000));

        // Step 4: Description
        const descSelector = [
            'textarea[placeholder*="description" i]',
            'textarea[name*="description"]',
            '[data-testid*="description"] textarea'
        ].join(', ');
        const descEl = await page.$(descSelector);
        if (descEl) {
            await humanType(page, descSelector, description);
            await page.waitForTimeout(randomDelay(500, 1000));
        } else {
            logger.warn('[Whatnot Publish] Description field not found, skipping');
        }

        // Step 5: Price (Buy Now)
        const priceSelector = [
            'input[placeholder*="price" i]',
            'input[name*="price"]',
            'input[aria-label*="price" i]',
            '[data-testid*="price"] input'
        ].join(', ');
        const priceEl = await page.$(priceSelector);
        if (priceEl) {
            await humanType(page, priceSelector, price.toFixed(2));
            await page.waitForTimeout(randomDelay(500, 1000));
        } else {
            logger.warn('[Whatnot Publish] Price field not found, skipping');
        }

        // Step 6: Condition
        const conditionTrigger = await page.$(
            '[data-testid*="condition"], select[name*="condition"], button:has-text("Condition"), [aria-label*="condition" i]'
        );
        if (conditionTrigger) {
            const tagName = await conditionTrigger.evaluate(el => el.tagName.toLowerCase());
            if (tagName === 'select') {
                await conditionTrigger.selectOption({ label: condition });
            } else {
                await conditionTrigger.click();
                await page.waitForTimeout(randomDelay(600, 1200));
                const option = await page.$(`[role="option"]:has-text("${condition}"), li:has-text("${condition}")`);
                if (option) {
                    await option.click();
                    await page.waitForTimeout(randomDelay(400, 800));
                } else {
                    logger.warn('[Whatnot Publish] Condition option not found', { condition });
                    await page.keyboard.press('Escape');
                }
            }
        } else {
            logger.warn('[Whatnot Publish] Condition trigger not found, skipping');
        }

        // Step 7: Submit
        logger.info('[Whatnot Publish] Submitting listing');
        const submitSelector = [
            '[data-testid*="submit"]',
            '[data-testid*="publish"]',
            'button:has-text("Publish")',
            'button:has-text("Create")',
            'button:has-text("Save")',
            'button[type="submit"]'
        ].join(', ');
        const submitBtn = await page.$(submitSelector);
        if (!submitBtn) throw new Error('Could not find submit button on Whatnot sell page');

        await submitBtn.click();
        await page.waitForTimeout(randomDelay(4000, 6000));

        // Step 8: Capture URL
        const finalUrl = page.url();
        logger.info('[Whatnot Publish] Post-submit URL', { url: finalUrl });

        // Extract listing ID: /listing/[id] or /item/[id]
        const urlMatch = finalUrl.match(/\/listing\/([^/?]+)/)
                      || finalUrl.match(/\/item\/([^/?]+)/);
        const listingId = urlMatch ? urlMatch[1] : `wn-${Date.now()}`;
        const listingUrl = urlMatch ? finalUrl : `${WHATNOT_URL}/listing/${listingId}`;

        logger.info('[Whatnot Publish] Success', { listingId, listingUrl });
        auditLog('whatnot', 'publish_success', { listingId, listingUrl });
        return { listingId, listingUrl };

    } catch (err) {
        auditLog('whatnot', 'publish_failure', { listingId: listing.id, error: err.message });
        throw err;
    } finally {
        cleanupTempImages(tempFiles);
        if (browser) {
            try { await browser.close(); } catch (closeErr) { logger.warn('[Whatnot Publish] Browser close failed:', closeErr.message); }
        }
    }
}

export default { publishListingToWhatnot };
