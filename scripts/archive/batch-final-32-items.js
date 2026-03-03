#!/usr/bin/env bun
// Batch update: Check off 32 remaining pending to-do items + add toggle blocks
// Covers: Image Bank (1), My Listings (2), Inventory (4), My Shops (3), Transactions (1),
//         Orders (1), Automations (1), Offers (1), Dashboard (1), Calendar (3),
//         Checklist (4), Analytics (2), Feedback (8)

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = {
  imageBank: { id: '48d3f0ec-f382-83e1-9170-015cab35fd27', name: 'Image Bank' },
  myListings: { id: '19f3f0ec-f382-83ca-8fe4-014a1e665539', name: 'My Listings' },
  inventory: { id: '20a3f0ec-f382-82bc-8d59-01f332e4e196', name: 'Inventory' },
  myShops: { id: '9513f0ec-f382-8344-8d4f-01097038fb0b', name: 'My Shops' },
  transactions: { id: '6623f0ec-f382-82c8-bcde-013c9b842ed0', name: 'Transactions' },
  orders: { id: '2fd3f0ec-f382-836b-8589-81252121f2bb', name: 'Orders' },
  automations: { id: '8b83f0ec-f382-8315-9ce0-01a7e520599c', name: 'Automations' },
  offers: { id: 'e313f0ec-f382-8390-a4b3-8173de396b3f', name: 'Offers' },
  dashboard: { id: '29f3f0ec-f382-83a6-8d1c-01d6640c22b8', name: 'Dashboard' },
  calendar: { id: '31c3f0ec-f382-82c5-88e3-01976e5de201', name: 'Calendar' },
  checklist: { id: '5933f0ec-f382-8364-891e-01899cddd9e2', name: 'Checklist' },
  analytics: { id: '31e3f0ec-f382-82fa-aac4-01dc57fd8b6f', name: 'Analytics' },
  feedback: { id: 'af63f0ec-f382-82c4-8030-013518f734e8', name: 'Feedback & Suggestions' },
};

