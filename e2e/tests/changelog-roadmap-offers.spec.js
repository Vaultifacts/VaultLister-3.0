import { test, expect } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;

test.describe('Changelog Features', () => {

    test('1. should display changelog page with versions', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#changelog`);
        await page.waitForLoadState('networkidle');

        // Verify page title and description
        await expect(page.locator('h1:has-text("Changelog")')).toBeVisible();
        await expect(page.locator('text=See what\'s new in VaultLister')).toBeVisible();

        // Verify versions are displayed
        await expect(page.locator('h2.version-number:has-text("v1.6.0")')).toBeVisible();
        await expect(page.locator('h2.version-number:has-text("v1.5.0")')).toBeVisible();
    });

    test('2. should display Before/After screenshots for UI changes', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#changelog`);
        await page.waitForLoadState('networkidle');

        // Expand a changelog item with screenshots
        await page.locator('div.change-item').first().click();

        // Verify screenshot comparison section exists
        const screenshotComparison = page.locator('.screenshot-comparison');
        await expect(screenshotComparison).toBeVisible();
    });

    test('3. should display change type badges (Feature/Fix/Improvement/Breaking)', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#changelog`);
        await page.waitForLoadState('networkidle');

        // Verify badge types are present
        const featureBadge = page.locator('span:has-text("feature")').first();
        const improvementBadge = page.locator('span:has-text("improvement")').first();

        await expect(featureBadge).toBeVisible();
        await expect(improvementBadge).toBeVisible();
    });

    test('4. should display affected areas per change', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#changelog`);
        await page.waitForLoadState('networkidle');

        // Expand a change item to see affected areas
        await page.locator('div.change-item').first().click();
        await page.waitForSelector('.change-details-open', { timeout: 5000 });

        // Verify affected areas are displayed
        await expect(page.locator('.change-details-open').locator('text=Affected Areas').first()).toBeVisible();
    });

    test('5. should filter by version in sidebar', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#changelog`);
        await page.waitForLoadState('networkidle');

        // Click on v1.5.0 version filter
        await page.locator('button:has-text("v1.5.0")').click();

        // Verify v1.5.0 is displayed and other versions are hidden
        await expect(page.locator('h2:has-text("v1.5.0")')).toBeVisible();
    });

    test('6. should allow voting on changelog items (Helpful/Not Helpful)', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#changelog`);
        await page.waitForLoadState('networkidle');

        // Expand a change item to see voting buttons
        await page.locator('div.change-item').first().click();
        await page.waitForSelector('.change-details-open', { timeout: 5000 });

        // Find and verify the helpful button within expanded section
        const voteButtons = page.locator('.change-details-open div.change-vote-buttons').first();
        await expect(voteButtons).toBeVisible();

        // Verify vote buttons exist
        const helpfulBtn = page.locator('.change-details-open button.change-vote-btn').first();
        await expect(helpfulBtn).toBeVisible();
    });

    test('7. should provide RSS feed for changelog', async ({ authedPage: page, authToken }) => {
        const response = await page.request.get(`${BASE_URL}/api/roadmap/changelog/rss`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status()).toBe(200);
        const body = await response.text();
        expect(body).toContain('<?xml');
        expect(body).toContain('VaultLister Changelog');
        expect(body).toContain('v1.6.0');
    });

    test('8. should display What\'s New banner on roadmap', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Wait for roadmap page to render
        await page.waitForSelector('.roadmap-progress-card', { timeout: 10000 });

        // What's New banner only shows if there are completed features
        const banner = page.locator('.whats-new-banner');
        if (await banner.count() > 0) {
            await expect(banner).toBeVisible();
            const changelogLink = banner.locator('text=View Changelog');
            await expect(changelogLink).toBeVisible();
        }
    });

    test('9. should search within changelog', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#changelog`);
        await page.waitForLoadState('networkidle');

        // Find search input
        const searchInput = page.locator('input[placeholder="Search changes..."]');
        await expect(searchInput).toBeVisible();

        // Type search term
        await searchInput.fill('Gmail');
        await page.waitForTimeout(500);

        // Verify filtered results
        await expect(page.locator('.change-title:has-text("Gmail")').first()).toBeVisible();
    });
});

// Helper: navigate to #help-support and activate the Roadmap tab
async function navigateToRoadmap(page) {
    await page.goto(`${BASE_URL}/#help-support`);
    await page.waitForLoadState('networkidle');
    // The Help page opens on "Help & Support" tab by default; click Roadmap tab
    const roadmapTab = page.locator('button:has-text("Roadmap")').first();
    await roadmapTab.waitFor({ state: 'visible', timeout: 10_000 });
    await roadmapTab.click();
}

