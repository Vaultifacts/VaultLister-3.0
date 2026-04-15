// Full fingerprint comparison: A) Current stealth, B) Camoufox, C) Hybrid
// Tests against every valuable fingerprint site

import { stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs, stealthContextOptions, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS } from '../worker/bots/stealth.js';
import { Camoufox } from 'camoufox-js';

const SITES = [
    { name: 'sannysoft', url: 'https://bot.sannysoft.com/', wait: 3000 },
    { name: 'creepjs', url: 'https://abrahamjuliot.github.io/creepjs/', wait: 15000 },
    { name: 'pixelscan', url: 'https://pixelscan.net/', wait: 10000 },
    { name: 'browserleaks-canvas', url: 'https://browserleaks.com/canvas', wait: 5000 },
    { name: 'browserleaks-webrtc', url: 'https://browserleaks.com/webrtc', wait: 5000 },
    { name: 'browserleaks-webgl', url: 'https://browserleaks.com/webgl', wait: 5000 },
    { name: 'browserleaks-js', url: 'https://browserleaks.com/javascript', wait: 5000 },
    { name: 'browserleaks-fonts', url: 'https://browserleaks.com/fonts', wait: 5000 },
    { name: 'deviceinfo', url: 'https://www.deviceinfo.me/', wait: 8000 },
    { name: 'amiunique', url: 'https://amiunique.org/fingerprint', wait: 8000 },
    { name: 'coveryourtracks', url: 'https://coveryourtracks.eff.org/results', wait: 8000 },
    { name: 'incolumitas', url: 'https://bot.incolumitas.com/', wait: 10000 },
];

async function extractSannyResults(page) {
    return page.evaluate(() => {
        const rows = document.querySelectorAll('table tr');
        let pass = 0, fail = 0;
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const failed = row.classList.contains('failed') || cells[1]?.classList?.contains('failed');
                if (failed) fail++; else pass++;
            }
        });
        return { pass, fail };
    });
}

async function extractVerdict(page, siteName) {
    return page.evaluate((name) => {
        const body = document.body?.innerText || '';
        const patterns = {
            'creepjs': /headless|trust|bot|human|score|grade/i,
            'pixelscan': /bot|human|detect|score|status|consistent|mismatch/i,
            'incolumitas': /bot|human|score|detection|result|passed|failed/i,
            'coveryourtracks': /unique|fingerprint|tracking|protected|browser/i,
            'amiunique': /unique|fingerprint|similar|browser/i,
            'deviceinfo': /bot|automation|headless|webdriver/i,
            'default': /bot|human|detect|headless|automation|score|status|passed|failed|leak/i,
        };
        const pattern = patterns[name] || patterns['default'];
        const lines = body.split('\n').filter(l => pattern.test(l));
        return lines.slice(0, 8).join(' | ');
    }, siteName);
}

async function runTests(label, launchFn) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ${label}`);
    console.log(`${'='.repeat(70)}`);

    const { browser, page } = await launchFn();
    const results = {};

    for (const site of SITES) {
        process.stdout.write(`  ${site.name.padEnd(25)}`);
        try {
            await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(site.wait);

            const prefix = label.charAt(0).toLowerCase();
            await page.screenshot({ path: `data/full-${prefix}-${site.name}.png`, fullPage: true });

            if (site.name === 'sannysoft') {
                const r = await extractSannyResults(page);
                results[site.name] = `${r.pass}/${r.pass + r.fail} PASS`;
                console.log(`${r.pass}/${r.pass + r.fail} PASS`);
            } else {
                const v = await extractVerdict(page, site.name);
                const short = v ? v.substring(0, 120) : '(check screenshot)';
                results[site.name] = short;
                console.log(short);
            }
        } catch (e) {
            results[site.name] = `ERROR: ${e.message.substring(0, 80)}`;
            console.log(`ERROR: ${e.message.substring(0, 80)}`);
        }
    }

    await browser.close();
    return results;
}

// ── Launch functions ──

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

// ── Run all ──

console.log('Full Fingerprint Comparison — 12 sites x 3 approaches');
console.log('This will take several minutes...\n');

const resultsA = await runTests('A) Current Stealth (playwright-extra + StealthPlugin)', launchA);
const resultsB = await runTests('B) Camoufox (standalone)', launchB);
const resultsC = await runTests('C) Hybrid (Camoufox + our stubs)', launchC);

// ── Summary table ──
console.log(`\n${'='.repeat(70)}`);
console.log('  SUMMARY');
console.log(`${'='.repeat(70)}`);
console.log(`${'Site'.padEnd(25)} ${'A) Stealth'.padEnd(30)} ${'B) Camoufox'.padEnd(30)} ${'C) Hybrid'.padEnd(30)}`);
console.log('-'.repeat(115));
for (const site of SITES) {
    const a = (resultsA[site.name] || 'N/A').substring(0, 28);
    const b = (resultsB[site.name] || 'N/A').substring(0, 28);
    const c = (resultsC[site.name] || 'N/A').substring(0, 28);
    console.log(`${site.name.padEnd(25)} ${a.padEnd(30)} ${b.padEnd(30)} ${c.padEnd(30)}`);
}
console.log(`\nScreenshots: data/full-{a,b,c}-{sitename}.png`);
