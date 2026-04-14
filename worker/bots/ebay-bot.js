// eBay Automation Bot using Playwright
// Handles listing creation and inventory sync via Seller Hub

import { stealthChromium as chromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from './stealth.js';
import fs from 'fs';
import path from 'path';
import { logger } from '../../src/backend/shared/logger.js';
import { RATE_LIMITS, jitteredDelay } from './rate-limits.js';
import { retryAction } from './retry.js';

const EBAY_URL = 'https://www.ebay.com';
const EBAY_SIGNIN_URL = 'https://signin.ebay.com/signin';
const EBAY_SELLER_HUB_URL = 'https://www.ebay.com/sh/ovw';
const EBAY_LIST_URL = 'https://www.ebay.com/sl/add';

const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');
const COOKIE_FILE = path.join(process.cwd(), 'data', 'ebay-cookies.json');
const SCREENSHOT_DIR = path.join(process.cwd(), 'data', 'bot-screenshots');

function randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function captureFailureScreenshot(page, actionName) {
    try {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}-ebay-${actionName.replace(/[^a-z0-9_-]/gi, '_')}.png`;
        const filePath = path.join(SCREENSHOT_DIR, filename);
        await page.screenshot({ path: filePath, fullPage: false });
        logger.info(`[EbayBot] Failure screenshot saved: ${filePath}`);
        return filePath;
    } catch (screenshotErr) {
        logger.warn('[EbayBot] Failed to capture failure screenshot', { error: screenshotErr.message });
        return null;
    }
}

function writeAuditLog(event, metadata = {}) {
    try {
        const entry = JSON.stringify({ ts: new Date().toISOString(), platform: 'ebay', event, ...metadata });
        fs.appendFileSync(AUDIT_LOG, entry + '\n');
    } catch (e) {
        logger.error('[EbayBot] Failed to write audit log', e);
    }
}

async function humanType(page, selector, text) {
    await page.click(selector);
    for (const char of text) {
        await page.keyboard.type(char);
        await page.waitForTimeout(randomDelay(50, 150));
    }
}

async function detectCaptcha(page) {
    const hasCaptchaFrame = await page.$('iframe[src*="captcha"]');
    const hasRecaptcha = await page.$('div.g-recaptcha');
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const hasHumanCheck = bodyText.includes("Let's make sure you're human");
    return !!(hasCaptchaFrame || hasRecaptcha || hasHumanCheck);
}

/**
 * EbayBot class for automation
 */
export class EbayBot {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.options = {
            headless: true,
            slowMo: 50,
            ...options
        };
        this.stats = {
            listings: 0,
            errors: 0
        };
        this.sessionStartTime = Date.now();
        this.lastActionTime = {
            listing: 0,
            search: 0
        };
    }

    async enforceRateLimit(actionType, minDelay) {
        const now = Date.now();
        const elapsed = now - (this.lastActionTime[actionType] || 0);
        if (elapsed < minDelay) {
            const waitTime = minDelay - elapsed;
            logger.info(`[EbayBot] Rate limit: waiting ${waitTime}ms before next ${actionType}`);
            await this.page.waitForTimeout(waitTime);
        }
        this.lastActionTime[actionType] = Date.now();
    }

    async init() {
        logger.info('[EbayBot] Initializing browser...');
        try {
            this.browser = await chromium.launch({
                headless: this.options.headless,
                slowMo: this.options.slowMo,
                args: STEALTH_ARGS,
                ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
            });

            const context = await this.browser.newContext({
                userAgent: randomChromeUA(),
                viewport: randomViewport(),
                locale: 'en-US',
                timezoneId: 'America/New_York',
            });

            this.page = await context.newPage();

            await this.page.route('**/analytics/**', route => route.abort());
            await this.page.route('**/tracking/**', route => route.abort());

            logger.info('[EbayBot] Browser initialized');
        } catch (error) {
            if (this.browser) {
                await this.browser.close().catch(() => {});
                this.browser = null;
            }
            throw error;
        }
    }

    /**
     * Login to eBay.
     * Strategy:
     *   1. If data/ebay-cookies.json exists, load cookies and verify session — skip form login.
     *   2. Otherwise fall back to form login with credentials from .env.
     *   3. After successful form login, save cookies for next run.
     */
    async login() {
        const username = process.env.EBAY_USERNAME;
        const password = process.env.EBAY_PASSWORD;

        logger.info('[EbayBot] Logging in...');

        // --- Strategy 1: cookie-based login ---
        if (fs.existsSync(COOKIE_FILE)) {
            try {
                const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
                await this.page.context().addCookies(cookies);
                await this.page.goto(`${EBAY_URL}/mys/home`, { waitUntil: 'domcontentloaded' });
                await mouseWiggle(this.page);
                // TODO: verify selector — eBay's "My eBay" nav link or account avatar
                const isLoggedIn = await this.page.$('#gh-ug, .gh-ug, [class*="account-menu"], #myebay-link');
                if (isLoggedIn) {
                    this.isLoggedIn = true;
                    logger.info('[EbayBot] Cookie login successful');
                    writeAuditLog('login', { username, method: 'cookie', success: true });
                    return true;
                }
                logger.info('[EbayBot] Cookies expired — falling back to form login');
                fs.unlinkSync(COOKIE_FILE);
            } catch (e) {
                logger.info('[EbayBot] Cookie load failed — falling back to form login', { error: e.message });
            }
        }

        // --- Strategy 2: form login ---
        if (!username || !password) {
            throw new Error('[EbayBot] EBAY_USERNAME and EBAY_PASSWORD must be set in .env');
        }

        try {
            await this.page.goto(EBAY_SIGNIN_URL, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.ebay.login));

            if (await detectCaptcha(this.page)) {
                const screenshotPath = await captureFailureScreenshot(this.page, 'login-captcha');
                writeAuditLog('captcha_detected', { action: 'login', screenshotPath });
                throw new Error('[EbayBot] CAPTCHA detected on login page — stopping');
            }

            await this.page.waitForSelector('#userid', { timeout: 10000 });
            await humanType(this.page, '#userid', username);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            // TODO: verify selector — eBay "Continue" button after entering username
            await humanClick(this.page, '#signin-continue-btn');
            await this.page.waitForTimeout(randomDelay(1000, 2000));

            if (await detectCaptcha(this.page)) {
                const screenshotPath = await captureFailureScreenshot(this.page, 'login-captcha-after-user');
                writeAuditLog('captcha_detected', { action: 'login_after_username', screenshotPath });
                throw new Error('[EbayBot] CAPTCHA detected after entering username — stopping');
            }

            await this.page.waitForSelector('#pass', { timeout: 10000 });
            await humanType(this.page, '#pass', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanClick(this.page, '#sgnBt');

            await this.page.waitForFunction(
                () => !window.location.href.includes('signin.ebay.com'),
                { timeout: 15000 }
            );

            if (await detectCaptcha(this.page)) {
                const screenshotPath = await captureFailureScreenshot(this.page, 'login-captcha-post-submit');
                writeAuditLog('captcha_detected', { action: 'login_post_submit', screenshotPath });
                throw new Error('[EbayBot] CAPTCHA detected after login submit — stopping');
            }

            // TODO: verify selector — logged-in indicator in eBay global header
            const isLoggedIn = await this.page.$('#gh-ug, .gh-ug, #myebay-link, [class*="account-menu"]');
            this.isLoggedIn = !!isLoggedIn;

            if (this.isLoggedIn) {
                logger.info('[EbayBot] Form login successful');
                const cookies = await this.page.context().cookies();
                fs.mkdirSync(path.dirname(COOKIE_FILE), { recursive: true });
                fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
                logger.info('[EbayBot] Session cookies saved');
                writeAuditLog('login', { username, method: 'form', success: true });
            } else {
                throw new Error('Login failed - could not verify login status');
            }

            return this.isLoggedIn;
        } catch (error) {
            await this._screenshotOnFailure('login');
            logger.error('[EbayBot] Login error', error);
            writeAuditLog('login', { username, method: 'form', success: false, error: error.message });
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Create a new eBay listing via Quick List (/sl/add).
     * @param {Object} itemData - Listing data from inventory
     * @param {string} itemData.title - Listing title (max 80 chars)
     * @param {string} itemData.description - Item description
     * @param {string} itemData.price - Buy It Now price (e.g. "29.99")
     * @param {string} itemData.condition - Item condition code (e.g. "1000" = New)
     * @param {string} [itemData.category] - eBay category name or ID hint (optional)
     * @param {string} [itemData.quantity] - Quantity available (default "1")
     */
    async createListing(itemData) {
        logger.info('[EbayBot] Creating listing', { title: itemData.title });

        try {
            return await retryAction(async () => {
                await this.page.goto(EBAY_LIST_URL, { waitUntil: 'domcontentloaded' });
                await mouseWiggle(this.page);
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.ebay.pageLoad));

                if (await detectCaptcha(this.page)) {
                    const screenshotPath = await captureFailureScreenshot(this.page, 'create-listing-captcha');
                    writeAuditLog('captcha_detected', { action: 'create_listing', screenshotPath });
                    throw new Error('[EbayBot] CAPTCHA detected on listing page — stopping');
                }

                // TODO: verify selector — Quick List title input field
                await this.page.waitForSelector('#title', { timeout: 15000 });
                await humanType(this.page, '#title', itemData.title.slice(0, 80));
                await this.page.waitForTimeout(randomDelay(500, 1000));

                // TODO: verify selector — eBay category search/autocomplete input
                if (itemData.category) {
                    const catInput = await this.page.$('#categoryInput, input[placeholder*="category"], input[name*="category"]');
                    if (catInput) {
                        await humanType(this.page, catInput, itemData.category);
                        await this.page.waitForTimeout(randomDelay(1000, 2000));
                        // TODO: verify selector — first category suggestion in dropdown
                        const firstSuggestion = await this.page.$('.category-suggestion:first-child, [role="option"]:first-child');
                        if (firstSuggestion) {
                            await humanClick(this.page, firstSuggestion);
                        }
                    }
                }

                await this.enforceRateLimit('listing', jitteredDelay(RATE_LIMITS.ebay.betweenActions));

                // TODO: verify selector — condition dropdown (value varies: 1000=New, 3000=Used)
                const conditionSelect = await this.page.$('#conditionId, select[name*="condition"]');
                if (conditionSelect && itemData.condition) {
                    await this.page.selectOption('#conditionId, select[name*="condition"]', itemData.condition);
                    await this.page.waitForTimeout(randomDelay(300, 700));
                }

                // TODO: verify selector — Buy It Now price input
                const priceInput = await this.page.$('#binPrice, input[name*="buyItNow"], input[placeholder*="price"]');
                if (priceInput) {
                    await humanType(this.page, priceInput, itemData.price);
                    await this.page.waitForTimeout(randomDelay(300, 700));
                }

                // TODO: verify selector — quantity input
                const qty = itemData.quantity || '1';
                const qtyInput = await this.page.$('#qtyAvailable, input[name*="quantity"]');
                if (qtyInput) {
                    await qtyInput.fill(qty);
                    await this.page.waitForTimeout(randomDelay(200, 500));
                }

                // TODO: verify selector — description iframe or textarea (eBay uses RTE iframe)
                const descFrame = this.page.frameLocator('iframe[title*="description"], iframe#desc_iframe');
                const descBody = descFrame.locator('body');
                try {
                    await descBody.fill(itemData.description, { timeout: 5000 });
                } catch {
                    // Fallback: plain textarea if RTE not loaded
                    const descTextarea = await this.page.$('textarea[name*="description"], #description');
                    if (descTextarea) {
                        await humanType(this.page, descTextarea, itemData.description);
                    }
                }

                await this.enforceRateLimit('listing', jitteredDelay(RATE_LIMITS.ebay.betweenActions));

                // TODO: verify selector — "List it" or "Save" submit button in Quick List
                const submitBtn = await this.page.$('#submitBtn, button[data-test*="submit"], button[type="submit"]');
                if (!submitBtn) {
                    throw new Error('Could not find listing submit button');
                }

                await humanClick(this.page, submitBtn);
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.ebay.listingCreate));

                // TODO: verify selector — success confirmation element after listing created
                const confirmEl = await this.page.$('.confirmation, [class*="success"]');
                // Fallback: check if redirected to an eBay item URL (listing created)
                const currentUrl = this.page.url();
                const urlSuccess = currentUrl.includes('/itm/') || currentUrl.includes('ViewItem');
                const success = !!(confirmEl || urlSuccess);

                if (success) {
                    this.stats.listings++;
                    writeAuditLog('create_listing', { title: itemData.title, success: true });
                    logger.info('[EbayBot] Listing created successfully', { title: itemData.title });
                } else {
                    writeAuditLog('create_listing', { title: itemData.title, success: false, note: 'no confirmation element found' });
                    logger.warn('[EbayBot] Listing submitted but confirmation not detected', { title: itemData.title });
                }

                return success;
            }, { platform: 'ebay', action: 'listing' });
        } catch (error) {
            await this._screenshotOnFailure('create_listing');
            logger.error('[EbayBot] Create listing error', error);
            writeAuditLog('create_listing', { title: itemData?.title, success: false, error: error.message });
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Scrape basic stats from eBay Seller Hub overview.
     * @returns {Object} Stats object with active listings, sold items, and total views
     */
    async getSellerHubStats() {
        logger.info('[EbayBot] Fetching Seller Hub stats');

        try {
            await this.page.goto(EBAY_SELLER_HUB_URL, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.ebay.pageLoad));

            if (await detectCaptcha(this.page)) {
                const screenshotPath = await captureFailureScreenshot(this.page, 'seller-hub-captcha');
                writeAuditLog('captcha_detected', { action: 'get_seller_hub_stats', screenshotPath });
                throw new Error('[EbayBot] CAPTCHA detected on Seller Hub — stopping');
            }

            // TODO: verify selectors — Seller Hub overview panel metric cards
            const stats = await this.page.evaluate(() => {
                function getText(selector) {
                    const el = document.querySelector(selector);
                    return el ? el.textContent.trim() : null;
                }
                return {
                    // TODO: verify these selectors against live Seller Hub DOM
                    activeListings: getText('.active-listings-count, [data-metric="active-listings"] .value'),
                    soldItems:      getText('.sold-count, [data-metric="sold-items"] .value'),
                    totalViews:     getText('.views-count, [data-metric="total-views"] .value'),
                    awaiting:       getText('.awaiting-shipment-count, [data-metric="awaiting-shipment"] .value'),
                };
            });

            writeAuditLog('get_seller_hub_stats', { stats });
            logger.info('[EbayBot] Seller Hub stats fetched', stats);
            return stats;
        } catch (error) {
            await this._screenshotOnFailure('get_seller_hub_stats');
            logger.error('[EbayBot] Seller Hub stats error', error);
            writeAuditLog('get_seller_hub_stats', { success: false, error: error.message });
            this.stats.errors++;
            throw error;
        }
    }

    async _screenshotOnFailure(action) {
        if (!this.page) return;
        try {
            fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotPath = path.join(SCREENSHOT_DIR, `${ts}-ebay-${action}.png`);
            await this.page.screenshot({ path: screenshotPath });
            logger.warn('[EbayBot] Failure screenshot saved', { path: screenshotPath, action });
            writeAuditLog('failure_screenshot', { action, path: screenshotPath });
            const pageTitle = await this.page.title().catch(() => 'unknown');
            const pageUrl = this.page.url();
            logger.warn('[EbayBot] Failure context', { action, url: pageUrl, title: pageTitle });
            writeAuditLog('failure_context', { action, url: pageUrl, title: pageTitle });
        } catch (e) {
            logger.warn('[EbayBot] Could not capture failure screenshot', { error: e.message, action });
        }
    }

    async close() {
        logger.info('[EbayBot] Closing browser...');
        if (this.browser) {
            try {
                await Promise.race([
                    this.browser.close(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('browser.close() timed out')), 5000))
                ]);
            } catch (e) {
                logger.warn('[EbayBot] Browser close error', { error: e.message });
            } finally {
                this.browser = null;
                this.page = null;
            }
        }
        logger.info('[EbayBot] Browser closed');
    }
}

/**
 * Main entry point for the eBay bot.
 * @param {Object} [credentials] - Optional override; falls back to EBAY_USERNAME/EBAY_PASSWORD env vars
 * @param {string} [task='list'] - 'list' | 'stats'
 * @param {Object} [itemData] - Required when task === 'list'
 */
export async function runEbayBot(task = 'list', itemData = null) {
    const username = process.env.EBAY_USERNAME;
    const password = process.env.EBAY_PASSWORD;

    if (!username || !password) {
        throw new Error('[EbayBot] EBAY_USERNAME and EBAY_PASSWORD must be set in .env');
    }

    const bot = new EbayBot();
    writeAuditLog('bot_start', { task });

    try {
        await bot.init();
        await bot.login();

        let result;
        if (task === 'list') {
            if (!itemData) throw new Error('[EbayBot] itemData is required for task "list"');
            result = await bot.createListing(itemData);
        } else if (task === 'stats') {
            result = await bot.getSellerHubStats();
        } else {
            throw new Error(`[EbayBot] Unknown task: "${task}"`);
        }

        writeAuditLog('bot_complete', { task, stats: bot.stats });
        return result;
    } catch (error) {
        writeAuditLog('bot_error', { task, error: error.message, stats: bot.stats });
        logger.error('[EbayBot] Bot run failed', error);
        throw error;
    } finally {
        await bot.close();
    }
}

let botInstance = null;

export async function getEbayBot(options = {}) {
    if (!botInstance) {
        botInstance = new EbayBot(options);
        await botInstance.init();
    }
    return botInstance;
}

export async function closeEbayBot() {
    if (botInstance) {
        await botInstance.close();
        botInstance = null;
    }
}
