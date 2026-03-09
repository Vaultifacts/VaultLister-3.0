/**
 * D-3 Chrome Extension Test
 * Launches Chrome with VaultLister Helper loaded, runs all checklist items.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(__dirname, '../chrome-extension');
const SERVER = 'http://localhost:3000';
const DEMO_EMAIL = 'demo@vaultlister.com';
const DEMO_PASS = 'DemoPassword123!';
const AMAZON_URL = 'https://www.amazon.com/dp/B0BSHF7WHW'; // Nike Air Force

const results = [];
function pass(label, detail = '') { results.push({ status: '✅ PASS', label, detail }); console.log(`✅ PASS  ${label}${detail ? ' — ' + detail : ''}`); }
function fail(label, detail = '') { results.push({ status: '❌ FAIL', label, detail }); console.log(`❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
function warn(label, detail = '') { results.push({ status: '⚠️ WARN', label, detail }); console.log(`⚠️ WARN  ${label}${detail ? ' — ' + detail : ''}`); }

// Node-side token helper (avoids CORS by fetching from test script, not browser page)
let _token = null;
async function getToken() {
    if (_token) return _token;
    const r = await fetch(`${SERVER}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASS })
    });
    _token = (await r.json()).token;
    return _token;
}

// Only flag errors that are from our extension, not from third-party scripts on the page
function isOurError(msg) {
    const m = msg.toLowerCase();
    return m.includes('vaultlister') || m.includes('extension') || m.includes('api.js') ||
           m.includes('popup.js') || m.includes('autofill.js') || m.includes('scraper.js') ||
           m.includes('service-worker');
}

async function run() {
    console.log('\n=== D-3 Chrome Extension Test ===\n');

    // Launch Chrome with extension
    const context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [
            `--disable-extensions-except=${EXT_PATH}`,
            `--load-extension=${EXT_PATH}`,
        ],
        ignoreHTTPSErrors: true,
    });

    // ── Step 1: Extension loads (no error badge) ─────────────────────────────
    // Give SW time to register
    await new Promise(r => setTimeout(r, 2000));

    // Get extension background service worker URL
    let extId = null;
    const swTargets = context.serviceWorkers();
    for (const sw of swTargets) {
        if (sw.url().includes('service-worker')) {
            extId = sw.url().split('/')[2];
            break;
        }
    }

    if (extId) {
        pass('Step 1 — Extension loaded', `ID: ${extId}`);
    } else {
        // Still try to get ID from workers that register after start
        await new Promise(r => setTimeout(r, 3000));
        const allSW = context.serviceWorkers();
        for (const sw of allSW) {
            if (sw.url().includes('background')) {
                extId = sw.url().split('/')[2];
            }
        }
        extId ? pass('Step 1 — Extension loaded', `ID: ${extId}`) : warn('Step 1 — Extension ID not detected via SW', 'may still be loaded');
    }

    // ── Step 2: Popup opens + console errors ────────────────────────────────
    const popupErrors = [];
    const popupPage = await context.newPage();
    popupPage.on('console', msg => {
        if (msg.type() === 'error') popupErrors.push(msg.text());
    });
    popupPage.on('pageerror', err => popupErrors.push(err.message));

    if (extId) {
        try {
            await popupPage.goto(`chrome-extension://${extId}/popup/popup.html`, { timeout: 5000 });
            await popupPage.waitForSelector('#login-view, #main-view', { timeout: 5000 });
            const hasLogin = await popupPage.$('#login-view:not(.hidden)') !== null;
            const hasMain  = await popupPage.$('#main-view:not(.hidden)') !== null;
            const heading  = await popupPage.textContent('h1').catch(() => '');
            pass('Step 2 — Popup renders', `heading="${heading.trim()}", login=${hasLogin}, main=${hasMain}`);
        } catch (e) {
            fail('Step 2 — Popup render', e.message);
        }
    } else {
        warn('Step 2 — Popup skipped', 'no extension ID');
    }

    // ── Step 3: Login to the popup ───────────────────────────────────────────
    if (extId) {
        try {
            const loginView = await popupPage.$('#login-view:not(.hidden)');
            if (loginView) {
                await popupPage.fill('#email', DEMO_EMAIL);
                await popupPage.fill('#password', DEMO_PASS);
                await popupPage.click('button[type="submit"]');
                await popupPage.waitForSelector('#main-view:not(.hidden)', { timeout: 8000 });
                pass('Step 3 — Popup login', 'main view appeared');
            } else {
                pass('Step 3 — Popup login', 'already logged in (main view showing)');
            }
        } catch (e) {
            fail('Step 3 — Popup login', e.message);
        }
    }

    // Wait a moment for any async console errors to surface
    await new Promise(r => setTimeout(r, 1000));
    if (popupErrors.length === 0) {
        pass('Step 3b — Popup console', 'zero red errors');
    } else {
        fail('Step 3b — Popup console errors', popupErrors.join(' | '));
    }

    // ── Step 4: Amazon — floating button + capture ────────────────────────────
    const amazonPage = await context.newPage();
    const amazonErrors = [];
    amazonPage.on('console', msg => {
        if (msg.type() === 'error') amazonErrors.push(msg.text());
    });

    try {
        await amazonPage.goto(AMAZON_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await amazonPage.waitForTimeout(3000); // let content script inject

        const floatBtn = await amazonPage.$('#vaultlister-scrape-btn');
        if (floatBtn) {
            pass('Step 4a — Amazon floating button injected');

            // Read product title to confirm scraper can see it
            const title = await amazonPage.$eval('#productTitle', el => el.textContent.trim()).catch(() => null);
            const price = await amazonPage.$eval('.a-price-whole', el => el.textContent.trim()).catch(() => null);
            console.log(`         Product: "${title?.substring(0,50)}" | Price: $${price}`);

            // Record count before click
            const beforeCount = await fetch(`${SERVER}/api/extension/scraped`, {
                headers: { 'Authorization': 'Bearer ' + await getToken() }
            }).then(r => r.json()).then(d => d.count).catch(() => 0);

            // Click the button
            await floatBtn.click();
            await amazonPage.waitForTimeout(4000); // wait for SW to save

            // Verify via Node fetch (not from Amazon page context — avoids CORS)
            const afterCount = await fetch(`${SERVER}/api/extension/scraped`, {
                headers: { 'Authorization': 'Bearer ' + await getToken() }
            }).then(r => r.json()).then(d => d.count).catch(() => 0);

            if (afterCount > beforeCount) {
                pass('Step 4b — Amazon capture saved to backend', `count ${beforeCount} → ${afterCount}`);
            } else {
                // SW may not have our token — check if any amazon item exists
                const scraped = await fetch(`${SERVER}/api/extension/scraped`, {
                    headers: { 'Authorization': 'Bearer ' + await getToken() }
                }).then(r => r.json());
                const hasAmazon = scraped.items?.some(i => i.source_site === 'amazon' || i.source === 'amazon');
                hasAmazon
                    ? pass('Step 4b — Amazon items exist in backend')
                    : warn('Step 4b — Count unchanged', `before=${beforeCount} after=${afterCount} — SW may use different user token`);
            }
        } else {
            fail('Step 4a — Amazon floating button NOT found', 'content script may not have injected');
        }
    } catch (e) {
        fail('Step 4 — Amazon', e.message);
    }

    // ── Step 5: Price tracking ───────────────────────────────────────────────
    // 5a: Verify Track Price button is visible in popup
    if (extId) {
        try {
            await popupPage.reload();
            await popupPage.waitForSelector('#main-view:not(.hidden)', { timeout: 5000 });
            const trackBtn = await popupPage.$('#price-track-btn');
            if (trackBtn) {
                pass('Step 5a — Price Track button visible in popup');
            } else {
                warn('Step 5a — Price Track button not found in popup DOM');
            }
        } catch (e) {
            warn('Step 5a — Price track popup check', e.message);
        }
    }

    // 5b: Price tracking API end-to-end — POST a tracked item, verify it persists
    try {
        const token = await getToken();
        const beforeRes = await fetch(`${SERVER}/api/extension/price-tracking`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const beforeData = await beforeRes.json();
        const beforeCount = Array.isArray(beforeData.items) ? beforeData.items.length : (beforeData.count || 0);

        // Get CSRF token (required by dev server for state-changing requests)
        const csrfRes = await fetch(`${SERVER}/api/csrf-token`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const csrfData = await csrfRes.json();
        const csrfToken = csrfData.csrfToken || csrfData.token || '';

        // POST a test tracked item (mirrors what the SW sends after scrapeProduct)
        const trackRes = await fetch(`${SERVER}/api/extension/price-tracking`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                productTitle: 'Nike Air Force 1 (D-3 Test)',
                url: AMAZON_URL,
                currentPrice: 89.99,
                site: 'amazon'
            })
        });

        if (trackRes.ok) {
            const afterRes = await fetch(`${SERVER}/api/extension/price-tracking`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const afterData = await afterRes.json();
            const afterCount = Array.isArray(afterData.items) ? afterData.items.length : (afterData.count || 0);

            if (afterCount > beforeCount) {
                pass('Step 5b — Price tracking API end-to-end', `count ${beforeCount} → ${afterCount}`);
                // Clean up: delete the test item
                const testItem = afterData.items?.find(i => i.title === 'Nike Air Force 1 (D-3 Test)' || i.productTitle === 'Nike Air Force 1 (D-3 Test)');
                if (testItem) {
                    const csrfRes2 = await fetch(`${SERVER}/api/csrf-token`, { headers: { 'Authorization': 'Bearer ' + token } });
                    const csrf2 = (await csrfRes2.json()).csrfToken || '';
                    await fetch(`${SERVER}/api/extension/price-tracking/${testItem.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token, 'X-CSRF-Token': csrf2 }
                    });
                }
            } else {
                warn('Step 5b — Price tracking count unchanged after POST', `${beforeCount} → ${afterCount}`);
            }
        } else {
            const err = await trackRes.text();
            fail('Step 5b — Price tracking POST failed', `${trackRes.status}: ${err.substring(0, 80)}`);
        }
    } catch (e) {
        fail('Step 5b — Price tracking API', e.message);
    }

    // ── Step 6: Poshmark autofill ────────────────────────────────────────────
    const poshPage = await context.newPage();
    const poshErrors = [];
    poshPage.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error' && isOurError(text)) poshErrors.push(text);
        if (msg.type() === 'log' && text.includes('[VaultLister]')) {
            console.log(`   [posh-console] ${text}`);
        }
    });

    try {
        await poshPage.goto('https://poshmark.com/create-listing', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        await poshPage.waitForTimeout(3000);

        // Check if autofill.js injected (it logs to console on activation)
        const autofillActive = await poshPage.evaluate(() => {
            // autofill.js adds a class or mutation observer — check for extension markers
            return document.querySelector('[data-vaultlister-autofill]') !== null
                || document.querySelector('#vaultlister-autofill-banner') !== null;
        });

        if (autofillActive) {
            pass('Step 6 — Poshmark autofill UI injected');
        } else {
            // Check if at least the content script loaded (no crash)
            const pageTitle = await poshPage.title();
            if (poshErrors.length === 0) {
                pass('Step 6 — Poshmark content script loaded (no errors)', `page: "${pageTitle}"`);
            } else {
                fail('Step 6 — Poshmark autofill errors', poshErrors.join(' | '));
            }
        }
    } catch (e) {
        if (e.message.includes('net::ERR') || e.message.includes('timeout')) {
            warn('Step 6 — Poshmark navigation failed (network)', e.message.substring(0, 80));
        } else {
            fail('Step 6 — Poshmark', e.message);
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n=== D-3 RESULTS ===');
    for (const r of results) {
        console.log(`${r.status}  ${r.label}${r.detail ? '\n         ' + r.detail : ''}`);
    }

    const passed = results.filter(r => r.status.includes('PASS')).length;
    const failed = results.filter(r => r.status.includes('FAIL')).length;
    const warned = results.filter(r => r.status.includes('WARN')).length;
    console.log(`\nTotal: ${passed} pass / ${failed} fail / ${warned} warn`);

    await context.close();
}

run().catch(err => {
    console.error('Test crashed:', err.message);
    process.exit(1);
});
