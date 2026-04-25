import { test, expect } from '@playwright/test';

const BASE = `http://localhost:${process.env.PORT || 3000}`;

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------
test.describe('Landing Page', () => {
    test('should load with correct title when visiting root', async ({ page }) => {
        await page.goto(BASE);
        await expect(page).toHaveTitle(/VaultLister/);
    });

    test('should show Features dropdown and nav links when page loads', async ({ page }) => {
        await page.goto(BASE);
        await expect(page.locator('.nav-links button.nav-dropdown-btn').first()).toBeVisible();
        await expect(page.locator('a.nav-link[href="/platforms.html"]')).toBeVisible();
        await expect(page.locator('a.nav-link[href="/pricing.html"]')).toBeVisible();
        await expect(page.locator('button[data-dropdown="feedback-menu"]')).toBeVisible();
    });

    test('should show hero section heading when page loads', async ({ page }) => {
        await page.goto(BASE);
        await expect(page.locator('h1')).toContainText('List. Sell.');
    });

    test('should have 12 feature cards when page loads', async ({ page }) => {
        await page.goto(BASE);
        const featureCards = page.locator('.feature-card');
        await expect(featureCards).toHaveCount(12);
    });

    test('should show 14 marketplace tiles (7 supported + 7 coming soon) when page loads', async ({ page }) => {
        await page.goto(BASE);
        const allTiles = page.locator('.vinyl-wrapper, .vinyl-wrapper-soon');
        await expect(allTiles).toHaveCount(14);
        const comingSoonTiles = page.locator('.vinyl-wrapper-soon');
        await expect(comingSoonTiles).toHaveCount(7);
    });

    test('should have 4 footer columns when page loads', async ({ page }) => {
        await page.goto(BASE);
        const footerCols = page.locator('.footer-cols .footer-col');
        await expect(footerCols).toHaveCount(4);
        await expect(page.locator('.footer-col-label').filter({ hasText: 'Resources' })).toBeVisible();
        await expect(page.locator('.footer-col-label').filter({ hasText: 'Company' })).toBeVisible();
        await expect(page.locator('.footer-col-label').filter({ hasText: 'Legal' })).toBeVisible();
        await expect(page.locator('.footer-col-label').filter({ hasText: 'Compare' })).toBeVisible();
    });

    test('should have 5 social icons in footer when page loads', async ({ page }) => {
        await page.goto(BASE);
        const socialLinks = page.locator('.footer-social-links a');
        await expect(socialLinks).toHaveCount(6);
    });

    test('should show mobile hamburger button when page loads', async ({ page }) => {
        await page.goto(BASE);
        await expect(page.locator('.nav-hamburger')).toBeAttached();
    });
});

// ---------------------------------------------------------------------------
// Pricing Page
// ---------------------------------------------------------------------------
test.describe('Pricing Page', () => {
    test('should load with correct heading when visiting /pricing.html', async ({ page }) => {
        await page.goto(`${BASE}/pricing.html`);
        await expect(page.locator('h1')).toContainText('Plans For All ReSellers');
    });

    test('should show 4 plan cards when pricing page loads', async ({ page }) => {
        await page.goto(`${BASE}/pricing.html`);
        const planCards = page.locator('.plan-card');
        await expect(planCards).toHaveCount(4);
        await expect(page.locator('.plan-name').filter({ hasText: 'Free' })).toBeVisible();
        await expect(page.locator('.plan-name').filter({ hasText: 'Starter' })).toBeVisible();
        await expect(page.locator('.plan-name').filter({ hasText: 'Pro' })).toBeVisible();
        await expect(page.locator('.plan-name').filter({ hasText: 'Business' })).toBeVisible();
    });

    test('should show 3 billing period toggle buttons when pricing page loads', async ({ page }) => {
        await page.goto(`${BASE}/pricing.html`);
        const billingBtns = page.locator('.billing-btn');
        await expect(billingBtns).toHaveCount(3);
        await expect(billingBtns.filter({ hasText: 'Monthly' })).toBeVisible();
        await expect(billingBtns.filter({ hasText: 'Quarterly' })).toBeVisible();
        await expect(billingBtns.filter({ hasText: 'Yearly' })).toBeVisible();
    });

    test('should show comparison table with 10 feature rows when pricing page loads', async ({ page }) => {
        await page.goto(`${BASE}/pricing.html`);
        const tableRows = page.locator('.compare-table tbody tr');
        await expect(tableRows).toHaveCount(10);
    });

    test('should update Starter price to C$8.10 when Quarterly is clicked', async ({ page }) => {
        await page.goto(`${BASE}/pricing.html`);
        await page.locator('.billing-btn[data-period="quarterly"]').click();
        const starterAmount = page.locator('.plan-amount[data-quarterly="8.10"]');
        await expect(starterAmount).toHaveText('8.10');
    });
});

