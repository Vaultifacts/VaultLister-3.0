// Playwright Configuration for VaultLister E2E Tests
import { defineConfig, devices } from '@playwright/test';

// Ensure virtual display is set for headless browser rendering in VM
process.env.DISPLAY = process.env.DISPLAY || ':99';

// E2E must use a dedicated test port. Do not inherit the app port from .env.
const RAW_TEST_PORT = process.env.TEST_PORT || '3100';
const APP_PORT = parseInt(RAW_TEST_PORT, 10);
if (!Number.isFinite(APP_PORT) || APP_PORT <= 0) {
    throw new Error(`Invalid TEST_PORT: ${RAW_TEST_PORT}`);
}

process.env.TEST_PORT = String(APP_PORT);
process.env.PORT = String(APP_PORT);
process.env.TEST_BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${APP_PORT}`;

export default defineConfig({
    testDir: './e2e/tests',
    testMatch: ['*.spec.js', '*.e2e.js'],
    globalSetup: './e2e/global-setup.js',
    globalTeardown: './e2e/global-teardown.js',
    fullyParallel: true,
    timeout: 30000,
    navigationTimeout: 15000,
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
        // Functional tests — CSRF and rate limiting disabled for speed
        {
            name: 'chromium',
            testIgnore: ['**/security-integration*'],
            use: { ...devices['Desktop Chrome'] }
        },
        {
            name: 'firefox',
            testIgnore: ['**/security-integration*'],
            use: { ...devices['Desktop Firefox'] }
        },
        {
            name: 'webkit',
            testIgnore: ['**/security-integration*'],
            use: { ...devices['Desktop Safari'] }
        },
        // Security project — real CSRF + rate limiting, Chromium only
        {
            name: 'security',
            testMatch: ['**/security-integration*'],
            use: {
                ...devices['Desktop Chrome'],
                serviceWorkers: 'allow'
            }
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
            DISPLAY: process.env.DISPLAY || ':99',
            DATABASE_URL: process.env.DATABASE_URL || 'postgresql://vaultlister:localdev@localhost:5432/vaultlister_dev',
            JWT_SECRET: process.env.JWT_SECRET || 'ci-test-secret-do-not-use-in-production'
        }
    }
});
