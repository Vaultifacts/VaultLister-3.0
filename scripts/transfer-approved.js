/**
 * Transfer Approved Items
 *
 * Automatically transfers items from "Approved to Move" sections
 * to the matching sub-pages under "Completed Issues and Features"
 *
 * Usage: bun scripts/transfer-approved.js
 */

import { loadEnv } from './lib/env.js';
import { notionFetch, getChildPages, getBlocks, appendBlocks, deleteBlock, updatePage, getPageIds } from './lib/notion.js';

loadEnv();

const { incomplete: INCOMPLETE_ISSUES_PAGE_ID, complete: COMPLETED_ISSUES_PAGE_ID } = getPageIds();

function extractText(block) {
  const richText = block[block.type]?.rich_text || [];
  return richText.map(t => t.plain_text).join('').trim();
}

async function findApprovedItems(pageId) {
  const blocks = await getBlocks(pageId);
  const approvedItems = [];
  let inApprovedSection = false;

  for (const block of blocks) {
    const text = extractText(block);

    if (block.type === 'heading_2') {
      inApprovedSection = text.toLowerCase().includes('approved to move');
      continue;
    }

    if (inApprovedSection && text && block.type !== 'child_page') {
      approvedItems.push({
        id: block.id,
        type: block.type,
        text: text,
        richText: block[block.type]?.rich_text || [],
        hasChildren: block.has_children || false,
        color: block[block.type]?.color || 'default'
      });
    }
  }

  return approvedItems;
}

async function addToCompletedPage(targetPageId, items) {
  for (const item of items) {
    if (item.type === 'toggle') {
      // Preserve toggle structure: fetch children first, then recreate the toggle
      let children = [];
      if (item.hasChildren) {
        const childBlocks = await getBlocks(item.id);
        children = childBlocks.map(child => {
          const childContent = child[child.type];
          if (!childContent) return null;
          const block = { type: child.type, [child.type]: {} };
          if (childContent.rich_text) block[child.type].rich_text = childContent.rich_text;
          if (childContent.color) block[child.type].color = childContent.color;
          if (childContent.checked !== undefined) block[child.type].checked = childContent.checked;
          return block;
        }).filter(Boolean);
      }

      const toggleBlock = {
        type: 'toggle',
        toggle: {
          rich_text: item.richText,
          color: item.color || 'default',
          children: children
        }
      };

      await appendBlocks(targetPageId, [toggleBlock]);
    } else {
      // Non-toggle blocks: transfer as bulleted list items
      await appendBlocks(targetPageId, [{
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: item.richText.length > 0 ? item.richText : [{ type: 'text', text: { content: item.text } }]
        }
      }]);
    }
    await new Promise(r => setTimeout(r, 350));
  }
}

async function deleteBlocks(blockIds) {
  for (const id of blockIds) {
    await deleteBlock(id);
    await new Promise(r => setTimeout(r, 350));
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          TRANSFER APPROVED ITEMS                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Get all sub-pages
  const incompletePages = await getChildPages(INCOMPLETE_ISSUES_PAGE_ID);
  const completedPages = await getChildPages(COMPLETED_ISSUES_PAGE_ID);

  console.log(`Found ${incompletePages.length} incomplete issue pages`);
  console.log(`Found ${completedPages.length} completed issue pages\n`);

  // Build lookup for completed pages by title (normalized)
  const completedLookup = {};
  for (const page of completedPages) {
    const normalizedTitle = page.title.toLowerCase().replace(/\s*\(items to approve\)\s*/i, '').trim();
    completedLookup[normalizedTitle] = page.id;
  }

  let totalTransferred = 0;
  let pagesUpdated = 0;

  for (const page of incompletePages) {
    // Skip system pages
    if (page.title.toLowerCase().includes('not fixed across')) continue;

    const approvedItems = await findApprovedItems(page.id);

    if (approvedItems.length === 0) continue;

    console.log(`\n📁 ${page.title}: ${approvedItems.length} items to transfer`);

    // Find matching completed page
    const normalizedTitle = page.title.toLowerCase().replace(/\s*\(items to approve\)\s*/i, '').trim();
    let targetPageId = completedLookup[normalizedTitle];

    if (!targetPageId) {
      console.log(`  ⚠️  No matching completed page for "${normalizedTitle}" - creating...`);
      const newPage = await notionFetch('/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { page_id: COMPLETED_ISSUES_PAGE_ID },
          properties: { title: { title: [{ text: { content: normalizedTitle } }] } }
        })
      });
      targetPageId = newPage.id;
      console.log(`  ✓ Created: ${normalizedTitle}`);
    }

    // Transfer items
    await addToCompletedPage(targetPageId, approvedItems);
    console.log(`  ✓ Added ${approvedItems.length} items to Completed`);

    // Delete original items
    await deleteBlocks(approvedItems.map(i => i.id));
    console.log(`  ✓ Removed from Approved to Move`);

    totalTransferred += approvedItems.length;
    pagesUpdated++;

    // Check if we should remove "(Items to Approve)" from title
    if (page.title.includes('(Items to Approve)')) {
      // Check if Waiting for Manual Approval is also empty
      const blocks = await getBlocks(page.id);
      let inWaitingSection = false;
      let waitingHasItems = false;

      for (const block of blocks) {
        const text = extractText(block);
        if (block.type === 'heading_2') {
          inWaitingSection = text.toLowerCase().includes('waiting for manual approval');
          continue;
        }
        if (inWaitingSection && text && block.type !== 'child_page' && block.type !== 'heading_2') {
          waitingHasItems = true;
          break;
        }
      }

      if (!waitingHasItems) {
        const cleanTitle = page.title.replace(/\s*\(Items to Approve\)\s*/i, '').trim();
        await updatePage(page.id, { title: { title: [{ text: { content: cleanTitle } }] } });
        console.log(`  ✓ Removed "(Items to Approve)" suffix`);
      }
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Items transferred: ${totalTransferred}`);
  console.log(`  Pages updated:     ${pagesUpdated}`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
