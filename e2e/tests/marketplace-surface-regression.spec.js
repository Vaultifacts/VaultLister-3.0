import { test, expect } from '../fixtures/auth.js';
import { waitForSpaRender, waitForUiSettle } from '../helpers/wait-utils.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;
const LIVE_MARKETPLACES = [
    'Poshmark (U.S)',
    'eBay (U.S)',
    'Depop (U.S)',
    'Shopify (CA)',
    'Facebook Marketplace',
    'Whatnot'
];
const COMING_SOON_MARKETPLACES = [
    'Mercari (U.S)',
    'Grailed (CA)',
    'Etsy (CA)',
    'Kijiji (CA)',
    'Vinted (U.S)'
];

async function readConnectionsMarketplaceState(page) {
    return page.evaluate(() => {
        const connectionsCard = [...document.querySelectorAll('.card')].find((card) => {
            const title = card.querySelector('.card-title');
            return title && title.textContent.includes('Marketplace Connections');
        });
        if (!connectionsCard) return null;

        const body = connectionsCard.querySelector('.card-body');
        const liveGrid = [...body.children].find((child) => child.classList?.contains('grid'));
        const comingSoonSection = [...body.children].find((child) => child.textContent.includes('Coming Soon') && child.querySelector('.grid'));
        const comingSoonGrid = comingSoonSection?.querySelector('.grid');
        const readRows = (grid) => {
            if (!grid) return [];
            return [...grid.children].map((row) => ({
                label: row.querySelector('.font-medium')?.textContent?.trim() || '',
                action: row.querySelector('button')?.textContent?.trim() || '',
                disabled: Boolean(row.querySelector('button')?.disabled)
            }));
        };

        return {
            live: readRows(liveGrid),
            comingSoon: readRows(comingSoonGrid)
        };
    });
}

async function readSettingsIntegrationsState(page) {
    return page.evaluate(() => {
        const settingsSection = [...document.querySelectorAll('.settings-section')].find((section) => {
            const title = section.querySelector('.settings-section-title');
            return title && title.textContent.includes('Connected Platforms');
        });
        if (!settingsSection) return null;

        const liveGrid = settingsSection.querySelector('.integrations-grid');
        const comingSoonSection = [...settingsSection.children].find((child) => child.textContent.includes('Coming Soon') && child.querySelector('.integrations-grid'));
        const comingSoonGrid = comingSoonSection?.querySelector('.integrations-grid');
        const readCards = (grid) => {
            if (!grid) return [];
            return [...grid.querySelectorAll('.integration-card')].map((card) => ({
                label: card.querySelector('h5')?.textContent?.trim() || '',
                action: card.querySelector('button')?.textContent?.trim() || '',
                disabled: Boolean(card.querySelector('button')?.disabled)
            }));
        };

        return {
            live: readCards(liveGrid),
            comingSoon: readCards(comingSoonGrid)
        };
    });
}

function assertMarketplaceState(state) {
    expect(state).not.toBeNull();
    expect(state.live.map((entry) => entry.label)).toEqual(LIVE_MARKETPLACES);
    expect(state.comingSoon.map((entry) => entry.label)).toEqual(COMING_SOON_MARKETPLACES);

    for (const entry of state.live) {
        expect(['Connect', 'Manage']).toContain(entry.action);
        expect(entry.action).not.toBe('Coming Soon');
    }

    for (const entry of state.comingSoon) {
        expect(entry.action).toBe('Coming Soon');
        expect(entry.disabled).toBe(true);
    }
}

test('connections page shows canonical marketplace labels and launch grouping', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/#connections`);
    await page.waitForURL(/#connections$/, { timeout: 15000 });
    await expect(page.locator('.page-title', { hasText: 'Connections' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.card-title', { hasText: 'Marketplace Connections' })).toBeVisible({ timeout: 10000 });
    await waitForSpaRender(page);
    await waitForUiSettle(page);

    const marketplaceState = await readConnectionsMarketplaceState(page);
    assertMarketplaceState(marketplaceState);
});

test('settings integrations tab shows canonical marketplace labels and launch grouping', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/#settings/integrations`);
    await page.waitForURL(/#settings\/integrations$/, { timeout: 15000 });
    await page.waitForSelector('.settings-tabs', { timeout: 10000 });
    await waitForSpaRender(page);
    await waitForUiSettle(page);

    const marketplaceState = await readSettingsIntegrationsState(page);
    assertMarketplaceState(marketplaceState);
    await expect(page.locator('.settings-tab.active', { hasText: 'Integrations' })).toBeVisible({ timeout: 10000 });
});
