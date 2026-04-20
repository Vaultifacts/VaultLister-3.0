-- Seed initial FAQ entries and help articles so the Help & Knowledge Base
-- tab shows content instead of "No FAQs found." / "No articles found."
-- All inserts use ON CONFLICT DO NOTHING — safe to re-run.

-- ─── FAQ ────────────────────────────────────────────────────────────────────

INSERT INTO help_faq (id, question, answer, category, position) VALUES

-- Getting Started
('faq_gs_01', 'What is VaultLister?',
 'VaultLister is a multi-channel reselling platform that lets you manage your inventory, cross-list items to 9+ marketplaces (eBay, Shopify, Poshmark, Depop, Whatnot, and more), track sales, and automate repetitive tasks — all from one dashboard.',
 'Getting Started', 1),

('faq_gs_02', 'How do I start a free trial?',
 'Click "Start Free Trial" on the homepage or sign-up page. No credit card is required. You get full access to all features during the trial period.',
 'Getting Started', 2),

('faq_gs_03', 'Which marketplaces does VaultLister support?',
 'VaultLister currently supports 6 live marketplaces: eBay, Shopify, Poshmark, Depop, Facebook Marketplace, and Whatnot. Mercari, Grailed, and Etsy are coming soon.',
 'Getting Started', 3),

('faq_gs_04', 'How do I connect my marketplace accounts?',
 'Go to Settings → Connected Accounts. Click "Connect" next to any marketplace and follow the OAuth or credential setup flow. For eBay and Shopify, you will be redirected to their sign-in pages. For Poshmark and Depop, you enter your username and password (stored encrypted).',
 'Getting Started', 4),

('faq_gs_05', 'Is there a mobile app?',
 'VaultLister is a web app optimised for mobile browsers — no app store download needed. A Chrome extension for quick listing while browsing marketplaces is also available.',
 'Getting Started', 5),

-- Inventory
('faq_inv_01', 'How do I add items to my inventory?',
 'Click "Add Item" on the Inventory page. Fill in the title, condition, purchase price, and optionally add photos. Once saved, the item is in your inventory and ready to be listed.',
 'Inventory', 10),

('faq_inv_02', 'Can I import inventory from a CSV?',
 'Yes. Go to Inventory → Import and download the CSV template. Fill in your items and upload. The importer maps columns automatically and flags any rows with errors before they are saved.',
 'Inventory', 11),

('faq_inv_03', 'What is the difference between an inventory item and a listing?',
 'An inventory item is the physical product you own. A listing is a live or draft record on a specific marketplace. One inventory item can have multiple listings across different platforms.',
 'Inventory', 12),

('faq_inv_04', 'How do I track my cost of goods?',
 'When adding or editing an inventory item, enter the "Purchase Price" field. VaultLister uses this to calculate profit automatically when the item sells.',
 'Inventory', 13),

-- Cross-Listing
('faq_cl_01', 'How do I list an item to multiple marketplaces at once?',
 'Open an inventory item and click "Cross-List". Select the marketplaces you want to publish to, review the auto-filled listing details, and click "Publish". VaultLister pushes the listing to each selected platform.',
 'Cross-Listing', 20),

('faq_cl_02', 'What happens when an item sells on one marketplace?',
 'VaultLister detects the sale (via webhook or sync), marks the item as sold, and automatically delists it from all other active marketplaces to prevent double-selling.',
 'Cross-Listing', 21),

('faq_cl_03', 'Can I customise the listing per marketplace?',
 'Yes. In the Cross-Lister, each marketplace tab lets you adjust the title, description, price, and shipping details independently before publishing.',
 'Cross-Listing', 22),

-- Pricing & Plans
('faq_plan_01', 'What is included in the free plan?',
 'The free plan lets you manage up to 10 active inventory items, cross-list to 2 marketplaces, and access basic analytics. No time limit — stay on the free plan as long as you like.',
 'Pricing & Plans', 30),

('faq_plan_02', 'How do I upgrade my plan?',
 'Go to Settings → Billing and click "Upgrade". Choose Starter, Pro, or Business and complete checkout with your card. Your new plan activates immediately.',
 'Pricing & Plans', 31),

('faq_plan_03', 'Is there a minimum contract length?',
 'No. All plans are monthly (or discounted quarterly/yearly). You can cancel anytime — your access continues until the end of the paid period.',
 'Pricing & Plans', 32),

