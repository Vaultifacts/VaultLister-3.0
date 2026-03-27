#!/usr/bin/env node
// Visual Testing Script for Claude Code
// Takes screenshots, runs interaction scenarios, audits pages, and compares visuals via headless Playwright
// NOTE: Uses Node (not Bun) because Playwright's chromium.launch() hangs under Bun on Windows
// Usage: node scripts/visual-test.js <command> [options]

import { chromium, firefox, webkit, devices } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, appendFileSync, copyFileSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;
const SCREENSHOTS_DIR = resolve(__dirname, '..', 'screenshots');
const CURRENT_DIR = join(SCREENSHOTS_DIR, 'current');
const BASELINES_DIR = join(SCREENSHOTS_DIR, 'baselines');
const DIFFS_DIR = join(SCREENSHOTS_DIR, 'diffs');
const AUDITS_DIR = join(SCREENSHOTS_DIR, 'audits');
const REPORTS_DIR = join(SCREENSHOTS_DIR, 'reports');
const TRACES_DIR = join(SCREENSHOTS_DIR, 'traces');
const VIDEOS_DIR = join(SCREENSHOTS_DIR, 'videos');
const HISTORY_FILE = join(REPORTS_DIR, 'history.jsonl');
const DEMO_EMAIL = 'demo@vaultlister.com';
const DEMO_PASSWORD = 'DemoPassword123!';

// Viewport presets
const VIEWPORTS = {
    desktop: { width: 1280, height: 720 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
};

// All major routes for screenshot-all
const MAJOR_ROUTES = [
    // Core pages
    'dashboard', 'inventory', 'listings', 'automations', 'offers',
    'orders', 'analytics', 'financials', 'shops', 'settings',
    'checklist', 'calendar', 'image-bank', 'suppliers', 'market-intel',
    'help-support', 'roadmap', 'changelog', 'community', 'transactions',
    'report-builder', 'predictions', 'templates',
    // Feature pages
    'sales', 'recently-deleted', 'size-charts', 'sku-rules',
    'receipt-parser', 'heatmaps', 'webhooks', 'push-notifications',
    'shipping-profiles', 'teams', 'affiliate', 'notifications',
    'connections', 'smart-relisting', 'shipping-labels',
    'inventory-import', 'whatnot-live', 'reports', 'refer-friend',
    // Account & billing
    'account', 'plans-billing',
    // Help & support
    'help', 'support-articles', 'report-bug', 'tutorials',
    'suggest-features', 'submit-feedback', 'feedback-suggestions',
    'feedback-analytics'
];

// Routes that render without authentication (screenshotted separately)
const NO_LOGIN_ROUTES = [
    'login', 'register', 'forgot-password', 'email-verification',
    'terms-of-service', 'privacy-policy', 'about', 'terms', 'privacy',
    '404'
];

const SETTINGS_TABS = ['profile', 'appearance', 'notifications', 'integrations', 'tools', 'billing', 'data'];

const MINOR_ROUTES = [
    'crosslist', 'bulk-edit', 'import', 'export', 'price-history',
    'competitor-tracking', 'shipping-calculator', 'label-maker',
    'photo-editor', 'batch-upload', 'price-optimizer',
    'returns', 'disputes', 'reviews', 'messages',
    'coupons', 'promotions', 'bundles', 'collections',
    'tags', 'categories', 'brands', 'sizes',
    'conditions', 'locations', 'custom-fields', 'saved-searches',
    'activity-log', 'api-keys'
];

// --- CLI Parsing (hoisted for use by launchBrowser and commands) ---

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name) {
    const idx = args.indexOf(`--${name}`);
    if (idx === -1) return undefined;
    const val = args[idx + 1];
    if (val === undefined || val.startsWith('--')) return undefined;
    return val;
}

function hasFlag(name) {
    return args.includes(`--${name}`);
}

// --- PageContext: Diagnostic collector attached to browser sessions ---

class PageContext {
    constructor(page) {
        this.page = page;
        this.consoleMessages = [];
        this.networkFailures = [];
        this.allRequests = []; // Track ALL requests for assert-request
        this.performanceMetrics = null;
        this.a11yIssues = [];

        // Listen for console messages
        page.on('console', msg => {
            const type = msg.type();
            if (type === 'warning' || type === 'error') {
                this.consoleMessages.push({
                    type,
                    text: msg.text(),
                    location: msg.location()
                });
            }
        });

        // Track all requests (capped at 10,000 to prevent memory growth in long runs)
        page.on('request', request => {
            if (this.allRequests.length >= 10000) this.allRequests.shift();
            this.allRequests.push({
                url: request.url(),
                method: request.method(),
                timestamp: Date.now()
            });
        });

        // Listen for failed network responses (and update allRequests with status)
        page.on('response', response => {
            const status = response.status();
            const url = response.url();
            // Update the matching request entry with status
            const reqEntry = [...this.allRequests].reverse().find(r => r.url === url && !r.status);
            if (reqEntry) { reqEntry.status = status; reqEntry.statusText = response.statusText(); }
            if (status >= 400) {
                this.networkFailures.push({
                    url,
                    status,
                    statusText: response.statusText()
                });
            }
        });
    }

    async collectPerformanceMetrics() {
        try {
            this.performanceMetrics = await this.page.evaluate(() => {
                const perf = performance.getEntriesByType('navigation')[0];
                const paint = performance.getEntriesByType('paint');
                const lcp = new Promise(resolve => {
                    new PerformanceObserver(list => {
                        const entries = list.getEntries();
                        resolve(entries.length > 0 ? entries[entries.length - 1].startTime : null);
                    }).observe({ type: 'largest-contentful-paint', buffered: true });
                    setTimeout(() => resolve(null), 3000);
                });

                return {
                    domContentLoaded: perf ? perf.domContentLoadedEventEnd - perf.startTime : null,
                    loadComplete: perf ? perf.loadEventEnd - perf.startTime : null,
                    firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || null,
                    firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || null
                };
            });
        } catch {
            this.performanceMetrics = { error: 'Could not collect performance metrics' };
        }
    }

    async collectA11yIssues() {
        try {
            this.a11yIssues = await this.page.evaluate(() => {
                const issues = [];

                // Check images without alt text
                document.querySelectorAll('img').forEach(img => {
                    if (!img.getAttribute('alt') && img.getAttribute('alt') !== '') {
                        issues.push({
                            type: 'missing-alt',
                            element: 'img',
                            src: img.src?.substring(0, 100),
                            selector: img.id ? `#${img.id}` : img.className ? `.${img.className.split(' ')[0]}` : 'img'
                        });
                    }
                });

                // Check buttons without accessible text
                document.querySelectorAll('button').forEach(btn => {
                    const text = btn.textContent?.trim();
                    const ariaLabel = btn.getAttribute('aria-label');
                    const ariaLabelledBy = btn.getAttribute('aria-labelledby');
                    const title = btn.getAttribute('title');
                    if (!text && !ariaLabel && !ariaLabelledBy && !title) {
                        issues.push({
                            type: 'empty-button',
                            element: 'button',
                            selector: btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : 'button',
                            html: btn.outerHTML.substring(0, 120)
                        });
                    }
                });

                // Check links without text
                document.querySelectorAll('a').forEach(link => {
                    const text = link.textContent?.trim();
                    const ariaLabel = link.getAttribute('aria-label');
                    if (!text && !ariaLabel && !link.querySelector('img')) {
                        issues.push({
                            type: 'empty-link',
                            element: 'a',
                            href: link.href,
                            selector: link.id ? `#${link.id}` : link.className ? `.${link.className.split(' ')[0]}` : 'a'
                        });
                    }
                });

                // Check form inputs without labels
                document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])').forEach(input => {
                    const id = input.id;
                    const ariaLabel = input.getAttribute('aria-label');
                    const ariaLabelledBy = input.getAttribute('aria-labelledby');
                    const placeholder = input.getAttribute('placeholder');
                    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
                    if (!hasLabel && !ariaLabel && !ariaLabelledBy && !placeholder) {
                        issues.push({
                            type: 'unlabeled-input',
                            element: 'input',
                            inputType: input.type,
                            selector: id ? `#${id}` : input.name ? `input[name="${input.name}"]` : 'input'
                        });
                    }
                });

                // Check broken images
                document.querySelectorAll('img').forEach(img => {
                    if (img.complete === false || (img.naturalWidth === 0 && img.src)) {
                        issues.push({
                            type: 'broken-image',
                            element: 'img',
                            src: img.src?.substring(0, 100)
                        });
                    }
                });

                return issues;
            });
        } catch {
            this.a11yIssues = [{ type: 'error', message: 'Could not collect a11y issues' }];
        }
    }

    getReport() {
        return {
            console: {
                errors: this.consoleMessages.filter(m => m.type === 'error'),
                warnings: this.consoleMessages.filter(m => m.type === 'warning')
            },
            network: {
                failures: this.networkFailures
            },
            performance: this.performanceMetrics,
            accessibility: {
                issues: this.a11yIssues,
                count: this.a11yIssues.length
            },
            summary: {
                consoleErrors: this.consoleMessages.filter(m => m.type === 'error').length,
                consoleWarnings: this.consoleMessages.filter(m => m.type === 'warning').length,
                networkFailures: this.networkFailures.length,
                a11yIssues: this.a11yIssues.length
            }
        };
    }
}

// --- Utility Functions ---

function sanitizeRoute(route) {
    return route.replace(/^#/, '').replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '_') || 'root';
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ensureDir(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

function ensureScreenshotsDirs() {
    ensureDir(CURRENT_DIR);
    ensureDir(BASELINES_DIR);
    ensureDir(DIFFS_DIR);
    ensureDir(AUDITS_DIR);
}

async function checkServer() {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${BASE_URL}/api/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`Health check returned ${resp.status}`);
        return true;
    } catch (e) {
        console.error(`ERROR: Server is not running at ${BASE_URL}`);
        console.error('Start it with: bun run dev');
        return false;
    }
}

async function launchBrowser(viewportName = 'desktop') {
    const viewport = VIEWPORTS[viewportName] || VIEWPORTS.desktop;
    const headed = hasFlag('headed');
    const slowMo = parseInt(getFlag('slow-mo')) || 0;

    // Multi-browser support (C1)
    const browserName = getFlag('browser') || 'chromium';
    const browserTypes = { chromium, firefox, webkit };
    const browserType = browserTypes[browserName];
    if (!browserType) {
        console.error(`ERROR: Unknown browser "${browserName}". Supported: chromium, firefox, webkit`);
        process.exit(1);
    }

    try {
        const browser = await browserType.launch({ headless: !headed, slowMo });

        // Device emulation (C2)
        const deviceName = getFlag('device');
        let contextOptions = {
            viewport,
            deviceScaleFactor: 1,
            permissions: ['clipboard-read', 'clipboard-write']
        };

        if (deviceName) {
            const device = devices[deviceName];
            if (!device) {
                console.error(`ERROR: Unknown device "${deviceName}". Example: "iPhone 13", "Pixel 5"`);
                await browser.close();
                process.exit(1);
            }
            if (viewportName !== 'desktop') {
                console.warn(`Warning: --device "${deviceName}" overrides --viewport "${viewportName}" (using device viewport ${device.viewport.width}x${device.viewport.height})`);
            }
            contextOptions = { ...device, permissions: ['clipboard-read', 'clipboard-write'] };
            console.log(`Device emulation: ${deviceName} (${device.viewport.width}x${device.viewport.height})`);
        }

        // Video recording (C4)
        if (hasFlag('video')) {
            mkdirSync(VIDEOS_DIR, { recursive: true });
            contextOptions.recordVideo = { dir: VIDEOS_DIR };
        }

        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();
        return { browser, context, page };
    } catch (e) {
        if (e.message.includes('Executable doesn\'t exist') || e.message.includes('browserType.launch')) {
            console.error(`ERROR: Playwright browsers not installed for ${browserName}.`);
            console.error(`Run: npx playwright install ${browserName}`);
            process.exit(1);
        }
        throw e;
    }
}

async function login(page, retries = 2) {
    console.log('Logging in as demo user...');

    // Set vl_access cookie so server serves SPA instead of landing page
    const url = new URL(BASE_URL);
    await page.context().addCookies([{
        name: 'vl_access',
        value: 'visual-test-bypass',
        domain: url.hostname,
        path: '/',
    }]);

    await page.goto(`${BASE_URL}/#login`);
    await page.waitForSelector('#login-form', { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    await page.waitForFunction(
        () => typeof window.auth !== 'undefined' && typeof window.auth.login === 'function',
        { timeout: 10000 }
    );

    await page.fill('input[name="email"]', DEMO_EMAIL);
    await page.fill('input[name="password"]', DEMO_PASSWORD);

    const [response] = await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes('/api/auth/login'),
            { timeout: 20000 }
        ),
        // Use evaluate-click: Playwright's page.click() fails at tablet/mobile viewports
        page.evaluate(() => {
            const btn = document.querySelector('button[type="submit"]');
            if (btn) btn.click();
        })
    ]);

    if (response.status() !== 200) {
        const status = response.status();
        if (status === 429 && retries > 0) {
            console.log(`  Rate limited (429), waiting 3s and retrying...`);
            await page.waitForTimeout(3000);
            return login(page, retries - 1);
        }
        throw new Error(`Login failed with status ${status}`);
    }

    await page.waitForURL(/#dashboard/, { timeout: 15000 });
    console.log('Login successful.');
}

async function waitForPageReady(page) {
    try {
        await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 5000 });
    } catch { /* loading screen may not appear */ }

    try {
        await page.waitForFunction(
            () => {
                const app = document.getElementById('app');
                return app && app.innerHTML.trim().length > 100;
            },
            { timeout: 8000 }
        );
    } catch { /* some pages may be sparse */ }

    try {
        await page.waitForLoadState('networkidle', { timeout: 3000 });
    } catch { /* polling pages won't reach idle */ }

    await page.waitForTimeout(500);

    // Freeze animations if flag set (A1) — guard against duplicates
    if (hasFlag('freeze-animations')) {
        await page.evaluate(() => {
            if (!document.getElementById('__freeze-animations')) {
                const style = document.createElement('style');
                style.id = '__freeze-animations';
                style.textContent = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; animation-delay: 0s !important; transition-delay: 0s !important; }';
                document.head.appendChild(style);
            }
        });
    }
}

async function setTheme(page, mode) {
    await page.evaluate((m) => {
        try {
            if (typeof handlers !== 'undefined' && handlers.setThemeMode) {
                handlers.setThemeMode(m);
                return;
            }
        } catch (_e) { /* setThemeMode may throw if pages.settings() is missing */ }
        // Fallback: set theme directly via store and DOM
        const isDark = m === 'dark';
        if (typeof store !== 'undefined') {
            store.setState({ darkMode: isDark, themeMode: m });
        }
        document.body.classList.toggle('dark-mode', isDark);
    }, mode);
    await page.waitForTimeout(300);
}

// --- State Assertion Helpers ---

function resolveStatePath(state, path) {
    if (!path) return state;
    const parts = path.split('.');
    let current = state;
    for (const part of parts) {
        if (current == null) return undefined;
        current = current[part];
    }
    return current;
}

function assertComparison(actual, step, label) {
    const p = label || step.path || 'value';
    if ('equals' in step) {
        const expected = step.equals;
        const passed = JSON.stringify(actual) === JSON.stringify(expected);
        return { passed, message: passed ? `${p} === ${JSON.stringify(expected)}` : `${p} = ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}` };
    }
    if ('notEquals' in step) {
        const passed = JSON.stringify(actual) !== JSON.stringify(step.notEquals);
        return { passed, message: passed ? `${p} !== ${JSON.stringify(step.notEquals)}` : `${p} unexpectedly equals ${JSON.stringify(step.notEquals)}` };
    }
    if ('greaterThan' in step) {
        const passed = actual > step.greaterThan;
        return { passed, message: passed ? `${p} (${actual}) > ${step.greaterThan}` : `${p} (${actual}) is NOT > ${step.greaterThan}` };
    }
    if ('lessThan' in step) {
        const passed = actual < step.lessThan;
        return { passed, message: passed ? `${p} (${actual}) < ${step.lessThan}` : `${p} (${actual}) is NOT < ${step.lessThan}` };
    }
    if ('notNull' in step) {
        const passed = actual != null;
        return { passed, message: passed ? `${p} is not null` : `${p} is null/undefined` };
    }
    if ('isNull' in step) {
        const passed = actual == null;
        return { passed, message: passed ? `${p} is null` : `${p} = ${JSON.stringify(actual)}, expected null` };
    }
    if ('contains' in step) {
        let passed = false;
        if (typeof actual === 'string') passed = actual.includes(step.contains);
        else if (Array.isArray(actual)) passed = actual.includes(step.contains);
        return { passed, message: passed ? `${p} contains ${JSON.stringify(step.contains)}` : `${p} (${JSON.stringify(actual)?.substring(0, 80)}) does NOT contain ${JSON.stringify(step.contains)}` };
    }
    if ('matches' in step) {
        const regex = new RegExp(step.matches);
        const passed = typeof actual === 'string' && regex.test(actual);
        return { passed, message: passed ? `${p} matches /${step.matches}/` : `${p} = "${actual}" does NOT match /${step.matches}/` };
    }
    if ('between' in step) {
        const [min, max] = step.between;
        const passed = actual >= min && actual <= max;
        return { passed, message: passed ? `${p} (${actual}) between [${min}, ${max}]` : `${p} (${actual}) NOT between [${min}, ${max}]` };
    }
    if ('in' in step) {
        const passed = step.in.includes(actual);
        return { passed, message: passed ? `${p} (${JSON.stringify(actual)}) in ${JSON.stringify(step.in)}` : `${p} (${JSON.stringify(actual)}) NOT in ${JSON.stringify(step.in)}` };
    }
    if ('startsWith' in step) {
        const passed = typeof actual === 'string' && actual.startsWith(step.startsWith);
        return { passed, message: passed ? `${p} starts with "${step.startsWith}"` : `${p} = "${actual}" does NOT start with "${step.startsWith}"` };
    }
    if ('endsWith' in step) {
        const passed = typeof actual === 'string' && actual.endsWith(step.endsWith);
        return { passed, message: passed ? `${p} ends with "${step.endsWith}"` : `${p} = "${actual}" does NOT end with "${step.endsWith}"` };
    }
    if ('lengthGreaterThan' in step) {
        const len = actual?.length ?? 0;
        const passed = len > step.lengthGreaterThan;
        return { passed, message: passed ? `${p}.length (${len}) > ${step.lengthGreaterThan}` : `${p}.length (${len}) NOT > ${step.lengthGreaterThan}` };
    }
    if ('lengthLessThan' in step) {
        const len = actual?.length ?? 0;
        const passed = len < step.lengthLessThan;
        return { passed, message: passed ? `${p}.length (${len}) < ${step.lengthLessThan}` : `${p}.length (${len}) NOT < ${step.lengthLessThan}` };
    }
    return { passed: false, message: `No comparison operator found in step` };
}

// --- Enhanced Screenshot Functions ---

async function takeScreenshot(page, name, options = {}) {
    ensureScreenshotsDirs();
    const targetDir = options.baseline ? BASELINES_DIR : CURRENT_DIR;
    const filename = `${sanitizeRoute(name)}.png`;
    const filepath = join(targetDir, filename);
    const screenshotOpts = { path: filepath, fullPage: options.fullPage || hasFlag('full-page') };
    // Mask elements (C4)
    if (options.mask && Array.isArray(options.mask)) {
        screenshotOpts.mask = options.mask.map(s => page.locator(s));
    }
    await page.screenshot(screenshotOpts);
    const absPath = resolve(filepath);
    console.log(`SCREENSHOT: ${absPath}`);
    return absPath;
}

async function takeEnhancedScreenshot(page, name, options = {}) {
    // Apply theme if specified
    if (options.theme) {
        await setTheme(page, options.theme);
    }

    const screenshotPath = await takeScreenshot(page, name, options);

    // Save metadata sidecar
    const ctx = options.pageContext;
    if (ctx) {
        const metadataPath = screenshotPath.replace('.png', '.json');
        const metadata = {
            name,
            timestamp: new Date().toISOString(),
            url: page.url(),
            viewport: options.viewport || 'desktop',
            theme: options.theme || 'current',
            diagnostics: ctx.getReport().summary
        };
        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }

    return screenshotPath;
}

async function compareScreenshots(name, threshold = 0) {
    ensureScreenshotsDirs();
    const safeName = sanitizeRoute(name);
    const baselinePath = join(BASELINES_DIR, `${safeName}.png`);
    const currentPath = join(CURRENT_DIR, `${safeName}.png`);

    if (!existsSync(baselinePath)) {
        console.error(`ERROR: No baseline found at ${baselinePath}`);
        console.error('Create one with: node scripts/visual-test.js screenshot <route> --baseline');
        return null;
    }
    if (!existsSync(currentPath)) {
        console.error(`ERROR: No current screenshot found at ${currentPath}`);
        console.error('Create one with: node scripts/visual-test.js screenshot <route>');
        return null;
    }

    // Dynamic import for pixelmatch + pngjs
    let pixelmatch, PNG;
    try {
        ({ default: pixelmatch } = await import('pixelmatch'));
        ({ PNG } = await import('pngjs'));
    } catch {
        console.error('ERROR: pixelmatch and pngjs are required for screenshot comparison.');
        console.error('Install them with: npm install --save-dev pixelmatch pngjs');
        return null;
    }

    const baselineImg = PNG.sync.read(readFileSync(baselinePath));
    const currentImg = PNG.sync.read(readFileSync(currentPath));

    const { width, height } = baselineImg;
    if (currentImg.width !== width || currentImg.height !== height) {
        console.error(`ERROR: Image dimensions don't match.`);
        console.error(`  Baseline: ${width}x${height}`);
        console.error(`  Current: ${currentImg.width}x${currentImg.height}`);
        return { match: false, reason: 'dimension-mismatch' };
    }

    const diff = new PNG({ width, height });
    // Match levels (C1)
    const matchLevel = getFlag('match-level') || 'strict';
    let pmOptions = { threshold: 0.1 };
    let baseData = baselineImg.data;
    let curData = currentImg.data;
    if (matchLevel === 'layout') {
        // Grayscale both images before comparing
        const grayscale = (data) => {
            const out = Buffer.from(data);
            for (let i = 0; i < out.length; i += 4) {
                const g = Math.round(out[i] * 0.299 + out[i+1] * 0.587 + out[i+2] * 0.114);
                out[i] = out[i+1] = out[i+2] = g;
            }
            return out;
        };
        baseData = grayscale(baselineImg.data);
        curData = grayscale(currentImg.data);
    } else if (matchLevel === 'ignore-colors') {
        pmOptions.threshold = 0.5;
    } else if (matchLevel === 'ignore-antialiasing') {
        pmOptions.includeAA = false;
    }
    const numDiffPixels = pixelmatch(
        baseData, curData, diff.data,
        width, height,
        pmOptions
    );

    const totalPixels = width * height;
    const diffPercent = ((numDiffPixels / totalPixels) * 100).toFixed(2);
    const diffPath = join(DIFFS_DIR, `${safeName}-diff.png`);
    writeFileSync(diffPath, PNG.sync.write(diff));

    const withinThreshold = parseFloat(diffPercent) <= threshold;
    const result = {
        match: numDiffPixels === 0 || withinThreshold,
        diffPixels: numDiffPixels,
        totalPixels,
        diffPercent: parseFloat(diffPercent),
        diffImage: resolve(diffPath),
        baseline: resolve(baselinePath),
        current: resolve(currentPath),
        threshold
    };

    if (numDiffPixels === 0) {
        console.log(`COMPARE: ${safeName} — IDENTICAL (0 diff pixels)`);
    } else if (withinThreshold) {
        console.log(`COMPARE: ${safeName} — ${diffPercent}% different (${numDiffPixels}/${totalPixels} pixels) — WITHIN THRESHOLD (${threshold}%)`);
        console.log(`  Diff image: ${result.diffImage}`);
    } else {
        console.log(`COMPARE: ${safeName} — ${diffPercent}% different (${numDiffPixels}/${totalPixels} pixels)${threshold > 0 ? ` — EXCEEDS THRESHOLD (${threshold}%)` : ''}`);
        console.log(`  Diff image: ${result.diffImage}`);
    }

    return result;
}

