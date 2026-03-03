#!/usr/bin/env bun
// Batch update: Check off to-do items + add toggle blocks for Changelog items (6 items)
// Also updates Roadmap page for the "public changelog linked" item

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = {
  changelog: { id: 'c993f0ec-f382-828b-996e-81f8c2d19690', name: 'Changelog' },
  roadmap: { id: 'fcc3f0ec-f382-82db-b0fb-81ae5ec96553', name: 'Roadmap' },
};

const features = [
  // CHANGELOG - Already implemented (search + date-grouped were pre-existing)
  {
    pageKey: 'changelog',
    title: 'Search Functionality Within Changelog',
    description: 'Full-text search across changelog entries. Searches title, description, and affected areas. Real-time filtering as user types.',
    test: 'Go to Changelog > Type in search box > Enter a term like "calendar"',
    expected: 'Entries filter in real-time showing only matching changes. Searches title, description, and affected area tags.',
    files: 'src/frontend/app.js:29278 (search input), 29196-29201 (filter logic)'
  },
  {
    pageKey: 'changelog',
    title: 'Date-Grouped Changelog with Expand/Collapse',
    description: 'Changelog entries grouped by version release date. Each version card shows date, change count, and expandable change items with details, affected areas, and voting.',
    test: 'Go to Changelog > Click on a change item > Check expand/collapse works',
    expected: 'Clicking a change item expands it to show full description, affected area badges, and voting buttons. Click again to collapse.',
    files: 'src/frontend/app.js:29339-29407 (change items with expand), 42463-42472 (toggleChangeDetails handler)'
  },
  {
    pageKey: 'changelog',
    title: 'What\'s New Banner on Dashboard',
    description: 'Dismissible banner at top of dashboard showing latest version (v1.6.0) with summary. Links to full changelog. Persists dismiss state.',
    test: 'Go to Dashboard > See "New in v1.6.0" banner > Click "View Changelog" > Dismiss banner',
    expected: 'Banner shows latest version. "View Changelog" navigates to changelog page. X button dismisses permanently.',
    files: 'src/frontend/app.js:16878-16893 (banner HTML), main.css:23728-23773 (banner CSS)'
  },
  {
    pageKey: 'changelog',
    title: 'RSS/Atom Feed for Changelog',
    description: 'RSS feed endpoint at /api/roadmap/changelog/rss. Frontend RSS button in changelog header opens modal with copyable feed URL. Generates valid RSS 2.0 XML.',
    test: 'Go to Changelog > Click "RSS Feed" button > Copy URL > Open in browser',
    expected: 'Modal shows RSS feed URL with copy button. URL returns valid RSS XML with all version entries.',
    files: 'src/frontend/app.js:42578-42605 (openChangelogRSS handler), src/backend/routes/roadmap.js:200-235 (RSS endpoint)'
  },
  {
    pageKey: 'changelog',
    title: 'Changelog Voting (Helpful/Not Helpful)',
    description: 'Each expanded change item has thumbs-up/thumbs-down voting. Vote counts persist via localStorage. Toggle vote on re-click. Prevents double-voting.',
    test: 'Go to Changelog > Expand a change > Click thumbs up > Click again to un-vote > Click thumbs down',
    expected: 'Vote count increments/decrements. Active vote is highlighted. Persists across page refreshes.',
    files: 'src/frontend/app.js:29375-29400 (vote buttons), 42555-42575 (voteChangelogItem handler)'
  },
  {
    pageKey: 'changelog',
    title: 'Version-Based Filtering in Sidebar',
    description: 'Clicking a version in the sidebar filters changelog to show only that version. Click again or "Clear Filter" to show all. Active version highlighted with blue styling.',
    test: 'Go to Changelog > Click "v1.4.0" in sidebar > See only v1.4.0 entries > Click "Clear Filter"',
    expected: 'Sidebar highlights selected version. Only that version shows in main content. Clear button resets to all versions.',
    files: 'src/frontend/app.js:29253-29280 (sidebar with filter), 42549-42553 (filterChangelogVersion handler)'
  },
  // ROADMAP - Public changelog link from completed items
  {
    pageKey: 'roadmap',
    title: 'Public Changelog Link from Completed Roadmap Items',
    description: 'Completed roadmap items now show a "Changelog" link in their metadata. Clicking navigates to the changelog page. Helps users discover what was released.',
    test: 'Go to Roadmap > Filter to "Completed" > Check items for "Changelog" link > Click it',
    expected: 'Completed items show "Changelog" link with arrow icon. Clicking navigates to changelog page.',
    files: 'src/frontend/app.js:28741-28749 (changelog link in roadmap cards), main.css:23352-23366 (link CSS)'
  },
  // Affected areas on changelog entries
  {
    pageKey: 'changelog',
    title: 'Affected Areas/Pages Per Change',
    description: 'Each changelog entry shows colored tags indicating which app areas are affected (e.g., "Navigation", "Analytics", "Calendar"). Tags are searchable and shown in both collapsed and expanded views.',
    test: 'Go to Changelog > Check change items for area tags > Search for an area name like "Analytics"',
    expected: 'Purple-ish area tags show under each change description. Searching by area name filters to matching items.',
    files: 'src/frontend/app.js:29126-29198 (areas data), 29354-29358 (area tags rendering), main.css:23689-23698 (tag CSS)'
  },
];

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

