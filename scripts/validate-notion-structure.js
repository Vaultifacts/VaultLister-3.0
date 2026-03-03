/**
 * Notion Structure Validator
 *
 * Validates that all Notion pages have the correct structure:
 * - All sub-pages have required sections
 * - Section headers are heading_2 (not checkboxes)
 * - Reports structural issues that need fixing
 *
 * Usage: bun scripts/validate-notion-structure.js
 */

import { loadEnv } from './lib/env.js';
import { getChildPages, getBlocks, getPageIds } from './lib/notion.js';

loadEnv();

const { incomplete: INCOMPLETE_ISSUES_PAGE_ID, complete: COMPLETED_ISSUES_PAGE_ID } = getPageIds();

function extractText(block) {
  const richText = block[block.type]?.rich_text || [];
  return richText.map(t => t.plain_text).join('').trim();
}

const REQUIRED_SECTIONS = [
  'Issues/Features to Work On',
  'Waiting for Manual Approval',
  'Approved to Move'
];

async function validateIncompletePage(page) {
  const issues = [];
  const blocks = await getBlocks(page.id);

  // Check for required sections
  const foundSections = {};
  const sectionIssues = [];

  for (const block of blocks) {
    const text = extractText(block);

    for (const section of REQUIRED_SECTIONS) {
      if (text.toLowerCase().includes(section.toLowerCase().slice(0, 20))) {
        foundSections[section] = {
          found: true,
          type: block.type,
          isHeading2: block.type === 'heading_2'
        };

        if (block.type !== 'heading_2') {
          sectionIssues.push({
            section,
            issue: `Should be heading_2, but is ${block.type}`,
            blockId: block.id
          });
        }
      }
    }
  }

  // Check for missing sections
  for (const section of REQUIRED_SECTIONS) {
    if (!foundSections[section]) {
      issues.push({
        type: 'missing_section',
        section,
        message: `Missing section: "${section}"`
      });
    }
  }

  // Add section type issues
  for (const si of sectionIssues) {
    issues.push({
      type: 'wrong_section_type',
      section: si.section,
      message: si.issue,
      blockId: si.blockId
    });
  }

  // Check for "(Items to Approve)" suffix consistency
  const hasWaitingItems = blocks.some(b => {
    const text = extractText(b);
    return b.type !== 'heading_2' && b.type !== 'child_page' && text.length > 0;
  });

  const hasSuffix = page.title.includes('(Items to Approve)');

  // This is informational, not necessarily an issue
  if (hasSuffix && !hasWaitingItems) {
    issues.push({
      type: 'info',
      message: 'Has "(Items to Approve)" suffix but may not have waiting items'
    });
  }

  return issues;
}

async function validateCompletedPage(page) {
  const issues = [];
  const blocks = await getBlocks(page.id);

  // Completed pages should NOT have section headers
  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = extractText(block);
      issues.push({
        type: 'unexpected_header',
        message: `Completed page has section header: "${text}"`
      });
    }
  }

  // Should have content (bullet items)
  const hasContent = blocks.some(b =>
    b.type === 'bulleted_list_item' || b.type === 'paragraph' || b.type === 'toggle'
  );

  if (!hasContent && blocks.length === 0) {
    issues.push({
      type: 'info',
      message: 'Page is empty (no completed items yet)'
    });
  }

  return issues;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          NOTION STRUCTURE VALIDATOR                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let totalIssues = 0;
  let totalWarnings = 0;

  // Validate Incomplete Issues pages
  console.log('Validating Incomplete Issues & Features...\n');
  const incompletePages = await getChildPages(INCOMPLETE_ISSUES_PAGE_ID);

  for (const page of incompletePages) {
    if (page.title.toLowerCase().includes('not fixed across')) continue;

    const issues = await validateIncompletePage(page);
    const errors = issues.filter(i => i.type !== 'info');
    const infos = issues.filter(i => i.type === 'info');

    if (errors.length > 0) {
      console.log(`❌ ${page.title}`);
      errors.forEach(issue => {
        console.log(`   └─ ${issue.message}`);
        totalIssues++;
      });
    } else if (infos.length > 0) {
      console.log(`⚠️  ${page.title}`);
      infos.forEach(issue => {
        console.log(`   └─ ${issue.message}`);
        totalWarnings++;
      });
    } else {
      console.log(`✓  ${page.title}`);
    }

    await new Promise(r => setTimeout(r, 300)); // Rate limit
  }

  console.log('\n' + '─'.repeat(60) + '\n');

  // Validate Completed Issues pages
  console.log('Validating Completed Issues and Features...\n');
  const completedPages = await getChildPages(COMPLETED_ISSUES_PAGE_ID);

  for (const page of completedPages) {
    const issues = await validateCompletedPage(page);
    const errors = issues.filter(i => i.type !== 'info');
    const infos = issues.filter(i => i.type === 'info');

    if (errors.length > 0) {
      console.log(`❌ ${page.title}`);
      errors.forEach(issue => {
        console.log(`   └─ ${issue.message}`);
        totalIssues++;
      });
    } else if (infos.length > 0) {
      console.log(`ℹ️  ${page.title}`);
      infos.forEach(issue => {
        console.log(`   └─ ${issue.message}`);
      });
    } else {
      console.log(`✓  ${page.title}`);
    }

    await new Promise(r => setTimeout(r, 300)); // Rate limit
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Incomplete pages checked: ${incompletePages.length}`);
  console.log(`  Completed pages checked:  ${completedPages.length}`);
  console.log(`  Issues found:            ${totalIssues}`);
  console.log(`  Warnings:                ${totalWarnings}`);

  if (totalIssues === 0) {
    console.log('\n  ✅ All pages have valid structure!');
  } else {
    console.log('\n  ⚠️  Some pages need attention. See details above.');
  }

  console.log('═'.repeat(60));

  // Exit with error code if issues found
  if (totalIssues > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
