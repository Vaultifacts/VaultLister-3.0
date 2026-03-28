# Bug Scan Reports

This directory is written by `scripts/bug-scan.js` and is the **read-only output**
of the continuous bug scanner. Do **not** edit files here by hand — they are
overwritten on each scan pass.

## Directory structure

```
docs/bug-reports/
├── README.md           ← this file
├── LATEST.md           ← always the most recent scan (overwritten each pass)
├── scan-history.log    ← one-line summary appended after every pass
└── YYYY-MM-DD/         ← one directory per calendar day
    ├── scan-<timestamp>.md
    └── …
```

## Running the scanner

| Command | What it does |
|---------|-------------|
| `bun scripts/bug-scan.js` | Single scan, results in `LATEST.md` |
| `bun run bug:scan` | Same as above via npm script |
| `bun scripts/bug-scan.js --watch` | Continuous scan every **30 minutes** until midnight |
| `bun run bug:scan:watch` | Same as above via npm script |
| `bun scripts/bug-scan.js --watch --interval 15` | Continuous scan every **15 minutes** |
| `bun scripts/bug-scan.js --output /tmp/my-scans` | Custom output directory |

## How Claude Code should use these reports

At the end of the day, open `docs/bug-reports/LATEST.md` (or any timestamped
report in the dated sub-folder) and work through each finding:

1. **Read the flagged code snippet** — confirm the finding is a real bug, not a
   false positive.
2. **Apply the suggested fix** listed under each finding.
3. **Suppress false positives** by adding `// noscan: <reason>` at the end of
   the flagged source line. The scanner will skip that line in all future passes.
4. **Add `// noscan-file` as the first line** of any file that should be excluded
   from scanning entirely (e.g. generated files, vendor bundles).

## Severity guide

| Level | Emoji | Meaning |
|-------|-------|---------|
| Critical | 🔴 | Likely exploitable vulnerability or data-corrupting bug — fix immediately |
| High | 🟠 | Probable runtime error or security weakness — fix before next release |
| Medium | 🟡 | Code smell with realistic failure path — fix in current sprint |
| Low | 🔵 | Style / best-practice deviation — fix when touching the file |

## What the scanner checks

| Category | Examples caught |
|----------|----------------|
| `null-deref` | `rows[0].id` with empty array, `req.user.id` without guard |
| `missing-await` | `const x = asyncFn()` (Promise returned, not awaited) |
| `unhandled-promise` | `.then()` without `.catch()` |
| `sql-injection` | Template literals interpolated directly into SQL strings |
| `xss` | `element.innerHTML = value` without `escapeHtml()` / DOMPurify |
| `open-redirect` | `res.redirect(req.query.next)` |
| `path-traversal` | `path.join(base, req.params.file)` without boundary check |
| `insecure-random` | `Math.random()` in token/nonce generation |
| `code-injection` | `eval(...)`, `new Function(...)` |
| `prototype-pollution` | `Object.assign(target, req.body)` |
| `loose-equality` | `==` / `!=` instead of `===` / `!==` |
| `hardcoded-secret` | `password: 'hunter2'` in source |
| `missing-error-handling` | `async function handler(ctx) {` without `try/catch` |
| `memory-leak` | `setInterval(...)` result not stored |
| `redos` | `new RegExp(req.query.search)` |
| `info-leak` | `console.log(user.password)` |
