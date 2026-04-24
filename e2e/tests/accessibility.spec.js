// Accessibility Tests — WCAG 2.1 AA via @axe-core/playwright
// Scans 6 key pages for critical and serious accessibility violations.
// Known pre-existing violations are baselined per page; tests fail only
// when NEW violation types appear (regression detection).
import { test, expect } from '../fixtures/auth.js';
import AxeBuilder from '@axe-core/playwright';
import { demoUser, routes, selectors } from '../fixtures/test-data.js';

/**
 * Helper: navigate to a target route (auth already injected by authedPage fixture).
 */
async function loginAndNavigate(page, targetRoute) {
    if (targetRoute && targetRoute !== routes.dashboard) {
        await page.goto(targetRoute);
        await page.waitForLoadState('domcontentloaded');
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
// scrollable-region-focusable added 2026-04-24 (pre-existing overflow divs/table-containers, not caused by BS-3).
// These are real a11y issues that should be fixed in the frontend,
// but we exclude them here so the test catches regressions only.
const KNOWN_RULES = {
    login: ['color-contrast', 'label'],
    register: ['color-contrast', 'label'],
    dashboard: ['color-contrast', 'button-name', 'select-name', 'scrollable-region-focusable'],
    inventory: ['color-contrast', 'select-name'],
    listings: ['color-contrast', 'select-name'],
    analytics: ['color-contrast', 'select-name', 'button-name', 'aria-required-children', 'scrollable-region-focusable'],
    settings: ['color-contrast', 'label', 'select-name'],
    billing: ['color-contrast', 'button-name', 'scrollable-region-focusable'],
    shops: ['color-contrast', 'select-name'],
    automations: ['color-contrast', 'select-name', 'button-name', 'scrollable-region-focusable'],
};

test.describe('Accessibility - WCAG 2.1 AA', () => {
    test.setTimeout(90_000);
    // ============================================================
    // Public Pages (no auth needed)
    // ============================================================

    test('Login page has no new critical/serious violations', async ({ authedPage: page }) => {
        await page.goto(routes.login);
        await page.waitForSelector(selectors.loginForm, { timeout: 10000 });

        const violations = await getSeriesViolations(page, KNOWN_RULES.login);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Register page has no new critical/serious violations', async ({ authedPage: page }) => {
        await page.goto(routes.register);
        await page.waitForLoadState('domcontentloaded');

        const violations = await getSeriesViolations(page, KNOWN_RULES.register);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    // ============================================================
    // Authenticated Pages
    // ============================================================

    test('Dashboard has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, routes.dashboard);

        const violations = await getSeriesViolations(page, KNOWN_RULES.dashboard);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Inventory page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, routes.inventory);

        const violations = await getSeriesViolations(page, KNOWN_RULES.inventory);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Listings page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, routes.listings);

        const violations = await getSeriesViolations(page, KNOWN_RULES.listings);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Analytics page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, routes.analytics);

        const violations = await getSeriesViolations(page, KNOWN_RULES.analytics);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Settings page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, routes.settings);

        const violations = await getSeriesViolations(page, KNOWN_RULES.settings);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Billing page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, `${routes.dashboard.replace('#dashboard', '')}#billing`);

        const violations = await getSeriesViolations(page, KNOWN_RULES.billing);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Shops page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, routes.shops);

        const violations = await getSeriesViolations(page, KNOWN_RULES.shops);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Automations page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, routes.automations);

        const violations = await getSeriesViolations(page, KNOWN_RULES.automations);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Offers page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, routes.offers);

        const violations = await getSeriesViolations(page, ['color-contrast', 'select-name', 'button-name', 'scrollable-region-focusable']);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Sales page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, routes.sales);

        const violations = await getSeriesViolations(page, ['color-contrast', 'select-name', 'scrollable-region-focusable']);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Image Bank page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, routes.imageBank);

        const violations = await getSeriesViolations(page, ['color-contrast', 'button-name']);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Reports page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, `${routes.dashboard.replace('#dashboard', '')}#reports`);

        const violations = await getSeriesViolations(page, ['color-contrast', 'select-name']);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test('Plans & Billing page has no new critical/serious violations', async ({ authedPage: page }) => {
        await loginAndNavigate(page, `${routes.dashboard.replace('#dashboard', '')}#plans-billing`);

        const violations = await getSeriesViolations(page, ['color-contrast', 'button-name', 'scrollable-region-focusable']);
        expect(violations, formatViolations(violations)).toHaveLength(0);
    });
});
