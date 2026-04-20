// Sites from earlier rounds NOT included in the final production test

import { launchCamoufox } from '../worker/bots/stealth.js';
import { initProfiles, getNextProfile, getProfileDir } from '../worker/bots/browser-profiles.js';

initProfiles();
const profile = getNextProfile();
console.log(`Using profile: ${profile.id}`);

const browser = await launchCamoufox({ profileDir: getProfileDir(profile.id), headless: true });
const page = await browser.newPage();

const SITES = [
    // From earlier rounds — not in final production test
    { name: 'browserscan-webrtc', url: 'https://www.browserscan.net/webrtc', wait: 5000 },
    { name: 'browserscan-fingerprint', url: 'https://www.browserscan.net/fingerprint', wait: 8000 },
    { name: 'browserleaks-quic', url: 'https://browserleaks.com/quic', wait: 5000 },
    { name: 'browserleaks-clientrects', url: 'https://browserleaks.com/rects', wait: 5000 },
    { name: 'browserleaks-geo', url: 'https://browserleaks.com/geo', wait: 5000 },
    { name: 'browserleaks-tcp', url: 'https://browserleaks.com/tcp', wait: 5000 },
    { name: 'browserleaks-css', url: 'https://browserleaks.com/css', wait: 5000 },
    { name: 'browserleaks-ip', url: 'https://browserleaks.com/ip', wait: 5000 },
    { name: 'webgpu-wbt', url: 'https://webbrowsertools.com/webgpu-fingerprint/', wait: 5000 },
    { name: 'amiunique', url: 'https://amiunique.org/fingerprint', wait: 8000 },
    // Interactive — try clicking
    { name: 'pixelscan-botcheck', url: 'https://pixelscan.net/bot-check', wait: 12000 },
    { name: 'coveryourtracks', url: 'https://coveryourtracks.eff.org/', wait: 3000, interact: true },
];

async function extractVerdict(pg) {
    return pg.evaluate(() => {
        const body = document.body?.innerText || '';
        const lines = body.split('\n').filter(l =>
            /bot|human|detect|headless|automation|score|result|passed|failed|status|leak|risk|normal|robot|fingerprint|unique|tracking|protected/i.test(l)
        );
        return lines.slice(0, 8).join(' | ');
    });
}

console.log(`\nTesting ${SITES.length} remaining sites...\n`);
console.log(`${'Site'.padEnd(30)} Result`);
console.log('-'.repeat(90));

for (const site of SITES) {
    process.stdout.write(`${site.name.padEnd(30)}`);
    try {
        await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(site.wait);

        if (site.interact) {
            // Try to click test button for CoverYourTracks
            const testBtn = await page.$('a.btn-primary, a[href*="kcarter"], button:has-text("Test"), a:has-text("TEST YOUR BROWSER")');
            if (testBtn) {
                await testBtn.click();
                await page.waitForTimeout(15000);
            }
        }

        await page.screenshot({ path: `data/prod-remaining-${site.name}.png`, fullPage: true });

        const v = await extractVerdict(page);
        console.log(v ? v.substring(0, 120) : '(check screenshot)');
    } catch (e) {
        console.log(`ERROR: ${e.message.substring(0, 80)}`);
    }
}

// JS checks not in previous run
console.log('\n--- Additional JS Checks ---');
await page.goto('about:blank').catch(() => {});

const checks = [
    ['speechSynthesis voices', `speechSynthesis.getVoices().map(v => v.name).slice(0,5).join(', ')`],
    ['gamepad slots', `navigator.getGamepads ? navigator.getGamepads().length : 'N/A'`],
    ['Intl timezone', `Intl.DateTimeFormat().resolvedOptions().timeZone`],
    ['Math.tan(-1e300)', `Math.tan(-1e300)`],
    ['performance.now precision', `(() => { const t = []; for(let i=0;i<10;i++) t.push(performance.now()); return t.slice(0,5).map(v=>v.toFixed(4)).join(', '); })()`],
    ['CSS @supports grid', `CSS.supports('display','grid')`],
    ['isSecureContext', `window.isSecureContext`],
    ['emoji rect width', `(() => { const s=document.createElement('span'); s.textContent='😀'; s.style.fontSize='16px'; s.style.position='absolute'; document.body.appendChild(s); const w=s.getBoundingClientRect().width; s.remove(); return w; })()`],
    ['canvas text width', `(() => { const c=document.createElement('canvas').getContext('2d'); c.font='16px Arial'; return c.measureText('test').width; })()`],
];

for (const [name, expr] of checks) {
    try {
        const val = await page.evaluate(expr);
        console.log(`  ${name.padEnd(28)} ${String(val).substring(0, 80)}`);
    } catch (e) {
        console.log(`  ${name.padEnd(28)} ERROR: ${e.message.substring(0, 50)}`);
    }
}

await browser.close();
console.log('\n=== ALL REMAINING TESTS COMPLETE ===');
