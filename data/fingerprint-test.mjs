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

console.log('Navigating to bot.sannysoft.com...');
await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

await page.screenshot({ path: 'data/fingerprint-test.png', fullPage: true });
console.log('Screenshot saved to data/fingerprint-test.png');

const results = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tr');
    const data = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
            const test = cells[0]?.textContent?.trim();
            const result = cells[1]?.textContent?.trim();
            const passed = !row.classList.contains('failed') && !cells[1]?.classList?.contains('failed');
            data.push({ test, result: result?.substring(0, 80), passed });
        }
    });
    return data;
});

console.log('\n=== FINGERPRINT TEST RESULTS ===');
let passCount = 0, failCount = 0;
results.forEach(r => {
    const icon = r.passed ? 'PASS' : 'FAIL';
    if (r.passed) passCount++; else failCount++;
    console.log(`[${icon}] ${r.test}: ${r.result}`);
});
console.log(`\nTotal: ${passCount} PASS, ${failCount} FAIL`);

await browser.close();
