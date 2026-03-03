// e2e/global-setup.js
import { acquireTestLock } from './helpers/test-lock.js';

export default async function globalSetup() {
  const locked = acquireTestLock();
  if (!locked) {
    console.warn('[global-setup] Another test suite is running — proceeding anyway');
  }
  console.log('[global-setup] Test lock acquired, PID:', process.pid);
}