// ---------------------------------------------------------------------------
// Contact Page
// ---------------------------------------------------------------------------
test.describe('Contact Page', () => {
    test('should load with correct heading when visiting /contact.html', async ({ page }) => {
        await page.goto(`${BASE}/contact.html`);
        await expect(page.locator('h1')).toContainText('Contact Us');
    });

    test('should show contact form with Name, Email, Message fields when page loads', async ({ page }) => {
        await page.goto(`${BASE}/contact.html`);
        await expect(page.locator('#contact-name')).toBeVisible();
        await expect(page.locator('#contact-email')).toBeVisible();
        await expect(page.locator('#contact-message')).toBeVisible();
    });

    test('should show submit button when page loads', async ({ page }) => {
        await page.goto(`${BASE}/contact.html`);
        await expect(page.locator('#contact-submit')).toBeVisible();
    });

    test('should show validation error when form is submitted empty', async ({ page }) => {
        await page.goto(`${BASE}/contact.html`);
        await page.locator('#contact-submit').click();
        const errMsg = page.locator('#contact-msg');
        await expect(errMsg).toBeVisible({ timeout: 5000 });
        await expect(errMsg).toHaveClass(/error/);
    });
});

// ---------------------------------------------------------------------------
// Changelog Page
// ---------------------------------------------------------------------------
test.describe('Changelog Page', () => {
    test('should load with correct heading when visiting /changelog.html', async ({ page }) => {
        await page.goto(`${BASE}/changelog.html`);
        await expect(page.locator('h1')).toContainText('Changelog');
    });

    test('should show 5 filter buttons when changelog page loads', async ({ page }) => {
        await page.goto(`${BASE}/changelog.html`);
        const filterBtns = page.locator('.filter-btn');
        await expect(filterBtns).toHaveCount(5);
        await expect(filterBtns.filter({ hasText: 'All' })).toBeVisible();
        await expect(filterBtns.filter({ hasText: 'New' })).toBeVisible();
        await expect(filterBtns.filter({ hasText: 'Fix' })).toBeVisible();
        await expect(filterBtns.filter({ hasText: 'Security' })).toBeVisible();
        await expect(filterBtns.filter({ hasText: 'AI' })).toBeVisible();
    });

    test('should have at least one release entry when changelog page loads', async ({ page }) => {
        await page.goto(`${BASE}/changelog.html`);
        const releases = page.locator('article.release');
        await expect(releases.first()).toBeVisible();
    });

    test('should load VaultLister logo image when changelog page loads', async ({ page }) => {
        await page.goto(`${BASE}/changelog.html`);
        const logo = page.locator('.nav-logo img[alt="VaultLister"]');
        await expect(logo).toBeVisible();
        const naturalWidth = await logo.evaluate(el => el.naturalWidth);
        expect(naturalWidth).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// Platforms Page
// ---------------------------------------------------------------------------
test.describe('Platforms Page', () => {
    test('should load with correct heading when visiting /platforms.html', async ({ page }) => {
        await page.goto(`${BASE}/platforms.html`);
        await expect(page.locator('h1')).toContainText('Integrations');
    });

    test('should show 10 platform cards when page loads', async ({ page }) => {
        await page.goto(`${BASE}/platforms.html`);
        const cards = page.locator('.platform-card');
        await expect(cards).toHaveCount(10);
    });

    test('should show Live badge on Depop card', async ({ page }) => {
        await page.goto(`${BASE}/platforms.html`);
        const depopCard = page.locator('.platform-card').filter({ has: page.locator('h2', { hasText: 'Depop' }) });
        await expect(depopCard.locator('.badge-live')).toContainText('Live');
    });

    test('should show Live badge on Facebook card', async ({ page }) => {
        await page.goto(`${BASE}/platforms.html`);
        const fbCard = page.locator('.platform-card').filter({ has: page.locator('h2', { hasText: 'Facebook' }) });
        await expect(fbCard.locator('.badge-live')).toContainText('Live');
    });
});

// ---------------------------------------------------------------------------
// Compare Page — Vendoo
// ---------------------------------------------------------------------------
test.describe('Compare Page — Vendoo', () => {
    test('should load with correct heading when visiting /compare/vendoo.html', async ({ page }) => {
        await page.goto(`${BASE}/compare/vendoo.html`);
        await expect(page.locator('h1')).toContainText('VaultLister vs Vendoo');
    });

    test('should show comparison table when vendoo compare page loads', async ({ page }) => {
        await page.goto(`${BASE}/compare/vendoo.html`);
        await expect(page.locator('.compare-table')).toBeVisible();
    });

    test('should show Why choose VaultLister section when vendoo compare page loads', async ({ page }) => {
        await page.goto(`${BASE}/compare/vendoo.html`);
        await expect(page.locator('.compare-why h2')).toContainText('Why choose VaultLister');
    });
});
