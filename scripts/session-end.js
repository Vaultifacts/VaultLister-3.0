/**
 * Session End Script
 *
 * Run at the end of a coding session to:
 * 1. Add completed items to "Waiting for Manual Approval" with proper format
 * 2. Update page titles with "(Items to Approve)" suffix
 * 3. Generate a session summary
 *
 * Usage: bun scripts/session-end.js
 *
 * Interactive mode - prompts for completed features
 */

import * as readline from 'readline';
import { loadEnv } from './lib/env.js';
import { notionFetch, getChildPages, getBlocks, appendBlocks, updatePage, getPageIds } from './lib/notion.js';

loadEnv();

const { incomplete: INCOMPLETE_ISSUES_PAGE_ID } = getPageIds();

async function findWaitingSection(pageId) {
  const blocks = await getBlocks(pageId);
  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = block.heading_2?.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('waiting for manual approval')) {
        return block.id;
      }
    }
  }
  return null;
}

async function addItemToWaiting(pageId, waitingSectionId, item) {
  // Append collapsed toggle block to the page after the waiting section heading
  // (heading_2 blocks don't support children, so we use the `after` param on the page)
  const toggleBlock = {
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

  await appendBlocks(pageId, [toggleBlock], waitingSectionId);
}

function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          SESSION END - Add Completed Features              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const rl = createPrompt();

  // Get available pages
  const pages = await getChildPages(INCOMPLETE_ISSUES_PAGE_ID);
  const validPages = pages.filter(p => !p.title.toLowerCase().includes('not fixed across'));

  console.log('Available pages:');
  validPages.forEach((p, i) => console.log(`  ${i + 1}. ${p.title}`));
  console.log('');

  const completedItems = [];

  while (true) {
    const addMore = await ask(rl, 'Add a completed feature? (y/n): ');
    if (addMore.toLowerCase() !== 'y') break;

    console.log('\n--- New Completed Feature ---');

    const pageNum = await ask(rl, 'Page number (from list above): ');
    const pageIndex = parseInt(pageNum) - 1;
    if (isNaN(pageIndex) || pageIndex < 0 || pageIndex >= validPages.length) {
      console.log('Invalid page number');
      continue;
    }

    const selectedPage = validPages[pageIndex];
    console.log(`Selected: ${selectedPage.title}\n`);

    const title = await ask(rl, 'Feature Title: ');
    const description = await ask(rl, 'Description (what it does): ');
    const test = await ask(rl, 'Test steps (how to test): ');
    const expected = await ask(rl, 'Expected result: ');
    const files = await ask(rl, 'Files modified: ');

    completedItems.push({
      page: selectedPage,
      item: { title, description, test, expected, files }
    });

    console.log(`\n✓ Added: "${title}" to ${selectedPage.title}\n`);
  }

  rl.close();

  if (completedItems.length === 0) {
    console.log('\nNo items to add. Session end complete.');
    return;
  }

  console.log('\n' + '─'.repeat(60));
  console.log('Adding items to Notion...\n');

  const updatedPages = new Set();

  for (const { page, item } of completedItems) {
    console.log(`Adding "${item.title}" to ${page.title}...`);

    // Find or create waiting section
    let waitingSectionId = await findWaitingSection(page.id);

    if (!waitingSectionId) {
      console.log('  Creating "Waiting for Manual Approval" section...');
      // Add the section at the end
      await appendBlocks(page.id, [{
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: 'Waiting for Manual Approval' } }] }
      }]);
      // Re-fetch to get the new section ID
      waitingSectionId = await findWaitingSection(page.id);
    }

    await addItemToWaiting(page.id, waitingSectionId, item);
    updatedPages.add(page);
    console.log('  ✓ Added');
  }

  // Update page titles
  console.log('\nUpdating page titles...');
  for (const page of updatedPages) {
    if (!page.title.includes('(Items to Approve)')) {
      const newTitle = `${page.title} (Items to Approve)`;
      await updatePage(page.id, { title: { title: [{ text: { content: newTitle } }] } });
      console.log(`  ✓ ${page.title} → ${newTitle}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SESSION END SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Features added:    ${completedItems.length}`);
  console.log(`  Pages updated:     ${updatedPages.size}`);
  console.log('');
  console.log('Items added:');
  completedItems.forEach(({ page, item }) => {
    console.log(`  • [${page.title}] ${item.title}`);
  });
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
