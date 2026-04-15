import { launchCamoufox } from '../worker/bots/stealth.js';
import { initProfiles, getNextProfile, getProfileDir } from '../worker/bots/browser-profiles.js';

initProfiles();
const profile = getNextProfile();
const browser = await launchCamoufox({ profileDir: getProfileDir(profile.id), headless: true });
const page = await browser.newPage();

const SITES = [
    { name: 'scrapfly-automation', url: 'https://scrapfly.io/web-scraping-tools/automation-detector', wait: 10000 },
    { name: 'ipqs-bot', url: 'https://www.ipqualityscore.com/bot-management/bot-detection-check', wait: 8000 },
];

for (const site of SITES) {
    process.stdout.write(`${site.name.padEnd(25)}`);
    try {
        await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(site.wait);
        await page.screenshot({ path: `data/prod-${site.name}.png`, fullPage: true });
        const v = await page.evaluate(() => {
            const body = document.body?.innerText || '';
            return body.split('\n').filter(l => /bot|human|detect|automat|score|result|passed|failed|status/i.test(l)).slice(0, 8).join(' | ');
        });
        console.log(v ? v.substring(0, 120) : '(check screenshot)');
    } catch (e) {
        console.log(`ERROR: ${e.message.substring(0, 80)}`);
    }
}
await browser.close();
console.log('DONE');
