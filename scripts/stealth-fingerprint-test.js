#!/usr/bin/env node
/**
 * Stealth Fingerprint Test
 * Launches the stealth browser and checks all the signals that bot detectors use.
 * Outputs PASS/FAIL for each check.
 */

import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS } from '../src/shared/automations/stealth.js';

const ua = randomChromeUA();
const vp = randomViewport();

console.log('');
console.log('=== Stealth Fingerprint Test ===');
console.log(`UA: ${ua}`);
console.log(`Viewport: ${vp.width}x${vp.height}`);
console.log('');

let browser;
try {
    browser = await stealthChromium.launch({
        headless: true,
        args: STEALTH_ARGS,
        ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS,
    });

    const context = await browser.newContext({
        userAgent: ua,
        viewport: vp,
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });

    const page = await context.newPage();

    // Run all fingerprint checks in the browser context
    const results = await page.evaluate(() => {
        const checks = [];

        // 1. navigator.webdriver — must be false/undefined
        checks.push({
            name: 'navigator.webdriver',
            value: String(navigator.webdriver),
            pass: !navigator.webdriver,
            detail: navigator.webdriver ? 'EXPOSED as automated' : 'Hidden'
        });

        // 2. Chrome runtime — real Chrome has window.chrome
        checks.push({
            name: 'window.chrome exists',
            value: String(!!window.chrome),
            pass: !!window.chrome,
            detail: window.chrome ? 'Present (looks real)' : 'Missing (bot signal)'
        });

        // 3. chrome.runtime — real Chrome has this
        checks.push({
            name: 'chrome.runtime',
            value: String(!!window.chrome?.runtime),
            pass: !!window.chrome?.runtime,
            detail: window.chrome?.runtime ? 'Present' : 'Missing'
        });

        // 4. Permissions API — headless Chrome often fails this
        let permCheck = 'unknown';
        try {
            // In automation, Notification.permission is often 'denied' immediately
            permCheck = Notification.permission;
        } catch { permCheck = 'error'; }
        checks.push({
            name: 'Notification.permission',
            value: permCheck,
            pass: permCheck !== 'error',
            detail: permCheck
        });

        // 5. navigator.plugins — real browsers have plugins, headless often has 0
        checks.push({
            name: 'navigator.plugins.length',
            value: String(navigator.plugins.length),
            pass: navigator.plugins.length > 0,
            detail: navigator.plugins.length > 0 ? `${navigator.plugins.length} plugins` : 'Empty (bot signal)'
        });

        // 6. navigator.languages — should be populated
        checks.push({
            name: 'navigator.languages',
            value: JSON.stringify(navigator.languages),
            pass: navigator.languages && navigator.languages.length > 0,
            detail: navigator.languages?.join(', ') || 'Empty'
        });

        // 7. WebGL renderer — should not be "SwiftShader" (headless indicator)
        let webglRenderer = 'unknown';
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                }
            }
        } catch { webglRenderer = 'error'; }
        const isSwiftShader = webglRenderer.toLowerCase().includes('swiftshader');
        checks.push({
            name: 'WebGL renderer',
            value: webglRenderer,
            pass: !isSwiftShader && webglRenderer !== 'unknown',
            detail: isSwiftShader ? 'SwiftShader detected (headless indicator)' : webglRenderer
        });

        // 8. WebGL vendor
        let webglVendor = 'unknown';
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                }
            }
        } catch { webglVendor = 'error'; }
        checks.push({
            name: 'WebGL vendor',
            value: webglVendor,
            pass: webglVendor !== 'unknown' && webglVendor !== 'error',
            detail: webglVendor
        });

        // 9. Headless detection via User-Agent
        const uaLower = navigator.userAgent.toLowerCase();
        const hasHeadless = uaLower.includes('headless');
        checks.push({
            name: 'UA headless string',
            value: String(!hasHeadless),
            pass: !hasHeadless,
            detail: hasHeadless ? 'Contains "headless"' : 'Clean'
        });

        // 10. window.outerWidth/outerHeight — headless often has 0
        checks.push({
            name: 'window.outerWidth > 0',
            value: String(window.outerWidth),
            pass: window.outerWidth > 0,
            detail: `${window.outerWidth}x${window.outerHeight}`
        });

        // 11. navigator.connection — real browsers usually have this
        checks.push({
            name: 'navigator.connection',
            value: String(!!navigator.connection),
            pass: !!navigator.connection,
            detail: navigator.connection ? `rtt=${navigator.connection.rtt}, type=${navigator.connection.effectiveType}` : 'Missing'
        });

        // 12. screen dimensions — should be reasonable
        checks.push({
            name: 'screen.width/height',
            value: `${screen.width}x${screen.height}`,
            pass: screen.width > 0 && screen.height > 0,
            detail: `${screen.width}x${screen.height}, depth=${screen.colorDepth}`
        });

        // 13. StackTrace automation detection — Playwright adds specific traces
        let stackClean = true;
        try {
            throw new Error('test');
        } catch (e) {
            if (e.stack && (e.stack.includes('playwright') || e.stack.includes('puppeteer'))) {
                stackClean = false;
            }
        }
        checks.push({
            name: 'Stack trace clean',
            value: String(stackClean),
            pass: stackClean,
            detail: stackClean ? 'No automation traces' : 'Playwright/Puppeteer in stack'
        });

        // 14. document.hasFocus — in headless, this is often false
        checks.push({
            name: 'document.hasFocus()',
            value: String(document.hasFocus()),
            pass: true, // informational — headless will show false
            detail: document.hasFocus() ? 'Focused' : 'Not focused (expected in headless)'
        });

        // 15. Automation-specific properties
        const automationProps = [
            'callPhantom', '__nightmare', '_phantom', 'domAutomation',
            'domAutomationController', '_selenium', 'callSelenium',
            '__webdriver_evaluate', '__driver_evaluate', '__webdriver_unwrap',
            '__driver_unwrap', '__fxdriver_evaluate', '__fxdriver_unwrap',
            '_Selenium_IDE_Recorder', 'calledSelenium', '_WEBDRIVER_ELEM_CACHE',
            'ChromeDriverw', 'driver-hierarchical', 'cdc_', 'webdriver'
        ];
        const found = automationProps.filter(p => p in window || p in document);
        checks.push({
            name: 'Automation globals',
            value: String(found.length === 0),
            pass: found.length === 0,
            detail: found.length === 0 ? 'None found' : `Found: ${found.join(', ')}`
        });

        // 16. Check for CDP (Chrome DevTools Protocol) artifacts
        let cdpClean = true;
        try {
            // Runtime.evaluate leaves artifacts sometimes
            if (window.cdc_adoQpoasnfa76pfcZLmcfl_Array ||
                window.cdc_adoQpoasnfa76pfcZLmcfl_Promise) {
                cdpClean = false;
            }
            // Check for __proto__ modifications
            const desc = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
            if (desc && desc.get && desc.get.toString().includes('native code') === false) {
                // Manually overridden — stealth plugin does this correctly
            }
        } catch {}
        checks.push({
            name: 'CDP artifacts',
            value: String(cdpClean),
            pass: cdpClean,
            detail: cdpClean ? 'Clean' : 'CDP artifacts detected'
        });

        return checks;
    });

    // Print results
    let passCount = 0;
    let failCount = 0;

    for (const check of results) {
        const icon = check.pass ? 'PASS' : 'FAIL';
        const color = check.pass ? '\x1b[32m' : '\x1b[31m';
        console.log(`${color}[${icon}]\x1b[0m ${check.name}: ${check.detail}`);
        if (check.pass) passCount++;
        else failCount++;
    }

    console.log('');
    console.log(`Results: ${passCount} passed, ${failCount} failed out of ${results.length} checks`);

    if (failCount === 0) {
        console.log('\x1b[32m✓ All stealth checks passed — bot fingerprint looks clean\x1b[0m');
    } else {
        console.log(`\x1b[33m⚠ ${failCount} check(s) failed — review above for detection risks\x1b[0m`);
    }

    // Bonus: test against a real page to see if we get blocked
    console.log('');
    console.log('--- Poshmark Homepage Test ---');
    try {
        const response = await page.goto('https://poshmark.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
        const status = response?.status();
        const url = page.url();
        const hasCaptcha = await page.$('iframe[src*="recaptcha"], iframe[src*="captcha"], .g-recaptcha, #captcha, [class*="captcha"]');
        const hasBlock = await page.$('[class*="blocked"], [class*="denied"], [class*="banned"]');
        const title = await page.title();

        console.log(`Status: ${status}`);
        console.log(`URL: ${url}`);
        console.log(`Title: ${title}`);

        if (hasCaptcha) {
            console.log('\x1b[31m[FAIL] CAPTCHA detected on homepage\x1b[0m');
        } else {
            console.log('\x1b[32m[PASS] No CAPTCHA on homepage\x1b[0m');
        }

        if (hasBlock) {
            console.log('\x1b[31m[FAIL] Block/ban page detected\x1b[0m');
        } else {
            console.log('\x1b[32m[PASS] No block page detected\x1b[0m');
        }

        if (status === 403 || status === 429) {
            console.log(`\x1b[31m[FAIL] HTTP ${status} — likely bot detection\x1b[0m`);
        } else if (status >= 200 && status < 400) {
            console.log(`\x1b[32m[PASS] HTTP ${status} — page loaded successfully\x1b[0m`);
        }
    } catch (e) {
        console.log(`\x1b[31m[FAIL] Could not load Poshmark: ${e.message}\x1b[0m`);
    }

    console.log('');
    await browser.close();

} catch (e) {
    console.error('Fatal error:', e.message);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
}
