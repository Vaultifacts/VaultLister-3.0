// Grailed Automation Bot using Playwright
// Handles bumping/refreshing listings on Grailed

import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle, stealthContextOptions } from './stealth.js';
import fs from 'fs';
import path from 'path';
import { RATE_LIMITS, jitteredDelay, randomDelay } from './rate-limits.js';
import { logger } from '../../src/backend/shared/logger.js';
import { closeBrowserWithTimeout, captureErrorScreenshot, purgeOldErrorScreenshots } from './bot-utils.js';
import { preBotSafetyCheck, releasePlatformLock, enhancedHumanType } from './bot-safety.js';
import { getProfileBehavior } from './browser-profiles.js';
import {
    canActOnItem,
    recordItemAction,
    recordDetectionEvent as arcRecordDetectionEvent,
    isCoolingDown as arcIsCoolingDown,
    checkQuarantine,
    writeAuditLog as arcWriteAuditLog
} from './adaptive-rate-control.js';
import { SIGNAL_TYPES } from './signal-contracts.js';
import { getPlatformProfile } from './platform-profiles.js';
import { executeBotActionWithGuards } from './behavior-enforcer.js';

const PLATFORM = 'grailed';
const GRAILED_URL = 'https://www.grailed.com';
const BUMP_TRACKER_PATH = path.join(process.cwd(), 'data', '.grailed-bump-tracker.json');
// Fallback price history file — used when Grailed DOM price isn't readable.
// 30 days after listing creation, require ≥10% reduction before bump.
const BUMP_PRICE_PATH = path.join(process.cwd(), 'data', '.grailed-bump-prices.json');

function writeAuditLog(event, metadata = {}) {
    return arcWriteAuditLog(PLATFORM, event, metadata);
}

// --- Bump tracker -----------------------------------------------------------

function readBumpPrices() {
    try {
        if (fs.existsSync(BUMP_PRICE_PATH)) {
            return JSON.parse(fs.readFileSync(BUMP_PRICE_PATH, 'utf8'));
        }
    } catch {}
    return {};
}

