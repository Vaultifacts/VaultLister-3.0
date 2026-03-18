import { test } from '../fixtures/auth.js';

test('screenshots', async ({ authedPage: page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login page
  await page.goto(`http://localhost:${process.env.PORT || 3000}/#login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/ss-login.png' });

  // Dashboard (already authenticated via authedPage fixture)
  await page.goto(`http://localhost:${process.env.PORT || 3000}/#dashboard`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/ss-dashboard.png' });
});
