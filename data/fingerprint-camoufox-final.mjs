// Final verification: Camoufox standalone (from launchCamoufox + profile) against ALL test sites
// This is the PRODUCTION configuration — exactly how facebook-bot.js will launch

import { launchCamoufox } from '../worker/bots/stealth.js';
import { initProfiles, getNextProfile, getProfileDir } from '../worker/bots/browser-profiles.js';

initProfiles();
const profile = getNextProfile();
console.log(`Using profile: ${profile.id}`);

const browser = await launchCamoufox({ profileDir: getProfileDir(profile.id), headless: true });
const page = await browser.newPage();

const SITES = [
    // Round 1 — core tests
    { name: 'sannysoft', url: 'https://bot.sannysoft.com/', wait: 3000 },
    { name: 'creepjs', url: 'https://abrahamjuliot.github.io/creepjs/', wait: 15000 },
    // Round 2 — bot detection
    { name: 'browserscan-bot', url: 'https://www.browserscan.net/bot-detection', wait: 8000 },
    { name: 'rebrowser-detector', url: 'https://bot-detector.rebrowser.net/', wait: 10000 },
    { name: 'devicebrowserinfo', url: 'https://deviceandbrowserinfo.com/are_you_a_bot', wait: 8000 },
    // Round 3 — leak tests
    { name: 'browserleaks-js', url: 'https://browserleaks.com/javascript', wait: 5000 },
    { name: 'browserleaks-webrtc', url: 'https://browserleaks.com/webrtc', wait: 5000 },
    { name: 'browserleaks-webgl', url: 'https://browserleaks.com/webgl', wait: 5000 },
    { name: 'browserleaks-canvas', url: 'https://browserleaks.com/canvas', wait: 5000 },
    { name: 'browserleaks-fonts', url: 'https://browserleaks.com/fonts', wait: 5000 },
    // Round 4 — transport layer
    { name: 'browserscan-tls', url: 'https://www.browserscan.net/tls', wait: 8000 },
    { name: 'http2-fingerprint', url: 'https://scrapfly.io/web-scraping-tools/http2-fingerprint', wait: 8000 },
    { name: 'browserscan-dns', url: 'https://www.browserscan.net/dns-leak', wait: 10000 },
    // Round 5 — additional
    { name: 'browserleaks-webgpu', url: 'https://browserleaks.com/webgpu', wait: 5000 },
    { name: 'browserleaks-client-hints', url: 'https://browserleaks.com/client-hints', wait: 5000 },
    { name: 'browserleaks-features', url: 'https://browserleaks.com/features', wait: 5000 },
    { name: 'browserscan-screen', url: 'https://www.browserscan.net/screen', wait: 5000 },
    { name: 'audiocontext-wbt', url: 'https://webbrowsertools.com/audiocontext-fingerprint/', wait: 8000 },
    { name: 'fingerprintjs-demo', url: 'https://fingerprint.com/demo/', wait: 8000 },
    { name: 'incolumitas', url: 'https://bot.incolumitas.com/', wait: 10000 },
];

async function extractSannyResults(pg) {
    return pg.evaluate(() => {
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

async function extractVerdict(pg) {
    return pg.evaluate(() => {
        const body = document.body?.innerText || '';
        const lines = body.split('\n').filter(l =>
            /bot|human|detect|headless|automation|score|result|passed|failed|status|leak|risk|normal|robot|fingerprint/i.test(l)
        );
        return lines.slice(0, 8).join(' | ');
    });
}

console.log(`\nTesting ${SITES.length} sites with production Camoufox config...\n`);
console.log(`${'Site'.padEnd(30)} Result`);
console.log('-'.repeat(90));

for (const site of SITES) {
    process.stdout.write(`${site.name.padEnd(30)}`);
    try {
        await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(site.wait);
        await page.screenshot({ path: `data/prod-${site.name}.png`, fullPage: true });

        if (site.name === 'sannysoft') {
            const r = await extractSannyResults(page);
            console.log(`${r.pass}/${r.pass + r.fail} PASS`);
        } else {
            const v = await extractVerdict(page);
            console.log(v ? v.substring(0, 120) : '(check screenshot)');
        }
    } catch (e) {
        console.log(`ERROR: ${e.message.substring(0, 80)}`);
    }
}

// JS signal checks
console.log('\n--- JS Signal Checks ---');
await page.goto('about:blank').catch(() => {});

const checks = [
    ['UA', `navigator.userAgent`],
    ['webdriver', `navigator.webdriver`],
    ['plugins', `navigator.plugins.length`],
    ['voices', `speechSynthesis.getVoices().length`],
    ['maxTouchPoints', `navigator.maxTouchPoints`],
    ['hardwareConcurrency', `navigator.hardwareConcurrency`],
    ['deviceMemory', `navigator.deviceMemory || 'undefined'`],
    ['HeadlessChrome', `navigator.userAgent.includes('HeadlessChrome')`],
];

for (const [name, expr] of checks) {
    try {
        const val = await page.evaluate(expr);
        const str = typeof val === 'string' ? val.substring(0, 80) : String(val);
        console.log(`  ${name.padEnd(25)} ${str}`);
    } catch (e) {
        console.log(`  ${name.padEnd(25)} ERROR: ${e.message.substring(0, 50)}`);
    }
}

await browser.close();
console.log('\n=== PRODUCTION CONFIG TEST COMPLETE ===');
