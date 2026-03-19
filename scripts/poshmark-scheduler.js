#!/usr/bin/env node
/**
 * Poshmark Automation Scheduler
 * Runs closet sharing, session keepalive, and offer sync on configurable intervals.
 *
 * Usage:
 *   node scripts/poshmark-scheduler.js                # run all tasks on default schedule
 *   node scripts/poshmark-scheduler.js --once         # run all tasks once then exit
 *   node scripts/poshmark-scheduler.js --share-only   # only run closet sharing loop
 *   node scripts/poshmark-scheduler.js --offers-only  # only run offer sync loop
 *
 * Default schedule:
 *   Closet share:    every 8 hours (3x/day)
 *   Session keepalive: every 6 hours
 *   Offer sync:      every 4 hours
 *
 * Set POSHMARK_USERNAME, POSHMARK_PASSWORD, POSHMARK_COUNTRY in .env
 */

import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from '../src/shared/automations/stealth.js';
import { RATE_LIMITS, jitteredDelay } from '../src/shared/automations/rate-limits.js';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROFILE_DIR = join(ROOT, 'data', 'poshmark-profile');
const COOKIE_FILE = join(ROOT, 'data', 'poshmark-cookies.json');
const AUDIT_LOG = join(ROOT, 'data', 'automation-audit.log');
const SCHEDULER_LOG = join(ROOT, 'logs', 'poshmark-scheduler.log');
const LOCK_FILE = join(ROOT, 'data', 'poshmark-scheduler.lock');

// Intervals in milliseconds
const SHARE_INTERVAL   = 8 * 60 * 60 * 1000;  // 8 hours
const KEEPALIVE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const OFFER_INTERVAL   = 4 * 60 * 60 * 1000;   // 4 hours

// Sharing config
const MAX_SHARES_PER_RUN = 50; // conservative — well under 200/run limit
const SHARE_DELAY = RATE_LIMITS.poshmark.shareDelay;

function readEnvVar(name) {
    try {
        const env = readFileSync(join(ROOT, '.env'), 'utf8');
        const match = env.match(new RegExp(`^${name}=(.+)$`, 'm'));
        return match ? match[1].trim() : '';
    } catch { return ''; }
}

const COUNTRY = (process.env.POSHMARK_COUNTRY || readEnvVar('POSHMARK_COUNTRY') || 'us').toLowerCase();
const DOMAIN_MAP = { us: 'https://poshmark.com', ca: 'https://poshmark.ca', au: 'https://poshmark.com.au' };
const BASE_URL = DOMAIN_MAP[COUNTRY] || DOMAIN_MAP.us;

const args = process.argv.slice(2);
const ONCE = args.includes('--once');
const SHARE_ONLY = args.includes('--share-only');
const OFFERS_ONLY = args.includes('--offers-only');

function log(msg) {
    const line = `[${new Date().toISOString()}] [Scheduler] ${msg}`;
    console.log(line);
    try {
        mkdirSync(join(ROOT, 'logs'), { recursive: true });
        appendFileSync(SCHEDULER_LOG, line + '\n');
    } catch {}
}

function auditLog(event, data = {}) {
    try {
        mkdirSync(join(ROOT, 'data'), { recursive: true });
        appendFileSync(AUDIT_LOG, JSON.stringify({ ts: new Date().toISOString(), platform: 'poshmark', event, ...data }) + '\n');
    } catch {}
}

