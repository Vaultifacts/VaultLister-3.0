#!/usr/bin/env node
// Diagnostic: check Poshmark account listing state
// Run: POSHMARK_COUNTRY=ca node scripts/poshmark-diagnose.mjs

import { firefox } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COOKIE_FILE = join(ROOT, 'data', 'poshmark-cookies.json');
const POSHMARK_URL = `https://poshmark.${(process.env.POSHMARK_COUNTRY || 'com').toLowerCase() === 'ca' ? 'ca' : 'com'}`;

async function shot(page, name) {
    const p = join(ROOT, 'data', `diag-${name}.png`);
    await page.screenshot({ path: p, fullPage: false });
    process.stderr.write(`[diag] Screenshot: ${p}\n`);
}

(async () => {
    let browser;
    try {
        const cookies = JSON.parse(readFileSync(COOKIE_FILE, 'utf8'));

        browser = await firefox.launch({ headless: true, slowMo: 50 });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            viewport: { width: 1280, height: 900 }
        });
        const page = await context.newPage();
        await context.addCookies(cookies);

        // 1. Closet page
        process.stderr.write(`[diag] Checking closet...\n`);
        await page.goto(`${POSHMARK_URL}/closet/raverealm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        await shot(page, '1-closet');

        const closetText = await page.evaluate(() => {
            const items = [...document.querySelectorAll('[data-et="listing_thumbnail"], .tile, [class*="listing-card"], [class*="tile__title"]')];
            return {
                listingCount: document.querySelector('[data-et="closet_listings_count"], .stats__count')?.textContent?.trim() || null,
                itemTitles: items.slice(0, 5).map(el => el.textContent?.trim().substring(0, 60)),
                bodySnippet: document.body.innerText.substring(0, 500)
            };
        });
        process.stderr.write(`[diag] Closet data: ${JSON.stringify(closetText)}\n`);

        // 2. Seller tools / manage listings
        process.stderr.write(`[diag] Checking seller manage listings...\n`);
        await page.goto(`${POSHMARK_URL}/my/selling/listings`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(3000);
        await shot(page, '2-my-listings');

        const myListings = await page.evaluate(() => {
            const items = [...document.querySelectorAll('[class*="listing"], [data-et="listing"], .m-listing, .item')];
            return {
                url: window.location.href,
                count: items.length,
                titles: items.slice(0, 5).map(el => el.textContent?.trim().substring(0, 60)),
                bodySnippet: document.body.innerText.substring(0, 800)
            };
        });
        process.stderr.write(`[diag] My listings: ${JSON.stringify(myListings)}\n`);

        // 3. All listings including sold/not for sale
        process.stderr.write(`[diag] Checking closet with sold filter...\n`);
        await page.goto(`${POSHMARK_URL}/closet/raverealm?availability=all`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);
        await shot(page, '3-closet-all');
        const allText = await page.evaluate(() => document.body.innerText.substring(0, 600));
        process.stderr.write(`[diag] All filter: ${allText.substring(0, 200)}\n`);

        await browser.close();
        process.stderr.write('[diag] Done. Check data/diag-*.png screenshots.\n');
        process.exit(0);
    } catch (err) {
        process.stderr.write(`[diag] Error: ${err.message}\n`);
        if (browser) await browser.close().catch(() => {});
        process.exit(1);
    }
})();
