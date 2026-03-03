/**
 * Smart Feature Suggestions
 *
 * Analyzes completed and pending features to suggest new ones:
 * - Identifies categories with few pending items
 * - Generates contextual suggestions based on patterns
 * - Avoids suggesting anything already done or pending
 *
 * Usage: bun scripts/suggest-features.js [category]
 */

import { loadEnv } from './lib/env.js';
import { getChildPages, getBlocks, getPageIds } from './lib/notion.js';

loadEnv();

const { incomplete: INCOMPLETE_ISSUES_PAGE_ID, complete: COMPLETED_ISSUES_PAGE_ID } = getPageIds();

async function getPageItems(pageId) {
  const blocks = await getBlocks(pageId);
  return blocks
    .filter(b => b.type === 'bulleted_list_item' || b.type === 'to_do' || b.type === 'paragraph' || b.type === 'toggle')
    .map(b => {
      const richText = b[b.type]?.rich_text || [];
      return richText.map(t => t.plain_text).join('').trim().toLowerCase();
    })
    .filter(t => t.length > 0);
}

// Feature suggestion templates by category
const SUGGESTION_TEMPLATES = {
  'dashboard': [
    'Add customizable dashboard widgets with drag-and-drop reordering',
    'Show real-time notifications feed on dashboard',
    'Add quick stats comparison (today vs yesterday, this week vs last week)',
    'Implement dashboard themes/layouts users can choose from',
    'Add keyboard shortcuts overlay accessible from dashboard',
    'Show trending items widget based on recent sales',
    'Add goal tracking widget with progress bars',
    'Implement dashboard tour for new users'
  ],
  'inventory': [
    'Add barcode/QR code scanning for quick item lookup',
    'Implement bulk edit for multiple inventory items',
    'Add inventory value calculator with profit margins',
    'Show inventory aging report (days since listed)',
    'Add low stock alerts with customizable thresholds',
    'Implement inventory categories with custom icons',
    'Add inventory import from CSV/spreadsheet',
    'Show inventory turnover rate analytics'
  ],
  'my listings': [
    'Add listing quality score with improvement suggestions',
    'Implement A/B testing for listing titles/photos',
    'Add competitor price comparison for similar items',
    'Show listing performance heatmap (views over time)',
    'Implement listing templates with quick-apply',
    'Add SEO keyword suggestions for titles/descriptions',
    'Show best time to list based on historical data',
    'Add watermark feature for listing photos'
  ],
  'orders': [
    'Add order fulfillment workflow with stages',
    'Implement shipping label generation integration',
    'Show order profitability breakdown (fees, shipping, profit)',
    'Add customer communication templates',
    'Implement order issue tracking (returns, disputes)',
    'Add packing slip generation with custom branding',
    'Show order timeline with all status changes',
    'Implement order notes with @mentions'
  ],
  'automations': [
    'Add automation scheduling with calendar view',
    'Implement automation templates marketplace',
    'Show automation performance analytics',
    'Add conditional logic builder for complex rules',
    'Implement automation testing/preview mode',
    'Add webhook triggers for external integrations',
    'Show automation run history with detailed logs',
    'Implement automation groups for organized management'
  ],
  'checklist': [
    'Add checklist templates for common workflows',
    'Implement checklist sharing between team members',
    'Show checklist completion statistics',
    'Add time tracking per checklist item',
    'Implement checklist dependencies (item A before B)',
    'Add checklist reminders with notifications',
    'Show overdue checklist items prominently',
    'Implement checklist archiving for completed lists'
  ],
  'analytics': [
    'Add custom report builder with drag-and-drop',
    'Implement scheduled report emails',
    'Show year-over-year comparison charts',
    'Add cohort analysis for customer retention',
    'Implement export to PDF/Excel for reports',
    'Add benchmark comparison with industry averages',
    'Show predictive analytics with ML forecasting',
    'Implement analytics dashboard sharing'
  ],
  'settings': [
    'Add two-factor authentication setup',
    'Implement API key management for integrations',
    'Add account activity log with IP tracking',
    'Show storage usage breakdown by category',
    'Implement data export with format options',
    'Add notification preferences granular control',
    'Show connected apps/integrations management',
    'Implement account deletion with data export'
  ],
  'calendar': [
    'Add calendar sync with Google/Outlook',
    'Implement recurring events with custom patterns',
    'Show event reminders with push notifications',
    'Add calendar sharing with team members',
    'Implement event categories with color coding',
    'Add drag-and-drop event rescheduling',
    'Show event conflicts detection',
    'Implement calendar view options (day/week/month/agenda)'
  ],
  'suppliers': [
    'Add supplier rating system with reviews',
    'Implement supplier comparison tool',
    'Show supplier order history timeline',
    'Add supplier communication log',
    'Implement supplier price alerts',
    'Add supplier payment terms tracking',
    'Show supplier performance trends',
    'Implement supplier discovery marketplace'
  ],
  'market intel': [
    'Add price tracking for competitor items',
    'Implement market trend alerts',
    'Show demand forecasting by category',
    'Add competitor inventory monitoring',
    'Implement keyword trend analysis',
    'Add market share estimation',
    'Show pricing recommendation engine',
    'Implement competitor action notifications'
  ]
};

