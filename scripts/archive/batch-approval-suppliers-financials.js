#!/usr/bin/env bun
// Batch update: Check off to-do items + add toggle blocks for Suppliers (9) + Financials (9) = 18 items

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = {
  suppliers: { id: '33a3f0ec-f382-82cf-8d52-812928a2e177', name: 'Suppliers' },
  financials: { id: '5de3f0ec-f382-82a1-bdbf-014629239151', name: 'Financials' },
};

const features = [
  // SUPPLIERS
  {
    pageKey: 'suppliers',
    title: 'Supplier Rating System Based on Quality, Delivery, and Pricing',
    description: 'Star rating system for suppliers with interactive 5-star UI. Rate button opens modal with clickable stars and optional review. Rating displayed on supplier cards and comparison table.',
    test: 'Go to Suppliers > Click "Rate Supplier" on any supplier card > Select stars > Submit',
    expected: 'Star rating modal opens. Clicking stars updates rating. After submit, rating shows on supplier card and in comparison table.',
    files: 'src/frontend/app.js:42008-42054 (rateSupplier/setStarRating/saveSupplierRating handlers), 31190-31193 (star display in table)'
  },
  {
    pageKey: 'suppliers',
    title: 'Purchase Order Creation and Tracking from Supplier Profiles',
    description: 'Full PO management with create/view/update status flow. Purchase orders table shows PO#, supplier, items, total, status (pending/confirmed/shipped/delivered/cancelled), and creation date.',
    test: 'Go to Suppliers > Scroll to "Purchase Orders" > Click "+ New PO" > Fill form > Submit > Click eye icon to view > Change status',
    expected: 'PO appears in table with correct data. View modal shows details with status dropdown. Status updates persist.',
    files: 'src/frontend/app.js:31215-31260 (PO table HTML), 42367-42460 (createPurchaseOrder/savePurchaseOrder/viewPurchaseOrder/updatePOStatus handlers)'
  },
  {
    pageKey: 'suppliers',
    title: 'Supplier Price Comparison Across Vendors',
    description: 'Price comparison table showing all suppliers side-by-side with items, avg price, stock status, rating stars, reliability score, and 30-day price trend sparkline charts.',
    test: 'Go to Suppliers > Scroll to "Price Comparison" section',
    expected: 'Table shows all suppliers with columns for items, price, stock status, star rating, reliability %, and mini sparkline chart.',
    files: 'src/frontend/app.js:31143-31210 (comparison table with sparklines), 14172-14192 (priceTrendSparkline component)'
  },
  {
    pageKey: 'suppliers',
    title: 'Lead Time Tracking with Average Delivery Days Per Supplier',
    description: 'Lead time dashboard with 4 summary stat cards (avg ship days, delivery days, on-time rate, processing days) and per-supplier table with processing, shipping, total days, on-time %, and improvement trend.',
    test: 'Go to Suppliers > Scroll to "Lead Time Tracking" section',
    expected: 'Summary cards show aggregate metrics. Table shows per-supplier lead times with trend arrows (improving/slower).',
    files: 'src/frontend/app.js:31264-31330 (lead time stats and table HTML)'
  },
  {
    pageKey: 'suppliers',
    title: 'Supplier Contact Management with Multiple Contacts',
    description: 'Contact directory showing contact cards in a 3-column grid. Each card shows avatar, name, role, supplier affiliation, email, and phone. Add Contact button opens modal to create new contacts.',
    test: 'Go to Suppliers > Scroll to "Contact Directory" > Click "+ Add Contact" > Fill form > Submit',
    expected: 'Contact cards display for each supplier. New contacts can be added with name, role, email, phone, and supplier association.',
    files: 'src/frontend/app.js:31334-31364 (contact grid HTML), 42462-42510 (addSupplierContact/saveSupplierContact handlers)'
  },
  {
    pageKey: 'suppliers',
    title: 'Minimum Order Quantity and Pricing Tier Display',
    description: 'MOQ & Pricing Tiers table showing per-supplier minimum order quantities and 3 pricing tiers (1-49, 50-99, 100+ units) with per-unit prices and best value savings percentage.',
    test: 'Go to Suppliers > Scroll to "MOQ & Pricing Tiers" section',
    expected: 'Table shows each supplier with MOQ badge, three pricing tiers with decreasing per-unit costs, and savings % for bulk orders.',
    files: 'src/frontend/app.js:31368-31404 (MOQ table HTML)'
  },
  {
    pageKey: 'suppliers',
    title: 'Supplier Notes and Communication Log',
    description: 'Communication log with timestamped entries for emails, phone calls, and messages. Each entry shows type icon, supplier name, date, and note content. Color-coded left border by type.',
    test: 'Go to Suppliers > Scroll to "Communication Log" > Click "+ Log Entry" > Fill form > Submit',
    expected: 'Entry appears with correct type icon, supplier name, date, and note text. Color-coded border matches communication type.',
    files: 'src/frontend/app.js:31408-31448 (communication log HTML), 42512-42562 (addCommunicationEntry/saveCommunicationEntry handlers)'
  },
  {
    pageKey: 'suppliers',
    title: 'Supplier Reliability Score Based on Order Accuracy',
    description: 'Reliability score calculated as weighted average: 40% order accuracy + 30% on-time delivery + 30% quality rating. Shown as colored badge in comparison table and supplier cards.',
    test: 'Go to Suppliers > Check comparison table "Reliability" column > Hover badges for breakdown',
    expected: 'Reliability % badges show green (90%+), yellow (70-89%), or red (<70%). Hovering shows accuracy/delivery/quality breakdown.',
    files: 'src/frontend/app.js:31164-31198 (reliability calculation), 14271-14295 (supplierCardEnhanced reliability display)'
  },
  {
    pageKey: 'suppliers',
    title: 'Supplier Map Showing Geographic Locations',
    description: 'Simplified US map visualization with supplier pin markers positioned geographically. Active suppliers shown in green, inactive in gray. Legend explains color coding.',
    test: 'Go to Suppliers > Scroll to "Supplier Map" section',
    expected: 'Map shows with supplier names as labeled pins. Active suppliers are green dots, inactive are gray dots. Legend shown below map.',
    files: 'src/frontend/app.js:31452-31486 (SVG map with supplier pins)'
  },

  // FINANCIALS
  {
    pageKey: 'financials',
    title: 'Expense Category Tracking with Custom Categories',
    description: 'Expense Categories dashboard with horizontal bar chart showing 7 categories: Inventory/COGS, Shipping, Platform Fees, Supplies, Marketing, Software, Other. Each shows percentage bar and dollar amount.',
    test: 'Go to Financials > Scroll to "Expense Categories" section',
    expected: 'Horizontal bars show spending by category with percentage fills, category labels, and dollar amounts aligned right.',
    files: 'src/frontend/app.js:22650-22680 (expense categories bar chart HTML)'
  },
  {
    pageKey: 'financials',
    title: 'Tax Estimate Calculator Based on Income and Deductions',
    description: 'Interactive tax calculator with filing status, gross income, deductions, and self-employment income inputs. Calculates federal income tax using 2024 brackets plus SE tax (15.3%). Shows annual total, quarterly payment, breakdown, and effective rate.',
    test: 'Go to Financials > Scroll to "Tax Estimate Calculator" > Enter $50,000 gross income > Enter $12,000 deductions > Enter $10,000 SE income > Click Calculate',
    expected: 'Result shows estimated annual tax, quarterly payment amount, line-by-line breakdown (taxable income, income tax, SE tax), and effective tax rate.',
    files: 'src/frontend/app.js:22462-22530 (tax calculator HTML), 51421-51448 (recalcTaxEstimate handler)'
  },
  {
    pageKey: 'financials',
    title: 'Cash Flow Projection Based on Historical Trends',
    description: 'Cash flow projection section showing 6-month forecast with summary cards (projected income, expenses, net cash flow, end balance) and month-by-month table with income, expenses, net, cumulative, and bar visualization.',
    test: 'Go to Financials > Scroll to "Cash Flow Projection" section',
    expected: 'Four summary cards at top. Table shows 6 months with income (green), expenses (red), net (colored), cumulative total, and progress bar.',
    files: 'src/frontend/app.js:22534-22575 (cash flow projection HTML)'
  },
  {
    pageKey: 'financials',
    title: 'Receipt Scanning and Attachment for Expense Documentation',
    description: 'Full receipt management with upload, list, and delete functionality. Transaction attachments stored in database with file metadata. Receipt Parser page for Gmail integration and manual upload.',
    test: 'Go to Financials > Transactions > Click a transaction > Upload receipt file',
    expected: 'File upload accepts image/PDF. Receipt appears in attachments list. Can be deleted. Receipt Parser page offers Gmail sync.',
    files: 'src/backend/routes/financials.js:1018-1070 (attachment endpoints), src/backend/db/migrations/060_transaction_enhancements.sql (attachments table)'
  },
  {
    pageKey: 'financials',
    title: 'Multi-Currency Support with Automatic Conversion',
    description: 'Currency converter with amount input, target currency dropdown (EUR, GBP, CAD, AUD, JPY), and real-time conversion display. Shows indicative exchange rates grid for 5 major currencies.',
    test: 'Go to Financials > Scroll to "Multi-Currency Converter" > Enter $250 > Select GBP > Check result',
    expected: 'Converted amount displays with currency symbol. Rate shown below. Quick reference grid shows all 5 currency rates vs USD.',
    files: 'src/frontend/app.js:22577-22615 (converter HTML), 51450-51462 (convertCurrency handler)'
  },
  {
    pageKey: 'financials',
    title: 'Financial Goal Tracking with Progress Visualization',
    description: 'Goal tracking cards with name, category tag, progress bar (color-coded by completion %), current/target amounts, and deadline. Add Goal modal with name, category, target, current, and deadline fields.',
    test: 'Go to Financials > Scroll to "Financial Goals" > Click "+ Add Goal" > Fill form > Submit',
    expected: 'Goal card appears with progress bar. Color changes: green (100%+), blue (60%+), yellow (30%+), red (<30%). Amounts and deadline shown.',
    files: 'src/frontend/app.js:22617-22648 (goal cards HTML), 51464-51502 (addFinancialGoal/saveFinancialGoal handlers)'
  },
  {
    pageKey: 'financials',
    title: 'Fee Breakdown by Marketplace Showing Total Platform Fees',
    description: 'Platform fee analysis table showing 5 marketplaces (eBay, Poshmark, Mercari, Whatnot, Depop) with gross sales, fee rate badge (color-coded), total fees, net revenue, and % of total revenue. Footer shows totals.',
    test: 'Go to Financials > Scroll to "Platform Fee Analysis" section',
    expected: 'Table shows per-platform breakdown. Fee rate badges are green (<= 10%), yellow (<= 15%), or red (> 15%). Footer shows grand totals.',
    files: 'src/frontend/app.js:22723-22770 (fee analysis table HTML)'
  },
  {
    pageKey: 'financials',
    title: 'Bank Account Reconciliation to Match Transactions',
    description: 'Reconciliation section with 3 summary cards (bank balance, book balance, difference with color-coded alert). Unmatched transactions list with date, description, amount, and match button. Start Reconciliation modal to update bank statement balance.',
    test: 'Go to Financials > Scroll to "Bank Reconciliation" > Click "Start Reconciliation" > Enter balance > Save > Click match button on a transaction',
    expected: 'Balance cards update. Difference shows red if > $50, green if within tolerance. Match button confirms transaction matching.',
    files: 'src/frontend/app.js:22684-22720 (reconciliation HTML), 51504-51524 (startReconciliation/saveReconciliation/matchTransaction handlers)'
  },
  {
    pageKey: 'financials',
    title: 'Budget Alerts When Spending Approaches Limits',
    description: 'Budget Progress component with visual gauge showing spending vs monthly budget. Budget settings modal to set monthly limit. Financial insights bar shows warnings when margin is low or expenses exceed revenue.',
    test: 'Go to Financials > Check "Budget Progress" card > Click gear icon to set budget > Check insight bar messages',
    expected: 'Budget gauge shows spending percentage. Setting budget updates the display. Insight cards show warnings when margins are thin.',
    files: 'src/frontend/app.js:22442-22449 (budget progress card), 14025 (budgetProgress component), 22391-22406 (insight cards)'
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
  console.log('=== Batch Notion Update: Suppliers (9) + Financials (9) = 18 items ===');
  console.log(`Total features: ${features.length}`);

  const pageKeys = [...new Set(features.map(f => f.pageKey))];
  for (const key of pageKeys) { await processPage(key); }

  console.log('\n=== DONE ===');
  const summary = pageKeys.map(k => `${PAGES[k].name}: ${features.filter(f => f.pageKey === k).length}`).join(', ');
  console.log(`Summary: ${summary}`);
}

main().catch(console.error);
