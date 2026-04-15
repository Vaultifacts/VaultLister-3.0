// Facebook Marketplace Publish Service
// Creates a new Facebook Marketplace listing via Playwright browser automation
// Flow: login → marketplace/create/item → fill form → publish → capture URL
//
// Note: Facebook has no public Marketplace seller API. This service automates the web UI.
// Requires FACEBOOK_EMAIL and FACEBOOK_PASSWORD in .env.
//
// WARNING: Facebook actively detects automation. If a CAPTCHA or security check appears,
// this service will throw rather than attempt to bypass it. If logins consistently fail,
// consider using a dedicated Facebook account for VaultLister rather than your personal account.

import { logger } from '../../shared/logger.js';

// Lazy-load stealth utilities — worker/bots/ depends on playwright-extra which is
// installed in worker/node_modules, not the root. Static import crashes the server
// at startup in environments (CI) where worker deps aren't installed.
let _stealth = null;
async function getStealth() {
    if (!_stealth) _stealth = await import('../../../worker/bots/stealth.js');
    return _stealth;
}

let _profiles = null;
async function getProfiles() {
    if (!_profiles) _profiles = await import('../../../worker/bots/browser-profiles.js');
    return _profiles;
}
import { resolveImageFiles, cleanupTempImages } from './imageUploadHelper.js';
import { auditLog } from './platformAuditLog.js';

const FACEBOOK_URL = 'https://www.facebook.com';

// Facebook Marketplace condition values
const CONDITION_MAP = {
    'new':        'New',
    'like_new':   'Like New',
    'good':       'Good',
    'fair':       'Fair',
    'poor':       'Poor'
};

