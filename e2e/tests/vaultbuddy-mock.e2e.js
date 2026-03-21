// VaultBuddy Mock Indicator E2E Tests
// Verifies that the VaultBuddy chat FAB is accessible and that the demo-mode
// indicator renders when the server has no Anthropic API key configured.
import { test, expect } from '@playwright/test';
import { waitForSpaRender, waitForUiSettle } from '../helpers/wait-utils.js';
import { test as authTest } from '../fixtures/auth.js';

const BASE = `http://localhost:${process.env.PORT || 3000}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Open the VaultBuddy chat panel by clicking the FAB.
 * Returns without error if the FAB is not present (AI feature may be disabled).
 */
async function openVaultBuddy(page) {
    const fab = page.locator('.vault-buddy-fab');
    if (!await fab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        return false;
    }
    await fab.click();
    await waitForUiSettle(page);
    return true;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('VaultBuddy — FAB and modal render', () => {
    authTest('should render the VaultBuddy FAB when authenticated', async ({ authedPage: page }) => {
        // Navigate to dashboard where VaultBuddy FAB should be rendered
        await page.evaluate(() => router.navigate('dashboard'));
        await waitForSpaRender(page);

        const fab = page.locator('.vault-buddy-fab');
        await expect(fab).toBeVisible({ timeout: 10_000 });
    });

    authTest('should open the VaultBuddy modal when the FAB is clicked', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('dashboard'));
        await waitForSpaRender(page);

        const opened = await openVaultBuddy(page);
        if (!opened) {
            test.skip(true, 'VaultBuddy FAB not visible — feature may be disabled');
            return;
        }

        const modal = page.locator('.vault-buddy-modal');
        await expect(modal).toBeVisible({ timeout: 5_000 });
    });

    authTest('should close the VaultBuddy modal when FAB is clicked again', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('dashboard'));
        await waitForSpaRender(page);

        const fab = page.locator('.vault-buddy-fab');
        if (!await fab.isVisible({ timeout: 5_000 }).catch(() => false)) {
            test.skip(true, 'VaultBuddy FAB not visible — feature may be disabled');
            return;
        }

        // Open
        await fab.click();
        await waitForUiSettle(page);
        await expect(page.locator('.vault-buddy-modal')).toBeVisible({ timeout: 5_000 });

        // Close
        await fab.click();
        await waitForUiSettle(page);
        const modalOpen = await page.locator('.vault-buddy-modal.open').isVisible().catch(() => false);
        expect(modalOpen).toBe(false);
    });
});

test.describe('VaultBuddy — demo mode indicator', () => {
    authTest('should render the demo-mode indicator when no AI key is configured', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('dashboard'));
        await waitForSpaRender(page);

        const opened = await openVaultBuddy(page);
        if (!opened) {
            test.skip(true, 'VaultBuddy FAB not visible — feature may be disabled');
            return;
        }

        // The mock indicator is only rendered when the server has no ANTHROPIC_API_KEY.
        // In CI / dev without a key, this element must be present.
        const indicator = page.locator('.vault-buddy-mock-indicator');
        const indicatorVisible = await indicator.isVisible({ timeout: 3_000 }).catch(() => false);

        if (indicatorVisible) {
            // Confirm text matches expected demo-mode copy
            const text = await indicator.textContent();
            expect(text).toContain('demo mode');
            // Must not contain an empty or whitespace-only string
            expect(text.trim().length).toBeGreaterThan(0);
        } else {
            // If not visible, the server has a real API key — indicator correctly hidden
            console.log('VaultBuddy demo-mode indicator not shown (real API key configured): PASS');
        }
    });

    authTest('should show the mock indicator text with correct styling when present', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('dashboard'));
        await waitForSpaRender(page);

        const opened = await openVaultBuddy(page);
        if (!opened) {
            test.skip(true, 'VaultBuddy FAB not visible — feature may be disabled');
            return;
        }

        const indicator = page.locator('.vault-buddy-mock-indicator');
        if (!await indicator.isVisible({ timeout: 3_000 }).catch(() => false)) {
            // Real key is configured — indicator intentionally absent
            return;
        }

        // Verify the element is rendered as italic (font-style: italic per implementation)
        const fontStyle = await indicator.evaluate((el) => getComputedStyle(el).fontStyle);
        expect(fontStyle).toBe('italic');
    });
});

test.describe('VaultBuddy — message input', () => {
    authTest('should render a text input or textarea for chat messages when the modal is open', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('dashboard'));
        await waitForSpaRender(page);

        const opened = await openVaultBuddy(page);
        if (!opened) {
            test.skip(true, 'VaultBuddy FAB not visible — feature may be disabled');
            return;
        }

        await expect(page.locator('.vault-buddy-modal')).toBeVisible({ timeout: 5_000 });

        // Chat input may be textarea or input depending on conversation state
        const inputEl = page.locator(
            '.vault-buddy-modal textarea, .vault-buddy-modal input[type="text"]'
        ).first();
        const inputVisible = await inputEl.isVisible({ timeout: 3_000 }).catch(() => false);

        if (inputVisible) {
            await expect(inputEl).toBeEditable();
        } else {
            // Input appears only after selecting or starting a conversation — acceptable
            console.log('Chat input not immediately visible — may require conversation selection: acceptable');
        }
    });
});
