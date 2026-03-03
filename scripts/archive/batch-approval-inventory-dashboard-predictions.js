#!/usr/bin/env bun
// Batch update: Check off to-do items + add toggle blocks for 17 items
// Categories: Inventory(5), Dashboard(2), Predictions(10)

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = {
  inventory: { id: '20a3f0ec-f382-82bc-8d59-01f332e4e196', name: 'Inventory' },
  dashboard: { id: '29f3f0ec-f382-83a6-8d1c-01d6640c22b8', name: 'Dashboard' },
  predictions: { id: '5683f0ec-f382-82a1-b12d-8126d4b66058', name: 'Predictions' },
};

const features = [
  // INVENTORY (5 items - all already implemented)
  {
    pageKey: 'inventory',
    title: 'Inventory Age Display',
    description: 'Items show days since acquisition with color-coded badges: Fresh (0-7d green), Moderate (8-30d blue), Aging (31-90d yellow), Stale (91-180d orange), Deadstock (180+d red).',
    test: 'Go to Inventory > Check age column on items > Sort by age',
    expected: 'Age column shows with colored badges. Sorting works correctly.',
    files: 'src/frontend/app.js:17618-17751 (table column), 45380-45545 (age analysis handler)'
  },
  {
    pageKey: 'inventory',
    title: 'Cost and Profit Margin in Inventory Table',
    description: 'Inventory table shows cost price, profit amount, and profit margin percentage. Calculated from list_price and cost_price fields.',
    test: 'Go to Inventory > Check price column shows cost and profit info',
    expected: 'Price column displays list price, cost price, profit amount ($), and margin (%).',
    files: 'src/frontend/app.js:17664-17671 (price column rendering)'
  },
  {
    pageKey: 'inventory',
    title: 'Inventory Edit Save Functionality',
    description: 'Full edit modal with all fields (title, SKU, brand, category, size, color, condition, prices, quantity, location, status, description, notes). Saves to backend via PUT /inventory/:id.',
    test: 'Go to Inventory > Click Edit on any item > Modify fields > Save',
    expected: 'Edit modal opens with pre-filled data. Changes save successfully and persist after refresh.',
    files: 'src/frontend/app.js:34046-34194 (edit modal), 37749-37813 (updateItem handler)'
  },
  {
    pageKey: 'inventory',
    title: 'Inventory Page Improvements and Import Fixes',
    description: 'Enhanced inventory page with hero stats (Active, Drafts, Low Stock, Out of Stock, Stale, Avg Age), search/filter/column picker, import/export functionality.',
    test: 'Go to Inventory > Check hero stats > Use search > Try filters > Open column picker',
    expected: 'Stats cards show correct counts. Search filters items. Column picker toggles table columns. Import/export buttons functional.',
    files: 'src/frontend/app.js:17401-17576 (hero section, search, filters, column picker)'
  },
  {
    pageKey: 'inventory',
    title: 'Inventory Age Analysis Tool',
    description: 'Detailed age analysis modal showing distribution by age group (Fresh/Recent/Aging/Stale/Deadstock) with dollar values, bar charts, recommendations, and oldest item display.',
    test: 'Go to Inventory > Click Tools dropdown > Click "Age Analysis"',
    expected: 'Modal shows age distribution with visual bars, dollar totals per group, recommendations for stale/deadstock items.',
    files: 'src/frontend/app.js:45380-45545 (showInventoryAgeAnalysis handler)'
  },

  // DASHBOARD (2 items)
  {
    pageKey: 'dashboard',
    title: 'Marketplace Price Trend Sparklines',
    description: 'New dashboard widget showing top-selling items with price trend sparklines. Shows item name, current price, trend chart, and percentage change. Uses priceTrendSparkline component. Falls back to inventory items when no sales data.',
    test: 'Go to Dashboard > Enable "Price Trends" widget from widget manager > Check sparklines display',
    expected: 'Widget shows top items with mini sparkline charts, prices, and green/red percentage changes.',
    files: 'src/frontend/app.js (price-trends widget in dashboard, widgetManager)'
  },
  {
    pageKey: 'dashboard',
    title: 'Dashboard Widget Manager Enhancement',
    description: 'Price Trends widget added to widgetManager.defaultWidgets as configurable dashboard widget with collapse/expand support.',
    test: 'Go to Dashboard > Check widget list includes "Price Trends" > Toggle visibility',
    expected: 'Price Trends appears in widget list. Can be toggled on/off and collapsed/expanded.',
    files: 'src/frontend/app.js:9408 (widgetManager defaultWidgets)'
  },

  // PREDICTIONS (10 items)
  {
    pageKey: 'predictions',
    title: 'Confidence Scores with Factor Explanations',
    description: 'Each prediction card shows AI confidence percentage with collapsible factor breakdown: Market Data, Price Stability, Demand Signal, and Seasonality scores with descriptions.',
    test: 'Go to Predictions > Click "View confidence factors" on any prediction card',
    expected: 'Expandable section shows 4 factors with individual scores, progress bars, and descriptions of strongest factor.',
    files: 'src/frontend/app.js:30270-30343 (confidence factors in prediction cards)'
  },
  {
    pageKey: 'predictions',
    title: 'Prediction Accuracy Tracking',
    description: 'Accuracy tracking section showing success rate, total predictions made, best category, average price error, and monthly accuracy trend bar chart.',
    test: 'Go to Predictions > Scroll to Prediction Accuracy section',
    expected: 'Four stat cards (accuracy rate, predictions made, best category, avg error) plus monthly bar chart showing accuracy trend.',
    files: 'src/frontend/app.js (prediction accuracy section in predictions page)'
  },
  {
    pageKey: 'predictions',
    title: 'Inventory Demand Forecast (30/60/90 Days)',
    description: 'Three-column demand forecast showing projected demand by category (Tops, Bottoms, Shoes, Bags, Dresses, Accessories) for 30, 60, and 90-day periods with color-coded bars.',
    test: 'Go to Predictions > Scroll to "Demand Forecast by Period" section',
    expected: 'Three cards showing demand projections per category with green/yellow/red bars based on demand level.',
    files: 'src/frontend/app.js (demand forecast section in predictions page)'
  },
  {
    pageKey: 'predictions',
    title: 'Price Prediction Bands (Optimistic/Expected/Pessimistic)',
    description: 'Table showing pessimistic, expected, and optimistic price scenarios for each item. Includes visual range bar with current price indicator.',
    test: 'Go to Predictions > Scroll to "Price Prediction Bands" table',
    expected: 'Table shows 3 price scenarios per item with gradient range bar and current price marker.',
    files: 'src/frontend/app.js (price bands table in predictions page)'
  },
  {
    pageKey: 'predictions',
    title: 'What-If Scenario Modeling',
    description: 'Interactive scenario tool with price change slider (-30% to +30%), category filter, and time period selector. Calculates estimated revenue, sales count, days to sell, and profit impact.',
    test: 'Go to Predictions > Adjust What-If sliders > Click "Run Scenario"',
    expected: 'Results show projected revenue, sales, days to sell, and profit impact based on price change scenario.',
    files: 'src/frontend/app.js (what-if section + runWhatIfScenario handler)'
  },
  {
    pageKey: 'predictions',
    title: 'Trend Detection Alerts',
    description: 'Alert cards showing market condition changes: price increases, demand spikes, price drops, and market saturation. Color-coded by severity with icons and actionable messages.',
    test: 'Go to Predictions > Scroll to "Trend Alerts" section',
    expected: 'Alert cards display with category, change badge, description, and timestamp. Color-coded by type (green/blue/yellow/red).',
    files: 'src/frontend/app.js (trend alerts section in predictions page)'
  },
  {
    pageKey: 'predictions',
    title: 'Seasonal Adjustment Visualization',
    description: 'Monthly seasonality factor charts for Clothing, Shoes, and Electronics categories. Shows 12-month bar charts with current month highlighted. Factors above 1.0 indicate high-demand periods.',
    test: 'Go to Predictions > Scroll to "Seasonal Adjustments" section',
    expected: 'Three category charts with monthly bars. Current month highlighted. Hover shows exact factor values.',
    files: 'src/frontend/app.js (seasonal patterns section in predictions page)'
  },
  {
    pageKey: 'predictions',
    title: 'Prediction Explanations in Plain Language',
    description: 'AI explanation cards showing natural language descriptions of why prices are predicted to change. Cites demand levels, supply competition, and seasonal factors.',
    test: 'Go to Predictions > Scroll to "AI Explanations" section',
    expected: 'Cards show item name, percentage change, and plain language explanation of prediction reasoning.',
    files: 'src/frontend/app.js (AI explanations section in predictions page)'
  },
  {
    pageKey: 'predictions',
    title: 'Custom Prediction Model Configuration',
    description: 'Adjustable model weights via sliders: Market Data, Seasonal Trends, Demand Score, and Price History. Saves to state for use in future predictions.',
    test: 'Go to Predictions > Adjust weight sliders > Click "Save Config"',
    expected: 'Sliders update labels in real-time. Save persists weights. Future predictions use updated weights.',
    files: 'src/frontend/app.js (custom model config section + saveCustomModelConfig handler)'
  },
  {
    pageKey: 'predictions',
    title: 'Prediction Model Comparison',
    description: 'Side-by-side comparison of 3 prediction models: Market Comps, Seasonal AI, and Demand-Weighted. Shows accuracy percentage, speed, and approach description for each.',
    test: 'Go to Predictions > Scroll to "Model Comparison" section',
    expected: 'Three model cards with accuracy badges, speed indicators, and approach descriptions.',
    files: 'src/frontend/app.js (model comparison section in predictions page)'
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
  if (!waitingHeadingId) { console.log(`  SKIPPING toggles`); return; }

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
  console.log('=== Batch Notion Update: 17 Items ===');
  console.log('Categories: Inventory(5), Dashboard(2), Predictions(10)');
  console.log(`Total features: ${features.length}`);

  const pageKeys = [...new Set(features.map(f => f.pageKey))];
  for (const key of pageKeys) { await processPage(key); }

  console.log('\n=== DONE ===');
  const summary = pageKeys.map(k => `${PAGES[k].name}: ${features.filter(f => f.pageKey === k).length}`).join(', ');
  console.log(`Summary: ${summary}`);
}

main().catch(console.error);
