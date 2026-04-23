/**
 * VaultLister Server Manager
 *
 * Lightweight process manager for background server operation.
 *
 * Commands:
 *   start [--watch]  - Start server in background (--watch enables file watching)
 *   stop             - Gracefully stop the server
 *   restart [--watch]- Stop then start
 *   status           - Check if server is running + health
 *   logs [--tail N]  - Show last N lines of server log (default 50)
 *
 * Usage: bun scripts/server-manager.js <command> [options]
 */

import { spawn, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const PID_FILE = join(ROOT_DIR, 'logs', 'server.pid');
const LOG_FILE = join(ROOT_DIR, 'logs', 'server.log');
const PORT = process.env.PORT || 3000;
const HEALTH_URL = `http://localhost:${PORT}/api/health`;

// Ensure logs directory exists
mkdirSync(join(ROOT_DIR, 'logs'), { recursive: true });

function readPid() {
  try {
    if (existsSync(PID_FILE)) {
      const pid = parseInt(readFileSync(PID_FILE, 'utf8').trim());
      return isNaN(pid) ? null : pid;
    }
  } catch {}
  return null;
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function checkHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return { healthy: true, data };
    }
    return { healthy: false };
  } catch {
    return { healthy: false };
  }
}

function cleanStalePid() {
  const pid = readPid();
  if (pid && !isProcessAlive(pid)) {
    try { unlinkSync(PID_FILE); } catch {}
    return true;
  }
  return false;
}

// Kill any process already listening on PORT, regardless of PID file state.
// Prevents dual-server conflicts when a previous process wasn't tracked.
function killByPort() {
  try {
    if (process.platform === 'win32') {
      const r = spawnSync('powershell.exe', [
        '-NoProfile', '-Command',
        `$p = (Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach ($id in $p) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; Write-Output $id }`
      ], { encoding: 'utf8', timeout: 8000 });
      const killed = r.stdout?.trim();
      if (killed) console.log(`Cleared existing process(es) on port ${PORT} (PID ${killed})`);
    } else {
      spawnSync('sh', ['-c', `lsof -ti tcp:${PORT} | xargs kill -9 2>/dev/null || true`], { timeout: 5000 });
    }
  } catch { /* non-fatal — don't block startup */ }
}

