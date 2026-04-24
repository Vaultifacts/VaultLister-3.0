
// Mobile audit E2E test — runs on BrowserStack real devices at 390px.
// All 9 VaultLister pages tested in a SINGLE session (BrowserStack CDP closes on disconnect).
// Uses page.route() to mock API calls + sessionStorage fake session for auth.
//
// Run: bun run test:mobile-audit
// Results: playwright-report/browserstack/

import { test, expect } from '@playwright/test';

const LIVE_URL = process.env.VAULTLISTER_URL || 'https://vaultlister-app-production.up.railway.app';

const PAGES = [
    { hash: 'dashboard',    name: 'Dashboard' },
    { hash: 'inventory',    name: 'Inventory' },
    { hash: 'cross-lister', name: 'Cross-Lister' },
    { hash: 'automations',  name: 'Automations' },
    { hash: 'analytics',    name: 'Analytics' },
    { hash: 'sales',        name: 'Sales' },
    { hash: 'offers',       name: 'Offers' },
    { hash: 'image-bank',   name: 'Image Bank' },
    { hash: 'settings',     name: 'Settings' },
];

async function injectFakeSession(page) {
    await page.evaluate(() => {
        const state = JSON.stringify({
            user: { id: 'demo', username: 'demo', email: 'demo@vaultlister.com', role: 'admin' },
            token: 'fake',
            refreshToken: 'fake',
            isAuthenticated: true,
            useSessionStorage: true,
        });
        try { sessionStorage.setItem('vaultlister_state', state); } catch {}
        if (typeof store !== 'undefined' && store.setState) {
            store.setState({
                user: { id: 'demo', username: 'demo', email: 'demo@vaultlister.com', role: 'admin' },
                token: 'fake',
                refreshToken: 'fake',
                isAuthenticated: true,
            });
        }
    });
}

async function navigateToPage(page, hash) {
    await page.evaluate((h) => {
        if (typeof router !== 'undefined' && router.navigate) {
            router.navigate(h);
        } else {
            window.location.hash = h;
        }
    }, hash);
    await page.waitForTimeout(800);
}

