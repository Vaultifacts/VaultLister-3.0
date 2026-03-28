// e2e/helpers/test-isolation.js
// Data cleanup helpers and strict locking for E2E test isolation
import { acquireTestLock, releaseTestLock } from './test-lock.js';

const BASE = `http://localhost:${process.env.PORT || 3001}`;

/**
 * Clean up test data by prefix name pattern.
 * Deletes all inventory items whose name starts with the given prefix.
 * Call in beforeEach/afterEach to prevent test pollution.
 */
export async function cleanupInventoryByPrefix(token, namePrefix) {
    if (!token) return;
    try {
        const res = await fetch(`${BASE}/api/inventory?limit=200`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const items = data.items || data.inventory || data.data || [];
        const matching = items.filter(i => (i.name || i.title || '').startsWith(namePrefix));
        for (const item of matching) {
            await fetch(`${BASE}/api/inventory/${item.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            }).catch(() => {});
        }
    } catch (_) {}
}

/**
 * Delete a single resource by ID and endpoint.
 * @param {string} token - Auth token
 * @param {string} endpoint - API endpoint path (e.g., '/api/inventory')
 * @param {string} id - Resource ID to delete
 */
export async function cleanupById(token, endpoint, id) {
    if (!token || !id) return;
    try {
        await fetch(`${BASE}${endpoint}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    } catch (_) {}
}

/**
 * Delete all resources by ID list.
 * @param {string} token
 * @param {string} endpoint
 * @param {string[]} ids
 */
export async function cleanupByIds(token, endpoint, ids = []) {
    for (const id of ids) {
        await cleanupById(token, endpoint, id);
    }
}

/**
 * Reset page state between tests — clears storage and cookies.
 * Call in beforeEach on the Playwright page.
 * @param {import('@playwright/test').Page} page
 */
export async function resetPageState(page) {
    await page.context().clearCookies();
    await page.evaluate(() => {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (_) {}
    }).catch(() => {});
}

/**
 * Acquire a file-system lock before running exclusive E2E tests.
 * Returns false if lock is held by another process — test should skip.
 * Call in test.beforeAll; release in test.afterAll.
 *
 * @returns {boolean} true if lock acquired, false if blocked
 */
export function acquireExclusiveLock() {
    return acquireTestLock();
}

/**
 * Release the exclusive E2E test lock.
 */
export function releaseExclusiveLock() {
    releaseTestLock();
}

/**
 * Seed a test inventory item via API and return the created item.
 * All seeded items are prefixed with 'E2E_' for easy cleanup.
 * @param {string} token
 * @param {Object} overrides
 * @returns {Promise<Object>}
 */
export async function seedTestInventoryItem(token, overrides = {}) {
    const ts = Date.now();
    const item = {
        name: `E2E_Item_${ts}`,
        sku: `E2E-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        purchase_price: '10.00',
        listing_price: '25.00',
        quantity: 1,
        status: 'active',
        ...overrides,
    };
    const res = await fetch(`${BASE}/api/inventory`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(item),
    });
    if (!res.ok) return null;
    return res.json();
}
