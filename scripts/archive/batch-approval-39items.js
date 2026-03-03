#!/usr/bin/env bun
// Batch update: Check off to-do items + add toggle blocks for 39 items
// Categories: Dashboard(1), Inventory(2), Image Bank(1), Help & Support(3),
//   My Listings(4), Orders(4), Offers(4), Automations(4), Size Charts(8), My Shops(8)

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Page IDs
const PAGES = {
  dashboard: { id: '29f3f0ec-f382-83a6-8d1c-01d6640c22b8', name: 'Dashboard' },
  inventory: { id: '20a3f0ec-f382-82bc-8d59-01f332e4e196', name: 'Inventory' },
  imageBank: { id: '48d3f0ec-f382-83e1-9170-015cab35fd27', name: 'Image Bank' },
  helpSupport: { id: '3343f0ec-f382-820e-9c06-0141c79b7ed4', name: 'Help & Support' },
  myListings: { id: '19f3f0ec-f382-83ca-8fe4-014a1e665539', name: 'My Listings' },
  orders: { id: '2fd3f0ec-f382-836b-8589-81252121f2bb', name: 'Orders' },
  offers: { id: 'e313f0ec-f382-8390-a4b3-8173de396b3f', name: 'Offers' },
  automations: { id: '8b83f0ec-f382-8315-9ce0-01a7e520599c', name: 'Automations' },
  sizeCharts: { id: 'de93f0ec-f382-8351-920d-81a185740201', name: 'Size Charts' },
  myShops: { id: '9513f0ec-f382-8344-8d4f-01097038fb0b', name: 'My Shops' },
};

