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

5. **Update STATUS.md**
   - Update "Current State" in `memory/STATUS.md` with current branch, test status, and last commit
