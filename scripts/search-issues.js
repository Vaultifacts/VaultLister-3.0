/**
 * Cross-Page Issue Search
 *
 * Search across all Notion pages for issues/features:
 * - Find by keyword
 * - Shows which page and section each result is in
 * - Useful for checking if something already exists
 *
 * Usage: bun scripts/search-issues.js <keyword>
 * Example: bun scripts/search-issues.js "dark mode"
 */

import { loadEnv } from './lib/env.js';
import { getChildPages, getBlocks, getPageIds } from './lib/notion.js';

loadEnv();

const { incomplete: INCOMPLETE_ISSUES_PAGE_ID, complete: COMPLETED_ISSUES_PAGE_ID } = getPageIds();

function extractText(block) {
  const richText = block[block.type]?.rich_text || [];
  return richText.map(t => t.plain_text).join('').trim();
}

function highlightMatch(text, keyword) {
  const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safeKeyword})`, 'gi');  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  return text.replace(regex, '\x1b[33m$1\x1b[0m'); // Yellow highlight
}

async function searchInPage(page, keyword, parentType) {
  const results = [];
  const blocks = await getBlocks(page.id);

  let currentSection = 'Unknown';

  for (const block of blocks) {
    const text = extractText(block);

    // Track current section
    if (block.type === 'heading_2') {
      if (text.toLowerCase().includes('issues/features to work on')) {
        currentSection = 'To Work On';
      } else if (text.toLowerCase().includes('waiting for manual approval')) {
        currentSection = 'Waiting Approval';
      } else if (text.toLowerCase().includes('approved to move')) {
        currentSection = 'Approved';
      } else {
        currentSection = text;
      }
      continue;
    }

    // Search for keyword
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      results.push({
        page: page.title,
        parentType,
        section: parentType === 'completed' ? 'Completed' : currentSection,
        text: text,
        blockType: block.type,
        checked: block.type === 'to_do' ? block.to_do?.checked : null
      });
    }
  }

  return results;
}

async function main() {
  const keyword = process.argv.slice(2).join(' ');

  if (!keyword) {
    console.log('Usage: bun scripts/search-issues.js <keyword>');
    console.log('Example: bun scripts/search-issues.js "dark mode"');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          NOTION ISSUE SEARCH                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`Searching for: "${keyword}"\n`);

  const allResults = [];

  // Search Incomplete Issues
  console.log('Searching Incomplete Issues...');
  const incompletePages = await getChildPages(INCOMPLETE_ISSUES_PAGE_ID);

  for (const page of incompletePages) {
    if (page.title.toLowerCase().includes('not fixed across')) continue;
    const results = await searchInPage(page, keyword, 'incomplete');
    allResults.push(...results);
    await new Promise(r => setTimeout(r, 200));
  }

  // Search Completed Issues
  console.log('Searching Completed Issues...');
  const completedPages = await getChildPages(COMPLETED_ISSUES_PAGE_ID);

  for (const page of completedPages) {
    const results = await searchInPage(page, keyword, 'completed');
    allResults.push(...results);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`SEARCH RESULTS (${allResults.length} matches)`);
  console.log('═'.repeat(60) + '\n');

  if (allResults.length === 0) {
    console.log('No matches found.\n');
    console.log('This keyword is NOT in any existing issues or features.');
    console.log('It may be safe to suggest as a new feature.\n');
  } else {
    // Group by status
    const completed = allResults.filter(r => r.parentType === 'completed' || r.section === 'Completed');
    const pending = allResults.filter(r => r.section === 'To Work On' && !r.checked);
    const inProgress = allResults.filter(r => r.section === 'To Work On' && r.checked);
    const waiting = allResults.filter(r => r.section === 'Waiting Approval');
    const approved = allResults.filter(r => r.section === 'Approved');

    if (completed.length > 0) {
      console.log('✅ COMPLETED (' + completed.length + ')');
      console.log('─'.repeat(50));
      completed.forEach(r => {
        const truncated = r.text.length > 70 ? r.text.slice(0, 67) + '...' : r.text;
        console.log(`  [${r.page}]`);
        console.log(`  ${highlightMatch(truncated, keyword)}\n`);
      });
    }

    if (pending.length > 0) {
      console.log('📋 PENDING - To Work On (' + pending.length + ')');
      console.log('─'.repeat(50));
      pending.forEach(r => {
        const truncated = r.text.length > 70 ? r.text.slice(0, 67) + '...' : r.text;
        console.log(`  [${r.page}]`);
        console.log(`  ${highlightMatch(truncated, keyword)}\n`);
      });
    }

    if (inProgress.length > 0) {
      console.log('🔄 IN PROGRESS - Checked (' + inProgress.length + ')');
      console.log('─'.repeat(50));
      inProgress.forEach(r => {
        const truncated = r.text.length > 70 ? r.text.slice(0, 67) + '...' : r.text;
        console.log(`  [${r.page}]`);
        console.log(`  ${highlightMatch(truncated, keyword)}\n`);
      });
    }

    if (waiting.length > 0) {
      console.log('⏳ WAITING FOR APPROVAL (' + waiting.length + ')');
      console.log('─'.repeat(50));
      waiting.forEach(r => {
        const truncated = r.text.length > 70 ? r.text.slice(0, 67) + '...' : r.text;
        console.log(`  [${r.page}]`);
        console.log(`  ${highlightMatch(truncated, keyword)}\n`);
      });
    }

    if (approved.length > 0) {
      console.log('✔️  APPROVED TO MOVE (' + approved.length + ')');
      console.log('─'.repeat(50));
      approved.forEach(r => {
        const truncated = r.text.length > 70 ? r.text.slice(0, 67) + '...' : r.text;
        console.log(`  [${r.page}]`);
        console.log(`  ${highlightMatch(truncated, keyword)}\n`);
      });
    }

    console.log('═'.repeat(60));
    console.log('SUMMARY');
    console.log('─'.repeat(60));
    console.log(`  Completed:         ${completed.length}`);
    console.log(`  Pending:           ${pending.length}`);
    console.log(`  In Progress:       ${inProgress.length}`);
    console.log(`  Waiting Approval:  ${waiting.length}`);
    console.log(`  Approved to Move:  ${approved.length}`);
    console.log('═'.repeat(60));

    if (completed.length > 0) {
      console.log('\n⚠️  This feature/issue appears to be COMPLETED.');
      console.log('   Do NOT suggest it again.\n');
    } else if (pending.length > 0 || waiting.length > 0 || approved.length > 0) {
      console.log('\n⚠️  This feature/issue is already TRACKED.');
      console.log('   No need to suggest it again.\n');
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