async function startServer(useWatch) {
  const existingPid = readPid();
  if (existingPid && isProcessAlive(existingPid)) {
    console.log(`Server already running (PID ${existingPid})`);
    const health = await checkHealth();
    if (health.healthy) {
      console.log(`Health: OK - ${health.data.status}`);
    }
    return;
  }

  cleanStalePid();
  killByPort();

  const args = useWatch
    ? ['--watch', join(ROOT_DIR, 'src', 'backend', 'server.js')]
    : [join(ROOT_DIR, 'src', 'backend', 'server.js')];

  const logFd = openSync(LOG_FILE, 'a');

  const child = spawn('bun', args, {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    cwd: ROOT_DIR,
    shell: true  // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
  });

  child.unref();

  // Write the spawned PID (server.js will overwrite with its own PID on startup)
  writeFileSync(PID_FILE, String(child.pid));
  console.log(`Server starting in background (PID ${child.pid})${useWatch ? ' with file watching' : ''}...`);

  // Poll health endpoint to confirm startup
  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000));
    const health = await checkHealth();
    if (health.healthy) {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Health: OK - database ${health.data.database?.status || 'unknown'}`);
      console.log(`Logs: ${LOG_FILE}`);
      return;
    }
    attempts++;
  }

  console.log(`Server may still be starting. Check status with: bun run dev:status`);
  console.log(`Logs: ${LOG_FILE}`);
}

async function stopServer() {
  const pid = readPid();
  if (!pid) {
    console.log('No PID file found. Server may not be running.');
    return;
  }

  if (!isProcessAlive(pid)) {
    console.log(`Process ${pid} is not running. Cleaning up PID file.`);
    try { unlinkSync(PID_FILE); } catch {}
    return;
  }

  console.log(`Stopping server (PID ${pid})...`);

  try {
    // Send SIGTERM for graceful shutdown
    process.kill(pid, 'SIGTERM');

    // Wait for process to exit
    let attempts = 0;
    while (attempts < 10 && isProcessAlive(pid)) {
      await new Promise(r => setTimeout(r, 500));
      attempts++;
    }

    if (isProcessAlive(pid)) {
      console.log('Process did not exit gracefully. Force killing...');
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // On Windows, try taskkill as fallback
        if (process.platform === 'win32') {
          spawn('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' });
        }
      }
    }

    // Clean up PID file (graceful shutdown should have removed it)
    try { unlinkSync(PID_FILE); } catch {}
    console.log('Server stopped.');
  } catch (err) {
    console.error(`Failed to stop server: ${err.message}`);
  }
}

async function showStatus() {
  const pid = readPid();

  if (!pid) {
    console.log('Status: NOT RUNNING (no PID file)');
    console.log(`Start with: bun run dev:bg`);
    return;
  }

  const alive = isProcessAlive(pid);
  if (!alive) {
    console.log(`Status: NOT RUNNING (stale PID ${pid})`);
    try { unlinkSync(PID_FILE); } catch {}
    console.log(`Start with: bun run dev:bg`);
    return;
  }

  const health = await checkHealth();
  if (health.healthy) {
    console.log(`Status: RUNNING`);
    console.log(`  PID:      ${pid}`);
    console.log(`  URL:      http://localhost:${PORT}`);
    console.log(`  Health:   OK`);
    console.log(`  Database: ${health.data.database?.status || 'unknown'}`);
    console.log(`  Version:  ${health.data.version || 'unknown'}`);
    console.log(`  Uptime:   since ${health.data.timestamp || 'unknown'}`);
  } else {
    console.log(`Status: RUNNING (PID ${pid}) but NOT HEALTHY`);
    console.log(`  The process is alive but the health endpoint is not responding.`);
    console.log(`  Check logs: bun run dev:status logs`);
  }
}

function showLogs(tailLines) {
  if (!existsSync(LOG_FILE)) {
    console.log('No log file found.');
    return;
  }

  const content = readFileSync(LOG_FILE, 'utf8');
  const lines = content.trim().split('\n');
  const start = Math.max(0, lines.length - tailLines);
  const tail = lines.slice(start);

  console.log(`--- Last ${tail.length} lines of ${LOG_FILE} ---`);
  for (const line of tail) {
    console.log(line);
  }
  console.log(`--- End of logs (${lines.length} total lines) ---`);
}

// Main
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'start': {
    const useWatch = args.includes('--watch');
    await startServer(useWatch);
    break;
  }
  case 'stop':
    await stopServer();
    break;
  case 'restart': {
    const useWatch = args.includes('--watch');
    await stopServer();
    await new Promise(r => setTimeout(r, 1000));
    await startServer(useWatch);
    break;
  }
  case 'status':
    await showStatus();
    break;
  case 'logs': {
    const tailIdx = args.indexOf('--tail');
    const tailLines = tailIdx >= 0 ? parseInt(args[tailIdx + 1]) || 50 : 50;
    showLogs(tailLines);
    break;
  }
  default:
    console.log('VaultLister Server Manager');
    console.log('');
    console.log('Usage: bun scripts/server-manager.js <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  start [--watch]   Start server in background');
    console.log('  stop              Stop the server');
    console.log('  restart [--watch] Restart the server');
    console.log('  status            Check server status');
    console.log('  logs [--tail N]   Show last N lines of log (default 50)');
    console.log('');
    console.log('Shortcuts:');
    console.log('  bun run dev:bg     = start');
    console.log('  bun run dev:stop   = stop');
    console.log('  bun run dev:status = status');
    break;
}
