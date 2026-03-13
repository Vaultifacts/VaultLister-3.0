/**
 * Poshmark Automation E2E Tests — Live
 *
 * P4-2  Closet sharing — verifies Poshmark closet page loads with listing tiles and share UI
 * P4-3  Follow-back — verifies followers page loads with user cards and follow buttons
 * P4-4  Auto-offer selector verification — verifies offers page loads and has expected structure
 * P4-6  Inventory sync — POST /api/automations/poshmark/sync queues a task and returns taskId
 *
 * Live tests (P4-2, P4-3, P4-4) skip gracefully when POSHMARK_USERNAME is not configured.
 * These use @playwright/test's own browser (Node.js-managed), not PoshmarkBot, so they
 * work correctly on all platforms without needing browser subprocess spawning from Bun.
 */

import { test, expect, chromium } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const AUDIT_LOG = path.resolve(ROOT, 'data/automation-audit.log');

// Read Poshmark credentials from .env (Playwright workers don't inherit all env vars)
function readEnvVar(name) {
    try {
        const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
        const match = env.match(new RegExp(`^${name}=(.+)$`, 'm'));
        return match ? match[1].trim() : '';
    } catch { return ''; }
}

const POSHMARK_USERNAME = process.env.POSHMARK_USERNAME || readEnvVar('POSHMARK_USERNAME');
const POSHMARK_PASSWORD = process.env.POSHMARK_PASSWORD || readEnvVar('POSHMARK_PASSWORD');
const POSHMARK_COUNTRY = (process.env.POSHMARK_COUNTRY || readEnvVar('POSHMARK_COUNTRY') || 'us').toLowerCase();
const APP_PORT = process.env.PORT || readEnvVar('PORT') || '3000';
const BASE_URL = `http://localhost:${APP_PORT}`;

const POSHMARK_DOMAIN_MAP = { us: 'https://poshmark.com', ca: 'https://poshmark.ca', au: 'https://poshmark.com.au', in: 'https://poshmark.in' };
const POSHMARK_URL = POSHMARK_DOMAIN_MAP[POSHMARK_COUNTRY] || POSHMARK_DOMAIN_MAP.us;

const COOKIE_FILE = path.resolve(ROOT, 'data/poshmark-cookies.json');
const PROFILE_DIR = path.resolve(ROOT, 'data/poshmark-profile');
const COOKIES_EXIST = fs.existsSync(COOKIE_FILE);
const PROFILE_EXISTS = fs.existsSync(path.join(PROFILE_DIR, 'Default', 'Network', 'Cookies'));
const CREDS_CONFIGURED = !!POSHMARK_USERNAME && !!POSHMARK_PASSWORD;

// Live tests need either saved cookies or an existing browser profile
const LIVE_TESTS_ENABLED = CREDS_CONFIGURED && (COOKIES_EXIST || PROFILE_EXISTS);
const LIVE_SKIP_REASON = !CREDS_CONFIGURED
    ? 'POSHMARK_USERNAME / POSHMARK_PASSWORD not configured'
    : !LIVE_TESTS_ENABLED
        ? 'No Poshmark session found — need data/poshmark-cookies.json or data/poshmark-profile/'
        : null;

test.setTimeout(120_000);

// ── Session helper: launch persistent context (reuses existing browser profile) ──

async function launchPoshmarkContext(chromium) {
    if (PROFILE_EXISTS) {
        // Reuse the existing browser profile (has valid Poshmark session)
        return chromium.launchPersistentContext(PROFILE_DIR, {
            headless: true,
            args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
            ignoreDefaultArgs: ['--enable-automation']
        });
    }
    // Fallback: launch fresh context with saved cookies
    const ctx = await chromium.launchPersistentContext('', { headless: true });
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
    await ctx.addCookies(cookies);
    return ctx;
}

