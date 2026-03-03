#!/usr/bin/env bun
// Clean up stale non-to_do blocks in "Issues/Features to Work On" sections
// These are toggle/paragraph blocks that were accidentally placed in the wrong section.
// They should only exist in "Waiting for Manual Approval" sections.
// This script finds and deletes them (they're duplicates of proper toggle blocks in the approval section).

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
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== Cleanup Stale Section Blocks ${dryRun ? '(DRY RUN)' : ''} ===`);
  console.log('Removing non-to_do blocks from "Issues/Features to Work On" sections\n');

  const res = await notion.blocks.children.list({ block_id: PARENT_PAGE, page_size: 100 });
  const pages = res.results.filter(b => b.type === 'child_page');

  let totalDeleted = 0;

  for (const page of pages) {
    const pageName = page.child_page.title;
    const blocks = await getPageBlocks(page.id);

    let inWorkOnSection = false;
    const blocksToDelete = [];

    for (const block of blocks) {
      if (block.type === 'heading_2') {
        const text = extractText(block);
        if (text.includes('Issues/Features to Work On') || text.includes('Issues / Features to Work On')) {
          inWorkOnSection = true;
        } else {
          inWorkOnSection = false;
        }
        continue;
      }

      // In the "work on" section, only to_do blocks belong
      if (inWorkOnSection && block.type !== 'to_do') {
        const text = extractText(block);
        if (text) {
          blocksToDelete.push({ id: block.id, type: block.type, text: text.substring(0, 60) });
        }
      }
    }

    if (blocksToDelete.length === 0) continue;

    console.log(`${pageName}: ${blocksToDelete.length} stale blocks`);
    for (const b of blocksToDelete) {
      if (dryRun) {
        console.log(`  [DRY] Would delete ${b.type}: "${b.text}..."`);
      } else {
        try {
          await notion.blocks.delete({ block_id: b.id });
          totalDeleted++;
          console.log(`  [x] Deleted ${b.type}: "${b.text}..."`);
          await sleep(350);
        } catch (e) {
          console.log(`  [!] Failed to delete: ${e.message}`);
        }
      }
    }
  }

  console.log(`\n=== DONE: Deleted ${totalDeleted} stale blocks ===`);
}

main().catch(console.error);