function normalizeCategory(title) {
  return title.toLowerCase()
    .replace(/\s*\(items to approve\)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterNewSuggestions(suggestions, existingItems) {
  return suggestions.filter(suggestion => {
    const suggestionLower = suggestion.toLowerCase();
    return !existingItems.some(existing =>
      existing.includes(suggestionLower.slice(0, 30)) ||
      suggestionLower.includes(existing.slice(0, 30))
    );
  });
}

async function main() {
  const targetCategory = process.argv[2]?.toLowerCase();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          SMART FEATURE SUGGESTIONS                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Get all pages
  const incompletePages = await getChildPages(INCOMPLETE_ISSUES_PAGE_ID);
  const completedPages = await getChildPages(COMPLETED_ISSUES_PAGE_ID);

  // Collect all existing items
  const existingByCategory = {};
  const stats = {};

  console.log('Analyzing existing features...\n');

  for (const page of [...incompletePages, ...completedPages]) {
    const category = normalizeCategory(page.title);
    if (category.includes('not fixed')) continue;

    const items = await getPageItems(page.id);
    existingByCategory[category] = existingByCategory[category] || [];
    existingByCategory[category].push(...items);

    await new Promise(r => setTimeout(r, 200)); // Rate limit
  }

  // Calculate stats
  for (const [category, items] of Object.entries(existingByCategory)) {
    stats[category] = items.length;
  }

  // Sort categories by least items (most need suggestions)
  const sortedCategories = Object.entries(stats)
    .sort((a, b) => a[1] - b[1])
    .map(([cat]) => cat);

  console.log('Category Coverage:');
  console.log('─'.repeat(50));
  for (const cat of sortedCategories) {
    const count = stats[cat];
    const bar = '█'.repeat(Math.min(count, 30));
    console.log(`  ${cat.padEnd(20)} ${String(count).padStart(3)} ${bar}`);
  }
  console.log('');

  // Generate suggestions
  const categoriesToSuggest = targetCategory
    ? [targetCategory]
    : sortedCategories.slice(0, 5); // Top 5 categories with least items

  console.log('═'.repeat(60));
  console.log('SUGGESTED FEATURES');
  console.log('═'.repeat(60));

  for (const category of categoriesToSuggest) {
    const templates = SUGGESTION_TEMPLATES[category] || [];
    const existing = existingByCategory[category] || [];
    const newSuggestions = filterNewSuggestions(templates, existing);

    if (newSuggestions.length === 0) continue;

    console.log(`\n## ${category.charAt(0).toUpperCase() + category.slice(1)}`);
    console.log(`   (${existing.length} existing items)`);
    console.log('─'.repeat(50));

    newSuggestions.slice(0, 5).forEach((suggestion, i) => {
      console.log(`  ${i + 1}. ${suggestion}`);
    });
  }

  console.log('\n' + '═'.repeat(60));
  console.log('TIP: Run with category name to get more suggestions:');
  console.log('     bun scripts/suggest-features.js dashboard');
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
