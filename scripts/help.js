/**
 * VaultLister Scripts Help
 *
 * Lists all available scripts with descriptions and usage.
 *
 * Usage: bun scripts/help.js [category]
 * Categories: notion, database, testing, security, backup, server, utility, all
 */

const SCRIPTS = {
  notion: {
    title: '📋 Notion Workflow Scripts',
    description: 'Scripts for managing the Notion-based issue tracking system',
    scripts: [
      {
        name: 'session-start.js',
        description: 'Run at START of every session. Shows completed features (to avoid duplicates) and current Notion status (pending/waiting/approved items).',
        usage: 'bun scripts/session-start.js',
        when: 'Beginning of every coding session'
      },
      {
        name: 'session-end.js',
        description: 'Interactive script to add completed features to "Waiting for Manual Approval" with proper formatting.',
        usage: 'bun scripts/session-end.js',
        when: 'End of session after completing features'
      },
      {
        name: 'transfer-approved.js',
        description: 'Automatically moves items from "Approved to Move" to Completed Issues pages. Updates page titles.',
        usage: 'bun scripts/transfer-approved.js',
        when: 'After user approves items in Notion'
      },
      {
        name: 'fetch-completed-features.js',
        description: 'Lists all completed features organized by category. Used by session-start.js.',
        usage: 'bun scripts/fetch-completed-features.js',
        when: 'Before suggesting new features'
      },
      {
        name: 'check-notion-status.js',
        description: 'Shows pending issues, waiting approvals, and approved items across all pages.',
        usage: 'bun scripts/check-notion-status.js',
        when: 'To see what needs to be worked on'
      },
      {
        name: 'suggest-features.js',
        description: 'Analyzes existing features and suggests new ones. Avoids duplicates.',
        usage: 'bun scripts/suggest-features.js [category]',
        when: 'When a page needs new feature suggestions'
      },
      {
        name: 'validate-notion-structure.js',
        description: 'Validates all pages have correct structure (sections, headers, etc.).',
        usage: 'bun scripts/validate-notion-structure.js',
        when: 'Troubleshooting Notion issues'
      },
      {
        name: 'search-issues.js',
        description: 'Search across all Notion pages by keyword. Shows which page/section matches are in.',
        usage: 'bun scripts/search-issues.js "keyword"',
        when: 'Checking if a feature already exists'
      },
      {
        name: 'add-to-approval.js',
        description: 'Add a completed feature directly to "Waiting for Manual Approval" section with proper toggle format.',
        usage: 'bun scripts/add-to-approval.js',
        when: 'Adding a single completed item to Notion during work'
      }
    ]
  },
  database: {
    title: '🗄️ Database Scripts',
    description: 'Scripts for database management and maintenance',
    scripts: [
      {
        name: 'checkDatabase.js',
        description: 'Check database integrity and structure',
        usage: 'bun scripts/checkDatabase.js'
      },
      {
        name: 'checkUsers.js',
        description: 'Check user records in database',
        usage: 'bun scripts/checkUsers.js'
      },
      {
        name: 'cleanInventory.js',
        description: 'Clean up inventory data',
        usage: 'bun scripts/cleanInventory.js'
      },
      {
        name: 'fixInventoryStatus.js',
        description: 'Fix inventory status values',
        usage: 'bun scripts/fixInventoryStatus.js'
      },
      {
        name: 'run-migrations.js',
        description: 'Run all pending database migrations',
        usage: 'bun scripts/run-migrations.js'
      },
      {
        name: 'runMigration.js',
        description: 'Run a specific migration',
        usage: 'bun scripts/runMigration.js <migration-name>'
      }
    ]
  },
  testing: {
    title: '🧪 Testing Scripts',
    description: 'Scripts for running tests and simulations',
    scripts: [
      {
        name: 'run-api-tests.js',
        description: 'Run API endpoint tests',
        usage: 'bun scripts/run-api-tests.js'
      },
      {
        name: 'run-e2e-tests.js',
        description: 'Run end-to-end tests',
        usage: 'bun scripts/run-e2e-tests.js'
      },
      {
        name: 'simulateRealUsage.js',
        description: 'Simulate real user workflows',
        usage: 'bun scripts/simulateRealUsage.js'
      },
      {
        name: 'load-test.js',
        description: 'Performance and load testing',
        usage: 'bun scripts/load-test.js'
      },
      {
        name: 'benchmark.js',
        description: 'Benchmark specific operations',
        usage: 'bun scripts/benchmark.js'
      },
      {
        name: 'visual-test.js',
        description: 'Visual & Interactive Testing — screenshots, interaction scenarios, a11y audits, visual regression, 140+ step types. Run with no args to see full help.',
        usage: 'node scripts/visual-test.js',
        when: 'Visual testing, UI screenshots, accessibility audits, interaction testing'
      },
      {
        name: 'test-cleanup.js',
        description: 'Clean up test artifacts and temporary test data',
        usage: 'bun scripts/test-cleanup.js'
      }
    ]
  },
  security: {
    title: '🔒 Security & Audit Scripts',
    description: 'Scripts for security scanning and auditing',
    scripts: [
      {
        name: 'security-audit.js',
        description: 'Run comprehensive security audit',
        usage: 'bun scripts/security-audit.js'
      },
      {
        name: 'testSecurity.js',
        description: 'Dynamic security testing — rate limiting, CSRF, input validation, headers',
        usage: 'bun scripts/testSecurity.js',
        when: 'Testing security controls (requires server running)'
      },
      {
        name: 'searchXss.js',
        description: 'Search for XSS vulnerabilities',
        usage: 'bun scripts/searchXss.js'
      },
      {
        name: 'accessibility-audit.js',
        description: 'Run accessibility audit (WCAG)',
        usage: 'bun scripts/accessibility-audit.js'
      },
      {
        name: 'ethics-audit.js',
        description: 'Run ethics and privacy audit',
        usage: 'bun scripts/ethics-audit.js'
      },
      {
        name: 'lighthouse-audit.js',
        description: 'Run Lighthouse performance audit',
        usage: 'bun scripts/lighthouse-audit.js'
      }
    ]
  },
  backup: {
    title: '💾 Backup & Deployment Scripts',
    description: 'Scripts for backup, restore, and deployment',
    scripts: [
      {
        name: 'backup.js',
        description: 'Create manual backup of database and files',
        usage: 'bun scripts/backup.js'
      },
      {
        name: 'backup-automation.js',
        description: 'Set up automated backup schedule',
        usage: 'bun scripts/backup-automation.js'
      },
      {
        name: 'restore.js',
        description: 'Restore from a backup',
        usage: 'bun scripts/restore.js <backup-file>'
      },
      {
        name: 'deploy-local.sh',
        description: 'Deploy to local environment',
        usage: 'bash scripts/deploy-local.sh'
      }
    ]
  },
  server: {
    title: '🖥️ Server Management Scripts',
    description: 'Scripts for managing the development server process',
    scripts: [
      {
        name: 'bun run dev',
        description: 'Start server in foreground with file watching and auto-restart on crash or code changes.',
        usage: 'bun run dev',
        when: 'Normal development (keeps terminal attached)'
      },
      {
        name: 'server-manager.js start [--watch]',
        description: 'Start server in background. Use --watch for file watching. Logs to logs/server.log.',
        usage: 'bun run dev:bg  OR  bun scripts/server-manager.js start --watch',
        when: 'Running server without tying up a terminal'
      },
      {
        name: 'server-manager.js stop',
        description: 'Gracefully stop the background server. Sends SIGTERM, cleans up PID file.',
        usage: 'bun run dev:stop',
        when: 'Stopping the background server'
      },
      {
        name: 'server-manager.js status',
        description: 'Check if server is running, show PID, health, and database status.',
        usage: 'bun run dev:status',
        when: 'Checking if server is alive'
      },
      {
        name: 'server-manager.js restart [--watch]',
        description: 'Stop and restart the server. Supports --watch flag.',
        usage: 'bun scripts/server-manager.js restart',
        when: 'Restarting after config changes'
      },
      {
        name: 'server-manager.js logs [--tail N]',
        description: 'Show last N lines of server log (default 50).',
        usage: 'bun scripts/server-manager.js logs --tail 100',
        when: 'Debugging server issues'
      }
    ]
  },
  utility: {
    title: '🔧 Utility Scripts',
    description: 'Miscellaneous utility and sync scripts',
    scripts: [
      {
        name: 'sync-visual-test-prompt.js',
        description: 'Sync visual test setup prompt to Desktop, memory, and Notion page.',
        usage: 'bun scripts/sync-visual-test-prompt.js',
        when: 'After updating visual-test.js or visual-test-setup-prompt.md'
      },
      {
        name: 'help.js',
        description: 'This script — lists all available scripts with descriptions.',
        usage: 'bun scripts/help.js [category]'
      }
    ]
  }
};

