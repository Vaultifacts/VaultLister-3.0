#!/usr/bin/env bun
// Tails the automation audit log in real time with formatted, coloured output.
// Usage: bun run audit:tail
//   or:  bun scripts/tail-audit.js [--lines 20]

import { existsSync, readFileSync, watchFile, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH  = join(__dirname, '..', 'data', 'automation-audit.log');

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

const EVENT_COLOURS = {
    publish_attempt: CYAN,
    publish_success: GREEN,
    publish_failure: RED,
};

function formatLine(line) {
    if (!line.trim()) return null;
    try {
        const { ts, platform, event, ...rest } = JSON.parse(line);
        const colour = EVENT_COLOURS[event] || YELLOW;
        const time = ts?.replace('T', ' ').replace(/\.\d+Z$/, 'Z') || '?';
        const details = Object.keys(rest).length
            ? ` ${DIM}${JSON.stringify(rest)}${RESET}`
            : '';
        return `${DIM}${time}${RESET}  ${BOLD}${platform.padEnd(10)}${RESET}  ${colour}${event}${RESET}${details}`;
    } catch {
        return `${DIM}(unparsed)${RESET} ${line}`;
    }
}

// How many tail lines to show initially
const linesArg = process.argv.indexOf('--lines');
const tailCount = linesArg !== -1 ? parseInt(process.argv[linesArg + 1]) || 20 : 20;

if (!existsSync(LOG_PATH)) {
    console.log(`${YELLOW}No audit log yet — ${LOG_PATH}${RESET}`);
    console.log(`${DIM}Watching for new entries...${RESET}\n`);
} else {
    const content = readFileSync(LOG_PATH, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const tail = lines.slice(-tailCount);

    console.log(`${BOLD}${CYAN}VaultLister — Automation Audit Log${RESET}`);
    console.log(`${DIM}Showing last ${tail.length} of ${lines.length} entries — watching for new...${RESET}\n`);

    for (const line of tail) {
        const formatted = formatLine(line);
        if (formatted) console.log(formatted);
    }
    if (tail.length > 0) console.log('');
}

// Watch for changes
let lastSize = existsSync(LOG_PATH) ? statSync(LOG_PATH).size : 0;

watchFile(LOG_PATH, { interval: 500 }, () => {
    if (!existsSync(LOG_PATH)) return;
    const newSize = statSync(LOG_PATH).size;
    if (newSize <= lastSize) { lastSize = newSize; return; }

    const fd = Bun.file(LOG_PATH);
    fd.text().then(content => {
        const newContent = content.slice(lastSize);
        lastSize = newSize;
        for (const line of newContent.split('\n')) {
            const formatted = formatLine(line);
            if (formatted) console.log(formatted);
        }
    });
});

console.log(`${DIM}Press Ctrl+C to stop.${RESET}`);
