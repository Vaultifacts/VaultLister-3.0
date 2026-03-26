// Shared stealth configuration for all Playwright bots
// Centralizes anti-detection measures so every bot benefits from updates.

import { chromium as chromiumBase } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Apply stealth plugin once — patches navigator.webdriver, chrome.runtime,
// WebGL vendor, canvas fingerprint, codec enumeration, etc.
//
// Known limitation: chrome.runtime check scores 1/16 in fingerprint tests.
// puppeteer-extra-plugin-stealth cannot fully emulate chrome.runtime in a
// Playwright context because Playwright does not expose the Chrome extension
// runtime. This is a known upstream limitation — see:
// https://github.com/berstend/puppeteer-extra/issues/188
// The chrome.runtime stub is partial and will be detected by strict fingerprint
// tests (e.g. CreepJS). For most real-world marketplace bot detection (Poshmark,
// Mercari, Depop), this does not trigger a block. If it does, mitigate by
// injecting a more complete chrome.runtime mock via page.addInitScript().
chromiumBase.use(StealthPlugin());

export const stealthChromium = chromiumBase;

// Pool of recent real Chrome UA strings — rotated per session to avoid
// fingerprinting on a single static UA.
const CHROME_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];

const FIREFOX_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
];

// Viewport sizes that look like real monitors — avoids the 1280x800 fingerprint
const VIEWPORT_SIZES = [
    { width: 1920, height: 1080 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Get a random Chrome UA from the pool. */
export function randomChromeUA() { return pick(CHROME_USER_AGENTS); }

/** Get a random Firefox UA from the pool. */
export function randomFirefoxUA() { return pick(FIREFOX_USER_AGENTS); }

/** Get a random realistic viewport size. */
export function randomViewport() { return { ...pick(VIEWPORT_SIZES) }; }

/** Standard Chrome launch args for stealth. */
export const STEALTH_ARGS = [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=AutomationControlled',
    '--disable-dev-shm-usage',
];

/** Args to remove from Chromium defaults (they flag automation). */
export const STEALTH_IGNORE_DEFAULTS = ['--enable-automation'];

/**
 * Build a context options object with stealth defaults.
 * @param {'chrome'|'firefox'} browser - Which UA pool to use
 * @param {object} overrides - Any options to override
 */
export function stealthContextOptions(browser = 'chrome', overrides = {}) {
    const ua = browser === 'firefox' ? randomFirefoxUA() : randomChromeUA();
    const viewport = randomViewport();
    return {
        userAgent: ua,
        viewport,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        ...overrides,
    };
}

/**
 * Move the mouse to an element with a natural-looking curved path before clicking.
 * Avoids the teleporting-cursor fingerprint of direct element.click().
 */
export async function humanClick(page, selector) {
    const el = typeof selector === 'string' ? await page.$(selector) : selector;
    if (!el) return false;
    const box = await el.boundingBox();
    if (!box) return false;

    // Target: random point inside the element (not dead center)
    const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
    const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

    // Move through 2-4 intermediate points with slight overshoot
    const steps = 2 + Math.floor(Math.random() * 3);
    await page.mouse.move(targetX, targetY, { steps });

    // Small pause before click (like a real human aiming)
    await page.waitForTimeout(50 + Math.floor(Math.random() * 150));
    await page.mouse.click(targetX, targetY);
    return true;
}

/**
 * Scroll the page in a human-like way — variable speed, occasional pauses.
 */
export async function humanScroll(page, distance = 600) {
    const chunks = 3 + Math.floor(Math.random() * 4);
    const chunkSize = Math.floor(distance / chunks);
    for (let i = 0; i < chunks; i++) {
        const jitter = Math.floor(Math.random() * 40) - 20;
        await page.mouse.wheel(0, chunkSize + jitter);
        await page.waitForTimeout(80 + Math.floor(Math.random() * 120));
    }
}

/**
 * Small random mouse wiggle — breaks the "cursor appears then clicks" pattern.
 * Call this between major actions.
 */
export async function mouseWiggle(page) {
    const x = 400 + Math.floor(Math.random() * 600);
    const y = 200 + Math.floor(Math.random() * 400);
    await page.mouse.move(x, y, { steps: 3 + Math.floor(Math.random() * 3) });
}
