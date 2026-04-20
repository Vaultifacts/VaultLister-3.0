// Poshmark Automation Bot using Playwright
// Handles sharing, following, and offer management

import { stealthChromium as chromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, stealthContextOptions } from './stealth.js';
import fs from 'fs';
import path from 'path';
import { logger } from '../../src/backend/shared/logger.js';
import { RATE_LIMITS, jitteredDelay } from './rate-limits.js';
import { retryAction } from './retry.js';
import { closeBrowserWithTimeout, captureErrorScreenshot, purgeOldErrorScreenshots } from './bot-utils.js';
import { preBotSafetyCheck, releasePlatformLock, enhancedHumanType } from './bot-safety.js';
import { getProfileBehavior } from './browser-profiles.js';
import {
    recordDetectionEvent as arcRecordDetectionEvent,
    isCoolingDown as arcIsCoolingDown,
    writeAuditLog as arcWriteAuditLog,
    checkQuarantine
} from './adaptive-rate-control.js';
import { SIGNAL_TYPES } from './signal-contracts.js';

const PLATFORM = 'poshmark';

// Regional domain map — set POSHMARK_COUNTRY in .env (us, ca, au, in)
const POSHMARK_DOMAINS = { us: 'https://poshmark.com', ca: 'https://poshmark.ca', au: 'https://poshmark.com.au', in: 'https://poshmark.in' };
const POSHMARK_URL = POSHMARK_DOMAINS[process.env.POSHMARK_COUNTRY?.toLowerCase()] || POSHMARK_DOMAINS.us;

const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');
const COOKIE_FILE = path.join(process.cwd(), 'data', 'poshmark-cookies.json');
const SCREENSHOT_DIR = path.join(process.cwd(), 'data', 'bot-screenshots');

// Random delay for human-like typing and short navigation pauses only
// Inter-action delays use jitteredDelay(RATE_LIMITS.poshmark.*) instead
function randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


function writeAuditLog(event, metadata = {}) {
    try {
        const entry = JSON.stringify({ ts: new Date().toISOString(), platform: 'poshmark', event, ...metadata });
        fs.appendFileSync(AUDIT_LOG, entry + '\n');
    } catch (e) {
        logger.error('[PoshmarkBot] Failed to write audit log', e);
    }
}

// Human-like typing
let _activeBehavior = null; // Set by PoshmarkBot.init(), read by humanType

async function humanType(page, selector, text) {
    // Delegate to shared enhanced typing with per-profile behavioral params
    await enhancedHumanType(page, selector, text, _activeBehavior);
}

/**
 * PoshmarkBot class for automation
 */
