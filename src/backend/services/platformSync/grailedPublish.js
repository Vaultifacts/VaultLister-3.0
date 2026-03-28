// Grailed Publish Service
// Creates a new Grailed listing via Playwright browser automation
// Flow: login → sell page → fill form → submit → capture URL
//
// Note: Grailed has no public seller API. This service automates the web UI.
// Requires GRAILED_USERNAME (email) and GRAILED_PASSWORD in .env.
// Grailed is a fashion/streetwear focused marketplace — listings should have
// accurate designer/brand, category, and condition for best visibility.

import { chromium } from 'playwright';
import { logger } from '../../shared/logger.js';
import { resolveImageFiles, cleanupTempImages } from './imageUploadHelper.js';
import { auditLog } from './platformAuditLog.js';

const GRAILED_URL = 'https://www.grailed.com';

// Grailed condition values (web UI display names)
const CONDITION_MAP = {
    'new':        'New/Never Worn',
    'like_new':   'Gently Used',
    'good':       'Used',
    'fair':       'Worn In / Vintage',
    'poor':       'Heavily Used',
    'parts_only': 'Heavily Used'
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
 * Publish a VaultLister listing to Grailed via browser automation.
 * @param {Object} shop      - Shop row (platform = 'grailed')
 * @param {Object} listing   - Listing row
 * @param {Object} inventory - InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function publishListingToGrailed(shop, listing, inventory) {
    const username = process.env.GRAILED_USERNAME;
    const password = process.env.GRAILED_PASSWORD;

    if (!username || !password) {
        throw new Error('GRAILED_USERNAME and GRAILED_PASSWORD must be set in .env to publish to Grailed');
    }

    const price = parseFloat(listing.price || inventory.list_price || 0);
    if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

    auditLog('grailed', 'publish_attempt', { listingId: listing.id });

    const title       = (listing.title || inventory.title || 'Item from VaultLister').slice(0, 60); // Grailed max title: 60 chars
    const description = (listing.description || inventory.description || title).slice(0, 1500);
    const condition   = CONDITION_MAP[inventory.condition?.toLowerCase()] || 'Used';
    const brand       = inventory.brand || '';

    logger.info('[Grailed Publish] Launching browser');

    let browser;
    try {
        browser = await chromium.launch({ headless: true, slowMo: 50 });
    } catch (launchErr) {
        throw new Error(`[Grailed Publish] Browser launch failed: ${launchErr.message}`);
    }
    if (!browser) {
        throw new Error('[Grailed Publish] Browser launch returned null — Playwright may not be installed');
    }

    let tempFiles = [];

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 900 }
        });
        if (!context) throw new Error('[Grailed Publish] Browser context creation returned null');

        const page = await context.newPage();
        if (!page) throw new Error('[Grailed Publish] Page creation returned null');

        // Step 1: Login
        logger.info('[Grailed Publish] Logging in', { username });
        await page.goto(`${GRAILED_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(1500, 2500));

        // Grailed may show a modal or full login page
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
            throw new Error('Grailed login failed — check GRAILED_USERNAME / GRAILED_PASSWORD in .env');
        }
        logger.info('[Grailed Publish] Login successful');

        // Step 2: Navigate to sell page
        logger.info('[Grailed Publish] Navigating to sell page');
        await page.goto(`${GRAILED_URL}/sell`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(2000, 3500));

        // Step 3: Upload photos
        const photoInput = await page.$('input[type="file"][accept*="image"], input[type="file"]');
        if (photoInput) {
            const { files, tempFiles: tf } = await resolveImageFiles(inventory.images, 10);
            tempFiles = tf;
            if (files.length > 0) {
                await photoInput.setInputFiles(files);
                await page.waitForTimeout(randomDelay(1500, 3000));
                logger.info('[Grailed Publish] Uploaded images', { count: files.length });
            }
        } else {
            logger.warn('[Grailed Publish] Photo upload input not found, skipping');
        }

        // Step 4: Title / Item Name
        const titleSelector = [
            'input[placeholder*="item" i]',
            'input[placeholder*="name" i]',
            'input[placeholder*="title" i]',
            '[data-testid*="title"] input',
            '[data-testid*="name"] input',
            'input[name*="title"]',
            'input[name*="name"]'
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
            logger.warn('[Grailed Publish] Description field not found, skipping');
        }

        // Step 5: Designer / Brand (Grailed is designer-forward)
        if (brand) {
            const designerSelector = [
                'input[placeholder*="designer" i]',
                'input[placeholder*="brand" i]',
                '[data-testid*="designer"] input',
                'input[name*="designer"]',
                'input[name*="brand"]'
            ].join(', ');
            const designerEl = await page.$(designerSelector);
            if (designerEl) {
                await humanType(page, designerSelector, brand);
                await page.waitForTimeout(randomDelay(400, 800));
                // Accept first autocomplete suggestion
                const suggestion = await page.$('[class*="suggestion"] li:first-child, [class*="autocomplete"] li:first-child, [role="option"]:first-child');
                if (suggestion) {
                    await suggestion.click();
                    await page.waitForTimeout(randomDelay(300, 600));
                } else {
                    // Press Enter or Tab to confirm typed value
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(randomDelay(200, 400));
                }
            } else {
                logger.warn('[Grailed Publish] Designer/brand field not found, skipping');
            }
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
                const option = await page.$(`[role="option"]:has-text("${condition}"), li:has-text("${condition}"), button:has-text("${condition}")`);
                if (option) {
                    await option.click();
                    await page.waitForTimeout(randomDelay(400, 800));
                } else {
                    logger.warn('[Grailed Publish] Condition option not found', { condition });
                    await page.keyboard.press('Escape');
                }
            }
        } else {
            logger.warn('[Grailed Publish] Condition trigger not found, skipping');
        }

        // Step 7: Price
        const priceSelector = [
            'input[placeholder*="price" i]',
            'input[name*="price"]',
            '[data-testid*="price"] input',
            'input[id*="price"]'
        ].join(', ');
        const priceEl = await page.$(priceSelector);
        if (priceEl) {
            await humanType(page, priceSelector, Math.floor(price).toString()); // Grailed requires integer prices
            await page.waitForTimeout(randomDelay(500, 1000));
        } else {
            logger.warn('[Grailed Publish] Price field not found, skipping');
        }

        // Step 8: Submit
        logger.info('[Grailed Publish] Submitting listing');
        const submitSelector = [
            '[data-testid*="list"]',
            '[data-testid*="submit"]',
            'button:has-text("List")',
            'button:has-text("Publish")',
            'button:has-text("Post")',
            'button[type="submit"]'
        ].join(', ');
        const submitBtn = await page.$(submitSelector);
        if (!submitBtn) throw new Error('Could not find submit button on Grailed sell page');

        await submitBtn.click();
        await page.waitForTimeout(randomDelay(4000, 6000));

        // Step 9: Capture listing URL
        const finalUrl = page.url();
        logger.info('[Grailed Publish] Post-submit URL', { url: finalUrl });

        if (finalUrl.includes('/sell') && !finalUrl.includes('/success')) {
            const errors = await page.$$eval(
                '[class*="error"], [class*="alert"], [data-testid*="error"]',
                els => els.map(e => e.textContent.trim()).filter(Boolean)
            );
            if (errors.length > 0) {
                throw new Error(`Grailed listing submission failed: ${errors[0]}`);
            }
            const successEl = await page.$('[class*="success"], [data-testid*="success"]');
            if (!successEl) {
                throw new Error('Grailed listing submission may have failed. Check sell page for errors.');
            }
        }

        // Extract listing ID: /listings/[id]-[slug]
        const urlMatch = finalUrl.match(/\/listings\/(\d+)/)
                      || finalUrl.match(/\/listings\/([^/?]+)/);
        const listingId = urlMatch ? urlMatch[1] : `gr-${Date.now()}`;
        const listingUrl = urlMatch ? finalUrl : `${GRAILED_URL}/listings/${listingId}`;

        logger.info('[Grailed Publish] Success', { listingId, listingUrl });
        auditLog('grailed', 'publish_success', { listingId, listingUrl });
        return { listingId, listingUrl };

    } catch (err) {
        auditLog('grailed', 'publish_failure', { listingId: listing.id, error: err.message });
        throw err;
    } finally {
        cleanupTempImages(tempFiles);
        await browser.close();
    }
}

export default { publishListingToGrailed };
