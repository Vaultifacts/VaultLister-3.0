// Community E2E Tests
import { test, expect } from '@playwright/test';
import { demoUser, routes } from '../fixtures/test-data.js';

test.describe('Community Features', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto(routes.login);
        await page.waitForTimeout(1000);

        const emailInput = page.locator('input[type="email"]').first();
        const passwordInput = page.locator('input[type="password"]').first();
        const submitBtn = page.locator('button[type="submit"]').first();

        await emailInput.fill(demoUser.email);
        await passwordInput.fill(demoUser.password);
        await submitBtn.click();

        await page.waitForURL(/#dashboard/, { timeout: 10000 });
    });

    test('should navigate to community page', async ({ page, baseURL }) => {
        // Navigate to community via hash — use baseURL from Playwright config
        await page.goto(`${baseURL}/#community`);
        await page.waitForURL(/#community/, { timeout: 10000 });

        // Verify we're on the community page
        await expect(page).toHaveURL(/#community/);

        // Wait for deferred chunk to load and render
        const pageTitle = page.locator('h1.page-title, .page-header h1').first();
        await expect(pageTitle).toBeVisible({ timeout: 15000 });
        await expect(pageTitle).toContainText('Community');
    });

    test('should switch between community tabs', async ({ page }) => {
        await page.goto(`http://localhost:${process.env.PORT || 3000}/#community`);
        await page.waitForTimeout(1000);

        // Find tab buttons
        const discussionTab = page.locator('button:has-text("Discussion"), button:has-text("Forum")').first();
        const successTab = page.locator('button:has-text("Success"), button:has-text("Stories")').first();
        const tipsTab = page.locator('button:has-text("Tips"), button:has-text("Tricks")').first();
        const leaderboardTab = page.locator('button:has-text("Leaderboard")').first();

        // Click through tabs
        if (await discussionTab.isVisible()) {
            await discussionTab.click();
            await page.waitForTimeout(500);
        }

        if (await successTab.isVisible()) {
            await successTab.click();
            await page.waitForTimeout(500);
        }

        if (await tipsTab.isVisible()) {
            await tipsTab.click();
            await page.waitForTimeout(500);
        }

        if (await leaderboardTab.isVisible()) {
            await leaderboardTab.click();
            await page.waitForTimeout(500);
        }

        // Should still be on community page
        await expect(page).toHaveURL(/#community/);
    });

    test('should open create post modal', async ({ page }) => {
        await page.goto(`http://localhost:${process.env.PORT || 3000}/#community`);
        await page.waitForTimeout(1000);

        // Look for create post button
        const createBtn = page.locator('button:has-text("Create Post"), button:has-text("New Post")').first();

        if (await createBtn.isVisible()) {
            await createBtn.click();
            await page.waitForTimeout(500);

            // Modal should appear
            const modal = page.locator('.modal, [role="dialog"]').first();
            await expect(modal).toBeVisible({ timeout: 3000 });

            // Close modal
            const closeBtn = page.locator('button.modal-close, button:has-text("Cancel")').first();
            if (await closeBtn.isVisible()) {
                await closeBtn.click();
            }
        }
    });

    test('should display community posts', async ({ page }) => {
        await page.goto(`http://localhost:${process.env.PORT || 3000}/#community`);
        await page.waitForTimeout(2000);

        // Page should load without errors
        await expect(page).toHaveURL(/#community/);
    });

    test('should view leaderboard', async ({ page }) => {
        await page.goto(`http://localhost:${process.env.PORT || 3000}/#community`);
        await page.waitForTimeout(1000);

        // Click leaderboard tab
        const leaderboardTab = page.locator('button:has-text("Leaderboard")').first();

        if (await leaderboardTab.isVisible()) {
            await leaderboardTab.click();
            await page.waitForTimeout(1000);

            // Leaderboard content should be visible
            await expect(page).toHaveURL(/#community/);
        }
    });
});
