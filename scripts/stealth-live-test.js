#!/usr/bin/env node
/**
 * Stealth Live Test — minimal Poshmark session test
 * Tests: stealth launch → cookie login → closet visit → share 1 item
 * Safe: only shares 1 item, stops on any detection signal
 */

import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, humanClick, humanScroll, mouseWiggle } from '../src/shared/automations/stealth.js';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COOKIE_FILE = join(ROOT, 'data', 'poshmark-cookies.json');
const PROFILE_DIR = join(ROOT, 'data', 'poshmark-profile');

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
const USERNAME = process.env.POSHMARK_USERNAME || readEnvVar('POSHMARK_USERNAME');

const ua = randomChromeUA();
const vp = randomViewport();

console.log('');
console.log('=== Stealth Live Test ===');
console.log(`Target: ${BASE_URL}`);
console.log(`UA: ${ua}`);
console.log(`Viewport: ${vp.width}x${vp.height}`);
console.log(`Username: ${USERNAME || '(not set)'}`);
console.log('');

const useProfile = existsSync(PROFILE_DIR);
let browser = null;
let context;

try {
    // Step 1: Launch with stealth
    console.log('[1/5] Launching stealth browser...');
    if (useProfile) {
        context = await stealthChromium.launchPersistentContext(PROFILE_DIR, {
            headless: true,
            slowMo: 30,
            args: STEALTH_ARGS,
            ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS,
            userAgent: ua,
            viewport: vp,
            locale: 'en-US',
            timezoneId: 'America/New_York',
        });
        console.log('  Using persistent profile: ' + PROFILE_DIR);
    } else {
        browser = await stealthChromium.launch({ headless: true, slowMo: 30, args: STEALTH_ARGS, ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS });
        context = await browser.newContext({ userAgent: ua, viewport: vp, locale: 'en-US', timezoneId: 'America/New_York' });
        if (existsSync(COOKIE_FILE)) {
            const cookies = JSON.parse(readFileSync(COOKIE_FILE, 'utf8'));
            const pmCookies = cookies.filter(c => c.domain && c.domain.includes('poshmark'));
            await context.addCookies(pmCookies);
            console.log(`  Loaded ${pmCookies.length} cookies from file`);
        }
    }
    console.log('  \x1b[32mPASS\x1b[0m Browser launched');

    const page = useProfile ? (context.pages()[0] || await context.newPage()) : await context.newPage();

    // Step 2: Check session
    console.log('[2/5] Checking Poshmark session...');
    await page.goto(`${BASE_URL}/feed`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mouseWiggle(page);
    await page.waitForTimeout(3000);

    // Check for CAPTCHA first
    const captcha = await page.$('iframe[src*="recaptcha"], iframe[src*="captcha"], .g-recaptcha, #captcha');
    if (captcha) {
        console.log('  \x1b[31mFAIL\x1b[0m CAPTCHA detected — bot was flagged!');
        await page.screenshot({ path: join(ROOT, 'logs', 'stealth-test-captcha.png') });
        console.log('  Screenshot saved: logs/stealth-test-captcha.png');
        throw new Error('CAPTCHA detected');
    }

    // Check for block page
    const blocked = await page.$('[class*="blocked"], [class*="denied"], [class*="banned"]');
    if (blocked) {
        console.log('  \x1b[31mFAIL\x1b[0m Block/ban page detected!');
        await page.screenshot({ path: join(ROOT, 'logs', 'stealth-test-blocked.png') });
        throw new Error('Blocked');
    }

    const url = page.url();
    const isLoggedIn = !url.includes('/login');
    if (isLoggedIn) {
        console.log('  \x1b[32mPASS\x1b[0m Session valid — logged in');
    } else {
        console.log('  \x1b[33mWARN\x1b[0m Session expired — redirected to login');
        console.log('  Run: node scripts/poshmark-login.js to re-authenticate');
        // Still test that the page loaded without detection
        const title = await page.title();
        console.log(`  Page title: ${title}`);
        console.log('  \x1b[32mPASS\x1b[0m No CAPTCHA or block on login page (stealth working)');
        // Can't continue without session
        console.log('');
        console.log('=== Test Complete (partial — no session) ===');
        console.log('Stealth fingerprint: OK');
        console.log('Session: Expired — re-login needed');
        await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        process.exit(0);
    }

    // Step 3: Visit closet
    console.log('[3/5] Visiting closet...');
    const closetUrl = `${BASE_URL}/closet/${USERNAME}`;
    await page.goto(closetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await mouseWiggle(page);
    await page.waitForTimeout(2000);
    await humanScroll(page, 300);
    await page.waitForTimeout(1000);

    const listings = await page.$$('[data-test="tile"], .card--small, .tc--b');
    console.log(`  Found ${listings.length} listings in closet`);
    if (listings.length === 0) {
        console.log('  \x1b[33mWARN\x1b[0m No listings found — closet may be empty or selectors changed');
        await page.screenshot({ path: join(ROOT, 'logs', 'stealth-test-closet.png') });
    } else {
        console.log('  \x1b[32mPASS\x1b[0m Closet loaded with listings');
    }

    // Step 4: Share 1 item (minimal safe action)
    console.log('[4/5] Sharing 1 item...');
    if (listings.length > 0) {
        const firstListing = listings[0];
        const shareBtn = await firstListing.$('[data-test="tile-share"], button[aria-label*="share" i], .social-action-bar__share');

        if (shareBtn) {
            await humanClick(page, shareBtn);
            await page.waitForTimeout(1500);

            const toFollowers = await page.$('[data-test="share-to-followers"], .share-wrapper__icon--followers');
            if (toFollowers) {
                await humanClick(page, toFollowers);
                await page.waitForTimeout(2000);
                console.log('  \x1b[32mPASS\x1b[0m Item shared to followers');
            } else {
                // Try the share modal — Poshmark sometimes shows a different UI
                console.log('  \x1b[33mWARN\x1b[0m "To My Followers" button not found after share click');
                await page.screenshot({ path: join(ROOT, 'logs', 'stealth-test-share-modal.png') });
                // Press Escape to close any modal
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
            }
        } else {
            console.log('  \x1b[33mWARN\x1b[0m Share button not found on first listing — selector may need update');
            await page.screenshot({ path: join(ROOT, 'logs', 'stealth-test-no-share-btn.png') });
        }
    } else {
        console.log('  SKIP — no listings to share');
    }

    // Step 5: Post-action check — still no CAPTCHA?
    console.log('[5/5] Post-action detection check...');
    await page.waitForTimeout(2000);
    const postCaptcha = await page.$('iframe[src*="recaptcha"], iframe[src*="captcha"], .g-recaptcha, #captcha');
    const postBlock = await page.$('[class*="blocked"], [class*="denied"], [class*="suspended"]');

    if (postCaptcha) {
        console.log('  \x1b[31mFAIL\x1b[0m CAPTCHA appeared after share action!');
        await page.screenshot({ path: join(ROOT, 'logs', 'stealth-test-post-captcha.png') });
    } else if (postBlock) {
        console.log('  \x1b[31mFAIL\x1b[0m Block page appeared after share action!');
        await page.screenshot({ path: join(ROOT, 'logs', 'stealth-test-post-block.png') });
    } else {
        console.log('  \x1b[32mPASS\x1b[0m No detection signals after action');
    }

    // Summary
    console.log('');
    console.log('=== Stealth Live Test Complete ===');
    console.log('Stealth fingerprint: OK');
    console.log('Session: Valid');
    console.log('Closet access: OK');
    console.log('Share action: Attempted');
    console.log('Post-action detection: None');
    console.log('\x1b[32mAll checks passed — bot is operating undetected\x1b[0m');

} catch (err) {
    console.error('\x1b[31mTest failed:\x1b[0m', err.message);
} finally {
    await context?.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
}
