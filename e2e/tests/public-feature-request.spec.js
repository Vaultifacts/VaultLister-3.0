import { test, expect } from '@playwright/test';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;

test('public feature request form submits successfully', async ({ page }) => {
    const uniqueSuffix = Date.now();
    await page.context().setExtraHTTPHeaders({
        'x-forwarded-for': `203.0.113.${(uniqueSuffix % 200) + 1}`
    });

    await page.goto(`${BASE_URL}/request-feature.html`);
    await page.waitForLoadState('domcontentloaded');

    const cookieButton = page.locator('#cookie-banner button').first();
    if (await cookieButton.isVisible().catch(() => false)) {
        await cookieButton.click().catch(() => {});
    }

    await page.locator('#open-form-btn').click();
    await page.locator('#fr-name').fill('E2E Tester');
    await page.locator('#fr-email').fill(`e2e+${uniqueSuffix}@example.com`);
    await page.locator('#fr-title').fill(`E2E feature request ${uniqueSuffix}`);
    await page.locator('#fr-desc').fill('Verify that the public feature request form accepts submissions without an authenticated session.');

    const [submitResponse] = await Promise.all([
        page.waitForResponse((response) => response.url().includes('/api/feature-requests') && response.request().method() === 'POST'),
        page.locator('#fr-submit').click()
    ]);

    expect(submitResponse.status()).toBe(201);
    await expect(page.locator('#fr-form-msg')).toContainText("Thanks! We've received your request and will review it soon.");
});
