// e2e/helpers/test-lock.js
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';

const LOCK_FILE = '/tmp/vaultlister-e2e.lock';

export function acquireTestLock() {
  if (existsSync(LOCK_FILE)) {
    const data = readFileSync(LOCK_FILE, 'utf-8');
    const { pid, time } = JSON.parse(data);
    // Stale lock (>30 min old) — override
    if (Date.now() - time > 30 * 60 * 1000) {
      console.log(`[test-lock] Overriding stale lock from PID ${pid}`);
    } else {
      console.log(`[test-lock] Lock held by PID ${pid} — skipping`);
      return false;
    }
  }
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, time: Date.now() }));
  return true;
}

export function releaseTestLock() {
  try { unlinkSync(LOCK_FILE); } catch {}
}

export function isTestLocked() {
  if (!existsSync(LOCK_FILE)) return false;
  try {
    const { time } = JSON.parse(readFileSync(LOCK_FILE, 'utf-8'));
    return Date.now() - time < 30 * 60 * 1000;
  } catch { return false; }
}
