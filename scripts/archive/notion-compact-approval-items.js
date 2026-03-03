#!/usr/bin/env bun
// Compact format for "Waiting for Manual Approval" items using toggle blocks
// Run: bun run scripts/notion-compact-approval-items.js

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const itemsToAdd = {
  'Inventory': {
    id: '20a3f0ec-f382-82bc-8d59-01f332e4e196',
    items: [
      {
        title: 'Fix Inventory Edit Save Functionality',
        description: 'Removed duplicate updateItem handler that was breaking edit save. Modal now properly saves changes.',
        test: 'Go to Inventory → Click item → Edit → Change price → Save',
        expected: 'Changes save successfully, item updates with new values',
        files: 'src/frontend/app.js'
      },
      {
        title: 'Inventory Page Improvements and Import Fixes',
        description: 'Fixed duplicate import handlers breaking file upload. Simplified stats to Active, Drafts, Low Stock, Out of Stock.',
        test: 'Go to Inventory → Check stats cards → Try Import button with CSV',
        expected: 'Stats show 4 categories, import works without errors',
        files: 'src/frontend/app.js, src/backend/db/seeds/demoData.js'
      }
    ]
  },
  'Calendar': {
    id: '31c3f0ec-f382-82c5-88e3-01976e5de201',
    items: [
      {
        title: 'Dark Mode Text Visibility for Calendar',
        description: 'Added dark mode styling for week/day header names with light gray text on dark backgrounds.',
        test: 'Enable dark mode in Settings → Go to Calendar → Check day headers',
        expected: 'Day headers (Sun, Mon, etc.) clearly visible in light gray',
        files: 'src/frontend/styles/main.css'
      }
    ]
  }
};

async function clearAndReformatItems(pageName, pageId, items) {
  console.log(`\n--- ${pageName} ---`);

  try {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });
    await sleep(300);

    let waitingHeadingId = null;
    const blocksToDelete = [];
    let inWaitingSection = false;

    for (const block of response.results) {
      if (block.type === 'heading_2') {
        const text = block.heading_2.rich_text.map(rt => rt.plain_text).join('');
        if (text.includes('Waiting for Manual Approval')) {
          waitingHeadingId = block.id;
          inWaitingSection = true;
        } else if (text.includes('Approved to Move') || text.includes('Issues/Features')) {
          inWaitingSection = false;
        }
      } else if (inWaitingSection) {
        blocksToDelete.push(block.id);
      }
    }

    if (!waitingHeadingId) {
      console.log(`  ⚠️ Could not find "Waiting for Manual Approval" heading`);
      return;
    }

    // Delete existing blocks
    if (blocksToDelete.length > 0) {
      console.log(`  Removing ${blocksToDelete.length} old blocks...`);
      for (const blockId of blocksToDelete) {
        try {
          await notion.blocks.delete({ block_id: blockId });
          await sleep(150);
        } catch (err) {}
      }
    }

    // Create compact toggle blocks for each item
    const newBlocks = [];

    for (const item of items) {
      // Toggle block with title - expands to show details
      newBlocks.push({
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: [
            { type: 'text', text: { content: '🔧 ' } },
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
      });
    }

    console.log(`  Adding ${items.length} compact toggle item(s)...`);
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
  console.log('=== Creating Compact Toggle Format ===');

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
