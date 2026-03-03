#!/usr/bin/env bun
// Batch update: Roadmap (7+3), About Us (10), Changelog (2), Orders (1) = 23 items
// Checks off to-dos for already-implemented items + adds toggles for new work

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = {
  roadmap: { id: 'fcc3f0ec-f382-82db-b0fb-81ae5ec96553', name: 'Roadmap' },
  changelog: { id: 'c993f0ec-f382-828b-996e-81f8c2d19690', name: 'Changelog' },
  about: { id: 'a3b3f0ec-f382-8268-a7b9-01139d8022a3', name: 'About Us' },
  orders: { id: '2fd3f0ec-f382-836b-8589-81252121f2bb', name: 'Orders' },
};

const features = [
  // ROADMAP - Already implemented (4 items, just check off)
  // These exist in code but to-dos weren't checked off:
  // 1. Feature voting - already at app.js:28685
  // 2. Estimated release dates - already at app.js:28721
  // 3. Roadmap categories - already at app.js:28550
  // 4. Progress indicators - already at app.js:28708
  // These need toggles too since they don't have them yet:
  {
    pageKey: 'roadmap',
    title: 'Feature Voting (Upvote System)',
    description: 'Users can vote on roadmap features by clicking the star button. Vote count displayed per feature. Tracks user vote state to prevent duplicates.',
    test: 'Go to Roadmap > Click star icon on any feature > Check vote count increments',
    expected: 'Star fills in, vote count increases by 1. Clicking again removes vote.',
    files: 'src/frontend/app.js:28685-28691 (vote button), 52986 (voteRoadmapFeature handler)'
  },
  {
    pageKey: 'roadmap',
    title: 'Estimated Release Dates on Roadmap Items',
    description: 'Roadmap items display ETA with calendar icon when eta field is set. Shows month/year format.',
    test: 'Go to Roadmap > Check items for ETA dates > Look for calendar icon',
    expected: 'Items with release dates show them with a calendar icon in the metadata row.',
    files: 'src/frontend/app.js:28747-28756 (eta display)'
  },
  {
    pageKey: 'roadmap',
    title: 'Roadmap Categories (Enhancement/Feature/Bug Fix)',
    description: 'Roadmap items have category badges. Category filter dropdown in the filter bar allows filtering by category.',
    test: 'Go to Roadmap > Check category badges on items > Use category dropdown to filter',
    expected: 'Category badges appear on each item. Dropdown filters items by selected category.',
    files: 'src/frontend/app.js:28550 (categories), 28654-28663 (filter), 42567 (handler)'
  },
  {
    pageKey: 'roadmap',
    title: 'Progress Indicators for In-Progress Items',
    description: 'In-progress roadmap items show a progress bar with percentage. Visual fill indicates completion level.',
    test: 'Go to Roadmap > Filter to "In Progress" > Check for progress bars',
    expected: 'Items show progress bar with percentage fill and text label.',
    files: 'src/frontend/app.js:28734-28741 (progress bar)'
  },
  // ROADMAP - Newly implemented (3 items)
  {
    pageKey: 'roadmap',
    title: 'Roadmap Item Dependencies and Blockers',
    description: 'Roadmap feature cards can display dependency chains (depends on X) and blockers (blocked by Y). Dependencies shown with link icon in yellow, blockers with red circle-slash icon.',
    test: 'Go to Roadmap > Check items with dependencies field > See dependency/blocker badges',
    expected: 'Items with dependencies show "Depends on: ..." with link icon. Blocked items show "Blocked by: ..." with red icon.',
    files: 'src/frontend/app.js:28743-28756 (dependency/blocker display)'
  },
  {
    pageKey: 'roadmap',
    title: 'Subscribe Button for Feature Ship Notifications',
    description: 'Subscribe button in roadmap header opens modal with email subscription form. Users can choose: features voted for, new features added, status changes.',
    test: 'Go to Roadmap > Click "Subscribe" button > Fill in email > Select notification types',
    expected: 'Modal with email input and 3 checkbox options. Submit shows success toast.',
    files: 'src/frontend/app.js:28592-28595 (subscribe button), 42572-42614 (handler)'
  },
  {
    pageKey: 'roadmap',
    title: 'Roadmap Search to Find Specific Features',
    description: 'Search input in roadmap header filters features by title, description, and category in real-time.',
    test: 'Go to Roadmap > Type in search box > Enter a term like "analytics"',
    expected: 'Feature list filters to only show items matching search query across title, description, and category.',
    files: 'src/frontend/app.js:28585-28591 (search input), 28571-28575 (filter logic), 42569-42571 (handler)'
  },

  // CHANGELOG - Already implemented (1 item, check off)
  {
    pageKey: 'changelog',
    title: 'Change Type Badges (Feature/Fix/Improvement/Breaking)',
    description: 'Each changelog entry shows a colored badge for its type: feature (blue), improvement (green), fix (yellow), breaking (red), security (red). Badge shown next to title.',
    test: 'Go to Changelog > Check entries for colored type badges',
    expected: 'Each entry shows type badge with appropriate color. Badges are filterable via type filter buttons.',
    files: 'src/frontend/app.js:29234-29248 (badge definitions), 29375 (badge rendering)'
  },
  // CHANGELOG - Newly implemented (1 item)
  {
    pageKey: 'changelog',
    title: 'Before/After Screenshots for UI Changes',
    description: 'Changelog entries can include before/after screenshot comparison. Expanded details show side-by-side image grid with "Before" (red label) and "After" (green label). Graceful fallback if images unavailable.',
    test: 'Go to Changelog > Expand "Sidebar Icon-Only Mode" entry > Check for Before/After section',
    expected: 'Two-column grid with Before and After images. Images load from /assets/screenshots/. Shows fallback text if images missing.',
    files: 'src/frontend/app.js:29582-29608 (screenshot rendering in change details)'
  },

  // ABOUT US - Already implemented (4 items)
  {
    pageKey: 'about',
    title: 'Company Mission Statement and Values',
    description: 'About page displays "Built for Resellers, by Resellers" mission with three core values: Simplicity, Privacy, Affordability. Each value has icon and description.',
    test: 'Go to About Us > Scroll to Mission section',
    expected: 'Mission statement displayed with 3 value cards (Simplicity, Privacy, Affordability).',
    files: 'src/frontend/app.js:27840-27869'
  },
  {
    pageKey: 'about',
    title: 'Platform Statistics Display',
    description: 'About page shows key platform stats: 171+ Features Built, 6 Platforms Supported, 100% Free, Local Data Storage.',
    test: 'Go to About Us > Check stats section below hero',
    expected: 'Four stat cards with icons, counts, and descriptions.',
    files: 'src/frontend/app.js:27797-27838'
  },
  {
    pageKey: 'about',
    title: 'Customer Testimonials Section',
    description: 'Three customer testimonials with star ratings, quotes, names, and roles.',
    test: 'Go to About Us > Scroll to Testimonials section',
    expected: 'Three testimonial cards with 5-star ratings, quotes, and author info.',
    files: 'src/frontend/app.js:27772-27914'
  },
  {
    pageKey: 'about',
    title: 'Contact Information Section',
    description: 'Contact section with email link, Help Center link, and Send Feedback link.',
    test: 'Go to About Us > Scroll to bottom > Check contact options',
    expected: 'Three contact options: Email (mailto link), Help Center (navigation), Send Feedback (navigation).',
    files: 'src/frontend/app.js:27935-27967'
  },
  // ABOUT US - Newly implemented (6 items)
  {
    pageKey: 'about',
    title: 'Team Member Profiles with Photos and Roles',
    description: 'Grid of team member cards with avatar initials, name, role, and short bio. 4 members: Founder, UX Designer, Backend Engineer, Community Manager.',
    test: 'Go to About Us > Scroll to "Meet the Team" section',
    expected: 'Four team cards in grid layout with colored avatars, names, roles, and bios. Cards lift on hover.',
    files: 'src/frontend/app.js (team section in about page), main.css:24484-24550 (team CSS)'
  },
  {
    pageKey: 'about',
    title: 'Company Timeline Showing Key Milestones',
    description: 'Vertical timeline showing VaultLister milestones from Dec 2025 launch to Feb 2026 growth. Current milestone highlighted with blue dot and glow.',
    test: 'Go to About Us > Scroll to "Our Journey" section',
    expected: 'Vertical timeline with 6 milestones. Each shows date, title, description. Last milestone has blue highlight.',
    files: 'src/frontend/app.js (timeline section in about page), main.css:24553-24622 (timeline CSS)'
  },
  {
    pageKey: 'about',
    title: 'Social Media Links for Company Profiles',
    description: 'Social media link cards for Twitter/X, Instagram, YouTube, and Discord. Each shows platform icon and name. Coming soon toast on click.',
    test: 'Go to About Us > Scroll to "Connect With Us" section > Click a social link',
    expected: 'Four social link cards. Clicking shows "coming soon" toast. Cards highlight on hover.',
    files: 'src/frontend/app.js (social links section in about page), main.css:24655-24686 (social CSS)'
  },
  {
    pageKey: 'about',
    title: 'Press/Media Kit Download',
    description: 'Press kit card with download icon and description. Button shows "coming soon" toast. Includes brand assets info.',
    test: 'Go to About Us > Scroll to Press & Careers section > Click "Download Press Kit"',
    expected: 'Card with download icon, description, and button. Toast notification on click.',
    files: 'src/frontend/app.js (press kit card in about page), main.css:24688-24720 (card CSS)'
  },
  {
    pageKey: 'about',
    title: 'Careers Page / Link to Job Listings',
    description: 'Careers card with briefcase icon and description. Button shows "coming soon" toast with careers email.',
    test: 'Go to About Us > Scroll to Press & Careers section > Click "View Open Positions"',
    expected: 'Card with briefcase icon, description, and button. Toast with careers@vaultlister.com email.',
    files: 'src/frontend/app.js (careers card in about page), main.css:24688-24720 (card CSS)'
  },
  {
    pageKey: 'about',
    title: 'Technology Partners and Integration Logos',
    description: 'Grid of 6 marketplace partner cards: Poshmark, eBay, Mercari, Depop, Grailed, Facebook. Each with colored logo icon and name.',
    test: 'Go to About Us > Scroll to "Platform Integrations" section',
    expected: 'Six partner cards in grid with brand-colored icons. Cards lift on hover.',
    files: 'src/frontend/app.js (partners section in about page), main.css:24624-24653 (partners CSS)'
  },

  // ORDERS - Bug fix already resolved
  {
    pageKey: 'orders',
    title: 'Action Button Visibility Fix (Light Mode)',
    description: 'Fixed Orders table action buttons to have proper contrast. Buttons now use black background with white text/icons in light mode, and white background with black text in dark mode.',
    test: 'Go to Orders > Check action buttons in the table (eye, notes, bell, printer icons)',
    expected: 'All action buttons clearly visible with proper contrast in both light and dark modes.',
    files: 'src/frontend/styles/main.css:2044-2052 (light mode), 269-288 (dark mode)'
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
  console.log('=== Batch Notion Update: Roadmap + About Us + Changelog + Orders ===');
  console.log(`Total features: ${features.length}`);

  const pageKeys = [...new Set(features.map(f => f.pageKey))];
  for (const key of pageKeys) { await processPage(key); }

  console.log('\n=== DONE ===');
  const summary = pageKeys.map(k => `${PAGES[k].name}: ${features.filter(f => f.pageKey === k).length}`).join(', ');
  console.log(`Summary: ${summary}`);
}

main().catch(console.error);
