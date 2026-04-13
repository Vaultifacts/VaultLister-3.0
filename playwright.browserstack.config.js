// Playwright config for BrowserStack mobile audit runs.
// Run with: npx browserstack-node-sdk playwright test --config playwright.browserstack.config.js
// Requires BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY in .env or environment.
// Tests against the live Railway deployment — no local server needed.

import { defineConfig } from '@playwright/test';

const LIVE_URL = process.env.VAULTLISTER_URL || 'https://vaultlister-app-production.up.railway.app';

export default defineConfig({
    testDir: './e2e/tests',
    testMatch: ['mobile-audit.bs.spec.js'],
    fullyParallel: false,
    timeout: 60000,
    retries: 1,
    workers: 1,
    reporter: [
        ['html', { outputFolder: 'playwright-report/browserstack', open: 'never' }],
        ['json', { outputFile: 'playwright-report/browserstack/results.json' }],
        ['list']
    ],
    use: {
        baseURL: LIVE_URL,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        trace: 'on-first-retry',
        screenshot: 'on',
        video: 'retain-on-failure',
    },
    // No webServer block — tests run against the live site
});
