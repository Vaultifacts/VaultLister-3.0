#!/usr/bin/env node
// Poshmark Manual Login Helper
// Opens a headed Chromium browser using the persistent profile so you can log in
// manually (including SMS 2FA). The session is saved automatically for future bot runs.
//
// Usage: node scripts/poshmark-login.js
// After running, log in to Poshmark in the browser window that opens, then close the window.

import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const PROFILE_DIR = join(ROOT_DIR, 'data', 'poshmark-profile');
const BASE_URL = process.env.POSHMARK_COUNTRY === 'ca' ? 'https://poshmark.ca' : 'https://poshmark.com';

console.log('[poshmark-login] Opening headed browser with persistent profile...');
console.log('[poshmark-login] Profile dir:', PROFILE_DIR);
console.log('[poshmark-login] Log in to Poshmark in the browser window, then close it.');
console.log('[poshmark-login] SMS 2FA will work normally — complete it in the browser.\n');

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    slowMo: 0,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: { width: 1280, height: 900 }
});

const page = await context.newPage();
await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });

console.log('[poshmark-login] Waiting for you to log in... (close the browser window when done)');

// Wait until navigated away from /login (successful login) or browser closes
try {
    await page.waitForFunction(
        () => !window.location.pathname.startsWith('/login'),
        { timeout: 300_000 }  // 5 min timeout
    );
    console.log('[poshmark-login] ✅ Login detected! Session saved to:', PROFILE_DIR);
    console.log('[poshmark-login] Closing in 3 seconds...');
    await page.waitForTimeout(3000);
} catch {
    console.log('[poshmark-login] Timed out or browser closed manually.');
}

await context.close();
console.log('[poshmark-login] Done. You can now run the Poshmark publish bot.');