const features = [
  // Image Bank (1)
  {
    pageKey: 'imageBank',
    title: 'Enhanced Storage Quota Indicator',
    description: 'Real storage quota with backend endpoint. GET /image-bank/storage-stats returns total_bytes, quota_bytes (5GB), percent_used. Frontend shows accurate storage bar with GB values. Scan Usage button triggers POST /image-bank/scan-usage to update usage counts.',
    test: 'Go to Image Bank > Check storage bar at top > Click "Scan Usage" quick action button',
    expected: 'Storage bar shows real usage from backend (not estimate). Scan Usage triggers scan and shows toast with results.',
    files: 'src/backend/routes/imageBank.js:676-776 (endpoints), src/frontend/app.js:26785-26796 (display), 60180-60204 (handlers), 61691-61694 (router)'
  },
  // My Listings (2)
  {
    pageKey: 'myListings',
    title: 'Enhanced Stale Listing Indicator with Days Count and Quick Relist',
    description: 'Stale listings show badge with exact days count (e.g. "Stale (45d)"). Badge color varies: green=Fresh <30d, yellow=Aging 30-90d, red=Stale 90d+. Quick "Relist Now" option in dropdown menu for stale items.',
    test: 'Go to My Listings > Find listing older than 30 days > Check badge > Click "..." menu',
    expected: 'Badge shows "Stale (Xd)" with color coding. Dropdown menu includes "Relist Now" for stale items.',
    files: 'src/frontend/app.js:18400-18423 (stale badge with days), 18439-18442 (relist button in dropdown)'
  },
  {
    pageKey: 'myListings',
    title: 'Automatic Price-Drop Scheduling',
    description: 'Schedule automatic price drops with timing options (daily/weekly/custom), percentage or fixed reduction, floor price, and recurring options. Full modal form with backend persistence via POST /api/listings/:id/schedule-price-drop.',
    test: 'Go to My Listings > Click "..." on a listing > Select "Schedule Price Drop" > Fill form > Save',
    expected: 'Modal shows schedule options. Saving creates scheduled drop. Price drop badge appears on listing.',
    files: 'src/frontend/app.js:45669-45886 (modal + handler), src/backend/routes/listings.js:977 (endpoint)'
  },
  // Inventory (4)
  {
    pageKey: 'inventory',
    title: 'Show Cost and Profit Margin in Inventory Table',
    description: 'Cost field in inventory data model with profit margin calculations. Dashboard profit gauge shows margin %. Import mapping supports cost field. Profit calculations use cost basis vs sale price.',
    test: 'Go to Inventory > Check table columns for cost > Go to Dashboard > Check profit gauge',
    expected: 'Cost data available in inventory. Profit gauge on dashboard shows margin percentage.',
    files: 'src/frontend/app.js:33726-33727 (import mapping), 9405 (profit margin widget), 11453 (profitGauge component)'
  },
  {
    pageKey: 'inventory',
    title: 'Fix Inventory Edit Save Functionality',
    description: 'Inventory edit modal with save functionality. Edit button opens modal, user modifies fields, save persists changes. Permission check for edit capability included.',
    test: 'Go to Inventory > Click edit icon on any item > Modify a field > Click Save',
    expected: 'Edit modal opens with current values. Changes save successfully. Item updates in table.',
    files: 'src/frontend/app.js:17361 (editItem handler), 38239 (edit permission check)'
  },
  {
    pageKey: 'inventory',
    title: 'Inventory Page Improvements and Import Fixes',
    description: 'Multiple import methods: CSV/TSV file upload, advanced import with column mapping, URL-based import. Dedicated inventoryImport.js backend route handles file processing and validation.',
    test: 'Go to Inventory > Click Import > Try CSV upload > Try URL import',
    expected: 'CSV upload parses and imports items. URL import fetches and processes data. Column mapping available for advanced import.',
    files: 'src/frontend/app.js:33783 (CSV/TSV), 35902 (advanced import), 45141 (URL import), src/backend/routes/inventoryImport.js'
  },
  {
    pageKey: 'inventory',
    title: 'Inventory Age Analysis',
    description: 'Per-item age badges (Fresh <30d green, Aging 30-90d yellow, Stale 90d+ red). Aggregate stats show stale items count and average age. Age column in table with sorting support.',
    test: 'Go to Inventory > Check "Age" column > Check stat cards for "Stale Stock" and "Avg Age"',
    expected: 'Age badges with day counts on each item. Stats cards show stale count and avg age.',
    files: 'src/frontend/app.js:17495-17507 (stale/avg age calc), 17600-17622 (stat cards), 17828-17855 (age cell with badge)'
  },
  // My Shops (3)
  {
    pageKey: 'myShops',
    title: 'Shop Vacation Mode Toggle',
    description: 'Toggle vacation mode for shops. When enabled, banner shows across My Shops page. State stored in store.state.vacationMode. Handler toggles state and shows confirmation toast.',
    test: 'Go to My Shops > Click vacation mode toggle > Check banner appears',
    expected: 'Toggle switches on/off. Yellow vacation banner appears when active. Toast confirms change.',
    files: 'src/frontend/app.js:22960-22970 (banner + state), 53701-53710 (toggleVacationMode handler)'
  },
  {
    pageKey: 'myShops',
    title: 'Shop-Level Fee Tracking',
    description: 'Per-shop fee tracking section in shop cards showing platform-specific fee rates (eBay 13.25%, Mercari 10%, etc.). Fee calculations include total fees, fee rate, and fee percentage. Performance dashboard includes fee analysis.',
    test: 'Go to My Shops > Check any shop card for "Platform Fee Tracking" section',
    expected: 'Each shop card shows fee rate, total fees, and net revenue after fees. Performance dashboard includes fee comparison.',
    files: 'src/frontend/app.js:22806 (fee rates), 23045 (fee calc), 23146-23147 (fee tracking section), 23236 (performance fees)'
  },
  {
    pageKey: 'myShops',
    title: 'Quick-Switch Between Shops',
    description: 'Shop quick-switch dropdown in navigation/header area. Connected shops listed for one-click switching. switchShop handler updates active shop context.',
    test: 'Go to My Shops > Look for shop quick-switch dropdown > Click a different shop',
    expected: 'Dropdown shows connected shops. Clicking switches active shop context.',
    files: 'src/frontend/app.js:14914-14949 (quick switch component + handler)'
  },
  // Transactions (1)
  {
    pageKey: 'transactions',
    title: 'Transaction Tagging with Custom Tags',
    description: 'Custom tag system for transactions. Tag filter bar at top of transactions page. Per-transaction tag display. Modal for adding/managing tags with custom tag creation. saveTransactionTags handler persists selections.',
    test: 'Go to Transactions > Click tag icon on a transaction > Add tags > Check filter bar',
    expected: 'Tag modal opens with preset and custom tag options. Tags display on transaction rows. Tag filter bar allows filtering by tag.',
    files: 'src/frontend/app.js:13574-13576 (tag display), 34407-34413 (tag filter bar), 58383-58460 (tag handlers)'
  },
  // Orders (1)
  {
    pageKey: 'orders',
    title: 'Add Sale Price and Profit Columns to Orders Table',
    description: 'Orders data model includes sale_price and profit fields. Visible columns configuration includes both columns. Order details show sale price with profit calculation.',
    test: 'Go to Orders > Check table for "Sale Price" and "Profit" columns',
    expected: 'Both columns visible in orders table with formatted currency values.',
    files: 'src/frontend/app.js:7672-7681 (data model), 25076 (visible columns)'
  },
  // Automations (1)
  {
    pageKey: 'automations',
    title: 'Conditional Logic in Automation Chains',
    description: 'Conditional fields module with show/hide logic for automation steps. Supports condition evaluation, field visibility toggling, and helper text for setup. Enables if/then branching in automation workflows.',
    test: 'Go to Automations > Create/edit an automation > Add conditional step',
    expected: 'Conditional logic options available in automation builder. Fields show/hide based on conditions.',
    files: 'src/frontend/app.js:3982-3998 (conditionalFields module), 60290 (conditional logic docs)'
  },
  // Offers (1)
  {
    pageKey: 'offers',
    title: 'Best Offer Badge Highlighting',
    description: 'Offers page calculates best offer percentage for each offer. Best offer row gets highlighted CSS class. Badge shows "Best Offer" indicator on the highest-value offer.',
    test: 'Go to Offers > Check for highlighted "Best Offer" badge on highest offer',
    expected: 'Best offer row has distinct styling. Badge shows percentage advantage over other offers.',
    files: 'src/frontend/app.js:19207-19215 (bestOfferPercent calc), 19467 (best-offer-row CSS class)'
  },
  // Dashboard (1)
  {
    pageKey: 'dashboard',
    title: 'Marketplace Price Trend Sparklines',
    description: 'SVG sparkline charts showing price trends inline. Sparkline generator creates mini line/bar charts with configurable colors. Used on dashboard widgets, prediction cards, and marketplace views.',
    test: 'Go to Dashboard > Check for sparkline mini-charts in widgets',
    expected: 'Small inline charts show price/sales trends. Multiple sparkline styles (line, bar) visible.',
    files: 'src/frontend/app.js:560-586 (sparkline generator), 5485-5511 (renderSparkline), 14172-14188 (priceTrendSparkline)'
  },
  // Calendar (3)
  {
    pageKey: 'calendar',
    title: 'Color-Coded Event Categories',
    description: 'Calendar events colored by type: sale=green, shipment=blue/purple, restock=yellow, live=red, custom=gray, expiration=amber. Both light and dark mode rules. Legend shows color coding.',
    test: 'Go to Calendar > Check events have different colors by type > Toggle dark mode > Verify colors still distinct',
    expected: 'Each event type has distinct color. Dark mode has matching semi-transparent versions. Legend explains colors.',
    files: 'src/frontend/styles/main.css:17840-17914 (light+dark mode event colors), src/frontend/app.js:25149-25159 (color assignments)'
  },
  {
    pageKey: 'calendar',
    title: 'Dark Mode Text Visibility for Calendar',
    description: 'Dark mode calendar fix: blanket override scoped to untyped events only via :not([class*="calendar-event-"]). Type-specific rules at 17880-17914 apply correctly. Day numbers, headers, and grid lines all have dark mode rules.',
    test: 'Toggle dark mode > Go to Calendar > Check all text is readable > Check events have correct type colors',
    expected: 'All calendar text visible in dark mode. Events keep type-specific colors. Grid lines, day numbers, headers all readable.',
    files: 'src/frontend/styles/main.css:9161-9178 (scoped override), 17880-17914 (type-specific dark rules), 903-944 (grid/header dark rules)'
  },
  {
    pageKey: 'calendar',
    title: 'Shipping Deadlines on Calendar',
    description: 'Shipping deadline events displayed on calendar with blue/purple color coding. Deadline data pulled from orders with expected shipping dates. Shows carrier and tracking info.',
    test: 'Go to Calendar > Look for shipping deadline events (blue/purple)',
    expected: 'Shipping deadlines appear as events with shipment color coding and deadline details.',
    files: 'src/frontend/app.js:25127-25137 (shipping deadline events)'
  },
  // Checklist (4)
  {
    pageKey: 'checklist',
    title: 'Quick Add Task Inline Input',
    description: 'Inline quick-add input at top of checklist for rapid task creation. quickAddTask function handles adding without opening full modal. Input auto-focuses for fast entry.',
    test: 'Go to Checklist > Find quick add input at top > Type task name > Press Enter',
    expected: 'Task added immediately without modal. Input clears and refocuses for next task.',
    files: 'src/frontend/app.js:50288 (quickAddTask function), 50730 (quick-add-task-input element)'
  },
  {
    pageKey: 'checklist',
    title: 'Checklist Templates for Common Workflows',
    description: 'Template selection interface with pre-built workflow templates. applyTemplate handler creates checklist from template definition. Template cards show name and description for one-click application.',
    test: 'Go to Checklist > Click "Templates" or "Use Template" > Select a template > Apply',
    expected: 'Template selection shows available workflows. Applying creates new checklist with pre-filled tasks.',
    files: 'src/frontend/app.js:12795 (template task application), 36623 (template cards UI), 54773 (applyTemplate handler)'
  },
  {
    pageKey: 'checklist',
    title: 'Sub-tasks / Nested Checklist Items',
    description: 'Full subtask system with expansion/collapse. Subtasks show under parent with indent. Progress tracking shows completed vs total subtasks. Add/delete subtask handlers.',
    test: 'Go to Checklist > Expand a task with subtasks > Add a subtask > Complete it',
    expected: 'Subtasks indent under parent. Progress bar shows completion. Add/delete subtask works.',
    files: 'src/frontend/app.js:25417-25472 (subtask rendering), 50434-50568 (subtask handlers)'
  },
  {
    pageKey: 'checklist',
    title: 'Checklist Item Notes and File Attachments',
    description: 'Notes field and file attachment support on checklist items. Notes display inline with item. Attachments shown with paperclip icon. Backend stores notes and attachments in checklist schema.',
    test: 'Go to Checklist > Click a task > Add a note > Attach a file',
    expected: 'Note saves and displays. Attachment uploads and shows with icon. Both persist on refresh.',
    files: 'src/frontend/app.js:25436-25437 (notes/attachments display), 42028-42070 (attachment handlers), src/backend/routes/checklists.js:57,65'
  },
  // Analytics (2)
  {
    pageKey: 'analytics',
    title: 'Quick Date Range Presets',
    description: 'Date range preset buttons: Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month. Button group at top of analytics for one-click date filtering.',
    test: 'Go to Analytics > Find date range presets > Click "Last 7 Days" > Check data updates',
    expected: 'Preset buttons visible. Clicking updates date range and refreshes all charts/data.',
    files: 'src/frontend/app.js:2151-2158 (date range presets), 46598-46603 (additional presets)'
  },
  {
    pageKey: 'analytics',
    title: 'Comparison Mode to Overlay Time Periods',
    description: 'Toggle comparison mode to overlay current period vs previous period on charts. Button toggles analyticsCompareMode state. Revenue trend chart shows dual lines when active. Comparison data overlaid with different styling.',
    test: 'Go to Analytics > Click "Compare" button > Check revenue chart shows two lines',
    expected: 'Compare button toggles on/off. When active, charts show current + previous period data overlaid.',
    files: 'src/frontend/app.js:20644 (compare toggle button), 21125-21148 (dual chart rendering), 52348 (toggleAnalyticsCompare handler)'
  },
  // Feedback (8)
  {
    pageKey: 'feedback',
    title: 'Feedback Roadmap Integration',
    description: 'Feedback items linked to roadmap features. Action card navigates to roadmap page. Feedback detail shows "Linked to Roadmap" badge when associated with a roadmap item.',
    test: 'Go to Feedback > Click "Roadmap" action card > Check feedback items for roadmap badges',
    expected: 'Roadmap action card navigates to roadmap. Linked feedback shows "Linked to Roadmap" badge.',
    files: 'src/frontend/app.js:33046 (roadmap action card), 43875 (roadmap badge on feedback), src/backend/routes/feedback.js:507,528'
  },
  {
    pageKey: 'feedback',
    title: 'Feedback Analytics Page',
    description: 'Dedicated feedback analytics page with submission trends, category breakdown, sentiment analysis, and response rate metrics. Accessible from feedback page action card.',
    test: 'Go to Feedback > Click "Analytics" action card > Check analytics page',
    expected: 'Analytics page shows charts and metrics for feedback data. Category and sentiment breakdowns visible.',
    files: 'src/frontend/app.js:33057 (analytics action card), 33118-33120 (feedbackAnalytics page), src/backend/routes/feedback.js:59-107'
  },
  {
    pageKey: 'feedback',
    title: 'Similar Feedback Suggestions While Typing',
    description: 'As user types feedback title, similar existing feedback shown below input. searchSimilarFeedback handler queries existing items. Helps prevent duplicate submissions.',
    test: 'Go to Feedback > Start typing in title field > Check for similar suggestions below',
    expected: 'Typing triggers search. Similar feedback appears in suggestion area with notification icon.',
    files: 'src/frontend/app.js:29479 (oninput handler), 29483-29487 (similar suggestions container), src/backend/routes/feedback.js:109-132'
  },
  {
    pageKey: 'feedback',
    title: 'Screenshot Attachment for Bug Reports',
    description: 'Screenshot upload section appears when "Bug Report" type selected. Image preview shown after upload. Screenshot stored as base64 and displayed in feedback detail view.',
    test: 'Go to Feedback > Select "Bug Report" type > Upload a screenshot > Submit',
    expected: 'Screenshot section appears for bug reports. Image preview shown. Screenshot visible in feedback detail.',
    files: 'src/frontend/app.js:29441 (type toggle), 29515-29516 (screenshot section), 43901 (screenshot display), src/backend/routes/feedback.js:452-468'
  },
  {
    pageKey: 'feedback',
    title: 'Anonymous Feedback Option',
    description: 'Checkbox to submit feedback anonymously. When checked, feedback shows "Anonymous" badge instead of username. Backend stores is_anonymous flag.',
    test: 'Go to Feedback > Check "Submit Anonymously" checkbox > Submit feedback > View it',
    expected: 'Anonymous checkbox available. Submitted feedback shows "Anonymous" badge.',
    files: 'src/frontend/app.js:29540 (anonymous checkbox), 43874 (anonymous badge), 54663 (is_anonymous in submit), src/backend/routes/feedback.js:38-49'
  },
  {
    pageKey: 'feedback',
    title: 'Admin Responses in Thread Format',
    description: 'Admin responses shown as threaded replies on feedback items. Each response has author, timestamp, and content. Thread format maintains conversation context.',
    test: 'Go to Feedback > View a feedback item with admin response > Check thread format',
    expected: 'Admin response appears below original feedback in thread style with author and timestamp.',
    files: 'src/frontend/app.js:7961-7965 (mock data with admin_response), src/backend/routes/feedback.js:221-285'
  },
  {
    pageKey: 'feedback',
    title: 'Feedback Categorization (Bug/Feature/Improvement/General)',
    description: 'Category selector in feedback form with Bug, Feature, Improvement, and General options. Category badge shown on feedback items. Filter by category supported.',
    test: 'Go to Feedback > Submit form > Select category > Check category badge on item',
    expected: 'Category dropdown with 4 options. Submitted feedback shows category badge. Filtering by category works.',
    files: 'src/frontend/app.js:29393 (category state), 29456-29457 (category selector), 29584 (category badge)'
  },
  {
    pageKey: 'feedback',
    title: 'Upvote/Downvote System for Feedback',
    description: 'Vote buttons on feedback items. voteFeedback handler toggles votes. Vote counts displayed. User impact section shows votes received.',
    test: 'Go to Feedback > Click upvote on a suggestion > Check count changes > Click downvote',
    expected: 'Vote buttons highlight when clicked. Counts update. User impact shows vote totals.',
    files: 'src/frontend/app.js:33097-33103 (vote buttons), 43758 (voteFeedback handler), 32893 (user impact stats)'
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

  // Add toggle blocks for features that don't already have them
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
  if (added > 0) console.log(`  Added ${added} toggle blocks`);

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
  console.log('=== Batch Notion Update: Final 32 Pending Items ===');
  console.log(`Total features: ${features.length}`);
  console.log(`Pages to process: ${Object.keys(PAGES).length}`);

  const pageKeys = [...new Set(features.map(f => f.pageKey))];
  for (const key of pageKeys) { await processPage(key); }

  console.log('\n=== DONE ===');
  const summary = pageKeys.map(k => `${PAGES[k].name}: ${features.filter(f => f.pageKey === k).length}`).join(', ');
  console.log(`Summary: ${summary}`);
}

main().catch(console.error);
