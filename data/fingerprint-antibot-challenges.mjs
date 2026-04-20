// Test Camoufox against real anti-bot challenge systems
// These simulate what Facebook and other major platforms use

import { launchCamoufox } from '../worker/bots/stealth.js';
import { initProfiles, getNextProfile, getProfileDir } from '../worker/bots/browser-profiles.js';

initProfiles();
const profile = getNextProfile();
const browser = await launchCamoufox({ profileDir: getProfileDir(profile.id), headless: true });
const page = await browser.newPage();

const SITES = [
    // Cloudflare Turnstile — most common anti-bot on the web
    { name: 'cloudflare-turnstile', url: 'https://seleniumbase.io/apps/turnstile', wait: 10000 },
    { name: 'turnstile-2captcha', url: 'https://2captcha.com/demo/cloudflare-turnstile', wait: 10000 },

    // Cloudflare challenge pages
    { name: 'cloudflare-challenge', url: 'https://nowsecure.nl/', wait: 10000 },

    // DataDome protected site
    { name: 'datadome-test', url: 'https://www.hermes.com/', wait: 10000 },

    // PerimeterX / HUMAN protected site
    { name: 'perimeterx-test', url: 'https://www.zillow.com/', wait: 10000 },

    // Akamai Bot Manager protected site
    { name: 'akamai-test', url: 'https://www.nike.com/', wait: 10000 },

    // hCaptcha challenge
    { name: 'hcaptcha-test', url: 'https://accounts.hcaptcha.com/demo', wait: 10000 },

    // reCAPTCHA test
    { name: 'recaptcha-test', url: 'https://www.google.com/recaptcha/api2/demo', wait: 8000 },

    // Practice login form with anti-bot
    { name: 'practice-login', url: 'https://practice.expandtesting.com/login', wait: 5000 },

    // Form fill behavioral test
    { name: 'httpbin-post', url: 'https://httpbin.org/forms/post', wait: 3000 },
];

console.log(`Testing ${SITES.length} anti-bot challenge sites...\n`);
console.log(`${'Site'.padEnd(25)} Result`);
console.log('-'.repeat(100));

for (const site of SITES) {
    process.stdout.write(`${site.name.padEnd(25)}`);
    try {
        const response = await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(site.wait);

        const status = response?.status() || 'unknown';
        const url = page.url();
        const blocked = url.includes('/blocked') || url.includes('/captcha') || url.includes('/challenge');
        const hasCaptcha = await page.$('iframe[src*="captcha"], iframe[src*="hcaptcha"], iframe[src*="recaptcha"], [class*="captcha" i], [id*="challenge"]') !== null;
        const hasTurnstile = await page.$('iframe[src*="turnstile"], [class*="turnstile"], cf-turnstile') !== null;
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || '');
        const isBlocked = bodyText.includes('Access denied') || bodyText.includes('blocked') || bodyText.includes('Pardon our interruption') || bodyText.includes('Just a moment');

        await page.screenshot({ path: `data/antibot-${site.name}.png`, fullPage: true });

        let verdict = `HTTP ${status}`;
        if (isBlocked) verdict += ' | BLOCKED';
        else if (hasCaptcha) verdict += ' | CAPTCHA present';
        else if (hasTurnstile) verdict += ' | Turnstile present';
        else if (blocked) verdict += ' | Redirected to challenge';
        else verdict += ' | PASSED';

        console.log(verdict);
    } catch (e) {
        console.log(`ERROR: ${e.message.substring(0, 80)}`);
    }
}

await browser.close();
console.log('\n=== ANTI-BOT CHALLENGE TESTS COMPLETE ===');