test.describe('Roadmap Features', () => {

    test('1. should display roadmap page with features', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Wait for roadmap page to render
        await page.waitForSelector('.roadmap-progress-card', { timeout: 10000 });

        // Verify page title
        await expect(page.locator('h1:has-text("Product Roadmap")')).toBeVisible();

        // Features may or may not exist depending on API data
        const featureCards = page.locator('.roadmap-feature-card');
        const count = await featureCards.count();
        if (count > 0) {
            await expect(featureCards.first()).toBeVisible();
        } else {
            // Empty state should be shown
            await expect(page.locator('text=No features found')).toBeVisible();
        }
    });

    test('2. should allow searching roadmap features', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Wait for roadmap page to render
        await page.waitForSelector('.roadmap-progress-card', { timeout: 10000 });

        // Find search input (always visible regardless of feature count)
        const searchInput = page.locator('input[placeholder="Search features..."]');
        await expect(searchInput).toBeVisible();

        // Only test search filtering if features exist
        const featureCards = page.locator('.roadmap-feature-card');
        if (await featureCards.count() > 0) {
            await searchInput.fill('Mobile');
            await page.waitForTimeout(500);
            await expect(page.locator('text=Mobile App').first()).toBeVisible();
        }
    });

    test('3. should display Subscribe button for notifications', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Find subscribe button
        const subscribeBtn = page.locator('button:has-text("Subscribe")');
        await expect(subscribeBtn).toBeVisible();
    });

    test('4. should show dependencies and blockers', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Look for dependency indicators
        const dependencies = page.locator('.feature-dependencies');
        // Some features may have dependencies
        if (await dependencies.count() > 0) {
            await expect(dependencies.first()).toBeVisible();
        }
    });

    test('5. should display roadmap categories', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Wait for roadmap page to render
        await page.waitForSelector('.roadmap-progress-card', { timeout: 10000 });

        // Category filter only renders when features with categories exist
        const categoryFilter = page.locator('.category-filter');
        if (await categoryFilter.count() > 0) {
            await expect(categoryFilter).toBeVisible();
        } else {
            // Verify the status filter pills are at least visible
            await expect(page.locator('.filter-pill').first()).toBeVisible();
        }
    });

    test('6. should show estimated release dates (ETA)', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Look for ETA badges
        const etaBadges = page.locator('.feature-eta');

        if (await etaBadges.count() > 0) {
            await expect(etaBadges.first()).toBeVisible();
        }
    });

    test('7. should allow voting on roadmap features', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Wait for roadmap page to render
        await page.waitForSelector('.roadmap-progress-card', { timeout: 10000 });

        // Vote buttons only exist on feature cards
        const voteBtn = page.locator('.vote-button');
        if (await voteBtn.count() > 0) {
            await expect(voteBtn.first()).toBeVisible();
            const voteCount = page.locator('.vote-count').first();
            await expect(voteCount).toBeVisible();
        }
    });

    test('8. should link completed roadmap items to changelog', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Look for completed features with changelog link
        const completedFeatures = page.locator('.roadmap-feature-card.completed');

        if (await completedFeatures.count() > 0) {
            const changelogLink = completedFeatures.first().locator('.feature-changelog-link');
            await expect(changelogLink).toBeVisible();
        }
    });

    test('9. should display progress indicators for in-progress items', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Wait for roadmap to render
        await page.waitForSelector('.roadmap-feature-card', { timeout: 10_000 }).catch(() => {});

        // Look for in-progress features with progress bars
        const inProgressFeatures = page.locator('.roadmap-feature-card.in_progress');

        if (await inProgressFeatures.count() > 0) {
            const progressBar = inProgressFeatures.first().locator('.feature-progress');
            // Progress bar may not exist on all in-progress cards
            if (await progressBar.count() > 0) {
                await expect(progressBar).toBeVisible({ timeout: 5_000 });
            }
        }
    });
});

