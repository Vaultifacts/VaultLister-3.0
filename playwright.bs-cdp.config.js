// Playwright config for BrowserStack via direct CDP endpoint.
// No SDK required — uses Playwright's built-in connectOptions.wsEndpoint.
// Run: node -r dotenv/config node_modules/.bin/playwright test --config playwright.bs-cdp.config.js
// Or: bun run test:mobile-audit

import { defineConfig } from '@playwright/test';
import 'dotenv/config';

const BS_USER = process.env.BROWSERSTACK_USERNAME;
const BS_KEY = process.env.BROWSERSTACK_ACCESS_KEY;
const LIVE_URL = process.env.VAULTLISTER_URL || 'https://vaultlister-app-production.up.railway.app';

if (!BS_USER || !BS_KEY) {
    throw new Error('BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY must be set in .env');
}

function bsEndpoint(caps) {
    return `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify({
        ...caps,
        'browserstack.username': BS_USER,
        'browserstack.accessKey': BS_KEY,
        'browserstack.consoleLogs': 'errors',
        'browserstack.networkLogs': false,
    }))}`;
}

export default defineConfig({
    testDir: './e2e/tests',
    testMatch: ['mobile-audit.bs.spec.js'],
    fullyParallel: false,
    timeout: 120000,
    retries: 1,
    workers: 1,
    reporter: [
        ['html', { outputFolder: 'playwright-report/browserstack', open: 'never' }],
        ['json', { outputFile: 'playwright-report/browserstack/results.json' }],
        ['list'],
    ],
    use: {
        baseURL: LIVE_URL,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        screenshot: 'on',
        // trace disabled — iOS Safari does not support tracingStartChunk via BrowserStack CDP
        video: 'retain-on-failure',
    },
    projects: [
        // Samsung Android Chrome is NOT supported via BrowserStack CDP (Malformed endpoint).
        // CDP endpoint only supports desktop browsers + iOS Safari (playwright-webkit).
        {
            name: 'iPhone 14 Pro — Safari',
            use: {
                connectOptions: {
                    wsEndpoint: bsEndpoint({
                        browser: 'playwright-webkit',
                        os: 'ios',
                        os_version: '16',
                        device: 'iPhone 14 Pro',
                        real_mobile: 'true',
                    }),
                },
            },
        },
    ],
    // No webServer — tests run against live Railway deployment
});
