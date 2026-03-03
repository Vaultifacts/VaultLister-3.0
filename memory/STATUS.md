# STATUS.md – VaultLister 3.0 Agent Coordination File
> Both CLI agent (Claude Code) and Bot agent (OpenClaw) share this file. Update on every session.

## Current State
- **Branch:** main
- **Server:** not started
- **Last commit:** — (scaffold only, no code yet)
- **Test status:** not run yet
- **As of:** 2026-03-02

## In Progress
_(claim tasks here during work — format: `- AGENT: Description [files: file1, file2]`)_

## Pending Review
_(Bot commits waiting for CLI agent review)_

## Next Tasks
- [ ] H: Configure git remote → `git remote set-url origin https://github.com/Vaultifacts/VaultLister-3.0.git`
- [ ] H: Copy/port codebase from VaultLister 2.0 into this directory
- [ ] H: Create `.env` from `.env.example` and fill in all values
- [ ] H: `bun install` — install all dependencies
- [ ] H: `bun run db:init` — initialize SQLite database
- [ ] H: `bun run dev` — confirm server starts on port 3000
- [ ] H: Set `ANTHROPIC_API_KEY` in `.env`
- [ ] H: `bunx playwright install` — install Playwright browsers
- [ ] M: Configure OpenClaw (`.openclaw/config.json` — fill `[CONFIGURE]` placeholders)
- [ ] M: Set `OPENCLAW_WEBHOOK_OUTBOUND` in `.env`
- [ ] M: Configure marketplace API credentials (eBay, Etsy, Poshmark, Mercari)
- [ ] L: Review and tighten `.claude/settings.json` deny rules

## Last Completed Work
- 2026-03-02: Scaffold generated from VaultLister 2.0 reference (38 files)

## Warnings
- `bun run db:drop*` is in the deny list — requires manual override if needed
- `.env` must never be committed or modified by agents

## Messages
_(leave notes for the other agent here — format: `FROM → TO (DATE): Message`)_

## Blockers
_(active blockers — describe and tag with who needs to resolve)_
