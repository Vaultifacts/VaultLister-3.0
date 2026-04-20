import { stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs, stealthContextOptions, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS } from '../worker/bots/stealth.js';

const browser = await stealthChromium.launch({
    headless: true,
    args: STEALTH_ARGS,
    ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
});

const context = await browser.newContext(stealthContextOptions('chrome'));
const page = await context.newPage();
await injectChromeRuntimeStub(page);
await injectBrowserApiStubs(page);

const sites = [
    { name: 'CreepJS', url: 'https://abrahamjuliot.github.io/creepjs/', wait: 15000 },
    { name: 'FingerprintJS-BotD', url: 'https://fingerprintjs.github.io/BotD/', wait: 8000 },
    { name: 'Pixelscan', url: 'https://pixelscan.net/', wait: 10000 },
    { name: 'BrowserLeaks-Canvas', url: 'https://browserleaks.com/canvas', wait: 5000 },
    { name: 'BrowserLeaks-WebRTC', url: 'https://browserleaks.com/webrtc', wait: 5000 },
    { name: 'BrowserLeaks-WebGL', url: 'https://browserleaks.com/webgl', wait: 5000 },
];

for (const site of sites) {
    console.log(`\n=== ${site.name} ===`);
    console.log(`Navigating to ${site.url}...`);
    try {
        await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(site.wait);

        const filename = `data/fp-${site.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
        await page.screenshot({ path: filename, fullPage: true });
        console.log(`Screenshot: ${filename}`);

        // Extract any visible bot/human verdict from the page
        const verdict = await page.evaluate(() => {
            const body = document.body?.innerText || '';
            const lines = body.split('\n').filter(l =>
                /bot|human|detected|automation|headless|trust|score|grade|rating|passed|failed|status/i.test(l)
            );
            return lines.slice(0, 15).join('\n');
        });
        if (verdict) console.log(`Findings:\n${verdict}`);
        else console.log('No explicit verdict text found — check screenshot');
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

await browser.close();
console.log('\n=== ALL TESTS COMPLETE ===');
