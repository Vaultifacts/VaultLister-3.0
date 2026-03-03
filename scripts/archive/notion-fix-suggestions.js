#!/usr/bin/env bun
// Fixes the suggestions placement - removes incorrect blocks and adds to-do items under correct section
// Run: bun run scripts/notion-fix-suggestions.js

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// All pages with their IDs and suggestions (shortened format for to-do items)
const pages = [
  {
    name: 'Dashboard',
    id: '29f3f0ec-f382-83a6-8d1c-01d6640c22b8',
    suggestions: [
      'Add a "Quick Actions" widget for common tasks like adding inventory or creating listings',
      'Show a daily profit/loss summary card on the dashboard',
      'Add a recent activity feed showing last 10 actions across the app',
      'Display low-stock alerts for inventory items below threshold',
      'Add a "Getting Started" checklist for new users',
      'Show marketplace price trend sparklines for top-selling items',
      'Add drag-and-drop widget reordering for dashboard customization',
      'Display pending offers count badge on the dashboard',
      'Add a weekly sales comparison chart (this week vs last week)',
      'Show shipping status summary for orders awaiting shipment',
    ],
  },
  {
    name: 'Inventory',
    id: '20a3f0ec-f382-82bc-8d59-01f332e4e196',
    suggestions: [
      'Add bulk import via CSV/Excel file upload for inventory items',
      'Add barcode/UPC scanning support for quick item lookup',
      'Implement inventory categories with color-coded labels',
      'Add a "Duplicate Item" button to quickly clone inventory entries',
      'Show cost-basis and estimated profit per item in list view',
      'Add inventory location/bin tracking for warehouse organization',
      'Implement batch editing to update multiple items at once',
      'Add photo gallery support with multiple images per inventory item',
      'Show inventory age (days since acquisition) to identify stale stock',
      'Add export functionality to export inventory as CSV, PDF, or JSON',
    ],
  },
  {
    name: 'My Listings',
    id: '19f3f0ec-f382-83ca-8fe4-014a1e665539',
    suggestions: [
      'Add cross-listing to multiple marketplaces with one click',
      'Show listing health score based on views, watchers, and time listed',
      'Add automatic price-drop scheduling for stale listings',
      'Implement listing templates for frequently sold item types',
      'Add a "Relist" button for expired listings that preserves original data',
      'Show competitor pricing comparison for similar active listings',
      'Add SEO suggestions for listing titles and descriptions',
      'Implement listing drafts that save automatically',
      'Add photo watermarking option for listing images',
      'Show time-to-sell estimates based on historical data',
    ],
  },
  {
    name: 'Orders',
    id: '2fd3f0ec-f382-836b-8589-81252121f2bb',
    suggestions: [
      'Add shipping label generation directly from order details',
      'Implement order status timeline showing progression from sale to delivery',
      'Add automated buyer feedback request after delivery confirmation',
      'Show profit calculation per order including fees, shipping, and item cost',
      'Add batch shipping for multiple orders going to same region',
      'Implement order notes and internal comments for team collaboration',
      'Add return/refund management workflow within order details',
      'Show order map visualization for delivery locations',
      'Add packing slip and invoice PDF generation from orders',
      'Implement order search with filters for date range, status, and buyer',
    ],
  },
  {
    name: 'Offers',
    id: 'e313f0ec-f382-8390-a4b3-8173de396b3f',
    suggestions: [
      'Add auto-accept rules for offers above a configurable threshold',
      'Show offer history per item to track negotiation patterns',
      'Implement counter-offer templates for common negotiation scenarios',
      'Add offer expiration countdown timer visible to both parties',
      'Show buyer reputation score and purchase history with their offer',
      'Add bulk offer response to accept/decline multiple offers at once',
      'Implement offer notifications with push and email options',
      'Add "Best Offer" badge highlighting the highest offer per item',
      'Show market value comparison when viewing an offer',
      'Add saved offer responses for frequently used decline reasons',
    ],
  },
  {
    name: 'My Shops',
    id: '9513f0ec-f382-8344-8d4f-01097038fb0b',
    suggestions: [
      'Add shop performance dashboard comparing metrics across connected shops',
      'Implement shop-specific branding with custom logos and color themes',
      'Add shop vacation mode that pauses all listings with one toggle',
      'Show connection health status for each linked marketplace account',
      'Add shop-level fee tracking showing platform fees per shop',
      'Implement multi-shop inventory sync to keep quantities consistent',
      'Add shop analytics with sales velocity and conversion rates',
      'Show marketplace-specific listing requirements per shop',
      'Add quick-switch between shops without navigating away',
      'Implement shop backup/export to save all shop settings and data',
    ],
  },
  {
    name: 'Automations',
    id: '8b83f0ec-f382-8315-9ce0-01a7e520599c',
    suggestions: [
      'Add visual automation builder with drag-and-drop workflow nodes',
      'Implement automation templates for common workflows like price drops',
      'Add automation run history with success/failure logs',
      'Implement conditional logic (if/else) in automation chains',
      'Add scheduled automations with cron-like recurring execution',
      'Show automation performance metrics (time saved, actions completed)',
      'Add webhook triggers to start automations from external services',
      'Implement automation testing mode to dry-run without real changes',
      'Add error handling with retry logic and failure notifications',
      'Implement automation sharing to export/import workflows',
    ],
  },
  {
    name: 'Analytics',
    id: '31e3f0ec-f382-82fa-aac4-01dc57fd8b6f',
    suggestions: [
      'Add customizable date range presets (this month, last quarter, YTD)',
      'Implement exportable PDF reports with charts and summary data',
      'Add comparison mode to overlay two time periods on the same chart',
      'Show top-performing items ranked by profit margin and sales volume',
      'Add real-time analytics dashboard with live updating metrics',
      'Implement funnel analysis showing listing-to-sale conversion pipeline',
      'Add geographic heatmap of buyer locations',
      'Implement custom metric builder to create user-defined KPIs',
      'Add email-scheduled analytics digests (daily/weekly summary)',
      'Show sell-through rate analysis by category and time period',
    ],
  },
  {
    name: 'Calendar',
    id: '31c3f0ec-f382-82c5-88e3-01976e5de201',
    suggestions: [
      'Add drag-and-drop event creation by clicking and dragging on dates',
      'Implement recurring events for regular tasks like restocking',
      'Add color-coded event categories (shipping, listing, purchasing)',
      'Show listing expiration dates automatically on the calendar',
      'Add calendar sync with Google Calendar and Outlook',
      'Implement daily/weekly/monthly agenda views alongside calendar grid',
      'Add reminder notifications configurable per event',
      'Show shipping deadlines and estimated delivery dates for orders',
      'Add task dependencies to link related calendar events',
      'Implement a "This Week" summary widget showing upcoming events',
    ],
  },
  {
    name: 'Financials',
    id: '5de3f0ec-f382-82a1-bdbf-014629239151',
    suggestions: [
      'Add profit & loss statement generation for tax reporting',
      'Implement expense category tracking with custom categories',
      'Add tax estimate calculator based on income and deductions',
      'Show cash flow projection based on historical trends',
      'Add receipt scanning and attachment for expense documentation',
      'Implement multi-currency support with automatic conversion',
      'Add financial goal tracking with progress visualization',
      'Show fee breakdown by marketplace showing total platform fees',
      'Add bank account reconciliation to match transactions',
      'Implement budget alerts when spending approaches limits',
    ],
  },
  {
    name: 'Transactions',
    id: '6623f0ec-f382-82c8-bcde-013c9b842ed0',
    suggestions: [
      'Add advanced transaction search with multi-field filtering',
      'Implement transaction categorization with auto-categorization rules',
      'Add transaction split functionality for partial payments',
      'Show running balance alongside transaction history',
      'Add recurring transaction templates for regular expenses',
      'Implement transaction tagging with custom tags for organization',
      'Add transaction import from bank statements (CSV/OFX format)',
      'Show transaction summary statistics for filtered view',
      'Add receipt/document attachment to individual transactions',
      'Implement transaction audit log showing all edits and changes',
    ],
  },
  {
    name: 'Suppliers',
    id: '33a3f0ec-f382-82cf-8d52-812928a2e177',
    suggestions: [
      'Add supplier rating system based on quality, delivery, and pricing',
      'Implement purchase order creation and tracking from supplier profiles',
      'Add supplier price comparison for the same product across vendors',
      'Show lead time tracking with average delivery days per supplier',
      'Add supplier contact management with multiple contacts per supplier',
      'Implement minimum order quantity and pricing tier display',
      'Add supplier notes and communication log',
      'Show supplier reliability score based on order accuracy',
      'Add automated reorder alerts when inventory drops below thresholds',
      'Implement supplier map showing geographic locations of vendors',
    ],
  },
  {
    name: 'Market Intel',
    id: '0ec3f0ec-f382-821f-a857-81e0f97aaee3',
    suggestions: [
      'Add price tracking with historical price charts for watched items',
      'Implement market trend alerts for significant price changes',
      'Add competitor monitoring to track specific sellers listings',
      'Show demand score indicating buyer interest level for categories',
      'Add sold listing analysis showing average sale prices',
      'Implement price suggestion engine based on market data',
      'Add seasonal trend analysis showing best times to buy and sell',
      'Show market saturation index for product categories',
      'Add saved searches with automatic new-listing alerts',
      'Implement market comparison across different platforms',
    ],
  },
  {
    name: 'Predictions',
    id: '5683f0ec-f382-82a1-b12d-8126d4b66058',
    suggestions: [
      'Add confidence scores to all predictions with explanation of factors',
      'Implement prediction accuracy tracking to show model performance',
      'Add inventory demand forecasting for next 30/60/90 days',
      'Show price prediction bands (optimistic, expected, pessimistic)',
      'Add "What-If" scenario modeling for different pricing strategies',
      'Implement trend detection alerting when market conditions shift',
      'Add seasonal adjustment to predictions based on historical patterns',
      'Show prediction explanations in plain language',
      'Add custom prediction models users can train on their own data',
      'Implement prediction comparison showing different model outputs',
    ],
  },
  {
    name: 'Checklist',
    id: '5933f0ec-f382-8364-891e-01899cddd9e2',
    suggestions: [
      'Add checklist templates for common workflows (listing prep, shipping)',
      'Implement checklist sharing and assignment to team members',
      'Add due dates and priority levels to individual checklist items',
      'Show checklist progress bars with completion percentage',
      'Add recurring checklists that auto-regenerate on a schedule',
      'Implement drag-and-drop reordering of checklist items',
      'Add sub-tasks/nested checklist items for multi-step tasks',
      'Show completed checklist archive for reference',
      'Add checklist item notes and file attachments',
      'Implement checklist analytics showing completion trends',
    ],
  },
  {
    name: 'Image Bank',
    id: '48d3f0ec-f382-83e1-9170-015cab35fd27',
    suggestions: [
      'Add batch image upload with drag-and-drop zone',
      'Implement image tagging and search by tags',
      'Add built-in image editor for cropping, rotating, and resizing',
      'Show image usage tracking indicating which listings use each image',
      'Add automatic background removal for product photos',
      'Implement image folders/albums for organizing by category',
      'Add image compression/optimization for faster page loads',
      'Show storage usage with quota indicator',
      'Add image comparison tool to view before/after edits',
      'Implement image watermarking with customizable text and position',
    ],
  },
  {
    name: 'Settings',
    id: '9f63f0ec-f382-839f-8186-014eb9898857',
    suggestions: [
      'Add two-factor authentication (2FA) setup in security settings',
      'Implement settings import/export for backup and migration',
      'Add notification preference granularity per event type',
      'Show account activity log with login history and IP addresses',
      'Add keyboard shortcut customization panel',
      'Implement API key management for third-party integrations',
      'Add data retention settings to auto-delete old records',
      'Show account usage statistics (API calls, storage, listings)',
      'Add connected services management to view and revoke integrations',
      'Implement timezone and locale settings for all date/time displays',
    ],
  },
  {
    name: 'Help & Support',
    id: '3343f0ec-f382-820e-9c06-0141c79b7ed4',
    suggestions: [
      'Add searchable knowledge base with categorized help articles',
      'Implement in-app live chat support widget',
      'Add interactive walkthrough tutorials for each app section',
      'Show contextual help tooltips throughout the app',
      'Add video tutorial library organized by topic',
      'Implement support ticket system with status tracking',
      'Add FAQ section with most commonly asked questions',
      'Show system status page indicating service health',
      'Add keyboard shortcut reference card accessible from Help',
      'Implement feedback rating for help articles (helpful/not helpful)',
    ],
  },
  {
    name: 'Roadmap',
    id: 'fcc3f0ec-f382-82db-b0fb-81ae5ec96553',
    suggestions: [
      'Add interactive timeline visualization for roadmap items',
      'Implement feature voting so users can upvote desired features',
      'Add status filters (planned, in progress, completed, cancelled)',
      'Show estimated release dates or quarters for planned features',
      'Add roadmap categories (enhancement, new feature, bug fix)',
      'Implement public changelog linked from completed roadmap items',
      'Add progress indicators for in-progress items',
      'Show roadmap item dependencies and blockers',
      'Add subscribe button to get notified when a feature ships',
      'Implement roadmap search to find specific planned features',
    ],
  },
  {
    name: 'About Us',
    id: 'a3b3f0ec-f382-8268-a7b9-01139d8022a3',
    suggestions: [
      'Add team member profiles with photos and roles',
      'Show company mission statement and values prominently',
      'Add company timeline showing key milestones and growth',
      'Implement social media links for company profiles',
      'Add press/media kit download with logos and brand assets',
      'Show platform statistics (total users, listings, markets)',
      'Add contact information with embedded map for office location',
      'Implement careers page or link to job listings',
      'Add customer testimonials or case studies section',
      'Show technology partners and integration logos',
    ],
  },
  {
    name: 'Changelog',
    id: 'c993f0ec-f382-828b-996e-81f8c2d19690',
    suggestions: [
      'Add version-based filtering to view changes for specific releases',
      'Implement change type badges (feature, fix, improvement, breaking)',
      'Add search functionality within changelog entries',
      'Show date-grouped changelog with expand/collapse per release',
      'Add "What\'s New" banner linking to latest changelog on login',
      'Implement RSS/Atom feed for changelog updates',
      'Add before/after screenshots for UI changes',
      'Show affected areas/pages for each change',
      'Add user notification preferences for changelog updates',
      'Implement changelog voting to mark changes as helpful',
    ],
  },
  {
    name: 'Size Charts',
    id: 'de93f0ec-f382-8351-920d-81a185740201',
    suggestions: [
      'Add visual size chart builder with drag-and-drop columns and rows',
      'Implement brand-specific size charts with conversion tables',
      'Add size chart templates for common categories (shoes, shirts)',
      'Show measurement guide with visual body measurement diagrams',
      'Add international size conversion (US, UK, EU, JP, CN)',
      'Implement size recommendation based on saved measurements',
      'Add size chart linking to automatically attach charts to listings',
      'Show size availability heatmap for inventory items',
      'Add custom measurement fields beyond standard dimensions',
      'Implement size chart import from CSV or other sources',
    ],
  },
  {
    name: 'Feedback & Suggestions',
    id: 'af63f0ec-f382-82c4-8030-013518f734e8',
    suggestions: [
      'Add upvote/downvote system for community feedback prioritization',
      'Implement feedback categorization (bug report, feature request)',
      'Add feedback status tracking (submitted, under review, planned)',
      'Show admin responses to feedback in a thread-like format',
      'Implement anonymous feedback option for sensitive suggestions',
      'Add screenshot attachment support for bug reports',
      'Show "Similar Feedback" suggestions while typing',
      'Add feedback analytics showing trending topics',
      'Implement feedback roadmap integration linking to roadmap items',
      'Add email notifications when feedback status changes',
    ],
  },
];

