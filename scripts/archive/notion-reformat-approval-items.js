#!/usr/bin/env bun
// Reformats "Waiting for Manual Approval" items with better visual styling
// Run: bun run scripts/notion-reformat-approval-items.js

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Items with better formatting
const itemsToAdd = {
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

async function clearAndReformatItems(pageName, pageId, items) {
  console.log(`\n--- ${pageName} ---`);

  try {
    // Get all blocks
    const response = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });
    await sleep(300);

    let waitingHeadingId = null;
    let approvedHeadingId = null;
    const blocksToDelete = [];
    let inWaitingSection = false;

    // Find headings and blocks to delete
    for (const block of response.results) {
      if (block.type === 'heading_2') {
        const text = block.heading_2.rich_text.map(rt => rt.plain_text).join('');
        if (text.includes('Waiting for Manual Approval')) {
          waitingHeadingId = block.id;
          inWaitingSection = true;
        } else if (text.includes('Approved to Move')) {
          approvedHeadingId = block.id;
          inWaitingSection = false;
        } else {
          inWaitingSection = false;
        }
      } else if (inWaitingSection && block.type !== 'heading_2') {
        // Delete any existing content in the Waiting section
        blocksToDelete.push(block.id);
      }
    }

    if (!waitingHeadingId) {
      console.log(`  ⚠️ Could not find "Waiting for Manual Approval" heading`);
      return;
    }

    // Delete existing blocks in the section
    if (blocksToDelete.length > 0) {
      console.log(`  Removing ${blocksToDelete.length} old blocks...`);
      for (const blockId of blocksToDelete) {
        try {
          await notion.blocks.delete({ block_id: blockId });
          await sleep(150);
        } catch (err) {
          // Ignore errors
        }
      }
    }

    // Create formatted blocks for each item
    const newBlocks = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Callout block with colored background for the item
      newBlocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            {
              type: 'text',
              text: { content: item.title },
              annotations: { bold: true, color: 'default' }
            }
          ],
          icon: { type: 'emoji', emoji: '🔧' },
          color: 'blue_background',
          children: [
            // Description
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'Description: ' }, annotations: { bold: true, color: 'blue' } },
                  { type: 'text', text: { content: item.description } }
                ]
              }
            },
            // Divider inside callout
            {
              object: 'block',
              type: 'divider',
              divider: {}
            },
            // Test steps
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'Test Steps: ' }, annotations: { bold: true, color: 'purple' } },
                ]
              }
            },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: item.test } }
                ]
              }
            },
            // Expected result
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'Expected: ' }, annotations: { bold: true, color: 'green' } },
                  { type: 'text', text: { content: item.expected } }
                ]
              }
            },
            // Files
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'Files: ' }, annotations: { bold: true, color: 'orange' } },
                  { type: 'text', text: { content: item.files }, annotations: { code: true } }
                ]
              }
            }
          ]
        }
      });

      // Add space between items (but not after the last one)
      if (i < items.length - 1) {
        newBlocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [] }
        });
      }
    }

    // Add the formatted blocks after the heading
    console.log(`  Adding ${items.length} formatted item(s)...`);
    await notion.blocks.children.append({
      block_id: pageId,
      children: newBlocks,
      after: waitingHeadingId,
    });
    await sleep(350);

    console.log(`  ✅ Done!`);

  } catch (err) {
    console.error(`  ❌ ERROR: ${err.message}`);
  }
}

async function main() {
  console.log('=== Reformatting Approval Items with Better Styling ===');

  for (const [pageName, data] of Object.entries(itemsToAdd)) {
    await clearAndReformatItems(pageName, data.id, data.items);
    await sleep(400);
  }

  console.log('\n✨ All done!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
