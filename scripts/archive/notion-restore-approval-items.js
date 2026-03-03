#!/usr/bin/env bun
// Restores items to "Waiting for Manual Approval" sections based on git history
// Run: bun run scripts/notion-restore-approval-items.js

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Items to restore based on git commit history
const itemsToRestore = {
  'Inventory': {
    id: '20a3f0ec-f382-82bc-8d59-01f332e4e196',
    items: [
      {
        title: 'Fix Inventory Edit Save Functionality',
        description: 'Removed duplicate updateItem handler that was overwriting the comprehensive version, which was breaking the inventory edit save functionality. Edit modal now properly saves changes.',
        test: '1. Go to Inventory page\n2. Click on any inventory item to open it\n3. Click Edit button\n4. Make changes to any field (e.g., change the price)\n5. Click Save',
        expected: 'Changes should save successfully and the item should update with the new values. No console errors.',
        files: 'src/frontend/app.js'
      },
      {
        title: 'Inventory Page Improvements and Import Fixes',
        description: 'Removed duplicate import handlers that were breaking file upload. Simplified inventory stats to show Active, Drafts, Low Stock, Out of Stock (removed Total Items and Total Value). Removed unused topCategories and recentItems calculations.',
        test: '1. Go to Inventory page\n2. Check the stats cards at the top\n3. Try the Import button to upload a CSV file',
        expected: 'Stats should show: Active, Drafts, Low Stock, Out of Stock. Import functionality should work without errors.',
        files: 'src/frontend/app.js, src/backend/db/seeds/demoData.js'
      }
    ]
  },
  'Calendar': {
    id: '31c3f0ec-f382-82c5-88e3-01976e5de201',
    items: [
      {
        title: 'Dark Mode Text Visibility for Calendar',
        description: 'Added dark mode styling for Calendar week/day header names. Headers now show light gray text on dark backgrounds for better visibility.',
        test: '1. Enable dark mode in Settings > Appearance\n2. Navigate to Calendar page\n3. Look at the week day headers (Sun, Mon, Tue, etc.)',
        expected: 'Day headers should be clearly visible with light gray text (#9ca3af) on the dark background.',
        files: 'src/frontend/styles/main.css'
      }
    ]
  }
};

async function addItemsToWaitingSection(pageName, pageId, items) {
  console.log(`\n--- ${pageName} ---`);

  try {
    // Get all blocks to find the "Waiting for Manual Approval" heading
    const response = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });
    await sleep(350);

    let waitingHeadingId = null;
    let approvedHeadingId = null;

    for (const block of response.results) {
      if (block.type === 'heading_2') {
        const text = block.heading_2.rich_text.map(rt => rt.plain_text).join('');
        if (text.includes('Waiting for Manual Approval')) {
          waitingHeadingId = block.id;
        } else if (text.includes('Approved to Move')) {
          approvedHeadingId = block.id;
        }
      }
    }

    if (!waitingHeadingId) {
      console.log(`  ⚠️ Could not find "Waiting for Manual Approval" heading`);
      return;
    }

    // Create paragraph blocks for each item
    const itemBlocks = [];
    for (const item of items) {
      const content = `**Title**: ${item.title}\n**Description**: ${item.description}\n**Test**: ${item.test}\n**Expected**: ${item.expected}\n**Files**: ${item.files}`;

      itemBlocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: content } }],
        },
      });

      // Add a blank line between items
      itemBlocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [],
        },
      });
    }

    // Add blocks after the "Waiting for Manual Approval" heading
    await notion.blocks.children.append({
      block_id: pageId,
      children: itemBlocks,
      after: waitingHeadingId,
    });
    await sleep(350);

    console.log(`  ✅ Added ${items.length} item(s) to "Waiting for Manual Approval"`);

    // Update page title to add "(Items to Approve)" suffix
    const page = await notion.pages.retrieve({ page_id: pageId });
    const currentTitle = page.properties.title?.title?.[0]?.plain_text || pageName;

    if (!currentTitle.includes('(Items to Approve)')) {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          title: {
            title: [{ text: { content: `${pageName} (Items to Approve)` } }]
          }
        }
      });
      console.log(`  ✅ Updated page title to "${pageName} (Items to Approve)"`);
    }

  } catch (err) {
    console.error(`  ❌ ERROR: ${err.message}`);
  }
}

async function main() {
  console.log('=== Restoring Items to Waiting for Manual Approval ===');

  for (const [pageName, data] of Object.entries(itemsToRestore)) {
    await addItemsToWaitingSection(pageName, data.id, data.items);
    await sleep(400);
  }

  console.log('\n✨ Done!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
