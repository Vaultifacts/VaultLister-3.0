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
    const browser = await chromium.launch({ headless: true, slowMo: 0 });
    const result = { name, pass: false, warning: null, error: null };

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
        await browser.close();
    }

    return result;
}

async function main() {
    const arg = process.argv[2]?.toLowerCase();
    const targets = arg
        ? (PLATFORMS[arg] ? { [arg]: PLATFORMS[arg] } : null)
        : PLATFORMS;

    if (!targets) {
        console.error(`${RED}Unknown platform: "${arg}". Valid: ${Object.keys(PLATFORMS).join(', ')}${RESET}`);
        process.exit(1);
    }

    const names = Object.keys(targets);
    console.log(`\n${BOLD}${CYAN}VaultLister — Automation Smoke Test${RESET}`);
    console.log(`${CYAN}Platforms: ${names.join(', ')}${RESET}`);
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

    const passed  = results.filter(r => r.pass).length;
    const warned  = results.filter(r => r.warning).length;
    const failed  = results.filter(r => r.error).length;
    const total   = results.length;

    console.log(`\n${BOLD}Results: ${GREEN}${passed} passed${RESET}  ${YELLOW}${warned} warned${RESET}  ${RED}${failed} failed${RESET}  / ${total} total${RESET}\n`);

    if (warned > 0) {
        console.log(`${YELLOW}Warnings indicate bot detection triggered before the login form loaded.`);
        console.log(`This is usually a transient rate-limit — retry in a few minutes.${RESET}\n`);
    }

    if (failed > 0) {
        console.log(`${RED}Failures indicate the platform's login page HTML has changed.`);
        console.log(`Update the selector in this script to match the new markup.${RESET}\n`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(`${RED}Fatal: ${err.message}${RESET}`);
    process.exit(1);
});
