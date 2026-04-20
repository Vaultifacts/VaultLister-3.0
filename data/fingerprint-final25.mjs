// Test all 25 remaining untested signals across 3 approaches
// Split into: BrowserLeaks pages (10) + inline JS checks (15)

import { stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs, stealthContextOptions, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS } from '../worker/bots/stealth.js';
import { Camoufox } from 'camoufox-js';

const BROWSERLEAKS_SITES = [
    { name: 'webgpu', url: 'https://browserleaks.com/webgpu', wait: 5000 },
    { name: 'client-hints', url: 'https://browserleaks.com/client-hints', wait: 5000 },
    { name: 'quic', url: 'https://browserleaks.com/quic', wait: 5000 },
    { name: 'clientrects', url: 'https://browserleaks.com/rects', wait: 5000 },
    { name: 'geolocation', url: 'https://browserleaks.com/geo', wait: 5000 },
    { name: 'content-filters', url: 'https://browserleaks.com/proxy', wait: 5000 },
    { name: 'tcp-fingerprint', url: 'https://browserleaks.com/tcp', wait: 5000 },
    { name: 'css-media', url: 'https://browserleaks.com/css', wait: 5000 },
    { name: 'audiocontext-wbt', url: 'https://webbrowsertools.com/audiocontext-fingerprint/', wait: 8000 },
    { name: 'webgpu-wbt', url: 'https://webbrowsertools.com/webgpu-fingerprint/', wait: 5000 },
];

// Inline JS checks for signals with no dedicated test site
const JS_CHECKS = [
    {
        name: 'speechSynthesis-voices',
        fn: `(() => {
            if (!window.speechSynthesis) return 'API not available';
            const voices = speechSynthesis.getVoices();
            return voices.length + ' voices: ' + voices.slice(0,3).map(v => v.name).join(', ');
        })()`
    },
    {
        name: 'gamepad-api',
        fn: `(() => {
            if (!navigator.getGamepads) return 'API not available';
            const pads = navigator.getGamepads();
            return 'getGamepads() returns ' + pads.length + ' slots, all null: ' + Array.from(pads).every(p => p === null);
        })()`
    },
    {
        name: 'touch-pointer',
        fn: `(() => ({
            maxTouchPoints: navigator.maxTouchPoints,
            pointerEnabled: !!window.PointerEvent,
            touchEnabled: 'ontouchstart' in window,
            matchesCoarse: matchMedia('(pointer: coarse)').matches,
            matchesFine: matchMedia('(pointer: fine)').matches
        }))()`
    },
    {
        name: 'math-precision',
        fn: `(() => ({
            tan: Math.tan(-1e300),
            sin: Math.sin(Math.PI),
            cos: Math.cos(20.4),
            exp: Math.exp(1),
            log: Math.log(10),
            acos: Math.acos(0.5),
            acosh: Math.acosh(2)
        }))()`
    },
    {
        name: 'intl-formatting',
        fn: `(() => ({
            resolvedLocale: Intl.DateTimeFormat().resolvedOptions().locale,
            resolvedTZ: Intl.DateTimeFormat().resolvedOptions().timeZone,
            numberFormat: new Intl.NumberFormat().format(1234567.89),
            dateFormat: new Intl.DateTimeFormat('en-US').format(new Date(2026, 0, 1)),
            listFormat: typeof Intl.ListFormat
        }))()`
    },
    {
        name: 'performance-precision',
        fn: `(() => {
            const times = [];
            for (let i = 0; i < 20; i++) times.push(performance.now());
            const diffs = times.slice(1).map((t, i) => t - times[i]);
            const minDiff = Math.min(...diffs.filter(d => d > 0));
            return { precision: minDiff, sample: times.slice(0, 5).map(t => t.toFixed(6)) };
        })()`
    },
    {
        name: 'media-devices',
        fn: `(async () => {
            if (!navigator.mediaDevices?.enumerateDevices) return 'API not available';
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.map(d => ({ kind: d.kind, label: d.label || '(empty)', deviceId: d.deviceId?.substring(0, 8) }));
        })()`
    },
    {
        name: 'css-supports',
        fn: `(() => ({
            grid: CSS.supports('display', 'grid'),
            subgrid: CSS.supports('grid-template-columns', 'subgrid'),
            containerQuery: CSS.supports('container-type', 'inline-size'),
            hasSelector: CSS.supports('selector(:has(*))'),
            colorMix: CSS.supports('color', 'color-mix(in srgb, red 50%, blue)'),
            backdropFilter: CSS.supports('backdrop-filter', 'blur(10px)')
        }))()`
    },
    {
        name: 'storage-apis',
        fn: `(() => ({
            localStorage: typeof localStorage !== 'undefined',
            sessionStorage: typeof sessionStorage !== 'undefined',
            indexedDB: typeof indexedDB !== 'undefined',
            caches: typeof caches !== 'undefined',
            cookieEnabled: navigator.cookieEnabled
        }))()`
    },
    {
        name: 'hsts-state',
        fn: `(() => ({
            securityPolicy: document.securityPolicy || 'undefined',
            isSecureContext: window.isSecureContext,
            crossOriginIsolated: window.crossOriginIsolated
        }))()`
    },
    {
        name: 'css-system-styles',
        fn: `(() => {
            const el = document.createElement('div');
            document.body.appendChild(el);
            const cs = getComputedStyle(el);
            const sample = {
                fontFamily: cs.fontFamily,
                fontSize: cs.fontSize,
                lineHeight: cs.lineHeight,
                color: cs.color,
                direction: cs.direction
            };
            el.remove();
            return sample;
        })()`
    },
    {
        name: 'htmlelement-proto',
        fn: `(() => ({
            htmlKeys: Object.getOwnPropertyNames(HTMLElement.prototype).length,
            divKeys: Object.getOwnPropertyNames(HTMLDivElement.prototype).length,
            inputKeys: Object.getOwnPropertyNames(HTMLInputElement.prototype).length,
            toString: HTMLElement.prototype.toString.call(document.createElement('div'))
        }))()`
    },
    {
        name: 'emoji-domrect',
        fn: `(() => {
            const el = document.createElement('span');
            el.textContent = '😀';
            el.style.fontSize = '16px';
            el.style.position = 'absolute';
            document.body.appendChild(el);
            const rect = el.getBoundingClientRect();
            const result = { width: rect.width, height: rect.height, x: rect.x, y: rect.y };
            el.remove();
            return result;
        })()`
    },
    {
        name: 'textmetrics',
        fn: `(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            const m = ctx.measureText('Hello World');
            return {
                width: m.width,
                actualBoundingBoxAscent: m.actualBoundingBoxAscent,
                actualBoundingBoxDescent: m.actualBoundingBoxDescent,
                fontBoundingBoxAscent: m.fontBoundingBoxAscent,
                fontBoundingBoxDescent: m.fontBoundingBoxDescent
            };
        })()`
    },
    {
        name: 'resistance-detection',
        fn: `(() => ({
            braveShields: !!navigator.brave,
            firefoxResist: CSS.supports('-moz-appearance', 'none') && navigator.maxTouchPoints === 0,
            torBrowser: Intl.DateTimeFormat().resolvedOptions().timeZone === 'UTC' && navigator.plugins.length === 0,
            spoofedUA: navigator.userAgent.includes('HeadlessChrome') || navigator.userAgent.includes('Headless'),
            webdriverPresent: !!navigator.webdriver
        }))()`
    },
];