function randomDelay(min = 800, max = 2000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function launchBrowser() {
    const ua = randomChromeUA();
    const vp = randomViewport();
    log(`Launching browser — UA: ${ua.slice(-30)}, VP: ${vp.width}x${vp.height}`);

    if (existsSync(PROFILE_DIR)) {
        const ctx = await stealthChromium.launchPersistentContext(PROFILE_DIR, {
            headless: true, slowMo: 30,
            args: STEALTH_ARGS, ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS,
            userAgent: ua, viewport: vp, locale: 'en-US', timezoneId: 'America/New_York',
        });
        return { context: ctx, browser: null, page: ctx.pages()[0] || await ctx.newPage() };
    }

    const browser = await stealthChromium.launch({
        headless: true, slowMo: 30, args: STEALTH_ARGS, ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS,
    });
    const context = await browser.newContext({
        userAgent: ua, viewport: vp, locale: 'en-US', timezoneId: 'America/New_York',
    });
    if (existsSync(COOKIE_FILE)) {
        const cookies = JSON.parse(readFileSync(COOKIE_FILE, 'utf8'));
        await context.addCookies(cookies.filter(c => c.domain?.includes('poshmark')));
    }
    return { context, browser, page: await context.newPage() };
}

async function checkSession(page) {
    await page.goto(`${BASE_URL}/feed`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    if (page.url().includes('/login')) return false;
    const captcha = await page.$('iframe[src*="recaptcha"], .g-recaptcha');
    if (captcha) { log('CAPTCHA detected!'); return false; }
    return true;
}

async function getClosetHandle(page) {
    const links = await page.$$eval('a[href*="/closet/"]', els =>
        els.map(a => a.href.match(/\/closet\/([^/?]+)/)?.[1]).filter(Boolean)
    );
    return links[0] || null;
}

// ─── Task: Closet Share ────────────────────────────────────────────────────
async function taskShareCloset() {
    log('=== Starting closet share ===');
    const { context, browser, page } = await launchBrowser();

    try {
        if (!await checkSession(page)) {
            log('Session invalid — run: node scripts/poshmark-login.js');
            auditLog('scheduler_share_skipped', { reason: 'no_session' });
            return;
        }

        const handle = await getClosetHandle(page);
        if (!handle) { log('Could not find closet handle'); return; }
        log(`Closet handle: @${handle}`);

        // Get listing URLs from closet page
        await page.goto(`${BASE_URL}/closet/${handle}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await mouseWiggle(page);
        await page.waitForTimeout(randomDelay(2000, 3500));

        // Scroll to load more listings
        for (let i = 0; i < 3; i++) {
            await humanScroll(page, 600 + Math.floor(Math.random() * 400));
            await page.waitForTimeout(randomDelay(1000, 2000));
        }

        const listingUrls = await page.evaluate(() => {
            return [...new Set(
                Array.from(document.querySelectorAll('a[href*="/listing/"]'))
                    .map(a => a.href)
                    .filter(Boolean)
            )];
        });
        log(`Found ${listingUrls.length} listing URLs`);

        const toShare = Math.min(listingUrls.length, MAX_SHARES_PER_RUN);
        let shared = 0, errors = 0;

        // Visit each listing page and share from there
        for (let i = 0; i < toShare; i++) {
            try {
                await page.goto(listingUrls[i], { waitUntil: 'domcontentloaded', timeout: 15000 });
                await page.waitForTimeout(randomDelay(1500, 2500));
                if (i === 0) await mouseWiggle(page);

                // Scroll share button into view and click
                const shareBox = await page.evaluate(() => {
                    const el = document.querySelector('.social-action-bar__share, [data-test="social-action-bar-share"]');
                    if (!el) return null;
                    el.scrollIntoView({ behavior: 'instant', block: 'center' });
                    const r = el.getBoundingClientRect();
                    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
                });

                if (!shareBox || shareBox.w === 0) continue;
                await page.waitForTimeout(300);

                await page.mouse.move(shareBox.x, shareBox.y, { steps: 3 + Math.floor(Math.random() * 3) });
                await page.waitForTimeout(randomDelay(50, 150));
                await page.mouse.click(shareBox.x, shareBox.y);
                await page.waitForTimeout(randomDelay(1000, 2000));

                // Click "To My Followers" in the share popup
                const followersBox = await page.evaluate(() => {
                    // Try data-test first, then text match
                    let el = document.querySelector('[data-test="share-to-followers"]');
                    if (!el) {
                        const items = Array.from(document.querySelectorAll('a, button, div, span, li'))
                            .filter(e => e.getBoundingClientRect().height > 0 && e.textContent?.trim());
                        el = items.find(e => /my followers/i.test(e.textContent?.trim()) && e.children.length < 5);
                    }
                    if (!el) el = document.querySelector('.share-wrapper__icon--followers');
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
                });

                if (followersBox && followersBox.w > 0) {
                    await page.mouse.move(followersBox.x, followersBox.y, { steps: 3 });
                    await page.waitForTimeout(randomDelay(50, 150));
                    await page.mouse.click(followersBox.x, followersBox.y);
                    shared++;
                    if (shared % 10 === 0) log(`Shared ${shared}/${toShare}`);
                } else {
                    // Close any modal
                    await page.keyboard.press('Escape');
                }

                if (shared % 5 === 0) await mouseWiggle(page);
                await page.waitForTimeout(jitteredDelay(SHARE_DELAY));
            } catch (e) {
                errors++;
                if (errors > 5) { log(`Too many errors (${errors}) — stopping`); break; }
            }
        }

        log(`Closet share done: ${shared} shared, ${errors} errors`);
        auditLog('scheduler_share_complete', { handle, shared, errors, total: toShare });

        // Refresh cookies after activity
        if (!browser) {
            const cookies = await context.cookies();
            const pmCookies = cookies.filter(c => c.domain?.includes('poshmark'));
            writeFileSync(COOKIE_FILE, JSON.stringify(pmCookies, null, 2));
        }

    } catch (e) {
        log(`Share error: ${e.message}`);
        auditLog('scheduler_share_error', { error: e.message });
    } finally {
        await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
}

// ─── Task: Session Keepalive ───────────────────────────────────────────────
async function taskKeepalive() {
    log('=== Session keepalive ===');
    const { context, browser, page } = await launchBrowser();

    try {
        if (!await checkSession(page)) {
            log('Session expired — run: node scripts/poshmark-login.js');
            auditLog('scheduler_keepalive_expired', {});
            return;
        }

        // Browse a couple pages to keep session warm
        await mouseWiggle(page);
        await page.waitForTimeout(randomDelay(2000, 4000));
        await humanScroll(page, 300);
        await page.waitForTimeout(randomDelay(1000, 2000));

        // Save refreshed cookies
        if (!browser) {
            const cookies = await context.cookies();
            const pmCookies = cookies.filter(c => c.domain?.includes('poshmark'));
            writeFileSync(COOKIE_FILE, JSON.stringify(pmCookies, null, 2));
            log(`Keepalive done — refreshed ${pmCookies.length} cookies`);
        } else {
            log('Keepalive done (no persistent context — cookies saved via file)');
        }
        auditLog('scheduler_keepalive_ok', {});

    } catch (e) {
        log(`Keepalive error: ${e.message}`);
    } finally {
        await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
}

// ─── Task: Offer Sync ─────────────────────────────────────────────────────
async function taskOfferSync() {
    log('=== Offer sync ===');
    const { context, browser, page } = await launchBrowser();

    try {
        if (!await checkSession(page)) {
            log('Session invalid — skipping offer sync');
            return;
        }

        await mouseWiggle(page);

        // Navigate to offers
        let navigated = false;
        for (const url of [`${BASE_URL}/offers/my_offers`, `${BASE_URL}/offers`]) {
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForTimeout(randomDelay(2000, 3000));
                navigated = true;
                break;
            } catch {}
        }

        if (!navigated) { log('Could not reach offers page'); return; }

        // Count pending offers
        const offers = await page.$$('[data-test="offer-card"]');
        log(`Found ${offers.length} offer cards`);
        auditLog('scheduler_offer_sync', { count: offers.length });

        // Just log for now — auto-counter handled by poshmark-offer-sync.mjs
        if (offers.length > 0) {
            log(`${offers.length} pending offers — run 'node scripts/poshmark-offer-sync.mjs' to process`);
        }

    } catch (e) {
        log(`Offer sync error: ${e.message}`);
    } finally {
        await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
}

// ─── Main Loop ─────────────────────────────────────────────────────────────
async function runAll() {
    if (!OFFERS_ONLY) await taskShareCloset();
    if (!SHARE_ONLY && !OFFERS_ONLY) await taskKeepalive();
    if (!SHARE_ONLY) await taskOfferSync();
}

// ─── Lock File (prevent collision with in-app taskWorker) ────────────────
function acquireLock() {
    try {
        if (existsSync(LOCK_FILE)) {
            const lockData = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
            const age = Date.now() - new Date(lockData.ts).getTime();
            if (age < 30 * 60 * 1000) { // Lock valid for 30 min
                log(`ERROR: Another scheduler is running (PID ${lockData.pid}, started ${lockData.ts})`);
                log('If the in-app taskWorker handles Poshmark automations, this standalone script is not needed.');
                log('To force: delete data/poshmark-scheduler.lock');
                process.exit(1);
            }
            log('Stale lock found (>30min) — overwriting');
        }
        mkdirSync(join(ROOT, 'data'), { recursive: true });
        writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, ts: new Date().toISOString(), source: 'standalone' }));
    } catch (e) {
        log(`Lock warning: ${e.message}`);
    }
}

function releaseLock() {
    try {
        if (existsSync(LOCK_FILE)) {
            const lockData = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
            if (lockData.pid === process.pid) {
                unlinkSync(LOCK_FILE);
            }
        }
    } catch {}
}

process.on('SIGINT', () => { releaseLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });

log('');
log('NOTE: This standalone scheduler is DEPRECATED. The in-app taskWorker handles');
log('Poshmark automations automatically. Use this only for manual/one-off runs.');
log('');
acquireLock();
log('Poshmark Scheduler starting');
log(`Mode: ${ONCE ? 'once' : 'loop'} | Target: ${BASE_URL}`);
log(`Schedule: share every ${SHARE_INTERVAL/3600000}h, keepalive every ${KEEPALIVE_INTERVAL/3600000}h, offers every ${OFFER_INTERVAL/3600000}h`);
log('');

// Initial run
await runAll();

if (ONCE) {
    log('Single run complete — exiting');
    process.exit(0);
}

// Schedule recurring runs
log('');
log('Entering loop mode — press Ctrl+C to stop');

let shareTimer, keepaliveTimer, offerTimer;

if (!OFFERS_ONLY) {
    shareTimer = setInterval(async () => {
        try { await taskShareCloset(); } catch (e) { log('Share task crashed: ' + e.message); }
    }, SHARE_INTERVAL);
}

if (!SHARE_ONLY && !OFFERS_ONLY) {
    keepaliveTimer = setInterval(async () => {
        try { await taskKeepalive(); } catch (e) { log('Keepalive task crashed: ' + e.message); }
    }, KEEPALIVE_INTERVAL);
}

if (!SHARE_ONLY) {
    offerTimer = setInterval(async () => {
        try { await taskOfferSync(); } catch (e) { log('Offer sync crashed: ' + e.message); }
    }, OFFER_INTERVAL);
}

// Graceful shutdown
process.on('SIGINT', () => {
    log('Shutting down scheduler...');
    clearInterval(shareTimer);
    clearInterval(keepaliveTimer);
    clearInterval(offerTimer);
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('SIGTERM received — shutting down');
    clearInterval(shareTimer);
    clearInterval(keepaliveTimer);
    clearInterval(offerTimer);
    process.exit(0);
});
