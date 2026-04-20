// Test the 6 untested detection categories across all 3 approaches

import { stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs, stealthContextOptions, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS } from '../worker/bots/stealth.js';
import { Camoufox } from 'camoufox-js';

const SITES = [
    { name: 'tls-fingerprint', url: 'https://www.browserscan.net/tls', wait: 8000 },
    { name: 'http2-fingerprint', url: 'https://scrapfly.io/web-scraping-tools/http2-fingerprint', wait: 8000 },
    { name: 'tcp-ip', url: 'https://browserleaks.com/ip', wait: 5000 },
    { name: 'audio-fingerprint', url: 'https://browserleaks.com/audio', wait: 5000 },
    { name: 'dns-leak', url: 'https://www.browserscan.net/dns-leak', wait: 10000 },
    { name: 'screen-display', url: 'https://browserleaks.com/screen', wait: 5000 },
];

async function extractVerdict(page) {
    return page.evaluate(() => {
        const body = document.body?.innerText || '';
        const lines = body.split('\n').filter(l =>
            /fingerprint|JA3|JA4|TLS|HTTP\/2|h2|leak|mismatch|audio|screen|resolution|dns|detected|hash|version|cipher|protocol/i.test(l)
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
        process.stdout.write(`  ${site.name.padEnd(22)}`);
        try {
            await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(site.wait);

            const prefix = label.charAt(0).toLowerCase();
            await page.screenshot({ path: `data/untested-${prefix}-${site.name}.png`, fullPage: true });

            const v = await extractVerdict(page);
            console.log(v ? v.substring(0, 150) : '(check screenshot)');
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

console.log('Untested Categories — 6 sites x 3 approaches\n');

await runTests('A) Current Stealth', launchA);
await runTests('B) Camoufox', launchB);
await runTests('C) Hybrid', launchC);

console.log('\n=== DONE ===');
console.log('Screenshots: data/untested-{a,b,c}-{sitename}.png');