// Single test = single BrowserStack session covering all 9 pages.
// BrowserStack CDP closes the connection when the test ends — running
// multiple test() functions would open a new session each time, which fails
// because the previous CDP endpoint is already closed.
test('full mobile audit — all 9 pages', async ({ page }) => {
    // Mock all API calls so pages render without real backend.
    await page.route('**/api/**', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [], items: [], total: 0, listings: [], sales: [] }),
    }));

    // Step 1: Navigate to base URL — always works on BrowserStack iOS (loads landing page).
    // Direct goto to /?app=1 or ?app fails (BrowserStack iOS returns about:blank for URLs
    // with path/query). Starting from the base URL is the reliable entry point.
    await page.goto(LIVE_URL);
    await page.waitForLoadState('load', { timeout: 60000 });

    // Step 2: Client-side navigate to /?app=1 from within the page.
    // window.location.href assignment works reliably where page.goto with a path does not.
    await page.evaluate((url) => { window.location.href = url + '/?app=1'; }, LIVE_URL);
    await page.waitForLoadState('load', { timeout: 60000 });
    // Give the SPA bundle extra time to download and execute on real device (slow 4G).
    await page.waitForTimeout(6000);
    await injectFakeSession(page);
    await navigateToPage(page, 'dashboard');
    await page.waitForSelector('.sidebar, .mobile-header', { timeout: 10000 }).catch(() => {});

    // Diagnostic: log what the page actually looks like after setup
    const setupDiag = await page.evaluate(() => {
        const qsLinks = Array.from(document.querySelectorAll('a'))
            .filter(a => a.textContent.trim() === 'Quickstart' || a.href.includes('quickstart'));
        return {
            innerWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            hash: location.hash,
            href: location.href,
            hasSidebar: !!document.querySelector('.sidebar'),
            hasMobileHeader: !!document.querySelector('.mobile-header'),
            hasLoginForm: !!document.querySelector('#login-form, .login-form, [data-page="login"]'),
            bodyClasses: document.body.className.slice(0, 100),
            title: document.title,
            hasStore: typeof window.store !== 'undefined',
            hasRenderApp: typeof window.renderApp !== 'undefined',
            appDivContent: (document.getElementById('app') || {}).innerHTML?.slice(0, 200) || 'NO #app',
            quickstartLinks: qsLinks.map(a => ({ href: a.href, parentCls: a.closest('[class]')?.className?.slice(0,60) })),
            bodySnippet: document.body.innerHTML.slice(0, 300),
        };
    });
    console.log('SETUP DIAGNOSTIC:', JSON.stringify(setupDiag));

    const findings = [];

    for (const { hash, name } of PAGES) {
        await injectFakeSession(page);
        await navigateToPage(page, hash);
        await page.screenshot({
            path: `e2e/screenshots/mobile-audit/${hash}.png`,
            fullPage: false,
        }).catch(() => {});

        // 1. No horizontal overflow
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        if (scrollWidth > 400) {
            findings.push({ page: name, check: 'horizontal overflow', value: `scrollWidth=${scrollWidth}px` });
        }

        // 2. Desktop header hidden
        const headerDisplay = await page.evaluate(() => {
            const el = document.querySelector('.header');
            return el ? getComputedStyle(el).display : 'not-found';
        });
        if (headerDisplay !== 'none' && headerDisplay !== 'not-found') {
            findings.push({ page: name, check: 'desktop header visible', value: `display=${headerDisplay}` });
        }

        // 3. iOS zoom-risk inputs
        const riskInputs = await page.evaluate(() =>
            Array.from(document.querySelectorAll('input, select, textarea'))
                .filter(el => parseFloat(getComputedStyle(el).fontSize) < 16)
                .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 40), fs: getComputedStyle(el).fontSize }))
        );
        if (riskInputs.length > 0) {
            findings.push({ page: name, check: 'iOS zoom-risk inputs', value: JSON.stringify(riskInputs) });
        }

        // 4. Touch targets < 44×44px
        const smallTargets = await page.evaluate(() =>
            Array.from(document.querySelectorAll('button, a, [role="button"]'))
                .filter(el => {
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && (r.width < 44 || r.height < 44);
                })
                .map(el => ({
                    text: el.textContent.trim().slice(0, 40),
                    w: Math.round(el.getBoundingClientRect().width),
                    h: Math.round(el.getBoundingClientRect().height),
                }))
        );
        if (smallTargets.length > 0) {
            findings.push({ page: name, check: 'touch targets < 44px', value: `${smallTargets.length} targets: ${JSON.stringify(smallTargets.slice(0, 5))}` });
        }
    }

    // Dashboard: widget grid should be 2-column
    await injectFakeSession(page);
    await navigateToPage(page, 'dashboard');
    const gridCols = await page.evaluate(() => {
        const c = document.querySelector('.dashboard-widgets-container');
        return c ? getComputedStyle(c).gridTemplateColumns : 'container not found';
    });
    const trackCount = gridCols === 'container not found' ? 0 : gridCols.trim().split(/\s+(?=\d|\()/).length;
    if (trackCount !== 2) {
        findings.push({ page: 'Dashboard', check: 'widget grid not 2-column', value: `tracks=${trackCount} cols="${gridCols}"` });
    }

    // Analytics: tab bar must not overflow
    await injectFakeSession(page);
    await navigateToPage(page, 'analytics');
    const tabOverflow = await page.evaluate(() => {
        const bar = document.querySelector('.analytics-tabs, [class*="analytics"][class*="tab"]');
        if (!bar) return null;
        return { scrollWidth: bar.scrollWidth, clientWidth: bar.clientWidth, overflows: bar.scrollWidth > bar.clientWidth };
    });
    if (tabOverflow && tabOverflow.overflows) {
        findings.push({ page: 'Analytics', check: 'tab bar overflow', value: `scrollWidth=${tabOverflow.scrollWidth}px clientWidth=${tabOverflow.clientWidth}px` });
    }

    // Print all findings to console for report writing
    if (findings.length > 0) {
        console.log('\n=== MOBILE AUDIT FINDINGS ===');
        for (const f of findings) {
            console.log(`[${f.page}] ${f.check}: ${f.value}`);
        }
        console.log(`=== TOTAL: ${findings.length} findings ===\n`);
    } else {
        console.log('\n=== MOBILE AUDIT: 0 findings — all checks passed ===\n');
    }

    // Soft-assert: test passes but records findings in output.
    // Review console output above for VERIFIED issues.
    expect.soft(findings.length, `Mobile audit findings:\n${findings.map(f => `  [${f.page}] ${f.check}: ${f.value}`).join('\n')}`).toBe(0);
});