async function cleanAndAddSuggestions(page) {
  const { name, id, suggestions } = page;
  console.log(`\n--- ${name} ---`);

  try {
    // Step 1: Get all blocks from the page
    const response = await notion.blocks.children.list({
      block_id: id,
      page_size: 100,
    });
    await sleep(350);

    let issuesHeadingId = null;
    let waitingHeadingId = null;
    const blocksToDelete = [];

    // Find the headings and identify blocks to delete
    for (const block of response.results) {
      if (block.type === 'heading_2') {
        const text = block.heading_2.rich_text.map(rt => rt.plain_text).join('');
        if (text.includes('Issues/Features to Work On')) {
          issuesHeadingId = block.id;
        } else if (text.includes('Waiting for Manual Approval')) {
          waitingHeadingId = block.id;
        } else if (text.includes('New Suggestions')) {
          blocksToDelete.push(block.id);
        }
      } else if (block.type === 'divider') {
        blocksToDelete.push(block.id);
      } else if (block.type === 'bulleted_list_item') {
        blocksToDelete.push(block.id);
      }
    }

    if (!issuesHeadingId) {
      console.log(`  ⚠️ Could not find "Issues/Features to Work On" heading`);
      return;
    }

    // Step 2: Delete the incorrectly placed blocks
    if (blocksToDelete.length > 0) {
      console.log(`  Deleting ${blocksToDelete.length} incorrectly placed blocks...`);
      for (const blockId of blocksToDelete) {
        try {
          await notion.blocks.delete({ block_id: blockId });
          await sleep(150);
        } catch (err) {
          // Block might already be deleted
        }
      }
    }

    // Step 3: Add suggestions as to-do items after the "Issues/Features to Work On" heading
    console.log(`  Adding ${suggestions.length} to-do items...`);

    const todoBlocks = suggestions.map((text) => ({
      object: 'block',
      type: 'to_do',
      to_do: {
        rich_text: [{ type: 'text', text: { content: text } }],
        checked: false,
      },
    }));

    // Add blocks after the Issues/Features heading
    await notion.blocks.children.append({
      block_id: id,
      children: todoBlocks,
      after: issuesHeadingId,
    });
    await sleep(350);

    console.log(`  ✅ Done - ${suggestions.length} suggestions added under "Issues/Features to Work On"`);
  } catch (err) {
    console.error(`  ❌ ERROR: ${err.message}`);
  }
}

async function main() {
  console.log('=== Fixing Suggestion Placement ===');
  console.log(`Processing ${pages.length} pages...`);

  for (const page of pages) {
    await cleanAndAddSuggestions(page);
    await sleep(400);
  }

  console.log('\n✨ All done!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
