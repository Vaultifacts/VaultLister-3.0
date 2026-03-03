/**
 * Check off completed to-do items from "Issues/Features to Work On" sections
 * for Settings, Analytics, and Checklist pages.
 * These items have been implemented and moved to "Waiting for Manual Approval".
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

function extractText(block) {
  const rt = block[block.type]?.rich_text || [];
  return rt.map(t => t.plain_text).join('').trim().toLowerCase();
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

// Keywords to match for each category (lowercase)
const completedKeywords = {
  'Settings': [
    'account activity log', 'login history',
    'data retention',
    'account usage statistics', 'usage statistics'
  ],
  'Analytics': [
    'comparison mode', 'compare mode',
    'real-time analytics', 'real time analytics', 'realtime',
    'date range preset', 'quick date range',
    'custom metric', 'custom kpi', 'kpi builder', 'metric builder',
    'email digest', 'scheduled digest', 'email-scheduled', 'digest'
  ],
  'Checklist': [
    'template', 'common workflow',
    'sub-task', 'subtask', 'nested item',
    'notes', 'file attachment', 'attachments',
    'checklist analytics', 'completion trend',
    'select all',
    'quick add', 'inline input',
    'sharing', 'assignment', 'team member', 'share checklist',
    'icon visibility', 'icon color', 'analytics icon'
  ]
};

async function checkOffTodosForPage(pageName, keywords) {
  console.log(`\n--- ${pageName} ---`);

  const pageId = await searchForPage(pageName);
  if (!pageId) {
    console.log(`  ERROR: Could not find page "${pageName}"`);
    return 0;
  }
  console.log(`  Found page: ${pageId}`);

  const blocks = await getPageBlocks(pageId);

  // Find "Issues/Features to Work On" section and collect to_do blocks
  let inWorkSection = false;
  const todosToCheck = [];

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = extractText(block);
      if (text.includes('issues') || text.includes('features to work on')) {
        inWorkSection = true;
      } else {
        inWorkSection = false;
      }
      continue;
    }

    if (inWorkSection && block.type === 'to_do' && !block.to_do?.checked) {
      const text = extractText(block);
      // Check if this to-do matches any of our completed keywords
      const matches = keywords.some(kw => text.includes(kw));
      if (matches) {
        todosToCheck.push({ id: block.id, text: text.substring(0, 80) });
      }
    }
  }

  if (todosToCheck.length === 0) {
    console.log('  No matching unchecked to-dos found');
    return 0;
  }

  console.log(`  Found ${todosToCheck.length} to-dos to check off:`);
  let checked = 0;
  for (const todo of todosToCheck) {
    try {
      await notionFetch(`/blocks/${todo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ to_do: { checked: true } })
      });
      console.log(`  ✓ Checked: ${todo.text}`);
      checked++;
      await new Promise(r => setTimeout(r, 350));
    } catch (err) {
      console.log(`  ERROR checking "${todo.text}": ${err.message}`);
    }
  }

  return checked;
}

async function main() {
  console.log('=== Checking off completed to-do items from pending sections ===');

  let totalChecked = 0;

  for (const [pageName, keywords] of Object.entries(completedKeywords)) {
    totalChecked += await checkOffTodosForPage(pageName, keywords);
  }

  console.log(`\n=== Done: ${totalChecked} to-do items checked off ===`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
