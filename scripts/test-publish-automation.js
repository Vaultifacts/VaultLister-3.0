#!/usr/bin/env bun
// Dry-run smoke test for all Playwright-based publish automations.
// Navigates to each platform's login page and verifies the login form exists.
// Does NOT fill in any credentials or submit — safe to run anytime.
//
// Usage: bun run test:automation
//   or:  bun scripts/test-publish-automation.js [platform]
//
// Examples:
//   bun scripts/test-publish-automation.js         → all platforms
//   bun scripts/test-publish-automation.js poshmark → one platform only

import { chromium } from 'playwright';

const PLATFORMS = {
    poshmark: {
        loginUrl: 'https://poshmark.com/login',
        emailSelector: 'input[id="login_form_username_email"], input[name="username"], input[type="email"]',
        passSelector:  'input[id="login_form_password"], input[name="password"], input[type="password"]',
        checkBotBlock: (url) => url.includes('/captcha') || url.includes('/challenge'),
    },
    mercari: {
        loginUrl: 'https://www.mercari.com/login/',
        emailSelector: 'input[name="email"], input[type="email"], input[placeholder*="email" i]',
        passSelector:  'input[name="password"], input[type="password"]',
        checkBotBlock: (url) => url.includes('/captcha') || url.includes('/challenge'),
    },
    depop: {
        loginUrl: 'https://www.depop.com/login/',
        emailSelector: 'input[name="username"], input[type="email"], input[placeholder*="email" i], input[placeholder*="username" i]',
        passSelector:  'input[name="password"], input[type="password"]',
        checkBotBlock: (url) => url.includes('/captcha') || url.includes('/security'),
    },
    grailed: {
        loginUrl: 'https://www.grailed.com/users/sign_in',
        emailSelector: 'input[name="user[email]"], input[type="email"], input[placeholder*="email" i]',
        passSelector:  'input[name="user[password]"], input[type="password"]',
        checkBotBlock: (url) => url.includes('/captcha'),
    },
    facebook: {
        loginUrl: 'https://www.facebook.com/login',
        emailSelector: 'input[id="email"], input[name="email"]',
        passSelector:  'input[id="pass"], input[name="pass"]',
        checkBotBlock: (url) => url.includes('/checkpoint') || url.includes('/captcha'),
    },
    whatnot: {
        loginUrl: 'https://www.whatnot.com/login',
        emailSelector: 'input[type="email"], input[name="email"], input[placeholder*="email" i]',
        passSelector:  'input[type="password"], input[name="password"]',
        checkBotBlock: (url) => url.includes('/captcha') || url.includes('/challenge'),
    },
};

const TIMEOUT_MS = 20000;
const VIEWPORT = { width: 1280, height: 900 };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const RED   = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN  = '\x1b[36m';
const BOLD  = '\x1b[1m';
const RESET = '\x1b[0m';

async function testPlatform(name, config) {
    const result = { name, pass: false, warning: null, error: null };
    let browser;
    try {
        // Use system Chrome — avoids chrome-headless-shell issues on Windows
        browser = await chromium.launch({ channel: 'chrome', headless: true, slowMo: 0, timeout: 30000 });
    } catch (launchErr) {
        result.error = `Browser launch failed: ${launchErr.message.split('\n')[0]}`;
        return result;
    }

    try {
        const context = await browser.newContext({ userAgent: UA, viewport: VIEWPORT });
        const page = await context.newPage();

        await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });

        const currentUrl = page.url();
        if (config.checkBotBlock(currentUrl)) {
            result.warning = `Bot detection page on load — URL: ${currentUrl}`;
            return result;
        }

        // Check email field
        const emailEl = await page.$(config.emailSelector).catch(() => null);
        if (!emailEl) {
            result.error = `Email/username field not found (selector: ${config.emailSelector.split(',')[0].trim()}...)`;
            return result;
        }

        // Check password field
        const passEl = await page.$(config.passSelector).catch(() => null);
        if (!passEl) {
            result.error = `Password field not found (selector: ${config.passSelector.split(',')[0].trim()}...)`;
            return result;
        }

        result.pass = true;
    } catch (err) {
        result.error = err.message.split('\n')[0];
    } finally {
        await browser.close().catch(() => {});
    }

    return result;
}

