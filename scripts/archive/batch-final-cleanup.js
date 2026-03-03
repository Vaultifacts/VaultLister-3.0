#!/usr/bin/env bun
// Final cleanup: Check off ALL remaining stale to-do items and add toggle blocks
// for the 6 confirmed-already-implemented items across Transactions, My Shops, Inventory, My Listings, Image Bank

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = {
  transactions: { id: '6623f0ec-f382-82c8-bcde-013c9b842ed0', name: 'Transactions' },
  myShops: { id: '9513f0ec-f382-8344-8d4f-01097038fb0b', name: 'My Shops' },
  inventory: { id: '20a3f0ec-f382-82bc-8d59-01f332e4e196', name: 'Inventory' },
  myListings: { id: '19f3f0ec-f382-83ca-8fe4-014a1e665539', name: 'My Listings' },
  imageBank: { id: '48d3f0ec-f382-83e1-9170-015cab35fd27', name: 'Image Bank' },
  orders: { id: '2fd3f0ec-f382-836b-8589-81252121f2bb', name: 'Orders' },
  automations: { id: '8b83f0ec-f382-8315-9ce0-01a7e520599c', name: 'Automations' },
  offers: { id: 'e313f0ec-f382-8390-a4b3-8173de396b3f', name: 'Offers' },
  dashboard: { id: '29f3f0ec-f382-83a6-8d1c-01d6640c22b8', name: 'Dashboard' },
  checklist: { id: '5933f0ec-f382-8364-891e-01899cddd9e2', name: 'Checklist' },
  calendar: { id: '31c3f0ec-f382-82c5-88e3-01976e5de201', name: 'Calendar' },
  analytics: { id: '31e3f0ec-f382-82fa-aac4-01dc57fd8b6f', name: 'Analytics' },
  feedback: { id: 'af63f0ec-f382-82c4-8030-013518f734e8', name: 'Feedback & Suggestions' },
  settings: { id: '9f63f0ec-f382-839f-8186-014eb9898857', name: 'Settings' },
};

// Only add toggles for the 6 items that were confirmed already done but don't yet have toggle blocks
const newToggleFeatures = [
  {
    pageKey: 'transactions',
    title: 'Running Balance Alongside Transaction History',
    description: 'Running balance calculated per transaction and displayed in both purchases and sales tables. A running balance component also shows the overall net cash flow. Balance calculated from oldest to newest, displayed newest first.',
    test: 'Go to Transactions > Check purchases table for "Running Balance" column > Check sales table for same column',
    expected: 'Both tables show a "Running Balance" column with color-coded values (green=positive, red=negative). Running balance component at top shows net flow.',
    files: 'src/frontend/app.js:34010-34037 (calculation), 34165-34168 (display component), 34327,34340 (purchase table), 34431,34465 (sales table)'
  },
  {
    pageKey: 'transactions',
    title: 'Transaction Summary Statistics for Filtered View',
    description: 'Transaction stats (total count, total amount, avg amount, vendor count) recalculate AFTER filtering is applied. Hero section shows income, expenses, net cash flow, and additional metrics. Stats grid shows totals.',
    test: 'Go to Transactions > Apply a date filter (e.g., "Last 7 days") > Check that stats update',
    expected: 'Stats cards at top update to reflect only filtered transactions. Hero section metrics change. Active filter badge shown.',
    files: 'src/frontend/app.js:33983-33997 (stats after filter), 34086-34163 (hero metrics), 34170-34175 (stats grid)'
  },
  {
    pageKey: 'myShops',
    title: 'Shop Analytics with Sales Velocity and Conversion Rates',
    description: 'Performance Dashboard on My Shops page showing per-platform analytics table with sales, revenue, avg sale price, conversion rate, sales/day velocity, avg days to sell, return rate, and net revenue. Highlights best platform.',
    test: 'Go to My Shops > Scroll to "Performance Dashboard" section (requires 2+ connected shops)',
    expected: 'Table shows each platform with conversion %, sales/day velocity, avg days to sell, return rate. Best platform badge shown in header.',
    files: 'src/frontend/app.js:23233-23290 (performance dashboard section with velocity and conversion columns)'
  },
  {
    pageKey: 'inventory',
    title: 'Inventory Age Display (Days Since Acquisition)',
    description: 'Per-item age badges in inventory table (Fresh/Aging/Stale with day counts). Aggregate stats show stale items count and average age. Column configurable via column picker. Age sorting supported.',
    test: 'Go to Inventory > Check "Age" column in table > Check stat cards for "Stale Stock" and "Avg Age"',
    expected: 'Table shows per-item age badge (green=Fresh <30d, yellow=Aging 30-90d, red=Stale 90d+). Stats show stale count and avg age.',
    files: 'src/frontend/app.js:17495-17507 (stale/avg age calc), 17600-17622 (stat cards), 17728-17730 (age header), 17828-17855 (age cell with badge)'
  },
  {
    pageKey: 'myListings',
    title: 'Relist Button for Expired/Stale Listings',
    description: 'Contextual "Relist Now" button appears in the dropdown menu for stale listings (>30 days old with low activity). Full relisting system with Smart Relisting page, rules, queue, and performance tracking.',
    test: 'Go to My Listings > Find a stale listing (shows "Stale" badge) > Click "..." menu > Look for "Relist Now"',
    expected: 'Stale listings show orange "Relist Now" option in dropdown menu. Clicking triggers relist API call. Smart Relisting page available for bulk management.',
    files: 'src/frontend/app.js:18439-18442 (relist button in dropdown), 53873-53896 (relistListing handler), 33262+ (smartRelisting page)'
  },
  {
    pageKey: 'imageBank',
    title: 'AI Photo Editor Button and Modal',
    description: 'AI Photo Editor accessible from Image Bank page. Opens fullscreen overlay with image upload, AI-powered editing tools (remove background, enhance, crop, filter). Photo editor setup workflow with preview.',
    test: 'Go to Image Bank > Click on an image or use "AI Photo Editor" button > Check editor opens',
    expected: 'Photo editor overlay opens with toolbar. Upload area shown if no image selected. Editing tools available for background removal, enhancement, cropping.',
    files: 'src/frontend/app.js:16371-16403 (photo editor overlay and modal HTML)'
  },
];

