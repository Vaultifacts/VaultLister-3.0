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
import { scanListingContent } from './contentSafetyScanner.js';
import { scanImages, recordImageHash } from './imageHasher.js';

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

    // Pre-flight content safety scan (Layer 8)
    const scanResult = scanListingContent({ title, description, price, platform: 'facebook' });
    if (scanResult.status === 'BLOCK') {
        auditLog('facebook', 'publish_blocked_by_scanner', { listingId: listing.id, issues: scanResult.issues });
        throw new Error(`Content safety scanner BLOCKED this listing: ${scanResult.issues.join('; ')}`);
    }
    if (scanResult.status === 'WARN') {
        logger.warn('[Facebook Publish] Content safety warnings:', scanResult.issues);
        auditLog('facebook', 'publish_warned_by_scanner', { listingId: listing.id, issues: scanResult.issues });
    }

    logger.info('[Facebook Publish] Launching browser');

    const { launchCamoufox, humanClick, mouseWiggle } = await getStealth();
    const { initProfiles, getNextProfile, saveProfileUsage, flagProfile, getProfileDir, getProfileProxy } = await getProfiles();

    initProfiles();
    const profile = getNextProfile();

    // Per-profile proxy — each profile gets its own proxy to prevent IP correlation
    const proxyUrl = getProfileProxy(profile.id);
    const proxy = proxyUrl ? { server: proxyUrl } : undefined;

    let browser;
    let page;
    try {
        const launched = await launchCamoufox({
            profileDir: getProfileDir(profile.id),
            proxy,
            headless: true,
        });
        browser = launched.browser;
        page = launched.page;
    } catch (launchErr) {
        throw new Error(`[Facebook Publish] Browser launch failed: ${launchErr.message}`);
    }
    if (!browser) {
        throw new Error('[Facebook Publish] Browser launch returned null — camoufox-js may not be installed');
    }

    let tempFiles = [];

    try {

        // Do NOT call injectChromeRuntimeStub or injectBrowserApiStubs — they hurt
        // Camoufox's fingerprint score (firefoxResist detection, emoji DomRect mismatch).
        // page.route() removed — Camoufox ships with uBlock Origin which handles
        // analytics/tracking blocking. page.route() is a confirmed detection vector
        // (Camoufox Issues #271, #428) because Facebook detects dropped telemetry requests.

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
        if (
            afterLogin.includes('/checkpoint') ||
            afterLogin.includes('/two_step_verification') ||
            afterLogin.includes('/login/two-factor') ||
            afterLogin.includes('/marketplace/verify') ||
            afterLogin.includes('/seller-verification') ||
            afterLogin.includes('/identity')
        ) {
            throw new Error('Facebook security check detected after login (2FA, checkpoint, or seller verification). Complete the verification manually, then retry.');
        }
        if (afterLogin.includes('/login')) {
            throw new Error('Facebook login failed — check FACEBOOK_EMAIL / FACEBOOK_PASSWORD in .env');
        }

        logger.info('[Facebook Publish] Login successful');

        // Step 2: Session warmup — browse before creating listing
        // Per spec Layer 5: never navigate directly to listing creation form.
        logger.info('[Facebook Publish] Starting warmup browse...');
        await page.goto(FACEBOOK_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(3000, 5000));
        await mouseWiggle(page);

        // Scroll through a few feed items
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 400));
            await page.waitForTimeout(randomDelay(2000, 4000));
        }
        await mouseWiggle(page);

        // Navigate to Marketplace via sidebar link, fall back to direct URL
        const mpLink = await page.$('a[href*="/marketplace"][role="link"], a[href*="/marketplace"]');
        if (mpLink) {
            await humanClick(page, mpLink);
        } else {
            await page.goto(`${FACEBOOK_URL}/marketplace`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
        await page.waitForTimeout(randomDelay(3000, 5000));
        await mouseWiggle(page);

        // Browse 1-2 existing listings before creating
        const existingListings = await page.$$('a[href*="/marketplace/item/"]');
        const toVisit = existingListings.slice(0, Math.min(2, existingListings.length));
        for (const el of toVisit) {
            try {
                await humanClick(page, el);
                await page.waitForTimeout(randomDelay(4000, 8000));
                await mouseWiggle(page);
                await page.goBack({ waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(randomDelay(2000, 3000));
            } catch {}
        }
        logger.info('[Facebook Publish] Warmup complete');

        // Step 3: Navigate to Marketplace item creation
        logger.info('[Facebook Publish] Navigating to Marketplace create page');
        await page.goto(`${FACEBOOK_URL}/marketplace/create/item`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(2500, 4000));

        const captchaOnCreate = await page.$('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]');
        if (captchaOnCreate) {
            throw new Error('Facebook CAPTCHA detected on Marketplace create page — automated publishing blocked. Try again later.');
        }

        // Guard: Meta AI sometimes pre-populates the title field — clear it if present.
        // Also skip any "Create listing details" AI button — fill fields manually.
        const aiButton = await page.$('button:has-text("Create listing details"), [aria-label*="AI" i]:has-text("Create")');
        if (aiButton) {
            logger.info('[Facebook Publish] AI listing button detected — skipping, proceeding with manual fill');
        }
        const titleFieldEarly = await page.$('input[placeholder*="title" i], input[aria-label*="title" i]');
        if (titleFieldEarly) {
            const existingTitle = await titleFieldEarly.inputValue().catch(() => '');
            if (existingTitle.length > 0) {
                logger.info('[Facebook Publish] Detected AI pre-populated title field, clearing');
                await page.click('input[placeholder*="title" i], input[aria-label*="title" i]', { clickCount: 3 });
                await page.keyboard.press('Backspace');
            }
        }

        // Step 3: Upload photos (Facebook Marketplace expects photos before text fields)
        const photoInput = await page.$('input[type="file"][accept*="image"], input[type="file"]');
        if (photoInput) {
            const { files, tempFiles: tf } = await resolveImageFiles(inventory.images, 10);
            tempFiles = tf;
            if (files.length > 0) {
                // Pre-flight image duplicate scan
                const imgScan = scanImages(files, profile.id);
                if (imgScan.status === 'BLOCK') {
                    throw new Error(`Image safety scanner BLOCKED: ${imgScan.issues.join('; ')}`);
                }
                if (imgScan.issues.length > 0) {
                    logger.warn('[Facebook Publish] Image scan warnings:', imgScan.issues);
                }
                await photoInput.setInputFiles(files);
                await page.waitForTimeout(randomDelay(2000, 3500));
                logger.info('[Facebook Publish] Uploaded images', { count: files.length });
                // Review uploaded thumbnails — per spec Layer 5: cursor moves over
                // uploaded thumbnails as if reviewing them (1-3s per photo)
                const thumbnails = await page.$$('[data-testid*="photo"] img, [aria-label*="photo"] img, .photo-upload img');
                for (const thumb of thumbnails.slice(0, 3)) {
                    try {
                        await thumb.hover();
                        await page.waitForTimeout(randomDelay(1000, 3000));
                    } catch {}
                }
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

        // Step 8: Pre-submit review scroll + Next / Publish button
        // Per spec Layer 5: scroll to bottom of form to "review" before submitting
        logger.info('[Facebook Publish] Reviewing form before submit');
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
        await page.waitForTimeout(randomDelay(2000, 5000));
        await mouseWiggle(page);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await page.waitForTimeout(randomDelay(1000, 2000));

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
        // Record image hashes after successful publish for future duplicate detection
        for (const f of tempFiles) {
            try { recordImageHash(f, { accountId: profile.id, platform: 'facebook', listingId }); } catch {}
        }

        // Post-listing verification: stay on confirmation, then browse selling page
        // Per spec Layer 5: "navigate to selling page to verify listing appeared"
        try {
            await page.waitForTimeout(randomDelay(8000, 15000));
            await mouseWiggle(page);
            await page.goto(`${FACEBOOK_URL}/marketplace/you/selling`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(randomDelay(5000, 10000));
            await mouseWiggle(page);
        } catch {}

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