function writeBumpPrices(data) {
    try {
        fs.writeFileSync(BUMP_PRICE_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch {}
}

// Records price at first-seen time; returns the recorded entry.
// createdAt is optional — if omitted, first-seen is used as proxy.
function recordListingPrice(listingUrl, price, createdAt = null) {
    const data = readBumpPrices();
    if (!data[listingUrl]) {
        data[listingUrl] = {
            firstSeenAt: new Date().toISOString(),
            createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
            initialPrice: Number.isFinite(price) ? price : null,
            currentPrice: Number.isFinite(price) ? price : null
        };
    } else if (Number.isFinite(price)) {
        data[listingUrl].currentPrice = price;
    }
    writeBumpPrices(data);
    return data[listingUrl];
}

// Enforce: 7-day minimum since last bump.
// If listing age ≥ 30 days, also require current price ≤ 90% of initial.
function canBumpListing(listingUrl, currentPrice = null) {
    const minDays = getPlatformProfile(PLATFORM).bumpCooldownDays || 7;
    if (!canActOnItem(PLATFORM, listingUrl, minDays)) {
        return { allowed: false, reason: `min ${minDays} days between bumps not elapsed` };
    }
    const prices = readBumpPrices();
    const entry = prices[listingUrl];
    if (!entry) return { allowed: true, reason: 'no_price_history' };

    const ageDays = (Date.now() - new Date(entry.createdAt).getTime()) / 86400000;
    if (ageDays < 30) return { allowed: true, reason: 'under_30d' };

    if (!Number.isFinite(entry.initialPrice) || !Number.isFinite(currentPrice)) {
        return { allowed: true, reason: 'price_unknown' };
    }
    if (currentPrice <= entry.initialPrice * 0.9) {
        return { allowed: true, reason: 'price_reduced_10pct' };
    }
    return {
        allowed: false,
        reason: `listing age ${ageDays.toFixed(1)}d requires ≥10% price reduction (current=${currentPrice}, initial=${entry.initialPrice})`
    };
}

function recordBump(listingUrl) {
    recordItemAction(PLATFORM, listingUrl, { pruneAfterDays: 60 });
}

async function checkForCaptcha(page) {
    const captcha = await page.$('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], [data-testid*="captcha"]');
    if (captcha) {
        writeAuditLog('captcha_detected');
        arcRecordDetectionEvent(PLATFORM, SIGNAL_TYPES.CAPTCHA, { url: page.url() });
        throw new Error('CAPTCHA detected — stopping automation. Please solve manually.');
    }
}

let _activeBehavior = null;

async function humanType(page, selector, text) {
    await enhancedHumanType(page, selector, text, _activeBehavior);
}

export class GrailedBot {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.options = { headless: true, slowMo: 50, ...options };
        this.stats = { bumps: 0, errors: 0 };
        this._behavior = getProfileBehavior('profile-1');
    }

    async init() {
        logger.info('[GrailedBot] Initializing browser...');
        if (checkQuarantine(PLATFORM)) {
            throw new Error(`[${PLATFORM}] account quarantined — manual review required`);
        }
        const coolingStatus = arcIsCoolingDown(PLATFORM);
        if (coolingStatus.cooling) {
            throw new Error(`[${PLATFORM}] in cooldown (${coolingStatus.reason}) — retry after ${coolingStatus.remainingMs || 'review'}ms`);
        }
        const safetyCheck = preBotSafetyCheck('grailed', { sessionCooldownMs: RATE_LIMITS.grailed.loginCooldown });
        if (!safetyCheck.safe) {
            throw new Error(safetyCheck.reason);
        }
        _activeBehavior = this._behavior;
        try {
            this.browser = await stealthChromium.launch({
                headless: this.options.headless,
                args: STEALTH_ARGS,
                ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
            });
            const context = await this.browser.newContext(stealthContextOptions('chrome'));
            this.page = await context.newPage();
            // page.route() removed — platforms detect dropped telemetry requests.
            logger.info('[GrailedBot] Browser initialized');
        } catch (err) {
            if (this.browser) await this.browser.close().catch(() => {});
            this.browser = null;
            this.page = null;
            throw err;
        }
    }

    async login() {
        const email = process.env.GRAILED_USERNAME;
        const password = process.env.GRAILED_PASSWORD;
        if (!email || !password) throw new Error('GRAILED_USERNAME and GRAILED_PASSWORD must be set in .env');
        logger.info('[GrailedBot] Logging in...');
        writeAuditLog('login_attempt');
        try {
            await this.page.goto(`${GRAILED_URL}/users/sign_in`, { waitUntil: 'domcontentloaded' });
            await checkForCaptcha(this.page);
            await this.page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });

            await humanType(this.page, 'input[name="email"], input[type="email"]', email);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanType(this.page, 'input[name="password"], input[type="password"]', password);
            await this.page.waitForTimeout(randomDelay(500, 1000));

            await humanClick(this.page, 'button[type="submit"]');
            await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
            await checkForCaptcha(this.page);

            const postLoginUrl = this.page.url();
            const postLoginText = await this.page.content().catch(() => '');
            if (postLoginUrl.includes('/checkpoint') || /temporarily locked/i.test(postLoginText)) {
                arcRecordDetectionEvent(PLATFORM, SIGNAL_TYPES.LOCKOUT, { url: postLoginUrl });
                throw new Error(`[${PLATFORM}] lockout detected`);
            }
            if (/verify it'?s you/i.test(postLoginText) || postLoginUrl.includes('/verify')) {
                arcRecordDetectionEvent(PLATFORM, SIGNAL_TYPES.LOGIN_CHALLENGE, { url: postLoginUrl });
                throw new Error(`[${PLATFORM}] login challenge detected`);
            }

            const loggedIn = await this.page.$('[data-testid*="avatar"], [class*="avatar"], a[href*="/users/"]');
            this.isLoggedIn = !!loggedIn;

            if (this.isLoggedIn) {
                writeAuditLog('login_success');
                await this.warmup();
                logger.info('[GrailedBot] Login successful');
            } else {
                throw new Error('Login failed - could not verify login status');
            }
            return this.isLoggedIn;
        } catch (error) {
            writeAuditLog('login_error', { error: error.message });
            logger.error('[GrailedBot] Login error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    async warmup() {
        logger.info('[GrailedBot] Starting session warmup...');
        writeAuditLog('warmup_start');
        try {
            await this.page.goto(`${GRAILED_URL}`, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(jitteredDelay(3000));
            await mouseWiggle(this.page);
            for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
                await humanScroll(this.page);
                await this.page.waitForTimeout(randomDelay(2000, 4000));
            }
            logger.info('[GrailedBot] Warmup complete');
            writeAuditLog('warmup_complete');
        } catch (err) {
            logger.warn('[GrailedBot] Warmup error (non-fatal):', err.message);
        }
    }

    _accountId() {
        return process.env.GRAILED_USERNAME || 'default';
    }

    /**
     * Bump a listing by editing and re-saving (increases visibility on Grailed).
     * Wrapped by BehaviorEnforcer → per-action rate/burst/session + account lock.
     */
    async bumpListing(listingUrl) {
        return executeBotActionWithGuards(
            PLATFORM,
            this._accountId(),
            () => this._bumpListingImpl(listingUrl),
            { skipDelay: true, accountAgeDays: 30, lockTtlSeconds: 60 }
        );
    }

    async _bumpListingImpl(listingUrl) {
        logger.info('[GrailedBot] Bumping listing:', listingUrl);
        try {
            await this.page.goto(listingUrl, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.grailed.actionDelay));

            // Read current listing price so the 30-day age / price-reduction rule can evaluate.
            let currentPrice = null;
            try {
                const priceEl = await this.page.$('[class*="price" i], [data-testid*="price" i]');
                if (priceEl) {
                    const priceText = await priceEl.textContent();
                    if (priceText) {
                        const match = priceText.match(/[\d,]+(?:\.\d+)?/);
                        if (match) currentPrice = parseFloat(match[0].replace(/,/g, ''));
                    }
                }
            } catch {}

            const gate = canBumpListing(listingUrl, currentPrice);
            if (!gate.allowed) {
                writeAuditLog('bump_skipped', { listingUrl, reason: gate.reason });
                logger.info(`[GrailedBot] Bump skipped: ${gate.reason}`);
                return false;
            }
            recordListingPrice(listingUrl, currentPrice);

            // Grailed has a "Bump" button on seller's own listings
            const bumpBtn = await this.page.$('button:has-text("Bump"), [data-testid*="bump"], button[aria-label*="bump" i]');
            if (bumpBtn) {
                await humanClick(this.page, bumpBtn);
                await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.grailed.actionDelay));
                this.stats.bumps++;
                recordBump(listingUrl);
                writeAuditLog('bump_listing', { listingUrl, gateReason: gate.reason });
                logger.info('[GrailedBot] Listing bumped');
                return true;
            }

            // Fallback: edit + save
            const editBtn = await this.page.$('a:has-text("Edit"), button:has-text("Edit"), [data-testid*="edit"]');
            if (editBtn) {
                await humanClick(this.page, editBtn);
                await this.page.waitForTimeout(randomDelay(2000, 3000));
                const saveBtn = await this.page.$('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
                if (saveBtn) {
                    await humanClick(this.page, saveBtn);
                    await this.page.waitForTimeout(jitteredDelay(RATE_LIMITS.grailed.actionDelay));
                    this.stats.bumps++;
                    writeAuditLog('bump_listing_via_edit', { listingUrl });
                    logger.info('[GrailedBot] Listing bumped via edit');
                    return true;
                }
            }

            logger.info('[GrailedBot] Bump/Edit button not found');
            return false;
        } catch (error) {
            logger.error('[GrailedBot] Bump error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Bump all listings in the seller's wardrobe
     */
    async bumpAllListings(options = {}) {
        const { maxBumps = 50, delayBetween = RATE_LIMITS.grailed.actionDelay } = options;
        logger.info(`[GrailedBot] Bumping up to ${maxBumps} listings`);

        try {
            await this.page.goto(`${GRAILED_URL}/users/myitems`, { waitUntil: 'domcontentloaded' });
            await mouseWiggle(this.page);
            await this.page.waitForTimeout(randomDelay(2000, 3500));

            const listingLinks = await this.page.$$eval(
                'a[href*="/listings/"], [data-testid*="listing"] a',
                links => links.map(a => a.href).filter(Boolean)
            );

            const uniqueLinks = [...new Set(listingLinks)].slice(0, maxBumps);
            logger.info(`[GrailedBot] Found ${uniqueLinks.length} listings`);

            let bumped = 0, skipped = 0;
            for (const link of uniqueLinks) {
                const success = await this.bumpListing(link);
                if (success) bumped++;
                else skipped++;
                await this.page.waitForTimeout(jitteredDelay(delayBetween));
            }

            writeAuditLog('bump_all_complete', { bumped, skipped, total: uniqueLinks.length });
            logger.info(`[GrailedBot] Bump complete: ${bumped} bumped, ${skipped} skipped`);
            return { bumped, skipped, total: uniqueLinks.length };
        } catch (error) {
            logger.error('[GrailedBot] Bump all error:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    getStats() {
        return { ...this.stats };
    }

    async close() {
        logger.info('[GrailedBot] Closing browser...');
        await closeBrowserWithTimeout(this.browser);
        this.browser = null;
        this.page = null;
        releasePlatformLock('grailed');
        logger.info('[GrailedBot] Browser closed');
    }
}

let botInstance = null;

export async function getGrailedBot(options = {}) {
    if (!botInstance) {
        botInstance = new GrailedBot(options);
        await botInstance.init();
    }
    return botInstance;
}

export async function closeGrailedBot() {
    if (botInstance) {
        await botInstance.close();
        botInstance = null;
    }
}
