// Test the 4 remaining testable categories:
// 1. AudioContext (alternative site)
// 2. Screen/Display (alternative site)
// 3. Pixelscan bot check (automate the click)
// 4. CoverYourTracks EFF (automate the click)

import { stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs, stealthContextOptions, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS } from '../worker/bots/stealth.js';
import { Camoufox } from 'camoufox-js';

const SITES = [
    {
        name: 'audiocontext',
        url: 'https://audiofingerprint.openwpm.com/',
        wait: 5000,
        interact: null
    },
    {
        name: 'screeninfo',
        url: 'https://www.browserscan.net/screen',
        wait: 5000,
        interact: null
    },
    {
        name: 'pixelscan-botcheck',
        url: 'https://pixelscan.net/bot-check',
        wait: 3000,
        interact: async (page) => {
            // Click the "Check" or start button
            const btn = await page.$('button, [role="button"], a[href*="check"], .btn');
            if (btn) { await btn.click(); await page.waitForTimeout(8000); }
        }
    },
    {
        name: 'coveryourtracks',
        url: 'https://coveryourtracks.eff.org/',
        wait: 3000,
        interact: async (page) => {
            // Click "Test Me" button
            const btn = await page.$('button:has-text("Test"), a:has-text("Test"), .test-btn, #test-me, a[href*="kcarter"]');
            if (btn) { await btn.click(); await page.waitForTimeout(10000); }
        }
    },
    {
        name: 'audiocontext-browserleaks',
        url: 'https://browserleaks.com/features',
        wait: 5000,
        interact: null
    },
    {
        name: 'fingerprintjs-demo',
        url: 'https://fingerprint.com/demo/',
        wait: 8000,
        interact: null
    },
];

async function extractVerdict(page) {
    return page.evaluate(() => {
        const body = document.body?.innerText || '';
        const lines = body.split('\n').filter(l =>
            /audio|screen|fingerprint|bot|human|detect|unique|tracking|protected|browser|hash|score|resolution|width|height/i.test(l)
        );
        return lines.slice(0, 10).join(' | ');
    });
}

async function runTests(label, launchFn) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ${label}`);
    console.log(`${'='.repeat(70)}`);

    const { browser, page } = await launchFn();

    for (const site of SITES) {
        process.stdout.write(`  ${site.name.padEnd(30)}`);
        try {
            await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(site.wait);

            if (site.interact) {
                await site.interact(page);
            }

            const prefix = label.charAt(0).toLowerCase();
            await page.screenshot({ path: `data/remain-${prefix}-${site.name}.png`, fullPage: true });

            const v = await extractVerdict(page);
            console.log(v ? v.substring(0, 140) : '(check screenshot)');
        } catch (e) {
            console.log(`ERROR: ${e.message.substring(0, 80)}`);
        }
    }
    await browser.close();
}

async function launchA() {
    const browser = await stealthChromium.launch({
        headless: true, args: STEALTH_ARGS, ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
    });
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

console.log('Remaining Testable Categories — 6 sites x 3 approaches\n');

await runTests('A) Current Stealth', launchA);
await runTests('B) Camoufox', launchB);
await runTests('C) Hybrid', launchC);

console.log('\n=== DONE ===');
