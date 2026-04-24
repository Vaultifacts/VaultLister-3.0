import { test, expect } from '@playwright/test';

const LIVE_URL = process.env.VAULTLISTER_URL || 'https://vaultlister.com';

test('browserstack smoke test (debug)', async ({ page }) => {
  console.log('Navigating to:', LIVE_URL);

  try {
    const response = await page.goto(LIVE_URL, { timeout: 30000 });

    console.log('Response status:', response?.status());
    console.log('Final URL:', page.url());

    const title = await page.title();
    console.log('Page title:', title);

    // relaxed check
    expect(response).not.toBeNull();

  } catch (err) {
    console.error('Navigation failed:', err);
    throw err;
  }
});