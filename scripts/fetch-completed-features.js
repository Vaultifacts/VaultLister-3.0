/**
 * Fetch Completed Features from Notion
 *
 * Run at session start to get a summary of all completed features.
 * This helps avoid suggesting already-implemented features.
 *
 * Usage: bun scripts/fetch-completed-features.js
 */

import { loadEnv } from './lib/env.js';
import { notionFetch, getChildPages, getBlocks, getPageIds } from './lib/notion.js';

loadEnv();

const { complete: COMPLETED_ISSUES_PAGE_ID } = getPageIds();

async function getPageItems(pageId) {
  const blocks = await getBlocks(pageId);
  return blocks
    .filter(block => block.type === 'bulleted_list_item' || block.type === 'paragraph' || block.type === 'toggle')
    .map(block => {
      const richText = block[block.type]?.rich_text || [];
      return richText.map(t => t.plain_text).join('').trim();
    })
    .filter(text => text.length > 0);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          COMPLETED FEATURES SUMMARY                        ║');
  console.log('║          (Do not suggest these again)                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Get all sub-pages under Completed Issues
  const subPages = await getChildPages(COMPLETED_ISSUES_PAGE_ID);

  if (subPages.length === 0) {
    console.log('No sub-pages found under Completed Issues and Features.');
    return;
  }

  let totalFeatures = 0;
  const summary = {};

  // Fetch items from each sub-page
  for (const page of subPages) {
    const items = await getPageItems(page.id);
    if (items.length > 0) {
      summary[page.title] = items;
      totalFeatures += items.length;
    }
  }

  // Output summary by category
  for (const [category, items] of Object.entries(summary).sort()) {
    console.log(`\n## ${category} (${items.length} items)`);
    console.log('─'.repeat(50));
    for (const item of items) {
      // Truncate long items for readability
      const displayText = item.length > 80 ? item.slice(0, 77) + '...' : item;
      console.log(`  • ${displayText}`);
    }
  }

  // Summary stats
  console.log('\n' + '═'.repeat(60));
  console.log(`TOTAL: ${totalFeatures} completed features across ${Object.keys(summary).length} categories`);
  console.log('═'.repeat(60));

  // Output compact list for quick reference
  console.log('\n### Quick Reference (category counts):');
  for (const [category, items] of Object.entries(summary).sort()) {
    console.log(`  ${category}: ${items.length}`);
  }
}

main().catch(err => {
  console.error('Error fetching completed features:', err.message);
  process.exit(1);
});
