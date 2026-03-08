// Poshmark Automation Bot using Playwright
// Handles sharing, following, and offer management

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { logger } from '../../backend/shared/logger.js';
import { RATE_LIMITS, jitteredDelay } from './rate-limits.js';

const POSHMARK_URL = 'https://poshmark.com';
const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');

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
async function humanType(page, selector, text) {
    await page.click(selector);
    for (const char of text) {
        await page.keyboard.type(char);
        await page.waitForTimeout(randomDelay(50, 150));
    }
}

/**
 * PoshmarkBot class for automation
 */
export class PoshmarkBot {
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
            shares: 0,
            follows: 0,
            offers: 0,
            errors: 0
        };
    }

    /**
     * Initialize the browser
     */
    async init() {
        logger.info('[PoshmarkBot] Initializing browser...');

        try {
            this.browser = await chromium.launch({
                headless: this.options.headless,
                slowMo: this.options.slowMo
            });

            const context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 800 }
            });

            this.page = await context.newPage();

            // Block unnecessary resources for speed
            await this.page.route('**/*.{png,jpg,jpeg,gif,webp}', route => route.abort());
            await this.page.route('**/analytics/**', route => route.abort());
            await this.page.route('**/tracking/**', route => route.abort());

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
     * Login to Poshmark — reads credentials from process.env, never accepts them as arguments
     */
    async login() {
        const username = process.env.POSHMARK_USERNAME;
        const password = process.env.POSHMARK_PASSWORD;

        if (!username || !password) {
            throw new Error('[PoshmarkBot] POSHMARK_USERNAME and POSHMARK_PASSWORD must be set in .env');
        }

        logger.info('[PoshmarkBot] Logging in...');

        try {
            await this.page.goto(`${POSHMARK_URL}/login`, { waitUntil: 'networkidle' });

            // Wait for login form
            await this.page.waitForSelector('input[name="login_form[username_email]"]', { timeout: 10000 });

            // Enter credentials
            await humanType(this.page, 'input[name="login_form[username_email]"]', username);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, 'input[name="login_form[password]"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            // Submit form
            await this.page.click('button[type="submit"]');

            // Wait for navigation
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });

            // Check if logged in
            const isLoggedIn = await this.page.$('.user-avatar, .dropdown__menu--user');
            this.isLoggedIn = !!isLoggedIn;

            if (this.isLoggedIn) {
                logger.info('[PoshmarkBot] Login successful');
                writeAuditLog('login', { username, success: true });
            } else {
                throw new Error('Login failed - could not verify login status');
            }

            return this.isLoggedIn;
        } catch (error) {
            logger.error('[PoshmarkBot] Login error', error);
            writeAuditLog('login', { username, success: false, error: error.message });
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Share an item
     */
    async shareItem(listingUrl) {
        logger.info('[PoshmarkBot] Sharing item', { listingUrl });

        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.poshmark.shareDelay));

            // Find and click share button
            const shareButton = await this.page.$('[data-test="social-action-bar-share"]');
            if (!shareButton) {
                logger.info('[PoshmarkBot] Share button not found');
                return false;
            }

            await shareButton.click();
            await this.page.waitForTimeout(randomDelay(500, 1000));

            // Click "To My Followers" option
            const toFollowersOption = await this.page.$('[data-test="share-to-followers"]');
            if (toFollowersOption) {
                await toFollowersOption.click();
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.poshmark.shareDelay));
                this.stats.shares++;
                writeAuditLog('share_item', { listingUrl });
                logger.info('[PoshmarkBot] Item shared successfully');
                return true;
            }

            return false;
        } catch (error) {
            logger.error('[PoshmarkBot] Share error', error);
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
            await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'networkidle' });
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
                        await shareBtn.click();
                        await this.page.waitForTimeout(randomDelay(500, 1000));

                        // Click "To My Followers"
                        const toFollowers = await this.page.$('[data-test="share-to-followers"]');
                        if (toFollowers) {
                            await toFollowers.click();
                            shared++;
                            this.stats.shares++;
                            writeAuditLog('share_closet_item', { username, shared, maxShares });
                            logger.info(`[PoshmarkBot] Shared item ${shared}/${maxShares}`);
                        }

                        await this.page.waitForTimeout(jitteredDelay(delayBetween));
                    }
                } catch (e) {
                    logger.info('[PoshmarkBot] Error sharing item', { error: e.message });
                }
            }

            writeAuditLog('share_closet_complete', { username, shared, maxShares });
            logger.info(`[PoshmarkBot] Closet share complete. Shared ${shared} items.`);
            return shared;
        } catch (error) {
            logger.error('[PoshmarkBot] Closet share error', error);
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
            await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.poshmark.followDelay));

            // Find follow button
            const followBtn = await this.page.$('[data-test="follow-button"]:not([data-test-value="following"])');

            if (followBtn) {
                await followBtn.click();
                this.stats.follows++;
                writeAuditLog('follow_user', { username });
                logger.info('[PoshmarkBot] Followed user successfully');
                return true;
            }

            logger.info('[PoshmarkBot] Already following or button not found');
            return false;
        } catch (error) {
            logger.error('[PoshmarkBot] Follow error', error);
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
            await this.page.goto(`${POSHMARK_URL}/user/followers`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            let followed = 0;

            // Find users not followed back
            const userCards = await this.page.$$('.user-card');

            for (const card of userCards.slice(0, maxFollows)) {
                const followBtn = await card.$('[data-test="follow-button"]:not([data-test-value="following"])');

                if (followBtn) {
                    await followBtn.click();
                    followed++;
                    this.stats.follows++;
                    writeAuditLog('follow_back', { followed, maxFollows });
                    logger.info(`[PoshmarkBot] Followed back ${followed}/${maxFollows}`);
                    await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.poshmark.followDelay));
                }
            }

            writeAuditLog('follow_back_complete', { followed, maxFollows });
            logger.info(`[PoshmarkBot] Follow back complete. Followed ${followed} users.`);
            return followed;
        } catch (error) {
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
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'networkidle' });
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
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.poshmark.offerDelay));

            const offerCards = await this.page.$$('[data-test="offer-card"]');

            if (offerCards[offerIndex]) {
                const acceptBtn = await offerCards[offerIndex].$('[data-test="accept-offer"]');
                if (acceptBtn) {
                    await acceptBtn.click();
                    await this.page.waitForTimeout(randomDelay(1000, 2000));

                    // Confirm accept
                    const confirmBtn = await this.page.$('[data-test="confirm-accept"]');
                    if (confirmBtn) {
                        await confirmBtn.click();
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
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.poshmark.offerDelay));

            const offerCards = await this.page.$$('[data-test="offer-card"]');

            if (offerCards[offerIndex]) {
                const counterBtn = await offerCards[offerIndex].$('[data-test="counter-offer"]');
                if (counterBtn) {
                    await counterBtn.click();
                    await this.page.waitForTimeout(randomDelay(500, 1000));

                    // Enter counter amount
                    await humanType(this.page, '[data-test="counter-amount-input"]', counterAmount.toString());
                    await this.page.waitForTimeout(randomDelay(500, 1000));

                    // Submit counter
                    const submitBtn = await this.page.$('[data-test="submit-counter"]');
                    if (submitBtn) {
                        await submitBtn.click();
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
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.poshmark.offerDelay));

            const offerCards = await this.page.$$('[data-test="offer-card"]');

            if (offerCards[offerIndex]) {
                const declineBtn = await offerCards[offerIndex].$('[data-test="decline-offer"]');
                if (declineBtn) {
                    await declineBtn.click();
                    await this.page.waitForTimeout(randomDelay(1000, 2000));

                    // Confirm decline
                    const confirmBtn = await this.page.$('[data-test="confirm-decline"]');
                    if (confirmBtn) {
                        await confirmBtn.click();
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
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.poshmark.offerDelay));

            // Find the "Offer/Price Drop" or "Send Offer to Likers" button
            const otlBtn = await this.page.$(
                'button:has-text("Offer to Likers"), button:has-text("Price Drop"), [data-test="offer-to-likers"], [data-test*="price-drop"]'
            );
            if (!otlBtn) {
                logger.info('[PoshmarkBot] OTL button not found — listing may have no likers');
                return { sent: false, reason: 'no_otl_button' };
            }

            await otlBtn.click();
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
                await submitBtn.click();
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.poshmark.offerDelay));
                this.stats.offers++;
                writeAuditLog('send_otl', { listingUrl, discountPercent, shippingDiscount });
                logger.info('[PoshmarkBot] OTL sent successfully');
                return { sent: true };
            }

            return { sent: false, reason: 'submit_button_not_found' };
        } catch (error) {
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
            await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'networkidle' });
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
                await this.page.waitForTimeout(jitteredDelay(delayBetween));
            }

            writeAuditLog('send_otl_campaign_complete', { username, sent, skipped, total: uniqueLinks.length });
            logger.info(`[PoshmarkBot] OTL campaign done: ${sent} sent, ${skipped} skipped`);
            return { sent, skipped, total: uniqueLinks.length };
        } catch (error) {
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
            await this.page.goto(`${POSHMARK_URL}/${feedType}`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            let shared = 0;

            // Scroll and share items from the feed
            while (shared < maxShares) {
                const tiles = await this.page.$$('[data-test="tile"], .card--small');
                const unsharedTiles = tiles.slice(shared, shared + 10);

                if (unsharedTiles.length === 0) {
                    // Scroll down to load more
                    await this.page.evaluate(() => window.scrollBy(0, 800));
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
                            await shareBtn.click();
                            await this.page.waitForTimeout(randomDelay(500, 1000));

                            const toFollowers = await this.page.$('[data-test="share-to-followers"]');
                            if (toFollowers) {
                                await toFollowers.click();
                                shared++;
                                this.stats.shares++;
                                writeAuditLog('community_share', { feedType, shared, maxShares });
                                logger.info(`[PoshmarkBot] Community shared ${shared}/${maxShares}`);
                            }

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
            logger.error('[PoshmarkBot] Community share error', error);
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
     * Close the browser
     */
    async close() {
        logger.info('[PoshmarkBot] Closing browser...');
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
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
