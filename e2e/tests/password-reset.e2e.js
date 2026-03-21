// Password Reset Flow E2E Tests
// Tests the forgot-password and reset-password UI flows.
// Cannot test actual email delivery — validates UI states and form behaviour only.
import { test, expect } from '@playwright/test';
import { waitForSpaRender, waitForUiSettle, loginAndNavigate } from '../helpers/wait-utils.js';

const BASE = `http://localhost:${process.env.PORT || 3000}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function goToForgotPassword(page) {
    await loginAndNavigate(page, 'dashboard', { baseUrl: BASE });
    await page.evaluate(() => router.navigate('forgot-password'));
    await page.waitForSelector('#forgot-password-form', { timeout: 10_000 });
    await waitForSpaRender(page);
    // Dismiss overlays that intercept pointer events
    const dismissBtn = page.locator('button:has-text("Dismiss announcement")');
    if (await dismissBtn.isVisible().catch(() => false)) {
        await dismissBtn.click();
        await page.waitForTimeout(400);
    }
    const acceptBtn = page.locator('#cookie-banner button:has-text("Accept"), #cookie-banner button:has-text("Decline")').first();
    if (await acceptBtn.isVisible().catch(() => false)) {
        await acceptBtn.click();
        await page.waitForTimeout(200);
    }
}

async function goToResetPassword(page, token = 'test-token') {
    await loginAndNavigate(page, 'dashboard', { baseUrl: BASE });
    await page.evaluate((t) => router.navigate(`reset-password?token=${t}`), token);
    await page.waitForSelector('#reset-password-form', { timeout: 10_000 });
    await waitForSpaRender(page);
}

// ── Forgot Password ───────────────────────────────────────────────────────────

test.describe('Password Reset — Forgot Password form', () => {
    test('should render forgot-password form when navigating to #forgot-password', async ({ page }) => {
        await goToForgotPassword(page);

        await expect(page.locator('#forgot-password-form')).toBeVisible();
        await expect(page.locator('#forgot-password-form input[name="email"]')).toBeVisible();
        await expect(page.locator('#forgot-password-form button[type="submit"]')).toBeVisible();
        await expect(page.locator('#forgot-password-form button[type="submit"]')).toHaveText('Send Reset Link');
    });

    test('should show success state when valid email is submitted', async ({ page }) => {
        await goToForgotPassword(page);

        await page.locator('#forgot-password-form input[name="email"]').fill('user@example.com');
        await page.locator('#forgot-password-form button[type="submit"]').click();

        await page.waitForSelector('#forgot-password-success', { state: 'visible', timeout: 10_000 });

        await expect(page.locator('#forgot-password-success')).toBeVisible();
        await expect(page.locator('#forgot-password-form')).toBeHidden();
    });

    test('should show the same success message regardless of whether email exists', async ({ page }) => {
        await goToForgotPassword(page);

        await page.locator('#forgot-password-form input[name="email"]').fill('nonexistent-xyz-12345@fakeemail.test');
        await page.locator('#forgot-password-form button[type="submit"]').click();

        await page.waitForSelector('#forgot-password-success', { state: 'visible', timeout: 10_000 });

        // Email enumeration protection: success shown for any input
        await expect(page.locator('#forgot-password-success')).toBeVisible();
        const successText = await page.locator('#forgot-password-success').textContent();
        expect(successText).not.toMatch(/account found/i);
        expect(successText).not.toMatch(/email sent to/i);
    });

    test('should not submit when email field is empty (HTML5 required)', async ({ page }) => {
        await goToForgotPassword(page);

        const emailEl = page.locator('#forgot-password-form input[name="email"]');
        await emailEl.fill('');
        const validity = await emailEl.evaluate((el) => el.validity.valueMissing);
        expect(validity).toBe(true);

        // Form should still be visible (not submitted)
        await expect(page.locator('#forgot-password-form')).toBeVisible();
    });

    test('should navigate back to login when Back to Sign In link is clicked', async ({ page }) => {
        await goToForgotPassword(page);

        const backLink = page.locator('#forgot-password-form a[href="#login"]');
        await expect(backLink).toBeVisible();
        await backLink.click();

        await page.waitForSelector('#login-form', { timeout: 10_000 });
        await expect(page.locator('#login-form')).toBeVisible();
    });

    test('should show Back to Sign In link in success state and navigate to login', async ({ page }) => {
        await goToForgotPassword(page);

        await page.locator('#forgot-password-form input[name="email"]').fill('test@example.com');
        await page.locator('#forgot-password-form button[type="submit"]').click();
        await page.waitForSelector('#forgot-password-success', { state: 'visible', timeout: 10_000 });

        const successBackLink = page.locator('#forgot-password-success a[href="#login"]');
        await expect(successBackLink).toBeVisible();
        await successBackLink.click();

        await page.waitForSelector('#login-form', { timeout: 10_000 });
        await expect(page.locator('#login-form')).toBeVisible();
    });
});

// ── Reset Password ────────────────────────────────────────────────────────────

test.describe('Password Reset — Reset Password form', () => {
    test('should render reset-password form when navigating to #reset-password with a token', async ({ page }) => {
        await goToResetPassword(page, 'test-token');

        await expect(page.locator('#reset-password-form')).toBeVisible();
        await expect(page.locator('#reset-password-input')).toBeVisible();
        await expect(page.locator('#reset-password-confirm')).toBeVisible();
        await expect(page.locator('[data-testid="reset-password-submit"]')).toBeVisible();
    });

    test('should render new password and confirm password fields', async ({ page }) => {
        await goToResetPassword(page, 'test-token');

        const newPwField = page.locator('#reset-password-input');
        const confirmField = page.locator('#reset-password-confirm');

        await expect(newPwField).toHaveAttribute('type', 'password');
        await expect(confirmField).toHaveAttribute('type', 'password');
        await expect(newPwField).toHaveAttribute('required', '');
        await expect(confirmField).toHaveAttribute('required', '');
    });

    test('should show an error when passwords do not match', async ({ page }) => {
        await goToResetPassword(page, 'test-token');

        await page.locator('#reset-password-input').fill('ValidPassword123!');
        await page.locator('#reset-password-confirm').fill('DifferentPassword456!');
        await page.locator('[data-testid="reset-password-submit"]').click();
        await waitForUiSettle(page);

        // Error element should become visible with a mismatch message
        const errorEl = page.locator('#reset-password-error');
        await expect(errorEl).toBeVisible({ timeout: 5_000 });
        const errorText = await errorEl.textContent();
        expect(errorText.trim().length).toBeGreaterThan(0);
    });

    test('should keep both password fields empty on initial render', async ({ page }) => {
        await goToResetPassword(page, 'test-token');

        await expect(page.locator('#reset-password-input')).toHaveValue('');
        await expect(page.locator('#reset-password-confirm')).toHaveValue('');
    });
});