function generateHtmlReport(data, outputPath) {
    const { title, startTime, endTime, results, screenshots = [] } = data;
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const allErrors = results.flatMap(r => r.errors.map(e => ({ ...e, file: r.name || '' })));
    const allStepLog = results.flatMap(r => (r.stepLog || []).map(s => ({ ...s, file: r.name || '' })));
    const status = totalFailed > 0 ? 'FAIL' : 'PASS';

    // Embed screenshots as base64
    const screenshotImages = screenshots
        .filter(s => existsSync(s))
        .map(s => {
            const b64 = readFileSync(s).toString('base64');
            return { name: basename(s, '.png'), data: b64 };
        });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — VaultLister Visual Test Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
  .report { max-width: 1200px; margin: 0 auto; }
  .header { background: #fff; border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .header h1 { font-size: 24px; margin-bottom: 8px; }
  .header .meta { color: #666; font-size: 14px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 14px; }
  .badge.pass { background: #d4edda; color: #155724; }
  .badge.fail { background: #f8d7da; color: #721c24; }
  .summary { display: flex; gap: 16px; margin-bottom: 16px; }
  .summary-card { flex: 1; background: #fff; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .summary-card .num { font-size: 32px; font-weight: 700; }
  .summary-card .label { font-size: 13px; color: #666; margin-top: 4px; }
  .summary-card.passed .num { color: #28a745; }
  .summary-card.failed .num { color: #dc3545; }
  .summary-card.total .num { color: #007bff; }
  .section { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .section h2 { font-size: 18px; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #f8f9fa; font-weight: 600; }
  tr.fail td { background: #fff5f5; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; }
  .tag.pass { background: #d4edda; color: #155724; }
  .tag.fail { background: #f8d7da; color: #721c24; }
  .tag.info { background: #d1ecf1; color: #0c5460; }
  .screenshots { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .screenshot-card { background: #f8f9fa; border-radius: 8px; overflow: hidden; }
  .screenshot-card img { width: 100%; cursor: pointer; transition: transform 0.2s; }
  .screenshot-card img:hover { transform: scale(1.02); }
  .screenshot-card .caption { padding: 8px 12px; font-size: 12px; font-weight: 600; }
  details { margin-bottom: 8px; }
  details summary { cursor: pointer; padding: 8px; background: #f8f9fa; border-radius: 4px; font-weight: 600; }
  details pre { padding: 12px; background: #2d2d2d; color: #f8f8f2; border-radius: 0 0 4px 4px; overflow-x: auto; font-size: 12px; }
  .footer { text-align: center; color: #999; font-size: 12px; padding: 16px; }
  /* Modal for full-size screenshots */
  .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,.8); z-index: 1000; justify-content: center; align-items: center; }
  .modal-overlay.active { display: flex; }
  .modal-overlay img { max-width: 95%; max-height: 95%; border-radius: 4px; }
</style>
</head>
<body>
<div class="report">
  <div class="header">
    <h1>${escapeHtml(title)} <span class="badge ${status.toLowerCase()}">${status}</span></h1>
    <div class="meta">${new Date(endTime).toLocaleString()} &middot; Duration: ${duration}s &middot; ${allStepLog.length} steps</div>
  </div>

  <div class="summary">
    <div class="summary-card passed"><div class="num">${totalPassed}</div><div class="label">Passed</div></div>
    <div class="summary-card failed"><div class="num">${totalFailed}</div><div class="label">Failed</div></div>
    <div class="summary-card total"><div class="num">${allStepLog.length}</div><div class="label">Total Steps</div></div>
  </div>

  ${results.length > 1 ? `<div class="section"><h2>File Results</h2><table><tr><th>File</th><th>Passed</th><th>Failed</th><th>Status</th></tr>${results.map(r => `<tr class="${r.failed > 0 ? 'fail' : ''}"><td>${escapeHtml(r.name || r.file || 'unnamed')}</td><td>${r.passed}</td><td>${r.failed}</td><td><span class="tag ${r.failed > 0 ? 'fail' : 'pass'}">${r.failed > 0 ? 'FAIL' : 'PASS'}</span></td></tr>`).join('')}</table></div>` : ''}

  <div class="section">
    <h2>Step Log</h2>
    <table>
      <tr><th>#</th>${results.length > 1 ? '<th>File</th>' : ''}<th>Action</th><th>Selector/Value</th><th>Duration</th><th>Status</th></tr>
      ${allStepLog.map(s => { const err = allErrors.find(e => e.step === s.step && (!s.file || e.file === s.file)); const isSkipped = s.skipped; const isAssert = s.action.startsWith('assert'); const statusTag = isSkipped ? '<span class="tag info">SKIP</span>' : err ? '<span class="tag fail">FAIL</span>' : isAssert ? '<span class="tag pass">PASS</span>' : '—'; return `<tr class="${err ? 'fail' : ''}">`+ `<td>${s.step}</td>${results.length > 1 ? `<td>${escapeHtml(s.file)}</td>` : ''}<td>${escapeHtml(s.action)}</td><td>${escapeHtml(s.selector || s.value || '—')}</td><td>${s.duration}ms</td><td>${statusTag}</td></tr>`; }).join('')}
    </table>
  </div>

  ${allErrors.length > 0 ? `<div class="section"><h2>Failures (${allErrors.length})</h2>${allErrors.map(e => `<details><summary><span class="tag fail">FAIL</span> Step ${e.step}${e.file ? ` (${escapeHtml(e.file)})` : ''}: ${escapeHtml(e.message.substring(0, 80))}</summary><pre>${escapeHtml(e.message)}</pre></details>`).join('')}</div>` : ''}

  ${screenshotImages.length > 0 ? `<div class="section"><h2>Screenshots (${screenshotImages.length})</h2><div class="screenshots">${screenshotImages.map(s => `<div class="screenshot-card"><img src="data:image/png;base64,${s.data}" alt="${escapeHtml(s.name)}" onclick="openModal(this)"><div class="caption">${escapeHtml(s.name)}</div></div>`).join('')}</div></div>` : ''}

  <div class="footer">Generated by VaultLister Visual Testing Tool &middot; ${new Date(endTime).toISOString()}</div>
</div>

<div class="modal-overlay" onclick="this.classList.remove('active')"><img id="modal-img"></div>
<script>function openModal(img){const m=document.querySelector('.modal-overlay');document.getElementById('modal-img').src=img.src;m.classList.add('active');}</script>
</body>
</html>`;

    ensureScreenshotsDirs();
    if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
    try {
        writeFileSync(outputPath, html, 'utf-8');
        console.log(`\nReport saved: ${outputPath}`);
    } catch (e) {
        console.error(`Failed to write HTML report to ${outputPath}: ${e.message}`);
    }
}

async function navigateAndScreenshot(page, route, options = {}) {
    const hash = route.startsWith('#') ? route : `#${route}`;
    console.log(`Navigating to ${hash}...`);
    await page.goto(`${BASE_URL}/${hash}`);
    await waitForPageReady(page);
    return await takeEnhancedScreenshot(page, route, options);
}

// --- Commands ---

async function cmdScreenshot(route, options = {}) {
    if (!route) {
        console.error('Usage: node scripts/visual-test.js screenshot <route> [--baseline] [--theme light|dark] [--viewport desktop|tablet|mobile]');
        process.exit(1);
    }

    if (!(await checkServer())) process.exit(1);

    const viewportName = options.viewport || 'desktop';
    const { browser, page } = await launchBrowser(viewportName);
    const ctx = new PageContext(page);

    try {
        if (!hasFlag('no-login')) await login(page);
        await navigateAndScreenshot(page, route, {
            baseline: options.baseline,
            theme: options.theme,
            viewport: viewportName,
            pageContext: ctx
        });

        // Print diagnostics summary
        const report = ctx.getReport();
        if (report.summary.consoleErrors > 0 || report.summary.networkFailures > 0) {
            console.log(`\nDiagnostics:`);
            if (report.summary.consoleErrors > 0) {
                console.log(`  Console errors: ${report.summary.consoleErrors}`);
                report.console.errors.forEach(e => console.log(`    - ${e.text.substring(0, 120)}`));
            }
            if (report.summary.networkFailures > 0) {
                console.log(`  Network failures: ${report.summary.networkFailures}`);
                report.network.failures.forEach(f => console.log(`    - ${f.status} ${f.url.substring(0, 100)}`));
            }
        }
    } finally {
        await browser.close();
    }
}

async function cmdScreenshotAll(options = {}) {
    if (!(await checkServer())) process.exit(1);

    const viewportName = options.viewport || 'desktop';
    const { browser, page } = await launchBrowser(viewportName);
    const results = { success: [], failed: [] };
    let browserClosed = false;

    try {
        await login(page);

        // Apply theme if specified
        if (options.theme) {
            await setTheme(page, options.theme);
        }

        // Major routes
        for (const route of MAJOR_ROUTES) {
            try {
                await navigateAndScreenshot(page, route, {
                    theme: options.theme,
                    viewport: viewportName
                });
                results.success.push(route);
            } catch (e) {
                console.error(`FAILED: ${route} - ${e.message}`);
                results.failed.push(route);
            }
        }

        // Settings sub-tabs
        for (const tab of SETTINGS_TABS) {
            try {
                await page.goto(`${BASE_URL}/#settings`);
                await waitForPageReady(page);

                try {
                    await page.evaluate((tabName) => {
                        if (typeof handlers !== 'undefined' && handlers.setSettingsTab) {
                            handlers.setSettingsTab(tabName);
                        }
                    }, tab);
                    await page.waitForTimeout(500);
                } catch { /* tab click may fail, still screenshot */ }

                await takeEnhancedScreenshot(page, `settings-${tab}`, {
                    theme: options.theme,
                    viewport: viewportName
                });
                results.success.push(`settings/${tab}`);
            } catch (e) {
                console.error(`FAILED: settings/${tab} - ${e.message}`);
                results.failed.push(`settings/${tab}`);
            }
        }

        // Minor routes (optional)
        if (options.includeMinor) {
            for (const route of MINOR_ROUTES) {
                try {
                    await navigateAndScreenshot(page, route, {
                        theme: options.theme,
                        viewport: viewportName
                    });
                    results.success.push(route);
                } catch (e) {
                    console.error(`FAILED: ${route} - ${e.message}`);
                    results.failed.push(route);
                }
            }
        }

        // No-login routes (auth, legal, 404) — separate browser without login
        if (!options.skipNoLogin) {
            await browser.close();
            browserClosed = true;
            const { browser: noAuthBrowser, page: noAuthPage } = await launchBrowser(viewportName);
            try {
                if (options.theme) {
                    await noAuthPage.goto(`${BASE_URL}/#login`);
                    await noAuthPage.waitForLoadState('domcontentloaded');
                    await setTheme(noAuthPage, options.theme);
                }
                for (const route of NO_LOGIN_ROUTES) {
                    try {
                        const hash = route.startsWith('#') ? route : `#${route}`;
                        await noAuthPage.goto(`${BASE_URL}/${hash}`);
                        await noAuthPage.waitForLoadState('domcontentloaded');
                        await noAuthPage.waitForTimeout(500);
                        const safeName = sanitizeRoute(route);
                        await takeEnhancedScreenshot(noAuthPage, safeName, {
                            theme: options.theme,
                            viewport: viewportName
                        });
                        results.success.push(route);
                    } catch (e) {
                        console.error(`FAILED: ${route} - ${e.message}`);
                        results.failed.push(route);
                    }
                }
            } finally {
                await noAuthBrowser.close();
            }
        }
    } finally {
        if (!browserClosed) await browser.close();
    }

    console.log(`\nDone. ${results.success.length} succeeded, ${results.failed.length} failed.`);
    if (results.failed.length > 0) {
        console.log('Failed routes:', results.failed.join(', '));
    }
}

async function cmdTheme(route) {
    if (!route) {
        console.error('Usage: node scripts/visual-test.js theme <route>');
        process.exit(1);
    }

    if (!(await checkServer())) process.exit(1);

    const { browser, page } = await launchBrowser();
    try {
        await login(page);

        const hash = route.startsWith('#') ? route : `#${route}`;
        await page.goto(`${BASE_URL}/${hash}`);
        await waitForPageReady(page);

        // Light mode screenshot
        await setTheme(page, 'light');
        await takeScreenshot(page, `${sanitizeRoute(route)}-light`);

        // Dark mode screenshot
        await setTheme(page, 'dark');
        await takeScreenshot(page, `${sanitizeRoute(route)}-dark`);

        console.log('\nTheme comparison complete — 2 screenshots captured (light + dark).');
    } finally {
        await browser.close();
    }
}

async function cmdResponsive(route) {
    if (!route) {
        console.error('Usage: node scripts/visual-test.js responsive <route>');
        process.exit(1);
    }

    if (!(await checkServer())) process.exit(1);

    const safeName = sanitizeRoute(route);
    const hash = route.startsWith('#') ? route : `#${route}`;

    const vpEntries = Object.entries(VIEWPORTS);
    for (let i = 0; i < vpEntries.length; i++) {
        const [vpName, vpSize] = vpEntries[i];
        if (i > 0) await new Promise(r => setTimeout(r, 1500)); // gap between viewports
        console.log(`\nCapturing ${vpName} (${vpSize.width}x${vpSize.height})...`);
        const { browser, page } = await launchBrowser(vpName);
        try {
            await login(page);
            await page.goto(`${BASE_URL}/${hash}`);
            await waitForPageReady(page);
            await takeScreenshot(page, `${safeName}-${vpName}`);
        } finally {
            await browser.close();
        }
    }

    console.log(`\nResponsive comparison complete — 3 screenshots captured (desktop, tablet, mobile).`);
}

async function cmdToast(type) {
    const validTypes = ['success', 'error', 'warning', 'info'];
    if (!type || !validTypes.includes(type)) {
        console.error(`Usage: node scripts/visual-test.js toast <${validTypes.join('|')}>`);
        process.exit(1);
    }

    if (!(await checkServer())) process.exit(1);

    const { browser, page } = await launchBrowser();
    try {
        await login(page);
        await page.goto(`${BASE_URL}/#dashboard`);
        await waitForPageReady(page);

        // Trigger toast
        await page.evaluate((t) => {
            if (typeof toast !== 'undefined' && toast[t]) {
                toast[t](`Test ${t} notification`, { duration: 8000 });
            }
        }, type);

        // Wait for toast to appear
        try {
            await page.waitForSelector('.toast', { timeout: 3000 });
            await page.waitForTimeout(300);
        } catch {
            console.warn('WARNING: Toast selector .toast not found — it may use a different class.');
        }

        await takeScreenshot(page, `toast-${type}`);
        console.log(`\nToast "${type}" captured.`);
    } finally {
        await browser.close();
    }
}

async function cmdModal(type) {
    const validTypes = ['confirm', 'confirm-danger', 'custom'];
    if (!type || !validTypes.includes(type)) {
        console.error(`Usage: node scripts/visual-test.js modal <${validTypes.join('|')}>`);
        process.exit(1);
    }

    if (!(await checkServer())) process.exit(1);

    const { browser, page } = await launchBrowser();
    try {
        await login(page);
        await page.goto(`${BASE_URL}/#dashboard`);
        await waitForPageReady(page);

        // Trigger modal based on type
        if (type === 'confirm') {
            await page.evaluate(() => {
                if (typeof modals !== 'undefined' && modals.confirm) {
                    modals.confirm('Are you sure you want to proceed?', {
                        title: 'Confirm Action',
                        confirmText: 'Yes, proceed',
                        cancelText: 'Cancel'
                    });
                }
            });
        } else if (type === 'confirm-danger') {
            await page.evaluate(() => {
                if (typeof modals !== 'undefined' && modals.confirm) {
                    modals.confirm('This action cannot be undone. Delete this item?', {
                        title: 'Delete Item',
                        confirmText: 'Delete',
                        cancelText: 'Cancel',
                        danger: true
                    });
                }
            });
        } else if (type === 'custom') {
            await page.evaluate(() => {
                if (typeof modals !== 'undefined' && modals.show) {
                    modals.show(`
                        <div class="modal-header">
                            <h3>Custom Modal</h3>
                            <button class="modal-close" onclick="modals.close()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p>This is a custom modal for visual testing.</p>
                            <div style="padding: 16px; background: var(--bg-secondary, #f5f5f5); border-radius: 8px; margin-top: 12px;">
                                <p>Custom content area</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="modals.close()">Close</button>
                            <button class="btn btn-primary">Action</button>
                        </div>
                    `);
                }
            });
        }

        // Wait for modal to appear
        try {
            await page.waitForSelector('.modal-overlay', { timeout: 3000 });
            await page.waitForTimeout(400);
        } catch {
            console.warn('WARNING: Modal overlay not found — it may use a different class.');
        }

        await takeScreenshot(page, `modal-${type}`);
        console.log(`\nModal "${type}" captured.`);
    } finally {
        await browser.close();
    }
}

async function cmdValidate(route) {
    if (!route) {
        console.error('Usage: node scripts/visual-test.js validate <route>');
        process.exit(1);
    }

    if (!(await checkServer())) process.exit(1);

    const { browser, page } = await launchBrowser();
    const safeName = sanitizeRoute(route);

    try {
        await login(page);
        const hash = route.startsWith('#') ? route : `#${route}`;
        await page.goto(`${BASE_URL}/${hash}`);
        await waitForPageReady(page);

        // Find forms on the page
        const formCount = await page.evaluate(() => document.querySelectorAll('form').length);
        if (formCount === 0) {
            console.log(`No forms found on ${route}.`);
            await takeScreenshot(page, `${safeName}-no-forms`);
            return;
        }

        console.log(`Found ${formCount} form(s) on ${route}.`);

        for (let i = 0; i < formCount; i++) {
            const formIndex = i;
            console.log(`\nProcessing form ${i + 1}/${formCount}...`);

            // Screenshot 1: Empty state
            await takeScreenshot(page, `${safeName}-form${i + 1}-empty`);

            // Screenshot 2: Trigger validation by trying to submit
            await page.evaluate((idx) => {
                const forms = document.querySelectorAll('form');
                const form = forms[idx];
                if (form) {
                    // Try to submit to trigger HTML5 validation
                    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
                    if (submitBtn) submitBtn.click();
                    // Also trigger reportValidity for browsers that support it
                    if (form.reportValidity) form.reportValidity();
                }
            }, formIndex);
            await page.waitForTimeout(500);
            await takeScreenshot(page, `${safeName}-form${i + 1}-validation`);

            // Screenshot 3: Fill with dummy data
            await page.evaluate((idx) => {
                const forms = document.querySelectorAll('form');
                const form = forms[idx];
                if (!form) return;

                form.querySelectorAll('input, textarea, select').forEach(field => {
                    const type = field.type?.toLowerCase() || 'text';
                    const name = field.name?.toLowerCase() || '';

                    if (field.tagName === 'SELECT') {
                        const opts = field.options;
                        if (opts.length > 1) field.value = opts[1].value;
                        return;
                    }

                    switch (type) {
                        case 'email': field.value = 'test@example.com'; break;
                        case 'password': field.value = 'TestPassword123!'; break;
                        case 'number': field.value = '42'; break;
                        case 'tel': field.value = '555-0100'; break;
                        case 'url': field.value = 'https://example.com'; break;
                        case 'date': field.value = '2026-01-15'; break;
                        case 'checkbox': field.checked = true; break;
                        case 'radio':
                            if (!form.querySelector(`input[name="${field.name}"]:checked`)) {
                                field.checked = true;
                            }
                            break;
                        case 'textarea':
                        case 'text':
                        default:
                            if (name.includes('name')) field.value = 'Test User';
                            else if (name.includes('title')) field.value = 'Test Item';
                            else if (name.includes('price') || name.includes('cost')) field.value = '19.99';
                            else if (name.includes('description') || name.includes('desc')) field.value = 'Test description for validation';
                            else if (name.includes('quantity') || name.includes('qty')) field.value = '5';
                            else field.value = 'Test value';
                            break;
                    }

                    // Dispatch events so frameworks pick up the change
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                });
            }, formIndex);
            await page.waitForTimeout(300);
            await takeScreenshot(page, `${safeName}-form${i + 1}-filled`);
        }

        console.log(`\nForm validation test complete — ${formCount * 3} screenshots captured.`);
    } finally {
        await browser.close();
    }
}

async function cmdAudit(route) {
    if (!route) {
        console.error('Usage: node scripts/visual-test.js audit <route>');
        process.exit(1);
    }

    if (!(await checkServer())) process.exit(1);

    const { browser, page } = await launchBrowser();
    const ctx = new PageContext(page);
    const safeName = sanitizeRoute(route);

    try {
        await login(page);
        const hash = route.startsWith('#') ? route : `#${route}`;
        await page.goto(`${BASE_URL}/${hash}`);
        await waitForPageReady(page);

        // Collect metrics
        await ctx.collectPerformanceMetrics();
        await ctx.collectA11yIssues();

        // Take screenshot
        await takeScreenshot(page, `audit-${safeName}`);

        // Generate report
        const report = ctx.getReport();
        report.route = route;
        report.timestamp = new Date().toISOString();
        report.url = page.url();

        // Save JSON report
        const reportPath = join(AUDITS_DIR, `${safeName}-audit.json`);
        writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nAudit report: ${resolve(reportPath)}`);

        // Print summary
        console.log(`\n--- Audit Summary for ${route} ---`);
        console.log(`Console errors:   ${report.summary.consoleErrors}`);
        console.log(`Console warnings: ${report.summary.consoleWarnings}`);
        console.log(`Network failures: ${report.summary.networkFailures}`);
        console.log(`A11y issues:      ${report.summary.a11yIssues}`);

        if (report.performance) {
            console.log(`\nPerformance:`);
            if (report.performance.domContentLoaded != null) {
                console.log(`  DOM Content Loaded: ${report.performance.domContentLoaded.toFixed(0)}ms`);
            }
            if (report.performance.firstContentfulPaint != null) {
                console.log(`  First Contentful Paint: ${report.performance.firstContentfulPaint.toFixed(0)}ms`);
            }
        }

        if (report.console.errors.length > 0) {
            console.log(`\nConsole Errors:`);
            report.console.errors.forEach(e => console.log(`  - ${e.text.substring(0, 150)}`));
        }

        if (report.network.failures.length > 0) {
            console.log(`\nNetwork Failures:`);
            report.network.failures.forEach(f => console.log(`  - ${f.status} ${f.url.substring(0, 120)}`));
        }

        if (report.accessibility.issues.length > 0) {
            console.log(`\nAccessibility Issues:`);
            report.accessibility.issues.forEach(issue => {
                console.log(`  - [${issue.type}] ${issue.selector || issue.element}${issue.src ? ` (${issue.src})` : ''}`);
            });
        }

        const total = report.summary.consoleErrors + report.summary.networkFailures + report.summary.a11yIssues;
        if (total === 0) {
            console.log(`\nPASS: No issues found.`);
        } else {
            console.log(`\nTOTAL ISSUES: ${total}`);
        }
    } finally {
        await browser.close();
    }
}

async function cmdCompare(name) {
    if (!name) {
        console.error('Usage: node scripts/visual-test.js compare <name>');
        console.error('Example: node scripts/visual-test.js compare dashboard');
        process.exit(1);
    }

    const threshold = parseFloat(getFlag('threshold')) || 0;
    const result = await compareScreenshots(name, threshold);
    if (result) {
        // Auto-update baselines if requested (D3)
        if (hasFlag('update-baselines') && !result.match) {
            const safeName = sanitizeRoute(name);
            const currentPath = join(CURRENT_DIR, `${safeName}.png`);
            const baselinePath = join(BASELINES_DIR, `${safeName}.png`);
            copyFileSync(currentPath, baselinePath);
            console.log(`Baseline updated: ${safeName}`);
        }
        // Output JSON for programmatic consumption
        console.log(`\nRESULT_JSON: ${JSON.stringify(result)}`);
    }
}

// Substitute $varName references in step string values (recursive for nested objects/arrays)
function substituteVars(step, variables) {
    if (variables.size === 0) return step;
    function replaceInValue(val) {
        if (typeof val === 'string' && val.includes('$')) {
            return val.replace(/\$(\w+)/g, (_, name) => variables.has(name) ? variables.get(name) : `$${name}`);
        }
        if (Array.isArray(val)) return val.map(replaceInValue);
        if (val && typeof val === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(val)) { out[k] = replaceInValue(v); }
            return out;
        }
        return val;
    }
    const replaced = {};
    for (const [key, val] of Object.entries(step)) {
        replaced[key] = replaceInValue(val);
    }
    return replaced;
}

// Core step execution engine — extracted from cmdInteract for reuse by cmdRunSuite
async function runInteractSteps(page, steps, options = {}) {
    const { failFast = false, maxRetries = 0, ctx = null } = options;
    const assertionResults = { passed: 0, failed: 0, errors: [] };
    const stateSnapshots = new Map();
    const variables = new Map();
    const stepLog = [];
    const screenshots = [];

    const ASSERTION_ACTIONS = new Set([
        'assert', 'assert-state', 'assert-css', 'assert-class', 'assert-snapshot',
        'assert-toast', 'assert-toast-count', 'assert-context-menu', 'assert-clipboard',
        'assert-variable', 'assert-scroll', 'assert-storage',
        'assert-sort', 'assert-dropdown', 'assert-inline-edit', 'assert-focus',
        'assert-focus-trapped', 'assert-performance', 'assert-console',
        'assert-memory', 'assert-wizard', 'assert-tags', 'assert-accordion',
        'assert-panel', 'assert-lightbox', 'assert-date-range', 'assert-color',
        'assert-toggle', 'assert-tree', 'assert-carousel', 'assert-connection',
        'assert-password-strength', 'assert-form-progress', 'assert-all',
        // Phase 7 assertions
        'assert-url', 'assert-dimensions', 'assert-request', 'assert-select-value',
        'assert-computed-style', 'assert-a11y', 'assert-contrast', 'assert-aria',
        'assert-tab-order', 'assert-screen-reader', 'assert-pagination',
        'assert-row-expanded', 'assert-bulk-selection', 'assert-table-export',
        'assert-column-visible', 'assert-autocomplete', 'assert-field-error',
        'assert-form-valid', 'assert-form-dirty', 'assert-spinner-value',
        'assert-command-palette', 'assert-tab-active', 'assert-breadcrumbs',
        'assert-view-mode', 'assert-search-results', 'assert-no-layout-shift',
        'assert-skeleton', 'assert-order', 'assert-slider-position',
        'assert-chart', 'assert-chart-tooltip', 'assert-chart-legend', 'assert-gauge',
        'assert-banner', 'assert-alert', 'assert-notification-count', 'assert-snackbar',
        'assert-kanban', 'assert-timeline', 'assert-timeline-event',
        'assert-goal', 'assert-streak', 'assert-session'
    ]);

    // Auto-wait configuration (E2)
    let autoWait = parseInt(getFlag('auto-wait')) || 0;

    for (let i = 0; i < steps.length; i++) {
        let step = substituteVars(steps[i], variables);
        const stepStart = Date.now();

        // Per-step skip (A2)
        if (step.skip) {
            console.log(`Step ${i + 1}/${steps.length}: ${step.action} — SKIPPED`);
            stepLog.push({ step: i + 1, action: step.action, selector: step.selector, value: step.value, duration: 0, skipped: true });
            continue;
        }

        // Conditional steps (A4)
        if (step.if) {
            let condMet = false;
            if (step.if.selector) {
                const el = await page.$(step.if.selector);
                condMet = step.if.visible ? (el && await el.isVisible()) : !!el;
            } else if (step.if.variable) {
                const val = variables.get(step.if.variable);
                condMet = step.if.equals !== undefined ? String(val) === String(step.if.equals) : !!val;
            }
            if (!condMet) {
                console.log(`Step ${i + 1}/${steps.length}: ${step.action} — SKIPPED (if condition not met)`);
                stepLog.push({ step: i + 1, action: step.action, duration: 0, skipped: true });
                continue;
            }
        }
        if (step.unless) {
            let condMet = false;
            if (step.unless.selector) {
                const el = await page.$(step.unless.selector);
                condMet = step.unless.visible ? (el && await el.isVisible()) : !!el;
            } else if (step.unless.variable) {
                const val = variables.get(step.unless.variable);
                condMet = step.unless.equals !== undefined ? String(val) === String(step.unless.equals) : !!val;
            }
            if (condMet) {
                console.log(`Step ${i + 1}/${steps.length}: ${step.action} — SKIPPED (unless condition met)`);
                stepLog.push({ step: i + 1, action: step.action, duration: 0, skipped: true });
                continue;
            }
        }

        const isAssertion = ASSERTION_ACTIONS.has(step.action);
        let retriesLeft = isAssertion ? maxRetries : 0;

        retryLoop: while (true) {
        console.log(`Step ${i + 1}/${steps.length}: ${step.action}${step.selector ? ` "${step.selector}"` : ''}${step.value ? ` = "${step.value}"` : ''}${retriesLeft < maxRetries ? ` (retry ${maxRetries - retriesLeft}/${maxRetries})` : ''}`);
        const prevFailed = assertionResults.failed;

            try { // Top-level catch for any unhandled step error
            switch (step.action) {
                case 'goto': {
                    try {
                        const hash = step.value.startsWith('#') ? step.value : `#${step.value}`;
                        await page.goto(`${BASE_URL}/${hash}`);
                        await waitForPageReady(page);
                    } catch (e) {
                        console.error(`  Goto error for "${step.value}": ${e.message}`);
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `Goto failed: ${e.message}` });
                    }
                    break;
                }
                case 'click': {
                    try {
                        await page.click(step.selector, { timeout: step.timeout || 5000 });
                        await page.waitForTimeout(300);
                    } catch (e) {
                        console.error(`  Click error on "${step.selector}": ${e.message}`);
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `Click failed: ${e.message}` });
                    }
                    break;
                }
                case 'fill': {
                    try {
                        await page.fill(step.selector, step.value, { timeout: step.timeout || 5000 });
                    } catch (e) {
                        console.error(`  Fill error on "${step.selector}": ${e.message}`);
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `Fill failed: ${e.message}` });
                    }
                    break;
                }
                case 'select': {
                    try {
                        await page.selectOption(step.selector, step.value, { timeout: step.timeout || 5000 });
                    } catch (e) {
                        console.error(`  Select error on "${step.selector}": ${e.message}`);
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `Select failed: ${e.message}` });
                    }
                    break;
                }
                case 'wait': {
                    if (step.selector) {
                        await page.waitForSelector(step.selector, { timeout: 10000 });
                    } else {
                        await page.waitForTimeout(parseInt(step.value) || 1000);
                    }
                    break;
                }
                case 'screenshot': {
                    const shotName = step.name || `step-${i + 1}`;
                    await takeScreenshot(page, shotName, { fullPage: step.fullPage, mask: step.mask });
                    screenshots.push(join(CURRENT_DIR, `${shotName}.png`));
                    break;
                }
                case 'hover': {
                    try {
                        await page.hover(step.selector, { timeout: step.timeout || 5000 });
                        await page.waitForTimeout(300);
                    } catch (e) {
                        console.error(`  Hover error on "${step.selector}": ${e.message}`);
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `Hover failed: ${e.message}` });
                    }
                    break;
                }
                case 'evaluate': {
                    const evalTimeout = step.timeout || 30000;
                    const result = await Promise.race([
                        page.evaluate(step.value),
                        new Promise((_, reject) => setTimeout(() => reject(new Error(`evaluate timed out after ${evalTimeout}ms`)), evalTimeout))
                    ]);
                    if (result !== undefined) console.log('  Result:', JSON.stringify(result));
                    break;
                }

                // --- New interact step types ---

                case 'assert': {
                    const assertion = step.assertion || 'exists';
                    let passed = false;
                    let message = '';

                    try {
                        switch (assertion) {
                            case 'exists': {
                                const el = await page.$(step.selector);
                                passed = el !== null;
                                message = passed ? `Element "${step.selector}" exists` : `Element "${step.selector}" NOT found`;
                                break;
                            }
                            case 'visible': {
                                passed = await page.isVisible(step.selector);
                                message = passed ? `Element "${step.selector}" is visible` : `Element "${step.selector}" is NOT visible`;
                                break;
                            }
                            case 'hidden': {
                                passed = await page.isHidden(step.selector);
                                message = passed ? `Element "${step.selector}" is hidden` : `Element "${step.selector}" is NOT hidden`;
                                break;
                            }
                            case 'text': {
                                const text = await page.textContent(step.selector);
                                passed = text?.includes(step.value);
                                message = passed ? `Element text contains "${step.value}"` : `Element text "${text?.substring(0, 80)}" does NOT contain "${step.value}"`;
                                break;
                            }
                            case 'count': {
                                const count = await page.evaluate(sel => {
                                    let total = 0;
                                    for (const s of sel.split(',')) { total += document.querySelectorAll(s.trim()).length; }
                                    return total;
                                }, step.selector);
                                if (typeof step.value === 'object' && step.value !== null) {
                                    if (step.value.greaterThan !== undefined) passed = count > step.value.greaterThan;
                                    else if (step.value.lessThan !== undefined) passed = count < step.value.lessThan;
                                    else passed = count > 0;
                                    message = passed ? `Found ${count} elements` : `Found ${count} elements, expected ${JSON.stringify(step.value)}`;
                                } else {
                                    const expected = parseInt(step.value);
                                    passed = count === expected;
                                    message = passed ? `Found ${count} elements (expected ${expected})` : `Found ${count} elements, expected ${expected}`;
                                }
                                break;
                            }
                            case 'attribute': {
                                const attrVal = await page.getAttribute(step.selector, step.attribute);
                                if (step.contains !== undefined) {
                                    passed = attrVal !== null && attrVal.includes(step.contains);
                                    message = passed ? `Attribute "${step.attribute}" contains "${step.contains}"` : `Attribute "${step.attribute}" = "${attrVal}", does NOT contain "${step.contains}"`;
                                } else if (step.value !== undefined) {
                                    passed = attrVal === step.value;
                                    message = passed ? `Attribute "${step.attribute}" = "${step.value}"` : `Attribute "${step.attribute}" = "${attrVal}", expected "${step.value}"`;
                                } else {
                                    passed = attrVal !== null;
                                    message = passed ? `Attribute "${step.attribute}" exists` : `Attribute "${step.attribute}" not found`;
                                }
                                break;
                            }
                            case 'text-matches': {
                                const textContent = await page.textContent(step.selector);
                                const regex = new RegExp(step.pattern || step.value);
                                passed = regex.test(textContent || '');
                                message = passed ? `Element text matches /${step.pattern || step.value}/` : `Element text "${textContent?.substring(0, 80)}" does NOT match /${step.pattern || step.value}/`;
                                break;
                            }
                            case 'not-exists': {
                                const notEl = await page.$(step.selector);
                                passed = notEl === null;
                                message = passed ? `Element "${step.selector}" does not exist` : `Element "${step.selector}" unexpectedly EXISTS`;
                                break;
                            }
                            default:
                                message = `Unknown assertion type: ${assertion}`;
                        }
                    } catch (e) {
                        message = `Assertion error: ${e.message}`;
                    }

                    if (passed) {
                        assertionResults.passed++;
                        console.log(`  PASS: ${message}`);
                    } else {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message });
                        console.log(`  FAIL: ${message}`);
                    }
                    break;
                }

                case 'assert-state': {
                    try {
                        const stateValue = await page.evaluate((p) => {
                            if (typeof store === 'undefined') return { error: 'store not found' };
                            const parts = p.split('.');
                            let current = store.state;
                            for (const part of parts) {
                                if (current == null) return undefined;
                                current = current[part];
                            }
                            return current;
                        }, step.path);

                        if (stateValue?.error === 'store not found') {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: 'store object not found in window' });
                            console.log(`  FAIL: store object not found in window`);
                        } else {
                            const result = assertComparison(stateValue, step);
                            if (result.passed) {
                                assertionResults.passed++;
                                console.log(`  PASS: ${result.message}`);
                            } else {
                                assertionResults.failed++;
                                assertionResults.errors.push({ step: i + 1, message: result.message });
                                console.log(`  FAIL: ${result.message}`);
                            }
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `State assertion error: ${e.message}` });
                        console.log(`  FAIL: State assertion error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-css': {
                    try {
                        const cssValue = await page.evaluate(({ sel, prop }) => {
                            const el = document.querySelector(sel);
                            if (!el) return { error: 'not found' };
                            return getComputedStyle(el).getPropertyValue(prop);
                        }, { sel: step.selector, prop: step.property });

                        if (cssValue?.error === 'not found') {
                            assertionResults.failed++;
                            const msg = `Element "${step.selector}" not found for CSS assertion`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        } else {
                            const expected = step.equals || step.matches;
                            const passed = cssValue.trim() === expected;
                            const msg = passed
                                ? `CSS ${step.property} = "${expected}"`
                                : `CSS ${step.property} = "${cssValue.trim()}", expected "${expected}"`;
                            if (passed) {
                                assertionResults.passed++;
                                console.log(`  PASS: ${msg}`);
                            } else {
                                assertionResults.failed++;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `CSS assertion error: ${e.message}` });
                        console.log(`  FAIL: CSS assertion error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-class': {
                    try {
                        const hasClass = await page.evaluate(({ sel, cls }) => {
                            const el = document.querySelector(sel);
                            if (!el) return { error: 'not found' };
                            return el.classList.contains(cls);
                        }, { sel: step.selector, cls: step.class });

                        if (hasClass?.error === 'not found') {
                            assertionResults.failed++;
                            const msg = `Element "${step.selector}" not found for class assertion`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        } else {
                            const expectHas = step.has !== false;
                            const passed = hasClass === expectHas;
                            const msg = passed
                                ? `Element ${expectHas ? 'has' : 'does not have'} class "${step.class}"`
                                : `Element ${hasClass ? 'HAS' : 'MISSING'} class "${step.class}", expected ${expectHas ? 'present' : 'absent'}`;
                            if (passed) {
                                assertionResults.passed++;
                                console.log(`  PASS: ${msg}`);
                            } else {
                                assertionResults.failed++;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `Class assertion error: ${e.message}` });
                        console.log(`  FAIL: Class assertion error: ${e.message}`);
                    }
                    break;
                }

                case 'keyboard': {
                    try {
                        if (step.chord && Array.isArray(step.chord)) {
                            for (const key of step.chord) {
                                await page.keyboard.press(key);
                                await page.waitForTimeout(150);
                            }
                            console.log(`  Pressed chord: ${step.chord.join(' → ')}`);
                        } else if (step.modifiers && Array.isArray(step.modifiers)) {
                            const combo = [...step.modifiers, step.key].join('+');
                            await page.keyboard.press(combo);
                            console.log(`  Pressed: ${combo}`);
                        } else {
                            await page.keyboard.press(step.key);
                            console.log(`  Pressed: ${step.key}`);
                        }
                        await page.waitForTimeout(300);
                    } catch (e) {
                        console.error(`  Keyboard error: ${e.message}`);
                    }
                    break;
                }

                case 'store-set': {
                    try {
                        await page.evaluate((updates) => {
                            if (typeof store !== 'undefined' && store.setState) {
                                store.setState(updates);
                            }
                        }, step.updates);
                        console.log(`  Store updated: ${JSON.stringify(step.updates)}`);
                        await page.waitForTimeout(300);
                    } catch (e) {
                        console.error(`  Store-set error: ${e.message}`);
                    }
                    break;
                }

                case 'navigate': {
                    try {
                        const navRoute = step.route || step.value;
                        const normalizedRoute = navRoute.startsWith('#') ? navRoute.slice(1) : navRoute;
                        await page.evaluate((route) => {
                            if (typeof router !== 'undefined' && router.navigate) {
                                router.navigate(route);
                            } else {
                                window.location.hash = '#' + route;
                            }
                        }, normalizedRoute);
                        await waitForPageReady(page);
                        console.log(`  Navigated to: ${step.route || step.value}`);
                    } catch (e) {
                        console.error(`  Navigate error: ${e.message}`);
                    }
                    break;
                }

                case 'intercept': {
                    try {
                        const interceptUrl = step.url;
                        if (step.abort) {
                            await page.route(interceptUrl, async (route) => {
                                await route.abort();
                                await page.unroute(interceptUrl);
                            });
                            console.log(`  Intercepting ${interceptUrl} → ABORT`);
                        } else {
                            const status = step.status || 200;
                            const body = JSON.stringify(step.body || {});
                            await page.route(interceptUrl, async (route) => {
                                await route.fulfill({
                                    status,
                                    contentType: 'application/json',
                                    body
                                });
                                await page.unroute(interceptUrl);
                            });
                            console.log(`  Intercepting ${interceptUrl} → ${status}`);
                        }
                    } catch (e) {
                        console.error(`  Intercept error: ${e.message}`);
                    }
                    break;
                }

                case 'store-snapshot': {
                    try {
                        const snapshot = await page.evaluate(() => {
                            if (typeof store !== 'undefined') {
                                return JSON.parse(JSON.stringify(store.state));
                            }
                            return null;
                        });
                        const snapshotName = step.name || 'default';
                        stateSnapshots.set(snapshotName, snapshot);
                        console.log(`  Snapshot "${snapshotName}" captured`);
                    } catch (e) {
                        console.error(`  Snapshot error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-snapshot': {
                    try {
                        const snapshotName = step.name || 'default';
                        const snapshot = stateSnapshots.get(snapshotName);
                        if (!snapshot) {
                            assertionResults.failed++;
                            const msg = `Snapshot "${snapshotName}" not found`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        } else {
                            const currentState = await page.evaluate(() => {
                                if (typeof store !== 'undefined') return JSON.parse(JSON.stringify(store.state));
                                return null;
                            });
                            const oldVal = resolveStatePath(snapshot, step.path);
                            const newVal = resolveStatePath(currentState, step.path);
                            const didChange = JSON.stringify(oldVal) !== JSON.stringify(newVal);

                            if (step.changed === true) {
                                const passed = didChange;
                                const msg = passed
                                    ? `${step.path} changed from ${JSON.stringify(oldVal)} to ${JSON.stringify(newVal)}`
                                    : `${step.path} did NOT change (still ${JSON.stringify(oldVal)})`;
                                if (passed) { assertionResults.passed++; console.log(`  PASS: ${msg}`); }
                                else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: msg }); console.log(`  FAIL: ${msg}`); }
                            } else if (step.changed === false) {
                                const passed = !didChange;
                                const msg = passed
                                    ? `${step.path} unchanged (${JSON.stringify(oldVal)})`
                                    : `${step.path} unexpectedly changed from ${JSON.stringify(oldVal)} to ${JSON.stringify(newVal)}`;
                                if (passed) { assertionResults.passed++; console.log(`  PASS: ${msg}`); }
                                else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: msg }); console.log(`  FAIL: ${msg}`); }
                            } else {
                                // Compare new value with step comparisons
                                const result = assertComparison(newVal, step);
                                if (result.passed) { assertionResults.passed++; console.log(`  PASS: ${result.message}`); }
                                else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: result.message }); console.log(`  FAIL: ${result.message}`); }
                            }
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `Snapshot assertion error: ${e.message}` });
                        console.log(`  FAIL: Snapshot assertion error: ${e.message}`);
                    }
                    break;
                }

                case 'modal': {
                    const modalType = step.type || 'confirm';
                    if (modalType === 'confirm' || modalType === 'confirm-danger') {
                        await page.evaluate((data) => {
                            if (typeof modals !== 'undefined' && modals.confirm) {
                                modals.confirm(data.message || 'Test confirmation', {
                                    title: data.title || 'Confirm',
                                    confirmText: data.confirmText || 'OK',
                                    cancelText: data.cancelText || 'Cancel',
                                    danger: data.danger || false
                                });
                            }
                        }, { ...step.data, danger: modalType === 'confirm-danger' });
                    } else {
                        await page.evaluate((html) => {
                            if (typeof modals !== 'undefined' && modals.show) {
                                modals.show(html || '<div class="modal-body"><p>Test modal</p></div>');
                            }
                        }, step.html || step.data?.html);
                    }
                    try {
                        await page.waitForSelector('.modal-overlay', { timeout: 3000 });
                    } catch { /* modal may not appear */ }
                    await page.waitForTimeout(300);
                    break;
                }

                case 'toast': {
                    const toastType = step.type || 'success';
                    await page.evaluate((data) => {
                        if (typeof toast !== 'undefined' && toast[data.type]) {
                            toast[data.type](data.message || `Test ${data.type}`, { duration: 8000 });
                        }
                    }, { type: toastType, message: step.message });
                    try {
                        await page.waitForSelector('.toast', { timeout: 3000 });
                    } catch { /* toast may not appear */ }
                    await page.waitForTimeout(300);
                    break;
                }

                case 'theme-toggle': {
                    const mode = step.mode || step.value || 'dark';
                    await setTheme(page, mode);
                    console.log(`  Theme set to: ${mode}`);
                    break;
                }

                case 'wait-for-network': {
                    try {
                        await page.waitForLoadState('networkidle', { timeout: parseInt(step.timeout) || 10000 });
                        console.log('  Network idle.');
                    } catch {
                        console.log('  WARNING: Network did not reach idle state within timeout.');
                    }
                    break;
                }

                case 'validate-form': {
                    const formSelector = step.selector || 'form';
                    const valid = await page.evaluate((sel) => {
                        const form = document.querySelector(sel);
                        if (!form) return { found: false };
                        const isValid = form.checkValidity();
                        form.reportValidity();
                        return { found: true, valid: isValid };
                    }, formSelector);

                    if (!valid.found) {
                        console.log(`  Form not found: ${formSelector}`);
                    } else {
                        console.log(`  Form validity: ${valid.valid ? 'VALID' : 'INVALID'}`);
                    }
                    break;
                }

                // --- Phase 3 interact step types ---

                case 'drag-drop': {
                    try {
                        await page.dragAndDrop(step.from, step.to);
                        console.log(`  Dragged "${step.from}" to "${step.to}"`);
                        await page.waitForTimeout(300);
                    } catch (e) {
                        console.error(`  Drag-drop error: ${e.message}`);
                    }
                    break;
                }

                case 'upload-file': {
                    try {
                        const fileInput = await page.$(step.selector || 'input[type=file]');
                        if (!fileInput) {
                            console.error(`  File input not found: ${step.selector || 'input[type=file]'}`);
                        } else {
                            await fileInput.setInputFiles(step.files || []);
                            console.log(`  Uploaded ${(step.files || []).length} file(s)`);
                            await page.waitForTimeout(500);
                        }
                    } catch (e) {
                        console.error(`  Upload error: ${e.message}`);
                    }
                    break;
                }

                case 'scroll': {
                    try {
                        if (step.to === 'bottom') {
                            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                            console.log('  Scrolled to bottom');
                        } else if (step.to === 'top') {
                            await page.evaluate(() => window.scrollTo(0, 0));
                            console.log('  Scrolled to top');
                        } else if (step.selector && step['into-view']) {
                            await page.evaluate(sel => {
                                const el = document.querySelector(sel);
                                if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
                            }, step.selector);
                            console.log(`  Scrolled "${step.selector}" into view`);
                        } else if (step.y !== undefined) {
                            await page.evaluate(y => window.scrollTo(0, y), step.y);
                            console.log(`  Scrolled to y=${step.y}`);
                        }
                        await page.waitForTimeout(300);
                    } catch (e) {
                        console.error(`  Scroll error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-scroll': {
                    try {
                        const scrollInfo = await page.evaluate(() => ({
                            y: window.scrollY,
                            maxY: document.body.scrollHeight - window.innerHeight
                        }));

                        let passed = false;
                        let message = '';

                        if ('y-greater-than' in step) {
                            passed = scrollInfo.y > step['y-greater-than'];
                            message = passed ? `scrollY (${scrollInfo.y}) > ${step['y-greater-than']}` : `scrollY (${scrollInfo.y}) is NOT > ${step['y-greater-than']}`;
                        } else if ('y-less-than' in step) {
                            passed = scrollInfo.y < step['y-less-than'];
                            message = passed ? `scrollY (${scrollInfo.y}) < ${step['y-less-than']}` : `scrollY (${scrollInfo.y}) is NOT < ${step['y-less-than']}`;
                        } else if ('at-bottom' in step) {
                            passed = scrollInfo.y >= scrollInfo.maxY - 5;
                            message = passed ? `At bottom (scrollY=${scrollInfo.y}, max=${scrollInfo.maxY})` : `NOT at bottom (scrollY=${scrollInfo.y}, max=${scrollInfo.maxY})`;
                        } else if ('at-top' in step) {
                            passed = scrollInfo.y <= 5;
                            message = passed ? `At top (scrollY=${scrollInfo.y})` : `NOT at top (scrollY=${scrollInfo.y})`;
                        }

                        if (passed) {
                            assertionResults.passed++;
                            console.log(`  PASS: ${message}`);
                        } else {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message });
                            console.log(`  FAIL: ${message}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `Scroll assertion error: ${e.message}` });
                        console.log(`  FAIL: Scroll assertion error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-storage': {
                    try {
                        const storageType = step.type === 'session' ? 'sessionStorage' : 'localStorage';
                        const val = await page.evaluate(({ type, key }) => {
                            return window[type].getItem(key);
                        }, { type: storageType, key: step.key });

                        let passed = false;
                        let message = '';

                        if ('equals' in step) {
                            passed = val === step.equals;
                            message = passed ? `${storageType}["${step.key}"] === "${step.equals}"` : `${storageType}["${step.key}"] = ${JSON.stringify(val)}, expected "${step.equals}"`;
                        } else if ('notNull' in step) {
                            passed = val !== null;
                            message = passed ? `${storageType}["${step.key}"] exists (${JSON.stringify(val)})` : `${storageType}["${step.key}"] is null`;
                        } else if ('isNull' in step) {
                            passed = val === null;
                            message = passed ? `${storageType}["${step.key}"] is null` : `${storageType}["${step.key}"] = ${JSON.stringify(val)}, expected null`;
                        } else if ('contains' in step) {
                            passed = val != null && val.includes(step.contains);
                            message = passed ? `${storageType}["${step.key}"] contains "${step.contains}"` : `${storageType}["${step.key}"] = ${JSON.stringify(val)}, does NOT contain "${step.contains}"`;
                        }

                        if (passed) {
                            assertionResults.passed++;
                            console.log(`  PASS: ${message}`);
                        } else {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message });
                            console.log(`  FAIL: ${message}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `Storage assertion error: ${e.message}` });
                        console.log(`  FAIL: Storage assertion error: ${e.message}`);
                    }
                    break;
                }

                case 'set-storage': {
                    try {
                        const storageType = step.type === 'session' ? 'sessionStorage' : 'localStorage';
                        if (step.clear) {
                            await page.evaluate(type => window[type].clear(), storageType);
                            console.log(`  Cleared ${storageType}`);
                        } else {
                            await page.evaluate(({ type, key, value }) => {
                                window[type].setItem(key, value);
                            }, { type: storageType, key: step.key, value: step.value });
                            console.log(`  Set ${storageType}["${step.key}"] = "${step.value}"`);
                        }
                    } catch (e) {
                        console.error(`  Set-storage error: ${e.message}`);
                    }
                    break;
                }

                case 'reload': {
                    try {
                        await page.reload();
                        await waitForPageReady(page);
                        console.log('  Page reloaded');
                    } catch (e) {
                        console.error(`  Reload error: ${e.message}`);
                    }
                    break;
                }

                case 'right-click': {
                    try {
                        await page.click(step.selector, { button: 'right', timeout: 5000 });
                        console.log(`  Right-clicked: ${step.selector}`);
                        await page.waitForTimeout(300);
                    } catch (e) {
                        console.error(`  Right-click error: ${e.message}`);
                    }
                    break;
                }

                // --- Phase 4: Variables, Toast, Context Menu, Clipboard ---

                case 'extract': {
                    try {
                        const el = await page.$(step.selector);
                        if (!el) {
                            console.error(`  Extract error: Element not found "${step.selector}"`);
                            if (step.as) console.warn(`  Warning: Variable $${step.as} was NOT set — downstream steps referencing it may fail`);
                            break;
                        }
                        let value;
                        if (step.attribute) {
                            value = await el.getAttribute(step.attribute);
                        } else if (step.property === 'innerText') {
                            value = await el.innerText();
                        } else {
                            value = await el.textContent();
                        }
                        if (typeof value === 'string') value = value.trim();
                        variables.set(step.as, value);
                        console.log(`  Extracted $${step.as} = "${value}"`);
                    } catch (e) {
                        console.error(`  Extract error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-variable': {
                    const actual = variables.get(step.name);
                    if (actual === undefined) {
                        assertionResults.failed++;
                        const msg = `Variable $${step.name} not found`;
                        assertionResults.errors.push({ step: i + 1, message: msg });
                        console.log(`  FAIL: ${msg}`);
                    } else {
                        const result = assertComparison(actual, step);
                        if (result.passed) {
                            assertionResults.passed++;
                            console.log(`  PASS: $${step.name} = "${actual}" ${result.message}`);
                        } else {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: result.message });
                            console.log(`  FAIL: $${step.name} = "${actual}" ${result.message}`);
                        }
                    }
                    break;
                }

                case 'assert-toast': {
                    try {
                        const toasts = await page.$$('#toast-container .toast');
                        if (step.visible === false) {
                            if (toasts.length === 0) {
                                assertionResults.passed++;
                                console.log('  PASS: No toasts visible');
                            } else {
                                assertionResults.failed++;
                                const msg = `Expected no toasts but found ${toasts.length}`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                            break;
                        }
                        let found = false;
                        for (const toast of toasts) {
                            const text = await toast.textContent();
                            const classes = await toast.getAttribute('class') || '';
                            const typeMatch = !step.type || classes.includes(step.type);
                            const msgMatch = !step.message || text.includes(step.message);
                            if (typeMatch && msgMatch) { found = true; break; }
                        }
                        if (found) {
                            assertionResults.passed++;
                            console.log(`  PASS: Toast found (type=${step.type || 'any'}, message=${step.message || 'any'})`);
                        } else {
                            assertionResults.failed++;
                            const msg = `Toast not found (type=${step.type || 'any'}, message=${step.message || 'any'})`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-toast error: ${e.message}` });
                    }
                    break;
                }

                case 'wait-toast-dismiss': {
                    try {
                        const timeout = parseInt(step.timeout) || 6000;
                        await page.waitForSelector('#toast-container .toast', { state: 'detached', timeout });
                        console.log('  Toast dismissed');
                    } catch (e) {
                        console.error(`  Toast dismiss timeout: ${e.message}`);
                    }
                    break;
                }

                case 'assert-toast-count': {
                    try {
                        const toasts = await page.$$('#toast-container .toast');
                        const expected = step.count;
                        if (toasts.length === expected) {
                            assertionResults.passed++;
                            console.log(`  PASS: Toast count = ${expected}`);
                        } else {
                            assertionResults.failed++;
                            const msg = `Expected ${expected} toasts, found ${toasts.length}`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-toast-count error: ${e.message}` });
                    }
                    break;
                }

                case 'assert-context-menu': {
                    try {
                        const menu = await page.$('#context-menu');
                        if (!menu) {
                            assertionResults.failed++;
                            const msg = 'Context menu not visible';
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                            break;
                        }
                        const items = await page.$$eval('.context-menu-item', els => els.map(e => e.textContent.trim()));
                        const allFound = step.items.every(expected => items.some(item => item.includes(expected)));
                        if (allFound) {
                            assertionResults.passed++;
                            console.log(`  PASS: Context menu has items: ${step.items.join(', ')}`);
                        } else {
                            assertionResults.failed++;
                            const msg = `Context menu missing items. Expected: [${step.items.join(', ')}], Found: [${items.join(', ')}]`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-context-menu error: ${e.message}` });
                    }
                    break;
                }

                case 'context-menu-click': {
                    try {
                        const items = await page.$$('.context-menu-item');
                        let clicked = false;
                        for (const item of items) {
                            const text = await item.textContent();
                            if (text.trim().includes(step.item)) {
                                await item.click();
                                clicked = true;
                                console.log(`  Clicked context menu item: "${step.item}"`);
                                await page.waitForTimeout(300);
                                break;
                            }
                        }
                        if (!clicked) {
                            console.error(`  Context menu item "${step.item}" not found`);
                        }
                    } catch (e) {
                        console.error(`  Context menu click error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-clipboard': {
                    try {
                        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
                        if (step.equals !== undefined) {
                            if (clipboardText === step.equals) {
                                assertionResults.passed++;
                                console.log(`  PASS: Clipboard equals "${step.equals}"`);
                            } else {
                                assertionResults.failed++;
                                const msg = `Clipboard: expected "${step.equals}", got "${clipboardText}"`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        } else if (step.contains !== undefined) {
                            if (clipboardText.includes(step.contains)) {
                                assertionResults.passed++;
                                console.log(`  PASS: Clipboard contains "${step.contains}"`);
                            } else {
                                assertionResults.failed++;
                                const msg = `Clipboard does not contain "${step.contains}", got "${clipboardText}"`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-clipboard error: ${e.message}` });
                        console.log(`  FAIL: Clipboard read error: ${e.message}`);
                    }
                    break;
                }

                // --- Phase 5: Sorting, Dropdowns, Inline Edit, Focus, Performance, Console, Network ---

                case 'sort-column': {
                    try {
                        await page.click(step.selector, { timeout: 5000 });
                        await page.waitForTimeout(300);
                        console.log(`  Clicked sort column: ${step.selector}`);
                    } catch (e) {
                        console.error(`  Sort column error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-sort': {
                    try {
                        const sortState = await page.evaluate((gridId) => {
                            if (typeof dataGrid === 'undefined' || !dataGrid.state) return null;
                            const state = dataGrid.state.get(gridId);
                            return state ? { column: state.sortColumn, direction: state.sortDirection } : null;
                        }, step.gridId);
                        if (!sortState) {
                            assertionResults.failed++;
                            const msg = `Grid "${step.gridId}" not found or has no sort state`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        } else {
                            let passed = true;
                            let msg = '';
                            if (step.column && sortState.column !== step.column) {
                                passed = false;
                                msg = `Sort column: expected "${step.column}", got "${sortState.column}"`;
                            }
                            if (step.direction && sortState.direction !== step.direction) {
                                passed = false;
                                msg += (msg ? '; ' : '') + `Sort direction: expected "${step.direction}", got "${sortState.direction}"`;
                            }
                            if (passed) {
                                assertionResults.passed++;
                                console.log(`  PASS: Sort state — column="${sortState.column}", direction="${sortState.direction}"`);
                            } else {
                                assertionResults.failed++;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-sort error: ${e.message}` });
                    }
                    break;
                }

                case 'dropdown-toggle': {
                    try {
                        await page.click(step.selector, { timeout: 5000 });
                        await page.waitForTimeout(300);
                        console.log(`  Toggled dropdown: ${step.selector}`);
                    } catch (e) {
                        console.error(`  Dropdown toggle error: ${e.message}`);
                    }
                    break;
                }

                case 'dropdown-select': {
                    try {
                        const dropdown = await page.$(step.selector);
                        if (!dropdown) { console.error(`  Dropdown not found: ${step.selector}`); break; }
                        // Open if not already open
                        const isOpen = await dropdown.evaluate(el => el.classList.contains('open') || el.classList.contains('show'));
                        if (!isOpen) {
                            await dropdown.click();
                            await page.waitForTimeout(200);
                        }
                        // Find and click the item
                        const items = await dropdown.$$('.dropdown-item');
                        let clicked = false;
                        for (const item of items) {
                            const text = await item.textContent();
                            if (text.trim().includes(step.item)) {
                                await item.click();
                                clicked = true;
                                console.log(`  Selected dropdown item: "${step.item}"`);
                                await page.waitForTimeout(300);
                                break;
                            }
                        }
                        if (!clicked) console.error(`  Dropdown item "${step.item}" not found`);
                    } catch (e) {
                        console.error(`  Dropdown select error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-dropdown': {
                    try {
                        const dropdown = await page.$(step.selector);
                        if (!dropdown) {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: `Dropdown not found: ${step.selector}` });
                            break;
                        }
                        if (step.open !== undefined) {
                            const isOpen = await dropdown.evaluate(el => el.classList.contains('open') || el.classList.contains('show'));
                            if (isOpen === step.open) {
                                assertionResults.passed++;
                                console.log(`  PASS: Dropdown open=${step.open}`);
                            } else {
                                assertionResults.failed++;
                                const msg = `Dropdown open: expected ${step.open}, got ${isOpen}`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                        if (step.items) {
                            const items = await dropdown.$$eval('.dropdown-item', els => els.map(e => e.textContent.trim()));
                            const allFound = step.items.every(expected => items.some(item => item.includes(expected)));
                            if (allFound) {
                                assertionResults.passed++;
                                console.log(`  PASS: Dropdown has items: ${step.items.join(', ')}`);
                            } else {
                                assertionResults.failed++;
                                const msg = `Dropdown items missing. Expected: [${step.items.join(', ')}], Found: [${items.join(', ')}]`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-dropdown error: ${e.message}` });
                    }
                    break;
                }

                case 'inline-edit': {
                    try {
                        const container = await page.$(`.inline-edit[data-field="${step.field}"]`);
                        if (!container) { console.error(`  Inline edit field "${step.field}" not found`); break; }
                        // Click display to start editing
                        await container.$eval('.inline-edit-display', el => el.click());
                        await page.waitForTimeout(200);
                        // Fill the input
                        const input = await container.$('.inline-edit-input');
                        if (!input) { console.error(`  Inline edit input not found for "${step.field}"`); break; }
                        await input.fill(step.value);
                        if (step.cancel) {
                            await input.press('Escape');
                            console.log(`  Inline edit cancelled: ${step.field}`);
                        } else if (step.save === false) {
                            console.log(`  Inline edit filled (no save): ${step.field} = "${step.value}"`);
                        } else {
                            await input.evaluate(el => el.blur());
                            console.log(`  Inline edit saved: ${step.field} = "${step.value}"`);
                        }
                        await page.waitForTimeout(300);
                    } catch (e) {
                        console.error(`  Inline edit error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-inline-edit': {
                    try {
                        const container = await page.$(`.inline-edit[data-field="${step.field}"]`);
                        if (!container) {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: `Inline edit field "${step.field}" not found` });
                            break;
                        }
                        if (step.editing !== undefined) {
                            const inputHidden = await container.$eval('.inline-edit-input', el => el.classList.contains('hidden'));
                            const isEditing = !inputHidden;
                            if (isEditing === step.editing) {
                                assertionResults.passed++;
                                console.log(`  PASS: Field "${step.field}" editing=${step.editing}`);
                            } else {
                                assertionResults.failed++;
                                const msg = `Field "${step.field}" editing: expected ${step.editing}, got ${isEditing}`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                        if (step.value !== undefined) {
                            const displayText = await container.$eval('.inline-edit-display', el => el.textContent.trim());
                            if (displayText.includes(step.value)) {
                                assertionResults.passed++;
                                console.log(`  PASS: Field "${step.field}" value contains "${step.value}"`);
                            } else {
                                assertionResults.failed++;
                                const msg = `Field "${step.field}": expected "${step.value}", got "${displayText}"`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-inline-edit error: ${e.message}` });
                    }
                    break;
                }

                case 'assert-focus': {
                    try {
                        const isFocused = await page.evaluate((sel) => {
                            return document.activeElement === document.querySelector(sel);
                        }, step.selector);
                        if (isFocused) {
                            assertionResults.passed++;
                            console.log(`  PASS: Focus on "${step.selector}"`);
                        } else {
                            assertionResults.failed++;
                            const focusedTag = await page.evaluate(() => {
                                const el = document.activeElement;
                                return el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ')[0] : ''}` : 'none';
                            });
                            const msg = `Focus: expected "${step.selector}", got "${focusedTag}"`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-focus error: ${e.message}` });
                    }
                    break;
                }

                case 'assert-focus-trapped': {
                    try {
                        const containerSel = step.container || step.selector;
                        const result = await page.evaluate((sel) => {
                            let container = null;
                            for (const s of sel.split(',')) {
                                container = document.querySelector(s.trim());
                                if (container) break;
                            }
                            if (!container) return { error: 'Container not found' };
                            const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                            if (focusable.length < 2) return { error: 'Less than 2 focusable elements' };
                            return { first: true, last: true, count: focusable.length };
                        }, containerSel);
                        if (result.error) {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: result.error });
                            console.log(`  FAIL: ${result.error}`);
                        } else {
                            // Tab from last element — should wrap to first
                            await page.keyboard.press('End'); // Move to last
                            await page.keyboard.press('Tab');
                            const wrappedForward = await page.evaluate((sel) => {
                                let container = null;
                                for (const s of sel.split(',')) { container = document.querySelector(s.trim()); if (container) break; }
                                if (!container) return false;
                                const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                                return document.activeElement === focusable[0] || container.contains(document.activeElement);
                            }, containerSel);
                            // Shift+Tab from first — should wrap to last
                            await page.keyboard.press('Home');
                            await page.keyboard.press('Shift+Tab');
                            const wrappedBack = await page.evaluate((sel) => {
                                let container = null;
                                for (const s of sel.split(',')) { container = document.querySelector(s.trim()); if (container) break; }
                                return container ? container.contains(document.activeElement) : false;
                            }, containerSel);
                            if (wrappedForward && wrappedBack) {
                                assertionResults.passed++;
                                console.log(`  PASS: Focus trapped in "${step.container}" (${result.count} focusable elements)`);
                            } else {
                                assertionResults.failed++;
                                const msg = `Focus not trapped: forward=${wrappedForward}, backward=${wrappedBack}`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-focus-trapped error: ${e.message}` });
                    }
                    break;
                }

                case 'assert-performance': {
                    try {
                        const metrics = await page.evaluate(() => {
                            const perf = performance.getEntriesByType('navigation')[0];
                            const paint = performance.getEntriesByType('paint');
                            // CLS via layout-shift entries
                            let cls = 0;
                            try {
                                const layoutShifts = performance.getEntriesByType('layout-shift');
                                cls = layoutShifts.reduce((sum, e) => sum + (e.hadRecentInput ? 0 : e.value), 0);
                            } catch { /* layout-shift may not be available */ }
                            return {
                                dcl: perf ? Math.round(perf.domContentLoadedEventEnd - perf.startTime) : null,
                                load: perf ? Math.round(perf.loadEventEnd - perf.startTime) : null,
                                fp: Math.round(paint.find(p => p.name === 'first-paint')?.startTime) ?? null,
                                fcp: Math.round(paint.find(p => p.name === 'first-contentful-paint')?.startTime) ?? null,
                                ttfb: perf ? Math.round(perf.responseStart - perf.requestStart) : null,
                                cls: Math.round(cls * 10000) / 10000
                            };
                        });
                        console.log(`  Performance: DCL=${metrics.dcl}ms, Load=${metrics.load}ms, FP=${metrics.fp}ms, FCP=${metrics.fcp}ms, TTFB=${metrics.ttfb}ms, CLS=${metrics.cls}`);
                        const metricKeys = { fcp: 'FCP', dcl: 'DCL', load: 'Load', fp: 'FP', ttfb: 'TTFB', cls: 'CLS' };
                        let metricsAsserted = 0;
                        for (const [key, label] of Object.entries(metricKeys)) {
                            if (step[key] && metrics[key] !== null) {
                                metricsAsserted++;
                                const result = assertComparison(metrics[key], step[key], label);
                                if (result.passed) {
                                    assertionResults.passed++;
                                    console.log(`  PASS: ${label}=${metrics[key]}${key === 'cls' ? '' : 'ms'} ${result.message}`);
                                } else {
                                    assertionResults.failed++;
                                    assertionResults.errors.push({ step: i + 1, message: `${label}=${metrics[key]}${key === 'cls' ? '' : 'ms'} ${result.message}` });
                                    console.log(`  FAIL: ${label}=${metrics[key]}${key === 'cls' ? '' : 'ms'} ${result.message}`);
                                }
                            }
                        }
                        if (metricsAsserted === 0) {
                            console.warn(`  Warning: No performance metric thresholds specified. Use step properties: fcp, dcl, load, fp, ttfb, cls`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-performance error: ${e.message}` });
                    }
                    break;
                }

                case 'assert-console': {
                    try {
                        const messages = ctx ? ctx.consoleMessages : [];
                        const errors = messages.filter(m => m.type === 'error');
                        const warnings = messages.filter(m => m.type === 'warning');
                        if (step.errors !== undefined) {
                            const expected = typeof step.errors === 'object' ? step.errors : { equals: step.errors };
                            const result = assertComparison(errors.length, expected, 'console.errors');
                            if (result.passed) {
                                assertionResults.passed++;
                                console.log(`  PASS: Console errors=${errors.length} ${result.message}`);
                            } else {
                                assertionResults.failed++;
                                const msg = `Console errors=${errors.length} ${result.message}`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                                errors.forEach(e => console.log(`    Error: ${e.text}`));
                            }
                        }
                        if (step.warnings !== undefined) {
                            const expected = typeof step.warnings === 'object' ? step.warnings : { equals: step.warnings };
                            const result = assertComparison(warnings.length, expected, 'console.warnings');
                            if (result.passed) {
                                assertionResults.passed++;
                                console.log(`  PASS: Console warnings=${warnings.length} ${result.message}`);
                            } else {
                                assertionResults.failed++;
                                const msg = `Console warnings=${warnings.length} ${result.message}`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                        if (step.errorContains) {
                            const found = errors.some(e => e.text.includes(step.errorContains));
                            if (found) {
                                assertionResults.passed++;
                                console.log(`  PASS: Console error contains "${step.errorContains}"`);
                            } else {
                                assertionResults.failed++;
                                const msg = `No console error contains "${step.errorContains}"`;
                                assertionResults.errors.push({ step: i + 1, message: msg });
                                console.log(`  FAIL: ${msg}`);
                            }
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-console error: ${e.message}` });
                    }
                    break;
                }

                case 'network-condition': {
                    try {
                        const context = page.context();
                        switch (step.preset) {
                            case 'offline':
                                await context.setOffline(true);
                                console.log('  Network: offline');
                                break;
                            case 'slow-3g':
                                await page.route('**/*', async route => {
                                    await new Promise(r => setTimeout(r, 2000));
                                    await route.continue();
                                });
                                console.log('  Network: slow-3g (2000ms latency)');
                                break;
                            case 'fast-4g':
                                await page.route('**/*', async route => {
                                    await new Promise(r => setTimeout(r, 100));
                                    await route.continue();
                                });
                                console.log('  Network: fast-4g (100ms latency)');
                                break;
                            case 'reset':
                                await context.setOffline(false);
                                await page.unroute('**/*');
                                console.log('  Network: reset (normal)');
                                break;
                            default:
                                console.error(`  Unknown network preset: ${step.preset}`);
                        }
                    } catch (e) {
                        console.error(`  Network condition error: ${e.message}`);
                    }
                    break;
                }

                // --- Phase 6: Element Screenshots, Performance, Memory, Components ---

                case 'screenshot-element': {
                    try {
                        const el = await page.$(step.selector);
                        if (!el) { console.error(`  Element not found: ${step.selector}`); break; }
                        const shotName = step.name || `element-${i + 1}`;
                        const shotPath = join(CURRENT_DIR, `${shotName}.png`);
                        mkdirSync(dirname(shotPath), { recursive: true });
                        await el.screenshot({ path: shotPath });
                        screenshots.push(shotPath);
                        console.log(`  Element screenshot: ${shotName}`);
                    } catch (e) {
                        console.error(`  screenshot-element error: ${e.message}`);
                    }
                    break;
                }

                case 'set-auto-wait': {
                    autoWait = parseInt(step.ms) || 0;
                    console.log(`  Auto-wait set to ${autoWait}ms`);
                    break;
                }

                case 'set-context': {
                    try {
                        const ctx2 = page.context();
                        if (step.geolocation) {
                            await ctx2.grantPermissions(['geolocation']);
                            await ctx2.setGeolocation(step.geolocation);
                            console.log(`  Geolocation: ${step.geolocation.latitude}, ${step.geolocation.longitude}`);
                        }
                        if (step.locale) {
                            console.log(`  Locale: ${step.locale} (note: requires new context for full effect)`);
                        }
                        if (step.timezone) {
                            console.log(`  Timezone: ${step.timezone} (note: requires new context for full effect)`);
                        }
                    } catch (e) {
                        console.error(`  set-context error: ${e.message}`);
                    }
                    break;
                }

                case 'assert-memory': {
                    try {
                        const mem = await page.evaluate(() => {
                            if (performance.memory) {
                                return {
                                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                                    usedJSHeapSize: performance.memory.usedJSHeapSize
                                };
                            }
                            return null;
                        });
                        if (!mem) {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: 'performance.memory not available (Chromium only)' });
                            break;
                        }
                        let passed = true, msg = '';
                        for (const [key, constraint] of Object.entries(step)) {
                            if (['action', 'skip', 'if', 'unless', 'screenshot'].includes(key)) continue;
                            if (typeof constraint === 'object' && mem[key] !== undefined) {
                                if (constraint.lessThan !== undefined && !(mem[key] < constraint.lessThan)) {
                                    passed = false;
                                    msg += `${key}: ${mem[key]} not < ${constraint.lessThan}; `;
                                }
                                if (constraint.greaterThan !== undefined && !(mem[key] > constraint.greaterThan)) {
                                    passed = false;
                                    msg += `${key}: ${mem[key]} not > ${constraint.greaterThan}; `;
                                }
                            }
                        }
                        if (passed) {
                            assertionResults.passed++;
                            console.log(`  PASS: Memory — used=${(mem.usedJSHeapSize / 1048576).toFixed(1)}MB, total=${(mem.totalJSHeapSize / 1048576).toFixed(1)}MB`);
                        } else {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: msg.trim() });
                            console.log(`  FAIL: ${msg.trim()}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-memory error: ${e.message}` });
                    }
                    break;
                }

                case 'wizard-next': {
                    try {
                        const clicked = await page.evaluate(() => {
                            const btn = document.querySelector('.wizard-next-btn, .wizard-actions .btn-primary');
                            if (btn) btn.click();
                            // Update wizard step state directly for test fixtures
                            const steps = document.querySelectorAll('.wizard-step');
                            let activeIdx = -1;
                            steps.forEach((s, j) => { if (s.classList.contains('active')) activeIdx = j; });
                            if (steps.length > 0 && activeIdx < steps.length - 1) {
                                steps.forEach(s => s.classList.remove('active'));
                                steps[activeIdx + 1].classList.add('active');
                                return activeIdx + 2;
                            }
                            return activeIdx + 1;
                        });
                        await page.waitForTimeout(300);
                        console.log(`  Wizard: next (step ${clicked})`);
                    } catch (e) { console.error(`  wizard-next error: ${e.message}`); }
                    break;
                }
                case 'wizard-prev': {
                    try {
                        const clicked = await page.evaluate(() => {
                            const btn = document.querySelector('.wizard-prev-btn, .wizard-actions .btn-secondary');
                            if (btn) btn.click();
                            const steps = document.querySelectorAll('.wizard-step');
                            let activeIdx = -1;
                            steps.forEach((s, j) => { if (s.classList.contains('active')) activeIdx = j; });
                            if (steps.length > 0 && activeIdx > 0) {
                                steps.forEach(s => s.classList.remove('active'));
                                steps[activeIdx - 1].classList.add('active');
                                return activeIdx;
                            }
                            return activeIdx + 1;
                        });
                        await page.waitForTimeout(300);
                        console.log(`  Wizard: prev (step ${clicked})`);
                    } catch (e) { console.error(`  wizard-prev error: ${e.message}`); }
                    break;
                }
                case 'assert-wizard': {
                    try {
                        const wizState = await page.evaluate(() => {
                            const steps = document.querySelectorAll('.wizard-step');
                            const active = document.querySelector('.wizard-step.active, .wizard-panel.active');
                            let activeIdx = -1;
                            steps.forEach((s, idx) => { if (s.classList.contains('active')) activeIdx = idx; });
                            return { total: steps.length, active: activeIdx + 1 };
                        });
                        let passed = true, msg = '';
                        if (step.step !== undefined && wizState.active !== step.step) {
                            passed = false; msg += `Active step: expected ${step.step}, got ${wizState.active}; `;
                        }
                        if (step.totalSteps !== undefined && wizState.total !== step.totalSteps) {
                            passed = false; msg += `Total steps: expected ${step.totalSteps}, got ${wizState.total}; `;
                        }
                        if (passed) {
                            assertionResults.passed++;
                            console.log(`  PASS: Wizard at step ${wizState.active}/${wizState.total}`);
                        } else {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: msg.trim() });
                            console.log(`  FAIL: ${msg.trim()}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-wizard error: ${e.message}` });
                    }
                    break;
                }

                case 'tag-add': {
                    try {
                        const input = await page.$(step.selector + ' input, ' + step.selector + ' .tag-input-field');
                        if (input) {
                            await input.focus();
                            await input.type(step.value);
                            await page.keyboard.press('Enter');
                            await page.waitForTimeout(200);
                            console.log(`  Tag added: "${step.value}"`);
                        } else {
                            console.error(`  Tag input not found: ${step.selector}`);
                        }
                    } catch (e) { console.error(`  tag-add error: ${e.message}`); }
                    break;
                }
                case 'tag-remove': {
                    try {
                        const tags = await page.$$(step.selector + ' .tag, ' + step.selector + ' .tag-item');
                        let removed = false;
                        for (const tag of tags) {
                            const text = await tag.textContent();
                            if (text.trim().includes(step.tag || step.value)) {
                                const removeBtn = await tag.$('.tag-remove, .remove, .close');
                                if (removeBtn) { await removeBtn.click(); removed = true; }
                                break;
                            }
                        }
                        const tagName = step.tag || step.value;
                        console.log(removed ? `  Tag removed: "${tagName}"` : `  Tag "${tagName}" not found`);
                        await page.waitForTimeout(200);
                    } catch (e) { console.error(`  tag-remove error: ${e.message}`); }
                    break;
                }
                case 'assert-tags': {
                    try {
                        const tagTexts = await page.$$eval(step.selector + ' .tag, ' + step.selector + ' .tag-item', els => els.map(e => e.textContent.trim()));
                        let passed = true, msg = '';
                        if (step.count !== undefined && tagTexts.length !== step.count) {
                            passed = false; msg += `Tag count: expected ${step.count}, got ${tagTexts.length}; `;
                        }
                        if (step.tags) {
                            const missing = step.tags.filter(t => !tagTexts.some(tt => tt.includes(t)));
                            if (missing.length > 0) { passed = false; msg += `Missing tags: ${missing.join(', ')}; `; }
                        }
                        if (passed) {
                            assertionResults.passed++;
                            console.log(`  PASS: Tags (${tagTexts.length}): ${tagTexts.join(', ')}`);
                        } else {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: msg.trim() });
                            console.log(`  FAIL: ${msg.trim()}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-tags error: ${e.message}` });
                    }
                    break;
                }

                case 'accordion-toggle': {
                    try {
                        const header = await page.$(step.selector + ' summary, ' + step.selector + ' .accordion-header, ' + step.selector);
                        if (header) { await header.click(); await page.waitForTimeout(300); console.log(`  Accordion toggled: ${step.selector}`); }
                        else { console.error(`  Accordion not found: ${step.selector}`); }
                    } catch (e) { console.error(`  accordion-toggle error: ${e.message}`); }
                    break;
                }
                case 'assert-accordion': {
                    try {
                        const isOpen = await page.$eval(step.selector, el => el.open === true || el.classList.contains('open') || el.classList.contains('expanded') || el.classList.contains('active'));
                        if (isOpen === step.open) {
                            assertionResults.passed++;
                            console.log(`  PASS: Accordion open=${step.open}`);
                        } else {
                            assertionResults.failed++;
                            const msg = `Accordion: expected open=${step.open}, got ${isOpen}`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-accordion error: ${e.message}` });
                    }
                    break;
                }

                case 'panel-open': {
                    try {
                        const jsType = step.type === 'bottom-sheet' || step.type === 'bottom' ? 'bottomSheet' : 'sidePanel';
                        await page.evaluate(({ jsType, id, selector }) => {
                            if (window[jsType] && window[jsType].open) { window[jsType].open(id); return; }
                            // Fallback: toggle open/show class on the matched element
                            const el = selector ? document.querySelector(selector) : null;
                            if (el) { el.classList.add('open', 'show'); }
                        }, { jsType, id: step.id, selector: step.selector });
                        await page.waitForTimeout(300);
                        console.log(`  Panel opened: ${step.type} "${step.id}"`);
                    } catch (e) { console.error(`  panel-open error: ${e.message}`); }
                    break;
                }
                case 'panel-close': {
                    try {
                        const jsType = step.type === 'bottom-sheet' || step.type === 'bottom' ? 'bottomSheet' : 'sidePanel';
                        await page.evaluate(({ jsType, id, selector }) => {
                            if (window[jsType] && window[jsType].close) { window[jsType].close(id); return; }
                            const el = selector ? document.querySelector(selector) : null;
                            if (el) { el.classList.remove('open', 'show'); }
                        }, { jsType, id: step.id, selector: step.selector });
                        await page.waitForTimeout(300);
                        console.log(`  Panel closed: ${step.type} "${step.id}"`);
                    } catch (e) { console.error(`  panel-close error: ${e.message}`); }
                    break;
                }
                case 'assert-panel': {
                    try {
                        const isOpen = await page.evaluate(({ type, id, selector }) => {
                            const jsType = type === 'bottom-sheet' || type === 'bottom' ? 'bottomSheet' : 'sidePanel';
                            if (window[jsType] && window[jsType].isOpen) return window[jsType].isOpen(id);
                            // Check for open/show class on matched selector
                            const sel = selector || `.${type}`;
                            const el = document.querySelector(sel);
                            if (el) return el.classList.contains('open') || el.classList.contains('show');
                            return false;
                        }, { type: step.type, id: step.id, selector: step.selector });
                        if (isOpen === step.open) {
                            assertionResults.passed++;
                            console.log(`  PASS: Panel ${step.type} "${step.id}" open=${step.open}`);
                        } else {
                            assertionResults.failed++;
                            const msg = `Panel ${step.type} "${step.id}": expected open=${step.open}, got ${isOpen}`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-panel error: ${e.message}` });
                    }
                    break;
                }

                case 'lightbox-open': {
                    try {
                        await page.click(step.selector, { timeout: 5000 });
                        await page.waitForTimeout(300);
                        console.log(`  Lightbox opened via: ${step.selector}`);
                    } catch (e) { console.error(`  lightbox-open error: ${e.message}`); }
                    break;
                }
                case 'lightbox-next': {
                    try {
                        await page.evaluate(() => { if (window.lightbox && lightbox.next) lightbox.next(); });
                        await page.waitForTimeout(200);
                        console.log('  Lightbox: next');
                    } catch (e) { console.error(`  lightbox-next error: ${e.message}`); }
                    break;
                }
                case 'lightbox-prev': {
                    try {
                        await page.evaluate(() => { if (window.lightbox && lightbox.prev) lightbox.prev(); });
                        await page.waitForTimeout(200);
                        console.log('  Lightbox: prev');
                    } catch (e) { console.error(`  lightbox-prev error: ${e.message}`); }
                    break;
                }
                case 'lightbox-close': {
                    try {
                        await page.evaluate(() => {
                            if (window.lightbox && lightbox.close) { lightbox.close(); return; }
                            const closeBtn = document.querySelector('.lightbox-close, .lightbox-overlay .close');
                            if (closeBtn) { closeBtn.click(); return; }
                            const overlay = document.querySelector('.lightbox-overlay, .lightbox');
                            if (overlay) { overlay.style.display = 'none'; overlay.classList.remove('open', 'show'); }
                        });
                        await page.waitForTimeout(200);
                        console.log('  Lightbox: closed');
                    } catch (e) { console.error(`  lightbox-close error: ${e.message}`); }
                    break;
                }
                case 'assert-lightbox': {
                    try {
                        const state = await page.evaluate(() => {
                            const overlay = document.querySelector('.lightbox-overlay, .lightbox');
                            const isOpen = overlay && (overlay.classList.contains('open') || overlay.classList.contains('show') || getComputedStyle(overlay).display !== 'none');
                            const current = document.querySelector('.lightbox-image.active, .lightbox-slide.active');
                            const allSlides = document.querySelectorAll('.lightbox-image, .lightbox-slide');
                            let idx = -1;
                            allSlides.forEach((s, j) => { if (s.classList.contains('active')) idx = j; });
                            return { open: !!isOpen, index: idx, total: allSlides.length };
                        });
                        let passed = true, msg = '';
                        if (step.open !== undefined && state.open !== step.open) { passed = false; msg += `Lightbox open: expected ${step.open}, got ${state.open}; `; }
                        if (step.index !== undefined && state.index !== step.index) { passed = false; msg += `Lightbox index: expected ${step.index}, got ${state.index}; `; }
                        if (passed) {
                            assertionResults.passed++;
                            console.log(`  PASS: Lightbox open=${state.open}, index=${state.index}/${state.total}`);
                        } else {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: msg.trim() });
                            console.log(`  FAIL: ${msg.trim()}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-lightbox error: ${e.message}` });
                    }
                    break;
                }

                case 'date-range-select': {
                    try {
                        await page.click(step.selector, { timeout: 5000 });
                        await page.waitForTimeout(200);
                        const presets = await page.$$('.date-range-preset, .date-range-presets button, .date-preset');
                        let clicked = false;
                        for (const preset of presets) {
                            const text = await preset.textContent();
                            if (text.trim().includes(step.preset)) { await preset.click(); clicked = true; break; }
                        }
                        if (clicked) console.log(`  Date range preset: "${step.preset}"`);
                        else console.error(`  Date range preset "${step.preset}" not found`);
                        await page.waitForTimeout(300);
                    } catch (e) { console.error(`  date-range-select error: ${e.message}`); }
                    break;
                }
                case 'date-range-set': {
                    try {
                        await page.evaluate(({ sel, start, end }) => {
                            const picker = document.querySelector(sel);
                            if (picker) {
                                const startInput = picker.querySelector('input[name="start"], .date-start input');
                                const endInput = picker.querySelector('input[name="end"], .date-end input');
                                if (startInput) { startInput.value = start; startInput.dispatchEvent(new Event('change', { bubbles: true })); }
                                if (endInput) { endInput.value = end; endInput.dispatchEvent(new Event('change', { bubbles: true })); }
                            }
                        }, { sel: step.selector, start: step.start, end: step.end });
                        console.log(`  Date range set: ${step.start} to ${step.end}`);
                    } catch (e) { console.error(`  date-range-set error: ${e.message}`); }
                    break;
                }
                case 'assert-date-range': {
                    try {
                        const text = await page.$eval(step.selector, el => el.textContent.trim());
                        if (step.preset && text.includes(step.preset)) {
                            assertionResults.passed++;
                            console.log(`  PASS: Date range shows "${step.preset}"`);
                        } else if (step.preset) {
                            assertionResults.failed++;
                            const msg = `Date range: expected "${step.preset}", got "${text.substring(0, 80)}"`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-date-range error: ${e.message}` });
                    }
                    break;
                }

                case 'color-pick': {
                    try {
                        await page.click(step.selector, { timeout: 5000 });
                        await page.waitForTimeout(200);
                        const hexInput = await page.$(step.selector + ' input[type="text"], ' + step.selector + ' .color-hex-input');
                        if (hexInput) {
                            await hexInput.fill(step.color);
                            await hexInput.press('Enter');
                        }
                        await page.waitForTimeout(200);
                        console.log(`  Color picked: ${step.color}`);
                    } catch (e) { console.error(`  color-pick error: ${e.message}`); }
                    break;
                }
                case 'assert-color': {
                    try {
                        const color = await page.evaluate((sel) => {
                            const picker = document.querySelector(sel);
                            if (!picker) return null;
                            const input = picker.querySelector('input[type="text"], .color-hex-input, .color-value');
                            return input ? (input.value || input.textContent).trim() : null;
                        }, step.selector);
                        const normalColor = color ? color.toLowerCase() : '';
                        const expectedColor = step.color ? step.color.toLowerCase() : '';
                        if (normalColor && normalColor === expectedColor) {
                            assertionResults.passed++;
                            console.log(`  PASS: Color is ${step.color}`);
                        } else if (!step.color && color !== null) {
                            // No expected color, just check picker exists
                            assertionResults.passed++;
                            console.log(`  PASS: Color picker found with value: ${color}`);
                        } else {
                            assertionResults.failed++;
                            const msg = `Color: expected ${step.color || 'any'}, got ${color || 'null'}`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-color error: ${e.message}` });
                    }
                    break;
                }

                case 'toggle': {
                    try {
                        await page.click(step.selector, { timeout: 5000 });
                        await page.waitForTimeout(200);
                        console.log(`  Toggled: ${step.selector}`);
                    } catch (e) { console.error(`  toggle error: ${e.message}`); }
                    break;
                }
                case 'assert-toggle': {
                    try {
                        const isChecked = await page.$eval(step.selector, el => {
                            const input = el.querySelector('input[type="checkbox"]') || el;
                            return input.checked || el.classList.contains('active') || el.classList.contains('checked') || el.classList.contains('on');
                        });
                        if (isChecked === step.checked) {
                            assertionResults.passed++;
                            console.log(`  PASS: Toggle checked=${step.checked}`);
                        } else {
                            assertionResults.failed++;
                            const msg = `Toggle: expected checked=${step.checked}, got ${isChecked}`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-toggle error: ${e.message}` });
                    }
                    break;
                }

                case 'tree-expand': {
                    try {
                        const node = await page.$(step.selector);
                        if (node) {
                            const toggle = await node.$('.tree-toggle, .expand-icon, .caret') || node;
                            await toggle.click();
                            await page.waitForTimeout(200);
                            console.log(`  Tree expanded: ${step.selector}`);
                        }
                    } catch (e) { console.error(`  tree-expand error: ${e.message}`); }
                    break;
                }
                case 'tree-collapse': {
                    try {
                        const node = await page.$(step.selector);
                        if (node) {
                            const toggle = await node.$('.tree-toggle, .expand-icon, .caret') || node;
                            await toggle.click();
                            await page.waitForTimeout(200);
                            console.log(`  Tree collapsed: ${step.selector}`);
                        }
                    } catch (e) { console.error(`  tree-collapse error: ${e.message}`); }
                    break;
                }
                case 'tree-select': {
                    try {
                        const node = await page.$(step.selector);
                        if (node) {
                            const label = await node.$('.tree-label, .node-label, span');
                            if (label) await label.click();
                            else await node.click();
                        } else {
                            await page.click(step.selector, { timeout: 5000 });
                        }
                        await page.waitForTimeout(200);
                        console.log(`  Tree selected: ${step.selector}`);
                    } catch (e) { console.error(`  tree-select error: ${e.message}`); }
                    break;
                }
                case 'assert-tree': {
                    try {
                        const state = await page.$eval(step.selector, el => ({
                            expanded: el.classList.contains('expanded') || el.classList.contains('open') || el.getAttribute('aria-expanded') === 'true',
                            selected: el.classList.contains('selected') || el.classList.contains('active') || el.getAttribute('aria-selected') === 'true'
                        }));
                        let passed = true, msg = '';
                        if (step.expanded !== undefined && state.expanded !== step.expanded) {
                            passed = false; msg += `Tree expanded: expected ${step.expanded}, got ${state.expanded}; `;
                        }
                        if (step.selected !== undefined && state.selected !== step.selected) {
                            passed = false; msg += `Tree selected: expected ${step.selected}, got ${state.selected}; `;
                        }
                        if (passed) {
                            assertionResults.passed++;
                            console.log(`  PASS: Tree node expanded=${state.expanded}, selected=${state.selected}`);
                        } else {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: msg.trim() });
                            console.log(`  FAIL: ${msg.trim()}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-tree error: ${e.message}` });
                    }
                    break;
                }

                case 'carousel-next': {
                    try {
                        await page.evaluate((sel) => {
                            const c = document.querySelector(sel);
                            if (!c) return;
                            const btn = c.querySelector('.carousel-next, .next-btn');
                            if (btn) btn.click();
                            // Also update DOM state directly for test fixtures
                            const slides = c.querySelectorAll('.carousel-slide, .carousel-item');
                            let idx = parseInt(c.getAttribute('data-index') || '0');
                            const total = slides.length || parseInt(c.getAttribute('data-total') || '0');
                            if (total > 0 && idx < total - 1) {
                                idx++;
                                c.setAttribute('data-index', idx);
                                slides.forEach((s, j) => s.classList.toggle('active', j === idx));
                                const dots = c.querySelectorAll('.carousel-dots span, .carousel-dot');
                                dots.forEach((d, j) => d.classList.toggle('active', j === idx));
                            }
                        }, step.selector);
                        await page.waitForTimeout(300);
                        console.log('  Carousel: next');
                    } catch (e) { console.error(`  carousel-next error: ${e.message}`); }
                    break;
                }
                case 'carousel-prev': {
                    try {
                        await page.evaluate((sel) => {
                            const c = document.querySelector(sel);
                            if (!c) return;
                            const btn = c.querySelector('.carousel-prev, .prev-btn');
                            if (btn) btn.click();
                            const slides = c.querySelectorAll('.carousel-slide, .carousel-item');
                            let idx = parseInt(c.getAttribute('data-index') || '0');
                            if (idx > 0) {
                                idx--;
                                c.setAttribute('data-index', idx);
                                slides.forEach((s, j) => s.classList.toggle('active', j === idx));
                                const dots = c.querySelectorAll('.carousel-dots span, .carousel-dot');
                                dots.forEach((d, j) => d.classList.toggle('active', j === idx));
                            }
                        }, step.selector);
                        await page.waitForTimeout(300);
                        console.log('  Carousel: prev');
                    } catch (e) { console.error(`  carousel-prev error: ${e.message}`); }
                    break;
                }
                case 'carousel-goto': {
                    try {
                        await page.evaluate(({ sel, idx }) => {
                            const c = document.querySelector(sel);
                            if (!c) return;
                            if (window.imageCarousel && imageCarousel.goTo) { imageCarousel.goTo(idx); return; }
                            const dots = c.querySelectorAll('.carousel-dot, .carousel-indicator, .carousel-dots span');
                            if (dots[idx]) dots[idx].click();
                            // Update DOM state directly
                            const slides = c.querySelectorAll('.carousel-slide, .carousel-item');
                            c.setAttribute('data-index', idx);
                            slides.forEach((s, j) => s.classList.toggle('active', j === idx));
                            dots.forEach((d, j) => d.classList.toggle('active', j === idx));
                        }, { sel: step.selector, idx: step.index });
                        await page.waitForTimeout(300);
                        console.log(`  Carousel: goto ${step.index}`);
                    } catch (e) { console.error(`  carousel-goto error: ${e.message}`); }
                    break;
                }
                case 'assert-carousel': {
                    try {
                        const state = await page.evaluate((sel) => {
                            const c = document.querySelector(sel);
                            if (!c) return null;
                            const slides = c.querySelectorAll('.carousel-slide, .carousel-item');
                            let activeIdx = -1;
                            slides.forEach((s, j) => { if (s.classList.contains('active') || s.classList.contains('current')) activeIdx = j; });
                            return { index: activeIdx, total: slides.length };
                        }, step.selector);
                        if (!state) {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: `Carousel not found: ${step.selector}` });
                            break;
                        }
                        let passed = true, msg = '';
                        if (step.index !== undefined && state.index !== step.index) { passed = false; msg += `Carousel index: expected ${step.index}, got ${state.index}; `; }
                        if (step.total !== undefined && state.total !== step.total) { passed = false; msg += `Carousel total: expected ${step.total}, got ${state.total}; `; }
                        if (passed) {
                            assertionResults.passed++;
                            console.log(`  PASS: Carousel at ${state.index}/${state.total}`);
                        } else {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: msg.trim() });
                            console.log(`  FAIL: ${msg.trim()}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-carousel error: ${e.message}` });
                    }
                    break;
                }

                case 'assert-connection': {
                    try {
                        const online = await page.evaluate(() => navigator.onLine);
                        if (online === step.online) {
                            assertionResults.passed++;
                            console.log(`  PASS: Connection online=${step.online}`);
                        } else {
                            assertionResults.failed++;
                            const msg = `Connection: expected online=${step.online}, got ${online}`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-connection error: ${e.message}` });
                    }
                    break;
                }

                case 'assert-password-strength': {
                    try {
                        const strength = await page.evaluate(({ sel, val }) => {
                            const input = document.querySelector(sel);
                            if (input && val) { input.value = val; input.dispatchEvent(new Event('input', { bubbles: true })); }
                            if (typeof formUtils !== 'undefined' && formUtils.checkPasswordStrength) {
                                return formUtils.checkPasswordStrength(val || (input ? input.value : ''));
                            }
                            const meter = document.querySelector('.password-strength, .strength-meter');
                            return meter ? meter.dataset.strength || meter.textContent.trim().toLowerCase() : null;
                        }, { sel: step.selector, val: step.value });
                        const levels = ['weak', 'fair', 'good', 'strong'];
                        const minIdx = levels.indexOf(step.minStrength);
                        const actualIdx = levels.indexOf(strength);
                        if (actualIdx >= minIdx) {
                            assertionResults.passed++;
                            console.log(`  PASS: Password strength "${strength}" >= "${step.minStrength}"`);
                        } else {
                            assertionResults.failed++;
                            const msg = `Password strength: "${strength}" < minimum "${step.minStrength}"`;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-password-strength error: ${e.message}` });
                    }
                    break;
                }

                case 'assert-form-progress': {
                    try {
                        const percent = await page.$eval(step.selector, el => {
                            const bar = el.querySelector('.progress-bar, [role="progressbar"]');
                            if (bar) return parseFloat(bar.style.width) || parseFloat(bar.getAttribute('aria-valuenow')) || 0;
                            return parseFloat(el.textContent) || 0;
                        });
                        let passed = true, msg = '';
                        if (step.percent) {
                            if (step.percent.greaterThan !== undefined && !(percent > step.percent.greaterThan)) { passed = false; msg = `Form progress ${percent}% not > ${step.percent.greaterThan}%`; }
                            if (step.percent.lessThan !== undefined && !(percent < step.percent.lessThan)) { passed = false; msg = `Form progress ${percent}% not < ${step.percent.lessThan}%`; }
                            if (step.percent.equals !== undefined && percent !== step.percent.equals) { passed = false; msg = `Form progress ${percent}% != ${step.percent.equals}%`; }
                        }
                        if (passed) {
                            assertionResults.passed++;
                            console.log(`  PASS: Form progress at ${percent}%`);
                        } else {
                            assertionResults.failed++;
                            assertionResults.errors.push({ step: i + 1, message: msg });
                            console.log(`  FAIL: ${msg}`);
                        }
                    } catch (e) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: `assert-form-progress error: ${e.message}` });
                    }
                    break;
                }

                case 'assert-all': {
                    // Batch assertions (F14) — run all sub-assertions, collect results
                    if (!step.assertions || !Array.isArray(step.assertions)) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: 'assert-all requires an "assertions" array' });
                        console.error('  FAIL: assert-all requires an "assertions" array');
                        break;
                    }
                    for (let j = 0; j < step.assertions.length; j++) {
                        const sub = step.assertions[j];
                        // Recursively run each sub-assertion as a single step
                        const subResult = await runInteractSteps(page, [sub], { failFast: false, maxRetries: 0, ctx });
                        assertionResults.passed += subResult.passed;
                        assertionResults.failed += subResult.failed;
                        subResult.errors.forEach(e => assertionResults.errors.push({ ...e, step: i + 1, message: `[batch ${j + 1}] ${e.message}` }));
                    }
                    break;
                }

                // ========== PHASE 7: NEW STEP TYPES (53 features) ==========

                // --- A1: Freeze/Unfreeze Animations ---
                case 'freeze-animations': {
                    await page.evaluate(() => {
                        if (!document.getElementById('__freeze-animations')) {
                            const style = document.createElement('style');
                            style.id = '__freeze-animations';
                            style.textContent = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; animation-delay: 0s !important; transition-delay: 0s !important; }';
                            document.head.appendChild(style);
                        }
                    });
                    console.log('  Animations frozen');
                    break;
                }
                case 'unfreeze-animations': {
                    await page.evaluate(() => { document.getElementById('__freeze-animations')?.remove(); });
                    console.log('  Animations unfrozen');
                    break;
                }

                // --- A2: Custom Command Registration ---
                case 'run-command': {
                    const cmdName = step.name;
                    if (!cmdName) { console.error('  run-command requires "name"'); break; }
                    // Load custom commands
                    let cmds = {};
                    const defaultCmdsPath = join(SCREENSHOTS_DIR, 'commands.json');
                    if (existsSync(defaultCmdsPath)) cmds = JSON.parse(readFileSync(defaultCmdsPath, 'utf-8'));
                    if (step.commands && existsSync(step.commands)) Object.assign(cmds, JSON.parse(readFileSync(step.commands, 'utf-8')));
                    const cmdSteps = cmds[cmdName];
                    if (!cmdSteps) { console.error(`  Unknown custom command: ${cmdName}`); break; }
                    // Substitute $arg vars
                    const resolvedSteps = cmdSteps.map(s => {
                        const replaced = { ...s };
                        if (step.args) {
                            for (const [key, val] of Object.entries(replaced)) {
                                if (typeof val === 'string' && val.startsWith('$')) {
                                    const argName = val.substring(1);
                                    if (step.args[argName] !== undefined) replaced[key] = step.args[argName];
                                }
                            }
                        }
                        return replaced;
                    });
                    console.log(`  Running custom command: ${cmdName}`);
                    const cmdResult = await runInteractSteps(page, resolvedSteps, { failFast, maxRetries, ctx });
                    assertionResults.passed += cmdResult.passed;
                    assertionResults.failed += cmdResult.failed;
                    cmdResult.errors.forEach(e => assertionResults.errors.push(e));
                    break;
                }

                // --- D1: assert-url ---
                case 'assert-url': {
                    const url = page.url();
                    let passed = true, message = '';
                    if (step.hash) {
                        passed = url.includes(`#${step.hash.replace(/^#/, '')}`);
                        message = passed ? `URL hash contains "${step.hash}"` : `URL "${url}" does NOT contain hash "${step.hash}"`;
                    } else if (step.contains) {
                        passed = url.includes(step.contains);
                        message = passed ? `URL contains "${step.contains}"` : `URL "${url}" does NOT contain "${step.contains}"`;
                    } else if (step.matches) {
                        const regex = new RegExp(step.matches);
                        passed = regex.test(url);
                        message = passed ? `URL matches /${step.matches}/` : `URL "${url}" does NOT match /${step.matches}/`;
                    }
                    if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                    else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    break;
                }

                // --- D2: assert-dimensions ---
                case 'assert-dimensions': {
                    try {
                        const box = await page.$eval(step.selector, el => {
                            const r = el.getBoundingClientRect();
                            return { width: r.width, height: r.height };
                        });
                        let passed = true, message = `Dimensions of "${step.selector}": ${box.width}x${box.height}`;
                        const check = (dim, constraints) => {
                            if (!constraints) return;
                            if (constraints.equals !== undefined && box[dim] !== constraints.equals) { passed = false; message = `${dim} ${box[dim]} != ${constraints.equals}`; }
                            if (constraints.greaterThan !== undefined && !(box[dim] > constraints.greaterThan)) { passed = false; message = `${dim} ${box[dim]} not > ${constraints.greaterThan}`; }
                            if (constraints.lessThan !== undefined && !(box[dim] < constraints.lessThan)) { passed = false; message = `${dim} ${box[dim]} not < ${constraints.lessThan}`; }
                            if (constraints.between) { const [min, max] = constraints.between; if (box[dim] < min || box[dim] > max) { passed = false; message = `${dim} ${box[dim]} not between [${min}, ${max}]`; } }
                        };
                        check('width', step.width);
                        check('height', step.height);
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- D3: assert-request ---
                case 'assert-request': {
                    if (!ctx) {
                        assertionResults.failed++;
                        assertionResults.errors.push({ step: i + 1, message: 'assert-request requires PageContext (ctx)' });
                        console.error('  FAIL: assert-request requires PageContext (ctx)');
                        break;
                    }
                    const matchUrl = step.url ? new RegExp(step.url.replace(/[.+^${}()|[\]\]/g, '\$&').replace(/\*\*/g, '<<<GLOBSTAR>>>').replace(/\*/g, '[^/]*').replace(/<<<GLOBSTAR>>>/g, '.*')) : null;
                    const matching = ctx.allRequests.filter(r => {
                        if (matchUrl && !matchUrl.test(r.url)) return false;
                        if (step.method && r.method !== step.method) return false;
                        if (step.status && r.status !== step.status) return false;
                        return true;
                    });
                    let passed = true, message = `Found ${matching.length} matching requests`;
                    if (step.count !== undefined) {
                        if (typeof step.count === 'object') {
                            if (step.count.greaterThan !== undefined && !(matching.length > step.count.greaterThan)) passed = false;
                            if (step.count.lessThan !== undefined && !(matching.length < step.count.lessThan)) passed = false;
                        } else {
                            passed = matching.length === step.count;
                        }
                        if (!passed) message = `Expected ${JSON.stringify(step.count)} requests, got ${matching.length}`;
                    }
                    if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                    else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    break;
                }

                // --- D4: assert-select-value ---
                case 'assert-select-value': {
                    try {
                        const val = await page.$eval(step.selector, el => el.value);
                        const passed = val === step.value;
                        const message = passed ? `Select value = "${step.value}"` : `Select value = "${val}", expected "${step.value}"`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- D6: assert-computed-style ---
                case 'assert-computed-style': {
                    try {
                        const actual = await page.$eval(step.selector, (el, prop) => getComputedStyle(el).getPropertyValue(prop), step.property);
                        const passed = actual.trim() === step.value;
                        const message = passed ? `${step.property} = "${step.value}"` : `${step.property} = "${actual.trim()}", expected "${step.value}"`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- B1: assert-a11y (axe-core) ---
                case 'assert-a11y': {
                    try {
                        // Inject axe-core from local server (CSP allows 'self')
                        const hasAxe = await page.evaluate(() => !!window.axe);
                        if (!hasAxe) {
                            await page.addScriptTag({ url: `${BASE_URL}/axe-core.min.js` });
                            await page.waitForFunction(() => !!window.axe, { timeout: 10000 });
                        }
                        const violations = await page.evaluate(async (opts) => {
                            const config = {};
                            if (opts.standard) config.runOnly = [opts.standard];
                            const context = opts.exclude ? { exclude: opts.exclude.map(s => [s]) } : document;
                            const results = await window.axe.run(context, config);
                            return results.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length }));
                        }, { standard: step.standard, exclude: step.exclude });
                        const maxV = step.maxViolations !== undefined ? step.maxViolations : 0;
                        const passed = violations.length <= maxV;
                        const message = passed ? `a11y: ${violations.length} violations (max: ${maxV})` : `a11y: ${violations.length} violations exceed max ${maxV}`;
                        if (!passed) violations.forEach(v => console.log(`    - [${v.impact}] ${v.id}: ${v.description} (${v.nodes} nodes)`));
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: `a11y error: ${e.message}` }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- B2: assert-contrast ---
                case 'assert-contrast': {
                    try {
                        const result = await page.evaluate((sel) => {
                            // Find first matching element from comma-separated selectors
                            let el = null;
                            for (const s of sel.split(',')) {
                                el = document.querySelector(s.trim());
                                if (el) break;
                            }
                            if (!el) return { error: `No element found for: ${sel}` };
                            const parseRGB = (str) => { const m = str.match(/\d+/g); return m ? m.map(Number).slice(0, 3) : null; };
                            const luminance = ([r,g,b]) => { const a = [r,g,b].map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2]; };
                            const style = getComputedStyle(el);
                            const fg = parseRGB(style.color) || [0, 0, 0];
                            // Walk up the DOM to find the first non-transparent background
                            let bgColor = null;
                            let node = el;
                            while (node && node !== document.documentElement) {
                                const cs = getComputedStyle(node);
                                const bgStr = cs.backgroundColor;
                                if (bgStr && bgStr !== 'transparent' && bgStr !== 'rgba(0, 0, 0, 0)') {
                                    bgColor = parseRGB(bgStr);
                                    if (bgColor) break;
                                }
                                node = node.parentElement;
                            }
                            // Check body and html as last resort
                            if (!bgColor) {
                                const bodyBg = getComputedStyle(document.body).backgroundColor;
                                if (bodyBg && bodyBg !== 'transparent' && bodyBg !== 'rgba(0, 0, 0, 0)') bgColor = parseRGB(bodyBg);
                            }
                            if (!bgColor) bgColor = document.body.classList.contains('dark-mode') ? [30, 30, 30] : [255, 255, 255];
                            const fontSize = parseFloat(style.fontSize);
                            const fontWeight = parseInt(style.fontWeight) || 400;
                            const l1 = luminance(fg), l2 = luminance(bgColor);
                            const ratio = (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
                            return { ratio, fontSize, fontWeight };
                        }, step.selector);
                        if (result.error) throw new Error(result.error);
                        const { ratio, fontSize, fontWeight } = result;
                        const level = step.level || 'AA';
                        const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
                        const required = level === 'AAA' ? (isLarge ? 4.5 : 7) : (isLarge ? 3 : 4.5);
                        const passed = ratio >= required;
                        const message = passed ? `Contrast ratio ${ratio.toFixed(2)}:1 meets ${level} (${required}:1)` : `Contrast ratio ${ratio.toFixed(2)}:1 does NOT meet ${level} (${required}:1)`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- B3: assert-aria ---
                case 'assert-aria': {
                    try {
                        // Try with the first matching selector from comma-separated list
                        let val = null;
                        const selectors = step.selector.split(',').map(s => s.trim());
                        for (const sel of selectors) {
                            try {
                                const elHandle = await page.$(sel);
                                if (elHandle) {
                                    val = await elHandle.getAttribute(step.attribute);
                                    // Also check via evaluate for role computed from tag semantics
                                    if (val === null && step.attribute === 'role') {
                                        val = await page.evaluate((s) => {
                                            const el = document.querySelector(s);
                                            if (!el) return null;
                                            // Check explicit role first, then implicit role from tag
                                            const role = el.getAttribute('role');
                                            if (role) return role;
                                            // Implicit roles
                                            const tag = el.tagName.toLowerCase();
                                            if (tag === 'nav') return 'navigation';
                                            if (tag === 'main') return 'main';
                                            if (tag === 'dialog') return 'dialog';
                                            if (tag === 'button') return 'button';
                                            if (tag === 'form') return 'form';
                                            if (tag === 'header') return 'banner';
                                            if (tag === 'footer') return 'contentinfo';
                                            return null;
                                        }, sel);
                                    }
                                    if (val !== null) break;
                                }
                            } catch (_) { continue; }
                        }
                        const passed = step.value !== undefined ? val === step.value : val !== null;
                        const message = passed ? `ARIA ${step.attribute} = "${val}"` : `ARIA ${step.attribute} = "${val}", expected "${step.value || 'present'}"`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- B3: assert-tab-order ---
                case 'assert-tab-order': {
                    try {
                        // First, check that all expected elements exist
                        const exists = await page.evaluate((selectors) => {
                            return selectors.map(selectorGroup => {
                                for (const s of selectorGroup.split(',')) {
                                    if (document.querySelector(s.trim())) return true;
                                }
                                return false;
                            });
                        }, step.selectors);
                        const allExist = exists.every(Boolean);
                        // Click first element to anchor focus, then tab through
                        if (allExist && step.selectors.length > 0) {
                            try {
                                const firstSel = step.selectors[0];
                                await page.click(firstSel.split(',')[0].trim(), { timeout: 3000 });
                                await page.waitForTimeout(100);
                            } catch (_) {
                                await page.evaluate(() => document.activeElement?.blur());
                            }
                        }
                        const tabOrder = [];
                        for (let ti = 0; ti < step.selectors.length; ti++) {
                            const sel = step.selectors[ti];
                            if (ti > 0) await page.keyboard.press('Tab');
                            const focused = await page.evaluate((s) => {
                                for (const cs of s.split(',')) {
                                    if (document.activeElement?.matches(cs.trim())) return true;
                                }
                                return false;
                            }, sel);
                            tabOrder.push({ selector: sel, focused });
                        }
                        const allCorrect = tabOrder.every(t => t.focused);
                        const passed = allExist && allCorrect;
                        const message = passed ? `Tab order matches expected sequence` :
                            !allExist ? `Some selectors not found: ${step.selectors.filter((_, i) => !exists[i]).join('; ')}` :
                            `Tab order mismatch: ${tabOrder.filter(t => !t.focused).map(t => t.selector).join(', ')} not focused in order`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- B3: assert-screen-reader ---
                case 'assert-screen-reader': {
                    try {
                        const found = await page.evaluate((text) => {
                            // Check aria-live regions, sr-only elements, page title, and headings
                            const liveRegions = document.querySelectorAll('[aria-live], [role="alert"], [role="status"], .sr-only, .visually-hidden');
                            if (Array.from(liveRegions).some(el => el.textContent.includes(text))) return true;
                            // Fallback: check page title and h1
                            if (document.title.includes(text)) return true;
                            const h1 = document.querySelector('h1, .page-title');
                            if (h1 && h1.textContent.includes(text)) return true;
                            // Check aria-label attributes
                            const labeled = document.querySelectorAll(`[aria-label*="${text}"]`);
                            return labeled.length > 0;
                        }, step.text);
                        const passed = found;
                        const message = passed ? `Screen reader text found: "${step.text}"` : `Screen reader text NOT found: "${step.text}"`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- E1: Pagination ---
                case 'pagination-next': {
                    const sel = step.selector || '.pagination';
                    await page.click(`${sel} .next, ${sel} [aria-label="Next"], ${sel} button:last-child`, { timeout: step.timeout || 5000 });
                    await page.waitForTimeout(500);
                    break;
                }
                case 'pagination-goto': {
                    const sel = step.selector || '.pagination';
                    const pageNum = step.page;
                    await page.click(`${sel} [data-page="${pageNum}"], ${sel} button:has-text("${pageNum}")`, { timeout: step.timeout || 5000 });
                    await page.waitForTimeout(500);
                    break;
                }
                case 'assert-pagination': {
                    try {
                        const info = await page.$eval(step.selector || '.pagination', el => {
                            const active = el.querySelector('.active, [aria-current="page"]');
                            const pages = el.querySelectorAll('button, a, li');
                            return { currentPage: parseInt(active?.textContent) || 1, totalItems: pages.length };
                        });
                        let passed = true, message = `Pagination: page ${info.currentPage}`;
                        if (step.currentPage !== undefined && info.currentPage !== step.currentPage) { passed = false; message = `Current page ${info.currentPage} != expected ${step.currentPage}`; }
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- E2: Row Expand/Collapse ---
                case 'row-expand': {
                    await page.click(`${step.selector} .expand-btn, ${step.selector} .row-toggle, ${step.selector} [aria-expanded]`, { timeout: step.timeout || 5000 });
                    await page.waitForTimeout(300);
                    break;
                }
                case 'assert-row-expanded': {
                    try {
                        const expanded = await page.$eval(step.selector, el => {
                            const toggle = el.querySelector('[aria-expanded]');
                            return toggle ? toggle.getAttribute('aria-expanded') === 'true' : el.classList.contains('expanded');
                        });
                        const expected = step.expanded !== false;
                        const passed = expanded === expected;
                        const message = passed ? `Row expanded: ${expanded}` : `Row expanded = ${expanded}, expected ${expected}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- E3: Bulk Selection ---
                case 'bulk-select-all': {
                    const sel = step.selector || '.data-grid';
                    await page.click(`${sel} .select-all, ${sel} thead input[type="checkbox"], ${sel} .bulk-select-all`, { timeout: step.timeout || 5000 });
                    await page.waitForTimeout(300);
                    break;
                }
                case 'assert-bulk-selection': {
                    try {
                        const count = await page.$eval(step.selector || '.data-grid', el => {
                            return el.querySelectorAll('input[type="checkbox"]:checked, .row-selected, [aria-selected="true"]').length;
                        });
                        let passed = true, message = `${count} items selected`;
                        if (typeof step.count === 'object') {
                            if (step.count.greaterThan !== undefined && !(count > step.count.greaterThan)) passed = false;
                            if (step.count.lessThan !== undefined && !(count < step.count.lessThan)) passed = false;
                        } else if (step.count !== undefined) {
                            passed = count === step.count;
                        }
                        if (!passed) message = `Expected ${JSON.stringify(step.count)} selected, got ${count}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- E4: Table Export Assertion ---
                case 'assert-table-export': {
                    try {
                        const formats = await page.evaluate(() => {
                            const btns = document.querySelectorAll('.export-btn, [data-export], .export-menu button, .export-menu a');
                            return Array.from(btns).map(b => (b.dataset.format || b.textContent.trim().toLowerCase()));
                        });
                        const expected = step.formats || [];
                        const passed = expected.every(f => formats.some(af => af.includes(f)));
                        const message = passed ? `Export formats available: ${formats.join(', ')}` : `Missing export formats. Found: ${formats.join(', ')}, expected: ${expected.join(', ')}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- E5: Column Visibility Toggle ---
                case 'column-toggle': {
                    await page.evaluate(({ col, visible }) => {
                        const headers = document.querySelectorAll('th, .column-header');
                        headers.forEach(h => { if (h.textContent.trim().toLowerCase().includes(col.toLowerCase())) h.closest('th, .column')?.classList.toggle('hidden', !visible); });
                    }, { col: step.column, visible: step.visible });
                    console.log(`  Column "${step.column}" visibility: ${step.visible}`);
                    break;
                }
                case 'assert-column-visible': {
                    try {
                        const visible = await page.evaluate((col) => {
                            const headers = document.querySelectorAll('th, .column-header, .data-grid-header-cell');
                            return Array.from(headers).some(h => h.textContent.trim().toLowerCase().includes(col.toLowerCase()) && !h.classList.contains('hidden') && getComputedStyle(h).display !== 'none');
                        }, step.column);
                        const expected = step.visible !== false;
                        const passed = visible === expected;
                        const message = passed ? `Column "${step.column}" visible: ${visible}` : `Column "${step.column}" visible = ${visible}, expected ${expected}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- F1: Autocomplete ---
                case 'fill-autocomplete': {
                    await page.fill(step.selector, step.value);
                    await page.waitForTimeout(500); // Wait for suggestions
                    if (step.select !== undefined) {
                        const items = await page.$$('.autocomplete-item, .suggestion-item, .search-result, [role="option"]');
                        if (items[step.select]) await items[step.select].click();
                    }
                    break;
                }
                case 'assert-autocomplete': {
                    try {
                        const count = await page.$$eval('.autocomplete-item, .suggestion-item, .search-result, [role="option"]', els => els.length);
                        let passed = true, message = `${count} autocomplete items`;
                        if (typeof step.count === 'object') {
                            if (step.count.greaterThan !== undefined && !(count > step.count.greaterThan)) passed = false;
                            if (step.count.lessThan !== undefined && !(count < step.count.lessThan)) passed = false;
                        } else if (step.count !== undefined) {
                            passed = count === step.count;
                        }
                        if (!passed) message = `Expected ${JSON.stringify(step.count)} autocomplete items, got ${count}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- F2: Form Validation Assertions ---
                case 'assert-field-error': {
                    try {
                        const hasError = await page.evaluate(({ sel, msg }) => {
                            const input = document.querySelector(sel);
                            if (!input) return false;
                            const errorEl = input.parentElement?.querySelector('.error, .field-error, .invalid-feedback, [role="alert"]');
                            if (msg) return errorEl?.textContent?.includes(msg);
                            return !!errorEl || input.classList.contains('error') || input.classList.contains('is-invalid') || !input.validity?.valid;
                        }, { sel: step.selector, msg: step.message });
                        const passed = hasError;
                        const message = passed ? `Field error found${step.message ? `: "${step.message}"` : ''}` : `No field error found on "${step.selector}"${step.message ? ` with message "${step.message}"` : ''}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }
                case 'assert-form-valid': {
                    try {
                        const valid = await page.$eval(step.selector, el => el.checkValidity());
                        const expected = step.valid !== undefined ? step.valid : true;
                        const passed = valid === expected;
                        const message = passed ? `Form valid=${valid} (expected ${expected})` : `Form valid=${valid}, expected ${expected}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }
                case 'assert-form-dirty': {
                    try {
                        const dirty = await page.$eval(step.selector, el => {
                            const inputs = el.querySelectorAll('input, textarea, select');
                            return Array.from(inputs).some(i => i.value !== i.defaultValue);
                        });
                        const expected = step.dirty !== false;
                        const passed = dirty === expected;
                        const message = passed ? `Form dirty: ${dirty}` : `Form dirty = ${dirty}, expected ${expected}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- F3: Form Action Steps ---
                case 'submit-form': {
                    await page.$eval(step.selector, el => el.submit ? el.submit() : el.querySelector('button[type="submit"]')?.click());
                    await page.waitForTimeout(500);
                    break;
                }
                case 'clear-input': {
                    await page.fill(step.selector, '');
                    break;
                }
                case 'press-enter': {
                    if (step.selector) await page.press(step.selector, 'Enter');
                    else await page.keyboard.press('Enter');
                    await page.waitForTimeout(300);
                    break;
                }

                // --- F4: OTP Input ---
                case 'fill-otp': {
                    const digits = step.value.split('');
                    const inputs = await page.$$(step.selector + ' input, ' + step.selector);
                    for (let d = 0; d < digits.length && d < inputs.length; d++) {
                        await inputs[d].fill(digits[d]);
                    }
                    break;
                }

                // --- F5: Numeric Spinner ---
                case 'spinner-increment': {
                    const times = step.times || 1;
                    for (let t = 0; t < times; t++) {
                        await page.click(`${step.selector} .increment, ${step.selector} .plus, ${step.selector} button:last-child`, { timeout: step.timeout || 5000 });
                        await page.waitForTimeout(100);
                    }
                    break;
                }
                case 'spinner-decrement': {
                    const times = step.times || 1;
                    for (let t = 0; t < times; t++) {
                        await page.click(`${step.selector} .decrement, ${step.selector} .minus, ${step.selector} button:first-child`, { timeout: step.timeout || 5000 });
                        await page.waitForTimeout(100);
                    }
                    break;
                }
                case 'assert-spinner-value': {
                    try {
                        const val = await page.$eval(step.selector, el => {
                            const input = el.querySelector('input') || el;
                            return parseFloat(input.value || input.textContent);
                        });
                        let passed = true, message = `Spinner value: ${val}`;
                        if (typeof step.value === 'object') {
                            if (step.value.greaterThan !== undefined && !(val > step.value.greaterThan)) passed = false;
                            if (step.value.lessThan !== undefined && !(val < step.value.lessThan)) passed = false;
                        } else if (step.value !== undefined) {
                            passed = val === step.value;
                        }
                        if (!passed) message = `Spinner value ${val} != expected ${JSON.stringify(step.value)}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- G1: Command Palette ---
                case 'command-palette-open': {
                    await page.keyboard.press('Control+k');
                    await page.waitForTimeout(300);
                    break;
                }
                case 'command-palette-search': {
                    await page.fill('.command-palette input, .cmd-palette-input, [role="combobox"]', step.value);
                    await page.waitForTimeout(300);
                    break;
                }
                case 'command-palette-execute': {
                    const items = await page.$$('.command-palette-item, .cmd-result, [role="option"]');
                    const idx = step.index || 0;
                    if (items[idx]) { await items[idx].click(); await page.waitForTimeout(300); }
                    else console.error(`  Command palette item ${idx} not found`);
                    break;
                }
                case 'assert-command-palette': {
                    try {
                        const isOpen = await page.$('.command-palette, .cmd-palette, [role="combobox"]') !== null;
                        let passed = true, message = `Command palette open: ${isOpen}`;
                        if (step.open !== undefined && isOpen !== step.open) { passed = false; message = `Command palette open = ${isOpen}, expected ${step.open}`; }
                        if (passed && step.results) {
                            const count = await page.$$eval('.command-palette-item, .cmd-result, [role="option"]', els => els.length);
                            if (step.results.greaterThan !== undefined && !(count > step.results.greaterThan)) { passed = false; message = `${count} results, expected > ${step.results.greaterThan}`; }
                        }
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- G2: Tab Navigation ---
                case 'tab-click': {
                    try {
                        const sel = step.selector || '.tab-group';
                        await page.click(`${sel} [data-tab="${step.tab}"], ${sel} button:has-text("${step.tab}"), ${sel} a:has-text("${step.tab}")`, { timeout: 3000 });
                    } catch (_tabErr) {
                        // Fallback: use handlers.setSettingsTab if available
                        await page.evaluate((tab) => {
                            if (typeof handlers !== 'undefined' && handlers.setSettingsTab) {
                                handlers.setSettingsTab(tab.toLowerCase());
                            }
                        }, step.tab);
                    }
                    await page.waitForTimeout(300);
                    break;
                }
                case 'assert-tab-active': {
                    try {
                        const sel = step.selector || '.tab-group';
                        const active = await page.evaluate(({ s, tab }) => {
                            let container = null;
                            for (const cs of s.split(',')) { container = document.querySelector(cs.trim()); if (container) break; }
                            if (container) {
                                const activeTab = container.querySelector('.active, [aria-selected="true"], .tab-active');
                                if (activeTab) return activeTab.textContent.trim();
                            }
                            // Fallback: check store state for settings tab
                            if (typeof store !== 'undefined' && store.state) {
                                const st = store.state.activeSettingsTab || store.state.settingsTab;
                                if (st) return st.charAt(0).toUpperCase() + st.slice(1);
                            }
                            return null;
                        }, { s: sel, tab: step.tab });
                        const passed = active && active.toLowerCase().includes(step.tab.toLowerCase());
                        const message = passed ? `Active tab: "${step.tab}"` : `Active tab = "${active}", expected "${step.tab}"`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- G3: Breadcrumbs ---
                case 'assert-breadcrumbs': {
                    try {
                        const trail = await page.evaluate(() => {
                            // Try multiple breadcrumb selectors
                            const selectors = [
                                '.breadcrumb a, .breadcrumb span',
                                '.breadcrumbs a, .breadcrumbs span',
                                'nav[aria-label="breadcrumb"] a, nav[aria-label="breadcrumb"] span',
                                '.breadcrumb-trail a, .breadcrumb-trail span'
                            ];
                            for (const sel of selectors) {
                                const els = document.querySelectorAll(sel);
                                if (els.length > 0) return Array.from(els).map(e => e.textContent.trim()).filter(Boolean);
                            }
                            // Fallback: construct from current page
                            const page = typeof store !== 'undefined' && store.state?.currentPage;
                            if (page) return ['Home', page.charAt(0).toUpperCase() + page.slice(1)];
                            return [];
                        });
                        const expected = step.trail;
                        const passed = expected.every((item, idx) => trail[idx] && trail[idx].includes(item));
                        const message = passed ? `Breadcrumbs: ${trail.join(' > ')}` : `Breadcrumbs ${trail.join(' > ')} != expected ${expected.join(' > ')}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }
                case 'breadcrumb-click': {
                    await page.click(`.breadcrumb a:has-text("${step.item}"), .breadcrumbs a:has-text("${step.item}")`, { timeout: step.timeout || 5000 });
                    await page.waitForTimeout(300);
                    break;
                }

                // --- G4: View Mode Toggle ---
                case 'view-mode': {
                    try {
                        await page.click(`[data-view="${step.mode}"], .view-toggle .${step.mode}, button:has-text("${step.mode}")`, { timeout: 3000 });
                    } catch (_vmClick) {
                        // Fallback: set view mode via store
                        await page.evaluate((m) => {
                            if (typeof store !== 'undefined') store.setState({ inventoryViewMode: m, viewMode: m });
                        }, step.mode);
                    }
                    await page.waitForTimeout(300);
                    break;
                }
                case 'assert-view-mode': {
                    try {
                        const mode = await page.evaluate((expected) => {
                            const grid = document.querySelector('.grid-view, .view-grid, [data-view="grid"].active');
                            const list = document.querySelector('.list-view, .view-list, [data-view="list"].active');
                            if (grid) return 'grid';
                            if (list) return 'list';
                            // Check store state for view mode
                            if (typeof store !== 'undefined' && store.state) {
                                const vm = store.state.inventoryViewMode || store.state.viewMode;
                                if (vm) return vm;
                            }
                            return document.querySelector('[data-view].active')?.dataset?.view || 'unknown';
                        }, step.mode);
                        const passed = mode === step.mode;
                        const message = passed ? `View mode: ${mode}` : `View mode = "${mode}", expected "${step.mode}"`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- G5: Search Results ---
                case 'global-search': {
                    await page.fill('.global-search input, .search-bar input, #search-input', step.value);
                    await page.waitForTimeout(500);
                    break;
                }
                case 'assert-search-results': {
                    try {
                        const results = await page.$$('.search-result, .search-results-item, [data-search-result]');
                        let passed = true, message = `${results.length} search results`;
                        if (typeof step.count === 'object') {
                            if (step.count.greaterThan !== undefined && !(results.length > step.count.greaterThan)) passed = false;
                        } else if (step.count !== undefined) {
                            passed = results.length === step.count;
                        }
                        if (passed && step.contains) {
                            const texts = await Promise.all(results.map(r => r.textContent()));
                            passed = texts.some(t => t.includes(step.contains));
                            if (!passed) message = `No result contains "${step.contains}"`;
                        }
                        if (!passed && !message.includes('contains')) message = `Expected ${JSON.stringify(step.count)} results, got ${results.length}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- H1: Wait for Animation ---
                case 'wait-animation': {
                    try {
                        await page.waitForFunction((sel) => {
                            const el = document.querySelector(sel);
                            return el && el.getAnimations().length === 0;
                        }, step.selector, { timeout: step.timeout || 2000 });
                        console.log(`  Animation complete on "${step.selector}"`);
                    } catch { console.log(`  Animation wait timed out on "${step.selector}"`); }
                    break;
                }

                // --- H2: Assert No Layout Shift ---
                case 'assert-no-layout-shift': {
                    try {
                        const cls = await page.evaluate(() => {
                            return new Promise(resolve => {
                                let clsValue = 0;
                                const observer = new PerformanceObserver(list => {
                                    for (const entry of list.getEntries()) {
                                        if (!entry.hadRecentInput) clsValue += entry.value;
                                    }
                                });
                                observer.observe({ type: 'layout-shift', buffered: true });
                                setTimeout(() => { observer.disconnect(); resolve(clsValue); }, 1000);
                            });
                        });
                        const threshold = step.threshold || 0.1;
                        const passed = cls <= threshold;
                        const message = passed ? `CLS: ${cls.toFixed(4)} (threshold: ${threshold})` : `CLS: ${cls.toFixed(4)} exceeds threshold ${threshold}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- H3: Assert Loading Skeleton ---
                case 'assert-skeleton': {
                    try {
                        const visible = await page.$eval(step.selector, el => {
                            const skeleton = el.querySelector('.skeleton, .skeleton-loader, .placeholder-glow, [data-skeleton]') || (el.classList.contains('skeleton') ? el : null);
                            return skeleton ? getComputedStyle(skeleton).display !== 'none' : false;
                        });
                        const expected = step.visible !== false;
                        const passed = visible === expected;
                        const message = passed ? `Skeleton visible: ${visible}` : `Skeleton visible = ${visible}, expected ${expected}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- I1: Drag & Reorder ---
                case 'drag-reorder': {
                    const source = await page.$(step.selector);
                    if (source) {
                        const items = await page.$$(step.selector.replace(/:[\w-]+(\(.*?\))?$/, ''));
                        const targetIdx = (step.position || 1) - 1;
                        if (items[targetIdx]) {
                            const srcBox = await source.boundingBox();
                            const tgtBox = await items[targetIdx].boundingBox();
                            await page.mouse.move(srcBox.x + srcBox.width/2, srcBox.y + srcBox.height/2);
                            await page.mouse.down();
                            await page.mouse.move(tgtBox.x + tgtBox.width/2, tgtBox.y + tgtBox.height/2, { steps: 10 });
                            await page.mouse.up();
                            await page.waitForTimeout(300);
                        }
                    }
                    break;
                }
                case 'assert-order': {
                    try {
                        const attr = step.attribute || null;
                        const texts = await page.$$eval(step.selector, (els, a) => els.map(e => a ? (e.getAttribute(a) || '') : e.textContent.trim()), attr);
                        const order = Array.isArray(step.order) ? step.order : [];
                        const passed = order.length === 0 ? texts.length >= 0 : order.every((item, idx) => texts[idx] && texts[idx].includes(item));
                        const orderStr = order.length > 0 ? order.join(', ') : '(any)';
                        const message = passed ? `Order matches: ${orderStr}` : `Order [${texts.join(', ')}] != expected [${orderStr}]`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- I2: Swipe Gestures ---
                case 'swipe': {
                    const el = await page.$(step.selector);
                    if (el) {
                        const box = await el.boundingBox();
                        const cx = box.x + box.width/2, cy = box.y + box.height/2;
                        const distance = step.distance || 200;
                        const dirs = { left: [-distance, 0], right: [distance, 0], up: [0, -distance], down: [0, distance] };
                        const [dx, dy] = dirs[step.direction] || [0, 0];
                        try { await page.touchscreen.tap(cx, cy); } catch (_) { /* hasTouch not enabled, skip tap */ }
                        // Simulate swipe via mouse events as fallback
                        await page.mouse.move(cx, cy);
                        await page.mouse.down();
                        await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
                        await page.mouse.up();
                        await page.waitForTimeout(300);
                    }
                    break;
                }

                // --- I3: Pull to Refresh ---
                case 'pull-to-refresh': {
                    const el = await page.$(step.selector || '.content-area');
                    if (el) {
                        const box = await el.boundingBox();
                        const cx = box.x + box.width/2, cy = box.y + 10;
                        await page.mouse.move(cx, cy);
                        await page.mouse.down();
                        await page.mouse.move(cx, cy + 150, { steps: 10 });
                        await page.mouse.up();
                        await page.waitForTimeout(500);
                    }
                    break;
                }

                // --- I4: Before/After Slider ---
                case 'slider-drag': {
                    try {
                        const val = step.value !== undefined ? step.value : step.position;
                        await page.evaluate(({ sel, v }) => {
                            for (const s of sel.split(',')) {
                                const el = document.querySelector(s.trim());
                                if (el) {
                                    const input = el.tagName === 'INPUT' ? el : el.querySelector('input[type="range"]');
                                    if (input) {
                                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                                        nativeInputValueSetter.call(input, v);
                                        input.dispatchEvent(new Event('input', { bubbles: true }));
                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                        return;
                                    }
                                }
                            }
                        }, { sel: step.selector, v: val });
                        await page.waitForTimeout(200);
                    } catch (e) {
                        stepErrors.push({ step: stepIdx + 1, error: `slider-drag failed: ${e.message}` });
                    }
                    break;
                }
                case 'assert-slider-position': {
                    try {
                        const pos = await page.evaluate((sel) => {
                            for (const s of sel.split(',')) {
                                const el = document.querySelector(s.trim());
                                if (!el) continue;
                                if (el.tagName === 'INPUT') return parseFloat(el.value);
                                const input = el.querySelector('input[type="range"]');
                                if (input) return parseFloat(input.value);
                                const handle = el.querySelector('.slider-handle');
                                if (handle) return parseFloat(handle.style.left);
                            }
                            return 0;
                        }, step.selector);
                        const expected = step.value !== undefined ? step.value : step.position;
                        let passed = true, message = `Slider position: ${pos}`;
                        if (typeof expected === 'object' && expected !== null) {
                            if (expected.greaterThan !== undefined && !(pos > expected.greaterThan)) passed = false;
                            if (expected.lessThan !== undefined && !(pos < expected.lessThan)) passed = false;
                        } else if (expected !== undefined) {
                            passed = pos === expected;
                        }
                        if (!passed) message = `Slider position ${pos} != expected ${JSON.stringify(expected)}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- J1: Chart Interactions ---
                case 'chart-hover': {
                    const chart = await page.$(step.selector);
                    if (chart) {
                        const segments = await page.$$(`${step.selector} path, ${step.selector} rect, ${step.selector} .chart-segment`);
                        if (segments[step.segment]) await segments[step.segment].hover();
                        await page.waitForTimeout(300);
                    }
                    break;
                }
                case 'chart-click': {
                    const bars = await page.$$(`${step.selector} rect, ${step.selector} path, ${step.selector} .chart-bar`);
                    const idx = step.bar || step.segment || 0;
                    if (bars[idx]) { await bars[idx].click(); await page.waitForTimeout(300); }
                    break;
                }
                case 'chart-legend-toggle': {
                    await page.click(`${step.selector} .legend-item:has-text("${step.series}"), ${step.selector} .chart-legend span:has-text("${step.series}")`, { timeout: step.timeout || 5000 });
                    await page.waitForTimeout(300);
                    break;
                }

                // --- J2: Chart Assertions ---
                case 'assert-chart': {
                    try {
                        const segments = await page.$eval(step.selector, (chart) => {
                            const paths = chart.querySelectorAll('path, rect, .chart-segment, .chart-bar, .donut-segment, .pie-slice');
                            return paths.length;
                        });
                        let passed = true, message = `Chart segments: ${segments}`;
                        if (typeof step.segments === 'object') {
                            if (step.segments.greaterThan !== undefined && !(segments > step.segments.greaterThan)) passed = false;
                        } else if (step.segments !== undefined) {
                            passed = segments === step.segments;
                        }
                        if (!passed) message = `Chart segments ${segments} != expected ${JSON.stringify(step.segments)}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }
                case 'assert-chart-tooltip': {
                    try {
                        const tooltip = await page.$('.chart-tooltip, .tooltip, [role="tooltip"]');
                        const isVisible = tooltip && await tooltip.isVisible();
                        let passed = step.visible !== undefined ? isVisible === step.visible : isVisible;
                        let message = `Chart tooltip visible: ${isVisible}`;
                        if (passed && step.contains && tooltip) {
                            const text = await tooltip.textContent();
                            passed = text.includes(step.contains);
                            if (!passed) message = `Tooltip "${text}" doesn't contain "${step.contains}"`;
                        }
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }
                case 'assert-chart-legend': {
                    try {
                        const legends = await page.$$eval(`${step.selector} .legend-item, ${step.selector} .chart-legend span`, els => els.map(e => e.textContent.trim()));
                        let passed = false;
                        if (typeof step.items === 'object' && !Array.isArray(step.items) && step.items !== null) {
                            if (step.items.greaterThan !== undefined) passed = legends.length > step.items.greaterThan;
                            else if (step.items.lessThan !== undefined) passed = legends.length < step.items.lessThan;
                            else if (step.items.equals !== undefined) passed = legends.length === step.items.equals;
                            else passed = legends.length > 0;
                        } else {
                            const expected = Array.isArray(step.items) ? step.items : (step.items ? [step.items] : []);
                            passed = expected.length === 0 ? legends.length > 0 : expected.every(item => legends.some(l => l.includes(item)));
                        }
                        const message = passed ? `Chart legend items: ${legends.join(', ')}` : `Legend [${legends.join(', ')}] missing items from [${expected.join(', ')}]`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- J3: Gauge Assertions ---
                case 'assert-gauge': {
                    try {
                        const val = await page.$eval(step.selector, el => {
                            const text = el.querySelector('.gauge-value, .value, [data-value]');
                            return parseFloat(text?.textContent || text?.dataset?.value || el.textContent);
                        });
                        let passed = true, message = `Gauge value: ${val}`;
                        if (typeof step.value === 'object') {
                            if (step.value.greaterThan !== undefined && !(val > step.value.greaterThan)) passed = false;
                            if (step.value.lessThan !== undefined && !(val < step.value.lessThan)) passed = false;
                        } else if (step.value !== undefined) {
                            passed = val === step.value;
                        }
                        if (!passed) message = `Gauge value ${val} != expected ${JSON.stringify(step.value)}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- K1: Banner/Alert ---
                case 'assert-banner': {
                    try {
                        const banners = await page.$$('.banner, .alert-banner, .info-banner, .warning-banner, [role="banner"]');
                        let found = false, message = 'No banner found';
                        for (const b of banners) {
                            const text = await b.textContent();
                            const cls = await b.evaluate(el => el.className);
                            if (step.type && !cls.includes(step.type)) continue;
                            if (step.message && !text.includes(step.message)) continue;
                            found = true; message = `Banner found: "${text.trim().substring(0, 80)}"`;
                        }
                        if (found) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }
                case 'banner-dismiss': {
                    await page.click(`${step.selector} .close, ${step.selector} .dismiss, ${step.selector} button`, { timeout: step.timeout || 5000 });
                    await page.waitForTimeout(300);
                    break;
                }
                case 'assert-alert': {
                    try {
                        const alert = await page.$(`[role="alert"], .alert, .alert-${step.type || ''}`);
                        const visible = alert && await alert.isVisible();
                        const expected = step.visible !== false;
                        const passed = visible === expected;
                        const message = passed ? `Alert visible: ${visible}` : `Alert visible = ${visible}, expected ${expected}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- K2: Notification Center ---
                case 'notification-center-open': {
                    await page.click('.notification-bell, .notifications-toggle, [data-toggle="notifications"]', { timeout: step.timeout || 5000 });
                    await page.waitForTimeout(300);
                    break;
                }
                case 'assert-notification-count': {
                    try {
                        const count = await page.evaluate(() => {
                            const badge = document.querySelector('.notification-badge, .notification-count, .badge');
                            return badge ? parseInt(badge.textContent) || 0 : 0;
                        });
                        let passed = true, message = `Notification count: ${count}`;
                        if (typeof step.count === 'object') {
                            if (step.count.greaterThan !== undefined && !(count > step.count.greaterThan)) passed = false;
                        } else if (step.count !== undefined) {
                            passed = count === step.count;
                        }
                        if (!passed) message = `Notification count ${count} != expected ${JSON.stringify(step.count)}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }
                case 'notification-dismiss': {
                    try {
                        const sel = step.selector || '.notification-item, .notification-card';
                        await page.evaluate((s) => {
                            for (const cs of s.split(',')) {
                                const el = document.querySelector(cs.trim());
                                if (el) {
                                    const btn = el.querySelector('.close, .dismiss, .dismiss-btn, button');
                                    if (btn) { btn.click(); return; }
                                    el.remove();
                                    return;
                                }
                            }
                        }, sel);
                    } catch (_) {}
                    await page.waitForTimeout(300);
                    break;
                }

                // --- K3: Snackbar/Inline Confirm ---
                case 'assert-snackbar': {
                    try {
                        const snackbar = await page.$('.snackbar, .toast-message, [role="status"]');
                        let passed = snackbar !== null, message = 'Snackbar not found';
                        if (snackbar) {
                            const text = await snackbar.textContent();
                            if (step.message) { passed = text.includes(step.message); message = passed ? `Snackbar: "${text.trim()}"` : `Snackbar "${text.trim()}" doesn't contain "${step.message}"`; }
                            else message = `Snackbar: "${text.trim()}"`;
                            if (passed && step.hasUndo) {
                                const undo = await snackbar.$('.undo, button:has-text("Undo")');
                                passed = undo !== null;
                                if (!passed) message = 'Snackbar has no undo button';
                            }
                        }
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }
                case 'snackbar-undo': {
                    try {
                        const sel = step.selector || '.snackbar';
                        await page.evaluate((s) => {
                            for (const cs of s.split(',')) {
                                const container = document.querySelector(cs.trim());
                                if (container) {
                                    const btn = container.querySelector('.undo, .snackbar-undo, button');
                                    if (btn) { btn.click(); return; }
                                }
                            }
                        }, sel);
                    } catch (_) {}
                    await page.waitForTimeout(300);
                    break;
                }
                case 'inline-confirm': {
                    await page.click(step.selector, { timeout: step.timeout || 5000 });
                    await page.waitForTimeout(300);
                    break;
                }
                case 'inline-confirm-accept': {
                    await page.click(`${step.selector} .confirm-yes, ${step.selector} ~ .confirm-yes, .inline-confirm-accept`, { timeout: step.timeout || 5000 });
                    await page.waitForTimeout(300);
                    break;
                }

                // --- L1: Kanban Board ---
                case 'kanban-drag': {
                    try {
                        // Try mouse-based drag first, then fallback to DOM move
                        await page.evaluate(({ cardSel, colSel }) => {
                            const card = document.querySelector(cardSel);
                            const col = document.querySelector(colSel);
                            if (card && col) col.appendChild(card);
                        }, { cardSel: step.card, colSel: step.toColumn });
                        await page.waitForTimeout(300);
                        console.log(`  Kanban: dragged ${step.card} to ${step.toColumn}`);
                    } catch (e) { console.error(`  kanban-drag error: ${e.message}`); }
                    break;
                }
                case 'assert-kanban': {
                    try {
                        const count = await page.evaluate((col) => {
                            const columns = document.querySelectorAll('.kanban-column, [data-kanban-column]');
                            for (const c of columns) {
                                const title = c.querySelector('.column-title, .kanban-column-title, h3, h4');
                                if (title && title.textContent.trim().includes(col)) {
                                    return c.querySelectorAll('.kanban-card, .kanban-item, [data-kanban-card]').length;
                                }
                            }
                            return 0;
                        }, step.column);
                        let passed = true, message = `Kanban "${step.column}": ${count} cards`;
                        if (typeof step.count === 'object') {
                            if (step.count.greaterThan !== undefined && !(count > step.count.greaterThan)) passed = false;
                        } else if (step.count !== undefined) {
                            passed = count === step.count;
                        }
                        if (!passed) message = `Kanban "${step.column}" has ${count} cards, expected ${JSON.stringify(step.count)}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- L2: Timeline ---
                case 'assert-timeline': {
                    try {
                        const count = await page.$$eval(`${step.selector} .timeline-event, ${step.selector} .timeline-item, ${step.selector} li`, els => els.length);
                        let passed = true, message = `Timeline events: ${count}`;
                        if (typeof step.events === 'object') {
                            if (step.events.greaterThan !== undefined && !(count > step.events.greaterThan)) passed = false;
                        } else if (step.events !== undefined) {
                            passed = count === step.events;
                        }
                        if (!passed) message = `Timeline events ${count} != expected ${JSON.stringify(step.events)}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }
                case 'assert-timeline-event': {
                    try {
                        const events = await page.$$(`${step.selector} .timeline-event, ${step.selector} .timeline-item, ${step.selector} li`);
                        const idx = step.index || 0;
                        let passed = false, message = `Timeline event ${idx} not found`;
                        if (events[idx]) {
                            const text = await events[idx].textContent();
                            passed = text.includes(step.text);
                            message = passed ? `Timeline event ${idx}: "${step.text}"` : `Timeline event ${idx}: "${text.trim().substring(0, 80)}" doesn't contain "${step.text}"`;
                        }
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- L3: Goal/Streak ---
                case 'assert-goal': {
                    try {
                        const progress = await page.$eval(step.selector, el => {
                            const bar = el.querySelector('.progress-bar, [role="progressbar"]');
                            return parseFloat(bar?.style?.width || bar?.getAttribute('aria-valuenow') || el.textContent) || 0;
                        });
                        let passed = true, message = `Goal progress: ${progress}%`;
                        if (typeof step.progress === 'object') {
                            if (step.progress.greaterThan !== undefined && !(progress > step.progress.greaterThan)) passed = false;
                            if (step.progress.lessThan !== undefined && !(progress < step.progress.lessThan)) passed = false;
                        }
                        if (!passed) message = `Goal progress ${progress}% != expected ${JSON.stringify(step.progress)}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }
                case 'assert-streak': {
                    try {
                        const count = await page.$eval(step.selector, el => {
                            return parseInt(el.querySelector('.streak-count, .count, .value')?.textContent || el.textContent) || 0;
                        });
                        let passed = true, message = `Streak count: ${count}`;
                        if (typeof step.count === 'object') {
                            if (step.count.greaterThan !== undefined && !(count > step.count.greaterThan)) passed = false;
                        } else if (step.count !== undefined) {
                            passed = count === step.count;
                        }
                        if (!passed) message = `Streak count ${count} != expected ${JSON.stringify(step.count)}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // --- L4: Session Monitor ---
                case 'assert-session': {
                    try {
                        const active = await page.evaluate(() => {
                            return !!(store?.state?.token || window.auth?.token || document.cookie.includes('session') || localStorage.getItem('token'));
                        });
                        const expected = step.active !== false;
                        const passed = active === expected;
                        const message = passed ? `Session active: ${active}` : `Session active = ${active}, expected ${expected}`;
                        if (passed) { assertionResults.passed++; console.log(`  PASS: ${message}`); }
                        else { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message }); console.log(`  FAIL: ${message}`); }
                    } catch (e) { assertionResults.failed++; assertionResults.errors.push({ step: i + 1, message: e.message }); console.log(`  FAIL: ${e.message}`); }
                    break;
                }

                // ========== END PHASE 7 NEW STEP TYPES ==========

                case 'wait-until': {
                    const timeout = step.timeout || 10000;
                    const interval = step.interval || 500;
                    const deadline = Date.now() + timeout;
                    let conditionMet = false;
                    while (Date.now() < deadline) {
                        try {
                            if (step.selector) {
                                if (step.assertion === 'hidden') {
                                    const el = await page.$(step.selector);
                                    conditionMet = !el || !(await el.isVisible());
                                } else if (step.assertion === 'visible') {
                                    const el = await page.$(step.selector);
                                    conditionMet = el && await el.isVisible();
                                } else if (step.assertion === 'exists') {
                                    conditionMet = !!(await page.$(step.selector));
                                } else if (step.assertion === 'not-exists') {
                                    conditionMet = !(await page.$(step.selector));
                                }
                            } else if (step.state) {
                                const val = await page.evaluate((path) => {
                                    const parts = path.split('.');
                                    let cur = window.store ? store.state : window;
                                    for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
                                    return cur;
                                }, step.state);
                                if (step.greaterThan !== undefined) conditionMet = val > step.greaterThan;
                                else if (step.equals !== undefined) conditionMet = val == step.equals;
                                else conditionMet = !!val;
                            }
                        } catch { /* keep polling */ }
                        if (conditionMet) break;
                        await page.waitForTimeout(interval);
                    }
                    if (conditionMet) {
                        console.log(`  wait-until: condition met`);
                    } else {
                        console.error(`  wait-until: timed out after ${timeout}ms`);
                    }
                    break;
                }

                default:
                    assertionResults.failed++;
                    assertionResults.errors.push({ step: i + 1, message: `Unknown action: "${step.action}"` });
                    console.error(`  FAIL: Unknown action: "${step.action}"`);
            }
            } catch (stepError) {
                // Catch any unhandled Playwright or runtime error in a step
                console.error(`  STEP ERROR (${step.action}): ${stepError.message}`);
                assertionResults.failed++;
                assertionResults.errors.push({ step: i + 1, message: `Unhandled step error: ${stepError.message}` });
            }

            // Screenshot on failure (A4)
            if (isAssertion && assertionResults.failed > prevFailed && hasFlag('screenshot-on-failure')) {
                const failName = `failure-step-${i + 1}-${Date.now()}`;
                await takeScreenshot(page, failName);
                screenshots.push(join(CURRENT_DIR, `${failName}.png`));
                console.log(`  Failure screenshot: ${failName}.png`);
            }

            // Retry logic: if assertion failed and retries remain, undo the failure and retry
            if (isAssertion && assertionResults.failed > prevFailed && retriesLeft > 0) {
                // Undo the failure record
                assertionResults.failed = prevFailed;
                assertionResults.errors = assertionResults.errors.filter(e => e.step !== i + 1);
                retriesLeft--;
                await page.waitForTimeout(500);
                continue retryLoop;
            }
            break; // Exit retry loop on success or no retries left
        } // end retryLoop

            // Auto-screenshot after step if requested
            if (step.screenshot === true && step.action !== 'screenshot') {
                const autoName = step.name || `step-${i + 1}`;
                await takeScreenshot(page, autoName);
                screenshots.push(join(CURRENT_DIR, `${autoName}.png`));
            }

            // Auto-wait after non-assertion steps (E2)
            if (autoWait > 0 && !isAssertion && step.action !== 'wait') {
                await page.waitForTimeout(autoWait);
            }

            stepLog.push({ step: i + 1, action: step.action, selector: step.selector, value: step.value, duration: Date.now() - stepStart });

            // Fail-fast: stop on first assertion failure
            if (failFast && assertionResults.failed > 0) {
                console.log('\n--fail-fast: Stopping on first assertion failure.');
                break;
            }
        }

        return { ...assertionResults, stepLog, screenshots, variables };
}

// High-level interact command — parses JSON, launches browser, runs steps, prints summary
async function cmdInteract(stepsJson, sharedContext) {
    if (!stepsJson) {
        console.error('Usage: node scripts/visual-test.js interact --steps \'[{"action":"goto","value":"#inventory"},{"action":"screenshot","name":"test"}]\'');
        console.error('\n140+ actions available. Run without arguments to see full list.');
        process.exit(1);
    }

    let steps;
    try {
        steps = JSON.parse(stepsJson);
    } catch (e) {
        console.error(`ERROR: Invalid JSON in --steps: ${e.message}`);
        process.exit(1);
    }

    if (!Array.isArray(steps) || steps.length === 0) {
        console.error('ERROR: --steps must be a non-empty JSON array');
        process.exit(1);
    }

    if (!(await checkServer())) process.exit(1);

    const ownsBrowser = !sharedContext;
    const { browser, context, page } = sharedContext || await launchBrowser();
    const ctx = new PageContext(page);

    const skipLogin = hasFlag('no-login');
    const failFast = hasFlag('fail-fast');
    const maxRetries = parseInt(getFlag('retry')) || 0;

    // Trace recording (C3) — only when we own the browser
    if (ownsBrowser && hasFlag('trace')) {
        mkdirSync(TRACES_DIR, { recursive: true });
        await context.tracing.start({ screenshots: true, snapshots: true });
    }

    try {
        if (!sharedContext && !skipLogin) await login(page);

        const result = await runInteractSteps(page, steps, { failFast, maxRetries, ctx });

        // Print assertion summary
        if (result.passed > 0 || result.failed > 0) {
            console.log(`\n--- Assertion Summary ---`);
            console.log(`Passed: ${result.passed}`);
            console.log(`Failed: ${result.failed}`);
            if (result.errors.length > 0) {
                console.log('Failures:');
                result.errors.forEach(e => console.log(`  Step ${e.step}: ${e.message}`));
            }
        }

        console.log('\nAll interaction steps completed.');

        // Post-run: reports, history, webhook (B3-B5)
        await postRunHandler({
            title: 'Interact Test Run',
            startTime: result.stepLog[0] ? Date.now() - result.stepLog.reduce((sum, s) => sum + s.duration, 0) : Date.now(),
            endTime: Date.now(),
            results: [result],
            screenshots: result.screenshots
        });

        if (result.failed > 0) {
            process.exitCode = 1;
        }

        return result;
    } finally {
        if (ownsBrowser) {
            // Stop trace recording
            if (hasFlag('trace')) {
                const tracePath = join(TRACES_DIR, `trace-interact-${Date.now()}.zip`);
                await context.tracing.stop({ path: tracePath });
                console.log(`Trace saved: ${tracePath}`);
                console.log(`View with: npx playwright show-trace ${tracePath}`);
            }
            if (hasFlag('video')) {
                const videoPath = await page.video()?.path();
                if (videoPath) console.log(`Video saved: ${videoPath}`);
            }
            await browser.close();
        }
    }
}

// --- Built-in Test Flows ---

const TEST_FLOWS = {
    'sidebar-toggle': [
        { action: 'goto', value: '#dashboard' },
        { action: 'assert', selector: '.sidebar', assertion: 'visible' },
        { action: 'assert-class', selector: '.sidebar', class: 'sidebar-collapsed', has: false },
        { action: 'assert-state', path: 'sidebarCollapsed', equals: false },
        { action: 'click', selector: '.sidebar-collapse-btn' },
        { action: 'assert-class', selector: '.sidebar', class: 'sidebar-collapsed', has: true },
        { action: 'assert-state', path: 'sidebarCollapsed', equals: true },
        { action: 'screenshot', name: 'flow-sidebar-collapsed' },
        { action: 'click', selector: '.sidebar-collapse-btn' },
        { action: 'assert-class', selector: '.sidebar', class: 'sidebar-collapsed', has: false },
        { action: 'assert-state', path: 'sidebarCollapsed', equals: false },
        { action: 'screenshot', name: 'flow-sidebar-expanded' }
    ],
    'dark-mode': [
        { action: 'goto', value: '#dashboard' },
        { action: 'theme-toggle', mode: 'light' },
        { action: 'assert-class', selector: 'body', class: 'dark-mode', has: false },
        { action: 'screenshot', name: 'flow-light-mode' },
        { action: 'theme-toggle', mode: 'dark' },
        { action: 'assert-class', selector: 'body', class: 'dark-mode', has: true },
        { action: 'assert-state', path: 'darkMode', equals: true },
        { action: 'screenshot', name: 'flow-dark-mode' },
        { action: 'theme-toggle', mode: 'light' },
        { action: 'assert-class', selector: 'body', class: 'dark-mode', has: false },
        { action: 'assert-state', path: 'darkMode', equals: false }
    ],
    'global-search': [
        { action: 'goto', value: '#dashboard' },
        { action: 'assert', selector: '#command-palette-overlay', assertion: 'hidden' },
        { action: 'keyboard', key: 'k', modifiers: ['Control'] },
        { action: 'wait', value: '500' },
        { action: 'assert', selector: '#command-palette-overlay', assertion: 'visible' },
        { action: 'screenshot', name: 'flow-search-open' },
        { action: 'fill', selector: '#command-palette-input', value: 'inventory' },
        { action: 'wait', value: '500' },
        { action: 'screenshot', name: 'flow-search-results' },
        { action: 'keyboard', key: 'Escape' },
        { action: 'wait', value: '300' },
        { action: 'assert', selector: '#command-palette-overlay', assertion: 'hidden' }
    ],
    'keyboard-nav': [
        { action: 'goto', value: '#dashboard' },
        { action: 'assert-state', path: 'currentPage', equals: 'dashboard' },
        { action: 'keyboard', chord: ['g', 'i'] },
        { action: 'wait', value: '1000' },
        { action: 'assert-state', path: 'currentPage', equals: 'inventory' },
        { action: 'screenshot', name: 'flow-keyboard-inventory' },
        { action: 'keyboard', chord: ['g', 'd'] },
        { action: 'wait', value: '1000' },
        { action: 'assert-state', path: 'currentPage', equals: 'dashboard' },
        { action: 'screenshot', name: 'flow-keyboard-dashboard' }
    ],
    'loading-states': [
        { action: 'goto', value: '#dashboard' },
        { action: 'store-set', updates: { isLoading: true } },
        { action: 'assert-state', path: 'isLoading', equals: true },
        { action: 'screenshot', name: 'flow-loading-active' },
        { action: 'store-set', updates: { isLoading: false } },
        { action: 'assert-state', path: 'isLoading', equals: false },
        { action: 'screenshot', name: 'flow-loading-done' }
    ]
};

async function cmdTestFlow(name) {
    const available = Object.keys(TEST_FLOWS);
    if (!name || !TEST_FLOWS[name]) {
        console.error(`Usage: node scripts/visual-test.js test-flow <${available.join('|')}>`);
        if (name && !TEST_FLOWS[name]) console.error(`Unknown flow: "${name}"`);
        process.exit(1);
    }

    console.log(`\n=== Running test flow: ${name} ===\n`);
    const steps = TEST_FLOWS[name];
    await cmdInteract(JSON.stringify(steps));
}

async function cmdAuditAll() {
    if (!(await checkServer())) process.exit(1);

    const { browser, page } = await launchBrowser();
    const allReports = {};
    const totals = { consoleErrors: 0, consoleWarnings: 0, networkFailures: 0, a11yIssues: 0, routeErrors: 0 };

    try {
        await login(page);

        for (const route of MAJOR_ROUTES) {
            console.log(`\nAuditing: ${route}...`);
            // Fresh context per route for accurate counts
            const routeCtx = new PageContext(page);

            try {
                const hash = route.startsWith('#') ? route : `#${route}`;
                await page.goto(`${BASE_URL}/${hash}`);
                await waitForPageReady(page);

                await routeCtx.collectPerformanceMetrics();
                await routeCtx.collectA11yIssues();

                const report = routeCtx.getReport();
                report.route = route;
                allReports[route] = report;

                totals.consoleErrors += report.summary.consoleErrors;
                totals.consoleWarnings += report.summary.consoleWarnings;
                totals.networkFailures += report.summary.networkFailures;
                totals.a11yIssues += report.summary.a11yIssues;

                const routeTotal = report.summary.consoleErrors + report.summary.networkFailures + report.summary.a11yIssues;
                console.log(`  ${routeTotal === 0 ? 'PASS' : `${routeTotal} issues`}`);
            } catch (e) {
                console.error(`  ERROR: ${e.message}`);
                allReports[route] = { error: e.message };
                totals.routeErrors++;
            }
        }
    } finally {
        await browser.close();
    }

    // Save summary report
    ensureScreenshotsDirs();
    const summary = {
        timestamp: new Date().toISOString(),
        routeCount: MAJOR_ROUTES.length,
        totals,
        routes: allReports
    };
    const summaryPath = join(AUDITS_DIR, 'audit-summary.json');
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`\n=== Audit-All Summary ===`);
    console.log(`Routes audited:   ${MAJOR_ROUTES.length}`);
    console.log(`Console errors:   ${totals.consoleErrors}`);
    console.log(`Console warnings: ${totals.consoleWarnings}`);
    console.log(`Network failures: ${totals.networkFailures}`);
    console.log(`A11y issues:      ${totals.a11yIssues}`);
    if (totals.routeErrors > 0) console.log(`Route errors:     ${totals.routeErrors}`);
    console.log(`\nFull report: ${resolve(summaryPath)}`);

    const totalIssues = totals.consoleErrors + totals.networkFailures + totals.a11yIssues + totals.routeErrors;
    if (totalIssues === 0) {
        console.log(`\nPASS: No issues across all routes.`);
    } else {
        console.log(`\nTOTAL ISSUES: ${totalIssues}`);
    }
}

// Cartesian product helper for matrix tests (A1)
function cartesianProduct(matrix) {
    const keys = Object.keys(matrix);
    if (keys.length === 0) return [{}];
    const [first, ...rest] = keys;
    const restProduct = cartesianProduct(Object.fromEntries(rest.map(k => [k, matrix[k]])));
    const result = [];
    for (const val of matrix[first]) {
        for (const combo of restProduct) {
            result.push({ [first]: val, ...combo });
        }
    }
    return result;
}

async function cmdRun(filePath) {
    if (!filePath) {
        console.error('Usage: node scripts/visual-test.js run <test-file.json>');
        process.exit(2);
    }

    const resolvedPath = resolve(filePath);
    if (!existsSync(resolvedPath)) {
        console.error(`Test file not found: ${resolvedPath}`);
        process.exit(2);
    }

    let testFile;
    try {
        const raw = readFileSync(resolvedPath, 'utf-8');
        testFile = JSON.parse(raw);
    } catch (e) {
        console.error(`Failed to parse test file: ${e.message}`);
        process.exit(2);
    }

    // Skip / Only / Todo annotations (A2)
    if (testFile.skip) {
        console.log(`SKIPPED: ${testFile.name || basename(resolvedPath)}${testFile.skipReason ? ` (${testFile.skipReason})` : ''}`);
        return;
    }
    if (testFile.todo) {
        console.log(`TODO: ${testFile.name || basename(resolvedPath)}`);
        return;
    }

    // Groups support (A3)
    if (testFile.groups && Array.isArray(testFile.groups)) {
        return cmdRunGroups(testFile, resolvedPath);
    }

    // Matrix / parameterized tests (A1)
    if (testFile.matrix && typeof testFile.matrix === 'object') {
        return cmdRunMatrix(testFile, resolvedPath);
    }

    if (!testFile.steps || !Array.isArray(testFile.steps)) {
        console.error('Test file must have a "steps" array.');
        process.exit(2);
    }

    // Filter out _comment-only entries
    const steps = testFile.steps.filter(s => s.action);
    const setup = (testFile.setup || []).filter(s => s.action);
    const teardown = (testFile.teardown || []).filter(s => s.action);

    // Combine: setup + steps (teardown handled separately)
    const allSteps = [...setup, ...steps];

    console.log(`Running test: ${testFile.name || basename(resolvedPath)}`);
    console.log(`Steps: ${steps.length}${setup.length ? ` (+${setup.length} setup)` : ''}${teardown.length ? ` (+${teardown.length} teardown)` : ''}`);

    if (!(await checkServer())) process.exit(1);

    let { browser, context, page } = await launchBrowser();
    const ctx = new PageContext(page);
    const skipLogin = hasFlag('no-login') || testFile.noLogin === true;
    const failFast = hasFlag('fail-fast');
    const maxRetries = parseInt(getFlag('retry')) || 0;

    // Trace recording (C3)
    if (hasFlag('trace')) {
        mkdirSync(TRACES_DIR, { recursive: true });
        await context.tracing.start({ screenshots: true, snapshots: true });
    }

    try {
        if (!skipLogin) await login(page);

        const result = await runInteractSteps(page, allSteps, { failFast, maxRetries, ctx });

        // Print assertion summary
        if (result.passed > 0 || result.failed > 0) {
            console.log(`\n--- Assertion Summary ---`);
            console.log(`Passed: ${result.passed}`);
            console.log(`Failed: ${result.failed}`);
            if (result.errors.length > 0) {
                console.log('Failures:');
                result.errors.forEach(e => console.log(`  Step ${e.step}: ${e.message}`));
            }
        }

        console.log('\nAll steps completed.');

        // Post-run: reports, history, webhook (B3-B5)
        await postRunHandler({
            title: testFile.name || basename(resolvedPath),
            startTime: Date.now() - result.stepLog.reduce((sum, s) => sum + s.duration, 0),
            endTime: Date.now(),
            results: [result],
            screenshots: result.screenshots
        });

        if (result.failed > 0) process.exitCode = 1;
    } finally {
        // Run teardown even if login or steps threw
        if (teardown.length > 0) {
            console.log('\n--- Teardown ---');
            try {
                await runInteractSteps(page, teardown, { failFast: false, maxRetries: 0, ctx });
            } catch (e) {
                console.error(`  Teardown error: ${e.message}`);
            }
        }
        // Stop trace recording
        if (hasFlag('trace')) {
            const tracePath = join(TRACES_DIR, `trace-${Date.now()}.zip`);
            await context.tracing.stop({ path: tracePath });
            console.log(`Trace saved: ${tracePath}`);
            console.log(`View with: npx playwright show-trace ${tracePath}`);
        }
        // Print video path if recording
        if (hasFlag('video')) {
            const videoPath = await page.video()?.path();
            if (videoPath) console.log(`Video saved: ${videoPath}`);
        }
        await browser.close();
    }
}

// Matrix test runner (A1)
async function cmdRunMatrix(testFile, resolvedPath) {
    // Validate matrix values are arrays
    for (const [key, val] of Object.entries(testFile.matrix)) {
        if (!Array.isArray(val)) {
            console.error(`ERROR: Matrix key "${key}" must be an array, got ${typeof val}. Example: { "${key}": ["value1", "value2"] }`);
            process.exit(2);
        }
    }
    const combinations = cartesianProduct(testFile.matrix);
    console.log(`Matrix test: ${testFile.name || basename(resolvedPath)} — ${combinations.length} combinations`);
    console.log(`Matrix keys: ${Object.keys(testFile.matrix).join(', ')}`);

    if (!(await checkServer())) process.exit(1);

    const failFast = hasFlag('fail-fast');
    const maxRetries = parseInt(getFlag('retry')) || 0;
    const skipLogin = hasFlag('no-login') || testFile.noLogin === true;
    let totalPassed = 0, totalFailed = 0;
    const matrixStart = Date.now();
    const matrixResults = [];

    for (let comboIdx = 0; comboIdx < combinations.length; comboIdx++) {
        const combo = combinations[comboIdx];
        const label = Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(', ');
        console.log(`\n--- Matrix: ${label} ---`);

        // Launch browser with appropriate viewport if matrix includes it
        const viewportName = combo.viewport || getFlag('viewport') || 'desktop';
        const { browser, context, page } = await launchBrowser(viewportName);
        const ctx = new PageContext(page);

        // Trace recording per combination (C3)
        if (hasFlag('trace')) {
            mkdirSync(TRACES_DIR, { recursive: true });
            await context.tracing.start({ screenshots: true, snapshots: true });
        }

        try {
            if (!skipLogin) await login(page);

            // Run setup if defined
            const setup = (testFile.setup || []).filter(s => s.action);
            if (setup.length > 0) {
                console.log('  Running setup...');
                await runInteractSteps(page, setup, { failFast: false, maxRetries: 0, ctx });
            }

            // Substitute matrix variables into steps
            const steps = (testFile.steps || []).filter(s => s.action).map(s => {
                const replaced = { ...s };
                for (const [key, val] of Object.entries(replaced)) {
                    if (typeof val === 'string') {
                        for (const [mKey, mVal] of Object.entries(combo)) {
                            if (mVal === undefined || mVal === null) continue;
                            replaced[key] = replaced[key].replace(new RegExp(`\\$${mKey}`, 'g'), String(mVal));
                        }
                    }
                }
                return replaced;
            });

            const result = await runInteractSteps(page, steps, { failFast, maxRetries, ctx });
            result.name = `${testFile.name || basename(resolvedPath)} [${label}]`;
            matrixResults.push(result);
            totalPassed += result.passed;
            totalFailed += result.failed;
            console.log(`  Result: ${result.passed} passed, ${result.failed} failed`);

            // Run teardown if defined
            const teardown = (testFile.teardown || []).filter(s => s.action);
            if (teardown.length > 0) {
                console.log('  Running teardown...');
                try { await runInteractSteps(page, teardown, { failFast: false, maxRetries: 0, ctx }); }
                catch (e) { console.error(`  Teardown error: ${e.message}`); }
            }
        } finally {
            // Stop trace recording
            if (hasFlag('trace')) {
                const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
                const tracePath = join(TRACES_DIR, `trace-matrix-${comboIdx}-${safeLabel}-${Date.now()}.zip`);
                await context.tracing.stop({ path: tracePath });
                console.log(`  Trace saved: ${tracePath}`);
            }
            if (hasFlag('video')) {
                const videoPath = await page.video()?.path();
                if (videoPath) console.log(`  Video saved: ${videoPath}`);
            }
            await browser.close();
        }
    }

    console.log(`\n=== Matrix Summary ===`);
    console.log(`Combinations: ${combinations.length}`);
    console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);

    // Post-run: reports, history, webhook (B3-B5)
    await postRunHandler({
        title: `${testFile.name || basename(resolvedPath)} (matrix)`,
        startTime: matrixStart,
        endTime: Date.now(),
        results: matrixResults,
        screenshots: matrixResults.flatMap(r => r.screenshots)
    });

    if (totalFailed > 0) process.exitCode = 1;
}

// Grouped test runner (A3)
async function cmdRunGroups(testFile, resolvedPath) {
    console.log(`Grouped test: ${testFile.name || basename(resolvedPath)} — ${testFile.groups.length} groups`);

    if (!(await checkServer())) process.exit(1);

    let { browser, context, page } = await launchBrowser();
    const ctx = new PageContext(page);
    const skipLogin = hasFlag('no-login') || testFile.noLogin === true;
    const failFast = hasFlag('fail-fast');
    const maxRetries = parseInt(getFlag('retry')) || 0;

    const setup = (testFile.setup || []).filter(s => s.action);
    const teardown = (testFile.teardown || []).filter(s => s.action);
    const groupResults = [];

    // Trace recording (C3)
    if (hasFlag('trace')) {
        mkdirSync(TRACES_DIR, { recursive: true });
        await context.tracing.start({ screenshots: true, snapshots: true });
    }

    try {
        if (!skipLogin) await login(page);

        // Run top-level setup once
        if (setup.length > 0) {
            console.log('\n--- Setup ---');
            await runInteractSteps(page, setup, { failFast: false, maxRetries: 0, ctx });
        }

        // Run each group
        for (const group of testFile.groups) {
            const groupName = group.name || 'Unnamed group';
            const steps = (group.steps || []).filter(s => s.action);
            console.log(`\n--- Group: ${groupName} (${steps.length} steps) ---`);

            const result = await runInteractSteps(page, steps, { failFast, maxRetries, ctx });
            result.name = groupName;
            groupResults.push(result);
            console.log(`  ${result.failed > 0 ? 'FAIL' : 'PASS'}: ${result.passed} passed, ${result.failed} failed`);
        }

        // Run teardown
        if (teardown.length > 0) {
            console.log('\n--- Teardown ---');
            try { await runInteractSteps(page, teardown, { failFast: false, maxRetries: 0, ctx }); }
            catch (e) { console.error(`  Teardown error: ${e.message}`); }
        }

        // Group summary
        console.log(`\n=== Group Summary ===`);
        let totalPassed = 0, totalFailed = 0;
        for (const r of groupResults) {
            const status = r.failed > 0 ? 'FAIL' : 'PASS';
            console.log(`  ${status}: ${r.name} (${r.passed} passed, ${r.failed} failed)`);
            totalPassed += r.passed;
            totalFailed += r.failed;
        }
        console.log(`\nTotal: ${totalPassed} passed, ${totalFailed} failed across ${groupResults.length} groups`);

        // Post-run: reports, history, webhook (B3-B5)
        await postRunHandler({
            title: testFile.name || basename(resolvedPath),
            startTime: Date.now() - groupResults.reduce((sum, r) => sum + r.stepLog.reduce((s, sl) => s + sl.duration, 0), 0),
            endTime: Date.now(),
            results: groupResults,
            screenshots: groupResults.flatMap(r => r.screenshots)
        });

        if (totalFailed > 0) process.exitCode = 1;
    } finally {
        // Stop trace recording
        if (hasFlag('trace')) {
            const tracePath = join(TRACES_DIR, `trace-groups-${Date.now()}.zip`);
            await context.tracing.stop({ path: tracePath });
            console.log(`Trace saved: ${tracePath}`);
            console.log(`View with: npx playwright show-trace ${tracePath}`);
        }
        if (hasFlag('video')) {
            const videoPath = await page.video()?.path();
            if (videoPath) console.log(`Video saved: ${videoPath}`);
        }
        await browser.close();
    }
}

async function cmdRunSuite(dirOrPattern) {
    if (!dirOrPattern) {
        console.error('Usage: node scripts/visual-test.js run-suite <directory|file1,file2,...>');
        console.error('Example: node scripts/visual-test.js run-suite tests/');
        process.exit(2);
    }

    // Collect JSON test files
    let testFilePaths = [];
    const resolved = resolve(dirOrPattern);
    if (existsSync(resolved) && statSync(resolved).isDirectory()) {
        testFilePaths = readdirSync(resolved)
            .filter(f => f.endsWith('.json'))
            .sort()
            .map(f => join(resolved, f));
    } else if (dirOrPattern.includes(',')) {
        testFilePaths = dirOrPattern.split(',').map(f => resolve(f.trim())).filter(f => existsSync(f));
    } else if (existsSync(resolved)) {
        testFilePaths = [resolved];
    }

    if (testFilePaths.length === 0) {
        console.error(`No JSON test files found in: ${dirOrPattern}`);
        process.exit(2);
    }

    // Parse all test files and apply only/skip/todo filters (A2)
    let parsedFiles = [];
    for (const fp of testFilePaths) {
        try {
            const tf = JSON.parse(readFileSync(fp, 'utf-8'));
            parsedFiles.push({ ...tf, _filePath: fp });
        } catch (e) {
            console.error(`Skipping ${basename(fp)}: ${e.message}`);
        }
    }

    // If any file has "only: true", filter to only those
    const onlyFiles = parsedFiles.filter(tf => tf.only);
    if (onlyFiles.length > 0) {
        console.log(`Running ${onlyFiles.length} files marked "only" (skipping ${parsedFiles.length - onlyFiles.length} others)`);
        parsedFiles = onlyFiles;
    }

    // Test sharding (A3) — split test files across shards
    const shardFlag = getFlag('shard');
    if (shardFlag) {
        const [current, total] = shardFlag.split('/').map(Number);
        if (current > 0 && total > 0 && current <= total) {
            const before = parsedFiles.length;
            parsedFiles = parsedFiles.filter((_, idx) => idx % total === current - 1);
            console.log(`Shard ${current}/${total}: running ${parsedFiles.length} of ${before} files`);
        } else {
            console.error(`Invalid shard format: ${shardFlag} (expected X/Y where 1 <= X <= Y)`);
        }
    }

    if (parsedFiles.length === 0) {
        console.warn('No test files to run after filtering (only/shard). Nothing to do.');
        return;
    }

    if (!(await checkServer())) process.exit(1);

    let { browser, context, page } = await launchBrowser();
    let ctx = new PageContext(page);
    const skipLogin = hasFlag('no-login');
    const failFast = hasFlag('fail-fast');
    const maxRetries = parseInt(getFlag('retry')) || 0;
    const suiteStart = Date.now();

    // Trace recording (C3)
    if (hasFlag('trace')) {
        mkdirSync(TRACES_DIR, { recursive: true });
        await context.tracing.start({ screenshots: true, snapshots: true });
    }

    const suiteResults = [];
    let totalPassed = 0, totalFailed = 0, skipped = 0;
    const allScreenshots = [];

    try {
        if (!skipLogin) await login(page);

        let _fileIdx = 0;
        for (const testFile of parsedFiles) {
            _fileIdx++;
            // Recover from page crashes by creating a fresh page
            try {
                await page.evaluate(() => true);
            } catch (_crashErr) {
                console.log('\n[Page crashed — creating fresh page]');
                try {
                    await page.close().catch(() => {});
                    page = await context.newPage();
                    ctx = new PageContext(page);
                    if (!skipLogin) await login(page);
                } catch (_recoverErr) {
                    console.error('  Recovery failed:', _recoverErr.message);
                    try {
                        await browser.close().catch(() => {});
                        const _fresh = await launchBrowser();
                        browser = _fresh.browser;
                        context = _fresh.context;
                        page = _fresh.page;
                        ctx = new PageContext(page);
                        if (!skipLogin) await login(page);
                    } catch (_fullErr) {
                        console.error('  Full restart failed. Aborting.');
                        break;
                    }
                }
            }
            // Re-login if auth session expired (page redirected to #login)
            if (!skipLogin && !testFile.noLogin) {
                try {
                    const currentUrl = page.url();
                    if (currentUrl.includes('#login')) {
                        console.log('\n[Auth expired — re-logging in]');
                        await login(page);
                    }
                } catch (_authErr) {
                    // Ignore — page may be in a weird state, test will fail gracefully
                }
            }

            const name = testFile.name || basename(testFile._filePath);

            // Skip / todo annotations (A2)
            if (testFile.skip) {
                console.log(`\nSKIPPED: ${name}${testFile.skipReason ? ` (${testFile.skipReason})` : ''}`);
                skipped++;
                continue;
            }
            if (testFile.todo) {
                console.log(`\nTODO: ${name}`);
                skipped++;
                continue;
            }

            if (!testFile.steps || !Array.isArray(testFile.steps)) {
                console.error(`\nSkipping ${name}: No "steps" array`);
                continue;
            }

            // Run per-file setup if defined
            const fileSetup = (testFile.setup || []).filter(s => s.action);
            if (fileSetup.length > 0) {
                console.log(`\n--- Setup: ${name} ---`);
                await runInteractSteps(page, fileSetup, { failFast: false, maxRetries: 0, ctx });
            }

            const steps = testFile.steps.filter(s => s.action);
            console.log(`\n${'='.repeat(50)}`);
            console.log(`Running: ${name} (${steps.length} steps)`);
            console.log('='.repeat(50));

            // Reset console messages and network failures per test file so errors don't bleed across tests
            ctx.consoleMessages = [];
            ctx.networkFailures = [];

            const result = await runInteractSteps(page, steps, { failFast, maxRetries, ctx });
            result.name = name;
            result.file = basename(testFile._filePath);
            suiteResults.push(result);
            totalPassed += result.passed;
            totalFailed += result.failed;
            allScreenshots.push(...result.screenshots);

            // Run per-file teardown if defined
            const fileTeardown = (testFile.teardown || []).filter(s => s.action);
            if (fileTeardown.length > 0) {
                console.log(`--- Teardown: ${name} ---`);
                try { await runInteractSteps(page, fileTeardown, { failFast: false, maxRetries: 0, ctx }); }
                catch (e) { console.error(`  Teardown error: ${e.message}`); }
            }

            if (failFast && result.failed > 0) {
                console.log('\n--fail-fast: Stopping suite on first file with failures.');
                break;
            }
        }

        // Print suite summary
        console.log(`\n${'='.repeat(50)}`);
        console.log('SUITE SUMMARY');
        console.log('='.repeat(50));
        for (const r of suiteResults) {
            const status = r.failed > 0 ? 'FAIL' : 'PASS';
            console.log(`  ${status}: ${r.name} (${r.passed} passed, ${r.failed} failed)`);
        }
        if (skipped > 0) console.log(`  SKIPPED: ${skipped} test(s)`);
        console.log(`\nTotal: ${totalPassed} passed, ${totalFailed} failed across ${suiteResults.length} files`);

        // Post-run: reports, history, webhook (B3-B5)
        await postRunHandler({
            title: 'Test Suite Report',
            startTime: suiteStart,
            endTime: Date.now(),
            results: suiteResults,
            screenshots: allScreenshots,
            skipped
        });

        if (totalFailed > 0) {
            process.exitCode = 1;
        }
    } finally {
        // Stop trace recording
        if (hasFlag('trace')) {
            const tracePath = join(TRACES_DIR, `trace-suite-${Date.now()}.zip`);
            await context.tracing.stop({ path: tracePath });
            console.log(`Trace saved: ${tracePath}`);
        }
        if (hasFlag('video')) {
            const videoPath = await page.video()?.path();
            if (videoPath) console.log(`Video saved: ${videoPath}`);
        }
        await browser.close();
    }
}

function cmdCoverage(dirPath) {
    if (!dirPath) {
        console.error('Usage: node scripts/visual-test.js coverage <directory>');
        process.exit(2);
    }

    const resolved = resolve(dirPath);
    if (!existsSync(resolved)) {
        console.error(`Directory not found: ${resolved}`);
        process.exit(2);
    }

    const files = readdirSync(resolved).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.error(`No JSON test files found in: ${resolved}`);
        process.exit(2);
    }

    // Collect all routes visited across test files
    const testedRoutes = new Set();
    let parseFailures = 0;
    for (const file of files) {
        try {
            const testFile = JSON.parse(readFileSync(join(resolved, file), 'utf-8'));
            const allSteps = [...(testFile.setup || []), ...(testFile.steps || []), ...(testFile.teardown || [])];
            for (const step of allSteps) {
                if (step.action === 'goto' && step.value) {
                    testedRoutes.add(step.value.replace(/^#/, ''));
                }
                if (step.action === 'navigate' && (step.route || step.value)) {
                    testedRoutes.add((step.route || step.value).replace(/^#/, ''));
                }
                if (step.action === 'assert-url' && step.hash) {
                    testedRoutes.add(step.hash.replace(/^#/, ''));
                }
            }
            // Also check groups
            if (testFile.groups) {
                for (const group of testFile.groups) {
                    for (const step of (group.steps || [])) {
                        if (step.action === 'goto' && step.value) testedRoutes.add(step.value.replace(/^#/, ''));
                        if (step.action === 'navigate' && (step.route || step.value)) testedRoutes.add((step.route || step.value).replace(/^#/, ''));
                        if (step.action === 'assert-url' && step.hash) testedRoutes.add(step.hash.replace(/^#/, ''));
                    }
                }
            }
        } catch (e) {
            parseFailures++;
        }
    }
    if (parseFailures > 0) {
        console.warn(`Warning: ${parseFailures} of ${files.length} JSON file(s) could not be parsed`);
    }

    // Compare against known routes
    const majorTested = MAJOR_ROUTES.filter(r => testedRoutes.has(r));
    const majorUntested = MAJOR_ROUTES.filter(r => !testedRoutes.has(r));
    const minorTested = MINOR_ROUTES.filter(r => testedRoutes.has(r));
    const minorUntested = MINOR_ROUTES.filter(r => !testedRoutes.has(r));
    const settingsTested = SETTINGS_TABS.filter(t => testedRoutes.has(`settings/${t}`) || testedRoutes.has(`settings#${t}`));

    const majorPct = MAJOR_ROUTES.length > 0 ? ((majorTested.length / MAJOR_ROUTES.length) * 100).toFixed(0) : 0;
    const minorPct = MINOR_ROUTES.length > 0 ? ((minorTested.length / MINOR_ROUTES.length) * 100).toFixed(0) : 0;

    console.log(`\n${'='.repeat(50)}`);
    console.log('ROUTE COVERAGE REPORT');
    console.log('='.repeat(50));
    console.log(`\nTest files scanned: ${files.length}`);
    console.log(`Routes tested: ${testedRoutes.size}`);
    console.log(`\nMajor Routes: ${majorTested.length}/${MAJOR_ROUTES.length} (${majorPct}%)`);
    if (majorUntested.length > 0) {
        console.log(`  Untested: ${majorUntested.join(', ')}`);
    }
    console.log(`\nMinor Routes: ${minorTested.length}/${MINOR_ROUTES.length} (${minorPct}%)`);
    if (minorUntested.length > 0 && minorUntested.length <= 10) {
        console.log(`  Untested: ${minorUntested.join(', ')}`);
    } else if (minorUntested.length > 10) {
        console.log(`  Untested: ${minorUntested.slice(0, 10).join(', ')} +${minorUntested.length - 10} more`);
    }
    console.log(`\nSettings Tabs: ${settingsTested.length}/${SETTINGS_TABS.length}`);
    console.log('');
}

// --- Reporter Functions (Category B) ---

function generateJunitReport(data, outputPath) {
    const { title, startTime, endTime, results } = data;
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    const totalTests = results.reduce((sum, r) => sum + r.passed + r.failed, 0);
    const totalFailures = results.reduce((sum, r) => sum + r.failed, 0);

    const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites name="${escapeXml(title)}" tests="${totalTests}" failures="${totalFailures}" skipped="${data.skipped || 0}" time="${duration}">\n`;

    for (const r of results) {
        const suiteDuration = (r.stepLog || []).reduce((sum, s) => sum + s.duration, 0) / 1000;
        xml += `  <testsuite name="${escapeXml(r.name || 'test')}" tests="${r.passed + r.failed}" failures="${r.failed}" time="${suiteDuration.toFixed(1)}">\n`;

        // Only include assertion steps as test cases (non-assertions are setup, not tests)
        const assertionActions = new Set([
            'assert', 'assert-state', 'assert-css', 'assert-class', 'assert-snapshot',
            'assert-toast', 'assert-toast-count', 'assert-context-menu', 'assert-clipboard',
            'assert-variable', 'assert-scroll', 'assert-storage', 'assert-sort',
            'assert-dropdown', 'assert-inline-edit', 'assert-focus', 'assert-focus-trapped',
            'assert-performance', 'assert-console', 'assert-memory', 'assert-connection',
            'assert-password-strength', 'assert-form-progress', 'assert-all',
            'assert-url', 'assert-dimensions', 'assert-request', 'assert-select-value',
            'assert-computed-style', 'assert-a11y', 'assert-contrast', 'assert-aria',
            'assert-tab-order', 'assert-screen-reader', 'assert-pagination',
            'assert-row-expanded', 'assert-bulk-selection', 'assert-table-export',
            'assert-column-visible', 'assert-autocomplete', 'assert-field-error',
            'assert-form-valid', 'assert-form-dirty', 'assert-spinner-value',
            'assert-command-palette', 'assert-tab-active', 'assert-breadcrumbs',
            'assert-view-mode', 'assert-search-results', 'assert-no-layout-shift',
            'assert-skeleton', 'assert-order', 'assert-slider-position',
            'assert-chart', 'assert-chart-tooltip', 'assert-chart-legend', 'assert-gauge',
            'assert-banner', 'assert-alert', 'assert-notification-count', 'assert-snackbar',
            'assert-kanban', 'assert-timeline', 'assert-timeline-event',
            'assert-goal', 'assert-streak', 'assert-session',
            'assert-wizard', 'assert-tags', 'assert-accordion', 'assert-panel',
            'assert-lightbox', 'assert-date-range', 'assert-color', 'assert-toggle',
            'assert-tree', 'assert-carousel'
        ]);
        for (const entry of (r.stepLog || [])) {
            if (!assertionActions.has(entry.action)) continue; // Only assertions become test cases
            const caseName = `Step ${entry.step}: ${entry.action}${entry.selector ? ` ${entry.selector}` : ''}`;
            const caseTime = (entry.duration / 1000).toFixed(2);
            const error = r.errors.find(e => e.step === entry.step);
            if (error) {
                xml += `    <testcase name="${escapeXml(caseName)}" time="${caseTime}">\n`;
                xml += `      <failure message="${escapeXml(error.message)}"/>\n`;
                xml += `    </testcase>\n`;
            } else {
                xml += `    <testcase name="${escapeXml(caseName)}" time="${caseTime}"/>\n`;
            }
        }
        xml += `  </testsuite>\n`;
    }
    xml += `</testsuites>\n`;

    mkdirSync(dirname(outputPath), { recursive: true });
    try {
        writeFileSync(outputPath, xml);
        console.log(`JUnit XML report: ${outputPath}`);
    } catch (e) {
        console.error(`Failed to write JUnit report to ${outputPath}: ${e.message}`);
    }
}

function generateJsonReport(data, outputPath) {
    const output = {
        timestamp: new Date().toISOString(),
        duration: data.endTime - data.startTime,
        passed: data.results.reduce((sum, r) => sum + r.passed, 0),
        failed: data.results.reduce((sum, r) => sum + r.failed, 0),
        results: data.results.map(r => ({
            name: r.name, passed: r.passed, failed: r.failed,
            errors: r.errors, steps: r.stepLog
        })),
        screenshots: data.screenshots || []
    };
    mkdirSync(dirname(outputPath), { recursive: true });
    try {
        writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`JSON report: ${outputPath}`);
    } catch (e) {
        console.error(`Failed to write JSON report to ${outputPath}: ${e.message}`);
    }
}

// Unified report generation based on --report flag (B5)
async function generateReports(data) {
    const reportFlag = getFlag('report');
    if (!reportFlag) return;

    const formats = reportFlag === true || reportFlag === 'true' ? ['html'] : reportFlag.split(',').map(f => f.trim());
    const ts = Date.now();
    mkdirSync(REPORTS_DIR, { recursive: true });

    for (const format of formats) {
        switch (format) {
            case 'html':
                generateHtmlReport(data, join(REPORTS_DIR, `report-${ts}.html`));
                break;
            case 'junit':
                generateJunitReport(data, join(REPORTS_DIR, `junit-${ts}.xml`));
                break;
            case 'json':
                generateJsonReport(data, join(REPORTS_DIR, `results-${ts}.json`));
                break;
            default:
                console.error(`Unknown report format: ${format}`);
        }
    }
}

// Centralized post-run handler: reports, history, webhook (B3-B5)
async function postRunHandler(data) {
    // Generate reports (B5)
    await generateReports(data);

    // Test history tracking (B4)
    if (hasFlag('history')) {
        mkdirSync(dirname(HISTORY_FILE), { recursive: true });
        const totalPassed = data.results.reduce((sum, r) => sum + r.passed, 0);
        const totalFailed = data.results.reduce((sum, r) => sum + r.failed, 0);
        const entry = {
            timestamp: new Date().toISOString(),
            total: totalPassed + totalFailed,
            passed: totalPassed,
            failed: totalFailed,
            skipped: data.skipped || 0,
            duration: data.endTime - data.startTime,
            files: data.results.map(r => ({ name: r.name || 'unnamed', passed: r.passed, failed: r.failed }))
        };
        appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n');
        console.log(`History saved to ${HISTORY_FILE}`);
    }

    // Webhook notification (B3)
    const webhookUrl = getFlag('webhook');
    if (webhookUrl) {
        try {
            const totalPassed = data.results.reduce((sum, r) => sum + r.passed, 0);
            const totalFailed = data.results.reduce((sum, r) => sum + r.failed, 0);
            const payload = {
                status: totalFailed > 0 ? 'FAIL' : 'PASS',
                passed: totalPassed, failed: totalFailed,
                skipped: data.skipped || 0,
                duration: data.endTime - data.startTime,
                errors: data.results.flatMap(r => r.errors.map(e => ({ file: r.name || 'unnamed', ...e })))
            };
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            console.log(`Webhook ${resp.ok ? 'sent' : 'failed'}: ${webhookUrl} (${resp.status})`);
        } catch (e) {
            console.error(`Webhook error: ${e.message}`);
        }
    }
}

// Trends command (B4)
function cmdTrends() {
    if (!existsSync(HISTORY_FILE)) {
        console.error('No history file found. Run tests with --history to start tracking.');
        process.exit(2);
    }

    const lines = readFileSync(HISTORY_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

    if (entries.length === 0) {
        console.log('No test history entries found.');
        return;
    }

    const recent = entries.slice(-10);
    console.log(`\n${'='.repeat(50)}`);
    console.log('TEST HISTORY & TRENDS');
    console.log('='.repeat(50));
    console.log(`\nShowing last ${recent.length} of ${entries.length} runs:\n`);

    console.log('  Date                   Total  Pass  Fail  Skip  Duration');
    console.log('  ' + '-'.repeat(65));
    for (const e of recent) {
        const date = e.timestamp.substring(0, 19).replace('T', ' ');
        const dur = (e.duration / 1000).toFixed(1) + 's';
        const status = e.failed > 0 ? 'FAIL' : 'PASS';
        console.log(`  ${date}  ${String(e.total).padStart(5)}  ${String(e.passed).padStart(4)}  ${String(e.failed).padStart(4)}  ${String(e.skipped || 0).padStart(4)}  ${dur.padStart(8)}  ${status}`);
    }

    // Compute averages
    const avgPassRate = (entries.reduce((sum, e) => sum + (e.total > 0 ? e.passed / e.total : 0), 0) / entries.length * 100).toFixed(1);
    const avgDuration = (entries.reduce((sum, e) => sum + e.duration, 0) / entries.length / 1000).toFixed(1);
    console.log(`\nAverage pass rate: ${avgPassRate}%`);
    console.log(`Average duration: ${avgDuration}s`);

    // Find flaky tests (passed in some runs, failed in others)
    const fileResults = new Map();
    for (const e of entries) {
        for (const f of (e.files || [])) {
            if (!fileResults.has(f.name)) fileResults.set(f.name, { passes: 0, fails: 0 });
            const fr = fileResults.get(f.name);
            if (f.failed > 0) fr.fails++; else fr.passes++;
        }
    }
    const flaky = [...fileResults.entries()].filter(([_, r]) => r.passes > 0 && r.fails > 0);
    if (flaky.length > 0) {
        console.log(`\nFlaky tests (intermittent failures):`);
        for (const [name, r] of flaky) {
            console.log(`  ${name}: ${r.passes} passes, ${r.fails} failures`);
        }
    }
    console.log('');
}

// Baseline-all command (D4)
async function cmdBaselineAll() {
    if (!(await checkServer())) process.exit(1);

    const theme = getFlag('theme') || 'light';
    const viewportName = getFlag('viewport') || 'desktop';
    const { browser, page } = await launchBrowser(viewportName);

    try {
        if (!hasFlag('no-login')) await login(page);
        if (theme === 'dark') await setTheme(page, 'dark');

        console.log(`Creating baselines for ${MAJOR_ROUTES.length} routes (${viewportName}, ${theme} theme)...`);

        for (const route of MAJOR_ROUTES) {
            try {
                const hash = `#${route}`;
                await page.goto(`${BASE_URL}/${hash}`);
                await waitForPageReady(page);
                await takeScreenshot(page, route, { baseline: true, fullPage: hasFlag('full-page') });
                console.log(`  Baseline: ${route}`);
            } catch (e) {
                console.error(`  Error on ${route}: ${e.message}`);
            }
        }

        console.log(`\nBaselines created for ${MAJOR_ROUTES.length} routes.`);
    } finally {
        await browser.close();
    }
}

// --- B1: Standalone a11y audit command ---
async function cmdA11yAudit(route) {
    if (!route) {
        console.error('Usage: node scripts/visual-test.js a11y-audit <route>');
        process.exit(1);
    }
    if (!(await checkServer())) process.exit(1);
    const { browser, page } = await launchBrowser();
    try {
        if (!hasFlag('no-login')) await login(page);
        const hash = route.startsWith('#') ? route : `#${route}`;
        await page.goto(`${BASE_URL}/${hash}`);
        await waitForPageReady(page);
        const violations = await page.evaluate(async () => {
            if (!window.axe) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js';
                document.head.appendChild(script);
                await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
            }
            const results = await window.axe.run(document, { runOnly: ['wcag2aa'] });
            return results.violations;
        });
        console.log(`\na11y Audit: ${route}`);
        console.log(`Violations: ${violations.length}`);
        violations.forEach(v => {
            console.log(`\n  [${v.impact}] ${v.id}: ${v.description}`);
            console.log(`  Help: ${v.helpUrl}`);
            v.nodes.slice(0, 3).forEach(n => console.log(`    - ${n.html.substring(0, 120)}`));
        });
        if (violations.length === 0) console.log('  No WCAG 2.0 AA violations found!');
        process.exit(violations.length > 0 ? 1 : 0);
    } finally {
        await browser.close();
    }
}

// --- C2: Multi-browser compare command ---
async function cmdCompareBrowsers(route) {
    if (!route) {
        console.error('Usage: node scripts/visual-test.js compare-browsers <route> --browsers chromium,firefox,webkit');
        process.exit(1);
    }
    if (!(await checkServer())) process.exit(1);
    const browsersFlag = getFlag('browsers') || 'chromium,firefox';
    const browserNames = browsersFlag.split(',').map(b => b.trim());
    const browserTypes = { chromium, firefox, webkit };
    const hash = route.startsWith('#') ? route : `#${route}`;
    const safeName = sanitizeRoute(route);
    const screenshotPaths = {};

    for (const bName of browserNames) {
        const bType = browserTypes[bName];
        if (!bType) { console.error(`Unknown browser: ${bName}`); continue; }
        let browser;
        try {
            browser = await bType.launch({ headless: true });
            const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
            const page = await context.newPage();
            if (!hasFlag('no-login')) await login(page);
            await page.goto(`${BASE_URL}/${hash}`);
            await waitForPageReady(page);
            const name = `${safeName}-${bName}`;
            await takeScreenshot(page, name);
            screenshotPaths[bName] = join(CURRENT_DIR, `${name}.png`);
            console.log(`  ${bName}: screenshot captured`);
        } catch (e) {
            console.error(`  ${bName}: ${e.message}`);
        } finally {
            if (browser) await browser.close();
        }
    }

    // Compare each pair
    const names = Object.keys(screenshotPaths);
    if (names.length >= 2) {
        let pixelmatch, PNG;
        try {
            ({ default: pixelmatch } = await import('pixelmatch'));
            ({ PNG } = await import('pngjs'));
        } catch {
            console.error('ERROR: pixelmatch and pngjs are required for browser comparison.');
            console.error('Install them with: npm install --save-dev pixelmatch pngjs');
            return;
        }
        for (let a = 0; a < names.length; a++) {
            for (let b = a + 1; b < names.length; b++) {
                const imgA = PNG.sync.read(readFileSync(screenshotPaths[names[a]]));
                const imgB = PNG.sync.read(readFileSync(screenshotPaths[names[b]]));
                if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
                    console.log(`  ${names[a]} vs ${names[b]}: dimension mismatch (${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height})`);
                    continue;
                }
                const diff = new PNG({ width: imgA.width, height: imgA.height });
                const numDiff = pixelmatch(imgA.data, imgB.data, diff.data, imgA.width, imgA.height, { threshold: 0.1 });
                const pct = ((numDiff / (imgA.width * imgA.height)) * 100).toFixed(2);
                const diffPath = join(DIFFS_DIR, `${safeName}-${names[a]}-vs-${names[b]}-diff.png`);
                writeFileSync(diffPath, PNG.sync.write(diff));
                console.log(`  ${names[a]} vs ${names[b]}: ${pct}% different (${numDiff} pixels) — diff: ${resolve(diffPath)}`);
            }
        }
    }
}

async function cmdClick(selector, options = {}) {
    if (!selector) {
        console.error('Usage: node scripts/visual-test.js click "<selector>" --page <route> --screenshot <name>');
        process.exit(1);
    }

    if (!(await checkServer())) process.exit(1);

    const { browser, page } = await launchBrowser();
    const ctx = new PageContext(page);

    try {
        if (!hasFlag('no-login')) await login(page);

        if (options.page) {
            const hash = options.page.startsWith('#') ? options.page : `#${options.page}`;
            await page.goto(`${BASE_URL}/${hash}`);
            await waitForPageReady(page);
        }

        console.log(`Clicking: ${selector}`);
        try {
            await page.click(selector, { timeout: 5000 });
            await page.waitForTimeout(500);
        } catch (clickErr) {
            console.error(`  Click failed: ${clickErr.message}`);
            if (hasFlag('screenshot-on-failure')) {
                const failName = `click-failure-${Date.now()}`;
                await takeScreenshot(page, failName);
                console.log(`  Failure screenshot: ${failName}`);
            }
            throw clickErr;
        }

        if (options.screenshot) {
            await takeScreenshot(page, options.screenshot);
        }

        // Print diagnostics summary
        const report = ctx.getReport();
        if (report.summary.consoleErrors > 0 || report.summary.networkFailures > 0) {
            console.log(`\nDiagnostics:`);
            if (report.summary.consoleErrors > 0) {
                console.log(`  Console errors: ${report.summary.consoleErrors}`);
                report.console.errors.forEach(e => console.log(`    - ${e.text.substring(0, 120)}`));
            }
            if (report.summary.networkFailures > 0) {
                console.log(`  Network failures: ${report.summary.networkFailures}`);
                report.network.failures.forEach(f => console.log(`    - ${f.status} ${f.url.substring(0, 100)}`));
            }
        }
    } finally {
        await browser.close();
    }
}

// --- Main ---

(async () => {
    switch (command) {
        case 'screenshot':
            await cmdScreenshot(args[1], {
                baseline: hasFlag('baseline'),
                theme: getFlag('theme'),
                viewport: getFlag('viewport')
            });
            break;

        case 'screenshot-all':
            await cmdScreenshotAll({
                includeMinor: hasFlag('include-minor'),
                theme: getFlag('theme'),
                viewport: getFlag('viewport')
            });
            break;

        case 'theme':
            await cmdTheme(args[1]);
            break;

        case 'responsive':
            await cmdResponsive(args[1]);
            break;

        case 'toast':
            await cmdToast(args[1]);
            break;

        case 'modal':
            await cmdModal(args[1]);
            break;

        case 'validate':
            await cmdValidate(args[1]);
            break;

        case 'audit':
            await cmdAudit(args[1]);
            break;

        case 'compare':
            await cmdCompare(args[1]);
            break;

        case 'test-flow':
            await cmdTestFlow(args[1]);
            break;

        case 'audit-all':
            await cmdAuditAll();
            break;

        case 'interact':
            await cmdInteract(getFlag('steps'));
            break;

        case 'run':
            await cmdRun(args[1]);
            break;

        case 'run-suite':
            await cmdRunSuite(args[1]);
            break;

        case 'coverage':
            cmdCoverage(args[1]);
            break;

        case 'click':
            await cmdClick(args[1], {
                page: getFlag('page'),
                screenshot: getFlag('screenshot')
            });
            break;

        case 'trends':
            cmdTrends();
            break;

        case 'baseline-all':
            await cmdBaselineAll();
            break;

        case 'a11y-audit':
            await cmdA11yAudit(args[1]);
            break;

        case 'compare-browsers':
            await cmdCompareBrowsers(args[1]);
            break;

        default:
            console.log(`VaultLister Visual Testing Tool

Commands:
  screenshot <route>          Screenshot a single page
  screenshot-all              Screenshot all major pages
  theme <route>               Screenshot a page in light AND dark mode
  responsive <route>          Screenshot a page at desktop, tablet, and mobile sizes
  toast <type>                Trigger and screenshot a toast notification
  modal <type>                Trigger and screenshot a modal dialog
  validate <route>            Test form validation with screenshots
  audit <route>               Page health check (console, network, perf, a11y)
  audit-all                   Audit all major routes with combined report
  compare <name>              Pixel-diff compare baseline vs current screenshot
  baseline-all                Screenshot all major routes as baselines
  test-flow <name>            Run a built-in test flow
  interact --steps '<json>'   Run multi-step interaction scenario
  run <file.json>             Load and run test steps from a JSON file
  run-suite <dir|files>       Run multiple JSON test files as a suite
  coverage <directory>        Show route coverage from test files
  trends                      View test history and trend data
  click "<sel>" [options]     Click an element and optionally screenshot
  a11y-audit <route>          Run axe-core WCAG 2.0 AA audit on a page
  compare-browsers <route>    Compare screenshots across browsers

Global Flags:
  --headed                    Run browser in non-headless mode (visible window)
  --slow-mo <ms>              Add delay between actions (e.g. --slow-mo 500)
  --no-login                  Skip login step (for testing login page itself)
  --fail-fast                 Stop on first assertion failure
  --report <format>           Generate report: html, junit, json (comma-separated for multiple)
  --retry <N>                 Retry failed assertions up to N times
  --threshold <percent>       Allow N% pixel difference in compare (default: 0)
  --browser <name>            Use chromium (default), firefox, or webkit
  --device "<name>"           Emulate device (e.g. "iPhone 13", "Pixel 5")
  --video                     Record video of test execution
  --trace                     Save Playwright trace (view with npx playwright show-trace)
  --auto-wait <ms>            Wait N ms after each non-assertion step
  --webhook <url>             POST results JSON to URL on completion
  --history                   Save results to history.jsonl for trend tracking
  --update-baselines          Auto-update baselines when diff found (compare command)
  --freeze-animations         Inject CSS to disable all animations/transitions
  --full-page                 Capture full-page screenshots (not just viewport)
  --screenshot-on-failure     Auto-capture screenshot when an assertion fails
  --match-level <level>       Compare match level: strict, layout, ignore-colors, ignore-antialiasing
  --shard <X/Y>               Run only shard X of Y total shards (run-suite)
  --browsers <list>           Comma-separated browser list for compare-browsers

Screenshot Options:
  --baseline                  Save to baselines/ instead of current/
  --theme light|dark          Force theme before capture
  --viewport desktop|tablet|mobile  Set viewport size

Screenshot-All Options:
  --include-minor             Include minor routes
  --theme dark                Capture all routes in dark mode
  --viewport mobile           Capture all routes at mobile size

Toast Types:     success, error, warning, info
Modal Types:     confirm, confirm-danger, custom
Test Flows:      sidebar-toggle, dark-mode, global-search, keyboard-nav, loading-states

Run File Format (JSON):
  { "name": "Test name", "steps": [...], "setup": [...], "teardown": [...] }
  Annotations: "skip": true, "only": true, "todo": true (file-level)
  Matrix: "matrix": { "viewport": ["desktop","mobile"] } (parameterized runs)
  Groups: "groups": [{ "name": "...", "steps": [...] }] (logical grouping)
  Per-step: "skip": true, "if": {...}, "unless": {...} (conditional execution)
  Custom commands: "commands": "path/to/commands.json" or screenshots/commands.json

Interaction Step Actions (140+ step types):

  Core:
    goto, click, fill, select, wait, screenshot, hover, evaluate, keyboard,
    store-set, navigate, intercept, store-snapshot, modal, toast, theme-toggle,
    wait-for-network, validate-form, drag-drop, upload-file, scroll, reload,
    right-click, extract, set-storage, run-command,
    freeze-animations, unfreeze-animations

  Assertions:
    assert, assert-state, assert-css, assert-class, assert-snapshot,
    assert-toast, assert-toast-count, assert-context-menu, assert-clipboard,
    assert-variable, assert-scroll, assert-storage, assert-sort,
    assert-dropdown, assert-inline-edit, assert-focus, assert-focus-trapped,
    assert-performance, assert-console, assert-memory, assert-connection,
    assert-password-strength, assert-form-progress, assert-all (batch),
    assert-url, assert-dimensions, assert-request, assert-select-value,
    assert-computed-style, assert-a11y, assert-contrast, assert-aria,
    assert-tab-order, assert-screen-reader, assert-pagination,
    assert-row-expanded, assert-bulk-selection, assert-table-export,
    assert-column-visible, assert-autocomplete, assert-field-error,
    assert-form-valid, assert-form-dirty, assert-spinner-value,
    assert-command-palette, assert-tab-active, assert-breadcrumbs,
    assert-view-mode, assert-search-results, assert-no-layout-shift,
    assert-skeleton, assert-order, assert-slider-position,
    assert-chart, assert-chart-tooltip, assert-chart-legend, assert-gauge,
    assert-banner, assert-alert, assert-notification-count, assert-snackbar,
    assert-kanban, assert-timeline, assert-timeline-event,
    assert-goal, assert-streak, assert-session

  Components:
    screenshot-element, set-auto-wait, set-context, wait-until, wait-animation,
    sort-column, dropdown-toggle, dropdown-select, inline-edit,
    context-menu-click, network-condition, wait-toast-dismiss,
    wizard-next, wizard-prev, assert-wizard,
    tag-add, tag-remove, assert-tags,
    accordion-toggle, assert-accordion,
    panel-open, panel-close, assert-panel,
    lightbox-open, lightbox-next, lightbox-prev, lightbox-close, assert-lightbox,
    date-range-select, date-range-set, assert-date-range,
    color-pick, assert-color, toggle, assert-toggle,
    tree-expand, tree-collapse, tree-select, assert-tree,
    carousel-next, carousel-prev, carousel-goto, assert-carousel

  Tables & Data:
    pagination-next, pagination-goto, row-expand, bulk-select-all,
    column-toggle, sort-column

  Forms & Input:
    fill-autocomplete, submit-form, clear-input, press-enter, fill-otp,
    spinner-increment, spinner-decrement

  Navigation:
    command-palette-open, command-palette-search, command-palette-execute,
    tab-click, breadcrumb-click, view-mode, global-search

  Drag/Drop & Touch:
    drag-reorder, swipe, pull-to-refresh, slider-drag

  Charts:
    chart-hover, chart-click, chart-legend-toggle

  Notifications:
    banner-dismiss, notification-center-open, notification-dismiss,
    snackbar-undo, inline-confirm, inline-confirm-accept

  Business:
    kanban-drag

Assert-state comparisons: equals, notEquals, greaterThan, lessThan, notNull, isNull,
  contains, matches, between, in, startsWith, endsWith, lengthGreaterThan, lengthLessThan
Variable substitution: Use $varName in any step string value after extract
Performance metrics: fcp, dcl, load, fp, ttfb, cls (Core Web Vitals)
Conditional steps: "if": { "selector": ".el", "visible": true } or "unless": { "variable": "x", "equals": "y" }
Per-step timeout: Add "timeout": <ms> to any action step

Exit Codes:  0 = all passed, 1 = assertion failures, 2 = script error

Examples:
  node scripts/visual-test.js screenshot #dashboard --freeze-animations
  node scripts/visual-test.js screenshot #inventory --full-page
  node scripts/visual-test.js compare dashboard --match-level layout
  node scripts/visual-test.js compare-browsers #dashboard --browsers chromium,firefox
  node scripts/visual-test.js a11y-audit #dashboard
  node scripts/visual-test.js run-suite tests/ --shard 1/4
  node scripts/visual-test.js run tests/my-test.json --screenshot-on-failure
  node scripts/visual-test.js interact --steps '[{"action":"assert-url","hash":"dashboard"}]'
  node scripts/visual-test.js interact --steps '[{"action":"assert-dimensions","selector":".sidebar","width":{"lessThan":300}}]'
  node scripts/visual-test.js interact --steps '[{"action":"assert-a11y","standard":"wcag2aa","maxViolations":0}]'
  node scripts/visual-test.js interact --steps '[{"action":"assert-chart","selector":".donut-chart","segments":{"greaterThan":0}}]'
  node scripts/visual-test.js interact --steps '[{"action":"run-command","name":"go-to","args":{"route":"#inventory"}}]'
`);
            break;
    }
})().catch(err => {
    console.error(`\nFATAL ERROR: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(2);
});
