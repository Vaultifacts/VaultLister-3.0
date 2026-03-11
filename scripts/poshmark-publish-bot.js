#!/usr/bin/env node
// Poshmark Publish Bot — standalone subprocess
// Spawned by poshmarkPublish.js to avoid Windows detached-process Playwright pipe issues.
// Input:  JSON object on stdin  { username, password, title, description, brand, price, originalPrice, listingId }
// Output: JSON on stdout        { success, listingUrl } or { success: false, error }
// Exit:   0 on success, 1 on error
//
// Uses the persistent Chromium profile at data/poshmark-profile/ (same as E2E tests)
// to maintain authenticated sessions across runs without requiring re-login or SMS 2FA.
// Falls back to cookie file if the profile directory does not exist.

import { chromium } from 'playwright';
import { appendFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const LOG_PATH = join(ROOT_DIR, 'data', 'automation-audit.log');
const COOKIES_PATH = join(ROOT_DIR, 'data', 'poshmark-cookies.json');
const PROFILE_DIR = join(ROOT_DIR, 'data', 'poshmark-profile');

const COUNTRY = process.env.POSHMARK_COUNTRY || 'com';
const BASE_URL = COUNTRY === 'ca' ? 'https://poshmark.ca' : 'https://poshmark.com';

function auditLog(event, data = {}) {
    const record = JSON.stringify({ ts: new Date().toISOString(), platform: 'poshmark', event, ...data });
    try { appendFileSync(LOG_PATH, record + '\n'); } catch {}
}

function randomDelay(min = 800, max = 2000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanType(page, selector, text) {
    await page.click(selector);
    await page.fill(selector, '');
    for (const char of text) {
        await page.keyboard.type(char);
        await new Promise(r => setTimeout(r, randomDelay(40, 100)));
    }
}

/**
 * Convert a raw inventory size string to the closest Poshmark size label.
 * @param {string|null} rawSize  e.g. "32x30", "L", "XL", "US M", "34", "28W 30L"
 * @param {string[]} category    e.g. ["Men","Pants"] — first element is dept
 * @returns {string}  label to search for in Poshmark's size dropdown
 */
function resolvePoshmarkSize(rawSize, category) {
    if (!rawSize) return 'M';
    const s = String(rawSize).trim();

    // WxL jeans format: "32x30", "32X30", "32 x 30", "32W 30L"
    const wxlMatch = s.match(/^(\d{2})\s*[xX×]\s*\d{2}$/) || s.match(/^(\d{2})[Ww]\s*\d{2}[Ll]$/);
    if (wxlMatch) {
        // Return numeric waist — matches Poshmark pants dropdown items like "28", "30", "32", "34"
        return wxlMatch[1];
    }

    // Pure numeric (waist-only): "32", "34"
    if (/^\d{2}$/.test(s)) return s;

    // Normalize letter sizes → "US X" format
    const clean = s.replace(/^US\s*/i, '').toUpperCase();
    const letterMap = {
        'XXS': 'US XXS', 'XS': 'US XS', 'S': 'US S', 'M': 'US M',
        'L': 'US L', 'XL': 'US XL', 'XXL': 'US XXL', '2XL': 'US XXL',
        'XXXL': 'US XXXL', '3XL': 'US XXXL', '4XL': 'US 4XL',
        '0': 'US 0', '2': 'US 2', '4': 'US 4', '6': 'US 6',
        '8': 'US 8', '10': 'US 10', '12': 'US 12', '14': 'US 14',
    };
    if (letterMap[clean]) return letterMap[clean];

    // Already has "US " prefix
    if (/^US\s/i.test(s)) return s;

    // Return as-is and let bot matching handle it
    return s;
}

async function main() {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const payload = JSON.parse(input);
    const { username, password, title, description, brand, price, originalPrice, listingId, photoPath, category, size } = payload;

    auditLog('publish_attempt', { listingId });

    // Prefer persistent Chromium profile (shares session with E2E tests)
    const useProfile = existsSync(PROFILE_DIR);
    process.stderr.write('[bot] Session mode: ' + (useProfile ? 'persistent-profile (' + PROFILE_DIR + ')' : 'cookie-fallback') + '\n');

    let browser = null;
    let context;
    if (useProfile) {
        context = await chromium.launchPersistentContext(PROFILE_DIR, {
            headless: true,
            slowMo: 30,
            args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
            ignoreDefaultArgs: ['--enable-automation'],
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });
    } else {
        browser = await chromium.launch({ headless: true, slowMo: 30, args: ['--no-sandbox'] });
        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });
        if (existsSync(COOKIES_PATH)) {
            try {
                const cookies = JSON.parse(readFileSync(COOKIES_PATH, 'utf8'));
                const pmCookies = cookies.filter(c => c.domain && c.domain.includes('poshmark'));
                await context.addCookies(pmCookies);
                process.stderr.write('[bot] Loaded ' + pmCookies.length + ' saved Poshmark cookies\n');
            } catch (e) {
                process.stderr.write('[bot] Warning: could not load cookies: ' + e.message + '\n');
            }
        }
    }

    try {
        const page = await context.newPage();

        // Step 1: Check if session is valid by going directly to create-listing
        process.stderr.write('[bot] Checking session at ' + BASE_URL + '/create-listing\n');
        await page.goto(BASE_URL + '/create-listing', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomDelay(2000, 3000));

        const currentUrl = page.url();
        process.stderr.write('[bot] Current URL: ' + currentUrl + '\n');

        // If redirected to login, fall back to form login
        if (currentUrl.includes('/login')) {
            process.stderr.write('[bot] Session invalid, attempting form login\n');
            await humanType(page, 'input[name="login_form[username_email]"]', username);
            await page.waitForTimeout(randomDelay(400, 800));
            await humanType(page, 'input[name="login_form[password]"]', password);
            await page.waitForTimeout(randomDelay(400, 800));
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(randomDelay(1500, 2500));

            const afterLogin = page.url();
            await page.screenshot({ path: join(ROOT_DIR, 'logs', 'poshmark-login-debug.png') }).catch(() => {});
            if (afterLogin.includes('/login') || afterLogin.includes('/auth')) {
                throw new Error('Poshmark login failed. SMS 2FA may be required. Check logs/poshmark-login-debug.png');
            }
            process.stderr.write('[bot] Form login succeeded\n');
            await page.goto(BASE_URL + '/create-listing', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(randomDelay(2000, 3000));
        } else {
            process.stderr.write('[bot] Session valid, on create-listing page\n');
        }

        // Dismiss any error modals (Poshmark sometimes shows "Something went wrong!" on load)
        const modalOk = page.locator('[class*="modal"] button, [class*="dialog"] button').filter({ hasText: /^ok$/i }).first();
        if (await modalOk.isVisible().catch(() => false)) {
            process.stderr.write('[bot] Dismissing error modal\n');
            await modalOk.click();
            await page.waitForTimeout(randomDelay(500, 1000));
        }

        // Step 1b: Upload photo (required) — must be a real item photo, not a placeholder
        // Poshmark moderators remove listings with placeholder/stock images
        const resolvedPhoto = (photoPath && existsSync(photoPath)) ? photoPath : null;
        if (!resolvedPhoto) {
            throw new Error('No valid photo found at: ' + (photoPath || '[none provided]') + '. A real item photo is required to publish to Poshmark.');
        }
        if (resolvedPhoto) {
            // Try input[type="file"] first (most reliable), then legacy #img-file-input
            const fileInput = page.locator('input[type="file"][accept*="image"], input[type="file"], #img-file-input').first();
            await fileInput.setInputFiles(resolvedPhoto, { timeout: 15000 });
            process.stderr.write('[bot] Uploaded photo: ' + resolvedPhoto + '\n');
            await page.waitForTimeout(randomDelay(2000, 3000));
            await page.screenshot({ path: join(ROOT_DIR, 'logs', 'poshmark-crop-modal.png') }).catch(() => {});

            // Dump all visible modal buttons for diagnostics
            const cropModalBtns = await page.evaluate(() =>
                Array.from(document.querySelectorAll('button, [role="button"]'))
                    .filter(el => el.getBoundingClientRect().height > 0)
                    .map(el => ({ text: el.textContent.trim(), cls: (el.className || '').slice(0, 60) }))
            );
            process.stderr.write('[bot] Visible buttons after upload: ' + JSON.stringify(cropModalBtns) + '\n');

            // Dismiss the photo crop/edit modal that Poshmark opens after upload
            // Try "Apply" first (Cropper.js), then "Done", then "Save"
            const cropBtnSelectors = [
                'button[class*="apply"]', 'button[class*="Apply"]',
                '.modal button[class*="primary"]',
                '[data-test="modal-footer"] button',
            ];
            let cropDismissed = false;
            for (const sel of cropBtnSelectors) {
                const btn = page.locator(sel).filter({ hasText: /apply|done|save|ok/i }).first();
                if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await btn.click();
                    process.stderr.write('[bot] Dismissed crop modal via: ' + sel + '\n');
                    cropDismissed = true;
                    await page.waitForTimeout(randomDelay(1000, 1500));
                    break;
                }
            }
            if (!cropDismissed) {
                // Fallback: find any visible button in a modal after upload
                const anyModalBtn = page.locator('[data-test="modal"] button, .modal button, .cr-viewport').first();
                const modalBtnText = await anyModalBtn.textContent().catch(() => '');
                process.stderr.write('[bot] Crop modal button found: "' + modalBtnText.trim() + '"\n');
                // Dismiss modal backdrop via JS
                await page.evaluate(() => {
                    document.querySelectorAll('.modal-backdrop, [data-test="modal"]').forEach(el => {
                        el.style.pointerEvents = 'none';
                    });
                });
                await page.waitForTimeout(500);
            }
            // Wait for crop overlay to disappear
            await page.waitForSelector('.cr-overlay', { state: 'hidden', timeout: 10000 }).catch(() => {});
        } else {
            process.stderr.write('[bot] WARNING: No photo found — upload will be skipped\n');
        }

        // Step 2: Title — poshmark.ca uses placeholder "What are you selling? (required)"
        const titleSelector = 'input[placeholder*="selling" i], input[placeholder*="title" i], [data-test*="title"] input, input[name*="title"]';
        await page.waitForSelector(titleSelector, { timeout: 15000 });
        await humanType(page, titleSelector, title);
        await page.waitForTimeout(randomDelay(400, 800));

        // Step 3: Description — poshmark.ca uses "Describe it! (required)"
        const descSelector = 'textarea[placeholder*="describe" i], textarea[placeholder*="description" i], [data-test*="description"] textarea';
        const descEl = await page.$(descSelector);
        if (descEl) {
            await humanType(page, descSelector, description);
            await page.waitForTimeout(randomDelay(400, 800));
        }

        // Step 3b: Category selection — poshmark.ca multi-step category picker
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        if (!category) process.stderr.write('[bot] WARN: No category provided — defaulting to Men>Tops. Set inventory.category for accurate listing.\n');
        const catParts = (category || 'Men>Tops').split('>').map(s => s.trim());
        process.stderr.write('[bot] Selecting category: ' + JSON.stringify(catParts) + '\n');

        // Poshmark category picker is HIERARCHICAL within ONE dropdown:
        //   1. Click selector → dropdown opens with top-level departments (Women, Men, Kids, etc.)
        //   2. Click department ("Men") → dropdown stays open, shows Men's categories (Accessories, Bags, Jackets & Coats, etc.)
        //   3. Click category ("Jackets & Coats") → dropdown closes, category is set on the form
        //   4. Optional: listing-editor__subcategory-container handles a 3rd level (e.g. "Raincoats")
        //
        // catParts[0] = department, catParts[1] = category, catParts[2] = subcategory (optional)

        const catDropdown = page.locator('.listing-editor__category-container .dropdown__selector').first();
        await catDropdown.scrollIntoViewIfNeeded().catch(() => {});
        await catDropdown.click();
        await page.waitForTimeout(randomDelay(600, 900));

        // Helper: click an item in the still-open category dropdown by text
        // Uses mousedown+mouseup+click dispatchEvent for Vue reactivity
        const clickCatItem = async (name) => {
            const result = await page.evaluate((itemName) => {
                const container = document.querySelector('.listing-editor__category-container');
                if (!container) return { error: 'container not found' };
                // Search across the whole container (dept items may be in .dropdown__menu,
                // subcategory items may appear elsewhere in the container after dept click)
                const items = Array.from(container.querySelectorAll('a, li, span, div'))
                    .filter(el => {
                        const h = el.getBoundingClientRect().height;
                        return h > 0 && el.innerText.trim() && !el.querySelector('a, li, span');
                    });
                const item = items.find(el => el.innerText.trim() === itemName)
                          || items.find(el => el.innerText.trim().includes(itemName));
                if (!item) {
                    return {
                        error: 'not found',
                        available: items.map(el => ({ tag: el.tagName, text: el.innerText.trim().slice(0, 30), cls: (el.className||'').slice(0,30) })).slice(0, 30)
                    };
                }
                item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                item.click();
                return { clicked: item.innerText.trim(), tag: item.tagName, cls: (item.className||'').slice(0,50) };
            }, name);
            process.stderr.write('[bot] Cat picker click "' + name + '": ' + JSON.stringify(result) + '\n');
            return !result.error;
        };

        // Step 1: Click department (catParts[0] = "Men") — dropdown stays open
        let catSelected = false;
        const deptOk = await clickCatItem(catParts[0]);
        if (deptOk) {
            // Wait for Vue to async-load dept's categories into the same dropdown (needs 2-3s)
            await page.waitForTimeout(randomDelay(2500, 3500));

            if (catParts.length > 1) {
                // Step 2: Click category (catParts[1] = "Jackets & Coats") — closes dropdown, sets category
                const catOk = await clickCatItem(catParts[1]);
                if (catOk) {
                    catSelected = true;
                    await page.waitForTimeout(randomDelay(800, 1200));
                    const catSelectorText = await catDropdown.textContent().catch(() => '');
                    process.stderr.write('[bot] Category selector after selection: "' + catSelectorText.trim() + '"\n');
                }
            } else {
                // Department IS the category for single-level selections
                catSelected = true;
                await page.waitForTimeout(randomDelay(800, 1200));
                const catSelectorText = await catDropdown.textContent().catch(() => '');
                process.stderr.write('[bot] Category selector after dept: "' + catSelectorText.trim() + '"\n');
            }
        }

        // Step 3: Optional subcategory (catParts[2]) via the separate subcategory container
        if (catParts.length > 2 && catSelected) {
            const subCatDropdown = page.locator('.listing-editor__subcategory-container .dropdown__selector').first();
            const subCatVisible = await subCatDropdown.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
            if (subCatVisible) {
                await subCatDropdown.click();
                await page.waitForTimeout(randomDelay(1000, 1500));
                const subCatResult = await page.evaluate((name) => {
                    const menu = document.querySelector('.listing-editor__subcategory-container .dropdown__menu');
                    if (!menu) return { error: 'menu not found' };
                    const items = Array.from(menu.querySelectorAll('a, li, span'))
                        .filter(el => el.getBoundingClientRect().height > 0 && el.innerText.trim());
                    const item = items.find(el => el.innerText.trim() === name)
                                || items.find(el => el.innerText.includes(name));
                    if (!item) return { notFound: name, available: items.map(el => el.innerText.trim()).slice(0, 10) };
                    item.click();
                    return { clicked: item.innerText.trim() };
                }, catParts[2]);
                process.stderr.write('[bot] Subcategory click: ' + JSON.stringify(subCatResult) + '\n');
                await page.waitForTimeout(randomDelay(400, 600));
            }
        }

        // Step 3c: Size selection — use mouse.click at element coordinates for Vue reactivity
        // (page.evaluate el.click() doesn't trigger Vue; mouse.click does)
        await page.waitForTimeout(randomDelay(400, 600));
        const sizeToSelect = resolvePoshmarkSize(size, catParts);
        process.stderr.write(`[bot] Size mapping: "${size}" → "${sizeToSelect}" (category: ${catParts.join('>')})\n`);

        // Get size dropdown bounding box via evaluate, then click via page.mouse
        const sizeDropdownBox = await page.evaluate(() => {
            const subsections = Array.from(document.querySelectorAll('.listing-editor__subsection'));
            const sizeSection = subsections.find(s => (s.innerText || '').trim().startsWith('SIZE'));
            if (!sizeSection) return null;
            const dropdown = sizeSection.querySelector('.dropdown__selector');
            if (!dropdown) return null;
            const r = dropdown.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        process.stderr.write('[bot] Size dropdown box: ' + JSON.stringify(sizeDropdownBox) + '\n');

        if (sizeDropdownBox) {
            // Scroll to ensure size dropdown is in viewport
            await page.evaluate(() => {
                const subsections = Array.from(document.querySelectorAll('.listing-editor__subsection'));
                const s = subsections.find(el => (el.innerText || '').trim().startsWith('SIZE'));
                if (s) s.scrollIntoView({ behavior: 'instant', block: 'center' });
            });
            await page.waitForTimeout(500);

            // Recalculate after scroll
            const sizeBoxAfterScroll = await page.evaluate(() => {
                const subsections = Array.from(document.querySelectorAll('.listing-editor__subsection'));
                const sizeSection = subsections.find(s => (s.innerText || '').trim().startsWith('SIZE'));
                if (!sizeSection) return null;
                const dropdown = sizeSection.querySelector('.dropdown__selector');
                if (!dropdown) return null;
                const r = dropdown.getBoundingClientRect();
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            });

            if (sizeBoxAfterScroll) {
                await page.mouse.move(sizeBoxAfterScroll.x, sizeBoxAfterScroll.y);
                await page.mouse.click(sizeBoxAfterScroll.x, sizeBoxAfterScroll.y);
                process.stderr.write('[bot] Clicked size dropdown via mouse\n');
                await page.waitForTimeout(randomDelay(600, 900));

                // Find the target size option and click it via mouse coordinates
                const sizeOptBox = await page.evaluate((sizeLabel) => {
                    const subsections = Array.from(document.querySelectorAll('.listing-editor__subsection'));
                    const sizeSection = subsections.find(s => (s.innerText || '').trim().startsWith('SIZE'));
                    if (!sizeSection) return null;
                    const menu = sizeSection.querySelector('.dropdown__menu');
                    if (!menu) return null;
                    const items = Array.from(menu.querySelectorAll('li, a, div'))
                        .filter(el => el.getBoundingClientRect().height > 0 && !el.querySelector('li, a') && (el.innerText || '').trim());
                    const available = items.map(el => el.innerText.trim());
                    // Match: exact → US prefix → word boundary → fallback to skip headers (Standard/Big & Tall/Custom)
                    const item = items.find(el => el.innerText.trim() === sizeLabel)
                              || items.find(el => el.innerText.trim() === 'US ' + sizeLabel)
                              || items.find(el => new RegExp('\\b' + sizeLabel + '$').test(el.innerText.trim()))
                              || items.find(el => !/^(Standard|Big & Tall|Custom)/.test(el.innerText.trim()));
                    if (!item) return { error: 'not found', available };
                    const r = item.getBoundingClientRect();
                    return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: item.innerText.trim(), available };
                }, sizeToSelect);

                process.stderr.write('[bot] Size option: ' + JSON.stringify(
                    sizeOptBox ? { text: sizeOptBox.text, x: Math.round(sizeOptBox.x), y: Math.round(sizeOptBox.y) } : sizeOptBox
                ) + '\n');

                if (sizeOptBox && sizeOptBox.x) {
                    await page.mouse.move(sizeOptBox.x, sizeOptBox.y);
                    await page.mouse.click(sizeOptBox.x, sizeOptBox.y);
                    process.stderr.write('[bot] Clicked size: ' + sizeOptBox.text + '\n');
                    await page.waitForTimeout(randomDelay(400, 600));

                    // Verify size was committed
                    const sizeSelectorText = await page.evaluate(() => {
                        const subsections = Array.from(document.querySelectorAll('.listing-editor__subsection'));
                        const sizeSection = subsections.find(s => (s.innerText || '').trim().startsWith('SIZE'));
                        if (!sizeSection) return 'section not found';
                        const sel = sizeSection.querySelector('.dropdown__selector');
                        return sel ? sel.innerText.trim() : 'selector not found';
                    });
                    process.stderr.write('[bot] Size selector now shows: "' + sizeSelectorText + '"\n');
                }
            }
        }

        // Step 4: Brand — poshmark.ca uses "Enter the Brand/Designer"
        const brandSelector = 'input[placeholder*="Brand" i], input[placeholder*="Designer" i]';
        const brandEl = await page.$(brandSelector);
        if (brandEl) {
            await humanType(page, brandSelector, brand);
            await page.waitForTimeout(randomDelay(300, 600));
            // Accept first autocomplete suggestion
            const suggestion = page.locator('[class*="suggestion"] li, [class*="autocomplete"] li').first();
            if (await suggestion.isVisible().catch(() => false)) {
                await suggestion.click();
                await page.waitForTimeout(randomDelay(200, 400));
            }
        }

        // Steps 5-6: Price — listingPrice input is directly on the page (no modal trigger needed)
        // Scroll to bring the price section into view
        await page.evaluate(() => window.scrollTo(0, 1900));
        await page.waitForTimeout(randomDelay(600, 900));

        // Fill listing price via the "Add Price" suggestion modal (Poshmark opens it on click/type)
        // Must use humanType in the modal for Vue v-model reactivity
        const priceInt = String(Math.round(parseFloat(price)));
        const priceMainInput = page.locator('input[data-vv-name="listingPrice"]');
        await priceMainInput.scrollIntoViewIfNeeded().catch(() => {});
        await priceMainInput.click();
        await page.waitForTimeout(randomDelay(600, 900));

        const suggestionModal = page.locator('.listing-price-suggestion-modal');
        const modalOpen = await suggestionModal.isVisible().catch(() => false);
        process.stderr.write('[bot] Price modal visible: ' + modalOpen + '\n');

        if (modalOpen) {
            // Use humanType for Vue reactivity — fill() doesn't trigger Vue's input event chain
            await humanType(page, 'input.listing-price-input', priceInt);
            await page.waitForTimeout(randomDelay(300, 500));

            // Check earnings updated
            const earningsEl = await page.$('.earnings-suffix');
            const earningsText = earningsEl ? await earningsEl.textContent() : '?';
            process.stderr.write('[bot] Earnings after price: ' + earningsText + '\n');

            // Click Done — scope to the price modal to avoid matching other modal footers
            const doneBtn = page.locator('.listing-price-suggestion-modal button.btn--primary').first();
            await doneBtn.click();
            process.stderr.write('[bot] Clicked Done in price modal\n');
            await page.waitForTimeout(randomDelay(500, 800));
        } else {
            // Fallback: type directly into the main input
            await humanType(page, 'input[data-vv-name="listingPrice"]', priceInt);
            await page.waitForTimeout(randomDelay(300, 500));
        }

        const finalPrice = await priceMainInput.inputValue().catch(() => '?');
        process.stderr.write('[bot] Main price after modal: ' + finalPrice + '\n');

        // Step 7: Screenshot before submit for verification
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(randomDelay(1000, 1500));
        await page.screenshot({ path: join(ROOT_DIR, 'logs', 'poshmark-preflight.png') }).catch(() => {});

        // Step 8: Multi-step form submit
        // Poshmark listing creation is 2 steps:
        //   Step 1 (photos/details): "Next" button → goes to step 2 (same /create-listing URL)
        //   Step 2 (condition/tags): "List This Item" button → publishes, navigates to listing URL
        //
        // Uses mouse.click at coordinates (more reliable with Vue.js than Playwright locator filter)
        const clickBtnByText = async (textMatch) => {
            await page.evaluate(() => {
                const backdrop = document.querySelector('[data-test="modal"], .modal-backdrop--in');
                if (backdrop) backdrop.style.pointerEvents = 'none';
            });
            await page.waitForTimeout(300);

            const btnInfo = await page.evaluate((match) => {
                const re = new RegExp(match, 'i');
                const btns = Array.from(document.querySelectorAll('button, [role="button"]'))
                    .filter(b => b.getBoundingClientRect().height > 0 && re.test(b.innerText.trim()));
                if (!btns.length) {
                    const all = Array.from(document.querySelectorAll('button'))
                        .filter(b => b.getBoundingClientRect().height > 0)
                        .map(b => b.innerText.trim());
                    return { error: 'not found', all };
                }
                const b = btns[btns.length - 1]; // last matching
                const r = b.getBoundingClientRect();
                return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: b.innerText.trim() };
            }, textMatch);

            if (btnInfo.error) {
                process.stderr.write('[bot] Button "' + textMatch + '" not found. Visible: ' + JSON.stringify(btnInfo.all) + '\n');
                return false;
            }
            process.stderr.write('[bot] Clicking button: "' + btnInfo.text + '" at (' + Math.round(btnInfo.x) + ',' + Math.round(btnInfo.y) + ')\n');
            await page.mouse.move(btnInfo.x, btnInfo.y);
            await page.mouse.click(btnInfo.x, btnInfo.y);
            return true;
        };

        // Step 1 → 2: Click "Next"
        process.stderr.write('[bot] Step 1 submit — clicking Next\n');
        const clickedNext = await clickBtnByText('next');
        await page.waitForTimeout(randomDelay(3000, 4000));
        const urlAfterNext = page.url();
        process.stderr.write('[bot] URL after Next: ' + urlAfterNext + '\n');
        await page.screenshot({ path: join(ROOT_DIR, 'logs', 'poshmark-step2.png') }).catch(() => {});

        if (!urlAfterNext.includes('/create-listing')) {
            // Navigated away after "Next" — success (rare, some accounts skip step 2)
            auditLog('publish_success', { listingId, listingUrl: urlAfterNext });
            process.stdout.write(JSON.stringify({ success: true, listingUrl: urlAfterNext }) + '\n');
            process.exit(0);
        }

        // Step 2: Click "List This Item"
        process.stderr.write('[bot] Step 2 submit — clicking List This Item\n');
        const clickedList = await clickBtnByText('list this item');
        if (!clickedList && !clickedNext) {
            await page.screenshot({ path: join(ROOT_DIR, 'logs', 'poshmark-submit-debug.png') }).catch(() => {});
            throw new Error('Could not find Next or List This Item button. Check logs/poshmark-submit-debug.png');
        }
        await page.waitForTimeout(randomDelay(5000, 7000));

        const finalUrl = page.url();
        process.stderr.write('[bot] Post-submit URL: ' + finalUrl + '\n');

        if (finalUrl.includes('/create-listing')) {
            await page.screenshot({ path: join(ROOT_DIR, 'logs', 'poshmark-submit-debug.png') }).catch(() => {});
            const errors = await page.$$eval(
                '[class*="error"], [class*="alert"]',
                els => els.filter(e => e.offsetHeight > 0 && e.textContent.trim()).map(e => e.textContent.trim())
            );
            throw new Error('Submission failed: ' + (errors.join('; ') || 'still on create-listing. Check logs/poshmark-submit-debug.png'));
        }

        // Post-publish verification: navigate to closet and confirm the listing appears
        // This catches silent failures where Poshmark redirects away but doesn't create the listing
        process.stderr.write('[bot] Verifying listing appeared in closet...\n');
        await page.waitForTimeout(randomDelay(3000, 5000));
        await page.goto(finalUrl.includes('/closet/') ? finalUrl : BASE_URL + '/closet/' + (process.env.POSHMARK_USERNAME || 'me'),
            { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(randomDelay(2000, 3000));

        // Look for the listing by title in the closet
        const listingFound = await page.evaluate((searchTitle) => {
            const titleNorm = searchTitle.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
            // Poshmark listing cards use various selectors depending on version
            const cards = [...document.querySelectorAll(
                '[data-et="listing_thumbnail"], .tile, [class*="listing-card"], [class*="card__title"], .tc--b'
            )];
            return cards.some(el => {
                const t = (el.textContent || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
                return t && titleNorm && t.includes(titleNorm.substring(0, 10));
            });
        }, title);

        // Also get listing URL from the first card link if available
        const listingUrl = await page.evaluate((searchTitle) => {
            const titleNorm = searchTitle.toLowerCase().substring(0, 15);
            const links = [...document.querySelectorAll('a[href*="/listing/"]')];
            const match = links.find(a => a.textContent?.toLowerCase().includes(titleNorm.substring(0, 8)));
            return match ? match.href : null;
        }, title) || finalUrl;

        if (!listingFound) {
            await page.screenshot({ path: join(ROOT_DIR, 'logs', 'poshmark-verify-debug.png') }).catch(() => {});
            process.stderr.write('[bot] WARN: Listing not found in closet after submit — may be pending moderation or silent failure. Check logs/poshmark-verify-debug.png\n');
            // Still report the URL but flag the warning
            auditLog('publish_unverified', { listingId, listingUrl, note: 'listing not visible in closet post-submit' });
            process.stdout.write(JSON.stringify({ success: true, listingUrl, warning: 'Listing not visible in closet — may be pending moderation' }) + '\n');
        } else {
            process.stderr.write('[bot] Listing verified in closet: ' + listingUrl + '\n');
            auditLog('publish_success', { listingId, listingUrl });
            process.stdout.write(JSON.stringify({ success: true, listingUrl }) + '\n');
        }
        process.exit(0);

    } catch (err) {
        process.stderr.write('[bot] ERROR: ' + err.message + '\n');
        auditLog('publish_failure', { listingId, error: err.message });
        process.stdout.write(JSON.stringify({ success: false, error: err.message }) + '\n');
        process.exit(1);
    } finally {
        await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
}

main().catch(err => {
    process.stdout.write(JSON.stringify({ success: false, error: err.message }) + '\n');
    process.exit(1);
});
