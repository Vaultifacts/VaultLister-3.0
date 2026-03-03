/**
 * Add completed feature to Waiting for Manual Approval section in Notion
 */

import { loadEnv } from './lib/env.js';
import { notionFetch, getBlocks, searchPages, appendBlocks, updatePage, getPageIds } from './lib/notion.js';

loadEnv();

const { incomplete: INCOMPLETE_PAGE_ID } = getPageIds();

// Feature to add - pageId will be looked up dynamically
const feature = {
  pageId: null, // Will be searched
  searchTitle: 'Automations',
  pageName: 'Automations',
  title: 'Automation Run History with Success/Failure Logs',
  description: 'Comprehensive automation run history modal showing detailed execution logs with status, duration, items processed, and error messages.',
  test: [
    '1. Log in to VaultLister',
    '2. Navigate to Automations page',
    '3. Click "Run History" button in the top right',
    '4. View the run history modal with summary stats and log entries',
    '5. Use the status and type filters to filter the logs',
    '6. Click on any log entry to see detailed run information',
    '7. Try the "Export" button to download history as CSV',
    '8. Try the "Clear History" button to clear all logs'
  ],
  expected: [
    'Run History modal opens with:',
    '  - Summary stats showing Total Runs, Successful, Failed, Success Rate',
    '  - Filter dropdowns for Status and Type',
    '  - Export and Clear History buttons',
    '  - Grouped log entries by date with status icons',
    'Each log entry shows automation name, status badge, result message, timestamp, duration, items processed',
    'Clicking a log entry shows detailed view with full stats and error messages',
    'Filters properly hide/show entries based on selection',
    'Export downloads a CSV file with all history data'
  ],
  files: [
    'src/frontend/app.js (showAutomationHistory handler and related functions)',
    'src/backend/routes/automations.js (history endpoints)',
    'src/backend/db/migrations/054_add_automation_history.sql'
  ]
};

async function findWaitingForApprovalSection(blocks) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'heading_2') {
      const text = block.heading_2?.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('waiting for manual approval')) {
        return block.id;
      }
    }
  }
  return null;
}

async function addItemAfterBlock(pageId, waitingHeadingId, content) {
  // Use collapsed toggle block format (NOT plain paragraphs)
  // Append to PAGE (not heading — headings don't support children)
  const toggleBlock = {
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: [
        { type: 'text', text: { content: '\ud83d\udd27 ' } },
        { type: 'text', text: { content: content.title }, annotations: { bold: true } }
      ],
      color: 'default',
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { type: 'text', text: { content: content.description }, annotations: { italic: true, color: 'gray' } }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Test: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: Array.isArray(content.test) ? content.test.join(' → ') : content.test } }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Expected: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: Array.isArray(content.expected) ? content.expected.join('; ') : content.expected } }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Files: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: Array.isArray(content.files) ? content.files.join(', ') : content.files }, annotations: { code: true } }
            ]
          }
        }
      ]
    }
  };

  await appendBlocks(pageId, [toggleBlock], waitingHeadingId);
}

async function searchForPage(title) {
  const data = await searchPages(title);

  // Find page under Incomplete Issues
  const page = (data.results || []).find(p =>
    p.parent?.page_id === INCOMPLETE_PAGE_ID &&
    (p.properties?.title?.title?.[0]?.plain_text || '').toLowerCase().includes(title.toLowerCase())
  );

  return page?.id || null;
}

async function main() {
  console.log('Adding completed feature to Waiting for Manual Approval...\n');
  console.log(`Feature: ${feature.title}`);
  console.log(`Page: ${feature.pageName}\n`);

  // Search for page if ID not provided
  let pageId = feature.pageId;
  if (!pageId && feature.searchTitle) {
    console.log(`Searching for page: ${feature.searchTitle}...`);
    pageId = await searchForPage(feature.searchTitle);
    if (!pageId) {
      console.log(`ERROR: Could not find page "${feature.searchTitle}"`);
      process.exit(1);
    }
    console.log(`Found page: ${pageId}\n`);
  }

  // Get page blocks
  const blocks = await getBlocks(pageId);

  // Find "Waiting for Manual Approval" section
  const sectionId = await findWaitingForApprovalSection(blocks);

  if (!sectionId) {
    console.log('ERROR: Could not find "Waiting for Manual Approval" section');
    process.exit(1);
  }

  console.log('Found "Waiting for Manual Approval" section');

  // Add the feature content after the section header (pass pageId, not heading ID)
  await addItemAfterBlock(pageId, sectionId, feature);
  console.log('Added feature content');

  // Update page title to include "(Items to Approve)"
  const newTitle = `${feature.pageName} (Items to Approve)`;
  await updatePage(pageId, { title: { title: [{ text: { content: newTitle } }] } });
  console.log(`Updated page title to: ${newTitle}`);

  console.log('\nDone! Feature added to Waiting for Manual Approval.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
