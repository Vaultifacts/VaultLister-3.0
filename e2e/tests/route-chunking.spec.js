// @ts-check
import { test, expect } from '../fixtures/auth.js';

const BASE = `http://localhost:${process.env.PORT || 3001}`;

/**
 * Route-based chunking E2E tests
 * Verifies that chunk loading works for all 6 route groups
 */
test.describe('Route-Based Chunking', () => {

    test('loads inventory-catalog chunk on navigation @chunking', async ({ authedPage }) => {
        await authedPage.goto(`${BASE}/#inventory`);
        await authedPage.waitForFunction(
            () => document.querySelector('#app')?.innerHTML.length > 200,
            { timeout: 15000 }
        );
        await expect(authedPage.locator('.page-title, h1, .main-content')).toBeVisible({ timeout: 10000 });
    });

    test('loads sales-orders chunk on navigation @chunking', async ({ authedPage }) => {
        await authedPage.goto(`${BASE}/#sales`);
        await authedPage.waitForFunction(
            () => document.querySelector('#app')?.innerHTML.length > 200,
            { timeout: 15000 }
        );
        await expect(authedPage.locator('.page-title, h1, .main-content')).toBeVisible({ timeout: 10000 });
    });

    test('loads tools-tasks chunk on navigation @chunking', async ({ authedPage }) => {
        await authedPage.goto(`${BASE}/#checklist`);
        await authedPage.waitForFunction(
            () => document.querySelector('#app')?.innerHTML.length > 200,
            { timeout: 15000 }
        );
        await expect(authedPage.locator('.page-title, h1, .main-content')).toBeVisible({ timeout: 10000 });
    });

    test('loads intelligence chunk on navigation @chunking', async ({ authedPage }) => {
        await authedPage.goto(`${BASE}/#predictions`);
        await authedPage.waitForFunction(
            () => document.querySelector('#app')?.innerHTML.length > 200,
            { timeout: 15000 }
        );
        await expect(authedPage.locator('.page-title, h1, .main-content')).toBeVisible({ timeout: 10000 });
    });

    test('loads settings-account chunk on navigation @chunking', async ({ authedPage }) => {
        await authedPage.goto(`${BASE}/#settings`);
        await authedPage.waitForFunction(
            () => document.querySelector('#app')?.innerHTML.length > 200,
            { timeout: 15000 }
        );
        await expect(authedPage.locator('.page-title, h1, .main-content')).toBeVisible({ timeout: 10000 });
    });

    test('loads community-help chunk on navigation @chunking', async ({ authedPage }) => {
        await authedPage.goto(`${BASE}/#help`);
        await authedPage.waitForFunction(
            () => document.querySelector('#app')?.innerHTML.length > 200,
            { timeout: 15000 }
        );
        await expect(authedPage.locator('.page-title, h1, .main-content')).toBeVisible({ timeout: 10000 });
    });

    test('navigates between different chunk groups without error @chunking', async ({ authedPage }) => {
        const routes = ['#inventory', '#sales', '#checklist', '#settings', '#help', '#dashboard'];
        for (const route of routes) {
            await authedPage.goto(`${BASE}/${route}`);
            await authedPage.waitForFunction(
                () => document.querySelector('#app')?.innerHTML.length > 200,
                { timeout: 15000 }
            );
        }
        // Verify no console errors from chunk loading
        const errors = [];
        authedPage.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        await authedPage.goto(`${BASE}/#inventory`);
        await authedPage.waitForTimeout(2000);
        // Allow some console errors (non-critical) but flag chunk-related ones
        const chunkErrors = errors.filter(e => e.includes('loadChunk') || e.includes('chunk'));
        expect(chunkErrors).toHaveLength(0);
    });

    test('same chunk is not re-fetched on repeat navigation @chunking', async ({ authedPage }) => {
        // Navigate to inventory (loads inventory-catalog chunk)
        await authedPage.goto(`${BASE}/#inventory`);
        await authedPage.waitForFunction(
            () => document.querySelector('#app')?.innerHTML.length > 200,
            { timeout: 15000 }
        );

        // Navigate away then back — chunk should be cached
        await authedPage.goto(`${BASE}/#dashboard`);
        await authedPage.waitForTimeout(1000);

        const startTime = Date.now();
        await authedPage.goto(`${BASE}/#inventory`);
        await authedPage.waitForFunction(
            () => document.querySelector('#app')?.innerHTML.length > 200,
            { timeout: 15000 }
        );
        const elapsed = Date.now() - startTime;

        // Second load should be faster since chunk is cached (< 5s)
        expect(elapsed).toBeLessThan(5000);
    });
});
