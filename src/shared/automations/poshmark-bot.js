// Poshmark Automation Bot using Playwright
// Handles sharing, following, and offer management

import { chromium } from 'playwright';

const POSHMARK_URL = 'https://poshmark.com';

// Random delay to mimic human behavior
function randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
        console.log('[PoshmarkBot] Initializing browser...');

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

        console.log('[PoshmarkBot] Browser initialized');
    }

    /**
     * Login to Poshmark
     */
    async login(username, password) {
        console.log('[PoshmarkBot] Logging in...');

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
                console.log('[PoshmarkBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }

            return this.isLoggedIn;
        } catch (error) {
            console.error('[PoshmarkBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Share an item
     */
    async shareItem(listingUrl) {
        console.log('[PoshmarkBot] Sharing item:', listingUrl);

        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay());

            // Find and click share button
            const shareButton = await this.page.$('[data-test="social-action-bar-share"]');
            if (!shareButton) {
                console.log('[PoshmarkBot] Share button not found');
                return false;
            }

            await shareButton.click();
            await this.page.waitForTimeout(randomDelay(500, 1000));

            // Click "To My Followers" option
            const toFollowersOption = await this.page.$('[data-test="share-to-followers"]');
            if (toFollowersOption) {
                await toFollowersOption.click();
                await this.page.waitForTimeout(randomDelay());
                this.stats.shares++;
                console.log('[PoshmarkBot] Item shared successfully');
                return true;
            }

            return false;
        } catch (error) {
            console.error('[PoshmarkBot] Share error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Share entire closet
     */
    async shareCloset(username, options = {}) {
        const { maxShares = 100, delayBetween = 3000 } = options;

        console.log(`[PoshmarkBot] Sharing closet for ${username}, max ${maxShares} items`);

        try {
            await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay());

            // Get all listing cards
            const listings = await this.page.$$('[data-test="tile"]');
            console.log(`[PoshmarkBot] Found ${listings.length} listings`);

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
                            console.log(`[PoshmarkBot] Shared item ${shared}/${maxShares}`);
                        }

                        await this.page.waitForTimeout(delayBetween + randomDelay());
                    }
                } catch (e) {
                    console.log('[PoshmarkBot] Error sharing item:', e.message);
                }
            }

            console.log(`[PoshmarkBot] Closet share complete. Shared ${shared} items.`);
            return shared;
        } catch (error) {
            console.error('[PoshmarkBot] Closet share error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Follow a user
     */
    async followUser(username) {
        console.log('[PoshmarkBot] Following user:', username);

        try {
            await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay());

            // Find follow button
            const followBtn = await this.page.$('[data-test="follow-button"]:not([data-test-value="following"])');

            if (followBtn) {
                await followBtn.click();
                this.stats.follows++;
                console.log('[PoshmarkBot] Followed user successfully');
                return true;
            }

            console.log('[PoshmarkBot] Already following or button not found');
            return false;
        } catch (error) {
            console.error('[PoshmarkBot] Follow error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Follow back users who followed you
     */
    async followBackFollowers(maxFollows = 50) {
        console.log(`[PoshmarkBot] Following back followers, max ${maxFollows}`);

        try {
            // Navigate to followers page
            await this.page.goto(`${POSHMARK_URL}/user/followers`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay());

            let followed = 0;

            // Find users not followed back
            const userCards = await this.page.$$('.user-card');

            for (const card of userCards.slice(0, maxFollows)) {
                const followBtn = await card.$('[data-test="follow-button"]:not([data-test-value="following"])');

                if (followBtn) {
                    await followBtn.click();
                    followed++;
                    this.stats.follows++;
                    console.log(`[PoshmarkBot] Followed back ${followed}/${maxFollows}`);
                    await this.page.waitForTimeout(randomDelay(2000, 4000));
                }
            }

            console.log(`[PoshmarkBot] Follow back complete. Followed ${followed} users.`);
            return followed;
        } catch (error) {
            console.error('[PoshmarkBot] Follow back error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Get pending offers
     */
    async getOffers() {
        console.log('[PoshmarkBot] Getting offers...');

        try {
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay());

            const offers = await this.page.$$eval('[data-test="offer-card"]', cards => {
                return cards.map(card => ({
                    itemTitle: card.querySelector('[data-test="item-title"]')?.textContent?.trim(),
                    offerAmount: card.querySelector('[data-test="offer-amount"]')?.textContent?.trim(),
                    listPrice: card.querySelector('[data-test="list-price"]')?.textContent?.trim(),
                    buyerUsername: card.querySelector('[data-test="buyer-username"]')?.textContent?.trim(),
                    status: 'pending'
                }));
            });

            console.log(`[PoshmarkBot] Found ${offers.length} offers`);
            return offers;
        } catch (error) {
            console.error('[PoshmarkBot] Get offers error:', error.message);
            return [];
        }
    }

    /**
     * Accept an offer
     */
    async acceptOffer(offerIndex) {
        console.log('[PoshmarkBot] Accepting offer at index:', offerIndex);

        try {
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay());

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
                        console.log('[PoshmarkBot] Offer accepted');
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('[PoshmarkBot] Accept offer error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Counter an offer
     */
    async counterOffer(offerIndex, counterAmount) {
        console.log('[PoshmarkBot] Countering offer at index:', offerIndex, 'with amount:', counterAmount);

        try {
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay());

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
                        console.log('[PoshmarkBot] Counter offer sent');
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('[PoshmarkBot] Counter offer error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Decline an offer
     */
    async declineOffer(offerIndex) {
        console.log('[PoshmarkBot] Declining offer at index:', offerIndex);

        try {
            await this.page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay());

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
                        console.log('[PoshmarkBot] Offer declined');
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('[PoshmarkBot] Decline offer error:', error.message);
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
        console.log(`[PoshmarkBot] Sending OTL for ${listingUrl} — ${discountPercent}% off`);

        try {
            await this.page.goto(listingUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            // Find the "Offer/Price Drop" or "Send Offer to Likers" button
            const otlBtn = await this.page.$(
                'button:has-text("Offer to Likers"), button:has-text("Price Drop"), [data-test="offer-to-likers"], [data-test*="price-drop"]'
            );
            if (!otlBtn) {
                console.log('[PoshmarkBot] OTL button not found — listing may have no likers');
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
                await this.page.waitForTimeout(randomDelay(2000, 3500));
                this.stats.offers++;
                console.log('[PoshmarkBot] OTL sent successfully');
                return { sent: true };
            }

            return { sent: false, reason: 'submit_button_not_found' };
        } catch (error) {
            console.error('[PoshmarkBot] OTL error:', error.message);
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
            delayBetween = 5000
        } = options;

        console.log(`[PoshmarkBot] Sending OTLs for @${username} closet — up to ${maxOffers} listings`);

        try {
            await this.page.goto(`${POSHMARK_URL}/closet/${username}`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/listing/"], [data-test="closet-card"] a',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxOffers);
            console.log(`[PoshmarkBot] Found ${uniqueLinks.length} listings`);

            let sent = 0;
            let skipped = 0;

            for (const link of uniqueLinks) {
                const result = await this.sendOfferToLikers(link, discountPercent, shippingDiscount);
                if (result.sent) {
                    sent++;
                } else {
                    skipped++;
                }
                await this.page.waitForTimeout(randomDelay(delayBetween * 0.8, delayBetween * 1.3));
            }

            console.log(`[PoshmarkBot] OTL campaign done: ${sent} sent, ${skipped} skipped`);
            return { sent, skipped, total: uniqueLinks.length };
        } catch (error) {
            console.error('[PoshmarkBot] OTL campaign error:', error.message);
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
        console.log('[PoshmarkBot] Closing browser...');
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        console.log('[PoshmarkBot] Browser closed');
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
