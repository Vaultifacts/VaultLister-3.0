/**
 * Shared .env loader for scripts
 *
 * Usage:
 *   import { loadEnv } from './lib/env.js';
 *   loadEnv();
 *   // process.env now has .env values
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '..', '.env');

export function loadEnv() {
  try {
    const envText = require('fs').readFileSync(envPath, 'utf8');
    for (const line of envText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        if (!process.env[key]) {
          let value = trimmed.slice(eq + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`Warning: .env file not found at ${envPath}`);
      console.warn('Copy .env.example to .env and fill in your values.');
    } else {
      throw new Error(`Failed to load .env from ${envPath}: ${err.message}`);
    }
  }
}
