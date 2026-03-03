#!/usr/bin/env bun
// Batch update: Check off to-do items + add toggle blocks for Market Intel 9 items

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = {
  marketIntel: { id: '0ec3f0ec-f382-821f-a857-81e0f97aaee3', name: 'Market Intel' },
};

const features = [
  {
    pageKey: 'marketIntel',
    title: 'Price Tracking with Historical Price Charts',
    description: 'Price History Tracker section with watchlist. Users can add items to watch, see sparkline price charts, percentage changes, and remove items. Data stored in store.state.priceWatchlist.',
    test: 'Go to Market Intel > Scroll to "Price History Tracker" > Click "+ Watch Item" > Fill form > Submit',
    expected: 'Item appears in watchlist with sparkline chart, current price, and % change. Remove button works.',
    files: 'src/frontend/app.js:31528-31576 (HTML), 42326-42380 (addPriceWatch/savePriceWatch/removePriceWatch handlers)'
  },
  {
    pageKey: 'marketIntel',
    title: 'Market Trend Alerts for Significant Price Changes',
    description: 'Market Trend Alerts section showing 4 alert types: price surges, demand spikes, price drops, and new competitors. Each has severity level, description, and timestamp. Configurable via modal.',
    test: 'Go to Market Intel > Scroll to "Market Trend Alerts" > Click "Configure" > Toggle alerts on/off > Set threshold > Save',
    expected: 'Alert cards display with color-coded severity. Configuration modal saves preferences for which alerts to receive.',
    files: 'src/frontend/app.js:31578-31604 (HTML), 42382-42430 (configureMarketAlerts/saveMarketAlertConfig handlers)'
  },
  {
    pageKey: 'marketIntel',
    title: 'Competitor Monitoring to Track Specific Sellers',
    description: 'Full competitor tracking system with add/remove/compare functionality. Shows competitor table with item count, avg price, threat level, and activity status. Includes activity feed.',
    test: 'Go to Market Intel > Click "Track Competitor" > Fill form > Submit > View competitor in table > Compare',
    expected: 'Competitor appears in tracked table. "View" shows details modal. "Compare" shows side-by-side metrics. Activity feed updates.',
    files: 'src/frontend/app.js:31415-31494 (table HTML), 42140-42281 (addCompetitor/viewCompetitor/compareWithCompetitor handlers)'
  },
  {
    pageKey: 'marketIntel',
    title: 'Sold Listing Analysis Showing Average Sale Prices',
    description: 'Sold Listing Analysis section with 4 stat cards (total analyzed, avg sale price, avg sell time, sell-through rate) and a category breakdown table showing category, avg price, volume, and trend.',
    test: 'Go to Market Intel > Scroll to "Sold Listing Analysis" section',
    expected: 'Stats cards show summary metrics. Table shows per-category breakdown with colored trend indicators.',
    files: 'src/frontend/app.js:31605-31648 (stats cards and category table HTML)'
  },
  {
    pageKey: 'marketIntel',
    title: 'Price Suggestion Engine Based on Market Data',
    description: 'Interactive form with item title, category, and condition inputs. Clicking "Get Price Suggestion" runs AI analysis and displays suggested price range, comparable sales count, avg sell time, and confidence score.',
    test: 'Go to Market Intel > Scroll to "Price Suggestion Engine" > Enter item title > Select category/condition > Click "Get Price Suggestion"',
    expected: 'Loading spinner shown, then result card with price range ($low-$high), best price, comparable sales, avg sell time, and confidence %.',
    files: 'src/frontend/app.js:31650-31694 (form HTML), 42432-42478 (runPriceSuggestion handler)'
  },
  {
    pageKey: 'marketIntel',
    title: 'Seasonal Trend Analysis for Best Buy/Sell Times',
    description: 'Three category cards (Electronics, Collectibles, Clothing) each with 12-month bar charts showing price trends. Color-coded bars (green=high, red=low) with month labels.',
    test: 'Go to Market Intel > Scroll to "Seasonal Trend Analysis"',
    expected: 'Three category cards each show 12-month bar chart. Bars are color-coded by value. Best/worst months clearly visible.',
    files: 'src/frontend/app.js:31696-31738 (seasonal charts HTML with 12-month SVG bars)'
  },
  {
    pageKey: 'marketIntel',
    title: 'Market Saturation Index for Product Categories',
    description: 'Circular gauge showing 65% market saturation on the overview stats bar. Category Demand Index shows top 5 categories with demand bars, trend arrows, and competition levels.',
    test: 'Go to Market Intel > Check overview stats > Scroll to "Category Demand Index"',
    expected: 'Saturation gauge shows percentage with color. Demand index rows show category name, rising/falling trend, competition level, and demand bar.',
    files: 'src/frontend/app.js:31272-31300 (saturation gauge), 31326-31372 (demand index)'
  },
  {
    pageKey: 'marketIntel',
    title: 'Saved Searches with Automatic New-Listing Alerts',
    description: 'Saved Searches section with create/run/delete functionality. Each saved search shows name, query, category, price range, alert status toggle, last run date, and result count.',
    test: 'Go to Market Intel > Scroll to "Saved Searches" > Click "+ New Search" > Fill form > Submit > Run search > Remove search',
    expected: 'Search appears in list with details. "Run" button updates results and last run date. Alert toggle shown. Remove button works.',
    files: 'src/frontend/app.js:31740-31768 (HTML), 42480-42538 (addSavedSearch/saveSavedSearch/removeSavedSearch/runSavedSearch handlers)'
  },
  {
    pageKey: 'marketIntel',
    title: 'Market Comparison Across Different Platforms',
    description: 'Cross-platform comparison table showing 5 platforms (eBay, Mercari, Poshmark, Whatnot, Amazon) across 6 metrics: avg price, fees, sell time, buyer reach, seller protection, and rating. Color-coded status badges.',
    test: 'Go to Market Intel > Scroll to "Cross-Platform Comparison"',
    expected: 'Table shows 5 platforms with 6 metrics each. Fee percentages, sell times, and ratings displayed. Color-coded indicators for good/medium/poor values.',
    files: 'src/frontend/app.js:31770-31838 (comparison table HTML)'
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
  let todoHeadingId = null;
  let waitingHeadingId = null;

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = extractText(block);
      if (text.includes('Issues/Features to Work On') || text.includes('Issues / Features to Work On')) todoHeadingId = block.id;
      if (text.includes('Waiting for Manual Approval')) waitingHeadingId = block.id;
    }
  }

  console.log(`  Todo heading: ${todoHeadingId ? 'found' : 'NOT FOUND'}`);
  console.log(`  Waiting heading: ${waitingHeadingId ? 'found' : 'NOT FOUND'}`);

  const pageFeatures = features.filter(f => f.pageKey === pageKey);
  console.log(`  Features to process: ${pageFeatures.length}`);

  // Check off matching to-do items
  const todoBlocks = blocks.filter(b => b.type === 'to_do' && !b.to_do.checked);
  let checkedOff = 0;
  for (const todo of todoBlocks) {
    const todoText = extractText(todo).toLowerCase();
    for (const feature of pageFeatures) {
      const keywords = feature.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matchCount = keywords.filter(kw => todoText.includes(kw)).length;
      if (matchCount >= 2 || todoText.includes(feature.title.toLowerCase().substring(0, 20))) {
        try {
          await notion.blocks.update({ block_id: todo.id, to_do: { checked: true } });
          checkedOff++;
          console.log(`  [x] Checked off: "${extractText(todo).substring(0, 60)}..."`);
          await sleep(350);
        } catch (e) { console.log(`  [!] Failed to check off: ${e.message}`); }
        break;
      }
    }
  }
  console.log(`  Checked off ${checkedOff} to-do items`);

  // Add toggle blocks
  if (!waitingHeadingId) { console.log(`  SKIPPING toggles - no waiting heading`); return; }

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
  console.log(`  Added ${added} toggle blocks`);

  // Update page title
  try {
    const pageData = await notion.pages.retrieve({ page_id: page.id });
    const currentTitle = pageData.properties.title?.title?.[0]?.plain_text || page.name;
    if (!currentTitle.includes('(Items to Approve)')) {
      await notion.pages.update({ page_id: page.id, properties: { title: { title: [{ text: { content: `${page.name} (Items to Approve)` } }] } } });
      console.log(`  Title updated to: "${page.name} (Items to Approve)"`);
    } else { console.log(`  Title already has suffix`); }
    await sleep(350);
  } catch (e) { console.log(`  [!] Failed to update title: ${e.message}`); }
}

async function main() {
  console.log('=== Batch Notion Update: Market Intel (9 items) ===');
  console.log(`Total features: ${features.length}`);

  const pageKeys = [...new Set(features.map(f => f.pageKey))];
  for (const key of pageKeys) { await processPage(key); }

  console.log('\n=== DONE ===');
  const summary = pageKeys.map(k => `${PAGES[k].name}: ${features.filter(f => f.pageKey === k).length}`).join(', ');
  console.log(`Summary: ${summary}`);
}

main().catch(console.error);