// All 39 features
const features = [
  // DASHBOARD (1 item)
  {
    pageKey: 'dashboard',
    title: 'CSS Fix: Order/Offer Button Visibility',
    description: 'Fixed .table .btn-ghost svg stroke from #000000 to #ffffff so icons are visible on dark table backgrounds. Also fixed modal button override to exclude btn-error, btn-success, btn-ghost, and modal-close classes.',
    test: 'Go to Orders/Offers > Check action buttons in table rows > Click delete/cancel buttons in modals',
    expected: 'Table action button icons visible. Modal error/success/ghost buttons retain correct styling.',
    files: 'src/frontend/styles/main.css:285,345'
  },

  // INVENTORY (2 items)
  {
    pageKey: 'inventory',
    title: 'Inventory Age Tracking',
    description: 'Items display age since acquisition with color-coded indicators. Fresh items (green), aging items (yellow), stale items (red).',
    test: 'Go to Inventory > Check age column/indicator on items',
    expected: 'Items show days since added with appropriate color coding based on age.',
    files: 'src/frontend/app.js (inventory page rendering)'
  },
  {
    pageKey: 'inventory',
    title: 'Inventory Condition Grading System',
    description: 'Items have condition grades (New, Like New, Good, Fair, Poor) with visual indicators and grade-based pricing suggestions.',
    test: 'Go to Inventory > Check condition field on items > Edit item condition',
    expected: 'Condition grades display with visual badges. Condition affects pricing suggestions.',
    files: 'src/frontend/app.js (inventory item cards)'
  },

  // IMAGE BANK (1 item)
  {
    pageKey: 'imageBank',
    title: 'Bulk Image Operations',
    description: 'Select multiple images for bulk operations like move, tag, delete. Multi-select with checkboxes and bulk action toolbar.',
    test: 'Go to Image Bank > Select multiple images > Use bulk action toolbar',
    expected: 'Multi-select works. Bulk move, tag, and delete operations function correctly.',
    files: 'src/frontend/app.js (image bank page)'
  },

  // HELP & SUPPORT (3 items)
  {
    pageKey: 'helpSupport',
    title: 'Live Chat Widget',
    description: 'Real-time chat support widget accessible from Help page. Shows agent greeting, supports message exchange with simulated responses.',
    test: 'Go to Help & Support > Click Live Chat card > Send a message',
    expected: 'Chat modal opens with support agent greeting. Messages send and receive simulated responses.',
    files: 'src/frontend/app.js (openLiveChat, sendChatMessage handlers)'
  },
  {
    pageKey: 'helpSupport',
    title: 'Interactive Walkthroughs',
    description: 'Step-by-step tutorial system for 6 pages (Inventory, Listings, Orders, Analytics, Automations, Image Bank). Progress bar, navigation, and contextual tips.',
    test: 'Go to Help > Click any walkthrough tutorial > Navigate through steps',
    expected: 'Walkthrough modal shows with step counter, progress bar, instructions, and next/previous navigation. Completes with link to relevant page.',
    files: 'src/frontend/app.js (startWalkthrough, _showWalkthroughStep handlers)'
  },
  {
    pageKey: 'helpSupport',
    title: 'Contextual Help Tooltips',
    description: 'Help icons and tooltips throughout the app that explain features in context. Hover or click for quick explanations.',
    test: 'Navigate various pages > Look for help icons > Hover/click for tooltips',
    expected: 'Help tooltips appear on hover with relevant explanations for the current context.',
    files: 'src/frontend/app.js (help components)'
  },

  // MY LISTINGS (4 items)
  {
    pageKey: 'myListings',
    title: 'Price Drop Scheduler (Backend Persistence)',
    description: 'Price drop scheduler now persists to backend via POST /listings/:id/schedule-price-drop. Schedule stored in platform_specific_data JSON field.',
    test: 'Go to Listings > Expand a listing > Set price drop schedule > Refresh page',
    expected: 'Price drop schedule saves to backend and persists across page refreshes.',
    files: 'src/backend/routes/listings.js, src/frontend/app.js (savePriceDropSchedule)'
  },
  {
    pageKey: 'myListings',
    title: 'Competitor Pricing Analysis',
    description: 'View competitor pricing for any listing. Shows average, min, and max prices from similar sales in the market. Loaded on demand from backend.',
    test: 'Go to Listings > Expand a listing > Click "Load Competitor Pricing" button',
    expected: 'Competitor pricing section shows avg, min, max prices from similar items. Data from backend analysis.',
    files: 'src/backend/routes/listings.js (competitor-pricing endpoint), src/frontend/app.js (loadCompetitorPricing)'
  },
  {
    pageKey: 'myListings',
    title: 'Time-to-Sell Estimator',
    description: 'Estimates days to sell based on historical data with price factor adjustment. Backend analyzes past sales in same category.',
    test: 'Go to Listings > Expand a listing > Click "Estimate Time to Sell" button',
    expected: 'Shows estimated days to sell, sample size used, and confidence indicator. Price factor adjusts estimate.',
    files: 'src/backend/routes/listings.js (time-to-sell endpoint), src/frontend/app.js (loadTimeToSell)'
  },
  {
    pageKey: 'myListings',
    title: 'Listing Draft Auto-Save',
    description: 'Listing drafts auto-save periodically while editing to prevent data loss. Recovery available if browser closes unexpectedly.',
    test: 'Start creating a listing > Type details > Check for auto-save indicator',
    expected: 'Draft auto-saves at regular intervals. Can recover draft on next visit.',
    files: 'src/frontend/app.js (listing form handlers)'
  },

  // ORDERS (4 items)
  {
    pageKey: 'orders',
    title: 'Batch Ship by Region',
    description: 'Groups orders by state/region for batch shipping label creation. Shows order count per region with one-click batch label generation.',
    test: 'Go to Orders > Click dropdown > Select "Batch Ship by Region" > Click batch label button for a region',
    expected: 'Modal groups orders by state. Shows count per region. Batch label creation triggers for selected region.',
    files: 'src/frontend/app.js (showBatchShipByRegion, batchCreateLabelsForRegion handlers)'
  },
  {
    pageKey: 'orders',
    title: 'Order Map Visualization',
    description: 'Bar chart visualization of orders by geographic region. Shows order distribution across US regions.',
    test: 'Go to Orders > Click dropdown > Select "Order Map"',
    expected: 'Modal displays horizontal bar chart showing order counts per US region (Northeast, Southeast, Midwest, etc.).',
    files: 'src/frontend/app.js (showOrderMap handler)'
  },
  {
    pageKey: 'orders',
    title: 'Split Shipment Support',
    description: 'Orders with multiple items can be split into separate shipments. Track individual package tracking numbers.',
    test: 'View multi-item order > Check split shipment option',
    expected: 'Split shipment option available. Can create separate tracking for different packages.',
    files: 'src/frontend/app.js (order detail handlers)'
  },
  {
    pageKey: 'orders',
    title: 'Order Priority Flags',
    description: 'Mark orders with priority levels (urgent, high, normal, low). Priority affects sort order and visual indicators.',
    test: 'Go to Orders > Flag an order with priority > Check sort order',
    expected: 'Priority flags display with color indicators. Priority orders sort to top.',
    files: 'src/frontend/app.js (order page rendering)'
  },

  // OFFERS (4 items)
  {
    pageKey: 'offers',
    title: 'Counter-Offer Suggestions',
    description: 'AI-suggested counter-offer prices based on item value, market data, and buyer history.',
    test: 'View an incoming offer > Check counter-offer suggestion',
    expected: 'Suggested counter price shown with reasoning based on market analysis.',
    files: 'src/frontend/app.js (offer detail view)'
  },
  {
    pageKey: 'offers',
    title: 'Bulk Offer Response',
    description: 'Select multiple offers and respond in bulk (accept all, decline all, or counter with percentage).',
    test: 'Go to Offers > Select multiple > Use bulk action buttons',
    expected: 'Bulk selection works. Can accept, decline, or counter multiple offers at once.',
    files: 'src/frontend/app.js (offer page handlers)'
  },
  {
    pageKey: 'offers',
    title: 'Offer Expiration Timer',
    description: 'Offers display countdown timers showing time remaining before expiration. Visual urgency increases as deadline approaches.',
    test: 'View offers with expiration dates > Check countdown display',
    expected: 'Countdown timers visible. Color changes from green to yellow to red as deadline approaches.',
    files: 'src/frontend/app.js (offer card rendering)'
  },
  {
    pageKey: 'offers',
    title: 'Offer History per Item',
    description: 'View complete offer history for any item. Shows all past offers, counter-offers, and outcomes.',
    test: 'View an item > Check offer history section',
    expected: 'Complete offer history shown chronologically with prices, dates, and outcomes.',
    files: 'src/frontend/app.js (item offer history section)'
  },

  // AUTOMATIONS (4 items)
  {
    pageKey: 'automations',
    title: 'Conditional Logic for Automations',
    description: 'Add if/else conditions to automations. Conditions include price, age, views, likes thresholds with configurable operators (>, <, =, >=, <=).',
    test: 'Go to Automations > Configure any automation > Add conditions in Conditional Logic section',
    expected: 'Can add/remove conditions with field, operator, and value. Multiple conditions supported.',
    files: 'src/frontend/app.js (addAutomationCondition, removeAutomationCondition, saveAutomationConfig)'
  },
  {
    pageKey: 'automations',
    title: 'Automation Error Handling',
    description: 'Configure error handling behavior: retry on failure, max retries, retry delay, failure notifications, and on-failure actions (stop, skip, continue).',
    test: 'Go to Automations > Configure automation > Check Error Handling section',
    expected: 'Error handling options display: on-failure action, max retries, retry delay, notification toggle.',
    files: 'src/frontend/app.js (automation config modal, saveAutomationConfig)'
  },
  {
    pageKey: 'automations',
    title: 'Automation Run History',
    description: 'View detailed history of automation runs including timestamps, success/failure status, and items affected.',
    test: 'Go to Automations > Check run history for an active automation',
    expected: 'Run history shows recent executions with status, timing, and affected items.',
    files: 'src/frontend/app.js (automation history section)'
  },
  {
    pageKey: 'automations',
    title: 'Automation Templates/Presets',
    description: 'Pre-built automation templates organized by category (Sharing, Pricing, Inventory, Marketing). One-click setup with customizable parameters.',
    test: 'Go to Automations > Browse preset categories > Configure a preset',
    expected: 'Preset categories display with descriptions. Click to configure with pre-filled settings.',
    files: 'src/frontend/app.js (automation presets section)'
  },

  // SIZE CHARTS (8 items)
  {
    pageKey: 'sizeCharts',
    title: 'Brand-Specific Size Guides',
    description: 'Detailed size charts for 8 major brands: Nike, Adidas, Levi\'s, Ralph Lauren, Gucci, Zara, H&M, Gap. Each with brand-specific size runs and tips.',
    test: 'Go to Size Charts > Click any brand in Brand-Specific Guides section',
    expected: 'Modal shows brand logo, size chart table, and brand-specific sizing tips.',
    files: 'src/frontend/app.js (brandSizeData, showBrandSizeGuide handler)'
  },
  {
    pageKey: 'sizeCharts',
    title: 'Interactive Measurement Guide with Body Diagram',
    description: 'Visual SVG body diagram showing where to measure bust, waist, and hips. Step-by-step instructions for accurate measurements.',
    test: 'Go to Size Charts > Scroll to Measurement Guide section',
    expected: 'SVG body diagram displays with measurement lines. Instructions for bust, waist, and hips measurements.',
    files: 'src/frontend/app.js (size charts page, SVG diagram)'
  },
  {
    pageKey: 'sizeCharts',
    title: 'Size Recommendation Tool',
    description: 'Enter bust, waist, and hips measurements to get personalized size recommendations across US, EU, and UK systems.',
    test: 'Go to Size Charts > Enter measurements in recommendation tool > Click Get Recommendation',
    expected: 'Recommended size displays for US, EU, and UK with measurement summary.',
    files: 'src/frontend/app.js (getSizeRecommendation handler)'
  },
  {
    pageKey: 'sizeCharts',
    title: 'Auto-Link Size Charts to Listings',
    description: 'One-click button to automatically link appropriate size charts to all eligible listings based on item category.',
    test: 'Go to Size Charts > Click "Auto-Link to Listings" button',
    expected: 'Success message confirming size charts linked to eligible listings by category.',
    files: 'src/frontend/app.js (autoLinkSizeCharts handler)'
  },
  {
    pageKey: 'sizeCharts',
    title: 'Size Availability Heatmap',
    description: 'Visual heatmap showing inventory quantity per size across all inventory. Green = in stock, yellow = low, red = out of stock.',
    test: 'Go to Size Charts > Scroll to Availability Heatmap section',
    expected: 'Heatmap grid displays with color-coded cells showing inventory levels per size.',
    files: 'src/frontend/app.js (size charts page, heatmap section)'
  },
  {
    pageKey: 'sizeCharts',
    title: 'Custom Measurement Fields',
    description: 'Define custom measurement fields (Sleeve Length, Rise, Neck, etc.) with add/remove and unit selection. Saves to state.',
    test: 'Go to Size Charts > Add/remove custom measurement fields > Save',
    expected: 'Custom fields display with name input, unit selector, and remove button. Fields persist after save.',
    files: 'src/frontend/app.js (addCustomMeasurementField, removeCustomMeasurementField, saveCustomMeasurementFields)'
  },
  {
    pageKey: 'sizeCharts',
    title: 'International Size Conversions (JP/CN)',
    description: 'Added JP and CN size columns to women\'s clothing size charts for international marketplace support.',
    test: 'Go to Size Charts > View Women\'s Clothing chart > Check JP and CN columns',
    expected: 'JP and CN size columns display alongside existing US, UK, EU columns.',
    files: 'src/frontend/app.js (sizeData women-clothing headers and rows)'
  },
  {
    pageKey: 'sizeCharts',
    title: 'Size Chart QR Code and Copy',
    description: 'Generate QR codes for size charts and copy chart data as tab-separated values for easy sharing and pasting.',
    test: 'Go to Size Charts > Click QR Code button or Copy button on any chart',
    expected: 'QR code modal displays. Copy function copies chart data to clipboard in TSV format.',
    files: 'src/frontend/app.js (generateSizeQR, copySizeChart handlers)'
  },

  // MY SHOPS (8 items)
  {
    pageKey: 'myShops',
    title: 'Shop-Specific Branding',
    description: 'Customize branding per shop: logo URL, primary color, tagline, banner text, and bio. Visual branding cards on shops page.',
    test: 'Go to My Shops > Click "Edit Branding" on any connected shop > Fill in details > Save',
    expected: 'Branding modal with logo, color picker, tagline, banner, and bio fields. Saves and displays on shop card.',
    files: 'src/frontend/app.js (showShopBranding, saveShopBranding handlers, shop branding section)'
  },
  {
    pageKey: 'myShops',
    title: 'Performance Dashboard',
    description: 'Cross-platform comparison table showing sales count, revenue, avg sale price, conversion rate, sales velocity, avg days to sell, return rate, and net revenue.',
    test: 'Go to My Shops > Scroll to Performance Dashboard (requires 2+ connected shops)',
    expected: 'Table displays all connected shops with metrics. Highlights top-performing platform.',
    files: 'src/frontend/app.js (performance dashboard section in shops page)'
  },
  {
    pageKey: 'myShops',
    title: 'Multi-Shop Inventory Sync',
    description: 'Configure sync settings per platform: enable/disable, sync mode (two-way, push-only, pull-only), frequency, quantity sync, and price sync.',
    test: 'Go to My Shops > Click "Sync Settings" > Configure per platform > Save',
    expected: 'Sync settings modal with per-platform configs. Cards show sync status. Settings persist.',
    files: 'src/frontend/app.js (showMultiShopSyncSettings, saveMultiShopSyncSettings, showSyncConflicts handlers)'
  },
  {
    pageKey: 'myShops',
    title: 'Marketplace Listing Requirements',
    description: 'Quick reference cards showing listing requirements per platform: photo limits, title/description limits, categories, and shipping options. Full guide modals available.',
    test: 'Go to My Shops > Scroll to Marketplace Listing Requirements > Click "View Full Guide"',
    expected: 'Requirement cards show per-platform limits. Full guide modal shows detailed photo, title, description, pricing, shipping, category, and pro tips.',
    files: 'src/frontend/app.js (showMarketplaceRequirements handler, requirements section)'
  },
  {
    pageKey: 'myShops',
    title: 'Shop Health Dashboard',
    description: 'Health score indicators per connected shop with overall health overview section. Scores based on sales activity and platform metrics.',
    test: 'Go to My Shops > Check Shop Health Overview section and per-card health badges',
    expected: 'Health scores display as percentage badges on shop cards and in dedicated health overview section.',
    files: 'src/frontend/app.js (shopHealthDashboard, health score in shop cards)'
  },
  {
    pageKey: 'myShops',
    title: 'Platform Fee Comparison',
    description: 'Comprehensive fee comparison showing gross revenue, total fees, net revenue, and avg fee rate across all platforms with per-platform breakdown bars.',
    test: 'Go to My Shops > Check Platform Fee Summary card',
    expected: 'Fee summary shows 4 stat cards (gross, fees, net, avg rate) plus per-platform bar chart.',
    files: 'src/frontend/app.js (platform fee summary section in shops page)'
  },
  {
    pageKey: 'myShops',
    title: 'Vacation Mode',
    description: 'Toggle vacation mode to pause all listings across all platforms. Shows prominent banner when active with one-click deactivation.',
    test: 'Go to My Shops > Click "Vacation Mode" button > Verify banner > Click "End Vacation"',
    expected: 'Vacation mode activates with warning banner. All quick actions accessible. End button deactivates.',
    files: 'src/frontend/app.js (toggleVacationMode handler, vacation mode banner)'
  },
  {
    pageKey: 'myShops',
    title: 'Cross-Listing and Bulk Listing',
    description: 'Cross-list items across multiple platforms and create bulk listings from inventory. Quick action buttons on shops page.',
    test: 'Go to My Shops > Click "Cross-List" or "Bulk List" quick actions',
    expected: 'Cross-list and bulk list modals open with platform selection and item configuration.',
    files: 'src/frontend/app.js (showCrossListModal, showBulkListing handlers)'
  },
];

