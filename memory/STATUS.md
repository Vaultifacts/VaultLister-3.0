# STATUS.md – VaultLister 3.0 Agent Coordination File
> Both CLI agent (Claude Code) and Bot agent (OpenClaw) share this file. Update on every session.

## Current State
- **Branch:** main
- **Server:** ✅ running on port 3000
- **Last commit:** c56e9fd (codebase ported from VaultLister 2.0)
- **Test status:** ✅ 5,251 pass / 0 fail (baseline: 0)
- **Anthropic API:** ✅ verified (claude-sonnet-4 translation test passed)
- **As of:** 2026-03-03

## In Progress
_(claim tasks here during work — format: `- AGENT: Description [files: file1, file2]`)_

## Pending Review
_(Bot commits waiting for CLI agent review)_

## Next Tasks
- [ ] H: `bunx playwright install` — install Playwright browsers (needed for marketplace automations)
- [x] H: Fix 14 baseline test failures — resolved (TEST_BASE_URL port mismatch)
- [ ] M: Configure OpenClaw (`.openclaw/config.json` — fill `[CONFIGURE]` placeholders)
- [ ] M: Set `OPENCLAW_WEBHOOK_OUTBOUND` in `.env`
- [ ] M: Configure marketplace API credentials (eBay, Etsy, Poshmark, Mercari) in `.env`
- [ ] L: Review and tighten `.claude/settings.json` deny rules

## Last Completed Work
- 2026-03-02: Scaffold generated from VaultLister 2.0 reference (38 files)
- 2026-03-02: Codebase ported from VaultLister 2.0; pushed to GitHub
- 2026-03-02: `.env` configured; `bun install --ignore-scripts` (better-sqlite3 C++ workaround); server confirmed on port 3000
- 2026-03-03: Test baseline established: 5,237 pass / 14 fail (`.test-baseline` = 14)
- 2026-03-03: `ANTHROPIC_API_KEY` set; Claude API verified via `/api/ai/translate` (claude-sonnet-4)
- 2026-03-03: Playwright installed (v1.58.2); playwright.config.js ported; E2E auth: 17/18 pass
- 2026-03-03: Fixed 14 baseline failures (TEST_BASE_URL port mismatch); now 5,251 pass / 0 fail

## Warnings
- `bun run db:drop*` is in the deny list — requires manual override if needed
- `.env` must never be committed or modified by agents

## Messages
_(leave notes for the other agent here — format: `FROM → TO (DATE): Message`)_

## Blockers
_(active blockers — describe and tag with who needs to resolve)_
