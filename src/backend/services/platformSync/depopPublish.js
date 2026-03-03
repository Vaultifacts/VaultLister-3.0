// Depop Publish Service
// Creates a new Depop listing via Playwright browser automation
// Flow: login → sell page → fill form → submit → capture URL
//
// Note: Depop has no public seller API. This service automates the web UI.
// Requires DEPOP_USERNAME (email) and DEPOP_PASSWORD in .env.

import { chromium } from 'playwright';
import { logger } from '../../shared/logger.js';

const DEPOP_URL = 'https://www.depop.com';

// Depop condition values (web UI display names)
const CONDITION_MAP = {
    'new':        'Brand New',
    'like_new':   'Like New',
    'good':       'Good',
    'fair':       'Used',
    'poor':       'Used',
    'parts_only': 'Used'
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
 * Publish a VaultLister listing to Depop via browser automation.
 * @param {Object} shop      - Shop row (platform = 'depop')
 * @param {Object} listing   - Listing row
 * @param {Object} inventory - InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function publishListingToDepop(shop, listing, inventory) {
    const username = process.env.DEPOP_USERNAME;
    const password = process.env.DEPOP_PASSWORD;

    if (!username || !password) {
        throw new Error('DEPOP_USERNAME and DEPOP_PASSWORD must be set in .env to publish to Depop');
    }

    const price = parseFloat(listing.price || inventory.list_price || 0);
    if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

    const title       = (listing.title || inventory.title || 'Item from VaultLister').slice(0, 75); // Depop max title: 75 chars
    const description = (listing.description || inventory.description || title).slice(0, 1000);
    const condition   = CONDITION_MAP[inventory.condition?.toLowerCase()] || 'Good';

    logger.info('[Depop Publish] Launching browser');

    const browser = await chromium.launch({ headless: true, slowMo: 50 });

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 900 }
        });

        const page = await context.newPage();

        // Step 1: Login
        logger.info('[Depop Publish] Logging in', { username });
        await page.goto(`${DEPOP_URL}/login/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(1500, 2500));

        const emailSelector = 'input[type="email"], input[name="email"], input[placeholder*="email" i], input[id*="email" i]';
        await page.waitForSelector(emailSelector, { timeout: 15000 });
        await humanType(page, emailSelector, username);
        await page.waitForTimeout(randomDelay(500, 1000));

        const passSelector = 'input[type="password"], input[name="password"]';
        await page.waitForSelector(passSelector, { timeout: 10000 });
        await humanType(page, passSelector, password);
        await page.waitForTimeout(randomDelay(500, 1000));

        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(randomDelay(2000, 3000));

        const afterLogin = page.url();
        if (afterLogin.includes('/login') || afterLogin.includes('/signup')) {
            throw new Error('Depop login failed — check DEPOP_USERNAME / DEPOP_PASSWORD in .env');
        }
        logger.info('[Depop Publish] Login successful');

        // Step 2: Navigate to sell page
        logger.info('[Depop Publish] Navigating to sell page');
        await page.goto(`${DEPOP_URL}/sell/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(2000, 3500));

        // Step 3: Title
        const titleSelector = [
            'input[placeholder*="item name" i]',
            'input[placeholder*="title" i]',
            '[data-testid*="title"] input',
            'input[name*="title"]',
            'input[id*="title"]'
        ].join(', ');
        await page.waitForSelector(titleSelector, { timeout: 15000 });
        await humanType(page, titleSelector, title);
        await page.waitForTimeout(randomDelay(500, 1000));

        // Step 4: Description
        const descSelector = [
            'textarea[placeholder*="description" i]',
            'textarea[placeholder*="tell" i]',
            '[data-testid*="description"] textarea',
            'textarea[name*="description"]'
        ].join(', ');
        const descEl = await page.$(descSelector);
        if (descEl) {
            await humanType(page, descSelector, description);
            await page.waitForTimeout(randomDelay(500, 1000));
        } else {
            logger.warn('[Depop Publish] Description field not found, skipping');
        }

        // Step 5: Condition
        const conditionTrigger = await page.$(
            '[data-testid*="condition"], button:has-text("Condition"), [aria-label*="condition" i], select[name*="condition"]'
        );
        if (conditionTrigger) {
            const tagName = await conditionTrigger.evaluate(el => el.tagName.toLowerCase());
            if (tagName === 'select') {
                await conditionTrigger.selectOption({ label: condition });
            } else {
                await conditionTrigger.click();
                await page.waitForTimeout(randomDelay(600, 1200));
                const option = await page.$(`[role="option"]:has-text("${condition}"), li:has-text("${condition}"), button:has-text("${condition}")`);
                if (option) {
                    await option.click();
                    await page.waitForTimeout(randomDelay(400, 800));
                } else {
                    logger.warn('[Depop Publish] Condition option not found', { condition });
                    await page.keyboard.press('Escape');
                }
            }
        } else {
            logger.warn('[Depop Publish] Condition trigger not found, skipping');
        }

        // Step 6: Price
        const priceSelector = [
            'input[placeholder*="price" i]',
            'input[name*="price"]',
            '[data-testid*="price"] input',
            'input[id*="price"]'
        ].join(', ');
        const priceEl = await page.$(priceSelector);
        if (priceEl) {
            await humanType(page, priceSelector, price.toFixed(2));
            await page.waitForTimeout(randomDelay(500, 1000));
        } else {
            logger.warn('[Depop Publish] Price field not found, skipping');
        }

        // Step 7: Submit
        logger.info('[Depop Publish] Submitting listing');
        const submitSelector = [
            '[data-testid*="publish"]',
            '[data-testid*="submit"]',
            'button:has-text("List")',
            'button:has-text("Publish")',
            'button[type="submit"]'
        ].join(', ');
        const submitBtn = await page.$(submitSelector);
        if (!submitBtn) throw new Error('Could not find submit button on Depop sell page');

        await submitBtn.click();
        await page.waitForTimeout(randomDelay(4000, 6000));

        // Step 8: Capture listing URL
        const finalUrl = page.url();
        logger.info('[Depop Publish] Post-submit URL', { url: finalUrl });

        if (finalUrl.includes('/sell/') && !finalUrl.includes('/success')) {
            const errors = await page.$$eval(
                '[class*="error"], [class*="alert"], [data-testid*="error"]',
                els => els.map(e => e.textContent.trim()).filter(Boolean)
            );
            if (errors.length > 0) {
                throw new Error(`Depop listing submission failed: ${errors[0]}`);
            }
            const successEl = await page.$('[class*="success"], [data-testid*="success"]');
            if (!successEl) {
                throw new Error('Depop listing submission may have failed. Check sell page for errors.');
            }
        }

        // Extract listing ID: /products/username-slug-[id]/ or /[username]/[id]/
        const urlMatch = finalUrl.match(/\/products\/[^/]*[-_](\w+)\/?$/)
                      || finalUrl.match(/\/products\/([^/?]+)/);
        const listingId = urlMatch ? urlMatch[1] : `dp-${Date.now()}`;
        const listingUrl = urlMatch ? finalUrl : `${DEPOP_URL}/products/${listingId}/`;

        logger.info('[Depop Publish] Success', { listingId, listingUrl });
        return { listingId, listingUrl };

    } finally {
        await browser.close();
    }
}

export default { publishListingToDepop };
