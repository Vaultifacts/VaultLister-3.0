// Additional bot detection tests not covered in the first run
// Tests: BrowserScan, Pixelscan Bot Check, Rebrowser Bot Detector,
//        DeviceAndBrowserInfo, Incolumitas (with deeper extraction)

import { stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs, stealthContextOptions, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS } from '../worker/bots/stealth.js';
import { Camoufox } from 'camoufox-js';

const SITES = [
    { name: 'browserscan-bot', url: 'https://www.browserscan.net/bot-detection', wait: 8000 },
    { name: 'pixelscan-botcheck', url: 'https://pixelscan.net/bot-check', wait: 8000 },
    { name: 'rebrowser-detector', url: 'https://bot-detector.rebrowser.net/', wait: 10000 },
    { name: 'devicebrowserinfo', url: 'https://deviceandbrowserinfo.com/are_you_a_bot', wait: 8000 },
    { name: 'browserscan-webrtc', url: 'https://www.browserscan.net/webrtc', wait: 5000 },
    { name: 'browserscan-fingerprint', url: 'https://www.browserscan.net/fingerprint', wait: 8000 },
];

async function extractVerdict(page) {
    return page.evaluate(() => {
        const body = document.body?.innerText || '';
        const lines = body.split('\n').filter(l =>
            /bot|human|detect|automation|headless|webdriver|score|result|passed|failed|status|leak|risk|safe|normal|suspicious/i.test(l)
        );
        return lines.slice(0, 12).join(' | ');
    });
}

async function runTests(label, launchFn) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ${label}`);
    console.log(`${'='.repeat(70)}`);

    const { browser, page } = await launchFn();

    for (const site of SITES) {
        process.stdout.write(`  ${site.name.padEnd(28)}`);
        try {
            await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(site.wait);

            const prefix = label.charAt(0).toLowerCase();
            await page.screenshot({ path: `data/extra-${prefix}-${site.name}.png`, fullPage: true });

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

console.log('Extra Fingerprint Tests — 6 sites x 3 approaches\n');

await runTests('A) Current Stealth', launchA);
await runTests('B) Camoufox', launchB);
await runTests('C) Hybrid', launchC);

console.log('\n=== DONE ===');
console.log('Screenshots: data/extra-{a,b,c}-{sitename}.png');
