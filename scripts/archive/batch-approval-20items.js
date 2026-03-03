/**
 * Batch add 20 completed items to Waiting for Manual Approval
 * Categories: Transactions (10), Offers (5), Automations (5)
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');

// Load .env
const envFile = Bun.file(envPath);
const envText = await envFile.text();
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const NOTION_KEY = process.env.NOTION_INTEGRATION_TOKEN;
const INCOMPLETE_PAGE_ID = '3f13f0ec-f382-8394-94e8-81b1614d19ab';

const headers = {
  'Authorization': `Bearer ${NOTION_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
};

async function notionFetch(endpoint, options = {}) {
  const res = await fetch(`https://api.notion.com/v1${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (data.object === 'error') {
    throw new Error(`Notion API error: ${data.message}`);
  }
  return data;
}

async function getPageBlocks(pageId) {
  const allBlocks = [];
  let cursor = undefined;
  do {
    const url = `/blocks/${pageId}/children?page_size=100${cursor ? '&start_cursor=' + cursor : ''}`;
    const data = await notionFetch(url);
    allBlocks.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return allBlocks;
}

async function findWaitingSection(blocks) {
  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = block.heading_2?.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('waiting for manual approval')) return block.id;
    }
  }
  return null;
}

async function searchForPage(title) {
  const data = await notionFetch('/search', {
    method: 'POST',
    body: JSON.stringify({ query: title, filter: { property: 'object', value: 'page' } })
  });
  const page = (data.results || []).find(p =>
    p.parent?.page_id === INCOMPLETE_PAGE_ID &&
    (p.properties?.title?.title?.[0]?.plain_text || '').toLowerCase().includes(title.toLowerCase())
  );
  return page?.id || null;
}

function createToggleBlock(item) {
  return {
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
          object: 'block', type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: item.description }, annotations: { italic: true, color: 'gray' } }] }
        },
        {
          object: 'block', type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: [
            { type: 'text', text: { content: 'Test: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: item.test } }
          ]}
        },
        {
          object: 'block', type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: [
            { type: 'text', text: { content: 'Expected: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: item.expected } }
          ]}
        },
        {
          object: 'block', type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: [
            { type: 'text', text: { content: 'Files: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: item.files }, annotations: { code: true } }
          ]}
        }
      ]
    }
  };
}

async function updatePageTitle(pageId, title) {
  await notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: { title: { title: [{ text: { content: title } }] } } })
  });
}

// ========== ITEMS TO ADD ==========

const categories = {
  'Transactions': [
    {
      title: 'Advanced Multi-Field Transaction Filtering',
      description: 'Added amount range (min/max), category filter, active filter count badge, and Clear All button to the transactions page filter bar.',
      test: 'Go to Transactions > Use min/max amount inputs, category dropdown > Click Clear All to reset',
      expected: 'Filters narrow transactions; badge shows count; Clear All resets all filters',
      files: 'src/frontend/app.js (transactions page filter bar)'
    },
    {
      title: 'Reactive Summary Stats After Filtering',
      description: 'Stats cards (Total Purchases, Total Revenue, etc.) now recalculate after filters are applied, showing "Showing X of Y" when filters are active.',
      test: 'Go to Transactions > Apply a filter > Observe stats cards update',
      expected: 'Stats reflect only filtered data; "Showing X of Y" label appears when filtered',
      files: 'src/frontend/app.js (transactions stats calculation)'
    },
    {
      title: 'Transaction Auto-Categorization Rules',
      description: 'Auto-categorize button scans uncategorized transactions and applies pattern-matching rules. Backend endpoint: POST /financials/auto-categorize.',
      test: 'Go to Transactions > Click Auto-Categorize > Check transactions get categories applied',
      expected: 'Uncategorized transactions are matched against rules and assigned categories',
      files: 'src/backend/routes/financials.js (auto-categorize endpoint), src/frontend/app.js (handler)'
    },
    {
      title: 'Transaction Split Functionality',
      description: 'Split a transaction into multiple parts. Each part gets its own description, amount, and category. Amounts must sum to original.',
      test: 'Go to Transactions > Click scissors icon on any row > Add 2+ splits > Submit',
      expected: 'Original transaction is zeroed; child transactions appear with split amounts',
      files: 'src/backend/routes/financials.js (split endpoint), src/frontend/app.js (showSplitTransactionModal), src/backend/db/migrations/060_transaction_enhancements.sql'
    },
    {
      title: 'Running Balance Per-Row Enhancement',
      description: 'Each transaction row in table view shows a cumulative running balance column, calculated from oldest to newest.',
      test: 'Go to Transactions > View table > Check Running Balance column',
      expected: 'Each row shows cumulative balance up to that point; positive/negative colored',
      files: 'src/frontend/app.js (running balance calculation in transactions page)'
    },
    {
      title: 'Recurring Transaction Templates',
      description: 'CRUD for recurring templates. Create templates with description, amount, category, frequency. Execute a template to instantly create a transaction.',
      test: 'Click Recurring button > New Template > Fill form > Execute > Check new transaction',
      expected: 'Template created; executing creates a real transaction with today\'s date',
      files: 'src/backend/routes/financials.js (recurring-templates CRUD), src/frontend/app.js (recurring template handlers), src/backend/db/migrations/060_transaction_enhancements.sql'
    },
    {
      title: 'Transaction Tagging with Custom Tags',
      description: 'Tag transactions with predefined or custom tags. Filter by tag using the tag bar above the sales table.',
      test: 'Go to Transactions > Sales tab > Click + on any row > Select/add tags',
      expected: 'Tags appear as colored badges; tag filter bar shows quick-filter buttons',
      files: 'src/frontend/app.js (showAddTagModal, saveTransactionTags, tag filter bar)'
    },
    {
      title: 'Receipt Attachment on Transactions',
      description: 'Attach receipt images (up to 2MB) to any transaction. View and delete attachments via modal.',
      test: 'Click paperclip icon on transaction > Upload image > View attachments',
      expected: 'Receipt uploaded and listed; can be viewed and deleted from attachments modal',
      files: 'src/backend/routes/financials.js (attachment endpoints), src/frontend/app.js (receipt handlers), src/backend/db/migrations/060_transaction_enhancements.sql'
    },
    {
      title: 'Transaction Audit Log',
      description: 'Every edit or split creates an audit trail. View the log via the clock icon on each transaction row.',
      test: 'Edit a transaction > Click clock icon > View changes',
      expected: 'Audit modal shows date, action, field, old value, new value for each change',
      files: 'src/backend/routes/financials.js (audit log endpoints + PUT handler), src/frontend/app.js (showTransactionAuditLog), src/backend/db/migrations/060_transaction_enhancements.sql'
    },
    {
      title: 'Transaction Database Migration (060)',
      description: 'Migration 060 adds: parent_transaction_id, is_split, split_note columns; transaction_attachments table; recurring_transaction_templates table; transaction_audit_log table.',
      test: 'Server starts without errors > Migration auto-applies > Check tables exist',
      expected: 'Migration runs on startup; new tables and columns available',
      files: 'src/backend/db/migrations/060_transaction_enhancements.sql, src/backend/db/database.js'
    }
  ],
  'Offers': [
    {
      title: 'Offer Expiration Countdown Timer',
      description: 'Offers show urgency-based countdown timers with critical/urgent/warning/normal states based on time remaining.',
      test: 'Go to Offers page > Check countdown badges on offer cards',
      expected: 'Red critical (<1h), orange urgent (<6h), yellow warning (<24h), green normal states',
      files: 'src/frontend/app.js (offer countdown in offers page)'
    },
    {
      title: 'Saved Offer Decline Responses',
      description: '6 preset decline responses plus custom textarea. Quick-select a reason when declining offers.',
      test: 'Decline an offer > See preset responses > Select one or write custom',
      expected: 'Modal shows 6 presets (Too Low, Not Interested, etc.) + custom input',
      files: 'src/frontend/app.js (decline response modal and presets)'
    },
    {
      title: 'Best Offer Badge Highlighting',
      description: 'Gold gradient "BEST" badge appears on the highest offer for each item.',
      test: 'Go to Offers page > Look for gold BEST badge on highest offers',
      expected: 'Gold gradient badge appears next to the best (highest) offer',
      files: 'src/frontend/app.js (best offer badge rendering)'
    },
    {
      title: 'Offer History Per Item',
      description: 'View complete offer history grouped by listing. Shows acceptance rate, most negotiated item, and per-item offer timelines.',
      test: 'Go to Offers > Click "Offer History" button > View grouped history',
      expected: 'Modal shows items sorted by offer count; each item shows offer timeline with status',
      files: 'src/frontend/app.js (showItemOfferHistory handler)'
    },
    {
      title: 'Decline Button Visibility Fix (btn-error CSS)',
      description: 'Added missing .btn-error CSS class so decline buttons are properly visible in both light and dark mode.',
      test: 'Go to Offers > Check decline buttons are visible > Toggle dark mode > Verify still visible',
      expected: 'Red decline buttons render correctly in light and dark mode',
      files: 'src/frontend/styles/main.css (.btn-error, .btn-error:hover, dark mode variant)'
    }
  ],
  'Automations': [
    {
      title: 'Conditional Logic in Automation Chains',
      description: 'Full conditional logic wizard with AND/OR operators, else-actions, and multi-condition support in automation chains.',
      test: 'Go to Automations > Create Custom > Add conditions with AND/OR > Add else-actions',
      expected: 'Wizard allows complex conditional chains with multiple conditions and fallback actions',
      files: 'src/frontend/app.js (automation wizard conditional logic)'
    },
    {
      title: 'Automation Dry-Run Testing Mode',
      description: 'Test automations without executing real actions. Shows simulated results with item count and estimated duration.',
      test: 'Go to Automations > Click test icon on any automation > View dry-run results',
      expected: 'Dry-run modal shows simulated execution with item count and estimated outcome',
      files: 'src/frontend/app.js (testAutomation, _simulateDryRun handlers)'
    },
    {
      title: 'Automation Run History Population from TaskWorker',
      description: 'TaskWorker now writes to automation_runs table on every task success/failure. History modal shows real execution data.',
      test: 'Run an automation > Go to Run History > Verify real entry appears (not just mock data)',
      expected: 'automation_runs table populated with real data; history modal shows actual runs',
      files: 'src/backend/workers/taskWorker.js (automation_runs INSERT on success/failure)'
    },
    {
      title: 'Automation Failure Alert Banner',
      description: 'Red alert banner appears at top of Automations page when any automations have failed recently. Links to Run History.',
      test: 'Go to Automations page > If failures exist, banner appears > Click "View Failures"',
      expected: 'Red banner shows failure count and links to run history modal',
      files: 'src/frontend/app.js (automations page failure banner, loadAutomations history fetch)'
    },
    {
      title: 'Automation History Real-Time Loading',
      description: 'Automations page now loads run history alongside automation rules. Failure count is calculated from real API data.',
      test: 'Navigate to Automations > Check that history data loads (banner reflects real failures)',
      expected: 'loadAutomations fetches /automations/history; page reflects real data',
      files: 'src/frontend/app.js (loadAutomations handler with history fetch)'
    }
  ]
};

async function main() {
  console.log('=== Batch Adding 20 Items to Waiting for Manual Approval ===\n');

  let totalAdded = 0;

  for (const [categoryName, items] of Object.entries(categories)) {
    console.log(`\n--- ${categoryName} (${items.length} items) ---`);

    // Find the category page under Incomplete Issues
    const pageId = await searchForPage(categoryName);
    if (!pageId) {
      console.log(`  ERROR: Could not find page "${categoryName}"`);
      continue;
    }
    console.log(`  Found page: ${pageId}`);

    // Get blocks to find Waiting for Manual Approval section
    const blocks = await getPageBlocks(pageId);
    const waitingId = await findWaitingSection(blocks);

    if (!waitingId) {
      console.log(`  ERROR: No "Waiting for Manual Approval" section found`);
      continue;
    }
    console.log(`  Found Waiting section: ${waitingId}`);

    // Add items one at a time (Notion API rate limit)
    for (const item of items) {
      try {
        const toggleBlock = createToggleBlock(item);
        await notionFetch(`/blocks/${pageId}/children`, {
          method: 'PATCH',
          body: JSON.stringify({ after: waitingId, children: [toggleBlock] })
        });
        console.log(`  + ${item.title}`);
        totalAdded++;
        // Rate limit delay
        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        console.log(`  ERROR adding "${item.title}": ${err.message}`);
      }
    }

    // Update page title
    try {
      await updatePageTitle(pageId, `${categoryName} (Items to Approve)`);
      console.log(`  Updated title: ${categoryName} (Items to Approve)`);
    } catch (err) {
      console.log(`  Warning: Could not update title: ${err.message}`);
    }
  }

  console.log(`\n=== Done! Added ${totalAdded} of 20 items ===`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