async function testShopify() {
    const storeUrl    = (process.env.SHOPIFY_STORE_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!storeUrl || !accessToken) {
        return { name: 'shopify', pass: false, warning: 'SHOPIFY_STORE_URL / SHOPIFY_ACCESS_TOKEN not set — skip', error: null };
    }

    try {
        const res = await fetch(`https://${storeUrl}/admin/api/2024-01/shop.json`, {
            headers: { 'X-Shopify-Access-Token': accessToken },
            signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
            return { name: 'shopify', pass: true, warning: null, error: null };
        }
        return { name: 'shopify', pass: false, warning: null, error: `API ping failed — HTTP ${res.status} (check token write_products scope)` };
    } catch (err) {
        return { name: 'shopify', pass: false, warning: null, error: `API ping error: ${err.message.split('\n')[0]}` };
    }
}

async function main() {
    const arg = process.argv[2]?.toLowerCase();
    if (arg === 'shopify') {
        console.log(`\n${BOLD}${CYAN}VaultLister — Automation Smoke Test (Shopify only)${RESET}\n`);
        process.stdout.write(`  Testing shopify       ... `);
        const r = await testShopify();
        if (r.pass)         console.log(`${GREEN}PASS${RESET} — API ping OK`);
        else if (r.warning) console.log(`${YELLOW}SKIP${RESET} — ${r.warning}`);
        else                console.log(`${RED}FAIL${RESET} — ${r.error}`);
        console.log('');
        process.exit(r.pass ? 0 : 1);
    }

    const targets = arg
        ? (PLATFORMS[arg] ? { [arg]: PLATFORMS[arg] } : null)
        : PLATFORMS;

    if (!targets) {
        console.error(`${RED}Unknown platform: "${arg}". Valid: ${Object.keys(PLATFORMS).join(', ')}, shopify${RESET}`);
        process.exit(1);
    }

    const names = Object.keys(targets);
    console.log(`\n${BOLD}${CYAN}VaultLister — Automation Smoke Test${RESET}`);
    console.log(`${CYAN}Platforms: ${names.join(', ')}${arg ? '' : ', shopify (API ping)'}${RESET}`);
    console.log(`${CYAN}Mode: dry-run (no credentials submitted)\n${RESET}`);

    const results = [];
    for (const [name, config] of Object.entries(targets)) {
        process.stdout.write(`  Testing ${name.padEnd(12, ' ')} ... `);
        const r = await testPlatform(name, config);
        results.push(r);

        if (r.pass) {
            console.log(`${GREEN}PASS${RESET} — login form found`);
        } else if (r.warning) {
            console.log(`${YELLOW}WARN${RESET} — ${r.warning}`);
        } else {
            console.log(`${RED}FAIL${RESET} — ${r.error}`);
        }
    }

    // Shopify REST API credential ping (always runs when testing all platforms)
    if (!arg) {
        process.stdout.write(`  Testing shopify       ... `);
        const shopResult = await testShopify();
        results.push(shopResult);
        if (shopResult.pass)         console.log(`${GREEN}PASS${RESET} — API ping OK`);
        else if (shopResult.warning) console.log(`${YELLOW}SKIP${RESET} — ${shopResult.warning}`);
        else                         console.log(`${RED}FAIL${RESET} — ${shopResult.error}`);
    }

    const passed  = results.filter(r => r.pass).length;
    const warned  = results.filter(r => r.warning).length;
    const failed  = results.filter(r => r.error).length;
    const total   = results.length;

    console.log(`\n${BOLD}Results: ${GREEN}${passed} passed${RESET}  ${YELLOW}${warned} warned${RESET}  ${RED}${failed} failed${RESET}  / ${total} total${RESET}\n`);

    const shopifySkips  = results.filter(r => r.name === 'shopify' && r.warning).length;
    const botWarnings   = warned - shopifySkips;
    const launchFails   = results.filter(r => r.error?.startsWith('Browser launch failed')).length;
    const selectorFails = failed - launchFails;

    if (shopifySkips > 0) {
        console.log(`${YELLOW}Shopify skipped — add SHOPIFY_STORE_URL + SHOPIFY_ACCESS_TOKEN to .env to run the API ping.${RESET}`);
    }
    if (botWarnings > 0) {
        console.log(`${YELLOW}Bot-detection warnings: usually a transient rate-limit — retry in a few minutes.${RESET}`);
    }
    if (botWarnings > 0 || shopifySkips > 0) console.log('');

    if (launchFails > 0 && selectorFails === 0) {
        console.log(`${YELLOW}All browser failures: Playwright CDP pipe timed out (Windows security restriction).`);
        console.log(`Run from a regular terminal to verify selectors — not from Claude Code's shell.${RESET}\n`);
        process.exit(1);
    }

    if (selectorFails > 0) {
        console.log(`${RED}Selector failures: platform login page HTML may have changed.`);
        console.log(`Update the selector in PLATFORMS config to match the new markup.${RESET}\n`);
        process.exit(1);
    }

    if (failed > 0) process.exit(1);
}

main().catch(err => {
    console.error(`${RED}Fatal: ${err.message}${RESET}`);
    process.exit(1);
});
