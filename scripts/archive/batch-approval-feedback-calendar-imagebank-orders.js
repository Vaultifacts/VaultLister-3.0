#!/usr/bin/env bun
// Batch update: Check off to-do items + add toggle blocks for 20 items
// Categories: Feedback (8), Calendar (8), Image Bank (3), Orders (1)

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
  feedback: { id: 'af63f0ec-f382-82c4-8030-013518f734e8', name: 'Feedback & Suggestions' },
  calendar: { id: '31c3f0ec-f382-82c5-88e3-01976e5de201', name: 'Calendar' },
  imageBank: { id: '48d3f0ec-f382-83e1-9170-015cab35fd27', name: 'Image Bank' },
  orders: { id: '2fd3f0ec-f382-836b-8589-81252121f2bb', name: 'Orders' },
};

// All 20 features to add to "Waiting for Manual Approval"
const features = [
  // FEEDBACK (8 items)
  {
    pageKey: 'feedback',
    title: 'Feedback Roadmap Integration',
    description: 'Feedback items can be linked to roadmap features. Users see roadmap status on their feedback submissions.',
    test: 'Go to Feedback page > Submit feedback > Check roadmap integration section',
    expected: 'Feedback items show linked roadmap status and users can see progress on their suggestions.',
    files: 'src/backend/routes/feedback.js:507,528, src/frontend/app.js:40760'
  },
  {
    pageKey: 'feedback',
    title: 'Feedback Analytics Page',
    description: 'Analytics dashboard showing feedback trends, category breakdowns, response rates, and sentiment analysis.',
    test: 'Go to Feedback page > Click Analytics tab',
    expected: 'Charts and metrics showing feedback volume, categories, response times, and satisfaction scores.',
    files: 'src/backend/routes/feedback.js:59-107, src/frontend/app.js:30966-31096'
  },
  {
    pageKey: 'feedback',
    title: 'Similar Feedback Suggestions While Typing',
    description: 'As users type feedback, similar existing submissions are shown to reduce duplicates and encourage voting on existing items.',
    test: 'Go to Feedback > Start typing a new submission > Observe suggestions',
    expected: 'Dropdown appears with similar existing feedback items that can be voted on instead of creating duplicates.',
    files: 'src/backend/routes/feedback.js:109-132, src/frontend/app.js:40699-40735'
  },
  {
    pageKey: 'feedback',
    title: 'Screenshot Attachment for Bug Reports',
    description: 'Users can attach screenshots when submitting bug reports. Images are uploaded and displayed in the feedback detail view.',
    test: 'Go to Feedback > Submit Bug Report > Attach screenshot > View submission',
    expected: 'Screenshot uploads successfully and displays in the feedback detail view.',
    files: 'src/backend/routes/feedback.js:452-468, src/frontend/app.js:28382-28401'
  },
  {
    pageKey: 'feedback',
    title: 'Anonymous Feedback Option',
    description: 'Toggle to submit feedback anonymously. Anonymous submissions hide user identity from public view while still tracking internally.',
    test: 'Go to Feedback > Toggle "Submit Anonymously" > Submit feedback > View it',
    expected: 'Feedback shows as anonymous in public view but admin can still see submitter.',
    files: 'src/backend/routes/feedback.js:38-49, src/frontend/app.js:28404-28411'
  },
  {
    pageKey: 'feedback',
    title: 'Admin Responses in Thread Format',
    description: 'Admin responses display as threaded conversations under feedback items. Supports multiple back-and-forth exchanges.',
    test: 'View a feedback item with admin response > Check thread format',
    expected: 'Responses appear as threaded conversation with timestamps and role indicators.',
    files: 'src/backend/routes/feedback.js:221-285, src/frontend/app.js:40790-40821'
  },
  {
    pageKey: 'feedback',
    title: 'Feedback Categorization',
    description: 'Feedback can be categorized (bug, feature, improvement, question). Categories have icons and color coding.',
    test: 'Go to Feedback > Submit with category > View categorized list',
    expected: 'Categories display with appropriate icons and colors. Filter by category works.',
    files: 'src/backend/routes/feedback.js:7, src/frontend/app.js:28290-28317'
  },
  {
    pageKey: 'feedback',
    title: 'Upvote/Downvote System',
    description: 'Users can upvote or downvote feedback submissions. Vote counts displayed with sorting by popularity.',
    test: 'Go to Feedback > Upvote/Downvote items > Sort by votes',
    expected: 'Vote buttons work, counts update, sorting by most votes functions correctly.',
    files: 'src/backend/routes/feedback.js:358-423, src/frontend/app.js:30943-30955'
  },

  // CALENDAR (8 items - includes 1 duplicate shipping deadlines)
  {
    pageKey: 'calendar',
    title: 'Listing Expiration Dates on Calendar',
    description: 'Calendar displays listing expiration dates as amber-colored events with countdown indicators.',
    test: 'Go to Calendar > Check for expiration events > Verify amber color',
    expected: 'Listing expirations appear as amber events with days remaining shown.',
    files: 'src/frontend/app.js:25110-25123'
  },
  {
    pageKey: 'calendar',
    title: 'Shipping Deadlines on Calendar',
    description: 'Orders with shipping deadlines appear as blue events on the calendar with deadline indicators.',
    test: 'Go to Calendar > Check for shipping deadline events',
    expected: 'Shipping deadlines display with blue color and deadline information.',
    files: 'src/frontend/app.js:25127-25137'
  },
  {
    pageKey: 'calendar',
    title: 'Task Dependencies',
    description: 'Calendar events can have dependencies on other events. Dependent events show blocked status until prerequisites are completed.',
    test: 'Go to Calendar > Create event with dependency > Check dependency indicator',
    expected: 'Events show dependency links, blocked events display appropriate indicators.',
    files: 'src/frontend/app.js:35864-35870, migration 058'
  },
  {
    pageKey: 'calendar',
    title: 'Color-Coded Event Categories',
    description: 'Calendar events are color-coded by type: sales (green), shipments (blue), restocks (yellow), live shows (red), custom (gray), expirations (amber).',
    test: 'Go to Calendar > View events of different types > Toggle dark mode',
    expected: 'Each event type has distinct colors in both light and dark mode. Dark mode text is readable.',
    files: 'src/frontend/app.js:25149-25159, src/frontend/styles/main.css:17877-17905'
  },
  {
    pageKey: 'calendar',
    title: 'Dark Mode Calendar Text Visibility Fix',
    description: 'Fixed blanket dark mode override that clobbered type-specific calendar event colors. Now each event type retains its distinct color in dark mode. Added missing expiration event dark mode rule.',
    test: 'Toggle dark mode > Go to Calendar > Check all event types are readable with distinct colors',
    expected: 'Sale (green), shipment (blue), restock (yellow), live (red), custom (gray), expiration (amber) all visible with proper contrast in dark mode.',
    files: 'src/frontend/styles/main.css:9172-9175, 17877-17910'
  },
  {
    pageKey: 'calendar',
    title: 'Google Calendar / Outlook Sync Settings',
    description: 'New sync settings modal accessible from Calendar page header. Supports Google Calendar and Outlook with direction (import/export/both), frequency (realtime/hourly/daily/manual), and calendar name. Settings persisted in database. OAuth integration is future work.',
    test: 'Go to Calendar > Click "Sync" button > Configure Google/Outlook settings > Save > Refresh page > Re-open modal',
    expected: 'Settings modal displays with provider sections. Saved settings persist across page reloads. Both providers configurable independently.',
    files: 'src/backend/routes/calendar.js, src/backend/db/migrations/062_calendar_sync_settings.sql, src/backend/db/database.js, src/frontend/app.js'
  },
  {
    pageKey: 'calendar',
    title: 'Shipping Deadlines (duplicate confirmation)',
    description: 'Duplicate of Shipping Deadlines item - confirming implementation exists. Orders with shipping deadlines appear on calendar.',
    test: 'Go to Calendar > Verify shipping deadline events display',
    expected: 'Shipping deadlines visible on calendar with appropriate styling.',
    files: 'src/frontend/app.js:25127-25137'
  },

  // IMAGE BANK (3 items)
  {
    pageKey: 'imageBank',
    title: 'Enhanced Image Comparison Tool',
    description: 'Upgraded image comparison from basic slider to multi-mode tool with: Slider (drag to compare), Side-by-Side (grid layout), and Overlay (opacity + blend mode controls). Includes toolbar with zoom in/out, image swap, and mode toggle buttons.',
    test: 'Use image comparison tool > Switch between Slider/Side-by-Side/Overlay modes > Test zoom and swap buttons',
    expected: 'All 3 modes work correctly. Zoom adjusts scale. Swap reverses before/after. Overlay has opacity slider and blend mode selector.',
    files: 'src/frontend/app.js:12822-12960, src/frontend/styles/main.css'
  },
  {
    pageKey: 'imageBank',
    title: 'Enhanced Storage Quota Indicator (Real Backend Data)',
    description: 'Replaced mock storage calculation with real backend endpoint. New GET /image-bank/storage-stats returns actual SUM(file_size) vs 5GB quota. Frontend loads real stats on page visit and uses them for storage display.',
    test: 'Go to Image Bank > Check storage bar shows real data > Upload image > Refresh > Verify storage updates',
    expected: 'Storage bar reflects actual database file sizes. Percentage and GB values are accurate.',
    files: 'src/backend/routes/imageBank.js, src/frontend/app.js:25843-25845,57769'
  },
  {
    pageKey: 'imageBank',
    title: 'Image Usage Scan',
    description: 'New "Scan Usage" quick action button and POST /image-bank/scan-usage endpoint. Scans all inventory items for image references, updates used_count and image_bank_usage table. Shows scan results via toast notification.',
    test: 'Go to Image Bank > Click "Scan Usage" quick action > Wait for scan > Check usage badges update',
    expected: 'Toast shows scan results (images scanned, items checked). Image usage counts refresh on page.',
    files: 'src/backend/routes/imageBank.js, src/frontend/app.js'
  },

  // ORDERS (1 item)
  {
    pageKey: 'orders',
    title: 'Order Notes and Internal Comments',
    description: 'Orders have a notes/comments section for internal team communication. Notes are saved per-order and display in chronological order.',
    test: 'Go to Orders > Open an order > Add internal note > Save > Refresh > Verify note persists',
    expected: 'Notes section visible on order detail. Notes save and persist. Displayed in chronological order.',
    files: 'src/frontend/app.js:24607, handlers at 43068-43150'
  }
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
      // Match by keywords from the title
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
    console.log(`  SKIPPING toggles — no "Waiting for Manual Approval" heading found`);
    return;
  }

  // Check which features already exist as toggles
  const existingToggles = blocks.filter(b => b.type === 'toggle');
  const existingTitles = existingToggles.map(t => extractText(t).toLowerCase());

  let added = 0;
  for (const feature of pageFeatures) {
    // Skip if already exists
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

async function main() {
  console.log('=== Batch Notion Update: Feedback, Calendar, Image Bank, Orders ===');
  console.log(`Total features: ${features.length}\n`);

  for (const pageKey of Object.keys(PAGES)) {
    await processPage(pageKey);
  }

  console.log('\n=== DONE ===');
  console.log(`Processed ${features.length} features across ${Object.keys(PAGES).length} pages`);
}

main().catch(console.error);
