// Tests for FacebookBot flows using the local mock server.
// Uses Playwright chromium directly (no Camoufox) -- tests bot DOM selectors.
//
// PLATFORM NOTE: Playwright browser subprocess launch hangs under Bun 1.3.x on
// Windows due to a known incompatibility with Bun"s child_process spawn.
// These tests pass on Linux/CI where Bun + Playwright works correctly.
// To run locally on Windows: npx playwright test worker/bots/facebook-bot.test.js
//
// Skip guard: all tests are skipped when process.platform === "win32" under bun.

import { test, expect, afterAll } from 'bun:test';
import { start, stop } from './test-fixtures/mock-server.js';

const IS_WINDOWS_BUN = process.platform === "win32" && typeof Bun !== "undefined";

let _port = 0;
let _browser = null;
let _page = null;
let _initError = null;

// Lazy init: skip silently on Windows+bun; launch chromium on Linux/CI
async function getCtx() {
    if (IS_WINDOWS_BUN) return null;
    if (_initError) throw _initError;
    if (_page) return { port: _port, page: _page };
    try {
        const { chromium } = await import('playwright');
        _port = await start();
        _browser = await chromium.launch({ headless: true });
        _page = await _browser.newPage();
    } catch(e) {
        _initError = e;
        throw e;
    }
    return { port: _port, page: _page };
}

afterAll(async () => {
    if (_browser) await _browser.close().catch(() => {});
    if (_port) await stop();
});

// -- Login -------------------------------------------------------------------

test('login: email + password + submit selectors present on /login', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#email, input[name="email"]');
    expect(await page.$('#email, input[name="email"]')).not.toBeNull();
    expect(await page.$('#pass, input[name="pass"]')).not.toBeNull();
    expect(await page.$('button[name="login"], button[type="submit"]')).not.toBeNull();
}, 30000);

test('login: fill + submit redirects away from /login', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#email', 'test@example.com');
    await page.fill('#pass', 'testpassword');
    await page.click('button[name="login"]');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {});
    expect(page.url()).not.toContain('/login');
}, 30000);

test('login: ?captcha=1 page has captcha element matching bot selector', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/login?captcha=1`, { waitUntil: 'domcontentloaded' });
    const captcha = await page.$('[class*="captcha" i], [id*="captcha" i]');
    expect(captcha).not.toBeNull();
}, 20000);

test('login: ?checkpoint=1 navigates to /checkpoint URL', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/?checkpoint=1`, { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/checkpoint');
}, 20000);

test('login: ?verify=1 navigates to /marketplace/verify URL', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/?verify=1`, { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/marketplace/verify');
}, 20000);

test('login: profile indicator visible on / when fb_session cookie is set', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.context().addCookies([{
        name: 'fb_session', value: '1',
        domain: '127.0.0.1', path: '/'
    }]);
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    const profileEl = await page.$('[aria-label="Your profile"], [data-testid="royal_profile_link"]');
    expect(profileEl).not.toBeNull();
    await page.context().clearCookies();
}, 20000);

// -- Refresh listing (edit + save) -----------------------------------------

test('refreshListing: Edit button present on /marketplace/item/:id', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/marketplace/item/100000001`, { waitUntil: 'domcontentloaded' });
    const editBtn = await page.$('[aria-label*="Edit" i], button:has-text("Edit listing"), [data-testid*="edit"]');
    expect(editBtn).not.toBeNull();
}, 20000);

test('refreshListing: clicking Edit reveals Save/Update button', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/marketplace/item/100000002`, { waitUntil: 'domcontentloaded' });
    const editBtn = await page.$('[aria-label*="Edit" i], button:has-text("Edit listing"), [data-testid*="edit"]');
    await editBtn.click();
    await page.waitForTimeout(200);
    const saveBtn = await page.$('button:has-text("Update"), button:has-text("Save"), [aria-label*="Publish" i]');
    expect(saveBtn).not.toBeNull();
    expect(await saveBtn.isVisible()).toBe(true);
}, 20000);

// -- Relist (renew + confirm) -----------------------------------------------

test('relistItem: Renew button present on /marketplace/item/:id', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/marketplace/item/100000003`, { waitUntil: 'domcontentloaded' });
    const renewBtn = await page.$('button:has-text("Renew"), [aria-label*="Renew" i], [data-testid*="renew"]');
    expect(renewBtn).not.toBeNull();
}, 20000);

test('relistItem: clicking Renew reveals Confirm/Publish button', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/marketplace/item/100000004`, { waitUntil: 'domcontentloaded' });
    const renewBtn = await page.$('button:has-text("Renew"), [aria-label*="Renew" i], [data-testid*="renew"]');
    await renewBtn.click();
    await page.waitForTimeout(200);
    const confirmBtn = await page.$('button:has-text("Confirm"), button:has-text("Publish"), button[type="submit"]');
    expect(confirmBtn).not.toBeNull();
    expect(await confirmBtn.isVisible()).toBe(true);
}, 20000);

// -- refreshAllListings - selling page link discovery ----------------------

test('refreshAllListings: selling page has 5+ marketplace item links', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/marketplace/you/selling`, { waitUntil: 'domcontentloaded' });
    const linkHandles = await page.$$('a[href*="/marketplace/item/"]');
    const hrefs = await Promise.all(linkHandles.map(h => h.getAttribute('href')));
    const valid = hrefs.filter(Boolean);
    expect([...new Set(valid)].length).toBeGreaterThanOrEqual(5);
}, 20000);

test('refreshAllListings: all link hrefs match /marketplace/item/{id}/ pattern', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/marketplace/you/selling`, { waitUntil: 'domcontentloaded' });
    const linkHandles = await page.$$('a[href*="/marketplace/item/"]');
    const hrefs = await Promise.all(linkHandles.map(h => h.getAttribute('href')));
    for (const href of hrefs) {
        expect(href).toMatch(/\/marketplace\/item\/\d+\//);
    }
}, 20000);

// -- POST create -> URL extraction regex -----------------------------------

test('create: POST /marketplace/create/item returns URL matching /marketplace/item/{id}/', async () => {
    if (IS_WINDOWS_BUN) { console.log("[SKIP] Windows+Bun: Playwright spawn not supported"); return; }
    const { port, page } = await getCtx();
    await page.goto(`http://127.0.0.1:${port}/marketplace/create/item`, { waitUntil: 'domcontentloaded' });
    const res = await page.request.fetch(`http://127.0.0.1:${port}/marketplace/create/item`, {
        method: 'POST',
        form: { title: 'Test', price: '25' }
    });
    expect(res.url()).toMatch(/\/marketplace\/item\/\d+\//);
}, 20000);