async function processPage(pageKey) {
  const page = PAGES[pageKey];
  console.log(`\n==============================`);
  console.log(`Processing: ${page.name} (${page.id})`);
  console.log(`==============================`);

  const blocks = await getPageBlocks(page.id);
  let todoHeadingId = null;
  let waitingHeadingId = null;

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = extractText(block);
      if (text.includes('Issues/Features to Work On') || text.includes('Issues / Features to Work On')) todoHeadingId = block.id;
      if (text.includes('Waiting for Manual Approval')) waitingHeadingId = block.id;
    }
  }

  console.log(`  Todo heading: ${todoHeadingId ? 'found' : 'NOT FOUND'}`);
  console.log(`  Waiting heading: ${waitingHeadingId ? 'found' : 'NOT FOUND'}`);

  const pageFeatures = features.filter(f => f.pageKey === pageKey);
  console.log(`  Features to process: ${pageFeatures.length}`);

  // Check off matching to-do items
  const todoBlocks = blocks.filter(b => b.type === 'to_do' && !b.to_do.checked);
  let checkedOff = 0;
  for (const todo of todoBlocks) {
    const todoText = extractText(todo).toLowerCase();
    for (const feature of pageFeatures) {
      const keywords = feature.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matchCount = keywords.filter(kw => todoText.includes(kw)).length;
      if (matchCount >= 2 || todoText.includes(feature.title.toLowerCase().substring(0, 20))) {
        try {
          await notion.blocks.update({ block_id: todo.id, to_do: { checked: true } });
          checkedOff++;
          console.log(`  [x] Checked off: "${extractText(todo).substring(0, 60)}..."`);
          await sleep(350);
        } catch (e) { console.log(`  [!] Failed to check off: ${e.message}`); }
        break;
      }
    }
  }
  console.log(`  Checked off ${checkedOff} to-do items`);

  // Add toggle blocks
  if (!waitingHeadingId) { console.log(`  SKIPPING toggles - no waiting heading`); return; }

  const existingToggles = blocks.filter(b => b.type === 'toggle');
  const existingTitles = existingToggles.map(t => extractText(t).toLowerCase());

  let added = 0;
  for (const feature of pageFeatures) {
    const alreadyExists = existingTitles.some(t => t.includes(feature.title.toLowerCase().substring(0, 20)));
    if (alreadyExists) { console.log(`  [=] Already exists: "${feature.title}"`); continue; }

    const toggleBlock = {
      object: 'block', type: 'toggle',
      toggle: {
        rich_text: [
          { type: 'text', text: { content: '\u{1F527} ' } },
          { type: 'text', text: { content: feature.title }, annotations: { bold: true } }
        ],
        color: 'default',
        children: [
          { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: feature.description }, annotations: { italic: true, color: 'gray' } }] } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Test: ' }, annotations: { bold: true } }, { type: 'text', text: { content: feature.test } }] } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Expected: ' }, annotations: { bold: true } }, { type: 'text', text: { content: feature.expected } }] } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Files: ' }, annotations: { bold: true } }, { type: 'text', text: { content: feature.files }, annotations: { code: true } }] } }
        ]
      }
    };

    try {
      await notion.blocks.children.append({ block_id: page.id, children: [toggleBlock], after: waitingHeadingId });
      added++;
      console.log(`  [+] Added: "${feature.title}"`);
      await sleep(400);
    } catch (e) { console.log(`  [!] Failed to add "${feature.title}": ${e.message}`); }
  }
  console.log(`  Added ${added} toggle blocks`);

  // Update page title
  try {
    const pageData = await notion.pages.retrieve({ page_id: page.id });
    const currentTitle = pageData.properties.title?.title?.[0]?.plain_text || page.name;
    if (!currentTitle.includes('(Items to Approve)')) {
      await notion.pages.update({ page_id: page.id, properties: { title: { title: [{ text: { content: `${page.name} (Items to Approve)` } }] } } });
      console.log(`  Title updated to: "${page.name} (Items to Approve)"`);
    } else { console.log(`  Title already has suffix`); }
    await sleep(350);
  } catch (e) { console.log(`  [!] Failed to update title: ${e.message}`); }
}

async function main() {
  console.log('=== Batch Notion Update: Changelog + Roadmap ===');
  console.log(`Total features: ${features.length}`);

  const pageKeys = [...new Set(features.map(f => f.pageKey))];
  for (const key of pageKeys) { await processPage(key); }

  console.log('\n=== DONE ===');
  const summary = pageKeys.map(k => `${PAGES[k].name}: ${features.filter(f => f.pageKey === k).length}`).join(', ');
  console.log(`Summary: ${summary}`);
}

main().catch(console.error);
