// e2e/global-teardown.js
import { releaseTestLock } from './helpers/test-lock.js';

export default async function globalTeardown() {
  // Clean up all test data created during the E2E run
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const { default: postgres } = await import('postgres');
      const sql = postgres(dbUrl, { max: 1, connect_timeout: 5 });
      try {
        // Delete test users (cascade removes inventory, listings, automations)
        const result = await sql`
          DELETE FROM users
          WHERE email LIKE '%@test.vaultlister.com'
             OR email LIKE 'test%@example.com'
        `;
        console.log(`[global-teardown] Cleaned up test users (${result.count} rows)`);

        // Truncate high-volume test-generated log rows from the test window
        await sql`DELETE FROM request_logs WHERE created_at > NOW() - INTERVAL '2 hours'`.catch(() => {});
        await sql`DELETE FROM error_logs WHERE created_at > NOW() - INTERVAL '2 hours'`.catch(() => {});
      } finally {
        await sql.end();
      }
    } catch (err) {
      console.warn('[global-teardown] DB cleanup skipped:', err.message);
    }
  }

  releaseTestLock();
  console.log('[global-teardown] Test lock released');
}