// Facebook Marketplace category mapping (broad categories only)
const CATEGORY_MAP = {
    'clothing': 'Clothing & Accessories',
    'shoes': 'Clothing & Accessories',
    'accessories': 'Clothing & Accessories',
    'electronics': 'Electronics',
    'furniture': 'Home & Garden',
    'home': 'Home & Garden',
    'garden': 'Home & Garden',
    'toys': 'Toys & Games',
    'games': 'Toys & Games',
    'books': 'Books, Movies & Music',
    'movies': 'Books, Movies & Music',
    'music': 'Books, Movies & Music',
    'sports': 'Sporting Goods',
    'vehicles': 'Vehicles',
    'tools': 'Tools & DIY',
    'collectibles': 'Hobbies'
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
 * Publish a VaultLister listing to Facebook Marketplace via browser automation.
 * @param {Object} shop      - Shop row (platform = 'facebook')
 * @param {Object} listing   - Listing row
 * @param {Object} inventory - InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function publishListingToFacebook(shop, listing, inventory) {
    const email    = process.env.FACEBOOK_EMAIL;
    const password = process.env.FACEBOOK_PASSWORD;

    if (!email || !password) {
        throw new Error('FACEBOOK_EMAIL and FACEBOOK_PASSWORD must be set in .env to publish to Facebook Marketplace');
    }

    const price = parseFloat(listing.price || inventory.list_price || 0);
    if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

    auditLog('facebook', 'publish_attempt', { listingId: listing.id });

    const title       = (listing.title || inventory.title || 'Item from VaultLister').slice(0, 100);
    const description = (listing.description || inventory.description || title).slice(0, 9999);
    const condition   = CONDITION_MAP[inventory.condition?.toLowerCase()] || 'Good';
    const rawCategory = (inventory.category || '').toLowerCase();
    const category    = Object.entries(CATEGORY_MAP).find(([k]) => rawCategory.includes(k))?.[1]
                     || 'Clothing & Accessories';

    logger.info('[Facebook Publish] Launching browser');

    const { launchCamoufox, humanClick, mouseWiggle } = await getStealth();
    const { initProfiles, getNextProfile, saveProfileUsage, flagProfile, getProfileDir } = await getProfiles();

    initProfiles();
    const profile = getNextProfile();

    const proxy = process.env.FACEBOOK_PROXY_URL
        ? { server: process.env.FACEBOOK_PROXY_URL }
        : undefined;

    let browser;
    try {
        browser = await launchCamoufox({
            profileDir: getProfileDir(profile.id),
            proxy,
            headless: true,
        });
    } catch (launchErr) {
        throw new Error(`[Facebook Publish] Browser launch failed: ${launchErr.message}`);
    }
    if (!browser) {
        throw new Error('[Facebook Publish] Browser launch returned null — camoufox-js may not be installed');
    }

    let tempFiles = [];

    try {
        const context = browser.contexts()[0] || await browser.newContext();
        if (!context) throw new Error('[Facebook Publish] Browser context creation returned null');

        const page = await context.newPage();
        if (!page) throw new Error('[Facebook Publish] Page creation returned null');

        // Do NOT call injectChromeRuntimeStub or injectBrowserApiStubs — they hurt
        // Camoufox's fingerprint score (firefoxResist detection, emoji DomRect mismatch).
        try {
            await page.route('**/analytics/**', route => route.abort());
            await page.route('**/tracking/**', route => route.abort());
        } catch {}

        // Step 1: Login
        logger.info('[Facebook Publish] Logging in', { email });
        await page.goto(`${FACEBOOK_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(2000, 3000));

        // Check for CAPTCHA before even attempting to fill login form
        const captcha = await page.$('iframe[src*="captcha"], [id*="captcha"], [class*="captcha"]');
        if (captcha) {
            throw new Error('Facebook CAPTCHA detected before login — automated publishing blocked. Try again later or use a different account.');
        }

        const emailSelector = '#email, input[name="email"], input[type="email"]';
        await page.waitForSelector(emailSelector, { timeout: 15000 });
        await humanType(page, emailSelector, email);
        await page.waitForTimeout(randomDelay(500, 1000));

        await humanType(page, '#pass, input[name="pass"], input[type="password"]', password);
        await page.waitForTimeout(randomDelay(500, 1000));

        await page.click('[name="login"], button[type="submit"], #loginbutton');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(randomDelay(3000, 4000));

        const afterLogin = page.url();

        // Detect security checks / checkpoints
        if (afterLogin.includes('/checkpoint') || afterLogin.includes('/two_step_verification') || afterLogin.includes('/login/two-factor')) {
            throw new Error('Facebook security check detected after login (2FA or checkpoint). Complete the verification manually, then retry.');
        }
        if (afterLogin.includes('/login')) {
            throw new Error('Facebook login failed — check FACEBOOK_EMAIL / FACEBOOK_PASSWORD in .env');
        }

        logger.info('[Facebook Publish] Login successful');

        // Step 2: Navigate to Marketplace item creation
        logger.info('[Facebook Publish] Navigating to Marketplace create page');
        await page.goto(`${FACEBOOK_URL}/marketplace/create/item`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(2500, 4000));

        const captchaOnCreate = await page.$('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]');
        if (captchaOnCreate) {
            throw new Error('Facebook CAPTCHA detected on Marketplace create page — automated publishing blocked. Try again later.');
        }

        // Step 3: Upload photos (Facebook Marketplace expects photos before text fields)
        const photoInput = await page.$('input[type="file"][accept*="image"], input[type="file"]');
        if (photoInput) {
            const { files, tempFiles: tf } = await resolveImageFiles(inventory.images, 10);
            tempFiles = tf;
            if (files.length > 0) {
                await photoInput.setInputFiles(files);
                await page.waitForTimeout(randomDelay(2000, 3500));
                logger.info('[Facebook Publish] Uploaded images', { count: files.length });
                await mouseWiggle(page);
            }
        } else {
            logger.warn('[Facebook Publish] Photo upload input not found, skipping');
        }

        // Step 4: Title
        const titleSelector = [
            'input[placeholder*="item title" i]',
            'input[placeholder*="title" i]',
            'input[aria-label*="title" i]',
            'input[id*="title"]'
        ].join(', ');
        await page.waitForSelector(titleSelector, { timeout: 20000 });
        await humanType(page, titleSelector, title);
        await page.waitForTimeout(randomDelay(500, 1000));
        await mouseWiggle(page);

        // Step 4: Price
        const priceSelector = [
            'input[placeholder*="price" i]',
            'input[aria-label*="price" i]',
            'input[id*="price"]'
        ].join(', ');
        const priceEl = await page.$(priceSelector);
        if (priceEl) {
            await humanType(page, priceSelector, Math.floor(price).toString());
            await page.waitForTimeout(randomDelay(500, 1000));
            await mouseWiggle(page);
        } else {
            logger.warn('[Facebook Publish] Price field not found, skipping');
        }

        // Step 5: Category
        const categoryTrigger = await page.$(
            '[aria-label*="category" i], [placeholder*="category" i], button:has-text("Category")'
        );
        if (categoryTrigger) {
            await humanClick(page, categoryTrigger);
            await page.waitForTimeout(randomDelay(800, 1500));
            const categoryOption = await page.$(`[role="option"]:has-text("${category}"), li:has-text("${category}")`);
            if (categoryOption) {
                await categoryOption.click();
                await page.waitForTimeout(randomDelay(400, 800));
            } else {
                logger.warn('[Facebook Publish] Category option not found', { category });
                await page.keyboard.press('Escape');
            }
            await mouseWiggle(page);
        }

        // Step 6: Condition
        const conditionTrigger = await page.$(
            '[aria-label*="condition" i], [placeholder*="condition" i], button:has-text("Condition")'
        );
        if (conditionTrigger) {
            await humanClick(page, conditionTrigger);
            await page.waitForTimeout(randomDelay(600, 1200));
            const conditionOption = await page.$(`[role="option"]:has-text("${condition}"), li:has-text("${condition}")`);
            if (conditionOption) {
                await conditionOption.click();
                await page.waitForTimeout(randomDelay(400, 800));
            } else {
                logger.warn('[Facebook Publish] Condition option not found', { condition });
                await page.keyboard.press('Escape');
            }
            await mouseWiggle(page);
        }

        // Step 7: Description
        const descSelector = [
            'textarea[placeholder*="description" i]',
            'textarea[aria-label*="description" i]',
            '[contenteditable="true"][aria-label*="description" i]'
        ].join(', ');
        const descEl = await page.$(descSelector);
        if (descEl) {
            const tagName = await descEl.evaluate(el => el.tagName.toLowerCase());
            if (tagName === 'textarea') {
                await humanType(page, descSelector, description);
            } else {
                await descEl.click();
                await descEl.type(description, { delay: randomDelay(30, 80) });
            }
            await page.waitForTimeout(randomDelay(500, 1000));
            await mouseWiggle(page);
        } else {
            logger.warn('[Facebook Publish] Description field not found, skipping');
        }

        // Step 8: Next / Publish button
        logger.info('[Facebook Publish] Submitting listing');
        const nextBtn = await page.$(
            'button:has-text("Next"), button:has-text("Publish"), button[type="submit"]'
        );
        if (!nextBtn) throw new Error('Could not find Next/Publish button on Facebook Marketplace create page');

        await humanClick(page, nextBtn);
        await page.waitForTimeout(randomDelay(3000, 5000));

        // May require a second "Publish" click after a preview step
        const publishBtn = await page.$('button:has-text("Publish"), button:has-text("List"), button[type="submit"]');
        if (publishBtn) {
            await humanClick(page, publishBtn);
            await page.waitForTimeout(randomDelay(3000, 5000));
            const captchaAfterPublish = await page.$('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]');
            if (captchaAfterPublish) {
                throw new Error('Facebook CAPTCHA detected after Publish click — listing may not have been created. Please check manually.');
            }
        }

        // Step 9: Capture URL
        const finalUrl = page.url();
        logger.info('[Facebook Publish] Post-submit URL', { url: finalUrl });

        // Extract listing ID from URL: /marketplace/item/[id]/
        const urlMatch = finalUrl.match(/\/marketplace\/item\/(\d+)/)
                      || finalUrl.match(/\/item\/(\d+)/);
        const listingId = urlMatch ? urlMatch[1] : `fb-${Date.now()}`;
        const listingUrl = urlMatch ? `${FACEBOOK_URL}/marketplace/item/${listingId}/` : finalUrl;

        logger.info('[Facebook Publish] Success', { listingId, listingUrl });
        auditLog('facebook', 'publish_success', { listingId, listingUrl });
        saveProfileUsage(profile.id);
        return { listingId, listingUrl };

    } catch (err) {
        auditLog('facebook', 'publish_failure', { listingId: listing.id, error: err.message });
        if (err.message && (err.message.includes('CAPTCHA') || err.message.includes('captcha'))) {
            flagProfile(profile.id);
        }
        throw err;
    } finally {
        cleanupTempImages(tempFiles);
        if (browser) {
            try { await browser.close(); } catch (closeErr) { logger.warn('[Facebook Publish] Browser close failed:', closeErr.message); }
        }
    }
}

export default { publishListingToFacebook };