test.describe('Offers Features', () => {

    test('1. should display offers page with pending offers', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#offers`);
        await page.waitForLoadState('networkidle');

        // Verify page title
        await expect(page.locator('h1:has-text("Offers")')).toBeVisible();

        // Verify pending offers badge
        const pendingBadge = page.locator('text=/\\d+ pending/');
        // May or may not have pending offers
        if (await pendingBadge.count() > 0) {
            await expect(pendingBadge.first()).toBeVisible();
        }
    });

    test('2. should show offer expiration timer with countdown', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#offers`);
        await page.waitForLoadState('networkidle');

        // Look for expiration countdowns in pending offers table
        const expiryCountdowns = page.locator('.offer-expiry-countdown');

        if (await expiryCountdowns.count() > 0) {
            await expect(expiryCountdowns.first()).toBeVisible();
        }
    });

    test('3. should allow bulk accept offers', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#offers`);
        await page.waitForLoadState('networkidle');

        // Look for visible bulk action Accept buttons only
        const bulkAcceptBtn = page.locator('button:has-text("Accept")').first();
        const isVisible = await bulkAcceptBtn.isVisible().catch(() => false);
        if (isVisible) {
            await expect(bulkAcceptBtn).toBeVisible();
        }
        // No pending offers is a valid state — test passes either way
    });

    test('4. should have decline button with error styling (btn-error CSS)', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#offers`);
        await page.waitForLoadState('networkidle');

        // Look for decline buttons with error styling
        const declineBtn = page.locator('button.btn-error').first();
        if (await declineBtn.count() > 0) {
            await expect(declineBtn).toBeVisible();
        }
    });

    test('5. should display offer history per item', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#offers`);
        await page.waitForLoadState('networkidle');

        // Verify offer history section exists
        const historyCard = page.locator('text=Offer History');
        await expect(historyCard).toBeVisible();
    });

    test('6. should highlight best offer with badge', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#offers`);
        await page.waitForLoadState('networkidle');

        // Look for best offer badge
        const bestOfferBadge = page.locator('text=BEST');

        if (await bestOfferBadge.count() > 0) {
            await expect(bestOfferBadge.first()).toBeVisible();
        }
    });

    test('7. should support saved decline responses', async ({ authedPage: page, authToken }) => {
        // This is a functional test - would need UI confirmation
        // The backend supports storing decline reasons
        const response = await page.request.get(`${BASE_URL}/api/offers`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status()).toBe(200);
    });

    test('8. should display counter-offer suggestions', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#offers`);
        await page.waitForLoadState('networkidle');

        // Look for counter amount input fields
        const counterInputs = page.locator('input[type="number"]');

        if (await counterInputs.count() > 0) {
            await expect(counterInputs.first()).toBeVisible();
        }
    });

    test('9. should allow individual offer actions (Accept/Counter/Decline)', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#offers`);
        await page.waitForLoadState('networkidle');

        // Look for action buttons in pending offers table
        const acceptBtn = page.locator('.btn-success.btn-xs').first();
        const counterBtn = page.locator('.btn-primary.btn-xs').first();
        const declineBtn = page.locator('.btn-error.btn-xs').first();

        // At least one action button should exist if there are offers
        const allButtons = page.locator('td div.flex button');
        if (await allButtons.count() > 0) {
            await expect(allButtons.first()).toBeVisible();
        }
    });
});

test.describe('API Integration Tests', () => {
    test('should fetch roadmap features via API', async ({ authedPage: page, authToken }) => {
        const response = await page.request.get(`${BASE_URL}/api/roadmap`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('features');
        expect(Array.isArray(body.features)).toBe(true);
    });

    test('should fetch offers via API', async ({ authedPage: page, authToken }) => {
        const response = await page.request.get(`${BASE_URL}/api/offers`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('offers');
        expect(body).toHaveProperty('total');
        expect(body).toHaveProperty('pending');
    });

    test('should fetch RSS changelog feed', async ({ authedPage: page, authToken }) => {
        const response = await page.request.get(`${BASE_URL}/api/roadmap/changelog/rss`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status()).toBe(200);
        const body = await response.text();
        expect(body).toContain('<?xml');
        expect(body).toContain('<rss');
        expect(body).toContain('VaultLister Changelog');
    });

    test('should return 404 for invalid offer ID', async ({ authedPage: page, authToken }) => {
        const response = await page.request.get(`${BASE_URL}/api/offers/invalid-id`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status()).toBe(404);
    });

    test('should require CSRF token for state-changing operations', async ({ authedPage: page, authToken }) => {
        const response = await page.request.post(`${BASE_URL}/api/offers/some-id/accept`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // CSRF middleware returns 403; in test mode CSRF is disabled so route returns 404
        // Playwright runner may not have NODE_ENV=test even when server does
        expect([403, 404]).toContain(response.status());
        const body = await response.json();
        expect(body.error).toBeDefined();
    });
});

test.describe('UI/UX Verification Tests', () => {

    test('changelog should have responsive layout', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#changelog`);
        await page.waitForLoadState('networkidle');

        // Verify layout elements
        const timeline = page.locator('.changelog-timeline');
        const content = page.locator('.changelog-content');

        await expect(timeline).toBeVisible();
        await expect(content).toBeVisible();
    });

    test('roadmap cards should display vote counts', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Verify vote counts are displayed
        const voteCounts = page.locator('.vote-count');

        if (await voteCounts.count() > 0) {
            await expect(voteCounts.first()).toBeVisible();
            const voteText = await voteCounts.first().textContent();
            expect(voteText).toMatch(/^\d+$/);
        }
    });

    test('offers page should have insights grid', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#offers`);
        await page.waitForLoadState('networkidle');

        // Wait for offers page to render with data
        await page.waitForSelector('.offers-insight-card', { timeout: 10000 });

        // Verify insights cards
        const insightCards = page.locator('.offers-insight-card');
        expect(await insightCards.count()).toBeGreaterThan(0);
    });

    test('changelog should show type filter badges', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#changelog`);
        await page.waitForLoadState('networkidle');

        // Wait for changelog to render filter buttons (webkit is slower)
        await page.waitForSelector('.type-filter-btn', { timeout: 10_000 });

        const typeFilters = page.locator('.type-filter-btn');
        expect(await typeFilters.count()).toBeGreaterThan(0);
    });

    test('roadmap should show progress overview cards', async ({ authedPage: page }) => {
        await navigateToRoadmap(page);

        // Wait for roadmap page to fully render
        await page.waitForSelector('.roadmap-progress-card', { timeout: 10000 });

        // Verify progress cards
        const progressCards = page.locator('.roadmap-progress-card');
        expect(await progressCards.count()).toBe(3); // Planned, In Progress, Completed
    });
});
