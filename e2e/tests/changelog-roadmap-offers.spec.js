import { test, expect } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;

async function openPublicChangelog(page) {
    await page.goto(`${BASE_URL}/changelog.html`);
    await expect(page).toHaveURL(/\/changelog\.html$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible();
    await expect(page.locator('#changelog-search')).toBeVisible();
}

async function openPublicRoadmap(page) {
    await page.goto(`${BASE_URL}/roadmap-public.html`);
    await expect(page).toHaveURL(/\/roadmap-public\.html$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Product Roadmap' })).toBeVisible();
    await expect(page.locator('.roadmap-kanban')).toBeVisible();
}

async function openOffers(page) {
    await page.goto(`${BASE_URL}/#offers`);
    await expect(page.getByRole('heading', { level: 1, name: 'Offers' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.offers-insights-grid')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Offer History' })).toBeVisible();
}

test.describe('Public Changelog Smoke', () => {
    test('renders the current changelog controls and release timeline', async ({ authedPage: page }) => {
        await openPublicChangelog(page);

        const filterButtons = page.locator('.filter-btn');
        await expect(filterButtons).toHaveCount(5);
        await expect(page.locator('#results-meta')).toContainText('Showing all releases');

        const releaseCount = await page.locator('article.release').count();
        expect(releaseCount).toBeGreaterThanOrEqual(5);

        const firstRelease = page.locator('article.release').first();
        await expect(firstRelease.locator('.release-meta .release-version')).toHaveText('v1.7.0');
        await expect(firstRelease.locator('.release-meta .release-date')).toContainText('April 2026');
        await expect(firstRelease.locator('.badge-latest')).toContainText('Latest');
    });

    test('search narrows the visible releases to the matching version rail', async ({ authedPage: page }) => {
        await openPublicChangelog(page);

        await page.locator('#changelog-search').fill('v1.5.0');

        const visibleReleases = page.locator('article.release:visible');
        await expect(visibleReleases).toHaveCount(1);
        await expect(visibleReleases.first().locator('.release-version')).toHaveText('v1.5.0');
        await expect(page.locator('#results-meta')).toContainText('matching "v1.5.0"');
    });

    test('security filter only leaves security-tagged change rows visible', async ({ authedPage: page }) => {
        await openPublicChangelog(page);

        await page.getByRole('button', { name: 'Security' }).click();

        const visibleBadgeTexts = await page.locator('article.release:visible .change-item:visible .badge:visible').allTextContents();
        expect(visibleBadgeTexts.length).toBeGreaterThan(0);
        expect(visibleBadgeTexts.every((text) => text.trim().toLowerCase() === 'security')).toBe(true);
        await expect(page.locator('#results-meta')).toContainText('filtered by security');
    });

    test('RSS feed endpoint still returns the changelog XML', async ({ authedPage: page, authToken }) => {
        const response = await page.request.get(`${BASE_URL}/api/roadmap/changelog/rss`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status()).toBe(200);
        const body = await response.text();
        expect(body).toContain('<?xml');
        expect(body).toContain('<rss');
        expect(body).toContain('VaultLister Changelog');
    });
});

test.describe('Public Roadmap Smoke', () => {
    test('renders the shipped public roadmap board', async ({ authedPage: page }) => {
        await openPublicRoadmap(page);

        const phaseHeadings = await page.locator('.roadmap-phase h2').allTextContents();
        expect(phaseHeadings).toEqual([
            'Feature Requests',
            'Coming Soon',
            'Currently Building',
            'Released Features'
        ]);
    });

    test('includes the feature-request CTA and all roadmap status lanes', async ({ authedPage: page }) => {
        await openPublicRoadmap(page);

        const requestLink = page.locator('.roadmap-phase a[href="/request-feature.html"]').first();
        await expect(requestLink).toBeVisible();
        await expect(requestLink).toContainText('Submit a feature request');

        const plannedCount = await page.locator('.roadmap-item.planned').count();
        const progressCount = await page.locator('.roadmap-item.progress').count();
        const shippedCount = await page.locator('.roadmap-item.shipped').count();

        expect(plannedCount).toBeGreaterThan(0);
        expect(progressCount).toBeGreaterThan(0);
        expect(shippedCount).toBeGreaterThan(0);
    });

    test('shows the current in-progress and shipped roadmap items', async ({ authedPage: page }) => {
        await openPublicRoadmap(page);

        await expect(page.locator('.roadmap-item.progress .item-title').filter({ hasText: 'EasyPost shipping integration' })).toBeVisible();
        await expect(page.locator('.roadmap-item.shipped .item-title').filter({ hasText: 'Offer management' })).toBeVisible();
        await expect(page.locator('.roadmap-item.shipped .item-title').filter({ hasText: 'Analytics dashboard' })).toBeVisible();
    });
});

test.describe('Offers UI Smoke', () => {
    test('renders the offers hero, insight cards, and filters', async ({ authedPage: page }) => {
        await openOffers(page);

        await expect(page.locator('.offers-insight-card')).toHaveCount(4);
        await expect(page.locator('.offers-toolbar select')).toHaveCount(2);
        await expect(page.getByRole('button', { name: /Item History/ })).toBeVisible();
    });

    test('opens the item-history modal from the offers page', async ({ authedPage: page }) => {
        await openOffers(page);

        await page.getByRole('button', { name: /Item History/ }).click();
        await expect(page.locator('.modal .modal-title')).toContainText('Offer History by Item');
    });

    test('keeps the offers page free of bootstrap error headings', async ({ authedPage: page }) => {
        await openOffers(page);

        await expect(page.getByRole('heading', { name: 'Page Error' })).toHaveCount(0);

        const pageText = await page.locator('body').innerText();
        expect(pageText).not.toContain('Failed to load offers');
    });
});

test.describe('Route API Contracts', () => {
    test('offers API still returns the current contract shape', async ({ authedPage: page, authToken }) => {
        const response = await page.request.get(`${BASE_URL}/api/offers`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body.offers)).toBe(true);
        expect(typeof body.total).toBe('number');
        expect(typeof body.pending).toBe('number');
    });

    test('roadmap API still returns a features array', async ({ authedPage: page, authToken }) => {
        const response = await page.request.get(`${BASE_URL}/api/roadmap`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body.features)).toBe(true);
    });
});