function printCategory(category) {
  const cat = SCRIPTS[category];
  if (!cat) {
    console.log(`Unknown category: ${category}`);
    console.log('Available: notion, database, testing, security, backup, server, utility, all');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(cat.title);
  console.log(cat.description);
  console.log('═'.repeat(60));

  for (const script of cat.scripts) {
    console.log(`\n  ${script.name}`);
    console.log(`  ${'─'.repeat(script.name.length)}`);
    console.log(`  ${script.description}`);
    console.log(`  Usage: ${script.usage}`);
    if (script.when) {
      console.log(`  When:  ${script.when}`);
    }
  }
}

function printQuickReference() {
  console.log('\n' + '═'.repeat(60));
  console.log('📚 QUICK REFERENCE - Common Workflows');
  console.log('═'.repeat(60));

  console.log(`
  🚀 START OF SESSION:
     bun scripts/session-start.js

  🔍 CHECK IF FEATURE EXISTS:
     bun scripts/search-issues.js "feature name"

  💡 GET FEATURE SUGGESTIONS:
     bun scripts/suggest-features.js

  ✅ END OF SESSION (add completed work):
     bun scripts/session-end.js

  📦 AFTER USER APPROVES:
     bun scripts/transfer-approved.js

  🔧 TROUBLESHOOT NOTION:
     bun scripts/validate-notion-structure.js
`);
}

function main() {
  const category = process.argv[2]?.toLowerCase();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          VAULTLISTER SCRIPTS HELP                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (!category || category === 'all') {
    // Print all categories
    for (const cat of Object.keys(SCRIPTS)) {
      printCategory(cat);
    }
    printQuickReference();
  } else {
    printCategory(category);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('Usage: bun scripts/help.js [category]');
  console.log('Categories: notion, database, testing, security, backup, server, utility, all');
  console.log('─'.repeat(60) + '\n');
}

main();
