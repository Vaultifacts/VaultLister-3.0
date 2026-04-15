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

/**
 * Inject a complete chrome.runtime stub via page.addInitScript() to avoid
 * detection by strict fingerprint tests (e.g. CreepJS) that probe for
 * chrome.runtime.id, getURL, getManifest, sendMessage, connect, etc.
 *
 * Call this in every bot's newPage() setup AFTER the page is created:
 *   await injectChromeRuntimeStub(page);
 *
 * This complements puppeteer-extra-plugin-stealth's partial stub, which
 * only sets chrome.runtime to a non-null object but leaves most methods
 * undefined — causing fingerprint tests to score a fail on that check.
 */
export async function injectChromeRuntimeStub(page) {
    await page.addInitScript(() => {
        if (typeof window.chrome === 'undefined') {
            window.chrome = {};
        }
        const chrome = window.chrome;

        if (!chrome.runtime) {
            chrome.runtime = {};
        }
        const rt = chrome.runtime;

        // Stable extension-like ID (avoids undefined check)
        if (!rt.id) rt.id = 'mhjfbmdgcfjbbpaeojofohoefgiehjai';

        if (typeof rt.getURL !== 'function') {
            rt.getURL = (path) => `chrome-extension://${rt.id}/${path}`;
        }

        if (typeof rt.getManifest !== 'function') {
            rt.getManifest = () => ({
                name: 'Chrome PDF Viewer',
                version: '1.0',
                manifest_version: 3,
                description: ''
            });
        }

        if (typeof rt.sendMessage !== 'function') {
            rt.sendMessage = (_extensionId, _message, _options, responseCallback) => {
                if (typeof responseCallback === 'function') responseCallback(undefined);
            };
        }

        if (typeof rt.connect !== 'function') {
            rt.connect = (_extensionId, _connectInfo) => {
                const port = {
                    name: '',
                    disconnect: () => {},
                    postMessage: () => {},
                    onDisconnect: { addListener: () => {}, removeListener: () => {} },
                    onMessage: { addListener: () => {}, removeListener: () => {} }
                };
                return port;
            };
        }

        if (typeof rt.onMessage === 'undefined') {
            rt.onMessage = { addListener: () => {}, removeListener: () => {}, hasListener: () => false };
        }

        if (typeof rt.onConnect === 'undefined') {
            rt.onConnect = { addListener: () => {}, removeListener: () => {}, hasListener: () => false };
        }

        if (typeof rt.onInstalled === 'undefined') {
            rt.onInstalled = { addListener: () => {}, removeListener: () => {}, hasListener: () => false };
        }

        if (typeof rt.lastError === 'undefined') {
            // Must be a getter so reads return undefined (not a plain property)
            Object.defineProperty(rt, 'lastError', {
                get: () => undefined,
                configurable: true
            });
        }
    });
}

/**
 * Inject browser API stubs that prevent common fingerprinting vectors:
 * WebRTC IP leak, navigator hardware properties, plugins array,
 * Permissions API, Battery API, NetworkInformation API.
 *
 * Call immediately after injectChromeRuntimeStub(page) in bot setup.
 */
export async function injectBrowserApiStubs(page) {
    await page.addInitScript(() => {
        // WebRTC leak prevention — strip STUN servers so local IP isn't exposed
        if (window.RTCPeerConnection) {
            const origRTC = window.RTCPeerConnection;
            window.RTCPeerConnection = function(...args) {
                const config = args[0] || {};
                config.iceServers = [];
                return new origRTC(config);
            };
            window.RTCPeerConnection.prototype = origRTC.prototype;
        }

        // Navigator hardware properties — randomized but plausible
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 + Math.floor(Math.random() * 5) });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => [4, 8, 16][Math.floor(Math.random() * 3)] });

        // Plugins — must be a PluginArray-like object, not a plain array
        const pluginData = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        ];
        const pluginArray = Object.create(PluginArray.prototype);
        pluginData.forEach((p, i) => {
            const plugin = Object.create(Plugin.prototype);
            Object.defineProperties(plugin, {
                name: { value: p.name, enumerable: true },
                filename: { value: p.filename, enumerable: true },
                description: { value: p.description, enumerable: true },
                length: { value: 0, enumerable: true }
            });
            pluginArray[i] = plugin;
            pluginArray[p.name] = plugin;
        });
        Object.defineProperty(pluginArray, 'length', { value: pluginData.length, enumerable: true });
        pluginArray.item = (i) => pluginArray[i] || null;
        pluginArray.namedItem = (name) => pluginArray[name] || null;
        pluginArray.refresh = () => {};
        Object.defineProperty(navigator, 'plugins', { get: () => pluginArray });

        // Permissions API — return 'denied' for notifications (fresh profile default)
        if (navigator.permissions) {
            const origQuery = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = (params) => {
                if (params.name === 'notifications') {
                    return Promise.resolve({ state: 'denied', onchange: null });
                }
                return origQuery(params);
            };
        }

        // Battery API — return plausible laptop-on-charger values
        if (navigator.getBattery) {
            navigator.getBattery = () => Promise.resolve({
                charging: true,
                chargingTime: Infinity,
                dischargingTime: Infinity,
                level: 0.85 + Math.random() * 0.15,
                addEventListener: () => {},
                removeEventListener: () => {}
            });
        }

        // NetworkInformation — report a plausible 4G connection
        if (!navigator.connection) {
            Object.defineProperty(navigator, 'connection', {
                get: () => ({
                    effectiveType: '4g',
                    downlink: 8 + Math.random() * 4,
                    rtt: 50 + Math.floor(Math.random() * 50),
                    saveData: false,
                    addEventListener: () => {},
                    removeEventListener: () => {}
                })
            });
        }
    });
}

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

const TIMEZONES = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
];

const LOCALES = ['en-US', 'en-CA', 'en-GB'];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Get a random Chrome UA from the pool. */
export function randomChromeUA() { return pick(CHROME_USER_AGENTS); }

/** Get a random Firefox UA from the pool. */
export function randomFirefoxUA() { return pick(FIREFOX_USER_AGENTS); }

/** Get a random realistic viewport size. */
export function randomViewport() { return { ...pick(VIEWPORT_SIZES) }; }

/** Return a random slowMo value between 30–80ms for launch(). */
export function randomSlowMo() { return 30 + Math.floor(Math.random() * 50); }

/** Standard Chrome launch args for stealth. */
export const STEALTH_ARGS = [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--disable-infobars',
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
        locale: pick(LOCALES),
        timezoneId: pick(TIMEZONES),
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

/**
 * Launch a Camoufox Firefox browser with anti-detect defaults.
 * Camoufox handles fingerprint spoofing natively — do NOT call
 * injectChromeRuntimeStub() or injectBrowserApiStubs() with pages from this browser.
 *
 * @param {object} options
 * @param {string} [options.profileDir]  - Absolute path to persistent user_data_dir
 * @param {object} [options.proxy]       - { server, username, password } proxy config
 * @param {boolean} [options.headless=true]
 * @returns {Promise<import('playwright').Browser>}
 */
export async function launchCamoufox(options = {}) {
    const { Camoufox } = await import('camoufox-js');
    const { profileDir, proxy, headless = true } = options;

    const camoufoxOpts = {
        headless,
        humanize: true,
        block_webrtc: true,
    };

    if (profileDir) {
        camoufoxOpts.persistent_context = true;
        camoufoxOpts.user_data_dir = profileDir;
    }

    if (proxy) {
        camoufoxOpts.proxy = proxy;
    }

    const browser = await Camoufox(camoufoxOpts);
    return browser;
}
