/**
 * Cross-platform port killer.
 * Usage: bun scripts/kill-port.js <port>
 */
import { execSync } from 'child_process';

const port = process.argv[2] || '3001';

try {
    if (process.platform === 'win32') {
        const output = execSync(`netstat -ano`, { encoding: 'utf8' });
        const pids = [...new Set(
            output.split('\n')
                .filter(line => line.includes(`:${port} `) && line.includes('LISTENING'))
                .map(line => line.trim().split(/\s+/).pop())
                .filter(pid => pid && pid !== '0')
        )];
        for (const pid of pids) {
            try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }); } catch {}
        }
    } else {
        execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: 'ignore' });
    }
} catch {
    // Port not in use — nothing to kill
}
