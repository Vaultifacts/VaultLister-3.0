// Playwright Configuration for VaultLister E2E Tests
import { defineConfig, devices } from '@playwright/test';

// Ensure virtual display is set for headless browser rendering in VM
process.env.DISPLAY = process.env.DISPLAY || ':99';

// Read PORT from .env if not already set in environment
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.PORT) {
    try {
        const env = readFileSync(join(__dirname, '.env'), 'utf8');
        const match = env.match(/^PORT=(\d+)/m);
        if (match) process.env.PORT = match[1];
    } catch {}
}
const APP_PORT = parseInt(process.env.TEST_PORT || process.env.PORT || '3001');
// Sync PORT so test files (auth.js, api-helpers.js, wait-utils.js) resolve to the same port
process.env.PORT = String(APP_PORT);

export default defineConfig({
    testDir: './e2e/tests',
    testMatch: '*.spec.js',
    globalSetup: './e2e/global-setup.js',
    globalTeardown: './e2e/global-teardown.js',
    fullyParallel: true,
    updateSnapshots: 'missing',
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: process.env.PW_WORKERS ? parseInt(process.env.PW_WORKERS) : (process.env.CI ? 2 : 4),
    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['json', { outputFile: 'playwright-report/results.json' }],
        ['list']
    ],
    use: {
        baseURL: `http://localhost:${APP_PORT}`,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        serviceWorkers: 'block',
        launchOptions: {
            env: {
                DISPLAY: process.env.DISPLAY || ':99'
            }
        }
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] }
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] }
        }
    ],
    webServer: {
        command: `bun src/backend/server.js`,
        url: `http://localhost:${APP_PORT}/api/health`,
        reuseExistingServer: true,
        timeout: 60000,
        env: {
            NODE_ENV: 'test',
            PORT: String(APP_PORT),
            DISABLE_RATE_LIMIT: 'true',
            DISABLE_CSRF: 'true',
            DISPLAY: process.env.DISPLAY || ':99'
        }
    }
});