async function getPageBlocks(pageId) {
  let allBlocks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    });
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

  // Find section headings
  let todoHeadingId = null;
  let waitingHeadingId = null;

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = extractText(block);
      if (text.includes('Issues/Features to Work On') || text.includes('Issues / Features to Work On')) {
        todoHeadingId = block.id;
      }
      if (text.includes('Waiting for Manual Approval')) {
        waitingHeadingId = block.id;
      }
    }
  }

  console.log(`  Todo heading: ${todoHeadingId ? 'found' : 'NOT FOUND'}`);
  console.log(`  Waiting heading: ${waitingHeadingId ? 'found' : 'NOT FOUND'}`);

  // Get features for this page
  const pageFeatures = features.filter(f => f.pageKey === pageKey);
  console.log(`  Features to process: ${pageFeatures.length}`);

  // Step 1: Check off matching to-do items
  const todoBlocks = blocks.filter(b => b.type === 'to_do' && !b.to_do.checked);
  let checkedOff = 0;

  for (const todo of todoBlocks) {
    const todoText = extractText(todo).toLowerCase();

    for (const feature of pageFeatures) {
      const keywords = feature.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matchCount = keywords.filter(kw => todoText.includes(kw)).length;

      if (matchCount >= 2 || todoText.includes(feature.title.toLowerCase().substring(0, 20))) {
        try {
          await notion.blocks.update({
            block_id: todo.id,
            to_do: { checked: true }
          });
          checkedOff++;
          console.log(`  [x] Checked off: "${extractText(todo).substring(0, 60)}..."`);
          await sleep(350);
        } catch (e) {
          console.log(`  [!] Failed to check off: ${e.message}`);
        }
        break;
      }
    }
  }
  console.log(`  Checked off ${checkedOff} to-do items`);

  // Step 2: Add toggle blocks to "Waiting for Manual Approval"
  if (!waitingHeadingId) {
    console.log(`  SKIPPING toggles - no "Waiting for Manual Approval" heading found`);
    return;
  }

  // Check which features already exist as toggles
  const existingToggles = blocks.filter(b => b.type === 'toggle');
  const existingTitles = existingToggles.map(t => extractText(t).toLowerCase());

  let added = 0;
  for (const feature of pageFeatures) {
    const alreadyExists = existingTitles.some(t => t.includes(feature.title.toLowerCase().substring(0, 20)));
    if (alreadyExists) {
      console.log(`  [=] Already exists: "${feature.title}"`);
      continue;
    }

    const toggleBlock = {
      object: 'block',
      type: 'toggle',
      toggle: {
        rich_text: [
          { type: 'text', text: { content: '\u{1F527} ' } },
          { type: 'text', text: { content: feature.title }, annotations: { bold: true } }
        ],
        color: 'default',
        children: [
          {
            object: 'block', type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: feature.description }, annotations: { italic: true, color: 'gray' } }]
            }
          },
          {
            object: 'block', type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                { type: 'text', text: { content: 'Test: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: feature.test } }
              ]
            }
          },
          {
            object: 'block', type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                { type: 'text', text: { content: 'Expected: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: feature.expected } }
              ]
            }
          },
          {
            object: 'block', type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                { type: 'text', text: { content: 'Files: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: feature.files }, annotations: { code: true } }
              ]
            }
          }
        ]
      }
    };

    try {
      await notion.blocks.children.append({
        block_id: page.id,
        children: [toggleBlock],
        after: waitingHeadingId,
      });
      added++;
      console.log(`  [+] Added: "${feature.title}"`);
      await sleep(400);
    } catch (e) {
      console.log(`  [!] Failed to add "${feature.title}": ${e.message}`);
    }
  }
  console.log(`  Added ${added} toggle blocks`);

  // Step 3: Update page title with "(Items to Approve)" suffix
  try {
    const pageData = await notion.pages.retrieve({ page_id: page.id });
    const currentTitle = pageData.properties.title?.title?.[0]?.plain_text || page.name;

    if (!currentTitle.includes('(Items to Approve)')) {
      await notion.pages.update({
        page_id: page.id,
        properties: {
          title: {
            title: [{ text: { content: `${page.name} (Items to Approve)` } }]
          }
        }
      });
      console.log(`  Title updated to: "${page.name} (Items to Approve)"`);
    } else {
      console.log(`  Title already has "(Items to Approve)" suffix`);
    }
    await sleep(350);
  } catch (e) {
    console.log(`  [!] Failed to update title: ${e.message}`);
  }
}

// Main
async function main() {
  console.log('=== Batch Notion Update: 39 Items ===');
  console.log('Categories: Dashboard, Inventory, Image Bank, Help & Support,');
  console.log('  My Listings, Orders, Offers, Automations, Size Charts, My Shops');
  console.log(`Total features: ${features.length}`);

  const pageKeys = [...new Set(features.map(f => f.pageKey))];
  console.log(`Pages to process: ${pageKeys.length}`);

  for (const key of pageKeys) {
    await processPage(key);
  }

  console.log('\n=== DONE ===');
  const summary = pageKeys.map(k => {
    const count = features.filter(f => f.pageKey === k).length;
    return `${PAGES[k].name}: ${count}`;
  }).join(', ');
  console.log(`Summary: ${summary}`);
}

main().catch(console.error);
