#!/usr/bin/env node
// Poshmark Manual Login Helper
// Opens a headed Chromium browser, pre-fills your credentials from .env,
// then waits for you to enter the SMS code. Session saves automatically.
//
// Usage: node scripts/poshmark-login.js
// Step 1: A browser window opens — your email is already typed.
// Step 2: Type your password and click Login.
// Step 3: Enter the SMS code Poshmark texts you.
// Step 4: Close the window once you see your feed/closet.

import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const PROFILE_DIR = join(ROOT_DIR, 'data', 'poshmark-profile');

function readEnvVar(name) {
    try {
        const env = readFileSync(join(ROOT_DIR, '.env'), 'utf8');
        const match = env.match(new RegExp(`^${name}=(.+)$`, 'm'));
        return match ? match[1].trim() : '';
    } catch { return ''; }
}

const COUNTRY = (process.env.POSHMARK_COUNTRY || readEnvVar('POSHMARK_COUNTRY') || 'us').toLowerCase();
const DOMAIN_MAP = { us: 'https://poshmark.com', ca: 'https://poshmark.ca', au: 'https://poshmark.com.au' };
const BASE_URL = DOMAIN_MAP[COUNTRY] || DOMAIN_MAP.us;
const USERNAME = process.env.POSHMARK_USERNAME || readEnvVar('POSHMARK_USERNAME');

console.log('');
console.log('=== Poshmark Login Helper ===');
console.log('A browser window is opening. Steps:');
console.log('  1. Your email/username is pre-filled');
console.log('  2. Type your password and click Login');
console.log('  3. Enter the SMS verification code Poshmark texts you');
console.log('  4. Once you see your feed, close the browser window');
console.log('  Session will be saved for future bot runs.');
console.log('');

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    slowMo: 0,
    args: ['--no-sandbox', '--start-maximized'],
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: null   // use full window size
});

const page = await context.newPage();
await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Pre-fill email/username if credentials are set in .env
if (USERNAME) {
    const usernameSel = 'input[name="login_form[username_email]"], input[placeholder*="Username or Email" i], input[placeholder*="username" i]:not([type="hidden"])';
    const inputEl = await page.$(usernameSel).catch(() => null);
    if (inputEl) {
        await inputEl.fill(USERNAME);
        console.log('[poshmark-login] Pre-filled username:', USERNAME);
        // Move focus to password field
        const pwdEl = await page.$('input[type="password"]').catch(() => null);
        if (pwdEl) await pwdEl.click();
    }
}

console.log('[poshmark-login] Waiting for you to complete login (5 min timeout)...');

// Wait until navigated away from /login (login complete)
const success = await page.waitForFunction(
    () => !window.location.pathname.startsWith('/login'),
    { timeout: 300_000 }
).then(() => true).catch(() => false);

if (success) {
    // Let the session cookies settle
    await page.waitForTimeout(3000);
    console.log('');
    console.log('[poshmark-login] ✅ Login successful! Session saved to:');
    console.log('   ' + PROFILE_DIR);
    console.log('[poshmark-login] Closing browser in 3 seconds...');
    await page.waitForTimeout(3000);
} else {
    console.log('[poshmark-login] Timed out waiting for login. Session may not be saved.');
}

await context.close().catch(() => {});
console.log('[poshmark-login] Done. The Poshmark bot will now use this session.');
