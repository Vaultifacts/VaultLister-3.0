/**
 * Batch add Settings (3), Analytics (6), Checklist (11) items to Waiting for Manual Approval
 * Total: 20 items (16 already done + 4 newly implemented)
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');

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
  return res.json();
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
  return page;
}

function makeToggleBlock(item) {
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
          paragraph: {
            rich_text: [{ type: 'text', text: { content: item.description }, annotations: { italic: true, color: 'gray' } }]
          }
        },
        {
          object: 'block', type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Test: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: item.test } }
            ]
          }
        },
        {
          object: 'block', type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Expected: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: item.expected } }
            ]
          }
        },
        {
          object: 'block', type: 'bulleted_list_item',
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
}

// All 20 items grouped by category page
const itemsByPage = {
  'Settings': [
    {
      title: 'Account Activity Log with Login History',
      description: 'Full account activity section in Settings > Data tab showing login history with device, IP address, and location info.',
      test: 'Go to Settings > Data tab > scroll to Account Activity section',
      expected: 'Activity log displays with device, IP, location columns and recent login entries',
      files: 'src/frontend/app.js (lines ~23437-23511)'
    },
    {
      title: 'Data Retention Settings',
      description: 'Configurable data retention settings in Settings > Data tab allowing users to set how long different data types are kept.',
      test: 'Go to Settings > Data tab > find Data Retention section > adjust retention periods',
      expected: 'Retention config UI with period selectors for each data type and cleanup handlers',
      files: 'src/frontend/app.js (lines ~23514-23619, handlers ~40211-40303)'
    },
    {
      title: 'Account Usage Statistics',
      description: 'Modal showing comprehensive account usage stats including platform breakdown and trend chart.',
      test: 'Go to Settings > Data tab > click "Usage Statistics" or trigger showAccountUsage handler',
      expected: 'Modal displays with item counts, platform breakdown bars, and usage trend chart',
      files: 'src/frontend/app.js (lines ~57163-57225)'
    }
  ],
  'Analytics': [
    {
      title: 'Comparison Mode Overlay',
      description: 'Analytics comparison mode with toggle button that overlays previous period data on charts with summary cards.',
      test: 'Go to Analytics > click "Compare" button in header > view comparison overlay',
      expected: 'Compare button toggles mode; charts show previous period overlay; summary cards show Revenue/Sales/AOV/Margin changes',
      files: 'src/frontend/app.js (lines ~20404, ~20856-20890)'
    },
    {
      title: 'Real-time Analytics Dashboard',
      description: 'Full "Live" tab on analytics page with auto-refresh, pause control, and today metrics including recent sales and alerts.',
      test: 'Go to Analytics > click "Live" tab > view real-time metrics',
      expected: 'Live tab shows today revenue, orders, inventory, listings with refresh/pause controls and recent sales list',
      files: 'src/frontend/app.js (lines ~20558-20675)'
    },
    {
      title: 'Quick Date Range Presets',
      description: 'Date range selector with 5 presets (7d, 30d, 90d, 6m, 1y) plus custom range option on analytics page.',
      test: 'Go to Analytics > use the period dropdown in the header',
      expected: 'Dropdown shows Last 7 Days, 30 Days, 90 Days, 6 Months, Last Year, Custom Range options; data updates on change',
      files: 'src/frontend/app.js (lines ~20397-20402)'
    },
    {
      title: 'Custom Metric Builder (KPI Creator)',
      description: 'Modal for creating custom KPIs by combining existing metrics (Revenue, Profit, Orders, etc.) with math operations. Custom metrics display as cards on the analytics dashboard.',
      test: 'Go to Analytics > click More > Custom KPIs > create a metric (e.g., Revenue / Orders = Revenue per Order) > save',
      expected: 'Custom KPI modal opens with name, metric selectors, operation, format; saved metrics appear as cards above analytics hero section; deletable via X button',
      files: 'src/frontend/app.js (showCustomMetricBuilder, saveCustomMetric, deleteCustomMetric handlers), src/backend/routes/analytics.js (custom-metrics CRUD), src/backend/db/migrations/061_analytics_and_checklist_enhancements.sql, src/frontend/styles/main.css (custom-kpi-grid)'
    },
    {
      title: 'Email-Scheduled Analytics Digests',
      description: 'Modal for configuring analytics digest emails with frequency (daily/weekly/monthly), email address, and enable toggle. Settings saved to backend.',
      test: 'Go to Analytics > click More > Schedule Digest > configure email, frequency, enable > save',
      expected: 'Digest settings modal opens; frequency/email/toggle are configurable; settings persist after save; toast confirms save',
      files: 'src/frontend/app.js (showAnalyticsDigestSettings, saveDigestSettings handlers), src/backend/routes/analytics.js (digest-settings endpoints), src/backend/db/migrations/061_analytics_and_checklist_enhancements.sql'
    }
  ],
  'Checklist': [
    {
      title: 'Templates for Common Workflows',
      description: 'Predefined checklist templates for common reseller workflows accessible from the Templates button on checklist page.',
      test: 'Go to Checklist > click "Templates" button > view and apply a template',
      expected: 'Template modal shows predefined templates (Sourcing, Listing, Shipping, etc.); selecting one populates tasks',
      files: 'src/frontend/app.js (showTaskTemplates handler ~38308, template definitions ~12700-12797)'
    },
    {
      title: 'Sub-tasks/Nested Items',
      description: 'Support for sub-tasks under main checklist items with expand/collapse, progress tracking, and individual completion.',
      test: 'Go to Checklist > click "+" on any task > add a subtask > toggle expand > complete subtask',
      expected: 'Subtasks render nested under parent; expand/collapse chevron works; progress bar shows completion; individual toggle works',
      files: 'src/frontend/app.js (subtask rendering ~24628-24688, toggle logic ~46992)'
    },
    {
      title: 'Notes and File Attachments on Tasks',
      description: 'Checklist items support notes text and file attachment badges displayed inline.',
      test: 'Go to Checklist > edit a task > add notes and attachments > save',
      expected: 'Notes preview shows below task title (truncated to 80 chars); attachment badges show with paperclip icon',
      files: 'src/frontend/app.js (lines ~24647-24648), src/backend/db/migrations/056_add_checklist_notes.sql'
    },
    {
      title: 'Checklist Analytics with Completion Trends',
      description: 'Full analytics modal showing completion rates by priority, category breakdown, and weekly completion bar chart.',
      test: 'Go to Checklist > click blue "Analytics" button > view analytics modal',
      expected: 'Modal shows priority breakdown bars, category completion rates, weekly trend chart, and productivity tips',
      files: 'src/frontend/app.js (showChecklistAnalytics handler ~57026-57160)'
    },
    {
      title: 'Select All Button for Checklist',
      description: 'Select all checkbox in checklist header to bulk-select/deselect all visible tasks.',
      test: 'Go to Checklist > click the select all checkbox in the header',
      expected: 'All visible tasks get selected/deselected; bulk actions become available',
      files: 'src/frontend/app.js (selectAll handler ~10422, checkbox ~17478)'
    },
    {
      title: 'Quick Add Task Inline Input',
      description: 'Inline input field at bottom of checklist for quickly adding tasks without opening a modal.',
      test: 'Go to Checklist > type in the quick-add input at the bottom > press Enter or click Add',
      expected: 'New task is created immediately and appears in the list; input clears for next entry',
      files: 'src/frontend/app.js (inline input ~24930, quickAddTask handler ~46844)'
    },
    {
      title: 'Sharing/Assignment to Team Members',
      description: 'Share checklist with team members via email or team member selection with permission levels (view/edit/admin).',
      test: 'Go to Checklist > click "Share" button > enter email or select team member > set permission > click Share',
      expected: 'Share modal opens with email input, permission dropdown, team member list; sharing creates a share record; toast confirms',
      files: 'src/frontend/app.js (showShareChecklist, submitShareChecklist handlers), src/backend/routes/checklists.js (share endpoint), src/backend/db/migrations/061_analytics_and_checklist_enhancements.sql'
    },
    {
      title: 'Checklist Analytics Icon Visibility Fix',
      description: 'Analytics button icon on checklist page changed from default gray to blue (var(--primary-500)) for better visibility.',
      test: 'Go to Checklist > look at the Analytics button in the header',
      expected: 'Analytics button icon (bar chart) displays in blue color instead of gray',
      files: 'src/frontend/app.js (line ~24738-24740)'
    }
  ]
};

async function main() {
  console.log('=== Batch Add: Settings (3) + Analytics (6) + Checklist (11) = 20 items ===\n');

  let totalAdded = 0;
  let totalFailed = 0;

  for (const [pageName, items] of Object.entries(itemsByPage)) {
    console.log(`\n--- ${pageName} (${items.length} items) ---`);

    // Find the category page
    const pageResult = await searchForPage(pageName);
    if (!pageResult) {
      console.log(`  ERROR: Could not find page "${pageName}" - skipping ${items.length} items`);
      totalFailed += items.length;
      continue;
    }
    const pageId = pageResult.id;
    const currentTitle = pageResult.properties?.title?.title?.[0]?.plain_text || pageName;
    console.log(`  Found page: ${pageId} ("${currentTitle}")`);

    // Get blocks and find Waiting section
    const blocks = await getPageBlocks(pageId);
    const waitingId = await findWaitingSection(blocks);

    if (!waitingId) {
      console.log(`  ERROR: No "Waiting for Manual Approval" section found - skipping`);
      totalFailed += items.length;
      continue;
    }

    console.log(`  Found "Waiting for Manual Approval" section`);

    // Add each item as a toggle block
    for (const item of items) {
      try {
        const toggleBlock = makeToggleBlock(item);
        await notionFetch(`/blocks/${pageId}/children`, {
          method: 'PATCH',
          body: JSON.stringify({ after: waitingId, children: [toggleBlock] })
        });
        console.log(`  + Added: ${item.title}`);
        totalAdded++;
        await new Promise(r => setTimeout(r, 350)); // Rate limit
      } catch (err) {
        console.log(`  ERROR adding "${item.title}": ${err.message}`);
        totalFailed++;
      }
    }

    // Update page title with "(Items to Approve)" if not already there
    if (!currentTitle.includes('Items to Approve')) {
      const newTitle = `${pageName} (Items to Approve)`;
      await notionFetch(`/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties: { title: { title: [{ text: { content: newTitle } }] } } })
      });
      console.log(`  Updated title: "${newTitle}"`);
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`  Added: ${totalAdded}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  Total: ${totalAdded + totalFailed}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
