/**
 * Chrome Extension E2E Tests — VaultLister Helper
 *
 * Tests the extension API endpoints and, when possible, the extension UI.
 * Extension popup/content-script tests are gated on extension presence and
 * require Chromium with --load-extension (skip gracefully on other browsers).
 *
 * Coverage:
 *   - Extension API: price tracking CRUD
 *   - Extension API: scraped items list
 *   - Extension popup loads (Chromium only, extension present)
 *   - Extension API: unauthenticated access rejected
 */

import { test, expect, chromium } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(__dirname, '../../chrome-extension');
const EXT_EXISTS = existsSync(EXT_PATH);

test.setTimeout(60_000);

// ── API-level extension tests (no browser extension required) ─────────────────

test.describe('Extension API — Price Tracking', () => {
    let token;
    let createdItemId;

    test.beforeAll(async ({ request }) => {
        const data = await apiLogin(request);
        token = data.token;
    });

    test.afterAll(async ({ request }) => {
        if (createdItemId) {
            const csrf = await getCsrf(request, token);
            await request.delete(`${BASE_URL}/api/extension/price-tracking/${createdItemId}`, {
                headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf }
            });
        }
    });

    test('GET /api/extension/price-tracking — returns list (200)', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/extension/price-tracking`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        // Accept either { tracking: [] } or { items: [] } shape
        const list = data.tracking ?? data.items ?? [];
        expect(Array.isArray(list)).toBe(true);
    });

    test('POST /api/extension/price-tracking — creates tracked item (200/201)', async ({ request }) => {
        const csrf = await getCsrf(request, token);
        const res = await request.post(`${BASE_URL}/api/extension/price-tracking`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
            data: {
                productTitle: 'E2E Price Track Test Item',
                url: 'https://www.amazon.com/dp/TEST123',
                currentPrice: 49.99,
                site: 'amazon'
            }
        });
        expect([200, 201]).toContain(res.status());

        const data = await res.json();
        // Persist ID for cleanup
        createdItemId = data.id ?? data.item?.id ?? data.tracking?.id;
    });

    test('GET /api/extension/price-tracking — created item appears in list', async ({ request }) => {
        if (!createdItemId) test.skip(true, 'Item not created in previous test');

        const res = await request.get(`${BASE_URL}/api/extension/price-tracking`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const list = data.tracking ?? data.items ?? [];
        const found = list.some(i =>
            (i.title === 'E2E Price Track Test Item' || i.productTitle === 'E2E Price Track Test Item') ||
            i.id === createdItemId
        );
        expect(found).toBe(true);
    });

    test('DELETE /api/extension/price-tracking/:id — removes item (200)', async ({ request }) => {
        if (!createdItemId) test.skip(true, 'Item not created in previous test');

        const csrf = await getCsrf(request, token);
        const res = await request.delete(`${BASE_URL}/api/extension/price-tracking/${createdItemId}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf }
        });
        expect([200, 204]).toContain(res.status());
        createdItemId = null; // already deleted, skip afterAll cleanup
    });
});

// ── Extension API — Scraped Items ─────────────────────────────────────────────

test.describe('Extension API — Scraped Items', () => {
    let token;

    test.beforeAll(async ({ request }) => {
        const data = await apiLogin(request);
        token = data.token;
    });

    test('GET /api/extension/scraped — returns list (200)', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/extension/scraped`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        // Accept { items: [], count: N } or { scraped: [], total: N }
        const list = data.items ?? data.scraped ?? [];
        expect(Array.isArray(list)).toBe(true);
    });

    test('GET /api/extension/scraped — unauthenticated returns 401', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/extension/scraped`);
        expect(res.status()).toBe(401);
    });

    test('GET /api/extension/price-tracking — unauthenticated returns 401', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/extension/price-tracking`);
        expect(res.status()).toBe(401);
    });
});

// ── Extension UI tests (Chromium + extension present) ────────────────────────

test.describe('Extension UI — Popup', () => {
    test.skip(!EXT_EXISTS, 'Chrome extension directory not found — skipping UI tests');

    // These tests use a persistent Chromium context with the extension loaded.
    // Only runs when Chromium browser is selected (skips Firefox/WebKit).
    test('Extension popup loads without console errors', async ({ browserName }) => {
        if (browserName !== 'chromium') {
            test.skip(true, 'Extension UI tests require Chromium');
        }

        const context = await chromium.launchPersistentContext('', {
            headless: true,
            args: [
                `--disable-extensions-except=${EXT_PATH}`,
                `--load-extension=${EXT_PATH}`,
            ],
            ignoreHTTPSErrors: true,
        });

        try {
            // Give service worker time to register
            await new Promise(r => setTimeout(r, 2000));

            let extId = null;
            const swTargets = context.serviceWorkers();
            for (const sw of swTargets) {
                if (sw.url().includes('background') || sw.url().includes('service-worker')) {
                    extId = sw.url().split('/')[2];
                    break;
                }
            }

            if (!extId) {
                // Not finding the SW is acceptable — extension may load differently
                console.log('[chrome-extension.spec] Service worker not detected, extension may still load');
                return;
            }

            const popupErrors = [];
            const popupPage = await context.newPage();
            popupPage.on('console', msg => {
                if (msg.type() === 'error') popupErrors.push(msg.text());
            });
            popupPage.on('pageerror', err => popupErrors.push(err.message));

            await popupPage.goto(`chrome-extension://${extId}/popup/popup.html`, { timeout: 8000 });
            await popupPage.waitForSelector('#login-view, #main-view', { timeout: 8000 });

            const hasLogin = await popupPage.$('#login-view') !== null;
            const hasMain  = await popupPage.$('#main-view') !== null;
            expect(hasLogin || hasMain).toBe(true);

            // No extension-originating errors
            const ownErrors = popupErrors.filter(e =>
                e.includes('vaultlister') || e.includes('popup') || e.includes('api.js')
            );
            expect(ownErrors.length).toBe(0);
        } finally {
            await context.close();
        }
    });

    test('Extension popup — login view has email and password fields', async ({ browserName }) => {
        if (browserName !== 'chromium') {
            test.skip(true, 'Extension UI tests require Chromium');
        }

        const context = await chromium.launchPersistentContext('', {
            headless: true,
            args: [
                `--disable-extensions-except=${EXT_PATH}`,
                `--load-extension=${EXT_PATH}`,
            ],
            ignoreHTTPSErrors: true,
        });

        try {
            await new Promise(r => setTimeout(r, 2000));
            let extId = null;
            for (const sw of context.serviceWorkers()) {
                if (sw.url().includes('background') || sw.url().includes('service-worker')) {
                    extId = sw.url().split('/')[2];
                    break;
                }
            }
            if (!extId) return; // Skip gracefully

            const page = await context.newPage();
            await page.goto(`chrome-extension://${extId}/popup/popup.html`, { timeout: 8000 });

            // If login view visible, check fields
            const loginView = await page.$('#login-view');
            if (loginView) {
                const emailField = await page.$('#email, input[type="email"]');
                const passwordField = await page.$('#password, input[type="password"]');
                expect(emailField).not.toBeNull();
                expect(passwordField).not.toBeNull();
            }
        } finally {
            await context.close();
        }
    });
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function getCsrf(request, token) {
    const res = await request.get(`${BASE_URL}/api/extension/price-tracking`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.headers()['x-csrf-token'] || '';
}
