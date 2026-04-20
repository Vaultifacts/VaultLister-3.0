#!/usr/bin/env node
// Fingerprint Self-Test — Runs inside Camoufox to detect known detection vectors
// Tests: CDP serialization leak, WebGPU adapter info, JA4 consistency,
//        cross-attribute coherence, RFP artifacts, navigator inconsistencies
//
// Usage: bun worker/bots/fingerprint-self-test.js
//        (Requires Camoufox installed — runs on Linux/Railway only)

import { launchCamoufox } from './stealth.js';
import { initProfiles, getProfileDir, getProfileBehavior } from './browser-profiles.js';
import fs from 'fs';
import path from 'path';

const PASS = '\x1b[32mPASS\x1b[0m';
const WARN = '\x1b[33mWARN\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';

let passes = 0, warnings = 0, failures = 0;
function check(label, status, detail = '') {
    const icon = status === 'pass' ? PASS : status === 'warn' ? WARN : FAIL;
    if (status === 'pass') passes++;
    else if (status === 'warn') warnings++;
    else failures++;
    console.log(`  ${icon} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function runTests() {
    console.log('\n=== Fingerprint Self-Test (Camoufox) ===\n');

    initProfiles();
    const profileDir = getProfileDir('profile-1');

    let browser, page;
    try {
        console.log('Launching Camoufox...');
        const launched = await launchCamoufox({ profileDir, headless: true });
        browser = launched.browser;
        page = launched.page;
        console.log('Browser launched.\n');
    } catch (err) {
        console.error('Failed to launch Camoufox:', err.message);
        console.log('\nThis test requires Camoufox installed. Run on Linux/Railway.');
        process.exit(1);
    }

    try {
        await page.goto('about:blank');

        // 1. CDP Serialization Leak (Gap #15)
        console.log('CDP Serialization Leak:');
        const cdpLeak = await page.evaluate(() => {
            return new Promise(resolve => {
                let leaked = false;
                const obj = {};
                Object.defineProperty(obj, 'toJSON', {
                    get: () => { leaked = true; return () => '{}'; }
                });
                try { JSON.stringify(obj); } catch {}
                resolve(leaked);
            });
        });
        check('CDP JSON.stringify leak', cdpLeak ? 'fail' : 'pass',
            cdpLeak ? 'CDP is serializing page objects — detectable' : 'No CDP serialization detected');

        // 2. navigator.webdriver
        console.log('\nAutomation Flags:');
        const webdriver = await page.evaluate(() => navigator.webdriver);
        check('navigator.webdriver', webdriver ? 'fail' : 'pass',
            webdriver ? 'true — automation detected' : 'false/undefined');

        // 3. Chrome-only APIs on Firefox (Cross-attribute coherence)
        console.log('\nCross-Attribute Coherence:');
        const deviceMemory = await page.evaluate(() => navigator.deviceMemory);
        check('navigator.deviceMemory (Chrome-only)', deviceMemory === undefined ? 'pass' : 'fail',
            deviceMemory === undefined ? 'undefined (correct for Firefox)' : `${deviceMemory} — should not exist in Firefox`);

        const perfMemory = await page.evaluate(() => typeof performance.memory);
        check('performance.memory (Chrome-only)', perfMemory === 'undefined' ? 'pass' : 'fail',
            perfMemory === 'undefined' ? 'undefined (correct for Firefox)' : 'exists — spoofing detected');

        // 4. Battery API (Firefox removed in v52)
        const hasBattery = await page.evaluate(() => typeof navigator.getBattery === 'function');
        check('navigator.getBattery (removed in Firefox)', !hasBattery ? 'pass' : 'fail',
            !hasBattery ? 'absent (correct)' : 'present — inconsistent with Firefox');

        // 5. WebGL Renderer
        console.log('\nWebGL/GPU:');
        const webglInfo = await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return { renderer: 'N/A', vendor: 'N/A' };
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            return {
                renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'N/A',
                vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'N/A',
            };
        });
        const isSoftware = /swiftshader|llvmpipe|softpipe|mesa/i.test(webglInfo.renderer);
        check('WebGL renderer', isSoftware ? 'warn' : 'pass',
            `${webglInfo.renderer} / ${webglInfo.vendor}${isSoftware ? ' (software renderer — non-consumer)' : ''}`);

        // 6. WebGPU adapter info (Gap #16)
        const webgpuInfo = await page.evaluate(async () => {
            if (!navigator.gpu) return { available: false };
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) return { available: false };
                const info = await adapter.requestAdapterInfo?.() || {};
                return { available: true, vendor: info.vendor || 'unknown', architecture: info.architecture || 'unknown', device: info.device || 'unknown' };
            } catch { return { available: false }; }
        });
        if (!webgpuInfo.available) {
            check('WebGPU adapter', 'pass', 'Not available (safe — no leak)');
        } else {
            const isSoftGpu = /llvmpipe|softpipe|mesa|swiftshader/i.test(webgpuInfo.device + webgpuInfo.vendor);
            check('WebGPU adapter', isSoftGpu ? 'warn' : 'pass',
                `${webgpuInfo.vendor}/${webgpuInfo.device}${isSoftGpu ? ' (software — non-consumer)' : ''}`);
        }

        // 7. performance.now() resolution (RFP detection)
        console.log('\nTiming:');
        const timingResolution = await page.evaluate(() => {
            const samples = [];
            for (let i = 0; i < 100; i++) {
                const a = performance.now();
                const b = performance.now();
                if (b > a) samples.push(b - a);
            }
            if (samples.length === 0) return { clamped: true, resolution: 'no variance' };
            const allInteger = samples.every(s => s === Math.round(s));
            const minDiff = Math.min(...samples);
            return { clamped: allInteger && minDiff >= 1, resolution: `${minDiff.toFixed(4)}ms min diff` };
        });
        check('performance.now() resolution', timingResolution.clamped ? 'warn' : 'pass',
            timingResolution.clamped ? `Clamped to 1ms — RFP may be active (${timingResolution.resolution})` : `Sub-ms resolution (${timingResolution.resolution})`);

        // 8. User Agent consistency
        console.log('\nUA Consistency:');
        const uaData = await page.evaluate(() => ({
            ua: navigator.userAgent,
            platform: navigator.platform,
            oscpu: navigator.oscpu,
            productSub: navigator.productSub,
        }));
        const isFirefox = /Firefox\/\d+/.test(uaData.ua);
        check('UA declares Firefox', isFirefox ? 'pass' : 'warn',
            isFirefox ? uaData.ua.match(/Firefox\/\d+/)[0] : `UA: ${uaData.ua.slice(0, 60)}`);

        // Firefox productSub should be "20100101"
        check('productSub', uaData.productSub === '20100101' ? 'pass' : 'warn',
            `${uaData.productSub} (Firefox should be 20100101)`);

        // 9. Plugin count (Firefox should have 5 standard plugins)
        const pluginCount = await page.evaluate(() => navigator.plugins.length);
        check('navigator.plugins', pluginCount >= 1 ? 'pass' : 'warn',
            `${pluginCount} plugins`);

        // 10. Canvas consistency — same hash on repeated calls
        console.log('\nFingerprint Stability:');
        const canvasStable = await page.evaluate(() => {
            function getCanvasHash() {
                const c = document.createElement('canvas');
                c.width = 200; c.height = 50;
                const ctx = c.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillText('fingerprint test 🎨', 2, 2);
                return c.toDataURL();
            }
            const h1 = getCanvasHash();
            const h2 = getCanvasHash();
            return h1 === h2;
        });
        check('Canvas hash stability', canvasStable ? 'pass' : 'warn',
            canvasStable ? 'Same hash on repeated calls' : 'Hash varies — randomization detected (suspicious)');

        // 11. Fingerprint config persistence check
        console.log('\nConfig Persistence:');
        const fpConfigPath = path.join(profileDir, '.fingerprint-config.json');
        const hasFpConfig = fs.existsSync(fpConfigPath);
        check('Fingerprint config saved', hasFpConfig ? 'pass' : 'warn',
            hasFpConfig ? 'Config persisted for reuse' : 'No saved config — fingerprint will change next run');

    } catch (err) {
        console.error('Test error:', err.message);
        failures++;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }

    console.log(`\n=== Summary: ${passes} pass, ${warnings} warn, ${failures} fail ===\n`);
    if (failures > 0) {
        console.log('FAIL items are active detection vectors — fix before going live.');
    } else if (warnings > 0) {
        console.log('WARN items may be detectable in some contexts. Review individually.');
    } else {
        console.log('All fingerprint checks passed.');
    }

    process.exit(failures > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
