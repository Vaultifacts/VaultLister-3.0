// Compare three anti-detection approaches against fingerprint test sites
// A) Current stealth (playwright-extra + StealthPlugin)
// B) Camoufox (custom Firefox build)
// C) Hybrid (Camoufox + our browser API stubs)

import { stealthChromium, injectChromeRuntimeStub, injectBrowserApiStubs, stealthContextOptions, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS } from '../worker/bots/stealth.js';
import { Camoufox } from 'camoufox-js';

const SITES = [
    { name: 'sannysoft', url: 'https://bot.sannysoft.com/', wait: 3000 },
    { name: 'creepjs', url: 'https://abrahamjuliot.github.io/creepjs/', wait: 15000 },
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

async function extractCreepVerdict(page) {
    return page.evaluate(() => {
        const body = document.body?.innerText || '';
        const lines = body.split('\n').filter(l =>
            /headless|trust|bot|human|score|grade/i.test(l)
        );
        return lines.slice(0, 10).join(' | ');
    });
}

// ── Approach A: Current stealth (playwright-extra) ──
async function testCurrentStealth() {
    console.log('\n=== APPROACH A: Current Stealth (playwright-extra + StealthPlugin) ===');
    const browser = await stealthChromium.launch({
        headless: true,
        args: STEALTH_ARGS,
        ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
    });
    const context = await browser.newContext(stealthContextOptions('chrome'));
    const page = await context.newPage();
    await injectChromeRuntimeStub(page);
    await injectBrowserApiStubs(page);

    for (const site of SITES) {
        console.log(`  Testing ${site.name}...`);
        try {
            await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(site.wait);
            await page.screenshot({ path: `data/compare-a-${site.name}.png`, fullPage: true });

            if (site.name === 'sannysoft') {
                const r = await extractSannyResults(page);
                console.log(`  Sannysoft: ${r.pass} PASS, ${r.fail} FAIL`);
            } else {
                const v = await extractCreepVerdict(page);
                console.log(`  CreepJS: ${v || '(check screenshot)'}`);
            }
        } catch (e) { console.log(`  Error: ${e.message}`); }
    }
    await browser.close();
}

// ── Approach B: Camoufox (standalone) ──
async function testCamoufox() {
    console.log('\n=== APPROACH B: Camoufox (custom Firefox build, no extra stubs) ===');
    const browser = await Camoufox({ headless: true, humanize: true, block_webrtc: true });
    const page = await browser.newPage();

    for (const site of SITES) {
        console.log(`  Testing ${site.name}...`);
        try {
            await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(site.wait);
            await page.screenshot({ path: `data/compare-b-${site.name}.png`, fullPage: true });

            if (site.name === 'sannysoft') {
                const r = await extractSannyResults(page);
                console.log(`  Sannysoft: ${r.pass} PASS, ${r.fail} FAIL`);
            } else {
                const v = await extractCreepVerdict(page);
                console.log(`  CreepJS: ${v || '(check screenshot)'}`);
            }
        } catch (e) { console.log(`  Error: ${e.message}`); }
    }
    await browser.close();
}

// ── Approach C: Hybrid (Camoufox + our stubs) ──
async function testHybrid() {
    console.log('\n=== APPROACH C: Hybrid (Camoufox + our browser API stubs) ===');
    const browser = await Camoufox({ headless: true, humanize: true, block_webrtc: true });
    const page = await browser.newPage();
    // Layer our stubs on top of Camoufox
    await injectBrowserApiStubs(page);

    for (const site of SITES) {
        console.log(`  Testing ${site.name}...`);
        try {
            await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(site.wait);
            await page.screenshot({ path: `data/compare-c-${site.name}.png`, fullPage: true });

            if (site.name === 'sannysoft') {
                const r = await extractSannyResults(page);
                console.log(`  Sannysoft: ${r.pass} PASS, ${r.fail} FAIL`);
            } else {
                const v = await extractCreepVerdict(page);
                console.log(`  CreepJS: ${v || '(check screenshot)'}`);
            }
        } catch (e) { console.log(`  Error: ${e.message}`); }
    }
    await browser.close();
}

// ── Run all three ──
console.log('Starting fingerprint comparison test...');
await testCurrentStealth();
await testCamoufox();
await testHybrid();
console.log('\n=== ALL TESTS COMPLETE ===');
console.log('Screenshots saved to data/compare-{a,b,c}-{sannysoft,creepjs}.png');
