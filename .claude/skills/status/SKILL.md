---
name: status
description: Show VaultLister 3.0 current project status — git, server, tasks, test baseline
trigger: /status
---

# /status — VaultLister 3.0 Status

## Steps

1. **Git status**
   ```
   git log --oneline -5
   git status
   ```

2. **Server check**
   ```
   lsof -ti:3000 && echo "Server running on :3000" || echo "Server not running"
   ```

3. **Test baseline**
   ```
   bun run test:unit --reporter=summary 2>&1 | tail -5
   ```

4. **Pending tasks**
   - Read `memory/STATUS.md` → "Next Tasks" section
   - Summarize top 3 pending items

5. **Update OpenClaw memory**
   Write current state to `.openclaw/memory/context.json`:
   ```json
   {
     "current_task": "[current task description]",
     "branch": "[current branch]",
     "last_updated": "[ISO 8601 timestamp]"
   }
   ```

6. **Notify**
   ```
   bash .claude/hooks/notify-openclaw.sh "milestone" "/status complete — [one-line summary]"
   ```
