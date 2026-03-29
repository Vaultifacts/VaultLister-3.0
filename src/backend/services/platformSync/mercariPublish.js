// Mercari Publish Service
// Creates a new Mercari listing via Playwright browser automation
// Flow: login → sell page → fill form → submit → capture URL
//
// Note: Mercari US has no public seller API. This service automates the web UI.
// Requires MERCARI_USERNAME (email) and MERCARI_PASSWORD in .env.

import { chromium } from 'playwright';
import { logger } from '../../shared/logger.js';
import { resolveImageFiles, cleanupTempImages } from './imageUploadHelper.js';
import { auditLog } from './platformAuditLog.js';

const MERCARI_URL = 'https://www.mercari.com';

// Mercari condition values (web UI display names)
const CONDITION_MAP = {
    'new':        'Brand New',
    'like_new':   'Like New',
    'good':       'Good',
    'fair':       'Fair',
    'poor':       'Poor',
    'parts_only': 'Poor'  // closest Mercari equivalent
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
 * Publish a VaultLister listing to Mercari via browser automation.
 * @param {Object} shop      - Shop row (platform = 'mercari')
 * @param {Object} listing   - Listing row
 * @param {Object} inventory - InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function publishListingToMercari(shop, listing, inventory) {
    const username = process.env.MERCARI_USERNAME;
    const password = process.env.MERCARI_PASSWORD;

    if (!username || !password) {
        throw new Error('MERCARI_USERNAME and MERCARI_PASSWORD must be set in .env to publish to Mercari');
    }

    const price = parseFloat(listing.price || inventory.list_price || 0);
    if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

    auditLog('mercari', 'publish_attempt', { listingId: listing.id });

    const title       = (listing.title || inventory.title || 'Item from VaultLister').slice(0, 40); // Mercari max title: 40 chars
    const description = (listing.description || inventory.description || title).slice(0, 1000);
    const condition   = CONDITION_MAP[inventory.condition?.toLowerCase()] || 'Good';

    logger.info('[Mercari Publish] Launching browser');

    let browser;
    try {
        browser = await chromium.launch({ headless: true, slowMo: 50 });
    } catch (launchErr) {
        throw new Error(`[Mercari Publish] Browser launch failed: ${launchErr.message}`);
    }
    if (!browser) {
        throw new Error('[Mercari Publish] Browser launch returned null — Playwright may not be installed');
    }

    let tempFiles = [];

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 900 }
        });
        if (!context) throw new Error('[Mercari Publish] Browser context creation returned null');

        const page = await context.newPage();
        if (!page) throw new Error('[Mercari Publish] Page creation returned null');

        // Step 1: Login
        logger.info('[Mercari Publish] Logging in', { username });
        await page.goto(`${MERCARI_URL}/login/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(1500, 2500));

        // Click "Sign in with Email" if the button exists (Mercari shows social login first)
        const emailSignInBtn = await page.$('[data-testid="email-login"], a[href*="email"], button:has-text("Email")');
        if (emailSignInBtn) {
            await emailSignInBtn.click();
            await page.waitForTimeout(randomDelay(800, 1500));
        }

        const emailSelector = 'input[type="email"], input[name="email"], input[placeholder*="email" i]';
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
        if (afterLogin.includes('/login') || afterLogin.includes('/signin')) {
            throw new Error('Mercari login failed — check MERCARI_USERNAME / MERCARI_PASSWORD in .env');
        }
        logger.info('[Mercari Publish] Login successful');

        // Step 2: Navigate to sell page
        logger.info('[Mercari Publish] Navigating to sell page');
        await page.goto(`${MERCARI_URL}/sell/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(2000, 3500));

        // Step 3: Upload photos
        const photoInput = await page.$('input[type="file"][accept*="image"], input[type="file"]');
        if (photoInput) {
            const { files, tempFiles: tf } = await resolveImageFiles(inventory.images, 12);
            tempFiles = tf;
            if (files.length > 0) {
                await photoInput.setInputFiles(files);
                await page.waitForTimeout(randomDelay(1500, 3000));
                logger.info('[Mercari Publish] Uploaded images', { count: files.length });
            }
        } else {
            logger.warn('[Mercari Publish] Photo upload input not found, skipping');
        }

        // Step 4: Title
        const titleSelector = [
            'input[placeholder*="item name" i]',
            'input[placeholder*="title" i]',
            '[data-testid*="title"] input',
            'input[name*="name"]'
        ].join(', ');
        await page.waitForSelector(titleSelector, { timeout: 15000 });
        await humanType(page, titleSelector, title);
        await page.waitForTimeout(randomDelay(500, 1000));

        // Step 4: Description
        const descSelector = [
            'textarea[placeholder*="description" i]',
            'textarea[placeholder*="tell" i]',
            '[data-testid*="description"] textarea'
        ].join(', ');
        const descEl = await page.$(descSelector);
        if (descEl) {
            await humanType(page, descSelector, description);
            await page.waitForTimeout(randomDelay(500, 1000));
        } else {
            logger.warn('[Mercari Publish] Description field not found, skipping');
        }

        // Step 5: Condition — click the condition dropdown and select matching option
        const conditionTrigger = await page.$('[data-testid*="condition"], button:has-text("Condition"), .condition-selector');
        if (conditionTrigger) {
            await conditionTrigger.click();
            await page.waitForTimeout(randomDelay(600, 1200));
            const option = await page.$(`[role="option"]:has-text("${condition}"), li:has-text("${condition}")`);
            if (option) {
                await option.click();
                await page.waitForTimeout(randomDelay(400, 800));
            } else {
                logger.warn('[Mercari Publish] Condition option not found', { condition });
                await page.keyboard.press('Escape');
            }
        } else {
            logger.warn('[Mercari Publish] Condition trigger not found, skipping');
        }

        // Step 6: Price
        const priceSelector = [
            'input[placeholder*="price" i]',
            'input[name*="price"]',
            '[data-testid*="price"] input'
        ].join(', ');
        const priceEl = await page.$(priceSelector);
        if (priceEl) {
            await humanType(page, priceSelector, Math.floor(price).toString()); // Mercari requires integer prices
            await page.waitForTimeout(randomDelay(500, 1000));
        } else {
            logger.warn('[Mercari Publish] Price field not found, skipping');
        }

        // Step 7: Shipping — try to select "Seller ships" (the standard option)
        const shippingTrigger = await page.$('[data-testid*="shipping"], button:has-text("Shipping"), .shipping-selector');
        if (shippingTrigger) {
            await shippingTrigger.click();
            await page.waitForTimeout(randomDelay(600, 1000));
            const sellerShipsOption = await page.$('[role="option"]:has-text("Seller"), li:has-text("Seller")');
            if (sellerShipsOption) {
                await sellerShipsOption.click();
                await page.waitForTimeout(randomDelay(400, 800));
            } else {
                await page.keyboard.press('Escape');
            }
        }

        // Step 8: Submit
        logger.info('[Mercari Publish] Submitting listing');
        const submitSelector = [
            '[data-testid*="list-item"]',
            '[data-testid*="submit"]',
            'button:has-text("List")',
            'button[type="submit"]'
        ].join(', ');
        const submitBtn = await page.$(submitSelector);
        if (!submitBtn) throw new Error('Could not find submit button on Mercari sell page');

        await submitBtn.click();
        await page.waitForTimeout(randomDelay(4000, 6000));

        // Step 9: Capture listing URL
        const finalUrl = page.url();
        logger.info('[Mercari Publish] Post-submit URL', { url: finalUrl });

        if (finalUrl.includes('/sell/') && !finalUrl.includes('/success')) {
            // Check for validation errors
            const errors = await page.$$eval(
                '[class*="error"], [class*="alert"], [data-testid*="error"]',
                els => els.map(e => e.textContent.trim()).filter(Boolean)
            );
            if (errors.length > 0) {
                throw new Error(`Mercari listing submission failed: ${errors[0]}`);
            }
            // May have submitted but stayed on sell page — check for success indicators
            const successEl = await page.$('[class*="success"], [data-testid*="success"]');
            if (!successEl) {
                throw new Error('Mercari listing submission may have failed. Check sell page for errors.');
            }
        }

        // Extract listing ID: /item/m[digits] or similar
        const urlMatch = finalUrl.match(/\/item\/(m\d+)/) || finalUrl.match(/\/listing\/([\w-]+)/);
        const listingId = urlMatch ? urlMatch[1] : `mc-${Date.now()}`;
        const listingUrl = urlMatch ? `${MERCARI_URL}/item/${listingId}/` : finalUrl;

        logger.info('[Mercari Publish] Success', { listingId, listingUrl });
        auditLog('mercari', 'publish_success', { listingId, listingUrl });
        return { listingId, listingUrl };

    } catch (err) {
        auditLog('mercari', 'publish_failure', { listingId: listing.id, error: err.message });
        throw err;
    } finally {
        cleanupTempImages(tempFiles);
        await browser.close();
    }
}

export default { publishListingToMercari };
