import { test } from '@playwright/test';

test('screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login page
  await page.goto(`http://localhost:${process.env.PORT || 3000}/#login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/ss-login.png' });

  // Login
  await page.locator('input[name="email"]').fill('demo@vaultlister.com');
  await page.locator('input[type="password"]').fill('DemoPassword123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/ss-dashboard.png' });
});