async function runPageTests(label, page) {
    console.log(`\n  --- BrowserLeaks Pages ---`);
    for (const site of BROWSERLEAKS_SITES) {
        process.stdout.write(`  ${site.name.padEnd(22)}`);
        try {
            await page.goto(site.url, { waitUntil: 'networkidle', timeout: 20000 });
            await page.waitForTimeout(site.wait);
            const prefix = label.charAt(0).toLowerCase();
            await page.screenshot({ path: `data/final25-${prefix}-${site.name}.png`, fullPage: true });
            console.log('captured');
        } catch (e) {
            console.log(`ERROR: ${e.message.substring(0, 60)}`);
        }
    }
}

async function runJSChecks(label, page) {
    console.log(`\n  --- Inline JS Checks ---`);
    // Navigate to a blank page for clean JS context
    await page.goto('about:blank').catch(() => {});
    await page.waitForTimeout(500);

    for (const check of JS_CHECKS) {
        process.stdout.write(`  ${check.name.padEnd(22)}`);
        try {
            const result = await page.evaluate(check.fn);
            const str = typeof result === 'object' ? JSON.stringify(result) : String(result);
            console.log(str.substring(0, 120));
        } catch (e) {
            console.log(`ERROR: ${e.message.substring(0, 60)}`);
        }
    }
}

async function runAll(label, launchFn) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ${label}`);
    console.log(`${'='.repeat(70)}`);
    const { browser, page } = await launchFn();
    await runPageTests(label, page);
    await runJSChecks(label, page);
    await browser.close();
}

async function launchA() {
    const browser = await stealthChromium.launch({ headless: true, args: STEALTH_ARGS, ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS });
    const context = await browser.newContext(stealthContextOptions('chrome'));
    const page = await context.newPage();
    await injectChromeRuntimeStub(page);
    await injectBrowserApiStubs(page);
    return { browser, page };
}
async function launchB() {
    const browser = await Camoufox({ headless: true, humanize: true, block_webrtc: true });
    const page = await browser.newPage();
    return { browser, page };
}
async function launchC() {
    const browser = await Camoufox({ headless: true, humanize: true, block_webrtc: true });
    const page = await browser.newPage();
    await injectBrowserApiStubs(page);
    return { browser, page };
}

console.log('Final 25 Untested Signals — 10 pages + 15 JS checks x 3 approaches');
console.log('This will take several minutes...\n');

await runAll('A) Current Stealth', launchA);
await runAll('B) Camoufox', launchB);
await runAll('C) Hybrid', launchC);

console.log('\n=== ALL 25 SIGNALS TESTED ===');
