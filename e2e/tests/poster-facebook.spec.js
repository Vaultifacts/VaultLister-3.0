// Playwright E2E: tests poster.js fillFacebook() against the Facebook mock server.

import { test, expect } from '@playwright/test';
import { start, stop, getPort } from '../../worker/bots/test-fixtures/mock-server.js';
import fs from 'fs';
import path from 'path';

let mockPort;

test.beforeAll(async () => {
    mockPort = await start();
});

test.afterAll(async () => {
    await stop();
});

function getPosterScript() {
    const src = fs.readFileSync(
        path.join(process.cwd(), 'chrome-extension/content/poster.js'),
        'utf8'
    );
    return src + '\nif (typeof fillFacebook !== "undefined") { window.fillFacebook = fillFacebook; }\n';
}

async function loadCreatePage(page, params) {
    await page.addInitScript(() => {
        window.chrome = {
            runtime: {
                id: 'mock-ext-id',
                onMessage: { addListener: () => {}, removeListener: () => {} },
                sendMessage: () => {},
                connect: () => ({
                    postMessage: () => {},
                    onDisconnect: { addListener: () => {} },
                    onMessage: { addListener: () => {} }
                })
            }
        };
    });
    const qs = params ? `?${params}` : '';
    await page.goto(`http://127.0.0.1:${mockPort}/marketplace/create/item${qs}`, {
        waitUntil: 'domcontentloaded'
    });
    await page.addScriptTag({ content: getPosterScript() });
    await page.waitForTimeout(300);
}

test('fillFacebook: fills title field', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({ title: 'Test Jacket', list_price: '25', description: 'Great condition' }));
    await page.waitForTimeout(1500);
    const val = await page.inputValue('#title-input');
    expect(val).toBe('Test Jacket');
});

test('fillFacebook: fills price field', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({ title: 'Shoes', list_price: '45', description: 'Size 10' }));
    await page.waitForTimeout(1500);
    const val = await page.inputValue('#price-input');
    expect(val).toBe('45');
});

test('fillFacebook: selects category — trigger text updates to mapped value', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({
        title: 'T-Shirt', list_price: '10', category: 'clothing', description: 'Nice shirt'
    }));
    await page.waitForTimeout(2000);
    const text = await page.textContent('#category-trigger');
    expect(text).toContain('Clothing & Accessories');
});

test('fillFacebook: selects condition — trigger text updates to mapped value', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({
        title: 'Jeans', list_price: '30', condition: 'good', description: 'Good jeans'
    }));
    await page.waitForTimeout(2000);
    const text = await page.textContent('#condition-trigger');
    expect(text).toContain('Good');
});

test('fillFacebook: types location and clicks first suggestion', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({
        title: 'Lamp', list_price: '15', location: 'Calgary', description: 'Nice lamp'
    }));
    await page.waitForTimeout(3500);
    const val = await page.inputValue('#location-input');
    expect(val.length).toBeGreaterThan(0);
});

test('fillFacebook: fills description in contenteditable Lexical editor', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({
        title: 'Book', list_price: '5', description: 'Great read, barely used'
    }));
    await page.waitForTimeout(1500);
    const text = await page.textContent('#description-editor');
    expect(text).toContain('Great read, barely used');
});

test('fillFacebook: skipped does not include Title/Price/Description when all provided', async ({ page }) => {
    await loadCreatePage(page);
    const skipped = await page.evaluate(() => window.fillFacebook({
        title: 'Full Item', list_price: '99',
        category: 'electronics', condition: 'like_new',
        location: 'Calgary', description: 'All fields provided'
    }));
    await page.waitForTimeout(3500);
    if (Array.isArray(skipped)) {
        expect(skipped).not.toContain('Title');
        expect(skipped).not.toContain('Price');
        expect(skipped).not.toContain('Description');
    }
});
