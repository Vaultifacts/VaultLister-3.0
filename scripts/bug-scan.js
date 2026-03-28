#!/usr/bin/env bun
/**
 * Continuous Bug Scanner — VaultLister 3.0
 *
 * Performs static analysis passes on the codebase and writes timestamped
 * Markdown reports to docs/bug-reports/ for later Claude Code review.
 *
 * Usage:
 *   bun scripts/bug-scan.js                      # single scan
 *   bun scripts/bug-scan.js --watch              # scan every 30 min all day
 *   bun scripts/bug-scan.js --watch --interval 15  # scan every 15 min
 *   bun scripts/bug-scan.js --output /tmp/scans  # custom output dir
 */

import {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
    readdirSync,
    statSync,
    appendFileSync,
} from 'fs';
import { join, dirname, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');  // nosemgrep

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const WATCH_MODE = args.includes('--watch');
const INTERVAL_IDX = args.indexOf('--interval');
const INTERVAL_MINUTES = INTERVAL_IDX !== -1 ? parseInt(args[INTERVAL_IDX + 1], 10) || 30 : 30;
const OUTPUT_IDX = args.indexOf('--output');
const OUTPUT_DIR = OUTPUT_IDX !== -1
    ? args[OUTPUT_IDX + 1]
    : join(ROOT_DIR, 'docs', 'bug-reports');  // nosemgrep

// ─── Directories to scan ─────────────────────────────────────────────────────
const SCAN_DIRS = [
    join(ROOT_DIR, 'src'),  // nosemgrep
    join(ROOT_DIR, 'scripts'),  // nosemgrep
    join(ROOT_DIR, 'worker'),  // nosemgrep
];

// ─── Paths / patterns to skip ────────────────────────────────────────────────
const IGNORE_FRAGMENTS = [
    'node_modules', '.git', 'dist', 'build', 'coverage',
    '.next', 'archive', 'screenshots', 'chrome-extension',
];
const IGNORE_SUFFIXES = ['.min.js', '.bundle.js', '-bundle.js', 'core-bundle.js', 'bun.lockb'];
const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.jsx', '.tsx']);

// ─── Bug pattern catalogue ────────────────────────────────────────────────────
/**
 * Each entry: { patterns: RegExp[], severity, category, message, suggest }
 * suggest: human-readable fix hint (may reference the matched snippet via {match})
 */
const BUG_PATTERNS = [
    // ── NULL / UNDEFINED DEREFERENCE ─────────────────────────────────────────
    {
        category: 'null-deref',
        severity: 'high',
        message: 'Property access on a value that may be null/undefined',
        suggest: 'Guard with optional chaining (`?.`) or an explicit null check before accessing the property.',
        patterns: [
            // e.g.  result.rows[0].id   where result.rows could be empty
            /\brows\[0\]\.\w+/g,
            // e.g.  req.user.id  (user may not be set)
            /\breq\.user\.\w+/g,
            // e.g.  res.data.items  (API response may be null)
            /\bres\.data\.\w+/g,
        ],
    },
    {
        category: 'null-deref',
        severity: 'medium',
        message: 'Array destructuring result used without null guard',
        suggest: 'Use `const [item] = arr ?? [];` or check that the array is non-empty first.',
        patterns: [
            /const\s*\[\s*\w+\s*\]\s*=\s*(?!.*\?\?|.*\|\|)/g,
        ],
    },

    // ── MISSING AWAIT ────────────────────────────────────────────────────────
    {
        category: 'missing-await',
        severity: 'high',
        message: 'Async function result used without `await` — operation may silently return a Promise',
        suggest: 'Add `await` before the call, or capture and handle the returned Promise explicitly.',
        patterns: [
            // const x = asyncFn()  (no await, inside async context)
            /const\s+\w+\s*=\s*(?!await\s)\w+(?:Async|Service|Query|Find|Save|Create|Update|Delete|Fetch|Get|Send)\s*\(/g,
        ],
    },

    // ── UNHANDLED PROMISE ────────────────────────────────────────────────────
    {
        category: 'unhandled-promise',
        severity: 'high',
        message: '`.then()` chain without a `.catch()` — rejection will be silently swallowed',
        suggest: 'Append `.catch(err => { /* handle */ })` or convert the chain to `async/await` inside a `try/catch`.',
        patterns: [
            /\.then\s*\([^)]*\)\s*(?!\.catch|\.finally)/g,
        ],
    },
    {
        category: 'unhandled-promise',
        severity: 'medium',
        message: 'Floating promise — async call not awaited and return value discarded',
        suggest: 'Either `await` the call or explicitly annotate with `void` if the rejection is handled elsewhere.',
        patterns: [
            /^\s*(?!return\s|await\s|const\s|let\s|var\s|throw\s|void\s)\w+\.\w+(?:Async|\.then)\s*\(/gm,
        ],
    },

    // ── SQL INJECTION ────────────────────────────────────────────────────────
    {
        category: 'sql-injection',
        severity: 'critical',
        message: 'Raw string interpolation inside SQL query — potential SQL injection',
        suggest: 'Use parameterised queries: `query.get(sql, [param1, param2])` — never interpolate user data directly into SQL strings.',
        patterns: [
            /`\s*SELECT\b[^`]*\$\{/g,
            /`\s*INSERT\b[^`]*\$\{/g,
            /`\s*UPDATE\b[^`]*\$\{/g,
            /`\s*DELETE\b[^`]*\$\{/g,
            /`\s*WHERE\b[^`]*\$\{/g,
        ],
    },

    // ── XSS ──────────────────────────────────────────────────────────────────
    {
        category: 'xss',
        severity: 'critical',
        message: '`innerHTML` assigned without sanitisation — potential XSS injection point',
        suggest: 'Wrap the value with `escapeHtml()` (for plain text) or `DOMPurify.sanitize()` (for intentional HTML). Never set `innerHTML` directly from user-supplied or API-sourced data.',
        patterns: [
            /\.innerHTML\s*=\s*(?!`[^`]*escapeHtml|DOMPurify)/g,
            /\.outerHTML\s*=\s*(?!`[^`]*escapeHtml|DOMPurify)/g,
        ],
    },
    {
        category: 'xss',
        severity: 'high',
        message: '`insertAdjacentHTML` called — ensure content is sanitised',
        suggest: 'Pass only static strings or values that have been through `DOMPurify.sanitize()` / `escapeHtml()`.',
        patterns: [
            /\.insertAdjacentHTML\s*\(/g,
        ],
    },

    // ── OPEN REDIRECT ────────────────────────────────────────────────────────
    {
        category: 'open-redirect',
        severity: 'high',
        message: '`res.redirect()` called with a value that may originate from user input',
        suggest: 'Validate the redirect target against an allowlist of known-safe paths, or use a relative path only.',
        patterns: [
            /res\.redirect\s*\(\s*(?:req\.|body\.|query\.|params\.)\w+/g,
        ],
    },

    // ── PATH TRAVERSAL ───────────────────────────────────────────────────────
    {
        category: 'path-traversal',
        severity: 'critical',
        message: '`path.join` / `path.resolve` called with request-derived input — potential path traversal',
        suggest: 'Resolve the path, then verify it starts with the expected base directory: `if (!resolved.startsWith(BASE)) throw new Error(\'Forbidden\')`.',
        patterns: [
            /(?:join|resolve)\s*\([^)]*(?:req\.|body\.|query\.|params\.)\w+/g,
        ],
    },

    // ── INSECURE RANDOM ──────────────────────────────────────────────────────
    {
        category: 'insecure-random',
        severity: 'medium',
        message: '`Math.random()` used — not cryptographically secure',
        suggest: 'Replace with `crypto.randomBytes(n)` (Node/Bun) or `crypto.getRandomValues()` for any token, nonce, or secret generation.',
        patterns: [
            /Math\.random\s*\(\s*\)/g,
        ],
    },

    // ── EVAL / CODE INJECTION ────────────────────────────────────────────────
    {
        category: 'code-injection',
        severity: 'critical',
        message: '`eval()` or `new Function()` — arbitrary code execution risk',
        suggest: 'Remove entirely. Refactor the calling code to avoid dynamic evaluation. If parsing is needed, use `JSON.parse()` or a purpose-built parser.',
        patterns: [
            /\beval\s*\(/g,
            /new\s+Function\s*\(/g,
        ],
    },

    // ── PROTOTYPE POLLUTION ──────────────────────────────────────────────────
    {
        category: 'prototype-pollution',
        severity: 'high',
        message: '`Object.assign({}, untrusted)` or spread of untrusted input — prototype pollution risk',
        suggest: 'Validate or whitelist keys before merging. For API bodies, destructure only the fields you need rather than spreading the entire object.',
        patterns: [
            /Object\.assign\s*\(\s*\w+\s*,\s*(?:req\.|body\.|query\.)\w+/g,
            /\.\.\.\s*(?:req\.body|req\.query|req\.params)\b/g,
        ],
    },

    // ── LOOSE EQUALITY ───────────────────────────────────────────────────────
    {
        category: 'loose-equality',
        severity: 'low',
        message: 'Loose equality (`==` / `!=`) used — type coercion may cause unexpected comparisons',
        suggest: 'Use strict equality (`===` / `!==`) unless you intentionally want type coercion (rare).',
        patterns: [
            /[^=!<>]={2}(?!=)[^=]/g,   // == (not ===)
            /!={1}(?!=)/g,              // != (not !==)
        ],
    },

    // ── HARDCODED SECRETS ────────────────────────────────────────────────────
    {
        category: 'hardcoded-secret',
        severity: 'critical',
        message: 'Likely hardcoded credential or API key in source code',
        suggest: 'Move the value to `.env` and access it via `process.env.YOUR_VAR`. Rotate the leaked secret immediately.',
        patterns: [
            /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{6,}['"]/gi,
            /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
            /(?:secret|private[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
            /(?:bearer|jwt)\s*[:=]\s*['"][^'"]{20,}['"]/gi,
        ],
    },

    // ── MISSING CATCH IN ROUTE HANDLER ──────────────────────────────────────
    {
        category: 'missing-error-handling',
        severity: 'high',
        message: 'Async route/handler defined without a `try/catch` — uncaught rejection may crash the server',
        suggest: 'Wrap the handler body in `try { ... } catch (err) { return { status: 500, error: err.message }; }` or use a shared `asyncHandler` wrapper.',
        patterns: [
            /async\s+function\s+\w+\s*\(\s*ctx\b[^)]*\)\s*\{(?![^}]*try\s*\{)/g,
        ],
    },

    // ── MEMORY LEAK: INTERVAL WITHOUT CLEAR ─────────────────────────────────
    {
        category: 'memory-leak',
        severity: 'medium',
        message: '`setInterval(...)` result not stored — interval cannot be cleared, potential memory leak',
        suggest: 'Assign the result to a variable (`const id = setInterval(...)`) and call `clearInterval(id)` when the component/connection is torn down.',
        patterns: [
            /(?:^|\s)setInterval\s*\([^;)]+\)(?!\s*;?\s*\/\/.*noscan)/gm,
        ],
    },
    {
        category: 'memory-leak',
        severity: 'medium',
        message: '`addEventListener` with no corresponding `removeEventListener` visible in same scope',
        suggest: 'Store the handler reference and call `removeEventListener` in a cleanup / `unsubscribe` function.',
        patterns: [
            /\.addEventListener\s*\(\s*['"][^'"]+['"]/g,
        ],
    },

    // ── DANGEROUS REGEX ──────────────────────────────────────────────────────
    {
        category: 'redos',
        severity: 'medium',
        message: '`new RegExp(userInput)` — ReDoS or regex injection if input is not sanitised',
        suggest: 'Escape user input with a `escapeRegex` helper before passing it to `new RegExp(...)`, or use a literal regex.',
        patterns: [
            /new\s+RegExp\s*\(\s*(?:req\.|body\.|query\.|params\.)\w+/g,
        ],
    },

    // ── CONSOLE LOG OF SENSITIVE DATA ────────────────────────────────────────
    {
        category: 'info-leak',
        severity: 'low',
        message: '`console.log` may be printing sensitive data (password / token / secret)',
        suggest: 'Remove the log statement in production, or redact the sensitive field: `console.log({ ...user, password: \'[REDACTED]\' })`.',
        patterns: [
            /console\.log\([^)]*(?:password|token|secret|key)/gi,
        ],
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shouldIgnore(filePath) {
    const rel = relative(ROOT_DIR, filePath);
    if (IGNORE_FRAGMENTS.some(f => rel.includes(f))) return true;
    if (IGNORE_SUFFIXES.some(s => filePath.endsWith(s))) return true;
    return false;
}

/** Collect all JS/TS files under `dir` */
function collectFiles(dir, acc = []) {
    if (!existsSync(dir) || shouldIgnore(dir)) return acc;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);  // nosemgrep
        try {
            const st = statSync(full);
            if (st.isDirectory()) {
                collectFiles(full, acc);
            } else if (SCAN_EXTENSIONS.has(extname(full)) && !shouldIgnore(full)) {
                acc.push(full);
            }
        } catch { /* skip unreadable */ }
    }
    return acc;
}

/** Return the 1-based line number for character index `charIdx` in `content` */
function lineNumberAt(content, charIdx) {
    let line = 1;
    for (let i = 0; i < charIdx; i++) {
        if (content[i] === '\n') line++;
    }
    return line;
}

/** Scan one file and return array of findings */
function scanFile(filePath) {
    const findings = [];
    let content;
    try {
        content = readFileSync(filePath, 'utf8');
    } catch { return findings; }

    const relPath = relative(ROOT_DIR, filePath);

    for (const def of BUG_PATTERNS) {
        for (const pattern of def.patterns) {
            const re = new RegExp(pattern.source, pattern.flags);  // nosemgrep
            let m;
            while ((m = re.exec(content)) !== null) {
                // Prevent catastrophic backtracking on degenerate inputs
                if (re.lastIndex === m.index) { re.lastIndex++; continue; }

                const lineNum = lineNumberAt(content, m.index);
                // Grab the full source line for context
                const lines = content.split('\n');
                const snippet = (lines[lineNum - 1] || '').trim().substring(0, 120);

                findings.push({
                    id: '',  // filled in after all files scanned
                    category: def.category,
                    severity: def.severity,
                    message: def.message,
                    suggest: def.suggest,
                    file: relPath,
                    line: lineNum,
                    snippet,
                });
            }
        }
    }
    return findings;
}

// ─── Report generation ────────────────────────────────────────────────────────

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };

function severitySort(a, b) {
    return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
}

function buildReport(findings, meta) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach(f => { counts[f.severity] = (counts[f.severity] || 0) + 1; });

    const totalBugs = findings.length;
    const lines = [];

    lines.push(`# VaultLister 3.0 — Bug Scan Report`);
    lines.push(``);
    lines.push(`> **Scan started:** ${meta.startedAt}`);
    lines.push(`> **Scan finished:** ${meta.finishedAt}`);
    lines.push(`> **Pass:** ${meta.pass} of the day  |  **Interval:** every ${meta.intervalMinutes} min`);
    lines.push(`> **Files scanned:** ${meta.filesScanned}  |  **Findings:** ${totalBugs}`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Summary`);
    lines.push(``);
    lines.push(`| Severity | Count |`);
    lines.push(`|----------|-------|`);
    lines.push(`| 🔴 Critical | ${counts.critical || 0} |`);
    lines.push(`| 🟠 High     | ${counts.high || 0} |`);
    lines.push(`| 🟡 Medium   | ${counts.medium || 0} |`);
    lines.push(`| 🔵 Low      | ${counts.low || 0} |`);
    lines.push(`| **Total**   | **${totalBugs}** |`);
    lines.push(``);
    lines.push(`> 📋 **For Claude Code:** Review each finding below. Each entry includes a suggested fix.`);
    lines.push(`> Confirm whether the flagged pattern is an actual bug in context, then apply the suggested fix`);
    lines.push(`> or mark the finding as a false-positive using a \`// noscan: <reason>\` inline comment.`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    if (totalBugs === 0) {
        lines.push(`## ✅ No bugs detected in this scan pass.`);
        lines.push(``);
        lines.push(`All ${meta.filesScanned} files scanned cleanly.`);
        lines.push(``);
        return lines.join('\n');
    }

    // Group by severity
    for (const sev of ['critical', 'high', 'medium', 'low']) {
        const group = findings.filter(f => f.severity === sev);
        if (group.length === 0) continue;

        lines.push(`## ${SEVERITY_EMOJI[sev]} ${sev.charAt(0).toUpperCase() + sev.slice(1)} (${group.length})`);
        lines.push(``);

        // Sub-group by category
        const byCategory = {};
        group.forEach(f => {
            (byCategory[f.category] = byCategory[f.category] || []).push(f);
        });

        for (const [cat, items] of Object.entries(byCategory)) {
            lines.push(`### ${cat} (${items.length})`);
            lines.push(``);

            items.forEach((f, idx) => {
                lines.push(`#### ${f.id} — \`${f.file}:${f.line}\``);
                lines.push(``);
                lines.push(`**Category:** \`${f.category}\``);
                lines.push(``);
                lines.push(`**Issue:** ${f.message}`);
                lines.push(``);
                if (f.snippet) {
                    lines.push(`**Flagged code:**`);
                    lines.push(`\`\`\`js`);
                    lines.push(`// Line ${f.line}`);
                    lines.push(f.snippet);
                    lines.push(`\`\`\``);
                    lines.push(``);
                }
                lines.push(`**Suggested fix:** ${f.suggest}`);
                lines.push(``);
                lines.push(`---`);
                lines.push(``);
            });
        }
    }

    lines.push(`## How to suppress a false-positive`);
    lines.push(``);
    lines.push(`Add \`// noscan: <reason>\` at the end of the flagged line to exclude it from future reports:`);
    lines.push(``);
    lines.push(`\`\`\`js`);
    lines.push(`const url = res.data.url; // noscan: res.data is always validated by schema before use`);
    lines.push(`\`\`\``);
    lines.push(``);

    return lines.join('\n');
}

// ─── Scan runner ─────────────────────────────────────────────────────────────

let passCount = 0;
const dayStart = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function runScan() {
    passCount++;
    const startedAt = new Date().toISOString();
    console.log(`\n[bug-scan] Pass ${passCount} starting at ${startedAt}`);

    // Collect files
    const files = [];
    for (const dir of SCAN_DIRS) {
        collectFiles(dir, files);
    }

    // Skip files with `// noscan-file` header
    const scanFiles = files.filter(f => {
        try {
            const head = readFileSync(f, 'utf8').substring(0, 200);
            return !head.includes('// noscan-file');
        } catch { return true; }
    });

    console.log(`[bug-scan] Scanning ${scanFiles.length} files…`);

    // Gather findings
    const allFindings = [];
    for (const f of scanFiles) {
        allFindings.push(...scanFile(f));
    }

    // Suppress lines with // noscan
    const filtered = allFindings.filter(f => {
        try {
            const lines = readFileSync(join(ROOT_DIR, f.file), 'utf8').split('\n');  // nosemgrep
            const line = lines[f.line - 1] || '';
            return !line.includes('// noscan');
        } catch { return true; }
    });

    // Assign sequential IDs and sort
    filtered.sort(severitySort);
    filtered.forEach((f, i) => { f.id = `BUG-${String(i + 1).padStart(3, '0')}`; });

    const finishedAt = new Date().toISOString();

    // Build report
    const report = buildReport(filtered, {
        startedAt,
        finishedAt,
        pass: passCount,
        intervalMinutes: INTERVAL_MINUTES,
        filesScanned: scanFiles.length,
    });

    // Ensure output dir exists
    const dayDir = join(OUTPUT_DIR, dayStart);  // nosemgrep
    mkdirSync(dayDir, { recursive: true });

    // Write timestamped report
    const timestamp = startedAt.replace(/[:.]/g, '-').slice(0, 19);
    const reportPath = join(dayDir, `scan-${timestamp}.md`);  // nosemgrep
    writeFileSync(reportPath, report, 'utf8');

    // Keep LATEST.md in the root of bug-reports for quick access
    const latestPath = join(OUTPUT_DIR, 'LATEST.md');  // nosemgrep
    writeFileSync(latestPath, report, 'utf8');

    // Append one-line summary to scan history
    const historyPath = join(OUTPUT_DIR, 'scan-history.log');  // nosemgrep
    const summary = `${finishedAt} | pass=${passCount} | files=${scanFiles.length} | findings=${filtered.length} (crit=${filtered.filter(f => f.severity === 'critical').length} high=${filtered.filter(f => f.severity === 'high').length} med=${filtered.filter(f => f.severity === 'medium').length} low=${filtered.filter(f => f.severity === 'low').length}) | report=${relative(ROOT_DIR, reportPath)}\n`;
    appendFileSync(historyPath, summary, 'utf8');

    const crit = filtered.filter(f => f.severity === 'critical').length;
    const high = filtered.filter(f => f.severity === 'high').length;
    console.log(`[bug-scan] Pass ${passCount} done — ${filtered.length} findings (${crit} critical, ${high} high)`);
    console.log(`[bug-scan] Report: ${relative(ROOT_DIR, reportPath)}`);
    if (WATCH_MODE) {
        console.log(`[bug-scan] Next scan in ${INTERVAL_MINUTES} minutes…`);
    }

    return filtered.length;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

if (WATCH_MODE) {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const msUntilEnd = endOfDay - Date.now();
    const intervalMs = INTERVAL_MINUTES * 60 * 1000;
    const estimatedPasses = Math.floor(msUntilEnd / intervalMs) + 1;

    console.log(`[bug-scan] Watch mode ON — interval: ${INTERVAL_MINUTES} min`);
    console.log(`[bug-scan] Reports output to: ${OUTPUT_DIR}`);
    console.log(`[bug-scan] Estimated passes today: ~${estimatedPasses}`);
    console.log(`[bug-scan] All reports accumulate in docs/bug-reports/${dayStart}/`);
    console.log(`[bug-scan] LATEST.md always points to the most recent scan.`);
    console.log(`[bug-scan] Press Ctrl-C to stop.\n`);

    // Run immediately, then schedule
    runScan();
    const intervalId = setInterval(() => {
        if (Date.now() >= endOfDay) {
            clearInterval(intervalId);
            console.log('\n[bug-scan] End of day reached — watch mode stopped.');
            console.log(`[bug-scan] Total passes today: ${passCount}`);
            console.log(`[bug-scan] Review reports in: ${OUTPUT_DIR}/${dayStart}/`);
            console.log(`[bug-scan] Quick review: docs/bug-reports/LATEST.md`);
            process.exit(0);
        }
        runScan();
    }, intervalMs);
} else {
    // Single scan
    console.log(`[bug-scan] Single scan — output: ${OUTPUT_DIR}`);
    runScan();
}