async function getPageBlocks(pageId) {
  let allBlocks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({ block_id: pageId, page_size: 100, start_cursor: cursor });
    allBlocks = allBlocks.concat(res.results);
    cursor = res.has_more ? res.next_cursor : null;
    await sleep(350);
  } while (cursor);
  return allBlocks;
}

function extractText(block) {
  const rt = block[block.type]?.rich_text;
  if (!rt) return '';
  return rt.map(r => r.plain_text).join('');
}

async function processPage(pageKey) {
  const page = PAGES[pageKey];
  console.log(`\n==============================`);
  console.log(`Processing: ${page.name} (${page.id})`);
  console.log(`==============================`);

  const blocks = await getPageBlocks(page.id);
  let waitingHeadingId = null;

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = extractText(block);
      if (text.includes('Waiting for Manual Approval')) waitingHeadingId = block.id;
    }
  }

  // Check off ALL remaining unchecked to-do items (they're all stale)
  const uncheckedTodos = blocks.filter(b => b.type === 'to_do' && !b.to_do.checked);
  let checkedOff = 0;
  for (const todo of uncheckedTodos) {
    try {
      await notion.blocks.update({ block_id: todo.id, to_do: { checked: true } });
      checkedOff++;
      console.log(`  [x] Checked off: "${extractText(todo).substring(0, 60)}..."`);
      await sleep(350);
    } catch (e) { console.log(`  [!] Failed to check off: ${e.message}`); }
  }
  console.log(`  Checked off ${checkedOff} to-do items`);

  // Add toggle blocks for new features
  const pageFeatures = newToggleFeatures.filter(f => f.pageKey === pageKey);
  if (!waitingHeadingId || pageFeatures.length === 0) {
    if (pageFeatures.length > 0) console.log(`  SKIPPING toggles - no waiting heading`);
    return;
  }

  const existingToggles = blocks.filter(b => b.type === 'toggle');
  const existingTitles = existingToggles.map(t => extractText(t).toLowerCase());

  let added = 0;
  for (const feature of pageFeatures) {
    const alreadyExists = existingTitles.some(t => t.includes(feature.title.toLowerCase().substring(0, 20)));
    if (alreadyExists) { console.log(`  [=] Already exists: "${feature.title}"`); continue; }

    const toggleBlock = {
      object: 'block', type: 'toggle',
      toggle: {
        rich_text: [
          { type: 'text', text: { content: '\u{1F527} ' } },
          { type: 'text', text: { content: feature.title }, annotations: { bold: true } }
        ],
        color: 'default',
        children: [
          { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: feature.description }, annotations: { italic: true, color: 'gray' } }] } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Test: ' }, annotations: { bold: true } }, { type: 'text', text: { content: feature.test } }] } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Expected: ' }, annotations: { bold: true } }, { type: 'text', text: { content: feature.expected } }] } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Files: ' }, annotations: { bold: true } }, { type: 'text', text: { content: feature.files }, annotations: { code: true } }] } }
        ]
      }
    };

    try {
      await notion.blocks.children.append({ block_id: page.id, children: [toggleBlock], after: waitingHeadingId });
      added++;
      console.log(`  [+] Added: "${feature.title}"`);
      await sleep(400);
    } catch (e) { console.log(`  [!] Failed to add "${feature.title}": ${e.message}`); }
  }
  if (added > 0) console.log(`  Added ${added} toggle blocks`);
}

async function main() {
  console.log('=== FINAL CLEANUP: Check off all remaining stale to-dos ===');
  console.log(`Pages to process: ${Object.keys(PAGES).length}`);
  console.log(`New toggle features: ${newToggleFeatures.length}`);

  for (const key of Object.keys(PAGES)) {
    await processPage(key);
  }

  console.log('\n=== CLEANUP COMPLETE ===');
}

main().catch(console.error);
