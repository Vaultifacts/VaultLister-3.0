// Poshmark Publish Service
// Creates a new Poshmark listing via Playwright browser automation
// Flow: login → create-listing page → fill form → submit → capture URL
//
// Note: Poshmark has no public API. This service automates the web UI.
// Requires POSHMARK_USERNAME and POSHMARK_PASSWORD in .env.

import { chromium } from 'playwright';
import { logger } from '../../shared/logger.js';
import { resolveImageFiles, cleanupTempImages } from './imageUploadHelper.js';
import { auditLog } from './platformAuditLog.js';

const POSHMARK_URL = 'https://poshmark.com';

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
 * Publish a VaultLister listing to Poshmark via browser automation.
 * @param {Object} shop      - Shop row (platform = 'poshmark')
 * @param {Object} listing   - Listing row
 * @param {Object} inventory - InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function publishListingToPoshmark(shop, listing, inventory) {
    const username = process.env.POSHMARK_USERNAME;
    const password = process.env.POSHMARK_PASSWORD;

    if (!username || !password) {
        throw new Error('POSHMARK_USERNAME and POSHMARK_PASSWORD must be set in .env to publish to Poshmark');
    }

    const price = parseFloat(listing.price || inventory.list_price || 0);
    if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

    auditLog('poshmark', 'publish_attempt', { listingId: listing.id });

    const title       = (listing.title || inventory.title || 'Item from VaultLister').slice(0, 80);
    const description = (listing.description || inventory.description || title).slice(0, 500);
    const brand       = inventory.brand || 'Other';
    const originalPrice = Math.max(price, parseFloat(inventory.purchase_price || 0) || price * 1.5).toFixed(2);

    logger.info('[Poshmark Publish] Launching browser');

    const browser = await chromium.launch({ headless: true, slowMo: 50 });
    let tempFiles = [];

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });

        const page = await context.newPage();

        // Step 1: Login
        logger.info('[Poshmark Publish] Logging in', { username });
        await page.goto(`${POSHMARK_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(1000, 2000));

        await humanType(page, 'input[name="login_form[username_email]"]', username);
        await page.waitForTimeout(randomDelay(500, 1000));
        await humanType(page, 'input[name="login_form[password]"]', password);
        await page.waitForTimeout(randomDelay(500, 1000));
        await page.click('button[type="submit"]');

        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(randomDelay(1500, 2500));

        const afterLogin = page.url();
        if (afterLogin.includes('/login') || afterLogin.includes('/auth')) {
            throw new Error('Poshmark login failed — check POSHMARK_USERNAME / POSHMARK_PASSWORD in .env');
        }
        logger.info('[Poshmark Publish] Login successful');

        // Step 2: Navigate to create listing
        logger.info('[Poshmark Publish] Navigating to create-listing page');
        await page.goto(`${POSHMARK_URL}/create-listing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(2000, 3000));

        // Step 3: Upload photos (before filling text fields — Poshmark requires photos first)
        const photoInput = await page.$('input[type="file"][accept*="image"], input[type="file"]');
        if (photoInput) {
            const { files, tempFiles: tf } = await resolveImageFiles(inventory.images, 8);
            tempFiles = tf;
            if (files.length > 0) {
                await photoInput.setInputFiles(files);
                await page.waitForTimeout(randomDelay(1500, 3000));
                logger.info('[Poshmark Publish] Uploaded images', { count: files.length });
            }
        } else {
            logger.warn('[Poshmark Publish] Photo upload input not found, skipping');
        }

        // Step 4: Title
        const titleSelector = [
            'input[placeholder*="title" i]',
            '[data-test*="title"] input',
            'input[name*="title"]'
        ].join(', ');
        await page.waitForSelector(titleSelector, { timeout: 15000 });
        await humanType(page, titleSelector, title);
        await page.waitForTimeout(randomDelay(500, 1000));

        // Step 4: Description
        const descSelector = [
            'textarea[placeholder*="description" i]',
            '[data-test*="description"] textarea',
            'textarea[name*="description"]'
        ].join(', ');
        const descEl = await page.$(descSelector);
        if (descEl) {
            await humanType(page, descSelector, description);
            await page.waitForTimeout(randomDelay(500, 1000));
        } else {
            logger.warn('[Poshmark Publish] Description field not found, skipping');
        }

        // Step 5: Brand
        const brandSelector = [
            'input[placeholder*="brand" i]',
            '[data-test*="brand"] input',
            'input[name*="brand"]'
        ].join(', ');
        const brandEl = await page.$(brandSelector);
        if (brandEl) {
            await humanType(page, brandSelector, brand);
            await page.waitForTimeout(randomDelay(400, 800));
            // Accept first autocomplete suggestion if it appears
            const suggestion = await page.$('[class*="suggestion"] li:first-child, [class*="autocomplete"] li:first-child');
            if (suggestion) {
                await suggestion.click();
                await page.waitForTimeout(randomDelay(300, 600));
            }
        } else {
            logger.warn('[Poshmark Publish] Brand field not found, skipping');
        }

        // Step 6: Original price (MSRP)
        const msrpSelector = 'input[placeholder*="original" i], input[name*="original_price" i]';
        const msrpEl = await page.$(msrpSelector);
        if (msrpEl) {
            await humanType(page, msrpSelector, originalPrice);
            await page.waitForTimeout(randomDelay(300, 600));
        }

        // Step 7: Listing price
        const priceSelector = [
            'input[placeholder*="listing price" i]',
            '[data-test*="listing-price"] input',
            'input[name*="price" i]:not([name*="original"])'
        ].join(', ');
        const priceEl = await page.$(priceSelector);
        if (priceEl) {
            await humanType(page, priceSelector, price.toFixed(2));
            await page.waitForTimeout(randomDelay(500, 1000));
        } else {
            logger.warn('[Poshmark Publish] Listing price field not found, skipping');
        }

        // Step 8: Submit
        logger.info('[Poshmark Publish] Submitting listing');
        const submitSelector = [
            '[data-test*="list-now"]',
            '[data-test*="submit"]',
            'button[type="submit"]'
        ].join(', ');
        const submitBtn = await page.$(submitSelector);
        if (!submitBtn) throw new Error('Could not find submit button on Poshmark create-listing page');

        await submitBtn.click();
        await page.waitForTimeout(randomDelay(4000, 6000));

        // Step 9: Capture listing URL from redirect
        const finalUrl = page.url();
        logger.info('[Poshmark Publish] Post-submit URL', { url: finalUrl });

        if (finalUrl.includes('/create-listing')) {
            // Still on create page — validation errors present
            const errors = await page.$$eval(
                '[class*="error"], [class*="alert"]',
                els => els.map(e => e.textContent.trim()).filter(Boolean)
            );
            throw new Error(`Poshmark listing submission failed. ${errors.join('; ') || 'See create-listing page for validation errors.'}`);
        }

        // Extract listing ID from URL: /listing/item-title-[24-char-hex]
        const urlMatch = finalUrl.match(/\/listing\/[^/]*[-_]([a-f0-9]{24})(?:[/?]|$)/)
                      || finalUrl.match(/\/listing\/([^/?]+)/);
        const listingId = urlMatch ? urlMatch[1] : `pm-${Date.now()}`;

        logger.info('[Poshmark Publish] Success', { listingId, listingUrl: finalUrl });
        auditLog('poshmark', 'publish_success', { listingId, listingUrl: finalUrl });
        return { listingId, listingUrl: finalUrl };

    } catch (err) {
        auditLog('poshmark', 'publish_failure', { listingId: listing.id, error: err.message });
        throw err;
    } finally {
        cleanupTempImages(tempFiles);
        await browser.close();
    }
}

export default { publishListingToPoshmark };
