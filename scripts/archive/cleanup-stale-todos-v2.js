#!/usr/bin/env bun
// Aggressive cleanup: Check off ALL to-do items that start with 🔧 emoji
// These are items that were already implemented and have toggle blocks but
// the to-do check-off was missed. The 🔧 prefix is only added when work is done.

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PARENT_PAGE = '3f13f0ec-f382-8394-94e8-81b1614d19ab';

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

async function main() {
  console.log('=== Aggressive Stale To-Do Cleanup v2 ===');
  console.log('Checking off ALL unchecked to-dos that start with 🔧\n');

  const res = await notion.blocks.children.list({ block_id: PARENT_PAGE, page_size: 100 });
  const pages = res.results.filter(b => b.type === 'child_page');

  let totalChecked = 0;
  let totalSkipped = 0;

  for (const page of pages) {
    const pageName = page.child_page.title;
    const blocks = await getPageBlocks(page.id);

    const uncheckedTodos = blocks.filter(b => b.type === 'to_do' && !b.to_do.checked);
    if (uncheckedTodos.length === 0) continue;

    let pageChecked = 0;
    for (const todo of uncheckedTodos) {
      const text = extractText(todo);
      // Check if starts with 🔧 emoji - these are all already completed
      if (text.startsWith('\u{1F527}') || text.startsWith('🔧')) {
        try {
          await notion.blocks.update({ block_id: todo.id, to_do: { checked: true } });
          pageChecked++;
          totalChecked++;
          console.log(`  [x] ${pageName}: "${text.substring(0, 70)}..."`);
          await sleep(350);
        } catch (e) {
          console.log(`  [!] Failed: ${e.message}`);
        }
      } else {
        totalSkipped++;
      }
    }

    if (pageChecked > 0) {
      console.log(`  >> ${pageName}: Checked off ${pageChecked} stale 🔧 to-dos\n`);
    }
  }

  console.log('\n=== CLEANUP v2 COMPLETE ===');
  console.log(`Checked off: ${totalChecked} stale 🔧 to-dos`);
  console.log(`Left unchecked: ${totalSkipped} genuinely pending items (no 🔧 prefix)`);
}

main().catch(console.error);