('faq_plan_04', 'Does VaultLister charge per-listing fees?',
 'No. VaultLister charges a flat monthly subscription only. There are no per-listing, per-sale, or success fees.',
 'Pricing & Plans', 33),

-- Account & Security
('faq_acct_01', 'How do I reset my password?',
 'On the login page, click "Forgot password?" and enter your email. You will receive a reset link within a few minutes. If you do not see it, check your spam folder.',
 'Account & Security', 40),

('faq_acct_02', 'How do I enable two-factor authentication?',
 'Go to Settings → Security and click "Enable 2FA". Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code to confirm.',
 'Account & Security', 41),

('faq_acct_03', 'How do I export or delete my data?',
 'Go to Settings → Privacy. You can download a full export of your inventory, sales, and account data as a CSV, or submit a data deletion request.',
 'Account & Security', 42)

ON CONFLICT (id) DO NOTHING;


-- ─── Help Articles ──────────────────────────────────────────────────────────

INSERT INTO help_articles (id, title, slug, content, category, tags, is_published) VALUES

('art_qs_01', 'Quick Start: Your First Listing in 5 Minutes',
 'quick-start-first-listing',
 '<h2>1. Add an inventory item</h2>
<p>Go to <strong>Inventory → Add Item</strong>. Enter the item title, condition (New / Used – Like New / etc.), and purchase price. Upload photos if you have them, then click <strong>Save</strong>.</p>

<h2>2. Cross-list to marketplaces</h2>
<p>Open the saved item and click <strong>Cross-List</strong>. Select eBay, Poshmark, or any other connected marketplace. VaultLister pre-fills the listing with your item details — adjust the price, title, or description per platform if needed.</p>

<h2>3. Publish</h2>
<p>Click <strong>Publish</strong>. VaultLister pushes the listing live to each selected marketplace. You will see a confirmation with direct links to each listing.</p>

<h2>4. Track your sale</h2>
<p>When the item sells, VaultLister records the sale in <strong>Sales</strong>, calculates your profit, and automatically delists the item from all other platforms.</p>',
 'Getting Started',
 '["cross-listing","inventory","quick-start"]'::jsonb,
 1),

('art_inv_01', 'Managing Your Inventory',
 'managing-inventory',
 '<h2>Adding items</h2>
<p>Use <strong>Inventory → Add Item</strong> for single items or <strong>Inventory → Import</strong> to bulk-upload from a CSV. Download the template to see the supported columns.</p>

<h2>Organising with tags</h2>
<p>Add tags to items (e.g. "electronics", "vintage", "lot") to filter and search your inventory quickly. Tags appear in the item list and carry through to listings when available.</p>

<h2>Editing items</h2>
<p>Click any item to open its detail page. Changes to title, price, or photos are reflected on all draft listings. Published listings need to be re-synced after an edit.</p>

<h2>Tracking COGS</h2>
<p>The <strong>Purchase Price</strong> field records your cost of goods. VaultLister uses this to calculate gross profit in <strong>Analytics → Profit Overview</strong>.</p>

<h2>Deleting items</h2>
<p>Archive an item to hide it from your active inventory without losing sales history. Permanently deleted items cannot be recovered.</p>',
 'Inventory',
 '["inventory","organisation","cogs"]'::jsonb,
 1),

('art_auto_01', 'Automations: Closet Sharing & Offer Rules',
 'automations-closet-sharing-offer-rules',
 '<h2>What are automations?</h2>
<p>Automations run scheduled tasks on your behalf on Poshmark — sharing your entire closet, following buyers, and sending automatic offers to likers. They run in the background without any action needed from you.</p>

<h2>Closet sharing</h2>
<p>Go to <strong>Automations → Closet Sharing</strong>. Set a sharing schedule (e.g. every 4 hours) and the maximum number of shares per cycle. Click <strong>Enable</strong> to start. VaultLister respects Poshmark''s rate limits automatically.</p>

<h2>Offer rules</h2>
<p>Go to <strong>Automations → Offer Rules</strong>. Create a rule: when a user likes an item listed for over $X, automatically send them a Y% discount offer. Multiple rules stack — more specific rules take priority.</p>

<h2>Rate limits &amp; safety</h2>
<p>All automations have built-in delays between actions to stay within platform limits. If Poshmark detects unusual activity and rate-limits your account, the automation pauses and alerts you.</p>',
 'Automations',
 '["automations","poshmark","sharing","offers"]'::jsonb,
 1)

ON CONFLICT (id) DO NOTHING;
