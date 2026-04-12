# /mobile-fix — Apply VERIFIED Mobile Fixes

Reads the latest mobile audit report, patches all VERIFIED issues in local source files, rebuilds, lints, and visually re-confirms at 390px.

## CRITICAL RULES
1. **Only fix VERIFIED issues.** HIGH-PROBABILITY and HYPOTHESIS require manual review.
2. **Minimal diffs only.** Fix the specific property/rule causing the issue. Do not refactor surrounding code.
3. **All CSS changes go in `src/frontend/styles/main.css`** inside the correct `@media` block.
4. **After any source module edit, run `bun run dev:bundle`** to regenerate `core-bundle.js`.
5. **Visual re-check is mandatory before marking fixed.** Screenshot at 390px proves the fix.

## Phase 1: Load Latest Audit

1. `Glob docs/audits/mobile/*.md` — find the most recent report (sort by filename date).
2. `Read` the report.
3. Extract all VERIFIED findings. If none: tell the user "No VERIFIED issues to fix." and stop.
4. List findings to the user before proceeding:
   ```
   Found N VERIFIED issues:
   1. [Page] — [Issue title]
   2. ...
   Fixing now.
   ```

## Phase 2: Fix Each Issue

For each VERIFIED finding:

### Locating the CSS rule

1. `Grep` for the class name in `src/frontend/styles/main.css`
2. Find the correct `@media` block (mobile issues usually belong in `@media (max-width: 768px)` or `@media (max-width: 1024px)`)
3. `Read` the surrounding lines to understand context

### Common fix patterns

**Touch target too small:**
```css
/* In appropriate .class rule or @media (max-width: 768px) block */
.the-element {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
```

**iOS auto-zoom on input:**
```css
@media (max-width: 768px) {
    .form-input, .form-select, .form-textarea {
        font-size: 1rem; /* 16px prevents Safari auto-zoom */
    }
}
```

**Desktop header visible on mobile:**
```css
@media (max-width: 1024px) {
    .header {
        display: none;
    }
}
```

**Widget grid too narrow:**
```css
@media (max-width: 768px) {
    .dashboard-widgets-container {
        grid-template-columns: repeat(2, 1fr);
    }
    .widget-size-full { grid-column: span 2; }
    .widget-size-half, .widget-size-third { grid-column: span 1; }
}
```

**Button row stacking instead of wrapping:**
```css
@media (max-width: 768px) {
    .page-header .flex {
        flex-wrap: wrap; /* not flex-direction: column */
    }
}
```

### After each edit

1. `Read` the edited section back — confirm the change looks right.
2. Record which file was changed.

## Phase 3: Rebuild (if needed)

Only run if you edited a **source module** (anything in `src/frontend/` other than `styles/main.css`).

CSS-only changes do NOT require rebuild:
```bash
bun run lint
```

Source module changes require rebuild:
```bash
bun run dev:bundle && bun run lint
```

Verify lint output ends with `Syntax OK`.

## Phase 4: Visual Verification

CSS changes are LOCAL — you must verify against **localhost**, not the live site. The live site won't reflect local file changes until deployed.

1. Ensure local server is running: `bun run dev` (or `bun run dev:bg`)
2. Get tab: `mcp__claude-in-chrome__tabs_context_mcp`
3. Navigate tab to `http://localhost:3000`: `mcp__claude-in-chrome__navigate`
4. Resize: `mcp__claude-in-chrome__resize_window` width: 390, height: 844
5. Hard-refresh (Ctrl+Shift+R via `mcp__claude-in-chrome__shortcuts_execute`) — forces CSS reload from disk
6. Re-inject fake session + navigate to the affected page
7. Take screenshot — **look at it** — confirm the issue is gone
6. If still broken: re-read the CSS, check specificity, check if rebuild was needed
7. Mark as **fixed** or **still failing** in your notes

Restore window: `mcp__claude-in-chrome__resize_window` width: 1280, height: 900

## Phase 5: Update Audit Report

After all fixes, append to the audit report file:

```markdown
## Fix Log — YYYY-MM-DD

| Issue | Status | Commit |
|-------|--------|--------|
| [issue title] | Fixed | [hash after commit] |
| [issue title] | Still failing | [reason] |
```

## Phase 6: Commit

Only commit after visual verification passes.

```bash
git add src/frontend/styles/main.css  # (and any other changed files, by name)
git commit -m "[AUTO] fix(mobile): [brief description of all fixes]

Verified: visual screenshot at 390px iPhone viewport confirms all N issues resolved.
$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```
