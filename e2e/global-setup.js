// e2e/global-setup.js
import { acquireTestLock } from './helpers/test-lock.js';

export default async function globalSetup() {
  // Fail fast if concurrent test lock already held — prevents shared DB corruption
  const locked = acquireTestLock();
  if (!locked) {
    throw new Error(
      '[global-setup] Another test suite is already running. ' +
      'Concurrent E2E runs corrupt shared DB state. ' +
      'Wait for the other suite to finish or delete data/test.lock'
    );
  }
  console.log('[global-setup] Test lock acquired, PID:', process.pid);

  // Pre-clean stale test data from previous runs to ensure a fresh baseline
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const { default: postgres } = await import('postgres');
      const sql = postgres(dbUrl, { max: 1, connect_timeout: 5 });
      try {
        // Remove test users and all cascading data (inventory, listings, automations)
        // Test accounts use @test.vaultlister.com or test+<timestamp>@example.com patterns
        await sql`
          DELETE FROM users
          WHERE email LIKE '%@test.vaultlister.com'
             OR email LIKE 'test%@example.com'
        `;
        console.log('[global-setup] Pre-cleaned stale test users from DB');
      } finally {
        await sql.end();
      }
    } catch (err) {
      // Non-fatal — DB may not be available in all environments (e.g., pure UI smoke tests)
      console.warn('[global-setup] DB pre-clean skipped:', err.message);
    }
  }
}
