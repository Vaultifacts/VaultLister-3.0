#!/usr/bin/env node
// Delete a Poshmark listing by URL
// Usage: POSHMARK_COUNTRY=ca node scripts/poshmark-delete-listing.mjs <listing-url>

import { firefox } from 'playwright';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COOKIE_FILE = join(ROOT, 'data', 'poshmark-cookies.json');
const AUDIT_LOG   = join(ROOT, 'data', 'automation-audit.log');
const SCREENSHOT  = join(ROOT, 'data', 'delete-debug.png');

const POSHMARK_URL = `https://poshmark.${(process.env.POSHMARK_COUNTRY||'us').toLowerCase()==='ca'?'ca':'com'}`;
const listingUrl = process.argv[2];

if (!listingUrl) { console.error('Usage: node poshmark-delete-listing.mjs <listing-url>'); process.exit(1); }

function log(msg) { process.stderr.write(`[${new Date().toISOString()}] [Delete] ${msg}\n`); }
function auditLog(event, meta={}) {
    try { appendFileSync(AUDIT_LOG, JSON.stringify({ ts: new Date().toISOString(), platform: 'poshmark', event, ...meta }) + '\n'); } catch(_){}
}

let browser;
try {
    const cookies = JSON.parse(readFileSync(COOKIE_FILE, 'utf8'));
    browser = await firefox.launch({ headless: true, slowMo: 50 });
    const ctx = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        viewport: { width: 1280, height: 900 }
    });
    const page = await ctx.newPage();
    await ctx.addCookies(cookies);

    log('Navigating to listing: ' + listingUrl);
    await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SCREENSHOT });

    // Find the Edit/Delete options — Poshmark shows "..." or "Edit" menu on seller's own listings
    const editBtn = await page.$('[data-et="edit_listing"], button[aria-label*="edit" i], a[href*="edit"], [class*="edit-listing"]');
    if (!editBtn) {
        // Try the "..." overflow menu
        const moreBtn = page.locator('button').filter({ hasText: /\.\.\.|more|edit/i }).first();
        if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await moreBtn.click();
            await page.waitForTimeout(1000);
        }
    } else {
        await editBtn.click();
        await page.waitForTimeout(1500);
    }

    // Look for delete option in the dropdown/page
    const deleteBtn = page.locator('button, a').filter({ hasText: /delete|remove listing/i }).first();
    if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deleteBtn.click();
        await page.waitForTimeout(1000);
        // Confirm dialog
        const confirmBtn = page.locator('button').filter({ hasText: /confirm|yes|delete/i }).first();
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmBtn.click();
            await page.waitForTimeout(2000);
            log('Listing deleted successfully');
            auditLog('listing_deleted', { listingUrl });
            console.log(JSON.stringify({ success: true }));
        } else {
            log('Confirm button not found — checking if already deleted');
            console.log(JSON.stringify({ success: false, error: 'confirm button not found' }));
        }
    } else {
        // Try navigating to edit page directly and deleting from there
        const editUrl = listingUrl.replace('/listing/', '/listing/edit/');
        log('Trying edit URL: ' + editUrl);
        await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: SCREENSHOT });

        const delBtn = page.locator('button, a').filter({ hasText: /delete|remove/i }).first();
        if (await delBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await delBtn.click();
            await page.waitForTimeout(1000);
            const confBtn = page.locator('button').filter({ hasText: /confirm|yes|delete/i }).first();
            if (await confBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await confBtn.click();
                await page.waitForTimeout(2000);
                log('Listing deleted via edit page');
                auditLog('listing_deleted', { listingUrl });
                console.log(JSON.stringify({ success: true }));
            } else {
                log('WARN: delete button found but confirm not visible. Check ' + SCREENSHOT);
                console.log(JSON.stringify({ success: false, error: 'confirm not found on edit page' }));
            }
        } else {
            log('Delete button not found on listing or edit page. Check ' + SCREENSHOT);
            log('You may need to delete manually at: ' + listingUrl);
            console.log(JSON.stringify({ success: false, error: 'delete button not found — delete manually at ' + listingUrl }));
        }
    }

    await browser.close();
} catch(err) {
    log('Error: ' + err.message);
    if (browser) await browser.close().catch(()=>{});
    console.log(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
}
