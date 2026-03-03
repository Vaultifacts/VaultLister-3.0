// e2e/global-teardown.js
import { releaseTestLock } from './helpers/test-lock.js';

export default async function globalTeardown() {
  releaseTestLock();
  console.log('[global-teardown] Test lock released');
}
