# Remaining Work Execution Sheet (2026-04-21)

> **Historical execution snapshot — do not use as the current open-items source of truth.**
> Current consolidated open items are generated in [`docs/OPEN_ITEMS.md`](OPEN_ITEMS.md).
> This sheet remains useful only as evidence for the April 21 dirty-worktree execution plan.

This sheet turns the current dirty-worktree staging plan into exact execution steps.

Use it one subset at a time. Do not run `git add .`.

## Global Rules

Before every subset:

```powershell
git status --short
git diff --cached --stat
```

Never stage these:

```text
.claude/
.playwright-mcp/
.tmp-*
.tmp-stage/
Browserstack Reports/
Platform Logos/
logo/
Realistic_Vault_Animation_Generated.mp4
docs/image-*.png
data/.soak-snapshots.jsonl
k.includes('DATABASE')
status-bars-check.png
status-bars-full.png
*.url
```

## Subset 1: Docs-only Cleanup

Rule:

```text
Never delete historical issues just because they are resolved.
All issue/history items must be kept and marked with an explicit status so they can be manually re-checked later.
Only remove non-issue scratch material such as agent resume commands, localhost instructions, or temporary planning notes.
```

Stage:

```powershell
git add docs/WALKTHROUGH_MASTER_FINDINGS.md memory/STATUS.md
```

Optional extra docs:

```powershell
git add docs/MANUAL_INSPECTION.md docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md docs/SNAPSHOT_CERTIFICATION_REPORT_2026-04-20.md
```

Review:

```powershell
git diff --cached --stat
git diff --cached -- docs/WALKTHROUGH_MASTER_FINDINGS.md memory/STATUS.md
```

Docs review standard:

```text
- Keep issue rows/bullets in place
- Mark all items; do not delete historical issue/history entries
- Mark them with statuses such as OPEN, FIXED, DEPLOYED, VERIFIED, or NEEDS MANUAL CHECK
- Do not publish internal workflow notes or agent session-resume commands
- Do not mark an item VERIFIED unless it has actually been re-checked
```

Commit:

```powershell
git commit -m "docs(audit): update walkthrough and status notes"
```

Push:

```powershell
git push origin master
```

Post-push verification:

```powershell
git ls-remote origin refs/heads/master
```

## Subset 2: Backend / Dev Tooling Hardening

Stage:

```powershell
git add .env.example scripts/build-dev-bundle.js scripts/server-manager.js src/backend/server.js
```

Review:

```powershell
git diff --cached --stat
git diff --cached -- .env.example scripts/build-dev-bundle.js scripts/server-manager.js src/backend/server.js
```

Syntax / local verification:

```powershell
node --check scripts/build-dev-bundle.js
node --check scripts/server-manager.js
node --check src/backend/server.js
bun scripts/build-dev-bundle.js
```

If you want to smoke startup behavior locally:

```powershell
node scripts/server-manager.js
```

Commit:

```powershell
git commit -m "fix(dev): harden startup and bundle version sync"
```

Push:

```powershell
git push origin master
```

Deploy verification:

```powershell
node scripts/post-deploy-check.mjs https://vaultlister.com --json
```

## Subset 3 + 4: Frontend Shell / Settings Redesign + Generated Artifacts

Stage source changes first:

```powershell
git add src/frontend/init.js src/frontend/pages/pages-settings-account.js src/frontend/styles/base.css src/frontend/styles/pages/community-help.css src/frontend/ui/components.js
```

Review source diff:

```powershell
git diff --cached --stat
git diff --cached -- src/frontend/init.js src/frontend/pages/pages-settings-account.js src/frontend/styles/base.css src/frontend/styles/pages/community-help.css src/frontend/ui/components.js
```

Syntax verification:

```powershell
node --check src/frontend/init.js
node --check src/frontend/pages/pages-settings-account.js
node --check src/frontend/ui/components.js
```

Manual local walkthrough before rebuilding artifacts:

```text
/?app=1#account
/?app=1#settings
/?app=1#connections
/?app=1#notifications
/?app=1#help-support
```

Rebuild generated assets:

```powershell
bun scripts/build-dev-bundle.js
bun scripts/build-frontend.js
```

Stage generated artifacts:

```powershell
git add src/frontend/core-bundle.js src/frontend/index.html src/frontend/styles/main.css public/sw.js
```

Review full combined diff:

```powershell
git diff --cached --stat
git diff --cached -- src/frontend/core-bundle.js src/frontend/index.html src/frontend/styles/main.css public/sw.js
```

Commit:

```powershell
git commit -m "feat(frontend): redesign sidebar and settings navigation"
```

Push:

```powershell
git push origin master
```

Post-push verification:

```powershell
bun run test:e2e:public
node scripts/post-deploy-check.mjs https://vaultlister.com --json
```

## Subset 5: Deferred Page Cleanup

Stage:

```powershell
git add src/frontend/pages/pages-deferred.js src/frontend/handlers/handlers-deferred.js
```

Review:

```powershell
git diff --cached --stat
git diff --cached -- src/frontend/pages/pages-deferred.js src/frontend/handlers/handlers-deferred.js
```

Syntax verification:

```powershell
node --check src/frontend/pages/pages-deferred.js
node --check src/frontend/handlers/handlers-deferred.js
```

Manual local verification:

```text
Load the deferred page
Confirm no marketplace_* sort requests fire
Confirm no missing handler/runtime errors
Confirm settings-related deferred UI still loads
```

Commit:

```powershell
git commit -m "fix(frontend): clean deferred page settings and sort residue"
```

Push:

```powershell
git push origin master
```

Post-push verification:

```powershell
node scripts/post-deploy-check.mjs https://vaultlister.com --json
```

## Subset 6: Optional robots.txt Formatting Cleanup

Stage:

```powershell
git add public/robots.txt
```

Review:

```powershell
git diff --cached -- public/robots.txt
```

Commit:

```powershell
git commit -m "chore(public): normalize robots formatting"
```

Push:

```powershell
git push origin master
```

## Recommended Order

1. Subset 1
2. Subset 2
3. Subset 3 + 4 together
4. Subset 5
5. Subset 6 only if still desired

## Final Production Reverification

After any deploy-bearing subset:

```powershell
node scripts/post-deploy-check.mjs https://vaultlister.com --json
bun scripts/launch-ops-check.mjs https://vaultlister.com --task-queue --queue-metrics --json
```