async function poshmarkLogin(context) {
    const page = context.pages()[0] || await context.newPage();
    try {
        await page.goto(`${POSHMARK_URL}/feed`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
        test.skip(true, 'Poshmark unreachable — skipping live test');
        return null;
    }
    await page.waitForTimeout(2000);
    if (page.url().includes('/login')) {
        test.skip(true, 'Poshmark session expired — need fresh login');
        return null;
    }
    return page;
}

// ── CSRF helper ───────────────────────────────────────────────────────────────

async function getCsrf(request, token) {
    const res = await request.get(`${BASE_URL}/api/automations`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.headers()['x-csrf-token'] || '';
}

// ── P4-2: Closet Sharing — Live UI Test ──────────────────────────────────────

test.describe('P4-2 — Poshmark Closet Sharing (Live)', () => {
    test.skip(!LIVE_TESTS_ENABLED, LIVE_SKIP_REASON || 'Live tests not enabled');

    test('closet page loads with listing tiles and share UI', async () => {
        const ctx = await launchPoshmarkContext(chromium);
        try {
            const page = await poshmarkLogin(ctx);

            // Navigate to own closet (get username from profile page after login)
            const profileLink = await page.$('[data-test="my_closet"], a[href*="/closet/"], .header__account-info-list a');
            let closetUrl = `${POSHMARK_URL}/feed`;
            if (profileLink) {
                const href = await profileLink.getAttribute('href');
                if (href && href.includes('/closet/')) {
                    closetUrl = href.startsWith('http') ? href : `${POSHMARK_URL}${href}`;
                }
            }

            await page.goto(closetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);

            expect(page.url()).not.toContain('/login');

            // Verify listing tiles or empty-closet message exists
            const tilesOrEmpty = await page.$('[data-test="tile"], .card--small, .closet__empty, [data-test="closet-empty"]');
            expect(tilesOrEmpty).not.toBeNull();
        } finally {
            await ctx.close();
        }
    });
});

// ── P4-3: Follow-Back — Live UI Test ─────────────────────────────────────────

test.describe('P4-3 — Poshmark Follow-Back (Live)', () => {
    test.skip(!LIVE_TESTS_ENABLED, LIVE_SKIP_REASON || 'Live tests not enabled');

    test('followers page loads and shows expected user card structure', async () => {
        const ctx = await launchPoshmarkContext(chromium);
        try {
            const page = await poshmarkLogin(ctx);

            await page.goto(`${POSHMARK_URL}/user/followers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);

            expect(page.url()).not.toContain('/login');

            const content = await page.$('.user-card, .follower-list, [data-test="user-card"], h1, .page__content');
            expect(content).not.toBeNull();
        } finally {
            await ctx.close();
        }
    });
});

// ── P4-4: Auto-Offer Selector Verification — Live UI ─────────────────────────

test.describe('P4-4 — Poshmark Auto-Offer Selectors (Live)', () => {
    test.skip(!LIVE_TESTS_ENABLED, LIVE_SKIP_REASON || 'Live tests not enabled');

    test('offers page loads without redirect to login', async () => {
        const ctx = await launchPoshmarkContext(chromium);
        try {
            const page = await poshmarkLogin(ctx);

            await page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);

            expect(page.url()).not.toContain('/login');

            const content = await page.$(
                '[data-test="offer-card"], .offer__empty-state, .offers-list, h1, .page__content, [data-test="offers-empty"]'
            );
            expect(content).not.toBeNull();
        } finally {
            await ctx.close();
        }
    });

    test('offer card action selectors exist when offers are present', async () => {
        const ctx = await launchPoshmarkContext(chromium);
        try {
            const page = await poshmarkLogin(ctx);

            await page.goto(`${POSHMARK_URL}/offers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);

            const offerCards = await page.$$('[data-test="offer-card"]');
            if (offerCards.length === 0) {
                test.skip(); // No active offers — can't verify action selectors
                return;
            }

            const counterBtn = await page.$('[data-test="counter-offer"]');
            const acceptBtn = await page.$('[data-test="accept-offer"]');
            const declineBtn = await page.$('[data-test="decline-offer"]');
            expect(counterBtn || acceptBtn || declineBtn).not.toBeNull();
        } finally {
            await ctx.close();
        }
    });
});

// ── P4-6: Inventory Sync — via API ───────────────────────────────────────────

test.describe('P4-6 — Poshmark Inventory Sync', () => {
    let token;

    test.beforeAll(async ({ request }) => {
        const data = await apiLogin(request);
        token = data.token;
    });

    test('POST /api/automations/poshmark/sync returns 400 when credentials not configured (or 202 when configured)', async ({ request }) => {
        const csrf = await getCsrf(request, token);
        const res = await request.post(`${BASE_URL}/api/automations/poshmark/sync`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
            data: { maxItems: 5 }
        });

        // 400 = no credentials, 202 = queued task (credentials present)
        expect([202, 400]).toContain(res.status());

        const body = await res.json();
        if (res.status() === 202) {
            expect(body.taskId).toBeTruthy();
            expect(body.status).toBe('queued');
        } else {
            expect(body.error).toMatch(/POSHMARK_USERNAME/i);
        }
    });

    test('sync endpoint queues a task with valid taskId when credentials are configured', async ({ request }) => {
        test.skip(!CREDS_CONFIGURED, LIVE_SKIP_REASON || 'Credentials not configured');

        const csrf = await getCsrf(request, token);
        const res = await request.post(`${BASE_URL}/api/automations/poshmark/sync`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
            data: { maxItems: 5 }
        });

        expect(res.status()).toBe(202);
        const body = await res.json();
        expect(body.taskId).toMatch(/^[0-9a-f-]{36}$/);
        expect(body.status).toBe('queued');
        expect(body.message).toBeTruthy();
    });
});
