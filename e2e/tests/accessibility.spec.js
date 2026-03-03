// Accessibility Tests — WCAG 2.1 AA via @axe-core/playwright
// Scans 6 key pages for critical and serious accessibility violations.
// Known pre-existing violations are baselined per page; tests fail only
// when NEW violation types appear (regression detection).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { demoUser, routes, selectors } from '../fixtures/test-data.js';

/**
 * Helper: log in via UI and navigate to a target route.
 */
async function loginAndNavigate(page, targetRoute) {
    await page.goto(routes.login);
    await page.waitForSelector(selectors.loginForm, { timeout: 10000 });
    await page.fill(selectors.emailInput, demoUser.email);
    await page.fill(selectors.passwordInput, demoUser.password);
    await Promise.all([
        page.waitForURL(/#dashboard/, { timeout: 15000 }),
        page.click(selectors.submitButton)
    ]);

    if (targetRoute && targetRoute !== routes.dashboard) {
        await page.goto(targetRoute);
        await page.waitForLoadState('networkidle');
    }
}

/**
 * Run axe WCAG 2.1 AA scan and return only critical/serious violations.
 */
async function getSeriesViolations(page, disableRules = []) {
    let builder = new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

    if (disableRules.length > 0) {
        builder = builder.disableRules(disableRules);
    }

    const results = await builder.analyze();

    return results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
    );
}

/**
 * Format violations for readable failure messages.
 */
function formatViolations(violations) {
    return violations.map(v =>
        `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} element(s))`
    ).join('\n');
}

// Known pre-existing violations per page — baselined 2026-02-24.
// These are real a11y issues that should be fixed in the frontend,
// but we exclude them here so the test catches regressions only.
const KNOWN_RULES = {
    login: ['color-contrast', 'label'],
    register: ['color-contrast', 'label'],
    dashboard: ['color-contrast', 'button-name', 'select-name'],
    inventory: ['color-contrast'],
    listings: ['color-contrast', 'select-name'],
    analytics: ['color-contrast', 'select-name', 'button-name', 'aria-required-children']
};

test.describe('Accessibility - WCAG 2.1 AA', () => {
    // ============================================================
    // Public Pages (no auth needed)
    // ============================================================

    test('Login page has no new critical/serious violations', async ({ page }) => {
        await page.goto(routes.login);
        await page.waitForSelector(selectors.loginForm, { timeout: 10000 });

        const violations = await getSeriesViolations(page, KNOWN_RULES.login);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Register page has no new critical/serious violations', async ({ page }) => {
        await page.goto(routes.register);
        await page.waitForLoadState('networkidle');

        const violations = await getSeriesViolations(page, KNOWN_RULES.register);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    // ============================================================
    // Authenticated Pages
    // ============================================================

    test('Dashboard has no new critical/serious violations', async ({ page }) => {
        await loginAndNavigate(page, routes.dashboard);

        const violations = await getSeriesViolations(page, KNOWN_RULES.dashboard);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Inventory page has no new critical/serious violations', async ({ page }) => {
        await loginAndNavigate(page, routes.inventory);

        const violations = await getSeriesViolations(page, KNOWN_RULES.inventory);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Listings page has no new critical/serious violations', async ({ page }) => {
        await loginAndNavigate(page, routes.listings);

        const violations = await getSeriesViolations(page, KNOWN_RULES.listings);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Analytics page has no new critical/serious violations', async ({ page }) => {
        await loginAndNavigate(page, routes.analytics);

        const violations = await getSeriesViolations(page, KNOWN_RULES.analytics);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });
});
