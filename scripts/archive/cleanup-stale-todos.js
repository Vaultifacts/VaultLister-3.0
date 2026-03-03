#!/usr/bin/env bun
// Cleanup: Check off stale to-do items that already have matching toggle blocks
// in "Waiting for Manual Approval" section. This fixes items that were implemented
// but had their to-do items left unchecked.

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Get all sub-pages under Incomplete Issues
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

function normalizeText(text) {
  return text.toLowerCase()
    .replace(/[🔧✨📈🐛🔒⚠️📌]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('=== Stale To-Do Cleanup ===');
  console.log('Checking all pages for unchecked to-dos with matching approval toggles...\n');

  // Get all sub-pages
  const res = await notion.blocks.children.list({ block_id: PARENT_PAGE, page_size: 100 });
  const pages = res.results.filter(b => b.type === 'child_page');

  let totalChecked = 0;
  let totalSkipped = 0;

  for (const page of pages) {
    const pageName = page.child_page.title;
    const blocks = await getPageBlocks(page.id);

    // Find sections
    let todoHeadingId = null;
    let waitingHeadingId = null;
    for (const block of blocks) {
      if (block.type === 'heading_2') {
        const text = extractText(block);
        if (text.includes('Issues/Features to Work On') || text.includes('Issues / Features to Work On')) todoHeadingId = block.id;
        if (text.includes('Waiting for Manual Approval')) waitingHeadingId = block.id;
      }
    }

    if (!todoHeadingId || !waitingHeadingId) continue;

    // Get unchecked to-dos
    const uncheckedTodos = blocks.filter(b => b.type === 'to_do' && !b.to_do.checked);
    if (uncheckedTodos.length === 0) continue;

    // Get toggle titles in Waiting section
    const toggleTitles = blocks
      .filter(b => b.type === 'toggle')
      .map(b => normalizeText(extractText(b)));

    if (toggleTitles.length === 0) continue;

    let pageChecked = 0;
    for (const todo of uncheckedTodos) {
      const todoText = normalizeText(extractText(todo));
      if (!todoText) continue;

      // Check if any toggle title matches this to-do
      const hasMatch = toggleTitles.some(toggleTitle => {
        // Extract keywords from both
        const todoWords = todoText.split(/\s+/).filter(w => w.length > 3);
        const toggleWords = toggleTitle.split(/\s+/).filter(w => w.length > 3);

        // Check if at least 3 words match, or if first 25 chars of todo appear in toggle
        const matchCount = todoWords.filter(tw => toggleTitle.includes(tw)).length;
        const reverseMatchCount = toggleWords.filter(tw => todoText.includes(tw)).length;

        return matchCount >= 3 || reverseMatchCount >= 3 ||
               toggleTitle.includes(todoText.substring(0, 25)) ||
               todoText.includes(toggleTitle.substring(0, 25));
      });

      if (hasMatch) {
        try {
          await notion.blocks.update({ block_id: todo.id, to_do: { checked: true } });
          pageChecked++;
          totalChecked++;
          console.log(`  [x] ${pageName}: "${extractText(todo).substring(0, 70)}..."`);
          await sleep(350);
        } catch (e) {
          console.log(`  [!] Failed: ${e.message}`);
        }
      } else {
        totalSkipped++;
      }
    }

    if (pageChecked > 0) {
      console.log(`  >> ${pageName}: Checked off ${pageChecked} stale to-dos\n`);
    }
  }

  console.log('\n=== CLEANUP COMPLETE ===');
  console.log(`Checked off: ${totalChecked} stale to-dos`);
  console.log(`Left unchecked: ${totalSkipped} genuinely pending items`);
}

main().catch(console.error);
