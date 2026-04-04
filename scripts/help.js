/**
 * VaultLister Scripts Help
 *
 * Lists all available scripts with descriptions and usage.
 *
 * Usage: bun scripts/help.js [category]
 * Categories: database, testing, security, backup, server, poshmark, utility, all
 */

const SCRIPTS = {
  database: {
    title: '🗄️ Database Scripts',
    scripts: [
      { name: 'checkDatabase.js', description: 'Check database integrity and structure', usage: 'bun scripts/checkDatabase.js' },
      { name: 'checkUsers.js', description: 'Check user records in database', usage: 'bun scripts/checkUsers.js' },
      { name: 'cleanInventory.js', description: 'Clean up inventory data', usage: 'bun scripts/cleanInventory.js' },
      { name: 'fixInventoryStatus.js', description: 'Fix inventory status values', usage: 'bun scripts/fixInventoryStatus.js' },
      { name: 'run-migrations.js', description: 'Run all pending database migrations', usage: 'bun scripts/run-migrations.js' },
      { name: 'runMigration.js', description: 'Run a specific migration', usage: 'bun scripts/runMigration.js <migration-name>' },
      { name: 'seed-demo.js', description: 'Seed database with demo data', usage: 'bun scripts/seed-demo.js' }
    ]
  },
  testing: {
    title: '🧪 Testing Scripts',
    scripts: [
      { name: 'run-api-tests.js', description: 'Run API endpoint tests', usage: 'bun scripts/run-api-tests.js' },
      { name: 'run-e2e-tests.js', description: 'Run end-to-end tests', usage: 'bun scripts/run-e2e-tests.js' },
      { name: 'run-e2e-chunks.js', description: 'Run E2E tests in parallel chunks', usage: 'node scripts/run-e2e-chunks.js' },
      { name: 'simulateRealUsage.js', description: 'Simulate real user workflows', usage: 'bun scripts/simulateRealUsage.js' },
      { name: 'load-test.js', description: 'Performance and load testing', usage: 'bun scripts/load-test.js' },
      { name: 'benchmark.js', description: 'Benchmark specific operations', usage: 'bun scripts/benchmark.js' },
      { name: 'visual-test.js', description: 'Visual testing — screenshots, interaction, a11y, regression', usage: 'node scripts/visual-test.js' },
      { name: 'test-cleanup.js', description: 'Clean up test artifacts and temporary test data', usage: 'bun scripts/test-cleanup.js' }
    ]
  },
  security: {
    title: '🔒 Security & Audit Scripts',
    scripts: [
      { name: 'security-audit.js', description: 'Run comprehensive security audit', usage: 'bun scripts/security-audit.js' },
      { name: 'testSecurity.js', description: 'Dynamic security testing (requires server)', usage: 'bun scripts/testSecurity.js' },
      { name: 'searchXss.js', description: 'Search for XSS vulnerabilities', usage: 'bun scripts/searchXss.js' },
      { name: 'accessibility-audit.js', description: 'Run accessibility audit (WCAG)', usage: 'bun scripts/accessibility-audit.js' },
      { name: 'ethics-audit.js', description: 'Run ethics and privacy audit', usage: 'bun scripts/ethics-audit.js' },
      { name: 'lighthouse-audit.js', description: 'Run Lighthouse performance audit', usage: 'bun scripts/lighthouse-audit.js' },
      { name: 'rotate-encryption-key.js', description: 'Rotate AES-256-GCM encryption key', usage: 'bun scripts/rotate-encryption-key.js' }
    ]
  },
  backup: {
    title: '💾 Backup & Deployment Scripts',
    scripts: [
      { name: 'pg-backup.js', description: 'Create PostgreSQL backup (pg_dump)', usage: 'bun scripts/pg-backup.js [--compress]' },
      { name: 'pg-restore.js', description: 'Restore from a PostgreSQL backup', usage: 'bun scripts/pg-restore.js <backup-file>' },
      { name: 'backup-health-check.js', description: 'Verify backup integrity', usage: 'bun scripts/backup-health-check.js' },
      { name: 'deploy-local.sh', description: 'Deploy to local environment', usage: 'bash scripts/deploy-local.sh' },
      { name: 'post-deploy-check.mjs', description: 'Post-deploy health verification', usage: 'node scripts/post-deploy-check.mjs' },
      { name: 'rollback.sh', description: 'Rollback deployment', usage: 'bash scripts/rollback.sh' }
    ]
  },
  server: {
    title: '🖥️ Server Management Scripts',
    scripts: [
      { name: 'bun run dev', description: 'Start server in foreground with file watching', usage: 'bun run dev' },
      { name: 'server-manager.js start', description: 'Start server in background', usage: 'bun run dev:bg' },
      { name: 'server-manager.js stop', description: 'Stop background server', usage: 'bun run dev:stop' },
      { name: 'server-manager.js status', description: 'Check server status', usage: 'bun run dev:status' },
      { name: 'server-manager.js restart', description: 'Restart server', usage: 'bun scripts/server-manager.js restart' },
      { name: 'server-manager.js logs', description: 'Show server logs', usage: 'bun scripts/server-manager.js logs --tail 100' },
      { name: 'kill-port.js', description: 'Kill process on a port', usage: 'bun scripts/kill-port.js <port>' },
      { name: 'preflight.js', description: 'Pre-startup environment check', usage: 'bun scripts/preflight.js' }
    ]
  },
  poshmark: {
    title: '🛍️ Poshmark Automation Scripts',
    scripts: [
      { name: 'poshmark-login.js', description: 'Log into Poshmark (stealth browser)', usage: 'node scripts/poshmark-login.js' },
      { name: 'poshmark-scheduler.js', description: 'Run automated sharing/offer schedule', usage: 'bun scripts/poshmark-scheduler.js' },
      { name: 'poshmark-publish-bot.js', description: 'Publish listings to Poshmark', usage: 'bun scripts/poshmark-publish-bot.js' },
      { name: 'poshmark-offer-sync.mjs', description: 'Sync offers from Poshmark', usage: 'node scripts/poshmark-offer-sync.mjs' },
      { name: 'poshmark-delete-listing.mjs', description: 'Delete a Poshmark listing', usage: 'node scripts/poshmark-delete-listing.mjs' },
      { name: 'poshmark-diagnose.mjs', description: 'Diagnose Poshmark connection', usage: 'node scripts/poshmark-diagnose.mjs' },
      { name: 'poshmark-keepalive.js', description: 'Keep Poshmark session alive', usage: 'bun scripts/poshmark-keepalive.js' },
      { name: 'stealth-fingerprint-test.js', description: 'Test browser stealth/fingerprint', usage: 'node scripts/stealth-fingerprint-test.js' }
    ]
  },
  utility: {
    title: '🔧 Utility Scripts',
    scripts: [
      { name: 'help.js', description: 'This script — lists all available scripts', usage: 'bun scripts/help.js [category]' },
      { name: 'session-start.js', description: 'Show pending tasks at session start', usage: 'bun scripts/session-start.js' },
      { name: 'validate-env.js', description: 'Validate environment variables', usage: 'bun scripts/validate-env.js' },
      { name: 'check-publish-credentials.js', description: 'Check marketplace credentials', usage: 'bun scripts/check-publish-credentials.js' },
      { name: 'build-dev-bundle.js', description: 'Build core-bundle.js from source modules', usage: 'bun scripts/build-dev-bundle.js' },
      { name: 'build-frontend.js', description: 'Production frontend build', usage: 'bun scripts/build-frontend.js' },
      { name: 'split-deferred-chunks.js', description: 'Split pages-deferred.js into route chunks', usage: 'bun scripts/split-deferred-chunks.js' },
      { name: 'admin.js', description: 'Admin CLI utilities', usage: 'bun scripts/admin.js' },
      { name: 'tail-audit.js', description: 'Tail the audit log', usage: 'bun scripts/tail-audit.js' }
    ]
  }
};

function printCategory(category) {
  const cat = SCRIPTS[category];
  if (!cat) {
    console.log(`Unknown category: ${category}`);
    console.log('Available: ' + Object.keys(SCRIPTS).join(', ') + ', all');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(cat.title);
  console.log('═'.repeat(60));

  for (const script of cat.scripts) {
    console.log(`\n  ${script.name}`);
    console.log(`  ${'─'.repeat(script.name.length)}`);
    console.log(`  ${script.description}`);
    console.log(`  Usage: ${script.usage}`);
  }
}

function main() {
  const category = process.argv[2]?.toLowerCase();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          VAULTLISTER SCRIPTS HELP                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (!category || category === 'all') {
    for (const cat of Object.keys(SCRIPTS)) {
      printCategory(cat);
    }
  } else {
    printCategory(category);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('Usage: bun scripts/help.js [category]');
  console.log('Categories: ' + Object.keys(SCRIPTS).join(', ') + ', all');
  console.log('─'.repeat(60) + '\n');
}

main();
