# /qa — Universal QA Testing Skill (v4)

You are executing a comprehensive, visual QA test of this project. This skill auto-detects what to test, requires zero manual input beyond "go", and produces screenshot-verified results.

## CRITICAL RULES — NON-NEGOTIABLE
1. **SCREENSHOT EVERY PAGE.** Before any DOM check, before any grep. Take a screenshot and LOOK AT IT.
2. **NEVER use `mcp__plugin_chrome-devtools-mcp`** — only use `mcp__claude-in-chrome__*` tools.
3. **NEVER mark anything as Pass without a screenshot** showing it looks correct.
4. **NEVER claim confidence without visual proof** shown to the user.
5. **Do NOT use `window.location.hash = '...'` or `window.router.navigate()`** via javascript_tool — both disconnect the extension bridge. Use `renderApp(window.pages.xxx())` instead.

## Phase 1: Auto-Detect Traits

Run the detection script:
```bash
bash scripts/qa-detect-traits.sh
```

This outputs DETECTED/NOT_DETECTED for each of 56 traits. Trait files live in the Claude project memory directory at `memory/qa-traits/`.

If the script is unavailable, detect manually by reading `memory/qa-traits/00-detection-rules.md` and scanning:
1. `package.json` for dependencies
2. `Glob` for file structure patterns
3. `Grep` for code patterns
4. `.env.example` for environment variables

## Phase 2: Build Test Plan

1. Always include traits 01-14 (universal)
2. Add all detected conditional traits (15-56)
3. Load test items from each matched trait file in `memory/qa-traits/`
4. Count total test items

Present to user:
```
━━━ QA TEST PLAN ━━━
Project: [name]
URL: [from CLAUDE.md or ask user]

Detected Traits: [N] of 56
Total Test Items: [M]

Traits included:
  01 Functional (X items)
  02 Visual/UI (X items)
  ...
  [NOT DETECTED] 50 Desktop/Electron
  ...

Estimated sessions: [M / 50] (~50 items per session)

Ready to start? Say "go" or "skip [trait number]" to exclude a trait.
```

Wait for user to say "go".

## Phase 3: Execute Tests

### Pre-Testing Setup
1. Get Chrome tab: `mcp__claude-in-chrome__tabs_context_mcp`
2. Navigate to the app URL (for VaultLister: `https://vaultlister-app-production.up.railway.app`)
3. Take initial screenshot — verify the app loads
4. Log in if needed. For VaultLister use fake session pattern:
   ```js
   window.store.setState({user:{id:'demo',username:'demo',email:'demo@vaultlister.com',role:'admin'},token:'fake',refreshToken:'fake',isAuthenticated:true});
   renderApp(window.pages.dashboard());
   ```
5. Create screenshot directory: `data/qa-screenshots/[date]/`
6. Create `.walkthrough-active` file (enables screenshot gate hook)

### Test Execution Loop

For each trait, for each test item:

**Step 1: Navigate**
Use `renderApp(window.pages.xxx())` for SPA pages. Use `mcp__claude-in-chrome__navigate` only for full-page URLs.

**Step 2: Screenshot**
Take screenshot using `mcp__claude-in-chrome__computer` with `action: "screenshot"`

**Step 3: Visual Check**
LOOK at the screenshot. Check for:
- Page renders (not blank, not error)
- Layout correct (not squished, not broken)
- No error toasts
- Content present and correct
- No visual glitches

**Step 4: Interact** (for interactive items)
Click buttons, fill forms using `mcp__claude-in-chrome__computer` or `mcp__claude-in-chrome__javascript_tool`
Take screenshot AFTER interaction to verify result

**Step 5: Record Result**
- **Pass**: Screenshot shows correct behavior
- **Fail**: Screenshot shows broken behavior — note what's wrong
- **Skip**: Can't test (needs real credentials, hardware, etc.) — note why

**Step 6: Report to User**
State what you tested, the result, and what you saw. Move to next item.

### Per-Page Mandatory Checks
On EVERY page visited, also check:
1. Layout not broken (no overlap, no squish, no overflow)
2. No error toasts in corners
3. No invisible/missing elements
4. Text readable, not truncated
5. Dark mode: check both light and dark if Trait 16 detected
6. Consistent styling with rest of app

### Session Management
- After every 50 items: pause, summarize progress, ask to continue
- Save progress to `memory/QA-PROGRESS.md` periodically
- If context gets heavy: save progress, suggest /compact, resume from saved state

## Phase 4: Generate Report

After all items tested, generate:

```markdown
# QA Report — [Project Name]
Date: [date]
URL: [url]
Traits Tested: [N]
Items Tested: [M]
Screenshots: data/qa-screenshots/[date]/

## Summary
- Pass: [count] ([%])
- Fail: [count] ([%])
- Skip: [count] ([%])

## Failures (by severity)
### Critical
[list with screenshot references]

### High
[list with screenshot references]

### Medium
[list with screenshot references]

### Low
[list with screenshot references]

## Skipped Items
[list with reasons]

## Pages Visited
[list of pages tested]
```

Save report to `data/qa-report-[date]-skill.md`
Delete `.walkthrough-active` file.

## Phase 5: Offer Fixes

After report, ask:
"I found [N] issues. Want me to fix them? I'll start with Critical, then High, then Medium."

If yes: fix each issue, rebuild (`bun run dev:bundle`), deploy, then RETAKE THE SCREENSHOT to verify the fix.

## Version History
- v1 (2026-03-22): DOM queries only. Missed 21 items.
- v2 (2026-03-30): DOM + grep. Passed 478 items without screenshots. Missed broken layouts, crashes, error toasts.
- v3 (2026-04-01): Screenshot-first with trait detection. First functional version.
- v4 (2026-04-05): Detection script, project-level command, fake session pattern, bridge safety rules.