export class PoshmarkBot {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this._behavior = getProfileBehavior('profile-1'); // Load per-profile behavioral params
        this.options = {
            headless: true,
            slowMo: 50,
            ...options
        };
        this.stats = {
            shares: 0,
            follows: 0,
            offers: 0,
            errors: 0
        };
        // Session-level rate limit tracking — persists across all actions in a single bot session
        this.sessionStartTime = Date.now();
        this.lastActionTime = {
            share: 0,
            follow: 0,
            offer: 0
        };
    }

    /**
     * Enforce rate limit for an action type within the session
     * Checks time elapsed since last action of that type; waits if needed
     * @param {string} actionType - 'share', 'follow', or 'offer'
     * @param {number} minDelay - Minimum milliseconds between actions (from RATE_LIMITS)
     */
    async enforceRateLimit(actionType, minDelay) {
        const now = Date.now();
        const lastTime = this.lastActionTime[actionType] || 0;
        const elapsed = now - lastTime;

        if (elapsed < minDelay) {
            const waitTime = minDelay - elapsed;
            logger.info(`[PoshmarkBot] Rate limit: waiting ${waitTime}ms before next ${actionType}`);
            await this.page.waitForTimeout(waitTime);
        }

        this.lastActionTime[actionType] = Date.now();
    }

    /**
     * Initialize the browser
     */
    async init() {
        logger.info('[PoshmarkBot] Initializing browser...');
        if (checkQuarantine(PLATFORM)) {
            throw new Error(`[${PLATFORM}] account quarantined — manual review required`);
        }
        const coolingStatus = arcIsCoolingDown(PLATFORM);
        if (coolingStatus.cooling) {
            throw new Error(`[${PLATFORM}] in cooldown (${coolingStatus.reason}) — retry after ${coolingStatus.remainingMs || 'review'}ms`);
        }
        const safetyCheck = preBotSafetyCheck('poshmark', { sessionCooldownMs: RATE_LIMITS.poshmark.loginCooldown || 90000 });
        if (!safetyCheck.safe) {
            throw new Error(safetyCheck.reason);
        }
        _activeBehavior = this._behavior;

        try {
            this.browser = await chromium.launch({
                headless: this.options.headless,
                slowMo: this.options.slowMo,
                args: STEALTH_ARGS,
                ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
            });

            const context = await this.browser.newContext(stealthContextOptions('chrome'));

            this.page = await context.newPage();

            // page.route() removed — platforms detect dropped telemetry requests.
            // Let all requests flow unimpeded (per anti-detection spec Layer 4).

            logger.info('[PoshmarkBot] Browser initialized');
        } catch (error) {
            if (this.browser) {
                await this.browser.close().catch(() => {});
                this.browser = null;
            }
            throw error;
        }
    }

    /**
     * Login to Poshmark.
     * Strategy:
     *   1. If data/poshmark-cookies.json exists, load cookies and verify session — skip form login.
     *   2. Otherwise fall back to form login with credentials from .env.
     *   3. After successful form login, save cookies for next run.
     */
    async login() {
        const username = process.env.POSHMARK_USERNAME;
        const password = process.env.POSHMARK_PASSWORD;

        logger.info('[PoshmarkBot] Logging in...');

        // --- Strategy 1: cookie-based login ---
        if (fs.existsSync(COOKIE_FILE)) {
            try {
                const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
                await this.page.context().addCookies(cookies);
                await this.page.goto(`${POSHMARK_URL}/feed`, { waitUntil: 'domcontentloaded' });
                await mouseWiggle(this.page);
                const isLoggedIn = await this.page.$('.user-image, .header__account-info-list, .dropdown__menu--user, [data-et="my_closet"]');
                if (isLoggedIn) {
                    this.isLoggedIn = true;
                    logger.info('[PoshmarkBot] Cookie login successful');
                    writeAuditLog('login', { username, method: 'cookie', success: true });
                    await this.warmup();
                    return true;
                }
                logger.info('[PoshmarkBot] Cookies expired — falling back to form login');
                fs.unlinkSync(COOKIE_FILE);
            } catch (e) {
                logger.info('[PoshmarkBot] Cookie load failed — falling back to form login', { error: e.message });
            }
        }

        // --- Strategy 2: form login ---
        if (!username || !password) {
            throw new Error('[PoshmarkBot] POSHMARK_USERNAME and POSHMARK_PASSWORD must be set in .env');
        }

        try {
            await this.page.goto(`${POSHMARK_URL}/login`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);

            // Wait for login form
            await this.page.waitForSelector('input[name="login_form[username_email]"]', { timeout: 10000 });

            // Enter credentials with natural mouse movement to each field
            await humanClick(this.page, 'input[name="login_form[username_email]"]');
            await humanType(this.page, 'input[name="login_form[username_email]"]', username);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanClick(this.page, 'input[name="login_form[password]"]');
            await humanType(this.page, 'input[name="login_form[password]"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            // Submit form with natural click
            await humanClick(this.page, 'button[type="submit"]');

            // Poshmark is a SPA — wait for URL to leave /login rather than a full navigation event
            await this.page.waitForFunction(
                () => !window.location.pathname.startsWith('/login'),
                { timeout: 15000 }
            );

            const currentUrl = this.page.url();
            const pageText = await this.page.content().catch(() => '');
            if (currentUrl.includes('/checkpoint') || /temporarily locked/i.test(pageText)) {
                arcRecordDetectionEvent(PLATFORM, SIGNAL_TYPES.LOCKOUT, { url: currentUrl });
                throw new Error(`[${PLATFORM}] lockout detected`);
            }
            if (/verify it'?s you/i.test(pageText) || currentUrl.includes('/verify')) {
                arcRecordDetectionEvent(PLATFORM, SIGNAL_TYPES.LOGIN_CHALLENGE, { url: currentUrl });
                throw new Error(`[${PLATFORM}] login challenge detected`);
            }

            // Check if logged in
            const isLoggedIn = await this.page.$('.user-image, .header__account-info-list, .dropdown__menu--user, [data-et="my_closet"]');
            this.isLoggedIn = !!isLoggedIn;

            if (this.isLoggedIn) {
                logger.info('[PoshmarkBot] Form login successful');
                // Save cookies for next run
                const cookies = await this.page.context().cookies();
                fs.mkdirSync(path.dirname(COOKIE_FILE), { recursive: true });
                fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
                logger.info('[PoshmarkBot] Session cookies saved');
                writeAuditLog('login', { username, method: 'form', success: true });
                await this.warmup();
            } else {
                throw new Error('Login failed - could not verify login status');
            }

            return this.isLoggedIn;
        } catch (error) {
            await this._screenshotOnFailure('login');
            logger.error('[PoshmarkBot] Login error', error);
            await captureErrorScreenshot(this.page, 'login');
            writeAuditLog('login', { username, method: 'form', success: false, error: error.message });
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Session warmup — browse feed and closet before automation actions.
     * Per spec Layer 5: makes session look organic, not mechanical.
     */
    async warmup() {
        logger.info('[PoshmarkBot] Starting session warmup...');
        writeAuditLog('warmup_start');
        try {
            await this.page.goto(`${POSHMARK_URL}/feed`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(3000));
            await mouseWiggle(this.page);
            // Scroll through feed items
            for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
                await humanScroll(this.page);
                await this.page.waitForTimeout(randomDelay(2000, 4000));
            }
            // Browse 1-2 listings
            const listings = await this.page.$$('a[href*="/listing/"]');
            for (const el of listings.slice(0, Math.min(2, listings.length))) {
                try {
                    await humanClick(this.page, el);
                    await this.page.waitForTimeout(randomDelay(4000, 8000));
                    await humanScroll(this.page);
                    await mouseWiggle(this.page);
                    await this.page.goBack({ waitUntil: 'domcontentloaded' });
                    await this.page.waitForTimeout(randomDelay(2000, 3000));
                } catch {}
            }
            logger.info('[PoshmarkBot] Warmup complete');
            writeAuditLog('warmup_complete');
        } catch (err) {
            logger.warn('[PoshmarkBot] Warmup error (non-fatal):', err.message);
        }
    }

    /**
     * Share an item
     */
    async shareItem(listingUrl) {
        logger.info('[PoshmarkBot] Sharing item', { listingUrl });

        try {
            return await retryAction(async () => {
                await this.page.goto(listingUrl, { waitUntil: 'domcontentloaded' });
                await mouseWiggle(this.page);
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.poshmark.shareDelay));

                // Find and click share button
                const shareButton = await this.page.$('[data-test="social-action-bar-share"]');
                if (!shareButton) {
                    logger.info('[PoshmarkBot] Share button not found');
                    return false;
                }

                await humanClick(this.page, shareButton);
                await this.page.waitForTimeout(randomDelay(500, 1000));

                // Click "To My Followers" option
                const toFollowersOption = await this.page.$('[data-test="share-to-followers"]');
                if (toFollowersOption) {
                    await humanClick(this.page, toFollowersOption);
                    // Enforce session-level rate limit before next share
                    await this.enforceRateLimit('share', jitteredDelay(RATE_LIMITS.poshmark.shareDelay));
                    this.stats.shares++;
                    writeAuditLog('share_item', { listingUrl });
                    logger.info('[PoshmarkBot] Item shared successfully');
                    return true;
                }

                return false;
            });
        } catch (error) {
            await this._screenshotOnFailure('share_item');
            logger.error('[PoshmarkBot] Share error', error);
            await captureErrorScreenshot(this.page, 'share_item');
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Share entire closet
     */
    async shareCloset(username, options = {}) {
        const { maxShares = 100, delayBetween = RATE_LIMITS.poshmark.shareDelay } = options;

        logger.info(`[PoshmarkBot] Sharing closet for ${username}, max ${maxShares} items`);

        try {
            await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            // Get all listing cards
            const listings = await this.page.$$('[data-test="tile"]');
            logger.info(`[PoshmarkBot] Found ${listings.length} listings`);

            let shared = 0;

            for (const listing of listings.slice(0, maxShares)) {
                try {
                    // Find share button within the listing
                    const shareBtn = await listing.$('[data-test="tile-share"]');
                    if (shareBtn) {
                        await humanClick(this.page, shareBtn);
                        await this.page.waitForTimeout(randomDelay(500, 1000));

                        // Click "To My Followers"
                        const toFollowers = await this.page.$('[data-test="share-to-followers"]');
                        if (toFollowers) {
                            await humanClick(this.page, toFollowers);
                            shared++;
                            this.stats.shares++;
                            writeAuditLog('share_closet_item', { username, shared, maxShares });
                            logger.info(`[PoshmarkBot] Shared item ${shared}/${maxShares}`);
                        }

                        // Occasional idle wiggle between shares (every ~5 items)
                        if (shared % 5 === 0) await mouseWiggle(this.page);
                        // Enforce session-level rate limit for next share
                        await this.enforceRateLimit('share', jitteredDelay(delayBetween));
                    }
                } catch (e) {
                    logger.info('[PoshmarkBot] Error sharing item', { error: e.message });
                }
            }

            writeAuditLog('share_closet_complete', { username, shared, maxShares });
            logger.info(`[PoshmarkBot] Closet share complete. Shared ${shared} items.`);
            return shared;
        } catch (error) {
            await this._screenshotOnFailure('share_closet');
            logger.error('[PoshmarkBot] Closet share error', error);
            await captureErrorScreenshot(this.page, 'share_closet');
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Follow a user
     */
    async followUser(username) {
        logger.info('[PoshmarkBot] Following user', { username });

        try {
            return await retryAction(async () => {
                await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'domcontentloaded' });
                await mouseWiggle(this.page);

                // Find follow button
                const followBtn = await this.page.$('[data-test="follow-button"]:not([data-test-value="following"])');

                if (followBtn) {
                    await humanClick(this.page, followBtn);
                    // Enforce session-level rate limit for next follow
                    await this.enforceRateLimit('follow', jitteredDelay(RATE_LIMITS.poshmark.followDelay));
                    this.stats.follows++;
                    writeAuditLog('follow_user', { username });
                    logger.info('[PoshmarkBot] Followed user successfully');
                    return true;
                }

                logger.info('[PoshmarkBot] Already following or button not found');
                return false;
            });
        } catch (error) {
            await this._screenshotOnFailure('follow_user');
            logger.error('[PoshmarkBot] Follow error', error);
            await captureErrorScreenshot(this.page, 'follow_user');
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Follow back users who followed you
     */
    async followBackFollowers(maxFollows = 50) {
        logger.info(`[PoshmarkBot] Following back followers, max ${maxFollows}`);

        try {
            // Navigate to followers page
            await this.page.goto(`${POSHMARK_URL}/user/followers`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            let followed = 0;

            // Find users not followed back
            const userCards = await this.page.$$('.user-card');

            for (const card of userCards.slice(0, maxFollows)) {
                const followBtn = await card.$('[data-test="follow-button"]:not([data-test-value="following"])');

                if (followBtn) {
                    await humanClick(this.page, followBtn);
                    followed++;
                    this.stats.follows++;
                    writeAuditLog('follow_back', { followed, maxFollows });
                    logger.info(`[PoshmarkBot] Followed back ${followed}/${maxFollows}`);
                    if (followed % 5 === 0) await mouseWiggle(this.page);
                    // Enforce session-level rate limit for next follow
                    await this.enforceRateLimit('follow', jitteredDelay(RATE_LIMITS.poshmark.followDelay));
                }
            }

            writeAuditLog('follow_back_complete', { followed, maxFollows });
            logger.info(`[PoshmarkBot] Follow back complete. Followed ${followed} users.`);
            return followed;
        } catch (error) {
            await this._screenshotOnFailure('follow_back');
            logger.error('[PoshmarkBot] Follow back error', error);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Get pending offers
     */
    async getOffers() {
        logger.info('[PoshmarkBot] Getting offers...');

        try {
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const offers = await this.page.$$eval('[data-test="offer-card"]', cards => {
                return cards.map(card => ({
                    itemTitle: card.querySelector('[data-test="item-title"]')?.textContent?.trim(),
                    offerAmount: card.querySelector('[data-test="offer-amount"]')?.textContent?.trim(),
                    listPrice: card.querySelector('[data-test="list-price"]')?.textContent?.trim(),
                    buyerUsername: card.querySelector('[data-test="buyer-username"]')?.textContent?.trim(),
                    status: 'pending'
                }));
            });

            logger.info(`[PoshmarkBot] Found ${offers.length} offers`);
            return offers;
        } catch (error) {
            logger.error('[PoshmarkBot] Get offers error', error);
            return [];
        }
    }

    /**
     * Accept an offer
     */
    async acceptOffer(offerIndex) {
        logger.info('[PoshmarkBot] Accepting offer', { offerIndex });

        try {
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);

            const offerCards = await this.page.$$('[data-test="offer-card"]');

            if (offerCards[offerIndex]) {
                const acceptBtn = await offerCards[offerIndex].$('[data-test="accept-offer"]');
                if (acceptBtn) {
                    await humanClick(this.page, acceptBtn);
                    await this.page.waitForTimeout(randomDelay(1000, 2000));

                    // Confirm accept
                    const confirmBtn = await this.page.$('[data-test="confirm-accept"]');
                    if (confirmBtn) {
                        await humanClick(this.page, confirmBtn);
                        // Enforce session-level rate limit for next offer action
                        await this.enforceRateLimit('offer', jitteredDelay(RATE_LIMITS.poshmark.offerDelay));
                        this.stats.offers++;
                        writeAuditLog('accept_offer', { offerIndex });
                        logger.info('[PoshmarkBot] Offer accepted');
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            logger.error('[PoshmarkBot] Accept offer error', error);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Counter an offer
     */
    async counterOffer(offerIndex, counterAmount) {
        logger.info('[PoshmarkBot] Countering offer', { offerIndex, counterAmount });

        try {
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);

            const offerCards = await this.page.$$('[data-test="offer-card"]');

            if (offerCards[offerIndex]) {
                const counterBtn = await offerCards[offerIndex].$('[data-test="counter-offer"]');
                if (counterBtn) {
                    await humanClick(this.page, counterBtn);
                    await this.page.waitForTimeout(randomDelay(500, 1000));

                    // Enter counter amount
                    await humanClick(this.page, '[data-test="counter-amount-input"]');
                    await humanType(this.page, '[data-test="counter-amount-input"]', counterAmount.toString());
                    await this.page.waitForTimeout(randomDelay(500, 1000));

                    // Submit counter
                    const submitBtn = await this.page.$('[data-test="submit-counter"]');
                    if (submitBtn) {
                        await humanClick(this.page, submitBtn);
                        // Enforce session-level rate limit for next offer action
                        await this.enforceRateLimit('offer', jitteredDelay(RATE_LIMITS.poshmark.offerDelay));
                        this.stats.offers++;
                        writeAuditLog('counter_offer', { offerIndex, counterAmount });
                        logger.info('[PoshmarkBot] Counter offer sent');
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            logger.error('[PoshmarkBot] Counter offer error', error);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Decline an offer
     */
    async declineOffer(offerIndex) {
        logger.info('[PoshmarkBot] Declining offer', { offerIndex });

        try {
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);

            const offerCards = await this.page.$$('[data-test="offer-card"]');

            if (offerCards[offerIndex]) {
                const declineBtn = await offerCards[offerIndex].$('[data-test="decline-offer"]');
                if (declineBtn) {
                    await humanClick(this.page, declineBtn);
                    await this.page.waitForTimeout(randomDelay(1000, 2000));

                    // Confirm decline
                    const confirmBtn = await this.page.$('[data-test="confirm-decline"]');
                    if (confirmBtn) {
                        await humanClick(this.page, confirmBtn);
                        // Enforce session-level rate limit for next offer action
                        await this.enforceRateLimit('offer', jitteredDelay(RATE_LIMITS.poshmark.offerDelay));
                        writeAuditLog('decline_offer', { offerIndex });
                        logger.info('[PoshmarkBot] Offer declined');
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            logger.error('[PoshmarkBot] Decline offer error', error);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Send Offer to Likers — navigate to a listing and send OTL (Offer to Likers)
     * @param {string} listingUrl - Full URL of the Poshmark listing
     * @param {number} discountPercent - Percentage off list price (e.g. 20 = 20% off)
     * @param {number} shippingDiscount - Shipping discount in dollars (0 = no discount, 4.99 = discounted shipping)
     */
    async sendOfferToLikers(listingUrl, discountPercent = 20, shippingDiscount = 0) {
        logger.info(`[PoshmarkBot] Sending OTL for ${listingUrl} — ${discountPercent}% off`);

        try {
            await this.page.goto(listingUrl, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);

            // Find the "Offer/Price Drop" or "Send Offer to Likers" button
            const otlBtn = await this.page.$(
                'button:has-text("Offer to Likers"), button:has-text("Price Drop"), [data-test="offer-to-likers"], [data-test*="price-drop"]'
            );
            if (!otlBtn) {
                logger.info('[PoshmarkBot] OTL button not found — listing may have no likers');
                return { sent: false, reason: 'no_otl_button' };
            }

            await humanClick(this.page, otlBtn);
            await this.page.waitForTimeout(randomDelay(1500, 2500));

            // Fill in the offer price (Poshmark shows a price input in the OTL modal)
            const priceInput = await this.page.$(
                'input[data-test="offer-price"], input[name="offerPrice"], input[placeholder*="price" i], input[type="number"]'
            );
            if (priceInput) {
                // Read the current list price from the page
                const listPriceText = await this.page.$eval(
                    '[data-test="list-price"], .listing-price, [class*="price"]',
                    el => el.textContent?.replace(/[^0-9.]/g, '') || '0'
                ).catch(() => '0');
                const listPrice = parseFloat(listPriceText);
                if (listPrice > 0) {
                    const offerPrice = Math.floor(listPrice * (1 - discountPercent / 100));
                    await humanType(this.page, priceInput, String(offerPrice));
                    await this.page.waitForTimeout(randomDelay(500, 1000));
                }
            }

            // Check shipping discount checkbox if available and requested
            if (shippingDiscount > 0) {
                const shippingCheckbox = await this.page.$(
                    'input[data-test*="shipping"], input[type="checkbox"][name*="shipping"]'
                );
                if (shippingCheckbox) {
                    const checked = await shippingCheckbox.isChecked();
                    if (!checked) await shippingCheckbox.click();
                    await this.page.waitForTimeout(randomDelay(400, 800));
                }
            }

            // Submit the OTL
            const submitBtn = await this.page.$(
                'button:has-text("Submit"), button:has-text("Send Offer"), button[data-test*="submit"], button[type="submit"]'
            );
            if (submitBtn) {
                await humanClick(this.page, submitBtn);
                // Enforce session-level rate limit for next offer action
                await this.enforceRateLimit('offer', jitteredDelay(RATE_LIMITS.poshmark.offerDelay));
                this.stats.offers++;
                writeAuditLog('send_otl', { listingUrl, discountPercent, shippingDiscount });
                logger.info('[PoshmarkBot] OTL sent successfully');
                return { sent: true };
            }

            return { sent: false, reason: 'submit_button_not_found' };
        } catch (error) {
            await this._screenshotOnFailure('send_offer_to_likers');
            logger.error('[PoshmarkBot] OTL error', error);
            this.stats.errors++;
            return { sent: false, reason: error.message };
        }
    }

    /**
     * Send OTL to all active listings with likers
     * @param {string} username - Poshmark username (closet owner)
     * @param {Object} options - { discountPercent, shippingDiscount, maxOffers, delayBetween }
     */
    async sendOffersToAllListings(username, options = {}) {
        const {
            discountPercent = 20,
            shippingDiscount = 0,
            maxOffers = 50,
            delayBetween = RATE_LIMITS.poshmark.offerDelay
        } = options;

        logger.info(`[PoshmarkBot] Sending OTLs for @${username} closet — up to ${maxOffers} listings`);

        try {
            await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/listing/"], [data-test="closet-card"] a',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxOffers);
            logger.info(`[PoshmarkBot] Found ${uniqueLinks.length} listings`);

            let sent = 0;
            let skipped = 0;

            for (const link of uniqueLinks) {
                const result = await this.sendOfferToLikers(link, discountPercent, shippingDiscount);
                if (result.sent) {
                    sent++;
                } else {
                    skipped++;
                }
                // Rate limit already enforced by sendOfferToLikers, but add jitter between campaigns
                await this.page.waitForTimeout(jitteredDelay(delayBetween));
            }

            writeAuditLog('send_otl_campaign_complete', { username, sent, skipped, total: uniqueLinks.length });
            logger.info(`[PoshmarkBot] OTL campaign done: ${sent} sent, ${skipped} skipped`);
            return { sent, skipped, total: uniqueLinks.length };
        } catch (error) {
            await this._screenshotOnFailure('send_offers_all_listings');
            logger.error('[PoshmarkBot] OTL campaign error', error);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Share items from the community feed (other closets) to increase visibility
     * @param {Object} options - { maxShares, delayBetween, feedType }
     */
    async shareCommunity(options = {}) {
        const {
            maxShares = 50,
            delayBetween = RATE_LIMITS.poshmark.shareDelay,
            feedType = 'feed' // 'feed', 'brand', 'category'
        } = options;

        logger.info(`[PoshmarkBot] Community sharing from ${feedType}, max ${maxShares} items`);

        try {
            await this.page.goto(`${POSHMARK_URL}/${feedType}`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            let shared = 0;

            // Scroll and share items from the feed
            while (shared < maxShares) {
                const tiles = await this.page.$$('[data-test="tile"], .card--small');
                const unsharedTiles = tiles.slice(shared, shared + 10);

                if (unsharedTiles.length === 0) {
                    // Scroll down to load more — human-like
                    await humanScroll(this.page, 600 + Math.floor(Math.random() * 400));
                    await this.page.waitForTimeout(randomDelay(1500, 2500));
                    const newTiles = await this.page.$$('[data-test="tile"], .card--small');
                    if (newTiles.length <= shared) break; // No new items loaded
                    continue;
                }

                for (const tile of unsharedTiles) {
                    if (shared >= maxShares) break;

                    try {
                        const shareBtn = await tile.$('[data-test="tile-share"], button[aria-label*="share" i]');
                        if (shareBtn) {
                            await humanClick(this.page, shareBtn);
                            await this.page.waitForTimeout(randomDelay(500, 1000));

                            const toFollowers = await this.page.$('[data-test="share-to-followers"]');
                            if (toFollowers) {
                                await humanClick(this.page, toFollowers);
                                shared++;
                                this.stats.shares++;
                                writeAuditLog('community_share', { feedType, shared, maxShares });
                                logger.info(`[PoshmarkBot] Community shared ${shared}/${maxShares}`);
                            }

                            if (shared % 5 === 0) await mouseWiggle(this.page);
                            await this.page.waitForTimeout(jitteredDelay(delayBetween));
                        }
                    } catch (e) {
                        logger.info('[PoshmarkBot] Community share item error', { error: e.message });
                    }
                }
            }

            writeAuditLog('community_share_complete', { feedType, shared, maxShares });
            logger.info(`[PoshmarkBot] Community share complete. Shared ${shared} items.`);
            return { shared };
        } catch (error) {
            await this._screenshotOnFailure('community_share');
            logger.error('[PoshmarkBot] Community share error', error);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Create a new listing on Poshmark via browser automation.
     * @param {Object} listing - { title, description, price, originalPrice, images, categoryPath, conditionTag, brand, size }
     * @returns {{ success: boolean, listingUrl: string|null, error: string|null }}
     */
    async createListing(listing) {
        const {
            title,
            description = '',
            price,
            originalPrice,
            images = [],
            categoryPath = '',
            conditionTag = 'good',
            brand = '',
            size = ''
        } = listing;

        logger.info('[PoshmarkBot] Creating listing', { title, price });
        writeAuditLog('publish_attempt', { title, price });

        // Use a fresh page so the image-blocking route on this.page doesn't affect the form
        const listPage = await this.page.context().newPage();

        try {
            await listPage.goto(`${POSHMARK_URL}/create-listing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await mouseWiggle(listPage);
            await listPage.waitForTimeout(randomDelay(2000, 3000));

            // Session guard — if redirected to login, session expired
            if (listPage.url().includes('/login')) {
                throw new Error('Poshmark session expired — re-authenticate via Settings → My Shops → Connect Poshmark');
            }

            // CAPTCHA guard — must come before any form interaction
            await this._checkCaptcha(listPage);

            // 1. Photos
            if (images.length > 0) {
                await this._uploadPhotos(listPage, images);
                await listPage.waitForTimeout(randomDelay(2000, 3500));
            }

            // 2. Title
            const titleSel = 'input[data-test="listing-title"], input[placeholder*="title" i], input[name*="title" i]';
            const titleInput = await listPage.waitForSelector(titleSel, { timeout: 15000 });
            await titleInput.click({ clickCount: 3 });
            await listPage.keyboard.type(title.slice(0, 80));
            await listPage.waitForTimeout(randomDelay(500, 1000));

            // 3. Description
            if (description) {
                const descEl = await listPage.$('textarea[data-test="listing-description"], textarea[placeholder*="description" i]');
                if (descEl) {
                    await descEl.click({ clickCount: 3 });
                    await listPage.keyboard.type(description.slice(0, 500));
                    await listPage.waitForTimeout(randomDelay(500, 1000));
                }
            }

            // 4. Category
            if (categoryPath) {
                await this._selectCategory(listPage, categoryPath);
                await listPage.waitForTimeout(randomDelay(800, 1200));
            }

            // 5. Size
            if (size) {
                await this._selectSize(listPage, size);
                await listPage.waitForTimeout(randomDelay(500, 900));
            }

            // 6. Brand
            if (brand) {
                const brandEl = await listPage.$('input[data-test="brand"], input[placeholder*="brand" i]');
                if (brandEl) {
                    await brandEl.click({ clickCount: 3 });
                    await listPage.keyboard.type(brand);
                    await listPage.waitForTimeout(randomDelay(600, 1000));
                    await listPage.keyboard.press('Escape'); // dismiss autocomplete
                    await listPage.waitForTimeout(randomDelay(300, 500));
                }
            }

            // 7. Original price
            if (originalPrice > 0) {
                const ogEl = await listPage.$('input[data-test="original-price"], input[placeholder*="original price" i]');
                if (ogEl) {
                    await ogEl.click({ clickCount: 3 });
                    await listPage.keyboard.type(String(Math.round(originalPrice)));
                    await listPage.waitForTimeout(randomDelay(400, 800));
                }
            }

            // 8. Listing price
            const priceEl = await listPage.$('input[data-test="listing-price"], input[placeholder*="listing price" i]');
            if (priceEl) {
                await priceEl.click({ clickCount: 3 });
                await listPage.keyboard.type(String(price));
                await listPage.waitForTimeout(randomDelay(400, 800));
            }

            // 9. Condition
            await this._selectCondition(listPage, conditionTag);
            await listPage.waitForTimeout(randomDelay(500, 900));

            // 10. Submit
            const submitBtn = await listPage.$(
                'button:has-text("List It"), button:has-text("List it"), button[data-test="listing-submit"]'
            );
            if (!submitBtn) throw new Error('Submit button not found on create-listing form');

            await humanClick(listPage, submitBtn);

            // Wait for redirect to the new listing page
            await listPage.waitForFunction(
                () => window.location.pathname.includes('/listing/'),
                { timeout: 25000 }
            );

            const listingUrl = listPage.url();
            writeAuditLog('publish_success', { title, price, listingUrl });
            logger.info('[PoshmarkBot] Listing published', { listingUrl });
            return { success: true, listingUrl };

        } catch (error) {
            try { await listPage.screenshot({ path: (() => { const d = path.join(process.cwd(), 'data', 'bot-screenshots'); fs.mkdirSync(d, { recursive: true }); return path.join(d, `${new Date().toISOString().replace(/[:.]/g, '-')}-create_listing.png`); })() }); } catch (_) {}
            writeAuditLog('publish_failure', { title, price, error: error.message });
            logger.error('[PoshmarkBot] createListing error', { error: error.message });
            this.stats.errors++;
            return { success: false, listingUrl: null, error: error.message };
        } finally {
            await listPage.close().catch(() => {});
        }
    }

    /** Throw if a CAPTCHA challenge is detected on the page. */
    async _checkCaptcha(page) {
        const captcha = await page.$('iframe[src*="recaptcha"], iframe[src*="captcha"], .g-recaptcha, #captcha');
        if (captcha) {
            writeAuditLog('captcha_detected', { url: page.url() });
            arcRecordDetectionEvent(PLATFORM, SIGNAL_TYPES.CAPTCHA, { url: page.url() });
            throw new Error('CAPTCHA detected — manual intervention required');
        }
    }

    /** Upload local or base64 images to the listing form. */
    async _uploadPhotos(page, images) {
        const tmpDir = path.join(process.cwd(), 'data', 'tmp');
        const allowedRoot = path.resolve(process.cwd());
        const localFiles = [];

        for (const img of images.slice(0, 8)) {
            if (!img) continue;
            if (img.startsWith('data:image/')) {
                const m = img.match(/^data:image\/(\w+);base64,(.+)$/);
                if (m) {
                    try {
                        fs.mkdirSync(tmpDir, { recursive: true }); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
                        const tmpFile = path.join(tmpDir, `pm_img_${Date.now()}_${localFiles.length}.${m[1]}`); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
                        fs.writeFileSync(tmpFile, Buffer.from(m[2], 'base64'));
                        localFiles.push(tmpFile);
                    } catch (e) { logger.warn('[PoshmarkBot] base64 decode failed', { error: e.message }); }
                }
            } else {
                // Relative paths resolved from cwd — validate stays within project root
                const resolved = path.resolve(path.isAbsolute(img) ? img : path.join(process.cwd(), img)); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
                if (!resolved.startsWith(allowedRoot + path.sep) && resolved !== allowedRoot) {
                    logger.warn('[PoshmarkBot] Rejected path outside project root', { img });
                    continue;
                }
                if (fs.existsSync(resolved)) localFiles.push(resolved);
            }
        }

        if (localFiles.length === 0) { logger.warn('[PoshmarkBot] No uploadable images found'); return; }

        const fileInput = await page.$('input[type="file"][accept*="image"], input[type="file"]');
        if (fileInput) {
            await fileInput.setInputFiles(localFiles);
        } else {
            const uploadArea = await page.$('[data-test="photo-upload"], .photo-upload-area, [aria-label*="upload photo" i]');
            if (uploadArea) {
                const chooserPromise = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
                await uploadArea.click();
                const chooser = await chooserPromise;
                if (chooser) await chooser.setFiles(localFiles);
            }
        }
        await page.waitForTimeout(randomDelay(1500, 3000));
        logger.info(`[PoshmarkBot] Uploaded ${localFiles.length} photo(s)`);
    }

    /**
     * Navigate the Poshmark category picker.
     * categoryPath: "Women > Tops > Blouses" — each part clicks the next level.
     */
    async _selectCategory(page, categoryPath) {
        const parts = categoryPath.split('>').map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) return;

        const opener = await page.$('[data-test="category-btn"], button:has-text("Category"), [aria-label*="category" i]');
        if (opener) { await opener.click(); await page.waitForTimeout(randomDelay(600, 1000)); }

        for (const part of parts) {
            const option = await page.$(`[data-test*="category"]:has-text("${part}"), li:has-text("${part}"), [role="option"]:has-text("${part}")`);
            if (option) { await option.click(); await page.waitForTimeout(randomDelay(500, 900)); }
            else logger.warn(`[PoshmarkBot] Category option not found: ${part}`);
        }
    }

    /** Select size from dropdown or option list. */
    async _selectSize(page, size) {
        const el = await page.$('select[data-test*="size"], [data-test="size-btn"], button:has-text("Size"), [aria-label*="size" i]');
        if (!el) return;
        const tag = await el.evaluate(n => n.tagName.toLowerCase());
        if (tag === 'select') {
            await el.selectOption({ label: size }).catch(() => el.selectOption(size));
        } else {
            await el.click();
            await page.waitForTimeout(randomDelay(400, 700));
            const opt = await page.$(`[role="option"]:has-text("${size}"), li:has-text("${size}")`);
            if (opt) await opt.click();
        }
    }

    /** Select condition radio / button matching the VaultLister conditionTag. */
    async _selectCondition(page, conditionTag) {
        const map = { new_with_tags: 'NWT', nwt: 'NWT', new_without_tags: 'NWOT', nwot: 'NWOT', excellent: 'Excellent', like_new: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' };
        const label = map[conditionTag?.toLowerCase()] || 'Good';
        const el = await page.$(`[data-test="condition-${label.toLowerCase()}"], label:has-text("${label}"), [role="option"]:has-text("${label}"), input[value="${label}"]`);
        if (el) { await el.click(); return; }
        // Try opener-then-option pattern
        const opener = await page.$('[data-test="condition-btn"], button:has-text("Condition")');
        if (opener) {
            await opener.click();
            await page.waitForTimeout(randomDelay(400, 700));
            const opt = await page.$(`[role="option"]:has-text("${label}"), li:has-text("${label}")`);
            if (opt) await opt.click();
        }
    }

    /**
     * Scrape closet listings for inventory sync.
     * Returns an array of { title, price, listingUrl, imageUrl } objects.
     */
    async getClosetListings(username, maxItems = 200) {
        logger.info(`[PoshmarkBot] Fetching closet listings for @${username}, max ${maxItems}`);

        try {
            await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listings = await this.page.$$eval(
                '[data-test="tile"], .card--small',
                (cards, max) => cards.slice(0, max).map(card => ({
                    title: card.querySelector('[data-test="tile-title"], .title__condition-size, .card__title')?.textContent?.trim() || '',
                    price: card.querySelector('[data-test="tile-price"], .price, .listing-price')?.textContent?.trim() || '',
                    listingUrl: card.querySelector('a[href*="/listing/"]')?.href || card.querySelector('a')?.href || '',
                    imageUrl: card.querySelector('img')?.src || ''
                })),
                maxItems
            );

            writeAuditLog('get_closet_listings', { username, count: listings.length });
            logger.info(`[PoshmarkBot] Found ${listings.length} closet listings`);
            return listings;
        } catch (error) {
            await this._screenshotOnFailure('get_closet_listings');
            logger.error('[PoshmarkBot] getClosetListings error', error);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Scrape high-level closet statistics from the user's own closet and offers pages.
     * Returns { totalListings, totalShares, totalLikes, activeOffers, recentSales, closetValue }.
     * Requires the bot to already be logged in.
     */
    async getClosetStats() {
        const username = process.env.POSHMARK_USERNAME;
        if (!username) {
            throw new Error('[PoshmarkBot] POSHMARK_USERNAME must be set in .env for getClosetStats');
        }

        logger.info(`[PoshmarkBot] Fetching closet stats for @${username}`);

        try {
            await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3000));

            // Listing count — tile cards in the closet grid
            const tileHandles = await this.page.$$('[data-test="tile"], .card--small');
            const totalListings = tileHandles.length;

            // Aggregate share and like counts from visible tiles
            let totalShares = 0;
            let totalLikes = 0;
            let closetValue = 0;

            const tileData = await this.page.$$eval(
                '[data-test="tile"], .card--small',
                cards => cards.map(c => ({
                    shares: parseInt(c.querySelector('[data-test="tile-share-count"], .social-action-bar__share-count')?.textContent?.replace(/[^0-9]/g, '') || '0', 10),
                    likes: parseInt(c.querySelector('[data-test="tile-like-count"], .social-action-bar__like-count, [data-et="like_count"]')?.textContent?.replace(/[^0-9]/g, '') || '0', 10),
                    price: parseFloat(c.querySelector('[data-test="tile-price"], .price')?.textContent?.replace(/[^0-9.]/g, '') || '0')
                }))
            );

            for (const t of tileData) {
                totalShares += isNaN(t.shares) ? 0 : t.shares;
                totalLikes += isNaN(t.likes) ? 0 : t.likes;
                closetValue += isNaN(t.price) ? 0 : t.price;
            }

            // Active offers — navigate to /offers and count pending cards
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(randomDelay(1500, 2500));
            const offerCards = await this.page.$$('[data-test="offer-card"]');
            const activeOffers = offerCards.length;

            // Recent sales — navigate to /sold and count items in last 30 days
            await this.page.goto(`${POSHMARK_URL}/sold`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(randomDelay(1500, 2500));
            const soldCards = await this.page.$$('[data-test="sold-listing"], .sold-listing, [class*="sold"]');
            const recentSales = soldCards.length;

            const stats = {
                totalListings,
                totalShares,
                totalLikes,
                activeOffers,
                recentSales,
                closetValue: Math.round(closetValue * 100) / 100
            };

            writeAuditLog('get_closet_stats', { username, ...stats });
            logger.info('[PoshmarkBot] Closet stats fetched', stats);
            return stats;
        } catch (error) {
            await this._screenshotOnFailure('get_closet_stats');
            logger.error('[PoshmarkBot] getClosetStats error', error);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Get stats
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Take a failure screenshot to data/bot-screenshots/[timestamp]-[action].png
     * Silently skips if page is not available.
     */
    async _screenshotOnFailure(action) {
        if (!this.page) return;
        try {
            const screenshotDir = path.join(process.cwd(), 'data', 'bot-screenshots');
            fs.mkdirSync(screenshotDir, { recursive: true });
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotPath = path.join(screenshotDir, `${ts}-${action}.png`);
            await this.page.screenshot({ path: screenshotPath });
            logger.warn('[PoshmarkBot] Failure screenshot saved', { path: screenshotPath, action });
            writeAuditLog('failure_screenshot', { action, path: screenshotPath });
        } catch (e) {
            logger.warn('[PoshmarkBot] Could not capture failure screenshot', { error: e.message, action });
        }
    }

    /**
     * Close the browser with a 5-second timeout.
     */
    async close() {
        logger.info('[PoshmarkBot] Closing browser...');
        if (this.browser) {
            try {
                await Promise.race([
                    this.browser.close(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('browser.close() timed out')), 5000))
                ]);
            } catch (e) {
                logger.warn('[PoshmarkBot] Browser close error', { error: e.message });
            } finally {
                this.browser = null;
                this.page = null;
            }
        }
        releasePlatformLock('poshmark');
        logger.info('[PoshmarkBot] Browser closed');
    }
}

// Export singleton instance for easy use
let botInstance = null;

export async function getPoshmarkBot(options = {}) {
    if (!botInstance) {
        botInstance = new PoshmarkBot(options);
        await botInstance.init();
    }
    return botInstance;
}

export async function closePoshmarkBot() {
    if (botInstance) {
        await botInstance.close();
        botInstance = null;
    }
}
