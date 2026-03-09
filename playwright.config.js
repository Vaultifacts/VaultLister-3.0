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
const APP_PORT = parseInt(process.env.PORT || '3001');

export default defineConfig({
    testDir: './e2e/tests',
    testMatch: '*.spec.js',
    globalSetup: './e2e/global-setup.js',
    globalTeardown: './e2e/global-teardown.js',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: process.env.CI ? 1 : 1, // Single worker: Bun server is single-threaded, parallel workers cause OOM
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
        command: 'NODE_ENV=test bun run dev',
        url: `http://localhost:${APP_PORT}/api/health`,
        reuseExistingServer: true, // test:setup always starts the server first
        timeout: 30000,
        env: {
            NODE_ENV: 'test',
            DISPLAY: process.env.DISPLAY || ':99'
        }
    }
});
