/**
 * Batch Notion Update Script (One-Time Use)
 *
 * Phase 1: Delete misplaced plain-paragraph blocks from previous run
 * Phase 2: Re-add items as collapsed toggle blocks after "Waiting for Manual Approval"
 *
 * Usage: bun scripts/batch-notion-update.js
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');

// Load .env
const envFile = Bun.file(envPath);
const envText = await envFile.text();
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const NOTION_KEY = process.env.NOTION_INTEGRATION_TOKEN;
const INCOMPLETE_ISSUES_PAGE_ID = '3f13f0ec-f382-8394-94e8-81b1614d19ab';

if (!NOTION_KEY) {
  console.error('Error: NOTION_INTEGRATION_TOKEN not found in .env');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${NOTION_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
};

async function notionFetch(endpoint, options = {}) {
  const res = await fetch(`https://api.notion.com/v1${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (data.object === 'error') {
    throw new Error(`Notion API error: ${data.message}`);
  }
  return data;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getChildPages(parentPageId) {
  const data = await notionFetch('/search', {
    method: 'POST',
    body: JSON.stringify({ filter: { property: 'object', value: 'page' } })
  });
  return (data.results || [])
    .filter(page => page.parent?.page_id === parentPageId)
    .map(page => ({
      id: page.id,
      title: page.properties?.title?.title?.[0]?.plain_text || 'Untitled'
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function getBlockText(block) {
  if (!block) return '';
  const type = block.type;
  const content = block[type];
  if (!content?.rich_text) return '';
  return content.rich_text.map(t => t.plain_text).join('');
}

async function getPageBlocks(pageId) {
  const allBlocks = [];
  let cursor = undefined;
  while (true) {
    const url = cursor
      ? `/blocks/${pageId}/children?page_size=100&start_cursor=${cursor}`
      : `/blocks/${pageId}/children?page_size=100`;
    const data = await notionFetch(url);
    allBlocks.push(...(data.results || []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
    await delay(300);
  }
  return allBlocks;
}

// Known titles from our batch - used to identify blocks to delete
const ALL_TITLES = [
  'Item Offer History', 'Offer Expiration Countdown', 'Saved Offer Responses',
  'Conditional Logic in Automation Chains', 'Automation Dry-Run / Testing Mode',
  'Checklist Templates for Common Workflows', 'Sub-tasks / Nested Checklist Items',
  'Checklist Item Notes and File Attachments', 'Checklist Analytics',
  'Account Activity Log', 'Data Retention Settings', 'Account Usage Statistics',
  'Comparison Mode to Overlay Time Periods',
  'Listing Expiration Dates on Calendar', 'Shipping Deadlines on Calendar',
  'Task Dependencies for Calendar Events',
  'Image Usage Tracking',
  'Internal Order Notes and Comments', 'Return/Refund Management Workflow',
  'Automatic Price-Drop Scheduling',
  'Inventory Age Analysis',
  'International Size Conversion (US, UK, EU, JP, CN)',
  'Confidence Scores for Predictions',
  'Running Balance Alongside Transaction History', 'Transaction Tagging with Custom Tags',
  'Shop Vacation Mode Toggle', 'Shop-Level Fee Tracking', 'Quick-Switch Between Shops',
  'Marketplace Price Trend Sparklines'
];

// ─── Phase 1: Delete misplaced blocks ──────────────────────────────────────

async function deleteMisplacedBlocks(pageId, pageName) {
  const blocks = await getPageBlocks(pageId);

  // Find blocks in "Waiting for Manual Approval" section that are plain paragraphs/dividers (wrong format)
  let inWaitingSection = false;
  const blocksToDelete = [];

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = getBlockText(block);
      if (text.toLowerCase().includes('waiting for manual approval')) {
        inWaitingSection = true;
        continue;
      }
      if (inWaitingSection && text.toLowerCase().includes('approved to move')) {
        break; // Stop at the next section
      }
    }

    if (inWaitingSection) {
      const text = getBlockText(block);
      // Delete plain paragraph blocks and dividers that match our items (wrong format from previous run)
      const isFormatBlock = text.startsWith('Description: ') || text.startsWith('Test: ') ||
        text.startsWith('Expected: ') || text.startsWith('Files: ') || text.startsWith('Title: ');
      const isEmpty = block.type === 'paragraph' && text === '';
      const isDivider = block.type === 'divider';

      if (isFormatBlock || isEmpty || isDivider) {
        blocksToDelete.push(block.id);
      }
    }
  }

  if (blocksToDelete.length === 0) {
    console.log(`  [${pageName}] No misplaced blocks found`);
    return;
  }

  console.log(`  [${pageName}] Deleting ${blocksToDelete.length} plain-paragraph blocks...`);
  for (const blockId of blocksToDelete) {
    try {
      await notionFetch(`/blocks/${blockId}`, { method: 'DELETE' });
      await delay(350);
    } catch (err) {
      console.log(`    Warning: Could not delete block ${blockId}: ${err.message}`);
    }
  }
  console.log(`  [${pageName}] Done`);
}

// ─── Phase 2: Add items as toggle blocks after Waiting heading ─────────────

function createToggleBlock(item) {
  return {
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: [
        { type: 'text', text: { content: '\ud83d\udd27 ' } },
        { type: 'text', text: { content: item.title }, annotations: { bold: true } }
      ],
      color: 'default',
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { type: 'text', text: { content: item.description }, annotations: { italic: true, color: 'gray' } }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Test: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: item.test } }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Expected: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: item.expected } }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Files: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: item.files }, annotations: { code: true } }
            ]
          }
        }
      ]
    }
  };
}

async function addItemsToWaiting(pageId, pageName, items) {
  const blocks = await getPageBlocks(pageId);

  // Find the "Waiting for Manual Approval" heading
  let waitingHeadingId = null;
  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = getBlockText(block);
      if (text.toLowerCase().includes('waiting for manual approval')) {
        waitingHeadingId = block.id;
        break;
      }
    }
  }

  if (!waitingHeadingId) {
    console.log(`  [${pageName}] No "Waiting for Manual Approval" section found, creating...`);
    await notionFetch(`/blocks/${pageId}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [{
          type: 'heading_2',
          heading_2: { rich_text: [{ type: 'text', text: { content: 'Waiting for Manual Approval' } }] }
        }]
      })
    });
    await delay(500);

    const newBlocks = await getPageBlocks(pageId);
    for (const block of newBlocks) {
      if (block.type === 'heading_2') {
        const text = getBlockText(block);
        if (text.toLowerCase().includes('waiting for manual approval')) {
          waitingHeadingId = block.id;
          break;
        }
      }
    }
  }

  if (!waitingHeadingId) {
    console.log(`  [${pageName}] ERROR: Could not find/create waiting section`);
    return 0;
  }

  // Add all items in reverse order using `after` parameter
  // Since each insert goes right after the heading, we insert in reverse
  // so the first item ends up first
  let added = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    try {
      console.log(`  [${pageName}] Adding: ${item.title}...`);
      const toggleBlock = createToggleBlock(item);
      await notionFetch(`/blocks/${pageId}/children`, {
        method: 'PATCH',
        body: JSON.stringify({
          after: waitingHeadingId,
          children: [toggleBlock]
        })
      });
      added++;
      console.log(`  ✓ Added`);
      await delay(500);
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
    }
  }
  return added;
}

// ─── All 29 completed features grouped by category page name ───────────────
const COMPLETED_FEATURES = {
  'Offers': [
    {
      title: 'Item Offer History',
      description: 'Shows complete offer history per item with timestamps, amounts, and statuses. Users can view all past offers made/received for any item.',
      test: 'Go to an item detail page, click the offer history section to see past offers.',
      expected: 'Offer history displays chronologically with offer amounts, dates, and accept/reject/expired statuses.',
      files: 'src/frontend/app.js, src/backend/routes/offers.js'
    },
    {
      title: 'Offer Expiration Countdown',
      description: 'Adds a real-time countdown timer to active offers showing time remaining before expiration.',
      test: 'View an active offer and check for countdown timer display.',
      expected: 'Active offers show a countdown timer (e.g., "2d 5h remaining") that updates and marks expired offers.',
      files: 'src/frontend/app.js'
    },
    {
      title: 'Saved Offer Responses',
      description: 'Allows users to save and reuse common offer response messages (accept, reject, counter) for quick replies.',
      test: 'Go to offer responses settings, create a saved response, then use it when replying to an offer.',
      expected: 'Saved responses appear as quick-select options when responding to offers.',
      files: 'src/frontend/app.js, src/backend/routes/offers.js'
    }
  ],
  'Automations': [
    {
      title: 'Conditional Logic in Automation Chains',
      description: 'Implements if/else conditional logic within automation chains, allowing branching workflows based on conditions.',
      test: 'Create an automation with a conditional step (e.g., if price > $50, apply discount).',
      expected: 'Conditional branches execute correctly based on evaluated conditions.',
      files: 'src/frontend/app.js, src/backend/routes/automations.js'
    },
    {
      title: 'Automation Dry-Run / Testing Mode',
      description: 'Adds a dry-run mode that simulates automation execution without making actual changes, showing what would happen.',
      test: 'Select an automation and click "Dry Run" to simulate execution.',
      expected: 'Dry run shows a preview of actions that would be taken without actually executing them.',
      files: 'src/frontend/app.js, src/backend/routes/automations.js'
    }
  ],
  'Checklist': [
    {
      title: 'Checklist Templates for Common Workflows',
      description: 'Adds pre-built and custom checklist templates that can be applied to quickly create standardized task lists.',
      test: 'Go to Checklist page, click "Templates", select a template to create a new checklist from it.',
      expected: 'Template creates a new checklist pre-populated with the template items.',
      files: 'src/frontend/app.js, src/backend/routes/checklist.js'
    },
    {
      title: 'Sub-tasks / Nested Checklist Items',
      description: 'Implements nested sub-tasks within checklist items, allowing hierarchical task organization.',
      test: 'Create a checklist item, then add sub-tasks beneath it.',
      expected: 'Sub-tasks display indented under parent items. Completing all sub-tasks updates parent progress.',
      files: 'src/frontend/app.js, src/backend/routes/checklist.js'
    },
    {
      title: 'Checklist Item Notes and File Attachments',
      description: 'Adds ability to attach notes and reference files to individual checklist items for additional context.',
      test: 'Open a checklist item, add a note and reference a file attachment.',
      expected: 'Notes and attachment references display on the checklist item detail view.',
      files: 'src/frontend/app.js, src/backend/routes/checklist.js'
    },
    {
      title: 'Checklist Analytics',
      description: 'Provides analytics on checklist completion rates, average completion times, and productivity trends.',
      test: 'Go to Checklist page and view the analytics section/tab.',
      expected: 'Analytics show completion rates, time-to-complete averages, and trend charts.',
      files: 'src/frontend/app.js, src/backend/routes/checklist.js'
    }
  ],
  'Settings': [
    {
      title: 'Account Activity Log',
      description: 'Shows a chronological log of account activities including logins, settings changes, and key actions.',
      test: 'Go to Settings > Data tab, view the account activity log section.',
      expected: 'Activity log shows timestamped entries for recent account actions.',
      files: 'src/frontend/app.js, src/backend/routes/settings.js'
    },
    {
      title: 'Data Retention Settings',
      description: 'Allows users to configure how long different types of data are retained (e.g., transaction history, logs).',
      test: 'Go to Settings > Data tab, adjust data retention periods.',
      expected: 'Retention settings are saved and display current retention periods per data type.',
      files: 'src/frontend/app.js, src/backend/routes/settings.js'
    },
    {
      title: 'Account Usage Statistics',
      description: 'Shows account usage stats including storage used, API calls, feature usage counts, and account limits.',
      test: 'Go to Settings > Data tab, view the usage statistics section.',
      expected: 'Usage stats display current values with visual indicators for limits.',
      files: 'src/frontend/app.js, src/backend/routes/settings.js'
    }
  ],
  'Analytics': [
    {
      title: 'Comparison Mode to Overlay Time Periods',
      description: 'Adds a comparison mode to analytics that overlays two time periods for side-by-side trend analysis.',
      test: 'Go to Analytics, enable comparison mode, select two date ranges.',
      expected: 'Charts overlay both periods with distinct colors and show percentage differences.',
      files: 'src/frontend/app.js'
    }
  ],
  'Calendar': [
    {
      title: 'Listing Expiration Dates on Calendar',
      description: 'Displays listing expiration dates as events on the calendar for proactive relisting.',
      test: 'View the calendar with active listings that have expiration dates.',
      expected: 'Listing expirations appear as calendar events with the listing title and platform.',
      files: 'src/frontend/app.js'
    },
    {
      title: 'Shipping Deadlines on Calendar',
      description: 'Shows shipping deadline dates on the calendar based on order ship-by dates.',
      test: 'View the calendar with pending orders that have shipping deadlines.',
      expected: 'Shipping deadlines appear as calendar events with order details.',
      files: 'src/frontend/app.js'
    },
    {
      title: 'Task Dependencies for Calendar Events',
      description: 'Adds dependency linking between calendar events/tasks so users can define prerequisite relationships.',
      test: 'Create two calendar events, then link one as a dependency of the other.',
      expected: 'Dependent tasks show the dependency relationship and warn if a prerequisite is incomplete.',
      files: 'src/frontend/app.js, src/backend/routes/calendar.js'
    }
  ],
  'Image Bank': [
    {
      title: 'Image Usage Tracking',
      description: 'Tracks where each image is used across listings, showing usage count and linked items.',
      test: 'Go to Image Bank, select an image, view the usage tracking section.',
      expected: 'Shows which listings use the image with links to each listing.',
      files: 'src/frontend/app.js, src/backend/routes/images.js'
    }
  ],
  'Orders': [
    {
      title: 'Internal Order Notes and Comments',
      description: 'Adds ability to add internal notes and comments to orders for team communication and record-keeping.',
      test: 'Open an order detail page, add an internal note.',
      expected: 'Notes are saved and displayed chronologically on the order detail page.',
      files: 'src/frontend/app.js, src/backend/routes/orders.js'
    },
    {
      title: 'Return/Refund Management Workflow',
      description: 'Implements a structured workflow for managing returns and refunds with status tracking and reason codes.',
      test: 'Open an order, initiate a return/refund, follow the workflow steps.',
      expected: 'Return/refund workflow guides through steps with status updates and tracking.',
      files: 'src/frontend/app.js, src/backend/routes/orders.js'
    }
  ],
  'My Listings': [
    {
      title: 'Automatic Price-Drop Scheduling',
      description: 'Allows scheduling automatic price reductions over time (e.g., drop 10% every week) for listings.',
      test: 'Go to a listing, set up a price-drop schedule with intervals and amounts.',
      expected: 'Price-drop schedule is saved and shows upcoming scheduled reductions.',
      files: 'src/frontend/app.js, src/backend/routes/listings.js'
    }
  ],
  'Inventory': [
    {
      title: 'Inventory Age Analysis',
      description: 'Shows how long each inventory item has been held since acquisition, with aging buckets and alerts for stale inventory.',
      test: 'Go to Inventory page and view the age analysis column/section.',
      expected: 'Each item shows days since acquisition with color-coded aging indicators.',
      files: 'src/frontend/app.js, src/backend/routes/inventory.js'
    }
  ],
  'Size Charts': [
    {
      title: 'International Size Conversion (US, UK, EU, JP, CN)',
      description: 'Adds international size conversion tool supporting US, UK, EU, JP, and CN sizing standards.',
      test: 'Go to Size Charts, select a size in one standard (e.g., US 10), view conversions.',
      expected: 'Converter shows equivalent sizes across all supported international standards.',
      files: 'src/frontend/app.js'
    }
  ],
  'Predictions': [
    {
      title: 'Confidence Scores for Predictions',
      description: 'Adds confidence score indicators to predictions showing how reliable each prediction is based on data quality and historical accuracy.',
      test: 'View predictions and check for confidence score badges/indicators.',
      expected: 'Each prediction shows a confidence score (e.g., High/Medium/Low or percentage) with explanation.',
      files: 'src/frontend/app.js'
    }
  ],
  'Transactions': [
    {
      title: 'Running Balance Alongside Transaction History',
      description: 'Shows a running balance column in the transaction history so users can see their balance after each transaction.',
      test: 'Go to Transactions page and view the running balance column.',
      expected: 'Each transaction row shows the cumulative balance at that point in time.',
      files: 'src/frontend/app.js, src/backend/routes/transactions.js'
    },
    {
      title: 'Transaction Tagging with Custom Tags',
      description: 'Allows users to create and assign custom tags to transactions for categorization and filtering.',
      test: 'Open a transaction, add a custom tag, then filter transactions by that tag.',
      expected: 'Tags are saved on transactions and can be used to filter the transaction list.',
      files: 'src/frontend/app.js, src/backend/routes/transactions.js'
    }
  ],
  'My Shops': [
    {
      title: 'Shop Vacation Mode Toggle',
      description: 'Adds a vacation mode toggle for each shop that temporarily pauses listings and shows an away message.',
      test: 'Go to My Shops, select a shop, toggle vacation mode on.',
      expected: 'Vacation mode activates with visual indicator and confirmation of paused status.',
      files: 'src/frontend/app.js, src/backend/routes/shops.js'
    },
    {
      title: 'Shop-Level Fee Tracking',
      description: 'Tracks and displays platform fees at the shop level including listing fees, transaction fees, and subscription costs.',
      test: 'Go to My Shops, select a shop, view the fee tracking section.',
      expected: 'Fee breakdown shows all fee types with totals and trends for the shop.',
      files: 'src/frontend/app.js, src/backend/routes/shops.js'
    },
    {
      title: 'Quick-Switch Between Shops',
      description: 'Adds a quick-switch dropdown/selector for rapidly switching between shops without navigating to My Shops page.',
      test: 'Look for the shop switcher in the header/sidebar, click to switch between shops.',
      expected: 'Shop context switches immediately and relevant data updates to the selected shop.',
      files: 'src/frontend/app.js'
    }
  ],
  'Dashboard': [
    {
      title: 'Marketplace Price Trend Sparklines',
      description: 'Shows small inline sparkline charts on the dashboard for marketplace price trends of key items.',
      test: 'View the dashboard and check for sparkline charts showing price trends.',
      expected: 'Sparklines display recent price trend data inline with minimal, readable charts.',
      files: 'src/frontend/app.js'
    }
  ]
};

// ─── Main execution ────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  BATCH UPDATE - Delete paragraphs, re-add as toggles      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Get all category pages
  console.log('Fetching category pages from Notion...');
  const pages = await getChildPages(INCOMPLETE_ISSUES_PAGE_ID);
  console.log(`Found ${pages.length} category pages.\n`);

  const pageLookup = {};
  for (const page of pages) {
    const cleanName = page.title.replace(/\(Items to Approve\)/gi, '').trim().toLowerCase();
    pageLookup[cleanName] = page;
  }

  // ── PHASE 1: Delete misplaced plain-paragraph blocks ──
  console.log('═══ PHASE 1: Deleting plain-paragraph blocks from Waiting section ═══\n');
  for (const [category] of Object.entries(COMPLETED_FEATURES)) {
    const page = pageLookup[category.toLowerCase()];
    if (!page) continue;
    await deleteMisplacedBlocks(page.id, category);
    await delay(500);
  }

  // ── PHASE 2: Re-add items as toggle blocks ──
  console.log('\n═══ PHASE 2: Adding items as collapsed toggle blocks ═══\n');
  let totalAdded = 0;
  let totalErrors = 0;

  for (const [category, items] of Object.entries(COMPLETED_FEATURES)) {
    const page = pageLookup[category.toLowerCase()];
    if (!page) {
      console.log(`⚠ Category "${category}" not found. Skipping.`);
      totalErrors += items.length;
      continue;
    }
    const added = await addItemsToWaiting(page.id, category, items);
    totalAdded += added;
    totalErrors += (items.length - added);
    await delay(300);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('BATCH UPDATE SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Features added (as toggles): ${totalAdded}`);
  console.log(`  Errors:                      ${totalErrors}`);
  console.log('═'.repeat(60));

  if (totalErrors > 0) {
    console.log('\n⚠ Some items had errors.');
  } else {
    console.log('\n✓ All items added as collapsed toggle blocks!');
    console.log('  Next: Run "bun scripts/session-start.js" to verify.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
